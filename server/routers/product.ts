import { TRPCError } from "@trpc/server";
import { and, desc, eq, ilike, isNull, or } from "drizzle-orm";
import { nanoid } from "nanoid";
import { z } from "zod";
import {
  attachments,
  conversations,
  files,
  memories,
  projects,
} from "../../drizzle/schema";
import { getDb } from "../db";
import { storagePut } from "../storage";
import { protectedProcedure, router } from "../_core/trpc";

const entityId = z.string().min(8).max(36);
const projectInput = z.object({
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().max(2_000).nullable().optional(),
  instructions: z.string().trim().max(4_000).nullable().optional(),
});
const memoryInput = z.object({
  content: z.string().trim().min(1).max(2_000),
  category: z
    .enum(["preference", "fact", "project", "instruction"])
    .default("fact"),
  projectId: entityId.nullable().optional(),
});

async function dbOrThrow() {
  const db = await getDb();
  if (!db)
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "KSEMO storage is unavailable.",
    });
  return db;
}

async function ownedProject(projectId: string, userId: number) {
  const db = await dbOrThrow();
  const result = await db
    .select()
    .from(projects)
    .where(and(eq(projects.id, projectId), eq(projects.userId, userId)))
    .limit(1);
  if (!result[0])
    throw new TRPCError({ code: "NOT_FOUND", message: "Project not found." });
  return result[0];
}

async function optionalOwnedProject(
  projectId: string | null | undefined,
  userId: number
) {
  if (projectId) await ownedProject(projectId, userId);
}

function safeFilename(name: string) {
  return (
    name
      .replace(/[^a-zA-Z0-9._-]/g, "-")
      .replace(/-+/g, "-")
      .slice(0, 180) || "upload"
  );
}

const allowedMimeTypes = new Set([
  "application/pdf",
  "text/plain",
  "text/markdown",
  "text/csv",
  "application/json",
  "image/png",
  "image/jpeg",
  "image/webp",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);

export const workspaceRouter = router({
  projects: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      const db = await dbOrThrow();
      return db
        .select()
        .from(projects)
        .where(
          and(eq(projects.userId, ctx.user.id), eq(projects.isArchived, false))
        )
        .orderBy(desc(projects.updatedAt));
    }),
    create: protectedProcedure
      .input(projectInput)
      .mutation(async ({ ctx, input }) => {
        const db = await dbOrThrow();
        const id = nanoid();
        await db.insert(projects).values({ id, userId: ctx.user.id, ...input });
        return (
          await db.select().from(projects).where(eq(projects.id, id)).limit(1)
        )[0];
      }),
    update: protectedProcedure
      .input(projectInput.partial().extend({ id: entityId }))
      .mutation(async ({ ctx, input }) => {
        const db = await dbOrThrow();
        await ownedProject(input.id, ctx.user.id);
        const { id, ...values } = input;
        await db
          .update(projects)
          .set({ ...values, updatedAt: new Date() })
          .where(and(eq(projects.id, id), eq(projects.userId, ctx.user.id)));
        return (
          await db.select().from(projects).where(eq(projects.id, id)).limit(1)
        )[0];
      }),
    archive: protectedProcedure
      .input(z.object({ id: entityId, isArchived: z.boolean() }))
      .mutation(async ({ ctx, input }) => {
        const db = await dbOrThrow();
        await ownedProject(input.id, ctx.user.id);
        await db
          .update(projects)
          .set({ isArchived: input.isArchived, updatedAt: new Date() })
          .where(eq(projects.id, input.id));
        return { success: true } as const;
      }),
    remove: protectedProcedure
      .input(z.object({ id: entityId }))
      .mutation(async ({ ctx, input }) => {
        const db = await dbOrThrow();
        await ownedProject(input.id, ctx.user.id);
        await db
          .delete(projects)
          .where(
            and(eq(projects.id, input.id), eq(projects.userId, ctx.user.id))
          );
        return { success: true } as const;
      }),
    conversations: protectedProcedure
      .input(z.object({ projectId: entityId }))
      .query(async ({ ctx, input }) => {
        const db = await dbOrThrow();
        await ownedProject(input.projectId, ctx.user.id);
        return db
          .select()
          .from(conversations)
          .where(
            and(
              eq(conversations.userId, ctx.user.id),
              eq(conversations.projectId, input.projectId),
              isNull(conversations.deletedAt)
            )
          )
          .orderBy(desc(conversations.updatedAt));
      }),
    setConversation: protectedProcedure
      .input(
        z.object({ conversationId: entityId, projectId: entityId.nullable() })
      )
      .mutation(async ({ ctx, input }) => {
        const db = await dbOrThrow();
        await optionalOwnedProject(input.projectId, ctx.user.id);
        const conversation = await db
          .select()
          .from(conversations)
          .where(
            and(
              eq(conversations.id, input.conversationId),
              eq(conversations.userId, ctx.user.id)
            )
          )
          .limit(1);
        if (!conversation[0])
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Conversation not found.",
          });
        await db
          .update(conversations)
          .set({ projectId: input.projectId, updatedAt: new Date() })
          .where(eq(conversations.id, input.conversationId));
        return { success: true } as const;
      }),
  }),
  memories: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      const db = await dbOrThrow();
      return db
        .select()
        .from(memories)
        .where(eq(memories.userId, ctx.user.id))
        .orderBy(desc(memories.updatedAt));
    }),
    create: protectedProcedure
      .input(memoryInput)
      .mutation(async ({ ctx, input }) => {
        const db = await dbOrThrow();
        await optionalOwnedProject(input.projectId, ctx.user.id);
        const id = nanoid();
        await db.insert(memories).values({ id, userId: ctx.user.id, ...input });
        return (
          await db.select().from(memories).where(eq(memories.id, id)).limit(1)
        )[0];
      }),
    setActive: protectedProcedure
      .input(z.object({ id: entityId, isActive: z.boolean() }))
      .mutation(async ({ ctx, input }) => {
        const db = await dbOrThrow();
        await db
          .update(memories)
          .set({ isActive: input.isActive, updatedAt: new Date() })
          .where(
            and(eq(memories.id, input.id), eq(memories.userId, ctx.user.id))
          );
        return { success: true } as const;
      }),
    remove: protectedProcedure
      .input(z.object({ id: entityId }))
      .mutation(async ({ ctx, input }) => {
        const db = await dbOrThrow();
        await db
          .delete(memories)
          .where(
            and(eq(memories.id, input.id), eq(memories.userId, ctx.user.id))
          );
        return { success: true } as const;
      }),
  }),
  files: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      const db = await dbOrThrow();
      return db
        .select()
        .from(files)
        .where(eq(files.userId, ctx.user.id))
        .orderBy(desc(files.createdAt));
    }),
    upload: protectedProcedure
      .input(
        z.object({
          filename: z.string().trim().min(1).max(255),
          mimeType: z.string().min(1).max(160),
          dataBase64: z.string().min(1),
          projectId: entityId.nullable().optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        if (!allowedMimeTypes.has(input.mimeType))
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "This file type is not supported in the KSEMO library.",
          });
        const buffer = Buffer.from(input.dataBase64, "base64");
        if (!buffer.length || buffer.length > 8 * 1024 * 1024)
          throw new TRPCError({
            code: "PAYLOAD_TOO_LARGE",
            message: "Files must be smaller than 8 MB.",
          });
        await optionalOwnedProject(input.projectId, ctx.user.id);
        const db = await dbOrThrow();
        const id = nanoid();
        const saved = await storagePut(
          `library/${ctx.user.id}/${id}-${safeFilename(input.filename)}`,
          buffer,
          input.mimeType
        );
        await db
          .insert(files)
          .values({
            id,
            userId: ctx.user.id,
            projectId: input.projectId,
            storageKey: saved.key,
            url: saved.url,
            filename: input.filename,
            mimeType: input.mimeType,
            sizeBytes: buffer.length,
          });
        return (
          await db.select().from(files).where(eq(files.id, id)).limit(1)
        )[0];
      }),
    remove: protectedProcedure
      .input(z.object({ id: entityId }))
      .mutation(async ({ ctx, input }) => {
        const db = await dbOrThrow();
        await db
          .delete(files)
          .where(and(eq(files.id, input.id), eq(files.userId, ctx.user.id)));
        return { success: true } as const;
      }),
    attachToConversation: protectedProcedure
      .input(z.object({ fileId: entityId, conversationId: entityId }))
      .mutation(async ({ ctx, input }) => {
        const db = await dbOrThrow();
        const [file] = await db
          .select()
          .from(files)
          .where(and(eq(files.id, input.fileId), eq(files.userId, ctx.user.id)))
          .limit(1);
        if (!file)
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "File not found.",
          });
        const [conversation] = await db
          .select()
          .from(conversations)
          .where(
            and(
              eq(conversations.id, input.conversationId),
              eq(conversations.userId, ctx.user.id)
            )
          )
          .limit(1);
        if (!conversation)
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Conversation not found.",
          });
        const [existing] = await db
          .select()
          .from(attachments)
          .where(
            and(
              eq(attachments.fileId, file.id),
              eq(attachments.conversationId, conversation.id)
            )
          )
          .limit(1);
        if (!existing)
          await db
            .insert(attachments)
            .values({
              id: nanoid(),
              fileId: file.id,
              conversationId: conversation.id,
            });
        return { success: true } as const;
      }),
  }),
  search: protectedProcedure
    .input(z.object({ query: z.string().trim().min(2).max(120) }))
    .query(async ({ ctx, input }) => {
      const db = await dbOrThrow();
      const phrase = `%${input.query}%`;
      const memoryResults = await db
        .select()
        .from(memories)
        .where(
          and(eq(memories.userId, ctx.user.id), ilike(memories.content, phrase))
        )
        .limit(8);
      return { memories: memoryResults };
    }),
});
