import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";
import { storagePut } from "../storage";
import { protectedProcedure, router } from "../_core/trpc";

const supabaseUrl = process.env.SUPABASE_URL || "https://vauqtdjpjwlhfgixfrij.supabase.co";
const supabaseKey = process.env.SUPABASE_ANON_KEY || "sb_publishable_wCv3g2jSb_qMbR7I3Fifbg_obIw1iuq";
const supabase = createClient(supabaseUrl, supabaseKey);

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
      const { data, error } = await supabase
        .from("projects")
        .select("*")
        .eq("user_id", ctx.user.id)
        .eq("is_archived", false)
        .order("updated_at", { ascending: false });

      if (error) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to fetch projects" });
      return data || [];
    }),
    create: protectedProcedure
      .input(projectInput)
      .mutation(async ({ ctx, input }) => {
        const id = crypto.randomUUID();
        const { data, error } = await supabase.from("projects").insert({
          id,
          user_id: ctx.user.id,
          name: input.name,
          description: input.description ?? null,
          instructions: input.instructions ?? null,
          is_archived: false,
        }).select().single();

        if (error) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to create project" });
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

        if (error) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to update project" });
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

        if (error) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to archive project" });
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

        if (error) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to delete project" });
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

        if (error) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to fetch conversations" });
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

        if (updateError) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to set conversation project" });
        return { success: true } as const;
      }),
  }),
  memories: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      const { data, error } = await supabase
        .from("memories")
        .select("*")
        .eq("user_id", ctx.user.id)
        .order("updated_at", { ascending: false });

      if (error) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to fetch memories" });
      return data || [];
    }),
    create: protectedProcedure
      .input(memoryInput)
      .mutation(async ({ ctx, input }) => {
        await optionalOwnedProject(input.projectId, ctx.user.id);
        const id = crypto.randomUUID();
        const { data, error } = await supabase.from("memories").insert({
          id,
          user_id: ctx.user.id,
          content: input.content,
          category: input.category,
          project_id: input.projectId ?? null,
          is_active: true,
        }).select().single();

        if (error) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to create memory" });
        return data;
      }),
    setActive: protectedProcedure
      .input(z.object({ id: entityId, isActive: z.boolean() }))
      .mutation(async ({ ctx, input }) => {
        const { error } = await supabase
          .from("memories")
          .update({ is_active: input.isActive })
          .eq("id", input.id)
          .eq("user_id", ctx.user.id);

        if (error) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to update memory" });
        return { success: true } as const;
      }),
    remove: protectedProcedure
      .input(z.object({ id: entityId }))
      .mutation(async ({ ctx, input }) => {
        const { error } = await supabase
          .from("memories")
          .delete()
          .eq("id", input.id)
          .eq("user_id", ctx.user.id);

        if (error) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to delete memory" });
        return { success: true } as const;
      }),
  }),
  files: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      const { data, error } = await supabase
        .from("files")
        .select("*")
        .eq("user_id", ctx.user.id)
        .order("created_at", { ascending: false });

      if (error) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to fetch files" });
      return data || [];
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
        const id = crypto.randomUUID();
        const saved = await storagePut(
          `library/${ctx.user.id}/${id}-${safeFilename(input.filename)}`,
          buffer,
          input.mimeType
        );
        const { data, error } = await supabase.from("files").insert({
          id,
          user_id: ctx.user.id,
          project_id: input.projectId ?? null,
          storage_key: saved.key,
          url: saved.url,
          filename: input.filename,
          mime_type: input.mimeType,
          size_bytes: buffer.length,
          status: "ready",
        }).select().single();

        if (error) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to upload file" });
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

        if (error) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to delete file" });
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
          const { error: insertError } = await supabase.from("attachments").insert({
            id: crypto.randomUUID(),
            file_id: file.id,
            conversation_id: conversation.id,
            message_id: null,
          });

          if (insertError) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to attach file" });
        }

        return { success: true } as const;
      }),
  }),
  search: protectedProcedure
    .input(z.object({ query: z.string().trim().min(2).max(120) }))
    .query(async ({ ctx, input }) => {
      const { data, error } = await supabase
        .from("memories")
        .select("*")
        .eq("user_id", ctx.user.id)
        .ilike("content", `%${input.query}%`)
        .limit(8);

      if (error) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to search" });
      return { memories: data || [] };
    }),
});
