import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";
import { storagePut } from "../storage";
import { extractFileText, extensionOf } from "../fileExtract";
import { protectedProcedure, router } from "../_core/trpc";

// The anon key cannot be used here: RLS policies require a Supabase Auth
// session (auth.uid()), which a server-side client never has. Use the service
// role key like supabase-db.ts; ownership is enforced per-query via user_id.
const supabaseUrl =
  process.env.SUPABASE_URL || "https://vauqtdjpjwlhfgixfrij.supabase.co";
const supabaseKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || "";

if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.error(
    "[Workspace] SUPABASE_SERVICE_ROLE_KEY missing - RLS will block files/projects"
  );
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

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
  "text/markdown",
  "text/csv",
  "application/json",
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
]);

// Browsers often send octet-stream or generic Office MIME types, so the
// extension is trusted as a fallback. Anything on this list can be stored;
// text-bearing formats additionally get content extraction for chat.
const allowedExtensions = new Set([
  "pdf",
  "txt",
  "md",
  "markdown",
  "csv",
  "tsv",
  "json",
  "log",
  "xml",
  "yml",
  "yaml",
  "png",
  "jpg",
  "jpeg",
  "webp",
  "gif",
  "docx",
  "xlsx",
  "xls",
  "pptx",
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
      // Exclude content_text from listings — it can be large and is only
      // needed server-side when chatting with files.
      const ready = await ensureLiteSchema();
      const columns = ready
        ? "id,user_id,project_id,storage_key,url,filename,mime_type,size_bytes,status,created_at,updated_at,is_favorite"
        : "id,user_id,project_id,storage_key,url,filename,mime_type,size_bytes,status,created_at,updated_at";
      const { data, error } = await supabase
        .from("files")
        .select(columns)
        .eq("user_id", ctx.user.id)
        .order("created_at", { ascending: false });

      if (error)
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to fetch files",
        });
      // Map to plain objects with a stable shape — the raw Supabase builder
      // types don't play well with conditional select columns + tRPC.
      const rows = (data || []) as unknown as Array<Record<string, unknown>>;
      return rows.map(row => ({
        id: String(row.id),
        userId: Number(row.user_id),
        projectId: (row.project_id as string | null) ?? null,
        storageKey: String(row.storage_key),
        url: String(row.url),
        filename: String(row.filename),
        mimeType: String(row.mime_type),
        sizeBytes: Number(row.size_bytes),
        status:
          String(row.status) === "failed"
            ? ("failed" as const)
            : ("ready" as const),
        createdAt: row.created_at
          ? new Date(String(row.created_at))
          : new Date(),
        updatedAt: row.updated_at
          ? new Date(String(row.updated_at))
          : new Date(),
        isFavorite: ready ? Boolean(row.is_favorite) : false,
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
              "This file type is not supported in the KSEMO library. Supported: PDF, Word, Excel, PowerPoint, text, data files, and images.",
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
        // Best-effort text extraction so the file can be chatted with later.
        // A failure never blocks the upload itself.
        let contentText: string | null = null;
        if (await ensureLiteSchema()) {
          contentText = await extractFileText(
            input.filename,
            input.mimeType,
            buffer
          );
        }
        const { data, error } = await supabase
          .from("files")
          .insert({
            id,
            user_id: ctx.user.id,
            project_id: input.projectId ?? null,
            storage_key: saved.key,
            url: saved.url,
            filename: input.filename,
            mime_type: input.mimeType,
            size_bytes: buffer.length,
            status: "ready",
            ...(contentText ? { content_text: contentText } : {}),
          })
          .select()
          .single();

        if (error)
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Failed to upload file",
          });
        return data;
      }),
    remove: protectedProcedure
      .input(z.object({ id: entityId }))
      .mutation(async ({ ctx, input }) => {
        const { error } = await supabase
          .from("files")
          .delete()
          .eq("id", input.id)
          .eq("user_id", ctx.user.id);

        if (error)
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Failed to delete file",
          });
        return { success: true } as const;
      }),
    attachToConversation: protectedProcedure
      .input(z.object({ fileId: entityId, conversationId: entityId }))
      .mutation(async ({ ctx, input }) => {
        const { data: file, error: fileError } = await supabase
          .from("files")
          .select("*")
          .eq("id", input.fileId)
          .eq("user_id", ctx.user.id)
          .single();

        if (fileError || !file)
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "File not found.",
          });

        const { data: conversation, error: convError } = await supabase
          .from("conversations")
          .select("*")
          .eq("id", input.conversationId)
          .eq("user_id", ctx.user.id)
          .single();

        if (convError || !conversation)
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Conversation not found.",
          });

        const { data: existing } = await supabase
          .from("attachments")
          .select("*")
          .eq("file_id", file.id)
          .eq("conversation_id", conversation.id)
          .single();

        if (!existing) {
          const { error: insertError } = await supabase
            .from("attachments")
            .insert({
              id: crypto.randomUUID(),
              file_id: file.id,
              conversation_id: conversation.id,
              message_id: null,
            });

          if (insertError)
            throw new TRPCError({
              code: "INTERNAL_SERVER_ERROR",
              message: "Failed to attach file",
            });
        }

        return { success: true } as const;
      }),
  }),
});
