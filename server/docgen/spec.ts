// The DocumentSpec is the structured, format-independent representation of a
// generated document. The AI produces a DocumentSpec (or the deterministic
// builder constructs one from a request), and the generators translate it into
// a real .docx / .xlsx / .pptx / .pdf / .csv / .txt / .md file.

export type DocFormat =
  | "pdf"
  | "docx"
  | "xlsx"
  | "pptx"
  | "csv"
  | "txt"
  | "md";

export type DocParagraph = {
  type: "paragraph";
  text: string;
  bold?: boolean;
  italic?: boolean;
  size?: number;
  color?: string;
  link?: string;
  alignment?: "left" | "center" | "right" | "justify";
};

export type DocHeading = {
  type: "heading";
  text: string;
  level: 1 | 2 | 3;
};

export type DocBulletList = {
  type: "bulletList";
  items: string[];
};

export type DocNumberedList = {
  type: "numberedList";
  items: string[];
};

export type DocTable = {
  type: "table";
  headers?: string[];
  rows: string[][];
};

export type DocPageBreak = {
  type: "pageBreak";
};

export type DocImage = {
  type: "image";
  // Not directly supported by the LLM text pipeline; reserved for future use.
  src: string;
};

export type DocBlock =
  | DocParagraph
  | DocHeading
  | DocBulletList
  | DocNumberedList
  | DocTable
  | DocPageBreak
  | DocImage;

// Spreadsheet-oriented spec: used when format is xlsx.
export type SheetCell = string | number | boolean | null | { formula?: string; value?: string | number | boolean | null };
export type SheetDefinition = {
  name: string;
  rows: SheetCell[][];
  /** Optional table headers applied to the leading row(s). */
  table?: boolean;
};

// Slide-oriented spec: used when format is pptx.
export type SlideDefinition = {
  title?: string;
  subtitle?: string;
  bullets?: string[];
  table?: { headers?: string[]; rows: string[][] };
  footnote?: string;
};

export type DocumentSpec = {
  format: DocFormat;
  filename: string;
  title: string;
  // For docx/pdf/txt/md: a linear list of content blocks.
  blocks?: DocBlock[];
  // For xlsx: one or more sheets.
  sheets?: SheetDefinition[];
  // For pptx: one or more slides.
  slides?: SlideDefinition[];
  // Optional orienting description shown as the AI's chat reply.
  summary?: string;
};

export const DOC_FORMATS: DocFormat[] = [
  "pdf",
  "docx",
  "xlsx",
  "pptx",
  "csv",
  "txt",
  "md",
];

export const FORMAT_LABELS: Record<DocFormat, string> = {
  pdf: "PDF",
  docx: "Word document",
  xlsx: "Excel spreadsheet",
  pptx: "PowerPoint presentation",
  csv: "CSV file",
  txt: "Text file",
  md: "Markdown file",
};

export const FORMAT_EXTENSIONS: Record<DocFormat, string> = {
  pdf: "pdf",
  docx: "docx",
  xlsx: "xlsx",
  pptx: "pptx",
  csv: "csv",
  txt: "txt",
  md: "md",
};

export const FORMAT_MIME: Record<DocFormat, string> = {
  pdf: "application/pdf",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  csv: "text/csv",
  txt: "text/plain",
  md: "text/markdown",
};

export const DEFAULT_SUMMARY: Record<DocFormat, string> = {
  pdf: "I created the requested PDF document.",
  docx: "I created the requested Word document.",
  xlsx: "I created the requested Excel spreadsheet.",
  pptx: "I created the requested PowerPoint presentation.",
  csv: "I created the requested CSV file.",
  txt: "I created the requested text file.",
  md: "I created the requested Markdown file.",
};

export function sanitizeFilename(format: DocFormat, requested?: string): string {
  const ext = FORMAT_EXTENSIONS[format];
  const slug = (requested ?? "document")
    .replace(/\.\w+$/, "")
    .replace(/[^a-zA-Z0-9._ -]/g, "-")
    .replace(/\s+/g, "_")
    .replace(/-+/g, "-")
    .replace(/_+/g, "_")
    .replace(/^[-_]+|[-_]+$/g, "")
    .slice(0, 120);
  const base = slug || "document";
  return `${base}.${ext}`;
}

// --- Light-weight coercion/validation for AI-produced documents -----------
// The LLM returns `unknown[]`; these guard the deterministic generators so a
// malformed block can never crash generation.

function asStr(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

export function coerceBlocks(value: unknown): DocBlock[] {
  if (!Array.isArray(value)) return [];
  const out: DocBlock[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object") continue;
    const b = item as Record<string, unknown>;
    switch (b.type) {
      case "heading":
        out.push({
          type: "heading",
          text: asStr(b.text),
          level: (b.level as number) === 1 ? 1 : (b.level as number) === 3 ? 3 : 2,
        });
        break;
      case "paragraph":
        out.push({
          type: "paragraph",
          text: asStr(b.text),
          bold: Boolean(b.bold),
          italic: Boolean(b.italic),
          size: typeof b.size === "number" ? b.size : undefined,
          alignment:
            b.alignment === "center" || b.alignment === "right" || b.alignment === "justify"
              ? (b.alignment as "center" | "right" | "justify")
              : undefined,
        });
        break;
      case "bulletList":
        out.push({
          type: "bulletList",
          items: Array.isArray(b.items) ? b.items.map(i => asStr(i)).filter(Boolean) : [],
        });
        break;
      case "numberedList":
        out.push({
          type: "numberedList",
          items: Array.isArray(b.items) ? b.items.map(i => asStr(i)).filter(Boolean) : [],
        });
        break;
      case "table":
        out.push({
          type: "table",
          headers: Array.isArray(b.headers) ? b.headers.map(h => asStr(h)).filter(Boolean) : undefined,
          rows: Array.isArray(b.rows)
            ? b.rows
                .filter(r => Array.isArray(r))
                .map(r => (r as unknown[]).map(c => asStr(c)))
            : [],
        });
        break;
      case "pageBreak":
        out.push({ type: "pageBreak" });
        break;
      default:
        break;
    }
  }
  return out;
}

export function coerceSheets(value: unknown): SheetDefinition[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter(v => v && typeof v === "object")
    .map(v => {
      const s = v as Record<string, unknown>;
      return {
        name: asStr(s.name, "Sheet"),
        table: Boolean(s.table),
        rows: Array.isArray(s.rows)
          ? s.rows
              .filter(r => Array.isArray(r))
              .map(r => (r as unknown[]).map(cell => {
                if (cell === null || cell === undefined || typeof cell === "string" || typeof cell === "number" || typeof cell === "boolean")
                  return cell as SheetCell;
                return asStr(cell);
              }))
          : [],
      };
    });
}

export function coerceSlides(value: unknown): SlideDefinition[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter(v => v && typeof v === "object")
    .map(v => {
      const s = v as Record<string, unknown>;
      const tableRaw = s.table as Record<string, unknown> | undefined;
      return {
        title: asStr(s.title),
        subtitle: asStr(s.subtitle),
        bullets: Array.isArray(s.bullets) ? s.bullets.map(b => asStr(b)).filter(Boolean) : undefined,
        table:
          tableRaw && Array.isArray(tableRaw.rows)
            ? {
                headers: Array.isArray(tableRaw.headers)
                  ? tableRaw.headers.map(h => asStr(h)).filter(Boolean)
                  : undefined,
                rows: (tableRaw.rows as unknown[])
                  .filter(r => Array.isArray(r))
                  .map(r => (r as unknown[]).map(c => asStr(c))),
              }
            : undefined,
        footnote: asStr(s.footnote),
      };
    });
}
