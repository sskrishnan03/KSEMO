import {
  CodeFileIcon,
  GenericFileIcon,
  ImageFileIcon,
  type FileBrandIconComponent,
  type FileBrandVariant,
  brandVariantForExt,
} from "@/components/ksemo/FileBrandIcons";
import { getCapabilityOption } from "@/lib/capabilities";

export type FileVisual = {
  Icon: FileBrandIconComponent;
  variant: FileBrandVariant;
  className: string;
};

const EXT_VISUALS: Record<string, FileVisual> = {
  pdf: {
    Icon: getCapabilityOption("pdf").icon,
    variant: "pdf",
    className: getCapabilityOption("pdf").iconColor,
  },
  doc: {
    Icon: getCapabilityOption("docx").icon,
    variant: "word",
    className: getCapabilityOption("docx").iconColor,
  },
  docx: {
    Icon: getCapabilityOption("docx").icon,
    variant: "word",
    className: getCapabilityOption("docx").iconColor,
  },
  xls: {
    Icon: getCapabilityOption("xlsx").icon,
    variant: "excel",
    className: getCapabilityOption("xlsx").iconColor,
  },
  xlsx: {
    Icon: getCapabilityOption("xlsx").icon,
    variant: "excel",
    className: getCapabilityOption("xlsx").iconColor,
  },
  ppt: {
    Icon: getCapabilityOption("pptx").icon,
    variant: "powerpoint",
    className: getCapabilityOption("pptx").iconColor,
  },
  pptx: {
    Icon: getCapabilityOption("pptx").icon,
    variant: "powerpoint",
    className: getCapabilityOption("pptx").iconColor,
  },
  json: { Icon: CodeFileIcon, variant: "code", className: "" },
  xml: { Icon: CodeFileIcon, variant: "code", className: "" },
  yml: { Icon: CodeFileIcon, variant: "code", className: "" },
  yaml: { Icon: CodeFileIcon, variant: "code", className: "" },
  txt: {
    Icon: getCapabilityOption("txt").icon,
    variant: "text",
    className: getCapabilityOption("txt").iconColor,
  },
  log: {
    Icon: getCapabilityOption("txt").icon,
    variant: "text",
    className: getCapabilityOption("txt").iconColor,
  },
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

// Picks a recognizable brand tile for a library file based on its extension,
// falling back to MIME hints for images and unknown types.
export function fileVisualFor(
  filename: string,
  mimeType?: string | null
): FileVisual {
  const ext = extensionOfFilename(filename);
  const visual = EXT_VISUALS[ext];
  if (visual) return visual;
  const imageVariant = brandVariantForExt("img");
  if (mimeType && mimeType.startsWith("image/"))
    return {
      Icon: ImageFileIcon,
      variant: imageVariant,
      className: "",
    };
  return {
    Icon: GenericFileIcon,
    variant: brandVariantForExt(ext),
    className: "",
  };
}
