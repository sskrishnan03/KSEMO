import fs from "fs";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { storagePut, resolveStoragePath } from "../storage";
import { extractFileText, extensionOf, TEXT_EXTENSIONS } from "../fileExtract";
import { protectedProcedure, router } from "../_core/trpc";
import {
  createFileForUser,
  listFilesForUser,
  getFileForUser,
  updateFileForUser,
  deleteFileForUser,
  attachFileToConversationForUser,
  supabase,
} from "../supabase-db";
import type { KsemoFile } from "../../supabase-schema/04-types";

const entityId = z.string().min(8).max(36);
const projectInput = z.object({
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().max(2_000).nullable().optional(),
  instructions: z.string().trim().max(4_000).nullable().optional(),
});

async function ownedProject(projectId: string, userId: number) {
  const { data, error } = await supabase
    .from("projects")
    .select("*")
    .eq("id", projectId)
    .eq("user_id", userId)
    .single();

  if (error || !data)
    throw new TRPCError({ code: "NOT_FOUND", message: "Project not found." });
  return data;
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

const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;

// Favorites rely on the optional is_favorite column added by
// supabase-schema/06-library-lite.sql; chat-with-file relies on content_text
// from the same migration. Both degrade gracefully when it hasn't run yet.
let liteSchemaChecked = false;
let liteSchemaReady = false;

async function ensureLiteSchema(): Promise<boolean> {
  if (!liteSchemaChecked) {
    const { error } = await supabase
      .from("files")
      .select("is_favorite,content_text")
      .limit(1);
    liteSchemaReady = !error;
    liteSchemaChecked = true;
  }
  return liteSchemaReady;
}

const allowedMimeTypes = new Set([
  "application/pdf",
  "text/plain",
  "text/csv",
  "text/markdown",
  "text/html",
  "text/css",
  "text/javascript",
  "application/csv",
  "application/x-csv",
  "application/json",
  "application/xml",
  "text/xml",
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
  "image/bmp",
  "image/svg+xml",
  "audio/mpeg",
  "audio/mp3",
  "audio/wav",
  "audio/x-wav",
  "audio/m4a",
  "audio/aac",
  "audio/ogg",
  "audio/webm",
  "audio/flac",
  "video/mp4",
  "video/webm",
  "video/quicktime",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/msword",
  "application/vnd.ms-excel",
  "application/vnd.ms-powerpoint",
  "application/octet-stream",
]);

// Browsers often send octet-stream or generic Office MIME types, so the
// extension is trusted as a fallback. Anything on this list can be stored;
// text-bearing formats additionally get content extraction for chat.
const allowedExtensions = new Set([
  "pdf",
  "doc",
  "docx",
  "xls",
  "xlsx",
  "csv",
  "tsv",
  "ppt",
  "pptx",
  "txt",
  "text",
  "md",
  "markdown",
  "json",
  "xml",
  "yml",
  "yaml",
  "log",
  "sql",
  "py",
  "js",
  "ts",
  "tsx",
  "jsx",
  "html",
  "htm",
  "css",
  "sh",
  "env",
  "png",
  "jpg",
  "jpeg",
  "webp",
  "gif",
  "bmp",
  "svg",
  "mp3",
  "wav",
  "m4a",
  "aac",
  "ogg",
  "webm",
  "flac",
  "mp4",
  "mov",
  "zip",
]);

export const workspaceRouter = router({
  projects: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      const { data, error } = await supabase
        .from("projects")
        .select("*")
        .eq("user_id", ctx.user.id)
        .eq("is_archived", false)
        .order("updated_at", { ascending: false });

      if (error)
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to fetch projects",
        });
      return data || [];
    }),
    create: protectedProcedure
      .input(projectInput)
      .mutation(async ({ ctx, input }) => {
        const id = crypto.randomUUID();
        const { data, error } = await supabase
          .from("projects")
          .insert({
            id,
            user_id: ctx.user.id,
            name: input.name,
            description: input.description ?? null,
            instructions: input.instructions ?? null,
            is_archived: false,
          })
          .select()
          .single();

        if (error)
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Failed to create project",
          });
        return data;
      }),
    update: protectedProcedure
      .input(projectInput.partial().extend({ id: entityId }))
      .mutation(async ({ ctx, input }) => {
        await ownedProject(input.id, ctx.user.id);
        const { id, ...values } = input;
        const { data, error } = await supabase
          .from("projects")
          .update(values)
          .eq("id", id)
          .select()
          .single();

        if (error)
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Failed to update project",
          });
        return data;
      }),
    archive: protectedProcedure
      .input(z.object({ id: entityId, isArchived: z.boolean() }))
      .mutation(async ({ ctx, input }) => {
        const project = await ownedProject(input.id, ctx.user.id);
        const { error } = await supabase
          .from("projects")
          .update({ is_archived: input.isArchived })
          .eq("id", input.id);

        if (error)
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Failed to archive project",
          });
        return { success: true } as const;
      }),
    remove: protectedProcedure
      .input(z.object({ id: entityId }))
      .mutation(async ({ ctx, input }) => {
        await ownedProject(input.id, ctx.user.id);
        const { error } = await supabase
          .from("projects")
          .delete()
          .eq("id", input.id);

        if (error)
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Failed to delete project",
          });
        return { success: true } as const;
      }),
    conversations: protectedProcedure
      .input(z.object({ projectId: entityId }))
      .query(async ({ ctx, input }) => {
        await ownedProject(input.projectId, ctx.user.id);
        const { data, error } = await supabase
          .from("conversations")
          .select("*")
          .eq("user_id", ctx.user.id)
          .eq("project_id", input.projectId)
          .is("deleted_at", null)
          .order("updated_at", { ascending: false });

        if (error)
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Failed to fetch conversations",
          });
        return data || [];
      }),
    setConversation: protectedProcedure
      .input(
        z.object({ conversationId: entityId, projectId: entityId.nullable() })
      )
      .mutation(async ({ ctx, input }) => {
        await optionalOwnedProject(input.projectId, ctx.user.id);
        const { data: conversation, error: findError } = await supabase
          .from("conversations")
          .select("*")
          .eq("id", input.conversationId)
          .eq("user_id", ctx.user.id)
          .single();

        if (findError || !conversation)
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Conversation not found.",
          });

        const { error: updateError } = await supabase
          .from("conversations")
          .update({ project_id: input.projectId })
          .eq("id", input.conversationId);

        if (updateError)
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Failed to set conversation project",
          });
        return { success: true } as const;
      }),
  }),
  files: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      const files = await listFilesForUser(ctx.user.id);
      return files.map(row => ({
        id: row.id,
        userId: row.userId,
        projectId: row.projectId ?? null,
        storageKey: row.storageKey,
        url: row.url,
        filename: row.filename,
        mimeType: row.mimeType,
        sizeBytes: row.sizeBytes,
        status:
          row.status === "failed" ? ("failed" as const) : ("ready" as const),
        createdAt: row.createdAt ? new Date(row.createdAt) : new Date(),
        updatedAt: row.updatedAt ? new Date(row.updatedAt) : new Date(),
        isFavorite: false,
      }));
    }),
    setFavorite: protectedProcedure
      .input(z.object({ id: entityId, isFavorite: z.boolean() }))
      .mutation(async ({ ctx, input }) => {
        if (!(await ensureLiteSchema()))
          throw new TRPCError({
            code: "PRECONDITION_FAILED",
            message:
              "Favorites aren't set up yet. Run supabase-schema/06-library-lite.sql in your Supabase SQL editor, then reload.",
          });
        const { error } = await supabase
          .from("files")
          .update({ is_favorite: input.isFavorite })
          .eq("id", input.id)
          .eq("user_id", ctx.user.id);

        if (error)
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Failed to update file",
          });
        return { success: true } as const;
      }),
    rename: protectedProcedure
      .input(
        z.object({
          id: entityId,
          filename: z.string().trim().min(1).max(255),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const existing = await getFileForUser(input.id, ctx.user.id);
        if (!existing)
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "File not found.",
          });

        await updateFileForUser(input.id, ctx.user.id, {
          filename: input.filename,
        });
        return { success: true } as const;
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
        const extension = extensionOf(input.filename);
        if (
          !allowedMimeTypes.has(input.mimeType) &&
          !allowedExtensions.has(extension)
        )
          throw new TRPCError({
            code: "BAD_REQUEST",
            message:
              "This file type is not supported in the KSEMO library. Supported: PDF, Word, Excel, PowerPoint, text, data files, images, and audio.",
          });
        const buffer = Buffer.from(input.dataBase64, "base64");
        if (!buffer.length || buffer.length > MAX_UPLOAD_BYTES)
          throw new TRPCError({
            code: "PAYLOAD_TOO_LARGE",
            message: "Files must be smaller than 25 MB.",
          });
        await optionalOwnedProject(input.projectId, ctx.user.id);
        const id = crypto.randomUUID();
        const saved = await storagePut(
          `library/${ctx.user.id}/${id}-${safeFilename(input.filename)}`,
          buffer,
          input.mimeType
        );
        // Best-effort text extraction so the file can be chatted with directly.
        // Extraction is never skipped — any failures simply return null without blocking the upload.
        let contentText: string | null = null;
        try {
          contentText = await extractFileText(
            input.filename,
            input.mimeType,
            buffer
          );
        } catch (extractErr) {
          console.warn("[upload] extraction error:", extractErr);
        }

        const fileRecord: KsemoFile = {
          id,
          userId: ctx.user.id,
          projectId: input.projectId ?? null,
          storageKey: saved.key,
          url: saved.url,
          filename: input.filename,
          mimeType: input.mimeType,
          sizeBytes: buffer.length,
          status: "ready",
          contentText: contentText ?? null,
          createdAt: new Date(),
          updatedAt: new Date(),
        };

        const created = await createFileForUser(fileRecord);
        return {
          id: created.id,
          userId: created.userId,
          projectId: created.projectId,
          storageKey: created.storageKey,
          url: created.url,
          filename: created.filename,
          mimeType: created.mimeType,
          sizeBytes: created.sizeBytes,
          status: created.status,
          createdAt: created.createdAt,
          updatedAt: created.updatedAt,
        };
      }),
    remove: protectedProcedure
      .input(z.object({ id: entityId }))
      .mutation(async ({ ctx, input }) => {
        await deleteFileForUser(input.id, ctx.user.id);
        return { success: true } as const;
      }),
    saveContent: protectedProcedure
      .input(
        z.object({
          id: entityId,
          content: z.string().max(5_000_000, "File content is too large."),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const file = await getFileForUser(input.id, ctx.user.id);
        if (!file)
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "File not found.",
          });

        // Only text-based files can be edited inline in the viewer.
        const isTextMime =
          file.mimeType.startsWith("text/") ||
          file.mimeType === "application/json";
        if (!isTextMime && !TEXT_EXTENSIONS.has(extensionOf(file.filename))) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Only text files can be edited in KSEMO.",
          });
        }

        const buffer = Buffer.from(input.content, "utf8");
        if (!buffer.length || buffer.length > MAX_UPLOAD_BYTES)
          throw new TRPCError({
            code: "PAYLOAD_TOO_LARGE",
            message: "Files must be smaller than 25 MB.",
          });

        const absolute = resolveStoragePath(file.storageKey);
        await fs.promises.writeFile(absolute, buffer);

        await updateFileForUser(input.id, ctx.user.id, {
          sizeBytes: buffer.length,
          contentText: input.content,
        });

        return { success: true, sizeBytes: buffer.length } as const;
      }),
    attachToConversation: protectedProcedure
      .input(z.object({ fileId: entityId, conversationId: entityId }))
      .mutation(async ({ ctx, input }) => {
        const file = await getFileForUser(input.fileId, ctx.user.id);
        if (!file)
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "File not found.",
          });

        await attachFileToConversationForUser({
          id: crypto.randomUUID(),
          fileId: file.id,
          conversationId: input.conversationId,
          userId: ctx.user.id,
        });

        return { success: true } as const;
      }),
  }),
  data: router({
    // Full personal-data export. Returns every conversation (with messages),
    // project, and uploaded-file listing so users can download their own data
    // from Data Control. File bytes stay in storage — only metadata is returned.
    exportAll: protectedProcedure.query(async ({ ctx }) => {
      const userId = ctx.user.id;

      const [conversationsRes, projectsRes, filesRes, memoriesRes] =
        await Promise.all([
          supabase
            .from("conversations")
            .select("*")
            .eq("user_id", userId)
            .order("updated_at", { ascending: false }),
          supabase
            .from("projects")
            .select("*")
            .eq("user_id", userId)
            .order("updated_at", { ascending: false }),
          supabase
            .from("files")
            .select(
              "id,filename,mime_type,size_bytes,url,is_favorite,created_at,updated_at"
            )
            .eq("user_id", userId)
            .order("created_at", { ascending: false }),
          supabase
            .from("memories")
            .select("*")
            .eq("user_id", userId)
            .order("created_at", { ascending: false }),
        ]);

      if (conversationsRes.error)
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to export conversations",
        });
      if (projectsRes.error)
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to export projects",
        });
      if (filesRes.error)
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to export files",
        });
      if (memoriesRes.error)
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to export memories",
        });

      const conversations = (conversationsRes.data || []) as unknown as Array<
        Record<string, unknown>
      >;
      const messagesByConversation: Record<string, unknown[]> = {};
      for (const conversation of conversations) {
        const { data, error } = await supabase
          .from("messages")
          .select("*")
          .eq("conversation_id", conversation.id)
          .order("created_at", { ascending: true });
        if (error)
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Failed to export messages",
          });
        messagesByConversation[String(conversation.id)] = data || [];
      }

      return {
        exportedAt: new Date(),
        profile: {
          name: ctx.user.name,
          email: ctx.user.email,
          role: ctx.user.role,
          loginMethod: ctx.user.loginMethod,
          createdAt: ctx.user.createdAt,
          lastSignedIn: ctx.user.lastSignedIn,
        },
        projects: projectsRes.data || [],
        conversations: conversations.map(conversation => ({
          conversation,
          messages: messagesByConversation[String(conversation.id)] ?? [],
        })),
        files: filesRes.data || [],
        memories: memoriesRes.data || [],
      };
    }),
  }),
});
