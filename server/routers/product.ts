import { TRPCError } from "@trpc/server";
import { nanoid } from "nanoid";
import { z } from "zod";
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
  const storage = await dbOrThrow();
  const project = storage.projects.get(projectId);
  if (!project || project.userId !== userId)
    throw new TRPCError({ code: "NOT_FOUND", message: "Project not found." });
  return project;
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
      const storage = await dbOrThrow();
      return Array.from(storage.projects.values())
        .filter(p => p.userId === ctx.user.id && !p.isArchived)
        .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
    }),
    create: protectedProcedure
      .input(projectInput)
      .mutation(async ({ ctx, input }) => {
        const storage = await dbOrThrow();
        const id = nanoid();
        const now = new Date();
        const project = {
          id,
          userId: ctx.user.id,
          name: input.name,
          description: input.description ?? null,
          instructions: input.instructions ?? null,
          isArchived: false,
          createdAt: now,
          updatedAt: now,
        };
        storage.projects.set(id, project);
        return project;
      }),
    update: protectedProcedure
      .input(projectInput.partial().extend({ id: entityId }))
      .mutation(async ({ ctx, input }) => {
        const storage = await dbOrThrow();
        await ownedProject(input.id, ctx.user.id);
        const { id, ...values } = input;
        const project = storage.projects.get(id);
        if (project) {
          Object.assign(project, values, { updatedAt: new Date() });
          storage.projects.set(id, project);
        }
        return project;
      }),
    archive: protectedProcedure
      .input(z.object({ id: entityId, isArchived: z.boolean() }))
      .mutation(async ({ ctx, input }) => {
        const storage = await dbOrThrow();
        const project = await ownedProject(input.id, ctx.user.id);
        project.isArchived = input.isArchived;
        project.updatedAt = new Date();
        storage.projects.set(input.id, project);
        return { success: true } as const;
      }),
    remove: protectedProcedure
      .input(z.object({ id: entityId }))
      .mutation(async ({ ctx, input }) => {
        const storage = await dbOrThrow();
        await ownedProject(input.id, ctx.user.id);
        storage.projects.delete(input.id);
        return { success: true } as const;
      }),
    conversations: protectedProcedure
      .input(z.object({ projectId: entityId }))
      .query(async ({ ctx, input }) => {
        const storage = await dbOrThrow();
        await ownedProject(input.projectId, ctx.user.id);
        return Array.from(storage.conversations.values())
          .filter(
            c =>
              c.userId === ctx.user.id &&
              c.projectId === input.projectId &&
              c.deletedAt === null
          )
          .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
      }),
    setConversation: protectedProcedure
      .input(
        z.object({ conversationId: entityId, projectId: entityId.nullable() })
      )
      .mutation(async ({ ctx, input }) => {
        const storage = await dbOrThrow();
        await optionalOwnedProject(input.projectId, ctx.user.id);
        const conversation = storage.conversations.get(input.conversationId);
        if (!conversation || conversation.userId !== ctx.user.id)
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Conversation not found.",
          });
        conversation.projectId = input.projectId;
        conversation.updatedAt = new Date();
        storage.conversations.set(input.conversationId, conversation);
        return { success: true } as const;
      }),
  }),
  memories: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      const storage = await dbOrThrow();
      return Array.from(storage.memories.values())
        .filter(m => m.userId === ctx.user.id)
        .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
    }),
    create: protectedProcedure
      .input(memoryInput)
      .mutation(async ({ ctx, input }) => {
        const storage = await dbOrThrow();
        await optionalOwnedProject(input.projectId, ctx.user.id);
        const id = nanoid();
        const now = new Date();
        const memory = {
          id,
          userId: ctx.user.id,
          content: input.content,
          category: input.category,
          projectId: input.projectId ?? null,
          isActive: true,
          createdAt: now,
          updatedAt: now,
        };
        storage.memories.set(id, memory);
        return memory;
      }),
    setActive: protectedProcedure
      .input(z.object({ id: entityId, isActive: z.boolean() }))
      .mutation(async ({ ctx, input }) => {
        const storage = await dbOrThrow();
        const memory = storage.memories.get(input.id);
        if (memory && memory.userId === ctx.user.id) {
          memory.isActive = input.isActive;
          memory.updatedAt = new Date();
          storage.memories.set(input.id, memory);
        }
        return { success: true } as const;
      }),
    remove: protectedProcedure
      .input(z.object({ id: entityId }))
      .mutation(async ({ ctx, input }) => {
        const storage = await dbOrThrow();
        const memory = storage.memories.get(input.id);
        if (memory && memory.userId === ctx.user.id) {
          storage.memories.delete(input.id);
        }
        return { success: true } as const;
      }),
  }),
  files: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      const storage = await dbOrThrow();
      return Array.from(storage.files.values())
        .filter(f => f.userId === ctx.user.id)
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
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
        const storage = await dbOrThrow();
        const id = nanoid();
        const saved = await storagePut(
          `library/${ctx.user.id}/${id}-${safeFilename(input.filename)}`,
          buffer,
          input.mimeType
        );
        const now = new Date();
        const file = {
          id,
          userId: ctx.user.id,
          projectId: input.projectId ?? null,
          storageKey: saved.key,
          url: saved.url,
          filename: input.filename,
          mimeType: input.mimeType,
          sizeBytes: buffer.length,
          status: "ready" as const,
          createdAt: now,
          updatedAt: now,
        };
        storage.files.set(id, file);
        return file;
      }),
    remove: protectedProcedure
      .input(z.object({ id: entityId }))
      .mutation(async ({ ctx, input }) => {
        const storage = await dbOrThrow();
        const file = storage.files.get(input.id);
        if (file && file.userId === ctx.user.id) {
          storage.files.delete(input.id);
        }
        return { success: true } as const;
      }),
    attachToConversation: protectedProcedure
      .input(z.object({ fileId: entityId, conversationId: entityId }))
      .mutation(async ({ ctx, input }) => {
        const storage = await dbOrThrow();
        const file = storage.files.get(input.fileId);
        if (!file || file.userId !== ctx.user.id)
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "File not found.",
          });
        const conversation = storage.conversations.get(input.conversationId);
        if (!conversation || conversation.userId !== ctx.user.id)
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Conversation not found.",
          });
        const existing = Array.from(storage.attachments.values()).find(
          a => a.fileId === file.id && a.conversationId === conversation.id
        );
        if (!existing) {
          const attachment = {
            id: nanoid(),
            fileId: file.id,
            conversationId: conversation.id,
            messageId: null,
            createdAt: new Date(),
          };
          storage.attachments.set(attachment.id, attachment);
        }
        return { success: true } as const;
      }),
  }),
  search: protectedProcedure
    .input(z.object({ query: z.string().trim().min(2).max(120) }))
    .query(async ({ ctx, input }) => {
      const storage = await dbOrThrow();
      const pattern = input.query.toLowerCase();
      const memoryResults = Array.from(storage.memories.values())
        .filter(
          m =>
            m.userId === ctx.user.id && m.content.toLowerCase().includes(pattern)
        )
        .slice(0, 8);
      return { memories: memoryResults };
    }),
});
