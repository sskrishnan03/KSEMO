import { TRPCError } from "@trpc/server";
import { z } from "zod";
import {
  clearConversationMemoriesForConversation,
  createConversationMemoryForUser,
  createUserMemoryForUser,
  deleteAllUserMemoriesForUser,
  deleteConversationMemoryForUser,
  deleteUserMemoryForUser,
  getConversationForUser,
  getMemorySettingsForUser,
  getUserMemoryForUser,
  listConversationMemoriesForConversation,
  listPendingMemorySuggestionsForUser,
  listUserMemoriesForUser,
  resolveMemorySuggestionForUser,
  updateConversationForUser,
  updateConversationMemoryForUser,
  updateUserMemoryForUser,
  upsertMemorySettingsForUser,
} from "../supabase-db";
import {
  USER_MEMORY_CATEGORIES,
  type MemorySuggestionMeta,
} from "../../supabase-schema/04-types";
import { protectedProcedure, router } from "../_core/trpc";

const entityId = z.string().min(8).max(36);
const conversationId = z.string().min(8).max(36);
const categoryInput = z.enum([...USER_MEMORY_CATEGORIES]);
const importanceInput = z.enum(["low", "medium", "high"]);
const expiresInput = z
  .object({ days: z.number().int().min(1).max(3650) })
  .nullable()
  .optional();

async function requireConversation(id: string, userId: number) {
  const conversation = await getConversationForUser(id, userId);
  if (!conversation)
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Conversation not found",
    });
  return conversation;
}

function explanationForExplicit(content: string): string {
  const trimmed = content.trim().slice(0, 200);
  return `You explicitly asked me to remember: "${trimmed}"`;
}

export const memoryRouter = router({
  userMemories: router({
    list: protectedProcedure.query(({ ctx }) =>
      listUserMemoriesForUser(ctx.user.id)
    ),
    create: protectedProcedure
      .input(
        z.object({
          content: z.string().trim().min(2).max(2_000),
          category: categoryInput.optional(),
          importance: importanceInput.optional(),
          expires: expiresInput,
        })
      )
      .mutation(async ({ ctx, input }) => {
        const expiresAt = input.expires?.days
          ? new Date(Date.now() + input.expires.days * 24 * 60 * 60 * 1000)
          : null;
        return createUserMemoryForUser({
          userId: ctx.user.id,
          content: input.content,
          category: input.category,
          importance: input.importance,
          // Explicitly created memories are trusted completely.
          confidence: 1,
          source: "explicit",
          explanation: explanationForExplicit(input.content),
          expiresAt,
        });
      }),
    update: protectedProcedure
      .input(
        z.object({
          id: entityId,
          content: z.string().trim().min(2).max(2_000).optional(),
          category: categoryInput.optional(),
          status: z.enum(["active", "disabled"]).optional(),
          importance: importanceInput.optional(),
          expires: expiresInput,
        })
      )
      .mutation(async ({ ctx, input }) => {
        const existing = await getUserMemoryForUser(input.id, ctx.user.id);
        if (!existing)
          throw new TRPCError({ code: "NOT_FOUND", message: "Memory not found" });
        return updateUserMemoryForUser(input.id, ctx.user.id, {
          content: input.content,
          category: input.category,
          status: input.status,
          importance: input.importance,
          expiresAt: input.expires !== undefined
            ? input.expires?.days
              ? new Date(Date.now() + input.expires.days * 24 * 60 * 60 * 1000)
              : null
            : undefined,
        });
      }),
    remove: protectedProcedure
      .input(z.object({ id: entityId }))
      .mutation(async ({ ctx, input }) => {
        const removed = await deleteUserMemoryForUser(input.id, ctx.user.id);
        if (!removed)
          throw new TRPCError({ code: "NOT_FOUND", message: "Memory not found" });
        return { success: true } as const;
      }),
    removeAll: protectedProcedure.mutation(async ({ ctx }) => {
      const removed = await deleteAllUserMemoriesForUser(ctx.user.id);
      return { success: true, removed } as const;
    }),
  }),

  conversationMemories: router({
    list: protectedProcedure
      .input(z.object({ conversationId }))
      .query(async ({ ctx, input }) => {
        await requireConversation(input.conversationId, ctx.user.id);
        return listConversationMemoriesForConversation(
          input.conversationId,
          ctx.user.id
        );
      }),
    create: protectedProcedure
      .input(
        z.object({
          conversationId,
          content: z.string().trim().min(2).max(2_000),
          category: categoryInput.optional(),
          importance: importanceInput.optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        await requireConversation(input.conversationId, ctx.user.id);
        return createConversationMemoryForUser({
          conversationId: input.conversationId,
          userId: ctx.user.id,
          content: input.content,
          category: input.category,
          importance: input.importance,
        });
      }),
    update: protectedProcedure
      .input(
        z.object({
          id: entityId,
          content: z.string().trim().min(2).max(2_000).optional(),
          category: categoryInput.optional(),
          importance: importanceInput.optional(),
        })
      )
      .mutation(async ({ ctx, input }) =>
        updateConversationMemoryForUser(input.id, ctx.user.id, {
          content: input.content,
          category: input.category,
          importance: input.importance,
        })
      ),
    remove: protectedProcedure
      .input(z.object({ id: entityId }))
      .mutation(async ({ ctx, input }) => {
        const removed = await deleteConversationMemoryForUser(
          input.id,
          ctx.user.id
        );
        if (!removed)
          throw new TRPCError({ code: "NOT_FOUND", message: "Memory not found" });
        return { success: true } as const;
      }),
    clearAll: protectedProcedure
      .input(z.object({ conversationId }))
      .mutation(async ({ ctx, input }) => {
        await requireConversation(input.conversationId, ctx.user.id);
        const removed = await clearConversationMemoriesForConversation(
          input.conversationId,
          ctx.user.id
        );
        return { success: true, removed } as const;
      }),
  }),

  suggestions: router({
    list: protectedProcedure.query(({ ctx }) =>
      listPendingMemorySuggestionsForUser(ctx.user.id)
    ),
    dismiss: protectedProcedure
      .input(z.object({ id: entityId }))
      .mutation(async ({ ctx, input }) => {
        const resolved = await resolveMemorySuggestionForUser(
          input.id,
          ctx.user.id,
          "dismissed"
        );
        if (!resolved)
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Suggestion not found",
          });
        return { success: true } as const;
      }),
    accept: protectedProcedure
      .input(
        z.object({
          id: entityId,
          resolution: z
            .enum(["keep_both", "replace", "merge"])
            .default("keep_both"),
          mergedContent: z.string().trim().min(2).max(2_000).optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const pending = await listPendingMemorySuggestionsForUser(ctx.user.id);
        const suggestion = pending.find(item => item.id === input.id);
        if (!suggestion)
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Suggestion not found or already resolved",
          });

        const meta: MemorySuggestionMeta = suggestion.meta ?? {};
        const similar = meta.similarTo ?? [];
        const target = similar[0];

        let createdOrUpdated;

        if (
          (meta.kind === "conflict" || meta.kind === "duplicate") &&
          target
        ) {
          if (input.resolution === "replace") {
            createdOrUpdated = await updateUserMemoryForUser(
              target.id,
              ctx.user.id,
              {
                content: suggestion.content,
                category: suggestion.category,
                importance: suggestion.importance,
              }
            );
          } else if (input.resolution === "merge") {
            if (!input.mergedContent)
              throw new TRPCError({
                code: "BAD_REQUEST",
                message: "A merged wording is required to merge memories.",
              });
            createdOrUpdated = await updateUserMemoryForUser(
              target.id,
              ctx.user.id,
              { content: input.mergedContent }
            );
          } else {
            createdOrUpdated = await createUserMemoryForUser({
              userId: ctx.user.id,
              content: suggestion.content,
              category: suggestion.category,
              importance: suggestion.importance,
              confidence: suggestion.confidence,
              source: "suggested",
              explanation: suggestion.reason
                ? `This was suggested because you mentioned this in your conversations: ${suggestion.reason}`
                : "You accepted this suggestion.",
            });
          }
        } else {
          createdOrUpdated = await createUserMemoryForUser({
            userId: ctx.user.id,
            content: suggestion.content,
            category: suggestion.category,
            importance: suggestion.importance,
            confidence: suggestion.confidence,
            source: "suggested",
            explanation: suggestion.reason
              ? `This was suggested because you mentioned this in your conversations: ${suggestion.reason}`
              : "You accepted this suggestion.",
          });
        }

        await resolveMemorySuggestionForUser(input.id, ctx.user.id, "accepted");
        return createdOrUpdated;
      }),
  }),

  settings: router({
    get: protectedProcedure.query(({ ctx }) =>
      getMemorySettingsForUser(ctx.user.id)
    ),
    update: protectedProcedure
      .input(
        z.object({
          memoryEnabled: z.boolean().optional(),
          autoSuggest: z.boolean().optional(),
          autoSaveInferred: z.boolean().optional(),
          showMemoryUsage: z.boolean().optional(),
        })
      )
      .mutation(({ ctx, input }) =>
        upsertMemorySettingsForUser(ctx.user.id, input)
      ),
  }),

  // Per-conversation pause ("Don't use memory for this conversation").
  conversationControl: router({
    setPaused: protectedProcedure
      .input(z.object({ conversationId, paused: z.boolean() }))
      .mutation(async ({ ctx, input }) => {
        await requireConversation(input.conversationId, ctx.user.id);
        await updateConversationForUser(input.conversationId, ctx.user.id, {
          memoryDisabled: input.paused,
        });
        return { success: true } as const;
      }),
  }),
});
