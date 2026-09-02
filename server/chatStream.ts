import type { Express, Request, Response } from "express";
import {
  attachFileToMessageForUser,
  createConversationForUser,
  createMessage,
  createResearchSession,
  getConversationForUser,
  getUserPreferences,
  listMessageFilesForUser,
  listMessagesForConversation,
  removeFollowingAssistantDuplicatesForUser,
  updateConversationForUser,
  updateMessage,
  updateResearchSession,
} from "./supabase-db";
import { streamLLM, type Message } from "./_core/llm";
import { sdk } from "./_core/sdk";
import { resolveStoragePath } from "./storage";
import fs from "fs";
import { buildUserMemoryContext } from "./memory/retrieval";
import { memorizeConversation } from "./memory/autoMemorize";
import { planDocument } from "./docgen/plan";
import {
  buildDocumentSpec,
  generateAndDeliverFile,
  type GeneratedFileResult,
} from "./docgen/service";
import type { CapabilityMode } from "@shared/research";
import { embedSourcesInContent, parseContentWithSources } from "@shared/research";
import { searchWeb } from "./search/webSearch";
import { streamWebAnswer } from "./search/searchAnswer";
import { runDeepResearch } from "./search/deepResearch";

const BASE_SYSTEM_INSTRUCTION =
  "You are KSEMO, a thoughtful and reliable AI assistant. Be clear, accurate, respectful, and practical. Use Markdown when it improves readability. Never claim to have completed work you cannot verify. You can perform math, logic, code analysis, and general reasoning directly — do not refuse calculation or analysis questions. When asked about the current time or date, state that you do not have access to a real-time clock but you can help with time-zone conversions, date math, and scheduling if the user provides a reference time or zone.";

// Per-file cap on extracted document text injected into the model context.
const FILE_TEXT_PER_FILE_CHARS = 12_000;

const VOICE_STYLE_INSTRUCTION =
  "Your reply will be spoken aloud in a live voice conversation. Answer exactly and completely, with the same full detail you would give in a written reply — but in plain natural spoken language. No markdown formatting, no bullet or numbered lists, no tables, no headings, no filler, and do not repeat the question back.";

// The Gemini/OpenAI-compatible provider cannot resolve localhost or relative
// storage URLs, so images are read from disk and sent inline as base64 data
// URIs instead of remote image_urls that the model could never fetch.
async function storageImageDataUri(
  storageKey: string,
  mimeType: string
): Promise<string | null> {
  try {
    const absolute = resolveStoragePath(storageKey);
    const stat = await fs.promises.stat(absolute);
    if (stat.size > MAX_INLINE_IMAGE_BYTES) return null;
    const buffer = await fs.promises.readFile(absolute);
    return `data:${mimeType || "image/png"};base64,${buffer.toString("base64")}`;
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

function createTitle(content: string) {
  const cleaned = content.replace(/\s+/g, " ").trim();
  if (cleaned.length <= 56) return cleaned || "New conversation";
  return `${cleaned.slice(0, 53).trimEnd()}…`;
}

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
  const valid: CapabilityMode[] = [
    "chat",
    "pdf",
    "docx",
    "xlsx",
    "pptx",
    "txt",
    "web_search",
    "deep_research",
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
    } catch {
      res.status(401).json({ error: "Authentication required" });
      return;
    }

    const body = req.body as {
      conversationId?: string;
      content?: string;
      regenerateAssistantMessageId?: string;
      attachmentFileIds?: string[];
      documentFormat?: string;
      /** The active capability mode. See shared/research.ts. */
      mode?: string;
    };
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
          title: createTitle(content),
        });
      }

      if (!conversation) throw new Error("Conversation creation failed");
      if (conversation.title === "New conversation" && content) {
        await updateConversationForUser(conversation.id, user.id, {
          title: createTitle(content),
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
            ? createTitle(content ?? "New conversation")
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
                      // The model cannot fetch a private/localhost PDF URL, so
                      // only the extracted text is sent for analysis.
                      if (file.contentText) {
                        contentParts.push({
                          type: "text",
                          text: `Extracted text of ${file.filename}:\n\n${file.contentText.slice(0, FILE_TEXT_PER_FILE_CHARS)}`,
                        });
                      } else {
                        contentParts.push({
                          type: "text",
                          text: `Attached PDF: ${file.filename}. Its text could not be extracted; it is stored in your private library.`,
                        });
                      }
                    } else if (file.contentText) {
                      // Office/data/text files: the model reads the extracted
                      // text directly instead of the raw bytes.
                      contentParts.push({
                        type: "text",
                        text: `Attached file: ${file.filename} (${file.mimeType}). Content:\n\n${file.contentText.slice(0, FILE_TEXT_PER_FILE_CHARS)}`,
                      });
                    } else {
                      contentParts.push({
                        type: "text",
                        text: `Attached file: ${file.filename} (${file.mimeType}). Its bytes are stored privately; describe or analyze it only when the selected model supports that file type.`,
                      });
                    }
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
        // --------------------------------------------------------------
        // File creation is an explicit, separate mode. It activates ONLY
        // when the user has selected a file type through the Create File UI
        // (which sends `documentFormat`). Auto-detection from natural language
        // is intentionally disabled: typing "create a PDF" alone must NOT
        // create a file. The selected format is the single source of truth
        // that drives the whole pipeline.
        //
        // When File Creation Mode is active (forcedFormat is set) and the
        // generation fails, the server does NOT fall back to normal chat.
        // The file.error event is emitted and the assistant message is
        // settled as failed. The two modes must never bleed into each other.
        let deliveredFile: GeneratedFileResult | null = null;
        let fileModeFailed = false;
        const isRegenerationTurn = Boolean(body.regenerateAssistantMessageId);
        // Resolve the active capability mode (moves Normal Chat -> a specific
        // file format / web search / deep research). `mode` is the source of
        // truth; `documentFormat` is kept for backward compatibility.
        const requestedMode = resolveCapabilityMode(
          body.mode ?? body.documentFormat ?? "chat"
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
        const isWebSearchMode = requestedMode === "web_search";
        const isDeepResearchMode = requestedMode === "deep_research";
        const isResearchTurn = isWebSearchMode || isDeepResearchMode;
        const activeResearchMode = isResearchTurn ? requestedMode : null;

        // Structured sources gathered during a research run; delivered to the
        // client progressively via SSE and persisted with the message.
        let researchSources: Awaited<ReturnType<typeof searchWeb>> = [];
        let researchFailed = false;
        let researchErrorText: string | null = null;
        // The final content (answer + embedded sources) persisted for a
        // successful research run; reused during settlement so we never
        // overwrite it with an empty/partial stream.
        let researchEmbeddedContent: string | null = null;

        if (!isRegenerationTurn && forcedFormat) {
          try {
            writeEvent(res, "file.progress", {
              messageId: assistantMessageId,
              stage: "analyzing",
              format: forcedFormat,
            });

            const plannerHistory: Message[] = filteredAssistantContext
              .filter(msg => msg.role === "user" || msg.role === "assistant")
              .slice(-8);
            const last = plannerHistory[plannerHistory.length - 1];
            if (
              last &&
              last.role === "user" &&
              typeof last.content === "string" &&
              last.content === content
            ) {
              plannerHistory.pop();
            }

            writeEvent(res, "file.progress", {
              messageId: assistantMessageId,
              stage: "researching",
              format: forcedFormat,
            });

            const plan = await planDocument(
              content ?? "",
              plannerHistory,
              forcedFormat
            );

            if (plan.kind === "file") {
              const planFormat = plan.format;

              writeEvent(res, "file.progress", {
                messageId: assistantMessageId,
                stage: "planning",
                format: planFormat,
              });

              const spec = buildDocumentSpec(plan);

              writeEvent(res, "file.progress", {
                messageId: assistantMessageId,
                stage: "content_generated",
                format: planFormat,
              });

              writeEvent(res, "file.progress", {
                messageId: assistantMessageId,
                stage: "formatting",
                format: planFormat,
              });

              deliveredFile = await generateAndDeliverFile({
                userId: user.id,
                assistantMessageId,
                conversationId: conversation.id,
                spec,
                summary: plan.summary,
              });

              writeEvent(res, "file.progress", {
                messageId: assistantMessageId,
                stage: "validating",
                format: planFormat,
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
            } else {
              // The planner decided this message does not need a file even
              // though a format was forced. Treat this as a file-mode failure
              // rather than silently dropping into normal chat — the two
              // modes must remain strictly separated.
              fileModeFailed = true;
              writeEvent(res, "file.error", {
                messageId: assistantMessageId,
                message: "KSEMO could not create a file for this request. Please try a different request.",
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
              message: "File generation could not be completed.",
            });
          }
        }

        // ------------------------------------------------------------------
        // Web Search & Deep Research — explicit separate modes. They run ONLY
        // when the corresponding mode is active and never bleed into Normal
        // Chat or File Creation.
        // ------------------------------------------------------------------
        if (!isRegenerationTurn && isResearchTurn && activeResearchMode) {
          // Create research session for tracking
          let researchSessionId: string | null = null;
          try {
            const researchSession = await createResearchSession({
              id: crypto.randomUUID(),
              userId: user.id,
              conversationId: conversation.id,
              messageId: assistantMessageId,
              researchMode: activeResearchMode,
              query: content ?? "",
            });
            researchSessionId = researchSession.id;
          } catch (error) {
            console.warn("[ChatStream] Failed to create research session", error);
          }

          try {
            if (activeResearchMode === "web_search") {
              writeEvent(res, "research.stage", {
                messageId: assistantMessageId,
                stage: "searching",
                label: "Searching the web",
              });

              // Real live search. On failure we report a real outage rather
              // than pretending a search happened.
              const sources = await searchWeb(content ?? "");
              researchSources = sources;

              // Update research session with sources
              if (researchSessionId) {
                await updateResearchSession(researchSessionId, {
                  sourcesCount: sources.length,
                  sourcesData: sources,
                });
              }

              writeEvent(res, "research.stage", {
                messageId: assistantMessageId,
                stage: "analyzing",
                label: "Analyzing results",
              });

              if (!researchSources.length) {
                writeEvent(res, "research.sources", {
                  messageId: assistantMessageId,
                  sources: [],
                });
              } else {
                writeEvent(res, "research.sources", {
                  messageId: assistantMessageId,
                  sources: researchSources,
                });
              }

              writeEvent(res, "research.stage", {
                messageId: assistantMessageId,
                stage: "writing",
                label: "Writing your answer",
              });

              responseText = await streamWebAnswer({
                query: content ?? "",
                sources: researchSources,
                signal: generationSignal,
                onDelta: delta =>
                  writeEvent(res, "assistant.delta", {
                    messageId: assistantMessageId,
                    delta,
                  }),
              });

              // Persist the structured sources alongside the answer.
              researchEmbeddedContent = embedSourcesInContent(
                responseText,
                researchSources
              );
              await updateMessage(assistantMessageId, {
                content: researchEmbeddedContent,
                status: "streaming",
              });

              // Mark research session as completed
              if (researchSessionId) {
                await updateResearchSession(researchSessionId, {
                  status: "completed",
                  completedAt: new Date(),
                });
              }

              writeEvent(res, "research.completed", {
                messageId: assistantMessageId,
                sources: researchSources,
              });
            } else {
              // Deep Research — genuine multi-step workflow.
              writeEvent(res, "research.stage", {
                messageId: assistantMessageId,
                stage: "understanding",
                label: "Understanding your question",
              });

              const result = await runDeepResearch({
                topic: content ?? "",
                signal: generationSignal,
                onProgress: (stage: string, label?: string) =>
                  writeEvent(res, "research.stage", {
                    messageId: assistantMessageId,
                    stage,
                    label: label ?? stage,
                  }),
                onDelta: delta =>
                  writeEvent(res, "assistant.delta", {
                    messageId: assistantMessageId,
                    delta,
                  }),
              });

              researchSources = result.sources;

              if (result.sources.length) {
                writeEvent(res, "research.sources", {
                  messageId: assistantMessageId,
                  sources: result.sources,
                });
              }
              if (result.summary) {
                writeEvent(res, "research.summary", {
                  messageId: assistantMessageId,
                  summary: result.summary,
                });
              }

              // Persist the structured sources with the written report.
              researchEmbeddedContent = embedSourcesInContent(
                result.answer,
                result.sources
              );
              await updateMessage(assistantMessageId, {
                content: researchEmbeddedContent,
                status: "streaming",
              });

              // Mark research session as completed
              if (researchSessionId) {
                await updateResearchSession(researchSessionId, {
                  status: "completed",
                  sourcesCount: result.sources.length,
                  sourcesData: result.sources,
                  completedAt: new Date(),
                });
              }

              writeEvent(res, "research.completed", {
                messageId: assistantMessageId,
                sources: result.sources,
                summary: result.summary,
              });
            }
          } catch (error) {
            console.warn(
              `[ChatStream] ${activeResearchMode} failed`,
              error
            );
            researchFailed = true;
            researchErrorText =
              activeResearchMode === "web_search"
                ? "Web search is temporarily unavailable. Please try again."
                : "Deep research could not be completed. Please try again.";
            
            // Mark research session as failed
            if (researchSessionId) {
              await updateResearchSession(researchSessionId, {
                status: "failed",
                errorMessage: researchErrorText,
                completedAt: new Date(),
              });
            }
            
            writeEvent(res, "research.error", {
              messageId: assistantMessageId,
              message: researchErrorText,
              sources: researchSources.length ? researchSources : undefined,
            });
          }
        }

        // ------------------------------------------------------------------
        // Normal Chat — only runs when NOT in file/research creation mode.
        // When a special mode was active and completed (or failed), this block
        // is skipped entirely so the modes never bleed into each other.
        // ------------------------------------------------------------------
        if (
          !deliveredFile &&
          !fileModeFailed &&
          !forcedFormat &&
          !isResearchTurn
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

        if (researchFailed && !userCancelled) {
          // A research mode was active but generation failed. Settle as
          // failed — do NOT fall back to normal chat. Persist whatever partial
          // answer we have (with any sources gathered so far) so we do not
          // lose the streamed content.
          const partialAnswer = researchEmbeddedContent
            ? researchEmbeddedContent
            : embedSourcesInContent(responseText || researchErrorText || "", researchSources);
          await updateMessage(assistantMessageId, {
            content: partialAnswer,
            status: "failed",
          });
          terminalStatusWritten = true;
        } else if (isResearchTurn && !researchFailed && !userCancelled) {
          // Research completed successfully. The full content (answer + sources)
          // was already persisted during the research run; here we only promote
          // the status so we never clobber the embedded sources.
          await updateMessage(assistantMessageId, {
            content:
              researchEmbeddedContent ??
              embedSourcesInContent(responseText || "", researchSources),
            model:
              usedFallbackModel
                ? QUOTA_FALLBACK_MODEL
                : (preferences?.selectedModel ?? null),
            status: "completed",
          });
          terminalStatusWritten = true;
          writeEvent(res, "assistant.completed", {
            messageId: assistantMessageId,
          });
          if (usedFallbackModel) {
            writeEvent(res, "assistant.modelFallback", {
              messageId: assistantMessageId,
              model: QUOTA_FALLBACK_MODEL,
            });
          }
          void memorizeConversation(user.id, conversation.id);
        } else if (fileModeFailed && !userCancelled) {
          // File Creation Mode was active but generation failed. Settle the
          // message as failed — do NOT fall back to normal chat. The two
          // modes must remain strictly separated.
          await updateMessage(assistantMessageId, {
            content: responseText || "",
            status: "failed",
          });
          terminalStatusWritten = true;
        } else if (isResearchTurn && userCancelled) {
          // Research was cancelled by the user. Persist any partial content
          // gathered so far (falling back to the streamed answer) so it is
          // not lost, then mark the message cancelled.
          const cancelledContent = researchEmbeddedContent
            ? researchEmbeddedContent
            : embedSourcesInContent(responseText || "", researchSources);
          await updateMessage(assistantMessageId, {
            content: cancelledContent,
            status: "cancelled",
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
            content:
              responseText || "I’m sorry, I couldn’t generate a response.",
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
            // Capture durable facts from this conversation in the background;
            // this never blocks the response (see memorizeConversation).
            void memorizeConversation(user.id, conversation.id);
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
}
