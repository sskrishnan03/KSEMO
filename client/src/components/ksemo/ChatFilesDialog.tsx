import { getFileKind, isImageFile } from "@/lib/fileKinds";
import { Eye, ExternalLink, FolderOpen, X } from "lucide-react";
import React, { memo, useEffect, useMemo, useState } from "react";
import { usePdfViewer, isViewableDocument } from "@/contexts/PdfViewerContext";
import { ImageLightbox } from "@/components/ui/image-lightbox";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export type ChatFile = {
  id: string;
  filename: string;
  mimeType?: string;
  url: string;
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  files: ChatFile[];
};

export const ChatFilesDialog = memo(function ChatFilesDialog({
  open,
  onOpenChange,
  files,
}: Props) {
  const { openPdf } = usePdfViewer();
  const rows = useMemo(() => files, [files]);
  const [lightboxFile, setLightboxFile] = useState<ChatFile | null>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onOpenChange(false);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onOpenChange]);

  // Closing the panel should also drop any lightbox it opened.
  useEffect(() => {
    if (!open) setLightboxFile(null);
  }, [open]);

  if (!open) return null;

  return (
    <>
    <div
      role="dialog"
      aria-label="Files in this chat"
      className="fixed right-2 top-2 bottom-5 z-50 flex h-[calc(100dvh-1.75rem)] w-[min(calc(100vw-1rem),23rem)] flex-col overflow-hidden rounded-2xl border border-border bg-popover/95 text-popover-foreground shadow-lg backdrop-blur-md"
    >
      <div className="flex shrink-0 items-center justify-between gap-2 border-b border-border/80 px-3.5 py-2.5 bg-muted/20">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted text-foreground">
            <FolderOpen className="size-4" />
          </span>
          <p className="text-[15px] font-semibold leading-tight text-foreground truncate">
            Files in this chat
          </p>
        </div>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={() => onOpenChange(false)}
                className="flex size-9 shrink-0 items-center justify-center rounded-lg text-muted-foreground outline-none transition-colors hover:bg-accent hover:text-foreground focus-visible:ring-1 focus-visible:ring-ring"
                aria-label="Close files panel"
              >
                <X className="size-4.5" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom">Close</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-2">
        {!rows.length ? (
          <div className="flex h-full min-h-36 items-center justify-center px-4 text-center">
            <p className="text-sm font-medium text-foreground">
              No files in this chat
            </p>
          </div>
        ) : (
          <ul className="space-y-1.5 p-1">
            {rows.map(file => {
              const kind = getFileKind(file.filename, file.mimeType);
              const image = isImageFile(file.filename, file.mimeType);
              const isPdfFile = isViewableDocument(
                file.filename,
                file.mimeType
              );
              return (
                <li key={file.id}>
                  <a
                    href={file.url}
                    target={isPdfFile || image ? undefined : "_blank"}
                    rel={isPdfFile || image ? undefined : "noreferrer"}
                    onClick={e => {
                      if (image) {
                        e.preventDefault();
                        setLightboxFile(file);
                        return;
                      }
                      if (isPdfFile) {
                        e.preventDefault();
                        openPdf({
                          url: file.url,
                          filename: file.filename,
                          id: file.id,
                        });
                        onOpenChange(false);
                      }
                    }}
                    className="group flex items-center gap-3 rounded-xl border border-transparent p-2 transition-all hover:border-border/50 hover:bg-accent/60"
                  >
                    {image ? (
                      <span className="flex size-11 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border bg-muted/40">
                        <img
                          src={file.url}
                          alt={file.filename}
                          className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-105"
                        />
                      </span>
                    ) : (
                      <kind.icon className="size-10 shrink-0" />
                    )}
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px] font-semibold text-foreground group-hover:text-primary transition-colors">
                        {file.filename}
                      </span>
                      <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                        {kind.label}
                      </span>
                    </span>
                    {image ? (
                      <span className="flex size-7 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors group-hover:bg-background/80 group-hover:text-foreground">
                        <Eye className="size-3.5" />
                      </span>
                    ) : isPdfFile ? null : (
                      <span className="flex size-7 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors group-hover:bg-background/80 group-hover:text-foreground">
                        <ExternalLink className="size-3.5" />
                      </span>
                    )}
                  </a>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
    <ImageLightbox
      images={
        lightboxFile
          ? [
              {
                src: lightboxFile.url,
                alt: lightboxFile.filename,
                label: lightboxFile.filename,
                downloadUrl: lightboxFile.url,
                downloadName: lightboxFile.filename,
              },
            ]
          : []
      }
      index={lightboxFile ? 0 : null}
      onIndexChange={() => {}}
      onClose={() => setLightboxFile(null)}
      title="Chat image"
    />
    </>
  );
});
