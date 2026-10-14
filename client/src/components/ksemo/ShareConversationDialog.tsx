import React, { memo, useCallback, useEffect, useRef, useState } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import {
  Dialog,
  DialogDescription,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Check,
  ChevronRight,
  Copy,
  Link2,
  LockKeyhole,
  Share2,
  X,
} from "lucide-react";
import { ChatLine } from "reicon-react/icons/ChatLine";
import { cn } from "@/lib/utils";

export interface SharePreviewMessage {
  id: string;
  role: "user" | "assistant" | "system" | "tool" | string;
  content: string;
  attachments?: Array<{ id: string; filename: string; mimeType?: string }>;
}

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  shareUrl: string;
  conversationId?: string;
  email?: string;
  onEmailChange?: (value: string) => void;
  onCopy: () => void;
  onEmail?: () => void;
  onSetPublic: (isPublic: boolean) => void;
  enabled: boolean;
  isPublic: boolean;
  messages?: SharePreviewMessage[];
  anchor?: React.ReactNode;
  trigger?: React.ReactNode;
  sideOffset?: number;
  className?: string;
};
type PanelProps = Omit<Props, "open" | "onOpenChange"> & { onCancel?: () => void };

export const ShareConversationDialog = memo(function ShareConversationDialog(
  props: Props
) {
  const { open, onOpenChange, title, className } = props;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {props.anchor}
      {props.trigger}
      <DialogPortal>
        <DialogOverlay className="bg-black/55 backdrop-blur-[2px]" />
        <DialogPrimitive.Content
          className={cn(
            "fixed left-1/2 top-1/2 z-[80] max-h-[calc(100dvh-2rem)] w-[calc(100vw-2rem)] max-w-[680px] -translate-x-1/2 -translate-y-1/2 overflow-y-auto bg-transparent p-0 text-popover-foreground shadow-none outline-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0 data-[state=open]:zoom-in-95 data-[state=closed]:zoom-out-95 duration-200",
            className
          )}
        >
          <DialogTitle className="sr-only">
            Share: {title?.trim() || "Untitled Conversation"}
          </DialogTitle>
          <DialogDescription className="sr-only">
            Create and manage a link to this conversation.
          </DialogDescription>
          <ShareConversationPanel {...props} onCancel={() => onOpenChange(false)} />
        </DialogPrimitive.Content>
      </DialogPortal>
    </Dialog>
  );
});

export function ShareConversationPanel({
  title,
  shareUrl,
  onCopy,
  onSetPublic,
  onCancel,
  enabled,
  isPublic,
  messages = [],
}: PanelProps) {
  const [copyState, setCopyState] = useState<"idle" | "copied">("idle");
  const [moreOpen, setMoreOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const resetTimer = useRef<number | undefined>(undefined);
  const conversationTitle = title?.trim() || "Untitled conversation";
  const hasLink = Boolean(shareUrl && isPublic);

  useEffect(() => () => window.clearTimeout(resetTimer.current), []);

  const copyLink = useCallback(async () => {
    if (!hasLink || !enabled) return;
    try {
      await navigator.clipboard?.writeText(shareUrl);
    } catch {
      // The app's existing copy handler still provides its normal feedback.
    }
    onCopy();
    setCopyState("copied");
    window.clearTimeout(resetTimer.current);
    resetTimer.current = window.setTimeout(() => setCopyState("idle"), 2200);
  }, [enabled, hasLink, onCopy, shareUrl]);

  const primaryAction = useCallback(() => {
    if (!enabled) return;
    if (hasLink) void copyLink();
    else onSetPublic(true);
  }, [copyLink, enabled, hasLink, onSetPublic]);

  const revokeLink = useCallback(() => {
    if (!enabled || !hasLink) return;
    onSetPublic(false);
    setMoreOpen(false);
  }, [enabled, hasLink, onSetPublic]);

  const previewLink = useCallback(() => {
    if (hasLink) window.open(shareUrl, "_blank", "noopener,noreferrer");
    else setPreviewOpen(true);
  }, [hasLink, shareUrl]);

  const previewMessages = messages.filter(message => message.role !== "system" && message.role !== "tool");

  return (
    <div className="share-conversation-shell relative isolate mx-auto w-full text-foreground">
      <svg
        aria-hidden="true"
        className="share-conversation-shape pointer-events-none absolute inset-0 -z-10 hidden h-full w-full md:block"
        viewBox="0 0 680 460"
        preserveAspectRatio="none"
      >
        <path
          d="M44 1 H636 C660 1 679 20 679 44 V190 C679 218 659 239 632 239 H585 C555 239 540 255 540 284 V416 C540 440 521 459 497 459 H183 C159 459 140 440 140 416 V284 C140 255 125 239 95 239 H48 C21 239 1 218 1 190 V44 C1 20 20 1 44 1 Z"
          className="fill-popover stroke-border"
          strokeWidth="1.5"
        />
      </svg>

      <div className="relative z-10 rounded-[26px] border border-border bg-popover shadow-2xl md:rounded-none md:border-0 md:bg-transparent md:shadow-none">
        <header className="flex items-start justify-between gap-4 px-5 pb-5 pt-5 sm:px-7 sm:pt-7 md:px-8 md:pb-5 md:pt-7">
          <div className="flex min-w-0 items-start gap-3.5">
            <Share2 className="mt-1 size-6 shrink-0 text-foreground" strokeWidth={1.8} />
            <div className="min-w-0">
              <h2 className="text-lg font-semibold tracking-tight sm:text-xl">Share conversation</h2>
              <p className="mt-1 text-sm text-muted-foreground">Share this conversation with others</p>
            </div>
          </div>
          {onCancel && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label="Close share dialog"
              onClick={onCancel}
              className="-mr-2 -mt-1 size-9 shrink-0 rounded-xl text-muted-foreground hover:bg-accent hover:text-foreground"
            >
              <X className="size-5" />
            </Button>
          )}
        </header>

        <div className="px-5 pb-6 sm:px-7 md:px-8 md:pb-0">
          <div className="flex min-h-[88px] min-w-0 items-center gap-3 rounded-2xl border border-border bg-muted/35 px-4 py-3">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-muted text-foreground">
              <ChatLine aria-hidden="true" className="size-5" />
            </span>
            <p className="min-w-0 flex-1 line-clamp-2 break-words text-sm font-medium leading-5 sm:text-base">
              {conversationTitle}
            </p>
            <span className="inline-flex shrink-0 items-center gap-2 rounded-full border border-border bg-background/60 px-3 py-2 text-xs font-medium text-muted-foreground sm:text-sm">
              <ChatLine aria-hidden="true" className="size-4" />
              Conversation
            </span>
          </div>
        </div>

        <main className="mx-auto space-y-3 px-5 pb-5 sm:px-7 md:w-[min(100%,400px)] md:px-0 md:pb-7 md:pt-5">
          <p className="px-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Share link</p>
          <div className="flex min-w-0 items-center gap-3 rounded-2xl border border-border bg-muted/30 p-3.5">
            <Link2 className="size-5 shrink-0 text-muted-foreground" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">Conversation link</p>
              {hasLink ? (
                <a href={shareUrl} target="_blank" rel="noopener noreferrer" className="mt-0.5 block truncate text-xs text-muted-foreground hover:text-foreground">
                  {shareUrl}
                </a>
              ) : (
                <p className="mt-0.5 truncate text-xs text-muted-foreground">Create a link when you’re ready to share</p>
              )}
            </div>
            {hasLink && (
              <Button type="button" variant="secondary" onClick={() => void copyLink()} disabled={!enabled} className="h-9 shrink-0 gap-2 rounded-full px-3 text-sm">
                {copyState === "copied" ? <Check className="size-4" /> : <Copy className="size-4" />}
                {copyState === "copied" ? "Copied" : "Copy link"}
              </Button>
            )}
          </div>

          <div className="overflow-hidden rounded-2xl border border-border bg-muted/25">
            <div className="flex min-h-[62px] items-center justify-between gap-2 px-3 py-2">
              <Button type="button" variant="ghost" onClick={() => setMoreOpen(value => !value)} aria-expanded={moreOpen} className="h-10 gap-2 rounded-xl px-2.5 text-muted-foreground hover:text-foreground">
                <span className="flex size-8 items-center justify-center rounded-lg bg-muted text-foreground"><LockKeyhole className="size-4" /></span>
                More options
                <ChevronRight className={cn("size-4 transition-transform duration-200", moreOpen && "rotate-90")} />
              </Button>
              <Button type="button" onClick={primaryAction} disabled={!enabled} className="h-10 gap-2 rounded-full px-5 font-semibold shadow-sm">
                {hasLink ? <Copy className="size-4" /> : <Share2 className="size-4" />}
                {hasLink ? (copyState === "copied" ? "Copied" : "Copy link") : "Share"}
              </Button>
            </div>
            {moreOpen && (
              <div className="space-y-1 border-t border-border p-2 animate-in slide-in-from-top-1 fade-in duration-150">
                <button type="button" onClick={previewLink} className="flex min-h-11 w-full items-center justify-between rounded-xl px-3 text-left text-sm text-foreground transition-colors hover:bg-accent">
                  <span>Preview shared conversation</span><ChevronRight className="size-4 text-muted-foreground" />
                </button>
                {hasLink && (
                  <button type="button" disabled={!enabled} onClick={revokeLink} className="flex min-h-11 w-full items-center justify-between rounded-xl px-3 text-left text-sm text-destructive transition-colors hover:bg-destructive/10 disabled:opacity-50">
                    <span>Revoke shared link</span><X className="size-4" />
                  </button>
                )}
              </div>
            )}
          </div>
        </main>

        {previewOpen && !hasLink && (
          <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/45 p-4" onClick={() => setPreviewOpen(false)}>
            <div role="dialog" aria-modal="true" aria-label="Conversation preview" onClick={event => event.stopPropagation()} className="max-h-[70dvh] w-full max-w-md overflow-y-auto rounded-2xl border border-border bg-popover p-5 shadow-2xl">
              <div className="mb-4 flex items-center justify-between gap-3"><h3 className="font-semibold">{conversationTitle}</h3><Button type="button" variant="ghost" size="icon" aria-label="Close preview" onClick={() => setPreviewOpen(false)} className="size-8 rounded-lg"><X className="size-4" /></Button></div>
              <div className="space-y-3">{previewMessages.length ? previewMessages.map(message => <div key={message.id} className="rounded-xl bg-muted/50 p-3 text-sm"><p className="mb-1 text-xs font-medium capitalize text-muted-foreground">{message.role}</p><p className="whitespace-pre-wrap break-words">{message.content}</p>{message.attachments?.map(file => <p key={file.id} className="mt-2 truncate text-xs text-muted-foreground">{file.filename}</p>)}</div>) : <p className="text-sm text-muted-foreground">No messages to preview.</p>}</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
