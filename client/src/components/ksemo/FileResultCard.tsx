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
  FileCode2,
  Download,
  CheckCircle2,
  Loader2,
  AlertCircle,
} from "lucide-react";
import { type FileFormat } from "@shared/research";

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

const FILE_TYPE_CONFIG: Record<FileFormat, { icon: typeof FileOutput; color: string; bgClass: string; label: string }> = {
  pdf: { icon: FileOutput, color: "text-red-500", bgClass: "bg-red-500/10", label: "PDF" },
  docx: { icon: FileText, color: "text-blue-600", bgClass: "bg-blue-500/10", label: "Word" },
  xlsx: { icon: FileSpreadsheet, color: "text-emerald-600", bgClass: "bg-emerald-500/10", label: "Excel" },
  pptx: { icon: Presentation, color: "text-orange-500", bgClass: "bg-orange-500/10", label: "PowerPoint" },
  txt: { icon: FileText, color: "text-slate-500", bgClass: "bg-slate-500/10", label: "Text" },
  md: { icon: FileCode2, color: "text-indigo-500", bgClass: "bg-indigo-500/10", label: "Markdown" },
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
      <div className={`flex size-12 shrink-0 items-center justify-center rounded-lg ${config.bgClass}`}>
        <Icon className={`size-6 ${config.color}`} />
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
            <span className="flex items-center gap-1 text-xs text-green-600">
              <CheckCircle2 className="size-3" />
              Created successfully
            </span>
          )}
          {file.status === "generating" && (
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <Loader2 className="size-3 animate-spin" />
              Generating...
            </span>
          )}
          {file.status === "error" && (
            <span className="flex items-center gap-1 text-xs text-red-600">
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