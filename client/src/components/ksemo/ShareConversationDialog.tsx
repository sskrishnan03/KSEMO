import React, { memo, useState, useEffect, useCallback, useRef } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import {
  Dialog,
  DialogPortal,
  DialogOverlay,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  ArrowUp,
  Check,
  Copy,
  ExternalLink,
  Globe,
  Lock,
  Mail,
  Users,
  X,
} from "lucide-react";
import { ChatLine } from "reicon-react/icons/ChatLine";
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

export type ShareAccessMode = "public" | "private" | "restricted";

interface SegmentOption<T extends string> {
  value: T;
  label: string;
  description?: string;
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
}

function AccessModeSelector({
  value,
  onChange,
  options,
  disabled,
  "aria-label": ariaLabel,
}: {
  value: ShareAccessMode;
  onChange: (value: ShareAccessMode) => void;
  options: SegmentOption<ShareAccessMode>[];
  disabled?: boolean;
  "aria-label"?: string;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className="animate-[ksemo-tag-pop_400ms_ease-out_both] space-y-1 rounded-2xl border border-white/10 bg-white/[0.04] p-1.5"
    >
      {options.map(option => {
        const Icon = option.icon;
        const active = value === option.value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={active}
            disabled={disabled}
            onClick={() => onChange(option.value)}
            className={cn(
              "flex w-full items-center justify-between rounded-xl px-3 py-2 text-left transition-colors",
              active ? "bg-white/[0.08]" : "hover:bg-white/[0.05]",
              disabled && "cursor-not-allowed opacity-50"
            )}
          >
            <div className="flex min-w-0 items-center gap-2.5">
              <Icon className="size-4 shrink-0 text-white/70" />
              <div className="flex min-w-0 flex-col">
                <span className="truncate text-sm font-medium text-white">
                  {option.label}
                </span>
                {option.description && (
                  <span className="truncate text-xs text-white/50">
                    {option.description}
                  </span>
                )}
              </div>
            </div>
            {active && (
              <Check className="size-4 shrink-0 text-white" strokeWidth={2.5} />
            )}
          </button>
        );
      })}
    </div>
  );
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
    <Dialog open={open} onOpenChange={onOpenChange}>
      {anchor}
      {trigger}
      <DialogPortal>
        <DialogOverlay className="bg-black/50" />
        <DialogPrimitive.Content
          className={cn(
            "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 fixed top-[50%] left-[50%] z-[80] grid w-[calc(100vw-2rem)] max-w-[440px] translate-x-[-50%] translate-y-[-50%] rounded-2xl border border-white/10 bg-[#1A1A1A] p-5 text-white shadow-2xl outline-none duration-200",
            className
          )}
        >
          <DialogTitle className="sr-only">
            Share: {title?.trim() || "Untitled Conversation"}
          </DialogTitle>
          <DialogDescription className="sr-only">
            Adjust access control and sharing permissions for this conversation.
          </DialogDescription>
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
        </DialogPrimitive.Content>
      </DialogPortal>
    </Dialog>
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
  const [copyState, setCopyState] = useState<"idle" | "loading" | "copied">(
    "idle"
  );
  const [accessMode, setAccessMode] = useState<ShareAccessMode>(() =>
    isPublic ? "public" : "private"
  );
  const timersRef = useRef<number[]>([]);

  const conversationTitle = title?.trim() || "Untitled Conversation";
  const origin =
    typeof window !== "undefined" ? window.location.origin : "https://ksemo.ai";
  const publicUrl = shareUrl || `${origin}/share/preview`;
  const privateUrl = conversationId
    ? createPrivateConversationUrl(origin, conversationId)
    : `${origin}/?conversation=private`;

  const currentLink = accessMode === "private" ? privateUrl : publicUrl;

  useEffect(() => {
    setAccessMode(prev =>
      isPublic ? (prev === "private" ? "public" : prev) : "private"
    );
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

    const loadTimer = window.setTimeout(() => {
      onCopy();
      setCopyState("copied");

      const resetTimer = window.setTimeout(() => {
        setCopyState("idle");
      }, 2500);
      timersRef.current.push(resetTimer);
    }, 400);

    timersRef.current.push(loadTimer);
  }, [clearTimers, copyState, currentLink, onCopy]);

  const handleAccessMode = useCallback(
    (mode: ShareAccessMode) => {
      setAccessMode(mode);
      onSetPublic(mode !== "private");
    },
    [onSetPublic]
  );

  const handleOpenLink = useCallback(() => {
    if (typeof window === "undefined") return;
    window.open(currentLink, "_blank", "noopener,noreferrer");
  }, [currentLink]);

  const handleEmail = useCallback(() => {
    if (!isPublic && accessMode !== "restricted") {
      onSetPublic(true);
    }
    onEmail();
  }, [accessMode, isPublic, onEmail, onSetPublic]);

  return (
    <div className="w-full max-w-full min-w-0 space-y-3 box-border">
      {/* ── Header: "Share conversation" on the left, clean white X close on the top right ── */}
      <div className="flex items-start justify-between gap-2">
        <h2 className="text-[15px] font-semibold tracking-[-0.01em] text-white">
          Share conversation
        </h2>
        {onCancel && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={onCancel}
            aria-label="Close share dialog"
            className="size-6 -mt-0.5 -mr-0.5 shrink-0 cursor-pointer rounded-md border-0 bg-transparent text-white/60 shadow-none transition-colors hover:bg-white/10 hover:text-white"
          >
            <X className="size-4" />
          </Button>
        )}
      </div>

      {/* ── Conversation title tile ── */}
      <div
        role="region"
        aria-label="Shared conversation details"
        className="select-none rounded-xl border border-white/10 bg-white/[0.04] p-2.5"
      >
        <div className="flex items-start gap-2">
          <ChatLine 
            aria-hidden="true" 
            className="size-[20px] shrink-0 text-white/60 transition-colors mt-0.5" 
          />
          <div className="flex-1 min-w-0">
            <p
              data-testid="share-conversation-title"
              className="line-clamp-2 break-words text-sm font-medium leading-snug text-white"
            >
              {conversationTitle}
            </p>
          </div>
          <span
            data-testid="share-conversation-badge"
            className="text-xs font-normal text-white/40 shrink-0"
          >
            Conversation
          </span>
        </div>
      </div>

      {/* ── Combined container: access mode + email like search results ── */}
      <div className="space-y-1.5">
        <p className="text-[11px] font-medium text-white/40">Sharing permissions</p>
        <div className="rounded-xl border border-white/10 bg-white/[0.04] divide-y divide-white/10">
        {/* Access mode options */}
        <button
          type="button"
          onClick={() => handleAccessMode("public")}
          className={cn(
            "flex w-full items-center justify-between px-3 py-2.5 text-left transition-colors first:rounded-t-xl",
            accessMode === "public" ? "bg-white/[0.08]" : "hover:bg-white/[0.05]"
          )}
        >
          <div className="flex min-w-0 items-center gap-2.5">
            <Globe className="size-4 shrink-0 text-white/70" />
            <div className="flex min-w-0 flex-col">
              <span className="truncate text-sm font-medium text-white">Public</span>
              <span className="truncate text-xs text-white/50">Anyone with the link</span>
            </div>
          </div>
          {accessMode === "public" && (
            <Check className="size-4 shrink-0 text-white" strokeWidth={2.5} />
          )}
        </button>

        <button
          type="button"
          onClick={() => handleAccessMode("private")}
          className={cn(
            "flex w-full items-center justify-between px-3 py-2.5 text-left transition-colors",
            accessMode === "private" ? "bg-white/[0.08]" : "hover:bg-white/[0.05]"
          )}
        >
          <div className="flex min-w-0 items-center gap-2.5">
            <Lock className="size-4 shrink-0 text-white/70" />
            <div className="flex min-w-0 flex-col">
              <span className="truncate text-sm font-medium text-white">Private</span>
              <span className="truncate text-xs text-white/50">Only you have access</span>
            </div>
          </div>
          {accessMode === "private" && (
            <Check className="size-4 shrink-0 text-white" strokeWidth={2.5} />
          )}
        </button>

        {/* Share via email section */}
        <div className="px-3 py-2.5 last:rounded-b-xl flex items-center gap-2">
          <Mail className="size-4 text-white/50 shrink-0 pointer-events-none" />
          <input
            id="share-email-input"
            value={email}
            onChange={e => onEmailChange(e.target.value)}
            placeholder="Email address…"
            type="email"
            className="flex-1 min-w-0 h-8 bg-transparent text-sm font-normal text-white placeholder:text-white/40 outline-none border-0"
            onKeyDown={e => {
              if (e.key === "Enter" && email.trim() && enabled) {
                e.preventDefault();
                handleEmail();
              }
            }}
          />
          <Button
            type="button"
            onClick={handleEmail}
            disabled={!email.trim() || !enabled}
            aria-label="Send email"
            className="h-8 shrink-0 cursor-pointer rounded-lg border-0 bg-white px-2.5 text-black shadow-none transition-all hover:bg-white/90 active:scale-[0.98]"
          >
            <ArrowUp className="size-4 shrink-0" strokeWidth={2.5} />
          </Button>
        </div>
        </div>
      </div>

      {/* ── Share link section: separate below ── */}
      <div className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5 flex items-center justify-between gap-2">
          <a
            href={currentLink}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 text-[13px] font-normal text-white/70 hover:text-white transition-colors overflow-hidden text-nowrap"
          >
            {currentLink}
          </a>
          <Button
            type="button"
            onClick={handleCopy}
            disabled={!enabled || copyState === "loading"}
            className="h-8 shrink-0 cursor-pointer rounded-lg border-0 bg-white px-3 text-[12px] font-medium text-black shadow-sm transition-all hover:bg-white/90 hover:shadow-md active:scale-[0.97] disabled:cursor-wait"
          >
            {copyState === "loading" ? (
              <>
                <span
                  className="loader loader-sm shrink-0"
                  style={{
                    width: 10,
                    height: 10,
                    ["--b" as any]: "2px",
                    background:
                      "conic-gradient(#0000 10%, currentColor) content-box",
                  }}
                  aria-hidden
                />
                <span className="truncate ml-1">Copying…</span>
              </>
            ) : (
              <>
                {copyState === "copied" ? (
                  <Check className="size-3 shrink-0" strokeWidth={2.5} />
                ) : (
                  <Copy className="size-3 shrink-0" />
                )}
                <span className="truncate ml-1">
                  {copyState === "copied" ? "Copied" : "Copy link"}
                </span>
              </>
            )}
          </Button>
        </div>
    </div>
  );
}
