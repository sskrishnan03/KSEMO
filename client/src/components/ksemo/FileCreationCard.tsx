import { cn } from "@/lib/utils";
import { getDocFormatOption, type DocFormat } from "@/lib/docFormats";
import {
  AlertCircle,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Copy,
  Download,
  ExternalLink,
  FileCode,
  FileSpreadsheet,
  FileText,
  Loader2,
  Presentation,
  RotateCw,
  Sparkles,
} from "lucide-react";
import React, { memo, useEffect, useState } from "react";

export type FileCreationStage =
  | "analyzing"
  | "researching"
  | "planning"
  | "content_generated"
  | "formatting"
  | "validating"
  | "completed"
  | "error";

const STAGES_PIPELINE = [
  { id: "analyzing", label: "Outline", detail: "Analyzing prompt & structuring document schema...", progress: 20 },
  { id: "researching", label: "Research", detail: "Synthesizing factual points, analysis & citations...", progress: 40 },
  { id: "planning", label: "Layout", detail: "Structuring sections, tables & document typography...", progress: 60 },
  { id: "content_generated", label: "Draft", detail: "Drafting complete multi-section document content...", progress: 80 },
  { id: "formatting", label: "Compile", detail: "Compiling native binary document & vector layout...", progress: 92 },
  { id: "validating", label: "Verify", detail: "Verifying binary checksum & structure integrity...", progress: 98 },
] as const;

const STAGE_CONFIG: Record<
  string,
  { label: string; detail: string; progress: number }
> = {
  analyzing: {
    label: "Analyzing Prompt & Architecture",
    detail: "Structuring document hierarchy and topic scope...",
    progress: 20,
  },
  researching: {
    label: "Synthesizing Data & Content",
    detail: "Gathering factual figures, detailed sections & analysis...",
    progress: 40,
  },
  planning: {
    label: "Architecting Document Layout",
    detail: "Designing headers, tables, typography & page flow...",
    progress: 60,
  },
  content_generated: {
    label: "Composing Document Content",
    detail: "Drafting complete multi-section structured content...",
    progress: 80,
  },
  formatting: {
    label: "Compiling Binary Document",
    detail: "Applying native specifications and binary formatting...",
    progress: 92,
  },
  validating: {
    label: "Quality & Integrity Verification",
    detail: "Verifying binary checksum & document structure...",
    progress: 98,
  },
  completed: {
    label: "Document Created Successfully",
    detail: "Ready for download and preview.",
    progress: 100,
  },
  error: {
    label: "Generation Interrupted",
    detail: "Document compilation could not be completed. You can try again.",
    progress: 100,
  },
};

const FORMAT_CONFIGS: Record<
  string,
  {
    icon: typeof FileText;
    label: string;
    ext: string;
  }
> = {
  pdf: {
    icon: FileText,
    label: "PDF Document",
    ext: "PDF",
  },
  docx: {
    icon: FileText,
    label: "Word Document",
    ext: "DOCX",
  },
  xlsx: {
    icon: FileSpreadsheet,
    label: "Excel Spreadsheet",
    ext: "XLSX",
  },
  pptx: {
    icon: Presentation,
    label: "PowerPoint Presentation",
    ext: "PPTX",
  },
  txt: {
    icon: FileText,
    label: "Text File",
    ext: "TXT",
  },
  md: {
    icon: FileCode,
    label: "Markdown Document",
    ext: "MD",
  },
};

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

type FileCreationCardProps = {
  stage: FileCreationStage;
  format?: DocFormat;
  filename?: string;
  fileUrl?: string;
  fileMimeType?: string;
  fileSizeBytes?: number;
  onRetry?: () => void;
};

export const FileCreationCard = memo(function FileCreationCard({
  stage,
  format = "pdf",
  filename,
  fileUrl,
  fileMimeType,
  fileSizeBytes,
  onRetry,
}: FileCreationCardProps) {
  const [copied, setCopied] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  const isProcessing = stage !== "completed" && stage !== "error";
  const config = FORMAT_CONFIGS[format] || FORMAT_CONFIGS.pdf;
  const Icon = config.icon;
  const stageInfo = STAGE_CONFIG[stage] || STAGE_CONFIG.analyzing;

  // Track creation time during processing
  useEffect(() => {
    if (!isProcessing) return;
    const interval = setInterval(() => {
      setElapsedSeconds(prev => prev + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [isProcessing]);

  const displayName =
    filename || `${config.label.replace(/\sDocument|\sFile|\sSpreadsheet|\sPresentation/g, "")}_Generated.${format}`;

  const cleanDocTitle = filename
    ? filename.replace(/\.[^/.]+$/, "").replace(/[-_]/g, " ")
    : config.label;

  const handleCopyLink = async () => {
    if (!fileUrl) return;
    try {
      const fullUrl = fileUrl.startsWith("http") ? fileUrl : `${window.location.origin}${fileUrl}`;
      await navigator.clipboard.writeText(fullUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard fallback
    }
  };

  const getStageIndex = (s: string) => {
    return STAGES_PIPELINE.findIndex(p => p.id === s);
  };
  const currentPipelineIdx = getStageIndex(stage);

  return (
    <div
      id={`ksemo-file-card-${stage}`}
      className={cn(
        "my-3 w-full max-w-2xl overflow-hidden rounded-xl border border-border bg-card text-card-foreground shadow-xs transition-all",
        isProcessing && "shadow-sm",
        stage === "error" && "border-destructive/30 bg-destructive/5"
      )}
    >
      {/* ------------------------------------------------------------- */}
      {/* 1. In-Progress Live Generation View                            */}
      {/* ------------------------------------------------------------- */}
      {isProcessing && (
        <div className="p-4 sm:p-5">
          {/* Header row */}
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted text-foreground font-semibold text-xs border border-border">
                <Icon className="size-4" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h4 className="text-sm font-semibold tracking-tight text-foreground truncate">
                    {cleanDocTitle}
                  </h4>
                  <span className="shrink-0 rounded border border-border bg-muted/70 px-1.5 py-0.5 text-[10px] font-semibold tracking-wider text-muted-foreground uppercase">
                    {config.ext}
                  </span>
                </div>
              </div>
            </div>

            {/* Elapsed Timer */}
            <div className="flex items-center gap-1.5 shrink-0 rounded-full border border-border bg-secondary/60 px-2.5 py-1 text-[11px] font-medium text-muted-foreground">
              <span className="size-1.5 animate-pulse rounded-full bg-primary" />
              <span>Compiling · {elapsedSeconds}s</span>
            </div>
          </div>

          {/* Stepper Pipeline */}
          <div className="mt-4 grid grid-cols-6 gap-1 border-t border-border pt-3">
            {STAGES_PIPELINE.map((p, idx) => {
              const isPast = currentPipelineIdx > idx;
              const isCurrent = currentPipelineIdx === idx;
              return (
                <div key={p.id} className="flex flex-col items-center text-center">
                  <div
                    className={cn(
                      "flex size-6 items-center justify-center rounded-full text-[10px] font-semibold transition-all",
                      isPast && "bg-primary text-primary-foreground",
                      isCurrent && "border-2 border-primary bg-card text-foreground shadow-xs",
                      !isPast && !isCurrent && "bg-muted text-muted-foreground"
                    )}
                  >
                    {isPast ? (
                      <Check className="size-3" />
                    ) : isCurrent ? (
                      <Loader2 className="size-3 animate-spin text-primary" />
                    ) : (
                      <span>{idx + 1}</span>
                    )}
                  </div>
                  <span
                    className={cn(
                      "mt-1 text-[10px] truncate max-w-[55px]",
                      isCurrent ? "font-semibold text-foreground" : "text-muted-foreground"
                    )}
                  >
                    {p.label}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Dynamic Progress Bar */}
          <div className="mt-3.5 space-y-1.5">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span className="font-medium text-foreground flex items-center gap-1.5">
                <Sparkles className="size-3 text-primary animate-pulse" />
                {stageInfo.label}
              </span>
              <span className="font-mono text-[11px] font-medium">
                {stageInfo.progress}%
              </span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
              <div
                className="h-full bg-primary transition-all duration-500 ease-out"
                style={{ width: `${stageInfo.progress}%` }}
              />
            </div>
            <p className="text-[11px] text-muted-foreground truncate">
              {stageInfo.detail}
            </p>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* 2. Completed State Display                                    */}
      {/* ------------------------------------------------------------- */}
      {stage === "completed" && (
        <div className="p-4 sm:p-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            {/* File Info */}
            <div className="flex items-start gap-3.5 min-w-0">
              <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-muted text-foreground border border-border shadow-2xs">
                <Icon className="size-5" />
              </div>

              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h4 className="text-sm font-semibold tracking-tight text-foreground truncate max-w-[280px] sm:max-w-[360px]">
                    {displayName}
                  </h4>
                  <span className="rounded border border-border bg-secondary/80 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    {config.ext}
                  </span>
                </div>

                <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  {fileSizeBytes ? (
                    <span className="font-mono">{formatFileSize(fileSizeBytes)}</span>
                  ) : null}
                  {fileSizeBytes ? <span>·</span> : null}
                  <span>{config.label}</span>
                  <span>·</span>
                  <span className="inline-flex items-center gap-1 font-medium text-foreground">
                    <CheckCircle2 className="size-3.5 text-primary" /> Generated
                  </span>
                </div>
              </div>
            </div>

            {/* Quick Primary Actions */}
            {fileUrl && (
              <div className="flex items-center gap-2 shrink-0">
                <a
                  id="ksemo-download-file-btn"
                  href={fileUrl}
                  download={filename || `document.${format}`}
                  className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-primary px-3.5 py-2 text-xs font-semibold text-primary-foreground shadow-xs transition hover:bg-primary/90 active:scale-[0.98]"
                >
                  <Download className="size-3.5" />
                  Download
                </a>

                <a
                  id="ksemo-preview-file-btn"
                  href={fileUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-xs font-medium text-foreground transition hover:bg-muted active:scale-[0.98]"
                  title="Open file in new tab"
                >
                  <ExternalLink className="size-3.5 text-muted-foreground" />
                  Preview
                </a>

                <button
                  type="button"
                  onClick={handleCopyLink}
                  className="inline-flex items-center justify-center rounded-lg border border-border bg-card p-2 text-foreground transition hover:bg-muted active:scale-[0.98]"
                  title={copied ? "Copied!" : "Copy link to clipboard"}
                  aria-label="Copy file link"
                >
                  {copied ? (
                    <Check className="size-3.5 text-primary" />
                  ) : (
                    <Copy className="size-3.5 text-muted-foreground" />
                  )}
                </button>
              </div>
            )}
          </div>

          {/* Expandable Technical Details */}
          <div className="mt-3.5 border-t border-border pt-2.5">
            <button
              type="button"
              onClick={() => setDetailsOpen(prev => !prev)}
              className="inline-flex items-center gap-1 text-[11px] font-medium text-muted-foreground transition hover:text-foreground"
            >
              {detailsOpen ? (
                <ChevronDown className="size-3" />
              ) : (
                <ChevronRight className="size-3" />
              )}
              {detailsOpen ? "Hide File Details" : "Show File Details"}
            </button>

            {detailsOpen && (
              <div className="mt-2.5 rounded-lg border border-border bg-muted/30 p-3 text-xs space-y-1.5 text-muted-foreground">
                <div className="flex justify-between">
                  <span>File Name:</span>
                  <span className="font-mono text-foreground font-medium">{displayName}</span>
                </div>
                <div className="flex justify-between">
                  <span>Format:</span>
                  <span className="uppercase text-foreground font-medium">{format}</span>
                </div>
                {fileMimeType && (
                  <div className="flex justify-between">
                    <span>MIME Type:</span>
                    <span className="font-mono text-foreground">{fileMimeType}</span>
                  </div>
                )}
                {fileSizeBytes && (
                  <div className="flex justify-between">
                    <span>File Size:</span>
                    <span className="font-mono text-foreground">{formatFileSize(fileSizeBytes)}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span>Storage:</span>
                  <span className="text-foreground">Secure Persistent Workspace</span>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* 3. Error State View                                           */}
      {/* ------------------------------------------------------------- */}
      {stage === "error" && (
        <div className="p-4 sm:p-5">
          <div className="flex items-start gap-3">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-destructive/10 text-destructive">
              <AlertCircle className="size-5" />
            </div>
            <div className="flex-1 min-w-0">
              <h4 className="text-sm font-semibold text-destructive">
                Document Generation Failed
              </h4>
              <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
                Could not compile the binary document specification. Please verify the prompt and try again.
              </p>
              {onRetry && (
                <button
                  type="button"
                  onClick={onRetry}
                  className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-semibold text-foreground transition hover:bg-muted"
                >
                  <RotateCw className="size-3" />
                  Try Again
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
});
