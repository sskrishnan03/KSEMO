/**
 * Server-side file generation engine for the Create, Search & Research system.
 * 
 * This module handles the generation of various file formats:
 * - PDF: Professional formatted documents
 * - DOCX: Microsoft Word documents
 * - XLSX: Excel spreadsheets
 * - PPTX: PowerPoint presentations
 * - TXT: Plain text files
 */

import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType, Table, TableRow, TableCell, WidthType, BorderStyle } from "docx";
import PptxGenJS from "pptxgenjs";
import * as XLSX from "xlsx";
import { createPdfFile } from "../client/src/lib/conversationExport";

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
  // For now, use the existing PDF generation from conversationExport
  // This can be enhanced with more sophisticated PDF formatting
  const pdfBlob = createPdfFile(content);
  const arrayBuffer = await pdfBlob.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  
  const filename = title ? `${sanitizeFilename(title)}.pdf` : "generated_document.pdf";
  
  return {
    filename,
    mimeType: "application/pdf",
    data: buffer,
    size: buffer.length,
  };
}

/**
 * Generate a DOCX (Word) file with professional formatting.
 */
async function generateDocx(content: string, title?: string, description?: string): Promise<GeneratedFile> {
  const paragraphs: Paragraph[] = [];
  
  // Add title if provided
  if (title) {
    paragraphs.push(
      new Paragraph({
        text: title,
        heading: HeadingLevel.HEADING_1,
        alignment: AlignmentType.CENTER,
        spacing: { after: 400 },
      })
    );
  }
  
  // Add description if provided
  if (description) {
    paragraphs.push(
      new Paragraph({
        text: description,
        spacing: { after: 400 },
      })
    );
  }
  
  // Parse content and convert to paragraphs
  const lines = content.split('\n');
  for (const line of lines) {
    if (line.trim() === '') {
      paragraphs.push(new Paragraph({ text: '' }));
    } else if (line.startsWith('# ')) {
      paragraphs.push(
        new Paragraph({
          text: line.substring(2),
          heading: HeadingLevel.HEADING_1,
          spacing: { before: 400, after: 200 },
        })
      );
    } else if (line.startsWith('## ')) {
      paragraphs.push(
        new Paragraph({
          text: line.substring(3),
          heading: HeadingLevel.HEADING_2,
          spacing: { before: 300, after: 200 },
        })
      );
    } else if (line.startsWith('### ')) {
      paragraphs.push(
        new Paragraph({
          text: line.substring(4),
          heading: HeadingLevel.HEADING_3,
          spacing: { before: 200, after: 200 },
        })
      );
    } else if (line.startsWith('- ') || line.startsWith('* ')) {
      paragraphs.push(
        new Paragraph({
          children: [
            new TextRun({
              text: "• ",
              bold: true,
            }),
            new TextRun(line.substring(2)),
          ],
          indent: { left: 720 },
          spacing: { after: 100 },
        })
      );
    } else {
      paragraphs.push(
        new Paragraph({
          text: line,
          spacing: { after: 120 },
        })
      );
    }
  }
  
  const doc = new Document({
    sections: [{ children: paragraphs }],
  });
  
  const buffer = await Packer.toBuffer(doc);
  const filename = title ? `${sanitizeFilename(title)}.docx` : "generated_document.docx";
  
  return {
    filename,
    mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    data: buffer,
    size: buffer.length,
  };
}

/**
 * Generate an XLSX (Excel) file with structured data.
 */
async function generateXlsx(content: string, title?: string, description?: string): Promise<GeneratedFile> {
  const workbook = XLSX.utils.book_new();
  
  // Parse content to extract structured data
  const lines = content.split('\n');
  const data: string[][] = [];
  
  for (const line of lines) {
    if (line.includes('|')) {
      // Treat as table row (Markdown table format)
      const cells = line.split('|').map(cell => cell.trim()).filter(cell => cell !== '');
      if (!cells.some(cell => cell.startsWith('---'))) { // Skip separator lines
        data.push(cells);
      }
    } else if (line.includes(',')) {
      // Treat as CSV row
      const cells = line.split(',').map(cell => cell.trim());
      data.push(cells);
    } else if (line.trim()) {
      // Treat as single-column data
      data.push([line.trim()]);
    }
  }
  
  // Create worksheet
  const worksheet = XLSX.utils.aoa_to_sheet(data);
  
  // Add worksheet to workbook
  const sheetName = title ? sanitizeFilename(title).substring(0, 31) : "Sheet1";
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
  
  // Generate buffer
  const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
  const filename = title ? `${sanitizeFilename(title)}.xlsx` : "generated_spreadsheet.xlsx";
  
  return {
    filename,
    mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    data: buffer,
    size: buffer.length,
  };
}

/**
 * Generate a PPTX (PowerPoint) presentation.
 */
async function generatePptx(content: string, title?: string, description?: string): Promise<GeneratedFile> {
  const pptx = new PptxGenJS();
  
  // Set presentation title
  if (title) {
    pptx.title = title;
  }
  
  // Parse content into slides
  const lines = content.split('\n');
  let currentSlide = pptx.addSlide();
  let bulletLevel = 0;
  
  for (const line of lines) {
    const trimmed = line.trim();
    
    if (trimmed.startsWith('# ')) {
      // Main heading - new slide
      currentSlide = pptx.addSlide();
      currentSlide.addText(trimmed.substring(2), {
        x: 0.5,
        y: 1,
        w: 9,
        h: 1,
        fontSize: 36,
        bold: true,
        color: '363636',
      });
      bulletLevel = 0;
    } else if (trimmed.startsWith('## ')) {
      // Subheading - new slide
      currentSlide = pptx.addSlide();
      currentSlide.addText(trimmed.substring(3), {
        x: 0.5,
        y: 1,
        w: 9,
        h: 1,
        fontSize: 32,
        bold: true,
        color: '363636',
      });
      bulletLevel = 0;
    } else if (trimmed.startsWith('### ')) {
      // Sub-subheading - same slide, reset bullets
      currentSlide.addText(trimmed.substring(4), {
        x: 0.5,
        y: 2,
        w: 9,
        h: 0.8,
        fontSize: 28,
        bold: true,
        color: '525252',
      });
      bulletLevel = 0;
    } else if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
      // Bullet point
      currentSlide.addText(trimmed.substring(2), {
        x: 0.5 + (bulletLevel * 0.5),
        y: 2.5 + (bulletLevel * 0.3),
        w: 9 - (bulletLevel * 0.5),
        h: 0.5,
        fontSize: 18,
        color: '525252',
        bullet: true,
      });
      bulletLevel = Math.min(bulletLevel + 1, 2);
    } else if (trimmed) {
      // Regular text
      currentSlide.addText(trimmed, {
        x: 0.5,
        y: 2.5,
        w: 9,
        h: 0.5,
        fontSize: 18,
        color: '525252',
      });
    }
  }
  
  // If no slides were created, add a title slide
  if (pptx.slides.length === 0) {
    const titleSlide = pptx.addSlide();
    titleSlide.addText(title || "Presentation", {
      x: 0.5,
      y: 2,
      w: 9,
      h: 1.5,
      fontSize: 44,
      bold: true,
      color: '363636',
      align: 'center',
    });
    
    if (description) {
      titleSlide.addText(description, {
        x: 0.5,
        y: 3.5,
        w: 9,
        h: 1,
        fontSize: 20,
        color: '737373',
        align: 'center',
      });
    }
  }
  
  const buffer = await pptx.write({ outputType: 'nodebuffer' });
  const filename = title ? `${sanitizeFilename(title)}.pptx` : "generated_presentation.pptx";
  
  return {
    filename,
    mimeType: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    data: buffer,
    size: buffer.length,
  };
}

/**
 * Generate a plain text file.
 */
async function generateTxt(content: string, title?: string): Promise<GeneratedFile> {
  let text = "";
  
  if (title) {
    text += `${title}\n${'='.repeat(title.length)}\n\n`;
  }
  
  text += content;
  
  const buffer = Buffer.from(text, 'utf-8');
  const filename = title ? `${sanitizeFilename(title)}.txt` : "generated_document.txt";
  
  return {
    filename,
    mimeType: "text/plain",
    data: buffer,
    size: buffer.length,
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