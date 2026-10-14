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
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Element | null;
      if (target?.closest("[data-code-trigger]") || panelRef.current?.contains(target))
        return;
      onClose();
    };
    window.addEventListener("keydown", onKey);
    const timer = window.setTimeout(() => {
      window.addEventListener("pointerdown", onPointerDown);
    }, 50);
    return () => {
      window.clearTimeout(timer);
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
      aria-modal="false"
      aria-label="Generated Python code"
      data-testid="generated-code-card"
      className="ksemo-code-panel-enter absolute bottom-[calc(8.25rem+env(safe-area-inset-bottom))] left-1/2 z-40 flex h-[60dvh] min-h-56 max-h-[calc(100%-9.75rem)] w-[calc(100%-2rem)] max-w-[45.5rem] -translate-x-1/2 flex-col overflow-hidden rounded-2xl border border-border bg-popover text-popover-foreground shadow-xl animate-in slide-in-from-bottom-4 fade-in duration-200"
    >
      <div className="flex shrink-0 items-center justify-between gap-2 border-b border-border/80 bg-muted/20 px-3.5 py-2.5">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted text-foreground">
            <Code2 className="size-4" />
          </span>
          <p className="truncate text-[15px] font-semibold leading-tight text-foreground">
            {filename || "Python"}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <DownloadCodeButton
            code={clean}
            rawLanguage="python"
            buttonClassName="size-8 rounded-md"
            iconClassName="size-[15px]"
          />
          <CopyCodeButton
            code={clean}
            buttonClassName="size-8 rounded-md"
            iconClassName="size-[15px]"
          />
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={onClose}
                className="flex size-8 items-center justify-center rounded-md text-muted-foreground outline-none transition-colors hover:bg-accent hover:text-foreground focus-visible:ring-1 focus-visible:ring-ring"
                aria-label="Close"
              >
                  <X className="size-[15px]" />
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
