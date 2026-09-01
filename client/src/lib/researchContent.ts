// Client-side helpers for rendering Web Search / Deep Research results.
//
// The server persists an assistant message's human-readable answer together with
// its structured sources by embedding a JSON payload inside HTML-comment markers
// in the message `content` string. When the user reloads a conversation (so the
// sources were never delivered via a live SSE event), this module recovers them
// from the persisted content. It mirrors `server/search/sources.ts`.

import type { Source } from "@shared/research";

const SOURCES_MARKER_START = "<!--KSEMO_SOURCES_START-->";
const SOURCES_MARKER_END = "<!--KSEMO_SOURCES_END-->";

/** Extracts the human-readable answer and any embedded structured sources. */
export function parseMessageSources(
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
    const parsed = JSON.parse(rawJson) as unknown;
    if (Array.isArray(parsed)) {
      sources = parsed.filter(
        (s): s is Source =>
          !!s &&
          typeof s === "object" &&
          typeof (s as Source).sourceId === "string" &&
          typeof (s as Source).title === "string" &&
          typeof (s as Source).url === "string"
      );
    }
  } catch {
    sources = [];
  }
  return { answer: content.slice(0, start).trimEnd(), sources };
}

/** Strips any embedded sources marker so speech/export never leaks the JSON. */
export function stripMessageSources(content: string): string {
  return parseMessageSources(content).answer;
}

/**
 * Rewrites inline `[n]` citation tokens in an answer into clickable links that
 * open the matching source URL (uses native Markdown link syntax so any MD
 * renderer displays the numbered badge and opens the source on click).
 *
 * Only in-range citation numbers are rewritten; unknown/out-of-range tokens are
 * left as plain text. The markdown pipe placeholder is used so tokens already
 * written as `[1](url)` links are never double-wrapped.
 */
export function decorateCitations(answer: string, sources: Source[]): string {
  if (!answer || !sources.length) return answer;
  const byNumber = new Map<number, Source>();
  sources.forEach((source, i) => byNumber.set(i + 1, source));
  return answer.replace(
    /\[(\d{1,2})\](?!\s*\()/g,
    (token, rawNumber: string) => {
      const n = Number(rawNumber);
      const source = byNumber.get(n);
      if (!source) return token;
      return `[${n}](${source.url})`;
    }
  );
}

/** The citation number (1-based) that maps a sourceId to the report body. */
export function citationNumberForSource(source: Source, index: number): number {
  return index + 1;
}
