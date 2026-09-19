import type { Express, Request, Response } from "express";
import {
  attachFileToMessageForUser,
  createConversationForUser,
  createMessage,
  getConversationForUser,
  getMessageForUser,
  getUserPreferences,
  listMessageFilesForUser,
  listMessagesForConversation,
  removeFollowingAssistantDuplicatesForUser,
  updateConversationForUser,
  updateMessage,
  DatabaseUnavailableError,
} from "./supabase-db";
import { streamLLM, type Message } from "./_core/llm";
import { sdk, SessionLookupError } from "./_core/sdk";
import { storageDownload } from "./storage";
import { buildUserMemoryContext } from "./memory/retrieval";
import { memorizeConversation } from "./memory/autoMemorize";
import { isEphemeralConversationTitle } from "./conversationTypes";
import {
  detectFileRequest,
  likelyFormatHint,
  looksLikeFileRequest,
  cleanPromptText,
} from "./docgen/detect";
import {
  runDocumentPipeline,
  runPresentationOutline,
  runPresentationFromOutline,
  type GeneratedFileResult,
  type PipelineProgressEvent,
} from "./docgen/service";
import { buildOutlineMetadata } from "./docgen/presentation/outline";
import { isPptOutlinePlan, type PptOutlinePlan } from "@shared/presentationOutline";
import type { CapabilityMode } from "@shared/capabilities";
import { ensureExtractedContent } from "./fileExtract";
import {
  createInitialTitle,
  resolveConversationTitle,
} from "./conversationTitler";

const BASE_SYSTEM_INSTRUCTION =
  "You are KSEMO, a thoughtful and reliable assistant. Be clear, accurate, respectful, and practical. Use Markdown when it improves readability. Never claim to have completed work you cannot verify. You can perform math, logic, code analysis, and general reasoning directly — do not refuse calculation or analysis questions. When asked about the current time or date, state that you do not have access to a real-time clock but you can help with time-zone conversions, date math, and scheduling if the user provides a reference time or zone. Never introduce yourself, never state your name, and never refer to yourself as an AI assistant unless the user explicitly asks about you — always reply directly and naturally to whatever the user says.";

// Per-file cap on extracted document text injected into the model context.
const FILE_TEXT_PER_FILE_CHARS = 150_000;

const VOICE_STYLE_INSTRUCTION =
  "You are in a live, real-time voice conversation speaking directly with the user. Sound natural, warm, conversational, and direct, like a thoughtful human expert talking to a colleague. Use natural phrasing and common contractions (I'm, it's, you'll, don't). Do NOT use any markdown formatting, asterisks, bullet points, headers, or emojis since your words are spoken aloud by a speech synthesizer. Speak in clear, flowing sentences with natural pauses (commas and periods). Never repeat the question back.";

// The Gemini/OpenAI-compatible provider cannot resolve localhost or relative
// storage URLs, so images are read from storage and sent inline as base64 data
// URIs instead of remote image_urls that the model could never fetch.
async function storageImageDataUri(
  storageKey: string,
  mimeType: string
): Promise<string | null> {
  try {
    const downloaded = await storageDownload(storageKey);
    if (!downloaded.data) return null;
    if (downloaded.data.length > MAX_INLINE_IMAGE_BYTES) return null;
    return `data:${mimeType || "image/png"};base64,${downloaded.data.toString("base64")}`;
  } catch (error) {
    console.warn(
      `[ChatStream] could not read stored image ${storageKey}`,
      error
    );
    return null;
  }
}

// Largest single image (in bytes) sent inline to the model. Google's vision
// models cap inline image sizes; anything larger is skipped so a single huge
// screenshot cannot fail the whole turn.
const MAX_INLINE_IMAGE_BYTES = 18 * 1024 * 1024;

// Maximum number of files attached to a single user message and sent to the
// model in one turn. Keeps the request within the model's vision/input limits
// while still allowing a generous number of images and files per message.
const MAX_ATTACHMENTS_PER_MESSAGE = 12;

// Separate free-tier quota bucket; used when the selected model's daily limit is hit.
const QUOTA_FALLBACK_MODEL = "gemini-flash-lite-latest";

// Hard cap for a single response generation. Without it a stalled provider
// (or its retry ladder) would hold the SSE connection open in silence while
// the browser spins forever.
const GENERATION_DEADLINE_MS = 180_000;

// SSE comment frames sent while nothing else is happening. They keep proxies
// (Render, Vite, corporate gateways) from killing the idle connection and let
// clients detect liveness.
const HEARTBEAT_INTERVAL_MS = 15_000;

function composeAbortSignals(...signals: AbortSignal[]): AbortSignal {
  if (typeof AbortSignal.any === "function") return AbortSignal.any(signals);
  const composed = new AbortController();
  for (const signal of signals)
    signal.addEventListener("abort", () => composed.abort(signal.reason), {
      once: true,
    });
  return composed.signal;
}

function createDeadlineTimer(timeoutMs: number): {
  signal: AbortSignal;
  clear: () => void;
} {
  const controller = new AbortController();
  const timer = setTimeout(
    () =>
      controller.abort(
        new Error(`Generation exceeded ${timeoutMs}ms deadline`)
      ),
    timeoutMs
  );
  return { signal: controller.signal, clear: () => clearTimeout(timer) };
}

// Supabase reads and signed-URL creation can occasionally fail transiently.
// Retrying this read-only preparation once prevents a user from needing to
// press "Try again" for a request that was otherwise perfectly valid.
async function retryPreparation<T>(
  label: string,
  operation: () => Promise<T>
): Promise<T> {
  try {
    return await operation();
  } catch (firstError) {
    console.warn(`[ChatStream] ${label} failed; retrying once`, firstError);
    await new Promise(resolve => setTimeout(resolve, 250));
    return operation();
  }
}

const isQuotaError = (error: unknown) =>
  error instanceof Error &&
  /\b429\b|resource_exhausted|quota/i.test(error.message);

async function runGeneration(
  model: string | undefined,
  messages: Message[],
  signal: AbortSignal,
  onDelta?: (delta: string) => void
) {
  let text = "";
  for await (const event of streamLLM({ model, messages }, signal)) {
    text += event.delta;
    onDelta?.(event.delta);
  }
  return text;
}

function writeEvent(res: Response, event: string, payload: unknown) {
  if (res.writableEnded || res.destroyed) return;
  try {
    res.write(`event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`);
  } catch {
    // Socket already gone; the close handler aborts generation separately.
  }
}

/**
 * Resolves a raw request value (mode or legacy documentFormat) into a valid
 * CapabilityMode. Anything unrecognized falls back to normal chat so the
 * stream stays resilient to unknown/legacy payloads.
 */
function resolveCapabilityMode(raw: string | undefined | null): CapabilityMode {
  const value = (raw ?? "").toLowerCase().trim();
  if (
    value === "create_file" ||
    value === "create_files" ||
    value === "doc" ||
    value === "document" ||
    value === "file"
  ) {
    return "pdf";
  }
  const valid: CapabilityMode[] = [
    "chat",
    "pdf",
    "docx",
    "xlsx",
    "pptx",
    "txt",
  ];
  return (valid as string[]).includes(value)
    ? (value as CapabilityMode)
    : "chat";
}

export function registerChatStream(app: Express) {
  app.post("/api/chat/stream", async (req: Request, res: Response) => {
    let assistantMessageId: string | null = null;
    let responseText = "";
    let terminalStatusWritten = false;
    let user;
    try {
      user = await sdk.authenticateRequest(req);
    } catch (error) {
      if (
        error instanceof DatabaseUnavailableError ||
        error instanceof SessionLookupError
      ) {
        // Database/OAuth outage: the session may still be valid, so do NOT
        // throw the user out. Report a server error and let them retry.
        res.status(503).json({
          error:
            "KSEMO's data store is temporarily unavailable. Please try again.",
        });
        return;
      }
      res.status(401).json({ error: "Authentication required" });
      return;
    }
    if (!user) {
      res.status(401).json({ error: "Authentication required" });
      return;
    }

    const body = req.body as {
      conversationId?: string;
      content?: string;
      regenerateAssistantMessageId?: string;
      attachmentFileIds?: string[];
      documentFormat?: string;
      /** The active capability mode. See shared/capabilities.ts. */
      mode?: string;
      /** Backward-compatible alias sent by older clients (`activeMode`). */
      activeMode?: string;
      /** User-selected PowerPoint options (per shared/presentation.ts). */
      pptConfig?: Record<string, unknown>;
      pptStyle?: string;
      /** Temporary ("incognito") chat: hidden from all listings and not memorized. */
      temporary?: boolean;
    };
    const temporary = body.temporary === true;
    let content = body.content?.trim();
    const hasAttachments = (body.attachmentFileIds?.length ?? 0) > 0;
    if (
      !body.regenerateAssistantMessageId &&
      (!content || content.length > 16_000) &&
      !hasAttachments
    ) {
      res.status(400).json({
        error: "A message between 1 and 16,000 characters is required.",
      });
      return;
    }
    if (!content) content = "";

    let conversation;
    try {
      if (body.conversationId) {
        conversation = await getConversationForUser(
          body.conversationId,
          user.id
        );
        if (!conversation) {
          res.status(404).json({ error: "Conversation not found" });
          return;
        }
      } else {
        if (
          body.regenerateAssistantMessageId ||
          (!content && !hasAttachments)
        ) {
          res.status(400).json({
            error: "A saved conversation is required to regenerate a response.",
          });
          return;
        }
        conversation = await createConversationForUser({
          id: crypto.randomUUID(),
          userId: user.id,
          title: createInitialTitle(content),
          ephemeral: temporary,
        });
      }

      if (!conversation) throw new Error("Conversation creation failed");
      const ephemeralConversation =
        temporary || isEphemeralConversationTitle(conversation.title);
      if (conversation.title === "New conversation" && content) {
        await updateConversationForUser(conversation.id, user.id, {
          title: createInitialTitle(content),
        });
      }

      let userMessageId: string = crypto.randomUUID();
      assistantMessageId =
        body.regenerateAssistantMessageId ?? crypto.randomUUID();
      let historyForContext;
      if (body.regenerateAssistantMessageId) {
        const existingMessages = await listMessagesForConversation(
          conversation.id
        );
        const assistantIndex = existingMessages.findIndex(
          message =>
            message.id === body.regenerateAssistantMessageId &&
            message.role === "assistant"
        );
        const sourceUser =
          assistantIndex >= 0
            ? [...existingMessages.slice(0, assistantIndex)]
                .reverse()
                .find(message => message.role === "user")
            : undefined;
        if (!sourceUser) {
          res
            .status(400)
            .json({ error: "The source response cannot be regenerated." });
          return;
        }
        content = sourceUser.content;
        userMessageId = sourceUser.id;
        historyForContext = existingMessages.slice(0, assistantIndex);
        await removeFollowingAssistantDuplicatesForUser(
          body.regenerateAssistantMessageId,
          user.id
        );
      } else {
        await createMessage({
          id: userMessageId,
          conversationId: conversation.id,
          role: "user",
          content: content!,
          model: null,
          status: "completed",
          createdAt: new Date(),
          updatedAt: new Date(),
        });
        for (const fileId of Array.from(
          new Set(body.attachmentFileIds ?? [])
        ).slice(0, MAX_ATTACHMENTS_PER_MESSAGE)) {
          const attached = await attachFileToMessageForUser({
            id: crypto.randomUUID(),
            fileId,
            messageId: userMessageId,
            userId: user.id,
            conversationId: conversation.id,
          });
          if (!attached) {
            res.status(400).json({
              error:
                "One of the selected files is unavailable in this KSEMO account.",
            });
            return;
          }
        }
        historyForContext = await listMessagesForConversation(conversation.id);
      }
      if (body.regenerateAssistantMessageId) {
        await updateMessage(assistantMessageId, {
          content: "",
          status: "streaming",
        });
      } else {
        await createMessage({
          id: assistantMessageId,
          conversationId: conversation.id,
          role: "assistant",
          content: "",
          model: null,
          status: "streaming",
          createdAt: new Date(),
          updatedAt: new Date(),
        });
      }

      res.status(200);
      res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
      res.setHeader("Cache-Control", "no-cache, no-transform");
      res.setHeader("Connection", "keep-alive");
      res.flushHeaders();

      let finished = false;
      const controller = new AbortController();
      res.on("close", () => {
        if (!finished) controller.abort();
      });

      // Heartbeat + deadline keep the stream observable and bounded: the
      // heartbeat prevents idle-connection kills between events, and the
      // deadline guarantees the request always finishes even if the provider
      // or a retry ladder stalls.
      const heartbeat = setInterval(() => {
        if (!finished && !res.writableEnded && !res.destroyed) {
          try {
            res.write(": ping\n\n");
          } catch {
            // Socket gone; close handler aborts generation.
          }
        }
      }, HEARTBEAT_INTERVAL_MS);
      const deadline = createDeadlineTimer(GENERATION_DEADLINE_MS);
      const generationSignal = composeAbortSignals(
        controller.signal,
        deadline.signal
      );

      // Emit the conversation identity before any slow setup work so the
      // client can anchor its optimistic drafts immediately.
      writeEvent(res, "conversation", {
        conversationId: conversation.id,
        title:
          conversation.title === "New conversation"
            ? createInitialTitle(content ?? "New conversation")
            : conversation.title,
        userMessageId,
        assistantMessageId,
      });

      // ============================================

      try {
        const preferences = await retryPreparation("preferences lookup", () =>
          getUserPreferences(user.id)
        );
        const memoryContext = await retryPreparation("memory context", () =>
          buildUserMemoryContext(user.id, content ?? "")
        );
        const assistantContext = await retryPreparation(
          "message context setup",
          () =>
            Promise.all(
              historyForContext
                .filter(
                  message =>
                    message.role === "user" || message.role === "assistant"
                )
                .slice(-30)
                .filter(
                  message =>
                    message.content.length > 0 ||
                    (message.role === "user" &&
                      historyForContext.indexOf(message) >= 0)
                )
                .map(async message => {
                  if (message.role !== "user")
                    return {
                      role: "assistant" as const,
                      content: message.content,
                    };
                  const media = await listMessageFilesForUser(
                    message.id,
                    user.id
                  );
                  if (!media.length && !message.content) return null;
                  const contentParts: Array<
                    | { type: "text"; text: string }
                    | {
                        type: "image_url";
                        image_url: { url: string; detail: "auto" };
                      }
                    | {
                        type: "file_url";
                        file_url: { url: string; mime_type: "application/pdf" };
                      }
                  > = message.content
                    ? [{ type: "text" as const, text: message.content }]
                    : [];
                  for (const file of media) {
                    if (file.mimeType.startsWith("image/")) {
                      const dataUri = await storageImageDataUri(
                        file.storageKey,
                        file.mimeType
                      );
                      if (dataUri) {
                        contentParts.push({
                          type: "image_url",
                          image_url: {
                            url: dataUri,
                            detail: "auto",
                          },
                        });
                      } else {
                        contentParts.push({
                          type: "text",
                          text: `Attached image: ${file.filename} (${file.mimeType}). The image bytes could not be loaded, but it is stored in your private library.`,
                        });
                      }
                    } else if (file.mimeType === "application/pdf") {
                      const text = await ensureExtractedContent({ ...file, userId: user.id });

                      if (text) {
                        contentParts.push({
                          type: "text",
                          text: `Extracted text of ${file.filename}:\n\n${text.slice(0, FILE_TEXT_PER_FILE_CHARS)}`,
                        });
                      } else {
                        contentParts.push({
                          type: "text",
                          text: `Attached PDF: ${file.filename}. Its text could not be extracted; it is stored in your private library.`,
                        });
                      }
                    } else {
                      const text = await ensureExtractedContent({ ...file, userId: user.id });

                      if (text) {
                        contentParts.push({
                          type: "text",
                          text: `Attached file: ${file.filename} (${file.mimeType}). Content:\n\n${text.slice(0, FILE_TEXT_PER_FILE_CHARS)}`,
                        });
                      } else {
                        contentParts.push({
                          type: "text",
                          text: `Attached file: ${file.filename} (${file.mimeType}). Its bytes are stored privately; describe or analyze it only when the selected model supports that file type.`,
                        });
                      }
                    }
                  }
                  if (!message.content?.trim() && contentParts.length > 0) {
                    contentParts.unshift({
                      type: "text",
                      text: "Please analyze and explain what is shown or contained in the attached file(s) / image(s) in detail. Answer any questions or details visible.",
                    });
                  }
                  return { role: "user" as const, content: contentParts };
                })
            )
        );
        const filteredAssistantContext = assistantContext.filter(
          (msg): msg is NonNullable<typeof msg> => msg !== null
        );
        const personaInstruction = {
          balanced: "Use a balanced level of detail.",
          concise: "Be direct and concise unless the user asks for depth.",
          creative: "Offer inventive but grounded ideas when useful.",
          analytical:
            "Reason carefully, state assumptions, and organize analysis clearly.",
        }[preferences?.persona ?? "balanced"];
        const now = new Date();
        const currentTimeString = now.toLocaleString("en-US", {
          weekday: "long",
          year: "numeric",
          month: "long",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          hour12: true,
          timeZoneName: "short",
        });
        const systemInstruction = [
          BASE_SYSTEM_INSTRUCTION,
          `The current date and time is: ${currentTimeString}. Use this to answer questions about time, dates, and scheduling. You may be asked about mathematical equations, code analysis, general reasoning, and anything else — always attempt to answer helpfully.`,
          personaInstruction,
          preferences?.customInstructions?.trim(),
          body.mode === "voice" ? VOICE_STYLE_INSTRUCTION : null,
          memoryContext,
        ]
          .filter(Boolean)
          .join("\n\n");

        let generationError: unknown = null;
        let usedFallbackModel = false;
        const chatMessages: Message[] = [
          { role: "system", content: systemInstruction },
          ...filteredAssistantContext,
        ];

        // ------------------------------------------------------------------
        // AI File Creation & Document Generation
        // ------------------------------------------------------------------
        // Supports two seamless pathways:
        // 1. Explicit capability mode selected from UI (+ menu -> Create Files)
        // 2. Natural language detection from user message ("I want this in PDF",
        //    "give me this in Word", "create an excel sheet...", etc.)
        let deliveredFile: GeneratedFileResult | null = null;
        let outlineDelivered = false;
        let fileModeFailed = false;
        // Resolve the active capability mode (moves Normal Chat -> a specific
        // file format). `mode` is the source of truth; `documentFormat` is kept
        // for backward compatibility.
        const requestedMode = resolveCapabilityMode(
          body.mode ?? body.activeMode ?? body.documentFormat ?? "chat"
        );
        const FILE_FORMATS = new Set<string>([
          "pdf",
          "docx",
          "xlsx",
          "pptx",
          "txt",
        ]);
        const forcedFormat = FILE_FORMATS.has(requestedMode)
          ? (requestedMode as GeneratedFileResult["format"])
          : null;

        // Auto-detect file creation from natural language if not explicitly selected from UI
        // e.g. "I want this in PDF", "give me this in Word", "create a spreadsheet of...", etc.
        const isVoiceMode = body.mode === "voice";
        const detected = (!forcedFormat && content && !isVoiceMode) ? detectFileRequest(content) : null;
        const targetFormat: GeneratedFileResult["format"] | null =
          forcedFormat ?? (detected?.isFileRequest && detected.format && FILE_FORMATS.has(detected.format) ? (detected.format as GeneratedFileResult["format"]) : null);

        if (targetFormat) {
          const cleanUserMessage = detected?.cleanedPrompt || cleanPromptText(content ?? "", targetFormat);

          if (targetFormat === "pptx") {
            // ── Phase 1 (pptx): OUTLINE ONLY ─────────────────────────────
            // Produce the user-editable presentation outline (analysis +
            // structured slides), persist it to message metadata, and stream a
            // `file.outline` event. The .pptx is NOT generated yet — the user
            // reviews/edits the outline and approves it, which runs the second
            // phase via POST /api/chat/presentation/stream.
            try {
              const outline = await runPresentationOutline({
                userId: user.id,
                assistantMessageId,
                conversationId: conversation.id,
                userMessage: cleanUserMessage || content || "",
                history: filteredAssistantContext,
                presentationConfig: body.pptConfig,
                presentationStyle: body.pptStyle,
                onProgress: (event: PipelineProgressEvent) => {
                  writeEvent(res, "file.progress", {
                    messageId: assistantMessageId,
                    stage: event.stage,
                    format: event.format,
                    message: event.message,
                    researchSourceCount: event.researchSourceCount,
                    researchFindingCount: event.researchFindingCount,
                  });
                },
                signal: generationSignal,
              });

              await updateMessage(assistantMessageId, {
                metadata: {
                  pptOutline: buildOutlineMetadata(
                    outline,
                    cleanUserMessage || content || ""
                  ),
                },
              });

              writeEvent(res, "file.progress", {
                messageId: assistantMessageId,
                stage: "outline",
                format: "pptx",
                message: "Outline ready — review & approve",
              });

              writeEvent(res, "file.outline", {
                messageId: assistantMessageId,
                outline,
              });

              // Settle the assistant message with the outline summary so the
              // turn completes; the client renders the outline editor instead
              // of a plain text answer, and no file exists yet.
              responseText = outline.summary;
              outlineDelivered = true;
            } catch (error) {
              console.warn("[ChatStream] presentation outline failed", error);
              fileModeFailed = true;
              writeEvent(res, "file.error", {
                messageId: assistantMessageId,
                message:
                  error instanceof Error
                    ? `Could not plan your presentation: ${error.message}`
                    : "Could not plan your presentation. Please try again.",
              });
            }
          } else {
            try {
              // Clean command prefixes if present while preserving core prompt
              // Run the full intelligent document generation pipeline.
              // Each pipeline stage emits real progress events that the
              // client renders as meaningful live stages.
              deliveredFile = await runDocumentPipeline({
                userId: user.id,
                assistantMessageId,
                conversationId: conversation.id,
                userMessage: cleanUserMessage || content || "",
                format: targetFormat,
                history: filteredAssistantContext,
                // pptx never reaches this branch — it uses the outline flow.
                presentationConfig: undefined,
                presentationStyle: undefined,
                onProgress: (event: PipelineProgressEvent) => {
                  writeEvent(res, "file.progress", {
                    messageId: assistantMessageId,
                    stage: event.stage,
                    format: event.format,
                    message: event.message,
                    researchSourceCount: event.researchSourceCount,
                    researchFindingCount: event.researchFindingCount,
                    qualityPassed: event.qualityPassed,
                    qualityIssueCount: event.qualityIssueCount,
                    code: event.code,
                  });
                },
                signal: generationSignal,
              });

              writeEvent(res, "file.created", {
                messageId: assistantMessageId,
                file: deliveredFile,
              });

              responseText = deliveredFile.summary;
              for (let i = 0; i < responseText.length; i += 64) {
                writeEvent(res, "assistant.delta", {
                  messageId: assistantMessageId,
                  delta: responseText.slice(i, i + 64),
                });
              }
            } catch (error) {
              console.warn(
                "[ChatStream] file generation failed",
                error
              );
              fileModeFailed = true;
              writeEvent(res, "file.error", {
                messageId: assistantMessageId,
                message: error instanceof Error
                  ? `File generation failed: ${error.message}`
                  : "File generation could not be completed. Please try again.",
              });
            }
          }
        }

        // ------------------------------------------------------------------
        // Normal Chat — only runs when NOT in file creation mode.
        // When a file mode was active and completed (or failed), this block
        // is skipped entirely so the modes never bleed into each other.
        // ------------------------------------------------------------------
        if (
          !deliveredFile &&
          !fileModeFailed &&
          !outlineDelivered &&
          !targetFormat
        ) {
          try {
            responseText = await runGeneration(
              preferences?.selectedModel ?? undefined,
              chatMessages,
              generationSignal,
              delta =>
                writeEvent(res, "assistant.delta", {
                  messageId: assistantMessageId,
                  delta,
                })
            );
          } catch (error) {
            generationError = error;
          }
        }

        if (
          !deliveredFile &&
          !fileModeFailed &&
          generationError &&
          !controller.signal.aborted &&
          !responseText &&
          isQuotaError(generationError)
        ) {
          console.warn(
            `[ChatStream] quota exceeded for "${preferences?.selectedModel ?? "default model"}"; retrying with ${QUOTA_FALLBACK_MODEL}`
          );
          try {
            responseText = await runGeneration(
              QUOTA_FALLBACK_MODEL,
              chatMessages,
              generationSignal,
              delta =>
                writeEvent(res, "assistant.delta", {
                  messageId: assistantMessageId,
                  delta,
                })
            );
            usedFallbackModel = true;
            generationError = null;
          } catch (fallbackError) {
            generationError = fallbackError;
          }
        }

        const timedOut = deadline.signal.aborted && !controller.signal.aborted;
        // User-initiated stop (stop button / ctrl-c). When this is true the
        // whole response is intentionally killed and we just mark the message.
        const userCancelled = controller.signal.aborted;

        if (fileModeFailed && !userCancelled) {
          // File Creation Mode was active but generation failed. Settle the
          // message as failed — do NOT fall back to normal chat. The two
          // modes must remain strictly separated.
          await updateMessage(assistantMessageId, {
            content: responseText || "",
            status: "failed",
          });
          terminalStatusWritten = true;
        } else if ((generationError || timedOut) && !controller.signal.aborted) {
          await updateMessage(assistantMessageId, {
            content: responseText,
            status: "failed",
          });
          terminalStatusWritten = true;
          if (generationError)
            console.error("[ChatStream] generation failed", generationError);
          else
            console.warn(
              `[ChatStream] generation exceeded the ${GENERATION_DEADLINE_MS}ms deadline`
            );
          writeEvent(res, "assistant.error", {
            messageId: assistantMessageId,
            message: timedOut
              ? "KSEMO stopped waiting because this response took too long. Please try again."
              : isQuotaError(generationError)
                ? "KSEMO reached today's free limit for this model. It resets in about 24 hours — switch models in Settings for a separate limit, or add billing to your Gemini API key."
                : "KSEMO could not complete this response. Please try again.",
          });
        } else {
          const cancelled = controller.signal.aborted;
          await updateMessage(assistantMessageId, {
            content: cancelled
              ? responseText
              : (responseText || "I’m sorry, I couldn’t generate a response."),
            model: usedFallbackModel
              ? QUOTA_FALLBACK_MODEL
              : (preferences?.selectedModel ?? null),
            status: cancelled ? "cancelled" : "completed",
          });
          terminalStatusWritten = true;
          if (!cancelled) {
            writeEvent(res, "assistant.completed", {
              messageId: assistantMessageId,
            });
            if (usedFallbackModel) {
              writeEvent(res, "assistant.modelFallback", {
                messageId: assistantMessageId,
                model: QUOTA_FALLBACK_MODEL,
              });
            }

            // Generate intelligent title after first assistant response
            // Only do this for new conversations (not regenerations)
            if (
              !body.regenerateAssistantMessageId &&
              content &&
              !ephemeralConversation
            ) {
              const messages = await listMessagesForConversation(conversation.id);
              const userMessages = messages.filter(m => m.role === "user");
              const assistantMessages = messages.filter(m => m.role === "assistant");

              // Only update title if this is the first assistant response
              if (assistantMessages.length === 1 && userMessages.length > 0) {
                const intelligentTitle = await resolveConversationTitle({
                  userContent: content,
                  assistantContent: responseText,
                  messages,
                  signal: controller.signal,
                });
                if (intelligentTitle && intelligentTitle !== conversation.title) {
                  await updateConversationForUser(conversation.id, user.id, {
                    title: intelligentTitle,
                  });
                  writeEvent(res, "conversation.titleUpdated", {
                    conversationId: conversation.id,
                    title: intelligentTitle,
                  });
                }
              }
            }

            // Capture durable facts from this conversation in the background;
            // this never blocks the response (see memorizeConversation).
            if (!ephemeralConversation) {
              void memorizeConversation(user.id, conversation.id);
            }
          }
        }
      } catch (error) {
        // This covers failures while preparing context (preferences, files,
        // signed URLs, etc.). The conversation event has already reached the
        // browser, so closing the response here without a terminal SSE event
        // makes the client look as if it is still loading forever.
        console.error("[ChatStream] stream setup failed", error);
        if (!terminalStatusWritten) {
          try {
            await updateMessage(assistantMessageId, {
              content: responseText,
              status: "failed",
            });
            terminalStatusWritten = true;
          } catch (cleanupError) {
            console.error(
              "[ChatStream] could not settle stream setup failure",
              cleanupError
            );
          }
        }
        if (!controller.signal.aborted) {
          writeEvent(res, "assistant.error", {
            messageId: assistantMessageId,
            message: "KSEMO could not prepare this response. Please try again.",
          });
        }
      } finally {
        finished = true;
        clearInterval(heartbeat);
        deadline.clear();
        if (!res.writableEnded) res.end();
      }
    } catch (error) {
      console.error("[ChatStream] setup failed", error);
      // A failure after the placeholder was inserted used to leave it as
      // `streaming` permanently. Always settle it before ending the request.
      if (assistantMessageId && !terminalStatusWritten) {
        try {
          await updateMessage(assistantMessageId, {
            content: responseText,
            status: "failed",
          });
          terminalStatusWritten = true;
        } catch (cleanupError) {
          console.error(
            "[ChatStream] could not settle failed message",
            cleanupError
          );
        }
      }
      if (!res.headersSent)
        res.status(500).json({ error: "Unable to start the response stream." });
      else if (!res.writableEnded) res.end();
    }
  });

  // -----------------------------------------------------------------------
  // Presentation approve & generate endpoint (Phase 2 of two-phase PPT flow)
  //
  // Called when the user edits the outline in the chat and clicks "Generate
  // presentation". Runs the layout engine, export, and storage; emits
  // file.progress / file.created events; then settles the assistant message.
  // Reuses the same SSE machinery so the client's existing file-progress UI
  // and FileCreationCard work without changes.
  // -----------------------------------------------------------------------
  app.post("/api/chat/presentation/stream", async (req: Request, res: Response) => {
    let user;
    try {
      user = await sdk.authenticateRequest(req);
    } catch (error) {
      if (error instanceof DatabaseUnavailableError || error instanceof SessionLookupError) {
        res.status(503).json({
          error: "KSEMO's data store is temporarily unavailable. Please try again.",
        });
        return;
      }
      res.status(401).json({ error: "Authentication required" });
      return;
    }
    if (!user) {
      res.status(401).json({ error: "Authentication required" });
      return;
    }

    const body = req.body as {
      assistantMessageId?: string;
      conversationId?: string;
      outline?: unknown;
      pptConfig?: Record<string, unknown>;
      pptStyle?: string;
    };

    if (!body.assistantMessageId || !body.conversationId || !body.outline) {
      res.status(400).json({ error: "assistantMessageId, conversationId, and outline are required." });
      return;
    }

    // Validate outline structure before doing any work
    if (!isPptOutlinePlan(body.outline)) {
      res.status(400).json({ error: "Invalid presentation outline. Please regenerate the outline and try again." });
      return;
    }

    // Validate the assistant message exists, is in this conversation, and
    // belongs to the authenticated user.
    const message = await getMessageForUser(body.assistantMessageId, user.id);
    if (!message) {
      res.status(404).json({ error: "Message not found" });
      return;
    }
    if (message.conversationId !== body.conversationId) {
      res.status(400).json({ error: "Message does not belong to this conversation" });
      return;
    }

    const conversation = await getConversationForUser(body.conversationId, user.id);
    if (!conversation) {
      res.status(404).json({ error: "Conversation not found" });
      return;
    }

    // The prompt recorded in metadata is the user message that preceded this
    // assistant message (the assistant placeholder content is always empty
    // during the outline phase).
    let outlinePrompt = "";
    try {
      const conversationMessages = await listMessagesForConversation(body.conversationId);
      const assistantIndex = conversationMessages.findIndex(m => m.id === body.assistantMessageId);
      const sourceUser = assistantIndex >= 0
        ? [...conversationMessages.slice(0, assistantIndex)].reverse().find(m => m.role === "user")
        : undefined;
      outlinePrompt = sourceUser?.content ?? "";
    } catch {}

    // Persist the (potentially user-edited) outline so it survives a refresh
    await updateMessage(body.assistantMessageId, {
      metadata: {
        pptOutline: {
          kind: "pptOutline",
          outline: body.outline,
          prompt: outlinePrompt,
          updatedAt: new Date().toISOString(),
          headerText: (body.outline as PptOutlinePlan).summary || "",
        },
      },
    });

    res.status(200);
    res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders();

    let finished = false;
    const controller = new AbortController();
    res.on("close", () => { if (!finished) controller.abort(); });

    const heartbeat = setInterval(() => {
      if (!finished && !res.writableEnded && !res.destroyed) {
        try { res.write(": ping\n\n"); } catch {}
      }
    }, HEARTBEAT_INTERVAL_MS);
    const deadline = createDeadlineTimer(GENERATION_DEADLINE_MS);
    const generationSignal = composeAbortSignals(controller.signal, deadline.signal);

    let settled = false;
    try {
      const outlinePlan = body.outline as PptOutlinePlan;

      writeEvent(res, "conversation", {
        conversationId: body.conversationId,
        title: conversation.title,
        userMessageId: message.conversationId,
        assistantMessageId: body.assistantMessageId,
      });

      const result = await runPresentationFromOutline({
        userId: user.id,
        assistantMessageId: body.assistantMessageId,
        conversationId: body.conversationId,
        outline: outlinePlan,
        onProgress: (event: PipelineProgressEvent) => {
          writeEvent(res, "file.progress", {
            messageId: body.assistantMessageId,
            stage: event.stage,
            format: event.format,
            message: event.message,
            researchSourceCount: event.researchSourceCount,
            researchFindingCount: event.researchFindingCount,
            qualityPassed: event.qualityPassed,
            qualityIssueCount: event.qualityIssueCount,
            code: event.code,
          });
        },
        signal: generationSignal,
      });

      // Persist the outline once more with an updated timestamp so the client
      // knows the version that produced this specific .pptx
      await updateMessage(body.assistantMessageId, {
        metadata: {
          pptOutline: {
            kind: "pptOutline",
            outline: outlinePlan,
            prompt: outlinePrompt,
            updatedAt: new Date().toISOString(),
            headerText: outlinePlan.summary,
          },
        },
      });

      writeEvent(res, "file.created", {
        messageId: body.assistantMessageId,
        file: result,
      });

      const summary = outlinePlan.summary || result.summary;
      for (let i = 0; i < summary.length; i += 64) {
        writeEvent(res, "assistant.delta", {
          messageId: body.assistantMessageId,
          delta: summary.slice(i, i + 64),
        });
      }

      await updateMessage(body.assistantMessageId, {
        content: summary,
        status: "completed",
        metadata: {
          pptOutline: {
            kind: "pptOutline",
            outline: outlinePlan,
            prompt: outlinePrompt,
            updatedAt: new Date().toISOString(),
            headerText: outlinePlan.summary,
          },
        },
      });
      settled = true;

      writeEvent(res, "assistant.completed", {
        messageId: body.assistantMessageId,
      });
    } catch (error) {
      console.warn("[ChatStream] presentation generation failed", error);
      if (!controller.signal.aborted) {
        writeEvent(res, "file.error", {
          messageId: body.assistantMessageId,
          message:
            error instanceof Error
              ? `Presentation generation failed: ${error.message}`
              : "Presentation generation could not be completed. Please try again.",
        });
        try {
          await updateMessage(body.assistantMessageId, {
            status: "failed",
          });
        } catch {}
      }
    } finally {
      finished = true;
      clearInterval(heartbeat);
      deadline.clear();
      if (!res.writableEnded) res.end();
    }
  });
}
