import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { ChevronDown, Layers, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ResearchSummary, Source } from "@shared/research";
import { SourceCard } from "./SourceCard";

/**
 * Compact source control for Web Search / Deep Research answers.
 *
 * The answer is the product and sources are evidence, so this control is a
 * single quiet row — "Sources · N" — placed between the answer and the message
 * actions. The full list only appears on demand:
 *  - desktop: an anchored popover near the row (viewport-aware, never clipped)
 *  - mobile:  a bottom sheet
 * The panel scrolls internally, closes on outside click / Escape, and keeps
 * keyboard focus semantics (aria-expanded + refocus on close).
 */
export function SourcesControl({
  sources,
  summary,
  activeSourceId,
  className,
}: {
  sources: Source[];
  summary?: ResearchSummary | null;
  activeSourceId?: string | null;
  className?: string;
}) {
  if (!sources.length) return null;
  return (
    <SourcesControlInner
      sources={sources}
      summary={summary}
      activeSourceId={activeSourceId}
      className={className}
    />
  );
}

function SourcesControlInner({
  sources,
  summary,
  activeSourceId,
  className,
}: {
  sources: Source[];
  summary?: ResearchSummary | null;
  activeSourceId?: string | null;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [isCompact, setIsCompact] = useState<boolean | null>(null);
  const [pos, setPos] = useState<{ top: number; left: number; width: number } | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  // Track the viewport so we know whether to render a popover or a bottom sheet.
  useEffect(() => {
    if (!open) return;
    const mq = window.matchMedia("(max-width: 639px)");
    const updateCompact = () => setIsCompact(mq.matches);
    updateCompact();
    mq.addEventListener("change", updateCompact);
    return () => mq.removeEventListener("change", updateCompact);
  }, [open]);

  const placePanel = useCallback(() => {
    const button = buttonRef.current;
    const panel = panelRef.current;
    if (!button) return;
    const rect = button.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const width = Math.min(384, vw - 16);
    const panelHeight = panel ? panel.getBoundingClientRect().height : 320;
    let top = rect.bottom + 8;
    if (top + panelHeight > vh - 8) {
      top = rect.top - panelHeight - 8;
      if (top < 8) top = Math.max(8, vh - panelHeight - 8);
    }
    const left = Math.max(8, Math.min(rect.left, vw - width - 8));
    setPos(prev =>
      prev &&
      prev.top === top &&
      prev.left === left &&
      prev.width === width
        ? prev
        : { top, left, width }
    );
  }, []);

  useLayoutEffect(() => {
    if (!open) return;
    if (isCompact === false) {
      placePanel();
    }
  }, [open, isCompact, placePanel]);

  // Once the panel is actually in the DOM, re-measure it so the initial
  // placement (which guessed the height) locks onto the real size.
  useLayoutEffect(() => {
    if (open && pos && isCompact === false) {
      placePanel();
    }
  }, [open, pos, isCompact, placePanel]);

  useEffect(() => {
    if (!open) return;
    const update = () => placePanel();
    window.addEventListener("scroll", update, true);
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update, true);
      window.removeEventListener("resize", update);
    };
  }, [open, placePanel]);

  const close = useCallback(() => {
    setOpen(false);
    setPos(null);
    // Restore focus to the trigger so keyboard users stay in context.
    window.requestAnimationFrame(() => buttonRef.current?.focus());
  }, []);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      const panel = panelRef.current;
      const button = buttonRef.current;
      if (panel?.contains(target) || button?.contains(target)) return;
      close();
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, close]);

  const toggle = () => {
    if (open) {
      close();
      return;
    }
    setOpen(true);
    setPos(null);
  };

  const shown = summary ? summary.sourcesUsed : sources.length;

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={toggle}
        aria-haspopup="dialog"
        aria-expanded={open}
        className={cn(
          "inline-flex items-center gap-1.5 rounded-full border border-border bg-muted/50 py-1 pl-2 pr-1.5 text-xs font-medium text-foreground transition-colors",
          "hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
          className
        )}
      >
        <Layers className="size-3.5 text-muted-foreground" aria-hidden="true" />
        Sources
        {shown > 0 ? (
          <span className="tabular-nums text-muted-foreground">· {shown}</span>
        ) : null}
        <ChevronDown
          className={cn(
            "size-3.5 text-muted-foreground/70 transition-transform",
            open && "rotate-180"
          )}
          aria-hidden="true"
        />
      </button>

      {open &&
        (isCompact === null ? null : isCompact) &&
        createPortal(
          <>
            <div
              className="fixed inset-0 z-[998] bg-black/40"
              onClick={close}
              aria-hidden="true"
            />
            <div
              ref={panelRef}
              role="dialog"
              aria-label="Sources"
              className="fixed inset-x-0 bottom-0 z-[999] flex max-h-[70dvh] flex-col overflow-hidden rounded-t-2xl border border-border bg-popover text-popover-foreground shadow-xl"
            >
              <SourcesPanelHeader
                count={sources.length}
                summary={summary}
                onClose={close}
              />
              <SourcePanelList sources={sources} activeSourceId={activeSourceId} />
            </div>
          </>,
          document.body
        )}

      {open &&
        (isCompact === null ? null : !isCompact) &&
        pos &&
        createPortal(
          <div
            ref={panelRef}
            role="dialog"
            aria-label="Sources"
            className="fixed z-[999] flex max-h-[min(420px,75dvh)] flex-col overflow-hidden rounded-xl border border-border bg-popover text-popover-foreground shadow-xl"
            style={{ top: pos.top, left: pos.left, width: pos.width }}
          >
            <SourcesPanelHeader
              count={sources.length}
              summary={summary}
              onClose={close}
            />
            <SourcePanelList sources={sources} activeSourceId={activeSourceId} />
          </div>,
          document.body
        )}
    </>
  );
}

function SourcesPanelHeader({
  count,
  summary,
  onClose,
}: {
  count: number;
  summary?: ResearchSummary | null;
  onClose: () => void;
}) {
  return (
    <div className="border-b border-border/70 px-3.5 py-2.5">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-medium text-foreground">
          Sources
          <span className="ml-1.5 tabular-nums text-muted-foreground">
            · {count}
          </span>
        </span>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close sources"
          className="flex size-6 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
        >
          <X className="size-4" aria-hidden="true" />
        </button>
      </div>
      {summary && (
        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
          {Object.entries(summary.byCategory).map(([category, catCount]) =>
            catCount ? (
              <span
                key={category}
                className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground"
              >
                {category} · {catCount}
              </span>
            ) : null
          )}
        </div>
      )}
    </div>
  );
}

function SourcePanelList({
  sources,
  activeSourceId,
}: {
  sources: Source[];
  activeSourceId?: string | null;
}) {
  return (
    <ol className="ksemo-thin-scroll min-h-0 flex-1 overflow-y-auto p-1.5">
      {sources.map((source, index) => (
        <li key={source.sourceId}>
          <SourceCard
            source={source}
            index={index}
            active={activeSourceId === source.sourceId}
          />
        </li>
      ))}
    </ol>
  );
}