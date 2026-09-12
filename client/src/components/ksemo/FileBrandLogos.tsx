import React, { memo, useId } from "react";
import type { ReactNode } from "react";

/*
 * KSEMO's own file-format icon set — custom, detailed artwork (not the
 * Microsoft logos). Each format is unmistakable at a glance through its
 * signature color and a distinctive document layout: PDF = red page w/ export
 * arrow, Word = blue text page w/ typing caret, Excel = green spreadsheet
 * grid, PowerPoint = orange slide w/ bullets + play, Text = slate paragraphs.
 *
 * Common anatomy: a vivid gradient tile with top gloss + bottom shade, a
 * three-dimensional document file with a folded corner and soft ground
 * shadow, and bold format content on top.
 */

type BrandLogoProps = { className?: string };

type DocumentBrand = {
  from: string;
  to: string;
  flap: string;
  accent: string;
};

type DocumentFileProps = {
  className?: string;
  brand: DocumentBrand;
  label: string;
  fontSize: number;
  letterSpacing?: number;
  children?: ReactNode;
};

function DocumentFile({
  className,
  brand,
  label,
  fontSize,
  letterSpacing = 0.5,
  children,
}: DocumentFileProps) {
  const uid = useId().replace(/:/g, "_");
  const clipId = `${uid}-clip`;
  const bannerId = `${uid}-banner`;
  const paperId = `${uid}-paper`;

  // Page contour path: x: 7 -> 41, y: 3 -> 45 (width 34, height 42)
  // Corner fold cuts diagonally from (30, 3) to (41, 14)
  const pagePath =
    "M 12 3 H 30 L 41 14 V 40 A 5 5 0 0 1 36 45 H 12 A 5 5 0 0 1 7 40 V 8 A 5 5 0 0 1 12 3 Z";

  return (
    <svg
      viewBox="0 0 48 48"
      className={className}
      role="img"
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <clipPath id={clipId}>
          <path d={pagePath} />
        </clipPath>
        <linearGradient id={bannerId} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={brand.from} />
          <stop offset="100%" stopColor={brand.to} />
        </linearGradient>
        <linearGradient id={paperId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="100%" stopColor="#F8FAFC" />
        </linearGradient>
      </defs>

      {/* Ground drop shadow */}
      <ellipse cx="24" cy="44.2" rx="14" ry="2.2" fill="#000000" opacity="0.18" />
      <rect x="8.5" y="5.5" width="31" height="39.5" rx="5" fill="#000000" opacity="0.06" />

      {/* Base White Document Sheet */}
      <path
        d={pagePath}
        fill={`url(#${paperId})`}
        stroke="#CBD5E1"
        strokeWidth="1.1"
      />

      {/* Clipped Document Interior */}
      <g clipPath={`url(#${clipId})`}>
        {/* Top header accent line */}
        <rect x="12" y="8.5" width="13" height="2" rx="1" fill="#E2E8F0" />

        {/* Signature Format Brand Banner */}
        <rect
          x="7"
          y="15"
          width="34"
          height="14"
          fill={`url(#${bannerId})`}
        />

        {/* Subtle highlight sheen on banner */}
        <rect
          x="7"
          y="15"
          width="34"
          height="1.2"
          fill="#ffffff"
          opacity="0.25"
        />

        {/* Large, Bold, Crystal-Clear Format Word */}
        <text
          x="24"
          y="22.5"
          textAnchor="middle"
          dominantBaseline="central"
          fontSize={fontSize}
          fontWeight="900"
          fill="#ffffff"
          fontFamily="system-ui,-apple-system,sans-serif"
          letterSpacing={letterSpacing}
        >
          {label}
        </text>

        {/* Format Specific Document Content Beneath Banner */}
        {children}
      </g>

      {/* Top-right folded flap with drop shadow */}
      <path
        d="M 30 14 L 30 17 L 39 14 Z"
        fill="#000000"
        opacity="0.12"
      />
      <path
        d="M 30 3 V 11.5 A 2.5 2.5 0 0 0 32.5 14 H 41 Z"
        fill={brand.flap}
        stroke={brand.accent}
        strokeOpacity="0.35"
        strokeWidth="0.75"
      />
    </svg>
  );
}

/*
 * PDF — crisp white document file with a folded corner, vivid red "PDF" banner,
 * and structured document text lines.
 */
export const PdfLogo = memo(function PdfLogo({ className }: BrandLogoProps) {
  return (
    <DocumentFile
      className={className}
      brand={{
        from: "#EF4444",
        to: "#B91C24",
        flap: "#FECDD3",
        accent: "#DC2626",
      }}
      label="PDF"
      fontSize={9.5}
      letterSpacing={0.6}
    >
      <rect x="12" y="32.5" width="24" height="2.2" rx="1.1" fill="#DC2626" opacity="0.35" />
      <rect x="12" y="36.5" width="16" height="2.2" rx="1.1" fill="#94A3B8" />
      <rect x="12" y="40.5" width="21" height="2.2" rx="1.1" fill="#CBD5E1" />
    </DocumentFile>
  );
});

/*
 * Word — crisp white document file with a folded corner, royal blue "WORD" banner,
 * blue margin rule, and structured document text lines with a typing caret.
 */
export const WordLogo = memo(function WordLogo({ className }: BrandLogoProps) {
  return (
    <DocumentFile
      className={className}
      brand={{
        from: "#3B82F6",
        to: "#1D4ED8",
        flap: "#BFDBFE",
        accent: "#2563EB",
      }}
      label="WORD"
      fontSize={8.5}
      letterSpacing={0.4}
    >
      <rect x="12" y="32.5" width="2.4" height="10" rx="1.2" fill="#2563EB" />
      <rect x="16.5" y="32.5" width="19.5" height="2.2" rx="1.1" fill="#1D4ED8" opacity="0.65" />
      <rect x="16.5" y="36.5" width="14" height="2.2" rx="1.1" fill="#94A3B8" />
      <rect x="16.5" y="40.5" width="16" height="2.2" rx="1.1" fill="#CBD5E1" />
      <rect x="34" y="39.8" width="1.8" height="3.2" rx="0.9" fill="#2563EB" />
    </DocumentFile>
  );
});

/*
 * Excel — crisp white document file with a folded corner, emerald green "EXCEL" banner,
 * and clean ruled spreadsheet table cells.
 */
export const ExcelLogo = memo(function ExcelLogo({ className }: BrandLogoProps) {
  return (
    <DocumentFile
      className={className}
      brand={{
        from: "#10B981",
        to: "#047857",
        flap: "#A7F3D0",
        accent: "#059669",
      }}
      label="EXCEL"
      fontSize={7.5}
      letterSpacing={0.2}
    >
      <rect x="12" y="32" width="11.5" height="4.2" rx="1" fill="#ffffff" stroke="#86EFAC" strokeWidth="0.8" />
      <rect x="24.5" y="32" width="11.5" height="4.2" rx="1" fill="#ffffff" stroke="#86EFAC" strokeWidth="0.8" />
      <rect x="14" y="33.6" width="7.5" height="1.2" rx="0.6" fill="#16A34A" />
      <rect x="26.5" y="33.6" width="7.5" height="1.2" rx="0.6" fill="#94A3B8" />
      <rect x="12" y="37.5" width="11.5" height="4.2" rx="1" fill="#ffffff" stroke="#86EFAC" strokeWidth="0.8" />
      <rect x="24.5" y="37.5" width="11.5" height="4.2" rx="1" fill="#ffffff" stroke="#86EFAC" strokeWidth="0.8" />
      <rect x="14" y="39.1" width="7.5" height="1.2" rx="0.6" fill="#94A3B8" />
      <rect x="26.5" y="39.1" width="7.5" height="1.2" rx="0.6" fill="#16A34A" />
    </DocumentFile>
  );
});

/*
 * PowerPoint — crisp white document file with a folded corner, vivid orange "PPT" banner,
 * and presentation slide bullet points with a play control.
 */
export const PowerPointLogo = memo(function PowerPointLogo({
  className,
}: BrandLogoProps) {
  return (
    <DocumentFile
      className={className}
      brand={{
        from: "#F97316",
        to: "#C2410C",
        flap: "#FED7AA",
        accent: "#EA580C",
      }}
      label="PPT"
      fontSize={9.5}
      letterSpacing={0.6}
    >
      <circle cx="14" cy="35" r="1.3" fill="#EA580C" />
      <rect x="17.5" y="33.9" width="11" height="2.2" rx="1.1" fill="#475569" />
      <circle cx="14" cy="40" r="1.3" fill="#EA580C" />
      <rect x="17.5" y="38.9" width="9" height="2.2" rx="1.1" fill="#94A3B8" />
      <path d="M30 36.5 l4 2.2 -4 2.2 z" fill="#EA580C" />
    </DocumentFile>
  );
});

/*
 * Text — crisp white document file with a folded corner, slate gray "TEXT" banner,
 * and clean paragraph document lines.
 */
export const TextLogo = memo(function TextLogo({ className }: BrandLogoProps) {
  return (
    <DocumentFile
      className={className}
      brand={{
        from: "#64748B",
        to: "#334155",
        flap: "#CBD5E1",
        accent: "#475569",
      }}
      label="TEXT"
      fontSize={8.5}
      letterSpacing={0.4}
    >
      <rect x="12" y="32.5" width="24" height="2.2" rx="1.1" fill="#475569" opacity="0.35" />
      <rect x="12" y="36.5" width="18" height="2.2" rx="1.1" fill="#94A3B8" />
      <rect x="12" y="40.5" width="14" height="2.2" rx="1.1" fill="#CBD5E1" />
    </DocumentFile>
  );
});

/*
 * Image — crisp white document file with a folded corner, sky blue "IMG" banner,
 * and a framed landscape photo preview.
 */
export const ImageLogo = memo(function ImageLogo({ className }: BrandLogoProps) {
  return (
    <DocumentFile
      className={className}
      brand={{
        from: "#0EA5E9",
        to: "#0369A1",
        flap: "#BAE6FD",
        accent: "#0284C7",
      }}
      label="IMG"
      fontSize={9.5}
      letterSpacing={0.6}
    >
      <circle cx="15" cy="35" r="1.8" fill="#FBBF24" />
      <path d="M12 42 L18 36 L22 39 L28 34 L36 42 Z" fill="#059669" />
      <path d="M18 36 L22 39 L21 42 L17 42 Z" fill="#94A3B8" opacity="0.6" />
    </DocumentFile>
  );
});