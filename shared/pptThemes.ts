/**
 * Reusable professional visual styles for presentations.
 *
 * THIS is the single source of truth for every visual style. The theme picker
 * previews AND the PowerPoint generation engine both read from this module, so
 * the thumbnail the user picks is exactly the design that gets generated.
 *
 * Each style is a COMPLETE DESIGN SYSTEM — not just a color palette. A style
 * owns its typography scale, spacing, card geometry, shape language, heading
 * treatment, group dividers, chart styling, image treatment, decoration rules
 * and its preferred slide compositions. Styles genuinely differ in structure:
 * editorial ≠ corporate ≠ bold, and the same content must be visibly different
 * when a different style is selected.
 *
 * All hex colors are stored WITHOUT the leading "#".
 */

export type ThemeKind = "light" | "dark";

/** Which miniature slide composition the theme picker should render. Each
 *  style maps to its own archetype so every thumbnail is structurally
 *  distinct, not just differently colored. */
export type ThemePreviewComposition =
  | "minimal"
  | "modern"
  | "corporate"
  | "editorial"
  | "bold"
  | "elegant"
  | "creative"
  | "dark"
  | "light"
  | "glass"
  | "academic"
  | "technical"
  | "luxury"
  | "startup"
  | "magazine"
  | "data"
  | "presentation";

/** Typography personality: label + small text letter-spacing flavor. */
export type Tracking = "tight" | "normal" | "wide";

/** Surface treatment used for panels, cards and columns. */
export type CardStyle = "filled" | "outlined" | "minimal" | "hard" | "soft";

/** Accent treatment used on headings and content rows. */
export type AccentStyle = "chisel" | "bar" | "dot" | "band" | "none";

export type TypeScale = {
  /** Hero / title slide display type. */
  display: number;
  /** Content slide main heading. */
  h1: number;
  /** In-slide section heading (column titles, block headers). */
  h2: number;
  /** Body text. */
  body: number;
  /** Supporting / secondary text. */
  small: number;
  /** Kicker / eyebrow labels. */
  label: number;
  /** Captions and references. */
  caption: number;
  /** Big statistic / number. */
  stat: number;
};

export type ThemeSpec = {
  key: string;
  name: string;
  kind: ThemeKind;

  // ── Surfaces ─────────────────────────────────────────────────────────────
  background: string;
  titleBackground: string;
  sectionBackground: string;
  panel: string;
  panelBorder: string;
  surfaceAlt: string;

  // ── Color system ─────────────────────────────────────────────────────────
  primary: string;
  secondary: string;
  accent: string;
  accent2: string;
  accent3: string;
  text: string;
  muted: string;
  invertedText: string;

  // ── Typography ───────────────────────────────────────────────────────────
  titleFont: string;
  bodyFont: string;
  labelFont: string;
  typeScale: TypeScale;
  tracking: Tracking;

  // ── Geometry & spacing ───────────────────────────────────────────────────
  /** Corner radius (inches) applied to cards, 0 = sharp. */
  radius: number;
  /** Radius for large display shapes (blobs/rings). */
  radiusDisplay: number;
  borderWidth: number;

  // ── Composition language ─────────────────────────────────────────────────
  headerRule: "bar" | "underline" | "dot" | "none";
  cardStyle: CardStyle;
  accents: AccentStyle;
  heroBand: "left" | "right" | "full" | "none";
  useKicker: boolean;
  /** How densely the style packs information (0..1). */
  density: number;
  /** Preferred content layouts (in priority order) used to give slides rhythm. */
  prefLayouts: string[];
  /** Decorative motif applied sparingly on title / section slides. */
  decoration: "none" | "ring" | "grid" | "blob" | "band" | "frame" | "dots" | "offset";
  /** Whether closing/summary slides get a large takeaway callout. */
  strongClosing: boolean;

  // ── Data / charts ────────────────────────────────────────────────────────
  chartColors: [string, string, string];
  barRadius: number;

  preview: ThemePreviewComposition;
  /** Short human description of the design personality. */
  tagline: string;
};

export const VISUAL_THEMES: Record<string, ThemeSpec> = {
  Minimal: {
    key: "minimal",
    name: "Minimal",
    kind: "light",
    background: "FFFFFF",
    titleBackground: "FFFFFF",
    sectionBackground: "F4F5F7",
    panel: "F4F5F7",
    panelBorder: "E3E5EA",
    surfaceAlt: "EDEFF3",
    primary: "16181D",
    secondary: "3E444D",
    accent: "1F3B8C",
    accent2: "8A93A6",
    accent3: "C9CFDA",
    text: "23262D",
    muted: "6E7482",
    invertedText: "FFFFFF",
    titleFont: "Segoe UI",
    bodyFont: "Segoe UI",
    labelFont: "Segoe UI",
    typeScale: {
      display: 42,
      h1: 27,
      h2: 17,
      body: 15,
      small: 13,
      label: 11,
      caption: 10,
      stat: 34,
    },
    tracking: "tight",
    radius: 0.08,
    radiusDisplay: 0.5,
    borderWidth: 0.75,
    headerRule: "bar",
    cardStyle: "minimal",
    accents: "bar",
    heroBand: "none",
    useKicker: true,
    density: 0.72,
    prefLayouts: ["bullets_rail", "two_column", "stat_strip", "single_focus", "bullets", "quote"],
    decoration: "ring",
    strongClosing: true,
    chartColors: ["1F3B8C", "5B77B8", "C9CFDA"],
    barRadius: 0.03,
    preview: "minimal",
    tagline: "Whitespace-led, restrained, typography-first.",
  },

  Modern: {
    key: "modern",
    name: "Modern",
    kind: "light",
    background: "F6F7FB",
    titleBackground: "141E2E",
    sectionBackground: "ECEEF5",
    panel: "FFFFFF",
    panelBorder: "D9DEF0",
    surfaceAlt: "EDF0F8",
    primary: "141E2E",
    secondary: "33415B",
    accent: "4456C6",
    accent2: "19A9C4",
    accent3: "8A6CF0",
    text: "1E2A3E",
    muted: "5E6C82",
    invertedText: "FFFFFF",
    titleFont: "Segoe UI",
    bodyFont: "Segoe UI",
    labelFont: "Segoe UI",
    typeScale: {
      display: 40,
      h1: 26,
      h2: 16,
      body: 15,
      small: 12.5,
      label: 10.5,
      caption: 9.5,
      stat: 32,
    },
    tracking: "normal",
    radius: 0.16,
    radiusDisplay: 0.6,
    borderWidth: 0.75,
    headerRule: "bar",
    cardStyle: "soft",
    accents: "chisel",
    heroBand: "full",
    useKicker: true,
    density: 0.82,
    prefLayouts: ["feature_grid", "stat_strip", "two_column", "bullets_rail", "quote", "single_focus"],
    decoration: "blob",
    strongClosing: true,
    chartColors: ["4456C6", "19A9C4", "8A6CF0"],
    barRadius: 0.05,
    preview: "modern",
    tagline: "Contemporary SaaS-style cards, sophisticated spacing, controlled accents.",
  },

  Corporate: {
    key: "corporate",
    name: "Corporate",
    kind: "light",
    background: "FFFFFF",
    titleBackground: "10233F",
    sectionBackground: "EFF3F9",
    panel: "F5F8FC",
    panelBorder: "D6DEE9",
    surfaceAlt: "E9EEF6",
    primary: "10233F",
    secondary: "2A4671",
    accent: "0E6BA8",
    accent2: "1B9AAA",
    accent3: "E58A2C",
    text: "1B2B3D",
    muted: "5E728B",
    invertedText: "FFFFFF",
    titleFont: "Calibri",
    bodyFont: "Calibri",
    labelFont: "Calibri",
    typeScale: {
      display: 38,
      h1: 26,
      h2: 17,
      body: 15.5,
      small: 13,
      label: 11,
      caption: 10,
      stat: 32,
    },
    tracking: "normal",
    radius: 0.08,
    radiusDisplay: 0.35,
    borderWidth: 1,
    headerRule: "underline",
    cardStyle: "outlined",
    accents: "bar",
    heroBand: "left",
    useKicker: true,
    density: 0.9,
    prefLayouts: ["two_column", "table", "bullets_rail", "stat_strip", "comparison", "bullets"],
    decoration: "band",
    strongClosing: true,
    chartColors: ["0E6BA8", "1B9AAA", "E58A2C"],
    barRadius: 0.02,
    preview: "corporate",
    tagline: "Structured grid, professional type, restrained colors, sharp information hierarchy.",
  },

  Editorial: {
    key: "editorial",
    name: "Editorial",
    kind: "light",
    background: "FAF7F1",
    titleBackground: "F1EAE0",
    sectionBackground: "F0E9DD",
    panel: "FDFBF6",
    panelBorder: "E1D8C6",
    surfaceAlt: "EAE1D1",
    primary: "2A2118",
    secondary: "5A472F",
    accent: "B3552C",
    accent2: "A07B3D",
    accent3: "3E5C5A",
    text: "33291E",
    muted: "7A6E5B",
    invertedText: "FFFFFF",
    titleFont: "Georgia",
    bodyFont: "Georgia",
    labelFont: "Segoe UI",
    typeScale: {
      display: 40,
      h1: 28,
      h2: 18,
      body: 15,
      small: 13,
      label: 11,
      caption: 10,
      stat: 34,
    },
    tracking: "normal",
    radius: 0.04,
    radiusDisplay: 0.5,
    borderWidth: 0.75,
    headerRule: "underline",
    cardStyle: "minimal",
    accents: "bar",
    heroBand: "left",
    useKicker: true,
    density: 0.8,
    prefLayouts: ["single_focus", "two_column", "quote", "stat_strip", "bullets_rail", "feature_grid"],
    decoration: "frame",
    strongClosing: true,
    chartColors: ["B3552C", "A07B3D", "3E5C5A"],
    barRadius: 0.02,
    preview: "editorial",
    tagline: "Magazine-like spreads, strong serif hierarchy, asymmetric intent.",
  },

  Bold: {
    key: "bold",
    name: "Bold",
    kind: "dark",
    background: "111013",
    titleBackground: "0A0A0C",
    sectionBackground: "19171B",
    panel: "242126",
    panelBorder: "38343B",
    surfaceAlt: "1B191E",
    primary: "FFFFFF",
    secondary: "C9C4CA",
    accent: "FF4D00",
    accent2: "FFD500",
    accent3: "6C5CE7",
    text: "F0EDEF",
    muted: "9C959E",
    invertedText: "0A0A0C",
    titleFont: "Arial Black",
    bodyFont: "Arial",
    labelFont: "Arial",
    typeScale: {
      display: 48,
      h1: 32,
      h2: 19,
      body: 16,
      small: 13.5,
      label: 12,
      caption: 10.5,
      stat: 44,
    },
    tracking: "tight",
    radius: 0.03,
    radiusDisplay: 0.3,
    borderWidth: 1.5,
    headerRule: "none",
    cardStyle: "hard",
    accents: "band",
    heroBand: "left",
    useKicker: true,
    density: 0.65,
    prefLayouts: ["stat_strip", "big_statement", "bullets_rail", "two_column", "comparison", "single_focus"],
    decoration: "offset",
    strongClosing: true,
    chartColors: ["FF4D00", "FFD500", "6C5CE7"],
    barRadius: 0.02,
    preview: "bold",
    tagline: "Oversize display type, powerful contrast, unmissable numbers.",
  },

  Elegant: {
    key: "elegant",
    name: "Elegant",
    kind: "light",
    background: "FBFBF8",
    titleBackground: "F4F2EA",
    sectionBackground: "F0EEE3",
    panel: "FFFFFF",
    panelBorder: "E1DED0",
    surfaceAlt: "EAE7D8",
    primary: "1F221C",
    secondary: "494E42",
    accent: "8D7B45",
    accent2: "B9A55C",
    accent3: "5B6B6A",
    text: "262A22",
    muted: "767B6D",
    invertedText: "FFFFFF",
    titleFont: "Palatino Linotype",
    bodyFont: "Palatino Linotype",
    labelFont: "Segoe UI",
    typeScale: {
      display: 40,
      h1: 27,
      h2: 17,
      body: 15,
      small: 13,
      label: 11,
      caption: 10,
      stat: 33,
    },
    tracking: "wide",
    radius: 0.04,
    radiusDisplay: 0.4,
    borderWidth: 0.75,
    headerRule: "dot",
    cardStyle: "minimal",
    accents: "dot",
    heroBand: "none",
    useKicker: true,
    density: 0.7,
    prefLayouts: ["single_focus", "quote", "two_column", "stat_strip", "bullets_rail", "bullets"],
    decoration: "frame",
    strongClosing: true,
    chartColors: ["8D7B45", "B9A55C", "5B6B6A"],
    barRadius: 0.02,
    preview: "elegant",
    tagline: "Refined serif type, hairline details and generous breathing room.",
  },

  Creative: {
    key: "creative",
    name: "Creative",
    kind: "light",
    background: "FFFFFF",
    titleBackground: "F3EEFF",
    sectionBackground: "F6F2FF",
    panel: "F3EEFF",
    panelBorder: "DFD2F5",
    surfaceAlt: "EAE0FC",
    primary: "181321",
    secondary: "3D3551",
    accent: "6C4CF1",
    accent2: "F25DA1",
    accent3: "18B3A3",
    text: "241D33",
    muted: "6A6380",
    invertedText: "FFFFFF",
    titleFont: "Segoe UI",
    bodyFont: "Segoe UI",
    labelFont: "Segoe UI",
    typeScale: {
      display: 42,
      h1: 28,
      h2: 17,
      body: 15,
      small: 13,
      label: 11,
      caption: 10,
      stat: 34,
    },
    tracking: "normal",
    radius: 0.22,
    radiusDisplay: 0.8,
    borderWidth: 1,
    headerRule: "bar",
    cardStyle: "soft",
    accents: "chisel",
    heroBand: "full",
    useKicker: true,
    density: 0.78,
    prefLayouts: ["feature_grid", "bullets_rail", "stat_strip", "two_column", "single_focus", "quote"],
    decoration: "blob",
    strongClosing: true,
    chartColors: ["6C4CF1", "F25DA1", "18B3A3"],
    barRadius: 0.08,
    preview: "creative",
    tagline: "Bold color blocks, soft radii and an expressive, modern collage feel.",
  },

  Dark: {
    key: "dark",
    name: "Dark",
    kind: "dark",
    background: "0E1116",
    titleBackground: "090B10",
    sectionBackground: "141922",
    panel: "1A202B",
    panelBorder: "2A3342",
    surfaceAlt: "161B24",
    primary: "F5F7FA",
    secondary: "C0C8D4",
    accent: "5B8DEF",
    accent2: "38C2A8",
    accent3: "9A7CF2",
    text: "E6Eaf2",
    muted: "97A0AE",
    invertedText: "0E1116",
    titleFont: "Segoe UI",
    bodyFont: "Segoe UI",
    labelFont: "Segoe UI",
    typeScale: {
      display: 40,
      h1: 27,
      h2: 17,
      body: 15.5,
      small: 13,
      label: 11,
      caption: 10,
      stat: 34,
    },
    tracking: "normal",
    radius: 0.12,
    radiusDisplay: 0.5,
    borderWidth: 1,
    headerRule: "bar",
    cardStyle: "outlined",
    accents: "bar",
    heroBand: "left",
    useKicker: true,
    density: 0.85,
    prefLayouts: ["bullets_rail", "two_column", "stat_strip", "feature_grid", "comparison", "bullets"],
    decoration: "grid",
    strongClosing: true,
    chartColors: ["5B8DEF", "38C2A8", "9A7CF2"],
    barRadius: 0.03,
    preview: "dark",
    tagline: "Deep-space backgrounds, cool high-contrast type, crisp panels.",
  },

  Light: {
    key: "light",
    name: "Light",
    kind: "light",
    background: "FFFFFF",
    titleBackground: "EAF3FE",
    sectionBackground: "F0F6FF",
    panel: "F5F9FF",
    panelBorder: "D6E4F5",
    surfaceAlt: "E8F1FC",
    primary: "0F1B2D",
    secondary: "28405E",
    accent: "2E7CF6",
    accent2: "7FB8F7",
    accent3: "24CFC4",
    text: "18263A",
    muted: "5D708C",
    invertedText: "FFFFFF",
    titleFont: "Segoe UI",
    bodyFont: "Segoe UI",
    labelFont: "Segoe UI",
    typeScale: {
      display: 42,
      h1: 28,
      h2: 17,
      body: 15.5,
      small: 13,
      label: 11,
      caption: 10,
      stat: 35,
    },
    tracking: "normal",
    radius: 0.16,
    radiusDisplay: 0.6,
    borderWidth: 0.75,
    headerRule: "bar",
    cardStyle: "soft",
    accents: "chisel",
    heroBand: "right",
    useKicker: true,
    density: 0.8,
    prefLayouts: ["feature_grid", "two_column", "stat_strip", "bullets_rail", "bullets", "single_focus"],
    decoration: "blob",
    strongClosing: true,
    chartColors: ["2E7CF6", "7FB8F7", "24CFC4"],
    barRadius: 0.05,
    preview: "light",
    tagline: "Bright, airy and uplifting — clean whites with fresh color accents.",
  },

  Glass: {
    key: "glass",
    name: "Glass",
    kind: "dark",
    background: "101826",
    titleBackground: "0C1220",
    sectionBackground: "162033",
    panel: "1E2A40",
    panelBorder: "3A4A66",
    surfaceAlt: "182338",
    primary: "F2F5FB",
    secondary: "C4CDDC",
    accent: "5FD4F4",
    accent2: "8FA6FF",
    accent3: "F4B860",
    text: "E6ECF7",
    muted: "93A0B6",
    invertedText: "101826",
    titleFont: "Segoe UI",
    bodyFont: "Segoe UI",
    labelFont: "Segoe UI",
    typeScale: {
      display: 41,
      h1: 27,
      h2: 17,
      body: 15.5,
      small: 13,
      label: 11,
      caption: 10,
      stat: 34,
    },
    tracking: "tight",
    radius: 0.18,
    radiusDisplay: 0.7,
    borderWidth: 0.75,
    headerRule: "bar",
    cardStyle: "soft",
    accents: "chisel",
    heroBand: "full",
    useKicker: true,
    density: 0.78,
    prefLayouts: ["feature_grid", "stat_strip", "two_column", "bullets_rail", "single_focus", "quote"],
    decoration: "blob",
    strongClosing: true,
    chartColors: ["5FD4F4", "8FA6FF", "F4B860"],
    barRadius: 0.06,
    preview: "glass",
    tagline: "Frosted translucent panels floating over a rich deep backdrop.",
  },

  Academic: {
    key: "academic",
    name: "Academic",
    kind: "light",
    background: "FFFFFF",
    titleBackground: "F2F6F3",
    sectionBackground: "EAF2EE",
    panel: "F6FAF7",
    panelBorder: "D5E1DA",
    surfaceAlt: "E7F0EA",
    primary: "14382A",
    secondary: "2F5D47",
    accent: "2E7D52",
    accent2: "B9573F",
    accent3: "4A78A8",
    text: "1E2E25",
    muted: "5D7164",
    invertedText: "FFFFFF",
    titleFont: "Georgia",
    bodyFont: "Georgia",
    labelFont: "Segoe UI",
    typeScale: {
      display: 38,
      h1: 26,
      h2: 17,
      body: 15,
      small: 13,
      label: 11,
      caption: 10,
      stat: 32,
    },
    tracking: "normal",
    radius: 0.05,
    radiusDisplay: 0.4,
    borderWidth: 0.75,
    headerRule: "underline",
    cardStyle: "outlined",
    accents: "bar",
    heroBand: "none",
    useKicker: false,
    density: 0.88,
    prefLayouts: ["two_column", "table", "bullets_rail", "definition", "stat_strip", "bullets"],
    decoration: "none",
    strongClosing: true,
    chartColors: ["2E7D52", "B9573F", "4A78A8"],
    barRadius: 0.02,
    preview: "academic",
    tagline: "Structured, evidence-driven layouts with figure plates and clean citations.",
  },

  Technical: {
    key: "technical",
    name: "Technical",
    kind: "light",
    background: "F6FAFD",
    titleBackground: "0B1F33",
    sectionBackground: "EAF2FA",
    panel: "FFFFFF",
    panelBorder: "CEDFEE",
    surfaceAlt: "E3EEF8",
    primary: "0B1F33",
    secondary: "234a6a",
    accent: "0E8FBF",
    accent2: "6E5CFF",
    accent3: "2Fbf8F",
    text: "122941",
    muted: "54708C",
    invertedText: "FFFFFF",
    titleFont: "Segoe UI",
    bodyFont: "Segoe UI",
    labelFont: "Consolas",
    typeScale: {
      display: 39,
      h1: 26,
      h2: 16,
      body: 15,
      small: 12.5,
      label: 11,
      caption: 10,
      stat: 32,
    },
    tracking: "tight",
    radius: 0.1,
    radiusDisplay: 0.4,
    borderWidth: 1,
    headerRule: "bar",
    cardStyle: "hard",
    accents: "bar",
    heroBand: "right",
    useKicker: true,
    density: 0.92,
    prefLayouts: ["architecture", "two_column", "table", "bullets_rail", "process", "definition"],
    decoration: "grid",
    strongClosing: true,
    chartColors: ["0E8FBF", "6E5CFF", "2FBF8F"],
    barRadius: 0.02,
    preview: "technical",
    tagline: "Blueprint precision, monospaced labels, sharp terminals, structured diagrams.",
  },

  Luxury: {
    key: "luxury",
    name: "Luxury",
    kind: "dark",
    background: "15151B",
    titleBackground: "0D0D12",
    sectionBackground: "1B1B23",
    panel: "202029",
    panelBorder: "36363F",
    surfaceAlt: "191920",
    primary: "F6F2E9",
    secondary: "BFB7A9",
    accent: "C9A227",
    accent2: "A8793E",
    accent3: "7E8AA0",
    text: "EDE8DE",
    muted: "948E82",
    invertedText: "15151B",
    titleFont: "Georgia",
    bodyFont: "Palatino Linotype",
    labelFont: "Segoe UI",
    typeScale: {
      display: 42,
      h1: 28,
      h2: 18,
      body: 15,
      small: 13,
      label: 11,
      caption: 10,
      stat: 36,
    },
    tracking: "wide",
    radius: 0.05,
    radiusDisplay: 0.4,
    borderWidth: 0.75,
    headerRule: "underline",
    cardStyle: "minimal",
    accents: "dot",
    heroBand: "left",
    useKicker: true,
    density: 0.68,
    prefLayouts: ["single_focus", "quote", "two_column", "stat_strip", "bullets_rail", "bullets"],
    decoration: "frame",
    strongClosing: true,
    chartColors: ["C9A227", "A8793E", "7E8AA0"],
    barRadius: 0.02,
    preview: "luxury",
    tagline: "Framed whitespace, gold hairlines and quietly confident serif type.",
  },

  Startup: {
    key: "startup",
    name: "Startup",
    kind: "light",
    background: "FFFFFF",
    titleBackground: "0E1B2C",
    sectionBackground: "F0F4FA",
    panel: "F2F6FC",
    panelBorder: "D5E0EF",
    surfaceAlt: "E6EEF8",
    primary: "0E1B2C",
    secondary: "314762",
    accent: "FF5A3C",
    accent2: "FFB020",
    accent3: "28C76F",
    text: "14202F",
    muted: "5A6B83",
    invertedText: "FFFFFF",
    titleFont: "Segoe UI",
    bodyFont: "Segoe UI",
    labelFont: "Segoe UI",
    typeScale: {
      display: 44,
      h1: 29,
      h2: 17,
      body: 15.5,
      small: 13,
      label: 11.5,
      caption: 10,
      stat: 38,
    },
    tracking: "tight",
    radius: 0.16,
    radiusDisplay: 0.6,
    borderWidth: 1,
    headerRule: "bar",
    cardStyle: "soft",
    accents: "chisel",
    heroBand: "left",
    useKicker: true,
    density: 0.76,
    prefLayouts: ["stat_strip", "feature_grid", "big_statement", "two_column", "bullets_rail", "single_focus"],
    decoration: "offset",
    strongClosing: true,
    chartColors: ["FF5A3C", "FFB020", "28C76F"],
    barRadius: 0.06,
    preview: "startup",
    tagline: "Pitch-deck energy — big claims, vibrant gradients and decisive numbers.",
  },

  Magazine: {
    key: "magazine",
    name: "Magazine",
    kind: "light",
    background: "FBFAF7",
    titleBackground: "171411",
    sectionBackground: "F1EDE5",
    panel: "FDFCF9",
    panelBorder: "E0DACB",
    surfaceAlt: "E9E3D5",
    primary: "1D1916",
    secondary: "4E453B",
    accent: "C4471D",
    accent2: "2E6E63",
    accent3: "C8943A",
    text: "2A251E",
    muted: "7D7567",
    invertedText: "FFFFFF",
    titleFont: "Georgia",
    bodyFont: "Segoe UI",
    labelFont: "Segoe UI",
    typeScale: {
      display: 46,
      h1: 30,
      h2: 18,
      body: 15,
      small: 13,
      label: 12,
      caption: 10,
      stat: 36,
    },
    tracking: "normal",
    radius: 0.05,
    radiusDisplay: 0.5,
    borderWidth: 1,
    headerRule: "underline",
    cardStyle: "minimal",
    accents: "bar",
    heroBand: "left",
    useKicker: true,
    density: 0.85,
    prefLayouts: ["feature_grid", "quote", "stat_strip", "two_column", "bullets_rail", "definition"],
    decoration: "frame",
    strongClosing: true,
    chartColors: ["C4471D", "2E6E63", "C8943A"],
    barRadius: 0.02,
    preview: "magazine",
    tagline: "Cover-story typography, pull quotes and spread-driven composition.",
  },

  Data: {
    key: "data",
    name: "Data",
    kind: "dark",
    background: "0D1117",
    titleBackground: "090C11",
    sectionBackground: "121821",
    panel: "161D28",
    panelBorder: "2A3442",
    surfaceAlt: "11161F",
    primary: "F1F5F9",
    secondary: "BCC7D6",
    accent: "38BDF8",
    accent2: "818CF8",
    accent3: "34D399",
    text: "DDE6F0",
    muted: "8794A6",
    invertedText: "0D1117",
    titleFont: "Segoe UI",
    bodyFont: "Segoe UI",
    labelFont: "Consolas",
    typeScale: {
      display: 40,
      h1: 27,
      h2: 17,
      body: 15.5,
      small: 13,
      label: 11,
      caption: 10,
      stat: 38,
    },
    tracking: "tight",
    radius: 0.12,
    radiusDisplay: 0.5,
    borderWidth: 1,
    headerRule: "bar",
    cardStyle: "outlined",
    accents: "bar",
    heroBand: "right",
    useKicker: true,
    density: 0.9,
    prefLayouts: ["chart_strip", "stat_strip", "table", "comparison", "two_column", "bullets_rail"],
    decoration: "grid",
    strongClosing: true,
    chartColors: ["38BDF8", "818CF8", "34D399"],
    barRadius: 0.03,
    preview: "data",
    tagline: "Quantitative-first, chart-forward decks with precise telemetry styling.",
  },

  Presentation: {
    key: "presentation",
    name: "Presentation",
    kind: "light",
    background: "F7F6F3",
    titleBackground: "1E232B",
    sectionBackground: "EEEDEA",
    panel: "FFFFFF",
    panelBorder: "DCDAD3",
    surfaceAlt: "E8E7E2",
    primary: "1E232B",
    secondary: "3D4756",
    accent: "C4552D",
    accent2: "2C6E8F",
    accent3: "6F7F52",
    text: "252B33",
    muted: "6A7079",
    invertedText: "FFFFFF",
    titleFont: "Calibri",
    bodyFont: "Calibri",
    labelFont: "Calibri",
    typeScale: {
      display: 40,
      h1: 27,
      h2: 17,
      body: 15.5,
      small: 13,
      label: 11,
      caption: 10,
      stat: 34,
    },
    tracking: "normal",
    radius: 0.08,
    radiusDisplay: 0.4,
    borderWidth: 0.75,
    headerRule: "bar",
    cardStyle: "filled",
    accents: "bar",
    heroBand: "full",
    useKicker: true,
    density: 0.82,
    prefLayouts: ["two_column", "bullets_rail", "feature_grid", "stat_strip", "comparison", "table"],
    decoration: "band",
    strongClosing: true,
    chartColors: ["C4552D", "2C6E8F", "6F7F52"],
    barRadius: 0.03,
    preview: "presentation",
    tagline: "A balanced, versatile conference-deck default that always looks professional.",
  },
};

// Register lowercase keys into VISUAL_THEMES for stable ID lookup
for (const key of Object.keys(VISUAL_THEMES)) {
  const spec = VISUAL_THEMES[key];
  if (spec.key && !VISUAL_THEMES[spec.key]) {
    VISUAL_THEMES[spec.key] = spec;
  }
}

export const THEME_KEYS = Object.keys(VISUAL_THEMES);

/**
 * Resolves any style name or ID into the canonical ThemeSpec.
 */
export function getThemeSpec(styleId: unknown): ThemeSpec | undefined {
  if (!styleId || typeof styleId !== "string") return undefined;
  const lower = styleId.trim().toLowerCase();
  return VISUAL_THEMES[lower] || VISUAL_THEMES[styleId];
}

/**
 * Selects a style for `Auto` using semantic cues from the topic/title.
 * Explicit user choices always win (handled by the caller).
 */
export function pickAutoTheme(title: string): ThemeSpec {
  const t = title.toLowerCase();
  const match = (words: string[]): boolean => words.some(w => t.includes(w));

  if (match(["data", "analytics", "statistics", "metrics", "kpis", "dashboard", "telemetry", "mlops"]))
    return VISUAL_THEMES["data"];
  if (match(["ai", "artificial intelligence", "machine learning", "deep learning", "neural", "cloud", "software", "tech", "digital", "system", "architecture", "algorithm", "engineering", "cyber"]))
    return VISUAL_THEMES["technical"];
  if (match(["finance", "financial", "revenue", "market", "investment", "banking", "fiscal", "enterprise", "corporate", "company", "business", "organizational", "governance"]))
    return VISUAL_THEMES["corporate"];
  if (match(["science", "research", "study", "university", "academic", "paper", "healthcare", "medicine", "clinical", "education", "teaching", "thesis"]))
    return VISUAL_THEMES["academic"];
  if (match(["startup", "pitch", "investor", "funding", "launch", "product", "saas", "founder", "venture"]))
    return VISUAL_THEMES["startup"];
  if (match(["magazine", "journalism", "article", "publishing", "fashion", "culture", "media"]))
    return VISUAL_THEMES["magazine"];
  if (match(["editorial", "opinion", "essay", "story", "narrative", "chronicle"]))
    return VISUAL_THEMES["editorial"];
  if (match(["luxury", "premium", "prestige", "jewelry", "watch", "haute", "wealth", "estate"]))
    return VISUAL_THEMES["luxury"];
  if (match(["bold", "impact", "power", "aggressive", "loud", "campaign", "kickoff"]))
    return VISUAL_THEMES["bold"];
  if (match(["elegant", "subtle", "refined", "gentle", "poise", "chic", "minimal", "clean", "simple"]))
    return VISUAL_THEMES["elegant"];
  if (match(["modern", "app", "ui", "design", "creative", "brand", "agency", "visual"]))
    return VISUAL_THEMES["modern"];
  if (match(["dark", "night", "cinema", "drama", "gothic", "mystery"]))
    return VISUAL_THEMES["dark"];
  if (match(["light", "bright", "summer", "spring", "fresh", "wellness", "nature", "climate", "environment", "sustainability"]))
    return VISUAL_THEMES["light"];
  if (match(["glass", "futuristic", "ui", "interface", "immersive"]))
    return VISUAL_THEMES["glass"];
  return VISUAL_THEMES["presentation"];
}