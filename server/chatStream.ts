import type { Express, Request, Response } from "express";
import {
  attachFileToMessageForUser,
  createConversationForUser,
  createMessage,
  getConversationForUser,
  getUserPreferences,
  listMessageFilesForUser,
  listMessagesForConversation,
  removeFollowingAssistantDuplicatesForUser,
  updateConversationForUser,
  updateMessage,
} from "./supabase-db";
import { streamLLM, type Message } from "./_core/llm";
import { sdk } from "./_core/sdk";
import { storageGetSignedUrl, requestBaseUrl } from "./storage";
import {
  composeWebSearchContext,
  performWebSearch,
} from "./webSearch";

const BASE_SYSTEM_INSTRUCTION =
  "You are KSEMO, a thoughtful and reliable AI assistant. Be clear, accurate, respectful, and practical. Use Markdown when it improves readability. Never claim to have completed work you cannot verify.";

// Per-file cap on extracted document text injected into the model context.
const FILE_TEXT_PER_FILE_CHARS = 12_000;

const VOICE_STYLE_INSTRUCTION =
  "Your reply will be spoken aloud in a live voice conversation. Answer exactly what was asked, briefly and naturally — one to three short sentences for simple questions like greetings, a little more only when depth is genuinely required. No filler, no lists, no markdown formatting, no repeating the question back.";

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
      mode?: string;
      webSearch?: boolean;
    };
    let content = body.content?.trim();
    if (
      !body.regenerateAssistantMessageId &&
      (!content || content.length > 16_000)
    ) {
      res.status(400).json({
        error: "A message between 1 and 16,000 characters is required.",
      });
      return;
    }

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
        if (body.regenerateAssistantMessageId || !content) {
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
        ).slice(0, 6)) {
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
        const fileUrlBase = requestBaseUrl(req);
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
                .filter(message => message.content.length > 0)
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
                  if (!media.length)
                    return { role: "user" as const, content: message.content };
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
                  > = [{ type: "text", text: message.content }];
                  for (const file of media) {
                    if (file.mimeType.startsWith("image/")) {
                      contentParts.push({
                        type: "image_url",
                        image_url: {
                          url: await storageGetSignedUrl(
                            file.storageKey,
                            fileUrlBase
                          ),
                          detail: "auto",
                        },
                      });
                    } else if (file.mimeType === "application/pdf") {
                      contentParts.push({
                        type: "file_url",
                        file_url: {
                          url: await storageGetSignedUrl(
                            file.storageKey,
                            fileUrlBase
                          ),
                          mime_type: "application/pdf",
                        },
                      });
                      if (file.contentText) {
                        contentParts.push({
                          type: "text",
                          text: `Extracted text of ${file.filename}:\n\n${file.contentText.slice(0, FILE_TEXT_PER_FILE_CHARS)}`,
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
        const personaInstruction = {
          balanced: "Use a balanced level of detail.",
          concise: "Be direct and concise unless the user asks for depth.",
          creative: "Offer inventive but grounded ideas when useful.",
          analytical:
            "Reason carefully, state assumptions, and organize analysis clearly.",
        }[preferences?.persona ?? "balanced"];
        const systemInstruction = [
          BASE_SYSTEM_INSTRUCTION,
          personaInstruction,
          preferences?.customInstructions?.trim(),
          body.mode === "voice" ? VOICE_STYLE_INSTRUCTION : null,
        ]
          .filter(Boolean)
          .join("\n\n");

        // WEB SEARCH: when the user toggled it on in the composer, retrieve
        // fresh results for this turn and hand them to the model. Failures
        // degrade silently to a normal answer.
        let webSearchContext: string | null = null;
        if (body.webSearch) {
          const searchQuery =
            (body.regenerateAssistantMessageId
              ? [...historyForContext]
                  .reverse()
                  .find(message => message.role === "user")?.content
              : content) ?? "";
          if (searchQuery) {
            const searchResults = await performWebSearch(searchQuery);
            webSearchContext = composeWebSearchContext(
              searchQuery,
              searchResults
            );
            writeEvent(res, "web.sources", {
              messageId: assistantMessageId,
              query: searchQuery,
              sources: searchResults.map(result => ({
                title: result.title,
                url: result.url,
              })),
            });
          }
        }

        let generationError: unknown = null;
        let usedFallbackModel = false;
        const chatMessages: Message[] = [
          { role: "system", content: systemInstruction },
          ...(webSearchContext
            ? [
                {
                  role: "system" as const,
                  content: webSearchContext,
                },
              ]
            : []),
          ...assistantContext,
        ];
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

        if (
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
        if ((generationError || timedOut) && !controller.signal.aborted) {
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
