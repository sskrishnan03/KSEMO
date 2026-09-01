// Lightweight text extraction for Library uploads. Best-effort: any failure
// returns null and the file is still saved (it just won't be chat-searchable).
// Supported: PDF, DOCX, XLSX/XLS/CSV, PPTX, plain text/markdown/json/etc.

import jszip from "jszip";

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
  const { text } = await extractText(pdf, { mergePages: true });
  return Array.isArray(text) ? text.join("\n\n") : text;
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
    parts.push(`## Sheet: ${name}`);
    for (const row of rows.slice(0, 2_000)) {
      const line = (row as unknown[])
        .map(cell => String(cell ?? ""))
        .join("\t")
        .replace(/\t+/g, "\t")
        .trim();
      if (line) parts.push(line);
    }
  }
  return parts.join("\n");
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
      ext === "tsv"
    ) {
      text = await extractSheet(buffer);
    } else if (ext === "pptx") {
      text = await extractPptx(buffer);
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
