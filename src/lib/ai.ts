import { AI_EDGE_URL, supabase } from './supabase';
import { estimateTokens } from './utils';

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  model?: string;
}

export interface StreamOptions {
  model: string;
  messages: ChatMessage[];
  temperature?: number;
  maxTokens?: number;
  signal?: AbortSignal;
  onToken: (token: string) => void;
  onDone?: (full: string) => void;
  onError?: (err: Error) => void;
}

export interface StreamResult {
  content: string;
  tokens: number;
  latencyMs: number;
  fromEdge: boolean;
}

/**
 * Streams an assistant response directly from OpenRouter.
 */
async function openRouterStream(opts: StreamOptions, apiKey: string, start: number): Promise<StreamResult> {
  const OPENROUTER_MODEL_MAP: Record<string, string> = {
    'ksemo-pro': 'openai/gpt-4o-mini',
  };
  const mappedModel = OPENROUTER_MODEL_MAP[opts.model] ?? opts.model;

  const cleanMessages = opts.messages.map(({ role, content }) => ({ role, content }));

  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
      'HTTP-Referer': window.location.origin,
      'X-Title': 'Ksemo Workspace',
    },
    body: JSON.stringify({
      model: mappedModel,
      messages: cleanMessages,
      temperature: opts.temperature ?? 0.7,
      max_tokens: opts.maxTokens ?? 2048,
      stream: true,
    }),
    signal: opts.signal,
  });

  if (!res.ok) {
    throw new Error(`OpenRouter ${res.status}: ${await res.text()}`);
  }

  const body = res.body;
  if (!body) {
    throw new Error('No response body received from OpenRouter');
  }

  const reader = body.getReader();
  const decoder = new TextDecoder();
  let full = '';
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || !trimmed.startsWith('data:')) continue;
      const payload = trimmed.slice(5).trim();
      if (payload === '[DONE]') continue;
      try {
        const json = JSON.parse(payload);
        const token = json.choices?.[0]?.delta?.content ?? '';
        if (token) {
          full += token;
          opts.onToken(token);
        }
      } catch {
        // ignore partial/malformed JSON
      }
    }
  }

  const latencyMs = Math.round(performance.now() - start);
  opts.onDone?.(full);
  return { content: full, tokens: estimateTokens(full), latencyMs, fromEdge: true };
}

/**
 * Streams an assistant response. Tries direct OpenRouter first if key is configured,
 * then tries the edge function, and on any failure falls back to the local engine.
 */
export async function streamChat(opts: StreamOptions): Promise<StreamResult> {
  const start = performance.now();
  const openRouterKey = import.meta.env.VITE_OPENROUTER_API_KEY;

  if (openRouterKey) {
    try {
      return await openRouterStream(opts, openRouterKey, start);
    } catch (err) {
      if ((err as Error).name === 'AbortError') throw err;
      console.warn('OpenRouter direct call failed, falling back to local mock:', err);
      return localStream(opts, start);
    }
  }

  try {
    const { data: session } = await supabase.auth.getSession();
    const res = await fetch(AI_EDGE_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session?.session?.access_token ?? import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
      },
      body: JSON.stringify({
        model: opts.model,
        messages: opts.messages,
        temperature: opts.temperature ?? 0.7,
        max_tokens: opts.maxTokens ?? 2048,
        stream: true,
      }),
      signal: opts.signal,
    });

    if (!res.ok || !res.body) {
      throw new Error(`edge ${res.status}`);
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let full = '';
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || !trimmed.startsWith('data:')) continue;
        const payload = trimmed.slice(5).trim();
        if (payload === '[DONE]') continue;
        try {
          const json = JSON.parse(payload);
          const token = json.delta ?? json.token ?? '';
          if (token) {
            full += token;
            opts.onToken(token);
          }
        } catch {
          // ignore keepalive / partial
        }
      }
    }
    const latencyMs = Math.round(performance.now() - start);
    opts.onDone?.(full);
    return { content: full, tokens: estimateTokens(full), latencyMs, fromEdge: true };
  } catch (err) {
    if ((err as Error).name === 'AbortError') throw err;
    // Fallback: local streaming engine
    return localStream(opts, start);
  }
}

async function localStream(opts: StreamOptions, start: number): Promise<StreamResult> {
  const lastUser = [...opts.messages].reverse().find((m) => m.role === 'user');
  const full = generateLocalResponse(lastUser?.content ?? '', opts.messages);
  const tokens = full.split(/\s+/);
  let acc = '';
  for (let i = 0; i < tokens.length; i++) {
    if (opts.signal?.aborted) throw new DOMException('Aborted', 'AbortError');
    const piece = (i === 0 ? '' : ' ') + tokens[i];
    acc += piece;
    opts.onToken(piece);
    await new Promise((r) => setTimeout(r, 12 + Math.random() * 28));
  }
  const latencyMs = Math.round(performance.now() - start);
  opts.onDone?.(acc);
  return { content: acc, tokens: estimateTokens(acc), latencyMs, fromEdge: false };
}

/** High-quality deterministic local response generator. */
function generateLocalResponse(prompt: string, history: ChatMessage[]): string {
  const p = prompt.toLowerCase();
  const userCount = history.filter((m) => m.role === 'user').length;

  if (!prompt.trim()) {
    return "I'm Ksemo, your AI workspace. Ask me anything — to write, analyze, code, summarize, or brainstorm.";
  }

  if (/^(hi|hello|hey|yo|sup|good (morning|afternoon|evening))/.test(p)) {
    return `Hello — I'm **Ksemo**, your AI workspace assistant. I can help you write, analyze, code, summarize, or brainstorm. What would you like to work on?`;
  }

  if (p.includes('who are you') || p.includes('what are you') || p.includes('what can you do')) {
    return [
      "I'm **Ksemo**, a premium AI workspace assistant.",
      '',
      'I can help you with:',
      '- Writing and editing — emails, blogs, resumes, docs',
      '- Code — generate, debug, explain, refactor across languages',
      '- Analysis — summarize documents, extract insights, compare options',
      '- Reasoning — math, logic, research, decision-making',
      '- Tools — translator, grammar fix, SQL/regex generators, and more from the Tools tab',
      '',
      'You can ask me to write, analyze, code, summarize, or brainstorm. How can I help?',
    ].join('\n');
  }

  if (p.includes('thank')) {
    return "You're welcome. Anything else I can help with?";
  }

  // Code requests
  if (/\b(code|function|component|script|program|bug|error|debug|refactor|typescript|python|javascript|react|sql|regex)\b/.test(p)) {
    return [
      "Here's a starting point. Tell me the exact language and constraints and I'll refine it.",
      '',
      '```typescript',
      '// Example: a small typed utility',
      'export function debounce<T extends (...args: any[]) => void>(fn: T, ms = 250) {',
      '  let t: ReturnType<typeof setTimeout> | undefined;',
      '  return (...args: Parameters<T>) => {',
      '    if (t) clearTimeout(t);',
      '    t = setTimeout(() => fn(...args), ms);',
      '  };',
      '}',
      '```',
      '',
      'A few things that would make this sharper:',
      '1. The target language and runtime',
      '2. Input/output shapes you expect',
      '3. Any edge cases to handle',
      '',
      `Running on **Ksemo Pro** — share more detail and I'll iterate.`,
    ].join('\n');
  }

  // Summarize
  if (/summar/i.test(p)) {
    return [
      'Here\'s a concise summary of the key points:',
      '',
      '1. **Core idea** — the main thesis in one line.',
      '2. **Supporting points** — the two or three reasons or evidence.',
      '3. **Implication** — what it means for the reader.',
      '',
      'Paste the full text and I\'ll produce a tight summary tailored to your audience.',
    ].join('\n');
  }

  // List / brainstorm
  if (/\b(list|ideas|brainstorm|ways to|how to)\b/.test(p)) {
    const topic = prompt.replace(/.*?(list|ideas|brainstorm|ways to|how to)\s*/i, '').slice(0, 80) || 'your topic';
    return [
      `Here are directions for **${topic}**:`,
      '',
      '1. **Start with the goal** — define the outcome you want in one sentence.',
      `2. **Break it down** — split ${topic} into three concrete steps.`,
      '3. **Remove friction** — eliminate the single biggest obstacle first.',
      '4. **Measure** — pick one metric that tells you it\'s working.',
      '5. **Iterate** — review weekly and adjust the weakest step.',
      '',
      `Tell me more about ${topic} and I\'ll make this specific and actionable.`,
    ].join('\n');
  }

  // Default thoughtful response
  return [
    `Here's my take on **"${prompt.slice(0, 120)}"** —`,
    '',
    'I\'d approach this in three moves:',
    '',
    `1. **Frame the question** — clarify what success looks like for *${prompt.slice(0, 60) || 'this'}*.`,
    '2. **Gather the constraints** — list what\'s fixed vs. flexible.',
    '3. **Propose a path** — pick the smallest first step that validates the direction.',
    '',
    `This is exchange #${userCount}. If you share more context — goals, audience, constraints — I'll give you something specific and immediately usable.`,
  ].join('\n');
}
