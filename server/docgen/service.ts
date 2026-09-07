// Document generation service. Orchestrates: plan (optional; AI produces a
// DocumentSpec) -> generate real bytes -> store securely -> persist metadata ->
// attach to the assistant message so the file card renders in the chat.

import { storagePut } from "../storage";
import { attachFileToMessageForUser, supabase, isSupabaseConfigured } from "../supabase-db";
import { inMemoryStore } from "../inMemoryStore";
import { generateDocument } from "./generate";
import type { DocumentSpec, DocFormat } from "./spec";
import { sanitizeFilename, FORMAT_MIME, coerceBlocks, coerceSheets, coerceSlides } from "./spec";
import type { DocumentPlan } from "./plan";

export type GeneratedFileResult = {
  fileId: string;
  filename: string;
  url: string;
  mimeType: string;
  sizeBytes: number;
  format: DocFormat;
  summary: string;
};

/**
 * Converts an AI-produced DocumentPlan into a validated DocumentSpec that the
 * deterministic generators can safely consume.
 */
export function buildDocumentSpec(plan: Extract<DocumentPlan, { kind: "file" }>): DocumentSpec {
  const spec: DocumentSpec = {
    format: plan.format,
    filename: plan.filename,
    title: plan.title || "Document",
    summary: plan.summary,
  };
  if (plan.format === "xlsx") {
    const sheets = coerceSheets(plan.content.sheets);
    if (sheets.length) spec.sheets = sheets;
  } else if (plan.format === "pptx") {
    const slides = coerceSlides(plan.content.slides);
    if (slides.length) spec.slides = slides;
  } else {
    const blocks = coerceBlocks(plan.content.blocks);
    spec.blocks = blocks.length ? blocks : [{ type: "paragraph", text: plan.title || "" }];
  }
  return spec;
}

/**
 * Generates a real, downloadable file from a DocumentSpec, stores it securely
 * under the user's namespace, records it in the library, and attaches it to the
 * given assistant message so it appears in the chat.
 */
export async function generateAndDeliverFile(input: {
  userId: number;
  assistantMessageId: string;
  conversationId: string;
  spec: DocumentSpec;
  summary?: string;
}): Promise<GeneratedFileResult> {
  const { userId, assistantMessageId, conversationId, spec } = input;
  const { buffer, filename, mimeType } = await generateDocument(spec);

  const fileId = crypto.randomUUID();
  const saved = await storagePut(
    `generated/${userId}/${fileId}-${sanitizeFilename(spec.format, filename)}`,
    buffer,
    mimeType
  );

  // Always register in local memory store first to guarantee instant availability
  try {
    inMemoryStore.files.set(fileId, {
      id: fileId,
      userId,
      projectId: null,
      filename,
      mimeType,
      sizeBytes: buffer.length,
      storageKey: saved.key,
      url: saved.url,
      status: "ready",
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  } catch (memErr) {
    console.warn("[DocGen] local in-memory store error:", memErr);
  }

  // If Supabase is configured, sync the file to Supabase ensuring foreign key validity
  if (isSupabaseConfigured) {
    try {
      // Ensure user exists in Supabase so foreign key constraint (files_user_id_fkey) succeeds
      const { data: existingUser } = await supabase
        .from("users")
        .select("id")
        .eq("id", userId)
        .maybeSingle();

      if (!existingUser) {
        const memUser = inMemoryStore.users.get(userId);
        await supabase.from("users").upsert({
          id: userId,
          open_id: memUser?.openId || `user-${userId}`,
          name: memUser?.name || "KSEMO User",
          email: memUser?.email || `user${userId}@ksemo.internal`,
          role: memUser?.role || "user",
        });
      }

      const { error: insertError } = await supabase.from("files").insert({
        id: fileId,
        user_id: userId,
        project_id: null,
        storage_key: saved.key,
        url: saved.url,
        filename,
        mime_type: mimeType,
        size_bytes: buffer.length,
        status: "ready",
      });

      if (insertError) {
        console.warn("[DocGen] Supabase insert warning (file saved locally):", insertError);
      }
    } catch (dbErr) {
      console.warn("[DocGen] Supabase write caught error (file saved locally):", dbErr);
    }
  }

  try {
    const attached = await attachFileToMessageForUser({
      id: crypto.randomUUID(),
      fileId,
      messageId: assistantMessageId,
      userId,
    });
    if (!attached) {
      console.warn("[DocGen] generated file could not be attached to message");
    }
  } catch (attErr) {
    console.warn("[DocGen] attachFileToMessageForUser error:", attErr);
  }

  return {
    fileId,
    filename,
    url: saved.url,
    mimeType,
    sizeBytes: buffer.length,
    format: spec.format,
    summary:
      input.summary ??
      `I created the requested file (${filename}). It is attached below — you can preview or download it.`,
  };
}

export { FORMAT_MIME };
