/**
 * Client-side preview extraction for generated files.
 *
 * Unlike the legacy attachment bubble, the generated-file card needs to show
 * the ACTUAL content of the file that was produced. These helpers fetch the
 * stored file bytes and parse them in the browser so the card can render a
 * faithful miniature of the real document:
 *
 * - PDF      -> renders the first page to a canvas -> data URL image
 * - DOCX     -> mammoth converts the document to HTML
 * - XLSX     -> xlsx parses the workbook into sheet grids
 * - PPTX     -> jszip reads the slide XML into slide data
 * - CSV      -> plain text parsed into rows
 * - TXT/.md  -> plain text read directly
 *
 * Results are cached per (url + format) at module level so scrolling through
 * conversation history does not re-fetch and re-parse the same files.
 */

import { getDocumentProxy } from "unpdf";

export type SlidePreviewItem = {
  text: string;
  isTitle?: boolean;
  isBullet?: boolean;
};

export type SlidePreview = {
  slideNumber: number;
  title: string;
  items: SlidePreviewItem[];
};

export type SheetPreview = {
  name: string;
  data: unknown[][];
};

export type FilePreviewData =
  | { kind: "pdf"; pageImageUrl: string; pageCount: number }
  | { kind: "docx"; html: string }
  | { kind: "xlsx"; sheets: SheetPreview[] }
  | { kind: "pptx"; slides: SlidePreview[] }
  | { kind: "csv"; rows: string[][] }
  | { kind: "text"; text: string; isMarkdown: boolean }
  | { kind: "error"; message: string };

const previewCache = new Map<string, Promise<FilePreviewData>>();

/** Resolve the format from an explicit format hint, falling back to the extension. */
export function effectiveFormat(format?: string, filename?: string): string {
  if (format) return format.toLowerCase();
  const ext = filename?.split(".").pop()?.toLowerCase();
  if (!ext) return "txt";
  if (ext === "md" || ext === "markdown") return "markdown";
  if (ext === "doc" || ext === "docx") return "docx";
  if (ext === "xls" || ext === "xlsx") return "xlsx";
  if (ext === "ppt" || ext === "pptx") return "pptx";
  if (ext === "csv") return "csv";
  if (ext === "pdf") return "pdf";
  return "txt";
}

/** Fetch and parse a generated file into previewable data. */
export async function loadFilePreview(
  url: string,
  format?: string,
  filename?: string
): Promise<FilePreviewData> {
  const fmt = effectiveFormat(format, filename);
  const key = `${fmt}|${url}`;
  const cached = previewCache.get(key);
  if (cached) return cached;

  const promise = loadPreviewFor(url, fmt);
  previewCache.set(key, promise);
  promise.catch(() => {
    // Avoid caching hard failures forever; allow a later retry.
    if (previewCache.get(key) === promise) {
      previewCache.delete(key);
    }
  });

  return promise;
}

async function loadPreviewFor(
  url: string,
  format: string
): Promise<FilePreviewData> {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      return { kind: "error", message: "Could not load the generated file." };
    }

    switch (format) {
      case "pdf":
        return await loadPdfPreview(response);
      case "docx":
        return await loadDocxPreview(response);
      case "xlsx":
        return await loadXlsxPreview(response);
      case "pptx":
        return await loadPptxPreview(response);
      case "csv":
        return await loadCsvPreview(response);
      case "markdown":
        return await loadTextPreview(response, true);
      case "txt":
      default:
        return await loadTextPreview(response, false);
    }
  } catch {
    return { kind: "error", message: "Preview unavailable." };
  }
}

async function loadPdfPreview(response: Response): Promise<FilePreviewData> {
  const buffer = await response.arrayBuffer();
  const doc = await getDocumentProxy(new Uint8Array(buffer));
  const pageCount = doc.numPages ?? 1;

  const canvas = document.createElement("canvas");
  // pdf.js typing changes across versions; the drawer uses the same untyped shape.
  const page: any = await doc.getPage(1);
  const viewport = page.getViewport({ scale: 1.5 });
  canvas.width = Math.floor(viewport.width);
  canvas.height = Math.floor(viewport.height);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D context unavailable");
  await page.render({
    canvasContext: ctx,
    viewport,
    intent: "print",
  }).promise;

  return {
    kind: "pdf",
    pageImageUrl: canvas.toDataURL("image/png"),
    pageCount,
  };
}

async function loadDocxPreview(response: Response): Promise<FilePreviewData> {
  const buffer = await response.arrayBuffer();
  // @ts-expect-error - mammoth.browser.js is a UMD bundle without dedicated subpath typings
  const mammothModule = await import("mammoth/mammoth.browser.js");
  const mammoth = (mammothModule as any).default || mammothModule;
  const result = await mammoth.convertToHtml({ arrayBuffer: buffer });
  return { kind: "docx", html: result.value || "" };
}

async function loadXlsxPreview(response: Response): Promise<FilePreviewData> {
  const buffer = await response.arrayBuffer();
  const XLSX = await import("xlsx");
  const workbook = XLSX.read(buffer, { type: "array" });
  const sheets: SheetPreview[] = [];
  for (const name of workbook.SheetNames) {
    const worksheet = workbook.Sheets[name];
    const rows = XLSX.utils.sheet_to_json<unknown[]>(worksheet, {
      header: 1,
      defval: "",
      blankrows: false,
    });
    sheets.push({ name, data: rows });
  }
  return { kind: "xlsx", sheets };
}

async function loadPptxPreview(response: Response): Promise<FilePreviewData> {
  const buffer = await response.arrayBuffer();
  const JSZip = (await import("jszip")).default;
  const zip = await JSZip.loadAsync(buffer);
  const slideFileNames = Object.keys(zip.files)
    .filter(name => /^ppt\/slides\/slide\d+\.xml$/.test(name))
    .sort((a, b) => {
      const numA = parseInt(a.replace(/\D+/g, ""), 10);
      const numB = parseInt(b.replace(/\D+/g, ""), 10);
      return numA - numB;
    });

  const slides: SlidePreview[] = [];
  for (let i = 0; i < slideFileNames.length; i++) {
    const xml = await zip.files[slideFileNames[i]].async("string");
    const pRegex = /<a:p\b[^>]*>([\s\S]*?)<\/a:p>/g;
    const items: SlidePreviewItem[] = [];
    let slideTitle = "";
    let pMatch: RegExpExecArray | null;
    while ((pMatch = pRegex.exec(xml))) {
      const pContent = pMatch[1];
      const tRegex = /<(?:a:t|a:fld)[^>]*>([^<]*)<\/(?:a:t|a:fld)>/g;
      const textParts: string[] = [];
      let tMatch: RegExpExecArray | null;
      while ((tMatch = tRegex.exec(pContent))) {
        const val = tMatch[1].trim();
        if (val) textParts.push(val);
      }
      const fullText = textParts.join(" ").trim();
      if (fullText) {
        if (!slideTitle) {
          slideTitle = fullText;
          items.push({ text: fullText, isTitle: true });
        } else {
          items.push({ text: fullText, isBullet: true });
        }
      }
    }
    slides.push({
      slideNumber: i + 1,
      title: slideTitle || `Slide ${i + 1}`,
      items:
        items.length > 0 ? items : [{ text: `Slide ${i + 1}`, isTitle: true }],
    });
  }

  return { kind: "pptx", slides };
}

async function loadCsvPreview(response: Response): Promise<FilePreviewData> {
  const text = await response.text();
  return { kind: "csv", rows: parseCsv(text) };
}

async function loadTextPreview(
  response: Response,
  isMarkdown: boolean
): Promise<FilePreviewData> {
  const text = await response.text();
  return { kind: "text", text, isMarkdown };
}

/** Parses CSV text into rows, honoring double-quote quoting. */
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      row.push(field);
      field = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i += 1;
      row.push(field);
      field = "";
      if (row.some(cell => cell.trim() !== "")) rows.push(row);
      row = [];
    } else {
      field += ch;
    }
  }
  row.push(field);
  if (row.some(cell => cell.trim() !== "")) rows.push(row);
  return rows;
}
