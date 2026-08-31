/**
 * Voice transcription helper using the Gemini API (multimodal generateContent).
 * Audio arrives as raw bytes from the browser recorder and is sent inline.
 */

const GEMINI_BASE_URL =
  process.env.LLM_BASE_URL?.replace(/\/openai\/?$/, "") ??
  "https://generativelanguage.googleapis.com/v1beta";
// Ordered by transcription speed as a best effort; each fallback is only used
// when the previous model is busy or unavailable on the configured API key.
// NOTE: gemini-2.0-flash returns 404 ("no longer available") and has been
// removed — it only wasted the request budget before the working models ran.
const TRANSCRIBE_MODELS = [
  "gemini-3.7-flash",
  "gemini-3.6-flash",
];

// Hard cap on total transcription time so the UI never hangs on an unresponsive
// model; the remaining budget is shared across model fallbacks.
const TRANSCRIPTION_DEADLINE_MS = 45_000;

export type TranscribeOptions = {
  audio: Buffer;
  mimeType: string;
  language?: string;
  prompt?: string;
};

export type TranscriptionResponse = {
  task: "transcribe";
  language: string;
  duration: number;
  text: string;
  segments: Array<unknown>;
};

export type TranscriptionError = {
  error: string;
  code:
    | "FILE_TOO_LARGE"
    | "INVALID_FORMAT"
    | "TRANSCRIPTION_FAILED"
    | "UPLOAD_FAILED"
    | "SERVICE_ERROR";
  details?: string;
};

function resolveApiKey(): string {
  return (
    process.env.BUILT_IN_FORGE_API_KEY ||
    process.env.OPENAI_API_KEY ||
    process.env.GEMINI_API_KEY ||
    ""
  );
}

function getLanguageName(langCode: string): string {
  const langMap: Record<string, string> = {
    en: "English",
    es: "Spanish",
    fr: "French",
    de: "German",
    it: "Italian",
    pt: "Portuguese",
    ru: "Russian",
    ja: "Japanese",
    ko: "Korean",
    zh: "Chinese",
    ar: "Arabic",
    hi: "Hindi",
    nl: "Dutch",
    pl: "Polish",
    tr: "Turkish",
    sv: "Swedish",
    da: "Danish",
    no: "Norwegian",
    fi: "Finnish",
  };
  return langMap[langCode] || langCode;
}

export async function transcribeAudio(
  options: TranscribeOptions
): Promise<TranscriptionResponse | TranscriptionError> {
  try {
    const apiKey = resolveApiKey();
    if (!apiKey) {
      return {
        error: "Voice transcription service is not configured",
        code: "SERVICE_ERROR",
        details: "GEMINI_API_KEY is not set",
      };
    }

    if (!options.audio?.length) {
      return { error: "No audio was provided", code: "INVALID_FORMAT" };
    }

    const sizeMB = options.audio.length / (1024 * 1024);
    if (sizeMB > 16) {
      return {
        error: "Audio file exceeds maximum size limit",
        code: "FILE_TOO_LARGE",
        details: `File size is ${sizeMB.toFixed(2)}MB, maximum allowed is 16MB`,
      };
    }

    const instruction =
      options.prompt ||
      (options.language
        ? `Transcribe the user's voice to text, the user's working language is ${getLanguageName(options.language)}`
        : "Transcribe the user's voice to text");

    const body = JSON.stringify({
      contents: [
        {
          parts: [
            {
              text: `${instruction}. Reply with ONLY the transcript text, with no commentary.`,
            },
            {
              inline_data: {
                mime_type: options.mimeType,
                data: options.audio.toString("base64"),
              },
            },
          ],
        },
      ],
      generationConfig: { temperature: 0 },
    });

    let response: Response | null = null;
    let lastError = "";
    const deadline = Date.now() + TRANSCRIPTION_DEADLINE_MS;
    for (const model of TRANSCRIBE_MODELS) {
      const remaining = deadline - Date.now();
      if (remaining <= 0) {
        lastError = lastError || "Transcription request timed out";
        break;
      }
      const url = `${GEMINI_BASE_URL.replace(/\/+$/, "")}/models/${model}:generateContent`;
      try {
        response = await fetch(url, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "x-goog-api-key": apiKey,
          },
          body,
          signal: AbortSignal.timeout(Math.min(20_000, remaining)),
        });
      } catch (error) {
        lastError =
          error instanceof Error && error.name === "TimeoutError"
            ? "Transcription request timed out"
            : error instanceof Error
              ? error.message
              : "Transcription request failed";
        // Move on to the next model instead of aborting — a slow or stalled
        // request on one model must not prevent the fallbacks from trying.
        if (Date.now() >= deadline) break;
        continue;
      }
      if (response.ok) break;
      const errorText = await response.text().catch(() => "");
      lastError = `${response.status} ${response.statusText}${errorText ? `: ${errorText}` : ""}`;
      // Retry the next model on contention (429/503) or if this model isn't
      // available on the configured key (400/404).
      if (
        response.status !== 503 &&
        response.status !== 429 &&
        response.status !== 400 &&
        response.status !== 404
      )
        break;
    }

    if (!response || !response.ok) {
      const rateLimited = /429|quota|RESOURCE_EXHAUSTED/i.test(lastError);
      return {
        error: rateLimited
          ? "Voice transcription is temporarily rate-limited. Please wait a moment and try again."
          : "Transcription service request failed",
        code: "TRANSCRIPTION_FAILED",
        details: lastError,
      };
    }

    const data = (await response.json()) as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    };
    const text = (data.candidates?.[0]?.content?.parts ?? [])
      .map(part => part.text ?? "")
      .join("")
      .trim();

    if (!text) {
      return {
        error: "Invalid transcription response",
        code: "SERVICE_ERROR",
        details: "Transcription service returned an empty response",
      };
    }

    return {
      task: "transcribe",
      language: options.language ?? "unknown",
      duration: 0,
      text,
      segments: [],
    };
  } catch (error) {
    return {
      error: "Voice transcription failed",
      code: "SERVICE_ERROR",
      details:
        error instanceof Error ? error.message : "An unexpected error occurred",
    };
  }
}
