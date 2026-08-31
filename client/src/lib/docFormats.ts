import type { ComponentType } from "react";
import { FileText, FileSpreadsheet, Presentation } from "lucide-react";

export type DocFormat = "pdf" | "docx" | "xlsx" | "pptx" | "csv" | "txt" | "md";

export type DocFormatOption = {
  format: DocFormat;
  label: string;
  hint: string;
  icon: ComponentType<{ className?: string }>;
  colorClass: string;
  iconColor: string;
};

export const DOC_FORMAT_OPTIONS: DocFormatOption[] = [
  {
    format: "pdf",
    label: "PDF",
    hint: "Styled, print-ready document",
    icon: FileText,
    colorClass: "bg-red-500/10 text-red-500",
    iconColor: "text-red-500",
  },
  {
    format: "docx",
    label: "Word",
    hint: "Editable Word document (.docx)",
    icon: FileText,
    colorClass: "bg-blue-500/10 text-blue-500",
    iconColor: "text-blue-600",
  },
  {
    format: "xlsx",
    label: "Excel",
    hint: "Spreadsheet with tables (.xlsx)",
    icon: FileSpreadsheet,
    colorClass: "bg-emerald-500/10 text-emerald-500",
    iconColor: "text-emerald-600",
  },
  {
    format: "pptx",
    label: "PowerPoint",
    hint: "Slide presentation (.pptx)",
    icon: Presentation,
    colorClass: "bg-orange-500/10 text-orange-500",
    iconColor: "text-orange-500",
  },
  {
    format: "csv",
    label: "CSV",
    hint: "Plain table data",
    icon: FileSpreadsheet,
    colorClass: "bg-teal-500/10 text-teal-500",
    iconColor: "text-teal-600",
  },
  {
    format: "txt",
    label: "Text",
    hint: "Plain text notes",
    icon: FileText,
    colorClass: "bg-slate-500/10 text-slate-500",
    iconColor: "text-slate-500",
  },
  {
    format: "md",
    label: "Markdown",
    hint: "Markdown-formatted file",
    icon: FileText,
    colorClass: "bg-indigo-500/10 text-indigo-500",
    iconColor: "text-indigo-500",
  },
];

const FALLBACK_FORMAT: DocFormatOption = DOC_FORMAT_OPTIONS[0];

export function getDocFormatOption(format: DocFormat): DocFormatOption {
  return (
    DOC_FORMAT_OPTIONS.find(option => option.format === format) ??
    FALLBACK_FORMAT
  );
}

export function isDocFormat(value: unknown): value is DocFormat {
  return typeof value === "string" && DOC_FORMAT_OPTIONS.some(o => o.format === value);
}
