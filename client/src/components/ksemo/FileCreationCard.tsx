import type { DocFormat } from "@/lib/docFormats";
import {
  ArrowUpRight,
  Download,
  ExternalLink,
  RotateCw,
} from "lucide-react";
import { memo } from "react";
import {
  FileBrandMark,
  type FileBrandVariant,
} from "@/components/ksemo/FileBrandIcons";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

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
  { creating: string; ready: string; short: string; ext: string; mdLabel: string }
> = {
  pdf: {
    creating: "Creating PDF",
    ready: "PDF ready",
    short: "PDF",
    ext: "PDF",
    mdLabel: "PDF",
  },
  docx: {
    creating: "Creating document",
    ready: "Document ready",
    short: "document",
    ext: "DOCX",
    mdLabel: "DOCX",
  },
  xlsx: {
    creating: "Creating workbook",
    ready: "Workbook ready",
    short: "workbook",
    ext: "XLSX",
    mdLabel: "XLSX",
  },
  pptx: {
    creating: "Creating presentation",
    ready: "Presentation ready",
    short: "presentation",
    ext: "PPTX",
    mdLabel: "PPTX",
  },
  txt: {
    creating: "Creating text file",
    ready: "Text file ready",
    short: "text file",
    ext: "TXT",
    mdLabel: "TXT",
  },
  markdown: {
    creating: "Creating markdown file",
    ready: "Markdown file ready",
    short: "markdown file",
    ext: "MD",
    mdLabel: "MD",
  },
  csv: {
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

// Mapping backend stages to user-friendly status lines — only one shows at a time.
const STATUS_LINES: Partial<Record<FileCreationStage, string>> = {
  analyzing: "Analyzing your request",
  planning: "Planning the document",
  researching: "Researching relevant information",
  searching: "Searching for information",
  fetching: "Gathering content",
  analyzing_sources: "Analyzing sources",
  content_generated: "Writing and formatting",
  designing: "Designing layout",
  generating: "Generating file",
  validating: "Validating document",
};

const FORMATTING_LINE = "Writing and formatting";

function formatFileSize(bytes?: number): string | null {
  if (typeof bytes !== "number" || Number.isNaN(bytes) || bytes < 0) return null;
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

function extractDomain(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

type FileCreationCardProps = {
  stage: FileCreationStage;
  format?: DocFormat;
  filename?: string;
  fileUrl?: string;
  fileSizeBytes?: number;
  onRetry?: () => void;
  researchSourceCount?: number;
  sources?: FileSource[];
  metrics?: FileMetrics;
};

// ── Source chips ───────────────────────────────────────────────────────────
const SourceChips = memo(function SourceChips({
  sources,
}: {
  sources: FileSource[];
}) {
  if (!sources.length) return null;

  return (
    <div>
      <p className="mb-2 text-[10px] font-medium uppercase tracking-wide text-muted-foreground/60">
        Sources
      </p>
      <div className="flex flex-wrap gap-1.5">
        {sources.map((source, index) => {
          const domain = source.publisher || extractDomain(source.url);
          return (
            <Tooltip key={source.url || index}>
              <TooltipTrigger asChild>
                <a
                  href={source.url}
                  target="_blank"
                  rel="noreferrer"
                  aria-label={`Open ${source.title || domain}`}
                  className={cn(
                    "group/chip inline-flex max-w-[160px] items-center gap-1 rounded-md",
                    "border border-border/60 bg-muted/40 px-2 py-0.5",
                    "text-[11px] leading-5 text-muted-foreground",
                    "transition-all duration-150",
                    "hover:border-border hover:bg-muted/70 hover:text-foreground"
                  )}
                >
                  <span className="truncate">{domain}</span>
                  <ExternalLink className="size-2.5 shrink-0 opacity-0 transition-opacity duration-150 group-hover/chip:opacity-60" />
                </a>
              </TooltipTrigger>
              <TooltipContent side="top" sideOffset={6}>
                <span className="line-clamp-2 max-w-[220px]">
                  {source.title || domain}
                </span>
              </TooltipContent>
            </Tooltip>
          );
        })}
      </div>
    </div>
  );
});

// ── Main card ──────────────────────────────────────────────────────────────
export const FileCreationCard = memo(function FileCreationCard({
  stage,
  format = "pdf",
  filename,
  fileUrl,
  fileSizeBytes,
  onRetry,
  sources,
}: FileCreationCardProps) {
  const config = FORMAT_CONFIGS[format] || FORMAT_CONFIGS.pdf;
  const variant = FORMAT_TO_VARIANT[format] || "generic";
  const displayName = filename || `document.${format}`;

  // ── Error state ─────────────────────────────────────────────────────────
  if (stage === "error") {
    return (
      <div className="my-1 w-full max-w-2xl">
        <div className="flex items-center gap-3 rounded-xl border border-border/50 bg-card/60 px-3.5 py-3">
          <FileBrandMark
            variant={variant}
            className="size-10 shrink-0 opacity-70 saturate-[0.5]"
          />
          <div className="min-w-0 flex-1">
            <p className="text-[13px] font-medium text-foreground">
              Document couldn't be created
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
                "inline-flex shrink-0 items-center gap-1.5 rounded-lg",
                "border border-border/60 bg-muted/50 px-2.5 py-1.5",
                "text-[11px] font-medium text-muted-foreground",
                "transition-colors duration-150 hover:bg-muted hover:text-foreground"
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

  // ── Processing state ────────────────────────────────────────────────────
  if (stage !== "completed") {
    const statusLine =
      STATUS_LINES[stage as FileCreationStage] ?? FORMATTING_LINE;

    return (
      <div className="my-1 w-full max-w-2xl">
        <div className="flex items-center gap-3 rounded-xl border border-border/50 bg-card/60 px-3.5 py-3">
          <FileBrandMark
            variant={variant}
            className="size-10 shrink-0"
          />
          <div className="min-w-0 flex-1">
            <p className="text-[13px] font-medium text-foreground">
              {config.creating}
            </p>
            <p
              key={stage}
              className="mt-0.5 flex items-center gap-2 text-[11px] text-muted-foreground animate-in fade-in duration-200"
            >
              <span className="inline-block size-1.5 shrink-0 rounded-full bg-muted-foreground/40 animate-pulse" />
              {statusLine}
            </p>
          </div>
        </div>
      </div>
    );
  }

  // ── Completed state ─────────────────────────────────────────────────────
  const sizeLabel = formatFileSize(fileSizeBytes);

  return (
    <div className="my-1 w-full max-w-2xl animate-in fade-in duration-200">
      <div className="rounded-xl border border-border/50 bg-card/60 transition-shadow duration-200 hover:shadow-[0_2px_8px_rgba(0,0,0,0.06)]">
        {/* File row */}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 px-3.5 py-3 sm:flex-nowrap">
          <FileBrandMark
            variant={variant}
            className="size-10 shrink-0"
          />
          <div className="min-w-0 flex-1">
            <p className="text-[13px] font-medium text-foreground leading-tight">
              {displayName}
            </p>
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              {config.mdLabel}
              {sizeLabel ? ` \u00b7 ${sizeLabel}` : ""}
            </p>
          </div>
          <div className="flex w-full shrink-0 items-center gap-1.5 sm:w-auto">
            {fileUrl && (
              <a
                href={fileUrl}
                target="_blank"
                rel="noreferrer"
                className={cn(
                  "inline-flex h-7 items-center gap-1 whitespace-nowrap rounded-lg px-2.5",
                  "bg-foreground text-[11px] font-medium text-background",
                  "transition-colors duration-150 hover:bg-foreground/85"
                )}
              >
                Open
                <ArrowUpRight className="size-3" />
              </a>
            )}
            {fileUrl && (
              <a
                href={fileUrl}
                download={displayName}
                aria-label={`Download ${displayName}`}
                title="Download file"
                className={cn(
                  "inline-flex size-7 items-center justify-center rounded-lg",
                  "border border-border/60 text-muted-foreground",
                  "transition-colors duration-150 hover:bg-muted hover:text-foreground"
                )}
              >
                <Download className="size-3.5" />
              </a>
            )}
          </div>
        </div>

        {/* Sources — inline chips, no dropdown */}
        {sources && sources.length > 0 && (
          <div className="animate-in fade-in duration-300 border-t border-border/40 px-3.5 pb-3 pt-2.5">
            <SourceChips sources={sources} />
          </div>
        )}
      </div>
    </div>
  );
});
