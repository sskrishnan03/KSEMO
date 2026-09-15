/**
 * Presentation layout engine.
 *
 * Converts semantic slide content (the AI's plan) + a visual style + the user's
 * configuration into a canonical `PptPresentationSpec` with explicitly bounded
 * elements. Every element is fitted by the text engine and validated against
 * safe margins. Both the preview renderer and the PPTX exporter consume this
 * exact specification.
 */

import {
  SLIDE_WIDTH_IN,
  SLIDE_HEIGHT_IN,
  SAFE_MARGIN,
  type PptBox,
  type PptElement,
  type PptPresentationSpec,
  type PptSlideSpec,
  type PptVisualStyle,
  type PresentationConfig,
} from "@shared/presentation";
import type { SlideDefinition } from "../spec";
import { fitText, measureLines, PROFESSIONAL_MIN_FONT } from "./textFit";
import { VISUAL_THEMES, pickAutoTheme, type ThemeSpec } from "./themes";

const W = SLIDE_WIDTH_IN;
const H = SLIDE_HEIGHT_IN;

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

// Scale fonts / spacing by density so the amount of information per slide
// actually changes, without ever dropping below professional readability.
const DENSITY_EXTRAS: Record<ConcreteDensity, {
  scale: number;
  spacing: number;
  maxBullets: number;
  minBody: number;
  minTable: number;
}> = {
  Light: { scale: 1.1, spacing: 1.25, maxBullets: 4, minBody: 12, minTable: 9 },
  Standard: { scale: 1.0, spacing: 1.18, maxBullets: 6, minBody: 11, minTable: 9 },
  Detailed: { scale: 0.93, spacing: 1.12, maxBullets: 8, minBody: 10.5, minTable: 9 },
  Research: { scale: 0.87, spacing: 1.06, maxBullets: 12, minBody: 10, minTable: 8.5 },
};

type Extras = (typeof DENSITY_EXTRAS)[ConcreteDensity];

type SlideContext = {
  theme: ThemeSpec;
  config: PresentationConfig;
  strategy: Strategy;
  density: Density;
  visuals: Visuals;
  ext: Extras;
  totalSlides: number;
};

/** Splits an overly long title into a short title + supporting subtitle. */
function splitLongTitle(
  raw: string
): { title: string; subtitle?: string } {
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

function addFittedText(
  ctx: SlideContext,
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
  const el: PptElement = {
    kind: "text",
    box,
    text,
    fontSize: +fitted.fontSize.toFixed(2),
    bold: opts.bold,
    color: opts.color,
    align: opts.align ?? "left",
    valign: opts.valign ?? "top",
    italic: opts.italic,
    font: opts.font ?? ctx.theme.bodyFont,
    lineSpacing: opts.lineSpacing ?? ctx.ext.spacing,
    letterSpacing: opts.letterSpacing,
    opacity: opts.opacity,
  };
  els.push(el);
  return el;
}

function addVisualPanel(
  ctx: SlideContext,
  els: PptElement[],
  box: PptBox,
  seed: number
): void {
  // Decorative abstract composition used for "image" slots. Composed purely
  // from theme shapes so the deck stays professional and never depends on
  // external image URLs that could break or stretch.
  const t = ctx.theme;
  addShapeEl(els, box, "roundRect", {
    fill: t.panel,
    lineColor: t.panelBorder,
    lineWidth: 1,
    radius: t.radius,
  });
  const ring = Math.min(box.w, box.h) * (0.5 + (seed % 3) * 0.09);
  const cx = box.x + box.w * (0.42 + ((seed % 5) * 0.07));
  const cy = box.y + box.h * 0.48;
  addShapeEl(
    els,
    { x: cx - ring / 2, y: cy - ring / 2, w: ring, h: ring },
    "ellipse",
    { lineColor: t.accent, lineWidth: 1.2, opacity: 65 }
  );
  addShapeEl(
    els,
    { x: box.x + box.w * 0.12, y: box.y + box.h * 0.16, w: box.w * 0.32, h: box.h * 0.15 },
    "rect",
    { fill: t.accent, opacity: 90 }
  );
  addShapeEl(
    els,
    { x: box.x + box.w * 0.12, y: box.y + box.h * 0.48, w: box.w * 0.46, h: box.h * 0.07 },
    "rect",
    { fill: t.secondary, opacity: 60 }
  );
  addShapeEl(
    els,
    { x: box.x + box.w * 0.12, y: box.y + box.h * 0.6, w: box.w * 0.38, h: box.h * 0.07 },
    "rect",
    { fill: t.panelBorder, opacity: 80 }
  );
  addShapeEl(
    els,
    { x: box.x + box.w * 0.12, y: box.y + box.h * 0.72, w: box.w * 0.42, h: box.h * 0.07 },
    "rect",
    { fill: t.accent2, opacity: 55 }
  );
}

function addFooter(
  ctx: SlideContext,
  els: PptElement[],
  slideIndex: number,
  label: string
): void {
  const t = ctx.theme;
  const fy = 6.8;
  if (t.kind === "dark") {
    addShapeEl(
      els,
      { x: SAFE_MARGIN.left, y: fy + 0.02, w: 0.5, h: 0.035 },
      "rect",
      { fill: t.accent, opacity: 70 }
    );
  }
  els.push({
    kind: "text",
    box: { x: SAFE_MARGIN.left + 0.55, y: fy - 0.03, w: 7, h: 0.24 },
    text: label,
    fontSize: 8.5,
    color: t.muted,
    font: t.bodyFont,
    lineSpacing: 1,
    valign: "middle",
    opacity: 85,
  });
  els.push({
    kind: "text",
    box: { x: W - SAFE_MARGIN.right - 1.1, y: fy - 0.03, w: 1.1, h: 0.24 },
    text: `${slideIndex} / ${ctx.totalSlides}`,
    fontSize: 8.5,
    color: t.muted,
    font: t.bodyFont,
    align: "right",
    valign: "middle",
    lineSpacing: 1,
    opacity: 85,
  });
}

function addHeader(
  ctx: SlideContext,
  els: PptElement[],
  rawTitle: string,
  heading: string,
  subtitle?: string
): { bodyTop: number; bodyBottom: number } {
  const t = ctx.theme;
  const split = splitLongTitle(rawTitle);
  const title = split.title;
  const effSubtitle = split.subtitle || subtitle;

  if (t.useKicker) {
    addFittedText(
      ctx,
      els,
      { x: SAFE_MARGIN.left, y: SAFE_MARGIN.top, w: 9, h: 0.24 },
      heading.toUpperCase(),
      {
        size: 10.5,
        minSize: 8,
        color: t.accent,
        font: t.bodyFont,
        bold: true,
        letterSpacing: 1.2,
        opacity: 90,
      }
    );
  }

  const titleY = t.useKicker ? 0.84 : 0.64;
  addFittedText(
    ctx,
    els,
    {
      x: SAFE_MARGIN.left,
      y: titleY,
      w: W - SAFE_MARGIN.left - SAFE_MARGIN.right,
      h: effSubtitle ? 0.86 : 1.0,
    },
    title,
    {
      size: 27 * ctx.ext.scale,
      minSize: Math.max(18, PROFESSIONAL_MIN_FONT.title * 0.9),
      color: t.primary,
      font: t.titleFont,
      bold: true,
      valign: "bottom",
      lineSpacing: 1.05,
      letterSpacing: -0.2,
    }
  );

  const ruleY = titleY + (effSubtitle ? 0.9 : 1.04);
  if (t.headerRule === "underline") {
    addShapeEl(els, { x: SAFE_MARGIN.left, y: ruleY, w: 1.6, h: 0.04 }, "rect", {
      fill: t.accent,
    });
  } else if (t.headerRule === "dot") {
    addShapeEl(
      els,
      { x: SAFE_MARGIN.left, y: ruleY, w: 0.09, h: 0.09 },
      "ellipse",
      { fill: t.accent }
    );
  } else if (t.headerRule === "bar") {
    addShapeEl(
      els,
      { x: SAFE_MARGIN.left, y: ruleY, w: 0.42, h: 0.035 },
      "rect",
      { fill: t.accent, opacity: 90 }
    );
  }

  if (effSubtitle) {
    addFittedText(
      ctx,
      els,
      { x: SAFE_MARGIN.left, y: ruleY + 0.08, w: W - SAFE_MARGIN.left - SAFE_MARGIN.right, h: 0.4 },
      effSubtitle,
      {
        size: 12.5 * ctx.ext.scale,
        minSize: 11,
        color: t.muted,
        font: t.bodyFont,
        lineSpacing: 1.05,
      }
    );
  }

  const bodyTop = effSubtitle ? ruleY + 0.52 : ruleY + 0.1;
  return { bodyTop, bodyBottom: 6.62 };
}

function addBulletsRegion(
  ctx: SlideContext,
  els: PptElement[],
  box: PptBox,
  bullets: string[],
  opts: { size?: number; color?: string } = {}
): void {
  const t = ctx.theme;
  const display = bullets.filter(b => b && b.trim()).slice(0, ctx.ext.maxBullets);
  if (!display.length) return;
  const base = opts.size ?? 14.5 * ctx.ext.scale;
  const minF = Math.max(10, ctx.ext.minBody);
  const gap = 0.09;
  const lineHeightAt = (f: number) => (f / 72) * ctx.ext.spacing + 0.015;
  const totalH = (f: number) =>
    display.reduce(
      (acc, b) =>
        acc + Math.max(measureLines(b, f, box.w - 0.4), 1) * lineHeightAt(f) + gap,
      0
    );
  let f = base;
  while (f > minF + 0.1 && totalH(f) > box.h) {
    f = Math.max(minF, +(f - 0.75).toFixed(2));
  }
  const lineH = lineHeightAt(f);
  let y = box.y;
  display.forEach(b => {
    const lines = Math.max(measureLines(b, f, box.w - 0.4), 1);
    const h = lines * lineH + gap;
    addShapeEl(
      els,
      { x: box.x + 0.04, y: y + (h / 2) - 0.07, w: 0.1, h: 0.1 },
      "ellipse",
      { fill: t.accent }
    );
    els.push({
      kind: "text",
      box: { x: box.x + 0.3, y, w: box.w - 0.34, h },
      text: b,
      fontSize: +f.toFixed(2),
      color: opts.color ?? t.text,
      font: t.bodyFont,
      lineSpacing: ctx.ext.spacing,
      valign: "top",
    });
    y += h;
  });
}

function addMetricCards(
  ctx: SlideContext,
  els: PptElement[],
  box: PptBox,
  metrics: Array<{ value: string; label: string; change?: string }>,
  columns: number
): void {
  const t = ctx.theme;
  const count = Math.min(metrics.length, columns);
  if (!count) return;
  const gap = 0.24;
  const cardW = (box.w - (count - 1) * gap) / count;
  const cardH = box.h;
  metrics.slice(0, count).forEach((m, i) => {
    const x = box.x + i * (cardW + gap);
    addShapeEl(els, { x, y: box.y, w: cardW, h: cardH }, "roundRect", {
      fill: t.panel,
      lineColor: t.panelBorder,
      lineWidth: 1,
      radius: Math.max(t.radius * 1.6, 0.1),
    });
    addShapeEl(els, { x: x + 0.22, y: box.y + 0.24, w: 0.42, h: 0.035 }, "rect", {
      fill: t.accent,
    });
    addFittedText(
      ctx,
      els,
      { x: x + 0.18, y: box.y + 0.4, w: cardW - 0.36, h: cardH * 0.42 },
      m.value,
      {
        size: Math.min(34, cardH * 3.6) * ctx.ext.scale,
        minSize: 16,
        color: t.accent,
        font: t.titleFont,
        bold: true,
        valign: "middle",
        lineSpacing: 1,
      }
    );
    addFittedText(
      ctx,
      els,
      { x: x + 0.18, y: box.y + cardH * 0.52, w: cardW - 0.36, h: cardH * 0.22 },
      m.label,
      {
        size: 14 * ctx.ext.scale,
        minSize: 11,
        color: t.primary,
        font: t.bodyFont,
        bold: true,
        valign: "top",
        lineSpacing: 1.1,
      }
    );
    if (m.change) {
      addFittedText(
        ctx,
        els,
        { x: x + 0.18, y: box.y + cardH * 0.76, w: cardW - 0.36, h: cardH * 0.18 },
        m.change,
        {
          size: 11.5,
          minSize: 10,
          color: t.secondary,
          font: t.bodyFont,
          lineSpacing: 1,
        }
      );
    }
  });
}

function addBarChart(
  ctx: SlideContext,
  els: PptElement[],
  box: PptBox,
  data: Array<{ label: string; value: number }>,
  opts: { size?: number; labelColor?: string } = {}
): void {
  const t = ctx.theme;
  const size = opts.size ?? 11.5;
  const labelColor = opts.labelColor ?? t.muted;
  const max = Math.max(...data.map(d => d.value), 1);
  const n = Math.min(data.length, 6);
  const chartW = box.w;
  const chartH = box.h;
  const barGap = 0.3;
  const barW = Math.max((chartW - (n - 1) * barGap) / n, 0.4);
  data.slice(0, n).forEach((d, i) => {
    const h = Math.max((d.value / max) * (chartH - 0.7), 0.12);
    const x = box.x + i * (barW + barGap);
    const y = box.y + chartH - h - 0.55;
    addShapeEl(
      els,
      { x, y, w: barW, h },
      "rect",
      { fill: i % 2 === 0 ? t.accent : t.accent2, opacity: 95 }
    );
    if (x + barW > box.x + box.w) return;
    const valueY = Math.max(y - 0.26, box.y);
    els.push({
      kind: "text",
      box: { x, y: valueY, w: barW, h: 0.24 },
      text: String(Math.round(d.value)),
      fontSize: size,
      color: t.text,
      align: "center",
      valign: "bottom",
      font: t.bodyFont,
      lineSpacing: 1,
    });
    if (y + h > box.y + box.h - 0.42) return;
    const labelW = barW * 1.6;
    const labelX = Math.min(
      Math.max(x - labelW / 2, box.x),
      box.x + box.w - labelW
    );
    els.push({
      kind: "text",
      box: { x: labelX, y: box.y + chartH - 0.42, w: labelW, h: 0.4 },
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

function addColumnPanels(
  ctx: SlideContext,
  els: PptElement[],
  box: PptBox,
  columns: Array<{ title?: string; text?: string; bullets?: string[] }>,
  colCount: number
): void {
  const t = ctx.theme;
  const gap = 0.26;
  const colW = (box.w - (colCount - 1) * gap) / colCount;
  columns.slice(0, colCount).forEach((c, i) => {
    const x = box.x + i * (colW + gap);
    addShapeEl(els, { x, y: box.y, w: colW, h: box.h }, "roundRect", {
      fill: t.panel,
      lineColor: t.panelBorder,
      lineWidth: 1,
      radius: Math.max(t.radius * 1.4, 0.08),
    });
    let innerY = box.y + 0.24;
    if (c.title) {
      addFittedText(
        ctx,
        els,
        { x: x + 0.22, y: innerY, w: colW - 0.44, h: 0.6 },
        c.title,
        {
          size: 16 * ctx.ext.scale,
          minSize: 13,
          color: t.primary,
          font: t.titleFont,
          bold: true,
          valign: "middle",
          lineSpacing: 1.05,
        }
      );
      innerY += 0.64;
    }
    if (c.text) {
      const textH = c.bullets?.length
        ? box.h * 0.26
        : Math.max(box.y + box.h - innerY - 0.24, 0.5);
      addFittedText(
        ctx,
        els,
        { x: x + 0.22, y: innerY, w: colW - 0.44, h: textH },
        c.text,
        {
          size: 13.5 * ctx.ext.scale,
          minSize: Math.max(10.5, ctx.ext.minBody - 0.5),
          color: t.text,
          font: t.bodyFont,
          lineSpacing: ctx.ext.spacing,
        }
      );
      innerY += textH + 0.1;
    }
    if (c.bullets?.length) {
      addBulletsRegion(
        ctx,
        els,
        { x: x + 0.22, y: innerY, w: colW - 0.44, h: Math.max(box.y + box.h - innerY - 0.2, 0.6) },
        c.bullets,
        { size: 13 * ctx.ext.scale, color: t.text }
      );
    }
  });
}

function addProcessSteps(
  ctx: SlideContext,
  els: PptElement[],
  box: PptBox,
  steps: Array<{ step: number; title: string; description: string }>
): void {
  const t = ctx.theme;
  const count = Math.min(steps.length, 5);
  if (!count) return;
  const gap = 0.2;
  const cardW = (box.w - (count - 1) * gap) / count;
  steps.slice(0, count).forEach((st, i) => {
    const x = box.x + i * (cardW + gap);
    addShapeEl(els, { x, y: box.y, w: cardW, h: box.h }, "roundRect", {
      fill: t.panel,
      lineColor: t.panelBorder,
      lineWidth: 1,
      radius: Math.max(t.radius * 1.4, 0.08),
    });
    addShapeEl(els, { x, y: box.y, w: cardW, h: 0.09 }, "rect", {
      fill: i % 2 === 0 ? t.accent : t.accent2,
    });
    els.push({
      kind: "text",
      box: { x: x + 0.18, y: box.y + 0.2, w: 0.9, h: 0.32 },
      text: String(st.step).padStart(2, "0"),
      fontSize: 12,
      bold: true,
      color: t.accent,
      font: t.titleFont,
      valign: "middle",
      lineSpacing: 1,
    });
    addFittedText(
      ctx,
      els,
      { x: x + 0.2, y: box.y + 0.54, w: cardW - 0.4, h: box.h * 0.3 },
      st.title,
      {
        size: 15 * ctx.ext.scale,
        minSize: 12.5,
        color: t.primary,
        font: t.titleFont,
        bold: true,
        valign: "top",
        lineSpacing: 1.1,
      }
    );
    addFittedText(
      ctx,
      els,
      { x: x + 0.2, y: box.y + box.h * 0.4, w: cardW - 0.4, h: box.h * 0.55 },
      st.description,
      {
        size: 12.5 * ctx.ext.scale,
        minSize: Math.max(10, ctx.ext.minBody - 0.5),
        color: t.text,
        font: t.bodyFont,
        lineSpacing: ctx.ext.spacing,
      }
    );
  });
}

type TableStyle = {
  headers: string[];
  rows: string[][];
  colCount: number;
  rowCount: number;
  colW: number;
  rowH: number;
  gap: number;
  fontSize: number;
  rowFill: string;
  altRowFill: string;
  borderColor: string;
};

function computeTableStyle(
  ctx: SlideContext,
  box: PptBox,
  headers: string[],
  rows: string[][]
): TableStyle {
  const t = ctx.theme;
  const maxCols = 5;
  const displayHeaders = headers.slice(0, maxCols);
  let displayRows = rows.map(r => r.slice(0, maxCols));
  const gap = 0.015;
  const blendRowFill = t.panel;
  const altRowFill = t.background === t.panel ? t.sectionBackground : t.panel;
  const borderColor = t.panelBorder;

  const minimum = Math.max(8.5, ctx.ext.minTable);
  let style: TableStyle | null = null;
  // Trim rows until the font is legible within the box.
  for (let attempt = 0; attempt < 6; attempt++) {
    const colCount = Math.max(
      displayHeaders.length,
      ...displayRows.map(r => Math.max(r.length, 1)),
      1
    );
    const rowCount = displayRows.length + (displayHeaders.length ? 1 : 0);
    const colW = (box.w - (colCount - 1) * gap) / colCount;
    const rowH = Math.min(box.h / rowCount, 0.56);
    const availW = Math.max(colW - 0.18, 0.2);
    const longest = Math.max(
      ...[...displayHeaders, ...displayRows.flat()].map(c => (c ? c.length : 1))
    );
    const fW = availW / (longest * 0.0085);
    const fH = (rowH - 0.1) * 60;
    let f = Math.min(12 * ctx.ext.scale, fW, fH);
    f = Math.max(Math.min(f, 13), 8.5);
    style = {
      headers: displayHeaders,
      rows: displayRows,
      colCount,
      rowCount,
      colW,
      rowH,
      gap,
      fontSize: +f.toFixed(1),
      rowFill: blendRowFill,
      altRowFill,
      borderColor,
    };
    if (f >= minimum || displayRows.length <= 4) break;
    displayRows = displayRows.slice(0, Math.max(displayRows.length - 2, 4));
  }
  return style as TableStyle;
}

function addTable(
  ctx: SlideContext,
  els: PptElement[],
  box: PptBox,
  headers: string[],
  rows: string[][]
): void {
  const t = ctx.theme;
  const st = computeTableStyle(ctx, box, headers, rows);
  const headerFill = t.primary;
  const headerColor = t.invertedText;
  const { gap, colW, rowH, fontSize } = st;

  const headerPad = st.headers.length ? rowH + gap : 0;
  st.headers.forEach((h, c) => {
    const x = box.x + c * (colW + gap);
    addShapeEl(els, { x, y: box.y, w: colW, h: rowH }, "rect", { fill: headerFill });
    els.push({
      kind: "text",
      box: { x: x + 0.08, y: box.y + 0.04, w: colW - 0.16, h: rowH - 0.08 },
      text: h,
      fontSize,
      bold: true,
      color: headerColor,
      font: t.bodyFont,
      valign: "middle",
      lineSpacing: 1,
    });
  });
  st.rows.forEach((row, r) => {
    const rowY = box.y + headerPad + r * (rowH + gap);
    const isAlt = r % 2 === 1;
    row.forEach((cell, c) => {
      const x = box.x + c * (colW + gap);
      addShapeEl(
        els,
        { x, y: rowY, w: colW, h: rowH },
        "rect",
        { fill: isAlt ? st.altRowFill : st.rowFill, lineColor: st.borderColor, lineWidth: 0.5 }
      );
      els.push({
        kind: "text",
        box: { x: x + 0.08, y: rowY + 0.03, w: colW - 0.16, h: rowH - 0.06 },
        text: cell,
        fontSize,
        color: t.text,
        font: t.bodyFont,
        valign: "middle",
        lineSpacing: 1,
      });
    });
  });
}

function addQuote(
  ctx: SlideContext,
  els: PptElement[],
  box: PptBox,
  text: string,
  author?: string
): void {
  const t = ctx.theme;
  addShapeEl(els, { x: box.x, y: box.y, w: box.w, h: box.h }, "roundRect", {
    fill: t.panel,
    lineColor: t.panelBorder,
    lineWidth: 1,
    radius: Math.max(t.radius * 1.2, 0.08),
  });
  addShapeEl(els, { x: box.x + 0.25, y: box.y + 0.28, w: 0.09, h: box.h - 0.56 }, "rect", {
    fill: t.accent,
  });
  const quoteText = `“${text}”`;
  const quoteBox = { x: box.x + 0.55, y: box.y + 0.42, w: box.w - 0.8, h: box.h * (author ? 0.56 : 0.8) };
  const fitted = fitText({
    text: quoteText,
    fontSize: 19 * ctx.ext.scale,
    minFontSize: 14,
    boxWidthIn: quoteBox.w,
    boxHeightIn: quoteBox.h,
    lineSpacing: 1.25,
  });
  els.push({
    kind: "text",
    box: quoteBox,
    text: quoteText,
    fontSize: +fitted.fontSize.toFixed(2),
    italic: true,
    color: t.primary,
    font: t.bodyFont,
    valign: "top",
    lineSpacing: 1.25,
  });
  if (author) {
    addFittedText(
      ctx,
      els,
      { x: box.x + 0.55, y: box.y + box.h - 0.62, w: box.w - 0.8, h: 0.46 },
      `— ${author}`,
      {
        size: 13.5,
        minSize: 12,
        color: t.secondary,
        font: t.bodyFont,
        bold: true,
        valign: "top",
        lineSpacing: 1.1,
      }
    );
  }
}

function slideHeadingFor(slide: SlideDefinition, index: number): string {
  const title = slide.title?.trim();
  return title && title.length <= 52 ? title : `Section ${index + 1}`;
}

function buildColumnsFromBullets(
  bullets?: string[],
  count = 2
): Array<{ bullets: string[] }> {
  if (!bullets?.length) return Array.from({ length: count }, () => ({ bullets: [] }));
  const per = Math.ceil(bullets.length / count);
  const cols: Array<{ bullets: string[] }> = [];
  for (let i = 0; i < count; i++) {
    cols.push({ bullets: bullets.slice(i * per, (i + 1) * per) });
  }
  return cols;
}

/** Builds a full canonical specification from semantic slides + config. */
export function buildPresentationSpec(input: {
  title: string;
  slides: SlideDefinition[];
  config: PresentationConfig;
  styleName?: PptVisualStyle;
  footerLabel?: string;
  notes?: Array<string | undefined>;
}): PptPresentationSpec {
  const styleName = input.styleName;
  const theme: ThemeSpec =
    !styleName || styleName === "auto"
      ? pickAutoTheme(input.title)
      : VISUAL_THEMES[styleName] ?? pickAutoTheme(input.title);
  const density = densityOf(input.config.density);
  const strategy = strategyOf(input.config.layout);
  // "Dense Professional" compresses like Detailed density; "Minimal" hides
  // decorative panels unless the user explicitly asked for illustrations.
  const effDensity: ConcreteDensity =
    strategy === "Dense Professional" ? "Detailed" : density;
  const baseVisuals = visualsOf(input.config.visuals);
  const visuals: Visuals =
    strategy === "Minimal" && baseVisuals !== "No Images" ? "Minimal" : baseVisuals;
  const ext = DENSITY_EXTRAS[effDensity];

  const totalSlides = Math.max(input.slides.length, 1);
  const footerLabel = input.footerLabel || input.title;

  const ctx: SlideContext = {
    theme,
    config: input.config,
    strategy,
    density: effDensity,
    visuals,
    ext,
    totalSlides,
  };

  const specSlides: PptSlideSpec[] = [];

  input.slides.forEach((rawSlide, index) => {
    const t = theme;
    const els: PptElement[] = [];
    const layout = (rawSlide.layout ?? (index === 0 ? "title" : "two_column")) as string;
    const kind = layout === "big_number" ? "stats" : layout;

    // Background
    let bg = t.background;
    if (layout === "title") bg = t.titleBackground;
    if (layout === "section") bg = t.sectionBackground;

    if (kind !== "title" && kind !== "section" && t.headerRule === "bar" && theme.kind === "light") {
      addShapeEl(els, { x: 0, y: 0, w: W, h: 0.09 }, "rect", { fill: t.accent, opacity: 92 });
    }

    if (kind === "title") {
      // Hero slide — full-bleed composition by style.
      const split = splitLongTitle(rawSlide.title || input.title);
      const kicker =
        rawSlide.subtitle && rawSlide.subtitle.length <= 68
          ? rawSlide.subtitle
          : undefined;
      const heroTitle = split.title || "Presentation";
      const heroSub = split.subtitle || (kicker ? undefined : rawSlide.subtitle);
      const titleTop = 2.2;

      if (theme.heroBand === "left") {
        addShapeEl(els, { x: 0, y: 0, w: 0.28, h: H }, "rect", { fill: t.accent });
      } else if (theme.heroBand === "right") {
        addShapeEl(els, { x: W - 0.28, y: 0, w: 0.28, h: H }, "rect", { fill: t.accent });
        addShapeEl(
          els,
          { x: W - 3.6, y: H - 2.9, w: 2.6, h: 2.6 },
          "ellipse",
          { lineColor: t.accent, lineWidth: 2, opacity: 55 }
        );
      } else if (theme.heroBand === "full") {
        addShapeEl(els, { x: 0, y: 0, w: W, h: 0.22 }, "rect", { fill: t.accent });
        addShapeEl(
          els,
          { x: W - 5.2, y: -2.3, w: 5.8, h: 5.8 },
          "ellipse",
          { fill: t.accent, opacity: 14 }
        );
      }

      if (kicker) {
        addFittedText(
          ctx,
          els,
          { x: 0.85, y: titleTop - 0.55, w: 8, h: 0.32 },
          kicker.toUpperCase(),
          {
            size: 11.5,
            minSize: 9,
            color: t.accent,
            font: t.bodyFont,
            bold: true,
            letterSpacing: 1.4,
          }
        );
      }

      addFittedText(ctx, els, { x: 0.85, y: titleTop, w: 11.6, h: 1.7 }, heroTitle, {
        size: 38,
        minSize: 26,
        color: t.primary,
        font: t.titleFont,
        bold: true,
        valign: "top",
        lineSpacing: 1.05,
        letterSpacing: -0.4,
      });

      if (heroSub) {
        addFittedText(
          ctx,
          els,
          { x: 0.85, y: titleTop + 1.72, w: 11.6, h: 0.62 },
          heroSub,
          {
            size: 17,
            minSize: 14,
            color: t.muted,
            font: t.bodyFont,
            lineSpacing: 1.2,
          }
        );
      }

      if (rawSlide.bullets?.length) {
        rawSlide.bullets.slice(0, 3).forEach((b, i) => {
          const by = titleTop + 2.55 + i * 0.44;
          if (by + 0.4 > 6.9) return;
          addShapeEl(els, { x: 0.85, y: by + 0.07, w: 0.1, h: 0.1 }, "ellipse", {
            fill: t.accent,
          });
          els.push({
            kind: "text",
            box: { x: 1.1, y: by, w: 11, h: 0.4 },
            text: b.length > 110 ? `${b.slice(0, 108)}…` : b,
            fontSize: 13.5,
            color: t.text,
            font: t.bodyFont,
            lineSpacing: 1.1,
            valign: "top",
          });
        });
      }
      addFooter(ctx, els, index + 1, footerLabel);
      specSlides.push({ index, kind, background: bg, elements: els });
      return;
    }

    if (kind === "section") {
      const split = splitLongTitle(rawSlide.title || input.title);
      const y = 2.6;
      if (theme.heroBand === "left") {
        addShapeEl(els, { x: 0, y: 0, w: 0.28, h: H }, "rect", { fill: t.accent });
      } else if (theme.heroBand === "full") {
        addShapeEl(els, { x: 0, y: 0, w: W, h: 0.22 }, "rect", { fill: t.accent });
      } else {
        addShapeEl(els, { x: W / 2 - 1.2, y: y - 0.5, w: 2.4, h: 0.06 }, "rect", {
          fill: t.accent,
        });
      }
      if (rawSlide.subtitle) {
        addFittedText(
          ctx,
          els,
          { x: 0.9, y: y - 0.62, w: 10, h: 0.34 },
          rawSlide.subtitle.toUpperCase(),
          {
            size: 11,
            minSize: 9,
            color: t.accent,
            font: t.bodyFont,
            bold: true,
            letterSpacing: 1.4,
          }
        );
      }
      addFittedText(ctx, els, { x: 0.9, y, w: 11.5, h: 1.6 }, split.title, {
        size: 33,
        minSize: 24,
        color: t.primary,
        font: t.titleFont,
        bold: true,
        valign: "top",
        lineSpacing: 1.06,
        letterSpacing: -0.3,
      });
      if (split.subtitle) {
        addFittedText(
          ctx,
          els,
          { x: 0.9, y: y + 1.7, w: 11, h: 0.55 },
          split.subtitle,
          {
            size: 15,
            minSize: 13,
            color: t.muted,
            font: t.bodyFont,
          }
        );
      }
      addFooter(ctx, els, index + 1, footerLabel);
      specSlides.push({ index, kind, background: bg, elements: els });
      return;
    }

    // -- Content slide header --
    const zone = addHeader(
      ctx,
      els,
      rawSlide.title || "Overview",
      slideHeadingFor(rawSlide, index),
      rawSlide.subtitle
    );
    const bodyTop = zone.bodyTop;
    const bodyBottom = zone.bodyBottom;
    const fullBody: PptBox = {
      x: SAFE_MARGIN.left,
      y: bodyTop,
      w: W - SAFE_MARGIN.left - SAFE_MARGIN.right,
      h: bodyBottom - bodyTop,
    };

    const showVisualPanel =
      visuals !== "Minimal" &&
      visuals !== "No Images" &&
      strategy !== "Text First" &&
      strategy !== "Data First";

    const numeric: Array<{ label: string; value: number }> = (rawSlide.metrics ?? [])
      .map(m => ({
        label: m.label,
        value: parseFloat(String(m.value).replace(/[^0-9.-]/g, "")),
      }))
      .filter(m => Number.isFinite(m.value));

    const showChart = numeric.length >= 3 && (visuals === "Charts & Data" || visuals === "Balanced" || visuals === "Image Rich");

    switch (kind) {
      case "stats": {
        const metrics = rawSlide.metrics ?? [];
        const chartSide = showChart;
        const cardsBox: PptBox = chartSide
          ? { x: SAFE_MARGIN.left, y: bodyTop, w: fullBody.w - 4.6, h: fullBody.h }
          : fullBody;
        addMetricCards(ctx, els, cardsBox, metrics, chartSide ? 2 : 4);
        if (chartSide) {
          addBarChart(
            ctx,
            els,
            { x: fullBody.x + fullBody.w - 4.45, y: bodyTop + 0.1, w: 4.2, h: fullBody.h },
            numeric
          );
        } else if (showVisualPanel && metrics.length <= 2) {
          addVisualPanel(
            ctx,
            els,
            { x: SAFE_MARGIN.left + fullBody.w - 3.4, y: bodyTop + 0.2, w: 3.4, h: fullBody.h - 0.3 },
            index
          );
        }
        break;
      }
      case "two_column": {
        const cols = rawSlide.columns || buildColumnsFromBullets(rawSlide.bullets);
        if (strategy === "Text First" || strategy === "Visual First") {
          const textBox: PptBox = {
            x: SAFE_MARGIN.left,
            y: bodyTop,
            w: strategy === "Visual First" ? fullBody.w - 4.4 : fullBody.w,
            h: fullBody.h,
          };
          addColumnPanels(ctx, els, textBox, cols, 2);
          if (strategy === "Visual First" && showVisualPanel) {
            addVisualPanel(
              ctx,
              els,
              { x: textBox.x + textBox.w + 0.35, y: bodyTop + 0.2, w: 4.05, h: fullBody.h - 0.3 },
              index
            );
          }
        } else {
          addColumnPanels(ctx, els, fullBody, cols, 2);
        }
        break;
      }
      case "three_column": {
        const cols = rawSlide.columns || buildColumnsFromBullets(rawSlide.bullets, 3);
        if (showVisualPanel && cols.length === 3) {
          const textBox: PptBox = {
            x: SAFE_MARGIN.left,
            y: bodyTop,
            w: fullBody.w - 3.3,
            h: fullBody.h,
          };
          addColumnPanels(ctx, els, textBox, cols, 2);
          addVisualPanel(
            ctx,
            els,
            { x: textBox.x + textBox.w + 0.3, y: bodyTop + 0.2, w: 3, h: fullBody.h - 0.3 },
            index + 1
          );
        } else {
          addColumnPanels(ctx, els, fullBody, cols, 3);
        }
        break;
      }
      case "process": {
        const steps =
          rawSlide.steps ||
          [{ step: 1, title: rawSlide.title || "Step", description: rawSlide.subtitle || "" }];
        addProcessSteps(ctx, els, fullBody, steps);
        if (showVisualPanel && steps.length <= 3) {
          addVisualPanel(
            ctx,
            els,
            { x: SAFE_MARGIN.left + fullBody.w - 4, y: bodyTop + 0.2, w: 4, h: fullBody.h - 0.3 },
            index + 2
          );
        }
        break;
      }
      case "comparison": {
        const cols = rawSlide.columns || buildColumnsFromBullets(rawSlide.bullets, 2);
        addColumnPanels(ctx, els, fullBody, cols, 2);
        break;
      }
      case "table": {
        if (rawSlide.table && rawSlide.table.rows?.length) {
          addTable(ctx, els, fullBody, rawSlide.table.headers ?? [], rawSlide.table.rows);
        } else if (rawSlide.bullets?.length) {
          addBulletsRegion(ctx, els, fullBody, rawSlide.bullets, {});
          if (showVisualPanel) {
            addVisualPanel(
              ctx,
              els,
              { x: SAFE_MARGIN.left + fullBody.w - 3.2, y: bodyTop + 0.2, w: 3.2, h: fullBody.h - 0.3 },
              index + 3
            );
          }
        }
        break;
      }
      case "quote": {
        if (rawSlide.quote) {
          addQuote(ctx, els, fullBody, rawSlide.quote.text, rawSlide.quote.author);
        } else {
          addBulletsRegion(ctx, els, fullBody, rawSlide.bullets ?? [], {});
        }
        break;
      }
      case "key_message": {
        const msgBox: PptBox = {
          x: SAFE_MARGIN.left + 0.7,
          y: bodyTop + 0.35,
          w: fullBody.w - 1.4,
          h: fullBody.h - 0.7,
        };
        addShapeEl(els, { x: msgBox.x, y: msgBox.y, w: msgBox.w, h: msgBox.h }, "roundRect", {
          fill: t.panel,
          lineColor: t.accent,
          lineWidth: 1.5,
          radius: Math.max(t.radius * 1.2, 0.08),
        });
        addFittedText(
          ctx,
          els,
          { x: msgBox.x + 0.55, y: msgBox.y + 0.35, w: msgBox.w - 1.1, h: msgBox.h * 0.55 },
          rawSlide.keyMessage?.statement || rawSlide.title || "",
          {
            size: 21 * ctx.ext.scale,
            minSize: 15,
            color: t.primary,
            font: t.titleFont,
            bold: true,
            align: "center",
            valign: "top",
            lineSpacing: 1.2,
          }
        );
        if (rawSlide.keyMessage?.context || rawSlide.subtitle) {
          addFittedText(
            ctx,
            els,
            { x: msgBox.x + 0.7, y: msgBox.y + msgBox.h * 0.62, w: msgBox.w - 1.4, h: msgBox.h * 0.3 },
            rawSlide.keyMessage?.context || rawSlide.subtitle || "",
            {
              size: 14 * ctx.ext.scale,
              minSize: 12,
              color: t.muted,
              font: t.bodyFont,
              align: "center",
              lineSpacing: ctx.ext.spacing,
            }
          );
        }
        break;
      }
      default: {
        const bullets = rawSlide.bullets ?? [];
        if (showChart) {
          const bulletsBox: PptBox = {
            x: SAFE_MARGIN.left,
            y: bodyTop,
            w: fullBody.w - 4.45,
            h: fullBody.h,
          };
          addBulletsRegion(ctx, els, bulletsBox, bullets, {});
          addBarChart(
            ctx,
            els,
            { x: fullBody.x + fullBody.w - 4.45, y: bodyTop + 0.1, w: 4.2, h: fullBody.h },
            numeric
          );
        } else if (showVisualPanel) {
          const bulletsBox: PptBox = {
            x: SAFE_MARGIN.left,
            y: bodyTop,
            w: fullBody.w - 3.6,
            h: fullBody.h,
          };
          addBulletsRegion(ctx, els, bulletsBox, bullets, {});
          addVisualPanel(
            ctx,
            els,
            { x: bulletsBox.x + bulletsBox.w + 0.3, y: bodyTop + 0.2, w: 3.3, h: fullBody.h - 0.3 },
            index + 4
          );
        } else {
          addBulletsRegion(ctx, els, fullBody, bullets, {});
        }
        break;
      }
    }

    if (rawSlide.footnote) {
      addFittedText(
        ctx,
        els,
        { x: SAFE_MARGIN.left, y: 6.62, w: W - SAFE_MARGIN.left - SAFE_MARGIN.right, h: 0.26 },
        rawSlide.footnote,
        {
          size: 9.5,
          minSize: 8.5,
          color: t.muted,
          font: t.bodyFont,
        }
      );
    }

    addFooter(ctx, els, index + 1, footerLabel);

    const notes = input.notes?.[index];
    specSlides.push({ index, kind, background: bg, elements: els, notes });
  });

  return {
    version: 1,
    widthIn: W,
    heightIn: H,
    title: input.title,
    themeKey: theme.key,
    style: theme.name,
    config: input.config,
    slides: specSlides,
  };
}