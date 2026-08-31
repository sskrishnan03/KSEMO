// Document generation service. Orchestrates: plan (optional; AI produces a
// DocumentSpec) -> generate real bytes -> store securely -> persist metadata ->
// attach to the assistant message so the file card renders in the chat.

import { createClient } from "@supabase/supabase-js";
import { storagePut } from "../storage";
import { attachFileToMessageForUser } from "../supabase-db";
import { generateDocument } from "./generate";
import type { DocumentSpec, DocFormat } from "./spec";
import { sanitizeFilename, FORMAT_MIME, coerceBlocks, coerceSheets, coerceSlides } from "./spec";
import type { DocumentPlan } from "./plan";

const supabaseUrl =
  process.env.SUPABASE_URL || "https://vauqtdjpjwlhfgixfrij.supabase.co";
const supabaseKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || "";

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

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

  const { data, error } = await supabase
    .from("files")
    .insert({
      id: fileId,
      user_id: userId,
      project_id: null,
      storage_key: saved.key,
      url: saved.url,
      filename,
      mime_type: mimeType,
      size_bytes: buffer.length,
      status: "ready",
    })
    .select()
    .single();

  if (error || !data) {
    console.error("[DocGen] could not record generated file", error);
    throw new Error("The generated file could not be saved.");
  }

  const attached = await attachFileToMessageForUser({
    id: crypto.randomUUID(),
    fileId,
    messageId: assistantMessageId,
    userId,
  });
  if (!attached) {
    console.warn("[DocGen] generated file could not be attached to message");
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
