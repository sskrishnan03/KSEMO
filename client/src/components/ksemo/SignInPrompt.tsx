import { Button } from "@/components/ui/button";
import { startLogin } from "@/const";
import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useRef } from "react";
import {
  AudioLines,
  Brain,
  Camera,
  Code2,
  FilePlus2,
  Image as ImageIcon,
  Library,
  LogIn,
  Mic,
  Paperclip,
  Search,
  Share2,
  SquarePen,
  Volume2,
  X,
} from "lucide-react";
import { TemporaryChatIcon } from "@/components/ksemo/icons";
import {
  ExcelLogo,
  PdfLogo,
  PowerPointLogo,
  WordLogo,
} from "@/components/ksemo/FileBrandLogos";

type TickerItem = {
  id: string;
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  isBrand?: boolean;
};

const ROW_1: TickerItem[] = [
  { id: "new-chat", title: "New chat", icon: SquarePen },
  { id: "voice-chat", title: "Voice chat", icon: AudioLines },
  { id: "create-files", title: "Create files", icon: FilePlus2 },
  { id: "browse-library", title: "Browse library", icon: Library },
  { id: "pdf-export", title: "PDF export", icon: PdfLogo, isBrand: true },
  { id: "voice-dictate", title: "Voice dictate", icon: Mic },
];

const ROW_2: TickerItem[] = [
  { id: "temp-chat", title: "Temporary chat", icon: TemporaryChatIcon },
  { id: "upload-files", title: "Upload files", icon: Paperclip },
  { id: "excel-sheets", title: "Excel sheets", icon: ExcelLogo, isBrand: true },
  { id: "search-chats", title: "Search chats", icon: Search },
  { id: "word-docs", title: "Word docs", icon: WordLogo, isBrand: true },
  { id: "upload-images", title: "Upload images", icon: ImageIcon },
];

const ROW_3: TickerItem[] = [
  { id: "slide-decks", title: "Slide decks", icon: PowerPointLogo, isBrand: true },
  { id: "take-screenshot", title: "Take screenshot", icon: Camera },
  { id: "read-aloud", title: "Read aloud", icon: Volume2 },
  { id: "code-snippets", title: "Code snippets", icon: Code2 },
  { id: "memory", title: "Memory", icon: Brain },
  { id: "share-chats", title: "Share chats", icon: Share2 },
];

function TickerPill({ item }: { item: TickerItem }) {
  const Icon = item.icon;
  return (
    <div className="flex items-center gap-2 rounded-full border border-neutral-200/90 bg-neutral-50/90 px-3 py-1.5 shadow-2xs whitespace-nowrap">
      <Icon className={item.isBrand ? "size-3.5 shrink-0" : "size-3.5 text-black shrink-0"} />
      <span className="text-[11.5px] font-semibold tracking-tight text-black select-none">
        {item.title}
      </span>
    </div>
  );
}

function MarqueeRow({
  items,
  direction = "left",
  duration = 22,
}: {
  items: TickerItem[];
  direction?: "left" | "right";
  duration?: number;
}) {
  return (
    <div className="flex overflow-hidden w-full">
      <motion.div
        className="flex w-max shrink-0"
        animate={{
          x: direction === "left" ? ["0%", "-50%"] : ["-50%", "0%"],
        }}
        transition={{
          ease: "linear",
          duration,
          repeat: Infinity,
        }}
      >
        <div className="flex items-center gap-2 pr-2 shrink-0">
          {items.map((item) => (
            <TickerPill key={item.id} item={item} />
          ))}
        </div>
        <div className="flex items-center gap-2 pr-2 shrink-0" aria-hidden="true">
          {items.map((item, idx) => (
            <TickerPill key={`${item.id}-dup-${idx}`} item={item} />
          ))}
        </div>
      </motion.div>
    </div>
  );
}

/**
 * Three-row infinite marquee prototype:
 * - Pure white background card with subtle modern dot texture.
 * - Three horizontal rows of 2-word capability pills with black/brand icons.
 * - Always moving continuously in alternating directions:
 *   Row 1: right-to-left
 *   Row 2: left-to-right
 *   Row 3: right-to-left
 * - Gradient masks on left and right borders for seamless edge fade.
 */
function ThreeRowMarqueePrototype() {
  return (
    <div className="relative h-44 w-full overflow-hidden rounded-xl border border-neutral-200/90 bg-white shadow-2xs select-none flex flex-col justify-center gap-2.5 py-3">
      {/* Modern subtle dot matrix texture on white */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.22]"
        style={{
          backgroundImage: "radial-gradient(#9ca3af 1px, transparent 1px)",
          backgroundSize: "16px 16px",
        }}
      />

      {/* Left and right fade gradients for seamless edge transitions */}
      <div className="pointer-events-none absolute inset-y-0 left-0 w-8 bg-gradient-to-r from-white via-white/80 to-transparent z-10" />
      <div className="pointer-events-none absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-white via-white/80 to-transparent z-10" />

      {/* Row 1: Right-to-left */}
      <MarqueeRow items={ROW_1} direction="left" duration={22} />

      {/* Row 2: Left-to-right */}
      <MarqueeRow items={ROW_2} direction="right" duration={25} />

      {/* Row 3: Right-to-left */}
      <MarqueeRow items={ROW_3} direction="left" duration={20} />
    </div>
  );
}

/**
 * Bottom-right card that appears when a guest tries to send a message.
 * Features an elevated-height white prototype with buttery smooth directional animation.
 * Clicking anywhere outside the card dismisses it; clicks inside never close it.
 */
export function SignInPrompt({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const cardRef = useRef<HTMLDivElement>(null);

  // Dismiss when the user taps anywhere outside the card.
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (cardRef.current && !cardRef.current.contains(event.target as Node)) {
        onClose();
      }
    };
    document.addEventListener("pointerdown", onPointerDown, true);
    return () => document.removeEventListener("pointerdown", onPointerDown, true);
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          ref={cardRef}
          className="fixed bottom-4 right-4 z-50 w-[calc(100vw-2rem)] max-w-[360px]"
          initial={{ opacity: 0, y: 16, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 16, scale: 0.97 }}
          transition={{ duration: 0.22, ease: [0.32, 0.72, 0, 1] }}
          role="dialog"
          aria-modal="false"
          aria-label="Sign in to continue"
        >
          <button
            type="button"
            onClick={onClose}
            className="absolute -right-2 -top-2 z-10 flex size-6 items-center justify-center rounded-full bg-popover text-muted-foreground shadow-md ring-1 ring-border transition-colors hover:bg-accent hover:text-foreground focus-visible:ring-0 focus-visible:outline-none"
            aria-label="Close"
          >
            <X className="size-3.5" />
          </button>

          <div className="rounded-2xl border border-border bg-popover p-3.5 shadow-xl">
            {/* 3-Row Infinite Marquee Prototype */}
            <ThreeRowMarqueePrototype />

            <h2 className="mt-3 text-center text-[14.5px] font-semibold tracking-[-0.01em]">
              Keep the conversation going
            </h2>
            <p className="mx-auto mt-0.5 text-center text-[12px] leading-relaxed text-muted-foreground">
              Sign in to unlock the full KSEMO experience.
            </p>

            <Button
              size="sm"
              onClick={() => startLogin()}
              className="mt-3 h-9.5 w-full rounded-xl bg-[oklch(0.95_0.003_80)] text-[oklch(0.21_0.008_80)] text-sm font-medium shadow-xs transition-[background-color,transform] duration-150 hover:bg-[oklch(0.93_0.003_80)] active:scale-[0.98]"
            >
              <span className="inline-flex items-center gap-2">
                <LogIn className="size-4" />
                Sign in
              </span>
            </Button>

            <p className="mt-2.5 text-center text-xs text-muted-foreground">
              New to KSEMO?{" "}
              <button
                type="button"
                onClick={() => {
                  window.location.href = "/signup";
                }}
                className="font-semibold text-foreground transition-colors hover:text-primary"
              >
                Create account
              </button>
            </p>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}