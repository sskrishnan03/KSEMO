// Document generation service. Orchestrates the full intelligent pipeline:
//   request understanding -> task planning -> research -> source analysis ->
//   content generation -> document design -> file generation -> quality check
//
// Each stage emits real progress events via the onProgress callback, ensuring
// the UI reflects actual backend processing — not fake timers.

import { storagePut } from "../storage";
import { attachFileToMessageForUser, supabase, isSupabaseConfigured } from "../supabase-db";
import { inMemoryStore } from "../inMemoryStore";
import { generateDocument, type GeneratedArtifact } from "./generate";
import type { DocBlock, DocumentSpec, DocFormat, SourceReference } from "./spec";
import { sanitizeFilename, FORMAT_MIME, coerceBlocks, coerceSheets, coerceSlides } from "./spec";
import type { DocumentPlan } from "./plan";
import { planDocument } from "./plan";
import { performResearch, type ResearchResult } from "./research";
import { validateDocument, type QualityReport } from "./quality";
import type { Message } from "../_core/llm";

export type GeneratedFileResult = {
  fileId: string;
  filename: string;
  url: string;
  mimeType: string;
  sizeBytes: number;
  format: DocFormat;
  summary: string;
  sourceCount: number;
  sources?: Array<SourceReference>;
  metrics?: {
    pages?: number;
    sheets?: number;
    slides?: number;
    words?: number;
  };
  qualityReport?: QualityReport;
};

export type PipelineProgressStage =
  | "analyzing"
  | "planning"
  | "researching"
  | "searching"
  | "fetching"
  | "analyzing_sources"
  | "content_generated"
  | "designing"
  | "generating"
  | "validating"
  | "completed"
  | "error";

export type PipelineProgressEvent = {
  stage: PipelineProgressStage;
  format: DocFormat;
  message?: string;
  researchSourceCount?: number;
  researchFindingCount?: number;
  qualityPassed?: boolean;
  qualityIssueCount?: number;
};

export type PipelineProgressCallback = (event: PipelineProgressEvent) => void;

// ─── Pipeline Orchestrator ──────────────────────────────────────────────────

/**
 * Runs the full intelligent document generation pipeline.
 *
 * Pipeline stages:
 *   1. Analyzing    — understand the request
 *   2. Planning     — determine what to create
 *   3. Researching  — gather information (if needed)
 *   4. Content Gen  — produce structured document plan
 *   5. Designing    — build validated DocumentSpec
 *   6. Generating   — create real file bytes
 *   7. Validating   — check quality before delivery
 *
 * Returns the generated file result including quality report and sources.
 */
export async function runDocumentPipeline(input: {
  userId: number;
  assistantMessageId: string;
  conversationId: string;
  userMessage: string;
  format: DocFormat;
  history: Message[];
  onProgress: PipelineProgressCallback;
  signal?: AbortSignal;
}): Promise<GeneratedFileResult> {
  const {
    userId,
    assistantMessageId,
    conversationId,
    userMessage,
    format,
    history,
    onProgress,
    signal,
  } = input;

  // ── Stage 1: Analyzing ────────────────────────────────────────────────
  onProgress({ stage: "analyzing", format, message: "Understanding your request" });

  // Brief yield to allow the client to render the analyzing state
  await yieldToEventLoop();

  // ── Stage 2: Researching (conditional) ────────────────────────────────
  let research: ResearchResult | undefined;

  onProgress({ stage: "planning", format, message: "Planning the document structure" });

  try {
    research = await performResearch(
      userMessage,
      history,
      format,
      (researchStage) => {
        // Map research sub-stages to pipeline progress
        switch (researchStage) {
          case "searching":
            onProgress({ stage: "researching", format, message: "Searching the web for relevant information" });
            break;
          case "fetching":
            onProgress({ stage: "searching", format, message: "Reading source content" });
            break;
          case "analyzing_sources":
            onProgress({ stage: "analyzing_sources", format, message: "Analyzing gathered sources" });
            break;
          default:
            onProgress({ stage: "researching", format, message: "Researching information" });
        }
      },
      signal
    );
  } catch (error) {
    console.warn("[DocGen] Research failed; continuing without web research:", error);
    research = { needed: false, query: userMessage, sources: [], findings: [], summary: "", sourceCount: 0 };
  }

  if (research.needed && research.sourceCount > 0) {
    console.log(`[DocGen] Research complete: ${research.sourceCount} sources, ${research.findings.length} findings`);
  }

  // ── Stage 3: Content Generation (AI Planning) ────────────────────────
  onProgress({
    stage: "content_generated",
    format,
    message: "Generating document content",
    researchSourceCount: research?.sourceCount,
    researchFindingCount: research?.findings.length,
  });

  const plannerHistory = history
    .filter(msg => msg.role === "user" || msg.role === "assistant")
    .slice(-8);

  const plan = await planDocument(
    userMessage,
    plannerHistory,
    format,
    research
  );

  if (plan.kind !== "file") {
    throw new Error("Document planner could not produce a file plan for this request.");
  }

  // ── Stage 4: Document Design (Spec Building) ─────────────────────────
  onProgress({
    stage: "designing",
    format: plan.format,
    message: "Designing document layout and structure",
  });

  const spec = buildDocumentSpec(plan);

  // Attach research sources to the spec
  if (research?.sources && research.sources.length > 0) {
    spec.sources = research.sources.map(s => ({
      title: s.title,
      url: s.url,
      publisher: s.publisher,
    }));
  }

  // ── Stage 5: File Generation ─────────────────────────────────────────
  onProgress({
    stage: "generating",
    format: spec.format,
    message: "Generating the file",
  });

  const generated = await generateDocument(spec);

  // ── Metrics: real page/sheet/slide/word counts for the artifact → ───────
  const metrics = await computeFileMetrics(spec, generated.buffer);

  // ── Stage 6: Quality Validation ──────────────────────────────────────
  onProgress({
    stage: "validating",
    format: spec.format,
    message: "Checking the generated document",
  });

  // Byte-level validation on the actual generated buffer. Non-blocking: the
  // report is included in the result, and only logged here for transparency.
  const qualityReport = validateDocument(spec, generated.buffer);

  if (!qualityReport.passed) {
    console.warn(
      `[DocGen] Quality check found issues:`,
      qualityReport.issues.filter(i => i.severity === "error")
    );
  }

  const result = await generateAndDeliverFile({
    userId,
    assistantMessageId,
    conversationId,
    spec,
    summary: plan.summary,
    generated,
  });

  return {
    ...result,
    sourceCount: research?.sourceCount ?? 0,
    sources: spec.sources && spec.sources.length > 0 ? spec.sources : undefined,
    metrics,
    qualityReport,
  };
}

function countWordsFromBlocks(blocks: DocBlock[]): number {
  let count = 0;
  for (const block of blocks) {
    if ("text" in block && typeof block.text === "string") {
      count += block.text.split(/\s+/).filter(Boolean).length;
    }
    if ("items" in block && Array.isArray(block.items)) {
      count += block.items.join(" ").split(/\s+/).filter(Boolean).length;
    }
    if ("rows" in block && Array.isArray(block.rows)) {
      count += block.rows.flat().join(" ").split(/\s+/).filter(Boolean).length;
    }
    if ("headers" in block && Array.isArray(block.headers)) {
      count += block.headers.join(" ").split(/\s+/).filter(Boolean).length;
    }
  }
  return count;
}

async function computeFileMetrics(
  spec: DocumentSpec,
  buffer: Buffer
): Promise<NonNullable<GeneratedFileResult["metrics"]>> {
  switch (spec.format) {
    case "pdf": {
      try {
        const { PDFDocument } = await import("pdf-lib");
        const doc = await PDFDocument.load(buffer);
        return { pages: doc.getPageCount() };
      } catch {
        return {};
      }
    }
    case "xlsx":
      return { sheets: spec.sheets?.length ?? 0 };
    case "pptx":
      return { slides: spec.slides?.length ?? 0 };
    default:
      return { words: countWordsFromBlocks(spec.blocks ?? []) };
  }
}

// ─── Legacy Orchestration (backward-compatible) ─────────────────────────────

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
  // Carry over source references from the plan
  if (plan.sources && plan.sources.length > 0) {
    spec.sources = plan.sources;
    // Research feature parity: weave sources into every format, not just PDF.
    // Excel gets a dedicated References sheet; PowerPoint gets a final
    // References slide; document formats get a References block set.
    if (plan.format === "xlsx") {
      spec.sheets = [
        ...(spec.sheets ?? []),
        {
          name: "References",
          table: true,
          rows: plan.sources.map(s => [s.title, s.url, s.publisher ?? ""]),
        },
      ];
    } else if (plan.format === "pptx") {
      spec.slides = [
        ...(spec.slides ?? []),
        {
          title: "References",
          bullets: plan.sources.map(s => `${s.title} — ${s.url}`),
        },
      ];
    } else {
      const refBlocks: DocBlock[] = [
        { type: "pageBreak" },
        { type: "heading", level: 2, text: "References" },
        ...plan.sources.map(
          source =>
            ({
              type: "paragraph",
              text: `${source.title} — ${source.url}`,
              size: 9,
            }) as DocBlock
        ),
      ];
      spec.blocks = [...(spec.blocks ?? []), ...refBlocks];
    }
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
  generated?: GeneratedArtifact;
}): Promise<GeneratedFileResult> {
  const { userId, assistantMessageId, conversationId, spec, generated } = input;
  const { buffer, filename, mimeType } = generated ?? (await generateDocument(spec));

  const fileId = crypto.randomUUID();
  const saved = await storagePut(
    `generated/${userId}/${fileId}-${sanitizeFilename(spec.format, filename)}`,
    buffer,
    mimeType
  );

  // Always register in local memory store first to guarantee instant availability
  try {
    const memFile = {
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
    } as const;
    inMemoryStore.files.set(fileId, memFile as never);
  } catch (memErr) {
    console.warn("[DocGen] local in-memory store error:", memErr);
  }

  // If Supabase is configured, sync the file to Supabase ensuring foreign key validity
  if (isSupabaseConfigured) {
    try {
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

  // The assistant's reply is a short natural description of the file. Source
  // count stays out of the text — the chat artifact shows sources separately.
  const summary =
    input.summary ??
    `I created the requested file (${filename}). It is attached below — you can preview or download it.`;

  return {
    fileId,
    filename,
    url: saved.url,
    mimeType,
    sizeBytes: buffer.length,
    format: spec.format,
    summary,
    sourceCount: spec.sources?.length ?? 0,
  };
}

// ─── Helpers ────────────────────────────────────────────────────────────────

/**
 * Yields to the event loop briefly so the client has time to render
 * the current progress stage before the next heavy computation begins.
 */
function yieldToEventLoop(): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, 0));
}

export { FORMAT_MIME };
