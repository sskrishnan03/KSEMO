// AI-driven document planning. Given the user's latest message (plus chat
// context), this asks the LLM to decide whether a file should be generated and,
// if so, to produce the structured content that the deterministic generators
// will turn into a real file. It keeps "format when not specified" behaviour
// sane by choosing a sensible default and advertising alternatives.

import { invokeLLM, type Message } from "../_core/llm";
import type { DocFormat } from "./spec";

export type DocumentPlan =
  | {
      kind: "file";
      format: "pdf" | "docx" | "xlsx" | "pptx" | "csv" | "txt" | "md";
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
budget, spreadsheet, presentation, notes, table, CSV, plain text, markdown, etc.).

Available output formats and their codes:
- pdf  -> a styled PDF document
- docx -> an editable Microsoft Word document
- xlsx -> an Excel spreadsheet (use the "sheets" structure)
- pptx -> a PowerPoint presentation (use the "slides" structure)
- csv  -> a comma-separated values file (use a table)
- txt  -> a plain text file
- md   -> a Markdown file

Return a JSON object (no markdown fences). Schema:
{
  "createFile": true|false,
  "format": "pdf"|"docx"|"xlsx"|"pptx"|"csv"|"txt"|"md",
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
  heading and appropriate section headings, paragraphs, and lists. Use markdown
  (**bold** and *emphasis*) sparingly inside paragraph text if helpful.
- content.sheets is a JSON array (for xlsx):
    {"name":"SheetName","rows":[[cell...],[cell...]],"table":true}
  where each cell is a string, number, boolean, or null.
- content.slides is a JSON array (for pptx):
    {"title":"Slide heading","bullets":["...","..."],"table":{"headers":["A"],"rows":[["..."]]},"footnote":"..."}
  The first slide is treated as a title slide (title + subtitle + bullets).

Number of blocks/slides: be generous and thorough. For a "10 page report" or
"detailed presentation", produce enough content to fill it (many headings,
paragraphs, list items; for pptx produce ~10 slides).
`;

// The invocation uses the generic OpenAI-compatible invokeLLM with a JSON
// response_format so the model returns only structured JSON we can parse.
export async function planDocument(
  userMessage: string,
  history: Message[],
  forcedFormat?: Extract<DocumentPlan, { kind: "file" }>["format"] | null
): Promise<DocumentPlan> {
  const forced = normalizeFormat(forcedFormat);
  const formatLine = forced
    ? `\nIMPORTANT: The user explicitly chose ${forced.toUpperCase()}. Force createFile=true and use format="${forced}". Ignore any other format hints.`
    : "";
  const systemContent = FORMAT_INSTRUCTIONS + formatLine;
  const userContent = `User's latest message:\n${userMessage}\n\nProduce the JSON plan now.`;

  try {
    const result = await invokeLLM({
      model: "gemini-flash-lite-latest",
      messages: [
        { role: "system", content: systemContent },
        ...history.slice(-8),
        { role: "user", content: userContent },
      ],
      responseFormat: { type: "json_object" },
      maxTokens: 4096,
    });
    const raw = result.choices?.[0]?.message?.content;
    const text = Array.isArray(raw) ? raw.map(p => (typeof p === "object" ? (p as { text?: string }).text ?? "" : String(p))).join("") : String(raw ?? "");
    const parsed = parsePlanJson(text);
    if (!parsed) return { kind: "none" };
    // When a format was forced, honour it even if the model chose otherwise.
    if (forced) {
      return buildPlanFromParsed(parsed, forced, userMessage);
    }
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
  return {
    kind: "file",
    format,
    filename: String(parsed.filename ?? sanitizeTitle(userMessage)).slice(0, 120),
    title: String(parsed.title ?? "Document").slice(0, 160),
    summary: String(
      parsed.summary ?? `I created the requested ${format.toUpperCase()} file.`
    ),
    content: Array.isArray(parsed.content)
      ? { blocks: parsed.content }
      : {
          blocks: Array.isArray(parsed.content?.blocks) ? parsed.content.blocks : undefined,
          sheets: Array.isArray(parsed.content?.sheets) ? parsed.content.sheets : undefined,
          slides: Array.isArray(parsed.content?.slides) ? parsed.content.slides : undefined,
        },
  };
}

function sanitizeTitle(message: string): string {
  const cleaned = message
    .replace(/[^a-zA-Z0-9 _-]/g, "")
    .trim()
    .split(/\s+/)
    .slice(0, 5)
    .join("_");
  return cleaned || "document";
}

function normalizeFormat(value: unknown): DocFormat | null {
  const v = String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/^\./, "");
  const valid: DocFormat[] = ["pdf", "docx", "xlsx", "pptx", "csv", "txt", "md"];
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
    // Try to salvage an object if there's a leading/trailing wrapper text.
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
