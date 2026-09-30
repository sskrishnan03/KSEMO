import React, { memo, useState, useEffect, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverAnchor,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ArrowUp, Check, Copy, Mail, Paperclip, X } from "lucide-react";
import { cn } from "@/lib/utils";

export interface SharePreviewMessage {
  id: string;
  role: "user" | "assistant" | "system" | "tool" | string;
  content: string;
  attachments?: Array<{
    id: string;
    filename: string;
    mimeType?: string;
  }>;
}

const FALLBACK_PREVIEW_MESSAGES: SharePreviewMessage[] = [
  {
    id: "preview-user-1",
    role: "user",
    content: "Can you analyze our quarterly product roadmap and highlight the key milestones?",
  },
  {
    id: "preview-asst-1",
    role: "assistant",
    content:
      "Here is the summary of your quarterly roadmap:\n\n• Q1 Foundation: Core authentication, voice assistant integration, and real-time streaming.\n• Q2 Scale: Multi-modal document generation, sharing workflows, and workspace sync.\n• Q3 Enterprise: Advanced team collaboration and custom AI models.",
  },
];

export const ShareConversationDialog = memo(function ShareConversationDialog({
  open,
  onOpenChange,
  title,
  shareUrl,
  email,
  onEmailChange,
  onCopy,
  onEmail,
  onSetPublic,
  enabled,
  isPublic,
  messages,
  anchor,
  trigger,
  sideOffset = 6,
  className,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  shareUrl: string;
  email: string;
  onEmailChange: (value: string) => void;
  onCopy: () => void;
  onEmail: () => void;
  onSetPublic: (isPublic: boolean) => void;
  enabled: boolean;
  isPublic: boolean;
  messages?: SharePreviewMessage[];
  anchor?: React.ReactNode;
  trigger?: React.ReactNode;
  sideOffset?: number;
  className?: string;
}) {
  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      {anchor ? (
        <PopoverAnchor asChild>{anchor}</PopoverAnchor>
      ) : trigger ? (
        <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      ) : null}
      <PopoverContent
        showOverlay
        onOverlayClick={() => onOpenChange(false)}
        align="end"
        side="bottom"
        sideOffset={sideOffset}
        className={cn(
          "w-[calc(100vw-2rem)] sm:w-[370px] gap-3 rounded-2xl p-4 sm:p-4.5 overflow-hidden border border-border bg-card text-card-foreground shadow-2xl box-border relative",
          className
        )}
      >
        <ShareConversationPanel
          title={title}
          shareUrl={shareUrl}
          email={email}
          onEmailChange={onEmailChange}
          onCopy={onCopy}
          onEmail={onEmail}
          onSetPublic={onSetPublic}
          onCancel={() => onOpenChange(false)}
          enabled={enabled}
          isPublic={isPublic}
          messages={messages}
        />
      </PopoverContent>
    </Popover>
  );
});

export function ShareConversationPanel({
  title = "this conversation",
  email,
  onEmailChange,
  onCopy,
  onEmail,
  onSetPublic,
  onCancel,
  enabled,
  isPublic,
  messages,
}: {
  title?: string;
  shareUrl: string;
  email: string;
  onEmailChange: (value: string) => void;
  onCopy: () => void;
  onEmail: () => void;
  onSetPublic: (isPublic: boolean) => void;
  onCancel?: () => void;
  enabled: boolean;
  isPublic: boolean;
  messages?: SharePreviewMessage[];
}) {
  const [copyState, setCopyState] = useState<"idle" | "loading" | "copied">("idle");
  const [showEmailInput, setShowEmailInput] = useState(Boolean(email));
  const timersRef = useRef<number[]>([]);

  const displayMessages =
    messages !== undefined ? messages : FALLBACK_PREVIEW_MESSAGES;

  const clearTimers = useCallback(() => {
    timersRef.current.forEach(id => window.clearTimeout(id));
    timersRef.current = [];
  }, []);

  useEffect(() => {
    return () => clearTimers();
  }, [clearTimers]);

  const handleCopy = useCallback(() => {
    if (copyState !== "idle") return;
    clearTimers();
    setCopyState("loading");

    // 2-second realistic KSEMO project loader
    const loadTimer = window.setTimeout(() => {
      if (!isPublic) {
        onSetPublic(true);
      }
      onCopy();
      setCopyState("copied");

      // Reset back to idle after 2.5s
      const resetTimer = window.setTimeout(() => {
        setCopyState("idle");
      }, 2500);
      timersRef.current.push(resetTimer);
    }, 2000);

    timersRef.current.push(loadTimer);
  }, [clearTimers, copyState, isPublic, onCopy, onSetPublic]);

  const handleEmail = useCallback(() => {
    if (!isPublic) {
      onSetPublic(true);
    }
    onEmail();
  }, [isPublic, onEmail, onSetPublic]);

  return (
    <div className="w-full max-w-full min-w-0 space-y-3 box-border">
      {/* ── Header: Clean title, description, and top-right close ("X") button ── */}
      <div className="flex items-start justify-between gap-2">
        <div className="text-left space-y-0.5 min-w-0 flex-1">
          <h2 className="text-base font-semibold tracking-[-0.01em] text-foreground">
            Share conversation
          </h2>
          <p className="text-xs text-muted-foreground leading-normal truncate">
            Share “{title}” via link or email.
          </p>
        </div>
        {onCancel && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={onCancel}
            aria-label="Close share dialog"
            className="size-7 -mt-0.5 -mr-1 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors shrink-0 cursor-pointer"
          >
            <X className="size-4" />
          </Button>
        )}
      </div>

      {/* ── Chat Workspace Live Preview with Undisturbed Ambient Glow & Side Gaps ── */}
      <div className="relative w-full max-w-full min-w-0 h-44 sm:h-48 rounded-xl bg-background overflow-hidden box-border">
        {/* Scrollable Message List */}
        <div
          tabIndex={0}
          role="region"
          aria-label="Conversation workspace preview"
          className="h-full w-full overflow-y-auto overflow-x-hidden px-3.5 py-3.5 space-y-3 text-xs focus:outline-hidden box-border"
        >
          <div className="w-[90%] mx-auto space-y-3 min-w-0">
            {displayMessages.length === 0 ? (
              <div className="flex h-full items-center justify-center text-center text-muted-foreground py-8">
                <p className="text-xs">No messages in this conversation yet</p>
              </div>
            ) : (
              displayMessages.map(msg => {
                const isUser = msg.role === "user";
                return (
                  <div
                    key={msg.id}
                    className={cn(
                      "flex w-full min-w-0",
                      isUser ? "justify-end" : "justify-start"
                    )}
                  >
                    {isUser ? (
                      /* User message: compact bubble */
                      <div className="flex flex-col items-end max-w-[85%] min-w-0">
                        <div className="rounded-2xl rounded-tr-md border-0 bg-muted px-3.5 py-1.5 text-xs leading-relaxed text-foreground shadow-xs max-w-full break-words [overflow-wrap:anywhere]">
                          <p className="whitespace-pre-wrap break-words [overflow-wrap:anywhere] max-w-full">
                            {msg.content}
                          </p>
                          {msg.attachments && msg.attachments.length > 0 && (
                            <div className="mt-1 flex flex-wrap gap-1 pt-1 border-t border-border/30">
                              {msg.attachments.map(att => (
                                <span
                                  key={att.id}
                                  className="inline-flex items-center gap-1 rounded bg-background px-1.5 py-0.5 text-[10px] text-foreground border-0 max-w-full truncate"
                                >
                                  <Paperclip className="size-2.5 shrink-0" />
                                  <span className="truncate max-w-[120px]">{att.filename}</span>
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    ) : (
                      /* Assistant message: compact text */
                      <div className="w-full max-w-[90%] min-w-0 text-left text-xs leading-relaxed text-foreground py-0.5 whitespace-pre-wrap break-words [overflow-wrap:anywhere]">
                        {msg.content}
                        {msg.attachments && msg.attachments.length > 0 && (
                          <div className="mt-1 flex flex-wrap gap-1">
                            {msg.attachments.map(att => (
                              <span
                                key={att.id}
                                className="inline-flex items-center gap-1 rounded bg-muted px-1.5 py-0.5 text-[10px] text-foreground border-0 max-w-full truncate"
                              >
                                <Paperclip className="size-2.5 shrink-0 text-muted-foreground" />
                                <span className="truncate max-w-[120px]">{att.filename}</span>
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Ambient white inner glow layer: stays completely undisturbed while scrolling */}
        <div
          className="pointer-events-none absolute inset-0 rounded-xl shadow-[inset_0_0_20px_rgba(255,255,255,0.18),inset_0_0_8px_rgba(255,255,255,0.28)]"
          aria-hidden="true"
        />
      </div>

      {/* ── Side-by-side Primary Action Buttons (With hover & active transitions) ── */}
      <div className="grid grid-cols-2 gap-2 pt-0.5 w-full">
        {/* Button 1: Copy Link with KSEMO segmented loader -> black tick mark */}
        {copyState === "loading" ? (
          <Button
            type="button"
            disabled
            className="h-9 w-full gap-2 rounded-xl text-xs font-medium border-0 bg-foreground text-background opacity-95 shadow-none cursor-wait"
          >
            <div
              className="loader loader-sm shrink-0"
              style={{
                width: 14,
                height: 14,
                ["--b" as any]: "2.5px",
                background: "conic-gradient(#0000 10%, currentColor) content-box",
              }}
              aria-hidden
            />
            <span>Copying…</span>
          </Button>
        ) : copyState === "copied" ? (
          <Button
            type="button"
            className="h-9 w-full gap-1.5 rounded-xl text-xs font-semibold border-0 bg-white text-black hover:bg-white/95 shadow-none transition-all active:scale-[0.98] cursor-default"
          >
            <Check className="size-4 text-black stroke-[3]" />
            <span className="text-black font-semibold">Copied</span>
          </Button>
        ) : (
          <Button
            type="button"
            onClick={handleCopy}
            disabled={!enabled}
            className="h-9 w-full gap-2 rounded-xl text-xs font-medium cursor-pointer border-0 bg-foreground text-background hover:bg-foreground/90 active:scale-[0.98] transition-all shadow-none"
          >
            <Copy className="size-3.5" />
            <span>Copy link</span>
          </Button>
        )}

        {/* Button 2: Share via Email toggle */}
        <Button
          type="button"
          onClick={() => setShowEmailInput(prev => !prev)}
          disabled={!enabled}
          className={cn(
            "h-9 w-full gap-2 rounded-xl text-xs font-medium cursor-pointer border border-border bg-popover hover:bg-accent text-foreground active:scale-[0.98] transition-all shadow-xs",
            showEmailInput && "bg-accent"
          )}
        >
          <Mail className="size-3.5" />
          <span>Share via email</span>
        </Button>
      </div>

      {/* ── KSEMO ChatBox-Style Email Input Bar (Static borderline, no hover border color changes) ── */}
      {showEmailInput && (
        <div className="flex items-center rounded-2xl border border-border bg-popover pl-3 pr-1 py-1 w-full min-w-0 shadow-xs animate-in fade-in-0 duration-150 box-border">
          <Mail className="size-4 text-muted-foreground shrink-0 mr-2 pointer-events-none" />
          <input
            id="share-email-input"
            autoFocus
            value={email}
            onChange={e => onEmailChange(e.target.value)}
            placeholder="Enter recipient's email…"
            type="email"
            className="flex-1 min-w-0 h-8 bg-transparent text-xs text-foreground placeholder:text-muted-foreground outline-none border-0"
            onKeyDown={e => {
              if (e.key === "Enter" && email.trim() && enabled) {
                e.preventDefault();
                handleEmail();
              }
            }}
          />
          <button
            type="button"
            onClick={handleEmail}
            disabled={!email.trim() || !enabled}
            aria-label="Send email"
            className={cn(
              "size-7 rounded-full flex items-center justify-center shrink-0 transition-all active:scale-95 border-0",
              email.trim() && enabled
                ? "bg-foreground text-background hover:bg-foreground/90 cursor-pointer shadow-xs hover:scale-105"
                : "bg-muted text-muted-foreground/40 cursor-not-allowed"
            )}
          >
            <ArrowUp className="size-3.5 stroke-[2.5]" />
          </button>
        </div>
      )}
    </div>
  );
}
