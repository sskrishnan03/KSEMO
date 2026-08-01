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

// Map Ksemo model ids to Google Gemini model names.
// gemini-flash-lite-latest is fast, cheap and non-thinking.
const MODEL_MAP: Record<string, string> = {
  'ksemo-pro': 'gemini-flash-lite-latest',
  'ksemo-max': 'gemini-flash-lite-latest',
  'ksemo-fast': 'gemini-flash-lite-latest',
  'gemini-2.0-flash': 'gemini-flash-lite-latest',
  'gemini-flash': 'gemini-flash-lite-latest',
};

function sse(data: unknown): string {
  return `data: ${JSON.stringify(data)}\n\n`;
}

async function callGemini(
  model: string,
  messages: IncomingMessage[],
  opts: { temperature: number; max_tokens: number },
  key: string,
  stream: boolean,
  writer: WritableStreamDefaultWriter<Uint8Array>,
  encoder: TextEncoder,
): Promise<string> {
  const systemText = messages.filter((m) => m.role === 'system').map((m) => m.content).join('\n');
  const contents = messages
    .filter((m) => m.role === 'user' || m.role === 'assistant')
    .map((m) => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    }));

  const body: Record<string, unknown> = {
    contents,
    generationConfig: {
      temperature: opts.temperature,
      maxOutputTokens: opts.max_tokens,
    },
  };
  if (systemText) {
    body.systemInstruction = { parts: [{ text: systemText }] };
  }

  const base = `https://generativelanguage.googleapis.com/v1beta/models/${model}`;
  const url = stream
    ? `${base}:streamGenerateContent?alt=sse&key=${encodeURIComponent(key)}`
    : `${base}:generateContent?key=${encodeURIComponent(key)}`;

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`gemini ${res.status}: ${await res.text()}`);

  if (!stream) {
    const json = await res.json();
    const parts = json?.candidates?.[0]?.content?.parts ?? [];
    return parts.map((p: { text?: string }) => p.text ?? '').join('');
  }

  const reader = res.body?.getReader();
  if (!reader) return '';
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
      if (!payload || payload === '[DONE]') continue;
      try {
        const j = JSON.parse(payload);
        const parts = j.candidates?.[0]?.content?.parts ?? [];
        for (const part of parts) {
          if (part.thought === true) continue;
          const delta = part.text ?? '';
          if (delta) {
            full += delta;
            await writer.write(encoder.encode(sse({ delta })));
          }
        }
      } catch {
        // skip malformed chunk
      }
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
    const model = MODEL_MAP[body.model] ?? 'gemini-flash-lite-latest';
    const messages = body.messages ?? [];
    const opts = { temperature: body.temperature ?? 0.7, max_tokens: body.max_tokens ?? 2048 };
    const stream = body.stream !== false;

    const key = Deno.env.get('GEMINI_API_KEY') ?? '';

    // No key configured -> return a 503 so the client falls back to local engine.
    if (!key) {
      return new Response(JSON.stringify({ error: 'no_provider_key', provider: 'gemini' }), {
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
        const full = await callGemini(model, messages, opts, key, stream, writer, encoder);

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
        }).then(({ error }: { error: { message: string } | null }) => { if (error) console.warn('usage log failed', error.message); });

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
