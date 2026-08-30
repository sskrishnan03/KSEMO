import { getFileKind, IMAGE_EXT } from "@/lib/fileKinds";
import { cn } from "@/lib/utils";
import { ExternalLink, Files, X } from "lucide-react";
import { memo, useEffect, useMemo, useRef } from "react";

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
    window.addEventListener("pointerdown", onPointerDown);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("pointerdown", onPointerDown);
    };
  }, [open, onOpenChange]);

  if (!open) return null;

  return (
    <div
      ref={panelRef}
      className="absolute right-0 top-full z-50 mt-2 flex w-80 flex-col overflow-hidden rounded-2xl border border-border bg-popover text-popover-foreground shadow-xl"
    >
      <div className="flex shrink-0 items-center justify-between gap-2 border-b border-border px-3.5 py-3">
        <div className="flex items-center gap-2">
          <span className="flex size-8 items-center justify-center rounded-lg bg-muted">
            <Files className="size-4" />
          </span>
          <div>
            <p className="text-[13px] font-semibold leading-tight">
              Files in this chat
            </p>
            <p className="text-[11px] text-muted-foreground">
                {rows.length
                  ? `${rows.length} file${rows.length === 1 ? "" : "s"} in this conversation`
                  : "No files attached yet"}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="flex size-7 shrink-0 items-center justify-center rounded-lg text-muted-foreground outline-none transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-0"
            aria-label="Close files panel"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="min-h-0 max-h-[22rem] overflow-y-auto p-2">
          {!rows.length ? (
            <div className="flex flex-col items-center px-4 py-12 text-center">
              <span className="flex size-12 items-center justify-center rounded-2xl bg-muted">
                <Files className="size-5 text-muted-foreground" />
              </span>
              <p className="mt-3 text-sm font-medium">No files in this chat</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Attach images or documents to a message and they will show up
                here.
              </p>
            </div>
          ) : (
            <ul className="space-y-1">
              {rows.map(file => {
                const kind = getFileKind(file.filename, file.mimeType);
                const image = isImage(file);
                return (
                  <li key={file.id}>
                    <a
                      href={file.url}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center gap-3 rounded-xl px-2.5 py-2 transition-colors hover:bg-muted/60"
                    >
                      {image ? (
                        <span className="flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-border">
                          <img
                            src={file.url}
                            alt={file.filename}
                            className="h-full w-full object-cover"
                          />
                        </span>
                      ) : (
                        <span
                          className={cn(
                            "flex size-12 shrink-0 items-center justify-center rounded-xl",
                            kind.colorClass
                          )}
                        >
                          <kind.icon className="size-6" />
                        </span>
                      )}
                      <span className="min-w-0 flex-1">
                        <span className="block max-w-[13rem] truncate text-[13px] font-semibold text-foreground">
                          {file.filename}
                        </span>
                        <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                          {kind.label}
                        </span>
                      </span>
                      <ExternalLink className="size-4 shrink-0 text-muted-foreground" />
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