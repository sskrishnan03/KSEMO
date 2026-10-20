import { getFileKind } from "@/lib/fileKinds";
import { getCapabilityOption } from "@/lib/capabilities";
import { cn } from "@/lib/utils";
import type { CreateMode } from "@shared/capabilities";

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
    <Icon
      className={cn(
        className,
        colored && option.iconColor,
        mode === "xlsx" && "stroke-[1.5]",
        mode === "txt" && "stroke-[1.5]"
      )}
      style={colored ? { color: option.iconHex } : undefined}
      aria-hidden="true"
    />
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
    return <CreateFileModeIcon mode={mode} className={className} />;
  }

  return (
    <kind.icon className={cn(className, kind.colorClass)} aria-hidden="true" />
  );
}
