// Lightweight text extraction for Library uploads. Best-effort: any failure
// returns null and the file is still saved (it just won't be chat-searchable).
// Supported: PDF, DOCX, XLSX/XLS/CSV, PPTX, plain text/markdown/json/etc.

import jszip from "jszip";
import fs from "fs";
import { resolveStoragePath } from "./storage";
import { inMemoryStore } from "./inMemoryStore";

export const MAX_EXTRACT_CHARS = 200_000;

const TEXT_EXTENSIONS = new Set([
  "txt",
  "tsv",
  "json",
  "log",
  "xml",
  "yml",
  "yaml",
  "html",
  "htm",
  "md",
  "markdown",
  "css",
  "scss",
  "sass",
  "less",
  "js",
  "jsx",
  "mjs",
  "cjs",
  "ts",
  "tsx",
  "py",
  "java",
  "c",
  "cpp",
  "h",
  "hpp",
  "cs",
  "rb",
  "go",
  "rs",
  "php",
  "sql",
  "sh",
  "bat",
  "ps1",
  "env",
  "ini",
  "toml",
  "conf",
  "dockerfile",
  "makefile",
  "r",
  "swift",
  "kt",
]);

const AUDIO_EXTENSIONS = new Set([
  "mp3",
  "wav",
  "m4a",
  "ogg",
  "webm",
  "aac",
  "flac",
]);

export function extensionOf(filename: string): string {
  const match = /\.([a-zA-Z0-9]+)$/.exec(filename.trim());
  return match ? match[1].toLowerCase() : "";
}

function cap(text: string): string {
  const normalized = text.replace(/\r\n/g, "\n").replace(/\u0000/g, "");
  return normalized.length > MAX_EXTRACT_CHARS
    ? `${normalized.slice(0, MAX_EXTRACT_CHARS)}\n…[truncated]`
    : normalized;
}

async function extractPdf(buffer: Buffer): Promise<string | null> {
  const { extractText, getDocumentProxy } = await import("unpdf");
  const pdf = await getDocumentProxy(new Uint8Array(buffer));
  const { text, totalPages } = await extractText(pdf, { mergePages: false });
  const pages = Array.isArray(text) ? text : [text];
  const numPages = totalPages || pdf.numPages || pages.length;
  const parts: string[] = [];
  for (let i = 0; i < pages.length; i++) {
    const pageText = (pages[i] || "").trim();
    if (pageText) {
      parts.push(`--- Page ${i + 1} of ${numPages} ---\n${pageText}`);
    } else {
      parts.push(`--- Page ${i + 1} of ${numPages} ---\n[Empty or image-only page]`);
    }
  }
  return parts.join("\n\n");
}

async function extractDocx(buffer: Buffer): Promise<string | null> {
  const mammoth = await import("mammoth");
  const result = await mammoth.extractRawText({ buffer });
  return result.value;
}

async function extractSheet(buffer: Buffer): Promise<string | null> {
  const XLSX = await import("xlsx");
  const workbook = XLSX.read(buffer, { type: "buffer" });
  const parts: string[] = [];
  for (const name of workbook.SheetNames.slice(0, 20)) {
    const sheet = workbook.Sheets[name];
    if (!sheet) continue;
    const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
      header: 1,
      raw: false,
      defval: "",
    });
    if (!rows || rows.length === 0) continue;
    parts.push(`## Sheet: ${name} (${rows.length} rows)`);

    const firstFew = rows.slice(0, 10);
    const maxCols = Math.min(
      Math.max(...firstFew.map(r => (Array.isArray(r) ? r.length : 0)), 1),
      50
    );

    const headers = Array.from({ length: maxCols }, (_, idx) => {
      const val = Array.isArray(rows[0]) ? rows[0][idx] : undefined;
      const str = String(val ?? "").replace(/[\r\n|]/g, " ").trim();
      return str || `Col_${idx + 1}`;
    });

    parts.push(`| ${headers.join(" | ")} |`);
    parts.push(`| ${headers.map(() => "---").join(" | ")} |`);

    for (let rIdx = 1; rIdx < Math.min(rows.length, 1000); rIdx++) {
      const row = Array.isArray(rows[rIdx]) ? rows[rIdx] : [];
      const cells = headers.map((_, cIdx) => {
        const val = row[cIdx];
        return String(val ?? "").replace(/[\r\n|]/g, " ").trim();
      });
      if (cells.some(c => c.length > 0)) {
        parts.push(`| ${cells.join(" | ")} |`);
      }
    }
    if (rows.length > 1000) {
      parts.push(`... [Truncated ${rows.length - 1000} additional rows]`);
    }
  }
  return parts.join("\n\n");
}

async function extractPptx(buffer: Buffer): Promise<string | null> {
  const zip = await jszip.loadAsync(buffer);
  const slideNames = Object.keys(zip.files)
    .filter(name => /^ppt\/slides\/slide\d+\.xml$/.test(name))
    .sort(
      (a, b) =>
        parseInt(a.replace(/\D+/g, ""), 10) -
        parseInt(b.replace(/\D+/g, ""), 10)
    );
  const parts: string[] = [];
  let slideNumber = 0;
  for (const name of slideNames) {
    slideNumber += 1;
    const xml = await zip.files[name].async("string");
    const texts: string[] = [];
    const pattern = /<(?:a:t|a:fld)[^>]*>([^<]*)<\/(?:a:t|a:fld)>/g;
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(xml))) {
      const value = match[1].trim();
      if (value) texts.push(value);
    }
    if (texts.length)
      parts.push(`## Slide ${slideNumber}\n${texts.join("\n")}`);
  }
  return parts.join("\n\n");
}

async function extractAudio(buffer: Buffer, mimeType: string): Promise<string | null> {
  try {
    const { transcribeAudio } = await import("./_core/voiceTranscription");
    const result = await transcribeAudio({
      audio: buffer,
      mimeType: mimeType || "audio/mp3",
    });
    if (result && "text" in result && result.text) {
      return `## Audio Transcription\n${result.text}`;
    }
    return null;
  } catch (err) {
    console.warn("[fileExtract] audio transcription error:", err);
    return null;
  }
}

function extractPlain(buffer: Buffer): string | null {
  // Reject obvious binary payloads before decoding.
  const sample = buffer.subarray(0, Math.min(buffer.length, 4_096));
  let suspicious = 0;
  for (let index = 0; index < sample.length; index += 1) {
    const byte = sample[index];
    if (byte === 0 || (byte < 9 && byte !== 0) || (byte > 13 && byte < 32))
      suspicious += 1;
  }
  if (suspicious / Math.max(sample.length, 1) > 0.02) return null;
  return buffer.toString("utf8");
}

export async function extractFileText(
  filename: string,
  mimeType: string,
  buffer: Buffer
): Promise<string | null> {
  try {
    const ext = extensionOf(filename);
    let text: string | null = null;

    if (ext === "pdf" || mimeType === "application/pdf") {
      text = await extractPdf(buffer);
    } else if (ext === "docx") {
      text = await extractDocx(buffer);
    } else if (
      ext === "xlsx" ||
      ext === "xls" ||
      ext === "csv" ||
      ext === "tsv"
    ) {
      text = await extractSheet(buffer);
    } else if (ext === "pptx") {
      text = await extractPptx(buffer);
    } else if (AUDIO_EXTENSIONS.has(ext) || mimeType.startsWith("audio/")) {
      text = await extractAudio(buffer, mimeType);
    } else if (TEXT_EXTENSIONS.has(ext) || mimeType.startsWith("text/")) {
      text = extractPlain(buffer);
    }

    if (!text) return null;
    const trimmed = cap(text);
    return trimmed.trim().length ? trimmed : null;
  } catch (error) {
    console.warn(
      `[fileExtract] extraction failed for "${filename}":`,
      error instanceof Error ? error.message : error
    );
    return null;
  }
}

export async function ensureExtractedContent(file: {
  id: string | number;
  filename: string;
  mimeType: string;
  storageKey: string;
  contentText?: string | null;
}): Promise<string | null> {
  if (file.contentText && file.contentText.trim().length > 0) {
    return file.contentText;
  }
  try {
    const absolutePath = resolveStoragePath(file.storageKey);
    const exists = await fs.promises
      .stat(absolutePath)
      .then(() => true)
      .catch(() => false);
    if (!exists) return null;

    const buffer = await fs.promises.readFile(absolutePath);
    const text = await extractFileText(file.filename, file.mimeType, buffer);
    if (text) {
      inMemoryStore.updateFile(String(file.id), { contentText: text });
    }
    return text;
  } catch (error) {
    console.warn(
      `[fileExtract] ensureExtractedContent failed for ${file.filename}:`,
      error
    );
    return null;
  }
}
