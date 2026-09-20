import { Code2, X } from "lucide-react";
import React, { memo, useEffect, useRef } from "react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  CodeSurface,
  CopyCodeButton,
  DownloadCodeButton,
  stripShebang,
} from "./code-block";

type Props = {
  open: boolean;
  code: string;
  filename?: string;
  onClose: () => void;
};

export const CodeViewerPanel = memo(function CodeViewerPanel({
  open,
  code,
  filename,
  onClose,
}: Props) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    const onPointerDown = (event: MouseEvent) => {
      if (
        panelRef.current &&
        !panelRef.current.contains(event.target as Node)
      ) {
        onClose();
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
  }, [open, onClose]);

  if (!open || !code) return null;

  const clean = stripShebang(code);

  return (
    <div
      ref={panelRef}
      role="dialog"
      aria-label="Code"
      className="ksemo-code-panel-enter fixed right-2 top-2 bottom-5 z-50 flex h-[calc(100dvh-1.75rem)] w-[min(calc(100vw-1rem),27rem)] flex-col overflow-hidden rounded-2xl border border-border bg-popover/95 text-popover-foreground shadow-lg backdrop-blur-md"
    >
      <div className="flex shrink-0 items-center justify-between gap-2 border-b border-border/80 px-3.5 py-2.5 bg-muted/20">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted text-foreground">
            <Code2 className="size-4" />
          </span>
          <p className="text-[15px] font-semibold leading-tight text-foreground truncate">
            Python
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <DownloadCodeButton code={clean} rawLanguage="python" />
          <CopyCodeButton code={clean} />
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={onClose}
                className="flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground outline-none focus-visible:ring-1 focus-visible:ring-ring"
                aria-label="Close"
              >
                <X className="size-3.5" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom">Close</TooltipContent>
          </Tooltip>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="p-3">
          <CodeSurface code={clean} rawLanguage="python" />
        </div>
      </div>
    </div>
  );
});
