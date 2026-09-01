// Generates a concise, citation-backed answer for Web Search mode.
//
// Returns a human-readable Markdown answer with inline [n] citations mapped to
// the real retrieved sources. The chat stream embeds the structured sources
// alongside this answer.

import { streamLLM, type Message } from "../_core/llm";
import type { Source } from "@shared/research";

const ANSWER_MODEL = "gemini-flash-lite-latest";

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

  const numbered = sources
    .map(
      (s, i) =>
        `${i + 1}. [${s.title}](${s.url}) — ${s.publisher ?? s.domain}. ${s.description ?? ""}`
    )
    .join("\n");

  const system =
    "You are a helpful web-research assistant. Answer the user's query using ONLY the numbered sources provided. " +
    "Place inline citations like [1] or [1][2] after the specific facts they support. Never invent citation " +
    "numbers or sources that are not listed. Be concise and accurate. If the sources do not answer the question, " +
    "clearly state that the available sources do not cover it. Distinguish your summary from the source material. " +
    "Do not present unverified claims as established fact.";

  const messages: Message[] = [
    { role: "system", content: system },
    { role: "user", content: `Query: ${query}\n\nSources (numbered):\n${numbered}` },
  ];

  let text = "";
  for await (const event of streamLLM({ model: ANSWER_MODEL, messages }, signal)) {
    text += event.delta;
    onDelta(event.delta);
  }
  return text;
}
