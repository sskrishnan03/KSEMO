// Intelligent research engine. When a document-generation request requires
// current, factual, historical, technical, or otherwise externally verifiable
// information, this module performs real web research before content generation.
//
// Pipeline:
//   1. Analyze the request to determine if research is needed
//   2. Generate targeted search queries
//   3. Execute web searches and collect sources
//   4. Fetch and extract content from key sources
//   5. Analyze and synthesize findings via LLM
//   6. Return structured research results for the document planner

import { invokeLLM, DEFAULT_LLM_MODEL, type Message } from "../_core/llm";

export type ResearchSource = {
  title: string;
  url: string;
  snippet: string;
  publisher?: string;
  publishDate?: string;
  relevance: "high" | "medium" | "low";
  extractedContent?: string;
};

export type ResearchFinding = {
  topic: string;
  content: string;
  sources: string[];
  confidence: "high" | "medium" | "low";
};

export type ResearchResult = {
  needed: boolean;
  query: string;
  sources: ResearchSource[];
  findings: ResearchFinding[];
  summary: string;
  sourceCount: number;
};

// ─── Web Search ─────────────────────────────────────────────────────────────

const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

const SEARCH_TIMEOUT_MS = 8_000;
const FETCH_TIMEOUT_MS = 10_000;
const MAX_SEARCH_RESULTS = 8;
const MAX_FETCH_URLS = 4;
const MAX_EXTRACT_CHARS = 3_000;

/**
 * Performs a web search using DuckDuckGo HTML endpoint and extracts
 * result links, titles, and snippets from the response.
 */
async function searchWeb(
  query: string,
  signal?: AbortSignal
): Promise<Array<{ title: string; url: string; snippet: string }>> {
  const results: Array<{ title: string; url: string; snippet: string }> = [];

  try {
    const params = new URLSearchParams({ q: query, kl: "us-en" });
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), SEARCH_TIMEOUT_MS);
    const composed = signal
      ? composeAbort(signal, controller.signal)
      : controller.signal;

    const res = await fetch(
      `https://html.duckduckgo.com/html/?${params.toString()}`,
      {
        headers: {
          "User-Agent": USER_AGENT,
          Accept:
            "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "Accept-Language": "en-US,en;q=0.9",
        },
        signal: composed,
        redirect: "follow",
      }
    );
    clearTimeout(timer);

    if (!res.ok) return results;
    const html = await res.text();

    // Parse DuckDuckGo HTML results
    // Each result is in a <div class="result results_links results_links_deep web-result">
    // with <a class="result__a"> for title/link and <a class="result__snippet"> for snippet
    const resultBlocks =
      /<div[^>]*class="[^"]*result\s+results_links[^"]*"[^>]*>([\s\S]*?)<\/div>\s*<\/div>/gi;
    let match: RegExpExecArray | null;

    while (
      (match = resultBlocks.exec(html)) !== null &&
      results.length < MAX_SEARCH_RESULTS
    ) {
      const block = match[1];

      // Extract URL from result__a link
      const urlMatch = /href="([^"]*)"[^>]*class="result__a"/i.exec(block);
      // Extract title text
      const titleMatch =
        /class="result__a"[^>]*>([\s\S]*?)<\/a>/i.exec(block);
      // Extract snippet
      const snippetMatch =
        /class="result__snippet"[^>]*>([\s\S]*?)<\/a>/i.exec(block);

      if (urlMatch && titleMatch) {
        let url = urlMatch[1];
        // DuckDuckGo wraps URLs in a redirect; extract the actual URL
        const uddgMatch = /uddg=([^&]+)/i.exec(url);
        if (uddgMatch) {
          url = decodeURIComponent(uddgMatch[1]);
        }
        // Skip DuckDuckGo internal links
        if (
          url.includes("duckduckgo.com") ||
          url.startsWith("//") ||
          !url.startsWith("http")
        )
          continue;

        const title = stripHtml(titleMatch[1]);
        const snippet = snippetMatch ? stripHtml(snippetMatch[1]) : "";

        if (title && url) {
          results.push({ title, url, snippet });
        }
      }
    }

    // Fallback: simpler regex if block parsing found too few results
    if (results.length < 3) {
      const linkPattern =
        /<a[^>]*rel="nofollow"[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi;
      while (
        (match = linkPattern.exec(html)) !== null &&
        results.length < MAX_SEARCH_RESULTS
      ) {
        let url = match[1];
        const text = stripHtml(match[2]);
        const uddgMatch = /uddg=([^&]+)/i.exec(url);
        if (uddgMatch) url = decodeURIComponent(uddgMatch[1]);
        if (
          !url.includes("duckduckgo.com") &&
          url.startsWith("http") &&
          text.length > 10 &&
          !results.some(r => r.url === url)
        ) {
          results.push({ title: text, url, snippet: "" });
        }
      }
    }
  } catch (error) {
    console.warn("[Research] web search failed:", error);
  }

  return results;
}

/**
 * Fetches a web page and extracts its main text content.
 * Strips HTML tags, scripts, styles, and nav elements.
 */
async function fetchPageContent(
  url: string,
  signal?: AbortSignal
): Promise<string> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    const composed = signal
      ? composeAbort(signal, controller.signal)
      : controller.signal;

    const res = await fetch(url, {
      headers: {
        "User-Agent": USER_AGENT,
        Accept: "text/html,application/xhtml+xml,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
      },
      signal: composed,
      redirect: "follow",
    });
    clearTimeout(timer);

    if (!res.ok) return "";
    const contentType = res.headers.get("content-type") || "";
    if (!contentType.includes("text/html") && !contentType.includes("text/"))
      return "";

    const html = await res.text();
    return extractTextFromHtml(html);
  } catch {
    return "";
  }
}

// ─── HTML Processing ────────────────────────────────────────────────────────

function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&[a-zA-Z]+;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function extractTextFromHtml(html: string): string {
  let text = html;
  // Remove non-content elements
  text = text.replace(
    /<(script|style|nav|header|footer|aside|iframe|noscript)[^>]*>[\s\S]*?<\/\1>/gi,
    ""
  );
  // Remove HTML comments
  text = text.replace(/<!--[\s\S]*?-->/g, "");
  // Try to find main/article content
  const mainMatch =
    /<(main|article)[^>]*>([\s\S]*?)<\/\1>/i.exec(text);
  if (mainMatch) {
    text = mainMatch[2];
  }
  // Convert block elements to newlines
  text = text.replace(/<\/(p|div|h[1-6]|li|tr|blockquote)>/gi, "\n");
  text = text.replace(/<br\s*\/?>/gi, "\n");
  // Strip remaining tags
  text = stripHtml(text);
  // Collapse whitespace
  text = text.replace(/\n{3,}/g, "\n\n").trim();
  return text.slice(0, MAX_EXTRACT_CHARS);
}

function composeAbort(...signals: AbortSignal[]): AbortSignal {
  if (typeof AbortSignal.any === "function") return AbortSignal.any(signals);
  const controller = new AbortController();
  for (const signal of signals)
    signal.addEventListener("abort", () => controller.abort(signal.reason), {
      once: true,
    });
  return controller.signal;
}

// ─── Research Analysis via LLM ──────────────────────────────────────────────

type SearchPlan = {
  needsResearch: boolean;
  reason: string;
  searchQueries: string[];
  complexity: "simple" | "moderate" | "complex";
};

/**
 * Step 1: Analyze the user's request to determine if web research is needed
 * and what search queries would be most effective.
 */
async function analyzeResearchNeeds(
  userMessage: string,
  history: Message[],
  format: string,
  signal?: AbortSignal
): Promise<SearchPlan> {
  const systemPrompt = `You are a research strategy analyst for a document generation system.
Analyze the user's document request and determine:

1. Does this document need current, factual, historical, statistical, technical, scientific, financial, political, or otherwise externally verifiable information that would benefit from web research?
2. What specific search queries would gather the most relevant and authoritative information?
3. How complex is the research needed?

IMPORTANT: Research is needed when the document would benefit from:
- Current events, recent developments, or latest data
- Specific statistics, numbers, or metrics
- Historical facts, dates, or biographical information
- Technical specifications or scientific data
- Political, economic, or social information
- Comparison data or rankings
- Official policies, regulations, or standards

Research is NOT needed when:
- The user provides all the content (e.g., "create a PDF from this text")
- The document is purely creative/template-based (e.g., a simple letter template)
- The topic is purely conceptual with no factual component
- The user explicitly provides data to include

Return a JSON object:
{
  "needsResearch": true|false,
  "reason": "brief explanation",
  "searchQueries": ["query1", "query2"],
  "complexity": "simple|moderate|complex"
}

Rules for search queries:
- Make them specific and targeted (not vague)
- Include the most important factual aspects
- 1-3 queries for simple topics, 2-5 for complex topics
- Each query should be concise but specific enough to find relevant results
- Do NOT include the word "PDF" or "document" in queries — search for the actual information`;

  try {
    const result = await invokeLLM({
      model: DEFAULT_LLM_MODEL,
      messages: [
        { role: "system", content: systemPrompt },
        ...history.slice(-4),
        {
          role: "user",
          content: `Document format: ${format}\nUser request: ${userMessage.slice(0, 600)}`,
        },
      ],
      responseFormat: { type: "json_object" },
      maxTokens: 500,
      signal,
    });

    const raw = result.choices?.[0]?.message?.content;
    const text = typeof raw === "string" ? raw : String(raw ?? "");
    const parsed = parseJson(text);

    if (parsed && typeof parsed.needsResearch === "boolean") {
      const complexity = String(parsed.complexity ?? "moderate");
      const queries = Array.isArray(parsed.searchQueries)
        ? parsed.searchQueries.map(String).slice(0, 5)
        : [];
      return {
        needsResearch: parsed.needsResearch,
        reason: String(parsed.reason || ""),
        searchQueries: queries,
        complexity: ["simple", "moderate", "complex"].includes(complexity)
          ? (complexity as "simple" | "moderate" | "complex")
          : "moderate",
      };
    }
  } catch (error) {
    console.warn("[Research] analysis call failed:", error);
  }

  return { needsResearch: false, reason: "", searchQueries: [], complexity: "simple" };
}

/**
 * Step 2: Analyze search results and extract key findings via LLM.
 */
async function analyzeSources(
  userMessage: string,
  searchResults: Array<{ title: string; url: string; snippet: string }>,
  pageContents: Map<string, string>,
  signal?: AbortSignal
): Promise<{
  sources: ResearchSource[];
  findings: ResearchFinding[];
  summary: string;
}> {
  const resultsWithContent = searchResults
    .filter(r => r.url)
    .slice(0, MAX_SEARCH_RESULTS)
    .map(r => {
      const content = pageContents.get(r.url);
      return `[${r.title}](${r.url})\nSnippet: ${r.snippet}${content ? `\nContent preview: ${content.slice(0, 1200)}` : ""}`;
    })
    .join("\n\n---\n\n");

  if (!resultsWithContent) {
    return { sources: [], findings: [], summary: "No research sources found." };
  }

  const systemPrompt = `You are a research analyst for a document generation system.
The user wants to create a document about: "${userMessage.slice(0, 400)}"

Analyze the following web search results and extract the most relevant, accurate, and useful information.

For each important source, determine:
- title, url, publisher (if identifiable), relevance (high/medium/low)
- Key information extracted

For the findings, extract:
- The most important factual information organized by topic
- Which sources support each finding
- Confidence level based on source quality and consistency

Return a JSON object:
{
  "sources": [
    {
      "title": "Source Title",
      "url": "https://...",
      "publisher": "Publisher Name",
      "relevance": "high|medium|low",
      "keyInformation": "Main info from this source"
    }
  ],
  "findings": [
    {
      "topic": "Topic name",
      "content": "Detailed factual content",
      "sourceUrls": ["https://..."],
      "confidence": "high|medium|low"
    }
  ],
  "summary": "Brief summary of research findings"
}

Rules:
- Prioritize official, authoritative, and recent sources
- If sources disagree, note the conflict and indicate which is more reliable
- Do not fabricate information — only use what the sources provide
- Focus on information relevant to the user's document request
- Be specific with facts, dates, names, and numbers
- Include at most 8 sources and 10 findings`;

  try {
    const result = await invokeLLM({
      model: DEFAULT_LLM_MODEL,
      messages: [
        { role: "system", content: systemPrompt },
        {
          role: "user",
          content: `Research results:\n\n${resultsWithContent.slice(0, 6000)}`,
        },
      ],
      responseFormat: { type: "json_object" },
      maxTokens: 3000,
      signal,
    });

    const raw = result.choices?.[0]?.message?.content;
    const text = typeof raw === "string" ? raw : String(raw ?? "");
    const parsed = parseJson(text);

    if (parsed && typeof parsed === "object") {
      const sources: ResearchSource[] = Array.isArray(parsed.sources)
        ? parsed.sources
            .filter(
              (s: Record<string, unknown>) =>
                s && typeof s.url === "string" && s.url.startsWith("http")
            )
            .map((s: Record<string, unknown>) => ({
              title: String(s.title || "Untitled"),
              url: String(s.url),
              snippet: String(s.keyInformation || s.snippet || ""),
              publisher: s.publisher ? String(s.publisher) : undefined,
              relevance: ["high", "medium", "low"].includes(
                s.relevance as string
              )
                ? (s.relevance as "high" | "medium" | "low")
                : "medium",
              extractedContent: pageContents.get(String(s.url)),
            }))
        : [];

      const findings: ResearchFinding[] = Array.isArray(parsed.findings)
        ? parsed.findings
            .filter(
              (f: Record<string, unknown>) =>
                f && typeof f.content === "string" && f.content.length > 10
            )
            .map((f: Record<string, unknown>) => ({
              topic: String(f.topic || "Finding"),
              content: String(f.content),
              sources: Array.isArray(f.sourceUrls)
                ? f.sourceUrls.map(String)
                : [],
              confidence: ["high", "medium", "low"].includes(
                f.confidence as string
              )
                ? (f.confidence as "high" | "medium" | "low")
                : "medium",
            }))
        : [];

      return {
        sources,
        findings,
        summary: String(parsed.summary || ""),
      };
    }
  } catch (error) {
    console.warn("[Research] source analysis failed:", error);
  }

  return {
    sources: searchResults.slice(0, 5).map(r => ({
      title: r.title,
      url: r.url,
      snippet: r.snippet,
      relevance: "medium" as const,
    })),
    findings: [],
    summary: "",
  };
}

// ─── Main Research Pipeline ─────────────────────────────────────────────────

/**
 * Performs intelligent web research for a document generation request.
 * Returns structured research results that the document planner can use
 * to create content grounded in real, verifiable information.
 */
export async function performResearch(
  userMessage: string,
  history: Message[],
  format: string,
  onProgress?: (stage: string) => void,
  signal?: AbortSignal
): Promise<ResearchResult> {
  const emptyResult: ResearchResult = {
    needed: false,
    query: userMessage,
    sources: [],
    findings: [],
    summary: "",
    sourceCount: 0,
  };

  // Step 1: Determine if research is needed
  onProgress?.("analyzing");
  const analysis = await analyzeResearchNeeds(
    userMessage,
    history,
    format,
    signal
  );

  if (!analysis.needsResearch || analysis.searchQueries.length === 0) {
    console.log(
      `[Research] No research needed for this request. Reason: ${analysis.reason}`
    );
    return emptyResult;
  }

  console.log(
    `[Research] Research needed (${analysis.complexity}). Queries: ${analysis.searchQueries.join(", ")}`
  );

  // Step 2: Execute web searches
  onProgress?.("searching");
  const allResults: Array<{ title: string; url: string; snippet: string }> = [];
  const seenUrls = new Set<string>();

  for (const query of analysis.searchQueries.slice(0, 3)) {
    try {
      const results = await searchWeb(query, signal);
      for (const r of results) {
        if (!seenUrls.has(r.url)) {
          seenUrls.add(r.url);
          allResults.push(r);
        }
      }
    } catch (error) {
      console.warn(`[Research] search failed for "${query}":`, error);
    }
  }

  if (allResults.length === 0) {
    console.log("[Research] No search results found.");
    return emptyResult;
  }

  console.log(`[Research] Found ${allResults.length} search results.`);

  // Step 3: Fetch key source pages for deeper content
  onProgress?.("fetching");
  const pageContents = new Map<string, string>();
  const urlsToFetch = allResults
    .slice(0, MAX_FETCH_URLS)
    .filter(r => {
      // Skip PDFs, images, and other non-HTML resources
      const url = r.url.toLowerCase();
      return (
        !url.endsWith(".pdf") &&
        !url.endsWith(".jpg") &&
        !url.endsWith(".png") &&
        !url.endsWith(".gif") &&
        !url.includes("/pdf/")
      );
    });

  const fetchPromises = urlsToFetch.map(async r => {
    const content = await fetchPageContent(r.url, signal);
    if (content.length > 100) {
      pageContents.set(r.url, content);
    }
  });
  await Promise.allSettled(fetchPromises);

  console.log(
    `[Research] Extracted content from ${pageContents.size}/${urlsToFetch.length} pages.`
  );

  // Step 4: Analyze sources and extract findings via LLM
  onProgress?.("analyzing_sources");
  const analysis2 = await analyzeSources(
    userMessage,
    allResults,
    pageContents,
    signal
  );

  const result: ResearchResult = {
    needed: true,
    query: analysis.searchQueries[0] || userMessage,
    sources: analysis2.sources,
    findings: analysis2.findings,
    summary: analysis2.summary,
    sourceCount: analysis2.sources.length,
  };

  console.log(
    `[Research] Complete. ${result.sourceCount} sources, ${result.findings.length} findings.`
  );

  return result;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function parseJson(text: string): Record<string, unknown> | null {
  const cleaned = text
    .replace(/```json/gi, "")
    .replace(/```/g, "")
    .trim();
  try {
    const parsed = JSON.parse(cleaned);
    return typeof parsed === "object" && parsed !== null ? parsed : null;
  } catch {
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(cleaned.slice(start, end + 1));
      } catch {
        return null;
      }
    }
    return null;
  }
}
