/**
 * Canonical presentation model.
 *
 * A generated PowerPoint is described by a single canonical specification
 * (`PptPresentationSpec`). The KSEMO preview renderer and the .pptx exporter
 * BOTH consume exactly this specification, so the preview and the downloaded
 * file can never drift from each other.
 *
 * All coordinates are expressed in PowerPoint-native inches on a fixed
 * 16:9 canvas (13.333 x 7.5 inches). Renderers convert inches -> their local
 * pixel space through a proportional scale (e.g. 96 px per inch).
 */

export type PptSlidesConfig =
  | "auto"
  | 1
  | 2
  | 3
  | 4
  | 5
  | 6
  | 7
  | 8
  | 9
  | 10
  | 11
  | 12
  | 13
  | 14
  | 15;

export type PptVisualStyle =
  | "auto"
  | "Minimal"
  | "Visual"
  | "Classic"
  | "Consultant"
  | "Editorial"
  | "Modern"
  | "Bold"
  | "Elegant"
  | "Professional"
  | "Creative"
  | "Tech"
  | "Cinematic"
  | "Playful"
  | "Luxury"
  | "Academic"
  | "Futuristic"
  | "Storytelling";

export type PptLayoutStrategy =
  | "auto"
  | "Balanced"
  | "Visual First"
  | "Text First"
  | "Data First"
  | "Minimal"
  | "Dense Professional";

export type PptDensity = "auto" | "Light" | "Standard" | "Detailed" | "Research";

export type PptVisuals =
  | "auto"
  | "Minimal"
  | "Balanced"
  | "Image Rich"
  | "Charts & Data"
  | "No Images";

export type PresentationConfig = {
  slides: PptSlidesConfig;
  visualStyle: PptVisualStyle;
  layout: PptLayoutStrategy;
  density: PptDensity;
  visuals: PptVisuals;
};

export const DEFAULT_PRESENTATION_CONFIG: PresentationConfig = {
  slides: "auto",
  visualStyle: "auto",
  layout: "Balanced",
  density: "Standard",
  visuals: "Balanced",
};

export const PPT_SLIDES_OPTIONS: PptSlidesConfig[] = [
  "auto",
  1,
  2,
  3,
  4,
  5,
  6,
  7,
  8,
  9,
  10,
  11,
  12,
  13,
  14,
  15,
];

export const PPT_STYLE_OPTIONS: PptVisualStyle[] = [
  "auto",
  "Minimal",
  "Visual",
  "Classic",
  "Consultant",
  "Editorial",
  "Modern",
  "Bold",
  "Elegant",
  "Professional",
  "Creative",
  "Tech",
  "Cinematic",
  "Playful",
  "Luxury",
  "Academic",
  "Futuristic",
  "Storytelling",
];


export const PPT_LAYOUT_OPTIONS: PptLayoutStrategy[] = [
  "auto",
  "Balanced",
  "Visual First",
  "Text First",
  "Data First",
  "Minimal",
  "Dense Professional",
];

export const PPT_DENSITY_OPTIONS: PptDensity[] = [
  "auto",
  "Light",
  "Standard",
  "Detailed",
  "Research",
];

export const PPT_VISUALS_OPTIONS: PptVisuals[] = [
  "auto",
  "Minimal",
  "Balanced",
  "Image Rich",
  "Charts & Data",
  "No Images",
];

export const SLIDE_WIDTH_IN = 13.333;
export const SLIDE_HEIGHT_IN = 7.5;
export const INCH_TO_PX = 96;

/** Default safe margins applied to every slide (inches). */
export const SAFE_MARGIN = {
  left: 0.6,
  right: 0.6,
  top: 0.55,
  bottom: 0.45,
} as const;

export type PptBox = {
  x: number;
  y: number;
  w: number;
  h: number;
};

export type PptElement =
  | {
      kind: "text";
      box: PptBox;
      text: string;
      fontSize: number;
      bold?: boolean;
      color: string;
      align?: "left" | "center" | "right";
      valign?: "top" | "middle" | "bottom";
      italic?: boolean;
      font?: string;
      lineSpacing?: number;
      bullet?: boolean;
      letterSpacing?: number;
      opacity?: number;
    }
  | {
      kind: "shape";
      box: PptBox;
      shape: "rect" | "roundRect" | "line" | "ellipse" | "chevron";
      fill?: string;
      lineColor?: string;
      lineWidth?: number;
      radius?: number;
      opacity?: number;
      flipV?: boolean;
    }
  | {
      kind: "image";
      box: PptBox;
      src: string;
      fit: "cover" | "contain";
      radius?: number;
    }
  | {
      kind: "table";
      box: PptBox;
      headers: string[];
      rows: string[][];
      fontSize: number;
      headerFill: string;
      headerColor: string;
      rowFill: string;
      altRowFill: string;
      textColor: string;
      borderColor: string;
    }
  | {
      kind: "barChart";
      box: PptBox;
      data: Array<{ label: string; value: number }>;
      color: string;
      secondaryColor: string;
      labelColor: string;
      valueColor: string;
      max: number;
    };

export type PptSlideSpec = {
  index: number;
  kind: string;
  background: string;
  elements: PptElement[];
  notes?: string;
};

export type PptPresentationSpec = {
  version: 1;
  widthIn: number;
  heightIn: number;
  title: string;
  themeKey: string;
  style: string;
  config: PresentationConfig;
  slides: PptSlideSpec[];
};

export const CANONICAL_PART_NAME = "ppt/canonical.json";

/** Estimate rendered text block height given a box and font in inches. */
export function estimateTextHeight(inches: {
  text: string;
  fontSize: number;
  widthIn: number;
  lineSpacing?: number;
  bold?: boolean;
}): number {
  const { text, fontSize, widthIn, lineSpacing = 1.15, bold } = inches;
  const pt = fontSize;
  // Conservative average character width for mixed-case Latin text at 96dpi.
  // Slightly over-estimates so PowerPoint never wraps beyond our estimate.
  const avgCharWidthIn = (pt * 0.55) / 72 + 0.01;
  const usableIn = Math.max(widthIn - 0.1, 0.2);
  const charLimitPerLine = Math.max(Math.floor(usableIn / avgCharWidthIn), 3);
  const words = text.split(/\s+/).filter(Boolean);
  let lines = 1;
  let current = 0;
  for (const word of words) {
    const wordLen = word.length;
    if (current + wordLen + 1 > charLimitPerLine && current > 0) {
      lines += 1;
      current = wordLen;
    } else {
      current += wordLen + 1;
    }
  }
  const lineHeightIn = pt / 72 * lineSpacing;
  return lines * lineHeightIn + 0.04;
}