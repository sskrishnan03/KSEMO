// The DocumentSpec is the structured, format-independent representation of a
// generated document. The AI produces a DocumentSpec (or the deterministic
// builder constructs one from a request), and the generators translate it into
// a real .docx / .xlsx / .pptx / .pdf / .txt file.

export type DocFormat =
  | "pdf"
  | "docx"
  | "xlsx"
  | "pptx"
  | "txt";

export type DocumentTheme =
  | "modern"
  | "technical"
  | "business"
  | "editorial"
  | "scientific";

export type ThemeColors = {
  primary: string;
  secondary: string;
  accent: string;
  surface: string;
  border: string;
  text: string;
  muted: string;
};

export const THEME_PALETTES: Record<DocumentTheme, ThemeColors> = {
  modern: {
    primary: "1E293B",     // slate-800
    secondary: "475569",   // slate-600
    accent: "2563EB",      // royal blue
    surface: "F8FAFC",     // slate-50
    border: "E2E8F0",      // slate-200
    text: "0F172A",        // slate-900
    muted: "64748B",       // slate-500
  },
  technical: {
    primary: "0F172A",     // dark indigo slate
    secondary: "334155",
    accent: "0284C7",      // sky-600
    surface: "F0F9FF",     // sky-50
    border: "BAE6FD",
    text: "0C4A6E",
    muted: "64748B",
  },
  business: {
    primary: "1E3A8A",     // deep navy
    secondary: "1E40AF",
    accent: "059669",      // emerald
    surface: "F8FAFC",
    border: "CBD5E1",
    text: "0F172A",
    muted: "64748B",
  },
  editorial: {
    primary: "292524",     // warm stone
    secondary: "44403C",
    accent: "D97706",      // amber
    surface: "FAFAF9",
    border: "E7E5E4",
    text: "1C1917",
    muted: "78716C",
  },
  scientific: {
    primary: "115E59",     // teal
    secondary: "0F766E",
    accent: "0D9488",
    surface: "F0FDFA",
    border: "99F6E4",
    text: "134E4A",
    muted: "64748B",
  },
};

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

// Rich semantic components supporting high-density, professional publications
export type DocCallout = {
  type: "callout";
  variant?: "info" | "warning" | "tip" | "takeaway" | "quote";
  title?: string;
  text: string;
};

export type DocStatItem = {
  value: string;
  label: string;
  change?: string;
  note?: string;
};

export type DocStatGrid = {
  type: "statGrid";
  items?: DocStatItem[];
  metrics?: DocStatItem[];
};

export type DocProcessStep = {
  step: number;
  title: string;
  description: string;
};

export type DocProcessFlow = {
  type: "processFlow";
  steps: DocProcessStep[];
};

export type DocComparison = {
  type: "comparison";
  headers?: [string, string] | string[];
  columns?: string[];
  rows: Array<
    | {
        feature: string;
        valA: string;
        valB: string;
        notes?: string;
      }
    | string[]
  >;
};

export type DocQuote = {
  type: "quote";
  text: string;
  author?: string;
  role?: string;
};

export type DocCodeBlock = {
  type: "codeBlock";
  language?: string;
  code: string;
};

export type DocBlock =
  | DocParagraph
  | DocHeading
  | DocBulletList
  | DocNumberedList
  | DocTable
  | DocPageBreak
  | DocImage
  | DocCallout
  | DocStatGrid
  | DocProcessFlow
  | DocComparison
  | DocQuote
  | DocCodeBlock;

// Spreadsheet-oriented spec: used when format is xlsx.
export type SheetCell =
  | string
  | number
  | boolean
  | null
  | { formula?: string; value?: string | number | boolean | null; format?: "currency" | "percent" | "number" | "text" };

export type SheetDefinition = {
  name: string;
  rows: SheetCell[][];
  /** Optional table headers applied to the leading row(s). */
  table?: boolean;
  /** Optional indicator that the bottom row represents summary/totals */
  hasTotals?: boolean;
};

// Slide-oriented spec: used when format is pptx.
export type SlideLayout =
  | "title"
  | "section"
  | "key_message"
  | "big_number"
  | "two_column"
  | "three_column"
  | "process"
  | "comparison"
  | "table"
  | "stats"
  | "quote";

export type SlideColumn = {
  title?: string;
  text?: string;
  bullets?: string[];
};

export type SlideDefinition = {
  title?: string;
  subtitle?: string;
  layout?: SlideLayout;
  bullets?: string[];
  columns?: SlideColumn[];
  metrics?: Array<{ value: string; label: string; change?: string }>;
  steps?: Array<{ step: number; title: string; description: string }>;
  quote?: { text: string; author?: string };
  keyMessage?: { statement: string; context?: string };
  table?: { headers?: string[]; rows: string[][] };
  footnote?: string;
};

export type SourceReference = {
  title: string;
  url: string;
  publisher?: string;
};

export type DocumentSpec = {
  format: DocFormat;
  filename: string;
  title: string;
  theme?: DocumentTheme;
  // For docx/pdf/txt: a linear list of content blocks.
  blocks?: DocBlock[];
  // For xlsx: one or more sheets.
  sheets?: SheetDefinition[];
  // For pptx: one or more slides.
  slides?: SlideDefinition[];
  // Optional orienting description shown as the AI's chat reply.
  summary?: string;
  // Web sources used to research and ground the document content.
  sources?: SourceReference[];
};

export const DOC_FORMATS: DocFormat[] = [
  "pdf",
  "docx",
  "xlsx",
  "pptx",
  "txt",
];

export const FORMAT_LABELS: Record<DocFormat, string> = {
  pdf: "PDF",
  docx: "Word document",
  xlsx: "Excel spreadsheet",
  pptx: "PowerPoint presentation",
  txt: "Text file",
};

export const FORMAT_EXTENSIONS: Record<DocFormat, string> = {
  pdf: "pdf",
  docx: "docx",
  xlsx: "xlsx",
  pptx: "pptx",
  txt: "txt",
};

export const FORMAT_MIME: Record<DocFormat, string> = {
  pdf: "application/pdf",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  txt: "text/plain",
};

export const DEFAULT_SUMMARY: Record<DocFormat, string> = {
  pdf: "I created the requested PDF document.",
  docx: "I created the requested Word document.",
  xlsx: "I created the requested Excel spreadsheet.",
  pptx: "I created the requested PowerPoint presentation.",
  txt: "I created the requested text file.",
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
      case "callout":
        out.push({
          type: "callout",
          variant: ["info", "warning", "tip", "takeaway", "quote"].includes(String(b.variant))
            ? (b.variant as DocCallout["variant"])
            : "info",
          title: b.title ? asStr(b.title) : undefined,
          text: asStr(b.text),
        });
        break;
      case "statGrid":
        if (Array.isArray(b.items)) {
          const items: DocStatItem[] = b.items
            .filter(it => it && typeof it === "object")
            .map(it => {
              const obj = it as Record<string, unknown>;
              return {
                value: asStr(obj.value),
                label: asStr(obj.label),
                change: obj.change ? asStr(obj.change) : undefined,
                note: obj.note ? asStr(obj.note) : undefined,
              };
            })
            .filter(it => it.value || it.label);
          if (items.length > 0) {
            out.push({ type: "statGrid", items });
          }
        }
        break;
      case "processFlow":
        if (Array.isArray(b.steps)) {
          const steps: DocProcessStep[] = b.steps
            .filter(s => s && typeof s === "object")
            .map((s, idx) => {
              const obj = s as Record<string, unknown>;
              return {
                step: typeof obj.step === "number" ? obj.step : idx + 1,
                title: asStr(obj.title),
                description: asStr(obj.description),
              };
            })
            .filter(s => s.title || s.description);
          if (steps.length > 0) {
            out.push({ type: "processFlow", steps });
          }
        }
        break;
      case "comparison":
        if (Array.isArray(b.rows)) {
          out.push({
            type: "comparison",
            headers: Array.isArray(b.headers) ? b.headers.map(h => asStr(h)) : ["Feature / Metric", "Option A", "Option B"],
            rows: (b.rows as unknown[])
              .filter(r => r && typeof r === "object")
              .map(r => {
                const obj = r as Record<string, unknown>;
                return {
                  feature: asStr(obj.feature),
                  valA: asStr(obj.valA),
                  valB: asStr(obj.valB),
                  notes: obj.notes ? asStr(obj.notes) : undefined,
                };
              }),
          });
        }
        break;
      case "quote":
        out.push({
          type: "quote",
          text: asStr(b.text),
          author: b.author ? asStr(b.author) : undefined,
          role: b.role ? asStr(b.role) : undefined,
        });
        break;
      case "codeBlock":
        out.push({
          type: "codeBlock",
          language: b.language ? asStr(b.language) : undefined,
          code: asStr(b.code),
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
        hasTotals: Boolean(s.hasTotals),
        rows: Array.isArray(s.rows)
          ? s.rows
              .filter(r => Array.isArray(r))
              .map(r => (r as unknown[]).map(cell => {
                if (cell === null || cell === undefined || typeof cell === "string" || typeof cell === "number" || typeof cell === "boolean")
                  return cell as SheetCell;
                if (typeof cell === "object") {
                  const cObj = cell as Record<string, unknown>;
                  if (cObj.formula || cObj.value !== undefined) {
                    return {
                      formula: cObj.formula ? asStr(cObj.formula) : undefined,
                      value: (typeof cObj.value === "string" || typeof cObj.value === "number" || typeof cObj.value === "boolean")
                        ? cObj.value
                        : undefined,
                      format: ["currency", "percent", "number", "text"].includes(String(cObj.format))
                        ? (cObj.format as "currency" | "percent" | "number" | "text")
                        : undefined,
                    } as SheetCell;
                  }
                }
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
      const metricsRaw = Array.isArray(s.metrics)
        ? s.metrics
            .filter(m => m && typeof m === "object")
            .map(m => {
              const obj = m as Record<string, unknown>;
              return {
                value: asStr(obj.value),
                label: asStr(obj.label),
                change: obj.change ? asStr(obj.change) : undefined,
              };
            })
        : undefined;

      const columnsRaw = Array.isArray(s.columns)
        ? s.columns
            .filter(c => c && typeof c === "object")
            .map(c => {
              const obj = c as Record<string, unknown>;
              return {
                title: obj.title ? asStr(obj.title) : undefined,
                text: obj.text ? asStr(obj.text) : undefined,
                bullets: Array.isArray(obj.bullets) ? obj.bullets.map(b => asStr(b)).filter(Boolean) : undefined,
              };
            })
        : undefined;

      const stepsRaw = Array.isArray(s.steps)
        ? s.steps
            .filter(st => st && typeof st === "object")
            .map((st, i) => {
              const obj = st as Record<string, unknown>;
              return {
                step: typeof obj.step === "number" ? obj.step : i + 1,
                title: asStr(obj.title),
                description: asStr(obj.description),
              };
            })
        : undefined;

      const validLayouts: SlideLayout[] = [
        "title",
        "section",
        "key_message",
        "big_number",
        "two_column",
        "three_column",
        "process",
        "comparison",
        "table",
        "stats",
        "quote",
      ];

      return {
        title: asStr(s.title),
        subtitle: s.subtitle ? asStr(s.subtitle) : undefined,
        layout: validLayouts.includes(s.layout as SlideLayout) ? (s.layout as SlideLayout) : undefined,
        bullets: Array.isArray(s.bullets) ? s.bullets.map(b => asStr(b)).filter(Boolean) : undefined,
        columns: columnsRaw,
        metrics: metricsRaw,
        steps: stepsRaw,
        quote: s.quote && typeof s.quote === "object"
          ? { text: asStr((s.quote as Record<string, unknown>).text), author: (s.quote as Record<string, unknown>).author ? asStr((s.quote as Record<string, unknown>).author) : undefined }
          : undefined,
        keyMessage: s.keyMessage && typeof s.keyMessage === "object"
          ? { statement: asStr((s.keyMessage as Record<string, unknown>).statement), context: (s.keyMessage as Record<string, unknown>).context ? asStr((s.keyMessage as Record<string, unknown>).context) : undefined }
          : undefined,
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
        footnote: s.footnote ? asStr(s.footnote) : undefined,
      };
    });
}
