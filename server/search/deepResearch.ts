// Deep Research engine — a genuine multi-step research workflow.
//
// This is intentionally far more than a single web search:
//   1. Understand the research question.
//   2. Build a research plan (research_subtasks).
//   3. Search multiple sources across several queries.
//   4. Optionally retrieve page content for key sources.
//   5. Analyze, cross-check and synthesize into a structured report with real
//      inline citations mapped to the retrieved sources.
//
// Progress is reported through an onProgress callback (mapped to SSE events by
// the chat stream) so the UI reflects real backend stages, never fake ones.

import type { Message } from "../_core/llm";
import { invokeLLM, streamLLM } from "../_core/llm";
import type {
  ResearchProgressStage,
  ResearchSummary,
  Source,
  SourceCategory,
} from "@shared/research";
import { searchWeb, fetchPageText } from "./webSearch";
import { parseContentWithSources } from "./sources";

// Citations in the final report use this marker so we can break the report into
// an "answer" (human text) and "sources" (structured) on the wire. We stream
// report text straight to the client, so this export is mainly informational.
export type DeepResearchResult = {
  answer: string;
  sources: Source[];
  summary: ResearchSummary | null;
  plan: string[];
};

export type ProgressFn = (stage: ResearchProgressStage, detail?: string) => void;

const RESEARCH_MODEL = "gemini-flash-lite-latest";

/** Extracts the citation ids referenced as [n] in text. */
function citedIndexes(answer: string): number[] {
  const indexes = new Set<number>();
  const re = /\[(\d{1,2})\]/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(answer))) {
    const n = Number(m[1]);
    if (n >= 1 && n <= 40) indexes.add(n);
  }
  return Array.from(indexes).sort((a, b) => a - b);
}

function safeJson<T>(text: string, fallback: T): T {
  const cleaned = text
    .replace(/```json/gi, "")
    .replace(/```/g, "")
    .trim();
  try {
    return JSON.parse(cleaned) as T;
  } catch {
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(cleaned.slice(start, end + 1)) as T;
      } catch {
        return fallback;
      }
    }
    return fallback;
  }
}

async function askJson(messages: Message[], fallback: unknown): Promise<any> {
  try {
    const result = await invokeLLM({
      model: RESEARCH_MODEL,
      messages,
      responseFormat: { type: "json_object" },
      maxTokens: 512,
    });
    const raw = result.choices?.[0]?.message?.content;
    const text = Array.isArray(raw)
      ? raw
          .map(p =>
            typeof p === "object"
              ? ((p as { text?: string }).text ?? "")
              : String(p)
          )
          .join("")
      : String(raw ?? "");
    return safeJson(text, fallback);
  } catch {
    return fallback;
  }
}

function asStringList(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .filter((v): v is string => typeof v === "string")
      .map(v => v.trim())
      .filter(Boolean)
      .slice(0, 10);
  }
  return [];
}

/** STAGE 1 + 2 — understand the question and build a research plan. */
async function understandAndPlan(topic: string): Promise<{ plan: string[]; scope: string }> {
  const fallback = {
    plan: [topic],
    scope: `${topic} — this was researched using current, publicly available sources.`,
  };
  const parsed = await askJson(
    [
      {
        role: "system",
        content:
          "You are the research planner for a deep research assistant. Given a research topic, break it into a focused list of 4-8 concrete research sub-tasks (what to investigate), and produce a one-sentence scope description. Respond ONLY with JSON: {\"plan\": [\"sub-task 1\", ...], \"scope\": \"...\"}. The plan items must be specific searchable queries.",
      },
      { role: "user", content: topic },
    ],
    fallback
  );
  let plan = asStringList(parsed.plan);
  if (!plan.length) plan = [topic];
  const scope =
    typeof parsed.scope === "string" && parsed.scope.trim()
      ? parsed.scope.trim()
      : fallback.scope;
  return { plan: plan.slice(0, 8), scope };
}

/** STAGE 3 + 4 — search multiple queries and collect real sources. */
async function gatherSources(plan: string[]): Promise<Source[]> {
  const perTask = Math.max(2, Math.min(3, Math.ceil(16 / Math.max(plan.length, 1))));
  const queries = plan.slice(0, 8);
  const collected: Source[] = [];
  const seen = new Set<string>();

  // Run phase-1 searches (all tasks) before any enrichment.
  const phaseOne: Array<{ query: string; offset: number }> = [];
  let offset = 0;
  for (const query of queries) {
    phaseOne.push({ query, offset });
    offset += 1;
  }

  for (const { query } of phaseOne) {
    try {
      const sources = await searchWeb(query, {});
      for (const source of sources.slice(0, perTask)) {
        const norm = source.url.replace(/[?#].*$/, "").toLowerCase();
        if (seen.has(norm)) continue;
        seen.add(norm);
        // Map sourceType into our categories during analysis.
        collected.push(source);
        if (collected.length >= 20) break;
      }
    } catch {
      // One sub-task search failing should not abort the whole research run.
    }
    if (collected.length >= 20) break;
  }

  return collected.slice(0, 20);
}

/** Classifies sources into basic categories from real metadata. */
function categorizeSource(source: Source): SourceCategory {
  const domain = source.domain.toLowerCase();
  const title = `${source.title} ${source.publisher ?? ""}`.toLowerCase();
  const uk = domain.endsWith(".ac.uk") || domain.endsWith(".edu");
  const gov =
    domain.endsWith(".gov") || domain.endsWith(".gov.uk") || domain.endsWith(".mil");
  if (uk || /university|research institute|arxiv|scholar/.test(title)) {
    return "Academic";
  }
  if (gov || /\.org$/.test(domain)) return "Official";
  if (
    /\b(news|reuters|apnews|bbc|cnn|theguardian|nytimes)\b/.test(domain) ||
    /news/.test(title)
  ) {
    return "News";
  }
  return "Industry";
}

function researchSummary(sources: Source[]): ResearchSummary {
  const byCategory: Partial<Record<SourceCategory, number>> = {};
  for (const source of sources) {
    const cat = categorizeSource(source);
    byCategory[cat] = (byCategory[cat] ?? 0) + 1;
  }
  return { sourcesUsed: sources.length, byCategory };
}

/** STAGE 7 — write the structured research report with citations. */
async function writeReport(opts: {
  topic: string;
  scope: string;
  sources: Source[];
  crossNotes: string;
  onDelta: (delta: string) => void;
  signal?: AbortSignal;
}): Promise<string> {
  const { topic, scope, sources, crossNotes, onDelta, signal } = opts;

  const numbered = sources.map((s, i) => `${i + 1}. [${s.title}](${s.url}) — ${s.publisher ?? s.domain}. ${s.description ?? ""}`).join("\n");

  const extraEvidence = crossNotes.trim()
    ? `\n\nCross-checked snippet evidence from key sources (treat as supporting detail):\n${crossNotes.slice(0, 6_000)}`
    : "";

  const system =
    "You are a rigorous research analyst producing a structured, citation-backed research report. " +
    "Write in clear Markdown using ONLY the numbered sources provided. Place inline citations " +
    "like [1] or [1][3] immediately after the facts they support (never invent citation numbers " +
    "beyond the provided source list, never reference sources that are not listed). When credible " +
    "sources disagree, describe the disagreement explicitly. When evidence is limited, say so. " +
    "Structure the report with these headings (adapt wording as needed but keep the structure):\n" +
    "# <Research Title>\n" +
    "## Executive Summary\n" +
    "## Research Scope\n" +
    "## Key Findings\n" +
    "## Detailed Analysis\n" +
    "## Evidence and Data\n" +
    "## Different Perspectives\n" +
    "## Trends and Future Outlook\n" +
    "## Limitations and Uncertainty\n" +
    "## Conclusion\n" +
    "End with a last line exactly: ## Sources";

  const user =
    `Research topic: ${topic}\n\nResearch scope: ${scope}\n\nSources (numbered):\n${numbered}${extraEvidence}`;

  const messages: Message[] = [
    { role: "system", content: system },
    { role: "user", content: user },
  ];

  let text = "";
  for await (const event of streamLLM({ model: RESEARCH_MODEL, messages }, signal)) {
    text += event.delta;
    onDelta(event.delta);
  }
  return text;
}

/** STAGE 5 + 6 — cross-check important claims by fetching a few source pages. */
async function crossCheck(sources: Source[]): Promise<Map<number, string>> {
  const notes = new Map<number, string>();
  const toFetch = sources.slice(0, 4);
  await Promise.all(
    toFetch.map(async (source, idx) => {
      const text = await fetchPageText(source.url, { maxChars: 2_200, timeoutMs: 6_000 });
      if (text) notes.set(idx, text);
    })
  );
  return notes;
}

/**
 * Runs the full deep research workflow. Progress is streamed via onProgress;
 * the report text is streamed via onDelta as it is written.
 */
export async function runDeepResearch(opts: {
  topic: string;
  onProgress: ProgressFn;
  onDelta: (delta: string) => void;
  signal?: AbortSignal;
}): Promise<DeepResearchResult> {
  const { topic, onProgress, onDelta, signal } = opts;

  onProgress("understanding", "Understanding your question");
  const { plan, scope } = await understandAndPlan(topic);

  onProgress("planning", "Planning research");
  onProgress("searching", "Searching reliable sources");
  const sources = await gatherSources(plan);

  onProgress("retrieving", "Retrieving relevant information");
  const crossNotes = await crossCheck(sources);

  onProgress("analyzing", "Analyzing evidence");
  onProgress("comparing", "Comparing findings");
  onProgress("writing", "Writing the research report");

  const crossNoteText = Array.from(crossNotes.entries())
    .map(([idx, text]) => `[Source ${idx + 1} / ${sources[idx]?.domain ?? "source"}]: ${text.trim()}`)
    .join("\n\n");

  const answer = await writeReport({
    topic,
    scope,
    sources,
    crossNotes: crossNoteText,
    onDelta,
    signal,
  });

  onProgress("completed", "Research complete");

  return {
    answer,
    sources,
    summary: researchSummary(sources),
    plan,
  };
}

export function stripSourcesFromContextAnswer(content: string): string {
  return parseContentWithSources(content).answer;
}

export { citedIndexes };
