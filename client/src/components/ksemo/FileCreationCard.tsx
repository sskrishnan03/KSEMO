import type { DocFormat } from "@/lib/docFormats";
import {
  AlertCircle,
  ArrowDownToLine,
  ExternalLink,
  FileCode,
  FileSpreadsheet,
  FileText,
  Loader2,
  Presentation,
  RotateCw,
} from "lucide-react";
import { memo } from "react";

export type FileCreationStage =
  | "analyzing"
  | "researching"
  | "planning"
  | "content_generated"
  | "formatting"
  | "validating"
  | "completed"
  | "error";

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
    label: "PDF",
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
  fileSizeBytes,
  onRetry,
}: FileCreationCardProps) {
  const isProcessing = stage !== "completed" && stage !== "error";
  const config = FORMAT_CONFIGS[format] || FORMAT_CONFIGS.pdf;
  const Icon = config.icon;
  const displayName =
    filename || `${config.label.replace(/\s/g, "_")}.${config.ext.toLowerCase()}`;

  if (stage === "error") {
    return (
      <div
        id={`ksemo-file-card-${stage}`}
        className="my-1.5 flex w-full max-w-2xl items-start gap-2.5 rounded-xl border border-destructive/30 bg-destructive/5 p-3.5"
      >
        <AlertCircle className="mt-0.5 size-4 shrink-0 text-destructive" />
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-semibold text-foreground">
            Couldn't create the {config.label.toLowerCase()} file.
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Please adjust the prompt and try again.
          </p>
          {onRetry && (
            <button
              type="button"
              onClick={onRetry}
              className="mt-2 inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-2.5 py-1.5 text-xs font-medium text-foreground transition hover:bg-muted"
            >
              <RotateCw className="size-3" />
              Try Again
            </button>
          )}
        </div>
      </div>
    );
  }

  if (isProcessing) {
    return (
      <div
        id={`ksemo-file-card-${stage}`}
        className="my-1.5 flex w-full max-w-2xl items-center gap-2.5 py-1.5 text-sm text-muted-foreground"
      >
        <Loader2 className="size-4 shrink-0 animate-spin" />
        <span>Creating {config.label.toLowerCase()} file…</span>
      </div>
    );
  }

  return (
    <div
      id={`ksemo-file-card-${stage}`}
      className="my-1.5 flex w-full max-w-2xl flex-wrap items-center gap-x-3.5 gap-y-2 rounded-xl border border-border bg-card p-3"
    >
      <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-foreground">
        <Icon className="size-4" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[13px] font-semibold text-foreground">
          {displayName}
        </p>
        <p className="mt-0.5 flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <span className="uppercase tracking-wide">{config.ext}</span>
          {fileSizeBytes != null && (
            <>
              <span aria-hidden>·</span>
              <span>{formatFileSize(fileSizeBytes)}</span>
            </>
          )}
          <span aria-hidden>·</span>
          <span>Ready</span>
        </p>
      </div>
      {fileUrl && (
        <div className="flex shrink-0 items-center gap-1.5">
          <a
            id="ksemo-download-file-btn"
            href={fileUrl}
            download={filename || `document.${format}`}
            className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground transition hover:bg-primary/90"
          >
            <ArrowDownToLine className="size-3.5" />
            Download
          </a>
          <a
            id="ksemo-preview-file-btn"
            href={fileUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-2.5 py-1.5 text-xs font-medium text-foreground transition hover:bg-muted"
          >
            <ExternalLink className="size-3.5" />
            Preview
          </a>
        </div>
      )}
    </div>
  );
});