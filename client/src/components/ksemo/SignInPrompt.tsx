import { Button } from "@/components/ui/button";
import { startLogin } from "@/const";
import { AnimatePresence, motion } from "framer-motion";
import {
  Library,
  LogIn,
  MessageCircle,
  Mic,
  MoreHorizontal,
  Plus,
  Search,
  Send,
  SquarePen,
  X,
} from "lucide-react";
import { PdfLogo } from "./FileBrandLogos";

const LOOP = 6;

const userTimes = [0, 0.24, 0.34, 1];
const aiTimes = [0, 0.44, 0.54, 1];
const tempTimes = [0, 0.46, 0.56, 1];
const fileTimes = [0, 0.64, 0.74, 1];

const T = "text-[7px] leading-[1.3]";

function SidebarItem({
  icon,
  children,
  active,
}: {
  icon: React.ReactNode;
  children: React.ReactNode;
  active?: boolean;
}) {
  return (
    <div
      className={`flex items-center gap-1 rounded-md px-1.5 py-[3px] ${
        active ? "bg-[oklch(0.95_0.003_80)]" : "bg-transparent"
      }`}
    >
      <span
        className={active ? "text-[oklch(0.21_0.008_80)]/70" : "text-foreground/35"}
      >
        {icon}
      </span>
      <span
        className={`truncate font-medium ${T} ${
          active ? "text-[oklch(0.21_0.008_80)]" : "text-foreground/70"
        }`}
      >
        {children}
      </span>
    </div>
  );
}

/** Looping video-style preview of the whole KSEMO home page, using the app's
 * real visual language: dark user bubble, muted assistant bubble, sidebar
 * with New chat / Search / Library. Elements appear once and stay — no fading. */
function AppPrototypePreview() {
  const convos = ["Design ideas", "Trip to Paris", "Weekly plan"];
  return (
    <div className="w-full overflow-hidden rounded-xl border border-border bg-background">
      {/* Window chrome */}
      <div className="flex items-center gap-1.5 border-b border-border bg-muted/40 px-3 py-2">
        <span className="size-1.5 rounded-full bg-foreground/20" />
        <span className="size-1.5 rounded-full bg-foreground/20" />
        <span className="size-1.5 rounded-full bg-foreground/20" />
        <span className="ml-2 h-1.5 w-16 rounded-full bg-foreground/15" />
      </div>

      <div className="flex h-44">
        {/* Sidebar */}
        <div className="flex w-[40%] flex-col border-r border-border p-2">
          <div className="mb-1 flex items-center gap-1 px-1.5">
            <span className="size-2.5 rounded-[5px] bg-[oklch(0.21_0.008_80)]/80" />
            <span className="text-[8px] font-bold tracking-tight">KSEMO</span>
          </div>
          <div className="flex flex-col gap-[1px]">
            <SidebarItem icon={<SquarePen className="size-2.5" />} active>
              New chat
            </SidebarItem>
            <SidebarItem icon={<Search className="size-2.5" />}>
              Search
            </SidebarItem>
            <SidebarItem icon={<Library className="size-2.5" />}>
              Library
            </SidebarItem>
          </div>
          <div className="my-1 h-px bg-border" />
          <div className="flex flex-col gap-[1px]">
            {convos.map((title, i) => (
              <div key={title} className="flex items-center gap-1 px-1.5 py-[3px]">
                <span className="text-foreground/25">
                  <MessageCircle className="size-2.5" />
                </span>
                <span className={`truncate ${T} ${i === 1 ? "font-semibold" : ""} text-foreground/70`}>
                  {title}
                </span>
              </div>
            ))}
          </div>
          {/* Temporary chat chip appears once the exchange starts */}
          <motion.div
            className="mt-auto flex items-center justify-center gap-1 rounded-full bg-accent px-2 py-[3px]"
            animate={{ opacity: [0, 1, 1], y: [3, 0, 0] }}
            transition={{ duration: LOOP, times: tempTimes, ease: "easeOut", repeat: Infinity }}
          >
            <span className="size-1 rounded-full bg-foreground/45" />
            <span className={`font-semibold ${T} text-foreground/70`}>
              Temporary chat
            </span>
          </motion.div>
        </div>

        {/* Main pane */}
        <div className="flex min-w-0 flex-1 flex-col">
          {/* Top bar */}
          <div className="flex items-center justify-between border-b border-border px-2 py-1">
            <span className={`font-medium ${T} text-foreground/50`}>
              Temporary chat
            </span>
            <span className="text-foreground/30">
              <MoreHorizontal className="size-2.5" />
            </span>
          </div>

          {/* Chat thread */}
          <div className="flex min-h-0 flex-1 flex-col justify-end gap-1.5 p-2">
            <motion.div
              className="mx-auto rounded-full bg-foreground/5 px-2 py-0.5 text-[6px] uppercase tracking-wider text-foreground/40"
              animate={{ opacity: [0, 1, 1] }}
              transition={{ duration: LOOP, times: [0, 0.06, 1], ease: "easeOut", repeat: Infinity }}
            >
              New chat
            </motion.div>
            <motion.div
              className="ml-auto max-w-[80%] rounded-xl rounded-br-md bg-foreground px-2 py-1"
              animate={{ opacity: [0, 1, 1], y: [6, 0, 0] }}
              transition={{ duration: LOOP, times: userTimes, ease: "easeOut", repeat: Infinity }}
            >
              <p className={`${T} text-background`}>
                Create a PDF invoice for $240
              </p>
            </motion.div>
            <motion.div
              className="max-w-[85%] rounded-xl rounded-bl-md bg-muted px-2 py-1"
              animate={{ opacity: [0, 1, 1], y: [6, 0, 0] }}
              transition={{ duration: LOOP, times: aiTimes, ease: "easeOut", repeat: Infinity }}
            >
              <p className={`${T} text-foreground/85`}>
                Done — here&apos;s your invoice
              </p>
            </motion.div>
            <motion.div
              className="flex items-center gap-1.5 self-start rounded-xl rounded-bl-md bg-muted px-2 py-1"
              animate={{ opacity: [0, 1, 1], y: [6, 0, 0] }}
              transition={{ duration: LOOP, times: fileTimes, ease: "easeOut", repeat: Infinity }}
            >
              <PdfLogo className="size-3.5 drop-shadow-sm" />
              <span className={`${T} font-medium text-foreground/85`}>
                invoice-24.pdf
              </span>
            </motion.div>
          </div>

          {/* Composer */}
          <div className="px-2 pb-2">
            <div className="flex items-center gap-1.5 rounded-xl ring-1 ring-border px-2 py-1.5">
              <span className="text-foreground/30">
                <Plus className="size-2.5" strokeWidth={3} />
              </span>
              <span className={`${T} text-foreground/35`}>
                Send a message to KSEMO…
              </span>
              <span className="ml-auto flex items-center gap-1 text-foreground/30">
                <Mic className="size-2.5" />
                <Send className="size-2.5" />
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Bottom-right card that appears when a guest tries to send a message. A
 * looping video-style preview of the whole KSEMO home leads into the sign-in
 * ask. Clicking anywhere outside the card dismisses it; clicks inside never
 * close it.
 */
export function SignInPrompt({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div className="fixed inset-0 z-50" onClick={onClose}>
          <motion.div
            className="absolute bottom-4 right-4 w-[calc(100vw-2rem)] max-w-sm"
            initial={{ opacity: 0, y: 18, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 18, scale: 0.97 }}
            transition={{ duration: 0.24, ease: [0.32, 0.72, 0, 1] }}
            onClick={event => event.stopPropagation()}
            role="dialog"
            aria-modal="false"
            aria-label="Sign in to continue"
          >
            <button
              type="button"
              onClick={onClose}
              className="absolute -right-2.5 -top-2.5 z-10 flex size-7 items-center justify-center rounded-full bg-popover text-muted-foreground shadow-lg ring-1 ring-border transition-colors hover:bg-accent hover:text-foreground focus-visible:ring-0 focus-visible:outline-none"
              aria-label="Close"
            >
              <X className="size-4" />
            </button>
            <div className="rounded-2xl border border-border bg-popover p-4 shadow-2xl">
              <AppPrototypePreview />

              <h2 className="mt-3.5 text-center text-[15px] font-semibold tracking-[-0.02em]">
                Keep the conversation going
              </h2>
              <p className="mx-auto mt-1 max-w-[19rem] text-center text-[13px] leading-5 text-muted-foreground">
                Sign in to unlock the full KSEMO experience.
              </p>

              <Button
                size="sm"
                onClick={() => startLogin()}
                className="mt-3.5 h-10 w-full rounded-xl bg-[oklch(0.95_0.003_80)] text-[oklch(0.21_0.008_80)] text-sm font-medium shadow-sm transition-[background-color,transform] duration-150 hover:bg-[oklch(0.93_0.003_80)] active:scale-[0.98]"
              >
                <span className="inline-flex items-center gap-2">
                  <LogIn className="size-4" />
                  Sign in
                </span>
              </Button>

              <p className="mt-3 text-center text-xs text-muted-foreground">
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
        </motion.div>
      )}
    </AnimatePresence>
  );
}