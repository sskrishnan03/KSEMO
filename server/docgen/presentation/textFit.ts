/**
 * Text fitting engine.
 *
 * Every text block is fitted into a bounded box (inches). The engine estimates
 * the required height using conservative metrics, then walks down the font-size
 * ladder until the block fits — but it NEVER drops below a professional
 * minimum, and it never relies on clipping. The same fitted size is encoded in
 * the canonical spec so preview and PowerPoint render identically.
 */

import { estimateTextHeight } from "@shared/presentation";

export type FitResult = {
  fontSize: number;
  heightIn: number;
  lines: number;
  fits: boolean;
};

export function measureLines(
  text: string,
  fontSize: number,
  widthIn: number
): number {
  if (!text) return 1;
  const avgCharWidthIn = (fontSize * 0.55) / 72 + 0.01;
  const usableIn = Math.max(widthIn - 0.1, 0.2);
  const charLimitPerLine = Math.max(
    Math.floor(usableIn / avgCharWidthIn),
    3
  );
  const words = text.split(/\s+/).filter(Boolean);
  let lines = 1;
  let current = 0;
  for (const word of words) {
    const wordLen = word.length;
    // Force-break extremely long tokens so a single URL cannot escape the box.
    const segments = Math.ceil(wordLen / Math.max(charLimitPerLine - 1, 1));
    const firstSegmentLen = wordLen;
    if (current + firstSegmentLen + 1 > charLimitPerLine && current > 0) {
      lines += 1;
      current = 0;
    }
    current += wordLen + 1 + (segments - 1) * charLimitPerLine;
    lines += Math.max(segments - 1, 0);
  }
  return Math.max(lines, 1);
}

export function fitText(opts: {
  text: string;
  fontSize: number;
  minFontSize: number;
  boxWidthIn: number;
  boxHeightIn: number;
  lineSpacing?: number;
  bold?: boolean;
  maxLines?: number;
}): FitResult {
  const {
    text,
    fontSize,
    minFontSize,
    boxWidthIn,
    boxHeightIn,
    lineSpacing = 1.15,
    maxLines,
  } = opts;
  let size = Math.max(fontSize, minFontSize);
  const sizeLimit = Math.max(fontSize, minFontSize) + 1.5;
  const widthForFit = boxWidthIn;
  const heightBudget = boxHeightIn;

  let best: FitResult = {
    fontSize: size,
    heightIn: heightBudget,
    lines: 1,
    fits: false,
  };

  while (size <= sizeLimit && size >= minFontSize) {
    const lines = measureLines(text, size, widthForFit);
    const height = size / 72 * lineSpacing * lines + 0.03;
    const lineOk = maxLines === undefined ? true : lines <= maxLines;
    const fits = height <= heightBudget + 0.01 && lineOk;
    best = { fontSize: size, heightIn: height, lines, fits };
    if (fits) return best;

    // Walk down the ladder.
    const step = size > 20 ? 1.25 : size > 12 ? 0.75 : 0.5;
    size = +(size - step).toFixed(2);
    if (size < minFontSize) break;
  }

  // Could not fit even at the minimum — return the minimum size so both
  // renderers show identical (dense) text rather than differing estimates.
  const lines = measureLines(text, minFontSize, widthForFit);
  return {
    fontSize: minFontSize,
    heightIn: minFontSize / 72 * lineSpacing * lines + 0.03,
    lines,
    fits: minFontSize / 72 * lineSpacing * lines + 0.03 <= heightBudget + 0.01,
  };
}

/** Truncates intelligently as a last-resort guard (keeps meaning). */
export function truncateTo(text: string, maxChars: number): string {
  if (text.length <= maxChars) return text;
  const cut = text.slice(0, maxChars - 1);
  const lastSpace = cut.lastIndexOf(" ");
  const base = lastSpace > maxChars * 0.6 ? cut.slice(0, lastSpace) : cut;
  return `${base.replace(/[,\s]+$/, "")}…`;
}

export const PROFESSIONAL_MIN_FONT = {
  /** Hero / title slide display type. */
  display: 24,
  /** Content slide main heading. */
  title: 22,
  /** In-slide section heading (column titles, block headers). */
  subtitle: 13,
  /** Body text. */
  body: 12,
  /** Big statistic / number. */
  stat: 24,
  /** Supporting / secondary text. */
  small: 11,
  /** Kicker / eyebrow labels. */
  caption: 10,
  /** Captions, references and footnotes. */
  label: 10,
  /** Table cell text. */
  table: 9,
} as const;