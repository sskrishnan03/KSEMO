/**
 * Voice transcription helper using the Gemini API (multimodal generateContent).
 * Audio arrives as raw bytes from the browser recorder and is sent inline.
 */

const GEMINI_BASE_URL =
  process.env.LLM_BASE_URL?.replace(/\/openai\/?$/, "") ??
  "https://generativelanguage.googleapis.com/v1beta";
// Ordered by transcription fidelity; each fallback is only used when the
// previous model is busy (429/503) or unavailable on the configured API key.
// The dedicated transcribe model MUST stay first: the general-purpose flash
// fallbacks happily invent text for non-speech audio, which puts words in the
// user's message that they never said.
const TRANSCRIBE_MODELS = [
  "gemini-3.5-transcribe",
  "gemini-3.6-flash",
];

// Hard cap on total transcription time so the UI never hangs on an unresponsive
// model; the remaining budget is shared across model fallbacks.
const TRANSCRIPTION_DEADLINE_MS = 110_000;

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
          signal: AbortSignal.timeout(Math.min(60_000, remaining)),
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
      candidates?: Array<{
        content?: {
          parts?: Array<{
            text?: string;
            audioTranscription?: { text?: string };
          }>;
        };
      }>;
    };
    const candidate = data.candidates?.[0];
    if (!candidate) {
      return {
        error: "Invalid transcription response",
        code: "SERVICE_ERROR",
        details: "Transcription service returned no candidates",
      };
    }
    // Two different part shapes carry the transcript, and reading only one of
    // them yields a silent empty string:
    //   - dedicated transcribe models return { audioTranscription: { text } }
    //   - general multimodal models return { text }
    // Read both, so the chain works no matter which model answers.
    const text = (candidate.content?.parts ?? [])
      .map(part => part.audioTranscription?.text ?? part.text ?? "")
      .join("")
      .trim();

    // An empty result is a legitimate outcome — the dedicated transcribe model
    // returns no parts for silence or non-speech audio. Report it as a
    // successful empty transcript so the client can show its own "no speech
    // detected" message, instead of surfacing a misleading service error.
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
