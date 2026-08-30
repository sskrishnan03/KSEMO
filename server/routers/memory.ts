import { z } from "zod";
import {
  getMemorySettings,
  listUserMemories,
  upsertMemorySettings,
  type MemorySettings,
} from "../supabase-db";
import { protectedProcedure, router } from "../_core/trpc";

// Memory is a single master toggle: when it is on, KSEMO automatically
// analyzes conversations, stores the facts it finds, and uses them in future
// replies. There are no manual memory CRUD or bulk-generation endpoints;
// everything the client needs is the settings object and the stored list.
export const memoryRouter = router({
  settings: router({
    get: protectedProcedure.query(async ({ ctx }) => {
      const settings = await getMemorySettings(ctx.user.id);
      return (settings ?? {
        userId: ctx.user.id,
        memoryEnabled: false,
        generateFromChats: false,
        sensitiveMemoryEnabled: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      }) satisfies MemorySettings;
    }),
    update: protectedProcedure
      .input(
        z.object({
          memoryEnabled: z.boolean().optional(),
          generateFromChats: z.boolean().optional(),
          sensitiveMemoryEnabled: z.boolean().optional(),
        })
      )
      .mutation(async ({ ctx, input }) =>
        upsertMemorySettings(ctx.user.id, {
          memoryEnabled: input.memoryEnabled,
          generateFromChats: input.generateFromChats,
          sensitiveMemoryEnabled: input.sensitiveMemoryEnabled,
        })
      ),
  }),

  list: protectedProcedure.query(async ({ ctx }) =>
    listUserMemories(ctx.user.id)
  ),
});
