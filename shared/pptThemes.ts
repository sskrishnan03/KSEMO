/**
 * Reusable professional visual styles for presentations.
 *
 * THIS is the single source of truth for every visual style. The theme picker
 * previews AND the PowerPoint generation engine both read from this module, so
 * the thumbnail the user picks is exactly the design that gets generated.
 *
 * Each style is a complete design system: palette, typography, card geometry,
 * title treatment, footer treatment and composition hints. Styles genuinely
 * differ in structure, not just accent color — light vs dark, serif vs sans,
 * band at the left vs full-bleed hero vs dotted dividers, etc.
 *
 * All hex colors are stored WITHOUT the leading "#".
 */

export type ThemeKind = "light" | "dark";

/** Which miniature slide composition the theme picker should render. Each
 *  style maps to its own archetype so every thumbnail is structurally
 *  distinct, not just differently colored. */
export type ThemePreviewComposition =
  | "hero" // Visual: image-led, one big visual block + short headline
  | "minimal" // Minimal: one heading, one accent, whitespace dominates
  | "classic" // Classic: traditional title + structured panels
  | "consultant" // Consultant: takeaway + metrics + evidence chart
  | "editorial" // Editorial: asymmetric magazine spread
  | "modern" // Modern: clean rounded SaaS card grid
  | "bold" // Bold: giant number, high contrast, dramatic
  | "elegant" // Elegant: refined sparse typography + hairline details
  | "professional" // Professional: corporate bullets + chart
  | "creative" // Creative: asymmetric shapes, collage feel
  | "tech" // Tech: dashboard / system diagram
  | "cinematic" // Cinematic: full-bleed dark frame, dramatic type
  | "playful" // Playful: rounded blobs, energetic
  | "luxury" // Luxury: framed whitespace, serif, diamonds
  | "academic" // Academic: figure + references, structured
  | "futuristic" // Futuristic: layered geometric, glowing data
  | "storytelling"; // Storytelling: narrative progression

export type ThemeSpec = {
  key: string;
  name: string;
  kind: ThemeKind;
  /** Normal content slide background. */
  background: string;
  /** Title / hero slide background. */
  titleBackground: string;
  /** Section divider slide background. */
  sectionBackground: string;
  /** Card / panel surface. */
  panel: string;
  /** Card / panel border. */
  panelBorder: string;
  primary: string;
  secondary: string;
  accent: string;
  accent2: string;
  text: string;
  muted: string;
  invertedText: string;
  titleFont: string;
  bodyFont: string;
  /** Corner radius (inches) applied to cards. */
  radius: number;
  /** Header rule style on content slides. */
  headerRule: "bar" | "underline" | "dot" | "none";
  /** Where the hero band sits on title slides. */
  heroBand: "left" | "right" | "full" | "none";
  /** Show a small kicker label above titles on section/summary slides. */
  useKicker: boolean;
  /** Accent color set used for charts. */
  chartColors: [string, string];
  /** Miniature composition used by the theme picker preview. */
  preview: ThemePreviewComposition;
};

export const VISUAL_THEMES: Record<string, ThemeSpec> = {
  Minimal: {
    key: "minimal",
    name: "Minimal",
    kind: "light",
    background: "FFFFFF",
    titleBackground: "FFFFFF",
    sectionBackground: "F5F6F8",
    panel: "F5F6F8",
    panelBorder: "E4E7EC",
    primary: "1A2233",
    secondary: "46536C",
    accent: "23408F",
    accent2: "7C8DB5",
    text: "232A38",
    muted: "6B7686",
    invertedText: "FFFFFF",
    titleFont: "Segoe UI",
    bodyFont: "Segoe UI",
    radius: 0.08,
    headerRule: "bar",
    heroBand: "left",
    useKicker: true,
    chartColors: ["23408F", "7C8DB5"],
    preview: "minimal",
  },
  Visual: {
    key: "visual",
    name: "Visual",
    kind: "light",
    background: "FFFFFF",
    titleBackground: "101418",
    sectionBackground: "F5F6F8",
    panel: "F8F9FB",
    panelBorder: "E2E5EA",
    primary: "101418",
    secondary: "3E4853",
    accent: "E8463F",
    accent2: "2A2E38",
    text: "16191D",
    muted: "6B7480",
    invertedText: "FFFFFF",
    titleFont: "Segoe UI",
    bodyFont: "Segoe UI",
    radius: 0.16,
    headerRule: "bar",
    heroBand: "full",
    useKicker: true,
    chartColors: ["E8463F", "2A2E38"],
    preview: "hero",
  },
  Classic: {
    key: "classic",
    name: "Classic",
    kind: "light",
    background: "FFFFFF",
    titleBackground: "0E2A47",
    sectionBackground: "EEF3F9",
    panel: "F3F7FC",
    panelBorder: "D7E2EE",
    primary: "0E2A47",
    secondary: "2E4A6E",
    accent: "0B7A8F",
    accent2: "E8842C",
    text: "1B2A3A",
    muted: "5E7086",
    invertedText: "FFFFFF",
    titleFont: "Calibri",
    bodyFont: "Calibri",
    radius: 0.06,
    headerRule: "underline",
    heroBand: "full",
    useKicker: true,
    chartColors: ["0B7A8F", "0E2A47"],
    preview: "classic",
  },
  Consultant: {
    key: "consultant",
    name: "Consultant",
    kind: "light",
    background: "FFFFFF",
    titleBackground: "F4F1EC",
    sectionBackground: "F1EDE6",
    panel: "F8F6F2",
    panelBorder: "E2DCD1",
    primary: "1C1E21",
    secondary: "3E444C",
    accent: "C8A24A",
    accent2: "26415E",
    text: "23262B",
    muted: "6E747D",
    invertedText: "FFFFFF",
    titleFont: "Calibri",
    bodyFont: "Calibri",
    radius: 0.09,
    headerRule: "bar",
    heroBand: "left",
    useKicker: true,
    chartColors: ["C8A24A", "26415E"],
    preview: "consultant",
  },
  Editorial: {
    key: "editorial",
    name: "Editorial",
    kind: "light",
    background: "FAF7F2",
    titleBackground: "F4EEE4",
    sectionBackground: "F0EAE0",
    panel: "FDFBF7",
    panelBorder: "E3DACA",
    primary: "2A2118",
    secondary: "5A4A36",
    accent: "B3552C",
    accent2: "8A6D3B",
    text: "33291E",
    muted: "7D7263",
    invertedText: "FFFFFF",
    titleFont: "Georgia",
    bodyFont: "Georgia",
    radius: 0.12,
    headerRule: "underline",
    heroBand: "left",
    useKicker: true,
    chartColors: ["B3552C", "8A6D3B"],
    preview: "editorial",
  },
  Modern: {
    key: "modern",
    name: "Modern",
    kind: "light",
    background: "F7F8FA",
    titleBackground: "1E2A3A",
    sectionBackground: "ECEEF3",
    panel: "FFFFFF",
    panelBorder: "DCDFE8",
    primary: "1E2A3A",
    secondary: "40536B",
    accent: "4456C6",
    accent2: "34B3C6",
    text: "273340",
    muted: "6A7686",
    invertedText: "FFFFFF",
    titleFont: "Segoe UI",
    bodyFont: "Segoe UI",
    radius: 0.1,
    headerRule: "bar",
    heroBand: "full",
    useKicker: true,
    chartColors: ["4456C6", "34B3C6"],
    preview: "modern",
  },
  Bold: {
    key: "bold",
    name: "Bold",
    kind: "dark",
    background: "141414",
    titleBackground: "0D0D0D",
    sectionBackground: "1B1B1B",
    panel: "1E1E1E",
    panelBorder: "333333",
    primary: "FFFFFF",
    secondary: "BDBDBD",
    accent: "FF5A1F",
    accent2: "F9E000",
    text: "EDEDED",
    muted: "999999",
    invertedText: "141414",
    titleFont: "Arial Black",
    bodyFont: "Arial",
    radius: 0.02,
    headerRule: "none",
    heroBand: "left",
    useKicker: true,
    chartColors: ["FF5A1F", "F9E000"],
    preview: "bold",
  },
  Elegant: {
    key: "elegant",
    name: "Elegant",
    kind: "light",
    background: "FBFBF9",
    titleBackground: "F5F3EC",
    sectionBackground: "F1EFE6",
    panel: "FFFFFF",
    panelBorder: "E2DFD3",
    primary: "20231E",
    secondary: "4C5149",
    accent: "9B8A5A",
    accent2: "C9A227",
    text: "262920",
    muted: "7A7E75",
    invertedText: "FFFFFF",
    titleFont: "Palatino Linotype",
    bodyFont: "Palatino Linotype",
    radius: 0.04,
    headerRule: "dot",
    heroBand: "none",
    useKicker: true,
    chartColors: ["9B8A5A", "C9A227"],
    preview: "elegant",
  },
  Professional: {
    key: "professional",
    name: "Professional",
    kind: "light",
    background: "FBFCFE",
    titleBackground: "EEF2F9",
    sectionBackground: "F0F3F9",
    panel: "F7F9FD",
    panelBorder: "E1E7F0",
    primary: "22314A",
    secondary: "42577A",
    accent: "6687C4",
    accent2: "9FB6DC",
    text: "2A3A52",
    muted: "6B7D99",
    invertedText: "FFFFFF",
    titleFont: "Calibri",
    bodyFont: "Calibri",
    radius: 0.12,
    headerRule: "underline",
    heroBand: "none",
    useKicker: true,
    chartColors: ["6687C4", "42577A"],
    preview: "professional",
  },
  Creative: {
    key: "creative",
    name: "Creative",
    kind: "light",
    background: "FFFFFF",
    titleBackground: "FFFFFF",
    sectionBackground: "F5F8FF",
    panel: "F0F6FF",
    panelBorder: "CFE0F5",
    primary: "111827",
    secondary: "374151",
    accent: "6C4CF1",
    accent2: "F15D96",
    text: "1F2937",
    muted: "63708B",
    invertedText: "FFFFFF",
    titleFont: "Segoe UI",
    bodyFont: "Segoe UI",
    radius: 0.16,
    headerRule: "bar",
    heroBand: "full",
    useKicker: true,
    chartColors: ["6C4CF1", "F15D96"],
    preview: "creative",
  },
  Tech: {
    key: "tech",
    name: "Tech",
    kind: "light",
    background: "F7FAFD",
    titleBackground: "0B1E33",
    sectionBackground: "EAF2FA",
    panel: "FFFFFF",
    panelBorder: "D6E2EE",
    primary: "0B1E33",
    secondary: "274868",
    accent: "22A7F0",
    accent2: "7C5CFF",
    text: "12233A",
    muted: "5E7694",
    invertedText: "FFFFFF",
    titleFont: "Segoe UI",
    bodyFont: "Segoe UI",
    radius: 0.14,
    headerRule: "bar",
    heroBand: "right",
    useKicker: true,
    chartColors: ["22A7F0", "7C5CFF"],
    preview: "tech",
  },
  Cinematic: {
    key: "cinematic",
    name: "Cinematic",
    kind: "dark",
    background: "0E1420",
    titleBackground: "0B1019",
    sectionBackground: "131A28",
    panel: "1B2434",
    panelBorder: "2A3550",
    primary: "F4F6FA",
    secondary: "B9C2D4",
    accent: "5B8CFF",
    accent2: "7FD1AE",
    text: "E8ECF4",
    muted: "93A0B8",
    invertedText: "0B1019",
    titleFont: "Segoe UI",
    bodyFont: "Segoe UI",
    radius: 0.1,
    headerRule: "bar",
    heroBand: "left",
    useKicker: true,
    chartColors: ["5B8CFF", "7FD1AE"],
    preview: "cinematic",
  },
  Playful: {
    key: "playful",
    name: "Playful",
    kind: "light",
    background: "FFFDF8",
    titleBackground: "1F1A16",
    sectionBackground: "F1EBDD",
    panel: "FFFFFF",
    panelBorder: "E4DCC8",
    primary: "1F1A16",
    secondary: "4C4035",
    accent: "D62828",
    accent2: "1F1A16",
    text: "2B241C",
    muted: "766C5C",
    invertedText: "FFFDF8",
    titleFont: "Tahoma",
    bodyFont: "Tahoma",
    radius: 0.02,
    headerRule: "none",
    heroBand: "left",
    useKicker: true,
    chartColors: ["D62828", "1F1A16"],
    preview: "playful",
  },
  Luxury: {
    key: "luxury",
    name: "Luxury",
    kind: "light",
    background: "FFFFFF",
    titleBackground: "242835",
    sectionBackground: "F2F1F5",
    panel: "F8F7FA",
    panelBorder: "E0DFE6",
    primary: "242835",
    secondary: "495060",
    accent: "B3473E",
    accent2: "4A4E69",
    text: "2B2F3A",
    muted: "707583",
    invertedText: "FFFFFF",
    titleFont: "Georgia",
    bodyFont: "Calibri",
    radius: 0.08,
    headerRule: "underline",
    heroBand: "left",
    useKicker: true,
    chartColors: ["B3473E", "4A4E69"],
    preview: "luxury",
  },
  Academic: {
    key: "academic",
    name: "Academic",
    kind: "light",
    background: "FFFFFF",
    titleBackground: "F3F6F4",
    sectionBackground: "EDF2EE",
    panel: "F7FAF8",
    panelBorder: "D9E2DC",
    primary: "1B3A2D",
    secondary: "3C5A4B",
    accent: "2E7D52",
    accent2: "C0503A",
    text: "1E2B24",
    muted: "5F7268",
    invertedText: "FFFFFF",
    titleFont: "Georgia",
    bodyFont: "Georgia",
    radius: 0.05,
    headerRule: "underline",
    heroBand: "none",
    useKicker: false,
    chartColors: ["2E7D52", "C0503A"],
    preview: "academic",
  },
  Futuristic: {
    key: "futuristic",
    name: "Futuristic",
    kind: "dark",
    background: "0A0E1A",
    titleBackground: "070A13",
    sectionBackground: "101627",
    panel: "131B30",
    panelBorder: "24304F",
    primary: "EDF2FF",
    secondary: "AFC0E8",
    accent: "7A5CFF",
    accent2: "00D4FF",
    text: "DCE4FF",
    muted: "8B99C4",
    invertedText: "0A0E1A",
    titleFont: "Segoe UI",
    bodyFont: "Segoe UI",
    radius: 0.14,
    headerRule: "bar",
    heroBand: "right",
    useKicker: true,
    chartColors: ["7A5CFF", "00D4FF"],
    preview: "futuristic",
  },
  Storytelling: {
    key: "storytelling",
    name: "Storytelling",
    kind: "light",
    background: "FDFBF7",
    titleBackground: "241F1A",
    sectionBackground: "F4EFE6",
    panel: "FFFEFB",
    panelBorder: "E6DDCE",
    primary: "241F1A",
    secondary: "4E453A",
    accent: "D95A2F",
    accent2: "2F6B5B",
    text: "2B2620",
    muted: "7A7264",
    invertedText: "FFFFFF",
    titleFont: "Georgia",
    bodyFont: "Calibri",
    radius: 0.1,
    headerRule: "underline",
    heroBand: "left",
    useKicker: true,
    chartColors: ["D95A2F", "2F6B5B"],
    preview: "storytelling",
  },
};

export const THEME_KEYS = Object.keys(VISUAL_THEMES);

/**
 * Selects a style for `Auto` using semantic cues from the topic/title.
 * Explicit user choices always win (handled by the caller).
 */
export function pickAutoTheme(title: string): ThemeSpec {
  const t = title.toLowerCase();
  const match = (words: string[]): boolean =>
    words.some(w => t.includes(w));
  if (match(["finance", "financial", "revenue", "market", "investment", "growth", "analy"]))
    return VISUAL_THEMES["Classic"];
  if (match(["ai", "artificial intelligence", "machine learning", "cloud", "software", "tech", "digital", "startup", "innovation", "data"]))
    return VISUAL_THEMES["Tech"];
  if (match(["science", "research", "study", "university", "academic", "paper", "healthcare", "medicine"]))
    return VISUAL_THEMES["Academic"];
  if (match(["strategy", "consulting", "framework", "transformation", "roadmap", "organization"]))
    return VISUAL_THEMES["Consultant"];
  if (match(["pitch", "investor", "funding", "launch", "product"]))
    return VISUAL_THEMES["Creative"];
  if (match(["car", "auto", "automotive", "luxury", "travel", "tourism", "design"]))
    return VISUAL_THEMES["Luxury"];
  if (match(["report", "annual", "corporate", "company ", "enterprise"]))
    return VISUAL_THEMES["Classic"];
  return VISUAL_THEMES["Minimal"];
}