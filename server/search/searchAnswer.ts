// Generates a concise, citation-backed answer for Web Search mode.
//
// Returns a human-readable Markdown answer with inline [n] citations mapped to
// the real retrieved sources. The chat stream embeds the structured sources
// alongside this answer.
//
// The model is told to treat the provided sources as evidence, cite claims with
// the supplied numeric markers, and never invent citations or facts.

import { streamLLM, sanitizeAssistantText, type Message } from "../_core/llm";
import type { Source } from "@shared/research";
import { fetchPageText } from "./webSearch";

const ANSWER_MODEL = "gemini-flash-lite-latest";

// How many sources get their page content retrieved for grounding. Beyond this
// cap we rely on the snippet-level evidence the search provider already gives
// us. Retrieval is best-effort: a page that cannot be fetched never fails the
// whole answer — the model still has snippet evidence and the source list.
const MAX_PAGES_TO_FETCH = 4;
const PAGE_TEXT_MAX_CHARS = 3_000;

export async function streamWebAnswer(opts: {
  query: string;
  sources: Source[];
  onDelta: (delta: string) => void;
  signal?: AbortSignal;
}): Promise<string> {
  const { query, sources, onDelta, signal } = opts;

  if (!sources.length) {
    const fallback =
      "I could not find reliable, current sources for that query. I’m not able to answer from live results right now — please try rephrasing or check back shortly.";
    onDelta(fallback);
    return fallback;
  }

  // Retrieve page content for the top sources to strengthen grounding. This is
  // best-effort; each source always has snippet-level evidence at minimum.
  const pageContext = await Promise.all(
    sources.slice(0, MAX_PAGES_TO_FETCH).map(async (source, i) => {
      const text = await fetchPageText(source.url, {
        maxChars: PAGE_TEXT_MAX_CHARS,
        timeoutMs: 8_000,
      });
      return { number: i + 1, source, text };
    })
  );

  const numberedSources = sources
    .map(
      (s, i) =>
        `${i + 1}. [${s.title}](${s.url}) — ${s.publisher ?? s.domain}${s.publishedDate ? ` (published ${new Date(s.publishedDate).toISOString().slice(0, 10)})` : ""}.\n   Snippet: ${s.description ?? "(no snippet)"}`
    )
    .join("\n\n");

  const retrievedBlock = pageContext
    .filter(page => page.text)
    .map(
      page =>
        `CONTENT FROM SOURCE ${page.number} (${page.source.domain}):\n${page.text}`
    )
    .join("\n\n");

  const system =
    "You are a precise web-research assistant for KSEMO. Answer the user's query directly, conversationally, and coherently, using ONLY the retrieved sources provided. " +
    "Synthesize information across sources into one well-organized answer — do NOT merely list or describe the sources, do NOT reproduce snippets verbatim, and do NOT dump disconnected statements. " +
    "Open with a short overview that directly answers the question, then support it with specific, clearly explained claims (use a short numbered list only when it genuinely helps name the examples). " +
    "Ground every factual claim in the evidence and place inline citation markers like [1] or [1][2] immediately after the specific fact they support. " +
    "Cite ONLY the sources you actually used for that section — never cite a number you did not rely on, and never invent a citation or a source. You may cite the same source multiple times. " +
    "Do NOT write any bracketed placeholder tokens such as [blocked], [error], or [failed] — never use a bracket for anything other than a numeric citation. " +
    "Never claim a comparison or ranking (e.g. 'ranked #1 in the world', 'the single greatest') unless a provided source expressly supports it. " +
    "Distinguish the basis of each claim: historical reputation, statistical performance, public polls, expert rankings, or official awards. Where different sources use different criteria, say so instead of merging them into one false universal ranking. " +
    "If a fact appears in no source, do not present it as established. Be concise and accurate. If the sources do not answer the question, clearly state that the available sources do not cover it. " +
    "Never fabricate quotations, dates, statistics, or URLs.";

  const userContent = [
    `User query: ${query}`,
    "",
    "AVAILABLE SOURCES (numbered):",
    numberedSources,
    retrievedBlock ? `\nRETRIEVED SOURCE CONTENT:\n${retrievedBlock}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  const messages: Message[] = [
    { role: "system", content: system },
    { role: "user", content: userContent },
  ];

  let text = "";
  for await (const event of streamLLM({ model: ANSWER_MODEL, messages }, signal)) {
    text += event.delta;
    onDelta(event.delta);
  }

  // The stream layer strips internal markers per delta; run one final pass over
  // the assembled text so any marker that spanned deltas is also removed before
  // it is persisted or embedded. Provider safety-blocks that left the answer
  // empty degrade to a graceful message instead of empty prose.
  text = sanitizeAssistantText(text);
  if (!text.trim()) {
    const fallback =
      "The search returned sources, but I could not generate a usable answer from them right now. Please try rephrasing your question or trying again shortly.";
    onDelta(fallback);
    return fallback;
  }
  return text;
}
