import {
  FileCode2,
  FileSpreadsheet,
  FileText,
  type LucideIcon,
} from "lucide-react";

export type FileVisual = {
  Icon: LucideIcon;
  className: string;
};

const EXT_VISUALS: Record<string, FileVisual> = {
  pdf: { Icon: FileText, className: "text-red-500" },
  doc: { Icon: FileText, className: "text-blue-500" },
  docx: { Icon: FileText, className: "text-blue-500" },
  xls: { Icon: FileSpreadsheet, className: "text-emerald-600" },
  xlsx: { Icon: FileSpreadsheet, className: "text-emerald-600" },
  csv: { Icon: FileSpreadsheet, className: "text-emerald-600" },
  tsv: { Icon: FileSpreadsheet, className: "text-emerald-600" },
  ppt: { Icon: FileText, className: "text-amber-500" },
  pptx: { Icon: FileText, className: "text-amber-500" },
  json: { Icon: FileCode2, className: "text-violet-500" },
  xml: { Icon: FileCode2, className: "text-violet-500" },
  yml: { Icon: FileCode2, className: "text-violet-500" },
  yaml: { Icon: FileCode2, className: "text-violet-500" },
  txt: { Icon: FileText, className: "text-muted-foreground" },
  md: { Icon: FileText, className: "text-muted-foreground" },
  markdown: { Icon: FileText, className: "text-muted-foreground" },
  log: { Icon: FileText, className: "text-muted-foreground" },
};

export function extensionOfFilename(filename: string): string {
  const match = /\.([a-zA-Z0-9]+)$/.exec(filename.trim());
  return match ? match[1].toLowerCase() : "";
}

// Mirrors the server-side allowlist so unsupported picks fail fast with a
// clear message instead of a round trip.
const SUPPORTED_EXTENSIONS = new Set([
  "pdf",
  "txt",
  "md",
  "markdown",
  "csv",
  "tsv",
  "json",
  "log",
  "xml",
  "yml",
  "yaml",
  "png",
  "jpg",
  "jpeg",
  "webp",
  "gif",
  "docx",
  "xlsx",
  "xls",
  "pptx",
]);

export function isSupportedUpload(file: File) {
  return (
    SUPPORTED_EXTENSIONS.has(extensionOfFilename(file.name)) ||
    file.type.startsWith("image/") ||
    file.type === "application/pdf"
  );
}

export function guessMimeType(filename: string) {
  const ext = extensionOfFilename(filename);
  const map: Record<string, string> = {
    pdf: "application/pdf",
    txt: "text/plain",
    md: "text/markdown",
    markdown: "text/markdown",
    csv: "text/csv",
    tsv: "text/tab-separated-values",
    json: "application/json",
    xml: "application/xml",
    yml: "application/x-yaml",
    yaml: "application/x-yaml",
    png: "image/png",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    webp: "image/webp",
    gif: "image/gif",
    docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    xls: "application/vnd.ms-excel",
    pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  };
  return map[ext] ?? "application/octet-stream";
}

// Picks a recognizable icon + tint for a library file based on its
// extension, falling back to MIME hints for images and unknown types.
export function fileVisualFor(
  filename: string,
  mimeType?: string | null
): FileVisual {
  const visual = EXT_VISUALS[extensionOfFilename(filename)];
  if (visual) return visual;
  if (mimeType && mimeType.startsWith("image/"))
    return { Icon: FileText, className: "text-sky-500" };
  return { Icon: FileText, className: "text-muted-foreground" };
}
