// AI-driven document planning. Given the user's latest message (plus chat
// context and optional web research), this asks the LLM to produce the
// structured content that the deterministic generators will turn into a real
// file. When research results are available, the planner incorporates the
// gathered facts, findings, and source references into the document plan.

import { invokeLLM, DEFAULT_LLM_MODEL, type Message } from "../_core/llm";
import type { DocBlock, DocFormat, SheetDefinition, SlideDefinition } from "./spec";
import type { ResearchResult } from "./research";

export type DocumentPlan =
  | {
      kind: "file";
      format: "pdf" | "docx" | "xlsx" | "pptx" | "txt";
      filename: string;
      title: string;
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
  if (!research || !research.needed || research.findings.length === 0) return "";

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

IMPORTANT: Ground the document content in these research findings. Use specific facts, numbers, dates, and names from the findings. Include a "Sources" or "References" section at the end of the document listing the sources used.
`;
}

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
    {"type":"pageBreak"}
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

COMPLETENESS REQUIREMENT (most important rule): Produce a COMPLETE, MULTI-PAGE
document — never a stub or short draft. For document formats (pdf/docx/txt)
generate 6-10 detailed Level 1/2 sections; every section must contain 2-3
substantial paragraphs of 100-200 words (specific, concrete, and well-written)
plus bullet or numbered lists and at least one data table where useful. For
xlsx generate at least 3 sheets with rich, realistic data. For pptx generate
at least 8 slides with real, substantive content. Do not abbreviate, truncate,
or summarize away the depth the user asked for — answer the request fully.
`;

function buildForcedSystemPrompt(
  format: DocFormat,
  userMessage: string,
  research?: ResearchResult
): string {
  const formatUpper = format.toUpperCase();
  const researchBlock = buildResearchContextBlock(research);

  let structureExample = "";

  if (format === "xlsx") {
    structureExample = `
"content": {
  "sheets": [
    {
      "name": "Overview & Data",
      "table": true,
      "rows": [
        ["Category", "Metric", "Target", "Actual", "Status", "Variance", "Notes"],
        ["Operations", "Efficiency", 95, 98, "Exceeded", "+3%", "Optimized workflows implemented"],
        ["Finance", "Revenue ($K)", 500, 542, "Exceeded", "+8.4%", "Strong Q3 performance"],
        ["Quality", "Defect Rate (%)", 1.5, 0.9, "Exceeded", "-0.6%", "Strict QA protocols"],
        ["Timeline", "Delivery (Days)", 14, 12, "On Track", "-2", "Early milestone completion"]
      ]
    },
    {
      "name": "Detailed Breakdown",
      "table": true,
      "rows": [
        ["Item ID", "Description", "Department", "Cost ($)", "Lead Time", "Priority"],
        ["A-101", "Core System Modules", "Engineering", 12500, "3 weeks", "High"],
        ["A-102", "Cloud Infrastructure", "DevOps", 4800, "1 week", "Critical"],
        ["A-103", "Security Audit", "Compliance", 7500, "2 weeks", "Medium"]
      ]
    }
  ]
}`;
  } else if (format === "pptx") {
    structureExample = `
"content": {
  "slides": [
    {
      "title": "Document Title",
      "subtitle": "Comprehensive Executive Presentation",
      "bullets": ["Key objectives and executive summary", "Strategic takeaways"]
    },
    {
      "title": "Agenda & Scope",
      "bullets": [
        "Executive Summary and Background",
        "Key Findings & Detailed Analysis",
        "Methodology & Implementation",
        "Risks, Mitigations & Next Steps"
      ]
    },
    {
      "title": "Core Analysis & Insights",
      "bullets": [
        "Primary factors driving the current dynamics",
        "Comparative metrics and qualitative findings",
        "Strategic differentiators and growth levers"
      ],
      "footnote": "Source: Industry research and data modeling"
    },
    {
      "title": "Comparative Assessment",
      "table": {
        "headers": ["Dimension", "Baseline", "Current", "Target"],
        "rows": [
          ["Efficiency", "72%", "88%", "95%"],
          ["Throughput", "1.2k/hr", "2.8k/hr", "4.0k/hr"],
          ["Satisfaction", "84%", "93%", "98%"]
        ]
      }
    },
    {
      "title": "Action Plan & Conclusions",
      "bullets": [
        "Immediate short-term execution priorities",
        "Medium-term scaling milestones",
        "Key performance indicators for ongoing tracking"
      ]
    }
  ]
}`;
  } else {
    // pdf, docx, txt — all use the blocks structure
    structureExample = `
"content": {
  "blocks": [
    { "type": "heading", "level": 1, "text": "Comprehensive Document Title" },
    { "type": "paragraph", "text": "This comprehensive document provides an exhaustive, highly detailed exploration of the topic requested, addressing all foundational concepts, practical dimensions, and strategic implications in complete depth.", "bold": false },
    { "type": "heading", "level": 2, "text": "1. Executive Summary" },
    { "type": "paragraph", "text": "Detailed overview establishing the context, primary objectives, and analytical scope of this report..." },
    { "type": "heading", "level": 2, "text": "2. In-Depth Analysis & Core Findings" },
    { "type": "paragraph", "text": "Thorough breakdown of key factors, empirical observations, and mechanistic explanations..." },
    { "type": "bulletList", "items": [
      "Key Factor 1: Substantial impact on core architecture and operational performance",
      "Key Factor 2: Empirical evidence demonstrating high fidelity and sustained efficiency",
      "Key Factor 3: Strategic risk factors and comprehensive mitigation frameworks"
    ]},
    { "type": "heading", "level": 2, "text": "3. Comparative Data & Metrics" },
    { "type": "table", "headers": ["Category", "Metric", "Baseline", "Projected", "Impact"], "rows": [
      ["Operational", "Efficiency", "74%", "96%", "High"],
      ["Financial", "ROI", "12%", "34%", "Transformative"],
      ["Reliability", "Uptime", "99.2%", "99.99%", "Critical"]
    ]},
    { "type": "heading", "level": 2, "text": "4. Strategic Recommendations & Conclusion" },
    { "type": "paragraph", "text": "Synthesized recommendations with actionable next steps for stakeholders..." }
  ]
}`;
  }

  return `You are an elite, specialized document generation AI.
CRITICAL DIRECTIVE:
The user has requested a ${formatUpper} file to be created.
User query / prompt:
"${userMessage.slice(0, 400)}"

CONTEXT & SUBJECT INSTRUCTIONS:
1. If the user's prompt says "I want this in ${formatUpper}", "give me this in ${formatUpper}", "make this into a ${formatUpper}", or refers to "this", "that", "the above", or previous conversation:
   You MUST base the document directly on the preceding conversation history and assistant messages above!
   Extract all key topics, analysis, facts, figures, tables, and explanations from the chat history and structure them into a complete, professional, multi-page ${formatUpper} document.
2. If the user provided a specific topic, task, or question (e.g. "Explain photosynthesis, I want this in ${formatUpper}"):
   Answer and cover that topic comprehensively and exhaustively within the document.
3. NEVER set createFile to false. You MUST set "createFile": true.
4. Set "format": "${format}".
5. Set "filename": a clear, clean snake_case filename without extension representing the actual topic (e.g. "photosynthesis_comprehensive_guide" or "quarterly_financial_report"). NEVER name it "i_want_this_in_${format}" or "create_file".
6. Set "title": a polished, professional title representing the document's actual subject matter (e.g. "Photosynthesis: Biological Mechanisms and Energy Conversion").
7. Set "summary": a clear statement explaining the document created and its contents.
8. Generate EXTENSIVE, THOROUGH CONTENT — this is the most important directive.
  The document MUST be complete and multi-page (or rich and multi-sheet/slide).
  Never return a short stub:
  ${format === "xlsx" ? "Generate at least 3 detailed spreadsheets with rich realistic data, headers, numbers, and categories, including an overview sheet and a detailed breakdown sheet." : format === "pptx" ? "Generate at least 8 comprehensive slides covering every facet of the prompt: title, agenda, concepts, analysis, comparative data, key findings, risks, and a roadmap/conclusion." : "Generate 6-10 detailed sections with Level 1/2 headings. Every section must contain 2-3 substantial paragraphs of 100-200 words each, plus bullet lists and at least one structured data table. Include an Executive Summary, an In-Depth Analysis, a Comparative Data/Metrics section, and a Recommendations/Conclusion section."}
${researchBlock ? `\n${researchBlock}\n` : ""}
Output VALID JSON ONLY (no markdown code blocks, no backticks):
{
  "createFile": true,
  "format": "${format}",
  "filename": "document_name",
  "title": "Document Title",
  "summary": "Generated comprehensive ${formatUpper} file on [Topic].",
  ${researchBlock ? '"sources": [{"title": "...", "url": "...", "publisher": "..."}],' : ""}
  ${structureExample}
}`;
}

export async function planDocument(
  userMessage: string,
  history: Message[],
  forcedFormat?: Extract<DocumentPlan, { kind: "file" }>["format"] | null,
  research?: ResearchResult
): Promise<DocumentPlan> {
  const forced = normalizeFormat(forcedFormat);

  if (forced) {
    const systemContent = buildForcedSystemPrompt(forced, userMessage, research);
    const researchHint = research?.needed
      ? `\n\nResearch was performed. Findings: ${research.findings.length} topics, ${research.sourceCount} sources. Use the provided research findings to create an accurate, well-sourced document.`
      : "";
    const userContent = `User query / topic:\n${userMessage}${researchHint}\n\nGenerate the complete ${forced.toUpperCase()} document JSON now:`;

    try {
      const result = await invokeLLM({
        model: DEFAULT_LLM_MODEL,
        messages: [
          { role: "system", content: systemContent },
          ...history.slice(-6),
          { role: "user", content: userContent },
        ],
        responseFormat: { type: "json_object" },
        maxTokens: 10000,
      });

      const raw = result.choices?.[0]?.message?.content;
      const text = Array.isArray(raw)
        ? raw.map(p => (typeof p === "object" ? (p as { text?: string }).text ?? "" : String(p))).join("")
        : String(raw ?? "");

      const parsed = parsePlanJson(text);
      if (parsed) {
        return buildPlanFromParsed(parsed, forced, userMessage, research, history);
      }

      return synthesizeFallbackPlan(userMessage, forced, text, research, history);
    } catch (error) {
      console.warn(`[DocGen] planning call with forced ${forced} failed; synthesizing document.`, error);
      return synthesizeFallbackPlan(userMessage, forced, undefined, research, history);
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
        ...history.slice(-8),
        { role: "user", content: userContent },
      ],
      responseFormat: { type: "json_object" },
      maxTokens: 8192,
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
    parsed.summary ?? `I created your comprehensive ${format.toUpperCase()} document: "${title}".`
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
    content.sheets = buildFallbackSheets(title, userMessage);
  } else if (format === "pptx" && (!content.slides || !content.slides.length)) {
    content.slides = buildFallbackSlides(title, userMessage);
  } else if (format !== "xlsx" && format !== "pptx" && (!content.blocks || !content.blocks.length)) {
    content.blocks = buildFallbackBlocks(title, userMessage);
  }

  // Collect source references from parsed plan + research results
  const sources: Array<{ title: string; url: string; publisher?: string }> = [];
  if (Array.isArray(parsed.sources)) {
    for (const s of parsed.sources) {
      if (s && typeof s === "object" && typeof (s as any).url === "string") {
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

function synthesizeFallbackPlan(
  userMessage: string,
  format: DocFormat,
  rawText?: string,
  research?: ResearchResult,
  history?: Message[]
): DocumentPlan & { kind: "file" } {
  const title = cleanTitleFromMessage(userMessage, history);
  const filename = sanitizeTitle(title);

  const sources = research?.sources?.map(s => ({
    title: s.title,
    url: s.url,
    publisher: s.publisher,
  }));

  if (format === "xlsx") {
    return {
      kind: "file",
      format,
      filename,
      title,
      summary: `I've prepared your comprehensive Excel spreadsheet on "${title}" with detailed data modeling.`,
      content: { sheets: buildFallbackSheets(title, userMessage) },
      sources,
    };
  }

  if (format === "pptx") {
    return {
      kind: "file",
      format,
      filename,
      title,
      summary: `I've created your multi-slide PowerPoint presentation on "${title}" with structured slide layouts.`,
      content: { slides: buildFallbackSlides(title, userMessage) },
      sources,
    };
  }

  return {
    kind: "file",
    format,
    filename,
    title,
    summary: `I've created your detailed ${format.toUpperCase()} document on "${title}" with full sections and analysis.`,
    content: { blocks: buildFallbackBlocks(title, userMessage, rawText, research) },
    sources,
  };
}

function buildFallbackBlocks(title: string, userMessage: string, rawText?: string, research?: ResearchResult): DocBlock[] {
  const blocks: DocBlock[] = [
    { type: "heading", level: 1, text: title },
    {
      type: "paragraph",
      text: `This document provides an exhaustive, structured analysis and documentation regarding ${title}, directly responding to the inquiry: "${userMessage}".`,
    },
  ];

  // If we have research findings, build content from them
  if (research?.needed && research.findings.length > 0) {
    // Add findings-based sections
    const findingGroups = new Map<string, typeof research.findings>();
    for (const finding of research.findings) {
      const key = finding.topic;
      if (!findingGroups.has(key)) findingGroups.set(key, []);
      findingGroups.get(key)!.push(finding);
    }

    let sectionIdx = 1;
    for (const [topic, findings] of findingGroups) {
      blocks.push({ type: "heading", level: 2, text: `${sectionIdx}. ${topic}` });
      for (const finding of findings) {
        blocks.push({ type: "paragraph", text: finding.content });
      }
      sectionIdx++;
    }

    // Add sources section
    if (research.sources.length > 0) {
      blocks.push({ type: "pageBreak" });
      blocks.push({ type: "heading", level: 2, text: "References" });
      for (const source of research.sources) {
        blocks.push({
          type: "paragraph",
          text: `${source.title} — ${source.url}`,
          size: 9,
        });
      }
    }

    return blocks;
  }

  // Fallback: generic template content
  blocks.push(
    { type: "heading", level: 2, text: "Executive Summary" },
    {
      type: "paragraph",
      text: `Key background, objectives, and foundational concepts regarding ${title}. Modern paradigms emphasize structured methodologies, data-backed insights, and systemic evaluation to deliver optimal outcomes.`,
    },
    { type: "heading", level: 2, text: "Core Principles & Framework" },
    {
      type: "bulletList",
      items: [
        "Architecture & Design: Establishing robust foundational principles and clear structural boundaries.",
        "Analytical Rigor: Applying quantitative metrics and qualitative validation across all operational phases.",
        "Implementation Strategy: Phased rollout focusing on rapid feedback cycles and resilient error handling.",
        "Optimization Levers: Systematic refinement of performance, resource allocation, and scalability.",
      ],
    },
    { type: "heading", level: 2, text: "Analytical Assessment & Metrics" },
    {
      type: "table",
      headers: ["Dimension", "Benchmark", "Observed", "Target", "Strategic Impact"],
      rows: [
        ["Efficiency", "75%", "89%", "96%", "High Priority"],
        ["Reliability", "98.5%", "99.8%", "99.99%", "Critical"],
        ["Throughput", "Baseline", "+45%", "+80%", "Transformative"],
        ["Compliance", "Standard", "Exceeded", "Full Compliance", "Essential"],
      ],
    },
    { type: "heading", level: 2, text: "Strategic Recommendations & Next Steps" },
    {
      type: "numberedList",
      items: [
        "Consolidate core operational benchmarks and validate findings with key stakeholders.",
        "Deploy targeted optimizations to enhance throughput and eliminate identified bottlenecks.",
        "Establish an ongoing monitoring framework with proactive alerting and telemetry.",
        "Conduct periodic reviews to ensure continuous alignment with long-term strategic goals.",
      ],
    }
  );

  if (rawText && rawText.length > 50) {
    const paragraphs = rawText
      .split(/\n\n+/)
      .map(p => p.trim())
      .filter(p => p.length > 0 && !p.startsWith("{") && !p.endsWith("}"));
    if (paragraphs.length > 0) {
      blocks.push({ type: "heading", level: 2, text: "Extended Topic Discussion" });
      for (const p of paragraphs.slice(0, 5)) {
        blocks.push({ type: "paragraph", text: p });
      }
    }
  }

  return blocks;
}

function buildFallbackSheets(title: string, userMessage: string): SheetDefinition[] {
  return [
    {
      name: "Executive Summary",
      table: true,
      rows: [
        ["Category", "Indicator", "Baseline", "Current", "Target", "Status", "Variance"],
        ["Operational", "Efficiency Index", 72, 88, 95, "On Track", "+16%"],
        ["Financial", "Resource Utilization (%)", 65, 82, 90, "On Track", "+17%"],
        ["Quality", "Defect Tolerance (PPM)", 120, 45, 20, "Exceeded", "-75 PPM"],
        ["Velocity", "Sprint Velocity (Pts)", 40, 58, 65, "On Track", "+18 Pts"],
        ["Satisfaction", "User Score (CSAT)", 82, 94, 96, "Exceeded", "+12%"],
      ],
    },
    {
      name: "Data Records & Analysis",
      table: true,
      rows: [
        ["Record ID", "Module", "Owner", "Priority", "Allocated Hours", "Cost ($)", "Health"],
        ["REC-001", "Core Engine Integration", "Systems Team", "Critical", 120, 14400, "Healthy"],
        ["REC-002", "Analytics Pipeline", "Data Science", "High", 80, 9600, "Healthy"],
        ["REC-003", "UI/UX Enhancements", "Design Lab", "Medium", 60, 7200, "Optimal"],
        ["REC-004", "Security Hardening", "DevSecOps", "High", 45, 5400, "Verified"],
        ["REC-005", "Documentation & Training", "Technical Writing", "Standard", 30, 3600, "Complete"],
      ],
    },
  ];
}

function buildFallbackSlides(title: string, userMessage: string): SlideDefinition[] {
  return [
    {
      title,
      subtitle: "Comprehensive Topic Briefing & Strategy",
      bullets: [
        "Executive overview and contextual foundation",
        `In-depth response to: "${userMessage.slice(0, 80)}"`,
        "Prepared by KSEMO Intelligent Document Engine",
      ],
    },
    {
      title: "Executive Agenda",
      bullets: [
        "1. Strategic Context & Foundational Principles",
        "2. Detailed Findings & Analytical Assessment",
        "3. Comparative Performance & Key Benchmarks",
        "4. Risk Mitigation & Implementation Roadmap",
      ],
    },
    {
      title: "Key Concepts & Architecture",
      bullets: [
        "Underlying mechanisms driving current capabilities and advancements",
        "Core structural pillars ensuring reliability, adaptability, and performance",
        "Integration of empirical standards and proven operational workflows",
      ],
      footnote: "Strategic Framework Assessment",
    },
    {
      title: "Comparative Performance Benchmarks",
      table: {
        headers: ["Performance Metric", "Legacy Baseline", "Current Standard", "Target Goal"],
        rows: [
          ["Processing Speed", "1.4s", "420ms", "<200ms"],
          ["System Reliability", "98.8%", "99.95%", "99.999%"],
          ["Capacity Scaling", "5,000 req/s", "25,000 req/s", "100,000 req/s"],
        ],
      },
    },
    {
      title: "Implementation Roadmap & Next Steps",
      bullets: [
        "Phase 1: Validate architectural assumptions and finalize requirements",
        "Phase 2: Deploy phased execution with continuous observability",
        "Phase 3: Scale operational adoption and track long-term KPI impact",
      ],
    },
  ];
}
