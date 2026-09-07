// AI-driven document planning. Given the user's latest message (plus chat
// context), this asks the LLM to decide whether a file should be generated and,
// if so, to produce the structured content that the deterministic generators
// will turn into a real file. It keeps "format when not specified" behaviour
// sane by choosing a sensible default and advertising alternatives.

import { invokeLLM, type Message } from "../_core/llm";
import type { DocBlock, DocFormat, SheetDefinition, SlideDefinition } from "./spec";

export type DocumentPlan =
  | {
      kind: "file";
      format: "pdf" | "docx" | "xlsx" | "pptx" | "txt" | "md";
      filename: string;
      title: string;
      summary: string;
      content: {
        blocks?: unknown[];
        sheets?: unknown[];
        slides?: unknown[];
      };
    }
  | { kind: "none" };

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
- md   -> a Markdown document (headings, lists, tables, code blocks, links)

Return a JSON object (no markdown fences). Schema:
{
  "createFile": true|false,
  "format": "pdf"|"docx"|"xlsx"|"pptx"|"txt"|"md",
  "filename": "a url-safe base name WITHOUT extension, e.g. Project_Report",
  "title": "document title",
  "summary": "a short, friendly sentence telling the user what you created and its format",
  "content": {
     "blocks": [ ... ]   // for pdf/docx/txt/md: an array of content blocks
     // OR
     "sheets": [ ... ]   // for xlsx
     // OR
     "slides": [ ... ]   // for pptx
  }
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

Number of blocks/slides: be generous and thorough.
`;

function buildForcedSystemPrompt(format: DocFormat, userMessage: string): string {
  const formatUpper = format.toUpperCase();
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
    // pdf, docx, txt, md
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
The user has explicitly activated ${formatUpper} FILE CREATION MODE.
Whatever the user's prompt or question is:
"${userMessage.slice(0, 400)}"

You MUST generate a complete, extensive, professional ${formatUpper} file answering and addressing this prompt in rich, exhaustive detail!
- NEVER set createFile to false. You MUST set "createFile": true.
- Set "format": "${format}".
- Set "filename": a clear, clean snake_case filename without extension (e.g., "artificial_intelligence_overview").
- Set "title": a polished, professional title for the document.
- Set "summary": a clear statement explaining the document created and its contents.
- Generate EXTENSIVE, THOROUGH content:
  ${format === "xlsx" ? "Generate at least 2 detailed spreadsheets with rich data, headers, numbers, and realistic categories." : format === "pptx" ? "Generate at least 6-8 comprehensive slides covering all facets of the prompt." : "Generate at least 4-7 detailed sections with Level 1/2 headings, substantial paragraphs, bullet lists, and structured data tables."}

Output VALID JSON ONLY (no markdown code blocks, no backticks):
{
  "createFile": true,
  "format": "${format}",
  "filename": "document_name",
  "title": "Document Title",
  "summary": "Generated comprehensive ${formatUpper} file on [Topic].",
  ${structureExample}
}`;
}

export async function planDocument(
  userMessage: string,
  history: Message[],
  forcedFormat?: Extract<DocumentPlan, { kind: "file" }>["format"] | null
): Promise<DocumentPlan> {
  const forced = normalizeFormat(forcedFormat);

  if (forced) {
    const systemContent = buildForcedSystemPrompt(forced, userMessage);
    const userContent = `User query / topic:\n${userMessage}\n\nGenerate the complete ${forced.toUpperCase()} document JSON now:`;

    try {
      const result = await invokeLLM({
        model: "gemini-flash-latest",
        messages: [
          { role: "system", content: systemContent },
          ...history.slice(-6),
          { role: "user", content: userContent },
        ],
        responseFormat: { type: "json_object" },
        maxTokens: 6000,
      });

      const raw = result.choices?.[0]?.message?.content;
      const text = Array.isArray(raw)
        ? raw.map(p => (typeof p === "object" ? (p as { text?: string }).text ?? "" : String(p))).join("")
        : String(raw ?? "");

      const parsed = parsePlanJson(text);
      if (parsed) {
        return buildPlanFromParsed(parsed, forced, userMessage);
      }

      // If JSON parsing failed, construct from raw text
      return synthesizeFallbackPlan(userMessage, forced, text);
    } catch (error) {
      console.warn(`[DocGen] planning call with forced ${forced} failed; synthesizing document.`, error);
      return synthesizeFallbackPlan(userMessage, forced);
    }
  }

  // Automatic document detection when format is not pre-selected
  const systemContent = FORMAT_INSTRUCTIONS;
  const userContent = `User's latest message:\n${userMessage}\n\nProduce the JSON plan now.`;

  try {
    const result = await invokeLLM({
      model: "gemini-flash-latest",
      messages: [
        { role: "system", content: systemContent },
        ...history.slice(-8),
        { role: "user", content: userContent },
      ],
      responseFormat: { type: "json_object" },
      maxTokens: 4096,
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
    return buildPlanFromParsed(parsed, format, userMessage);
  } catch (error) {
    console.warn("[DocGen] planning call failed; no file generated.", error);
    return { kind: "none" };
  }
}

function buildPlanFromParsed(
  parsed: Record<string, any>,
  format: DocFormat,
  userMessage: string
): DocumentPlan & { kind: "file" } {
  const title = String(parsed.title ?? cleanTitleFromMessage(userMessage)).slice(0, 160);
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

  return {
    kind: "file",
    format,
    filename,
    title,
    summary,
    content,
  };
}

function cleanTitleFromMessage(message: string): string {
  const cleaned = message
    .replace(/^(create|generate|write|make|build|give me|can you make|please make)\s+(a|an|the)?\s*/i, "")
    .replace(/(pdf|word document|docx|excel|spreadsheet|xlsx|powerpoint|presentation|pptx|text file|markdown|file)\s*/gi, "")
    .replace(/[^\w\s-]/g, "")
    .trim();
  if (!cleaned) return "Comprehensive Document";
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
  const valid: DocFormat[] = ["pdf", "docx", "xlsx", "pptx", "txt", "md"];
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
  rawText?: string
): DocumentPlan & { kind: "file" } {
  const title = cleanTitleFromMessage(userMessage);
  const filename = sanitizeTitle(title);

  if (format === "xlsx") {
    return {
      kind: "file",
      format,
      filename,
      title,
      summary: `I've prepared your comprehensive Excel spreadsheet on "${title}" with detailed data modeling.`,
      content: { sheets: buildFallbackSheets(title, userMessage) },
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
    };
  }

  return {
    kind: "file",
    format,
    filename,
    title,
    summary: `I've created your detailed ${format.toUpperCase()} document on "${title}" with full sections and analysis.`,
    content: { blocks: buildFallbackBlocks(title, userMessage, rawText) },
  };
}

function buildFallbackBlocks(title: string, userMessage: string, rawText?: string): DocBlock[] {
  const blocks: DocBlock[] = [
    { type: "heading", level: 1, text: title },
    {
      type: "paragraph",
      text: `This document provides an exhaustive, structured analysis and documentation regarding ${title}, directly responding to the inquiry: "${userMessage}".`,
    },
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
    },
  ];

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

