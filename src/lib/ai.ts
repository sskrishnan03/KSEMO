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
- If you don't know something, say so honestly and offer to help find out.
- End naturally, the way a person would, sometimes with a quick follow-up question.`;


// ---------- Live real-time context ----------
// The model has no built-in clock or live weather, so we fetch the facts and
// feed them into the request. This makes "what time is it" / "weather in
// Bangalore" answers real instead of canned or hallucinated.

export interface LiveContext {
  date: string;
  time: string;
  timezone: string;
  weather: string | null;
  note: string;
}

function lastUserText(messages: ChatMessage[]): string {
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i];
    if (m.role !== 'user') continue;
    return typeof m.content === 'string' ? m.content : textFromContent(m.content);
  }
  return '';
}

function isWeatherQuery(p: string): boolean {
  return /(weather|temperature|forecast|raining|rain (today|right now|outside)|humidity|wind speed|windy|like outside|outside like|degrees)/i.test(p);
}

function isTimeQuery(p: string): boolean {
  return /(what time|what's the time|current time|time is it|the time right now|time now|time right now|tell me the time)/i.test(p);
}

function isDateQuery(p: string): boolean {
  return /(what('s| is) the date|today'?s date|what day is (it|today)|current date|what date)/i.test(p);
}

function cleanCity(raw: string): string {
  let c = raw.trim()
    .replace(/[^a-zA-Z .'-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  c = c.replace(/(^|\s)(today|tomorrow|right now|now|here|my city|the city|the weather|what's|whats)(\s|$)/gi, ' ').trim();
  return c;
}

function extractCity(prompt: string): string | null {
  const isCityLike = (c: string | null): c is string => {
    if (!c) return false;
    // A real place name shouldn't be built from filler words ("how is the
    // weather" must not extract "how is the").
    return !/\b(how|is|the|it|like|outside|what|whats|do|does|in|for|here|today|now|around|there|out)\b/i.test(c);
  };
  let m = prompt.match(/\b(?:weather|temperature|forecast|raining|rain)\s+in\s+([A-Z][a-zA-Z .'-]+?)(?:\s+(?:today|tomorrow|right now|now|tonight|this\s+\w+)|[?,.\n]|$)/i);
  if (m) {
    const c = cleanCity(m[1]);
    if (isCityLike(c)) return c;
  }
  m = prompt.match(/\b([A-Z][a-zA-Z .'-]+?)\s+(?:weather|forecast|temperature)\b/i);
  if (m) {
    const c = cleanCity(m[1]);
    if (isCityLike(c)) return c;
  }
  return null;
}

// Live weather via wttr.in — free, no API key. Falls back to IP geolocation
// when no city is given, so "how's the weather" answers for the user's area.
async function fetchWeather(city: string | null): Promise<string | null> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);
    const url = city
      ? `https://wttr.in/${encodeURIComponent(city)}?format=j1`
      : 'https://wttr.in/?format=j1';
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timer);
    if (!res.ok) return null;
    const j = await res.json();
    const cur = j.current_condition?.[0];
    if (!cur) return null;
    const place = j.nearest_area?.[0]?.areaName?.[0]?.value ?? (city ? cleanCity(city) : '');
    const desc = (cur.weatherDesc?.[0]?.value ?? 'clear').toLowerCase();
    return `${place ? place + ': ' : ''}${cur.temp_C}°C, feels like ${cur.FeelsLikeC}°C, ${desc}, humidity ${cur.humidity}%, wind ${cur.windspeedKmph} km/h.`;
  } catch {
    return null;
  }
}

async function buildLiveContext(promptText: string): Promise<LiveContext> {
  const now = new Date();
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'local time';
  const date = now.toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', timeZone: timezone });
  const time = now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true, timeZone: timezone });
  let weather: string | null = null;
  if (isWeatherQuery(promptText)) {
    weather = await fetchWeather(extractCity(promptText));
  }
  const note = [
    'LIVE FACTS (trust these, they are more current than your training data):',
    `Today's date is ${date}. The current time is ${time} (${timezone}).`,
    weather ? `Current weather: ${weather}` : null,
  ].filter(Boolean).join(' ');
  return { date, time, timezone, weather, note };
}

// Grounding with Google Search gives the model live web data for anything, not
// just time/weather. Enabled by default when a Gemini key is present; override
// with VITE_GEMINI_GROUNDING=false, or pick the model with
// VITE_GEMINI_GROUNDING_MODEL.
function groundingEnabled(): boolean {
  const v = (import.meta.env as any).VITE_GEMINI_GROUNDING;
  return v === undefined || v === '' ? true : v !== 'false';
}

function mapModelForGemini(modelName: string, grounding: boolean): string {
  if (grounding) {
    return (import.meta.env as any).VITE_GEMINI_GROUNDING_MODEL || 'gemini-2.5-flash-lite';
  }
  // gemini-flash-lite-latest is fast, cheap and non-thinking, which keeps
  // voice replies quick and avoids burning free-tier quota on hidden thoughts.
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

async function geminiStream(opts: StreamOptions, apiKey: string, start: number, liveNote: string, grounding: boolean): Promise<StreamResult> {
  const model = mapModelForGemini(opts.model, grounding);
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
    body.systemInstruction = { parts: [{ text: systemText + '\n\n' + liveNote }] };
  } else if (liveNote) {
    body.systemInstruction = { parts: [{ text: liveNote }] };
  }
  if (grounding) {
    // Google Search grounding: the model searches the live web when its own
    // knowledge isn't enough, so answers stay current.
    body.tools = [{ googleSearch: {} }];
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
    if (res.status === 401) {
      throw new Error(`Gemini API key is invalid or unauthorized (${res.status}). Please update your API key.`);
    }
    if (res.status === 429) {
      throw new Error(`Gemini API quota exceeded (${res.status}). Please try again later or check your billing.`);
    }
    // Model/tool availability issue (bad model name, no search access, etc.).
    // Retry once on the fast non-grounded model so the app keeps working.
    if (grounding && (res.status === 400 || res.status === 403 || res.status === 404)) {
      return geminiStream(opts, apiKey, start, liveNote, false);
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
  // Build the live facts (current time/date + weather when asked) once so both
  // the Gemini and local paths answer from real, current data.
  const live = await buildLiveContext(lastUserText(opts.messages));

  // The Gemini API key comes only from the .env file (VITE_GEMINI_API_KEY).
  // When a key is configured, never silently fall back to canned local
  // responses: surface the real error so the user knows the key/service
  // needs attention.
  const geminiKey = import.meta.env.VITE_GEMINI_API_KEY;

  if (geminiKey) {
    return await geminiStream(opts, geminiKey, start, live.note, groundingEnabled());
  }

  return localStream(opts, start, live);
}

async function localStream(opts: StreamOptions, start: number, live: LiveContext): Promise<StreamResult> {
  const promptText = lastUserText(opts.messages);
  const liveAnswer = localLiveAnswer(promptText, live);
  const full = liveAnswer ?? generateLocalResponse(promptText, opts.messages as ChatMessage[]);
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

// Direct, conversational answers for time/date/weather when running without a
// Gemini key — never a canned reply for these.
function localLiveAnswer(p: string, live: LiveContext): string | null {
  if (isTimeQuery(p)) {
    return `Right now it's ${live.time}.`;
  }
  if (isDateQuery(p)) {
    return `Today is ${live.date}.`;
  }
  if (isWeatherQuery(p)) {
    if (live.weather) return live.weather;
    return `I couldn't fetch the live weather right now, but ask me again in a moment and I'll try once more.`;
  }
  return null;
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
