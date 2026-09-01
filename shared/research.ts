/**
 * Shared types for the Create, Search & Research capability system.
 *
 * This module defines the capability "modes" the chat composer can enter
 * (Normal Chat, the file creation formats, Web Search and Deep Research) plus
 * the structured Source model used across web search, deep research and the
 * inline citation system. Keeping these in `shared` lets the server and client
 * agree on one source of truth without drifting.
 */

/**
 * The single "active mode" of the composer. Exactly one is active at a time.
 *  - "chat"        : Normal Chat. No special workflow runs.
 *  - file formats  : File Creation Mode for that specific file type.
 *  - "web_search"  : Real web search with citations + sources.
 *  - "deep_research": Multi-step research producing a structured report.
 */
export type CapabilityMode =
  | "chat"
  | "pdf"
  | "docx"
  | "xlsx"
  | "pptx"
  | "txt"
  | "web_search"
  | "deep_research";

/** A mode in the CREATE section of the capability menu. */
export type CreateMode = "pdf" | "docx" | "xlsx" | "pptx" | "txt";

/**
 * File format type for file generation.
 */
export type FileFormat = "pdf" | "docx" | "xlsx" | "pptx" | "txt";

/** A mode in the SEARCH & RESEARCH section of the capability menu. */
export type ResearchMode = "web_search" | "deep_research";

export const CREATE_MODES: CreateMode[] = [
  "pdf",
  "docx",
  "xlsx",
  "pptx",
  "txt",
];

export const RESEARCH_MODES: ResearchMode[] = ["web_search", "deep_research"];

export function isCreateMode(value: unknown): value is CreateMode {
  return typeof value === "string" && (CREATE_MODES as string[]).includes(value);
}

export function isResearchMode(value: unknown): value is ResearchMode {
  return (
    typeof value === "string" && (RESEARCH_MODES as string[]).includes(value)
  );
}

export function isCapabilityMode(value: unknown): value is CapabilityMode {
  return (
    value === "chat" || isCreateMode(value) || isResearchMode(value)
  );
}

/**
 * A single retrieved source. Every field is populated from real data returned
 * by the search / research process. The frontend renders sources using this
 * structured shape and must never hardcode any source metadata.
 */
export type Source = {
  /** Stable id used to map inline citations ([1], [2], ...) to this source. */
  sourceId: string;
  title: string;
  /** original, validated, externally clickable URL. */
  url: string;
  /** registered domain, e.g. "openai.com". */
  domain: string;
  /** publisher / website display name when known. */
  publisher?: string;
  /** website favicon URL when known. */
  faviconUrl?: string;
  /** short description / snippet. */
  description?: string;
  /** ISO date the source was published, when known. */
  publishedDate?: string;
  /** ISO date the source was retrieved. */
  retrievedDate: string;
  /** "web" | "news" | "academic" ... */
  sourceType?: string;
};

/** Category grouping used by the Deep Research source panel. */
export type SourceCategory =
  | "Academic"
  | "Official"
  | "Industry"
  | "News";

/** Progress stage for Web Search / Deep Research streaming. */
export type ResearchProgressStage =
  | "understanding"
  | "planning"
  | "searching"
  | "retrieving"
  | "analyzing"
  | "comparing"
  | "writing"
  | "completed"
  | "error";

export const RESEARCH_STAGES: ResearchProgressStage[] = [
  "understanding",
  "planning",
  "searching",
  "retrieving",
  "analyzing",
  "comparing",
  "writing",
];

/**
 * The structured summary of a Deep Research run displayed in the source panel.
 * Only computed from real retrieved source data — never fabricated.
 */
export type ResearchSummary = {
  sourcesUsed: number;
  byCategory: Partial<Record<SourceCategory, number>>;
};

// The answer (content) and its structured sources are stored together in the
// message `content` string. The human-readable Markdown answer comes first,
// followed by a marker that carries the JSON sources. Renderers parse this out
// and never display it raw; context builders strip it before calling the LLM.
const SOURCES_MARKER_START = "<!--KSEMO_SOURCES_START-->";
const SOURCES_MARKER_END = "<!--KSEMO_SOURCES_END-->";

/**
 * Serializes the human-readable answer plus its structured sources into a
 * single message content string. The marker is an HTML comment so a Markdown
 * renderer never shows it, and our renderer strips it before display.
 */
export function embedSourcesInContent(
  answer: string,
  sources: Source[]
): string {
  if (!sources.length) return answer;
  try {
    const json = JSON.stringify(sources);
    return `${answer.trimEnd()}\n\n${SOURCES_MARKER_START}\n${json}\n${SOURCES_MARKER_END}\n`;
  } catch {
    return answer;
  }
}

/**
 * Parses structured sources out of a message content string. Returns the
 * cleaned human-readable answer and the extracted sources.
 */
export function parseContentWithSources(
  content: string
): { answer: string; sources: Source[] } {
  if (!content) return { answer: "", sources: [] };
  const start = content.indexOf(SOURCES_MARKER_START);
  const endAt = content.indexOf(SOURCES_MARKER_END);
  if (start === -1 || endAt === -1 || endAt <= start) {
    return { answer: content, sources: [] };
  }
  const rawJson = content
    .slice(start + SOURCES_MARKER_START.length, endAt)
    .trim();
  let sources: Source[] = [];
  try {
    const parsed = JSON.parse(rawJson);
    if (Array.isArray(parsed)) {
      sources = parsed.filter(
        (s): s is Source =>
          s &&
          typeof s === "object" &&
          typeof (s as Source).sourceId === "string" &&
          typeof (s as Source).title === "string" &&
          typeof (s as Source).url === "string"
      );
    }
  } catch {
    sources = [];
  }
  const answer = content.slice(0, start).trimEnd();
  return { answer, sources };
}
