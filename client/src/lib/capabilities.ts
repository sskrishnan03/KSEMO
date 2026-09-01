/**
 * Capability configuration for the "Create, Search & Research" workspace.
 *
 * This is the single scalable registry of every capability offered through the
 * Plus (+) button. Adding a future capability (image generation, agent mode,
 * etc.) means adding one entry here + the matching server-side workflow — the
 * menu, active-mode chip and routing all derive from this configuration.
 */
import type { ComponentType } from "react";
import {
  FileSpreadsheet,
  FileText,
  FlaskConical,
  Presentation,
  Search,
} from "lucide-react";
import type {
  CapabilityMode,
  CreateMode,
  ResearchMode,
} from "@shared/research";

export type CapabilityKind = "create" | "research";

export type CapabilityOption = {
  /** The mode this entry arms. */
  mode: CapabilityMode;
  kind: CapabilityKind;
  /** Short title shown in the menu. */
  title: string;
  /** One-line description shown under the title. */
  description: string;
  /** Icon component. */
  icon: ComponentType<{ className?: string }>;
  /** Accent classes for the icon tile. */
  iconColor: string;
  iconBg: string;
  /** Composer placeholder shown when this mode is active. */
  placeholder: string;
  /** Badge shown in the active-mode chip. */
  chipLabel: string;
};

const CREATE: CapabilityOption[] = [
  {
    mode: "pdf",
    kind: "create",
    title: "PDF",
    description: "Create a formatted PDF document.",
    icon: FileText,
    iconColor: "text-red-500",
    iconBg: "bg-red-500/10",
    placeholder: "Describe the PDF you want to create...",
    chipLabel: "Create PDF",
  },
  {
    mode: "docx",
    kind: "create",
    title: "Word Document",
    description: "Create a professionally formatted Word document.",
    icon: FileText,
    iconColor: "text-blue-600",
    iconBg: "bg-blue-500/10",
    placeholder: "Describe the Word document you want to create...",
    chipLabel: "Create Word Document",
  },
  {
    mode: "xlsx",
    kind: "create",
    title: "Excel",
    description: "Create a structured Excel spreadsheet.",
    icon: FileSpreadsheet,
    iconColor: "text-emerald-600",
    iconBg: "bg-emerald-500/10",
    placeholder: "Describe the spreadsheet you want to create...",
    chipLabel: "Create Excel",
  },
  {
    mode: "pptx",
    kind: "create",
    title: "PowerPoint",
    description: "Create a professional PowerPoint presentation.",
    icon: Presentation,
    iconColor: "text-orange-500",
    iconBg: "bg-orange-500/10",
    placeholder: "Describe the presentation you want to create...",
    chipLabel: "Create PowerPoint",
  },
  {
    mode: "txt",
    kind: "create",
    title: "Text Document",
    description: "Create a simple and lightweight text document.",
    icon: FileText,
    iconColor: "text-slate-500",
    iconBg: "bg-slate-500/10",
    placeholder: "Describe the text document you want to create...",
    chipLabel: "Create Text Document",
  },
];

const RESEARCH: CapabilityOption[] = [
  {
    mode: "web_search",
    kind: "research",
    title: "Web Search",
    description: "Search the web and answer using real, current sources.",
    icon: Search,
    iconColor: "text-sky-500",
    iconBg: "bg-sky-500/10",
    placeholder: "What would you like to search for?",
    chipLabel: "Web Search",
  },
  {
    mode: "deep_research",
    kind: "research",
    title: "Deep Research",
    description:
      "Research a topic in depth, analyze multiple sources, and generate a structured research report.",
    icon: FlaskConical,
    iconColor: "text-violet-500",
    iconBg: "bg-violet-500/10",
    placeholder: "What topic would you like me to research?",
    chipLabel: "Deep Research",
  },
] as CapabilityOption[];

export const CAPABILITY_SECTIONS: Array<{
  id: "create" | "research";
  heading: string;
  options: CapabilityOption[];
}> = [
  { id: "create", heading: "CREATE", options: CREATE },
  { id: "research", heading: "SEARCH & RESEARCH", options: RESEARCH },
];

export const ALL_CAPABILITIES: CapabilityOption[] = [
  ...CREATE,
  ...RESEARCH,
];

const MODE_INDEX = new Map<CapabilityMode, CapabilityOption>(
  ALL_CAPABILITIES.map(option => [option.mode, option])
);

export function getCapabilityOption(mode: CapabilityMode): CapabilityOption {
  return MODE_INDEX.get(mode)!;
}

export function isFileMode(mode: CapabilityMode): mode is CreateMode {
  return mode !== "chat" && mode !== "web_search" && mode !== "deep_research";
}

export function isResearchCapability(mode: CapabilityMode): mode is ResearchMode {
  return mode === "web_search" || mode === "deep_research";
}

/** Placeholder text for a given active mode (used by Normal Chat). */
export function placeholderForMode(mode: CapabilityMode): string | null {
  if (mode === "chat") return null;
  return getCapabilityOption(mode).placeholder;
}
