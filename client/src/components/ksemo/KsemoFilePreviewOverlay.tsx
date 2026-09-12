// KsemoFilePreviewOverlay - opens a generated/attached file inside KSEMO.
// The conversation stays mounted and usable behind the overlay; no new tab is
// needed to view PDFs, images, or text files.

import { Button } from "@/components/ui/button";
import { getFileKind } from "@/lib/fileKinds";
import { downloadFile } from "@/lib/downloadFile";
import { Download, ExternalLink, FolderOpen, X } from "lucide-react";
import { memo, useEffect } from "react";
import {
  usePdfViewer,
  isPdf,
  isViewableDocument,
} from "@/contexts/PdfViewerContext";

export type PreviewFile = {
  id: string;
  filename: string;
  url: string;
  mimeType?: string;
  sizeBytes?: number;
};

type KsemoFilePreviewOverlayProps = {
  file: PreviewFile;
  onClose: () => void;
  onOpenInLibrary?: () => void;
};

function formatBytes(bytes?: number): string | null {
  if (typeof bytes !== "number" || Number.isNaN(bytes) || bytes < 0)
    return null;
  const units = ["B", "KB", "MB", "GB"];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  const digits = unit === 0 || value >= 100 ? 0 : value >= 10 ? 1 : 2;
  return `${value.toFixed(digits)} ${units[unit]}`;
}

function isTextLike(file: PreviewFile): boolean {
  const ext = /\.([a-zA-Z0-9]+)$/
    .exec(file.filename.trim())?.[1]
    ?.toLowerCase();
  if (file.mimeType?.startsWith("text/")) return true;
  return Boolean(
    ext &&
    ["txt", "log", "tsv", "json", "xml", "yml", "yaml", "csv", "md"].includes(
      ext
    )
  );
}

export const KsemoFilePreviewOverlay = memo(function KsemoFilePreviewOverlay({
  file,
  onClose,
  onOpenInLibrary,
}: KsemoFilePreviewOverlayProps) {
  const { openPdf } = usePdfViewer();
  const kind = getFileKind(file.filename, file.mimeType);

  useEffect(() => {
    if (isViewableDocument(file.filename, file.mimeType)) {
      openPdf({
        url: file.url,
        filename: file.filename,
        sizeBytes: file.sizeBytes,
        mimeType: file.mimeType,
        id: file.id,
      });
      onClose();
    }
  }, [file, onClose, openPdf]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const isImage = file.mimeType?.startsWith("image/");
  const isPdfDoc = isPdf(file.filename, file.mimeType);
  const showInline = isImage || isPdfDoc || isTextLike(file);

  return (
    <div
      className="fixed inset-0 z-[110] flex items-center justify-center bg-black/80 p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={`Preview ${file.filename}`}
    >
      <div
        className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-border bg-background shadow-2xl"
        onClick={event => event.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
          <div className="flex min-w-0 items-center gap-2.5">
            <span
              className={`flex size-8 shrink-0 items-center justify-center rounded-lg ${kind.colorClass}`}
            >
              <kind.icon className="size-4" />
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-foreground">
                {file.filename}
              </p>
              <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                {kind.label}
                {file.sizeBytes !== undefined
                  ? ` · ${formatBytes(file.sizeBytes) ?? ""}`
                  : ""}
              </p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            {onOpenInLibrary && (
              <Button
                variant="ghost"
                size="sm"
                className="gap-1.5 text-xs"
                onClick={onOpenInLibrary}
              >
                <FolderOpen className="size-3.5" />
                Open in Library
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon"
              aria-label="Open file in new tab"
              asChild
            >
              <a href={file.url} target="_blank" rel="noreferrer">
                <ExternalLink className="size-4" />
              </a>
            </Button>
            <Button
              variant="ghost"
              size="icon"
              aria-label={`Download ${file.filename}`}
              onClick={() => void downloadFile(file.url, file.filename)}
            >
              <Download className="size-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              aria-label="Close preview"
            >
              <X className="size-4" />
            </Button>
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-hidden bg-muted/30">
          {isImage ? (
            <img
              src={file.url}
              alt={file.filename}
              className="mx-auto h-full max-h-[70vh] w-auto object-contain"
            />
          ) : isPdfDoc ? (
            <iframe
              src={file.url}
              title={file.filename}
              className="h-[70vh] w-full"
            />
          ) : showInline ? (
            <iframe
              src={file.url}
              title={file.filename}
              className="h-[70vh] w-full bg-background"
            />
          ) : (
            <div className="flex h-[50vh] flex-col items-center justify-center gap-3 p-6 text-center">
              <span
                className={`flex size-12 items-center justify-center rounded-xl ${kind.colorClass}`}
              >
                <kind.icon className="size-6" />
              </span>
              <p className="text-sm text-muted-foreground">
                This file type can't be previewed inline.
              </p>
              <Button asChild size="sm">
                <a href={file.url} target="_blank" rel="noreferrer" download>
                  <Download className="size-4" />
                  Download file
                </a>
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
});
