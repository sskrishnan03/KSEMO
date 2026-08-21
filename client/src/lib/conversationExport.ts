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
};

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

export function createConversationPdfFile(
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

export function createConversationWordFile(
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
