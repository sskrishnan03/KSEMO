import { getFileKind, IMAGE_EXT } from "@/lib/fileKinds";
import { cn } from "@/lib/utils";
import { ExternalLink, FolderOpen, X } from "lucide-react";
import React, { memo, useEffect, useMemo, useRef } from "react";

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

function isImage(file: ChatFile): boolean {
  return Boolean(
    file.mimeType?.startsWith("image/") || IMAGE_EXT.test(file.filename)
  );
}

export const ChatFilesDialog = memo(function ChatFilesDialog({
  open,
  onOpenChange,
  files,
}: Props) {
  const rows = useMemo(() => files, [files]);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onOpenChange(false);
    };
    const onPointerDown = (event: MouseEvent) => {
      if (
        panelRef.current &&
        !panelRef.current.contains(event.target as Node)
      ) {
        onOpenChange(false);
      }
    };
    window.addEventListener("keydown", onKey);
    const timer = setTimeout(() => {
      window.addEventListener("pointerdown", onPointerDown);
    }, 50);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("pointerdown", onPointerDown);
    };
  }, [open, onOpenChange]);

  if (!open) return null;

  return (
    <div
      ref={panelRef}
      role="dialog"
      aria-label="Files in this chat"
      className="fixed right-2 top-2 bottom-5 z-50 flex h-[calc(100dvh-1.75rem)] w-[min(calc(100vw-1rem),23rem)] flex-col overflow-hidden rounded-2xl border border-border bg-popover/95 text-popover-foreground shadow-2xl backdrop-blur-md animate-in fade-in-0 zoom-in-95 origin-top-right duration-150"
    >
      <div className="flex shrink-0 items-center justify-between gap-2 border-b border-border/80 px-3.5 py-2.5 bg-muted/20">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted text-foreground">
            <FolderOpen className="size-4" />
          </span>
          <p className="text-[13px] font-semibold leading-tight text-foreground truncate">
            Files in this chat
          </p>
        </div>
        <button
          type="button"
          onClick={() => onOpenChange(false)}
          className="flex size-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground outline-none transition-colors hover:bg-accent hover:text-foreground focus-visible:ring-1 focus-visible:ring-ring"
          aria-label="Close files panel"
        >
          <X className="size-4" />
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-2">
        {!rows.length ? (
          <div className="flex h-full min-h-36 flex-col items-center justify-center px-4 text-center">
            <span className="mb-2.5 flex size-12 items-center justify-center rounded-2xl bg-muted/50 text-muted-foreground/80">
              <FolderOpen className="size-6" />
            </span>
            <p className="text-sm font-medium text-foreground">
              No files in this chat
            </p>
            <p className="mt-1 text-xs text-muted-foreground max-w-[15rem] leading-relaxed">
              Files generated or attached in this conversation will appear here for quick access.
            </p>
          </div>
        ) : (
          <ul className="space-y-1.5 p-1">
            {rows.map(file => {
              const kind = getFileKind(file.filename, file.mimeType);
              const image = isImage(file);
              return (
                <li key={file.id}>
                  <a
                    href={file.url}
                    target="_blank"
                    rel="noreferrer"
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
                      <span
                        className={cn(
                          "flex size-11 shrink-0 items-center justify-center rounded-lg shadow-xs",
                          kind.colorClass
                        )}
                      >
                        <kind.icon className="size-5" />
                      </span>
                    )}
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px] font-semibold text-foreground group-hover:text-primary transition-colors">
                        {file.filename}
                      </span>
                      <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                        {kind.label}
                      </span>
                    </span>
                    <span className="flex size-7 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors group-hover:bg-background/80 group-hover:text-foreground">
                      <ExternalLink className="size-3.5" />
                    </span>
                  </a>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
});
