import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Trash2 } from "lucide-react";
import React, { useEffect, useState } from "react";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  confirmLabel?: string;
  confirmKeyword?: string;
  busy?: boolean;
  busyLabel?: string;
  onConfirm: () => void;
};

export function ConfirmDeleteDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  confirmKeyword,
  busy,
  busyLabel,
  onConfirm,
}: Props) {
  const [typed, setTyped] = useState("");
  const keyword = confirmKeyword ?? "";
  const matched = typed.trim().toUpperCase() === keyword.toUpperCase();

  useEffect(() => {
    if (!open) setTyped("");
  }, [open]);

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-sm gap-3 rounded-2xl p-4 sm:max-w-sm">
        <div className="flex items-start gap-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-destructive/10 text-destructive">
            <Trash2 className="size-4" />
          </span>
          <div className="min-w-0 flex-1">
            <AlertDialogTitle className="text-[15px] leading-6 font-semibold tracking-[-0.01em]">
              {title}
            </AlertDialogTitle>
            <AlertDialogDescription className="mt-0.5 text-[13px] leading-5">
              {description}
            </AlertDialogDescription>
          </div>
        </div>

        {keyword && (
          <div>
            <p className="text-xs text-muted-foreground">
              Type{" "}
              <span className="font-mono font-medium text-foreground">
                {keyword}
              </span>{" "}
              to confirm:
            </p>
            <Input
              autoFocus
              value={typed}
              onChange={event => setTyped(event.target.value)}
              onKeyDown={event => {
                if (event.key === "Enter" && matched && !busy) {
                  event.preventDefault();
                  onOpenChange(false);
                  onConfirm();
                }
              }}
              className="mt-1.5 h-9 rounded-lg font-mono text-sm"
              placeholder={keyword}
            />
          </div>
        )}

        <div className="flex justify-end gap-2">
          <AlertDialogCancel
            onClick={() => onOpenChange(false)}
            className="border-transparent bg-transparent shadow-none outline-none hover:bg-muted hover:text-foreground focus-visible:ring-0 focus-visible:border-transparent"
          >
            Cancel
          </AlertDialogCancel>
          <Button
            disabled={(Boolean(keyword) && !matched) || busy}
            onClick={() => {
              onOpenChange(false);
              onConfirm();
            }}
            className="rounded-lg bg-destructive text-white hover:bg-destructive/90"
          >
            {busy ? busyLabel ?? "Deleting…" : confirmLabel ?? "Delete"}
          </Button>
        </div>
      </AlertDialogContent>
    </AlertDialog>
  );
}