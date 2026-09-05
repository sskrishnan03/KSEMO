/**
 * Client-side safety net for assistant answers.
 *
 * The server strips internal provider markers ([blocked], [error], ...) from
 * each streamed delta, but a marker can theoretically span two deltas. This
 * render-level pass guarantees no internal marker ever reaches the screen or
 * the clipboard, whatever path the text took (live stream, research rewrite,
 * or a legacy row persisted before sanitization existed).
 */

const INTERNAL_MARKER =
  /\[(?:blocked|error|failed|undefined|null|object\s+object)\]/gi;
const MARKER_WITH_PREFIXED_ELLIPSIS =
  /[.。…]{2,}\s*\[(?:blocked|error|failed|undefined|null|object\s+object)\]/gi;
const MARKER_WITH_TRAILING_ELLIPSIS =
  /\[(?:blocked|error|failed|undefined|null|object\s+object)\]\s*[.。…]{2,}/gi;

export function sanitizeAssistantText(text: string): string {
  if (!text) return text;
  return text
    .replace(MARKER_WITH_PREFIXED_ELLIPSIS, "")
    .replace(MARKER_WITH_TRAILING_ELLIPSIS, "")
    .replace(INTERNAL_MARKER, "")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}