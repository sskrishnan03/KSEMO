import type { ComponentType } from "react";
import {
  ArchiveFileIcon,
  AudioFileIcon,
  CodeFileIcon,
  ExcelFileIcon,
  GenericFileIcon,
  ImageFileIcon,
  PdfFileIcon,
  PowerPointFileIcon,
  TextFileIcon,
  VideoFileIcon,
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
    /(spreadsheetml\.sheet$|excel$|officedocument\.spreadsheetml|csv|tab-separated-values)/.test(mime) ||
    /\.(xlsx|xls|csv|tsv)$/i.test(name)
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
  if (/^audio\//.test(mime) || /\.(mp3|wav|m4a|ogg|webm|aac|flac)$/i.test(name)) {
    return { label: "Audio", icon: AudioFileIcon, colorClass: "" };
  }
  if (/^video\//.test(mime) || /\.(mp4|mov|avi|mkv)$/i.test(name)) {
    return { label: "Video", icon: VideoFileIcon, colorClass: "" };
  }
  if (/\.(md|markdown)$/i.test(name) || /markdown/.test(mime)) {
    return { label: "Markdown", icon: TextFileIcon, colorClass: "" };
  }
  if (
    /\.(ts|tsx|js|jsx|py|go|rs|java|c|cpp|h|hpp|cs|rb|php|sql|sh|html|css|json|xml|yml|yaml)$/i.test(name) ||
    /json$/.test(mime)
  ) {
    return { label: "Code", icon: CodeFileIcon, colorClass: "" };
  }
  if (
    /text\//.test(mime) ||
    /\.(txt|log|ini|env|conf|toml)$/i.test(name)
  ) {
    return { label: "Text", icon: TextFileIcon, colorClass: "" };
  }
  return { label: "File", icon: GenericFileIcon, colorClass: "" };
}