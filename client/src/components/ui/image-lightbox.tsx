import React, { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronLeft, ChevronRight, Download, X, ZoomIn, ZoomOut } from "lucide-react";

export type ImageLightboxItem = {
  src: string;
  alt?: string;
  label?: string;
  /** Direct file URL used by the download button. Defaults to `src`. */
  downloadUrl?: string;
  downloadName?: string;
};

const ZOOM_STEPS = [1, 1.5, 2, 3];

/**
 * The single in-app image viewer used by every surface in KSEMO (chat fan,
 * Library, chat files panel, workspace panel, generated files). It matches the
 * chat fan's enlarged viewer: dimmed backdrop, 0.18s fade, circular
 * translucent controls, caption + counter, body scroll lock, and Escape /
 * arrow-key navigation. Images never leave the app in a new tab from here.
 */
export function ImageLightbox({
  images,
  index,
  onIndexChange,
  onClose,
  /** Optional heading shown in the top bar. */
  title,
}: {
  images: ImageLightboxItem[];
  index: number | null;
  onIndexChange: (index: number) => void;
  onClose: () => void;
  title?: string;
}) {
  const [zoom, setZoom] = useState(1);
  const total = images.length;
  const open = index !== null && total > 0;
  const current = open ? images[index] : undefined;

  const close = useCallback(() => {
    onClose();
  }, [onClose]);

  const go = useCallback(
    (delta: number) => {
      if (!open || total < 2) return;
      onIndexChange((index + delta + total) % total);
    },
    [index, onIndexChange, open, total]
  );

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        close();
      } else if (event.key === "ArrowRight") {
        event.stopPropagation();
        go(1);
      } else if (event.key === "ArrowLeft") {
        event.stopPropagation();
        go(-1);
      } else if (event.key === "+" || event.key === "=") {
        event.stopPropagation();
        setZoom(z => ZOOM_STEPS[Math.min(ZOOM_STEPS.indexOf(z) + 1, ZOOM_STEPS.length - 1)]);
      } else if (event.key === "-" || event.key === "_") {
        event.stopPropagation();
        setZoom(z => ZOOM_STEPS[Math.max(ZOOM_STEPS.indexOf(z) - 1, 0)]);
      } else if (event.key === "0") {
        event.stopPropagation();
        setZoom(1);
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [close, go, open]);

  useEffect(() => {
    if (open) setZoom(1);
  }, [index, open]);

  if (typeof document === "undefined") return null;

  const zoomOut = ZOOM_STEPS.indexOf(zoom) > 0;

  return createPortal(
    <AnimatePresence>
      {open && current && (
        <motion.div
          role="dialog"
          aria-modal="true"
          aria-label={title ?? "Image viewer"}
          className="fixed inset-0 z-[95] flex items-center justify-center bg-black/90 p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          onClick={close}
        >
          <button
            type="button"
            onClick={event => {
              event.stopPropagation();
              close();
            }}
            aria-label="Close image viewer"
            className="absolute top-4 right-4 z-10 rounded-full bg-white/10 p-2 text-white transition-colors hover:bg-white/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
          >
            <X className="size-5" />
          </button>

          {zoom > 1 && (
            <div
              className="absolute top-4 left-4 z-10 flex items-center gap-1.5"
              onClick={event => event.stopPropagation()}
            >
              <button
                type="button"
                onClick={() =>
                  setZoom(z =>
                    ZOOM_STEPS[Math.max(ZOOM_STEPS.indexOf(z) - 1, 0)]
                  )
                }
                disabled={!zoomOut}
                aria-label="Zoom out"
                className="rounded-full bg-white/10 p-2 text-white transition-colors hover:bg-white/25 disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
              >
                <ZoomOut className="size-5" />
              </button>
              <button
                type="button"
                onClick={() => setZoom(1)}
                aria-label="Reset zoom"
                className="rounded-full bg-white/10 px-3 py-2 text-xs font-semibold text-white tabular-nums transition-colors hover:bg-white/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
              >
                {Math.round(zoom * 100)}%
              </button>
              <button
                type="button"
                onClick={() =>
                  setZoom(z =>
                    ZOOM_STEPS[
                      Math.min(ZOOM_STEPS.indexOf(z) + 1, ZOOM_STEPS.length - 1)
                    ]
                  )
                }
                aria-label="Zoom in"
                className="rounded-full bg-white/10 p-2 text-white transition-colors hover:bg-white/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
              >
                <ZoomIn className="size-5" />
              </button>
            </div>
          )}

          {total > 1 && (
            <>
              <button
                type="button"
                onClick={event => {
                  event.stopPropagation();
                  go(-1);
                }}
                aria-label="Previous image"
                className="absolute top-1/2 left-3 z-10 -translate-y-1/2 rounded-full bg-white/10 p-2.5 text-white transition-colors hover:bg-white/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
              >
                <ChevronLeft className="size-5" />
              </button>
              <button
                type="button"
                onClick={event => {
                  event.stopPropagation();
                  go(1);
                }}
                aria-label="Next image"
                className="absolute top-1/2 right-3 z-10 -translate-y-1/2 rounded-full bg-white/10 p-2.5 text-white transition-colors hover:bg-white/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
              >
                <ChevronRight className="size-5" />
              </button>
            </>
          )}

          <div
            className={
              zoom > 1
                ? "max-h-[85vh] max-w-[90vw] cursor-grab overflow-auto"
                : "max-h-[85vh] max-w-[90vw] overflow-hidden"
            }
            onClick={event => event.stopPropagation()}
          >
            <motion.img
              key={current.src}
              src={current.src}
              alt={current.alt ?? current.label ?? "Image"}
              draggable={false}
              initial={{ opacity: 0, scale: 0.97 }}
              animate={{ opacity: 1, scale: zoom }}
              exit={{ opacity: 0 }}
              transition={{ duration: zoom > 1 ? 0.18 : 0.2, ease: "easeOut" }}
              className="mx-auto max-h-[85vh] max-w-[90vw] rounded-lg object-contain shadow-2xl"
              onClick={() => setZoom(z => (z > 1 ? 1 : 2))}
            />
          </div>

          <div
            className="absolute inset-x-0 bottom-4 z-10 flex flex-col items-center gap-2 px-4"
            onClick={event => event.stopPropagation()}
          >
            <p className="max-w-[85vw] truncate text-sm font-medium text-white/90">
              {current.label ?? current.alt ?? `Image ${index + 1}`}
              {total > 1 ? ` · ${index + 1} / ${total}` : ""}
            </p>
            <a
              href={current.downloadUrl ?? current.src}
              download={current.downloadName ?? current.label ?? true}
              onClick={event => event.stopPropagation()}
              className="rounded-full bg-white/10 p-2 text-white transition-colors hover:bg-white/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
              aria-label={`Download ${current.label ?? "image"}`}
            >
              <Download className="size-4" />
            </a>
          </div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
}

export default ImageLightbox;
