/**
 * Canonical-spec validator + repairer.
 *
 * The generated `PptPresentationSpec` is validated element-by-element:
 *  - every element box must be inside the slide bounds,
 *  - text blocks must stay inside the safe area and their estimated rendered
 *    height must not exceed their box height.
 *
 * Any violation is either reported to the caller or repaired in place
 * (re-fit text, clamp boxes) so a downloaded deck is guaranteed clean.
 */

import {
  SLIDE_WIDTH_IN,
  SLIDE_HEIGHT_IN,
  SAFE_MARGIN,
  estimateTextHeight,
  type PptPresentationSpec,
  type PptSlideSpec,
} from "@shared/presentation";

export type Violation = {
  slideIndex: number;
  elementIndex: number;
  kind: string;
  message: string;
};

const W = SLIDE_WIDTH_IN;
const H = SLIDE_HEIGHT_IN;
const WIDTH_TOL = 0.02;
const HEIGHT_TOL = 0.02;

function isInsideSlide(x: number, y: number, w: number, h: number): boolean {
  return (
    x >= -WIDTH_TOL &&
    y >= -HEIGHT_TOL &&
    x + w <= W + WIDTH_TOL &&
    y + h <= H + HEIGHT_TOL
  );
}

function isInsideSafeArea(x: number, y: number, w: number, h: number): boolean {
  return (
    x >= SAFE_MARGIN.left - WIDTH_TOL &&
    y >= SAFE_MARGIN.top - HEIGHT_TOL &&
    x + w <= W - SAFE_MARGIN.right + WIDTH_TOL &&
    y + h <= H - SAFE_MARGIN.bottom + HEIGHT_TOL
  );
}

export function validateSlide(slide: PptSlideSpec): Violation[] {
  const violations: Violation[] = [];
  slide.elements.forEach((el, elementIndex) => {
    const b = el.box;
    if (!isInsideSlide(b.x, b.y, b.w, b.h)) {
      violations.push({
        slideIndex: slide.index,
        elementIndex,
        kind: "bounds",
        message: `Element (${el.kind}) box [${r2(b.x)},${r2(b.y)},${r2(b.w)},${r2(b.h)}] exceeds slide bounds`,
      });
      return;
    }
    if (el.kind === "text") {
      if (!isInsideSafeArea(b.x, b.y, b.w, b.h)) {
        violations.push({
          slideIndex: slide.index,
          elementIndex,
          kind: "safe-area",
          message: `Text "${trunc(el.text)}" leaks outside the safe area`,
        });
      }
      const est = estimateTextHeight({
        text: el.text,
        fontSize: el.fontSize,
        widthIn: b.w,
        lineSpacing: el.lineSpacing ?? 1.15,
        bold: el.bold,
      });
      if (est > b.h + HEIGHT_TOL) {
        violations.push({
          slideIndex: slide.index,
          elementIndex,
          kind: "overflow",
          message: `Text "${trunc(el.text)}" needs ~${r2(est)}" but box is ${r2(b.h)}" (${el.fontSize}pt)`,
        });
      }
      if (!el.text || !el.text.trim()) {
        violations.push({
          slideIndex: slide.index,
          elementIndex,
          kind: "empty",
          message: "Empty text element",
        });
      }
    } else if (el.kind === "barChart") {
      if (!isInsideSafeArea(b.x, b.y, b.w, b.h)) {
        violations.push({
          slideIndex: slide.index,
          elementIndex,
          kind: "safe-area",
          message: "Bar chart leaks outside the safe area",
        });
      }
    }
  });
  return violations;
}

export function validateSpec(spec: PptPresentationSpec): Violation[] {
  const all: Violation[] = [];
  spec.slides.forEach(slide => all.push(...validateSlide(slide)));
  return all;
}

function trunc(s: string, n = 24): string {
  const t = s.replace(/\s+/g, " ").trim();
  return t.length > n ? `${t.slice(0, n)}…` : t;
}

function r2(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Best-effort repair: re-fit overflowing text inside its box, clamp boxes back
 * into bounds, and re-validate. Returns the (possibly unchanged) spec plus a
 * count of applied repairs. Runs until stable or the attempt budget is spent.
 */
export function repairSpec(
  source: PptPresentationSpec
): { spec: PptPresentationSpec; repairs: number } {
  let spec = cloneSpec(source);
  let repairs = 0;
  for (let pass = 0; pass < 3; pass++) {
    const violations = validateSpec(spec);
    if (!violations.length) break;
    const before = repairs;

    spec = {
      ...spec,
      slides: spec.slides.map((slide, slideIndex) => {
        const slideViolations = violations.filter(v => v.slideIndex === slide.index);
        if (!slideViolations.length) return slide;
        let elements = [...slide.elements];
        slideViolations.forEach(v => {
          const el = elements[v.elementIndex];
          if (!el) return;
          if (v.kind === "empty" && el.kind === "text" && !el.text.trim()) {
            elements = elements.map(e => (e === el ? { ...e, text: " " } : e));
            repairs += 1;
            return;
          }
          if (v.kind === "overflow" && el.kind === "text") {
            const fixed = shrinkToFit(el.box, el.text, el.fontSize, el.lineSpacing ?? 1.15);
            elements[v.elementIndex] = { ...el, fontSize: fixed, text: el.text };
            repairs += 1;
            return;
          }
          if (v.kind === "safe-area" || v.kind === "bounds") {
            const moved = clampBox(el.box);
            elements[v.elementIndex] = { ...el, box: moved };
            repairs += 1;
          }
        });
        return { ...slide, elements };
      }),
    };

    if (repairs === before) {
      // Repair is not helping; stop to avoid an infinite loop.
      break;
    }
  }
  return { spec, repairs };
}

function shrinkToFit(
  box: { w: number; h: number },
  text: string,
  start: number,
  lineSpacing: number
): number {
  let size = Math.max(start, 20);
  for (let f = Math.min(start, 20); f >= 6; f -= 0.5) {
    const est = estimateTextHeight({ text, fontSize: f, widthIn: box.w, lineSpacing });
    if (est <= box.h + HEIGHT_TOL) {
      size = f;
      break;
    }
    size = f;
  }
  return Math.round(Math.max(size, 6) * 100) / 100;
}

function clampBox(box: { x: number; y: number; w: number; h: number }) {
  let { x, y, w, h } = box;
  x = Math.min(Math.max(x, 0), W - w);
  y = Math.min(Math.max(y, 0), H - h);
  return { x, y, w, h };
}

function cloneSpec(spec: PptPresentationSpec): PptPresentationSpec {
  return {
    ...spec,
    slides: spec.slides.map(s => ({
      ...s,
      elements: s.elements.map(e => ({ ...e, box: { ...e.box } })),
    })),
  };
}