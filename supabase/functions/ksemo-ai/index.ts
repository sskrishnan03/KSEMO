import { createClient } from 'npm:@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

interface IncomingMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

interface RequestBody {
  model: string;
  messages: IncomingMessage[];
  temperature?: number;
  max_tokens?: number;
  stream?: boolean;
}

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  { auth: { persistSession: false } },
);

// Map Ksemo model ids to provider-specific model names.
const MODEL_MAP: Record<string, { provider: string; name: string }> = {
  'ksemo-pro': { provider: 'openrouter', name: 'openai/gpt-4o-mini' },
  'ksemo-max': { provider: 'openrouter', name: 'anthropic/claude-3.5-sonnet' },
  'ksemo-fast': { provider: 'openrouter', name: 'openai/gpt-4o-mini' },
  'gpt-4o': { provider: 'openai', name: 'gpt-4o' },
  'gemini-1.5-pro': { provider: 'gemini', name: 'gemini-1.5-pro' },
  'claude-3.5-sonnet': { provider: 'anthropic', name: 'claude-3-5-sonnet-20241022' },
  'grok-2': { provider: 'xai', name: 'grok-2' },
  'deepseek-v3': { provider: 'deepseek', name: 'deepseek-chat' },
  'openrouter-auto': { provider: 'openrouter', name: 'openrouter/auto' },
  'ollama-llama3': { provider: 'ollama', name: 'llama3' },
};

function sse(data: string): string {
  return `data: ${JSON.stringify(data)}\n\n`;
}

async function callOpenAI(model: string, messages: IncomingMessage[], opts: { temperature: number; max_tokens: number }, key: string, stream: boolean, writer: WritableStreamDefaultWriter<Uint8Array>, encoder: TextEncoder) {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
    body: JSON.stringify({ model, messages, temperature: opts.temperature, max_tokens: opts.max_tokens, stream }),
  });
  if (!res.ok) throw new Error(`openai ${res.status}: ${await res.text()}`);
  if (!stream || !res.body) {
    const json = await res.json();
    return json.choices?.[0]?.message?.content ?? '';
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let full = '';
  let buf = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    const lines = buf.split('\n');
    buf = lines.pop() ?? '';
    for (const line of lines) {
      const t = line.trim();
      if (!t.startsWith('data:')) continue;
      const payload = t.slice(5).trim();
      if (payload === '[DONE]') continue;
      try {
        const j = JSON.parse(payload);
        const delta = j.choices?.[0]?.delta?.content ?? '';
        if (delta) {
          full += delta;
          await writer.write(encoder.encode(sse({ delta })));
        }
      } catch { /* skip */ }
    }
  }
  return full;
}

async function callOpenRouter(model: string, messages: IncomingMessage[], opts: { temperature: number; max_tokens: number }, key: string, stream: boolean, writer: WritableStreamDefaultWriter<Uint8Array>, encoder: TextEncoder) {
  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
    body: JSON.stringify({ model, messages, temperature: opts.temperature, max_tokens: opts.max_tokens, stream }),
  });
  if (!res.ok) throw new Error(`openrouter ${res.status}: ${await res.text()}`);
  if (!stream || !res.body) {
    const json = await res.json();
    return json.choices?.[0]?.message?.content ?? '';
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let full = '';
  let buf = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    const lines = buf.split('\n');
    buf = lines.pop() ?? '';
    for (const line of lines) {
      const t = line.trim();
      if (!t.startsWith('data:')) continue;
      const payload = t.slice(5).trim();
      if (payload === '[DONE]') continue;
      try {
        const j = JSON.parse(payload);
        const delta = j.choices?.[0]?.delta?.content ?? '';
        if (delta) {
          full += delta;
          await writer.write(encoder.encode(sse({ delta })));
        }
      } catch { /* skip */ }
    }
  }
  return full;
}

async function callAnthropic(model: string, messages: IncomingMessage[], opts: { temperature: number; max_tokens: number }, key: string, stream: boolean, writer: WritableStreamDefaultWriter<Uint8Array>, encoder: TextEncoder) {
  const system = messages.filter((m) => m.role === 'system').map((m) => m.content).join('\n');
  const chat = messages.filter((m) => m.role !== 'system');
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({ model, system, messages: chat, temperature: opts.temperature, max_tokens: opts.max_tokens, stream }),
  });
  if (!res.ok) throw new Error(`anthropic ${res.status}: ${await res.text()}`);
  if (!stream || !res.body) {
    const json = await res.json();
    return json.content?.[0]?.text ?? '';
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let full = '';
  let buf = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    const lines = buf.split('\n');
    buf = lines.pop() ?? '';
    for (const line of lines) {
      const t = line.trim();
      if (!t.startsWith('data:')) continue;
      try {
        const j = JSON.parse(t.slice(5).trim());
        if (j.type === 'content_block_delta' && j.delta?.text) {
          full += j.delta.text;
          await writer.write(encoder.encode(sse({ delta: j.delta.text })));
        }
      } catch { /* skip */ }
    }
  }
  return full;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const body = (await req.json()) as RequestBody;
    const model = MODEL_MAP[body.model] ?? { provider: 'openrouter', name: 'openrouter/auto' };
    const messages = body.messages ?? [];
    const opts = { temperature: body.temperature ?? 0.7, max_tokens: body.max_tokens ?? 2048 };
    const stream = body.stream !== false;

    // Resolve a provider key from edge function secrets.
    const keyEnv: Record<string, string> = {
      openai: 'OPENAI_API_KEY',
      openrouter: 'OPENROUTER_API_KEY',
      anthropic: 'ANTHROPIC_API_KEY',
      xai: 'XAI_API_KEY',
      deepseek: 'DEEPSEEK_API_KEY',
      gemini: 'GEMINI_API_KEY',
      ollama: 'OLLAMA_HOST',
    };
    const key = Deno.env.get(keyEnv[model.provider]) ?? '';

    // No key configured -> return a 503 so the client falls back to local engine.
    if (!key) {
      return new Response(JSON.stringify({ error: 'no_provider_key', provider: model.provider }), {
        status: 503,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Stream responses back to the client as SSE.
    const { readable, writable } = new TransformStream();
    const writer = writable.getWriter();
    const encoder = new TextEncoder();

    (async () => {
      try {
        let full = '';
        if (model.provider === 'openai') {
          full = await callOpenAI(model.name, messages, opts, key, stream, writer, encoder);
        } else if (model.provider === 'openrouter') {
          full = await callOpenRouter(model.name, messages, opts, key, stream, writer, encoder);
        } else if (model.provider === 'anthropic') {
          full = await callAnthropic(model.name, messages, opts, key, stream, writer, encoder);
        } else {
          // Other providers fall back to OpenRouter-compatible call shape.
          full = await callOpenRouter(model.name, messages, opts, key, stream, writer, encoder);
        }

        // Log usage (best-effort).
        const authHeader = req.headers.get('Authorization') ?? '';
        const userClient = createClient(
          Deno.env.get('SUPABASE_URL') ?? '',
          Deno.env.get('SUPABASE_ANON_KEY') ?? '',
          { auth: { persistSession: false }, global: { headers: { Authorization: authHeader } } },
        );
        await userClient.from('ai_usage').insert({
          model: body.model,
          prompt_tokens: Math.ceil(messages.reduce((a, m) => a + m.content.length, 0) / 4),
          completion_tokens: Math.ceil(full.length / 4),
          latency_ms: 0,
        }).then(({ error }) => { if (error) console.warn('usage log failed', error.message); });

        await writer.write(encoder.encode('data: [DONE]\n\n'));
        void supabase;
      } catch (err) {
        await writer.write(encoder.encode(sse({ error: (err as Error).message })));
      } finally {
        await writer.close();
      }
    })();

    return new Response(readable, {
      headers: { ...corsHeaders, 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
