import type { ComponentType } from "react";
import {
  File,
  FileArchive,
  FileImage,
  FileSpreadsheet,
  FileText,
  Presentation,
} from "lucide-react";

export type FileKind = {
  label: string;
  icon: ComponentType<{ className?: string }>;
  colorClass: string;
};

export const IMAGE_EXT = /\.(png|jpe?g|webp|gif|bmp|svg|avif)$/i;

export function getFileKind(name: string, mimeType?: string): FileKind {
  const mime = (mimeType ?? "").toLowerCase();
  if (/pdf$/.test(mime) || /\.pdf$/i.test(name)) {
    return {
      label: "PDF",
      icon: FileText,
      colorClass: "bg-red-500/10 text-red-500",
    };
  }
  if (
    /(spreadsheetml\.sheet$|excel$|officedocument\.spreadsheetml)/.test(mime) ||
    /\.(xlsx|xls|csv|tsv)$/i.test(name)
  ) {
    return {
      label: "Sheet",
      icon: FileSpreadsheet,
      colorClass: "bg-emerald-500/10 text-emerald-500",
    };
  }
  if (/(ppt|presentationml)/.test(mime) || /\.pptx?$/i.test(name)) {
    return {
      label: "Slides",
      icon: Presentation,
      colorClass: "bg-orange-500/10 text-orange-500",
    };
  }
  if (
    /(wordprocessingml|document$|msword)/.test(mime) ||
    /\.docx?$/i.test(name)
  ) {
    return { label: "Word", icon: FileText, colorClass: "bg-blue-500/10 text-blue-500" };
  }
  if (/zip|compressed|tar|gzip/.test(mime) || /\.(zip|rar|7z|tar|gz)$/i.test(name)) {
    return {
      label: "Archive",
      icon: FileArchive,
      colorClass: "bg-amber-500/10 text-amber-500",
    };
  }
  if (/^image\//.test(mime) || IMAGE_EXT.test(name)) {
    return {
      label: "Image",
      icon: FileImage,
      colorClass: "bg-violet-500/10 text-violet-500",
    };
  }
  if (
    /text\//.test(mime) ||
    /\.(txt|md|markdown|json|log|xml|yml|yaml)$/i.test(name)
  ) {
    return { label: "Text", icon: FileText, colorClass: "bg-slate-500/10 text-slate-500" };
  }
  return { label: "File", icon: File, colorClass: "bg-muted text-muted-foreground" };
}