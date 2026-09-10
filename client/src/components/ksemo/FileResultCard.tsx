/**
 * FileResultCard - A premium component for displaying generated files in the conversation.
 * 
 * This component renders a file card with:
 * - File icon
 * - File name
 * - File type
 * - File size
 * - Creation status
 * - Download action
 */

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  FileOutput,
  FileText,
  FileSpreadsheet,
  Presentation,
  Download,
  CheckCircle2,
  Loader2,
  AlertCircle,
} from "lucide-react";
import { type FileFormat } from "@shared/capabilities";

export interface FileResult {
  filename: string;
  mimeType: string;
  size: number;
  downloadUrl?: string;
  status: "generating" | "completed" | "error";
  error?: string;
}

interface FileResultCardProps {
  file: FileResult;
  onDownload?: () => void;
  className?: string;
}

const FILE_TYPE_CONFIG: Record<FileFormat, { icon: typeof FileOutput; label: string }> = {
  pdf: { icon: FileOutput, label: "PDF" },
  docx: { icon: FileText, label: "Word" },
  xlsx: { icon: FileSpreadsheet, label: "Excel" },
  pptx: { icon: Presentation, label: "PowerPoint" },
  txt: { icon: FileText, label: "Text" },
};

function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${Math.round((bytes / Math.pow(k, i)) * 100) / 100} ${sizes[i]}`;
}

function getFileFormat(filename: string): FileFormat {
  const ext = filename.split('.').pop()?.toLowerCase() || "txt";
  return (ext in FILE_TYPE_CONFIG ? ext : "txt") as FileFormat;
}

export function FileResultCard({ file, onDownload, className }: FileResultCardProps) {
  const format = getFileFormat(file.filename);
  const config = FILE_TYPE_CONFIG[format];
  const Icon = config.icon;

  return (
    <div
      className={cn(
        "group flex items-center gap-4 rounded-xl border border-border bg-card p-4 shadow-sm transition-all hover:shadow-md",
        className
      )}
    >
      {/* File Icon */}
      <div className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-muted text-foreground border border-border">
        <Icon className="size-5" />
      </div>

      {/* File Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold text-foreground truncate">
            {file.filename}
          </h3>
          <span className="shrink-0 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {config.label}
          </span>
        </div>
        <div className="flex items-center gap-2 mt-1">
          <span className="text-xs text-muted-foreground">
            {formatFileSize(file.size)}
          </span>
          {file.status === "completed" && (
            <span className="flex items-center gap-1 text-xs text-foreground font-medium">
              <CheckCircle2 className="size-3 text-primary" />
              Generated
            </span>
          )}
          {file.status === "generating" && (
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <Loader2 className="size-3 animate-spin text-primary" />
              Compiling...
            </span>
          )}
          {file.status === "error" && (
            <span className="flex items-center gap-1 text-xs text-destructive">
              <AlertCircle className="size-3" />
              {file.error || "Failed to create file"}
            </span>
          )}
        </div>
      </div>

      {/* Download Button */}
      {file.status === "completed" && onDownload && (
        <Button
          variant="ghost"
          size="sm"
          onClick={onDownload}
          className="shrink-0 gap-2"
        >
          <Download className="size-4" />
          Download
        </Button>
      )}
    </div>
  );
}