import { getFileKind } from "@/lib/fileKinds";
import { getCapabilityOption } from "@/lib/capabilities";
import { cn } from "@/lib/utils";
import type { CreateMode } from "@shared/capabilities";
import {
  Archive,
  AudioLines,
  Code2,
  File,
  Image,
  Video,
} from "lucide-react";
import React from "react";

export function CreateFileModeIcon({
  mode,
  className,
  colored = true,
}: {
  mode: CreateMode;
  className?: string;
  colored?: boolean;
}) {
  const option = getCapabilityOption(mode);
  const Icon = option.icon;
  return (
    <span style={colored ? { color: option.iconHex } : undefined}>
      <Icon
        className={cn(
          className,
          colored && option.iconColor,
          "stroke-[1.5]"
        )}
        aria-hidden="true"
      />
    </span>
  );
}

/** Shared file type icon, using the colored Create Files menu icons. */
export function LibraryFileIcon({
  filename,
  mimeType,
  className,
}: {
  filename: string;
  mimeType?: string | null;
  className?: string;
}) {
  const kind = getFileKind(filename, mimeType ?? undefined);
  const mode: CreateMode | null =
    kind.label === "PDF"
      ? "pdf"
      : kind.label === "Word"
        ? "docx"
        : kind.label === "Sheet"
          ? "xlsx"
          : kind.label === "Slides"
            ? "pptx"
            : ["Text", "Markdown"].includes(kind.label)
              ? "txt"
              : null;

  if (mode) {
    const option = getCapabilityOption(mode);
    return (
      <span style={{ color: option.iconHex }}>
        <CreateFileModeIcon mode={mode} className={className} colored={false} />
      </span>
    );
  }

  const SimpleIcon =
    kind.label === "Archive"
      ? Archive
      : kind.label === "Image"
        ? Image
        : kind.label === "Audio"
          ? AudioLines
          : kind.label === "Video"
            ? Video
            : kind.label === "Code"
              ? Code2
              : File;
  const color =
    kind.label === "Archive"
      ? "#d97706"
      : kind.label === "Image"
        ? "#0284c7"
        : kind.label === "Audio"
          ? "#db2777"
          : kind.label === "Video"
            ? "#7c3aed"
            : kind.label === "Code"
              ? "#7c3aed"
              : "#64748b";

  return (
    <SimpleIcon
      className={cn(className, "stroke-[1.5]")}
      style={{ color }}
      aria-hidden="true"
    />
  );
}
