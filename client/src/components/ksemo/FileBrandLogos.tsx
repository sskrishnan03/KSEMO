import { memo, useId } from "react";
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

const PALETTES = {
  pdf: { from: "#F43F47", to: "#B91C24" },
  word: { from: "#3B82F6", to: "#1D4ED8" },
  excel: { from: "#22C55E", to: "#15803D" },
  powerpoint: { from: "#FB923C", to: "#C2410C" },
  text: { from: "#64748B", to: "#334155" },
  image: { from: "#0EA5E9", to: "#075985" },
} as const;

function FormatIcon({
  palette,
  className,
  children,
}: {
  palette: (typeof PALETTES)[keyof typeof PALETTES];
  className?: string;
  children: ReactNode;
}) {
  const uid = useId().replace(/:/g, "_");
  const gid = `${uid}-bg`;
  return (
    <svg
      viewBox="0 0 48 48"
      className={className}
      role="img"
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0.3" y2="1">
          <stop offset="0" stopColor={palette.from} />
          <stop offset="1" stopColor={palette.to} />
        </linearGradient>
      </defs>
      <rect x="1" y="1" width="46" height="46" rx="13.5" fill={`url(#${gid})`} />
      <rect
        x="1"
        y="1"
        width="46"
        height="46"
        rx="13.5"
        fill="none"
        stroke="#ffffff"
        strokeOpacity="0.32"
        strokeWidth="1"
      />
      <path
        d="M12.5 3.5 h20 a11.5 11.5 0 0 1 11.5 11.5 v3.5 a33 25 0 0 0 -31.5 -2.5 z"
        fill="#ffffff"
        opacity="0.16"
      />
      <path
        d="M6 36.5 a18 10 0 0 0 36 0 v-1.5 a18 10 0 0 1 -36 0 z"
        fill="#000000"
        opacity="0.14"
      />
      {children}
    </svg>
  );
}

function PageShadow() {
  return <ellipse cx="24" cy="40.6" rx="13.8" ry="2.7" fill="#000000" opacity="0.22" />;
}

function useGradientId() {
  return useId().replace(/:/g, "_");
}

/*
 * PDF — bright red page, folded corner, white export arrow dropping into a
 * tray. Reads "save as PDF" at a glance and is unmistakably red.
 */
export const PdfLogo = memo(function PdfLogo({ className }: BrandLogoProps) {
  const uid = useGradientId();
  const pageId = `${uid}-page`;
  return (
    <FormatIcon palette={PALETTES.pdf} className={className}>
      <defs>
        <linearGradient id={pageId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ED4F37" />
          <stop offset="1" stopColor="#C62E1B" />
        </linearGradient>
      </defs>
      <PageShadow />
      <rect x="11.5" y="9" width="25" height="30" rx="4" fill={`url(#${pageId})`} />
      <path d="M36.5 9 v5 a5 5 0 0 1 -5 -5 z" fill="#FFB0A2" />
      <path
        d="M24 16.4 v6"
        stroke="#ffffff"
        strokeWidth="2.6"
        strokeLinecap="round"
      />
      <path
        d="M20.1 20.6 24 24.5 27.9 20.6"
        fill="none"
        stroke="#ffffff"
        strokeWidth="2.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <rect x="18.6" y="26.6" width="10.8" height="2.1" rx="1.05" fill="#ffffff" />
      <rect x="15" y="31.2" width="8" height="1.8" rx="0.9" fill="#ffffff" opacity="0.6" />
      <rect x="25" y="31.2" width="8" height="1.8" rx="0.9" fill="#ffffff" opacity="0.6" />
    </FormatIcon>
  );
});

/*
 * Word — white page with a blue margin accent, title + body text lines and a
 * blue typing caret. Connected to "writing a document" immediately.
 */
export const WordLogo = memo(function WordLogo({ className }: BrandLogoProps) {
  const uid = useGradientId();
  const pageId = `${uid}-page`;
  return (
    <FormatIcon palette={PALETTES.word} className={className}>
      <defs>
        <linearGradient id={pageId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="1" stopColor="#EFF4FB" />
        </linearGradient>
      </defs>
      <PageShadow />
      <rect x="11.5" y="9" width="25" height="30" rx="4" fill={`url(#${pageId})`} />
      <path d="M36.5 9 v5 a5 5 0 0 1 -5 -5 z" fill="#DCE5F2" />
      <rect x="14.5" y="14.5" width="2.5" height="11.5" rx="1.25" fill="#2563EB" />
      <rect x="19.5" y="15.8" width="13.5" height="2.8" rx="1.4" fill="#1E3A8A" />
      <rect x="19.5" y="21.2" width="11" height="2.3" rx="1.15" fill="#94A3B8" />
      <rect x="19.5" y="25.8" width="13.5" height="2.3" rx="1.15" fill="#94A3B8" />
      <rect x="19.5" y="30.4" width="9.5" height="2.3" rx="1.15" fill="#94A3B8" />
      <rect x="33.3" y="29.7" width="2.4" height="4.8" rx="1.2" fill="#2563EB" />
    </FormatIcon>
  );
});

/*
 * Excel — white spreadsheet page with a folded corner, green header row and a
 * ruled cell grid. An unmistakable table reads "spreadsheet".
 */
export const ExcelLogo = memo(function ExcelLogo({ className }: BrandLogoProps) {
  const uid = useGradientId();
  const pageId = `${uid}-page`;
  const cells = (y: number) => (
    <>
      <rect
        x="13.5"
        y={y}
        width="10"
        height="4.3"
        rx="1"
        fill="#ffffff"
        stroke="#BFE0C8"
        strokeWidth="1"
      />
      <rect
        x="24.2"
        y={y}
        width="10.3"
        height="4.3"
        rx="1"
        fill="#ffffff"
        stroke="#BFE0C8"
        strokeWidth="1"
      />
    </>
  );
  return (
    <FormatIcon palette={PALETTES.excel} className={className}>
      <defs>
        <linearGradient id={pageId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="1" stopColor="#F0F7F2" />
        </linearGradient>
      </defs>
      <PageShadow />
      <rect x="11.5" y="9" width="25" height="30" rx="4" fill={`url(#${pageId})`} />
      <path d="M36.5 9 v5 a5 5 0 0 1 -5 -5 z" fill="#DFF0E4" />
      <rect x="13.5" y="13.8" width="10" height="4.3" rx="1" fill="#16A34A" />
      <rect x="24.2" y="13.8" width="10.3" height="4.3" rx="1" fill="#16A34A" />
      {cells(20)}
      {cells(26.1)}
      {cells(32.2)}
    </FormatIcon>
  );
});

/*
 * PowerPoint — white widescreen slide with an orange title bar, bullet lines
 * and a play control. Reads "presentation" at a glance.
 */
export const PowerPointLogo = memo(function PowerPointLogo({
  className,
}: BrandLogoProps) {
  return (
    <FormatIcon palette={PALETTES.powerpoint} className={className}>
      <PageShadow />
      <rect x="9" y="12" width="30" height="21" rx="2.5" fill="#ffffff" />
      <rect x="9" y="12" width="30" height="21" rx="2.5" fill="#C2410C" opacity="0.08" />
      <rect x="11.5" y="14.6" width="25" height="3.6" rx="1.8" fill="#EA7A32" />
      <rect x="11.5" y="20.6" width="10" height="2.2" rx="1.1" fill="#CBD5E1" />
      <rect x="11.5" y="24.6" width="13.5" height="2.2" rx="1.1" fill="#CBD5E1" />
      <rect x="11.5" y="28.6" width="7.5" height="2.2" rx="1.1" fill="#CBD5E1" />
      <path d="M27.6 21.6 l4.4 2.2 -4.4 2.2 z" fill="#EA7A32" />
    </FormatIcon>
  );
});

/*
 * Text — white page with a folded corner and plain slate paragraphs. No
 * accent color, so it clearly reads as simple text against the others.
 */
export const TextLogo = memo(function TextLogo({ className }: BrandLogoProps) {
  const uid = useGradientId();
  const pageId = `${uid}-page`;
  return (
    <FormatIcon palette={PALETTES.text} className={className}>
      <defs>
        <linearGradient id={pageId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="1" stopColor="#F1F3F7" />
        </linearGradient>
      </defs>
      <PageShadow />
      <rect x="11.5" y="9" width="25" height="30" rx="4" fill={`url(#${pageId})`} />
      <path d="M36.5 9 v5 a5 5 0 0 1 -5 -5 z" fill="#ECEEF2" />
      <rect x="14" y="15.5" width="12" height="2.7" rx="1.35" fill="#64748B" />
      <rect x="14" y="20.4" width="20" height="2.3" rx="1.15" fill="#CBD5E1" />
      <rect x="14" y="24.7" width="16.5" height="2.3" rx="1.15" fill="#CBD5E1" />
      <rect x="14" y="29" width="20" height="2.3" rx="1.15" fill="#CBD5E1" />
      <rect x="14" y="33.3" width="10.5" height="2.3" rx="1.15" fill="#CBD5E1" />
    </FormatIcon>
  );
});

/*
 * Image — white page with a folded corner and a framed picture: sky-blue
 * photo with a sun and mountain in the corner. Reads "photo" instantly while
 * still matching the other document logos. Keeps a sky-blue tile so image
 * files stay recognizable beside the colorful Office set.
 */
export const ImageLogo = memo(function ImageLogo({ className }: BrandLogoProps) {
  const uid = useGradientId();
  const pageId = `${uid}-page`;
  return (
    <FormatIcon palette={PALETTES.image} className={className}>
      <defs>
        <linearGradient id={pageId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="1" stopColor="#F0F7FB" />
        </linearGradient>
      </defs>
      <PageShadow />
      <rect x="11.5" y="9" width="25" height="30" rx="4" fill={`url(#${pageId})`} />
      <path d="M36.5 9 v5 a5 5 0 0 1 -5 -5 z" fill="#DCEAF4" />
      <rect x="14.5" y="15" width="19" height="15" rx="1.5" fill="#BFDBFE" />
      <rect x="14.5" y="15" width="19" height="15" rx="1.5" fill="#0284C7" opacity="0.25" />
      <circle cx="20" cy="19.5" r="1.5" fill="#FDE68A" />
      <path d="M16 29.5 L22.5 23.5 L25.5 26.5 L28.5 23.5 L32 29.5 Z" fill="#065F46" />
      <path d="M22.5 23.5 L25.5 26.5 L24 29.5 L21.8 29.5 Z" fill="#94A3B8" />
      <rect x="14.5" y="14" width="19" height="1.8" rx="0.9" fill="#0284C7" opacity="0.45" />
      <rect x="14.5" y="28.2" width="19" height="1.8" rx="0.9" fill="#0284C7" opacity="0.45" />
      <rect x="15.2" y="34" width="4.4" height="2" rx="1" fill="#64748B" />
    </FormatIcon>
  );
});