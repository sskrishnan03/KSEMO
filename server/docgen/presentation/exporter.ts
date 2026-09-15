/**
 * PPTX exporter for the canonical presentation spec.
 *
 * Walks `PptPresentationSpec` and renders it with pptxgenjs. Coordinates in the
 * spec are PowerPoint-native inches on the fixed 16:9 canvas, so the exporter
 * never re-lays-out or re-flows anything — the preview and the .pptx show the
 * exact same composition.
 *
 * After generating the package the canonical JSON is embedded as an extra zip
 * part (`ppt/canonical.json`). PowerPoint ignores unknown parts, so the file
 * opens normally everywhere while KSEMO's preview can read the identical spec
 * back out of the artifact itself.
 */

import PptxGenJS from "pptxgenjs";
import JSZip from "jszip";
import {
  SLIDE_WIDTH_IN,
  SLIDE_HEIGHT_IN,
  CANONICAL_PART_NAME,
  type PptElement,
  type PptPresentationSpec,
} from "@shared/presentation";

const LAYOUT_W = SLIDE_WIDTH_IN;
const LAYOUT_H = SLIDE_HEIGHT_IN;

// Transparency in the canonical model is 0-100 opacity; pptxgenjs expects
// 0-100 transparency. Map opacity -> transparency.
function transparencyOf(el: { opacity?: number }): number | undefined {
  if (el.opacity === undefined) return undefined;
  return Math.max(0, Math.min(100, Math.round(100 - el.opacity)));
}

function addShapeEl(pptx: PptxGenJS, slide: PptxGenJS.Slide, el: Extract<PptElement, { kind: "shape" }>): void {
  const { box, shape } = el;
  const transparency = transparencyOf(el);
  const fill = el.fill
    ? {
        color: el.fill as string,
        transparency: transparency ?? 0,
      }
    : undefined;
  const line = el.lineColor
    ? {
        color: el.lineColor as string,
        width: el.lineWidth ?? 1,
        transparency: transparency ?? 0,
      }
    : undefined;

  switch (shape) {
    case "rect":
      slide.addShape("rect", { x: box.x, y: box.y, w: box.w, h: box.h, fill, line });
      break;
    case "roundRect":
      slide.addShape("roundRect", {
        x: box.x,
        y: box.y,
        w: box.w,
        h: box.h,
        rectRadius: el.radius ?? 0.06,
        fill,
        line,
      });
      break;
    case "ellipse":
      slide.addShape("ellipse", { x: box.x, y: box.y, w: box.w, h: box.h, fill, line });
      break;
    case "line":
      slide.addShape("line", {
        x: box.x,
        y: box.y,
        w: box.w,
        h: box.h,
        line: { color: el.lineColor ?? "000000", width: el.lineWidth ?? 1 },
      });
      break;
    case "chevron":
      slide.addShape("chevron", { x: box.x, y: box.y, w: box.w, h: box.h, fill, line });
      break;
  }
}

function addBarChartEl(pptx: PptxGenJS, slide: PptxGenJS.Slide, el: Extract<PptElement, { kind: "barChart" }>): void {
  const { box, data } = el;
  const max = el.max || Math.max(...data.map(d => d.value), 1);
  const n = Math.min(data.length, 6);
  const gap = 0.3;
  const barW = Math.max((box.w - (n - 1) * gap) / n, 0.4);
  data.slice(0, n).forEach((d, i) => {
    const h = Math.max((d.value / max) * (box.h - 0.7), 0.12);
    const x = box.x + i * (barW + gap);
    const y = box.y + box.h - h - 0.55;
    slide.addShape("rect", {
      x,
      y,
      w: barW,
      h,
      fill: { color: i % 2 === 0 ? el.color : el.secondaryColor },
    });
    slide.addText(String(Math.round(d.value)), {
      x,
      y: y - 0.26,
      w: barW,
      h: 0.24,
      fontSize: 11.5,
      color: el.valueColor,
      align: "center",
      valign: "bottom",
    });
    slide.addText(d.label, {
      x: Math.max(x - barW / 2, box.x),
      y: box.y + box.h - 0.42,
      w: barW * 1.6,
      h: 0.4,
      fontSize: 10,
      color: el.labelColor,
      align: "center",
      valign: "top",
    });
  });
}

function addTextEl(pptx: PptxGenJS, slide: PptxGenJS.Slide, el: Extract<PptElement, { kind: "text" }>): void {
  const { box } = el;
  const opts: Record<string, unknown> = {
    x: box.x,
    y: box.y,
    w: box.w,
    h: box.h,
    fontSize: el.fontSize,
    color: el.color,
    fontFace: el.font,
    bold: el.bold,
    italic: el.italic,
    align: el.align ?? "left",
    valign: el.valign ?? "top",
    lineSpacing: el.lineSpacing ?? 1.15,
    breakLine: true,
    transparency: transparencyOf(el),
  };
  if (el.letterSpacing !== undefined) opts.charSpacing = el.letterSpacing;
  slide.addText(el.text, opts);
}

export async function exportPptx(spec: PptPresentationSpec): Promise<Buffer> {
  const pptx = new PptxGenJS();
  pptx.defineLayout({ name: "KSEMO_CUSTOM", width: LAYOUT_W, height: LAYOUT_H });
  pptx.layout = "KSEMO_CUSTOM";
  pptx.rtlMode = false;

  spec.slides.forEach(slideSpec => {
    const slide = pptx.addSlide();
    slide.addShape("rect", {
      x: 0,
      y: 0,
      w: LAYOUT_W,
      h: LAYOUT_H,
      fill: { color: slideSpec.background },
    });

    slideSpec.elements.forEach(el => {
      if (el.kind === "text") {
        addTextEl(pptx, slide, el);
      } else if (el.kind === "shape") {
        addShapeEl(pptx, slide, el);
      } else if (el.kind === "barChart") {
        addBarChartEl(pptx, slide, el);
      } else if (el.kind === "image") {
        slide.addImage({
          path: el.src,
          x: el.box.x,
          y: el.box.y,
          w: el.box.w,
          h: el.box.h,
          sizing: { type: el.fit === "contain" ? "contain" : "cover", w: el.box.w, h: el.box.h },
        });
      } else if (el.kind === "table") {
        // Tables are emitted as shapes + text by the layout engine so the
        // preview and exporter share one implementation. `kind: "table"`
        // elements are still part of the canonical model for future use.
      }
    });

    if (slideSpec.notes) {
      slide.addNotes(slideSpec.notes);
    }
  });

  const buffer = (await pptx.write({ outputType: "nodebuffer" })) as Buffer;

  // Embed the canonical spec inside the .pptx package.
  const zip = await JSZip.loadAsync(buffer);
  zip.file(CANONICAL_PART_NAME, JSON.stringify(spec));
  const out = await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
  return out as Buffer;
}

/** Reads the canonical spec back out of a generated .pptx artifact. */
export async function readCanonicalFromBuffer(
  buffer: Buffer
): Promise<PptPresentationSpec | null> {
  const zip = await JSZip.loadAsync(buffer);
  const entry = zip.file(CANONICAL_PART_NAME);
  if (!entry) return null;
  const text = await entry.async("string");
  try {
    const parsed = JSON.parse(text) as PptPresentationSpec;
    if (!Array.isArray(parsed?.slides)) return null;
    return parsed;
  } catch {
    return null;
  }
}