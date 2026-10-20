import type { DocFormat } from "@/lib/docFormats";
import React, { memo, useCallback, useEffect, useMemo, useState } from "react";
import type { FileBrandVariant } from "@/components/ksemo/FileBrandIcons";
import { CreateFileModeIcon } from "./LibraryFileIcon";
import { cn } from "@/lib/utils";
import { KsemoCodeBlock, stripShebang } from "@/components/ksemo/code-block";
import {
  loadFilePreview,
  type FilePreviewData,
  type SheetPreview,
  type SlidePreview,
} from "@/lib/filePreview";
import {
  asCssColor,
  type PptPresentationSpec,
  SLIDE_WIDTH_IN,
  SLIDE_HEIGHT_IN,
} from "@shared/presentation";
import { usePdfViewer, isViewableDocument } from "@/contexts/PdfViewerContext";
import { isLightOrWhiteBorder } from "@/components/ksemo/PdfDrawer";

export type FileCreationStage =
  | "analyzing"
  | "planning"
  | "researching"
  | "searching"
  | "fetching"
  | "analyzing_sources"
  | "content_generated"
  | "outline"
  | "designing"
  | "generating"
  | "validating"
  | "completed"
  | "interrupted"
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

// Keep each format's tile, filename surface, and hover shadow in one palette.
const FORMAT_ACCENT_COLOR: Record<DocFormat, string> = {
  pdf: "#E33135",
  docx: "#1D4E89",
  xlsx: "#2FA06A",
  pptx: "#F0783A",
  txt: "#778292",
  markdown: "#778292",
  csv: "#778292",
};

const FILE_NAME_SURFACE_COLOR = "#343434";

const FORMAT_SHADOW_COLOR: Record<DocFormat, string> = {
  pdf: "#64151B",
  docx: "#102744",
  xlsx: "#12402C",
  pptx: "#783719",
  txt: "#252B33",
  markdown: "#252B33",
  csv: "#252B33",
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
    case "outline":
      return "Preparing the presentation outline";
    case "designing":
      return "Formatting the layout";
    case "generating":
      return "Compiling the file";
    case "validating":
      return "Validating document integrity";
    case "completed":
      return "Document ready";
    case "interrupted":
      return "Document creation stopped";
    case "error":
      return "Document creation failed";
    default:
      return "Writing the document";
  }
}

export function getCreatingStatusPhrase(format?: DocFormat): string {
  switch (format) {
    case "xlsx":
    case "csv":
      return "Creating spreadsheet...";
    case "pptx":
      return "Creating presentation...";
    case "txt":
      return "Creating text file...";
    case "markdown":
      return "Creating document...";
    case "pdf":
    case "docx":
    default:
      return "Creating document...";
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
  outline: 4,
  designing: 5,
  generating: 6,
  validating: 7,
  completed: 8,
  interrupted: 0,
  error: 0,
};

export type FileCreationCardProps = {
  stage: FileCreationStage;
  format?: DocFormat;
  filename?: string;
  fileUrl?: string;
  fileSizeBytes?: number;
  fileId?: string;
  errorMessage?: string;
  researchSourceCount?: number;
  sources?: FileSource[];
  metrics?: FileMetrics;
  summary?: string;
  defaultExpanded?: boolean;
  initialShowReady?: boolean;
  code?: string;
  initialShowCodeExpanded?: boolean;
  initialShowCodeModal?: boolean;
  initialShowCodeDrawer?: boolean;
  onOpenCode?: (code: string, filename?: string) => void;
};

// ── Main card ──────────────────────────────────────────────────────────────
export const FileCreationCard = memo(function FileCreationCard({
  stage,
  format = "pdf",
  filename,
  fileUrl,
  fileSizeBytes,
  fileId,
  errorMessage,
  researchSourceCount,
  defaultExpanded = false,
  code,
  initialShowCodeExpanded = false,
  initialShowCodeModal = false,
  initialShowCodeDrawer = false,
  onOpenCode,
}: FileCreationCardProps) {
  const { currentPdf, isOpen, openPdf, closePdf } = usePdfViewer();

  const cleanCode = useMemo(() => {
    return stripShebang(code || "");
  }, [code]);

  const codeLineCount = useMemo(() => {
    if (!cleanCode) return 0;
    return cleanCode.split("\n").length;
  }, [cleanCode]);

  const config = FORMAT_CONFIGS[format] || FORMAT_CONFIGS.pdf;
  const capabilityFormat =
    format === "markdown" || format === "csv" ? "txt" : format;
  const displayName = filename || `document.${format}`;
  const isPreviewOpen = Boolean(
    fileUrl && isOpen && currentPdf?.url === fileUrl
  );

  const cleanBaseName = useMemo(() => {
    return displayName.replace(/\.\w+$/, "");
  }, [displayName]);

  const handleOpenCode = useCallback(() => {
    if (!cleanCode) return;
    if (onOpenCode) {
      onOpenCode(cleanCode, `${cleanBaseName}.py`);
      return;
    }
    const codeDataUrl = `data:text/x-python;charset=utf-8,${encodeURIComponent(cleanCode)}`;
    openPdf({
      url: codeDataUrl,
      filename: `${cleanBaseName}.py`,
      sizeBytes: new Blob([cleanCode]).size,
      mimeType: "text/x-python",
      isCode: true,
    });
  }, [cleanCode, cleanBaseName, openPdf, onOpenCode]);

  useEffect(() => {
    if (
      (initialShowCodeDrawer ||
        initialShowCodeModal ||
        initialShowCodeExpanded) &&
      cleanCode
    ) {
      handleOpenCode();
    }
  }, [
    initialShowCodeDrawer,
    initialShowCodeModal,
    initialShowCodeExpanded,
    cleanCode,
    handleOpenCode,
  ]);

  // ── Error state ─────────────────────────────────────────────────────────
  if (stage === "error") {
    return (
      <div className="my-2 w-fit max-w-md animate-in fade-in duration-200">
        <div className="flex items-center gap-3.5 rounded-2xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-destructive">
          <CreateFileModeIcon
            mode={capabilityFormat}
            className="size-9 shrink-0 opacity-80"
          />
          <div className="min-w-0 flex-1">
            <p className="text-[13px] font-medium text-foreground">
              Document creation could not be completed
            </p>
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              {errorMessage ||
                `Something went wrong while generating the ${config.short}.`}
            </p>
          </div>
        </div>
      </div>
    );
  }

  // ── Interrupted / stopped state ────────────────────────────────────────
  if (stage === "interrupted") {
    return (
      <div className="my-2 w-fit max-w-full animate-in fade-in duration-200">
        <div className="flex w-fit max-w-full items-center gap-2 rounded-xl border border-border/60 bg-muted/40 px-3 py-2 text-foreground">
          <CreateFileModeIcon
            mode={capabilityFormat}
            className="size-5 shrink-0 opacity-70"
          />
          <span className="whitespace-nowrap text-[13px] font-medium text-foreground">
            Creation stopped
          </span>
        </div>
      </div>
    );
  }

  // ── In-Progress / Creating state (CLEAN, CONTAINER-FREE, NO DROPDOWN) ───────
  if (stage !== "completed") {
    const creatingPhrase = getCreatingStatusPhrase(format);

    return (
      <div
        data-testid="file-creation-drafting"
        className="relative my-2 flex items-center gap-2.5 py-1 select-none motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-left-2 motion-safe:duration-300"
      >
        <CreateFileModeIcon
          mode={capabilityFormat}
          className="size-5 shrink-0 select-none"
        />
        <span className="text-[13.5px] font-medium select-none text-muted-foreground">
          {creatingPhrase}
        </span>
        <div
          aria-hidden="true"
          className="ksemo-file-status-sweep pointer-events-none absolute inset-0 flex items-center gap-2.5 text-foreground"
        >
          <CreateFileModeIcon
            mode={capabilityFormat}
            className="size-5 shrink-0 select-none"
          />
          <span className="text-[13.5px] font-medium select-none">
            {creatingPhrase}
          </span>
        </div>
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

  const handleTogglePreview = () => {
    if (!fileUrl) return;
    if (isPreviewOpen) {
      closePdf();
      return;
    }
    handleOpen();
  };

  const accent = FORMAT_ACCENT_COLOR[format] ?? "#778292";

  return (
    <div className="relative my-2 w-fit max-w-full">
      <button
        data-testid="file-creation-completed"
        data-preview-open={isPreviewOpen || undefined}
        type="button"
        onClick={handleTogglePreview}
        aria-label={`${isPreviewOpen ? "Close" : "Open"} ${displayName}`}
        className="ksemo-created-file-art group flex w-fit max-w-full cursor-pointer appearance-none items-center gap-0 border-0 bg-transparent p-0 text-left select-none animate-in fade-in-0 duration-300 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
      >
        <span
          data-testid="file-preview-stage"
          className="grid size-[124px] shrink-0 place-items-center rounded-2xl text-left"
          style={{ backgroundColor: accent }}
        >
          <DocumentFileGlyph format={format} label={config.ext} />
        </span>
        <span
          className="ksemo-created-file-name relative isolate -translate-y-3 flex min-w-[150px] max-w-[calc(100vw-148px)] items-center overflow-hidden rounded-r-2xl px-4 py-3 text-white"
          style={
            {
              backgroundColor: FILE_NAME_SURFACE_COLOR,
              "--ksemo-file-accent": accent,
            } as React.CSSProperties
          }
        >
          <span className="relative z-[1] min-w-0 flex-1 truncate whitespace-nowrap text-[15px] leading-snug font-semibold text-white">
            {displayName}
          </span>
        </span>
        {fileUrl && (
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            fill="none"
            className="ksemo-file-open-arrow relative -top-3 ml-2 size-5 shrink-0"
            style={{ color: accent }}
          >
            <path
              d="M4 12h15m-6-6 6 6-6 6"
              stroke="currentColor"
              strokeWidth="2.4"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        )}
      </button>
      {fileUrl && (
        <div
          role="group"
          aria-label="File actions"
          className="absolute top-[74px] left-[126px] inline-flex items-center rounded-l-none rounded-r-md border border-white/10 bg-[#343434] p-0.5"
        >
          <a
            href={fileUrl}
            download={displayName}
            aria-label={`Download ${displayName}`}
            className="inline-flex h-8 items-center gap-1.5 rounded-sm px-2.5 text-sm font-medium text-white transition-colors hover:bg-[#414141] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
          >
            <span>Download</span>
          </a>
          <span aria-hidden="true" className="h-4 w-px bg-white/20" />
          <button
            type="button"
            data-testid="file-creation-open-toggle"
            onClick={handleTogglePreview}
            aria-label={`${isPreviewOpen ? "Close" : "Open"} ${displayName}`}
            aria-pressed={isPreviewOpen}
            className="inline-flex h-8 items-center rounded-sm px-2.5 text-sm font-medium text-white transition-colors hover:bg-[#414141] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
          >
            {isPreviewOpen ? "Close" : "Open"}
          </button>
        </div>
      )}
    </div>
  );
});

function DocumentFileGlyph({
  format,
  label,
}: {
  format: DocFormat;
  label: string;
}) {
  const accent = FORMAT_ACCENT_COLOR[format] ?? "#778292";
  return (
    <span aria-hidden="true" className="block w-[104px] max-w-full">
      <svg
        className="ksemo-created-file-svg block h-auto w-full translate-x-[2px] overflow-visible"
        viewBox="0 0 132 145"
        fill="none"
      >
        <g className="ksemo-illustration-document">
          <path
            className="ksemo-file-cast-shadow"
            d="M42 17h43l36 36v69c0 13-10 22-22 22H42c-13 0-22-9-22-22V39c0-13 9-22 22-22Z"
            fill={FORMAT_SHADOW_COLOR[format]}
          />
          <path
            d="M35 12h43l36 36v69c0 13-10 22-22 22H35c-13 0-22-9-22-22V34c0-13 9-22 22-22Z"
            fill="#FFF"
          />
          <path
            d="M78 12v18c0 12 9 21 21 21h15L78 12Z"
            fill={accent}
            fillOpacity=".18"
          />
          <path
            d="M31 37h45"
            className="ksemo-file-writing-line"
            pathLength={1}
            stroke={accent}
            strokeOpacity=".3"
            strokeWidth="3.2"
            strokeLinecap="round"
          />
          <path
            d="M31 45h42"
            className="ksemo-file-writing-line ksemo-file-writing-line-2"
            pathLength={1}
            stroke={accent}
            strokeOpacity=".3"
            strokeWidth="3.2"
            strokeLinecap="round"
          />
          <rect x="24" y="57" width="80" height="38" rx="6" fill={accent} />
          <text
            x="64"
            y="83"
            textAnchor="middle"
            fill="#FFF"
            fontFamily="Arial,sans-serif"
            fontSize="22"
            fontWeight="700"
            letterSpacing=".2"
          >
            {label}
          </text>
          {format === "xlsx" ? (
            <g
              className="ksemo-file-grid"
              fill="none"
              stroke={accent}
              strokeOpacity=".48"
              strokeWidth=".9"
            >
              {Array.from({ length: 3 }, (_, row) =>
                Array.from({ length: 3 }, (_, column) => {
                  const cell = row * 3 + column + 1;
                  return (
                    <rect
                      key={cell}
                      className={`ksemo-file-grid-cell ksemo-file-grid-cell-${cell}`}
                      x={41 + column * 16}
                      y={101 + row * 10}
                      width="14"
                      height="8"
                      rx="1.5"
                      pathLength={1}
                    />
                  );
                })
              )}
            </g>
          ) : format === "pptx" ? (
            <g>
              <g className="ksemo-ppt-chart">
                <circle
                  cx="48"
                  cy="115"
                  r="12"
                  fill={accent}
                  fillOpacity=".1"
                  stroke={accent}
                  strokeOpacity=".38"
                  strokeWidth="1"
                />
                <path
                  d="M48 115V103A12 12 0 0 1 60 115Z"
                  fill={accent}
                  fillOpacity=".52"
                />
                <path
                  d="M48 115V103M48 115h12"
                  stroke={accent}
                  strokeOpacity=".62"
                  strokeWidth="1"
                  strokeLinecap="round"
                />
              </g>
              <g
                fill="none"
                stroke={accent}
                strokeOpacity=".3"
                strokeWidth="3.5"
                strokeLinecap="round"
              >
                <path
                  d="M66 106h25"
                  className="ksemo-file-writing-line ksemo-pptx-bar-1"
                  pathLength={1}
                />
                <path
                  d="M66 115h25"
                  className="ksemo-file-writing-line ksemo-pptx-bar-2"
                  pathLength={1}
                />
                <path
                  d="M66 124h25"
                  className="ksemo-file-writing-line ksemo-pptx-bar-3"
                  pathLength={1}
                />
              </g>
            </g>
          ) : (
            <g
              fill="none"
              stroke={accent}
              strokeOpacity=".3"
              strokeWidth="3.2"
              strokeLinecap="round"
            >
              <path
                d="M31 103h42"
                className="ksemo-file-writing-line ksemo-file-writing-line-3"
                pathLength={1}
              />
              <path
                d="M31 113h25"
                className="ksemo-file-writing-line ksemo-file-writing-line-4"
                pathLength={1}
              />
            </g>
          )}
        </g>
      </svg>
    </span>
  );
}

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
  const mode =
    variant === "pdf"
      ? "pdf"
      : variant === "word"
        ? "docx"
        : variant === "excel"
          ? "xlsx"
          : variant === "powerpoint"
            ? "pptx"
            : "txt";
  return (
    <div
      className="flex flex-col items-center gap-2.5 select-none"
      aria-hidden="true"
    >
      <CreateFileModeIcon
        mode={mode}
        className="size-[18px] shrink-0 opacity-55"
      />
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
  const mode =
    variant === "pdf"
      ? "pdf"
      : variant === "word"
        ? "docx"
        : variant === "excel"
          ? "xlsx"
          : variant === "powerpoint"
            ? "pptx"
            : "txt";
  return (
    <div className="flex flex-col items-center gap-2.5 text-center select-none">
      <CreateFileModeIcon
        mode={mode}
        className="size-[18px] shrink-0 opacity-90"
      />
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
  spec,
  width,
}: {
  slides: SlidePreview[];
  spec?: PptPresentationSpec;
  width: number;
}) {
  if (spec && spec.slides && spec.slides.length > 0) {
    const firstSlide = spec.slides[0];
    const bg = asCssColor(firstSlide.background);
    return (
      <MiniPage
        width={width}
        contentWidth={640}
        contentHeight={360}
        className="shadow-2xl ring-1 ring-black/10"
      >
        <div
          style={{ width: 640, height: 360, background: bg }}
          className="relative overflow-hidden select-none"
        >
          {firstSlide.elements.map((el, idx) => {
            const xPct = (el.box.x / SLIDE_WIDTH_IN) * 100;
            const yPct = (el.box.y / SLIDE_HEIGHT_IN) * 100;
            const wPct = (el.box.w / SLIDE_WIDTH_IN) * 100;
            const hPct = (el.box.h / SLIDE_HEIGHT_IN) * 100;

            if (el.kind === "text") {
              return (
                <div
                  key={idx}
                  style={{
                    position: "absolute",
                    left: `${xPct}%`,
                    top: `${yPct}%`,
                    width: `${wPct}%`,
                    height: `${hPct}%`,
                    color: asCssColor(el.color),
                    fontSize: `${Math.max(el.fontSize * 0.5, 7.5)}px`,
                    fontWeight: el.bold ? 700 : 400,
                    fontFamily: el.font,
                    fontStyle: el.italic ? "italic" : "normal",
                    opacity: (el.opacity ?? 100) / 100,
                    lineHeight: 1.15,
                    overflow: "hidden",
                    display: "flex",
                    alignItems:
                      el.valign === "bottom"
                        ? "flex-end"
                        : el.valign === "middle"
                          ? "center"
                          : "flex-start",
                    justifyContent:
                      el.align === "center"
                        ? "center"
                        : el.align === "right"
                          ? "flex-end"
                          : "flex-start",
                    textAlign: el.align ?? "left",
                  }}
                >
                  <span className="truncate">{el.text}</span>
                </div>
              );
            }

            if (el.kind === "shape") {
              const fill = el.fill
                ? asCssColor(el.fill)
                : el.lineColor
                  ? "transparent"
                  : "#000";
              const hasWhiteOrLightBorder = isLightOrWhiteBorder(el.lineColor);
              const shouldRenderBorder = Boolean(
                el.lineColor &&
                !hasWhiteOrLightBorder &&
                (el.shape === "line" || !el.fill)
              );
              return (
                <div
                  key={idx}
                  style={{
                    position: "absolute",
                    left: `${xPct}%`,
                    top: `${yPct}%`,
                    width: `${wPct}%`,
                    height: `${hPct}%`,
                    background: el.shape === "line" ? undefined : fill,
                    border: shouldRenderBorder
                      ? `1px solid ${asCssColor(el.lineColor)}`
                      : undefined,
                    borderRadius:
                      el.shape === "ellipse"
                        ? "50%"
                        : el.shape === "roundRect"
                          ? "4px"
                          : undefined,
                    opacity:
                      el.opacity !== undefined ? el.opacity / 100 : undefined,
                  }}
                />
              );
            }

            return null;
          })}
        </div>
      </MiniPage>
    );
  }

  const slide = slides[0];
  if (!slide) return null;
  const bullets = slide.items.filter(item => !item.isTitle);

  return (
    <MiniPage width={width} contentWidth={320} contentHeight={180}>
      <div className="flex h-full flex-col justify-between p-4 bg-neutral-900 text-neutral-100">
        <div>
          <h2 className="text-[17px] leading-tight font-bold text-white truncate">
            {slide.title}
          </h2>
        </div>

        <div className="mt-2 space-y-1.5 flex-1">
          {bullets.slice(0, 3).map((item, idx) => (
            <div key={idx} className="flex items-start gap-1.5">
              <span className="mt-[3px] h-1 w-1 shrink-0 rounded-full bg-neutral-400" />
              <p className="text-[11px] leading-snug text-neutral-300 truncate">
                {item.text}
              </p>
            </div>
          ))}
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
      body =
        data.slides.length || data.spec ? (
          <SlideMini slides={data.slides} spec={data.spec} width={pageWidth} />
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
