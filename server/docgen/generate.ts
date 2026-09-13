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
  DocCallout,
  DocComparison,
  DocProcessFlow,
  DocQuote,
  DocStatGrid,
  DocumentSpec,
  DocumentTheme,
  SheetCell,
  SheetDefinition,
  SlideDefinition,
  ThemeColors,
} from "./spec";
import { sanitizeFilename, THEME_PALETTES } from "./spec";

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

function getTheme(themeName?: DocumentTheme): ThemeColors {
  return THEME_PALETTES[themeName || "modern"] || THEME_PALETTES.modern;
}

function hexToRgb(hex: string) {
  const clean = hex.replace("#", "");
  const r = parseInt(clean.substring(0, 2), 16) / 255;
  const g = parseInt(clean.substring(2, 4), 16) / 255;
  const b = parseInt(clean.substring(4, 6), 16) / 255;
  return rgb(r, g, b);
}

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

function blockToDocxParagraph(block: DocBlock, theme: ThemeColors): (Paragraph | Table)[] | null {
  switch (block.type) {
    case "heading": {
      const headingLevels: Record<number, (typeof HeadingLevel)[keyof typeof HeadingLevel]> = {
        1: HeadingLevel.HEADING_1,
        2: HeadingLevel.HEADING_2,
        3: HeadingLevel.HEADING_3,
      };
      return [
        new Paragraph({
          children: [
            new TextRun({
              text: block.text,
              bold: true,
              color: block.level === 1 ? theme.primary : theme.secondary,
            }),
          ],
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
        color: block.color || theme.text,
      };
      const children: (TextRun | ExternalHyperlink)[] = block.link
        ? [
            new ExternalHyperlink({
              link: block.link,
              children: [new TextRun({ text: block.text, ...runOptions, color: block.color || theme.accent })],
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
    case "callout": {
      const calloutTitle = block.title || (block.variant ? block.variant.toUpperCase() : undefined);
      const paras: Paragraph[] = [];
      if (calloutTitle) {
        paras.push(
          new Paragraph({
            children: [new TextRun({ text: calloutTitle, bold: true, color: theme.accent, size: 20 })],
            spacing: { after: 60 },
          })
        );
      }
      paras.push(
        new Paragraph({
          children: [new TextRun({ text: block.text, color: theme.text, size: 20 })],
          spacing: { after: 40 },
        })
      );
      return [
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          borders: {
            left: { style: BorderStyle.SINGLE, size: 24, color: theme.accent },
            top: { style: BorderStyle.NONE },
            right: { style: BorderStyle.NONE },
            bottom: { style: BorderStyle.NONE },
            insideHorizontal: { style: BorderStyle.NONE },
            insideVertical: { style: BorderStyle.NONE },
          },
          rows: [
            new TableRow({
              children: [
                new TableCell({
                  shading: { type: ShadingType.CLEAR, fill: theme.surface },
                  children: paras,
                }),
              ],
            }),
          ],
        }),
        new Paragraph({ spacing: { after: 120 }, children: [new TextRun({ text: "" })] }),
      ];
    }
    case "statGrid": {
      const items = block.items || [];
      if (!items.length) return null;
      const count = Math.min(items.length, 4);
      const colWidth = Math.floor(100 / count);
      const cells = items.slice(0, count).map(it =>
        new TableCell({
          shading: { type: ShadingType.CLEAR, fill: theme.surface },
          children: [
            new Paragraph({
              alignment: AlignmentType.CENTER,
              children: [new TextRun({ text: it.value, bold: true, size: 34, color: theme.accent })],
              spacing: { before: 80, after: 40 },
            }),
            new Paragraph({
              alignment: AlignmentType.CENTER,
              children: [new TextRun({ text: it.label, size: 18, color: theme.muted, bold: true })],
              spacing: { after: 80 },
            }),
          ],
        })
      );
      return [
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          columnWidths: Array.from({ length: count }, () => colWidth),
          borders: {
            top: { style: BorderStyle.SINGLE, size: 4, color: theme.border },
            bottom: { style: BorderStyle.SINGLE, size: 4, color: theme.border },
            left: { style: BorderStyle.SINGLE, size: 4, color: theme.border },
            right: { style: BorderStyle.SINGLE, size: 4, color: theme.border },
            insideHorizontal: { style: BorderStyle.SINGLE, size: 4, color: theme.border },
            insideVertical: { style: BorderStyle.SINGLE, size: 4, color: theme.border },
          },
          rows: [new TableRow({ children: cells })],
        }),
        new Paragraph({ spacing: { after: 120 }, children: [new TextRun({ text: "" })] }),
      ];
    }
    case "processFlow": {
      const steps = block.steps || [];
      const paras: Paragraph[] = [];
      steps.forEach(st => {
        paras.push(
          new Paragraph({
            children: [
              new TextRun({ text: `Step ${st.step}: `, bold: true, color: theme.accent }),
              new TextRun({ text: st.title, bold: true, color: theme.primary }),
            ],
            spacing: { before: 100, after: 40 },
          })
        );
        paras.push(
          new Paragraph({
            children: [new TextRun({ text: st.description, color: theme.text })],
            indent: { left: 360 },
            spacing: { after: 80 },
          })
        );
      });
      return paras;
    }
    case "comparison": {
      const headers = block.headers || ["Feature", "Option A", "Option B"];
      const headerCells = headers.map(
        h =>
          new TableCell({
            shading: { type: ShadingType.CLEAR, fill: theme.surface },
            children: [new Paragraph({ children: [new TextRun({ text: h, bold: true, color: theme.primary })] })],
          })
      );
      const rows: TableRow[] = [new TableRow({ children: headerCells })];
      (block.rows || []).forEach(r => {
        const feat = Array.isArray(r) ? (r[0] ?? "") : (r.feature ?? "");
        const valA = Array.isArray(r) ? (r[1] ?? "") : (r.valA ?? "");
        const valB = Array.isArray(r) ? (r[2] ?? "") : (r.valB ?? "");
        rows.push(
          new TableRow({
            children: [
              new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: feat, bold: true })] })] }),
              new TableCell({ children: [new Paragraph({ text: valA })] }),
              new TableCell({ children: [new Paragraph({ text: valB })] }),
            ],
          })
        );
      });
      return [
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          borders: {
            top: { style: BorderStyle.SINGLE, size: 1, color: theme.border },
            bottom: { style: BorderStyle.SINGLE, size: 1, color: theme.border },
            left: { style: BorderStyle.SINGLE, size: 1, color: theme.border },
            right: { style: BorderStyle.SINGLE, size: 1, color: theme.border },
            insideHorizontal: { style: BorderStyle.SINGLE, size: 1, color: theme.border },
            insideVertical: { style: BorderStyle.SINGLE, size: 1, color: theme.border },
          },
          rows,
        }),
        new Paragraph({ spacing: { after: 120 }, children: [new TextRun({ text: "" })] }),
      ];
    }
    case "quote": {
      const paras: Paragraph[] = [
        new Paragraph({
          children: [new TextRun({ text: `“${block.text}”`, italics: true, color: theme.primary, size: 22 })],
          indent: { left: 720 },
          spacing: { before: 120, after: 60 },
        }),
      ];
      if (block.author) {
        paras.push(
          new Paragraph({
            children: [new TextRun({ text: `— ${block.author}${block.role ? ` (${block.role})` : ""}`, bold: true, size: 18, color: theme.muted })],
            indent: { left: 720 },
            spacing: { after: 140 },
          })
        );
      }
      return paras;
    }
    case "codeBlock":
      return [
        new Paragraph({
          children: [
            new TextRun({
              text: block.code,
              font: "Consolas",
              size: 19,
              color: "1E293B",
            }),
          ],
          shading: { type: ShadingType.CLEAR, fill: "F1F5F9" },
          spacing: { before: 100, after: 120 },
        }),
      ];
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
            shading: { type: ShadingType.CLEAR, fill: theme.surface },
            children: [new Paragraph({ children: [new TextRun({ text: header, bold: true, color: theme.primary })] })],
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
            top: { style: BorderStyle.SINGLE, size: 1, color: theme.border },
            bottom: { style: BorderStyle.SINGLE, size: 1, color: theme.border },
            left: { style: BorderStyle.SINGLE, size: 1, color: theme.border },
            right: { style: BorderStyle.SINGLE, size: 1, color: theme.border },
            insideHorizontal: { style: BorderStyle.SINGLE, size: 1, color: theme.border },
            insideVertical: { style: BorderStyle.SINGLE, size: 1, color: theme.border },
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
  const theme = getTheme(spec.theme);
  const paragraphs: (Paragraph | Table)[] = [];
  const blocks = spec.blocks ?? [];
  // Title heading
  paragraphs.push(
    new Paragraph({
      children: [
        new TextRun({
          text: spec.title || "Document",
          bold: true,
          color: theme.primary,
          size: 48,
        }),
      ],
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
    const converted = blockToDocxParagraph(block, theme);
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

function extractFormula(cell: SheetCell): string | null {
  if (cell && typeof cell === "object" && "formula" in cell && typeof cell.formula === "string") {
    return cell.formula.startsWith("=") ? cell.formula.slice(1) : cell.formula;
  }
  if (typeof cell === "string" && cell.startsWith("=") && cell.length > 1) {
    return cell.slice(1);
  }
  return null;
}

export function generateXlsx(spec: DocumentSpec): Buffer {
  const workbook = XLSX.utils.book_new();
  const sheets = spec.sheets?.length
    ? spec.sheets
    : ([
        {
          name: "Overview",
          rows: spec.blocks
            ? (spec.blocks
                .filter(b => b.type === "table")
                .flatMap(b => (b.type === "table" ? b.rows : [])) as SheetCell[][])
            : [],
        },
      ] as SheetDefinition[]);

  sheets.forEach((sheet, index) => {
    const rawRows = sheet.rows || [];
    const aoa = rawRows.map(row => row.map(cell => coerceCell(cell)));
    const ws = aoa.length > 0 ? XLSX.utils.aoa_to_sheet(aoa) : XLSX.utils.aoa_to_sheet([[]]);

    // Apply real formulas and number formatting to cells
    rawRows.forEach((row, rIdx) => {
      row.forEach((cell, cIdx) => {
        const formula = extractFormula(cell);
        const cellAddress = XLSX.utils.encode_cell({ r: rIdx, c: cIdx });
        if (formula) {
          const val =
            typeof cell === "object" && cell && "value" in cell && typeof cell.value === "number"
              ? cell.value
              : 0;
          ws[cellAddress] = { t: "n", f: formula, v: val };
        } else if (cell && typeof cell === "object" && "format" in cell) {
          if (!ws[cellAddress]) ws[cellAddress] = { t: "n", v: cell.value ?? 0 };
          if (cell.format === "currency") {
            ws[cellAddress].z = "$#,##0.00";
          } else if (cell.format === "percent") {
            ws[cellAddress].z = "0.0%";
          }
        }
      });
    });

    // Compute intelligent column widths
    const maxColCount = Math.max(...rawRows.map(r => r.length), 1);
    const colWidths: number[] = Array.from({ length: maxColCount }, () => 14);
    rawRows.forEach(row => {
      row.forEach((cell, cIdx) => {
        const textVal = String(coerceCell(cell) || "");
        if (textVal.length > colWidths[cIdx]) {
          colWidths[cIdx] = textVal.length;
        }
      });
    });
    ws["!cols"] = colWidths.map(len => ({
      wch: Math.max(14, Math.min(45, len + 3)),
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
  const theme = getTheme(spec.theme);

  const slides = spec.slides?.length
    ? spec.slides
    : buildSlidesFromBlocks(spec.blocks ?? []);

  slides.forEach((slide, index) => {
    const s = pptx.addSlide();

    // 1. Title slide (first slide or explicit layout === "title")
    if (index === 0 || slide.layout === "title") {
      s.addText(slide.title || spec.title || "Presentation", {
        x: 0.8,
        y: 1.8,
        w: 11.5,
        h: 1.6,
        fontSize: 40,
        bold: true,
        color: theme.primary,
        align: "left",
      });
      if (slide.subtitle) {
        s.addText(slide.subtitle, {
          x: 0.8,
          y: 3.6,
          w: 11.5,
          h: 0.8,
          fontSize: 20,
          color: theme.muted,
        });
      }
      if (slide.bullets?.length) {
        s.addText(slide.bullets.map(b => ({ text: b, options: { bullet: true } })), {
          x: 0.8,
          y: 4.6,
          w: 11.5,
          h: 2.2,
          fontSize: 16,
          color: theme.text,
        });
      }
      return;
    }

    // Header for content slides
    if (slide.title) {
      s.addText(slide.title, {
        x: 0.8,
        y: 0.45,
        w: 11.5,
        h: 0.7,
        fontSize: 26,
        bold: true,
        color: theme.primary,
      });
      if (slide.subtitle) {
        s.addText(slide.subtitle, {
          x: 0.8,
          y: 1.15,
          w: 11.5,
          h: 0.45,
          fontSize: 13,
          color: theme.muted,
        });
      }
    }

    const contentTop = slide.subtitle ? 1.7 : 1.4;

    // 2. Big Number / Stats Layout
    if (
      slide.layout === "big_number" ||
      slide.layout === "stats" ||
      (slide.metrics && slide.metrics.length > 0)
    ) {
      const metrics = slide.metrics || [];
      const count = Math.min(Math.max(metrics.length, 1), 4);
      const gap = 0.3;
      const totalW = 11.6;
      const cardW = (totalW - (count - 1) * gap) / count;

      metrics.slice(0, 4).forEach((m, idx) => {
        const x = 0.8 + idx * (cardW + gap);
        // Card background shape
        s.addShape(pptx.ShapeType.roundRect, {
          x,
          y: contentTop + 0.4,
          w: cardW,
          h: 4.2,
          fill: { color: theme.surface },
          line: { color: theme.border, width: 1 },
          rectRadius: 0.1,
        });
        // Big metric value
        s.addText(m.value, {
          x,
          y: contentTop + 0.9,
          w: cardW,
          h: 1.4,
          fontSize: 42,
          bold: true,
          color: theme.accent,
          align: "center",
        });
        // Label
        s.addText(m.label, {
          x: x + 0.1,
          y: contentTop + 2.5,
          w: cardW - 0.2,
          h: 1.0,
          fontSize: 15,
          bold: true,
          color: theme.primary,
          align: "center",
        });
        // Change badge if provided
        if (m.change) {
          s.addText(m.change, {
            x,
            y: contentTop + 3.6,
            w: cardW,
            h: 0.5,
            fontSize: 13,
            color: theme.secondary,
            align: "center",
          });
        }
      });
      if (slide.footnote) {
        s.addText(slide.footnote, { x: 0.8, y: 6.9, w: 11.5, h: 0.4, fontSize: 10, color: theme.muted });
      }
      return;
    }

    // 3. Multi-Column Layout (two_column or three_column)
    if (
      slide.layout === "two_column" ||
      slide.layout === "three_column" ||
      (slide.columns && slide.columns.length >= 2)
    ) {
      const cols = slide.columns || [];
      const colCount = slide.layout === "three_column" || cols.length === 3 ? 3 : 2;
      const gap = 0.4;
      const totalW = 11.6;
      const colW = (totalW - (colCount - 1) * gap) / colCount;

      cols.slice(0, colCount).forEach((c, idx) => {
        const x = 0.8 + idx * (colW + gap);
        s.addShape(pptx.ShapeType.roundRect, {
          x,
          y: contentTop,
          w: colW,
          h: 5.0,
          fill: { color: theme.surface },
          line: { color: theme.border, width: 1 },
          rectRadius: 0.08,
        });
        if (c.title) {
          s.addText(c.title, {
            x: x + 0.3,
            y: contentTop + 0.3,
            w: colW - 0.6,
            h: 0.6,
            fontSize: 18,
            bold: true,
            color: theme.primary,
          });
        }
        if (c.text) {
          s.addText(c.text, {
            x: x + 0.3,
            y: contentTop + 1.0,
            w: colW - 0.6,
            h: 1.2,
            fontSize: 13.5,
            color: theme.text,
          });
        }
        if (c.bullets?.length) {
          s.addText(c.bullets.map(b => ({ text: b, options: { bullet: true } })), {
            x: x + 0.3,
            y: contentTop + (c.text ? 2.3 : 1.0),
            w: colW - 0.6,
            h: c.text ? 2.4 : 3.6,
            fontSize: 13.5,
            color: theme.text,
          });
        }
      });
      if (slide.footnote) {
        s.addText(slide.footnote, { x: 0.8, y: 6.9, w: 11.5, h: 0.4, fontSize: 10, color: theme.muted });
      }
      return;
    }

    // 4. Process Flow Layout
    if (slide.layout === "process" || (slide.steps && slide.steps.length > 0)) {
      const steps = slide.steps || [];
      const count = Math.min(Math.max(steps.length, 1), 4);
      const gap = 0.35;
      const totalW = 11.6;
      const cardW = (totalW - (count - 1) * gap) / count;

      steps.slice(0, count).forEach((st, idx) => {
        const x = 0.8 + idx * (cardW + gap);
        s.addShape(pptx.ShapeType.roundRect, {
          x,
          y: contentTop + 0.5,
          w: cardW,
          h: 4.2,
          fill: { color: theme.surface },
          line: { color: theme.border, width: 1 },
          rectRadius: 0.1,
        });
        // Step badge
        s.addShape(pptx.ShapeType.rect, {
          x: x + 0.3,
          y: contentTop + 0.8,
          w: 1.2,
          h: 0.4,
          fill: { color: theme.accent },
        });
        s.addText(`STEP ${st.step}`, {
          x: x + 0.3,
          y: contentTop + 0.8,
          w: 1.2,
          h: 0.4,
          fontSize: 11,
          bold: true,
          color: "FFFFFF",
          align: "center",
        });
        // Title
        s.addText(st.title, {
          x: x + 0.3,
          y: contentTop + 1.4,
          w: cardW - 0.6,
          h: 0.8,
          fontSize: 16,
          bold: true,
          color: theme.primary,
        });
        // Description
        s.addText(st.description, {
          x: x + 0.3,
          y: contentTop + 2.3,
          w: cardW - 0.6,
          h: 2.1,
          fontSize: 13,
          color: theme.text,
        });
      });
      if (slide.footnote) {
        s.addText(slide.footnote, { x: 0.8, y: 6.9, w: 11.5, h: 0.4, fontSize: 10, color: theme.muted });
      }
      return;
    }

    // 5. Key Message / Takeaway Layout
    if (slide.layout === "key_message" || slide.keyMessage) {
      s.addShape(pptx.ShapeType.roundRect, {
        x: 1.2,
        y: contentTop + 0.6,
        w: 10.8,
        h: 3.8,
        fill: { color: theme.surface },
        line: { color: theme.accent, width: 2 },
        rectRadius: 0.15,
      });
      s.addText(slide.keyMessage?.statement || slide.title || "", {
        x: 1.6,
        y: contentTop + 1.1,
        w: 10.0,
        h: 1.6,
        fontSize: 26,
        bold: true,
        color: theme.primary,
        align: "center",
      });
      if (slide.keyMessage?.context || slide.subtitle) {
        s.addText(slide.keyMessage?.context || slide.subtitle || "", {
          x: 1.6,
          y: contentTop + 2.8,
          w: 10.0,
          h: 1.2,
          fontSize: 16,
          color: theme.muted,
          align: "center",
        });
      }
      if (slide.footnote) {
        s.addText(slide.footnote, { x: 0.8, y: 6.9, w: 11.5, h: 0.4, fontSize: 10, color: theme.muted });
      }
      return;
    }

    // 6. Quote Layout
    if (slide.layout === "quote" || slide.quote) {
      s.addText("“", {
        x: 1.2,
        y: contentTop + 0.4,
        w: 1.5,
        h: 1.2,
        fontSize: 64,
        bold: true,
        color: theme.accent,
      });
      s.addText(slide.quote?.text || "", {
        x: 1.8,
        y: contentTop + 1.2,
        w: 9.6,
        h: 2.6,
        fontSize: 22,
        italic: true,
        color: theme.primary,
      });
      if (slide.quote?.author) {
        s.addText(`— ${slide.quote.author}`, {
          x: 1.8,
          y: contentTop + 4.0,
          w: 9.6,
          h: 0.6,
          fontSize: 16,
          bold: true,
          color: theme.secondary,
        });
      }
      if (slide.footnote) {
        s.addText(slide.footnote, { x: 0.8, y: 6.9, w: 11.5, h: 0.4, fontSize: 10, color: theme.muted });
      }
      return;
    }

    // 7. Table or Standard Bullets
    const bullets = slide.bullets ?? [];
    if (bullets.length) {
      s.addText(bullets.map(b => ({ text: b, options: { bullet: true } })), {
        x: 0.8,
        y: contentTop,
        w: 11.6,
        h: slide.table ? 2.4 : 5.0,
        fontSize: 16,
        color: theme.text,
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
              color: r === 0 && header.length > 0 ? "FFFFFF" : theme.text,
              fill: { color: r === 0 && header.length > 0 ? theme.primary : theme.surface },
            },
          }))
        );
        s.addTable(tableRows, {
          x: 0.8,
          y: bullets.length ? contentTop + 2.6 : contentTop,
          w: 11.6,
          colW: colWidths,
          fontSize: 13,
          border: { pt: 0.5, color: theme.border },
        });
      }
    }

    if (slide.footnote) {
      s.addText(slide.footnote, { x: 0.8, y: 6.9, w: 11.5, h: 0.4, fontSize: 10, color: theme.muted });
    }
  });

  return (await pptx.write({ outputType: "nodebuffer" })) as Buffer;
}

function buildSlidesFromBlocks(blocks: DocBlock[]): SlideDefinition[] {
  const slides: SlideDefinition[] = [];
  let current: SlideDefinition | null = null;
  const flush = () => {
    if (current && (current.bullets?.length || current.table || current.metrics?.length || current.steps?.length || current.quote)) {
      slides.push(current);
    }
    current = null;
  };
  for (const block of blocks) {
    if (block.type === "heading") {
      flush();
      current = { title: block.text, bullets: [] };
    } else if (block.type === "statGrid") {
      flush();
      const items = block.items || block.metrics || [];
      slides.push({
        title: "Key Metrics & Insights",
        layout: "stats",
        metrics: items.map(it => ({ value: it.value, label: it.label, change: it.change })),
      });
    } else if (block.type === "processFlow") {
      flush();
      slides.push({
        title: "Operational Process",
        layout: "process",
        steps: block.steps,
      });
    } else if (block.type === "quote") {
      flush();
      slides.push({
        layout: "quote",
        quote: { text: block.text, author: block.author },
      });
    } else if (block.type === "comparison") {
      flush();
      slides.push({
        title: "Comparative Analysis",
        layout: "table",
        table: {
          headers: Array.isArray(block.headers) ? block.headers : ["Feature", "Option A", "Option B"],
          rows: (block.rows || []).map(r =>
            Array.isArray(r) ? [r[0] ?? "", r[1] ?? "", r[2] ?? ""] : [r.feature, r.valA, r.valB]
          ),
        },
      });
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
  if (!slides.length) slides.push({ title: "Overview", bullets: [] });
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

  const theme = getTheme(spec.theme);
  const colorPrimary = hexToRgb(theme.primary);
  const colorSecondary = hexToRgb(theme.secondary);
  const colorAccent = hexToRgb(theme.accent);
  const colorSurface = hexToRgb(theme.surface);
  const colorBorder = hexToRgb(theme.border);
  const colorText = hexToRgb(theme.text);
  const colorMuted = hexToRgb(theme.muted);

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
  const titleLines = wrapText(titleText, 22, contentWidth, fontBold);
  for (const line of titleLines) {
    ensureSpace(32);
    page.drawText(line, {
      x: margin,
      y,
      size: 22,
      font: fontBold,
      color: colorPrimary,
    });
    y -= 28;
  }

  // Accent horizontal divider
  ensureSpace(14);
  page.drawLine({
    start: { x: margin, y: y + 8 },
    end: { x: margin + contentWidth, y: y + 8 },
    thickness: 2,
    color: colorAccent,
  });
  y -= 16;

  const blocks = spec.blocks ?? [];
  for (const block of blocks) {
    switch (block.type) {
      case "heading": {
        const size = block.level === 1 ? 16 : block.level === 2 ? 13 : 11;
        const font = fontBold;
        const headingLines = wrapText(block.text, size, contentWidth, font);
        // Widow prevention: heading + at least 3 lines of following content
        ensureSpace(headingLines.length * (size + 6) + 40);
        y -= 12;
        for (const line of headingLines) {
          page.drawText(line, {
            x: margin,
            y,
            size,
            font,
            color: block.level === 1 ? colorPrimary : colorSecondary,
          });
          y -= size + 5;
        }
        y -= 4;
        break;
      }
      case "paragraph": {
        const size = block.size ?? 10;
        const font = block.bold ? fontBold : block.italic ? fontOblique : fontRegular;
        const color = block.color ? hexToRgb(block.color) : colorText;
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
                color: colorAccent,
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
                color: colorAccent,
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
      case "callout": {
        const calloutTitle = block.title || (block.variant ? block.variant.toUpperCase() : undefined);
        const titleLines = calloutTitle ? wrapText(calloutTitle, 10, contentWidth - 28, fontBold) : [];
        const textLines = wrapText(block.text, 9.5, contentWidth - 28, fontRegular);
        const boxHeight = (titleLines.length ? titleLines.length * 14 : 0) + textLines.length * 13 + 18;

        ensureSpace(boxHeight + 10);
        y -= 6;
        // Background
        page.drawRectangle({
          x: margin,
          y: y - boxHeight + 6,
          width: contentWidth,
          height: boxHeight,
          color: colorSurface,
          borderColor: colorBorder,
          borderWidth: 0.5,
        });
        // Left accent bar
        page.drawRectangle({
          x: margin,
          y: y - boxHeight + 6,
          width: 3.5,
          height: boxHeight,
          color: colorAccent,
        });
        let curY = y - 4;
        for (const line of titleLines) {
          page.drawText(line, {
            x: margin + 16,
            y: curY,
            size: 10,
            font: fontBold,
            color: colorAccent,
          });
          curY -= 14;
        }
        for (const line of textLines) {
          page.drawText(line, {
            x: margin + 16,
            y: curY,
            size: 9.5,
            font: fontRegular,
            color: colorText,
          });
          curY -= 13;
        }
        y -= boxHeight + 6;
        break;
      }
      case "statGrid": {
        const items = block.items || [];
        if (!items.length) break;
        const count = Math.min(items.length, 4);
        const gap = 10;
        const cardW = (contentWidth - (count - 1) * gap) / count;
        const cardH = 50;

        ensureSpace(cardH + 14);
        y -= 6;
        items.slice(0, count).forEach((it, idx) => {
          const cardX = margin + idx * (cardW + gap);
          page.drawRectangle({
            x: cardX,
            y: y - cardH + 4,
            width: cardW,
            height: cardH,
            color: colorSurface,
            borderColor: colorBorder,
            borderWidth: 0.5,
          });
          page.drawText(it.value, {
            x: cardX + 10,
            y: y - 18,
            size: 16,
            font: fontBold,
            color: colorAccent,
          });
          const labelLines = wrapText(it.label, 8.5, cardW - 20, fontBold);
          if (labelLines[0]) {
            page.drawText(labelLines[0], {
              x: cardX + 10,
              y: y - 32,
              size: 8.5,
              font: fontRegular,
              color: colorMuted,
            });
          }
        });
        y -= cardH + 10;
        break;
      }
      case "processFlow": {
        const steps = block.steps || [];
        for (const st of steps) {
          const descLines = wrapText(st.description, 9.5, contentWidth - 36, fontRegular);
          const stepHeight = 16 + descLines.length * 13 + 8;
          ensureSpace(stepHeight + 4);

          // Step numeral badge
          page.drawRectangle({
            x: margin + 2,
            y: y - 12,
            width: 16,
            height: 16,
            color: colorAccent,
          });
          page.drawText(String(st.step), {
            x: margin + 7,
            y: y - 9,
            size: 9,
            font: fontBold,
            color: rgb(1, 1, 1),
          });
          // Step title
          page.drawText(st.title, {
            x: margin + 26,
            y: y - 8,
            size: 10.5,
            font: fontBold,
            color: colorPrimary,
          });
          let descY = y - 22;
          for (const line of descLines) {
            page.drawText(line, {
              x: margin + 26,
              y: descY,
              size: 9.5,
              font: fontRegular,
              color: colorText,
            });
            descY -= 13;
          }
          y -= stepHeight + 2;
        }
        y -= 6;
        break;
      }
      case "comparison": {
        const headers = block.headers || ["Feature", "Option A", "Option B"];
        const rows = block.rows || [];
        const allRows = [
          headers,
          ...rows.map(r => (Array.isArray(r) ? [r[0] ?? "", r[1] ?? "", r[2] ?? ""] : [r.feature, r.valA, r.valB])),
        ];
        const colW = contentWidth / 3;
        const rowH = 22;

        ensureSpace(rowH * allRows.length + 10);
        y -= 6;
        allRows.forEach((r, rIdx) => {
          const isHdr = rIdx === 0;
          ensureSpace(rowH);
          if (isHdr) {
            page.drawRectangle({
              x: margin,
              y: y - 4,
              width: contentWidth,
              height: rowH,
              color: colorSurface,
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
          for (let c = 0; c < 3; c++) {
            const txt = String(r[c] ?? "");
            page.drawText(txt.length > 25 ? `${txt.slice(0, 23)}...` : txt, {
              x: margin + c * colW + 6,
              y: y + 2,
              size: isHdr ? 9.5 : 9,
              font: isHdr || c === 0 ? fontBold : fontRegular,
              color: isHdr ? colorPrimary : colorText,
            });
          }
          y -= rowH;
        });
        y -= 8;
        break;
      }
      case "quote": {
        const textLines = wrapText(`“${block.text}”`, 10.5, contentWidth - 28, fontOblique);
        const quoteH = textLines.length * 14 + (block.author ? 18 : 6);
        ensureSpace(quoteH + 8);
        y -= 6;
        page.drawRectangle({
          x: margin + 2,
          y: y - quoteH + 6,
          width: 2.5,
          height: quoteH,
          color: colorAccent,
        });
        let curY = y - 4;
        for (const line of textLines) {
          page.drawText(line, {
            x: margin + 14,
            y: curY,
            size: 10.5,
            font: fontOblique,
            color: colorPrimary,
          });
          curY -= 14;
        }
        if (block.author) {
          page.drawText(`— ${block.author}${block.role ? ` (${block.role})` : ""}`, {
            x: margin + 14,
            y: curY - 2,
            size: 9,
            font: fontBold,
            color: colorMuted,
          });
        }
        y -= quoteH + 8;
        break;
      }
      case "codeBlock": {
        const codeLines = block.code.split("\n");
        const codeH = Math.min(codeLines.length * 12 + 14, 250);
        ensureSpace(codeH + 8);
        y -= 4;
        page.drawRectangle({
          x: margin,
          y: y - codeH + 6,
          width: contentWidth,
          height: codeH,
          color: colorSurface,
          borderColor: colorBorder,
          borderWidth: 0.5,
        });
        let cY = y - 6;
        for (const line of codeLines.slice(0, 18)) {
          page.drawText(line.slice(0, 75), {
            x: margin + 8,
            y: cY,
            size: 8.5,
            font: fontRegular,
            color: colorText,
          });
          cY -= 12;
        }
        y -= codeH + 8;
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
              color: colorSurface,
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
      case "callout":
        lines.push(`[${block.title || (block.variant ? block.variant.toUpperCase() : "NOTE")}]: ${block.text}`, "");
        break;
      case "statGrid": {
        const metrics = block.metrics || (block as any).items || [];
        metrics.forEach((it: any) => lines.push(`  • ${it.label}: ${it.value}${it.change ? ` (${it.change})` : ""}`));
        lines.push("");
        break;
      }
      case "processFlow":
        (block.steps || []).forEach(st => lines.push(`  Step ${st.step}: ${st.title}\n    ${st.description}`));
        lines.push("");
        break;
      case "comparison": {
        const cols = block.columns || (block as any).headers;
        if (cols && Array.isArray(cols)) lines.push(cols.join("\t"));
        (block.rows || []).forEach((r: any) => {
          if (Array.isArray(r)) {
            lines.push(r.join("\t"));
          } else if (r && typeof r === "object") {
            lines.push(`${r.feature ?? ""}\t${r.valA ?? ""}\t${r.valB ?? ""}`);
          }
        });
        lines.push("");
        break;
      }
      case "quote":
        lines.push(`"${block.text}"${block.author ? ` — ${block.author}` : ""}`, "");
        break;
      case "codeBlock":
        lines.push("```" + (block.language || ""));
        lines.push(block.code);
        lines.push("```", "");
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
