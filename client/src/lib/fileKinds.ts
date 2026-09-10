import type { ComponentType } from "react";
import {
  ArchiveFileIcon,
  CodeFileIcon,
  ExcelFileIcon,
  GenericFileIcon,
  ImageFileIcon,
  PdfFileIcon,
  PowerPointFileIcon,
  TextFileIcon,
  WordFileIcon,
} from "@/components/ksemo/FileBrandIcons";

export type FileKind = {
  label: string;
  icon: ComponentType<{ className?: string }>;
  colorClass: string;
};

export const IMAGE_EXT = /\.(png|jpe?g|webp|gif|bmp|svg|avif)$/i;

export function getFileKind(name: string, mimeType?: string): FileKind {
  const mime = (mimeType ?? "").toLowerCase();
  if (/pdf$/.test(mime) || /\.pdf$/i.test(name)) {
    return { label: "PDF", icon: PdfFileIcon, colorClass: "" };
  }
  if (
    /(spreadsheetml\.sheet$|excel$|officedocument\.spreadsheetml)/.test(mime) ||
    /\.(xlsx|xls|tsv)$/i.test(name)
  ) {
    return { label: "Sheet", icon: ExcelFileIcon, colorClass: "" };
  }
  if (/(ppt|presentationml)/.test(mime) || /\.pptx?$/i.test(name)) {
    return { label: "Slides", icon: PowerPointFileIcon, colorClass: "" };
  }
  if (
    /(wordprocessingml|document$|msword)/.test(mime) ||
    /\.docx?$/i.test(name)
  ) {
    return { label: "Word", icon: WordFileIcon, colorClass: "" };
  }
  if (/zip|compressed|tar|gzip/.test(mime) || /\.(zip|rar|7z|tar|gz)$/i.test(name)) {
    return { label: "Archive", icon: ArchiveFileIcon, colorClass: "" };
  }
  if (/^image\//.test(mime) || IMAGE_EXT.test(name)) {
    return { label: "Image", icon: ImageFileIcon, colorClass: "" };
  }
  if (
    /text\//.test(mime) ||
    /\.(txt|json|log|xml|yml|yaml)$/i.test(name)
  ) {
    return { label: "Text", icon: TextFileIcon, colorClass: "" };
  }
  if (
    /\.(ts|tsx|js|jsx|py|go|rs|java|c|cpp|html|css|sql)$/i.test(name) ||
    /json$/.test(mime)
  ) {
    return { label: "Code", icon: CodeFileIcon, colorClass: "" };
  }
  return { label: "File", icon: GenericFileIcon, colorClass: "" };
}