import React, { memo, useId } from "react";
import type { ComponentType } from "react";
import {
  ExcelLogo,
  ImageLogo,
  PdfLogo,
  PowerPointLogo,
  TextLogo,
  WordLogo,
} from "./FileBrandLogos";

// File format icons: PDF / Word / Excel / PowerPoint / Text render KSEMO's
// custom format icon set, while the remaining variants use a colored document
// tile with a white glyph.

export type FileBrandVariant =
  | "pdf"
  | "word"
  | "excel"
  | "powerpoint"
  | "text"
  | "image"
  | "code"
  | "archive"
  | "audio"
  | "video"
  | "generic";

const BRAND_LOGOS: Partial<Record<FileBrandVariant, ComponentType<{ className?: string }>>> = {
  pdf: PdfLogo,
  word: WordLogo,
  excel: ExcelLogo,
  powerpoint: PowerPointLogo,
  text: TextLogo,
  image: ImageLogo,
};

type BrandStyle = {
  from: string;
  to: string;
  label: string;
  fontSize: number;
};

export const FILE_BRAND_STYLES: Record<FileBrandVariant, BrandStyle> = {
  pdf: { from: "#F0483E", to: "#C62B29", label: "PDF", fontSize: 19 },
  word: { from: "#5793F0", to: "#1F5CB8", label: "W", fontSize: 30 },
  excel: { from: "#45B868", to: "#0E7A3A", label: "X", fontSize: 30 },
  powerpoint: { from: "#FF7A45", to: "#C43E1C", label: "P", fontSize: 30 },
  text: { from: "#94A3B8", to: "#475569", label: "TXT", fontSize: 17 },
  image: { from: "#38BDF8", to: "#0369A1", label: "IMG", fontSize: 17 },
  code: { from: "#A78BFA", to: "#6D28D9", label: "{}", fontSize: 23 },
  archive: { from: "#FBBF24", to: "#B45309", label: "ZIP", fontSize: 17 },
  audio: { from: "#EC4899", to: "#BE185D", label: "AUDIO", fontSize: 12 },
  video: { from: "#8B5CF6", to: "#6D28D9", label: "VIDEO", fontSize: 12 },
  generic: { from: "#64748B", to: "#334155", label: "FILE", fontSize: 17 },
};

const SVG_LABEL_WIDTHS: Record<FileBrandVariant, number> = {
  pdf: 30,
  word: 34,
  excel: 34,
  powerpoint: 34,
  text: 30,
  image: 28,
  code: 30,
  archive: 28,
  audio: 34,
  video: 34,
  generic: 28,
};

export function FileBrandMark({
  variant = "generic",
  className,
}: {
  variant?: FileBrandVariant;
  className?: string;
}) {
  const Logo = BRAND_LOGOS[variant];
  if (Logo) {
    return <Logo className={className} />;
  }

  const gradientId = useId();
  const style = FILE_BRAND_STYLES[variant];
  return (
    <svg
      viewBox="0 0 48 48"
      className={className}
      role="img"
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={style.from} />
          <stop offset="100%" stopColor={style.to} />
        </linearGradient>
      </defs>
      <rect
        x="1.5"
        y="1.5"
        width="45"
        height="45"
        rx="10"
        fill={`url(#${gradientId})`}
      />
      <rect
        x="1.5"
        y="1.5"
        width="45"
        height="45"
        rx="10"
        fill="none"
        stroke="#000"
        strokeOpacity="0.12"
        strokeWidth="0.75"
      />
      <path
        d="M30 2.2 H44 a2 2 0 0 1 2 2 V18 a12 12 0 0 0 -16 -16 Z"
        fill="#fff"
        opacity="0.12"
      />
      <rect x="1.5" y="1.5" width="45" height="17" rx="9" fill="#fff" opacity="0.1" />
      <text
        x="24"
        y="26.5"
        textAnchor="middle"
        dominantBaseline="central"
        fontSize={style.fontSize}
        fontWeight="800"
        fill="#fff"
        fontFamily="'Segoe UI','DM Sans',system-ui,-apple-system,sans-serif"
        letterSpacing={SVG_LABEL_WIDTHS[variant] > 30 ? "0.5" : "0"}
      >
        {style.label}
      </text>
    </svg>
  );
}

export type FileBrandIconComponent = ComponentType<{ className?: string }>;

function brandIcon(variant: FileBrandVariant, displayName: string): FileBrandIconComponent {
  const Component = ({ className }: { className?: string }) => (
    <FileBrandMark variant={variant} className={className} />
  );
  Component.displayName = displayName;
  return memo(Component);
}

export const PdfFileIcon = brandIcon("pdf", "PdfFileIcon");
export const WordFileIcon = brandIcon("word", "WordFileIcon");
export const ExcelFileIcon = brandIcon("excel", "ExcelFileIcon");
export const PowerPointFileIcon = brandIcon("powerpoint", "PowerPointFileIcon");
export const TextFileIcon = brandIcon("text", "TextFileIcon");
export const ImageFileIcon = brandIcon("image", "ImageFileIcon");
export const CodeFileIcon = brandIcon("code", "CodeFileIcon");
export const ArchiveFileIcon = brandIcon("archive", "ArchiveFileIcon");
export const AudioFileIcon = brandIcon("audio", "AudioFileIcon");
export const VideoFileIcon = brandIcon("video", "VideoFileIcon");
export const GenericFileIcon = brandIcon("generic", "GenericFileIcon");

export function brandVariantForExt(ext: string): FileBrandVariant {
  const e = ext.toLowerCase();
  if (e === "pdf") return "pdf";
  if (e === "doc" || e === "docx") return "word";
  if (e === "xls" || e === "xlsx" || e === "csv" || e === "tsv") return "excel";
  if (e === "ppt" || e === "pptx") return "powerpoint";
  if (e === "txt" || e === "log" || e === "md" || e === "markdown") return "text";
  if (e === "json" || e === "xml" || e === "yml" || e === "yaml")
    return "code";
  if (
    /^(png|jpe?g|webp|gif|bmp|svg|avif)$/.test(e) ||
    e.startsWith("img")
  )
    return "image";
  if (/^(zip|rar|7z|tar|gz)$/.test(e)) return "archive";
  if (/^(mp3|wav|m4a|ogg|webm|aac|flac)$/.test(e)) return "audio";
  if (/^(mp4|mov|avi|mkv)$/.test(e)) return "video";
  return "generic";
}