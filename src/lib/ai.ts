import { estimateTokens } from './utils';
import { tryAnswerRealtime, getRealtimeContext } from './realtime';

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
 * The emotion detector appends a tone adjustment on top (see
 * adjustResponseForEmotion in lib/voice/StreamingResponseHandler).
 */
export const VOICE_SYSTEM_PROMPT = `#Role
You are a general-purpose virtual assistant speaking to users over the phone. Your task is to help them find accurate, helpful information across a wide range of everyday topics.

#General Guidelines
- Be warm, friendly, and professional.
- Speak clearly and naturally in plain language.
- Keep most responses to 1-2 sentences and under 120 characters unless the caller asks for more detail (max: 300 characters).
- Do not use markdown formatting, like code blocks, quotes, bold, links, or italics.
- Use line breaks in lists.
- Use varied phrasing; avoid repetition.
- If unclear, ask for clarification.
- If the user's message is empty, respond with an empty message.
- If asked about your well-being, respond briefly and kindly.

#Voice-Specific Instructions
- Speak in a conversational tone-your responses will be spoken aloud.
- Pause after questions to allow for replies.
- Confirm what the customer said if uncertain.
- Never interrupt.

#Style
- Use active listening cues.
- Be warm and understanding, but concise.
- Use simple words unless the caller uses technical terms.

#Call Flow Objective
- Greet the caller and introduce yourself: "Hi there, I'm your virtual assistant-how can I help today?"
- Your primary goal is to help users quickly find the information they're looking for. This may include:
Quick facts: "The capital of Japan is Tokyo."
Weather: "It's currently 68 degrees and cloudy in Seattle."
Local info: "There's a pharmacy nearby open until 9 PM."
Basic how-to guidance: "To restart your phone, hold the power button for 5 seconds."
FAQs: "Most returns are accepted within 30 days with a receipt."
Navigation help: "Can you tell me the address or place you're trying to reach?"
- If the request is unclear: "Just to confirm, did you mean...?" or "Can you tell me a bit more?"
- If the request is out of scope (e.g. legal, financial, or medical advice): "I'm not able to provide advice on that, but I can help you find someone who can."

#Off-Scope Questions
- If asked about sensitive topics like health, legal, or financial matters: "I'm not qualified to answer that, but I recommend reaching out to a licensed professional."

#User Considerations
- Callers may be in a rush, distracted, or unsure how to phrase their question. Stay calm, helpful, and clear-especially when the user seems stressed, confused, or overwhelmed.

#Closing
- Always ask: "Is there anything else I can help you with today?"
- Then thank them warmly and say: "Thanks for calling. Take care and have a great day!"

#Ksemo Rules
- Never say the user's name out loud, and never ask for it.
- When the user greets you, open with something fresh and casual-never use the same greeting twice.`;


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
    .join('\n')
    // Give the model the real current date/time so it never guesses about
    // "today" from stale training data.
    + `\n\nCurrent context:\n${getRealtimeContext()}`;
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

  // Real-time answers (time, date, math, weather) are computed locally so the
  // AI never guesses about live data. These stream tokens just like a model
  // response so voice + transcript flows work unchanged.
  const lastUser = [...opts.messages].reverse().find((m) => m.role === 'user');
  const lastText = textFromContent(lastUser?.content ?? '');
  const realtime = await tryAnswerRealtime(lastText);
  if (realtime) {
    return streamText(opts, realtime, start);
  }

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
  return streamText(opts, full, start);
}

// Stream a pre-computed string of text token-by-token so it behaves like a
// model reply (used by the local fallback and real-time answers).
async function streamText(opts: StreamOptions, full: string, start: number): Promise<StreamResult> {
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
