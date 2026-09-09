/**
 * Capability configuration for the Create & Document system.
 *
 * This is the single scalable registry of every capability offered through the
 * Plus (+) button. Adding a future capability (image generation, agent mode,
 * etc.) means adding one entry here + the matching server-side workflow — the
 * menu, active-mode chip and routing all derive from this configuration.
 */
import type { ComponentType } from "react";
import {
  File,
  FilePenLine,
  FileText,
  MonitorPlay,
  Table2,
} from "lucide-react";
import type {
  CapabilityMode,
  CreateMode,
} from "@shared/capabilities";

export type CapabilityKind = "create";

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
    iconBg: "bg-red-500/15",
    placeholder: "Describe the PDF you want to create...",
    chipLabel: "Create PDF",
  },
  {
    mode: "docx",
    kind: "create",
    title: "Word",
    description: "Create a Word document.",
    icon: FilePenLine,
    iconColor: "text-blue-600",
    iconBg: "bg-blue-500/15",
    placeholder: "Describe the Word document you want to create...",
    chipLabel: "Word Doc",
  },
  {
    mode: "xlsx",
    kind: "create",
    title: "Excel",
    description: "Create a structured Excel spreadsheet.",
    icon: Table2,
    iconColor: "text-emerald-600",
    iconBg: "bg-emerald-500/15",
    placeholder: "Describe the spreadsheet you want to create...",
    chipLabel: "Create Excel",
  },
  {
    mode: "pptx",
    kind: "create",
    title: "PowerPoint",
    description: "Create a professional PowerPoint presentation.",
    icon: MonitorPlay,
    iconColor: "text-orange-500",
    iconBg: "bg-orange-500/15",
    placeholder: "Describe the presentation you want to create...",
    chipLabel: "Create PowerPoint",
  },
  {
    mode: "txt",
    kind: "create",
    title: "Text",
    description: "Create a plain text file.",
    icon: File,
    iconColor: "text-sky-500",
    iconBg: "bg-sky-500/15",
    placeholder: "Describe the text file you want to create...",
    chipLabel: "Text",
  },
];

export const CAPABILITY_SECTIONS: Array<{
  id: "create";
  heading: string;
  options: CapabilityOption[];
}> = [
  { id: "create", heading: "CREATE", options: CREATE },
];

export const ALL_CAPABILITIES: CapabilityOption[] = [
  ...CREATE,
];

const MODE_INDEX = new Map<CapabilityMode, CapabilityOption>(
  ALL_CAPABILITIES.map(option => [option.mode, option])
);

export function getCapabilityOption(mode: CapabilityMode): CapabilityOption {
  return MODE_INDEX.get(mode)!;
}

export function isFileMode(mode: CapabilityMode): mode is CreateMode {
  return mode !== "chat";
}

/** Placeholder text for a given active mode (used by Normal Chat). */
export function placeholderForMode(mode: CapabilityMode): string | null {
  if (mode === "chat") return null;
  return getCapabilityOption(mode).placeholder;
}
