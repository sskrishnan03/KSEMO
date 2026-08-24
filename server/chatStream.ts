import type { Express, Request, Response } from "express";
import {
  attachFileToMessageForUser,
  createConversationForUser,
  createConversationMemoryForUser,
  createMemorySuggestionForUser,
  createMessage,
  createUserMemoryForUser,
  deleteAllUserMemoriesForUser,
  deleteUserMemoryForUser,
  getConversationForUser,
  getMemorySettingsForUser,
  getUserPreferences,
  listConversationMemoriesForConversation,
  listMessageFilesForUser,
  listMessagesForConversation,
  listPendingMemorySuggestionsForUser,
  listUserMemoriesForUser,
  removeFollowingAssistantDuplicatesForUser,
  resolveMemorySuggestionForUser,
  touchUserMemoriesForUser,
  updateConversationForUser,
  updateMessage,
} from "./supabase-db";
import { streamLLM, type Message } from "./_core/llm";
import { sdk } from "./_core/sdk";
import { storageGetSignedUrl, requestBaseUrl } from "./storage";
import {
  analyzeTurnForMemories,
  detectExplicitCommand,
  evaluateAgainstExisting,
  classifyExplicitContent,
  formatMemoryContextBlock,
  formatRecallBlock,
  isActiveAndUnexpired,
  selectRelevantMemories,
} from "./memory/memoryEngine";
import { DEFAULT_MEMORY_SETTINGS, type UserMemory } from "../supabase-schema/04-types";

const BASE_SYSTEM_INSTRUCTION =
  "You are KSEMO, a thoughtful and reliable AI assistant. Be clear, accurate, respectful, and practical. Use Markdown when it improves readability. Never claim to have completed work you cannot verify.";

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

type UsedMemoryItem = { id: string; content: string };

// Runs the explicit-command side effects ("remember that...", "forget ...").
// Returns notes to inject into the system prompt so the reply can acknowledge
// what actually happened instead of guessing.
async function applyExplicitMemoryCommand(
  userId: number,
  command: NonNullable<ReturnType<typeof detectExplicitCommand>>,
  notes: string[]
): Promise<void> {
  switch (command.kind) {
    case "remember": {
      const { category, importance } = classifyExplicitContent(command.content);
      await createUserMemoryForUser({
        userId,
        content: command.content,
        category,
        importance,
        confidence: 1,
        source: "explicit",
        explanation: `You explicitly asked me to remember: "${command.content.slice(0, 200)}"`,
      });
      notes.push(
        `MEMORY SAVED THIS TURN: The user explicitly asked you to remember "${command.content}". It is now saved as a long-term memory. Briefly confirm this in your reply.`
      );
      return;
    }
    case "forget": {
      if (command.all) {
        const removed = await deleteAllUserMemoriesForUser(userId);
        const pending = await listPendingMemorySuggestionsForUser(userId);
        await Promise.all(
          pending.map(item =>
            resolveMemorySuggestionForUser(item.id, userId, "dismissed")
          )
        );
        notes.push(
          `MEMORY FORGOTTEN: You just deleted all ${removed} stored long-term memories at the user's explicit request. Acknowledge this briefly and kindly.`
        );
        return;
      }
      if (!command.target) {
        // "Don't remember this." declines the most recent suggestion.
        const pending = await listPendingMemorySuggestionsForUser(userId);
        if (pending[0]) {
          await resolveMemorySuggestionForUser(
            pending[0].id,
            userId,
            "dismissed"
          );
          notes.push(
            "The user declined your most recent memory suggestion; it was discarded. Acknowledge briefly."
          );
        } else {
          notes.push(
            "The user said not to remember something, but there are no pending suggestions. Acknowledge briefly."
          );
        }
        return;
      }
      const all = await listUserMemoriesForUser(userId);
      const active = all.filter(memory => isActiveAndUnexpired(memory));
      const verdict = evaluateAgainstExisting(command.target, active);
      let forgotten = verdict.match?.content ?? null;
      if (verdict.match) {
        await deleteUserMemoryForUser(verdict.match.id, userId);
      } else {
        const lowerTarget = command.target.toLowerCase();
        const fuzzy = active.find(
          memory =>
            memory.content.toLowerCase().includes(lowerTarget) ||
            lowerTarget.includes(memory.content.toLowerCase())
        );
        if (fuzzy) {
          await deleteUserMemoryForUser(fuzzy.id, userId);
          forgotten = fuzzy.content;
        }
      }
      notes.push(
        forgotten
          ? `MEMORY FORGOTTEN: You deleted the memory "${forgotten}" at the user's request. Acknowledge briefly.`
          : `FORGET REQUEST NOT FOUND: The user asked you to forget "${command.target}" but no matching memory exists. Say so honestly and briefly.`
      );
      return;
    }
    default:
      return;
  }
}

// Post-turn analysis: detects new candidates, stores conversation memories
// directly, and either saves inferred memories or files pending suggestions.
// Never throws; memory problems must not fail a completed response.
async function runPostTurnMemoryAnalysis(options: {
  res: Response;
  userId: number;
  conversationId: string;
  userMessage: string;
  assistantMessage: string;
  settings: { autoSuggest: boolean; autoSaveInferred: boolean };
  existingActiveUserMemories: UserMemory[];
  existingConversationMemories: Array<{ id: string; content: string }>;
}): Promise<void> {
  try {
    const outcome = await analyzeTurnForMemories(
      {
        userMessage: options.userMessage,
        assistantMessage: options.assistantMessage,
        settings: options.settings,
        existingActiveUserMemories: options.existingActiveUserMemories.filter(
          memory => isActiveAndUnexpired(memory)
        ),
        existingConversationMemories:
          options.existingConversationMemories,
      },
      12_000
    );
    if (!outcome) return;

    for (const candidate of outcome.conversationCandidates) {
      try {
        await createConversationMemoryForUser({
          conversationId: options.conversationId,
          userId: options.userId,
          content: candidate.content,
          category: candidate.category,
          importance: candidate.importance,
        });
      } catch (error) {
        console.warn("[ChatStream] conversation memory save failed", error);
      }
    }

    for (const candidate of outcome.inferredToSave) {
      try {
        await createUserMemoryForUser({
          userId: options.userId,
          content: candidate.content,
          category: candidate.category,
          importance: candidate.importance,
          confidence: candidate.confidence,
          source: "inferred",
          explanation: candidate.reason
            ? `This was suggested because you mentioned this in your conversations: ${candidate.reason}`
            : "Detected automatically from your conversations.",
        });
      } catch (error) {
        console.warn("[ChatStream] inferred memory save failed", error);
      }
    }

    for (const entry of outcome.suggestionsToCreate) {
      try {
        const suggestion = await createMemorySuggestionForUser({
          userId: options.userId,
          conversationId: options.conversationId,
          content: entry.candidate.content,
          category: entry.candidate.category,
          importance: entry.candidate.importance,
          confidence: entry.candidate.confidence,
          reason: entry.candidate.reason || null,
          meta: entry.meta,
        });
        writeEvent(options.res, "memory.suggestion", {
          id: suggestion.id,
          content: suggestion.content,
          kind: entry.meta.kind,
          similarTo: entry.meta.similarTo ?? [],
        });
      } catch (error) {
        console.warn("[ChatStream] suggestion creation failed", error);
      }
    }
  } catch (error) {
    console.warn("[ChatStream] memory analysis failed", error);
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
      // MEMORY SYSTEM
      // User Memory = durable info across conversations.
      // Conversation Memory = context for this conversation only.
      // Explicit commands run immediately; retrieval picks only relevant
      // memories; analysis after the answer proposes anything new.
      // Every step is non-fatal: a memory failure never breaks a response.
      // ============================================
      let usedMemoryItems: UsedMemoryItem[] = [];
      const memoryNotes: string[] = [];
      let recallScope: "user" | "conversation" | null = null;
      let allUserMemoriesSnapshot: UserMemory[] = [];
      const memorySettings = await getMemorySettingsForUser(user.id).catch(
        error => {
          console.warn(
            "[ChatStream] memory settings unavailable, defaults in use",
            error
          );
          return {
            userId: user.id,
            ...DEFAULT_MEMORY_SETTINGS,
            createdAt: new Date(),
            updatedAt: new Date(),
          };
        }
      );
      const memoryActive =
        memorySettings.memoryEnabled && !conversation.memoryDisabled;
      const explicitCommand =
        memoryActive &&
        !body.regenerateAssistantMessageId &&
        content &&
        body.mode !== "voice"
          ? detectExplicitCommand(content)
          : null;

      try {
        if (explicitCommand && explicitCommand.kind !== "recall_user" && explicitCommand.kind !== "recall_conversation") {
          await applyExplicitMemoryCommand(user.id, explicitCommand, memoryNotes);
        }
        if (explicitCommand?.kind === "recall_user") recallScope = "user";
        if (explicitCommand?.kind === "recall_conversation")
          recallScope = "conversation";

        if (memoryActive) {
          const [allUserMemories, allConversationMemories] = await Promise.all([
            listUserMemoriesForUser(user.id),
            listConversationMemoriesForConversation(conversation.id, user.id),
          ]);
          allUserMemoriesSnapshot = allUserMemories;

          if (recallScope === "user") {
            const block = formatRecallBlock(allUserMemories, "user");
            if (block) memoryNotes.push(block);
          } else if (recallScope === "conversation") {
            const block = formatRecallBlock(allConversationMemories, "conversation");
            if (block) memoryNotes.push(block);
          } else {
            const relevant = selectRelevantMemories(
              content ?? "",
              allUserMemories,
              allConversationMemories
            );
            usedMemoryItems = [
              ...relevant.conversationMemories.map(item => ({
                id: item.id,
                content: item.content,
              })),
              ...relevant.userMemories.map(item => ({
                id: item.id,
                content: item.content,
              })),
            ];
            if (usedMemoryItems.length) {
              void touchUserMemoriesForUser(
                relevant.userMemories.map(item => item.id),
                user.id
              ).catch(() => undefined);
              const block = formatMemoryContextBlock(relevant);
              if (block) memoryNotes.push(block);
            }
          }
        }
      } catch (error) {
        console.warn("[ChatStream] memory pipeline failed (non-fatal)", error);
      }

      if (memorySettings.showMemoryUsage && usedMemoryItems.length) {
        writeEvent(res, "memory.used", {
          messageId: assistantMessageId,
          memories: usedMemoryItems,
        });
      }

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
          ...memoryNotes,
        ]
          .filter(Boolean)
          .join("\n\n");

        let generationError: unknown = null;
        let usedFallbackModel = false;
        const chatMessages: Message[] = [
          { role: "system", content: systemInstruction },
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
            // Post-turn memory analysis runs while the stream is still open so
            // suggestion/saved events reach the client in order. It is
            // skipped for voice turns and when memory is off or paused.
            if (memoryActive && body.mode !== "voice") {
              await runPostTurnMemoryAnalysis({
                res,
                userId: user.id,
                conversationId: conversation.id,
                userMessage: content ?? "",
                assistantMessage: responseText,
                settings: memorySettings,
                existingActiveUserMemories: allUserMemoriesSnapshot,
                existingConversationMemories: (
                  await listConversationMemoriesForConversation(
                    conversation.id,
                    user.id
                  ).catch(() => [])
                ).map(item => ({ id: item.id, content: item.content })),
              });
            }
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
