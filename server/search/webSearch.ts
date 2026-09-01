// Real web search via SerpApi's Google Search engine.
//
// The SERPAPI_API_KEY environment variable configures the provider. If it is
// missing, search gracefully reports that it is unavailable rather than
// fabricating results. Every Source returned here is built from real responses.

import type { Source } from "@shared/research";
import { buildSource, isSafeWebUrl } from "./sources";

function serpApiKey(): string | null {
  return process.env.SERPAPI_API_KEY?.trim() || null;
}

function hostFor(query: string): string | null {
  try {
    return new URL(query).hostname || null;
  } catch {
    return null;
  }
}

/**
 * Runs a single Google web search query through SerpApi and returns the raw
 * organic result items. Returns an empty array when no results were returned.
 * Throws a descriptive Error on provider/network failures so the caller can
 * report a real search outage (never a fake success).
 */
export async function serpSearch(
  query: string,
  options: { num?: number; timeoutMs?: number } = {}
): Promise<Array<Record<string, unknown>>> {
  const key = serpApiKey();
  if (!key) {
    throw new Error(
      "Web search is not configured. Set SERPAPI_API_KEY in the environment."
    );
  }
  const cleanQuery = query.trim();
  if (!cleanQuery) return [];

  const params = new URLSearchParams({
    engine: "google",
    q: cleanQuery,
    api_key: key,
    num: String(options.num ?? 8),
    gl: "us",
    hl: "en",
  });

  const controller = new AbortController();
  const timer = setTimeout(
    () => controller.abort(new Error("search timeout")),
    options.timeoutMs ?? 20_000
  );

  try {
    const response = await fetch(
      `https://serpapi.com/search.json?${params.toString()}`,
      { signal: controller.signal }
    );
    if (!response.ok) {
      const body = await response.text().catch(() => "");
      // A 429 (rate limit) etc. should surface as a real, retryable error.
      throw new Error(`Search provider returned ${response.status}. ${body}`);
    }
    const data = (await response.json()) as {
      organic_results?: Array<Record<string, unknown>>;
      answer_box?: Record<string, unknown> | null;
      knowledge_graph?: Record<string, unknown> | null;
      error?: string;
    };
    if (data.error) throw new Error(`Search failed: ${data.error}`);
    return Array.isArray(data.organic_results) ? data.organic_results : [];
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Converts raw SerpApi results into validated Source objects.
 * Deduplicates by normalized URL and filters unsafe entries.
 */
export function sourcesFromSerp(
  raw: Array<Record<string, unknown>>
): Source[] {
  const seen = new Set<string>();
  const out: Source[] = [];
  raw.forEach((item, index) => {
    const source = buildSource({
      title: item.title,
      link: item.link,
      url: item.link,
      snippet: item.snippet,
      description: item.snippet ?? item.raw_description,
      source: item.source,
      domain: item.displayed_link,
      date: item.date ?? item.published_date,
      source_type: "web",
      index,
    });
    if (!source) return;
    const normalized = source.url.replace(/[?#].*$/, "").toLowerCase();
    if (seen.has(normalized)) return;
    seen.add(normalized);
    out.push(source);
  });
  return out.slice(0, 8);
}

/**
 * High-level entry point used by the Web Search mode: run a query, optionally
 * expand with one extra query, and return validated sources.
 */
export async function searchWeb(
  query: string,
  options: { followUpQueries?: string[] } = {}
): Promise<Source[]> {
  const primary = await serpSearch(query);
  const sources = sourcesFromSerp(primary);

  // Optionally enrich with a focused follow-up query for coverage.
  const followUp = options.followUpQueries?.find(
    q => q && q.trim() && q.trim() !== query.trim()
  );
  if (followUp) {
    try {
      const extra = sourcesFromSerp(await serpSearch(followUp, { num: 5 }));
      const existing = new Set(sources.map(s => s.url.replace(/[?#].*$/, "")));
      for (const source of extra) {
        if (existing.has(source.url.replace(/[?#].*$/, ""))) continue;
        sources.push(source);
        existing.add(source.url.replace(/[?#].*$/, ""));
        if (sources.length >= 12) break;
      }
    } catch {
      // Enrichment is best-effort; primary results still stand.
    }
  }

  return sources.slice(0, 12);
}

/**
 * Optional lightweight page retrieval used to ground answers in source content.
 * Returns trimmed readable text only for valid http(s) pages; treats all
 * retrieved HTML as untrusted and never executes it.
 */
export async function fetchPageText(
  url: string,
  options: { maxChars?: number; timeoutMs?: number } = {}
): Promise<string | null> {
  if (!isSafeWebUrl(url)) return null;
  const controller = new AbortController();
  const timer = setTimeout(
    () => controller.abort(new Error("page fetch timeout")),
    options.timeoutMs ?? 8_000
  );
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        "user-agent":
          "Mozilla/5.0 (compatible; KSEMO-Research/1.0; research assistant)",
        accept: "text/html,text/plain;q=0.9",
      },
      redirect: "follow",
    });
    if (!response.ok) return null;
    const contentType = response.headers.get("content-type") ?? "";
    if (!contentType.includes("text/html") && !contentType.includes("text/plain")) {
      return null;
    }
    const text = await response.text();
    // Minimal, safe text extraction — never execute page code or load markup.
    const cleaned = text
      // remove scripts/styles
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<!--[\s\S]*?-->/g, " ")
      // collapse tags to spaces
      .replace(/<[^>]+>/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&nbsp;/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    const hostHint = hostFor(url) ? `[${hostFor(url)}]` : "";
    return cleaned
      ? `${hostHint} ${cleaned}`.slice(0, options.maxChars ?? 4_000)
      : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export { serpApiKey };
