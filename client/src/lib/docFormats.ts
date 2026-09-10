import type { ComponentType } from "react";
import {
  ExcelFileIcon,
  PdfFileIcon,
  PowerPointFileIcon,
  TextFileIcon,
  WordFileIcon,
} from "@/components/ksemo/FileBrandIcons";

export type DocFormat =
  | "pdf"
  | "docx"
  | "xlsx"
  | "pptx"
  | "txt"
  | "markdown"
  | "csv";

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
    icon: PdfFileIcon,
    colorClass: "bg-red-500/10 text-red-500",
    iconColor: "",
  },
  {
    format: "docx",
    label: "Word",
    hint: "Editable Word document (.docx)",
    icon: WordFileIcon,
    colorClass: "bg-blue-500/10 text-blue-500",
    iconColor: "",
  },
  {
    format: "xlsx",
    label: "Excel",
    hint: "Spreadsheet with tables (.xlsx)",
    icon: ExcelFileIcon,
    colorClass: "bg-emerald-500/10 text-emerald-500",
    iconColor: "",
  },
  {
    format: "pptx",
    label: "PowerPoint",
    hint: "Slide presentation (.pptx)",
    icon: PowerPointFileIcon,
    colorClass: "bg-orange-500/10 text-orange-500",
    iconColor: "",
  },
  {
    format: "txt",
    label: "Text",
    hint: "Plain text notes",
    icon: TextFileIcon,
    colorClass: "bg-slate-500/10 text-slate-500",
    iconColor: "",
  },
  {
    format: "markdown",
    label: "Markdown",
    hint: "Markdown document (.md)",
    icon: TextFileIcon,
    colorClass: "bg-violet-500/10 text-violet-500",
    iconColor: "",
  },
  {
    format: "csv",
    label: "CSV",
    hint: "Comma-separated data",
    icon: TextFileIcon,
    colorClass: "bg-teal-500/10 text-teal-500",
    iconColor: "",
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
