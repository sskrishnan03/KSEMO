import { cn } from "@/lib/utils";
import { getDocFormatOption, type DocFormat } from "@/lib/docFormats";
import {
  Check,
  ChevronDown,
  ChevronRight,
  Loader2,
  ShieldCheck,
} from "lucide-react";
import React, { memo, useState } from "react";

export type FileCreationStage =
  | "analyzing"
  | "researching"
  | "planning"
  | "content_generated"
  | "formatting"
  | "validating"
  | "completed"
  | "error";

const STAGE_LABELS: Record<string, string> = {
  analyzing: "Analyzing your request",
  researching: "Researching information",
  planning: "Planning document structure",
  content_generated: "Generating complete content",
  formatting: "Formatting the file",
  validating: "Validating the final file",
  completed: "File created successfully",
  error: "File creation could not be completed",
};

const PROCESSING_STAGES: string[] = [
  "analyzing",
  "researching",
  "planning",
  "content_generated",
  "formatting",
  "validating",
];

function stageIndex(stage: string): number {
  return PROCESSING_STAGES.indexOf(stage);
}

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

// The full creation history shown when the completed card is expanded: each
// stage plus its verified completion status.
const FULL_HISTORY: Array<{ stage: string; label: string }> = [
  { stage: "analyzing", label: "Request analyzed" },
  { stage: "researching", label: "Research completed" },
  { stage: "planning", label: "Document structure created" },
  { stage: "content_generated", label: "Content generated" },
  { stage: "formatting", label: "File formatted" },
  { stage: "validating", label: "Final validation completed" },
];

const FORMAT_LABELS: Record<string, string> = {
  pdf: "PDF",
  docx: "Word Document",
  xlsx: "Excel Spreadsheet",
  pptx: "PowerPoint Presentation",
  txt: "Text File",
};

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
  format,
  filename,
  fileUrl,
  fileMimeType,
  fileSizeBytes,
  onRetry,
}: FileCreationCardProps) {
  const [expanded, setExpanded] = useState(false);
  const option = getDocFormatOption(format ?? "pdf");
  const Icon = option.icon;
  const isProcessing = stage !== "completed" && stage !== "error";
  const currentIdx = isProcessing ? stageIndex(stage) : -1;
  const requestedLabel = format
    ? (FORMAT_LABELS[format] ?? format.toUpperCase())
    : option.label;

  const displayName =
    filename?.replace(/\.[^.]+$/, "").replace(/[-_]/g, " ") || "Document";

  return (
    <div
      className={cn(
        "mx-auto w-full max-w-3xl overflow-hidden rounded-2xl border border-border bg-card shadow-sm",
        "animate-[ksemo-card-enter_300ms_ease-out]"
      )}
    >
      {/* ---- Header ---- */}
      <div className="flex items-center gap-3 px-4 py-3">
        {isProcessing ? (
          <span className="relative flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Icon className="size-4" />
          </span>
        ) : stage === "completed" ? (
          <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
            <Check className="size-4" />
          </span>
        ) : (
          <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-destructive/10 text-destructive">
            <Icon className="size-4" />
          </span>
        )}
        <div className="min-w-0 flex-1">
          <div
            className={cn(
              "truncate text-[15px] font-semibold tracking-[-0.01em]",
              stage === "completed"
                ? "text-emerald-600 dark:text-emerald-400"
                : stage === "error"
                  ? "text-destructive"
                  : "text-foreground"
            )}
          >
            {stage === "completed"
              ? `${FILENAME_READY_LABEL(requestedLabel)}`
              : stage === "error"
                ? "File Creation Could Not Be Completed"
                : `Creating ${requestedLabel}`}
          </div>
          <p className="truncate text-[12px] text-muted-foreground">
            {displayName}
          </p>
        </div>
        {stage === "completed" && fileUrl && (
          <a
            href={fileUrl}
            download={filename}
            className="shrink-0 rounded-lg bg-foreground px-3 py-1.5 text-[12px] font-medium text-background transition-opacity hover:opacity-90"
          >
            Download
          </a>
        )}
      </div>

      {/* ---- In-progress stages ---- */}
      {isProcessing && (
        <div className="border-t border-border px-4 py-3">
          <div className="space-y-2.5">
            {PROCESSING_STAGES.map((s, i) => {
              const isCompletedStage = i < currentIdx;
              const isCurrentStage = i === currentIdx;
              if (!isCompletedStage && !isCurrentStage) {
                // Up next: render a muted dot without text to keep the list compact
                return (
                  <div key={s} className="flex items-center gap-2.5 opacity-40">
                    <span className="size-2 shrink-0 rounded-full border border-muted-foreground/40" />
                    <span className="text-[12px] text-muted-foreground">
                      {STAGE_LABELS[s]}
                    </span>
                  </div>
                );
              }
              return (
                <div key={s} className="flex items-center gap-2.5">
                  {isCompletedStage ? (
                    <Check className="size-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                  ) : (
                    <Loader2 className="size-4 shrink-0 animate-spin text-primary" />
                  )}
                  <span
                    className={cn(
                      "text-[13px]",
                      isCompletedStage
                        ? "text-foreground/70"
                        : "font-semibold text-foreground"
                    )}
                  >
                    {STAGE_LABELS[s]}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ---- Completed: compact summary ---- */}
      {stage === "completed" && (
        <>
          <div className="border-t border-border px-4 py-3">
            <div className="flex items-center gap-2">
              <ShieldCheck className="size-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
              <span className="text-[13px] text-foreground/80">
                Complete and validated
              </span>
              {fileSizeBytes ? (
                <span className="text-[12px] text-muted-foreground">
                  · {formatFileSize(fileSizeBytes)}
                </span>
              ) : null}
            </div>
          </div>
          <button
            type="button"
            onClick={() => setExpanded(e => !e)}
            className="flex w-full items-center justify-between border-t border-border bg-muted/40 px-4 py-2 text-left transition-colors hover:bg-accent/40"
          >
            <span className="text-[12px] font-medium text-muted-foreground">
              {expanded ? (
                <>
                  <ChevronDown className="mr-1.5 inline size-3.5" />
                  Collapse details
                </>
              ) : (
                <>
                  <ChevronRight className="mr-1.5 inline size-3.5" />
                  Expand details
                </>
              )}
            </span>
            <span className="flex items-center gap-1.5 text-[12px] text-emerald-600 dark:text-emerald-400">
              <Check className="size-3.5" />
              Passed validation
            </span>
          </button>
          {expanded && (
            <div className="border-t border-border px-4 py-3">
              <div className="space-y-2">
                {FULL_HISTORY.map(item => (
                  <div key={item.stage} className="flex items-center gap-2.5">
                    <Check className="size-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
                    <span className="flex-1 text-[13px] text-foreground/80">
                      {item.label}
                    </span>
                    <span className="text-[11px] font-medium uppercase tracking-wide text-emerald-600/80 dark:text-emerald-400/80">
                      Completed
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* ---- Error state ---- */}
      {stage === "error" && (
        <div className="space-y-3 border-t border-border px-4 py-3">
          <p className="text-[13px] text-muted-foreground">
            The requested file was not successfully generated and no incomplete
            file was delivered.
          </p>
          {onRetry && (
            <button
              onClick={onRetry}
              className="rounded-xl border border-border bg-muted px-4 py-1.5 text-[13px] font-medium text-foreground transition-colors hover:bg-accent"
            >
              Try Again
            </button>
          )}
        </div>
      )}
    </div>
  );
});

function FILENAME_READY_LABEL(label: string): string {
  return `${label} Ready`;
}
