/**
 * Presentation layout & design engine.
 *
 * Converts semantic slide content (the AI's plan) + a visual style + the user's
 * configuration into a canonical `PptPresentationSpec` with explicitly bounded
 * elements.
 *
 * The engine is STYLE-AWARE end to end:
 *   1. content planning  — derive a layout kind for every slide, adapt the
 *                          narrative (overview opener, meaningful closer),
 *   2. layout selection  — the active style's `prefLayouts` drives rhythm so a
 *                          deck never repeats the same composition,
 *   3. typography        — every style owns a type scale (display / h1 / h2 /
 *                          body / label / stat) that is used consistently,
 *   4. surface language  — cards, panels, rules, dividers and accents all come
 *                          from the style's design system,
 *   5. contrast guard    — text colors are validated against their background
 *                          and adjusted automatically,
 *   6. text fitting      — every text block is fitted; the repairer never
 *                          shrinks below each block's `minFontSize`.
 *
 * Both the KSEMO preview renderer and the .pptx exporter consume exactly this
 * specification, so preview and download can never drift.
 */

import {
  SLIDE_WIDTH_IN,
  SLIDE_HEIGHT_IN,
  SAFE_MARGIN,
  normalizeStyleId,
  type PptBox,
  type PptElement,
  type PptPresentationSpec,
  type PptSlideSpec,
  type PptVisualStyle,
  type PresentationConfig,
} from "@shared/presentation";
import type { SlideColumn, SlideDefinition } from "../spec";
import { fitText, measureLines, PROFESSIONAL_MIN_FONT } from "./textFit";
import {
  VISUAL_THEMES,
  THEME_KEYS,
  pickAutoTheme,
  getThemeSpec,
  type ThemeSpec,
} from "./themes";

const W = SLIDE_WIDTH_IN;
const H = SLIDE_HEIGHT_IN;

// ─── Geometry constants ─────────────────────────────────────────────────────
const ML = 0.85; // left margin
const MR = 0.85; // right margin
const CW = W - ML - MR; // content width
const TOP = 0.55;
const BODY_BOTTOM = 6.98;

/**
 * Resolves the authoritative theme for a deck. `auto` (or an absent style)
 * is the ONLY case where the engine may choose a theme itself. An explicitly
 * requested style must exist in the registry — if it doesn't, we fail loudly
 * instead of silently generating a generic deck, because the user's visual
 * style is the authoritative design system.
 */
export function resolveTheme(
  styleName: PptVisualStyle | undefined,
  title: string
): ThemeSpec {
  if (!styleName || styleName === "auto") return pickAutoTheme(title);
  const theme =
    getThemeSpec(styleName) ||
    VISUAL_THEMES[styleName] ||
    VISUAL_THEMES[normalizeStyleId(styleName)];
  if (!theme) {
    throw new Error(
      `Unknown visual style "${styleName}". Valid styles: ${THEME_KEYS.join(", ")}.`
    );
  }
  return theme;
}

type Strategy = PresentationConfig["layout"];
type Density = PresentationConfig["density"];
type Visuals = PresentationConfig["visuals"];
type ConcreteDensity = Exclude<Density, "auto">;

function densityOf(value?: Density): ConcreteDensity {
  return value && value !== "auto" ? value : "Standard";
}

function strategyOf(value?: Strategy): Strategy {
  return value && value !== "auto" ? value : "Balanced";
}

function visualsOf(value?: Visuals): Visuals {
  return value && value !== "auto" ? value : "Balanced";
}

// Density scales typography & bullet budget so the amount of information per
// slide changes WITHOUT ever dropping below professional readability.
const DENSITY_EXTRAS: Record<
  ConcreteDensity,
  { scale: number; spacing: number; maxBullets: number }
> = {
  Light: { scale: 1.12, spacing: 1.32, maxBullets: 4 },
  Standard: { scale: 1.0, spacing: 1.2, maxBullets: 6 },
  Detailed: { scale: 0.94, spacing: 1.14, maxBullets: 9 },
  Research: { scale: 0.9, spacing: 1.1, maxBullets: 12 },
};

type Extras = (typeof DENSITY_EXTRAS)[ConcreteDensity];

type CompositionCtx = {
  theme: ThemeSpec;
  config: PresentationConfig;
  strategy: Strategy;
  density: ConcreteDensity;
  ext: Extras;
  index: number;
  total: number;
  deckTitle: string;
};

// ─── Color / contrast helpers ───────────────────────────────────────────────

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}

function lumOf(hex: string | undefined): number {
  const c = (hex ?? "000000").replace(/^#/, "").trim();
  if (c.length !== 6 || !/^[0-9a-fA-F]{6}$/.test(c)) return 0;
  const r = parseInt(c.slice(0, 2), 16) / 255;
  const g = parseInt(c.slice(2, 4), 16) / 255;
  const b = parseInt(c.slice(4, 6), 16) / 255;
  const lin = (v: number) =>
    v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

function ratio(a: string, b: string): number {
  const la = lumOf(a);
  const lb = lumOf(b);
  const [hi, lo] = la >= lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

function isLight(hex: string): boolean {
  return lumOf(hex) >= 0.5;
}

/**
 * Returns a text color that reliably contrasts with `bg`. Prefers the given
 * candidate, falling back to the theme's semantic colors until the required
 * contrast ratio is met. This guarantees no gray-on-gray or dark-on-dark text.
 */
function safeText(
  ctx: CompositionCtx,
  bg: string,
  candidate: string,
  min = 4.0
): string {
  const t = ctx.theme;
  const opts = [
    candidate,
    isLight(bg) ? t.text : t.invertedText,
    isLight(bg) ? t.invertedText : t.text,
    "#000000",
    "#FFFFFF",
  ];
  for (const o of opts) {
    if (o && ratio(bg, o) >= min) return o.trim().toUpperCase();
  }
  return isLight(bg) ? "FFFFFF" : "000000";
}

function accentText(ctx: CompositionCtx, fill?: string): string {
  const bg = fill ?? ctx.theme.accent;
  return isLight(bg) ? ctx.theme.text : ctx.theme.invertedText;
}

function tint(hex: string, amount: number): string {
  // amount > 0 lightens toward white, amount < 0 darkens toward black.
  const c = hex.replace(/^#/, "");
  const f = Math.abs(amount);
  const r = parseInt(c.slice(0, 2), 16);
  const g = parseInt(c.slice(2, 4), 16);
  const b = parseInt(c.slice(4, 6), 16);
  const mix = (v: number) => {
    const out = amount >= 0 ? Math.round(v + (255 - v) * f) : Math.round(v * (1 - f));
    return clamp01(out / 255) * 255;
  };
  const rr = Math.round(mix(r)).toString(16).padStart(2, "0");
  const gg = Math.round(mix(g)).toString(16).padStart(2, "0");
  const bb = Math.round(mix(b)).toString(16).padStart(2, "0");
  return `${rr}${gg}${bb}`;
}

// ─── Element builders ───────────────────────────────────────────────────────

function addShapeEl(
  els: PptElement[],
  box: PptBox,
  shape: "rect" | "roundRect" | "line" | "ellipse" | "chevron",
  opts: {
    fill?: string;
    lineColor?: string;
    lineWidth?: number;
    radius?: number;
    opacity?: number;
  } = {}
): void {
  els.push({
    kind: "shape",
    box,
    shape,
    fill: opts.fill,
    lineColor: opts.lineColor,
    lineWidth: opts.lineWidth,
    radius: opts.radius,
    opacity: opts.opacity,
  });
}

function addTextEl(
  els: PptElement[],
  box: PptBox,
  text: string,
  opts: {
    size: number;
    color: string;
    font?: string;
    bold?: boolean;
    align?: "left" | "center" | "right";
    valign?: "top" | "middle" | "bottom";
    italic?: boolean;
    lineSpacing?: number;
    letterSpacing?: number;
    opacity?: number;
    minSize?: number;
  }
): PptElement {
  const el: PptElement = {
    kind: "text",
    box,
    text,
    fontSize: +opts.size.toFixed(2),
    bold: opts.bold,
    color: opts.color,
    align: opts.align ?? "left",
    valign: opts.valign ?? "top",
    italic: opts.italic,
    font: opts.font,
    lineSpacing: opts.lineSpacing ?? 1.2,
    letterSpacing: opts.letterSpacing,
    opacity: opts.opacity,
    minFontSize: opts.minSize,
  };
  els.push(el);
  return el;
}

function addFittedText(
  ctx: CompositionCtx,
  els: PptElement[],
  box: PptBox,
  text: string,
  opts: {
    size: number;
    minSize?: number;
    color: string;
    font?: string;
    bold?: boolean;
    align?: "left" | "center" | "right";
    valign?: "top" | "middle" | "bottom";
    italic?: boolean;
    lineSpacing?: number;
    letterSpacing?: number;
    opacity?: number;
  }
): PptElement {
  const minSize = opts.minSize ?? PROFESSIONAL_MIN_FONT.caption;
  const fitted = fitText({
    text,
    fontSize: opts.size,
    minFontSize: minSize,
    boxWidthIn: box.w,
    boxHeightIn: box.h,
    lineSpacing: opts.lineSpacing ?? ctx.ext.spacing,
    bold: opts.bold,
  });
  const el = addTextEl(els, box, text, {
    size: +fitted.fontSize.toFixed(2),
    minSize,
    color: opts.color,
    font: opts.font ?? ctx.theme.bodyFont,
    bold: opts.bold,
    align: opts.align,
    valign: opts.valign,
    italic: opts.italic,
    lineSpacing: opts.lineSpacing ?? ctx.ext.spacing,
    letterSpacing: opts.letterSpacing,
    opacity: opts.opacity,
  });
  return el;
}

function addBulletItem(
  ctx: CompositionCtx,
  els: PptElement[],
  box: PptBox,
  text: string,
  opts: {
    size: number;
    minSize: number;
    color: string;
    markerColor?: string;
    marker?: "dot" | "bar" | "none";
    lineSpacing?: number;
  }
): PptElement {
  const t = ctx.theme;
  const marker = opts.marker ?? "dot";
  const markerW = marker === "bar" ? 0.16 : 0.09;
  const textBox: PptBox = { ...box, x: box.x + markerW + 0.14, w: box.w - markerW - 0.14 };
  const fitted = fitText({
    text,
    fontSize: opts.size,
    minFontSize: opts.minSize,
    boxWidthIn: textBox.w,
    boxHeightIn: textBox.h,
    lineSpacing: opts.lineSpacing ?? ctx.ext.spacing,
  });
  const yCenter = box.y + textBox.h / 2;
  if (marker === "bar") {
    addShapeEl(els, { x: box.x, y: box.y + textBox.h / 2 - 0.045, w: 0.14, h: 0.09 }, "rect", {
      fill: opts.markerColor ?? t.accent,
      radius: 0.02,
    });
  } else {
    addShapeEl(els, { x: box.x, y: box.y + Math.min(yCenter - 0.045, box.y + 0.06), w: 0.09, h: 0.09 }, "ellipse", {
      fill: opts.markerColor ?? t.accent,
    });
  }
  return addTextEl(els, textBox, text, {
    size: +fitted.fontSize.toFixed(2),
    minSize: opts.minSize,
    color: opts.color,
    font: t.bodyFont,
    valign: "top",
    lineSpacing: opts.lineSpacing ?? ctx.ext.spacing,
  });
}

// ─── Title / heading helpers ────────────────────────────────────────────────

function splitLongTitle(raw: string): { title: string; subtitle?: string } {
  const trimmed = raw.trim();
  if (trimmed.length <= 92) return { title: trimmed };
  const sentences = trimmed
    .split(/(?<=[.!?])\s+|\s+—\s+/)
    .map(s => s.trim())
    .filter(Boolean);
  if (sentences.length > 1) {
    const first = sentences[0];
    if (first.length <= 60) {
      return {
        title: first.replace(/[.!?]$/, ""),
        subtitle: sentences.slice(1).join(" ").slice(0, 160),
      };
    }
  }
  const words = trimmed.split(/\s+/);
  let title = "";
  for (const word of words) {
    if (title.length + word.length + 1 > 52) break;
    title += (title ? " " : "") + word;
  }
  const rest = trimmed.slice(title.length).trim();
  return { title: title || trimmed.slice(0, 52), subtitle: rest.slice(0, 170) };
}

function typeSize(ctx: CompositionCtx, key: keyof ThemeSpec["typeScale"]): number {
  return ctx.theme.typeScale[key] * ctx.ext.scale;
}

/**
 * Composes the shared content-slide header (kicker, title, rule, subtitle)
 * and returns the body area.
 */
function composeHeader(
  ctx: CompositionCtx,
  els: PptElement[],
  rawTitle: string,
  heading: string,
  subtitle?: string
): PptBox {
  const t = ctx.theme;
  const split = splitLongTitle(rawTitle);
  const title = split.title;
  const effSubtitle = split.subtitle || subtitle;
  const labelMin = 9;

  if (t.useKicker && heading) {
    addFittedText(
      ctx,
      els,
      { x: ML, y: 0.58, w: CW, h: 0.3 },
      heading.toUpperCase(),
      {
        size: typeSize(ctx, "label"),
        minSize: labelMin,
        color: safeText(ctx, t.background, t.accent, 3.2),
        font: t.labelFont,
        bold: true,
        letterSpacing: t.tracking === "wide" ? 2.2 : 1.1,
        opacity: 92,
        valign: "middle",
      }
    );
  }

  addFittedText(
    ctx,
    els,
    { x: ML, y: 0.9, w: CW, h: 0.95 },
    title,
    {
      size: typeSize(ctx, "h1"),
      minSize: Math.max(22, PROFESSIONAL_MIN_FONT.title),
      color: safeText(ctx, t.background, t.primary, 5.5),
      font: t.titleFont,
      bold: true,
      valign: "bottom",
      lineSpacing: 1.02,
      letterSpacing: t.tracking === "tight" ? -0.3 : 0,
    }
  );

  const ruleY = 1.98;
  if (t.headerRule === "underline") {
    addShapeEl(els, { x: ML, y: ruleY, w: 1.7, h: 0.045 }, "rect", { fill: t.accent });
  } else if (t.headerRule === "dot") {
    addShapeEl(els, { x: ML, y: ruleY - 0.035, w: 0.09, h: 0.09 }, "ellipse", { fill: t.accent });
  } else if (t.headerRule === "bar") {
    addShapeEl(els, { x: ML, y: ruleY - 0.02, w: 0.55, h: 0.03 }, "rect", {
      fill: t.accent,
      radius: 0.02,
    });
  }

  let bodyTop = 2.12;
  if (effSubtitle) {
    addFittedText(
      ctx,
      els,
      { x: ML, y: ruleY + 0.1, w: CW, h: 0.42 },
      effSubtitle,
      {
        size: typeSize(ctx, "small"),
        minSize: Math.max(11, PROFESSIONAL_MIN_FONT.subtitle),
        color: safeText(ctx, t.background, t.muted, 3.4),
        font: t.bodyFont,
        lineSpacing: 1.05,
      }
    );
    bodyTop = 2.62;
  }
  return { x: ML, y: bodyTop, w: CW, h: BODY_BOTTOM - bodyTop };
}

function addCard(
  ctx: CompositionCtx,
  els: PptElement[],
  box: PptBox,
  opts: { fill?: string; accent?: string; accentPos?: "top" | "left" | "right" | "none"; seed?: number }
): void {
  const t = ctx.theme;
  const fill = opts.fill ?? t.panel;
  const accent = opts.accent ?? t.accent;
  const pos = opts.accentPos ?? (t.accents === "band" ? "top" : "none");

  if (t.cardStyle === "minimal") {
    if (pos === "top") {
      addShapeEl(els, { x: box.x + 0.06, y: box.y, w: Math.min(box.w - 0.12, 0.9), h: 0.03 }, "rect", { fill: accent });
    } else if (pos === "left") {
      addShapeEl(els, { x: box.x, y: box.y + 0.12, w: 0.045, h: Math.min(box.h - 0.24, 0.7) }, "rect", { fill: accent });
    } else if (t.accents === "dot") {
      addShapeEl(els, { x: box.x + 0.12, y: box.y + 0.16, w: 0.06, h: 0.06 }, "ellipse", { fill: accent });
    }
    return;
  }

  if (t.cardStyle === "hard") {
    addShapeEl(els, box, "rect", { fill, lineColor: t.panelBorder, lineWidth: t.borderWidth });
    if (pos === "top") {
      addShapeEl(els, { x: box.x, y: box.y, w: box.w, h: 0.07 }, "rect", { fill: accent });
    } else if (pos === "left") {
      addShapeEl(els, { x: box.x, y: box.y, w: 0.07, h: box.h }, "rect", { fill: accent });
    }
    return;
  }

  if (t.cardStyle === "outlined") {
    addShapeEl(els, box, "roundRect", {
      fill: fill,
      lineColor: t.panelBorder,
      lineWidth: t.borderWidth,
      radius: Math.max(t.radius, 0.05),
    });
    if (pos === "top") {
      addShapeEl(els, { x: box.x, y: box.y, w: box.w, h: 0.045 }, "rect", {
        fill: accent,
        opacity: 85,
        radius: Math.max(t.radius, 0.05) * 2,
      });
    } else if (pos === "left") {
      addShapeEl(els, { x: box.x, y: box.y, w: 0.06, h: box.h }, "rect", { fill: accent });
    }
    return;
  }

  // soft / filled — rounded floating panels
  const radius = t.cardStyle === "soft" ? Math.max(t.radius * 1.6, 0.14) : Math.max(t.radius, 0.06);
  addShapeEl(els, box, "roundRect", {
    fill,
    lineColor: t.cardStyle === "filled" ? undefined : t.panelBorder,
    lineWidth: t.borderWidth,
    radius,
  });
  if (pos === "top") {
    addShapeEl(
      els,
      { x: box.x + radius * 0.6, y: box.y, w: Math.min(box.w - radius * 1.2, 0.8), h: 0.035 },
      "rect",
      { fill: accent, radius: 0.02 }
    );
  } else if (pos === "left") {
    addShapeEl(els, { x: box.x + 0.14, y: box.y + 0.16, w: 0.05, h: 0.24 }, "rect", { fill: accent });
  }
}

// ─── Decorative motifs (used sparingly on title / section slides) ─────────

function addDecoration(ctx: CompositionCtx, els: PptElement[], kind: string): void {
  const t = ctx.theme;
  switch (kind) {
    case "ring": {
      addShapeEl(
        els,
        { x: W - 2.3, y: H - 2.4, w: 1.5, h: 1.5 },
        "ellipse",
        { lineColor: t.accent, lineWidth: 1, opacity: 45 }
      );
      addShapeEl(
        els,
        { x: W - 1.95, y: H - 2.05, w: 0.8, h: 0.8 },
        "ellipse",
        { lineColor: t.accent2, lineWidth: 1, opacity: 55 }
      );
      break;
    }
    case "blob": {
      addShapeEl(els, { x: W - 2.6, y: 0.7, w: 2.0, h: 2.0 }, "ellipse", {
        fill: t.accent2,
        opacity: 14,
      });
      addShapeEl(els, { x: W - 2.1, y: 1.2, w: 1.1, h: 1.1 }, "ellipse", {
        fill: t.accent,
        opacity: 18,
      });
      break;
    }
    case "offset": {
      addShapeEl(els, { x: W - 2.35, y: 0.9, w: 1.8, h: 2.6 }, "rect", {
        fill: t.accent2,
        opacity: 26,
      });
      addShapeEl(els, { x: W - 1.9, y: 1.25, w: 1.8, h: 2.6 }, "rect", {
        fill: t.accent,
        opacity: 30,
      });
      break;
    }
    case "grid": {
      const step = 2.6;
      for (let gy = 1.1; gy < H - 0.4; gy += step) {
        addShapeEl(els, { x: ML, y: gy, w: CW, h: 0.01 }, "line", {
          lineColor: t.accent,
          lineWidth: 0.5,
          opacity: 10,
        });
      }
      for (let gx = ML + 3; gx < W - 0.4; gx += 3) {
        addShapeEl(els, { x: gx, y: 0.6, w: 0.01, h: H - 1.2 }, "line", {
          lineColor: t.accent,
          lineWidth: 0.5,
          opacity: 9,
        });
      }
      break;
    }
    case "frame": {
      addShapeEl(els, { x: 0.4, y: 0.4, w: W - 0.8, h: H - 0.8 }, "rect", {
        lineColor: t.accent,
        lineWidth: 0.75,
        opacity: 30,
      });
      break;
    }
    case "band": {
      addShapeEl(els, { x: 0, y: H - 1.5, w: W, h: 1.5 }, "rect", {
        fill: t.accent,
        opacity: 8,
      });
      break;
    }
    default:
      break;
  }
}

// ─── Layout kind planning ───────────────────────────────────────────────────

type ComputedLayout =
  | "title"
  | "section"
  | "overview"
  | "bullets"
  | "bullets_rail"
  | "two_column"
  | "feature_grid"
  | "big_statement"
  | "stat_strip"
  | "big_number"
  | "process"
  | "timeline"
  | "comparison"
  | "architecture"
  | "table"
  | "definition"
  | "quote"
  | "key_message"
  | "closing"
  | "chart_strip";

const LAYOUT_RHYTHM: Record<string, string[]> = {
  minimal: ["bullets_rail", "two_column", "stat_strip", "single_focus", "bullets", "quote"],
  modern: ["feature_grid", "stat_strip", "two_column", "bullets_rail", "quote", "single_focus"],
  corporate: ["two_column", "table", "bullets_rail", "stat_strip", "comparison", "bullets"],
  editorial: ["single_focus", "two_column", "quote", "stat_strip", "bullets_rail", "feature_grid"],
  bold: ["stat_strip", "big_statement", "bullets_rail", "two_column", "comparison", "single_focus"],
  elegant: ["single_focus", "quote", "two_column", "stat_strip", "bullets_rail", "bullets"],
  creative: ["feature_grid", "bullets_rail", "stat_strip", "two_column", "single_focus", "quote"],
  dark: ["bullets_rail", "two_column", "stat_strip", "feature_grid", "comparison", "bullets"],
  light: ["feature_grid", "two_column", "stat_strip", "bullets_rail", "bullets", "single_focus"],
  glass: ["feature_grid", "stat_strip", "two_column", "bullets_rail", "single_focus", "quote"],
  academic: ["two_column", "table", "bullets_rail", "definition", "stat_strip", "bullets"],
  technical: ["architecture", "two_column", "table", "bullets_rail", "process", "definition"],
  luxury: ["single_focus", "quote", "two_column", "stat_strip", "bullets_rail", "bullets"],
  startup: ["stat_strip", "feature_grid", "big_statement", "two_column", "bullets_rail", "single_focus"],
  magazine: ["feature_grid", "quote", "stat_strip", "two_column", "bullets_rail", "definition"],
  data: ["chart_strip", "stat_strip", "table", "comparison", "two_column", "bullets_rail"],
  presentation: ["two_column", "bullets_rail", "feature_grid", "stat_strip", "comparison", "table"],
};

function rhythmFor(theme: ThemeSpec): ComputedLayout[] {
  const list = LAYOUT_RHYTHM[theme.key] ?? LAYOUT_RHYTHM.presentation;
  return list as ComputedLayout[];
}

function stripNumbers(text: string): string {
  return text.replace(/\b\d+(\.\d+)?(%|x|K|M|B|T)?\b/g, m => m);
}

function isNumericBullet(b: string): boolean {
  return /\d/.test(b);
}

/** Extracts presentable datum pairs (label + value) from metrics / bullets. */
function extractData(
  slide: SlideDefinition
): Array<{ label: string; value: number }> {
  const out: Array<{ label: string; value: number }> = [];
  for (const m of slide.metrics ?? []) {
    const n = parseFloat(String(m.value).replace(/[^0-9.\-]/g, ""));
    if (Number.isFinite(n)) {
      out.push({ label: m.label || String(m.value), value: n });
    }
  }
  if (out.length === 0) {
    for (const b of (slide.bullets ?? []).slice(0, 8)) {
      const m = b.match(/(\d+(?:\.\d+)?)\s*([%xX]|k|K|m|M|b|B|t|T)?/);
      if (m) {
        const n = parseFloat(m[1].replace(",", "."));
        const mult = /[kK]/.test(m[2] ?? "")
          ? 1000
          : /[mM]/.test(m[2] ?? "")
            ? 1000000
            : /[bB]/.test(m[2] ?? "")
              ? 1000000000
              : 1;
        out.push({
          label: (b.split(/[–—-]/)[1] || b).trim().slice(0, 34),
          value: Math.round(n * mult),
        });
      }
    }
  }
  return out.slice(0, 6);
}

function hasStructuredData(slide: SlideDefinition): boolean {
  return (
    (slide.metrics?.length ?? 0) >= 2 ||
    (slide.table?.rows?.length ?? 0) >= 2
  );
}

/** Assigns a concrete composition to every slide. */
function planLayouts(
  slides: SlideDefinition[],
  theme: ThemeSpec,
  visuals: Visuals
): ComputedLayout[] {
  const rhythm = rhythmFor(theme);
  const out: ComputedLayout[] = [];
  let rhythmCursor = 0;

  slides.forEach((slide, i) => {
    const explicit = slide.layout;
    if (explicit === "title") {
      out.push("title");
      return;
    }
    if (explicit === "section") {
      out.push("section");
      return;
    }
    if (explicit === "key_message") {
      out.push("key_message");
      return;
    }
    if (explicit === "quote") {
      out.push("quote");
      return;
    }
    if (explicit === "process") {
      out.push(slide.steps && slide.steps.length <= 4 ? "timeline" : "process");
      return;
    }
    if (explicit === "comparison") {
      out.push("comparison");
      return;
    }
    if (explicit === "table") {
      out.push("table");
      return;
    }
    if (explicit === "stats" || explicit === "big_number") {
      const metrics = slide.metrics ?? [];
      out.push(metrics.length === 1 || metrics.length >= 5 ? "big_number" : "stat_strip");
      return;
    }
    if (explicit === "three_column") {
      out.push("feature_grid");
      return;
    }
    if (explicit === "two_column") {
      out.push(theme.key === "technical" || theme.key === "data" ? "architecture" : "two_column");
      return;
    }

    const n = slides.length;
    const isFirst = i === 1 && n > 2;
    const isLast = i === n - 1;

    // Plain bullet slides get narrative intelligence.
    if (isFirst && (slide.bullets?.length ?? 0) >= 3 && !hasStructuredData(slide)) {
      out.push("overview");
      return;
    }
    if (isLast && slide.bullets && slide.bullets.length >= 2) {
      out.push("closing");
      return;
    }

    const bullets = slide.bullets ?? [];
    if (hasStructuredData(slide)) {
      out.push("chart_strip");
      return;
    }
    if (Object.keys(rhythm).length === 0) {
      out.push("bullets");
      return;
    }
    const kind = rhythm[rhythmCursor % rhythm.length];
    rhythmCursor += 1;
    // Density guard: extremely dense slides always use a two-column split.
    if ((slide.columns?.length ?? 0) >= 2 && bullets.length >= 6) {
      out.push("two_column");
      return;
    }
    out.push(kind);
  });

  return out;
}

// ─── Hero / title slide ─────────────────────────────────────────────────────

function composeTitleSlide(
  ctx: CompositionCtx,
  els: PptElement[],
  slide: SlideDefinition,
  deckTitle: string
): void {
  const t = ctx.theme;
  const split = splitLongTitle(slide.title || deckTitle);
  const kicker =
    slide.subtitle && slide.subtitle.length <= 68 ? slide.subtitle : undefined;
  const heroTitle = split.title || "Presentation";
  const heroSub = split.subtitle || rawSubtitle(slide);
  const display = typeSize(ctx, "display");
  const minDisplay = Math.max(26, PROFESSIONAL_MIN_FONT.display * ctx.ext.scale);
  const tTitle = safeText(ctx, t.titleBackground, t.primary, 5.5);
  const tSub = safeText(ctx, t.titleBackground, t.muted, 3.4);
  const tAccent = safeText(ctx, t.titleBackground, t.accent, 3.2);
  const styleKey = t.key;

  addDecoration(ctx, els, t.decoration);

  const labelY = 1.95;
  const titleY = 2.32;

  if (styleKey === "minimal" || styleKey === "elegant" || styleKey === "luxury") {
    const X = 1.05;
    if (kicker) {
      addFittedText(ctx, els, { x: X, y: labelY, w: 10, h: 0.32 }, kicker.toUpperCase(), {
        size: typeSize(ctx, "label"),
        minSize: 10,
        color: tAccent,
        font: t.labelFont,
        bold: true,
        letterSpacing: t.tracking === "wide" ? 2.4 : 1.4,
      });
    }
    const y2 = kicker ? titleY : 2.1;
    addFittedText(ctx, els, { x: X, y: y2, w: 11.2, h: 1.7 }, heroTitle, {
      size: display,
      minSize: minDisplay,
      color: tTitle,
      font: t.titleFont,
      bold: true,
      valign: "top",
      lineSpacing: 1.02,
      letterSpacing: t.tracking === "tight" ? -0.4 : 0,
    });
    if (t.headerRule === "dot") {
      addShapeEl(els, { x: X, y: y2 + 1.82, w: 0.09, h: 0.09 }, "ellipse", { fill: t.accent });
    } else {
      addShapeEl(els, { x: X, y: y2 + 1.85, w: 1.15, h: 0.035 }, "rect", { fill: t.accent });
    }
    if (heroSub) {
      addFittedText(ctx, els, { x: X, y: y2 + 2.1, w: 10.6, h: 0.75 }, heroSub, {
        size: typeSize(ctx, "body"),
        minSize: 13,
        color: tSub,
        font: t.bodyFont,
        italic: styleKey === "elegant",
        lineSpacing: 1.2,
      });
    }
  } else if (styleKey === "editorial" || styleKey === "magazine") {
    const X = 1.05;
    // Vertical accent rule on left + right color plate
    addShapeEl(els, { x: X - 0.35, y: 1.4, w: 0.045, h: 4.6 }, "rect", { fill: t.accent });
    addShapeEl(els, { x: W - 3.1, y: 1.3, w: 2.2, h: 4.8 }, "rect", {
      fill: styleKey === "magazine" ? t.accent2 : t.accent,
      opacity: styleKey === "magazine" ? 14 : 12,
    });
    if (kicker) {
      addFittedText(ctx, els, { x: X, y: labelY, w: 9, h: 0.3 }, kicker.toUpperCase(), {
        size: typeSize(ctx, "label"),
        minSize: 10,
        color: tAccent,
        font: "Segoe UI",
        bold: true,
        letterSpacing: 2.0,
      });
    }
    const y2 = kicker ? titleY : 2.05;
    addFittedText(ctx, els, { x: X, y: y2, w: 9.6, h: 2.05 }, heroTitle, {
      size: display,
      minSize: minDisplay,
      color: tTitle,
      font: t.titleFont,
      bold: true,
      valign: "top",
      lineSpacing: 1.0,
    });
    addShapeEl(els, { x: X, y: y2 + 2.18, w: 1.5, h: 0.03 }, "rect", { fill: t.accent });
    if (heroSub) {
      addFittedText(ctx, els, { x: X, y: y2 + 2.42, w: 9.4, h: 0.8 }, heroSub, {
        size: typeSize(ctx, "body"),
        minSize: 13,
        color: tSub,
        font: t.bodyFont,
        lineSpacing: 1.25,
      });
    }
  } else if (styleKey === "bold" || styleKey === "startup") {
    addShapeEl(els, { x: 0, y: 0, w: 0.5, h: H }, "rect", { fill: t.accent });
    if (styleKey === "startup") {
      addShapeEl(els, { x: W - 4.4, y: 1.1, w: 3.3, h: 2.2 }, "rect", {
        fill: t.accent2,
        opacity: 22,
      });
    } else {
      addShapeEl(els, { x: W - 3.6, y: H - 3.0, w: 2.7, h: 2.7 }, "rect", {
        fill: t.accent2,
        opacity: 90,
      });
    }
    const X = styleKey === "bold" ? 0.95 : 1.05;
    if (kicker) {
      addFittedText(ctx, els, { x: X, y: 1.55, w: 9, h: 0.34 }, kicker.toUpperCase(), {
        size: typeSize(ctx, "label"),
        minSize: 11,
        color: tAccent,
        font: t.labelFont,
        bold: true,
        letterSpacing: 1.8,
      });
    }
    const y2 = kicker ? 1.98 : 1.55;
    addFittedText(ctx, els, { x: X, y: y2, w: 10.8, h: 1.95 }, heroTitle, {
      size: display + (styleKey === "bold" ? 4 : 2),
      minSize: minDisplay,
      color: safeText(ctx, t.titleBackground, "#FFFFFF", 5.5),
      font: t.titleFont,
      bold: true,
      valign: "top",
      lineSpacing: 1.0,
    });
    if (heroSub) {
      addFittedText(ctx, els, { x: X, y: y2 + 2.15, w: 9.8, h: 0.8 }, heroSub, {
        size: typeSize(ctx, "body") + 1,
        minSize: 14,
        color: safeText(ctx, t.titleBackground, t.secondary, 4.2),
        font: t.bodyFont,
        lineSpacing: 1.25,
      });
    }
    if (slide.bullets?.length) {
      slide.bullets.slice(0, 3).forEach((b, i) => {
        const by = 5.3 + i * 0.46;
        if (by + 0.4 > H - 0.4) return;
        addShapeEl(els, { x: X + 0.03, y: by + 0.09, w: 0.3, h: 0.04 }, "rect", { fill: t.accent });
        addFittedText(ctx, els, { x: X + 0.48, y: by, w: 9.6, h: 0.42 }, b.length > 120 ? `${b.slice(0, 118)}…` : b, {
          size: typeSize(ctx, "small"),
          minSize: 11.5,
          color: safeText(ctx, t.titleBackground, t.text, 4.5),
          font: t.bodyFont,
          lineSpacing: 1.15,
        });
      });
    }
  } else if (styleKey === "technical" || styleKey === "data" || styleKey === "glass") {
    // Framed technical/telemetry hero with a right-side system panel.
    const techLike = styleKey === "technical" || styleKey === "data";
    if (techLike) {
      addShapeEl(els, { x: 0, y: 0, w: W, h: 0.06 }, "rect", { fill: t.accent, opacity: 90 });
      els.push({
        kind: "text",
        box: { x: 0.85, y: 0.62, w: 6, h: 0.24 },
        text: styleKey === "data" ? "DATA // ANALYSIS SYSTEM" : "SYS // OVERVIEW TERMINAL",
        fontSize: 9,
        bold: true,
        color: tAccent,
        font: t.labelFont,
        valign: "middle",
      });
    }
    addShapeEl(els, { x: 0, y: 0, w: 0.18, h: H }, "rect", { fill: t.accent });
    const X = 0.95;
    if (kicker) {
      addFittedText(ctx, els, { x: X, y: 1.5, w: 8, h: 0.32 }, kicker.toUpperCase(), {
        size: typeSize(ctx, "label"),
        minSize: 10,
        color: tAccent,
        font: t.labelFont,
        bold: true,
        letterSpacing: techLike ? 1.3 : 1.8,
      });
    }
    const rightPanel = { x: 9.15, y: 1.7, w: 3.15, h: 4.0 };
    const y2 = kicker ? 1.92 : 1.55;
    const titleW = 9.15 - X - 0.3;
    addFittedText(ctx, els, { x: X, y: y2, w: titleW, h: 1.8 }, heroTitle, {
      size: display,
      minSize: minDisplay,
      color: safeText(ctx, t.titleBackground, "#FFFFFF", 5.5),
      font: t.titleFont,
      bold: true,
      valign: "top",
      lineSpacing: 1.0,
    });
    if (heroSub) {
      addFittedText(ctx, els, { x: X, y: y2 + 1.92, w: titleW, h: 0.8 }, heroSub, {
        size: typeSize(ctx, "body"),
        minSize: 13,
        color: safeText(ctx, t.titleBackground, t.secondary, 4.2),
        font: t.bodyFont,
        lineSpacing: 1.25,
      });
    }
    // Right system panel with genuine data (metrics if present, else bars).
    const data = extractData(slide);
    addShapeEl(els, rightPanel, "roundRect", {
      fill: t.panel,
      lineColor: t.accent,
      lineWidth: t.borderWidth,
      radius: Math.max(t.radius, 0.06),
    });
    addShapeEl(els, { x: rightPanel.x, y: rightPanel.y, w: rightPanel.w, h: 0.32 }, "roundRect", {
      fill: t.accent,
      radius: Math.max(t.radius, 0.06) * 4,
    });
    // custom small header chip via plain rects:
    addShapeEl(els, { x: rightPanel.x, y: rightPanel.y, w: rightPanel.w, h: 0.09 }, "rect", { fill: t.accent, opacity: 90 });
    els.push({
      kind: "text",
      box: { x: rightPanel.x + 0.16, y: rightPanel.y + 0.1, w: rightPanel.w - 0.3, h: 0.24 },
      text: styleKey === "data" ? "KEY FIGURES" : "SYSTEM METRICS",
      fontSize: 9,
      bold: true,
      color: safeText(ctx, t.accent, "#FFFFFF", 4),
      font: t.labelFont,
      valign: "middle",
    });
    if (data.length >= 3) {
      addBarChart(ctx, els, {
        x: rightPanel.x + 0.22,
        y: rightPanel.y + 0.5,
        w: rightPanel.w - 0.44,
        h: rightPanel.h - 0.7,
      }, data.slice(0, 4), { size: 9, labelColor: safeText(ctx, t.panel, t.muted, 3.2) });
    } else {
      (slide.bullets ?? []).slice(0, 3).forEach((b, i) => {
        const by = rightPanel.y + 0.52 + i * 0.5;
        addShapeEl(els, { x: rightPanel.x + 0.2, y: by + 0.16, w: 0.09, h: 0.09 }, "ellipse", { fill: t.accent });
        addFittedText(ctx, els, { x: rightPanel.x + 0.38, y: by, w: rightPanel.w - 0.55, h: 0.9 }, b.length > 90 ? `${b.slice(0, 88)}…` : b, {
          size: 10.5,
          minSize: 9.5,
          color: safeText(ctx, t.panel, t.text, 4.2),
          font: t.bodyFont,
          lineSpacing: 1.15,
        });
      });
    }
  } else {
    // modern / corporate / creative / dark / light / academic / presentation
    if (t.heroBand === "left") {
      addShapeEl(els, { x: 0, y: 0, w: 0.28, h: H }, "rect", { fill: t.accent });
    } else if (t.heroBand === "right") {
      addShapeEl(els, { x: W - 0.28, y: 0, w: 0.28, h: H }, "rect", { fill: t.accent });
    } else if (t.heroBand === "full") {
      addShapeEl(els, { x: 0, y: 0, w: W, h: 0.22 }, "rect", { fill: t.accent });
    }
    const X = 1.05;
    if (kicker) {
      addFittedText(ctx, els, { x: X, y: 1.75, w: 9, h: 0.32 }, kicker.toUpperCase(), {
        size: typeSize(ctx, "label"),
        minSize: 10,
        color: tAccent,
        font: t.labelFont,
        bold: true,
        letterSpacing: 1.5,
      });
    }
    const y2 = kicker ? 2.15 : 1.85;
    addFittedText(ctx, els, { x: X, y: y2, w: 11.2, h: 1.7 }, heroTitle, {
      size: display,
      minSize: minDisplay,
      color: safeText(ctx, t.titleBackground, "#FFFFFF", 5),
      font: t.titleFont,
      bold: true,
      valign: "top",
      lineSpacing: 1.0,
    });
    addShapeEl(els, { x: X, y: y2 + 1.8, w: 1.2, h: 0.03 }, "rect", { fill: tAccent });
    if (heroSub) {
      addFittedText(ctx, els, { x: X, y: y2 + 2.05, w: 10.6, h: 0.75 }, heroSub, {
        size: typeSize(ctx, "body"),
        minSize: 13,
        color: safeText(ctx, t.titleBackground, t.secondary, 4.2),
        font: t.bodyFont,
        italic: styleKey === "academic",
        lineSpacing: 1.25,
      });
    }
  }

  // Compact highlights row (title slide bullets) for conversational styles.
  if (
    styleKey !== "minimal" &&
    styleKey !== "elegant" &&
    styleKey !== "luxury" &&
    styleKey !== "editorial" &&
    styleKey !== "magazine" &&
    slide.bullets?.length
  ) {
    const top = H - 1.5;
    slide.bullets.slice(0, 3).forEach((b, i) => {
      const x = ML + i * ((CW - 0.4) / 3);
      addShapeEl(els, { x, y: top + 0.05, w: Math.min((CW - 0.4) / 3 - 0.4, 0.5), h: 0.025 }, "rect", { fill: t.accent });
      addFittedText(ctx, els, { x, y: top + 0.22, w: (CW - 0.4) / 3 - 0.2, h: 0.68 }, b.length > 96 ? `${b.slice(0, 94)}…` : b, {
        size: typeSize(ctx, "small"),
        minSize: 11,
        color: safeText(ctx, t.titleBackground, t.secondary, 4.0),
        font: t.bodyFont,
        lineSpacing: 1.15,
      });
    });
  }
}

function rawSubtitle(slide: SlideDefinition): string | undefined {
  return slide.subtitle || undefined;
}

// ─── Section divider ───────────────────────────────────────────────────────

function composeSectionSlide(
  ctx: CompositionCtx,
  els: PptElement[],
  slide: SlideDefinition,
  deckTitle: string
): void {
  const t = ctx.theme;
  const split = splitLongTitle(slide.title || deckTitle);
  const display = typeSize(ctx, "display") - 4;
  const y = 2.4;

  if (t.heroBand === "left") {
    addShapeEl(els, { x: 0, y: 0, w: 0.28, h: H }, "rect", { fill: t.accent });
  } else if (t.heroBand === "full") {
    addShapeEl(els, { x: 0, y: 0, w: W, h: 0.2 }, "rect", { fill: t.accent });
  } else {
    addShapeEl(els, { x: ML, y: y - 0.5, w: 1.3, h: 0.045 }, "rect", { fill: t.accent });
  }
  addDecoration(ctx, els, t.decoration);

  const kick = slide.subtitle || (ctx.index === 0 ? "" : deckTitle.slice(0, 48));
  if (kick) {
    addFittedText(ctx, els, { x: ML, y: y - 0.66, w: CW, h: 0.32 }, kick.toUpperCase(), {
      size: typeSize(ctx, "label"),
      minSize: 10,
      color: safeText(ctx, t.sectionBackground, t.accent, 3.2),
      font: t.labelFont,
      bold: true,
      letterSpacing: 1.6,
    });
  }
  addFittedText(ctx, els, { x: ML, y, w: CW, h: 1.4 }, split.title, {
    size: display,
    minSize: Math.max(28, PROFESSIONAL_MIN_FONT.display * ctx.ext.scale),
    color: safeText(ctx, t.sectionBackground, t.primary, 5.5),
    font: t.titleFont,
    bold: true,
    valign: "top",
    lineSpacing: 1.02,
    letterSpacing: t.tracking === "tight" ? -0.3 : 0,
  });
  if (split.subtitle) {
    addFittedText(ctx, els, { x: ML, y: y + 1.55, w: CW, h: 0.6 }, split.subtitle, {
      size: typeSize(ctx, "body"),
      minSize: 13,
      color: safeText(ctx, t.sectionBackground, t.muted, 3.4),
      font: t.bodyFont,
      lineSpacing: 1.25,
    });
  }
}

// ─── Bullets / overview / closing ───────────────────────────────────────────

function composeBullets(
  ctx: CompositionCtx,
  els: PptElement[],
  body: PptBox,
  bullets: string[]
): void {
  const t = ctx.theme;
  const list = bullets.filter(b => b && b.trim()).slice(0, ctx.ext.maxBullets);
  if (!list.length) return;
  const size = typeSize(ctx, "body");
  const minSize = Math.max(size - 2, 13);
  const gap = 0.18;
  const per = list.length;
  const budget = body.h - (per - 1) * gap;
  const boxH = Math.max(budget, 0.5) / per;
  let y = body.y;
  list.forEach((b, i) => {
    addBulletItem(ctx, els, { x: body.x, y: y, w: body.w, h: boxH }, b, {
      size,
      minSize,
      color: safeText(ctx, t.background, t.text, 4.5),
      markerColor: t.accent,
      marker: t.accents === "bar" ? "bar" : "dot",
      lineSpacing: ctx.ext.spacing,
    });
    y += boxH + gap;
  });
}

function composeBulletsRail(
  ctx: CompositionCtx,
  els: PptElement[],
  body: PptBox,
  slide: SlideDefinition
): void {
  const t = ctx.theme;
  const bulletBox: PptBox = { ...body, w: body.w - 3.65 };
  composeBullets(ctx, els, bulletBox, slide.bullets ?? []);

  // Right rail carries REAL meaning: metrics / extracted figures / subtitle pull.
  const rail: PptBox = { x: body.x + body.w - 3.25, y: body.y + 0.05, w: 3.25, h: body.h - 0.1 };
  const data = extractData(slide);
  const showChart = data.length >= 3 &&
    (ctx.strategy === "Data First" || ["data", "technical", "corporate", "startup"].includes(t.key));

  if (showChart) {
    addCard(ctx, els, rail, { accentPos: "top" });
    els.push({
      kind: "text",
      box: { x: rail.x + 0.2, y: rail.y + 0.15, w: rail.w - 0.4, h: 0.26 },
      text: "KEY FIGURES",
      fontSize: typeSize(ctx, "label"),
      bold: true,
      color: safeText(ctx, t.panel, t.accent, 3.2),
      font: t.labelFont,
      valign: "middle",
    });
    addBarChart(ctx, els, { x: rail.x + 0.2, y: rail.y + 0.5, w: rail.w - 0.4, h: rail.h - 0.6 }, data.slice(0, 4), {
      size: 9,
      labelColor: safeText(ctx, t.panel, t.muted, 3.2),
    });
  } else if ((slide.metrics?.length ?? 0) >= 1) {
    addCard(ctx, els, rail, { accentPos: "top" });
    slide.metrics!.slice(0, 3).forEach((m, i) => {
      const my = rail.y + 0.2 + i * (rail.h - 0.4) / 3;
      addFittedText(ctx, els, { x: rail.x + 0.22, y: my, w: rail.w - 0.44, h: (rail.h - 0.4) * 0.42 }, m.value, {
        size: typeSize(ctx, "stat") * 0.72,
        minSize: 20,
        color: safeText(ctx, t.panel, t.accent, 3.4),
        font: t.titleFont,
        bold: true,
        valign: "middle",
        lineSpacing: 1,
      });
      addFittedText(ctx, els, { x: rail.x + 0.22, y: my + (rail.h - 0.4) * 0.45, w: rail.w - 0.44, h: (rail.h - 0.4) * 0.4 }, m.label, {
        size: typeSize(ctx, "small"),
        minSize: 11,
        color: safeText(ctx, t.panel, t.muted, 3.2),
        font: t.bodyFont,
        lineSpacing: 1.1,
      });
    });
  } else if (slide.subtitle) {
    addCard(ctx, els, rail, { accentPos: "left" });
    els.push({
      kind: "text",
      box: { x: rail.x + 0.35, y: rail.y + 0.3, w: rail.w - 0.7, h: 0.3 },
      text: "IN FOCUS",
      fontSize: typeSize(ctx, "label"),
      bold: true,
      color: safeText(ctx, t.panel, t.accent, 3.2),
      font: t.labelFont,
      letterSpacing: 1.4,
      valign: "middle",
    });
    addFittedText(ctx, els, { x: rail.x + 0.35, y: rail.y + 0.72, w: rail.w - 0.7, h: rail.h - 1.0 }, slide.subtitle, {
      size: typeSize(ctx, "small"),
      minSize: 12,
      color: safeText(ctx, t.panel, t.text, 4.4),
      font: t.bodyFont,
      italic: true,
      lineSpacing: 1.3,
    });
  }
}

function composeOverview(
  ctx: CompositionCtx,
  els: PptElement[],
  body: PptBox,
  slide: SlideDefinition
): void {
  const t = ctx.theme;
  const items = (slide.bullets ?? []).filter(Boolean).slice(0, Math.min(ctx.ext.maxBullets, 6));
  const kicker = slide.title || "Overview";
  addFittedText(ctx, els, { x: body.x, y: body.y + 0.05, w: body.w, h: 0.3 }, "AGENDA / STRUCTURE".toUpperCase(), {
    size: typeSize(ctx, "label"),
    minSize: 10,
    color: safeText(ctx, t.background, t.accent, 3.2),
    font: t.labelFont,
    bold: true,
    letterSpacing: 1.6,
  });
  addFittedText(ctx, els, { x: body.x, y: body.y + 0.42, w: body.w, h: 0.7 }, kicker, {
    size: typeSize(ctx, "h2") + 3,
    minSize: 18,
    color: safeText(ctx, t.background, t.primary, 5.5),
    font: t.titleFont,
    bold: true,
    valign: "top",
    lineSpacing: 1.05,
  });

  const rows = body.y + 1.35;
  const rowH = Math.min((body.y + body.h - rows) / Math.max(items.length, 1), 0.92);
  items.forEach((item, i) => {
    const ry = rows + i * rowH;
    const num = String(i + 1).padStart(2, "0");
    const numColor = safeText(ctx, t.background, t.accent, 3.4);
    addFittedText(ctx, els, { x: body.x, y: ry, w: 0.8, h: rowH }, num, {
      size: typeSize(ctx, "h2"),
      minSize: 15,
      color: numColor,
      font: t.titleFont,
      bold: true,
      valign: "middle",
      lineSpacing: 1,
    });
    addShapeEl(els, { x: body.x + 0.95, y: ry + rowH / 2 - 0.38, w: 0.045, h: 0.54 }, "rect", {
      fill: t.panelBorder,
    });
    addFittedText(ctx, els, { x: body.x + 1.2, y: ry, w: body.w - 1.2, h: rowH }, item, {
      size: typeSize(ctx, "body"),
      minSize: 13.5,
      color: safeText(ctx, t.background, t.text, 4.5),
      font: t.bodyFont,
      valign: "middle",
      lineSpacing: 1.15,
    });
  });
}

function composeClosing(
  ctx: CompositionCtx,
  els: PptElement[],
  body: PptBox,
  slide: SlideDefinition
): void {
  const t = ctx.theme;
  const bullets = (slide.bullets ?? []).filter(Boolean).slice(0, ctx.ext.maxBullets);
  const statement = bullets[0] || slide.title || "In summary";
  const supports = bullets.slice(1, 4);

  addShapeEl(els, { x: 0, y: 0, w: W, h: 0.16 }, "rect", { fill: t.accent, opacity: 90 });
  addFittedText(ctx, els, { x: body.x, y: body.y + 0.05, w: body.w, h: 0.3 }, "IN SUMMARY".toUpperCase(), {
    size: typeSize(ctx, "label"),
    minSize: 10,
    color: safeText(ctx, t.background, t.accent, 3.2),
    font: t.labelFont,
    bold: true,
    letterSpacing: 1.8,
  });

  const msgBox: PptBox = { x: body.x, y: body.y + 0.5, w: body.w, h: 1.6 };
  const tAccent = safeText(ctx, t.background, t.accent, 3.4);
  if (t.cardStyle !== "minimal") {
    addCard(ctx, els, msgBox, { accentPos: "left", fill: t.panel });
  }
  addFittedText(ctx, els, { x: msgBox.x + 0.35, y: msgBox.y + 0.25, w: msgBox.w - 0.7, h: msgBox.h - 0.5 }, statement, {
    size: typeSize(ctx, "h2") + 3,
    minSize: 17,
    color: safeText(ctx, t.panel, t.primary, 5),
    font: t.titleFont,
    bold: true,
    valign: "middle",
    lineSpacing: 1.15,
  });

  if (supports.length) {
    const yStart = msgBox.y + msgBox.h + 0.18;
    const gap = 0.14;
    const boxH = (body.y + body.h - yStart - gap * (supports.length - 1)) / supports.length;
    supports.forEach((b, i) => {
      addBulletItem(ctx, els, { x: body.x + 0.1, y: yStart + i * (boxH + gap), w: body.w - 0.1, h: boxH }, b, {
        size: typeSize(ctx, "small"),
        minSize: 12.5,
        color: safeText(ctx, t.background, t.text, 4.5),
        markerColor: i === 0 ? t.accent : t.accent2,
        marker: t.accents === "bar" ? "bar" : "dot",
      });
    });
  }
}

// ─── Columns / feature grid ─────────────────────────────────────────────────

function composeTwoColumn(
  ctx: CompositionCtx,
  els: PptElement[],
  body: PptBox,
  slide: SlideDefinition
): void {
  const t = ctx.theme;
  const cols = (slide.columns ?? []).length >= 2 ? slide.columns! : columnsFromBullets(slide.bullets ?? [], 2);
  const gap = 0.28;
  const colW = (body.w - gap) / 2;
  const widthForContent = colW;

  cols.slice(0, 2).forEach((col, i) => {
    const x = body.x + i * (colW + gap);
    addCard(ctx, els, { x, y: body.y, w: colW, h: body.h }, { accentPos: i === 0 ? "left" : "top", seed: i });
    let innerY = body.y + 0.28;
    if (col.title) {
      addFittedText(ctx, els, { x: x + 0.26, y: innerY, w: widthForContent - 0.52, h: 0.55 }, col.title, {
        size: typeSize(ctx, "h2"),
        minSize: 15,
        color: safeText(ctx, t.panel, t.primary, 5),
        font: t.titleFont,
        bold: true,
        valign: "middle",
        lineSpacing: 1.05,
      });
      innerY += 0.62;
    }
    if (col.text) {
      const textH = col.bullets?.length ? 0.7 : body.y + body.h - innerY - 0.24;
      addFittedText(ctx, els, { x: x + 0.26, y: innerY, w: widthForContent - 0.52, h: textH }, col.text, {
        size: typeSize(ctx, "small"),
        minSize: 12,
        color: safeText(ctx, t.panel, t.muted, 3.6),
        font: t.bodyFont,
        lineSpacing: ctx.ext.spacing,
      });
      innerY += textH + 0.12;
    }
    if (col.bullets?.length) {
      const bulletsBox: PptBox = { x: x + 0.26, y: innerY, w: widthForContent - 0.52, h: Math.max(body.y + body.h - innerY - 0.2, 0.6) };
      const bsize = typeSize(ctx, "body") - 0.5;
      const minB = Math.max(bsize - 2, 12.5);
      const gapB = 0.12;
      const per = col.bullets.length;
      const boxH = Math.max((bulletsBox.h - (per - 1) * gapB) / per, 0.42);
      col.bullets.slice(0, ctx.ext.maxBullets).forEach((b, bi) => {
        addBulletItem(ctx, els, { x: bulletsBox.x, y: bulletsBox.y + bi * (boxH + gapB), w: bulletsBox.w, h: boxH }, b, {
          size: bsize,
          minSize: minB,
          color: safeText(ctx, t.panel, t.text, 4.4),
          markerColor: i === 0 ? t.accent : t.accent2,
          marker: t.accents === "bar" ? "bar" : "dot",
          lineSpacing: ctx.ext.spacing,
        });
      });
    } else if (!col.text) {
      composeBulletsForColumn(ctx, els, { x: x + 0.26, y: innerY, w: widthForContent - 0.52, h: Math.max(body.y + body.h - innerY - 0.2, 0.6) }, (slide.bullets ?? []).slice(i === 0 ? 0 : Math.ceil((slide.bullets?.length ?? 0) / 2), i === 0 ? Math.ceil((slide.bullets?.length ?? 0) / 2) : undefined));
    }
  });
}

function composeBulletsForColumn(
  ctx: CompositionCtx,
  els: PptElement[],
  box: PptBox,
  bullets: string[]
): void {
  const t = ctx.theme;
  const list = bullets.filter(Boolean).slice(0, Math.ceil(ctx.ext.maxBullets / 2));
  if (!list.length) return;
  const size = typeSize(ctx, "body") - 0.5;
  const minSize = Math.max(size - 2, 12.5);
  const gap = 0.12;
  const per = list.length;
  const boxH = Math.max((box.h - (per - 1) * gap) / per, 0.42);
  list.forEach((b, i) => {
    addBulletItem(ctx, els, { x: box.x, y: box.y + i * (boxH + gap), w: box.w, h: boxH }, b, {
      size,
      minSize,
      color: safeText(ctx, t.background, t.text, 4.4),
      marker: t.accents === "bar" ? "bar" : "dot",
    });
  });
}

function columnsFromBullets(
  bullets: string[],
  count: number
): SlideColumn[] {
  if (!bullets?.length) return Array.from({ length: count }, () => ({ bullets: [] }));
  const per = Math.ceil(bullets.length / count);
  const cols: SlideColumn[] = [];
  for (let i = 0; i < count; i++) {
    cols.push({ bullets: bullets.slice(i * per, (i + 1) * per) });
  }
  return cols;
}

function composeFeatureGrid(
  ctx: CompositionCtx,
  els: PptElement[],
  body: PptBox,
  slide: SlideDefinition,
  cols: string
): void {
  const t = ctx.theme;
  const columns = (slide.columns ?? []).length >= 3 ? slide.columns! : columnsFromBullets(slide.bullets ?? [], 3);
  const count = Math.min(columns.length, 3);
  const gap = 0.26;
  const colW = (body.w - (count - 1) * gap) / count;
  const titleH = columns[columns.length - 1]?.title ? 0.5 : 0;

  columns.slice(0, count).forEach((col, i) => {
    const x = body.x + i * (colW + gap);
    addCard(ctx, els, { x, y: body.y, w: colW, h: body.h }, { accentPos: i === 0 ? "top" : "left", seed: i });
    let innerY = body.y + 0.24;
    if (col.title) {
      addFittedText(ctx, els, { x: x + 0.2, y: innerY, w: colW - 0.4, h: 0.6 }, col.title, {
        size: typeSize(ctx, "h2"),
        minSize: 14.5,
        color: safeText(ctx, t.panel, t.primary, 5),
        font: t.titleFont,
        bold: true,
        valign: "middle",
        lineSpacing: 1.05,
      });
      innerY += Math.min(titleH + 0.16, 0.66);
    }
    const contentH = body.y + body.h - innerY - 0.18;
    if (col.text) {
      addFittedText(ctx, els, { x: x + 0.2, y: innerY, w: colW - 0.4, h: col.bullets?.length ? contentH * 0.45 : contentH }, col.text, {
        size: typeSize(ctx, "small"),
        minSize: 12,
        color: safeText(ctx, t.panel, t.muted, 3.6),
        font: t.bodyFont,
        lineSpacing: ctx.ext.spacing,
      });
      innerY += contentH * 0.45;
    }
    if (col.bullets?.length) {
      const bsize = Math.max(typeSize(ctx, "body") - 1, 13);
      const per = col.bullets.length;
      const gapB = 0.1;
      const boxH = Math.max(((body.y + body.h - innerY - 0.2) - (per - 1) * gapB) / per, 0.4);
      col.bullets.slice(0, ctx.ext.maxBullets).forEach((b, bi) => {
        addBulletItem(ctx, els, { x: x + 0.2, y: innerY + bi * (boxH + gapB), w: colW - 0.4, h: boxH }, b, {
          size: bsize,
          minSize: Math.max(bsize - 2, 12),
          color: safeText(ctx, t.panel, t.text, 4.4),
          markerColor: i === 0 ? t.accent : i === 1 ? t.accent2 : t.accent3,
          marker: t.accents === "bar" ? "bar" : "dot",
        });
      });
    } else if (!col.text) {
      composeBulletsForColumn(ctx, els, { x: x + 0.2, y: innerY, w: colW - 0.4, h: body.y + body.h - innerY - 0.2 }, (slide.bullets ?? []).slice(i, 3 + i));
    }
  });
}

// ─── Big statements & stats ────────────────────────────────────────────────

function composeBigStatement(
  ctx: CompositionCtx,
  els: PptElement[],
  body: PptBox,
  slide: SlideDefinition
): void {
  const t = ctx.theme;
  const text = slide.subtitle || slide.bullets?.[0] || slide.title || "";
  const box: PptBox = { x: body.x + 0.4, y: body.y + 0.5, w: body.w - 0.8, h: body.h - 1.2 };
  const display = typeSize(ctx, "display") - 8;
  if (t.cardStyle !== "minimal") {
    addCard(ctx, els, box, { accentPos: "left", fill: t.panel });
  }
  addFittedText(ctx, els, { x: box.x + 0.5, y: box.y + 0.3, w: box.w - 1.0, h: box.h - 0.6 }, `“${text}”`, {
    size: display,
    minSize: 18,
    color: safeText(ctx, t.panel, t.primary, 5),
    font: t.titleFont,
    bold: true,
    align: t.kind === "dark" ? "center" : "left",
    valign: "middle",
    lineSpacing: 1.1,
  });
  if (slide.keyMessage?.context || slide.bullets?.[1]) {
    addFittedText(ctx, els, { x: box.x + 0.5, y: box.y + box.h - 0.7, w: box.w - 1.0, h: 0.42 }, slide.keyMessage?.context || slide.bullets![1], {
      size: typeSize(ctx, "small"),
      minSize: 12.5,
      color: safeText(ctx, t.panel, t.muted, 3.6),
      font: t.bodyFont,
      lineSpacing: 1.2,
    });
  }
}

function composeStatStrip(
  ctx: CompositionCtx,
  els: PptElement[],
  body: PptBox,
  slide: SlideDefinition
): void {
  const t = ctx.theme;
  const metrics = (slide.metrics ?? []).slice(0, 4);
  if (!metrics.length && slide.bullets?.length) {
    const data = extractData(slide);
    if (data.length >= 2) {
      metrics.length; // pass-through intentional
      composeStatStripFromNumbers(ctx, els, body, slide, data);
      return;
    }
  }
  if (!metrics.length) {
    composeBullets(ctx, els, body, slide.bullets ?? []);
    return;
  }
  const count = metrics.length;
  const gap = 0.26;
  const cardW = (body.w - (count - 1) * gap) / count;
  metrics.forEach((m, i) => {
    const x = body.x + i * (cardW + gap);
    const valueColor = safeText(ctx, t.panel, t.accent, 3.4);
    if (t.cardStyle === "minimal" || t.cardStyle === "outlined") {
      addShapeEl(els, { x, y: body.y, w: cardW, h: 0.025 }, "rect", { fill: t.accent });
    } else {
      addCard(ctx, els, { x, y: body.y, w: cardW, h: body.h }, { accentPos: "left", seed: i });
    }
    addFittedText(ctx, els, { x: x + 0.22, y: body.y + 0.25, w: cardW - 0.44, h: body.h * 0.4 }, String(m.value), {
      size: typeSize(ctx, "stat"),
      minSize: Math.max(26, PROFESSIONAL_MIN_FONT.stat * ctx.ext.scale),
      color: valueColor,
      font: t.titleFont,
      bold: true,
      valign: "middle",
      lineSpacing: 1,
    });
    addFittedText(ctx, els, { x: x + 0.22, y: body.y + body.h * 0.48, w: cardW - 0.44, h: body.h * 0.24 }, m.label, {
      size: typeSize(ctx, "h2"),
      minSize: 14,
      color: safeText(ctx, t.panel, t.primary, 5),
      font: t.titleFont,
      bold: true,
      valign: "top",
      lineSpacing: 1.1,
    });
    if (m.change) {
      addFittedText(ctx, els, { x: x + 0.22, y: body.y + body.h * 0.74, w: cardW - 0.44, h: body.h * 0.2 }, m.change, {
        size: typeSize(ctx, "small"),
        minSize: 11.5,
        color: safeText(ctx, t.panel, t.muted, 3.4),
        font: t.bodyFont,
        lineSpacing: 1,
      });
    }
  });
}

function composeStatStripFromNumbers(
  ctx: CompositionCtx,
  els: PptElement[],
  body: PptBox,
  _slide: SlideDefinition,
  data: Array<{ label: string; value: number }>
): void {
  const t = ctx.theme;
  const items = data.slice(0, 4);
  const count = items.length;
  const gap = 0.26;
  const cardW = (body.w - (count - 1) * gap) / count;
  items.forEach((d, i) => {
    const x = body.x + i * (cardW + gap);
    addCard(ctx, els, { x, y: body.y, w: cardW, h: body.h }, { accentPos: i === 0 ? "left" : "top", seed: i });
    addFittedText(ctx, els, { x: x + 0.2, y: body.y + 0.3, w: cardW - 0.4, h: body.h * 0.42 }, formatNumber(d.value), {
      size: typeSize(ctx, "stat") - 2,
      minSize: 24,
      color: safeText(ctx, t.panel, t.accent, 3.4),
      font: t.titleFont,
      bold: true,
      valign: "middle",
      lineSpacing: 1,
    });
    addFittedText(ctx, els, { x: x + 0.2, y: body.y + body.h * 0.54, w: cardW - 0.4, h: body.h * 0.34 }, d.label, {
      size: typeSize(ctx, "small"),
      minSize: 11.5,
      color: safeText(ctx, t.panel, t.muted, 3.4),
      font: t.bodyFont,
      lineSpacing: 1.12,
    });
  });
}

function formatNumber(v: number): string {
  if (v === 0) return "0";
  const abs = Math.abs(v);
  if (abs >= 1e9) return `${+(v / 1e9).toFixed(1)}B`;
  if (abs >= 1e6) return `${+(v / 1e6).toFixed(1)}M`;
  if (abs >= 1e3) return `${+(v / 1e3).toFixed(1)}K`;
  return String(v);
}

function composeBigNumber(
  ctx: CompositionCtx,
  els: PptElement[],
  body: PptBox,
  slide: SlideDefinition
): void {
  const t = ctx.theme;
  const metrics = slide.metrics ?? [];
  const data = extractData(slide);
  const m = metrics[0];
  const numberColor = safeText(ctx, t.background, t.accent, 3.4);
  const display = typeSize(ctx, "display") + 6;

  if (t.cardStyle !== "minimal") {
    addShapeEl(els, { x: 0, y: 0, w: W, h: H }, "rect", {
      fill: t.panel,
      opacity: 45,
    });
  }
  const numBox: PptBox = { x: body.x, y: body.y + 0.3, w: body.w, h: body.h * 0.45 };
  addFittedText(ctx, els, numBox, m ? String(m.value) : formatNumber(data[0]?.value ?? 0), {
    size: display,
    minSize: Math.max(30, PROFESSIONAL_MIN_FONT.stat * ctx.ext.scale + 4),
    color: numberColor,
    font: t.titleFont,
    bold: true,
    valign: "middle",
    lineSpacing: 1,
  });
  addShapeEl(els, { x: body.x, y: body.y + body.h * 0.52, w: 1.1, h: 0.035 }, "rect", { fill: t.accent });
  if (m?.label || data[0]?.label) {
    addFittedText(ctx, els, { x: body.x, y: body.y + body.h * 0.58, w: body.w, h: body.h * 0.2 }, m?.label ?? data[0].label, {
      size: typeSize(ctx, "h2"),
      minSize: 16,
      color: safeText(ctx, t.background, t.primary, 5),
      font: t.titleFont,
      bold: true,
      valign: "middle",
      lineSpacing: 1.1,
    });
  }
  if (m?.change || slide.subtitle) {
    addFittedText(ctx, els, { x: body.x, y: body.y + body.h * 0.8, w: body.w, h: body.h * 0.16 }, m?.change ?? slide.subtitle!, {
      size: typeSize(ctx, "small"),
      minSize: 12.5,
      color: safeText(ctx, t.background, t.muted, 3.4),
      font: t.bodyFont,
      lineSpacing: 1,
    });
  }
  if (!m && slide.bullets?.length) {
    const yBase = body.y + body.h * 0.62;
    (slide.bullets ?? []).slice(1, 3).forEach((b, i) => {
      addBulletItem(ctx, els, { x: body.x, y: yBase + 0.3 + i * 0.5, w: body.w, h: 0.45 }, b, {
        size: typeSize(ctx, "small"),
        minSize: 12,
        color: safeText(ctx, t.background, t.text, 4.4),
      });
    });
  }
}

// ─── Process / timeline ─────────────────────────────────────────────────────

function composeProcess(
  ctx: CompositionCtx,
  els: PptElement[],
  body: PptBox,
  steps: Array<{ step: number; title: string; description: string }>
): void {
  const t = ctx.theme;
  const count = Math.min(steps.length, 5);
  if (!count) return;
  const overlap = 0.3;
  const stepW = (body.w + overlap * (count - 1)) / count;
  const chevronH = body.h * 0.42;
  const chevY = body.y + body.h * 0.1;

  const accentFill = (i: number) => (i === 0 ? t.accent : i % 2 ? t.accent2 : t.accent);

  steps.slice(0, count).forEach((st, i) => {
    const x = body.x + i * (stepW - overlap);
    const fill = i === 0 ? t.accent : t.panel;
    const onFill = accentText(ctx, fill);
    addShapeEl(els, { x, y: chevY, w: stepW, h: chevronH }, "chevron", {
      fill,
      lineColor: undefined,
      lineWidth: 0,
    });
    if (t.cardStyle !== "hard") {
      addShapeEl(els, { x: x + 0.12, y: chevY + 0.1, w: stepW - 0.6, h: chevronH - 0.2 }, "rect", {
        opacity: 22,
      });
    }
    addFittedText(ctx, els, { x: x + 0.18, y: chevY + 0.16, w: stepW - 0.4, h: 0.28 }, `0${st.step}`.slice(-2), {
      size: typeSize(ctx, "label"),
      minSize: 10,
      color: onFill,
      font: t.labelFont,
      bold: true,
      valign: "middle",
      lineSpacing: 1,
    });
    addFittedText(ctx, els, { x: x + 0.18, y: chevY + 0.46, w: stepW - 0.5, h: 0.42 }, st.title, {
      size: typeSize(ctx, "h2"),
      minSize: 14,
      color: onFill,
      font: t.titleFont,
      bold: true,
      valign: "top",
      lineSpacing: 1,
    });
    const descY = chevY + chevronH + 0.12;
    addFittedText(ctx, els, { x: x + 0.14, y: descY, w: stepW - 0.38, h: body.h - 0.12 - (descY - body.y) }, st.description, {
      size: typeSize(ctx, "small"),
      minSize: 11.5,
      color: safeText(ctx, t.background, t.muted, 3.4),
      font: t.bodyFont,
      lineSpacing: 1.15,
    });
  });
}

function composeTimeline(
  ctx: CompositionCtx,
  els: PptElement[],
  body: PptBox,
  steps: Array<{ step: number; title: string; description: string }>
): void {
  const t = ctx.theme;
  const count = Math.min(steps.length, 5);
  if (!count) return;
  const lineY = body.y + body.h * 0.34;
  const gap = 0.24;
  const nodeW = (body.w - (count - 1) * gap) / count;

  addShapeEl(els, { x: body.x, y: lineY, w: body.w, h: 0.012 }, "rect", { fill: t.panelBorder });
  steps.slice(0, count).forEach((st, i) => {
    const cx = body.x + i * (nodeW + gap) + nodeW / 2;
    const onAccent = accentText(ctx, t.accent);
    if (i === 0 || i === count - 1) {
      addShapeEl(els, { x: cx - 0.08, y: lineY - 0.062, w: 0.16, h: 0.16 }, "ellipse", { fill: t.accent });
      els.push({
        kind: "text",
        box: { x: cx - 0.3, y: lineY - 0.07, w: 0.6, h: 0.2 },
        text: String(i + 1),
        fontSize: 10,
        bold: true,
        color: onAccent,
        font: t.titleFont,
        align: "center",
        valign: "middle",
      });
    } else {
      addShapeEl(els, { x: cx - 0.05, y: lineY - 0.04, w: 0.12, h: 0.12 }, "ellipse", {
        fill: t.background,
        lineColor: t.accent,
        lineWidth: t.borderWidth,
      });
    }
    // label / description stacked above and below the line
    const yTop = lineY - 0.16;
    const yBot = lineY + 0.22;
    addFittedText(ctx, els, { x: cx - nodeW / 2 + 0.16, y: yTop, w: nodeW - 0.32, h: 1.15 }, `${st.step}. ${st.title}`, {
      size: typeSize(ctx, "small"),
      minSize: 11.5,
      color: safeText(ctx, t.background, t.primary, 4.6),
      font: t.titleFont,
      bold: true,
      align: "center",
      valign: "bottom",
      lineSpacing: 1,
    });
    addFittedText(ctx, els, { x: cx - nodeW / 2 + 0.16, y: yBot, w: nodeW - 0.32, h: body.y + body.h - yBot - 0.1 }, st.description, {
      size: typeSize(ctx, "small"),
      minSize: 11,
      color: safeText(ctx, t.background, t.muted, 3.4),
      font: t.bodyFont,
      align: "center",
      valign: "top",
      lineSpacing: 1.15,
    });
  });
}

// ─── Comparison ─────────────────────────────────────────────────────────────

function composeComparison(
  ctx: CompositionCtx,
  els: PptElement[],
  body: PptBox,
  slide: SlideDefinition
): void {
  const t = ctx.theme;
  const cols = (slide.columns ?? []).length >= 2
    ? slide.columns!
    : columnsFromBullets(slide.bullets ?? [], 2);
  const gap = 0.0;
  const colW = (body.w - gap) / 2;
  const headerH = 0.72;

  cols.slice(0, 2).forEach((col, i) => {
    const x = body.x + i * (colW + gap);
    const headerFill = i === 0 ? t.accent : t.accent2;
    addShapeEl(els, { x, y: body.y, w: colW, h: headerH }, "rect", { fill: headerFill });
    const title = col.title || (i === 0 ? "Option A" : "Option B");
    addTextEl(els, { x: x, y: body.y, w: colW, h: headerH }, title, {
      size: typeSize(ctx, "h2") + 1,
      color: accentText(ctx, headerFill),
      font: t.titleFont,
      bold: true,
      valign: "middle",
      align: "center",
      lineSpacing: 1.05,
    });
  });

  const rows = Math.max(
    colContentCount(cols[0]),
    colContentCount(cols[1])
  );
  const rowArea: PptBox = { x: body.x, y: body.y + headerH + 0.14, w: body.w, h: body.h - headerH - 0.14 };
  const n = Math.max(rows, 1);
  const rowH = Math.min(rowArea.h / n, 1.0);
  const itemsA = colItems(cols[0]);
  const itemsB = colItems(cols[1]);

  for (let r = 0; r < n; r++) {
    const ry = rowArea.y + r * rowH;
    const a = itemsA[r];
    const b = itemsB[r];
    if (r % 2 === 0) {
      addShapeEl(els, { x: body.x, y: ry, w: body.w, h: rowH }, "rect", { fill: t.surfaceAlt, opacity: 55 });
    }
    if (a) {
      addBulletItem(ctx, els, { x: body.x + 0.22, y: ry + 0.06, w: colW - 0.44, h: rowH - 0.12 }, a, {
        size: typeSize(ctx, "small"),
        minSize: 11.5,
        color: safeText(ctx, t.background, t.text, 4.4),
      });
    }
    if (b) {
      addBulletItem(ctx, els, { x: body.x + colW + 0.22, y: ry + 0.06, w: colW - 0.44, h: rowH - 0.12 }, b, {
        size: typeSize(ctx, "small"),
        minSize: 11.5,
        color: safeText(ctx, t.background, t.text, 4.4),
      });
    }
  }
}

function colItems(col: { title?: string; text?: string; bullets?: string[] }): string[] {
  const out: string[] = [];
  if (col.text) out.push(col.text);
  out.push(...(col.bullets ?? []));
  return out;
}

function colContentCount(col: { title?: string; text?: string; bullets?: string[] }): number {
  return (col.text ? 1 : 0) + (col.bullets?.length ?? 0);
}

// ─── Architecture (technical / data) ────────────────────────────────────────

function composeArchitecture(
  ctx: CompositionCtx,
  els: PptElement[],
  body: PptBox,
  slide: SlideDefinition
): void {
  const t = ctx.theme;
  const cols = (slide.columns ?? []).length >= 2
    ? slide.columns!
    : columnsFromBullets(slide.bullets ?? [], slide.columns?.length || 3);
  const count = Math.min(cols.length, 4);
  const railW = 1.6;
  const gap = 0.2;
  const nodesArea = body.w - railW;
  const boxW = (nodesArea - (count - 1) * gap) / count;
  const topLabelH = 0.4;

  // Node rail
  addShapeEl(els, { x: body.x, y: body.y, w: 1.5, h: 0.55 }, "roundRect", {
    fill: t.accent,
    radius: 0.08,
  });
  addFittedText(ctx, els, { x: body.x + 0.18, y: body.y + 0.06, w: 1.2, h: 0.42 }, slide.title && slide.title.length <= 24 ? slide.title : "COMPONENTS", {
    size: typeSize(ctx, "small"),
    minSize: 10.5,
    color: accentText(ctx, t.accent),
    font: t.labelFont,
    bold: true,
    valign: "middle",
    lineSpacing: 1,
  });

  const nodesY = body.y + 0.75;
  const nodesH = body.y + body.h - nodesY - 0.3;

  // connector line
  addShapeEl(els, { x: body.x + railW, y: body.y + 0.27, w: nodesArea, h: 0.012 }, "rect", { fill: t.accent, opacity: 60 });

  const nodeBoxes = cols.slice(0, count).map((col, i) => {
    const x = body.x + railW + i * (boxW + gap);
    const w = boxW;
    return { x, w, col };
  });

  nodeBoxes.forEach((nb, i) => {
    addShapeEl(els, { x: nb.x, y: nodesY, w: nb.w, h: nodesH }, "roundRect", {
      fill: t.panel,
      lineColor: i === 0 ? t.accent : t.panelBorder,
      lineWidth: i === 0 ? 1.2 : t.borderWidth,
      radius: Math.max(t.radius, 0.06),
    });
    addShapeEl(els, { x: nb.x + 0.14, y: nodesY + 0.16, w: 0.1, h: 0.1 }, "ellipse", { fill: i === 0 ? t.accent : t.accent2 });
    if (nb.col.title) {
      addFittedText(ctx, els, { x: nb.x + 0.32, y: nodesY + 0.1, w: nb.w - 0.44, h: 0.28 }, nb.col.title.toUpperCase(), {
        size: typeSize(ctx, "label"),
        minSize: 9,
        color: safeText(ctx, t.panel, t.accent, 3.2),
        font: t.labelFont,
        bold: true,
        valign: "middle",
        lineSpacing: 1,
        letterSpacing: 0.6,
      });
    }
    const parent = nodesY + 0.56;
    const contentList = (nb.col.bullets?.length ? nb.col.bullets : nb.col.text ? [nb.col.text] : []).slice(0, 4);
    const per = Math.max(contentList.length, 1);
    const rowH = (nodesY + nodesH - parent - 0.14) / per;
    contentList.forEach((b, bi) => {
      addFittedText(ctx, els, { x: nb.x + 0.16, y: parent + bi * rowH, w: nb.w - 0.32, h: rowH }, b, {
        size: 11.5,
        minSize: 10,
        color: safeText(ctx, t.panel, t.text, 4.2),
        font: t.bodyFont,
        valign: "top",
        lineSpacing: 1.12,
      });
    });
  });
}

// ─── Table ──────────────────────────────────────────────────────────────────

function composeTable(
  ctx: CompositionCtx,
  els: PptElement[],
  body: PptBox,
  slide: SlideDefinition
): void {
  const t = ctx.theme;
  if (!slide.table || !slide.table.rows.length) {
    composeBullets(ctx, els, body, slide.bullets ?? []);
    return;
  }
  const headers = (slide.table.headers ?? []).slice(0, 6);
  const rows = slide.table.rows.map(r => r.slice(0, 6)).slice(0, 8);
  const colCount = Math.max(headers.length, ...rows.map(r => r.length), 0);
  if (!colCount) return;
  const gap = 0.012;
  const colW = (body.w - (colCount - 1) * gap) / colCount;
  const rowCount = rows.length + (headers.length ? 1 : 0);
  const rowH = Math.min(body.h / rowCount, 0.6);

  const headerH = headers.length ? rowH : 0;
  const headerFill = t.primary;
  const headerColor = safeText(ctx, headerFill, t.invertedText, 4.5);
  const borderColor = t.cardStyle === "minimal" ? t.panelBorder : t.panelBorder;

  headers.forEach((h, c) => {
    const x = body.x + c * (colW + gap);
    addShapeEl(els, { x, y: body.y, w: colW, h: headerH }, "rect", { fill: headerFill });
    addTextEl(els, { x: x + 0.08, y: body.y + 0.04, w: colW - 0.16, h: headerH - 0.08 }, h, {
      size: Math.min(typeSize(ctx, "small"), 12.5),
      color: headerColor,
      font: t.bodyFont,
      bold: true,
      valign: "middle",
      lineSpacing: 1,
    });
  });

  const fontSize = Math.max(Math.min(typeSize(ctx, "body") - 1.5, 12.5), 10.5);

  rows.forEach((row, r) => {
    const rowY = body.y + headerH + r * (rowH + gap);
    const isAlt = r % 2 === 1;
    const rowFill = isAlt ? t.sectionBackground : t.background;
    row.forEach((cell, c) => {
      const x = body.x + c * (colW + gap);
      addShapeEl(els, { x, y: rowY, w: colW, h: rowH }, "rect", { fill: rowFill });
      addTextEl(els, { x: x + 0.08, y: rowY + 0.03, w: colW - 0.16, h: rowH - 0.06 }, cell, {
        size: fontSize,
        color: safeText(ctx, rowFill, t.text, 4.4),
        font: t.bodyFont,
        valign: "middle",
        lineSpacing: 1,
      });
    });
    if (r < rows.length - 1 && borderColor) {
      addShapeEl(els, { x: body.x, y: rowY + rowH, w: body.w, h: 0.01 }, "line", {
        lineColor: borderColor,
        lineWidth: 0.5,
        opacity: 40,
      });
    }
  });
}

// ─── Definition / feature term ──────────────────────────────────────────────

function composeDefinition(
  ctx: CompositionCtx,
  els: PptElement[],
  body: PptBox,
  slide: SlideDefinition
): void {
  const t = ctx.theme;
  const term = slide.subtitle || slide.title || "Concept";
  const colW = body.w * 0.34;
  const defW = body.w - colW - 0.5;

  addShapeEl(els, { x: body.x, y: body.y + 0.1, w: 0.06, h: body.h - 0.2 }, "rect", { fill: t.accent });
  addFittedText(ctx, els, { x: body.x + 0.24, y: body.y + 0.3, w: colW, h: 1.2 }, term, {
    size: typeSize(ctx, "display") - 10,
    minSize: 20,
    color: safeText(ctx, t.background, t.primary, 5),
    font: t.titleFont,
    bold: true,
    valign: "top",
    lineSpacing: 1.05,
  });
  const list = (slide.bullets ?? []).slice(0, ctx.ext.maxBullets);
  const defBox: PptBox = { x: body.x + colW + 0.6, y: body.y + 0.28, w: defW, h: body.h - 0.4 };
  const per = Math.max(list.length, 1);
  const rowH = (defBox.h - (per - 1) * 0.14) / per;
  if (!list.length) {
    addFittedText(ctx, els, defBox, slide.subtitle || slide.title || "", {
      size: typeSize(ctx, "body"),
      minSize: 13,
      color: safeText(ctx, t.background, t.text, 4.5),
      font: t.bodyFont,
      lineSpacing: 1.3,
    });
    return;
  }
  list.forEach((b, i) => {
    addBulletItem(ctx, els, { x: defBox.x, y: defBox.y + i * (rowH + 0.14), w: defBox.w, h: rowH }, b, {
      size: typeSize(ctx, "body"),
      minSize: 13,
      color: safeText(ctx, t.background, t.text, 4.5),
      marker: t.accents === "bar" ? "bar" : "dot",
    });
  });
}

// ─── Quote ──────────────────────────────────────────────────────────────────

function composeQuote(
  ctx: CompositionCtx,
  els: PptElement[],
  body: PptBox,
  slide: SlideDefinition
): void {
  const t = ctx.theme;
  const quote = slide.quote?.text || (slide.bullets && slide.bullets.filter(Boolean).join(" ")) || slide.subtitle || slide.title || "";
  const author = slide.quote?.author;
  const box: PptBox = { x: body.x + 0.15, y: body.y + 0.2, w: body.w - 0.3, h: body.h - 0.4 };

  if (t.cardStyle !== "minimal") {
    addCard(ctx, els, box, { accentPos: "left", fill: t.panel });
  }
  els.push({
    kind: "text",
    box: { x: box.x + 0.42, y: box.y + 0.18, w: 0.7, h: 0.5 },
    text: "“",
    fontSize: 34,
    bold: true,
    color: safeText(ctx, t.panel, t.accent, 3.2),
    font: t.titleFont,
    valign: "top",
    lineSpacing: 1,
  });
  addFittedText(ctx, els, { x: box.x + 0.65, y: box.y + 0.5, w: box.w - 1.0, h: box.h * 0.5 }, quote, {
    size: typeSize(ctx, "h2") + 1,
    minSize: 14,
    color: safeText(ctx, t.panel, t.primary, 5),
    font: t.titleFont,
    italic: true,
    valign: "top",
    lineSpacing: 1.28,
  });
  if (author) {
    addFittedText(ctx, els, { x: box.x + 0.65, y: box.y + box.h - 0.7, w: box.w - 1.0, h: 0.5 }, `— ${author}`, {
      size: typeSize(ctx, "small"),
      minSize: 12,
      color: safeText(ctx, t.panel, t.muted, 3.4),
      font: t.bodyFont,
      bold: true,
      lineSpacing: 1.1,
    });
  }
}

// ─── Key message ────────────────────────────────────────────────────────────

function composeKeyMessage(
  ctx: CompositionCtx,
  els: PptElement[],
  body: PptBox,
  slide: SlideDefinition
): void {
  const t = ctx.theme;
  const msgBox: PptBox = { x: body.x + 0.3, y: body.y + 0.2, w: body.w - 0.6, h: body.h - 0.55 };
  addCard(ctx, els, msgBox, { accentPos: "left", fill: t.panel });
  if (slide.subtitle) {
    addFittedText(ctx, els, { x: msgBox.x + 0.55, y: msgBox.y + 0.28, w: msgBox.w - 1.0, h: 0.28 }, slide.subtitle.toUpperCase(), {
      size: typeSize(ctx, "label"),
      minSize: 9.5,
      color: safeText(ctx, t.panel, t.accent, 3.2),
      font: t.labelFont,
      bold: true,
      letterSpacing: 1.5,
    });
  }
  addFittedText(
    ctx,
    els,
    { x: msgBox.x + 0.55, y: msgBox.y + 0.66, w: msgBox.w - 1.1, h: msgBox.h * 0.48 },
    slide.keyMessage?.statement || slide.title || "",
    {
      size: typeSize(ctx, "h2") + 4,
      minSize: 17,
      color: safeText(ctx, t.panel, t.primary, 5),
      font: t.titleFont,
      bold: true,
      align: "center",
      valign: "middle",
      lineSpacing: 1.2,
    }
  );
  if (slide.keyMessage?.context || slide.title) {
    addFittedText(
      ctx,
      els,
      { x: msgBox.x + 0.7, y: msgBox.y + msgBox.h * 0.64, w: msgBox.w - 1.4, h: msgBox.h * 0.28 },
      slide.keyMessage?.context || slide.title || "",
      {
        size: typeSize(ctx, "small"),
        minSize: 12,
        color: safeText(ctx, t.panel, t.muted, 3.6),
        font: t.bodyFont,
        align: "center",
        lineSpacing: ctx.ext.spacing,
      }
    );
  }
}

// ─── Chart strip ────────────────────────────────────────────────────────────

function addBarChart(
  ctx: CompositionCtx,
  els: PptElement[],
  box: PptBox,
  data: Array<{ label: string; value: number }>,
  opts: { size?: number; labelColor?: string } = {}
): void {
  const t = ctx.theme;
  const size = opts.size ?? 10.5;
  const labelColor = opts.labelColor ?? safeText(ctx, t.background, t.muted, 3.2);
  const max = Math.max(...data.map(d => d.value), 1);
  const n = Math.min(data.length, 6);
  const chartW = box.w;
  const chartH = box.h;
  const barGap = Math.min(0.35, chartW / (n * 2));
  const barW = Math.max((chartW - (n - 1) * barGap) / n, 0.4);
  const baseline = box.y + chartH - 0.42;

  data.slice(0, n).forEach((d, i) => {
    const h = Math.max((d.value / max) * (chartH - 0.75), 0.12);
    const x = box.x + i * (barW + barGap);
    const y = baseline - h;
    if (x + barW > box.x + box.w) return;
    addShapeEl(els, { x, y, w: barW, h }, "rect", {
      fill: t.chartColors[i % t.chartColors.length],
      radius: t.barRadius,
      opacity: 96,
    });
    els.push({
      kind: "text",
      box: { x, y: Math.max(y - 0.3, box.y), w: barW, h: 0.26 },
      text: String(Math.round(d.value)).replace(/\B(?=(\d{3})+(?!\d))/g, ","),
      fontSize: size,
      color: safeText(ctx, t.background, t.text, 4.4),
      align: "center",
      valign: "bottom",
      font: t.bodyFont,
      lineSpacing: 1,
    });
    const labelW = barW * 1.8;
    const labelX = Math.min(Math.max(x - labelW / 2, box.x), box.x + box.w - labelW);
    els.push({
      kind: "text",
      box: { x: labelX, y: baseline + 0.08, w: labelW, h: 0.34 },
      text: d.label,
      fontSize: Math.max(size - 1.5, 9),
      color: labelColor,
      align: "center",
      valign: "top",
      font: t.bodyFont,
      lineSpacing: 1,
    });
  });
}

function composeChartStrip(
  ctx: CompositionCtx,
  els: PptElement[],
  body: PptBox,
  slide: SlideDefinition
): void {
  const t = ctx.theme;
  const data = extractData(slide);
  if (data.length < 3) {
    composeBullets(ctx, els, body, slide.bullets ?? []);
    return;
  }
  const textW = body.w * 0.34;
  const chartBox: PptBox = { x: body.x + textW + 0.45, y: body.y + 0.25, w: body.w - textW - 0.45, h: body.h - 0.4 };

  // Left: concise takeaways.
  ensureText: {
    const list = (slide.bullets ?? []).filter(b => b && b.trim()).slice(0, 3);
    const gap = 0.16;
    const boxH = (body.h - (gap * 2)) / (Math.max(list.length, 1));
    list.forEach((b, i) => {
      addBulletItem(ctx, els, { x: body.x, y: body.y + 0.1 + i * (boxH + gap), w: textW - 0.3, h: boxH }, b, {
        size: typeSize(ctx, "small"),
        minSize: 11.5,
        color: safeText(ctx, t.background, t.text, 4.4),
      });
    });
  }

  addCard(ctx, els, chartBox, { accentPos: "top", fill: t.panel });
  els.push({
    kind: "text",
    box: { x: chartBox.x + 0.2, y: chartBox.y + 0.16, w: chartBox.w - 0.4, h: 0.26 },
    text: "QUANTITATIVE VIEW",
    fontSize: typeSize(ctx, "label"),
    bold: true,
    color: safeText(ctx, t.panel, t.accent, 3.2),
    font: t.labelFont,
    valign: "middle",
    letterSpacing: 1.2,
  });
  addBarChart(ctx, els, { x: chartBox.x + 0.2, y: chartBox.y + 0.5, w: chartBox.w - 0.4, h: chartBox.h - 0.6 }, data.slice(0, 6), {
    size: 10,
    labelColor: safeText(ctx, t.panel, t.muted, 3.2),
  });
}

// ─── Deck assembly ──────────────────────────────────────────────────────────

export function buildPresentationSpec(input: {
  title: string;
  slides: SlideDefinition[];
  config: PresentationConfig;
  styleName?: PptVisualStyle;
  footerLabel?: string;
  notes?: Array<string | undefined>;
}): PptPresentationSpec {
  const styleName = input.styleName;
  const theme: ThemeSpec = resolveTheme(styleName, input.title);
  const density = densityOf(input.config.density);
  const strategy = strategyOf(input.config.layout);
  const effDensity: ConcreteDensity =
    strategy === "Dense Professional" ? "Detailed" : density;
  const baseVisuals = visualsOf(input.config.visuals);
  const visuals: Visuals =
    strategy === "Minimal" && baseVisuals !== "No Images" ? "No Images" : baseVisuals;
  const ext = DENSITY_EXTRAS[effDensity];

  const slides = input.slides.length ? input.slides : [{ title: input.title }];
  const totalSlides = Math.max(slides.length, 1);
  const plans = planLayouts(slides, theme, visuals);

  const specSlides: PptSlideSpec[] = [];
  const seedLabel = input.footerLabel || input.title;

  slides.forEach((rawSlide, index) => {
    const t = theme;
    const els: PptElement[] = [];
    const layout = plans[index] ?? "bullets";
    const ctx: CompositionCtx = {
      theme: t,
      config: input.config,
      strategy,
      density: effDensity,
      ext,
      index,
      total: totalSlides,
      deckTitle: input.title,
    };

    // Background chosen per slide role.
    let bg = t.background;
    if (layout === "title") bg = t.titleBackground;
    if (layout === "section") bg = t.sectionBackground;

    if (layout === "title") {
      composeTitleSlide(ctx, els, rawSlide, input.title);
      specSlides.push({ index, kind: "title", background: bg, elements: els, notes: input.notes?.[index] });
      return;
    }
    if (layout === "section") {
      composeSectionSlide(ctx, els, rawSlide, input.title);
      specSlides.push({ index, kind: "section", background: bg, elements: els, notes: input.notes?.[index] });
      return;
    }

    // Content-slide accent strip for light styles with band accents.
    if (layout !== "closing" && t.headerRule === "bar" && theme.kind === "light") {
      // subtle top hairline handled inside composeHeader visuals (skipped here
      // to avoid a hard color bar on every slide).
    }

    const heading = slideHeadingFor(rawSlide, index);
    const header = composeHeader(ctx, els, rawSlide.title || "Overview", heading, rawSlide.subtitle);
    const body: PptBox = { x: header.x, y: header.y, w: header.w, h: header.h };

    switch (layout) {
      case "overview":
        composeOverview(ctx, els, body, rawSlide);
        break;
      case "bullets":
        composeBullets(ctx, els, body, rawSlide.bullets ?? []);
        break;
      case "bullets_rail":
        composeBulletsRail(ctx, els, body, rawSlide);
        break;
      case "two_column":
        composeTwoColumn(ctx, els, body, rawSlide);
        break;
      case "feature_grid":
        composeFeatureGrid(ctx, els, body, rawSlide, "three_column");
        break;
      case "big_statement":
        composeBigStatement(ctx, els, body, rawSlide);
        break;
      case "stat_strip":
        composeStatStrip(ctx, els, body, rawSlide);
        break;
      case "big_number":
        composeBigNumber(ctx, els, body, rawSlide);
        break;
      case "process":
        composeProcess(ctx, els, body, rawSlide.steps || stepsFromBullets(rawSlide));
        break;
      case "timeline":
        composeTimeline(ctx, els, body, rawSlide.steps || stepsFromBullets(rawSlide));
        break;
      case "comparison":
        composeComparison(ctx, els, body, rawSlide);
        break;
      case "architecture":
        composeArchitecture(ctx, els, body, rawSlide);
        break;
      case "table":
        composeTable(ctx, els, body, rawSlide);
        break;
      case "definition":
        composeDefinition(ctx, els, body, rawSlide);
        break;
      case "quote":
        composeQuote(ctx, els, body, rawSlide);
        break;
      case "key_message":
        composeKeyMessage(ctx, els, body, rawSlide);
        break;
      case "chart_strip":
        composeChartStrip(ctx, els, body, rawSlide);
        break;
      case "closing":
        composeClosing(ctx, els, body, rawSlide);
        break;
      default:
        composeBullets(ctx, els, body, rawSlide.bullets ?? []);
    }

    if (rawSlide.footnote) {
      const fn = rawSlide.footnote.trim();
      const isPageOrMeta =
        /^(slide|page)?\s*\d+(\s*(of|\/)\s*\d+)?$/i.test(fn) ||
        /^\d+\s*[\/of]\s*\d+$/i.test(fn) ||
        (input.title && fn.toLowerCase().includes(input.title.toLowerCase())) ||
        (seedLabel && fn.toLowerCase().includes(seedLabel.toLowerCase()));
      if (!isPageOrMeta) {
        addFittedText(
          ctx,
          els,
          { x: ML, y: H - 0.42, w: CW, h: 0.26 },
          fn,
          {
            size: typeSize(ctx, "caption"),
            minSize: 9,
            color: safeText(ctx, t.background, t.muted, 3.2),
            font: t.bodyFont,
          }
        );
      }
    }

    const notes = input.notes?.[index];
    specSlides.push({ index, kind: layout, background: bg, elements: els, notes });
  });

  return {
    version: 1,
    widthIn: W,
    heightIn: H,
    title: input.title,
    themeKey: theme.key,
    style: theme.name,
    selectedStyle: input.styleName || input.config.visualStyle || "auto",
    resolvedStyle: theme.key,
    styleVersion: "2.0",
    config: input.config,
    slides: specSlides,
  };
}

function stepsFromBullets(slide: SlideDefinition): Array<{ step: number; title: string; description: string }> {
  return ((slide.bullets ?? []).filter(Boolean).slice(0, 5)).map((b, i) => {
    const sep = b.indexOf(":");
    if (sep > 4 && sep < 60) {
      return { step: i + 1, title: b.slice(0, sep).trim(), description: b.slice(sep + 1).trim() };
    }
    return { step: i + 1, title: b.slice(0, Math.min(b.length, 42)), description: "" };
  });
}

function slideHeadingFor(slide: SlideDefinition, _index: number): string {
  const title = slide.title?.trim();
  if (!title || title.length <= 52) return title || "";
  return title.slice(0, 52);
}

// Re-export for backward compatibility.
export { SAFE_MARGIN };