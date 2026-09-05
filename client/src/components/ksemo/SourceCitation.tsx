/**
 * SourceCitation - Interactive inline citation component for web search and deep research.
 *
 * Renders citation pills like [1], [2], etc. that:
 * - Open the exact mapped source on click (tap on mobile)
 * - Show a source preview popover on hover (desktop) or tap-and-hold (mobile)
 * - Stay within the viewport and are keyboard accessible
 *
 * The preview popover is rendered in a fixed layer so it is never clipped by the
 * chat container.
 */

import { cn } from "@/lib/utils";
import type { Source } from "@shared/research";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { SourcePreview } from "./SourcePreview";
import { createPortal } from "react-dom";

interface SourceCitationProps {
  source: Source;
  citationNumber: number;
  onHover?: (source: Source | null, element?: HTMLElement | null) => void;
  className?: string;
}

function isSafeUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

export function SourceCitation({
  source,
  citationNumber,
  onHover,
  className,
}: SourceCitationProps) {
  const [previewOpen, setPreviewOpen] = useState(false);
  const [anchorRect, setAnchorRect] = useState<DOMRect | null>(null);
  const [screen, setScreen] = useState({ w: 0, h: 0 });
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [previewPos, setPreviewPos] = useState({ top: 0, left: 0 });

  const measure = useCallback(() => {
    setAnchorRect(buttonRef.current?.getBoundingClientRect() ?? null);
    setScreen({ w: window.innerWidth, h: window.innerHeight });
  }, []);

  useLayoutEffect(() => {
    if (!previewOpen) return;
    measure();
  }, [previewOpen, measure]);

  // Reposition on scroll/resize so the preview follows the citation.
  useEffect(() => {
    if (!previewOpen) return;
    const update = () => measure();
    window.addEventListener("scroll", update, true);
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update, true);
      window.removeEventListener("resize", update);
    };
  }, [previewOpen, measure]);

  const handleOpen = () => {
    if (source && isSafeUrl(source.url)) {
      window.open(source.url, "_blank", "noopener,noreferrer");
    }
  };

  const showPreview = () => {
    measure();
    setPreviewOpen(true);
  };

  const hidePreview = () => {
    setPreviewOpen(false);
    onHover?.(null, null);
  };

  const handlePointerEnter = () => {
    onHover?.(source, buttonRef.current);
    showPreview();
  };

  const handlePointerLeave = () => {
    onHover?.(null, null);
    setPreviewOpen(false);
  };

  // Compute popover placement relative to the anchor, keeping it in viewport.
  useLayoutEffect(() => {
    if (!previewOpen || !anchorRect) return;
    const width = 320;
    const gap = 8;
    const h = heightFor(source);
    let top = anchorRect.top - h - gap;
    let left = anchorRect.left + anchorRect.width / 2 - width / 2;
    if (top < 8) top = anchorRect.bottom + gap;
    if (left < 8) left = 8;
    if (left + width > screen.w - 8) left = screen.w - width - 8;
    setPreviewPos({ top, left });
  }, [previewOpen, anchorRect, source, screen.w]);

  useEffect(() => {
    if (!previewOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") hidePreview();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [previewOpen]);

  const ariaLabel = `Source ${citationNumber}: ${source.title}`;

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        className={cn(
          "inline-flex cursor-pointer select-none items-center justify-center",
          "align-baseline",
          "mx-0.5 size-[1.35em] rounded-full",
          "bg-sky-100 text-sky-700",
          "dark:bg-sky-900/40 dark:text-sky-300",
          "text-[0.68em] font-semibold leading-none",
          "transition-colors hover:bg-sky-200 dark:hover:bg-sky-800/60",
          "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          className
        )}
        onClick={handleOpen}
        onPointerEnter={handlePointerEnter}
        onPointerLeave={handlePointerLeave}
        onFocus={handlePointerEnter}
        onBlur={hidePreview}
        onKeyDown={e => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            handleOpen();
          }
        }}
        aria-label={ariaLabel}
        title={source.title}
      >
        {citationNumber}
      </button>
      {previewOpen &&
        anchorRect &&
        createPortal(
          <div
            className="fixed z-[999]"
            style={{ top: previewPos.top, left: previewPos.left }}
            onPointerEnter={showPreview}
            onPointerLeave={handlePointerLeave}
            role="tooltip"
          >
            <SourcePreview
              source={source}
              onOpenSource={source => {
                if (isSafeUrl(source.url))
                  window.open(source.url, "_blank", "noopener,noreferrer");
                hidePreview();
              }}
              onClose={hidePreview}
            />
          </div>,
          document.body
        )}
    </>
  );
}

function heightFor(_source: Source): number {
  return 240;
}
