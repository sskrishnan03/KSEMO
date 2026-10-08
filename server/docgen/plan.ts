// AI-driven document planning. Given the user's latest message (plus chat
// context and optional web research), this asks the LLM to produce the
// structured content that the deterministic generators will turn into a real
// file. When research results are available, the planner incorporates the
// gathered facts, findings, and source references into the document plan.

import { invokeLLM, DEFAULT_LLM_MODEL, type Message } from "../_core/llm";
import type { DocFormat } from "./spec";
import type { ResearchResult } from "./research";

export type DocumentPlan =
  | {
      kind: "file";
      format: "pdf" | "docx" | "xlsx" | "pptx" | "txt";
      filename: string;
      title: string;
      theme?: "modern" | "technical" | "business" | "editorial" | "scientific";
      summary: string;
      content: {
        blocks?: unknown[];
        sheets?: unknown[];
        slides?: unknown[];
      };
      sources?: Array<{ title: string; url: string; publisher?: string }>;
    }
  | { kind: "none" };

function buildResearchContextBlock(research?: ResearchResult): string {
  if (!research?.needed) return "";

  if (research.findings.length === 0) {
    const sourceNotes = research.sources
      .map(source => `${source.title} — ${source.url}${source.snippet ? `\n${source.snippet}` : ""}`)
      .join("\n\n");
    return `
CURRENT-FACT RESEARCH STATUS:
Research was required for this request, but no verified findings were extracted. ${sourceNotes ? `The following source listings are available, but their content has not been verified:\n${sourceNotes}` : "No usable search results were available."}
Do not invent current facts, dates, statistics, rankings, or citations. Avoid claims of recency; state the limitation briefly in the document if it materially affects the answer.
`;
  }

  const findingsText = research.findings
    .map(
      (f, i) =>
        `${i + 1}. ${f.topic} (confidence: ${f.confidence})\n   ${f.content}\n   Sources: ${f.sources.join(", ")}`
    )
    .join("\n\n");

  const sourcesText = research.sources
    .map((s, i) => `${i + 1}. ${s.title} — ${s.url}${s.publisher ? ` (${s.publisher})` : ""}`)
    .join("\n");

  return `
RESEARCH FINDINGS (gathered from web sources — USE these facts in the document):
${findingsText}

AVAILABLE SOURCES (cite these in the document where appropriate):
${sourcesText}

Use these findings only where relevant to the user's request. Never infer facts that are not supported by the findings. Return source references in the JSON "sources" array; the document renderer adds the references section, so do not create a second one in the content.
`;
}

export type LengthIntent = {
  targetPages?: number;
  targetSlides?: number;
  targetSheets?: number;
  isExtensive?: boolean;
};

export function parseUserLengthIntent(message: string): LengthIntent {
  const text = message.toLowerCase();

  // Match e.g. "10 pages", "10 page", "10-page", "at least 10 pages", "approx 5 pages"
  const pageMatch = text.match(/\b(\d{1,3})\s*-?\s*pages?\b/i);
  // Match e.g. "12 slides", "15 slide"
  const slideMatch = text.match(/\b(\d{1,3})\s*-?\s*slides?\b/i);
  // Match e.g. "5 sheets", "4 tabs"
  const sheetMatch = text.match(/\b(\d{1,3})\s*-?\s*(?:sheets?|tabs?)\b/i);

  const isExtensive =
    /\b(unlimited|exhaustive|extensive|complete guide|deep dive|full book|long form|in-depth|massive|detailed guide|handbook|full length|maximum length)\b/i.test(
      text
    );

  const targetPages = pageMatch ? parseInt(pageMatch[1], 10) : undefined;
  const targetSlides = slideMatch ? parseInt(slideMatch[1], 10) : undefined;
  const targetSheets = sheetMatch ? parseInt(sheetMatch[1], 10) : undefined;

  return {
    targetPages: targetPages && targetPages > 0 ? Math.min(targetPages, 50) : undefined,
    targetSlides: targetSlides && targetSlides > 0 ? Math.min(targetSlides, 40) : undefined,
    targetSheets: targetSheets && targetSheets > 0 ? Math.min(targetSheets, 20) : undefined,
    isExtensive,
  };
}

/** Keep broad conversation context without sending entire extracted attachments to planning calls. */
export function compactDocumentHistory(history: Message[]): Message[] {
  const recent = history
    .filter(message => message.role === "user" || message.role === "assistant")
    .slice(-20);
  let remainingChars = 30_000;
  const compacted: Message[] = [];

  for (const message of [...recent].reverse()) {
    if (remainingChars <= 0) break;
    const compactText = (text: string): string => {
      if (text.length <= remainingChars) {
        remainingChars -= text.length;
        return text;
      }
      const budget = Math.max(0, remainingChars);
      remainingChars = 0;
      if (budget <= 120) return text.slice(0, budget);
      const headLength = budget - 120;
      return `${text.slice(0, headLength)}\n[Earlier context shortened]\n${text.slice(-120)}`;
    };

    const content = message.content;
    const compactContent: Message["content"] = typeof content === "string"
      ? compactText(content)
      : Array.isArray(content)
        ? content.map(part => {
          if (typeof part === "string") return compactText(part);
          if ("text" in part && typeof part.text === "string") {
            return { ...part, text: compactText(part.text) };
          }
          return {
            type: "text" as const,
            text: "[An earlier image or file attachment was present in the conversation.]",
          };
        })
        : "text" in content && typeof content.text === "string"
          ? { ...content, text: compactText(content.text) }
          : {
              type: "text" as const,
              text: "[An earlier image or file attachment was present in the conversation.]",
            };
    compacted.push({ ...message, content: compactContent });
  }

  return compacted.reverse();
}

const DIVERSE_ARCHITECTURE_GUIDE = `
Choose a structure that directly fits the user's requested artifact, audience, and topic. Start with the requested deliverable, then organize only the information needed to make it useful. Prefer clear headings and concise, specific bullets when they improve scanning. Do not force an executive-summary/report template onto letters, checklists, simple answers, forms, or other short requests. Never invent names, events, statistics, citations, or results. Mark assumptions clearly; use blank input fields or formulas where the user has not supplied data. Treat earlier conversation as source context only when the latest request refers to it.
`;

const FORMAT_INSTRUCTIONS = `
You are part of a document-generation assistant. Decide whether the user's latest
message is asking to CREATE a file (report, resume, invoice, letter, essay,
budget, spreadsheet, presentation, notes, table, plain text, etc.).

Available output formats and their codes:
- pdf  -> a styled PDF document
- docx -> an editable Microsoft Word document
- xlsx -> an Excel spreadsheet (use the "sheets" structure)
- pptx -> a PowerPoint presentation (use the "slides" structure)
- txt  -> a plain text file

Return a JSON object (no markdown fences). Schema:
{
  "createFile": true|false,
  "format": "pdf"|"docx"|"xlsx"|"pptx"|"txt",
  "filename": "a url-safe base name WITHOUT extension, e.g. Project_Report",
  "title": "document title",
  "summary": "a short, friendly sentence telling the user what you created and its format",
  "content": {
     "blocks": [ ... ]   // for pdf/docx/txt: an array of content blocks
     // OR
     "sheets": [ ... ]   // for xlsx
     // OR
     "slides": [ ... ]   // for pptx
  },
  "sources": [ { "title": "...", "url": "...", "publisher": "..." } ]
}

Rules:
- If the user is NOT asking to generate/create a file, set createFile=false and
  leave the other fields empty.
- If the user asks for a file but does NOT specify a format, infer the most
  natural format from the content (e.g. resume->docx, budget->xlsx,
  presentation->pptx, conversation/essay summary->pdf) and mention in "summary"
  the alternatives the user could ask for instead.
- content.blocks is a JSON array. Each block is one of:
    {"type":"heading","text":"...","level":1|2|3}
    {"type":"paragraph","text":"...","bold":false,"italic":false,"size":11,"alignment":"left"}
    {"type":"bulletList","items":["...","..."]}
    {"type":"numberedList","items":["...","..."]}
    {"type":"table","headers":["A","B"],"rows":[["a1","b1"],["a2","b2"]]}
  Produce a PROFESSIONAL, well-structured document with a sensible title
  heading and appropriate section headings, paragraphs, and lists.
- content.sheets is a JSON array (for xlsx):
    {"name":"SheetName","rows":[[cell...],[cell...]],"table":true}
  where each cell is a string, number, boolean, or null.
- content.slides is a JSON array (for pptx):
    {"title":"Slide heading","bullets":["...","..."],"table":{"headers":["A"],"rows":[["..."]]},"footnote":"..."}
  The first slide is treated as a title slide (title + subtitle + bullets).
- "sources" is an optional array of source references used in the document.
  Include this when research findings were provided.

COMPLETENESS & DIVERSITY REQUIREMENT (most important rule): Produce a complete artifact at the scope the user requested; never use a generic stub or filler.
- Respect any user-requested page count (e.g., "10 pages", "5 pages"), slide count ("12 slides"), or sheet count ("5 sheets").
- Match the requested topic, audience, and depth. Keep simple deliverables concise; expand only when the request needs detail.
- Adapt the structure dynamically to the topic: use technical guides for code, scientific abstracts for research, financial balance sheets for business, SOPs for workflows, etc. Do not force every document into a corporate Executive Summary template.
- Respect explicit page, slide, or sheet counts as approximate targets without padding. Do not invent numbers, facts, or results; label assumptions and leave unknown spreadsheet inputs blank. Let document pages flow naturally without forced page breaks.
`;

function buildForcedSystemPrompt(
  format: DocFormat,
  userMessage: string,
  research?: ResearchResult
): string {
  const formatUpper = format.toUpperCase();
  const researchBlock = buildResearchContextBlock(research);
  const lengthIntent = parseUserLengthIntent(userMessage);
  const currentDate = new Date().toISOString().slice(0, 10);

  let lengthDirective = "";
  if (format === "xlsx") {
    lengthDirective = lengthIntent.targetSheets
      ? `The user requested ${lengthIntent.targetSheets} sheets; target that count with distinct, useful content and no filler.`
      : `Create only the sheets the task needs (usually one to three). If source data is missing, make a usable template with clearly labeled blank inputs and formulas; never invent business data or present sample values as real.`;
  } else if (format === "pptx") {
    lengthDirective = `${lengthIntent.targetSlides ? `The user requested about ${lengthIntent.targetSlides} slides. ` : "Choose the smallest slide count that explains the topic well; use fewer slides for a focused request and more only when the substance requires it. "}${lengthIntent.isExtensive ? "The user asked for a comprehensive treatment, so cover the important dimensions with substantive slides. " : ""}Use professional layouts and concise, informative content. Never pad with agenda or recap slides unless useful.
CRITICAL PROHIBITION: NEVER write page numbers (e.g. "Page 1", "Slide 1", "1 of 5", "1/5"), slide counters, document titles, or file names inside slide titles, subtitles, bullets, or footnotes. The slide canvas must contain only the presentation topic content without meta page numbers or file names.`;
  } else {
    // pdf, docx, txt
    if (lengthIntent.targetPages) {
      const pCount = lengthIntent.targetPages;
      lengthDirective = `The user requested approximately ${pCount} pages. Aim for that length using relevant explanations, examples, and evidence; let pages flow naturally and do not force page breaks or add filler.`;
    } else if (lengthIntent.isExtensive) {
      lengthDirective = `The user requested an extensive treatment. Cover the major relevant aspects with enough depth, examples, and evidence; keep the writing specific and avoid repetition. Let pagination flow naturally.`;
    } else {
      lengthDirective = `Keep the document proportionate to the request. A simple deliverable should be concise; a complex question should receive a complete, clearly structured answer. Do not target a page count the user did not request.`;
    }
  }

  const structureExample = format === "xlsx"
    ? `"content":{"sheets":[{"name":"Sheet name","table":true,"rows":[["Column A","Column B"],["Value","Value"]]}]}`
    : format === "pptx"
      ? `"content":{"slides":[{"title":"Key point","bullets":["Specific supporting detail"]}]}`
      : `"content":{"blocks":[{"type":"heading","level":1,"text":"Section title"},{"type":"paragraph","text":"Relevant, supported content."},{"type":"bulletList","items":["Specific point"]}]}`;
  return `You are KSEMO's document-planning engine. The current date is ${currentDate}. Create a useful artifact that answers the user's latest request precisely.
Produce only content that serves the requested artifact. The user selected ${formatUpper}; return createFile=true and format="${format}".
The latest request and relevant earlier conversation are supplied as separate messages. Follow the latest request; use earlier turns only when it refers to them. Do not answer an older request again by default.
Choose a concise topic-based filename, accurate title, and brief user-facing summary.
${lengthDirective}
${DIVERSE_ARCHITECTURE_GUIDE}
${researchBlock ? `\n${researchBlock}\n` : ""}
Return valid JSON only, matching this format schema:
${structureExample}
When research is provided, include source details in the "sources" array and do not duplicate a references section in content. Do not claim current facts unless supported by supplied research. For templates, label assumptions and leave unknown values blank.`;
}

export async function planDocument(
  userMessage: string,
  history: Message[],
  forcedFormat?: Extract<DocumentPlan, { kind: "file" }>["format"] | null,
  research?: ResearchResult,
  opts?: { slideTarget?: number; visualStyle?: string; signal?: AbortSignal }
): Promise<DocumentPlan> {
  const forced = normalizeFormat(forcedFormat);
  const planningHistory = compactDocumentHistory(history);

  if (forced) {
    let systemContent = buildForcedSystemPrompt(forced, userMessage, research);
    if (forced === "pptx") {
      if (typeof opts?.slideTarget === "number") {
        systemContent += `\n\nThe user selected a target presentation size of ${opts.slideTarget} slides. Generate approximately ${opts.slideTarget} substantive slides (title, section dividers, metric layouts, tables, process flows, and comparisons) so the final deck is neither padded nor overcrowded. Never produce empty or placeholder slides.`;
      }
      if (opts?.visualStyle) {
        const styleName = opts.visualStyle.toUpperCase();
        systemContent += `\n\nAUTHORITATIVE PRESENTATION STYLE: ${styleName}.

NARRATIVE STRUCTURE (apply to every deck regardless of style):
Walk the audience through a coherent story — never a random list of slides. Follow this arc:
1. TITLE — a strong, specific title and subtitle that frame the topic.
2. CONTEXT — why this topic matters now (background, market, problem statement).
3. CONTENT — the substance: key concepts, mechanisms, evidence, cases. Use focused detail.
4. ANALYSIS / INSIGHTS — comparisons, metrics, implications. Let the numbers tell the story.
5. CONCLUSION — key takeaways, next steps, or a call to action.
Choose slide layouts that match this arc (title -> agenda -> content -> data/comparison -> closing). Never include page numbers, slide counters, "Slide N", "Page N", or the file name in any slide text.

You MUST tailor slide content, tone, layouts, and data storytelling directly to this visual style:
- Minimal: Crisp, punchy statements; one focused idea per slide; generous whitespace; high signal-to-noise ratio; avoid clutter; short bullets (under 8 words each).
- Modern: Clean, forward-looking tone; distinct sections with a rhythm of statements, compact bullet groups, and metric highlights; optimistic and conversational but professional.
- Corporate: Executive-grade tone; clear problem-solution-impact; scorecards, benchmarks, responsibility framing, ROI and readiness metrics; serious, measured language.
- Editorial: Thoughtful narrative flow; long-form analysis with rich sub-points, context, and nuance; magazine-style storytelling; detailed but structured bullets.
- Bold: Punchy, dramatic headlines; high-impact numbers; decisive statements and calls-to-action; fewer but stronger points; imperative tone.
- Elegant: Sophisticated, refined language; polished framing with considered wording; restrained bullet count; graceful headings; premium tone.
- Creative: Playful, energetic prose; vivid metaphors; memorable framing; slightly unconventional structure; expressive labels and punchy copy.
- Dark: Dramatic, high-contrast storytelling; emphasis on deep context, striking statistics, and confident declarations; sleek and modern tone.
- Light: Airy, optimistic, accessible tone; clear simple structure; friendly explanations; approachable framing for general audiences.
- Glass: Contemporary, translucent feel; layered concepts (foreground/background); clear tiers of information; modern tech-leaning tone.
- Academic: Rigorous, citation-ready; formal definitions, methodology, evidence, and references; analytical depth; precise terminology.
- Technical: Precise technical terminology; system architecture blocks; telemetry/metrics; quantitative benchmarks; implementation details.
- Luxury: Prestigious, understated tone; exclusive high-value framing; refined statistics; premium brand messaging with restraint.
- Startup: Energetic, product-led; problem-solution-validation framing; traction metrics, growth numbers, and crisp value propositions.
- Magazine: Feature-article tone; bold pull-quotes; human-interest framing; vivid details; structured feature sections with striking copy.
- Data: Data-first storytelling; every claim backed by metrics; comparisons, distributions, and quantified insights; analytical and evidence-led.
- Presentation: Balanced, all-purpose professional; clear structure; confident summaries; adaptable tone that makes complex topics easy to grasp.
Produce substantive, authentic slides reflecting this design archetype. If "AUTO", pick the archetype that best matches the topic and state it implicitly in your content choices.`;
      }
    }
    const researchHint = research?.needed
      ? `\n\nResearch was performed. Findings: ${research.findings.length} topics, ${research.sourceCount} sources. Use the provided research findings to create an accurate, well-sourced document.`
      : "";
    const userContent = `User query / topic:\n${userMessage}${researchHint}\n\nGenerate the complete ${forced.toUpperCase()} document JSON now:`;

    try {
      const result = await invokeLLM({
        model: DEFAULT_LLM_MODEL,
        messages: [
          { role: "system", content: systemContent },
          ...planningHistory,
          { role: "user", content: userContent },
        ],
        responseFormat: { type: "json_object" },
        maxTokens: 16000,
        signal: opts?.signal,
      });

      const raw = result.choices?.[0]?.message?.content;
      const text = Array.isArray(raw)
        ? raw.map(p => (typeof p === "object" ? (p as { text?: string }).text ?? "" : String(p))).join("")
        : String(raw ?? "");

      const parsed = parsePlanJson(text);
      if (!parsed) {
        throw new Error("The planner returned invalid document data.");
      }
      return buildPlanFromParsed(parsed, forced, userMessage, research, history);
    } catch (error) {
      if (opts?.signal?.aborted) throw error;
      console.error(`[DocGen] planning call with forced ${forced} failed.`, error);
      throw new Error("I couldn't build a reliable document from this request. Please try again.");
    }
  }

  // Automatic document detection when format is not pre-selected
  const systemContent = FORMAT_INSTRUCTIONS;
  const researchHint = research?.needed
    ? `\n\nResearch findings are available with ${research.findings.length} topics and ${research.sourceCount} sources. Use them if the document would benefit from factual, research-grounded content.`
    : "";
  const userContent = `User's latest message:\n${userMessage}${researchHint}\n\nProduce the JSON plan now.`;

  try {
    const result = await invokeLLM({
      model: DEFAULT_LLM_MODEL,
      messages: [
        { role: "system", content: systemContent },
        ...planningHistory,
        { role: "user", content: userContent },
      ],
      responseFormat: { type: "json_object" },
      maxTokens: 16000,
      signal: opts?.signal,
    });
    const raw = result.choices?.[0]?.message?.content;
    const text = Array.isArray(raw)
      ? raw.map(p => (typeof p === "object" ? (p as { text?: string }).text ?? "" : String(p))).join("")
      : String(raw ?? "");
    const parsed = parsePlanJson(text);
    if (!parsed) return { kind: "none" };

    if (parsed.createFile !== true) return { kind: "none" };
    const format = normalizeFormat(parsed.format);
    if (!format) return { kind: "none" };
    return buildPlanFromParsed(parsed, format, userMessage, research, history);
  } catch (error) {
    if (opts?.signal?.aborted) throw error;
    console.warn("[DocGen] planning call failed; no file generated.", error);
    return { kind: "none" };
  }
}

function buildPlanFromParsed(
  parsed: Record<string, any>,
  format: DocFormat,
  userMessage: string,
  research?: ResearchResult,
  history?: Message[]
): DocumentPlan & { kind: "file" } {
  const title = String(parsed.title ?? cleanTitleFromMessage(userMessage, history)).slice(0, 160);
  const filename = String(parsed.filename ?? sanitizeTitle(title)).slice(0, 120);
  const summary = String(
    parsed.summary ?? `I created your ${format.toUpperCase()} document: "${title}".`
  );

  let content: { blocks?: unknown[]; sheets?: unknown[]; slides?: unknown[] };

  if (Array.isArray(parsed.content)) {
    content = { blocks: parsed.content };
  } else {
    content = {
      blocks: Array.isArray(parsed.content?.blocks) ? parsed.content.blocks : undefined,
      sheets: Array.isArray(parsed.content?.sheets) ? parsed.content.sheets : undefined,
      slides: Array.isArray(parsed.content?.slides) ? parsed.content.slides : undefined,
    };
  }

  // If blocks/sheets/slides are empty, fill with synthesized content
  if (format === "xlsx" && (!content.sheets || !content.sheets.length)) {
    throw new Error("The planner did not provide spreadsheet content.");
  } else if (format === "pptx" && (!content.slides || !content.slides.length)) {
    throw new Error("The planner did not provide presentation content.");
  } else if (format !== "xlsx" && format !== "pptx" && (!content.blocks || !content.blocks.length)) {
    throw new Error("The planner did not provide document content.");
  }

  // Collect source references from parsed plan + research results
  const sources: Array<{ title: string; url: string; publisher?: string }> = [];
  if (Array.isArray(parsed.sources)) {
    for (const s of parsed.sources) {
      if (
        s &&
        typeof s === "object" &&
        typeof (s as any).url === "string" &&
        isUserProvidedOrResearchedUrl((s as any).url, userMessage, history, research)
      ) {
        sources.push({
          title: String((s as any).title || "Source"),
          url: String((s as any).url),
          publisher: (s as any).publisher ? String((s as any).publisher) : undefined,
        });
      }
    }
  }
  if (research?.sources) {
    for (const rs of research.sources) {
      if (!sources.some(s => s.url === rs.url)) {
        sources.push({
          title: rs.title,
          url: rs.url,
          publisher: rs.publisher,
        });
      }
    }
  }

  return {
    kind: "file",
    format,
    filename,
    title,
    summary,
    content,
    sources: sources.length > 0 ? sources : undefined,
  };
}

function isUserProvidedOrResearchedUrl(
  url: string,
  userMessage: string,
  history?: Message[],
  research?: ResearchResult
): boolean {
  const normalizedUrl = url.replace(/[),.;\]]+$/, "");
  if (research?.sources.some(source => source.url === normalizedUrl)) return true;
  const userText = [
    userMessage,
    ...(history ?? [])
      .filter(message => message.role === "user")
      .flatMap(message => {
        if (typeof message.content === "string") return [message.content];
        const parts = Array.isArray(message.content) ? message.content : [message.content];
        return parts.flatMap(part =>
          typeof part === "string"
            ? [part]
            : "text" in part && typeof part.text === "string"
              ? [part.text]
              : []
        );
      }),
  ].join("\n");
  return userText.includes(normalizedUrl);
}

function cleanTitleFromMessage(message: string, history?: Message[]): string {
  const cleaned = message
    .replace(/^\/?(pdf|docx|word|xlsx|excel|pptx|powerpoint|ppt|txt|text)\s*[:\s-]?/i, "")
    .replace(/^(can you\s+)?(i\s+want|i\s+need|give\s+me|can\s+you\s+give\s+me|can\s+you\s+provide|please\s+)?(this|that|it)?\s*(in|into|to|as\s+a|as)?\s*(pdf|word|docx|excel|xlsx|powerpoint|pptx|text|txt)?\s*/i, "")
    .replace(/^(create|generate|write|make|build|give me|can you make|please make)\s+(a|an|the)?\s*/i, "")
    .replace(/(pdf|word document|docx|excel|spreadsheet|xlsx|powerpoint|presentation|pptx|text file|txt|file)\s*/gi, "")
    .replace(/[^\w\s-]/g, "")
    .trim();

  // If the user's prompt was "I want this in PDF" or "give me this in Word",
  // derive the title from the previous user turn in history if available.
  if (!cleaned || /^(this|that|it|everything|the above)$/i.test(cleaned)) {
    if (history && history.length > 0) {
      const priorUser = [...history].reverse().find(m => m.role === "user" && m.content);
      if (priorUser && typeof priorUser.content === "string") {
        const priorTitle = cleanTitleFromMessage(priorUser.content);
        if (priorTitle && priorTitle !== "Comprehensive Document") {
          return priorTitle;
        }
      }
    }
    return "Comprehensive Document";
  }

  return cleaned
    .split(/\s+/)
    .slice(0, 7)
    .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}

function sanitizeTitle(title: string): string {
  const cleaned = title
    .replace(/[^a-zA-Z0-9 _-]/g, "")
    .trim()
    .split(/\s+/)
    .slice(0, 6)
    .join("_")
    .toLowerCase();
  return cleaned || "document";
}

function normalizeFormat(value: unknown): DocFormat | null {
  const v = String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/^\./, "");
  const valid: DocFormat[] = ["pdf", "docx", "xlsx", "pptx", "txt"];
  return valid.includes(v as DocFormat) ? (v as DocFormat) : null;
}

function parsePlanJson(text: string): Record<string, any> | null {
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
        const candidate = JSON.parse(cleaned.slice(start, end + 1));
        return typeof candidate === "object" && candidate !== null ? candidate : null;
      } catch {
        return null;
      }
    }
    return null;
  }
}
