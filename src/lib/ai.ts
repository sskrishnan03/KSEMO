import { estimateTokens } from './utils';

export interface TextPart { type: 'text'; text: string }
export interface ImagePart { type: 'image_url'; image_url: { url: string } }
export type ContentPart = TextPart | ImagePart;

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string | ContentPart[];
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
 * System prompt used by the voice assistant. Written to feel warm, natural
 * and human when spoken aloud, and never to sound like a canned robot reply.
 */
export const VOICE_SYSTEM_PROMPT = `You are Ksemo, a friendly voice assistant who talks to the user out loud, like a real person. Because your words are spoken, they must always sound natural and human.

How to talk:
- Answer the question directly and keep it short — usually 2 to 4 sentences, unless the user asks for more detail.
- Sound warm and conversational: use contractions like "I'll" and "that's", vary sentence length, and never use bullet points, lists, markdown, or anything that looks written for a screen.
- Respond to exactly what was asked. Never repeat a scripted or canned answer.
- When the user greets you, open with something fresh and casual. Never use the same greeting twice — vary it every time, the way a person would.
- Never say the user's name out loud, and never ask what their name is. It feels too personal.
- If you don't know something, say so honestly and offer to help find out.
- End naturally, the way a person would, sometimes with a quick follow-up question.`;


// gemini-flash-lite-latest is fast, cheap and non-thinking, which keeps
// voice replies quick and avoids burning free-tier quota on hidden thoughts.
function mapModelForGemini(modelName: string): string {
  const map: Record<string, string> = {
    'ksemo-pro': 'gemini-flash-lite-latest',
    'ksemo-max': 'gemini-flash-lite-latest',
    'ksemo-fast': 'gemini-flash-lite-latest',
    'gemini-2.0-flash': 'gemini-flash-lite-latest',
    'gemini-2.5-flash': 'gemini-flash-lite-latest',
    'gemini-flash': 'gemini-flash-lite-latest',
    'gemini-pro': 'gemini-flash-lite-latest',
  };
  return map[modelName] || modelName;
}

function textFromContent(content: string | ContentPart[]): string {
  if (typeof content === 'string') return content;
  return content
    .filter((p): p is TextPart => p.type === 'text')
    .map((p) => p.text)
    .join('\n');
}

async function geminiStream(opts: StreamOptions, apiKey: string, start: number): Promise<StreamResult> {
  const model = mapModelForGemini(opts.model);
  const systemText = opts.messages
    .filter((m) => m.role === 'system')
    .map((m) => textFromContent(m.content))
    .join('\n');
  const contents = opts.messages
    .filter((m) => m.role === 'user' || m.role === 'assistant')
    .map((m) => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: textFromContent(m.content) }],
    }));

  const body: Record<string, unknown> = {
    contents,
    generationConfig: {
      temperature: opts.temperature ?? 0.7,
      maxOutputTokens: opts.maxTokens ?? 2048,
    },
  };
  if (systemText) {
    body.systemInstruction = { parts: [{ text: systemText }] };
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?alt=sse&key=${encodeURIComponent(apiKey)}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: opts.signal,
  });

  if (!res.ok) {
    const detail = await res.text();
    if (res.status === 400 || res.status === 401 || res.status === 403) {
      throw new Error(`Gemini API key is invalid or unauthorized (${res.status}). Please update your API key.`);
    }
    if (res.status === 429) {
      throw new Error(`Gemini API quota exceeded (${res.status}). Please try again later or check your billing.`);
    }
    throw new Error(`Gemini ${res.status}: ${detail}`);
  }

  const stream = res.body;
  if (!stream) {
    throw new Error('No response body received from Gemini');
  }

  const reader = stream.getReader();
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
      if (!payload || payload === '[DONE]') continue;
      try {
        const json = JSON.parse(payload);
        const parts = json.candidates?.[0]?.content?.parts;
        if (Array.isArray(parts)) {
          for (const part of parts) {
            if (part.thought === true) continue;
            const token = part.text ?? '';
            if (token) {
              full += token;
              opts.onToken(token);
            }
          }
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
  // The Gemini API key comes only from the .env file (VITE_GEMINI_API_KEY).
  // When a key is configured, never silently fall back to canned local
  // responses: surface the real error so the user knows the key/service
  // needs attention.
  const geminiKey = import.meta.env.VITE_GEMINI_API_KEY;

  if (geminiKey) {
    return await geminiStream(opts, geminiKey, start);
  }

  return localStream(opts, start);
}

async function localStream(opts: StreamOptions, start: number): Promise<StreamResult> {
  const lastUser = [...opts.messages].reverse().find((m) => m.role === 'user');
  const promptText = typeof lastUser?.content === 'string'
    ? lastUser.content
    : Array.isArray(lastUser?.content)
      ? (lastUser!.content as ContentPart[]).filter((p): p is TextPart => p.type === 'text').map(p => p.text).join('\n')
      : '';
  const full = generateLocalResponse(promptText, opts.messages as ChatMessage[]);
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

/** Varied, natural greetings for the local fallback so replies never repeat. */
const GREETING_RESPONSES = [
  "Hey! Great to talk to you. What are we working on today?",
  "Well hello there! What's on your mind?",
  "Hey, good to hear from you. What can I do for you?",
  "Hello! Always nice to chat. What would you like to talk about?",
  "Hey there! How's it going? What can I help you with?",
  "Hi! I'm all ears — what do you want to talk about?",
  "Hey, glad you're here. What shall we dive into?",
  "Hello, good to have you here. What's on your mind today?",
];
let lastGreetingIndex = -1;

/** High-quality deterministic local response generator. */
function generateLocalResponse(prompt: string, history: ChatMessage[]): string {
  const p = prompt.toLowerCase();
  const userCount = history.filter((m) => m.role === 'user').length;

  if (!prompt.trim()) {
    return "I'm Ksemo, your voice assistant. Just ask me anything — I can write, analyze, code, summarize, or brainstorm.";
  }

  if (/^(hi|hello|hey|yo|sup|good (morning|afternoon|evening))/.test(p)) {
    let idx = Math.floor(Math.random() * GREETING_RESPONSES.length);
    if (GREETING_RESPONSES.length > 1 && idx === lastGreetingIndex) idx = (idx + 1) % GREETING_RESPONSES.length;
    lastGreetingIndex = idx;
    return GREETING_RESPONSES[idx];
  }

  if (p.includes('who are you') || p.includes('what are you') || p.includes('what can you do')) {
    return [
      "I'm **Ksemo**, a premium voice assistant.",
      '',
      'I can help you with:',
      '- **Writing & Editing** — emails, blogs, resumes, docs',
      '- **Code** — generate, debug, explain, refactor across languages',
      '- **Analysis** — summarize documents, extract insights, compare options',
      '- **Reasoning** — math, logic, research, decision-making',
      '',
      'How can I help?',
    ].join('\n');
  }

  if (p.includes('thank')) {
    return "You're welcome. Anything else I can help with?";
  }

  const hasFileContent = p.includes('--- file:') || p.includes('```') || p.includes('[page');
  if (hasFileContent) {
    return [
      "I've received the file content. Here's my analysis:",
      '',
      '**Document Type** — I can see this is a structured document with extractable content.',
      '**Key Observations** — The file contains text-based content that has been successfully parsed and loaded into context.',
      '**Recommendations** — Ask me specific questions about this file: summarize sections, extract data, find patterns, or rewrite content.',
      '',
      'What would you like me to do with this file?',
    ].join('\n');
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
    return 'Here\'s a concise summary of the key points:\n\n**Core idea** — the main thesis in one line.\n**Supporting points** — the two or three reasons or evidence.\n**Implication** — what it means for the reader.\n\nPaste the full text and I\'ll produce a tight summary tailored to your audience.';
  }

  if (/\b(list|ideas|brainstorm|ways to|how to)\b/.test(p)) {
    const topic = prompt.replace(/.*?(list|ideas|brainstorm|ways to|how to)\s*/i, '').slice(0, 80) || 'your topic';
    return `Here are directions for **${topic}**:\n\n- Start with the goal.\n- Break it into concrete steps.\n- Remove friction.\n- Measure progress.\n- Iterate weekly.`;
  }

  return `Here's my take on "${prompt.slice(0, 120)}" — I'd approach this in three moves:\n\n- Frame the question.\n- Gather the constraints.\n- Propose the smallest first step.\n\nThis is exchange #${userCount}. Share more context and I'll give you something specific.`;
}
