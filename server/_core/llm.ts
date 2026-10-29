import { ENV } from "./env";

export type Role = "system" | "user" | "assistant" | "tool" | "function";

export type TextContent = {
  type: "text";
  text: string;
};

export type ImageContent = {
  type: "image_url";
  image_url: {
    url: string;
    detail?: "auto" | "low" | "high";
  };
};

export type FileContent = {
  type: "file_url";
  file_url: {
    url: string;
    mime_type?: "application/pdf" | "video/mp4";
  };
};

export type MessageContent = string | TextContent | ImageContent | FileContent;

export type Message = {
  role: Role;
  content: MessageContent | MessageContent[];
  name?: string;
  tool_call_id?: string;
};

export type Tool = {
  type: "function";
  function: {
    name: string;
    description?: string;
    parameters?: Record<string, unknown>;
  };
};

export type ToolChoicePrimitive = "none" | "auto" | "required";
export type ToolChoiceByName = { name: string };
export type ToolChoiceExplicit = {
  type: "function";
  function: {
    name: string;
  };
};

export type ToolChoice =
  | ToolChoicePrimitive
  | ToolChoiceByName
  | ToolChoiceExplicit;

export type InvokeParams = {
  messages: Message[];
  tools?: Tool[];
  toolChoice?: ToolChoice;
  tool_choice?: ToolChoice;
  maxTokens?: number;
  max_tokens?: number;
  outputSchema?: OutputSchema;
  output_schema?: OutputSchema;
  responseFormat?: ResponseFormat;
  response_format?: ResponseFormat;
  model?: string;
  temperature?: number;
  reasoning_effort?: "minimal" | "low" | "medium" | "high";
  thinking?: Record<string, unknown>;
  reasoning?: Record<string, unknown>;
  signal?: AbortSignal;
};

export type StreamDelta = {
  type: "delta";
  delta: string;
};

// ---------------------------------------------------------------------------
// Assistant-text sanitization
//
// Some Gemini OpenAI-compatible streams emit internal placeholders like
// "[blocked]" inside a delta when the safety filter truncates part of a
// response. These are provider implementation markers, never legitimate user
// content, so they must not reach the chat UI. We strip them at the stream
// boundary and log the occurrence server-side; the client renderer additionally
// sanitizes final text so a marker that spans two deltas can never leak either.
// ---------------------------------------------------------------------------

// Matches `[blocked]` / `[error]` / `[failed]` / `[undefined]` / `[null]` /
// `[object Object]` (case-insensitive). A run of 2+ ellipsis dots adjacent to
// the marker (either side) is a truncation artifact and is stripped with it; a
// single leading period or full stop is real sentence punctuation and survives.
const INTERNAL_MARKER =
  /\[(?:blocked|error|failed|undefined|null|object\s+object)\]/gi;
const MARKER_WITH_PREFIXED_ELLIPSIS =
  /[.。…]{2,}\s*\[(?:blocked|error|failed|undefined|null|object\s+object)\]/gi;
const MARKER_WITH_TRAILING_ELLIPSIS =
  /\[(?:blocked|error|failed|undefined|null|object\s+object)\]\s*[.。…]{2,}/gi;

let lastMarkerLogAt = 0;

function logMarkerStripped(): void {
  const now = Date.now();
  if (now - lastMarkerLogAt > 1_000) {
    lastMarkerLogAt = now;
    console.warn(
      "[llm] Stripped an internal marker (e.g. [blocked]) from assistant output."
    );
  }
}

/**
 * Removes internal implementation markers from assistant streaming delta.
 * Crucially preserves leading and trailing spaces so tokens stitch together cleanly.
 */
export function sanitizeAssistantDelta(delta: string): string {
  if (!delta) return delta;
  return delta
    .replace(MARKER_WITH_PREFIXED_ELLIPSIS, "")
    .replace(MARKER_WITH_TRAILING_ELLIPSIS, "")
    .replace(INTERNAL_MARKER, "");
}

/**
 * Removes internal implementation markers from assistant text. Returns the
 * sanitized string; empty input is returned unchanged.
 */
export function sanitizeAssistantText(text: string): string {
  if (!text) return text;
  let cleaned = text
    .replace(MARKER_WITH_PREFIXED_ELLIPSIS, () => {
      logMarkerStripped();
      return "";
    })
    .replace(MARKER_WITH_TRAILING_ELLIPSIS, () => {
      logMarkerStripped();
      return "";
    })
    .replace(INTERNAL_MARKER, () => {
      logMarkerStripped();
      return "";
    });
  return cleaned.replace(/[ \t]{2,}/g, " ").trim();
}

export type ToolCall = {
  id: string;
  type: "function";
  function: {
    name: string;
    arguments: string;
  };
};

export type InvokeResult = {
  id: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: {
      role: Role;
      content: string | Array<TextContent | ImageContent | FileContent>;
      tool_calls?: ToolCall[];
    };
    finish_reason: string | null;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
};

export type JsonSchema = {
  name: string;
  schema: Record<string, unknown>;
  strict?: boolean;
};

export type OutputSchema = JsonSchema;

export type ResponseFormat =
  | { type: "text" }
  | { type: "json_object" }
  | { type: "json_schema"; json_schema: JsonSchema };

const ensureArray = (
  value: MessageContent | MessageContent[]
): MessageContent[] => (Array.isArray(value) ? value : [value]);

const normalizeContentPart = (
  part: MessageContent
): TextContent | ImageContent | FileContent => {
  if (typeof part === "string") {
    return { type: "text", text: part };
  }

  if (part.type === "text") {
    return part;
  }

  if (part.type === "image_url") {
    return part;
  }

  if (part.type === "file_url") {
    return part;
  }

  throw new Error("Unsupported message content part");
};

const normalizeMessage = (message: Message) => {
  const { role, name, tool_call_id } = message;

  if (role === "tool" || role === "function") {
    const content = ensureArray(message.content)
      .map(part => (typeof part === "string" ? part : JSON.stringify(part)))
      .join("\n");

    return {
      role,
      name,
      tool_call_id,
      content,
    };
  }

  const contentParts = ensureArray(message.content).map(normalizeContentPart);

  // If there's only text content, collapse to a single string for compatibility
  if (contentParts.length === 1 && contentParts[0].type === "text") {
    return {
      role,
      name,
      content: contentParts[0].text,
    };
  }

  return {
    role,
    name,
    content: contentParts,
  };
};

const normalizeToolChoice = (
  toolChoice: ToolChoice | undefined,
  tools: Tool[] | undefined
): "none" | "auto" | ToolChoiceExplicit | undefined => {
  if (!toolChoice) return undefined;

  if (toolChoice === "none" || toolChoice === "auto") {
    return toolChoice;
  }

  if (toolChoice === "required") {
    if (!tools || tools.length === 0) {
      throw new Error(
        "tool_choice 'required' was provided but no tools were configured"
      );
    }

    if (tools.length > 1) {
      throw new Error(
        "tool_choice 'required' needs a single tool or specify the tool name explicitly"
      );
    }

    return {
      type: "function",
      function: { name: tools[0].function.name },
    };
  }

  if ("name" in toolChoice) {
    return {
      type: "function",
      function: { name: toolChoice.name },
    };
  }

  return toolChoice;
};

const resolveApiUrl = () => {
  if (process.env.OLLAMA_API_KEY?.trim()) return "https://ollama.com/v1";
  // Generic OpenAI-compatible base URL override (e.g. Gemini's compatibility
  // endpoint at https://generativelanguage.googleapis.com/v1beta/openai).
  const baseUrl = process.env.LLM_BASE_URL?.trim();
  if (baseUrl) return `${baseUrl.replace(/\/$/, "")}/chat/completions`;
  return "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions";
};

const resolveApiKey = (): string =>
  process.env.OLLAMA_API_KEY?.trim() ||
  ENV.forgeApiKey ||
  process.env.OPENAI_API_KEY?.trim() ||
  process.env.GEMINI_API_KEY?.trim() ||
  "";

type RequestTarget = {
  name: string;
  url: string;
  apiKey: string;
  model?: string;
};

// Secondary OpenAI-compatible provider (AIML API, https://aimlapi.com — 1000+ models).
// Used automatically when the primary provider request fails, e.g. free-tier quota exhaustion.
const buildRequestTargets = (): RequestTarget[] => {
  const targets: RequestTarget[] = [];

  // Prefer Ollama Cloud whenever its key is configured. Keep this target
  // isolated: Gemini/AIML model names and credentials are not valid fallbacks
  // for an Ollama request.
  const ollamaKey = process.env.OLLAMA_API_KEY?.trim();
  if (ollamaKey) {
    return [
      {
        name: "Ollama Cloud",
        url: "https://ollama.com/v1/chat/completions",
        apiKey: ollamaKey,
      },
    ];
  }

  const primaryUrl = resolveApiUrl();

  // Try every distinct credential against the primary URL so one expired or
  // invalid key cannot take down every request.
  const primaryKeys: Array<{ name: string; apiKey: string }> = [];
  if (ENV.forgeApiKey)
    primaryKeys.push({ name: "primary-forge", apiKey: ENV.forgeApiKey });
  const openAiKey = process.env.OPENAI_API_KEY?.trim();
  if (openAiKey)
    primaryKeys.push({ name: "primary-openai", apiKey: openAiKey });
  const geminiKey = process.env.GEMINI_API_KEY?.trim();
  if (geminiKey && !primaryKeys.some(entry => entry.apiKey === geminiKey)) {
    primaryKeys.push({ name: "primary-gemini", apiKey: geminiKey });
  }

  for (let index = 0; index < primaryKeys.length; index++) {
    const entry = primaryKeys[index];
    targets.push({ name: entry.name, url: primaryUrl, apiKey: entry.apiKey });
    if (index === primaryKeys.length - 1) {
      targets.push({
        name: `${entry.name}-free`,
        url: primaryUrl,
        apiKey: entry.apiKey,
        model: PRIMARY_FREE_FALLBACK_MODEL,
      });
    }
  }

  const aimlKey = process.env.AIML_API_KEY?.trim();
  if (aimlKey) {
    const baseUrl =
      process.env.AIML_BASE_URL?.trim() || "https://api.aimlapi.com/v1";
    targets.push({
      name: "AIML",
      url: `${baseUrl.replace(/\/$/, "")}/chat/completions`,
      apiKey: aimlKey,
      model: process.env.AIML_MODEL?.trim() || "openai/gpt-4o-mini",
    });
  }

  return targets;
};

const assertApiKey = () => {
  if (!buildRequestTargets().length) {
    throw new Error(
      "No LLM API key configured. Set GEMINI_API_KEY, BUILT_IN_FORGE_API_KEY, or AIML_API_KEY."
    );
  }
};

const normalizeResponseFormat = ({
  responseFormat,
  response_format,
  outputSchema,
  output_schema,
}: {
  responseFormat?: ResponseFormat;
  response_format?: ResponseFormat;
  outputSchema?: OutputSchema;
  output_schema?: OutputSchema;
}):
  | { type: "json_schema"; json_schema: JsonSchema }
  | { type: "text" }
  | { type: "json_object" }
  | undefined => {
  const explicitFormat = responseFormat || response_format;
  if (explicitFormat) {
    if (
      explicitFormat.type === "json_schema" &&
      !explicitFormat.json_schema?.schema
    ) {
      throw new Error(
        "responseFormat json_schema requires a defined schema object"
      );
    }
    return explicitFormat;
  }

  const schema = outputSchema || output_schema;
  if (!schema) return undefined;

  if (!schema.name || !schema.schema) {
    throw new Error("outputSchema requires both name and schema");
  }

  return {
    type: "json_schema",
    json_schema: {
      name: schema.name,
      schema: schema.schema,
      ...(typeof schema.strict === "boolean" ? { strict: schema.strict } : {}),
    },
  };
};

const RETRY_MAX_RETRIES = 4;
const RETRY_BASE_DELAY_MS = 500;
const RETRY_MAX_DELAY_MS = 30_000;

type FetchInit = NonNullable<Parameters<typeof fetch>[1]>;

const sleep = (ms: number) =>
  new Promise<void>(resolve => setTimeout(resolve, ms));

const parseRetryAfter = (value: string | null): number | undefined => {
  if (!value) return undefined;
  const seconds = Number(value);
  if (Number.isFinite(seconds)) return Math.max(0, seconds * 1000);
  const at = Date.parse(value);
  return Number.isNaN(at) ? undefined : Math.max(0, at - Date.now());
};

// Equal-jitter exponential backoff. The cap/2 floor guarantees a minimum
// delay so a misbehaving caller loop slows down instead of hammering the
// upstream while it keeps returning errors.
const computeBackoffDelay = (
  attempt: number,
  retryAfterMs?: number
): number => {
  const cap = Math.min(RETRY_BASE_DELAY_MS * 2 ** attempt, RETRY_MAX_DELAY_MS);
  const jittered = cap / 2 + Math.random() * (cap / 2);
  return Math.min(Math.max(jittered, retryAfterMs ?? 0), RETRY_MAX_DELAY_MS);
};

// Statuses that cannot succeed on retry (bad key, bad request, or missing
// model). Transient 5xx responses retry with backoff; 429 retries once, then
// surfaces quickly because daily quota limits will not recover within seconds.
const NON_RETRYABLE_STATUSES = new Set([400, 401, 403, 404]);

// Retries non-2xx responses and network errors with exponential backoff, then
// returns the final Response so callers keep their existing error handling.
const fetchWithBackoff = async (
  url: string,
  init: FetchInit
): Promise<Response> => {
  let lastError: unknown;

  for (let attempt = 0; attempt <= RETRY_MAX_RETRIES; attempt++) {
    try {
      const response = await fetch(url, init);
      if (
        response.ok ||
        attempt === RETRY_MAX_RETRIES ||
        NON_RETRYABLE_STATUSES.has(response.status)
      ) {
        return response;
      }

      // Daily-quota exhaustion (429) never recovers within seconds; surface it
      // quickly instead of burning the full backoff schedule.
      if (response.status === 429 && attempt >= 1) {
        return response;
      }

      const retryAfterMs = parseRetryAfter(response.headers.get("retry-after"));
      try {
        await response.body?.cancel();
      } catch {
        // Body already settled; nothing to clean up.
      }
      console.warn(
        `LLM request retry ${attempt + 1}/${RETRY_MAX_RETRIES} after status ${response.status}`
      );
      await sleep(computeBackoffDelay(attempt, retryAfterMs));
    } catch (error) {
      lastError = error;
      if (attempt === RETRY_MAX_RETRIES) throw error;
      console.warn(
        `LLM request retry ${attempt + 1}/${RETRY_MAX_RETRIES} after network error`
      );
      await sleep(computeBackoffDelay(attempt));
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error("LLM request failed after exhausting retries");
};

export const DEFAULT_LLM_MODEL = process.env.OLLAMA_API_KEY?.trim()
  ? "gemma4:31b-cloud"
  : "models/gemini-2.5-flash";

const isOllamaCloudConfigured = () =>
  Boolean(process.env.OLLAMA_API_KEY?.trim());

export const getQuotaFallbackModel = () =>
  isOllamaCloudConfigured() ? undefined : PRIMARY_FREE_FALLBACK_MODEL;

export const resolveModelName = (model?: string) => {
  const selected = model?.trim();
  if (!isOllamaCloudConfigured()) return selected || DEFAULT_LLM_MODEL;
  // Existing accounts may have a Gemini model saved as their preference.
  // Keep those accounts working after switching the configured provider.
  if (!selected || /^(models\/)?gemini-/i.test(selected))
    return "gemma4:31b-cloud";
  return selected;
};

// Separate free-tier quota bucket on the primary provider; used automatically
// when the requested model is unavailable or rate-limited.
const PRIMARY_FREE_FALLBACK_MODEL = "models/gemini-3.5-flash-lite";

/**
 * Gemini's OpenAI-compatible endpoint can be unavailable while the native
 * Gemini API is healthy. Keep a native streaming fallback for normal chat so
 * a compatibility-layer outage does not take the whole assistant offline.
 */
async function* generateGeminiNative(
  params: InvokeParams,
  apiKey: string,
  model: string,
  signal?: AbortSignal
): AsyncGenerator<StreamDelta> {
  const systemParts: Array<{ text: string }> = [];
  const contents = params.messages.flatMap(message => {
    const role = message.role === "assistant" ? "model" : message.role;
    if (role === "system") {
      for (const part of ensureArray(message.content)) {
        if (typeof part === "string") systemParts.push({ text: part });
        else if (part.type === "text") systemParts.push({ text: part.text });
      }
      return [];
    }
    if (role !== "user" && role !== "model") return [];

    const parts: Array<Record<string, unknown>> = ensureArray(
      message.content
    ).flatMap<Record<string, unknown>>(part => {
      if (typeof part === "string") return [{ text: part }];
      if (part.type === "text") return [{ text: part.text }];
      if (part.type === "image_url") {
        const match = part.image_url.url.match(/^data:([^;,]+);base64,(.+)$/s);
        if (match)
          return [{ inlineData: { mimeType: match[1], data: match[2] } }];
      }
      return [];
    });
    return parts.length ? [{ role, parts }] : [];
  });

  const generationConfig: Record<string, unknown> = {};
  const maxOutputTokens = params.max_tokens ?? params.maxTokens;
  if (maxOutputTokens) generationConfig.maxOutputTokens = maxOutputTokens;
  if (typeof params.temperature === "number")
    generationConfig.temperature = params.temperature;
  const responseFormat = normalizeResponseFormat(params);
  if (responseFormat?.type === "json_object") {
    generationConfig.responseMimeType = "application/json";
  } else if (responseFormat?.type === "json_schema") {
    generationConfig.responseMimeType = "application/json";
    generationConfig.responseSchema = responseFormat.json_schema.schema;
  }
  const payload: Record<string, unknown> = { contents, generationConfig };
  if (systemParts.length) payload.systemInstruction = { parts: systemParts };
  if (params.thinking) payload.thinkingConfig = params.thinking;

  const normalizedModel = model.replace(/^models\//, "");
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(normalizedModel)}:generateContent`;
  const response = await fetchWithBackoff(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-goog-api-key": apiKey,
      accept: "application/json",
    },
    signal,
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`Gemini native stream failed: ${response.status} ${body}`);
  }

  const parsed = (await response.json()) as {
    candidates?: Array<{
      content?: { parts?: Array<{ text?: string; thought?: boolean }> };
    }>;
  };
  const text = (parsed.candidates?.[0]?.content?.parts ?? [])
    .filter(part => !part.thought)
    .map(part => part.text ?? "")
    .join("");
  if (!text) throw new Error("Gemini native API returned no answer text");
  const delta = sanitizeAssistantDelta(text);
  if (delta) {
    yield { type: "delta", delta };
  }
}

export async function invokeLLM(params: InvokeParams): Promise<InvokeResult> {
  assertApiKey();

  const {
    messages,
    tools,
    toolChoice,
    tool_choice,
    outputSchema,
    output_schema,
    responseFormat,
    response_format,
    model,
    thinking,
    reasoning,
    maxTokens,
    max_tokens,
    signal,
  } = params;

  const payload: Record<string, unknown> = {
    messages: messages.map(normalizeMessage),
  };

  payload.model = resolveModelName(model);

  if (tools && tools.length > 0) {
    payload.tools = tools;
  }

  const normalizedToolChoice = normalizeToolChoice(
    toolChoice || tool_choice,
    tools
  );
  if (normalizedToolChoice) {
    payload.tool_choice = normalizedToolChoice;
  }

  const resolvedMaxTokens = max_tokens ?? maxTokens;
  if (typeof resolvedMaxTokens === "number") {
    payload.max_tokens = resolvedMaxTokens;
  }

  if (typeof params.temperature === "number") {
    payload.temperature = params.temperature;
  }

  if (thinking) {
    payload.thinking = thinking;
  }
  if (reasoning) {
    payload.reasoning = reasoning;
  }

  const normalizedResponseFormat = normalizeResponseFormat({
    responseFormat,
    response_format,
    outputSchema,
    output_schema,
  });

  if (normalizedResponseFormat) {
    payload.response_format = normalizedResponseFormat;
  }

  const attemptInvoke = async (
    target: RequestTarget
  ): Promise<InvokeResult> => {
    const response = await fetchWithBackoff(target.url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${target.apiKey}`,
      },
      signal,
      body: JSON.stringify(
        target.model ? { ...payload, model: target.model } : payload
      ),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `LLM invoke failed: ${response.status} ${response.statusText} – ${errorText}`
      );
    }

    const result = (await response.json()) as InvokeResult;
    for (const choice of result.choices) {
      const content = choice?.message?.content;
      if (typeof content === "string" && content) {
        choice.message.content = sanitizeAssistantText(content);
      }
    }
    return result;
  };

  const targets = buildRequestTargets();
  let lastError: unknown;
  for (let index = 0; index < targets.length; index++) {
    const target = targets[index];
    try {
      return await attemptInvoke(target);
    } catch (error) {
      lastError = error;
      const geminiKey = process.env.GEMINI_API_KEY?.trim();
      const requestedModel = target.model || resolveModelName(model);
      if (
        !tools?.length &&
        geminiKey &&
        target.apiKey === geminiKey &&
        target.url.includes("generativelanguage.googleapis.com") &&
        /^models\/gemini-|^gemini-/.test(requestedModel)
      ) {
        try {
          let content = "";
          for await (const event of generateGeminiNative(
            params,
            geminiKey,
            requestedModel,
            signal
          )) {
            content += event.delta;
          }
          return {
            id: `gemini-native-${Date.now()}`,
            created: Math.floor(Date.now() / 1000),
            model: requestedModel,
            choices: [
              {
                index: 0,
                message: { role: "assistant", content },
                finish_reason: "stop",
              },
            ],
          };
        } catch (nativeError) {
          lastError = nativeError;
          if (signal?.aborted) throw nativeError;
          console.warn(
            "Gemini compatibility and native API calls both failed",
            nativeError instanceof Error
              ? nativeError.message.slice(0, 300)
              : "unknown native API error"
          );
        }
      }
      if (index === targets.length - 1) break;
      console.warn(
        `LLM invoke failed via ${target.name}; retrying with ${targets[index + 1].name}`
      );
    }
  }

  throw lastError instanceof Error ? lastError : new Error("LLM invoke failed");
}

/**
 * Streams OpenAI-compatible server-sent events from the configured LLM service.
 * Credentials and model selection remain on the server; callers receive text deltas only.
 */
export async function* streamLLM(
  params: InvokeParams,
  signal?: AbortSignal
): AsyncGenerator<StreamDelta> {
  assertApiKey();
  const payload: Record<string, unknown> = {
    messages: params.messages.map(normalizeMessage),
    stream: true,
  };
  payload.model = resolveModelName(params.model);
  if (params.max_tokens ?? params.maxTokens)
    payload.max_tokens = params.max_tokens ?? params.maxTokens;
  if (typeof params.temperature === "number")
    payload.temperature = params.temperature;
  if (params.thinking) payload.thinking = params.thinking;
  if (params.reasoning) payload.reasoning = params.reasoning;
  if (params.tools?.length) payload.tools = params.tools;
  const toolChoice = normalizeToolChoice(
    params.toolChoice || params.tool_choice,
    params.tools
  );
  if (toolChoice) payload.tool_choice = toolChoice;
  const responseFormat = normalizeResponseFormat(params);
  if (responseFormat) payload.response_format = responseFormat;

  const targets = buildRequestTargets();
  let lastError: unknown;
  for (let index = 0; index < targets.length; index++) {
    const target = targets[index];
    let yieldedDelta = false;
    const requestPayload: Record<string, unknown> = {
      ...payload,
      ...(target.model ? { model: target.model } : {}),
    };
    // Gemini's OpenAI-compatible endpoint supports reasoning_effort. Keep this
    // Gemini-only so alternate OpenAI-compatible providers receive their usual
    // request shape.
    if (
      params.reasoning_effort &&
      target.url.includes("generativelanguage.googleapis.com") &&
      /^models\/gemini-|^gemini-/.test(
        target.model || resolveModelName(params.model)
      )
    ) {
      requestPayload.reasoning_effort = params.reasoning_effort;
    }
    try {
      const response = await fetchWithBackoff(target.url, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${target.apiKey}`,
          accept: "text/event-stream",
        },
        signal,
        body: JSON.stringify(requestPayload),
      });
      if (!response.ok || !response.body) {
        const body = await response.text().catch(() => "");
        throw new Error(`LLM stream failed: ${response.status} ${body}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const events = buffer.split("\n\n");
          buffer = events.pop() ?? "";
          for (const event of events) {
            const data = event
              .split("\n")
              .filter(line => line.startsWith("data:"))
              .map(line => line.slice(5).trim())
              .join("\n");
            if (!data || data === "[DONE]") continue;
            try {
              const parsed = JSON.parse(data) as {
                choices?: Array<{ delta?: { content?: string } }>;
              };
              const raw = parsed.choices?.[0]?.delta?.content;
              if (raw) {
                // Mark the stream as progressed even if the chunk is fully
                // stripped, so a later provider fallback never re-runs an
                // already-started answer.
                yieldedDelta = true;
                const delta = sanitizeAssistantDelta(raw);
                if (delta) yield { type: "delta", delta };
              }
            } catch {
              // Ignore malformed provider keep-alives while preserving the visible stream.
            }
          }
        }
      } finally {
        reader.releaseLock();
      }
      if (!yieldedDelta)
        throw new Error("LLM stream completed without returning answer text");
      return;
    } catch (error) {
      lastError = error;
      // Never restart a partially streamed answer on another provider; text would duplicate.
      if (yieldedDelta || signal?.aborted) throw error;
      const geminiKey = process.env.GEMINI_API_KEY?.trim();
      const requestedModel =
        target.model || params.model || DEFAULT_LLM_MODEL;
      if (
        geminiKey &&
        target.apiKey === geminiKey &&
        target.url.includes("generativelanguage.googleapis.com") &&
        /^models\/gemini-|^gemini-/.test(requestedModel)
      ) {
        try {
          yield* generateGeminiNative(params, geminiKey, requestedModel, signal);
          return;
        } catch (nativeError) {
          lastError = nativeError;
          if (signal?.aborted) throw nativeError;
          console.warn(
            "Gemini compatibility and native API failed; trying the next configured model target",
            nativeError instanceof Error
              ? nativeError.message.slice(0, 300)
              : "unknown native API error"
          );
        }
      }
      if (index === targets.length - 1)
        throw lastError instanceof Error ? lastError : error;
      console.warn(
        `LLM stream failed via ${target.name}; retrying with ${targets[index + 1].name}`
      );
    }
  }

  throw lastError instanceof Error ? lastError : new Error("LLM stream failed");
}

export type ModelInfo = {
  id: string;
  object: string;
  created: number;
  owned_by: string;
};

export type ModelsResponse = {
  object: string;
  data: ModelInfo[];
};

export async function listLLMModels(): Promise<ModelsResponse> {
  assertApiKey();

  if (isOllamaCloudConfigured()) {
    const response = await fetchWithBackoff("https://ollama.com/api/tags", {
      headers: { authorization: `Bearer ${resolveApiKey()}` },
    });
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `List Ollama Cloud models failed: ${response.status} ${response.statusText} – ${errorText}`
      );
    }
    const catalog = (await response.json()) as {
      models?: Array<{ name?: string; model?: string }>;
    };
    return {
      object: "list",
      data: (catalog.models ?? [])
        .map(model => model.model || model.name || "")
        .filter(Boolean)
        .map(id => ({ id, object: "model", created: 0, owned_by: "ollama" })),
    };
  }

  const baseUrl = process.env.LLM_BASE_URL?.trim();
  const url = baseUrl
    ? `${baseUrl.replace(/\/$/, "")}/models`
    : "https://generativelanguage.googleapis.com/v1beta/openai/models";

  const response = await fetchWithBackoff(url, {
    headers: { authorization: `Bearer ${resolveApiKey()}` },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `List LLM models failed: ${response.status} ${response.statusText} – ${errorText}`
    );
  }

  return (await response.json()) as ModelsResponse;
}
