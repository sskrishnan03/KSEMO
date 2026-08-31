import React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function KsemoTextDialogPanel({
  label,
  value,
  onValueChange,
  multiline = false,
  actionLabel,
  onCancel,
  onAction,
}: {
  label: string;
  value: string;
  onValueChange: (value: string) => void;
  multiline?: boolean;
  actionLabel: string;
  onCancel: () => void;
  onAction: () => void;
}) {
  return (
    <>
      <div className="space-y-2 py-2">
        <Label htmlFor="ksemo-dialog-value">{label}</Label>
        {multiline ? (
          <textarea
            id="ksemo-dialog-value"
            value={value}
            onChange={event => onValueChange(event.target.value)}
            className="min-h-32 w-full resize-none rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40"
          />
        ) : (
          <Input
            id="ksemo-dialog-value"
            value={value}
            onChange={event => onValueChange(event.target.value)}
            maxLength={120}
            className="h-10 rounded-xl"
            autoFocus
          />
        )}
      </div>
      <div className="flex justify-end gap-2">
        <Button
          variant="ghost"
          onClick={onCancel}
          className="outline-none focus-visible:ring-0 focus-visible:border-transparent"
        >
          Cancel
        </Button>
        <Button
          onClick={onAction}
          disabled={!value.trim()}
          className="rounded-xl bg-foreground text-background hover:bg-foreground/90"
        >
          {actionLabel}
        </Button>
      </div>
    </>
  );
}
