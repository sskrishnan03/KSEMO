/**
 * Presentation pipeline engine.
 *
 * Orchestrates: AI slide content + user config -> canonical spec -> validation
 * -> repair -> pptx export with the canonical spec embedded.
 */

import {
  type PptPresentationSpec,
  type PptVisualStyle,
  type PresentationConfig,
} from "@shared/presentation";
import type { SlideDefinition } from "../spec";
import { buildPresentationSpec } from "./layout";
import { validateSpec, repairSpec, type Violation } from "./validator";
import { exportPptx, readCanonicalFromBuffer } from "./exporter";

export type DeckResult = {
  spec: PptPresentationSpec;
  buffer: Buffer;
  violations: Violation[];
  repairs: number;
};

export type BuildDeckArgs = {
  title: string;
  slides: SlideDefinition[];
  config: PresentationConfig;
  styleName?: PptVisualStyle;
  footerLabel?: string;
  notes?: Array<string | undefined>;
};

/** Builds + validates the canonical spec without exporting. */
export function buildDeckSpec(args: BuildDeckArgs): {
  spec: PptPresentationSpec;
  violations: Violation[];
  repairs: number;
} {
  const target = typeof args.config.slides === "number" ? args.config.slides : undefined;
  const slides = target ? adjustSlideCount(args.slides, target) : args.slides;

  let spec = buildPresentationSpec({
    title: args.title,
    slides,
    config: args.config,
    styleName: args.styleName,
    footerLabel: args.footerLabel,
    notes: args.notes,
  });

  const { spec: repairedSpec, repairs } = repairSpec(spec);
  spec = repairedSpec;
  const violations = validateSpec(spec);
  return { spec, violations, repairs };
}

/** Full pipeline: spec -> repair -> export -> verified artifact. */
export async function generateDeck(args: BuildDeckArgs): Promise<DeckResult> {
  const { spec, violations, repairs } = buildDeckSpec(args);
  const buffer = await exportPptx(spec);
  // Confirm the canonical part survived the re-zip.
  const roundTrip = await readCanonicalFromBuffer(buffer);
  if (!roundTrip) {
    throw new Error("Presentation export failed: canonical spec missing from artifact");
  }
  return { spec, violations, repairs, buffer };
}

const MIN_CONTENT_SLIDES = 4;

/**
 * Grows or trims the AI's slide list toward the requested target count
 * WITHOUT inventing new meaning: long bullet slides are split, and "key
 * takeaway" slides are derived from existing content. Silently stops early
 * rather than fabricating hollow slides.
 */
export function adjustSlideCount(
  source: SlideDefinition[],
  target: number
): SlideDefinition[] {
  let work: SlideDefinition[] = source.map(s => ({
    ...s,
    bullets: s.bullets ? [...s.bullets] : undefined,
    columns: s.columns ? s.columns.map(c => ({ ...c })) : undefined,
    metrics: s.metrics ? s.metrics.map(m => ({ ...m })) : undefined,
    steps: s.steps ? s.steps.map(st => ({ ...st })) : undefined,
    table: s.table ? { headers: s.table.headers ? [...s.table.headers] : [], rows: s.table.rows.map(r => [...r]) } : undefined,
  }));

  if (work.length <= target) {
    // Grow: split fat bullet slides, then derive takeaways from existing text.
    let guard = 0;
    while (work.length < target && guard++ < 24) {
      const fat = work.findIndex(
        s => s.layout !== "title" && (s.bullets?.length ?? 0) >= 6
      );
      if (fat >= 0) {
        const s = work[fat];
        const half = Math.ceil((s.bullets?.length ?? 0) / 2);
        const firstHalf = s.bullets?.slice(0, half) ?? [];
        const secondHalf = s.bullets?.slice(half) ?? [];
        const split: SlideDefinition = {
          ...s,
          bullets: secondHalf,
          title: s.title ? `${s.title} (continued)` : undefined,
        };
        const replaced: SlideDefinition = { ...s, bullets: firstHalf };
        work = [...work];
        work[fat] = replaced;
        work.splice(fat + 1, 0, split);
        continue;
      }
      const srcIdx = work.findIndex(
        s => s.layout !== "title" && (s.bullets?.length ?? 0) >= 3
      );
      if (srcIdx < 0) break;
      const src = work[srcIdx];
      const take = (src.bullets ?? []).splice(0, 2);
      work = [...work];
      work[srcIdx] = src;
      work.push({
        title: "Key takeaways",
        layout: "key_message",
        subtitle: "Highlights",
        keyMessage: { statement: take[0], context: take[1] },
      });
    }
    return work;
  }

  // Trim from the end, always keeping a title slide + a bare minimum.
  while (work.length > target && work.length > MIN_CONTENT_SLIDES) {
    work = work.slice(0, -1);
  }
  return work;
}