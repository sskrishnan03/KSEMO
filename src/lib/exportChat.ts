import { jsPDF } from 'jspdf';
import {
  AlignmentType,
  BorderStyle,
  Document,
  ImageRun,
  Packer,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableRow,
  TextRun,
  ThematicBreak,
  WidthType,
} from 'docx';

export type ExportMessage = { role: 'user' | 'assistant'; content: string };

const BRAND_NAME = 'KSEMO';
const BRAND_TAG = 'Voice Chat';

function toPlainText(text: string): string {
  return text
    .replace(/```[\s\S]*?```/g, '')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/#+\s+/g, '')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/<[^>]*>/g, '')
    .replace(/\s*\n{3,}/g, '\n\n')
    .trim();
}

function safeName(title: string): string {
  const cleaned = title.trim().replace(/[^\w\d\- ]+/g, '').replace(/\s+/g, '_').slice(0, 60);
  return cleaned || 'voice_chat';
}

function formatExportDateTime(d = new Date()): string {
  return d.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function loadLogoDataUrl(): Promise<string | null> {
  try {
    const res = await fetch('/KSEMOlogo.png');
    const blob = await res.blob();
    return await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

async function loadLogoBuffer(): Promise<ArrayBuffer | null> {
  try {
    const res = await fetch('/KSEMOlogo.png');
    return await res.arrayBuffer();
  } catch {
    return null;
  }
}

/* ──────────────────── Plain text export ──────────────────── */

export function exportChatAsText(title: string, messages: ExportMessage[]) {
  const lines: string[] = [];
  lines.push(`${BRAND_NAME} — ${BRAND_TAG}`);
  lines.push(`Exported on ${formatExportDateTime()}`);
  lines.push('');
  lines.push(title);
  lines.push('──────────────────────────────────────────');
  lines.push('');
  for (const m of messages) {
    const plain = toPlainText(m.content);
    if (!plain) continue;
    lines.push(m.role === 'user' ? 'You:' : `${BRAND_NAME}:`);
    lines.push(plain);
    lines.push('');
  }
  const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' });
  downloadBlob(blob, `${safeName(title)}.txt`);
}

/* ──────────────────── PDF export ──────────────────── */

export async function exportChatAsPDF(title: string, messages: ExportMessage[]) {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 48;
  const maxW = pageW - margin * 2;
  const lineH = 15;
  const padX = 14;
  const padY = 12;
  const bubbleW = maxW * 0.72;

  const logo = await loadLogoDataUrl();
  const logoSize = 26;
  const logoX = margin;
  const logoY = 34;
  const logoOffset = logo ? logoSize + 8 : 0;

  // ── Brand header: logo + project name + voice tag ──
  if (logo) {
    try { doc.addImage(logo, 'PNG', logoX, logoY, logoSize, logoSize); } catch { /* ignore */ }
  }
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(17);
  doc.setTextColor('#18181b');
  const nameW = doc.getTextWidth(BRAND_NAME);
  doc.text(BRAND_NAME, margin + logoOffset, logoY + logoSize - 6);

  // Voice Chat badge
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor('#71717a');
  const tagW = doc.getTextWidth(BRAND_TAG);
  const badgeX = margin + logoOffset + nameW + 10;
  const badgeY = logoY + 5;
  const badgeH = 16;
  doc.setFillColor('#f4f4f5');
  doc.setDrawColor('#e4e4e7');
  doc.roundedRect(badgeX, badgeY, tagW + 16, badgeH, badgeH / 2, badgeH / 2, 'FD');
  doc.text(BRAND_TAG, badgeX + (tagW + 16) / 2, badgeY + badgeH / 2 + 3, { align: 'center' });

  // Export date/time
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor('#9ca3af');
  doc.text(`Exported on ${formatExportDateTime()}`, margin + logoOffset, logoY + logoSize + 18);

  // Chat title
  doc.setFontSize(11.5);
  doc.setTextColor('#4b5563');
  const titleLines = doc.splitTextToSize(title, maxW - logoOffset - 20) as string[];
  doc.text(titleLines, margin + logoOffset, logoY + logoSize + 36);

  // Divider
  doc.setDrawColor('#e4e4e7');
  doc.setLineWidth(0.75);
  doc.line(margin, logoY + logoSize + 54, pageW - margin, logoY + logoSize + 54);

  let y = logoY + logoSize + 72;

  for (const m of messages) {
    const plain = toPlainText(m.content);
    if (!plain) continue;

    const isUser = m.role === 'user';
    const contentLines = doc.splitTextToSize(plain, bubbleW - padX * 2) as string[];
    const bubbleH = contentLines.length * lineH + padY * 2;

    if (y + bubbleH + 30 > pageH - margin) {
      doc.addPage();
      y = margin + 10;
    }

    const x = isUser ? pageW - margin - bubbleW : margin;

    // Label above the bubble
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(isUser ? '#8b5cf6' : '#10b981');
    doc.text(isUser ? 'You' : BRAND_NAME, isUser ? pageW - margin : margin, y, { align: isUser ? 'right' : 'left' });
    y += 10;

    // Bubble
    doc.setFillColor(isUser ? '#27272a' : '#f4f4f5');
    doc.setDrawColor(isUser ? '#3f3f46' : '#e4e4e7');
    doc.roundedRect(x, y, bubbleW, bubbleH, 10, 10, 'FD');

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(isUser ? '#fafafa' : '#18181b');
    let ty = y + padY + lineH * 0.8;
    for (const line of contentLines) {
      doc.text(line, x + padX, ty);
      ty += lineH;
    }

    y += bubbleH + 16;
  }

  doc.save(`${safeName(title)}.pdf`);
}

/* ──────────────────── Word (.docx) export ──────────────────── */

export async function exportChatAsDocx(title: string, messages: ExportMessage[]) {
  const logoData = await loadLogoBuffer();

  const noneBorder = { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' };
  const border = { style: BorderStyle.SINGLE, size: 4, color: 'E4E4E7' };

  const bubble = (label: string, text: string, isUser: boolean) => {
    const fill = isUser ? '27272A' : 'F4F4F5';
    const bd = isUser ? { style: BorderStyle.SINGLE, size: 4, color: '3F3F46' } : border;
    const textColor = isUser ? 'FAFAFA' : '18181B';
    const labelColor = isUser ? 'A1A1AA' : '71717A';

    const contentCell = new TableCell({
      width: { size: 50, type: WidthType.PERCENTAGE },
      shading: { type: ShadingType.CLEAR, fill },
      borders: { top: bd, bottom: bd, left: bd, right: bd },
      margins: { top: 140, bottom: 140, left: 180, right: 180 },
      children: [
        new Paragraph({
          alignment: isUser ? AlignmentType.RIGHT : AlignmentType.LEFT,
          spacing: { after: 80 },
          children: [new TextRun({ text: label, bold: true, color: labelColor, size: 16 })],
        }),
        new Paragraph({
          alignment: AlignmentType.LEFT,
          children: [new TextRun({ text, color: textColor, size: 20 })],
        }),
      ],
    });

    const emptyCell = new TableCell({
      width: { size: 50, type: WidthType.PERCENTAGE },
      borders: { top: noneBorder, bottom: noneBorder, left: noneBorder, right: noneBorder },
      children: [new Paragraph({})],
    });

    const row = isUser
      ? new TableRow({ children: [emptyCell, contentCell] })
      : new TableRow({ children: [contentCell, emptyCell] });

    return new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      columnWidths: [50, 50],
      rows: [row],
    });
  };

  const children: (Paragraph | Table)[] = [];

  children.push(
    // Brand header: logo + project name + voice tag
    new Paragraph({
      spacing: { after: 100 },
      children: [
        ...(logoData ? [new ImageRun({ type: 'png', data: logoData, transformation: { width: 28, height: 28 } })] : []),
        new TextRun({ text: '  ' + BRAND_NAME, bold: true, size: 36, color: '18181B' }),
        new TextRun({ text: '  ' + BRAND_TAG, size: 20, color: '71717A' }),
      ],
    }),
    // Export date/time
    new Paragraph({
      spacing: { after: 80 },
      children: [new TextRun({ text: `Exported on ${formatExportDateTime()}`, size: 18, color: '9CA3AF' })],
    }),
    // Chat title
    new Paragraph({
      spacing: { before: 40, after: 120 },
      children: [new TextRun({ text: title, bold: true, size: 26, color: '374151' })],
    }),
    // Divider
    new Paragraph({ children: [new ThematicBreak()] }),
    new Paragraph({ spacing: { before: 220 } }),
  );

  for (const m of messages) {
    const plain = toPlainText(m.content);
    if (!plain) continue;
    children.push(bubble(m.role === 'user' ? 'You' : BRAND_NAME, plain, m.role === 'user'));
    children.push(new Paragraph({ spacing: { before: 140 } }));
  }

  const doc = new Document({
    sections: [{ properties: {}, children }],
  });

  const blob = await Packer.toBlob(doc);
  downloadBlob(blob, `${safeName(title)}.docx`);
}
