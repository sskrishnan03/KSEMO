/**
 * Shared types for the Create & Capability system.
 *
 * This module defines the capability "modes" the chat composer can enter
 * (Normal Chat, and the file creation formats). Keeping these in `shared` lets
 * the server and client agree on one source of truth without drifting.
 */

/**
 * The single "active mode" of the composer. Exactly one is active at a time.
 *  - "chat"        : Normal Chat. No special workflow runs.
 *  - file formats  : File Creation Mode for that specific file type.
 */
export type CapabilityMode =
  | "chat"
  | "pdf"
  | "docx"
  | "xlsx"
  | "pptx"
  | "txt";

/** A mode in the CREATE section of the capability menu. */
export type CreateMode = "pdf" | "docx" | "xlsx" | "pptx" | "txt";

/**
 * File format type for file generation.
 */
export type FileFormat = "pdf" | "docx" | "xlsx" | "pptx" | "txt";

export const CREATE_MODES: CreateMode[] = [
  "pdf",
  "docx",
  "xlsx",
  "pptx",
  "txt",
];

export function isCreateMode(value: unknown): value is CreateMode {
  return typeof value === "string" && (CREATE_MODES as string[]).includes(value);
}

export function isCapabilityMode(value: unknown): value is CapabilityMode {
  return value === "chat" || isCreateMode(value);
}
