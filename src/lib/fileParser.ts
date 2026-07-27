import * as pdfjsLib from 'pdfjs-dist';
import * as XLSX from 'xlsx';

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.mjs',
  import.meta.url,
).toString();

export interface ParsedFile {
  text: string;
  imageDataUrl?: string;
  mimeType: string;
  fileName: string;
}

export function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
}

function dataUrlToText(dataUrl: string): string {
  const base64 = dataUrl.split(',')[1] || '';
  return decodeURIComponent(
    atob(base64)
      .split('')
      .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
      .join('')
  );
}

function getExt(fileName: string): string {
  return fileName.split('.').pop()?.toLowerCase() || '';
}

const TEXT_EXTS = new Set([
  'txt','md','json','csv','js','jsx','ts','tsx','py','html','css','go','rs','cpp','sh',
  'xml','yaml','yml','toml','sql','rb','java','c','h','hpp','vue','svelte','env','log',
  'ini','cfg','conf','markdown','tex','rtf','tsv','prisma','graphql','astro','mdx',
]);

const IMAGE_TYPES = new Set(['image/png','image/jpeg','image/gif','image/webp','image/svg+xml','image/bmp']);
const IMAGE_EXTS = new Set(['png','jpg','jpeg','gif','webp','svg','bmp','ico','tiff']);

export function isTextFile(fileName: string, mimeType: string): boolean {
  if (mimeType.startsWith('text/')) return true;
  if (mimeType === 'application/json' || mimeType === 'application/javascript' || mimeType === 'application/typescript') return true;
  return TEXT_EXTS.has(getExt(fileName));
}

export function isImageFile(fileName: string, mimeType: string): boolean {
  if (IMAGE_TYPES.has(mimeType)) return true;
  return IMAGE_EXTS.has(getExt(fileName));
}

export function isPdfFile(fileName: string, mimeType: string): boolean {
  return getExt(fileName) === 'pdf' || mimeType === 'application/pdf';
}

export function isExcelFile(fileName: string, mimeType: string): boolean {
  const ext = getExt(fileName);
  return ['xlsx','xls','xlsm','xlsb','csv','tsv'].includes(ext) ||
    mimeType.includes('spreadsheet') || mimeType.includes('excel') ||
    mimeType === 'text/csv';
}

async function extractPdfText(dataUrl: string): Promise<string> {
  try {
    const raw = atob(dataUrl.split(',')[1] || '');
    const bytes = new Uint8Array(raw.length);
    for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);

    const doc = await pdfjsLib.getDocument({ data: bytes }).promise;
    const maxPages = Math.min(doc.numPages, 40);
    const texts: string[] = [];

    for (let i = 1; i <= maxPages; i++) {
      const page = await doc.getPage(i);
      const content = await page.getTextContent();
      const pageText = content.items.map((item: any) => item.str).join(' ');
      if (pageText.trim()) texts.push(`[Page ${i}]\n${pageText.trim()}`);
    }

    if (doc.numPages > 40) texts.push(`\n...[truncated: ${doc.numPages - 40} more pages]`);
    return texts.join('\n\n') || '[PDF contains no extractable text — it may be a scanned image]';
  } catch (err) {
    console.warn('PDF extraction failed:', err);
    return `[Could not extract text from PDF: ${(err as Error).message}]`;
  }
}

async function extractExcelText(dataUrl: string): Promise<string> {
  try {
    const raw = atob(dataUrl.split(',')[1] || '');
    const bytes = new Uint8Array(raw.length);
    for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);

    const wb = XLSX.read(bytes, { type: 'array' });
    const results: string[] = [];

    for (const sheetName of wb.SheetNames.slice(0, 10)) {
      const sheet = wb.Sheets[sheetName];
      const csv = XLSX.utils.sheet_to_csv(sheet, { skipHidden: true });
      const rows = csv.split('\n');
      const truncated = rows.length > 200
        ? rows.slice(0, 200).join('\n') + `\n\n...[truncated: ${rows.length - 200} more rows]`
        : csv;
      results.push(`[Sheet: ${sheetName}]\n${truncated}`);
    }

    if (wb.SheetNames.length > 10) {
      results.push(`...[truncated: ${wb.SheetNames.length - 10} more sheets]`);
    }

    return results.join('\n\n') || '[Spreadsheet contains no data]';
  } catch (err) {
    console.warn('Excel extraction failed:', err);
    return `[Could not parse spreadsheet: ${(err as Error).message}]`;
  }
}

function extractTextContent(dataUrl: string): string {
  try {
    return dataUrlToText(dataUrl);
  } catch {
    return '[Could not decode text content]';
  }
}

export async function parseFile(file: File, dataUrl?: string): Promise<ParsedFile> {
  const url = dataUrl || await readFileAsDataUrl(file);
  const mimeType = file.type || 'application/octet-stream';
  const fileName = file.name;

  if (isImageFile(fileName, mimeType)) {
    return { text: '', imageDataUrl: url, mimeType, fileName };
  }

  if (isPdfFile(fileName, mimeType)) {
    const text = await extractPdfText(url);
    return { text, mimeType, fileName };
  }

  if (isExcelFile(fileName, mimeType)) {
    const text = await extractExcelText(url);
    return { text, mimeType, fileName };
  }

  if (isTextFile(fileName, mimeType)) {
    const text = extractTextContent(url);
    return { text, mimeType, fileName };
  }

  return {
    text: `[File type: ${mimeType || 'unknown'} | Name: ${fileName} | Size: ${file.size} bytes]\nThis file type cannot be parsed for text extraction. The file metadata is provided above for reference.`,
    mimeType,
    fileName,
  };
}

export function buildFileMessage(parsed: ParsedFile, userPrompt?: string): { text: string; imageDataUrl?: string } {
  const ext = parsed.fileName.split('.').pop()?.toUpperCase() || 'FILE';
  const prompt = userPrompt || 'Please analyze this file and provide a comprehensive summary with key takeaways.';

  if (parsed.imageDataUrl) {
    return {
      text: `I've uploaded an image file (${parsed.fileName}). ${prompt}`,
      imageDataUrl: parsed.imageDataUrl,
    };
  }

  const truncated = parsed.text.length > 15000
    ? parsed.text.slice(0, 15000) + '\n\n...[content truncated for length]'
    : parsed.text;

  return {
    text: `${prompt}\n\n--- File: ${parsed.fileName} (${ext}) ---\n\`\`\`\n${truncated}\n\`\`\`\n--- End of file ---`,
  };
}
