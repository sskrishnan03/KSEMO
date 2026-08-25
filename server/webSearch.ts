// Web search for KSEMO chat. Provider-agnostic: configure whichever service
// is available via environment variables — SerpApi, Tavily, Brave, or Serper.
// All calls are best-effort: a missing key, timeout, or provider failure must
// never break the chat turn.

export type WebSearchResult = {
  title: string;
  url: string;
  snippet: string;
};

const SEARCH_TIMEOUT_MS = 9_000;
const MAX_RESULTS = 5;

type Provider = "serpapi" | "tavily" | "brave" | "serper";

function resolveProvider(): { provider: Provider; apiKey: string } | null {
  const serpapi = process.env.SERPAPI_API_KEY?.trim();
  if (serpapi) return { provider: "serpapi", apiKey: serpapi };
  const tavily = process.env.TAVILY_API_KEY?.trim();
  if (tavily) return { provider: "tavily", apiKey: tavily };
  const brave = process.env.BRAVE_SEARCH_API_KEY?.trim();
  if (brave) return { provider: "brave", apiKey: brave };
  const serper = process.env.SERPER_API_KEY?.trim();
  if (serper) return { provider: "serper", apiKey: serper };
  return null;
}

async function fetchJson(
  url: string,
  init: RequestInit & { body?: string }
): Promise<unknown> {
  const response = await fetch(url, {
    ...init,
    signal: AbortSignal.timeout(SEARCH_TIMEOUT_MS),
    headers: {
      accept: "application/json",
      "content-type": "application/json",
      ...(init.headers ?? {}),
    },
  });
  if (!response.ok) {
    throw new Error(`Search provider responded ${response.status}`);
  }
  return response.json() as Promise<unknown>;
}

function truncate(value: string | undefined | null, max: number) {
  const text = value?.replace(/\s+/g, " ").trim() ?? "";
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

type RawResult = { title?: unknown; url?: unknown; content?: unknown };

function normalizeResults(raw: unknown): WebSearchResult[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item: RawResult) => ({
      title: typeof item.title === "string" ? item.title : "Untitled result",
      url: typeof item.url === "string" ? item.url : "",
      snippet: truncate(
        typeof item.content === "string" ? item.content : undefined,
        900
      ),
    }))
    .filter(result => result.url.startsWith("http"))
    .slice(0, MAX_RESULTS);
}

async function searchWithSerpApi(
  query: string,
  apiKey: string
): Promise<WebSearchResult[]> {
  const endpoint = `https://serpapi.com/search.json?engine=google&q=${encodeURIComponent(query)}&num=${MAX_RESULTS}&api_key=${encodeURIComponent(apiKey)}`;
  const payload = (await fetchJson(endpoint, { method: "GET" })) as {
    organic_results?: Array<RawResult & { link?: unknown; snippet?: unknown }>;
  };
  const results = (payload.organic_results ?? []).map(item => ({
    title: item.title,
    url: typeof item.link === "string" ? item.link : item.url,
    content:
      typeof item.snippet === "string"
        ? item.snippet
        : typeof item.content === "string"
          ? item.content
          : undefined,
  }));
  return normalizeResults(results);
}

async function searchWithTavily(
  query: string,
  apiKey: string
): Promise<WebSearchResult[]> {
  const payload = (await fetchJson("https://api.tavily.com/search", {
    method: "POST",
    headers: { authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      query,
      max_results: MAX_RESULTS,
      search_depth: "basic",
      include_answer: false,
    }),
  })) as { results?: RawResult[] };
  return normalizeResults(payload.results);
}

async function searchWithBrave(
  query: string,
  apiKey: string
): Promise<WebSearchResult[]> {
  const endpoint = `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&count=${MAX_RESULTS}`;
  const payload = (await fetchJson(endpoint, {
    method: "GET",
    headers: { "x-subscription-token": apiKey },
  })) as { web?: { results?: Array<RawResult & { description?: unknown }> } };
  const results = (payload.web?.results ?? []).map(item => ({
    title: item.title,
    url: item.url,
    content:
      typeof item.description === "string" ? item.description : item.content,
  }));
  return normalizeResults(results);
}

async function searchWithSerper(
  query: string,
  apiKey: string
): Promise<WebSearchResult[]> {
  const payload = (await fetchJson("https://google.serper.dev/search", {
    method: "POST",
    headers: { "x-api-key": apiKey },
    body: JSON.stringify({ q: query, num: MAX_RESULTS }),
  })) as { organic?: Array<RawResult & { description?: unknown }> };
  const results = (payload.organic ?? []).map(item => ({
    title: item.title,
    url: item.url,
    content:
      typeof item.description === "string" ? item.description : item.content,
  }));
  return normalizeResults(results);
}

export async function performWebSearch(
  query: string
): Promise<WebSearchResult[]> {
  const resolved = resolveProvider();
  if (!resolved) {
    console.warn(
      "[WebSearch] No provider configured. Set SERPAPI_API_KEY, TAVILY_API_KEY, BRAVE_SEARCH_API_KEY, or SERPER_API_KEY."
    );
    return [];
  }
  try {
    if (resolved.provider === "serpapi")
      return await searchWithSerpApi(query, resolved.apiKey);
    if (resolved.provider === "tavily")
      return await searchWithTavily(query, resolved.apiKey);
    if (resolved.provider === "brave")
      return await searchWithBrave(query, resolved.apiKey);
    return await searchWithSerper(query, resolved.apiKey);
  } catch (error) {
    console.warn("[WebSearch] Search failed:", error);
    return [];
  }
}

export function composeWebSearchContext(
  query: string,
  results: WebSearchResult[]
): string | null {
  if (!results.length) return null;
  const listing = results
    .map(
      (result, index) =>
        `[${index + 1}] ${result.title}\nURL: ${result.url}\n${result.snippet}`
    )
    .join("\n\n");
  return [
    `WEB SEARCH RESULTS for "${query}" (retrieved just now).`,
    "Use these results as the primary source for current facts. When a detail comes from a result, reference it inline like [1]. If the results do not cover the question, say so and answer from your own knowledge.",
    "",
    listing,
  ].join("\n");
}
