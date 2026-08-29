import React, { memo } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

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
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-2xl sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold tracking-[-0.02em]">
            Share conversation
          </DialogTitle>
          <DialogDescription>
            Choose whether “{title}” should have a public link. You can
            unpublish it at any time.
          </DialogDescription>
        </DialogHeader>
        <ShareConversationPanel
          shareUrl={shareUrl}
          email={email}
          onEmailChange={onEmailChange}
          onCopy={onCopy}
          onEmail={onEmail}
          onSetPublic={onSetPublic}
          enabled={enabled}
          isPublic={isPublic}
        />
      </DialogContent>
    </Dialog>
  );
});

export function ShareConversationPanel({
  shareUrl,
  email,
  onEmailChange,
  onCopy,
  onEmail,
  onSetPublic,
  enabled,
  isPublic,
}: {
  shareUrl: string;
  email: string;
  onEmailChange: (value: string) => void;
  onCopy: () => void;
  onEmail: () => void;
  onSetPublic: (isPublic: boolean) => void;
  enabled: boolean;
  isPublic: boolean;
}) {
  return (
    <div className="space-y-4 py-2">
      <div className="rounded-xl border border-border bg-muted/60 p-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-medium">Public link</p>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              Anyone with this link can read the conversation. Turn it on only
              when you are ready to share it publicly.
            </p>
          </div>
          <Button
            variant="outline"
            onClick={() => onSetPublic(!isPublic)}
            disabled={!enabled}
            className="h-8 shrink-0 rounded-lg text-xs"
          >
            {isPublic ? "Unpublish" : "Make public"}
          </Button>
        </div>
        {isPublic && (
          <div className="mt-3 flex gap-2">
            <Input
              value={shareUrl}
              readOnly
              className="h-9 min-w-0 rounded-lg text-xs"
              aria-label="Public conversation link"
            />
            <Button onClick={onCopy} className="h-9 shrink-0 rounded-lg">
              Copy link
            </Button>
          </div>
        )}
      </div>
      <div className="rounded-xl border border-border p-3">
        <Label htmlFor="share-email" className="text-sm">
          Email
        </Label>
        <p className="mt-1 text-xs leading-5 text-muted-foreground">
          Open your email app with the public link included. Sending remains
          under your control.
        </p>
        <div className="mt-3 flex gap-2">
          <Input
            id="share-email"
            value={email}
            onChange={event => onEmailChange(event.target.value)}
            placeholder="recipient@example.com"
            type="email"
            className="h-9 rounded-lg"
          />
          <Button
            onClick={onEmail}
            className="h-9 shrink-0 rounded-lg"
            disabled={!email.trim() || !enabled || !isPublic}
          >
            Email
          </Button>
        </div>
        {!isPublic && (
          <p className="mt-2 text-[11px] text-muted-foreground">
            Make the conversation public first to enable email sharing.
          </p>
        )}
      </div>
    </div>
  );
}
