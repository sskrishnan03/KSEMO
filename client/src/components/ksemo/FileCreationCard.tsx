import type { DocFormat } from "@/lib/docFormats";
import {
  Check,
  ChevronDown,
  Cpu,
  Download,
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
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { downloadFile } from "@/lib/downloadFile";
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

export function getLiveStatusPhrase(stage: FileCreationStage, format?: DocFormat): string {
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
      if (format === "xlsx" || format === "csv") return "Writing the spreadsheet";
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

function formatFileSize(bytes?: number): string | null {
  if (typeof bytes !== "number" || Number.isNaN(bytes) || bytes < 0)
    return null;
  const units = ["B", "KB", "MB", "GB"];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  const digits = unit === 0 || value >= 100 ? 0 : value >= 10 ? 1 : 2;
  return `${value.toFixed(digits)} ${units[unit]}`;
}

function formatFileMetrics(metrics?: FileMetrics): string | null {
  if (!metrics) return null;
  const parts: string[] = [];
  if (typeof metrics.pages === "number" && metrics.pages > 0) {
    parts.push(`${metrics.pages} ${metrics.pages === 1 ? "page" : "pages"}`);
  }
  if (typeof metrics.slides === "number" && metrics.slides > 0) {
    parts.push(`${metrics.slides} ${metrics.slides === 1 ? "slide" : "slides"}`);
  }
  if (typeof metrics.sheets === "number" && metrics.sheets > 0) {
    parts.push(`${metrics.sheets} ${metrics.sheets === 1 ? "sheet" : "sheets"}`);
  }
  if (typeof metrics.words === "number" && metrics.words > 0) {
    parts.push(`${metrics.words.toLocaleString()} words`);
  }
  return parts.length ? parts.join(" \u00b7 ") : null;
}

export type FileCreationCardProps = {
  stage: FileCreationStage;
  format?: DocFormat;
  filename?: string;
  fileUrl?: string;
  fileSizeBytes?: number;
  onRetry?: () => void;
  researchSourceCount?: number;
  sources?: FileSource[];
  metrics?: FileMetrics;
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
  onRetry,
  researchSourceCount,
  metrics,
  defaultExpanded = false,
  initialShowReady = false,
}: FileCreationCardProps) {
  const { openPdf } = usePdfViewer();
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const [showReady, setShowReady] = useState(initialShowReady);
  const prevStageRef = useRef<FileCreationStage | null>(stage);

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
    const statusPhrase = getLiveStatusPhrase(stage as FileCreationStage, format);
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
          aria-label={isExpanded ? "Collapse generation process" : "Expand generation process"}
          className="group/process flex min-h-[36px] items-center gap-2 py-1 text-left cursor-pointer transition-colors focus-visible:outline-none"
        >
          <FileBrandMark variant={variant} className="size-6 shrink-0 select-none" />
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

  // ── Completed state (BALANCED ELEGANT WIDTH, CLICK TO OPEN, HOVER DOWNLOAD) ───
  return (
    <div
      data-testid="file-creation-completed"
      className="my-2 w-fit min-w-[220px] max-w-[340px] sm:max-w-[360px] animate-in fade-in duration-200"
    >
      <a
        href={fileUrl}
        target="_blank"
        rel="noreferrer"
        onClick={e => {
          if (canOpenInDrawer && fileUrl) {
            e.preventDefault();
            openPdf({
              url: fileUrl,
              filename: displayName,
              sizeBytes: fileSizeBytes,
            });
          }
        }}
        className={cn(
          "group/file relative flex min-h-[58px] items-center gap-3.5 rounded-2xl",
          "border border-border/80 bg-card/90 px-4 py-3 shadow-sm backdrop-blur-sm",
          "transition-all duration-200 hover:border-border hover:bg-accent/60 hover:shadow-md",
          "dark:bg-card/60 dark:hover:bg-card/90 cursor-pointer"
        )}
      >
        {/* File Brand Logo: clean, properly sized (size-9 / 36px), no extra wrapper layer */}
        <FileBrandMark variant={variant} className="size-9 shrink-0 select-none" />

        {/* Title & auto-dismissing Ready status (no duplicate format badge) */}
        <div className="min-w-0 flex-1">
          <p className="truncate text-[14px] font-medium leading-snug text-foreground group-hover/file:text-primary transition-colors">
            {displayName}
          </p>

          {showReady && (
            <p className="mt-0.5 flex items-center gap-1 text-[11.5px] font-medium text-emerald-600 dark:text-emerald-400 animate-in fade-in duration-200">
              <Check className="size-3 stroke-[2.5]" />
              <span>Ready</span>
            </p>
          )}
        </div>

        {/* Download Option: Only shows on hover, stationary, transparent without white background */}
        {fileUrl && (
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={e => {
                  e.preventDefault();
                  e.stopPropagation();
                  void downloadFile(fileUrl, displayName);
                }}
                aria-label={`Download ${displayName}`}
                className={cn(
                  "relative flex size-9 shrink-0 items-center justify-center rounded-xl",
                  "bg-transparent text-muted-foreground",
                  "opacity-0 transition-opacity duration-150 group-hover/file:opacity-100",
                  "hover:bg-muted/80 hover:text-foreground",
                  "focus-visible:opacity-100"
                )}
              >
                <Download className="size-4" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom" sideOffset={6}>
              Download
            </TooltipContent>
          </Tooltip>
        )}
      </a>
    </div>
  );
});
