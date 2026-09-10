// Deterministic document generators. Each takes a DocumentSpec and returns the
// raw bytes (Buffer) of a real file, using proper generation libraries so the
// output is a genuine, openable document — not text pretending to be one.

import {
  AlignmentType,
  BorderStyle,
  Document,
  ExternalHyperlink,
  HeadingLevel,
  Packer,
  PageBreak,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from "docx";
import { PDFDocument, StandardFonts, rgb, grayscale } from "pdf-lib";
import PptxGenJS from "pptxgenjs";
import * as XLSX from "xlsx";
import type {
  DocBlock,
  DocumentSpec,
  SheetCell,
  SheetDefinition,
  SlideDefinition,
} from "./spec";
import { sanitizeFilename } from "./spec";

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

type StyleBitmap = { bold?: boolean; italic?: boolean; size?: number; color?: string };

function transformMarkdownInline(text: string): TextRun[] {
  // Very light inline markup support: **bold**, *italic*, `code`.
  const runs: TextRun[] = [];
  const pattern = /(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g;
  let last = 0;
  let match: RegExpExecArray | null;
  let plain: string;
  let opts: StyleBitmap;
  while ((match = pattern.exec(text))) {
    plain = text.slice(last, match.index);
    if (plain) runs.push(new TextRun({ text: plain }));
    opts = {};
    const token = match[0];
    if (token.startsWith("**")) opts.bold = true;
    else if (token.startsWith("`")) opts.italic = true;
    else opts.italic = true;
    runs.push(new TextRun({ text: token.replace(/[*`]/g, ""), ...opts }));
    last = match.index + token.length;
  }
  plain = text.slice(last);
  if (plain) runs.push(new TextRun({ text: plain }));
  return runs.length ? runs : [new TextRun({ text: "" })];
}

// ---------------------------------------------------------------------------
// WORD (.docx)
// ---------------------------------------------------------------------------

function blockToDocxParagraph(block: DocBlock): (Paragraph | Table)[] | null {
  switch (block.type) {
    case "heading": {
      const headingLevels: Record<number, (typeof HeadingLevel)[keyof typeof HeadingLevel]> = {
        1: HeadingLevel.HEADING_1,
        2: HeadingLevel.HEADING_2,
        3: HeadingLevel.HEADING_3,
      };
      return [
        new Paragraph({
          text: block.text,
          heading: headingLevels[block.level] ?? HeadingLevel.HEADING_2,
          spacing: { before: 240, after: 120 },
        }),
      ];
    }
    case "paragraph": {
      const alignment =
        block.alignment === "center"
          ? AlignmentType.CENTER
          : block.alignment === "right"
            ? AlignmentType.END
            : block.alignment === "justify"
              ? AlignmentType.BOTH
              : AlignmentType.START;
      const runOptions = {
        bold: block.bold,
        italics: block.italic,
        size: block.size ? Math.round(block.size * 2) : undefined,
        color: block.color,
      };
      const children: (TextRun | ExternalHyperlink)[] = block.link
        ? [
            new ExternalHyperlink({
              link: block.link,
              children: [new TextRun({ text: block.text, ...runOptions, color: block.color || "0563C1" })],
            }),
          ]
        : block.bold || block.italic
          ? [new TextRun({ text: block.text, ...runOptions })]
          : transformMarkdownInline(block.text);
      return [
        new Paragraph({
          children,
          alignment,
          spacing: { after: 140 },
        }),
      ];
    }
    case "bulletList":
      return block.items.map(
        item =>
          new Paragraph({
            text: item,
            bullet: { level: 0 },
            spacing: { after: 60 },
          })
      );
    case "numberedList":
      return block.items.map(
        item =>
          new Paragraph({
            text: item,
            numbering: { reference: "ksemo-numbered", level: 0 },
            spacing: { after: 60 },
          })
      );
    case "table": {
      const headerCount = Math.max(
        block.headers?.length ?? 0,
        ...block.rows.map(row => row.length),
        1
      );
      const widths = Array.from({ length: headerCount }, () => Math.floor(100 / headerCount));
      const headerCells = (block.headers ?? []).map(
        header =>
          new TableCell({
            shading: { type: ShadingType.CLEAR, fill: "E7EDF3" },
            children: [new Paragraph({ children: [new TextRun({ text: header, bold: true })] })],
          })
      );
      if (headerCells.length && headerCells.length < headerCount) {
        for (let i = headerCells.length; i < headerCount; i += 1)
          headerCells.push(new TableCell({ children: [new Paragraph({ text: "" })] }));
      }
      if (!headerCells.length) {
        for (let i = 0; i < headerCount; i += 1)
          headerCells.push(new TableCell({ children: [new Paragraph({ text: "" })] }));
      }
      const rows: TableRow[] = [];
      if ((block.headers ?? []).length) rows.push(new TableRow({ children: headerCells }));
      for (const row of block.rows) {
        const cells: TableCell[] = [];
        for (let i = 0; i < headerCount; i += 1)
          cells.push(
            new TableCell({
              children: [new Paragraph({ text: row[i] ?? "" })],
            })
          );
        rows.push(new TableRow({ children: cells }));
      }
      return [
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          columnWidths: widths,
          borders: {
            top: { style: BorderStyle.SINGLE, size: 1, color: "CCCCCC" },
            bottom: { style: BorderStyle.SINGLE, size: 1, color: "CCCCCC" },
            left: { style: BorderStyle.SINGLE, size: 1, color: "CCCCCC" },
            right: { style: BorderStyle.SINGLE, size: 1, color: "CCCCCC" },
            insideHorizontal: { style: BorderStyle.SINGLE, size: 1, color: "CCCCCC" },
            insideVertical: { style: BorderStyle.SINGLE, size: 1, color: "CCCCCC" },
          },
          rows,
        }),
        new Paragraph({ spacing: { after: 120 }, children: [new TextRun({ text: "" })] }),
      ];
    }
    case "pageBreak":
      return [new Paragraph({ children: [new PageBreak()] })];
    default:
      return null;
  }
}

export async function generateDocx(spec: DocumentSpec): Promise<Buffer> {
  const paragraphs: (Paragraph | Table)[] = [];
  const blocks = spec.blocks ?? [];
  // Title heading
  paragraphs.push(
    new Paragraph({
      text: spec.title || "Document",
      heading: HeadingLevel.TITLE,
      spacing: { after: 240 },
    })
  );
  paragraphs.push(
    new Paragraph({
      children: [new TextRun({ text: "", size: 4 })],
      spacing: { after: 80 },
    })
  );
  for (const block of blocks) {
    const converted = blockToDocxParagraph(block);
    if (converted) paragraphs.push(...converted);
  }
  const doc = new Document({
    numbering: {
      config: [
        {
          reference: "ksemo-numbered",
          levels: [
            { level: 0, format: "decimal", text: "%1.", alignment: AlignmentType.START },
          ],
        },
      ],
    },
    styles: {
      default: {
        document: {
          run: { font: "Calibri", size: 22 },
          paragraph: { spacing: { line: 276, after: 0 } },
        },
      },
    },
    sections: [{ children: paragraphs }],
  });
  return Packer.toBuffer(doc);
}

// ---------------------------------------------------------------------------
// EXCEL (.xlsx)
// ---------------------------------------------------------------------------

function coerceCell(cell: SheetCell): string | number | boolean {
  if (cell === null || cell === undefined) return "";
  if (typeof cell === "object") {
    if ("formula" in cell && typeof cell.formula === "string") return cell.formula;
    if ("value" in cell && (typeof cell.value === "number" || typeof cell.value === "boolean"))
      return cell.value;
    return String((cell as { value?: unknown }).value ?? "");
  }
  return cell;
}

export function generateXlsx(spec: DocumentSpec): Buffer {
  const workbook = XLSX.utils.book_new();
  const sheets = spec.sheets?.length
    ? spec.sheets
    : ([
        {
          name: "Sheet1",
          rows: spec.blocks
            ? (spec.blocks
                .filter(b => b.type === "table")
                .flatMap(b => (b.type === "table" ? b.rows : [])) as SheetCell[][])
            : [],
        },
      ] as SheetDefinition[]);
  sheets.forEach((sheet, index) => {
    const ws =
      sheet.rows.length > 0
        ? XLSX.utils.aoa_to_sheet(
            sheet.rows.map(row => row.map(cell => coerceCell(cell)))
          )
        : XLSX.utils.aoa_to_sheet([[]]);
    ws["!cols"] = Array.from({ length: sheet.rows[0]?.length ?? 1 }, () => ({
      wch: 22,
    }));
    const sheetName = (sheet.name || `Sheet${index + 1}`).slice(0, 31);
    XLSX.utils.book_append_sheet(workbook, ws, sheetName);
  });
  return XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }) as Buffer;
}

// ---------------------------------------------------------------------------
// POWERPOINT (.pptx)
// ---------------------------------------------------------------------------

export async function generatePptx(spec: DocumentSpec): Promise<Buffer> {
  const pptx = new PptxGenJS();
  pptx.layout = "LAYOUT_16x9";
  const slides = spec.slides?.length
    ? spec.slides
    : buildSlidesFromBlocks(spec.blocks ?? []);
  slides.forEach((slide, index) => {
    const s = pptx.addSlide();
    if (index === 0) {
      s.addText(spec.title || "Presentation", {
        x: 0.6,
        y: 1.4,
        w: 12,
        h: 1.2,
        fontSize: 40,
        bold: true,
        color: "1D4ED8",
        align: "left",
      });
      if ("subtitle" in slide && slide.subtitle)
        s.addText(slide.subtitle, { x: 0.6, y: 2.8, w: 12, h: 0.8, fontSize: 20, color: "555555" });
      if (slide.bullets?.length)
        s.addText(slide.bullets.map(b => ({ text: b, options: { bullet: true } })), {
          x: 0.6,
          y: 3.6,
          w: 12,
          h: 4,
          fontSize: 18,
          color: "333333",
        });
      return;
    }
    if (slide.title)
      s.addText(slide.title, {
        x: 0.6,
        y: 0.4,
        w: 12,
        h: 0.8,
        fontSize: 28,
        bold: true,
        color: "1D4ED8",
      });
    let top = 1.4;
    const bullets = slide.bullets ?? [];
    if (bullets.length) {
      s.addText(bullets.map(b => ({ text: b, options: { bullet: true } })), {
        x: 0.6,
        y: top,
        w: 12.2,
        h: 5.6,
        fontSize: 18,
        color: "333333",
      });
    }
    const tbl = slide.table;
    if (tbl) {
      const header = tbl.headers ?? [];
      const rows = [
        ...(header.length ? [header] : []),
        ...tbl.rows,
      ];
      if (rows.length) {
        const colCount = Math.max(...rows.map(r => r.length), 1);
        const colWidths = Array.from({ length: colCount }, () => Math.floor(100 / colCount));
        const tableRows = rows.map((row, r) =>
          Array.from({ length: colCount }, (_, c) => ({
            text: row[c] ?? "",
            options: {
              bold: r === 0 && header.length > 0,
              color: r === 0 && header.length > 0 ? "FFFFFF" : "333333",
              fill: { color: r === 0 && header.length > 0 ? "1D4ED8" : "F3F4F6" },
            },
          }))
        );
        s.addTable(tableRows, {
          x: 0.6,
          y: top + 2.2,
          w: 12.2,
          colW: colWidths,
          fontSize: 14,
          border: { pt: 0.5, color: "D1D5DB" },
        });
      }
    }
    if (slide.footnote)
      s.addText(slide.footnote, { x: 0.6, y: 7.2, w: 12, h: 0.5, fontSize: 11, color: "9CA3AF" });
  });
  return (await pptx.write({ outputType: "nodebuffer" })) as Buffer;
}

function buildSlidesFromBlocks(blocks: DocBlock[]): SlideDefinition[] {
  const slides: SlideDefinition[] = [];
  let current: SlideDefinition | null = null;
  const flush = () => {
    if (current && (current.bullets?.length || current.table)) {
      slides.push(current);
    }
    current = null;
  };
  for (const block of blocks) {
    if (block.type === "heading") {
      flush();
      current = { title: block.text, bullets: [] };
    } else if (current && block.type === "bulletList") {
      current.bullets = (current.bullets ?? []).concat(block.items);
    } else if (current && block.type === "numberedList") {
      current.bullets = (current.bullets ?? []).concat(
        block.items.map((item, i) => `${i + 1}. ${item}`)
      );
    } else if (current && block.type === "paragraph") {
      current.bullets = (current.bullets ?? []).concat([block.text]);
    } else if (block.type === "table") {
      if (!current) current = { bullets: [], table: { headers: block.headers, rows: block.rows } };
      else current.table = { headers: block.headers, rows: block.rows };
    }
  }
  flush();
  if (!slides.length) slides.push({ title: "Section", bullets: [] });
  return slides;
}

// ---------------------------------------------------------------------------
// PDF
// ---------------------------------------------------------------------------

function pdfEscape(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)")
    .replace(/[^\x20-\x7e]/g, "");
}

// A robust PDF writer built on pdf-lib that supports headings, paragraphs, lists, tables,
// page numbers, and pagination with embedded standard fonts.
export async function generatePdf(spec: DocumentSpec): Promise<Buffer> {
  const pdfDoc = await PDFDocument.create();
  pdfDoc.setTitle(spec.title || "Document");
  pdfDoc.setProducer("KSEMO AI Studio Document Engine");

  const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const fontOblique = await pdfDoc.embedFont(StandardFonts.HelveticaOblique);

  const pageWidth = 612;
  const pageHeight = 792;
  const margin = 54;
  const contentWidth = pageWidth - margin * 2;
  const bottomThreshold = margin + 36;

  let page = pdfDoc.addPage([pageWidth, pageHeight]);
  let y = pageHeight - margin;

  const colorText = rgb(0.12, 0.13, 0.16);
  const colorMuted = rgb(0.42, 0.44, 0.48);
  const colorPrimary = rgb(0.15, 0.2, 0.28);
  const colorBorder = rgb(0.86, 0.88, 0.9);
  const colorBgLight = rgb(0.96, 0.97, 0.98);

  const ensureSpace = (needed: number): void => {
    if (y - needed < bottomThreshold) {
      page = pdfDoc.addPage([pageWidth, pageHeight]);
      y = pageHeight - margin;
    }
  };

  const wrapText = (text: string, fontSize: number, maxWidth: number, font = fontRegular): string[] => {
    const clean = String(text ?? "").replace(/\r\n/g, "\n").replace(/[^\x20-\x7e\n\t]/g, " ");
    const paragraphs = clean.split("\n");
    const resultLines: string[] = [];

    for (const para of paragraphs) {
      if (!para.trim()) {
        resultLines.push("");
        continue;
      }
      const words = para.split(/\s+/).filter(Boolean);
      let currentLine = "";

      for (const word of words) {
        const candidate = currentLine ? `${currentLine} ${word}` : word;
        const width = font.widthOfTextAtSize(candidate, fontSize);
        if (width > maxWidth && currentLine) {
          resultLines.push(currentLine);
          currentLine = word;
        } else {
          currentLine = candidate;
        }
      }
      if (currentLine) {
        resultLines.push(currentLine);
      }
    }
    return resultLines.length ? resultLines : [""];
  };

  // Document Title Header
  const titleText = spec.title || "Document";
  const titleLines = wrapText(titleText, 20, contentWidth, fontBold);
  for (const line of titleLines) {
    ensureSpace(28);
    page.drawText(line, {
      x: margin,
      y,
      size: 20,
      font: fontBold,
      color: colorPrimary,
    });
    y -= 26;
  }

  // Accent horizontal divider
  ensureSpace(12);
  page.drawLine({
    start: { x: margin, y: y + 8 },
    end: { x: margin + contentWidth, y: y + 8 },
    thickness: 1.5,
    color: colorPrimary,
  });
  y -= 14;

  const blocks = spec.blocks ?? [];
  for (const block of blocks) {
    switch (block.type) {
      case "heading": {
        const size = block.level === 1 ? 15 : block.level === 2 ? 13 : 11;
        const font = fontBold;
        const headingLines = wrapText(block.text, size, contentWidth, font);
        ensureSpace(headingLines.length * (size + 6) + 16);
        y -= 10;
        for (const line of headingLines) {
          page.drawText(line, {
            x: margin,
            y,
            size,
            font,
            color: colorPrimary,
          });
          y -= size + 5;
        }
        y -= 4;
        break;
      }
      case "paragraph": {
        const size = block.size ?? 10;
        const font = block.bold ? fontBold : block.italic ? fontOblique : fontRegular;
        const color = block.color ? colorPrimary : colorText;
        const lines = wrapText(block.text, size, contentWidth, font);
        for (const line of lines) {
          ensureSpace(size + 4);
          if (line) {
            page.drawText(line, {
              x: margin,
              y,
              size,
              font,
              color,
            });
          }
          y -= size + 4.5;
        }
        y -= 5;
        break;
      }
      case "bulletList": {
        for (const item of block.items) {
          const lines = wrapText(item, 10, contentWidth - 18, fontRegular);
          ensureSpace(lines.length * 14 + 4);
          lines.forEach((line, idx) => {
            if (idx === 0) {
              page.drawText("-", {
                x: margin + 2,
                y,
                size: 10,
                font: fontBold,
                color: colorPrimary,
              });
            }
            page.drawText(line, {
              x: margin + 14,
              y,
              size: 10,
              font: fontRegular,
              color: colorText,
            });
            y -= 14;
          });
          y -= 2;
        }
        y -= 4;
        break;
      }
      case "numberedList": {
        block.items.forEach((item, itemIdx) => {
          const prefix = `${itemIdx + 1}.`;
          const lines = wrapText(item, 10, contentWidth - 22, fontRegular);
          ensureSpace(lines.length * 14 + 4);
          lines.forEach((line, idx) => {
            if (idx === 0) {
              page.drawText(prefix, {
                x: margin,
                y,
                size: 9.5,
                font: fontBold,
                color: colorPrimary,
              });
            }
            page.drawText(line, {
              x: margin + 18,
              y,
              size: 10,
              font: fontRegular,
              color: colorText,
            });
            y -= 14;
          });
          y -= 2;
        });
        y -= 4;
        break;
      }
      case "table": {
        const headers = block.headers ?? [];
        const data = block.rows ?? [];
        const allRows = headers.length ? [headers, ...data] : data;
        if (!allRows.length) break;

        const colCount = Math.max(headers.length, ...allRows.map(r => r.length), 1);
        const colWidth = contentWidth / colCount;
        const rowHeight = 22;

        ensureSpace(rowHeight + 10);
        y -= 6;

        allRows.forEach((row, rowIdx) => {
          const isHeader = rowIdx === 0 && headers.length > 0;
          ensureSpace(rowHeight);

          if (isHeader) {
            page.drawRectangle({
              x: margin,
              y: y - 4,
              width: contentWidth,
              height: rowHeight,
              color: colorBgLight,
              borderColor: colorBorder,
              borderWidth: 1,
            });
          } else {
            page.drawLine({
              start: { x: margin, y: y - 4 },
              end: { x: margin + contentWidth, y: y - 4 },
              thickness: 0.5,
              color: colorBorder,
            });
          }

          for (let c = 0; c < colCount; c++) {
            const rawCell = String(row[c] ?? "").trim();
            const cellFont = isHeader ? fontBold : fontRegular;
            const cellSize = isHeader ? 9.5 : 9;
            const maxChars = Math.max(6, Math.floor((colWidth - 8) / (cellSize * 0.55)));
            const cellText = rawCell.length > maxChars ? `${rawCell.slice(0, maxChars - 2)}...` : rawCell;

            page.drawText(cellText, {
              x: margin + c * colWidth + 5,
              y: y + 2,
              size: cellSize,
              font: cellFont,
              color: isHeader ? colorPrimary : colorText,
            });
          }
          y -= rowHeight;
        });
        y -= 8;
        break;
      }
      case "pageBreak": {
        page = pdfDoc.addPage([pageWidth, pageHeight]);
        y = pageHeight - margin;
        break;
      }
      default:
        break;
    }
  }

  // Add clean running footers with page numbers to all pages
  const totalPages = pdfDoc.getPageCount();
  for (let i = 0; i < totalPages; i++) {
    const p = pdfDoc.getPage(i);
    const footerText = `Page ${i + 1} of ${totalPages}`;
    const footerWidth = fontRegular.widthOfTextAtSize(footerText, 8.5);
    p.drawText(footerText, {
      x: pageWidth - margin - footerWidth,
      y: 28,
      size: 8.5,
      font: fontRegular,
      color: colorMuted,
    });
    p.drawText("Generated with KSEMO", {
      x: margin,
      y: 28,
      size: 8.5,
      font: fontRegular,
      color: colorMuted,
    });
    p.drawLine({
      start: { x: margin, y: 40 },
      end: { x: pageWidth - margin, y: 40 },
      thickness: 0.5,
      color: colorBorder,
    });
  }

  const bytes = await pdfDoc.save();
  return Buffer.from(bytes);
}

// ---------------------------------------------------------------------------
// TXT
// ---------------------------------------------------------------------------

export function generateTxt(spec: DocumentSpec): Buffer {
  const lines: string[] = [spec.title || "Document", ""];
  for (const block of spec.blocks ?? []) {
    switch (block.type) {
      case "heading":
        lines.push("=".repeat(Math.max(4, block.level === 1 ? 14 : 10)));
        lines.push(block.text);
        lines.push("");
        break;
      case "paragraph":
        lines.push(block.text, "");
        break;
      case "bulletList":
        block.items.forEach(item => lines.push(`  • ${item}`));
        lines.push("");
        break;
      case "numberedList":
        block.items.forEach((item, i) => lines.push(`  ${i + 1}. ${item}`));
        lines.push("");
        break;
      case "table":
        if (block.headers) lines.push(block.headers.join("\t"));
        block.rows.forEach(row => lines.push(row.join("\t")));
        lines.push("");
        break;
      case "pageBreak":
        lines.push("", "----- Page Break -----", "");
        break;
      default:
        break;
    }
  }
  return Buffer.from(lines.join("\n"), "utf8");
}

// ---------------------------------------------------------------------------
// Dispatcher
// ---------------------------------------------------------------------------

export type GeneratedArtifact = {
  buffer: Buffer;
  filename: string;
  mimeType: string;
};

export async function generateDocument(spec: DocumentSpec): Promise<GeneratedArtifact> {
  const filename = sanitizeFilename(spec.format, spec.filename);
  const mimeTypes: Record<string, string> = {
    pdf: "application/pdf",
    docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    txt: "text/plain",
  };
  let buffer: Buffer;
  try {
    switch (spec.format) {
      case "docx":
        buffer = await generateDocx(spec);
        break;
      case "xlsx":
        buffer = generateXlsx(spec);
        break;
      case "pptx":
        buffer = await generatePptx(spec);
        break;
      case "pdf":
        buffer = await generatePdf(spec);
        break;
      case "txt":
        buffer = generateTxt(spec);
        break;
      default:
        buffer = generateTxt(spec);
        break;
    }
  } catch (genError) {
    console.warn(`[DocGen] Specific generator for ${spec.format} encountered an issue; falling back to clean text compilation.`, genError);
    buffer = generateTxt(spec);
  }
  return { buffer, filename, mimeType: mimeTypes[spec.format] || "application/octet-stream" };
}
