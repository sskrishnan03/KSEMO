import type { ComponentType } from "react";
import { getCapabilityOption } from "@/lib/capabilities";

export type DocFormat =
  "pdf" | "docx" | "xlsx" | "pptx" | "txt" | "markdown" | "csv";

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
    icon: getCapabilityOption("pdf").icon,
    colorClass: "bg-red-500/10 text-red-500",
    iconColor: getCapabilityOption("pdf").iconColor,
  },
  {
    format: "docx",
    label: "Word",
    hint: "Editable Word document (.docx)",
    icon: getCapabilityOption("docx").icon,
    colorClass: "bg-blue-500/10 text-blue-500",
    iconColor: getCapabilityOption("docx").iconColor,
  },
  {
    format: "xlsx",
    label: "Excel",
    hint: "Spreadsheet with tables (.xlsx)",
    icon: getCapabilityOption("xlsx").icon,
    colorClass: "bg-emerald-500/10 text-emerald-500",
    iconColor: getCapabilityOption("xlsx").iconColor,
  },
  {
    format: "pptx",
    label: "PowerPoint",
    hint: "Slide presentation (.pptx)",
    icon: getCapabilityOption("pptx").icon,
    colorClass: "bg-orange-500/10 text-orange-500",
    iconColor: getCapabilityOption("pptx").iconColor,
  },
  {
    format: "txt",
    label: "Text",
    hint: "Plain text notes",
    icon: getCapabilityOption("txt").icon,
    colorClass: "bg-slate-500/10 text-slate-500",
    iconColor: getCapabilityOption("txt").iconColor,
  },
  {
    format: "markdown",
    label: "Markdown",
    hint: "Markdown document (.md)",
    icon: getCapabilityOption("txt").icon,
    colorClass: "bg-violet-500/10 text-violet-500",
    iconColor: getCapabilityOption("txt").iconColor,
  },
  {
    format: "csv",
    label: "CSV",
    hint: "Comma-separated data",
    icon: getCapabilityOption("txt").icon,
    colorClass: "bg-teal-500/10 text-teal-500",
    iconColor: getCapabilityOption("txt").iconColor,
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
  return (
    typeof value === "string" &&
    DOC_FORMAT_OPTIONS.some(o => o.format === value)
  );
}
