/**
 * Editable presentation outline model.
 *
 * The outline is the human-reviewable plan produced BEFORE the final .pptx is
 * generated. Unlike the canonical `PptPresentationSpec` (resolved pixel-perfect
 * geometry), an outline carries the semantic story: every slide's role, title,
 * subtitle and points. The user edits it in the chat, then approves it and the
 * server converts it into canonical slides via the professional layout engine
 * (`outlineToSlideDefinitions` on the server).
 *
 * Both the AI planner, the persistence layer (message metadata) and the client
 * editor consume exactly these types so a refreshed page can restore the exact
 * outline the user was editing.
 */

import type { PresentationConfig, PptVisualStyle } from "./presentation";

/** Semantic role of a slide. Distinct types drive distinct layout intents. */
export type PptSlideType =
  | "title"
  | "agenda"
  | "section"
  | "content"
  | "process"
  | "timeline"
  | "comparison"
  | "stats"
  | "chart"
  | "quote"
  | "key_message"
  | "closing";

export const PPT_SLIDE_TYPES: readonly PptSlideType[] = [
  "title",
  "agenda",
  "section",
  "content",
  "process",
  "timeline",
  "comparison",
  "stats",
  "chart",
  "quote",
  "key_message",
  "closing",
] as const;

export const PPT_SLIDE_TYPE_LABELS: Record<PptSlideType, string> = {
  title: "Title",
  agenda: "Agenda",
  section: "Section",
  content: "Key points",
  process: "Process",
  timeline: "Timeline",
  comparison: "Comparison",
  stats: "Statistics",
  chart: "Chart",
  quote: "Quote",
  key_message: "Key message",
  closing: "Closing",
};

/**
 * The structured fields a slide can carry. `bullets` is the universal minimum
 * (an outline slide is never title-only); the remaining fields feed richer
 * layout intents for their matching `type`.
 */
export type PptOutlineSlide = {
  id: string;
  type: PptSlideType;
  title: string;
  subtitle?: string;
  /** One-line human rationale shown under the title in the editor. */
  purpose?: string;
  bullets: string[];
  columns?: Array<{ title?: string; bullets?: string[] }>;
  metrics?: Array<{ value: string; label: string; change?: string }>;
  steps?: Array<{ step: number; title: string; description: string }>;
  quote?: { text: string; author?: string };
  keyMessage?: { statement: string; context?: string };
  chart?: Array<{ label: string; value: number }>;
  footnote?: string;
  /** Optional per-slide visual override; falls back to the deck style. */
  visual?: PptVisualStyle;
};

export type PptTopicAnalysis = {
  topic: string;
  contentType:
    | "concept"
    | "process"
    | "comparison"
    | "statistics"
    | "narrative"
    | "guide"
    | "proposal"
    | "report";
  audience: string;
  complexity: "basic" | "moderate" | "advanced";
  goal: string;
  visualNeed: "charts" | "diagrams" | "minimal" | "rich";
  /** Why the selected visual style fits this topic/audience. */
  styleRationale: string;
};

/**
 * The full, persistent outline plan. `config` and `styleName` are the deck
 * options honored by the layout engine when the outline is approved.
 */
export type PptOutlinePlan = {
  version: 1;
  title: string;
  filename: string;
  analysis: PptTopicAnalysis;
  /** Resolved number of content slides (never titles-only). */
  slideCount: number;
  slides: PptOutlineSlide[];
  config: PresentationConfig;
  styleName: PptVisualStyle;
  /** Short assistant-facing summary rendered above the editor. */
  summary: string;
};

/** JSON persisted in the assistant message's metadata column. */
export type PptOutlineMetadata = {
  kind: "pptOutline";
  outline: PptOutlinePlan;
  prompt: string;
  updatedAt: string;
  headerText: string;
};

export const PPT_OUTLINE_METADATA_KIND = "pptOutline" as const;

/** Deterministic short id for a freshly created/regenerated slide. */
export function createSlideId(): string {
  return `slide-${Date.now().toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 7)}`;
}

export function isPptOutlinePlan(value: unknown): value is PptOutlinePlan {
  return (
    Boolean(value) &&
    typeof value === "object" &&
    (value as Record<string, unknown>).version === 1 &&
    Array.isArray((value as Record<string, unknown>).slides)
  );
}

export function isPptOutlineSlide(value: unknown): value is PptOutlineSlide {
  return (
    Boolean(value) &&
    typeof value === "object" &&
    typeof (value as Record<string, unknown>).id === "string" &&
    typeof (value as Record<string, unknown>).title === "string" &&
    Array.isArray((value as Record<string, unknown>).bullets)
  );
}