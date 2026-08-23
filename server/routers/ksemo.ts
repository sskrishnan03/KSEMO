import { TRPCError } from "@trpc/server";
import { z } from "zod";
import {
  createConversationForUser,
  createMessage,
  createVoiceSession,
  deleteAllConversationsForUser,
  deleteConversationForUser,
  deleteMessageForUser,
  editMessageForUser,
  getConversationForUser,
  getPublicConversationByToken,
  getMessageForUser,
  listMessageVersionsForUser,
  listMessageFilesForUser,
  getUserPreferences,
  listConversationsForUser,
  listMessagesForConversation,
  moveConversationToTrash,
  restoreConversationForUser,
  searchConversationMessages,
  searchConversationTitles,
  setMessageFeedbackForUser,
  updateConversationForUser,
  upsertUserPreferences,
  updateVoiceSessionForUser,
} from "../supabase-db";
import { listLLMModels } from "../_core/llm";
import { transcribeAudio } from "../_core/voiceTranscription";
import { protectedProcedure, publicProcedure, router } from "../_core/trpc";
import { typeAfterVoiceSession } from "../conversationTypes";

const conversationId = z.string().min(8).max(36);
const preferenceInput = z.object({
  selectedModel: z.string().max(160).nullable().optional(),
  persona: z.enum(["balanced", "concise", "creative", "analytical"]).optional(),
  customInstructions: z.string().max(2_000).nullable().optional(),
  speechRate: z.number().int().min(60).max(180).optional(),
  autoPlayResponses: z.boolean().optional(),
  reduceMotion: z.boolean().optional(),
});

function requireConversation(id: string, userId: number) {
  return getConversationForUser(id, userId).then(conversation => {
    if (!conversation)
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Conversation not found",
      });
    return conversation;
  });
}

export const conversationRouter = router({
  list: protectedProcedure
    .input(
      z
        .object({
          scope: z.enum(["active", "archived", "trash"]).default("active"),
        })
        .optional()
    )
    .query(({ ctx, input }) =>
      listConversationsForUser(ctx.user.id, input?.scope ?? "active")
    ),
  create: protectedProcedure
    .input(
      z.object({
        conversationType: z.enum(["text", "voice", "mixed"]).default("text"),
      })
    )
    .mutation(({ ctx, input }) =>
      createConversationForUser({
        id: crypto.randomUUID(),
        userId: ctx.user.id,
        conversationType: input.conversationType,
      })
    ),
  get: protectedProcedure
    .input(z.object({ id: conversationId }))
    .query(async ({ ctx, input }) => {
      const conversation = await requireConversation(input.id, ctx.user.id);
      const items = await listMessagesForConversation(conversation.id);
      return {
        conversation,
        messages: await Promise.all(
          items.map(async message => ({
            ...message,
            attachments:
              message.role === "user"
                ? await listMessageFilesForUser(message.id, ctx.user.id)
                : [],
          }))
        ),
      };
    }),
  rename: protectedProcedure
    .input(
      z.object({ id: conversationId, title: z.string().trim().min(1).max(120) })
    )
    .mutation(async ({ ctx, input }) => {
      await requireConversation(input.id, ctx.user.id);
      return updateConversationForUser(input.id, ctx.user.id, {
        title: input.title,
      });
    }),
  setPinned: protectedProcedure
    .input(z.object({ id: conversationId, isPinned: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      await requireConversation(input.id, ctx.user.id);
      return updateConversationForUser(input.id, ctx.user.id, {
        isPinned: input.isPinned,
      });
    }),
  setArchived: protectedProcedure
    .input(z.object({ id: conversationId, isArchived: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      await requireConversation(input.id, ctx.user.id);
      return updateConversationForUser(input.id, ctx.user.id, {
        isArchived: input.isArchived,
        isPinned: input.isArchived ? false : undefined,
      });
    }),
  trash: protectedProcedure
    .input(z.object({ id: conversationId }))
    .mutation(async ({ ctx, input }) => {
      await requireConversation(input.id, ctx.user.id);
      await moveConversationToTrash(input.id, ctx.user.id);
      return { success: true } as const;
    }),
  restore: protectedProcedure
    .input(z.object({ id: conversationId }))
    .mutation(async ({ ctx, input }) => {
      await requireConversation(input.id, ctx.user.id);
      await restoreConversationForUser(input.id, ctx.user.id);
      return { success: true } as const;
    }),
  remove: protectedProcedure
    .input(z.object({ id: conversationId }))
    .mutation(async ({ ctx, input }) => {
      await requireConversation(input.id, ctx.user.id);
      await deleteConversationForUser(input.id, ctx.user.id);
      return { success: true } as const;
    }),
  removeAll: protectedProcedure
    .mutation(async ({ ctx }) => {
      const removed = await deleteAllConversationsForUser(ctx.user.id);
      return { success: true, removed } as const;
    }),
  duplicate: protectedProcedure
    .input(z.object({ id: conversationId }))
    .mutation(async ({ ctx, input }) => {
      const original = await requireConversation(input.id, ctx.user.id);
      const duplicate = await createConversationForUser({
        id: crypto.randomUUID(),
        userId: ctx.user.id,
        title: `${original.title.slice(0, 105)} (copy)`,
        conversationType: original.conversationType,
      });
      if (!duplicate)
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Conversation could not be duplicated.",
        });
      const originalMessages = await listMessagesForConversation(original.id);
      for (const message of originalMessages) {
        await createMessage({
          id: crypto.randomUUID(),
          conversationId: duplicate.id,
          role: message.role,
          content: message.content,
          model: message.model,
          status: message.status === "streaming" ? "cancelled" : message.status,
          createdAt: new Date(),
          updatedAt: new Date(),
        });
      }
      return duplicate;
    }),
  export: protectedProcedure
    .input(z.object({ id: conversationId }))
    .query(async ({ ctx, input }) => {
      const conversation = await requireConversation(input.id, ctx.user.id);
      const items = await listMessagesForConversation(conversation.id);
      return { conversation, messages: items };
    }),
  configurePublicShare: protectedProcedure
    .input(z.object({ id: conversationId, isPublic: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      const conversation = await requireConversation(input.id, ctx.user.id);
      const shareToken = input.isPublic
        ? conversation.shareToken || Array.from(crypto.getRandomValues(new Uint8Array(24))).map(b => b.toString(36).padStart(2, '0')).join('').slice(0, 24)
        : null;
      const updated = await updateConversationForUser(input.id, ctx.user.id, {
        isPublic: input.isPublic,
        shareToken: shareToken,
      });
      return {
        isPublic: Boolean(updated?.isPublic),
        shareToken: updated?.shareToken ?? null,
      };
    }),
  getPublic: publicProcedure
    .input(z.object({ token: z.string().min(16).max(64) }))
    .query(async ({ input }) => {
      const shared = await getPublicConversationByToken(input.token);
      if (!shared)
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Shared conversation not found",
        });
      return {
        conversation: {
          title: shared.conversation.title,
          createdAt: new Date(shared.conversation.created_at),
        },
        messages: shared.messages
          .filter(
            (message: any) => message.role === "user" || message.role === "assistant"
          )
          .map((message: any) => ({
            id: message.id,
            role: message.role,
            content: message.content,
            createdAt: new Date(message.created_at),
          })),
      };
    }),
  search: protectedProcedure
    .input(z.object({ query: z.string().trim().min(2).max(120) }))
    .query(async ({ ctx, input }) => {
      const [messageMatches, titleMatches] = await Promise.all([
        searchConversationMessages(ctx.user.id, input.query),
        searchConversationTitles(ctx.user.id, input.query),
      ]);
      return {
        chats: titleMatches.map((conversation: any) => ({
          conversationId: conversation.id,
          conversationTitle: conversation.title,
          createdAt: conversation.updatedAt,
        })),
        messages: messageMatches.slice(0, 30),
      };
    }),
});

export const preferenceRouter = router({
  get: protectedProcedure.query(
    async ({ ctx }) => (await getUserPreferences(ctx.user.id)) ?? null
  ),
  update: protectedProcedure
    .input(preferenceInput)
    .mutation(({ ctx, input }) => upsertUserPreferences(ctx.user.id, input)),
  models: protectedProcedure.query(async () => {
    try {
      const catalog = await listLLMModels();
      return catalog.data
        .map(model => ({
          id: model.id.replace(/^models\//, ""),
          label: model.id.replace(/^models\//, ""),
        }))
        .filter(
          model =>
            /^gemini-/.test(model.id) &&
            !/tts|image|embedding|veo|lyria|robotics|aqa|native-audio|computer-use|live/.test(
              model.id
            )
        );
    } catch (error) {
      console.error("[KSEMO] model catalogue unavailable", error);
      return [];
    }
  }),
});

export const messageRouter = router({
  remove: protectedProcedure
    .input(z.object({ id: z.string().min(8).max(36) }))
    .mutation(async ({ ctx, input }) => {
      const removed = await deleteMessageForUser(input.id, ctx.user.id);
      if (!removed)
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Message not found",
        });
      return { success: true } as const;
    }),
  edit: protectedProcedure
    .input(
      z.object({
        id: z.string().min(8).max(36),
        content: z.string().trim().min(1).max(16_000),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const existing = await getMessageForUser(input.id, ctx.user.id);
      if (!existing)
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Message not found",
        });
      if (existing.role !== "user")
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Only your own messages can be edited.",
        });
      return editMessageForUser({
        id: input.id,
        userId: ctx.user.id,
        versionId: crypto.randomUUID(),
        content: input.content,
      });
    }),
  history: protectedProcedure
    .input(z.object({ id: z.string().min(8).max(36) }))
    .query(async ({ ctx, input }) => {
      const versions = await listMessageVersionsForUser(input.id, ctx.user.id);
      if (!versions)
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Message not found",
        });
      return versions;
    }),
  restoreVersion: protectedProcedure
    .input(
      z.object({
        id: z.string().min(8).max(36),
        versionId: z.string().min(8).max(36),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const existing = await getMessageForUser(input.id, ctx.user.id);
      if (!existing)
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Message not found",
        });
      if (existing.role !== "user")
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Only your own messages can be restored.",
        });
      const versions = await listMessageVersionsForUser(input.id, ctx.user.id);
      const version = versions?.find(item => item.id === input.versionId);
      if (!version)
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Message version not found",
        });
      return editMessageForUser({
        id: input.id,
        userId: ctx.user.id,
        versionId: crypto.randomUUID(),
        content: version.content,
      });
    }),
  feedback: protectedProcedure
    .input(
      z.object({
        messageId: z.string().min(8).max(36),
        value: z.enum(["up", "down"]),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const message = await getMessageForUser(input.messageId, ctx.user.id);
      if (!message)
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Message not found",
        });
      if (message.role !== "assistant")
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Feedback is available for assistant responses only.",
        });
      await setMessageFeedbackForUser({
        id: crypto.randomUUID(),
        messageId: message.id,
        userId: ctx.user.id,
        value: input.value,
      });
      return { success: true } as const;
    }),
});

const supportedAudioTypes = new Set([
  "audio/webm",
  "audio/ogg",
  "audio/mpeg",
  "audio/wav",
  "audio/mp4",
]);

export const voiceRouter = router({
  sessionStart: protectedProcedure
    .input(z.object({ conversationId: conversationId.optional() }))
    .mutation(async ({ ctx, input }) => {
      let conversation = input.conversationId
        ? await requireConversation(input.conversationId, ctx.user.id)
        : await createConversationForUser({
            id: crypto.randomUUID(),
            userId: ctx.user.id,
            conversationType: "voice",
          });
      if (!conversation)
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Unable to create a voice session.",
        });
      const nextType = typeAfterVoiceSession(conversation.conversationType);
      if (nextType !== conversation.conversationType) {
        const updated = await updateConversationForUser(
          conversation.id,
          ctx.user.id,
          { conversationType: nextType }
        );
        if (updated) conversation = updated;
      }
      if (!conversation)
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Unable to update the conversation voice mode.",
        });
      const session = await createVoiceSession({
        id: crypto.randomUUID(),
        userId: ctx.user.id,
        conversationId: conversation.id,
      });
      return { session, conversation };
    }),
  sessionStatus: protectedProcedure
    .input(
      z.object({
        id: z.string().min(8).max(36),
        status: z.enum([
          "connecting",
          "listening",
          "speaking",
          "processing",
          "interrupted",
          "ended",
          "error",
        ]),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await updateVoiceSessionForUser(input.id, ctx.user.id, input.status);
      return { success: true } as const;
    }),
  transcribe: protectedProcedure
    .input(
      z.object({
        audioBase64: z.string().min(1),
        mimeType: z
          .string()
          .refine(
            type => supportedAudioTypes.has(type),
            "Unsupported audio format"
          ),
        language: z.string().length(2).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const buffer = Buffer.from(input.audioBase64, "base64");
      if (!buffer.length || buffer.length > 12 * 1024 * 1024) {
        throw new TRPCError({
          code: "PAYLOAD_TOO_LARGE",
          message: "Recordings must be smaller than 12 MB.",
        });
      }
      const result = await transcribeAudio({
        audio: buffer,
        mimeType: input.mimeType,
        language: input.language,
        prompt: "Transcribe the user's KSEMO message faithfully.",
      });
      if ("error" in result) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: result.error,
          cause: result,
        });
      }
      return {
        text: result.text,
        language: result.language,
        duration: result.duration,
      };
    }),
});
