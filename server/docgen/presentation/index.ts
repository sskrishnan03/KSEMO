export {
  buildPresentationSpec,
} from "./layout";

export {
  validateSpec,
  repairSpec,
  validateSlide,
  type Violation,
} from "./validator";

export {
  exportPptx,
  readCanonicalFromBuffer,
} from "./exporter";

export {
  buildDeckSpec,
  generateDeck,
  adjustSlideCount,
  type DeckResult,
  type BuildDeckArgs,
} from "./engine";

export {
  VISUAL_THEMES,
  THEME_KEYS,
  pickAutoTheme,
  type ThemeSpec,
} from "./themes";

export {
  fitText,
  measureLines,
  truncateTo,
  PROFESSIONAL_MIN_FONT,
  type FitResult,
} from "./textFit";