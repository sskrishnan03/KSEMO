import type { Express, Request, Response } from "express";
import { nanoid } from "nanoid";
import {
  createConversationForUser,
  createMessage,
  attachFileToMessageForUser,
  getConversationForUser,
  getUserPreferences,
  listMessageFilesForUser,
  listMessagesForConversation,
  removeFollowingAssistantDuplicatesForUser,
  updateConversationForUser,
  updateMessage,
} from "./db";
import { streamLLM, type Message } from "./_core/llm";
import { sdk } from "./_core/sdk";
import { storageGetSignedUrl } from "./storage";

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
  res.write(`event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`);
}

export function registerChatStream(app: Express) {
  app.post("/api/chat/stream", async (req: Request, res: Response) => {
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
      res
        .status(400)
        .json({
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
          res
            .status(400)
            .json({
              error:
                "A saved conversation is required to regenerate a response.",
            });
          return;
        }
        conversation = await createConversationForUser({
          id: nanoid(),
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

      let userMessageId = nanoid();
      const assistantMessageId = body.regenerateAssistantMessageId ?? nanoid();
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
          status: "completed",
        });
        for (const fileId of Array.from(
          new Set(body.attachmentFileIds ?? [])
        ).slice(0, 6)) {
          const attached = await attachFileToMessageForUser({
            id: nanoid(),
            fileId,
            messageId: userMessageId,
            userId: user.id,
          });
          if (!attached) {
            res
              .status(400)
              .json({
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
          status: "streaming",
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

      const preferences = await getUserPreferences(user.id);
      const assistantContext = await Promise.all(
        historyForContext
          .filter(
            message => message.role === "user" || message.role === "assistant"
          )
          .slice(-30)
          .filter(message => message.content.length > 0)
          .map(async message => {
            if (message.role !== "user")
              return { role: "assistant" as const, content: message.content };
            const media = await listMessageFilesForUser(message.id, user.id);
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
                    url: await storageGetSignedUrl(file.storageKey),
                    detail: "auto",
                  },
                });
              } else if (file.mimeType === "application/pdf") {
                contentParts.push({
                  type: "file_url",
                  file_url: {
                    url: await storageGetSignedUrl(file.storageKey),
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

      writeEvent(res, "conversation", {
        conversationId: conversation.id,
        title:
          conversation.title === "New conversation"
            ? createTitle(content ?? "New conversation")
            : conversation.title,
        userMessageId,
        assistantMessageId,
      });

      let responseText = "";
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
          controller.signal,
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
            controller.signal
          );
          usedFallbackModel = true;
          generationError = null;
        } catch (fallbackError) {
          generationError = fallbackError;
        }
      }

      if (generationError && !controller.signal.aborted) {
        await updateMessage(assistantMessageId, {
          content: responseText,
          status: "failed",
        });
        console.error("[ChatStream] generation failed", generationError);
        writeEvent(res, "assistant.error", {
          messageId: assistantMessageId,
          message: isQuotaError(generationError)
            ? "KSEMO reached today's free limit for this model. It resets in about 24 hours — switch models in Settings for a separate limit, or add billing to your Gemini API key."
            : "KSEMO could not complete this response. Please try again.",
        });
      } else {
        const cancelled = controller.signal.aborted;
        await updateMessage(assistantMessageId, {
          content: responseText || "I’m sorry, I couldn’t generate a response.",
          model: usedFallbackModel
            ? QUOTA_FALLBACK_MODEL
            : (preferences?.selectedModel ?? null),
          status: cancelled ? "cancelled" : "completed",
        });
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
      finished = true;
      res.end();
    } catch (error) {
      console.error("[ChatStream] setup failed", error);
      if (!res.headersSent)
        res.status(500).json({ error: "Unable to start the response stream." });
      else res.end();
    }
  });
}
