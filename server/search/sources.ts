// Source model + helpers for Web Search and Deep Research.
//
// Every displayed source is derived from real search results. This module owns:
//  - URL validation / sanitization (link security)
//  - domain + favicon derivation
//  - deterministic source_id generation
//  - a robust way to persist structured sources alongside a message's plain
//    text answer (embedded marker format) so they survive a page reload without
//    requiring a schema migration.

import type { Source } from "@shared/research";
import { embedSourcesInContent, parseContentWithSources } from "@shared/research";

// Re-export for backward compatibility
export { embedSourcesInContent, parseContentWithSources };

/**
 * Returns true for http/https URLs that are reasonably safe to open externally.
 * Blocks javascript:, data: (except images/data we consciously skip), vbscript,
 * and malformed URLs. This protects source interactions from malicious links.
 */
export function isSafeWebUrl(value: unknown): value is string {
  if (typeof value !== "string") return false;
  let parsed: URL;
  try {
    parsed = new URL(value.trim());
  } catch {
    return false;
  }
  return parsed.protocol === "http:" || parsed.protocol === "https:";
}

/**
 * Extracts a clean registrable domain (without www. / protocol / path).
 * Returns undefined for unsafe or malformed values.
 */
export function extractDomain(value: unknown): string | undefined {
  if (!isSafeWebUrl(value)) return undefined;
  try {
    const host = new URL(value).hostname.replace(/^www\./, "").toLowerCase();
    return host || undefined;
  } catch {
    return undefined;
  }
}

/**
 * Best-effort favicon derivation from a domain (Google favicon service).
 * Only produced for validated http(s) domains.
 */
export function faviconForDomain(domain: string): string {
  return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=64`;
}

/** Deterministic, collision-resistant source id for citation mapping. */
export function makeSourceId(index: number, url: string): string {
  if (isSafeWebUrl(url)) {
    try {
      const host = new URL(url).hostname.replace(/^www\./, "").toLowerCase();
      return `src-${index + 1}-${host.replace(/[^a-z0-9]/g, "")}-${Buffer.from(url)
        .toString("base64")
        .replace(/[^a-zA-Z0-9]/g, "")
        .slice(-8)}`;
    } catch {
      // fall through
    }
  }
  return `src-${index + 1}`;
}

/** Normalizes a raw search result object into a validated Source. */
export function buildSource(raw: {
  title?: unknown;
  link?: unknown;
  url?: unknown;
  snippet?: unknown;
  description?: unknown;
  source?: unknown;
  domain?: unknown;
  date?: unknown;
  source_type?: unknown;
  published_date?: unknown;
  publishedDate?: unknown;
  index?: number;
}): Source | null {
  const url = typeof raw.url === "string" ? raw.url : raw.link;
  if (!isSafeWebUrl(url)) return null;
  const domain = extractDomain(url) ?? "";

  const title = String(
    (raw.title ?? raw.source ?? domain) || "Untitled"
  ).replace(/\s+/g, " ").trim();
  const snippet = String(raw.snippet ?? raw.description ?? "").replace(
    /\s+/g,
    " "
  ).trim();

  const rawDate = raw.date ?? raw.published_date ?? raw.publishedDate;
  let publishedDate: string | undefined;
  if (typeof rawDate === "string" || typeof rawDate === "number") {
    const d = new Date(rawDate as string | number);
    if (!Number.isNaN(d.getTime())) publishedDate = d.toISOString();
  }

  return {
    sourceId: makeSourceId(raw.index ?? 0, url),
    title: title.slice(0, 400),
    url,
    domain: domain.slice(0, 253),
    publisher:
      typeof raw.source === "string" && raw.source.trim()
        ? raw.source.trim().slice(0, 200)
        : undefined,
    faviconUrl: faviconForDomain(domain),
    description: snippet ? snippet.slice(0, 500) : undefined,
    publishedDate,
    retrievedDate: new Date().toISOString(),
    sourceType:
      typeof raw.source_type === "string" && raw.source_type.trim()
        ? raw.source_type.trim().slice(0, 40)
        : "web",
  };
}

/**
 * Keeps only the sources the answer actually cited, renumbering the inline [n]
 * markers so numbers stay contiguous (1..N) and always resolve to the same
 * source in the persisted final list.
 *
 * The search provider may return up to ~12 results, but the LLM typically cites
 * only a few and never claims a source supports the answer if it was not used.
 * If the answer contains no citations at all, the top sources are kept as
 * references so the user still has the original links.
 *
 * Returns the (possibly rewritten) answer and the filtered source list.
 */
export function normalizeCitedSources(
  answer: string,
  allSources: Source[]
): { answer: string; sources: Source[] } {
  if (!allSources.length) return { answer, sources: [] };

  const used: Source[] = [];
  const oldToNew = new Map<number, number>();
  const CITE_PATTERN = /\[(\d+)\]/g;

  let match: RegExpExecArray | null;
  while ((match = CITE_PATTERN.exec(answer)) !== null) {
    const oldIndex = Number(match[1]);
    if (oldIndex < 1 || oldIndex > allSources.length) continue;
    if (!oldToNew.has(oldIndex)) {
      oldToNew.set(oldIndex, used.length + 1);
      used.push(allSources[oldIndex - 1]);
    }
  }

  if (!used.length) {
    return { answer, sources: allSources.slice(0, 6) };
  }

  const rewritten = answer.replace(/\[(\d+)\]/g, (token, n: string) => {
    const next = oldToNew.get(Number(n));
    return next ? `[${next}]` : token;
  });

  return { answer: rewritten, sources: used };
}

/**
 * Returns true for http/https URLs that are reasonably safe to open externally.
 * Blocks javascript:, data: (except images/data we consciously skip), vbscript,
 * and malformed URLs. This protects source interactions from malicious links.
 */
