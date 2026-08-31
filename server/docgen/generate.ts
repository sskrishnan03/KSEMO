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

// A compact PDF writer that supports headings, paragraphs, lists, tables,
// page numbers, and pagination with the built-in Helvetica font.
export function generatePdf(spec: DocumentSpec): Buffer {
  const pageWidth = 612;
  const pageHeight = 792;
  const margin = 50;
  const contentWidth = pageWidth - margin * 2;

  type Row = { text: string; x: number; y: number; size: number; bold?: boolean; fill?: number };
  const rows: Row[] = [];
  let y = pageHeight - margin;
  const lineHeight = (size: number) => Math.round(size * 1.35);

  const pushPageBreak = () => {
    if (y < margin + 40) {
      rows.push({ text: "\f", x: 0, y: 0, size: 0 });
      y = pageHeight - margin;
    }
  };

  const primaryColor = "1D4ED8";
  function hexShade(hex: string): number {
    const r = parseInt(hex.slice(0, 2), 16) / 255;
    const g = parseInt(hex.slice(2, 4), 16) / 255;
    const b = parseInt(hex.slice(4, 6), 16) / 255;
    return (0.299 * r + 0.587 * g + 0.114 * b) / 255 * 0.9;
  }

  const wrap = (text: string, size: number): string[] => {
    const charsPerLine = Math.max(8, Math.floor(contentWidth / (size * 0.48)));
    const words = text.split(/\s+/);
    const lines: string[] = [];
    let current = "";
    for (const word of words) {
      const next = current ? `${current} ${word}` : word;
      if (next.length > charsPerLine && current) {
        lines.push(current);
        current = word;
      } else current = next;
    }
    if (current) lines.push(current);
    return lines.length ? lines : [""];
  };

  // Title
  rows.push({ text: spec.title || "Document", x: margin, y, size: 22, bold: true });
  y -= lineHeight(22) + 12;
  rows.push({ text: "", x: margin, y, size: 1, fill: hexShade(primaryColor) });
  y -= 10;

  const blocks = spec.blocks ?? [];
  for (const block of blocks) {
    switch (block.type) {
      case "heading": {
        const size = block.level === 1 ? 17 : block.level === 2 ? 14 : 12;
        pushPageBreak();
        y -= 12;
        rows.push({ text: block.text, x: margin, y, size, bold: true });
        y -= lineHeight(size) + 4;
        break;
      }
      case "paragraph": {
        const size = block.size ?? 11;
        for (const line of wrap(block.text, size)) {
          pushPageBreak();
          rows.push({ text: line, x: margin, y, size });
          y -= lineHeight(size);
        }
        y -= 6;
        break;
      }
      case "bulletList": {
        for (const item of block.items) {
          const lines = wrap(item, 11);
          lines.forEach((line, index) => {
            pushPageBreak();
            rows.push({ text: line, x: margin + (index === 0 ? 14 : 22), y, size: 11 });
            y -= lineHeight(11);
          });
          if (lines.length) {
            rows.push({ text: "•", x: margin, y: y + lineHeight(11), size: 11, bold: true });
          }
          y -= 2;
        }
        break;
      }
      case "numberedList": {
        block.items.forEach((item, itemIndex) => {
          const lines = wrap(item, 11);
          lines.forEach((line, index) => {
            pushPageBreak();
            rows.push({ text: line, x: margin + (index === 0 ? 18 : 26), y, size: 11 });
            y -= lineHeight(11);
          });
          rows.push({
            text: `${itemIndex + 1}.`,
            x: margin,
            y: y + lineHeight(11),
            size: 11,
            bold: true,
          });
          y -= 2;
        });
        break;
      }
      case "table": {
        const headers = block.headers ?? [];
        const data = block.rows;
        const colCount = Math.max(headers.length, ...data.map(r => r.length), 1);
        const colWidth = contentWidth / colCount;
        const rowHeight = 22;
        const allRows = headers.length ? [headers, ...data] : data;
        const tableHeight = allRows.length * rowHeight + 4;
        if (y - tableHeight < margin) pushPageBreak();
        allRows.forEach((row, rowIndex) => {
          const isHeader = rowIndex === 0 && headers.length > 0;
          const cellHeight = isHeader ? rowHeight : rowHeight;
          if (y < margin + 20) {
            rows.push({ text: "\f", x: 0, y: 0, size: 0 });
            y = pageHeight - margin;
          }
          rows.push({
            text: "",
            x: margin,
            y: y + 2,
            size: 8,
            fill: isHeader ? hexShade(primaryColor) : 0.96,
          });
          for (let c = 0; c < colCount; c += 1) {
            const cellText = String(row[c] ?? "").slice(0, Math.floor(colWidth / 5.5));
            rows.push({
              text: cellText,
              x: margin + c * colWidth + 4,
              y: y + 6,
              size: isHeader ? 10 : 9.5,
              bold: isHeader,
            });
          }
          y -= cellHeight;
        });
        y -= 8;
        break;
      }
      case "pageBreak":
        rows.push({ text: "\f", x: 0, y: 0, size: 0 });
        y = pageHeight - margin;
        break;
      default:
        break;
    }
  }

  // Paginate
  const pages: Row[][] = [[]];
  rows.forEach(row => {
    if (row.text === "\f") pages.push([]);
    else pages[pages.length - 1].push(row);
  });
  const pageCount = pages.length;

  const objects: string[] = [];
  const pageIds: number[] = [];
  let objectId = 3;
  pages.forEach((page, pageIndex) => {
    const commands: string[] = [];
    // Page number footer
    commands.push(`BT /F1 9 Tf 1 0 0 1 ${pageWidth - margin - 40} 30 Tm (${pageIndex + 1} / ${pageCount}) Tj ET`);
    page.forEach(row => {
      if (row.fill !== undefined)
        commands.push(`${row.fill} g 0.3 w ${margin} ${row.y - 2} ${contentWidth} ${row.size + 4} re f`);
      const font = row.bold ? "F2" : "F1";
      commands.push(
        `BT /${font} ${row.size} Tf 1 0 0 1 ${row.x.toFixed(1)} ${row.y.toFixed(1)} Tm (${pdfEscape(row.text)}) Tj ET`
      );
    });
    pageIds.push(objectId);
    objects.push(`${objectId} 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${objectId + 1} 0 R >>\nendobj\n`);
    const stream = commands.join("\n");
    objects.push(`${objectId + 1} 0 obj\n<< /Length ${stream.length} >>\nstream\n${stream}\nendstream\nendobj\n`);
    objectId += 2;
  });

  const headerObjects = [
    "1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n",
    `2 0 obj\n<< /Type /Pages /Kids [${pageIds.map(id => `${id} 0 R`).join(" ")}] /Count ${pages.length} >>\nendobj\n`,
    "3 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n",
    "4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>\nendobj\n",
  ];
  const allObjects = [...headerObjects, ...objects];
  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  allObjects.forEach(object => {
    offsets.push(pdf.length);
    pdf += object;
  });
  const xrefOffset = pdf.length;
  pdf += `xref\n0 ${allObjects.length + 1}\n0000000000 65535 f \n${offsets
    .slice(1)
    .map(offset => `${String(offset).padStart(10, "0")} 00000 n \n`)
    .join("")}trailer\n<< /Size ${allObjects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
  return Buffer.from(pdf, "utf8");
}

// ---------------------------------------------------------------------------
// CSV / TXT / MD
// ---------------------------------------------------------------------------

function escapeCsv(value: string): string {
  const needsQuote = /[",\n\r]/.test(value);
  return needsQuote ? `"${value.replace(/"/g, '""')}"` : value;
}

export function generateCsv(spec: DocumentSpec): Buffer {
  const rows = spec.blocks
    ?.filter(b => b.type === "table")
    .flatMap(b => (b.type === "table" ? [b.headers ?? [], ...b.rows] : [])) ?? [];
  const header = spec.blocks
    ?.filter(b => b.type === "table" && b.headers?.length)
    .map(b => (b.type === "table" ? b.headers : []))
    .find(Boolean);
  const data = rows.filter((row, index) =>
    header ? index > 0 || !row.every((c, i) => c === (header as string[])[i]) : true
  );
  const lines = (header ? [header, ...data] : rows).map(row => row.map(escapeCsv).join(","));
  return Buffer.from(`\uFEFF${lines.join("\r\n")}`, "utf8");
}

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

export function generateMarkdown(spec: DocumentSpec): Buffer {
  const lines: string[] = [`# ${spec.title || "Document"}`, ""];
  for (const block of spec.blocks ?? []) {
    switch (block.type) {
      case "heading":
        lines.push(`${"#".repeat(block.level)} ${block.text}`, "");
        break;
      case "paragraph":
        lines.push(block.text, "");
        break;
      case "bulletList":
        block.items.forEach(item => lines.push(`- ${item}`));
        lines.push("");
        break;
      case "numberedList":
        block.items.forEach((item, i) => lines.push(`${i + 1}. ${item}`));
        lines.push("");
        break;
      case "table": {
        lines.push(`| ${(block.headers ?? []).join(" | ")} |`);
        lines.push(`| ${(block.headers ?? []).map(() => "---").join(" | ")} |`);
        block.rows.forEach(row => lines.push(`| ${row.join(" | ")} |`));
        lines.push("");
        break;
      }
      case "pageBreak":
        lines.push("---", "");
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

export async function generateDocument(spec: DocumentSpec): Promise<{
  buffer: Buffer;
  filename: string;
  mimeType: string;
}> {
  const filename = sanitizeFilename(spec.format, spec.filename);
  const mimeTypes: Record<string, string> = {
    pdf: "application/pdf",
    docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    csv: "text/csv",
    txt: "text/plain",
    md: "text/markdown",
  };
  let buffer: Buffer;
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
      buffer = generatePdf(spec);
      break;
    case "csv":
      buffer = generateCsv(spec);
      break;
    case "txt":
      buffer = generateTxt(spec);
      break;
    case "md":
      buffer = generateMarkdown(spec);
      break;
    default:
      throw new Error(`Unsupported document format: ${(spec as never as { format: string }).format}`);
  }
  return { buffer, filename, mimeType: mimeTypes[spec.format] };
}
