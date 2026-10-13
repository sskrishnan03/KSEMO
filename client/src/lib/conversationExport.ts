import {
  AlignmentType,
  Document,
  ExternalHyperlink,
  HeadingLevel,
  Packer,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from "docx";
import {
  PDFDocument,
  PDFArray,
  PDFDict,
  PDFName,
  PDFString,
  StandardFonts,
  rgb,
  type PDFFont,
  type PDFPage,
} from "pdf-lib";
import { marked } from "marked";

export function createPdfFile(text: string) {
  const rawLines = text.replace(/[^\x20-\x7e\n]/g, "?").split("\n");
  const lines = rawLines.flatMap(line => line.match(/.{1,78}/g) || [""]);
  const linesPerPage = 54;
  const pages = Array.from(
    { length: Math.max(1, Math.ceil(lines.length / linesPerPage)) },
    (_, index) => lines.slice(index * linesPerPage, (index + 1) * linesPerPage)
  );
  const pageIds = pages.map((_, index) => 4 + index * 2);
  const objects = [
    "1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n",
    `2 0 obj\n<< /Type /Pages /Kids [${pageIds.map(id => `${id} 0 R`).join(" ")}] /Count ${pages.length} >>\nendobj\n`,
    "3 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n",
  ];
  pages.forEach((page, pageIndex) => {
    const pageId = pageIds[pageIndex];
    const contentId = pageId + 1;
    const commands = page
      .map(
        (line, index) =>
          `BT /F1 10 Tf 1 0 0 1 50 ${790 - index * 13} Tm (${line.replace(/[()\\]/g, "\\$&")}) Tj ET`
      )
      .join("\n");
    objects.push(
      `${pageId} 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 842] /Resources << /Font << /F1 3 0 R >> >> /Contents ${contentId} 0 R >>\nendobj\n`
    );
    objects.push(
      `${contentId} 0 obj\n<< /Length ${commands.length} >>\nstream\n${commands}\nendstream\nendobj\n`
    );
  });
  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  objects.forEach(object => {
    offsets.push(pdf.length);
    pdf += object;
  });
  const xrefOffset = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets
    .slice(1)
    .map(offset => `${String(offset).padStart(10, "0")} 00000 n \n`)
    .join(
      ""
    )}trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
  return new Blob([pdf], { type: "application/pdf" });
}

export type ExportConversationMessage = {
  role: "user" | "assistant" | "system" | "tool";
  content: string;
  attachments?: Array<{ filename: string; url?: string | null }>;
};

function addPdfLink(page: PDFPage, x: number, y: number, width: number, height: number, url: string, pdf: PDFDocument) {
  try {
    const action = pdf.context.obj({ S: "URI", URI: PDFString.of(url) });
    const annotation = pdf.context.obj({
      Type: "Annot", Subtype: "Link", Rect: [x, y, x + width, y + height],
      Border: [0, 0, 0], A: action,
    }) as PDFDict;
    const current = page.node.lookupMaybe(PDFName.of("Annots"), PDFArray) ?? pdf.context.obj([]);
    current.push(pdf.context.register(annotation));
    page.node.set(PDFName.of("Annots"), current);
  } catch {
    // Keep the export usable if a malformed attachment URL cannot be linked.
  }
}

function pdfEscape(value: string) {
  return value.replace(/[()\\]/g, "\\$&").replace(/[^\x20-\x7e]/g, "?");
}

function wrapExportLine(value: string, width = 56) {
  const words = value.replace(/\s+/g, " ").trim().split(" ");
  const lines: string[] = [];
  let current = "";
  words.forEach(word => {
    const next = current ? `${current} ${word}` : word;
    if (next.length > width && current) {
      lines.push(current);
      current = word;
    } else current = next;
  });
  if (current) lines.push(current);
  return lines.length ? lines : [""];
}

function legacyCreateConversationPdfFile(
  title: string,
  messages: ExportConversationMessage[]
) {
  const pageWidth = 612;
  const margin = 42;
  const rows: Array<{
    text: string;
    x: number;
    y: number;
    size: number;
    shade?: number;
  }> = [];
  let y = 794;
  const pushPageBreak = () => {
    if (y < 68) {
      rows.push({ text: "\f", x: 0, y: 0, size: 0 });
      y = 794;
    }
  };
  rows.push({ text: title || "KSEMO conversation", x: margin, y, size: 18 });
  y -= 30;
  messages
    .filter(message => message.role === "user" || message.role === "assistant")
    .forEach(message => {
      const isUser = message.role === "user";
      const lines = wrapExportLine(message.content, 94);
      const label = isUser ? "You" : "KSEMO";
      pushPageBreak();
      const labelWidth = label.length * 5.5;
      rows.push({
        text: label,
        x: isUser ? pageWidth - margin - labelWidth : margin,
        y,
        size: 9,
        shade: 0.45,
      });
      y -= 14;
      lines.forEach(line => {
        pushPageBreak();
        const estimatedWidth = line.length * 5.2;
        rows.push({
          text: line,
          x: isUser
            ? Math.max(margin, pageWidth - margin - estimatedWidth)
            : margin,
          y,
          size: 10,
        });
        y -= 13;
      });
      y -= 10;
    });
  const pages: (typeof rows)[] = [[]];
  rows.forEach(row => {
    if (row.text === "\f") pages.push([]);
    else pages[pages.length - 1].push(row);
  });
  const pageIds = pages.map((_, index) => 4 + index * 2);
  const objects = [
    "1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n",
    `2 0 obj\n<< /Type /Pages /Kids [${pageIds.map(id => `${id} 0 R`).join(" ")}] /Count ${pages.length} >>\nendobj\n`,
    "3 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n",
  ];
  pages.forEach((page, pageIndex) => {
    const pageId = pageIds[pageIndex];
    const contentId = pageId + 1;
    const commands = page
      .map(
        row =>
          `${row.shade !== undefined ? `${row.shade} g ` : "0 g "}BT /F1 ${row.size} Tf 1 0 0 1 ${row.x.toFixed(1)} ${row.y.toFixed(1)} Tm (${pdfEscape(row.text)}) Tj ET`
      )
      .join("\n");
    objects.push(
      `${pageId} 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 842] /Resources << /Font << /F1 3 0 R >> >> /Contents ${contentId} 0 R >>\nendobj\n`
    );
    objects.push(
      `${contentId} 0 obj\n<< /Length ${commands.length} >>\nstream\n${commands}\nendstream\nendobj\n`
    );
  });
  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  objects.forEach(object => {
    offsets.push(pdf.length);
    pdf += object;
  });
  const xrefOffset = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets
    .slice(1)
    .map(offset => `${String(offset).padStart(10, "0")} 00000 n \n`)
    .join(
      ""
    )}trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
  return new Blob([pdf], { type: "application/pdf" });
}

function legacyCreateConversationWordFile(
  title: string,
  messages: ExportConversationMessage[]
) {
  const escapeHtml = (value: string) =>
    value.replace(
      /[&<>"]/g,
      character =>
        ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[
          character
        ] ?? character
    );
  const turns = messages
    .filter(message => message.role === "user" || message.role === "assistant")
    .map(message => {
      const isUser = message.role === "user";
      return `<div class="turn ${isUser ? "user" : "assistant"}"><div class="label">${isUser ? "You" : "KSEMO"}</div><div class="bubble">${escapeHtml(message.content).replace(/\n/g, "<br/>")}</div></div>`;
    })
    .join("");
  return new Blob(
    [
      `<html><head><meta charset="utf-8"/><style>body{font-family:Arial,sans-serif;color:#171717;margin:42px;line-height:1.5}h1{font-size:24px;margin:0 0 30px}.turn{display:block;width:100%;margin:0 0 18px;clear:both}.turn.user{text-align:right}.turn.assistant{text-align:left}.label{font-size:10px;font-weight:700;letter-spacing:.08em;color:#666;text-transform:uppercase;margin:0 0 5px}.bubble{display:block;box-sizing:border-box;width:94%;padding:12px 14px;border:1px solid #d7d7d7;border-radius:12px;text-align:left;white-space:pre-wrap;word-wrap:break-word}.user .bubble{margin-left:auto;background:#f1f1f1}.assistant .bubble{margin-right:auto;background:#fff}</style></head><body><h1>${escapeHtml(title || "KSEMO conversation")}</h1>${turns}</body></html>`,
    ],
    { type: "application/msword" }
  );
}

type MarkdownToken = {
  type: string;
  text?: string;
  raw?: string;
  href?: string;
  depth?: number;
  ordered?: boolean;
  start?: number | "";
  tokens?: MarkdownToken[];
  items?: MarkdownToken[];
  header?: MarkdownToken[];
  rows?: MarkdownToken[][];
};

type ExportBlock = {
  type: "paragraph" | "heading" | "code" | "quote" | "list" | "table" | "hr";
  text?: string;
  tokens?: MarkdownToken[];
  depth?: number;
  level?: number;
  marker?: string;
  rows?: string[][];
};

function markdownText(tokens: MarkdownToken[] = []): string {
  return tokens
    .map(token => {
      if (token.type === "br") return "\n";
      if (token.type === "link") {
        const label = markdownText(token.tokens ?? []) || token.text || "";
        return token.href && token.href !== label ? `${label} (${token.href})` : label;
      }
      if (token.type === "image") return token.text ? `[Image: ${token.text}]` : "[Image]";
      if (token.tokens?.length) return markdownText(token.tokens);
      return token.text ?? (token.type === "html" ? "" : token.raw ?? "");
    })
    .join("");
}

function markdownBlocks(source: string): ExportBlock[] {
  const blocks: ExportBlock[] = [];
  const append = (tokens: MarkdownToken[], listDepth = 0, quoted = false) => {
    tokens.forEach(token => {
      if (token.type === "heading" || token.type === "paragraph") {
        blocks.push({
          type: quoted ? "quote" : token.type,
          text: markdownText(token.tokens ?? []) || token.text || "",
          tokens: token.tokens,
          level: token.depth,
        });
      } else if (token.type === "code") {
        blocks.push({ type: "code", text: token.text ?? "" });
      } else if (token.type === "blockquote") {
        append(token.tokens ?? [], listDepth, true);
      } else if (token.type === "list") {
        (token.items ?? []).forEach((item, index) => {
          const itemTokens = item.tokens ?? [];
          const ownTokens = itemTokens.filter(child => child.type !== "list");
          const text = markdownText(ownTokens).trim() || item.text || "";
          const ordinal = Number(token.start) || 1;
          blocks.push({
            type: "list",
            text,
            tokens: ownTokens,
            depth: listDepth,
            marker: token.ordered ? `${ordinal + index}.` : "•",
          });
          itemTokens
            .filter(child => child.type === "list")
            .forEach(child => append([child], listDepth + 1));
        });
      } else if (token.type === "table") {
        const cellText = (cell: MarkdownToken) =>
          markdownText(cell.tokens ?? []) || cell.text || "";
        blocks.push({
          type: "table",
          rows: [
            (token.header ?? []).map(cellText),
            ...(token.rows ?? []).map(row => row.map(cellText)),
          ],
        });
      } else if (token.type === "hr") {
        blocks.push({ type: "hr" });
      }
    });
  };
  append(marked.lexer(source) as unknown as MarkdownToken[]);
  return blocks;
}

type InlineStyle = { bold?: boolean; italic?: boolean; strike?: boolean; code?: boolean };

function makeWordRuns(tokens: MarkdownToken[] = [], style: InlineStyle = {}): TextRun[] {
  const runs: TextRun[] = [];
  const addText = (text: string, runStyle: InlineStyle = style) => {
    if (!text) return;
    runs.push(
      new TextRun({
        text,
        bold: runStyle.bold,
        italics: runStyle.italic,
        strike: runStyle.strike,
        font: runStyle.code ? "Consolas" : "Aptos",
        color: runStyle.code ? "374151" : "202124",
      })
    );
  };
  tokens.forEach(token => {
    const nested = token.tokens ?? [];
    if (["strong", "em", "del"].includes(token.type)) {
      runs.push(
        ...makeWordRuns(nested, {
          bold: style.bold || token.type === "strong",
          italic: style.italic || token.type === "em",
          strike: style.strike || token.type === "del",
          code: style.code,
        })
      );
    } else if (token.type === "codespan") {
      addText(token.text ?? "", { ...style, code: true });
    } else if (token.type === "link") {
      addText(markdownText(nested) || token.text || "");
      if (token.href) addText(` (${token.href})`);
    } else if (token.type === "image") {
      addText(token.text ? `[Image: ${token.text}]` : "[Image]");
    } else if (token.type === "br") {
      addText("\n");
    } else if (nested.length) {
      runs.push(...makeWordRuns(nested, style));
    } else if (token.type !== "html") {
      addText(token.text ?? token.raw ?? "");
    }
  });
  return runs;
}

function wordParagraphs(block: ExportBlock, isUser: boolean): Paragraph[] | Table[] {
  if (block.type === "hr") return [];
  if (block.type === "table") {
    const rows = (block.rows ?? []).filter(row => row.length > 0);
    if (!rows.length) return [];
    const columnCount = Math.max(...rows.map(row => row.length));
    return [
      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: rows.map((row, rowIndex) =>
          new TableRow({
            children: Array.from({ length: columnCount }, (_, cellIndex) =>
              new TableCell({
                width: { size: 100 / columnCount, type: WidthType.PERCENTAGE },
                shading:
                  rowIndex === 0
                    ? { type: ShadingType.CLEAR, fill: "E9EDF2" }
                    : undefined,
                children: [
                  new Paragraph({
                    children: [
                      new TextRun({
                        text: row[cellIndex] ?? "",
                        bold: rowIndex === 0,
                        font: "Aptos",
                        size: 20,
                      }),
                    ],
                  }),
                ],
              })
            ),
          })
        ),
      }),
    ];
  }

  const text = block.text ?? "";
  const prefix =
    block.type === "list"
      ? `${"  ".repeat(block.depth ?? 0)}${block.marker ?? "•"} `
      : block.type === "quote"
        ? "│ "
        : "";
  const contentRuns =
    block.type === "code"
      ? [new TextRun({ text, font: "Consolas", size: 19, color: "374151" })]
      : block.tokens?.length
        ? makeWordRuns(block.tokens, { italic: block.type === "quote" })
        : [new TextRun({ text, font: "Aptos", size: 22, italics: block.type === "quote" })];
  const runs = prefix
    ? [new TextRun({ text: prefix, bold: block.type === "list", color: "596273" }), ...contentRuns]
    : contentRuns;
  const heading =
    block.type === "heading"
      ? block.level === 1
        ? HeadingLevel.HEADING_1
        : block.level === 2
          ? HeadingLevel.HEADING_2
          : HeadingLevel.HEADING_3
      : undefined;
  const userShading = isUser
    ? { type: ShadingType.CLEAR, fill: "F1F3F5" }
    : undefined;
  const indent =
    block.type === "list"
      ? { left: 360 + (block.depth ?? 0) * 360 }
      : block.type === "quote"
        ? { left: 360 }
        : isUser
          ? { left: 1080 }
          : undefined;
  const lines = block.type === "code" ? text.split("\n") : [""];
  return lines.map((_line, index) => {
    const codeLine = lines[index] ?? "";
    return new Paragraph({
      children:
        block.type === "code"
          ? [new TextRun({ text: codeLine, font: "Consolas", size: 19, color: "374151" })]
          : runs,
      heading,
      alignment: AlignmentType.LEFT,
      spacing: { after: block.type === "heading" ? 100 : 150 },
      indent,
      shading:
        block.type === "code"
          ? { type: ShadingType.CLEAR, fill: "F1F3F5" }
          : userShading,
    });
  });
}

type PdfLine = {
  text: string;
  font: PDFFont;
  size: number;
  gap: number;
  code?: boolean;
  linkUrl?: string;
};

function pdfSafeText(text: string, font: PDFFont): string {
  return Array.from(text)
    .map(character => {
      try {
        font.encodeText(character);
        return character;
      } catch {
        return "?";
      }
    })
    .join("");
}

function wrapPdfText(text: string, font: PDFFont, size: number, width: number): string[] {
  const lines: string[] = [];
  text.split("\n").forEach(rawLine => {
    const words = rawLine.split(/\s+/).filter(Boolean);
    if (!words.length) {
      lines.push("");
      return;
    }
    let line = "";
    words.forEach(word => {
      const next = line ? `${line} ${word}` : word;
      if (line && font.widthOfTextAtSize(pdfSafeText(next, font), size) > width) {
        lines.push(line);
        line = word;
      } else line = next;
    });
    if (line) lines.push(line);
  });
  return lines;
}

function pdfMessageLines(
  blocks: ExportBlock[],
  width: number,
  normal: PDFFont,
  bold: PDFFont,
  code: PDFFont
): PdfLine[] {
  const lines: PdfLine[] = [];
  blocks.forEach(block => {
    if (block.type === "hr") {
      lines.push({ text: "", font: normal, size: 3, gap: 10 });
      return;
    }
    if (block.type === "table") {
      (block.rows ?? []).forEach((row, rowIndex) =>
        wrapPdfText(row.join("   |   "), rowIndex === 0 ? bold : normal, 10, width).forEach((line, index) =>
          lines.push({ text: line, font: rowIndex === 0 ? bold : normal, size: 10, gap: index === 0 ? 4 : 0 })
        )
      );
      lines.push({ text: "", font: normal, size: 3, gap: 8 });
      return;
    }
    const font = block.type === "heading" ? bold : block.type === "code" ? code : normal;
    const size =
      block.type === "heading"
        ? block.level === 1
          ? 16
          : block.level === 2
            ? 14
            : 12
        : block.type === "code"
          ? 9
          : 11;
    const prefix =
      block.type === "list"
        ? `${"  ".repeat(block.depth ?? 0)}${block.marker ?? "•"} `
        : block.type === "quote"
          ? "> "
          : "";
    wrapPdfText(`${prefix}${block.text ?? ""}`, font, size, width).forEach((line, index) =>
      lines.push({
        text: line,
        font,
        size,
        gap: index === 0 ? (block.type === "heading" ? 9 : 5) : 0,
        code: block.type === "code",
      })
    );
    // Preserve the visible paragraph/list separation from the chat transcript.
    lines.push({ text: "", font: normal, size: 3, gap: 8 });
  });
  return lines;
}

export async function createConversationPdfFile(
  title: string,
  messages: ExportConversationMessage[]
) {
  void title;
  const pdf = await PDFDocument.create();
  const normal = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const code = await pdf.embedFont(StandardFonts.Courier);
  const pageWidth = 595.28;
  const pageHeight = 841.89;
  const margin = 48;
  const bottom = 48;
  const bodyWidth = pageWidth - margin * 2;
  let page: PDFPage = pdf.addPage([pageWidth, pageHeight]);
  let cursorY = pageHeight - margin;

  for (const message of messages.filter(
    item =>
      (item.role === "user" || item.role === "assistant") &&
      (item.content.trim() || item.attachments?.length)
  )) {
    const isUser = message.role === "user";
    const label = isUser ? "You" : "Assistant";
    const inset = isUser ? 46 : 0;
    const cardX = margin + inset;
    const cardWidth = bodyWidth - inset;
    const textX = cardX + 14;
    const textWidth = cardWidth - 28;
    const allLines: PdfLine[] = [
      { text: label, font: bold, size: 9, gap: 0 },
      ...pdfMessageLines(markdownBlocks(message.content), textWidth, normal, bold, code),
      ...(message.attachments ?? []).flatMap(attachment => [
        { text: `File: ${attachment.filename}`, font: normal, size: 9, gap: 5, ...(attachment.url ? { linkUrl: attachment.url } : {}) },
      ]),
    ];
    let firstChunk = true;

    while (allLines.length) {
      if (cursorY < bottom + 50) {
        page = pdf.addPage([pageWidth, pageHeight]);
        cursorY = pageHeight - margin;
      }
      const availableHeight = cursorY - bottom - 20;
      let chunkHeight = 16;
      let lineCount = 0;
      while (lineCount < allLines.length) {
        const line = allLines[lineCount];
        const needed = Math.max(4, line.size * 1.45) + line.gap;
        if (lineCount > 0 && chunkHeight + needed > availableHeight) break;
        chunkHeight += needed;
        lineCount += 1;
      }
      if (!lineCount) {
        page = pdf.addPage([pageWidth, pageHeight]);
        cursorY = pageHeight - margin;
        continue;
      }

      const chunk = allLines.splice(0, lineCount);
      const cardY = cursorY - chunkHeight;
      if (isUser) {
        page.drawRectangle({
          x: cardX, y: cardY, width: cardWidth, height: chunkHeight,
          color: rgb(0.955, 0.963, 0.976),
          borderColor: rgb(0.87, 0.89, 0.92), borderWidth: 0.7,
        });
      }
      let textY = cursorY - 11;
      if (!firstChunk) {
        page.drawText(`${label} (continued)`, {
          x: textX,
          y: textY,
          size: 8,
          font: bold,
          color: rgb(0.42, 0.45, 0.5),
        });
        textY -= 13;
      }
      chunk.forEach(line => {
        textY -= line.gap;
        const lineHeight = Math.max(4, line.size * 1.45);
        if (line.code && line.text) {
          page.drawRectangle({
            x: textX - 4,
            y: textY - 2,
            width: textWidth,
            height: lineHeight + 2,
            color: rgb(0.94, 0.95, 0.96),
          });
        }
        if (line.text) {
          const safeText = pdfSafeText(line.text, line.font);
          page.drawText(safeText, {
            x: textX + (line.code ? 3 : 0),
            y: textY - line.size,
            size: line.size,
            font: line.font,
            color:
              line.size === 9 && line.font === bold
                ? rgb(0.42, 0.45, 0.5)
                : rgb(0.12, 0.13, 0.15),
          });
          if ("linkUrl" in line && line.linkUrl) {
            addPdfLink(page, textX, textY - line.size - 2, Math.min(textWidth, line.font.widthOfTextAtSize(safeText, line.size)), line.size + 4, line.linkUrl, pdf);
          }
        }
        textY -= lineHeight;
      });
      cursorY = cardY - (isUser ? 12 : 20);
      firstChunk = false;
    }
  }
  const bytes = await pdf.save();
  return new Blob([new Uint8Array(bytes).buffer as ArrayBuffer], {
    type: "application/pdf",
  });
}

export async function createConversationWordFile(
  title: string,
  messages: ExportConversationMessage[]
) {
  void title;
  const children: Array<Paragraph | Table> = [];
  messages
    .filter(
      message =>
        (message.role === "user" || message.role === "assistant") &&
        (message.content.trim() || message.attachments?.length)
    )
    .forEach(message => {
      const isUser = message.role === "user";
      children.push(
        new Paragraph({
          children: [
            new TextRun({
              text: isUser ? "You" : "Assistant",
              bold: true,
              font: "Aptos",
              size: 19,
              color: "68717F",
            }),
          ],
          alignment: isUser ? AlignmentType.RIGHT : AlignmentType.LEFT,
          spacing: { before: 180, after: 70 },
        })
      );
      markdownBlocks(message.content).forEach(block => {
        wordParagraphs(block, isUser).forEach(child => children.push(child));
      });
      (message.attachments ?? []).forEach(attachment => {
        const run = attachment.url
          ? new ExternalHyperlink({ link: attachment.url, children: [new TextRun({ text: `📎 ${attachment.filename}`, style: "Hyperlink" })] })
          : new TextRun({ text: `📎 ${attachment.filename}` });
        children.push(new Paragraph({ children: [run], spacing: { before: 50, after: 70 } }));
      });
    });
  const document = new Document({
    sections: [
      {
        properties: {
          page: { margin: { top: 840, right: 900, bottom: 840, left: 900 } },
        },
        children,
      },
    ],
  });
  return Packer.toBlob(document);
}
