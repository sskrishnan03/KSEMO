/**
 * Server-side file generation engine.
 * 
 * This module handles the generation of various file formats:
 * - PDF: Professional formatted documents
 * - DOCX: Microsoft Word documents
 * - XLSX: Excel spreadsheets
 * - PPTX: PowerPoint presentations
 * - TXT: Plain text files
 */

import { generateDocument } from "./docgen/generate";
import type { DocBlock, DocumentSpec } from "./docgen/spec";

export type FileFormat = "pdf" | "docx" | "xlsx" | "pptx" | "txt";

export interface FileGenerationRequest {
  format: FileFormat;
  content: string;
  title?: string;
  description?: string;
}

export interface GeneratedFile {
  filename: string;
  mimeType: string;
  data: Buffer;
  size: number;
  code?: string;
}

/**
 * Generate a file based on the specified format and content.
 * This is the main entry point for file generation.
 */
export async function generateFile(request: FileGenerationRequest): Promise<GeneratedFile> {
  const { format, content, title, description } = request;
  
  switch (format) {
    case "pdf":
      return generatePdf(content, title, description);
    case "docx":
      return generateDocx(content, title, description);
    case "xlsx":
      return generateXlsx(content, title, description);
    case "pptx":
      return generatePptx(content, title, description);
    case "txt":
      return generateTxt(content, title);
    default:
      throw new Error(`Unsupported file format: ${format}`);
  }
}

/**
 * Generate a PDF file with professional formatting.
 */
async function generatePdf(content: string, title?: string, description?: string): Promise<GeneratedFile> {
  const lines = content.split("\n");
  const blocks: DocBlock[] = [];
  let currentParagraph = "";

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith("# ")) {
      if (currentParagraph) {
        blocks.push({ type: "paragraph", text: currentParagraph });
        currentParagraph = "";
      }
      blocks.push({ type: "heading", level: 1, text: trimmed.slice(2).trim() });
    } else if (trimmed.startsWith("## ")) {
      if (currentParagraph) {
        blocks.push({ type: "paragraph", text: currentParagraph });
        currentParagraph = "";
      }
      blocks.push({ type: "heading", level: 2, text: trimmed.slice(3).trim() });
    } else if (trimmed.startsWith("### ")) {
      if (currentParagraph) {
        blocks.push({ type: "paragraph", text: currentParagraph });
        currentParagraph = "";
      }
      blocks.push({ type: "heading", level: 3, text: trimmed.slice(4).trim() });
    } else if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
      if (currentParagraph) {
        blocks.push({ type: "paragraph", text: currentParagraph });
        currentParagraph = "";
      }
      blocks.push({ type: "bulletList", items: [trimmed.slice(2).trim()] });
    } else if (!trimmed) {
      if (currentParagraph) {
        blocks.push({ type: "paragraph", text: currentParagraph });
        currentParagraph = "";
      }
    } else {
      currentParagraph = currentParagraph ? `${currentParagraph} ${trimmed}` : trimmed;
    }
  }
  if (currentParagraph) {
    blocks.push({ type: "paragraph", text: currentParagraph });
  }

  const filename = title ? `${sanitizeFilename(title)}.pdf` : "generated_document.pdf";
  const artifact = await generateDocument({
    format: "pdf",
    filename,
    title: title || "Generated Document",
    summary: description,
    blocks: blocks.length ? blocks : [{ type: "paragraph", text: content }],
  });

  return {
    filename: artifact.filename,
    mimeType: artifact.mimeType,
    data: artifact.buffer,
    size: artifact.buffer.length,
    code: artifact.code,
  };
}

/**
 * Generate a DOCX (Word) file with professional formatting.
 */
async function generateDocx(content: string, title?: string, description?: string): Promise<GeneratedFile> {
  const blocks: DocBlock[] = [];
  if (title) {
    blocks.push({ type: "heading", level: 1, text: title });
  }
  if (description) {
    blocks.push({ type: "paragraph", text: description });
  }
  const lines = content.split('\n');
  let currentParagraph = "";
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('# ')) {
      if (currentParagraph) {
        blocks.push({ type: "paragraph", text: currentParagraph });
        currentParagraph = "";
      }
      blocks.push({ type: "heading", level: 1, text: trimmed.slice(2).trim() });
    } else if (trimmed.startsWith('## ')) {
      if (currentParagraph) {
        blocks.push({ type: "paragraph", text: currentParagraph });
        currentParagraph = "";
      }
      blocks.push({ type: "heading", level: 2, text: trimmed.slice(3).trim() });
    } else if (trimmed.startsWith('### ')) {
      if (currentParagraph) {
        blocks.push({ type: "paragraph", text: currentParagraph });
        currentParagraph = "";
      }
      blocks.push({ type: "heading", level: 3, text: trimmed.slice(4).trim() });
    } else if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
      if (currentParagraph) {
        blocks.push({ type: "paragraph", text: currentParagraph });
        currentParagraph = "";
      }
      blocks.push({ type: "bulletList", items: [trimmed.slice(2).trim()] });
    } else if (!trimmed) {
      if (currentParagraph) {
        blocks.push({ type: "paragraph", text: currentParagraph });
        currentParagraph = "";
      }
    } else {
      currentParagraph = currentParagraph ? `${currentParagraph} ${trimmed}` : trimmed;
    }
  }
  if (currentParagraph) {
    blocks.push({ type: "paragraph", text: currentParagraph });
  }

  const filename = title ? `${sanitizeFilename(title)}.docx` : "generated_document.docx";
  const artifact = await generateDocument({
    format: "docx",
    filename,
    title: title || "Generated Document",
    summary: description,
    blocks: blocks.length ? blocks : [{ type: "paragraph", text: content }],
  });

  return {
    filename: artifact.filename,
    mimeType: artifact.mimeType,
    data: artifact.buffer,
    size: artifact.buffer.length,
    code: artifact.code,
  };
}

/**
 * Generate an XLSX (Excel) file with structured data.
 */
async function generateXlsx(content: string, title?: string, description?: string): Promise<GeneratedFile> {
  const lines = content.split('\n');
  const data: (string | number)[][] = [];
  
  for (const line of lines) {
    if (line.includes('|')) {
      const cells = line.split('|').map(cell => cell.trim()).filter(cell => cell !== '');
      if (!cells.some(cell => cell.startsWith('---'))) {
        data.push(cells);
      }
    } else if (line.includes(',')) {
      const cells = line.split(',').map(cell => cell.trim());
      data.push(cells);
    } else if (line.trim()) {
      data.push([line.trim()]);
    }
  }
  
  const sheetName = title ? sanitizeFilename(title).substring(0, 31) : "Sheet1";
  const filename = title ? `${sanitizeFilename(title)}.xlsx` : "generated_spreadsheet.xlsx";

  const artifact = await generateDocument({
    format: "xlsx",
    filename,
    title: title || "Spreadsheet",
    summary: description,
    sheets: [{ name: sheetName, rows: data }],
  });

  return {
    filename: artifact.filename,
    mimeType: artifact.mimeType,
    data: artifact.buffer,
    size: artifact.buffer.length,
    code: artifact.code,
  };
}

/**
 * Generate a PPTX (PowerPoint) presentation.
 */
async function generatePptx(content: string, title?: string, description?: string): Promise<GeneratedFile> {
  const lines = content.split('\n');
  const slides: any[] = [];
  let currentSlide: { title: string; bullets: string[] } | null = null;

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('# ') || trimmed.startsWith('## ')) {
      if (currentSlide) {
        slides.push(currentSlide);
      }
      currentSlide = {
        title: trimmed.replace(/^#+\s*/, ''),
        bullets: [],
      };
    } else if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
      if (!currentSlide) {
        currentSlide = { title: title || "Overview", bullets: [] };
      }
      currentSlide.bullets.push(trimmed.substring(2));
    } else if (trimmed) {
      if (!currentSlide) {
        currentSlide = { title: title || "Overview", bullets: [] };
      }
      currentSlide.bullets.push(trimmed);
    }
  }
  if (currentSlide) {
    slides.push(currentSlide);
  }
  if (slides.length === 0) {
    slides.push({
      title: title || "Presentation",
      bullets: [description || "Generated presentation"],
    });
  }

  const filename = title ? `${sanitizeFilename(title)}.pptx` : "generated_presentation.pptx";
  const artifact = await generateDocument({
    format: "pptx",
    filename,
    title: title || "Presentation",
    summary: description,
    slides,
  });

  return {
    filename: artifact.filename,
    mimeType: artifact.mimeType,
    data: artifact.buffer,
    size: artifact.buffer.length,
    code: artifact.code,
  };
}

/**
 * Generate a plain text file.
 */
async function generateTxt(content: string, title?: string): Promise<GeneratedFile> {
  const filename = title ? `${sanitizeFilename(title)}.txt` : "generated_document.txt";
  const artifact = await generateDocument({
    format: "txt",
    filename,
    title: title || "Document",
    blocks: [{ type: "paragraph", text: content }],
  });

  return {
    filename: artifact.filename,
    mimeType: artifact.mimeType,
    data: artifact.buffer,
    size: artifact.buffer.length,
    code: artifact.code,
  };
}

/**
 * Sanitize filename to remove unsafe characters.
 */
function sanitizeFilename(filename: string): string {
  return filename
    .replace(/[<>:"/\\|?*]/g, '_')
    .replace(/\s+/g, '_')
    .substring(0, 200);
}