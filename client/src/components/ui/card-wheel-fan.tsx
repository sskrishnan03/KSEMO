import { AnimatePresence, motion } from "framer-motion";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import React, { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { ImageLightbox } from "./image-lightbox";

export type CardWheelFanImage = {
  src: string;
  alt?: string;
  label?: string;
};

export type CardWheelFanSize = "sm" | "md" | "lg";
export type CardWheelFanTheme = "light" | "dark";

const SLOT_COUNT = 5;

// The gallery only reveals this many images per page; the rest are reached with
// the next/next/next (right-side) buttons.
const PAGE_SIZE_DEFAULT = 11;

const SIZES: Record<
  CardWheelFanSize,
  { cardW: number; cardH: number; gap: number }
> = {
  sm: { cardW: 88, cardH: 120, gap: 62 },
  md: { cardW: 108, cardH: 148, gap: 76 },
  lg: { cardW: 128, cardH: 176, gap: 90 },
};

function resolveDarkness(theme?: CardWheelFanTheme): boolean {
  if (theme) return theme === "dark";
  if (typeof document === "undefined") return true;
  return document.documentElement.classList.contains("dark");
}

function nearestScrollable(start: HTMLElement | null): HTMLElement | null {
  let node: HTMLElement | null = start?.parentElement ?? null;
  while (node) {
    const st = getComputedStyle(node);
    if (/(auto|scroll)/.test(st.overflowY) || /(auto|scroll)/.test(st.overflowX)) {
      break;
    }
    node = node.parentElement;
  }
  return node;
}

/**
 * A linear card-spread of an uploaded image set — exactly the "stacked cards
 * fan out sideways on hover" look. At rest the cards sit perfectly stacked so
 * only the latest image (and a small "+N" badge) is visible; on hover the cards
 * spread horizontally with a springy slide while the center card lifts +
 * scales up. Any image count (1 to 5+ slots) uses the same structure, the same
 * card size, and the same animation — the spread is always centered on the
 * newest card. The spread is measured against the chat's scrollable workspace
 * and automatically shifts/tightens so the cards NEVER go beyond the chat
 * workspace.
 *
 * Clicking the fan opens a gallery that reveals at most `pageSize` images per
 * page (rest reached via the next/next/next right-side buttons); clicking any
 * image opens an enlarged view that is also navigable with prev/next arrows.
 */
function CardLinearSpreadImpl({
  images,
  theme,
  size = "lg",
  gap,
  duration = 0.5,
  hoverIntensity = 1,
  pageSize = PAGE_SIZE_DEFAULT,
  cardClassName,
  className,
  onViewImage,
}: {
  images: CardWheelFanImage[];
  theme?: CardWheelFanTheme;
  size?: CardWheelFanSize;
  gap?: number;
  duration?: number;
  hoverIntensity?: number;
  pageSize?: number;
  cardClassName?: string;
  className?: string;
  onViewImage?: (index: number) => void;
}) {
  const dark = resolveDarkness(theme);
  const [isHovered, setIsHovered] = useState(false);
  const [open, setOpen] = useState(false);
  const [page, setPage] = useState(0);
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);
  const [span, setSpan] = useState({ gap: 0, shift: 0 });

  const total = images.length;
  const dims = SIZES[size];
  const desiredGap = gap ?? dims.gap;

  // Up to SLOT_COUNT fan slots; the newest image sits at the visual center
  // (front, on top). The center is derived from however many cards are
  // actually present, so a 1-image set centers exactly like a 5-image set.
  // Each entry keeps its absolute index so any revealed card can be opened
  // directly.
  const lastStart = Math.max(0, total - SLOT_COUNT);
  const lastIndexed = images
    .slice(lastStart)
    .map((image, i) => ({ image, index: lastStart + i }));
  const center = Math.floor(lastIndexed.length / 2);
  const newest = lastIndexed[lastIndexed.length - 1];
  const rest = lastIndexed.slice(0, -1);
  const display =
    rest.length === 0
      ? lastIndexed
      : [...rest.slice(0, center), newest, ...rest.slice(center)];
  const hiddenCount = Math.max(0, total - display.length);

  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const pageStart = page * pageSize;
  const pageImages = images.slice(pageStart, pageStart + pageSize);

  const rootRef = useRef<HTMLDivElement>(null);

  // Measure the space around the fan inside the chat workspace and clamp the
  // hover spread so the deck never extends past the workspace edges.
  function measure() {
    const el = rootRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const container = nearestScrollable(el) ?? document.documentElement;
    const cont = container.getBoundingClientRect();
    const leftAvail = Math.max(0, rect.left - Math.max(cont.left, 0));
    const rightAvail = Math.max(
      0,
      Math.min(cont.right, window.innerWidth) - rect.right
    );
    const half = dims.cardW / 2;
    const naturalHalf = desiredGap * hoverIntensity + half;

    let effGap = desiredGap * hoverIntensity;
    let shift = 0;
    if (naturalHalf > rightAvail) {
      shift = naturalHalf - rightAvail;
      const leftNeeded = naturalHalf + shift;
      if (leftNeeded > leftAvail) {
        effGap = Math.max(0, leftAvail - shift - half);
        const span2 = effGap + half;
        shift = Math.max(0, span2 - rightAvail);
      }
    }
    setSpan({ gap: effGap, shift });
  }

  useEffect(() => {
    if (!isHovered) return;
    measure();
    const onResize = () => measure();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isHovered]);

  // Lock body scroll while any layer is open; Escape closes the top layer.
  useEffect(() => {
    const locked = open || viewerIndex !== null;
    if (!locked) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open, viewerIndex]);

  useEffect(() => {
    // The enlarged viewer owns its own keyboard handling via ImageLightbox, so
    // this only closes the gallery grid layer when the viewer is not stacked.
    if (!open || viewerIndex !== null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, viewerIndex]);

  // Reset the gallery to its first page whenever it is (re)opened.
  useEffect(() => {
    if (open) setPage(0);
  }, [open]);

  function handleOpenImage(index: number) {
    if (onViewImage) {
      setOpen(false);
      onViewImage(index);
      return;
    }
    setViewerIndex(index);
  }

  if (!total) return null;

  return (
    <>
      <div
        ref={rootRef}
        className={cn("relative select-none", className)}
        style={{ width: dims.cardW, height: dims.cardH }}
      >
        <button
          type="button"
          onClick={() => setOpen(true)}
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
          onFocus={() => setIsHovered(true)}
          onBlur={() => setIsHovered(false)}
          aria-haspopup="dialog"
          aria-label={`View ${total} image${total === 1 ? "" : "s"}`}
          className="flex h-full w-full cursor-pointer items-center justify-center rounded-2xl outline-none focus-visible:ring-2 focus-visible:ring-ring/70"
        >
          {display.map(({ image, index }, i) => {
            const dist = i - center;
            const targetX =
              isHovered && center > 0
                ? (span.gap / center) * dist - span.shift
                : 0;
            const isFront = dist === 0;

            return (
              <motion.div
                key={`${image.src}-${i}`}
                animate={{
                  x: targetX,
                  scale: isHovered ? (isFront ? 1.05 : 1) : 1,
                }}
                transition={{
                  type: "spring",
                  stiffness: 180,
                  damping: 20,
                  mass: 0.8,
                  duration,
                }}
                style={{
                  zIndex: center + 1 - Math.abs(dist),
                }}
                onClick={
                  isHovered
                    ? e => {
                        e.stopPropagation();
                        handleOpenImage(index);
                      }
                    : undefined
                }
                className={cn(
                  "absolute inset-0 overflow-hidden rounded-2xl border shadow-[0_4px_10px_-2px_rgba(0,0,0,0.15)]",
                  dark ? "border-white/5 bg-zinc-900" : "border-black/5 bg-muted",
                  cardClassName
                )}
              >
                <img
                  src={image.src}
                  alt={image.alt ?? "Uploaded image"}
                  loading="lazy"
                  draggable={false}
                  className="absolute inset-0 h-full w-full object-cover"
                />
                {isFront && hiddenCount > 0 && (
                  <span
                    className={cn(
                      "absolute top-1.5 right-1.5 z-10 rounded-full px-1.5 py-0.5 text-[11px] font-bold backdrop-blur-sm",
                      dark ? "bg-white/90 text-black" : "bg-black/80 text-white"
                    )}
                  >
                    +{hiddenCount}
                  </span>
                )}
              </motion.div>
            );
          })}
        </button>
      </div>

      <AnimatePresence>
        {open && (
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={`${total} uploaded images`}
            className="fixed inset-0 z-[90] flex flex-col bg-black/85 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
          >
            <div
              className="absolute inset-0"
              onClick={() => setOpen(false)}
              aria-hidden="true"
            />
            <div className="relative z-10 mx-auto flex h-full w-full max-w-6xl flex-col px-4 pt-4 pb-6 sm:px-12">
              <div className="mb-4 flex shrink-0 items-center justify-between">
                <p className="text-sm font-semibold text-white">
                  <span className="text-white/50">Attached · </span>
                  {total} image{total === 1 ? "" : "s"}
                </p>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  aria-label="Close images"
                  className="flex size-8 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/25"
                >
                  <X className="size-4" />
                </button>
              </div>

              <div className="relative min-h-0 flex-1 overflow-y-auto">
                {pageCount > 1 && (
                  <>
                    <button
                      type="button"
                      onClick={() => setPage(p => Math.max(0, p - 1))}
                      disabled={page === 0}
                      aria-label="Previous images"
                      className="absolute top-1/2 left-0 z-10 flex size-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-white opacity-90 transition-colors hover:bg-white/25 disabled:cursor-not-allowed disabled:opacity-30 sm:left-2"
                    >
                      <ChevronLeft className="size-5" />
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setPage(p => Math.min(pageCount - 1, p + 1))
                      }
                      disabled={page >= pageCount - 1}
                      aria-label="Next images"
                      className="absolute top-1/2 right-0 z-10 flex size-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-white opacity-90 transition-colors hover:bg-white/25 disabled:cursor-not-allowed disabled:opacity-30 sm:right-2"
                    >
                      <ChevronRight className="size-5" />
                    </button>
                  </>
                )}

                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-4">
                  {pageImages.map((image, i) => {
                    const absoluteIndex = pageStart + i;
                    return (
                      <motion.button
                        key={`${image.src}-${i}`}
                        type="button"
                        onClick={() => handleOpenImage(absoluteIndex)}
                        aria-label={`View ${image.alt ?? `image ${absoluteIndex + 1}`}`}
                        initial={{ opacity: 0, scale: 0.94, y: 8 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        transition={{
                          delay: Math.min(i * 0.02, 0.4),
                          duration: 0.25,
                        }}
                        className="group relative aspect-square overflow-hidden rounded-xl border border-white/15 bg-black/30 transition-transform duration-200 hover:scale-[1.04] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
                      >
                        <img
                          src={image.src}
                          alt={image.alt ?? `Uploaded image ${absoluteIndex + 1}`}
                          loading="lazy"
                          className="h-full w-full object-cover"
                        />
                        {image.label && (
                          <span className="pointer-events-none absolute inset-x-0 bottom-0 block truncate bg-gradient-to-t from-black/85 to-transparent px-2 pt-6 pb-1.5 text-left text-[11px] font-medium text-white opacity-0 transition-opacity duration-200 group-hover:opacity-100">
                            {image.label}
                          </span>
                        )}
                      </motion.button>
                    );
                  })}
                </div>
              </div>

              {pageCount > 1 && (
                <p className="mt-3 shrink-0 text-center text-xs font-semibold text-white/60">
                  {page + 1} / {pageCount}
                </p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <ImageLightbox
        images={images}
        index={onViewImage ? null : viewerIndex}
        onIndexChange={setViewerIndex}
        onClose={() => setViewerIndex(null)}
        title="Image viewer"
      />
    </>
  );
}

/**
 * Composite card fan combining the linear-spread collapsed state with the
 * paginated gallery + enlarged viewer. Keeps the shorter/backwards-compatible
 * name so existing call sites (MessageContent) stay unchanged.
 */
export function CardWheelFan(props: Parameters<typeof CardLinearSpreadImpl>[0]) {
  return <CardLinearSpreadImpl {...props} />;
}

export default CardWheelFan;