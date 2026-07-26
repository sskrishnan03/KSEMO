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


function mapModelForOpenRouter(modelName: string): string {
  const map: Record<string, string> = {
    'ksemo-pro': 'openai/gpt-4o-mini',
    'ksemo-max': 'anthropic/claude-3.5-sonnet',
    'ksemo-fast': 'openai/gpt-4o-mini',
    'gpt-4o': 'openai/gpt-4o',
    'gemini-1.5-pro': 'google/gemini-pro',
    'claude-3.5-sonnet': 'anthropic/claude-3.5-sonnet',
    'grok-2': 'xai/grok-2',
    'deepseek-v3': 'deepseek/deepseek-chat',
  };
  return map[modelName] || modelName;
}

async function openRouterStream(opts: StreamOptions, apiKey: string, start: number): Promise<StreamResult> {
  const cleanMessages = opts.messages.map(({ role, content }) => ({ role, content }));

  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
      'HTTP-Referer': window.location.origin,
      'X-Title': 'Ksemo AI Workspace',
    },
    body: JSON.stringify({
      model: mapModelForOpenRouter(opts.model),
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

export async function streamChat(opts: StreamOptions): Promise<StreamResult> {
  const start = performance.now();
  const openRouterKey = import.meta.env.VITE_OPENROUTER_API_KEY ||
    localStorage.getItem('ksemo_openrouter_api_key');

  if (openRouterKey) {
    try {
      return await openRouterStream(opts, openRouterKey, start);
    } catch (err) {
      if ((err as Error).name === 'AbortError') throw err;
      console.warn('OpenRouter call failed, falling back to local:', err);
      return localStream(opts, start);
    }
  }

  return localStream(opts, start);
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
      '',
      'How can I help?',
    ].join('\n');
  }

  if (p.includes('thank')) {
    return "You're welcome. Anything else I can help with?";
  }

  if (/\b(code|function|component|script|program|bug|error|debug|refactor|typescript|python|javascript|react|sql|regex)\b/.test(p)) {
    return [
      "Here's a starting point. Tell me the exact language and constraints and I'll refine it.",
      '',
      '```typescript',
      'export function debounce<T extends (...args: any[]) => void>(fn: T, ms = 250) {',
      '  let t: ReturnType<typeof setTimeout> | undefined;',
      '  return (...args: Parameters<T>) => {',
      '    if (t) clearTimeout(t);',
      '    t = setTimeout(() => fn(...args), ms);',
      '  };',
      '}',
      '```',
    ].join('\n');
  }

  if (/summar/i.test(p)) {
    return 'Here\'s a concise summary of the key points:\n\n1. **Core idea** — the main thesis in one line.\n2. **Supporting points** — the two or three reasons or evidence.\n3. **Implication** — what it means for the reader.\n\nPaste the full text and I\'ll produce a tight summary tailored to your audience.';
  }

  if (/\b(list|ideas|brainstorm|ways to|how to)\b/.test(p)) {
    const topic = prompt.replace(/.*?(list|ideas|brainstorm|ways to|how to)\s*/i, '').slice(0, 80) || 'your topic';
    return `Here are directions for **${topic}**:\n\n1. Start with the goal.\n2. Break it into concrete steps.\n3. Remove friction.\n4. Measure progress.\n5. Iterate weekly.`;
  }

  return `Here's my take on "${prompt.slice(0, 120)}" — I'd approach this in three moves:\n\n1. Frame the question.\n2. Gather the constraints.\n3. Propose the smallest first step.\n\nThis is exchange #${userCount}. Share more context and I'll give you something specific.`;
}
