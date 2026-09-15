/**
 * Sanitizes user-supplied presentation preferences at the server boundary.
 *
 * The browser can send arbitrary JSON; every field is validated against the
 * canonical option sets and falls back to a safe default. Unknown style names
 * collapse to "auto" so the engine picks a semantic theme instead of crashing.
 */

import {
  DEFAULT_PRESENTATION_CONFIG,
  PPT_LAYOUT_OPTIONS,
  PPT_DENSITY_OPTIONS,
  PPT_VISUALS_OPTIONS,
  PPT_SLIDES_OPTIONS,
  normalizeStyleId,
  type PptVisualStyle,
  type PresentationConfig,
  type PptSlidesConfig,
} from "@shared/presentation";

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function pick<T extends string>(
  value: unknown,
  options: readonly T[],
  fallback: T
): T {
  return typeof value === "string" && (options as readonly string[]).includes(value)
    ? (value as T)
    : fallback;
}

export function sanitizePresentationConfig(raw: unknown): PresentationConfig {
  const src = asRecord(raw);
  const slides =
    src.slides === "auto"
      ? "auto"
      : typeof src.slides === "number" &&
          (PPT_SLIDES_OPTIONS as readonly unknown[]).includes(src.slides)
        ? (src.slides as PptSlidesConfig)
        : DEFAULT_PRESENTATION_CONFIG.slides;
  return {
    slides,
    visualStyle: normalizeStyleId(src.visualStyle),
    layout: pick(src.layout, PPT_LAYOUT_OPTIONS, DEFAULT_PRESENTATION_CONFIG.layout),
    density: pick(src.density, PPT_DENSITY_OPTIONS, DEFAULT_PRESENTATION_CONFIG.density),
    visuals: pick(src.visuals, PPT_VISUALS_OPTIONS, DEFAULT_PRESENTATION_CONFIG.visuals),
  };
}

export function sanitizeStyleName(raw: unknown): PptVisualStyle | undefined {
  if (raw === "auto" || raw === undefined || raw === null || raw === "") return undefined;
  const norm = normalizeStyleId(raw);
  return norm === "auto" ? undefined : norm;
}