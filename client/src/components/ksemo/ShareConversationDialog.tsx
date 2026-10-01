import React, { memo, useState, useEffect, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverAnchor,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ArrowUp, Check, Copy, Globe, Link as LinkIcon, Lock, Mail, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { createPrivateConversationUrl } from "@/lib/ksemoInteraction";

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

export const ShareConversationDialog = memo(function ShareConversationDialog({
  open,
  onOpenChange,
  title,
  shareUrl,
  conversationId,
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
  conversationId?: string;
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
        align="end"
        side="bottom"
        sideOffset={sideOffset}
        className={cn(
          "w-[calc(100vw-2rem)] sm:w-[350px] max-w-[350px] gap-2.5 rounded-2xl p-3 overflow-hidden border border-border bg-card text-card-foreground shadow-xl box-border relative",
          className
        )}
      >
        <ShareConversationPanel
          title={title}
          shareUrl={shareUrl}
          conversationId={conversationId}
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
  shareUrl,
  conversationId,
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
  conversationId?: string;
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
  const [activeSection, setActiveSection] = useState<"none" | "link" | "email">(() => {
    if (email) return "email";
    if (isPublic) return "link";
    return "none";
  });
  const timersRef = useRef<number[]>([]);

  const conversationTitle = title?.trim() || "Untitled Conversation";
  const origin =
    typeof window !== "undefined" ? window.location.origin : "https://ksemo.ai";
  const publicUrl = shareUrl || `${origin}/share/preview`;
  const privateUrl = conversationId
    ? createPrivateConversationUrl(origin, conversationId)
    : `${origin}/?conversation=private`;

  const currentLink = isPublic ? publicUrl : privateUrl;

  useEffect(() => {
    if (isPublic) {
      setActiveSection(prev => (prev === "none" ? "link" : prev));
    }
  }, [isPublic]);

  const clearTimers = useCallback(() => {
    timersRef.current.forEach(id => window.clearTimeout(id));
    timersRef.current = [];
  }, []);

  useEffect(() => {
    return () => clearTimers();
  }, [clearTimers]);

  const handleCopy = useCallback(async () => {
    if (copyState !== "idle") return;
    clearTimers();
    setCopyState("loading");

    try {
      if (typeof navigator !== "undefined" && navigator.clipboard) {
        await navigator.clipboard.writeText(currentLink);
      }
    } catch {
      // Fallback
    }

    // Realistic loader
    const loadTimer = window.setTimeout(() => {
      onCopy();
      setCopyState("copied");

      // Reset back to idle after 2.5s
      const resetTimer = window.setTimeout(() => {
        setCopyState("idle");
      }, 2500);
      timersRef.current.push(resetTimer);
    }, 1200);

    timersRef.current.push(loadTimer);
  }, [clearTimers, copyState, currentLink, onCopy]);

  const handleToggleLink = useCallback(() => {
    setActiveSection(prev => {
      if (prev === "link") return "none";
      if (!isPublic) {
        onSetPublic(true);
      }
      return "link";
    });
  }, [isPublic, onSetPublic]);

  const handleToggleEmail = useCallback(() => {
    setActiveSection(prev => (prev === "email" ? "none" : "email"));
  }, []);

  const handleEmail = useCallback(() => {
    if (!isPublic) {
      onSetPublic(true);
    }
    onEmail();
  }, [isPublic, onEmail, onSetPublic]);

  return (
    <div className="w-full max-w-full min-w-0 space-y-2.5 box-border">
      {/* ── Header: Clean title and top-right close ("X") button (no subtitle) ── */}
      <div className="flex items-start justify-between gap-2">
        <div className="text-left space-y-0.5 min-w-0 flex-1">
          <h2 className="text-[15px] font-semibold tracking-[-0.01em] text-foreground">
            Share conversation
          </h2>
        </div>
        {onCancel && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={onCancel}
            aria-label="Close share dialog"
            className="size-6 -mt-0.5 -mr-0.5 rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors shrink-0 cursor-pointer"
          >
            <X className="size-4" />
          </Button>
        )}
      </div>

      {/* ── Conversation Title Tile (Static, can take up to 2 lines, no looping, "Conversation" on right side) ── */}
      <div
        role="region"
        aria-label="Shared conversation details"
        className="rounded-xl border border-border/60 bg-muted/40 p-2.5 space-y-1 select-none"
      >
        <div className="flex items-center justify-end">
          <span
            data-testid="share-conversation-badge"
            className="text-xs font-normal text-muted-foreground"
          >
            Conversation
          </span>
        </div>
        <p
          data-testid="share-conversation-title"
          className="text-sm font-normal text-foreground break-words leading-snug line-clamp-2"
        >
          {conversationTitle}
        </p>
      </div>

      {/* ── Side-by-side Primary Action Buttons (Left: White Create link button, Right: Share via email) ── */}
      <div className="grid grid-cols-2 gap-2 pt-0.5 w-full">
        {/* Button 1 (Left): White Create link toggle button */}
        <Button
          type="button"
          onClick={handleToggleLink}
          disabled={!enabled}
          className={cn(
            "h-9.5 w-full gap-2 rounded-xl text-sm font-normal cursor-pointer border-0 bg-white text-black hover:bg-white/90 active:scale-[0.98] transition-all shadow-none",
            activeSection === "link" && "ring-2 ring-white/30"
          )}
        >
          <LinkIcon className="size-4 shrink-0 text-black stroke-[1.75]" />
          <span className="truncate text-black font-normal">Create link</span>
        </Button>

        {/* Button 2 (Right): Share via email toggle */}
        <Button
          type="button"
          onClick={handleToggleEmail}
          disabled={!enabled}
          className={cn(
            "h-9.5 w-full gap-2 rounded-xl text-sm font-normal cursor-pointer border border-border bg-popover hover:bg-accent text-foreground active:scale-[0.98] transition-all shadow-xs",
            activeSection === "email" && "bg-accent border-foreground/30"
          )}
        >
          <Mail className="size-4 shrink-0" />
          <span className="truncate font-normal">Share via email</span>
        </Button>
      </div>

      {/* ── Link Section: Only shown when activeSection === 'link' (Never mixed up with email) ── */}
      {activeSection === "link" && (
        <div className="space-y-2 animate-in fade-in-0 slide-in-from-top-1 duration-150">
          {/* Public / Private Selector with Taglines & Checkmarks */}
          <div className="rounded-xl border border-border/70 bg-popover overflow-hidden shadow-xs divide-y divide-border/50">
            {/* Option 1: Public */}
            <button
              type="button"
              onClick={() => onSetPublic(true)}
              className={cn(
                "w-full flex items-center justify-between p-2.5 text-left transition-colors cursor-pointer",
                isPublic ? "bg-accent/60" : "hover:bg-muted/40"
              )}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <Globe className="size-4 text-muted-foreground shrink-0" />
                <div className="min-w-0">
                  <div className="text-sm font-normal text-foreground leading-tight">
                    Public
                  </div>
                  <div className="text-xs font-normal text-muted-foreground leading-tight mt-0.5">
                    Anyone with link
                  </div>
                </div>
              </div>
              {isPublic && (
                <Check className="size-4 text-foreground stroke-[1.75] shrink-0 ml-2" />
              )}
            </button>

            {/* Option 2: Private */}
            <button
              type="button"
              onClick={() => onSetPublic(false)}
              className={cn(
                "w-full flex items-center justify-between p-2.5 text-left transition-colors cursor-pointer",
                !isPublic ? "bg-accent/60" : "hover:bg-muted/40"
              )}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <Lock className="size-4 text-muted-foreground shrink-0" />
                <div className="min-w-0">
                  <div className="text-sm font-normal text-foreground leading-tight">
                    Private
                  </div>
                  <div className="text-xs font-normal text-muted-foreground leading-tight mt-0.5">
                    Only you have access
                  </div>
                </div>
              </div>
              {!isPublic && (
                <Check className="size-4 text-foreground stroke-[1.75] shrink-0 ml-2" />
              )}
            </button>
          </div>

          {/* ── Single-line Link Bar & Copy Button Inside (Project typography, link on left, Button on right) ── */}
          <div className="flex items-center rounded-xl border border-border bg-popover pl-3 pr-1 py-1 w-full min-w-0 shadow-xs gap-2 animate-in fade-in-0 duration-150 box-border">
            <span
              data-testid="share-active-url"
              className="flex-1 text-[13px] font-normal text-muted-foreground truncate select-all min-w-0"
              title={currentLink}
            >
              {currentLink}
            </span>
            {copyState === "loading" ? (
              <Button
                type="button"
                disabled
                size="sm"
                className="h-8 px-3 rounded-lg text-xs font-normal border-0 bg-white text-black opacity-95 shrink-0 cursor-wait shadow-none"
              >
                <div
                  className="loader loader-sm shrink-0"
                  style={{
                    width: 12,
                    height: 12,
                    ["--b" as any]: "2px",
                    background: "conic-gradient(#0000 10%, currentColor) content-box",
                  }}
                  aria-hidden
                />
                <span className="truncate text-black font-normal">Copying…</span>
              </Button>
            ) : copyState === "copied" ? (
              <Button
                type="button"
                size="sm"
                className="h-8 px-3 rounded-lg text-xs font-normal border-0 bg-white text-black hover:bg-white/95 shrink-0 shadow-none cursor-default"
              >
                <Check className="size-3.5 text-black stroke-[2] shrink-0" />
                <span className="text-black font-normal truncate">Copied</span>
              </Button>
            ) : (
              <Button
                type="button"
                size="sm"
                onClick={handleCopy}
                disabled={!enabled}
                className="h-8 px-3 rounded-lg text-xs font-normal cursor-pointer border-0 bg-white text-black hover:bg-white/90 active:scale-[0.98] transition-all shrink-0 shadow-none"
              >
                <Copy className="size-3.5 text-black shrink-0" />
                <span className="truncate text-black font-normal">Copy link</span>
              </Button>
            )}
          </div>
        </div>
      )}

      {/* ── Email Section: Only shown when activeSection === 'email' (Never mixed up with link) ── */}
      {activeSection === "email" && (
        <div className="flex items-center rounded-xl border border-border bg-popover pl-3 pr-1 py-1 w-full min-w-0 shadow-xs animate-in fade-in-0 duration-150 box-border gap-2">
          <Mail className="size-4 text-muted-foreground shrink-0 pointer-events-none" />
          <input
            id="share-email-input"
            autoFocus
            value={email}
            onChange={e => onEmailChange(e.target.value)}
            placeholder="Enter recipient's email…"
            type="email"
            className="flex-1 min-w-0 h-8 bg-transparent text-sm font-normal text-foreground placeholder:text-muted-foreground outline-none border-0"
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
              "size-8 rounded-full flex items-center justify-center shrink-0 transition-all active:scale-95 border-0",
              email.trim() && enabled
                ? "bg-foreground text-background hover:bg-foreground/90 cursor-pointer shadow-xs hover:scale-105"
                : "bg-muted text-muted-foreground/40 cursor-not-allowed"
            )}
          >
            <ArrowUp className="size-4 stroke-[2]" />
          </button>
        </div>
      )}
    </div>
  );
}
