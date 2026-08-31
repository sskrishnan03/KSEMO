import { cn } from "@/lib/utils";
import { getDocFormatOption, type DocFormat } from "@/lib/docFormats";
import { Check, Loader2 } from "lucide-react";
import React, { memo, useEffect, useState } from "react";

type FileCreationStage =
  | "understanding"
  | "analyzing"
  | "researching"
  | "planning"
  | "generating"
  | "formatting"
  | "validating"
  | "completed"
  | "error";

const STAGE_LABELS: Record<FileCreationStage, string> = {
  understanding: "Understanding your request",
  analyzing: "Analyzing requirements",
  researching: "Researching relevant information",
  planning: "Planning document structure",
  generating: "Generating complete content",
  formatting: "Formatting the file",
  validating: "Validating the final file",
  completed: "File created successfully",
  error: "File creation could not be completed",
};

const PROCESSING_STAGES: FileCreationStage[] = [
  "understanding",
  "analyzing",
  "researching",
  "planning",
  "generating",
  "formatting",
  "validating",
];

function stageIndex(stage: FileCreationStage): number {
  return PROCESSING_STAGES.indexOf(stage);
}

type FileCreationCardProps = {
  stage: FileCreationStage;
  format: DocFormat;
  filename?: string;
  fileUrl?: string;
  fileMimeType?: string;
  fileSizeBytes?: number;
  onRetry?: () => void;
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

export const FileCreationCard = memo(function FileCreationCard({
  stage,
  format,
  filename,
  fileUrl,
  fileMimeType,
  fileSizeBytes,
  onRetry,
}: FileCreationCardProps) {
  const [visibleStages, setVisibleStages] = useState<FileCreationStage[]>([]);
  const [elapsedStage, setElapsedStage] = useState(0);
  const option = getDocFormatOption(format);
  const Icon = option.icon;
  const isProcessing = stage !== "completed" && stage !== "error";
  const currentIdx = isProcessing ? stageIndex(stage) : -1;

  // During processing the server may only emit a couple of coarse events
  // ("detecting", "generating"). To keep the card feeling intelligent and
  // transparent we advance through the pipeline stages on a gentle timer so
  // the user sees real progress even between server events.
  useEffect(() => {
    if (!isProcessing) {
      setElapsedStage(0);
      return;
    }
    const startedAt = performance.now();
    const interval = window.setInterval(() => {
      const elapsed = Math.floor((performance.now() - startedAt) / 800);
      setElapsedStage(Math.min(elapsed, PROCESSING_STAGES.length - 1));
    }, 200);
    return () => window.clearInterval(interval);
  }, [stage, isProcessing]);

  useEffect(() => {
    if (isProcessing) {
      const idx = stageIndex(stage);
      if (idx >= 0 && !visibleStages.includes(stage)) {
        setVisibleStages(prev => [...prev, stage]);
      }
    }
  }, [stage, isProcessing]);

  useEffect(() => {
    if (stage === "completed" || stage === "error") {
      setVisibleStages(prev => {
        if (prev.includes(stage)) return prev;
        return [...prev, stage];
      });
    }
  }, [stage]);

  const displayName =
    filename?.replace(/\.[^.]+$/, "").replace(/[-_]/g, " ") || "Document";

  return (
    <div
      className={cn(
        "mx-auto w-full max-w-3xl rounded-2xl border border-border bg-card px-5 py-4 shadow-sm",
        "animate-[ksemo-card-enter_300ms_ease-out]"
      )}
    >
      {/* Header */}
      <div className="mb-3 flex items-center gap-2.5">
        {isProcessing ? (
          <Loader2 className="size-4 shrink-0 animate-spin text-muted-foreground" />
        ) : stage === "completed" ? (
          <span className="flex size-4 shrink-0 items-center justify-center rounded-full bg-emerald-500/10">
            <Check className="size-3 text-emerald-600 dark:text-emerald-400" />
          </span>
        ) : (
          <span className="flex size-4 shrink-0 items-center justify-center rounded-full bg-destructive/10">
            <span className="size-1.5 rounded-full bg-destructive" />
          </span>
        )}
        <span
          className={cn(
            "text-sm font-semibold tracking-[-0.01em]",
            stage === "completed"
              ? "text-emerald-600 dark:text-emerald-400"
              : stage === "error"
                ? "text-destructive"
                : "text-foreground"
          )}
        >
          {stage === "completed"
            ? `${option.label} Ready`
            : stage === "error"
              ? "File Creation Could Not Be Completed"
              : `Creating ${option.label}`}
        </span>
      </div>

      {/* Request summary */}
      <p className="mb-3 truncate text-[13px] text-muted-foreground">
        {displayName}
      </p>

      {/* Stage list */}
      {(isProcessing || stage === "completed") && (
        <div className="space-y-1.5">
          {PROCESSING_STAGES.map((s, i) => {
            const isVisible =
              i <= currentIdx ||
              i <= elapsedStage ||
              visibleStages.includes(s);
            const isCompleted =
              (stage === "completed" && i <= stageIndex("validating")) ||
              (isProcessing &&
                i < Math.max(currentIdx, elapsedStage));
            const isCurrent =
              isProcessing && i === Math.max(currentIdx, elapsedStage);
            if (!isVisible && !isCompleted && !isCurrent) return null;
            return (
              <div key={s} className="flex items-center gap-2">
                {isCompleted ? (
                  <Check className="size-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
                ) : isCurrent ? (
                  <span className="relative flex size-3.5 shrink-0 items-center justify-center">
                    <span className="absolute inline-flex size-full animate-ping rounded-full bg-primary/20" />
                    <span className="relative size-1.5 rounded-full bg-primary" />
                  </span>
                ) : (
                  <span className="size-3.5 shrink-0 rounded-full border border-border" />
                )}
                <span
                  className={cn(
                    "text-[13px] leading-none",
                    isCompleted
                      ? "text-foreground/70"
                      : isCurrent
                        ? "text-foreground font-medium"
                        : "text-muted-foreground"
                  )}
                >
                  {STAGE_LABELS[s]}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {/* Error state */}
      {stage === "error" && (
        <div className="mt-2 space-y-3">
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

      {/* Completion metadata */}
      {stage === "completed" && (
        <div className="mt-3 flex items-center gap-2 border-t border-border pt-3">
          <Icon className={`size-3.5 shrink-0 ${option.iconColor}`} />
          <span className="text-[12px] text-muted-foreground">
            {displayName}
            {fileSizeBytes ? ` · ${formatFileSize(fileSizeBytes)}` : ""}
            {" · "}
            <span className="text-emerald-600 dark:text-emerald-400 font-medium">
              Validated
            </span>
          </span>
          {fileUrl && (
            <a
              href={fileUrl}
              download={filename}
              className="ml-auto rounded-lg bg-foreground px-3 py-1 text-[12px] font-medium text-background transition-opacity hover:opacity-90"
            >
              Download
            </a>
          )}
        </div>
      )}
    </div>
  );
});
