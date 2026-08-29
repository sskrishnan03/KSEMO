import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { MEMORY_CATEGORIES, type MemoryCategoryId } from "@shared/memory";
import {
  deleteAllUserMemories,
  deleteUserMemory,
  getMemorySettings,
  getConversationForUser,
  createUserMemory,
  listMessagesForConversation,
  listUserMemories,
  updateUserMemory,
  upsertMemorySettings,
  type MemorySettings,
  type MemorySettingsValues,
} from "../supabase-db";
import { protectedProcedure, router } from "../_core/trpc";
import {
  extractMemoryCandidates,
  type MemoryCandidate,
} from "../memory/extract";
import { isSensitiveMemoryCategory } from "@shared/memory";

const memoryCategorySchema = z.enum(
  MEMORY_CATEGORIES.map(category => category.id) as [
    MemoryCategoryId,
    ...MemoryCategoryId[],
  ]
);

const memoryTitleSchema = z.string().trim().min(1).max(160);
const memoryContentSchema = z.string().trim().min(1).max(4_000);

async function ensureSensitiveAllowed(userId: number, category: string) {
  if (!isSensitiveMemoryCategory(category)) return;
  const settings = await getMemorySettings(userId);
  if (!settings?.sensitiveMemoryEnabled) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message:
        "Sensitive memory is turned off. Enable sensitive topics in Memory settings before saving sensitive information.",
    });
  }
}

async function resolveConversationOwner(
  userId: number,
  conversationId: string | undefined
) {
  if (!conversationId) return;
  const conversation = await getConversationForUser(conversationId, userId);
  if (!conversation) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "The selected conversation no longer exists.",
    });
  }
}

export const memoryRouter = router({
  settings: router({
    get: protectedProcedure.query(async ({ ctx }) => {
      const settings = await getMemorySettings(ctx.user.id);
      if (settings) return settings;
      return {
        userId: ctx.user.id,
        memoryEnabled: false,
        generateFromChats: false,
        sensitiveMemoryEnabled: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      } satisfies MemorySettings;
    }),
    update: protectedProcedure
      .input(
        z.object({
          memoryEnabled: z.boolean().optional(),
          generateFromChats: z.boolean().optional(),
          sensitiveMemoryEnabled: z.boolean().optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const existing = await getMemorySettings(ctx.user.id);
        const merged: MemorySettingsValues = {
          ...(existing ?? {
            memoryEnabled: false,
            generateFromChats: false,
            sensitiveMemoryEnabled: false,
          }),
          ...input,
        };
        // Turning memory off also disables chat generation. The reverse is not
        // automatic: the user re-opts into generation explicitly.
        if (merged.memoryEnabled === false) merged.generateFromChats = false;
        return upsertMemorySettings(ctx.user.id, merged);
      }),
  }),

  list: protectedProcedure
    .input(
      z
        .object({
          query: z.string().trim().max(120).optional(),
          category: memoryCategorySchema.optional(),
        })
        .optional()
    )
    .query(({ ctx, input }) =>
      listUserMemories(ctx.user.id, {
        query: input?.query,
        category: input?.category,
      })
    ),

  create: protectedProcedure
    .input(
      z.object({
        title: memoryTitleSchema,
        content: memoryContentSchema,
        category: memoryCategorySchema.default("general"),
        source: z.enum(["manual", "chat"]).default("manual"),
        sourceConversationId: z.string().min(8).max(36).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await ensureSensitiveAllowed(ctx.user.id, input.category);
      await resolveConversationOwner(ctx.user.id, input.sourceConversationId);

      const memory = await createUserMemory(ctx.user.id, {
        title: input.title,
        content: input.content,
        category: input.category,
        isSensitive: isSensitiveMemoryCategory(input.category),
        source: input.source,
        sourceConversationId: input.sourceConversationId ?? null,
        consentStatus: "explicit",
      });
      if (!memory) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to save memory.",
        });
      }
      return memory;
    }),

  update: protectedProcedure
    .input(
      z.object({
        id: z.string().min(8).max(36),
        title: memoryTitleSchema,
        content: memoryContentSchema,
        category: memoryCategorySchema,
      })
    )
    .mutation(async ({ ctx, input }) => {
      await ensureSensitiveAllowed(ctx.user.id, input.category);

      const memory = await updateUserMemory(ctx.user.id, input.id, {
        title: input.title,
        content: input.content,
        category: input.category,
        isSensitive: isSensitiveMemoryCategory(input.category),
      });
      if (!memory) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Memory not found.",
        });
      }
      return memory;
    }),

  remove: protectedProcedure
    .input(z.object({ id: z.string().min(8).max(36) }))
    .mutation(async ({ ctx, input }) => {
      const removed = await deleteUserMemory(ctx.user.id, input.id);
      if (!removed) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Memory not found.",
        });
      }
      return { success: true } as const;
    }),

  clear: protectedProcedure.mutation(async ({ ctx }) => {
    const removed = await deleteAllUserMemories(ctx.user.id);
    return { removed } as const;
  }),

  // Generates memory candidates from the user's chosen conversations. Nothing
  // is saved here — every candidate goes back to the client for review.
  generate: protectedProcedure
    .input(
      z.object({
        conversationIds: z.array(z.string().min(8).max(36)).min(1).max(50),
      })
    )
    .mutation(
      async ({
        ctx,
        input,
      }): Promise<{ candidates: MemoryCandidate[]; blockedSensitive: number }> => {
        const settings = await getMemorySettings(ctx.user.id);

        const resolved = await Promise.all(
          input.conversationIds.map(async id => {
            const conversation = await getConversationForUser(id, ctx.user.id);
            if (!conversation) {
              throw new TRPCError({
                code: "BAD_REQUEST",
                message: "One or more selected conversations no longer exist.",
              });
            }
            const messages = await listMessagesForConversation(conversation.id);
            return {
              id: conversation.id,
              title: conversation.title,
              messages,
            };
          })
        );

        const { candidates, blockedSensitive } = extractMemoryCandidates(
          resolved,
          { includeSensitive: settings?.sensitiveMemoryEnabled ?? false }
        );
        return { candidates, blockedSensitive };
      }
    ),

  // Persists candidates the user explicitly approved in the review step.
  approveGenerated: protectedProcedure
    .input(
      z.object({
        items: z
          .array(
            z.object({
              title: memoryTitleSchema,
              content: memoryContentSchema,
              category: memoryCategorySchema,
              sourceConversationId: z.string().min(8).max(36).optional(),
            })
          )
          .min(1)
          .max(40),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Validate everything before saving anything so a mid-batch failure
      // cannot leave behind a partially-approved set of memories.
      for (const item of input.items) {
        await ensureSensitiveAllowed(ctx.user.id, item.category);
        await resolveConversationOwner(
          ctx.user.id,
          item.sourceConversationId
        );
      }
      for (const item of input.items) {
        const memory = await createUserMemory(ctx.user.id, {
          title: item.title,
          content: item.content,
          category: item.category,
          isSensitive: isSensitiveMemoryCategory(item.category),
          source: "chat",
          sourceConversationId: item.sourceConversationId ?? null,
          consentStatus: "explicit",
        });
        if (!memory) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Failed to save memory.",
          });
        }
      }
      return { saved: input.items.length } as const;
    }),
});