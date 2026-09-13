import type { DocFormat } from "@/lib/docFormats";
import {
  ArrowUpRight,
  Check,
  ChevronDown,
  Cpu,
  Globe,
  LayoutList,
  Palette,
  PenLine,
  Presentation,
  RotateCw,
  ShieldCheck,
  Sparkles,
  Table,
} from "lucide-react";
import React, { memo, useEffect, useRef, useState } from "react";
import {
  FileBrandMark,
  type FileBrandVariant,
} from "@/components/ksemo/FileBrandIcons";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  loadFilePreview,
  type FilePreviewData,
  type SheetPreview,
  type SlidePreview,
} from "@/lib/filePreview";
import { usePdfViewer, isViewableDocument } from "@/contexts/PdfViewerContext";

export type FileCreationStage =
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

export type FileSource = {
  title: string;
  url: string;
  publisher?: string;
};

export type FileMetrics = {
  pages?: number;
  sheets?: number;
  slides?: number;
  words?: number;
};

const FORMAT_CONFIGS: Record<
  DocFormat,
  {
    writing: string;
    creating: string;
    ready: string;
    short: string;
    ext: string;
    mdLabel: string;
  }
> = {
  pdf: {
    writing: "Writing PDF",
    creating: "Creating PDF",
    ready: "PDF ready",
    short: "PDF",
    ext: "PDF",
    mdLabel: "PDF",
  },
  docx: {
    writing: "Writing Word document",
    creating: "Creating Word document",
    ready: "Document ready",
    short: "Word document",
    ext: "DOCX",
    mdLabel: "DOCX",
  },
  xlsx: {
    writing: "Writing Excel workbook",
    creating: "Creating Excel workbook",
    ready: "Workbook ready",
    short: "Excel workbook",
    ext: "XLSX",
    mdLabel: "XLSX",
  },
  pptx: {
    writing: "Writing presentation",
    creating: "Creating presentation",
    ready: "Presentation ready",
    short: "presentation",
    ext: "PPTX",
    mdLabel: "PPTX",
  },
  txt: {
    writing: "Writing text file",
    creating: "Creating text file",
    ready: "Text file ready",
    short: "text file",
    ext: "TXT",
    mdLabel: "TXT",
  },
  markdown: {
    writing: "Writing markdown file",
    creating: "Creating markdown file",
    ready: "Markdown file ready",
    short: "markdown file",
    ext: "MD",
    mdLabel: "MD",
  },
  csv: {
    writing: "Writing spreadsheet",
    creating: "Creating spreadsheet",
    ready: "Spreadsheet ready",
    short: "spreadsheet",
    ext: "CSV",
    mdLabel: "CSV",
  },
};

const FORMAT_TO_VARIANT: Record<DocFormat, FileBrandVariant> = {
  pdf: "pdf",
  docx: "word",
  xlsx: "excel",
  pptx: "powerpoint",
  txt: "text",
  markdown: "text",
  csv: "text",
};

// Brand colors for the file-type label: the extension text below the file
// name wears the color of the format (red PDF, blue Word, green Excel,
// orange PowerPoint, slate for text/spreadsheet).
const FORMAT_TEXT_COLOR: Record<DocFormat, string> = {
  pdf: "#E8504F",
  docx: "#4F7DF2",
  xlsx: "#2FA06A",
  pptx: "#F0783A",
  txt: "#9AA4B2",
  markdown: "#9AA4B2",
  csv: "#9AA4B2",
};

export function getLiveStatusPhrase(
  stage: FileCreationStage,
  format?: DocFormat
): string {
  switch (stage) {
    case "analyzing":
      return "Crafting the intelligence";
    case "researching":
    case "searching":
      return "Gathering verified insights";
    case "fetching":
    case "analyzing_sources":
      return "Synthesizing research";
    case "planning":
      return "Structuring the content";
    case "content_generated": {
      if (format === "xlsx" || format === "csv")
        return "Writing the spreadsheet";
      if (format === "pptx") return "Writing the presentation";
      return "Writing the document";
    }
    case "designing":
      return "Formatting the layout";
    case "generating":
      return "Compiling the file";
    case "validating":
      return "Validating document integrity";
    case "completed":
      return "Document ready";
    case "error":
      return "Document creation failed";
    default:
      return "Writing the document";
  }
}

export const STAGE_NUMBERS: Record<FileCreationStage, number> = {
  analyzing: 1,
  researching: 2,
  searching: 2,
  fetching: 2,
  analyzing_sources: 2,
  planning: 3,
  content_generated: 4,
  designing: 5,
  generating: 6,
  validating: 7,
  completed: 8,
  error: 0,
};

export type FileCreationCardProps = {
  stage: FileCreationStage;
  format?: DocFormat;
  filename?: string;
  fileUrl?: string;
  fileSizeBytes?: number;
  fileId?: string;
  onRetry?: () => void;
  researchSourceCount?: number;
  sources?: FileSource[];
  metrics?: FileMetrics;
  summary?: string;
  defaultExpanded?: boolean;
  initialShowReady?: boolean;
};

// ── Main card ──────────────────────────────────────────────────────────────
export const FileCreationCard = memo(function FileCreationCard({
  stage,
  format = "pdf",
  filename,
  fileUrl,
  fileSizeBytes,
  fileId,
  onRetry,
  researchSourceCount,
  defaultExpanded = false,
  initialShowReady = false,
}: FileCreationCardProps) {
  const { openPdf } = usePdfViewer();
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const [showReady, setShowReady] = useState(initialShowReady);
  const prevStageRef = useRef<FileCreationStage | null>(stage);
  const stageRef = useRef<HTMLDivElement>(null);
  const [stageWidth, setStageWidth] = useState(0);

  useEffect(() => {
    // Measure the preview stage so the document preview can scale up to fill
    // the available width (edge-to-edge) on any screen size.
    const el = stageRef.current;
    if (!el) return;
    const update = () => setStageWidth(el.clientWidth);
    update();
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    if (initialShowReady && stage === "completed") {
      const timer = setTimeout(() => {
        setShowReady(false);
      }, 3500);
      return () => clearTimeout(timer);
    }
  }, [initialShowReady, stage]);

  useEffect(() => {
    // Only show "Ready" if it just completed in this active session
    // (i.e. transitioned from an in-progress stage to "completed").
    // When opening an existing chat from history, stage is already "completed" on mount,
    // so showReady remains false.
    if (
      prevStageRef.current &&
      prevStageRef.current !== "completed" &&
      prevStageRef.current !== "error" &&
      stage === "completed"
    ) {
      setShowReady(true);
      const timer = setTimeout(() => {
        setShowReady(false);
      }, 3500);
      return () => clearTimeout(timer);
    }
    prevStageRef.current = stage;
  }, [stage]);

  const config = FORMAT_CONFIGS[format] || FORMAT_CONFIGS.pdf;
  const variant = FORMAT_TO_VARIANT[format] || "generic";
  const displayName = filename || `document.${format}`;

  // ── Error state ─────────────────────────────────────────────────────────
  if (stage === "error") {
    return (
      <div className="my-2 w-fit max-w-md animate-in fade-in duration-200">
        <div className="flex items-center gap-3.5 rounded-2xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-destructive">
          <FileBrandMark
            variant={variant}
            className="size-9 shrink-0 opacity-80 saturate-[0.5]"
          />
          <div className="min-w-0 flex-1">
            <p className="text-[13px] font-medium text-foreground">
              Document creation could not be completed
            </p>
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              Something went wrong while generating the {config.short}.
            </p>
          </div>
          {onRetry && (
            <button
              type="button"
              onClick={onRetry}
              className={cn(
                "inline-flex shrink-0 items-center gap-1.5 rounded-xl",
                "border border-border/70 bg-card px-3 py-1.5",
                "text-[11.5px] font-medium text-foreground shadow-sm",
                "transition-all duration-150 hover:bg-muted active:scale-[0.98]"
              )}
            >
              <RotateCw className="size-3" />
              Try again
            </button>
          )}
        </div>
      </div>
    );
  }

  // ── In-Progress / Creating state (CONTAINER-FREE, TEXT-ONLY PROCESS DROPDOWN) ──
  if (stage !== "completed") {
    const statusPhrase = getLiveStatusPhrase(
      stage as FileCreationStage,
      format
    );
    const currentOrder = STAGE_NUMBERS[stage as FileCreationStage] ?? 1;

    const hasResearch =
      (researchSourceCount && researchSourceCount > 0) ||
      ["researching", "searching", "fetching", "analyzing_sources"].includes(
        stage
      );

    const steps = [
      {
        id: "analyzing",
        order: 1,
        label: "Analyzing the request",
        icon: Sparkles,
      },
      ...(hasResearch
        ? [
            {
              id: "researching",
              order: 2,
              label:
                researchSourceCount && researchSourceCount > 0
                  ? `Gathering verified research (${researchSourceCount} sources)`
                  : "Gathering verified research",
              icon: Globe,
            },
          ]
        : []),
      {
        id: "planning",
        order: 3,
        label: "Structuring the content",
        icon: LayoutList,
      },
      {
        id: "content",
        order: 4,
        label:
          format === "xlsx" || format === "csv"
            ? "Writing the spreadsheet"
            : format === "pptx"
              ? "Writing the presentation"
              : "Writing the document",
        icon:
          format === "xlsx" || format === "csv"
            ? Table
            : format === "pptx"
              ? Presentation
              : PenLine,
      },
      {
        id: "designing",
        order: 5,
        label: "Formatting the layout",
        icon: Palette,
      },
      {
        id: "generating",
        order: 6,
        label: "Compiling the file",
        icon: Cpu,
      },
      {
        id: "validating",
        order: 7,
        label: "Validating document integrity",
        icon: ShieldCheck,
      },
    ];

    return (
      <div
        data-testid="file-creation-drafting"
        className="my-2 flex flex-col items-start select-none animate-in fade-in duration-150"
      >
        {/* Interactive process row as the dropdown trigger (minimal, container-free) */}
        <button
          type="button"
          onClick={() => setIsExpanded(prev => !prev)}
          aria-expanded={isExpanded}
          aria-label={
            isExpanded
              ? "Collapse generation process"
              : "Expand generation process"
          }
          className="group/process flex min-h-[36px] items-center gap-2 py-1 text-left cursor-pointer transition-colors focus-visible:outline-none"
        >
          <FileBrandMark
            variant={variant}
            className="size-6 shrink-0 select-none"
          />
          <span className="text-[14.5px] font-medium text-foreground transition-opacity duration-200">
            {statusPhrase}
          </span>
          <ChevronDown
            className={cn(
              "size-4 text-muted-foreground transition-transform duration-200 group-hover/process:text-foreground",
              isExpanded && "rotate-180"
            )}
          />
        </button>

        {/* Process dropdown with step icons before each word */}
        {isExpanded && (
          <div
            data-testid="file-creation-process-list"
            className="mt-2 space-y-2 pl-8 animate-in fade-in slide-in-from-top-1 duration-150"
          >
            {steps.map(step => {
              const StepIcon = step.icon;
              const isCompleted = currentOrder > step.order;
              const isActive = currentOrder === step.order;

              return (
                <div
                  key={step.id}
                  className="flex items-center gap-2 text-[13.5px] leading-snug"
                >
                  <StepIcon
                    className={cn(
                      "size-3.5 shrink-0 transition-colors duration-200",
                      isActive
                        ? "text-foreground"
                        : isCompleted
                          ? "text-muted-foreground"
                          : "text-muted-foreground/40"
                    )}
                  />
                  <span
                    className={cn(
                      "transition-colors duration-200 select-none",
                      isActive
                        ? "font-medium text-foreground"
                        : isCompleted
                          ? "text-muted-foreground"
                          : "text-muted-foreground/40"
                    )}
                  >
                    {step.label}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  const canOpenInDrawer =
    format === "pdf" ||
    format === "docx" ||
    format === "xlsx" ||
    format === "pptx" ||
    isViewableDocument(displayName);

  const handleOpen = () => {
    if (!fileUrl) return;
    if (canOpenInDrawer) {
      openPdf({
        url: fileUrl,
        filename: displayName,
        sizeBytes: fileSizeBytes,
        id: fileId,
      });
    } else {
      window.open(fileUrl, "_blank");
    }
  };

  // ── Completed state (PREMIUM FULL-ZOOM DOCUMENT CARD, OPEN ONLY) ────────────
  return (
    <div
      data-testid="file-creation-completed"
      className="my-2 w-full max-w-[440px] sm:max-w-[480px] select-none animate-in fade-in-0 slide-in-from-bottom-2 zoom-in-95 duration-300 ease-out"
    >
      <div className="overflow-hidden rounded-2xl border border-border/70 bg-card/70 shadow-sm backdrop-blur-sm dark:bg-card/60">
        {/* Dark preview frame — the document is offset inside it (asymmetric, layered) */}
        <div
          ref={stageRef}
          data-testid="file-preview-stage"
          className="relative grid h-[240px] place-items-center overflow-hidden bg-neutral-900 bg-gradient-to-br from-white/[0.06] via-transparent to-transparent shadow-inner ring-1 ring-inset ring-white/5"
        >
          <FileDocumentPreview
            format={format}
            url={fileUrl}
            displayName={displayName}
            variant={variant}
            availWidth={stageWidth}
          />

          {showReady && (
            <span className="absolute top-2 right-2 flex items-center gap-1 rounded-full border border-emerald-500/25 bg-emerald-500/10 px-2 py-0.5 text-[10.5px] font-semibold text-emerald-600 dark:text-emerald-400 animate-in fade-in duration-200 backdrop-blur-xs">
              <Check className="size-3 stroke-[2.5]" />
              Ready
            </span>
          )}

          {/* Short, strong fade at the bottom — between the document and the file bar only */}
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-card via-card/60 to-transparent" />
        </div>

        {/* File name (left) + Open (right) — solid card bg matching the fade base */}
        <div className="relative z-10 flex items-center justify-between gap-3 bg-card px-4 py-3">
          <div className="min-w-0">
            <p className="truncate text-[15px] font-semibold leading-snug text-foreground">
              {displayName}
            </p>
            <p
              className="mt-0.5 text-[11.5px] font-bold tracking-wide uppercase"
              style={{
                color: FORMAT_TEXT_COLOR[format] ?? "#9AA4B2",
              }}
            >
              {config.ext}
            </p>
          </div>
          <Button
            size="sm"
            onClick={handleOpen}
            disabled={!fileUrl}
            aria-label={`Open ${displayName}`}
            className="shrink-0 rounded-lg bg-neutral-900 text-neutral-50 hover:bg-neutral-800"
          >
            Open
            <ArrowUpRight className="size-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );
});

// ── Document preview renderers (fixed miniature white pages) ─────────────────

function cellText(value: unknown): string {
  if (value === null || value === undefined) return "";
  return String(value);
}

function escapeHtml(source: string): string {
  return source
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Light "sheet of paper" (pages stay light like real files) drawn at a
 * canonical size and scaled up so the rendered page fills the available
 * preview width (edge-to-edge, cropped by the stage when the page runs taller
 * than the stage).
 */
function MiniPage({
  children,
  width,
  contentWidth = 320,
  contentHeight = 452,
  className,
}: {
  children: React.ReactNode;
  width: number;
  contentWidth?: number;
  contentHeight?: number;
  className?: string;
}) {
  const scale = width / contentWidth;
  const height = Math.round(contentHeight * scale);
  return (
    <div
      style={{ width, height }}
      className={cn(
        "relative shrink-0 overflow-hidden rounded-tl-[8px] rounded-bl-[8px] bg-white text-neutral-800 shadow-xl shadow-black/15 ring-1 ring-black/10 select-none",
        className
      )}
    >
      <div
        style={{
          width: contentWidth,
          height: contentHeight,
          transform: `scale(${scale})`,
          transformOrigin: "top left",
        }}
        className="pointer-events-none overflow-hidden"
      >
        {children}
      </div>
    </div>
  );
}

function PreviewSkeleton({ variant }: { variant: FileBrandVariant }) {
  return (
    <div
      className="flex flex-col items-center gap-2.5 select-none"
      aria-hidden="true"
    >
      <FileBrandMark variant={variant} className="size-8 shrink-0 opacity-55" />
      <div className="h-2 w-24 animate-pulse rounded-full bg-foreground/10" />
      <p className="text-[10.5px] font-medium text-muted-foreground/70">
        Loading preview…
      </p>
    </div>
  );
}

function PreviewFallback({
  variant,
  displayName,
  message,
}: {
  variant: FileBrandVariant;
  displayName: string;
  message: string;
}) {
  return (
    <div className="flex flex-col items-center gap-2.5 text-center select-none">
      <FileBrandMark variant={variant} className="size-8 shrink-0 opacity-90" />
      <p className="text-[11px] font-medium text-muted-foreground">{message}</p>
      <p className="max-w-[220px] truncate text-[10.5px] text-muted-foreground/70">
        {displayName}
      </p>
    </div>
  );
}

function WordMini({ html, width }: { html: string; width: number }) {
  return (
    <MiniPage width={width}>
      <div
        className="space-y-2.5 px-4 pt-3 pb-3 leading-relaxed [&_a]:text-blue-600 [&_blockquote]:border-l-2 [&_blockquote]:border-neutral-300 [&_blockquote]:pl-2 [&_blockquote]:text-[11.5px] [&_blockquote]:text-neutral-500 [&_blockquote]:italic [&_h1]:mb-2 [&_h1]:text-[18px] [&_h1]:font-bold [&_h1]:text-neutral-900 [&_h2]:mb-1.5 [&_h2]:text-[16px] [&_h2]:font-semibold [&_h2]:text-neutral-900 [&_h3]:mb-1 [&_h3]:text-[13.5px] [&_h3]:font-semibold [&_h3]:text-neutral-900 [&_li]:mb-0.5 [&_li]:text-[11.5px] [&_ol]:mb-2 [&_ol]:list-decimal [&_ol]:pl-4 [&_p]:mb-2 [&_p]:text-[11.5px] [&_strong]:font-semibold [&_table]:my-1.5 [&_table]:w-full [&_table]:border-collapse [&_table]:border [&_table]:border-neutral-300 [&_td]:border [&_td]:border-neutral-300 [&_td]:px-1 [&_td]:py-0.5 [&_td]:text-[9px] [&_th]:border [&_th]:border-neutral-300 [&_th]:bg-neutral-50 [&_th]:px-1 [&_th]:py-0.5 [&_th]:text-[9px] [&_th]:font-semibold [&_th]:text-left [&_ul]:mb-2 [&_ul]:list-disc [&_ul]:pl-4"
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </MiniPage>
  );
}

function TextMini({ text, width }: { text: string; width: number }) {
  const lines = text.split(/\r?\n/).slice(0, 30).join("\n");
  return (
    <MiniPage width={width}>
      <pre className="whitespace-pre-wrap px-4 pt-3 pb-2.5 font-mono text-[10px] leading-[1.65] text-neutral-700">
        {lines}
      </pre>
    </MiniPage>
  );
}

function MarkdownMini({ text, width }: { text: string; width: number }) {
  const lines = text.split(/\r?\n/).slice(0, 34);
  const nodes: React.ReactNode[] = [];
  let bullets: string[] = [];

  const flushBullets = (key: number) => {
    if (bullets.length === 0) return;
    nodes.push(
      <ul key={`b-${key}`} className="mb-1 list-disc space-y-0.5 pl-4">
        {bullets.map((item, idx) => (
          <li key={idx} className="text-[11px] text-neutral-700">
            {item}
          </li>
        ))}
      </ul>
    );
    bullets = [];
  };

  lines.forEach((raw, i) => {
    const line = raw.trim();
    if (/^###\s+/.test(line)) {
      flushBullets(i);
      nodes.push(
        <div
          key={i}
          className="mt-0.5 mb-0.5 text-[11px] font-bold text-neutral-900"
        >
          {escapeHtml(line.slice(4))}
        </div>
      );
    } else if (/^##\s+/.test(line)) {
      flushBullets(i);
      nodes.push(
        <div
          key={i}
          className="mt-0.5 mb-0.5 text-[12px] font-bold text-neutral-900"
        >
          {escapeHtml(line.slice(3))}
        </div>
      );
    } else if (/^#\s+/.test(line)) {
      flushBullets(i);
      nodes.push(
        <div key={i} className="mb-1 text-[16px] font-bold text-neutral-900">
          {escapeHtml(line.slice(2))}
        </div>
      );
    } else if (/^[-*]\s+/.test(line)) {
      bullets.push(escapeHtml(line.replace(/^[-*]\s+/, "")));
    } else if (/^\s*$/.test(raw)) {
      flushBullets(i);
      nodes.push(<div key={i} className="h-1" />);
    } else {
      flushBullets(i);
      nodes.push(
        <p key={i} className="mb-1 text-[11px] leading-snug text-neutral-700">
          {escapeHtml(line)}
        </p>
      );
    }
  });
  flushBullets(lines.length);

  return (
    <MiniPage width={width}>
      <div className="px-4 pt-3 pb-2">{nodes}</div>
    </MiniPage>
  );
}

function ExcelMini({
  sheets,
  width,
}: {
  sheets: SheetPreview[];
  width: number;
}) {
  const sheet = sheets[0] ?? { name: "Sheet1", data: [] };
  const rows = sheet.data.slice(0, 11);
  const colCount = Math.min(
    Math.max(1, ...rows.map(r => (Array.isArray(r) ? r.length : 0))),
    6
  );
  const columnLetters = Array.from({ length: colCount }, (_, i) =>
    String.fromCharCode(65 + i)
  );

  return (
    <div
      style={{ width }}
      className="shrink-0 overflow-hidden rounded-tl-[8px] rounded-bl-[8px] bg-white text-neutral-800 shadow-xl shadow-black/15 ring-1 ring-black/10 select-none"
    >
      <div className="px-2 pt-2 pb-2">
        <table className="w-full table-fixed border-collapse">
          <thead>
            <tr>
              <th className="w-4 border border-[#C6D9C8] bg-[#E7F1E4] px-1 py-1 text-right text-[9px] font-semibold text-[#2E7D4F]">
                #
              </th>
              {columnLetters.map(letter => (
                <th
                  key={letter}
                  className="border border-[#C6D9C8] bg-[#E7F1E4] px-1 py-1 text-center text-[10px] font-bold text-[#1E6B3C]"
                >
                  {letter}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, ri) => (
              <tr key={ri}>
                <th className="border border-[#C6D9C8] bg-[#EDF6EA] px-1 py-0.5 text-right text-[9px] font-semibold text-[#2E7D4F]">
                  {ri + 1}
                </th>
                {Array.from({ length: colCount }, (_, ci) => (
                  <td
                    key={ci}
                    className="truncate border border-neutral-200 px-1 py-0.5 text-[10.5px] text-neutral-800"
                  >
                    {cellText(row[ci])}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function CsvMini({ rows, width }: { rows: string[][]; width: number }) {
  const limited = rows.slice(0, 11);
  const colCount = Math.min(Math.max(1, ...limited.map(r => r.length)), 5);
  const header = limited[0] ?? [];
  const body = limited.slice(1);

  return (
    <div
      style={{ width }}
      className="shrink-0 overflow-hidden rounded-tl-[8px] rounded-bl-[8px] bg-white text-neutral-800 shadow-xl shadow-black/15 ring-1 ring-black/10 select-none"
    >
      <div className="flex items-center justify-between border-b border-neutral-200 bg-neutral-50 px-3 py-1.5 text-[8px] font-semibold tracking-widest text-neutral-500 uppercase">
        <span>Spreadsheet</span>
      </div>
      <div className="px-2 pt-1.5 pb-2">
        <table className="w-full table-fixed border-collapse">
          <thead>
            <tr>
              {Array.from({ length: colCount }, (_, i) => (
                <th
                  key={i}
                  className="truncate border border-neutral-300 bg-neutral-100 px-1 py-1 text-left text-[10px] font-bold text-neutral-600"
                >
                  {cellText(header[i])}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {body.map((row, ri) => (
              <tr key={ri}>
                {Array.from({ length: colCount }, (_, ci) => (
                  <td
                    key={ci}
                    className="truncate border border-neutral-300 px-1 py-0.5 text-[10.5px] text-neutral-700"
                  >
                    {cellText(row[ci])}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function SlideMini({
  slides,
  width,
}: {
  slides: SlidePreview[];
  width: number;
}) {
  const slide = slides[0];
  if (!slide) return null;
  const bullets = slide.items.filter(item => !item.isTitle);

  return (
    <MiniPage width={width} contentWidth={320} contentHeight={180}>
      <div className="flex h-full flex-col justify-between p-4">
        <div>
          <div className="mb-2 flex items-center gap-1.5">
            <span className="h-1 w-6 rounded-full bg-orange-500" />
            <span className="text-[8px] font-semibold tracking-widest text-neutral-400 uppercase">
              Slide 1
            </span>
          </div>
          <h2 className="text-[19px] leading-tight font-bold text-neutral-900">
            {slide.title}
          </h2>
        </div>

        <div className="mt-2 space-y-1.5">
          {bullets.slice(0, 4).map((item, idx) => (
            <div key={idx} className="flex items-start gap-1.5">
              <span className="mt-[2px] h-1 w-1 shrink-0 rounded-full bg-orange-500/80" />
              <p className="text-[12px] leading-snug text-neutral-600">
                {item.text}
              </p>
            </div>
          ))}
        </div>

        <div className="flex items-center justify-between border-t border-neutral-200 pt-1.5 text-[8px] font-medium text-neutral-400">
          <span>Presentation</span>
          <span>1 of {slides.length}</span>
        </div>
      </div>
    </MiniPage>
  );
}

function FileDocumentPreview({
  format,
  url,
  displayName,
  variant,
  availWidth = 0,
}: {
  format: DocFormat;
  url?: string;
  displayName: string;
  variant: FileBrandVariant;
  availWidth?: number;
}) {
  const [data, setData] = useState<FilePreviewData | null>(null);
  const [isLoading, setIsLoading] = useState(Boolean(url));

  // The document spans the full frame width. With the left/top offset it keeps
  // the offset look on the left and top only, and simply extends (crops) past
  // the right edge — no empty gap on the right side.
  const pageWidth = Math.max(availWidth > 0 ? availWidth : 478, 240);

  useEffect(() => {
    let cancelled = false;
    if (!url) {
      setData(null);
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    void loadFilePreview(url, format, displayName)
      .then(next => {
        if (!cancelled) {
          setData(next);
          setIsLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setData({ kind: "error", message: "Preview unavailable." });
          setIsLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [url, format, displayName]);

  if (isLoading) {
    return <PreviewSkeleton variant={variant} />;
  }

  if (!data || data.kind === "error") {
    return (
      <PreviewFallback
        variant={variant}
        displayName={displayName}
        message="Preview unavailable"
      />
    );
  }

  let body: React.ReactNode;
  switch (data.kind) {
    case "pdf":
      body = data.pageImageUrl ? (
        <img
          src={data.pageImageUrl}
          alt={`Preview of ${displayName}`}
          style={{ width: pageWidth }}
          className="shrink-0 rounded-tl-[8px] rounded-bl-[8px] shadow-xl shadow-black/30 ring-1 ring-white/10"
        />
      ) : (
        <PreviewFallback
          variant={variant}
          displayName={displayName}
          message="Preview unavailable"
        />
      );
      break;
    case "docx":
      body = data.html ? (
        <WordMini html={data.html} width={pageWidth} />
      ) : (
        <PreviewFallback
          variant={variant}
          displayName={displayName}
          message="Preview unavailable"
        />
      );
      break;
    case "xlsx":
      body = data.sheets.length ? (
        <ExcelMini sheets={data.sheets} width={pageWidth} />
      ) : (
        <PreviewFallback
          variant={variant}
          displayName={displayName}
          message="Preview unavailable"
        />
      );
      break;
    case "pptx":
      body = data.slides.length ? (
        <SlideMini slides={data.slides} width={pageWidth} />
      ) : (
        <PreviewFallback
          variant={variant}
          displayName={displayName}
          message="Preview unavailable"
        />
      );
      break;
    case "csv":
      body = data.rows.length ? (
        <CsvMini rows={data.rows} width={pageWidth} />
      ) : (
        <PreviewFallback
          variant={variant}
          displayName={displayName}
          message="No data rows"
        />
      );
      break;
    case "text":
      body = data.isMarkdown ? (
        <MarkdownMini text={data.text} width={pageWidth} />
      ) : (
        <TextMini text={data.text} width={pageWidth} />
      );
      break;
    default:
      body = (
        <PreviewFallback
          variant={variant}
          displayName={displayName}
          message="Preview unavailable"
        />
      );
  }

  // Intentional asymmetric placement: the document starts below/inside the
  // frame's top-left corner so the dark frame is visible on the top and left,
  // while the large document extends (and crops) toward the right and bottom.
  return (
    <div className="mt-5 ml-3.5 block self-start justify-self-start">
      {body}
    </div>
  );
}
