import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Trash6Icon } from "./icons";
import { Loader2 } from "lucide-react";
import React, { useEffect, useState } from "react";

type PanelProps = {
  titleNode: React.ReactNode;
  descriptionNode: React.ReactNode;
  confirmLabel?: string;
  keyword: string;
  typed: string;
  onTypedChange: (value: string) => void;
  onSubmitKey: () => void;
  busy: boolean;
  busyLabel?: string;
  error?: string | null;
  cancelNode: React.ReactNode;
  onConfirm: () => void;
};

// Presentational surface of the confirmation dialog. The title/description
// arrive as nodes so the caller keeps Radix's a11y wiring while this panel
// stays renderable in isolation. While a destructive request is in flight the
// panel stays mounted and the confirm button spins; cancel and escape always
// stay available so a slow request can never trap the user.
export function ConfirmDeleteDialogPanel({
  titleNode,
  descriptionNode,
  confirmLabel,
  keyword,
  typed,
  onTypedChange,
  onSubmitKey,
  busy,
  busyLabel,
  error,
  cancelNode,
  onConfirm,
}: PanelProps) {
  const matched = typed.trim().toUpperCase() === keyword.toUpperCase();

  return (
    <>
      <div className="flex items-start gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-destructive/10 text-destructive">
          <Trash6Icon className="size-4" />
        </span>
        <div className="min-w-0 flex-1">
          {titleNode}
          {descriptionNode}
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
            disabled={busy}
            value={typed}
            onChange={event => onTypedChange(event.target.value)}
            onKeyDown={event => {
              if (event.key === "Enter" && matched && !busy) {
                event.preventDefault();
                onSubmitKey();
              }
            }}
            className="mt-1.5 h-9 rounded-lg font-mono text-sm"
            placeholder={keyword}
          />
        </div>
      )}

      {error && (
        <p
          role="alert"
          className="rounded-lg bg-destructive/10 px-2.5 py-2 text-[13px] leading-5 text-destructive"
        >
          {error}
        </p>
      )}

      <div className="flex justify-end gap-2">
        {cancelNode}
        <Button
          disabled={(Boolean(keyword) && !matched) || busy}
          onClick={onConfirm}
          className="rounded-lg bg-destructive text-destructive-foreground hover:bg-destructive/90"
        >
          {busy ? (
            <>
              <Loader2 className="size-3.5 animate-spin" />
              {busyLabel ?? "Deleting…"}
            </>
          ) : (
            (confirmLabel ?? "Delete")
          )}
        </Button>
      </div>
    </>
  );
}

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  confirmLabel?: string;
  confirmKeyword?: string;
  busy?: boolean;
  busyLabel?: string;
  error?: string | null;
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
  error,
  onConfirm,
}: Props) {
  const [typed, setTyped] = useState("");
  const keyword = confirmKeyword ?? "";
  const isBusy = Boolean(busy);

  useEffect(() => {
    if (!open) setTyped("");
  }, [open]);

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent
        // This dialog is always opened from inside an already-open Dialog
        // (Settings, WorkspacePanel, LibraryWorkspace), which sits at z-[80].
        // At the AlertDialog default of z-50 the confirmation rendered behind
        // the opaque panel, so the button looked like it did nothing at all.
        className="z-[90] max-w-sm gap-3 rounded-2xl p-4 sm:max-w-sm"
        overlayClassName="z-[85]"
        aria-busy={isBusy}
      >
        <ConfirmDeleteDialogPanel
          titleNode={
            <AlertDialogTitle className="text-[15px] leading-6 font-semibold tracking-[-0.01em]">
              {title}
            </AlertDialogTitle>
          }
          descriptionNode={
            <AlertDialogDescription className="mt-0.5 text-[13px] leading-5">
              {description}
            </AlertDialogDescription>
          }
          confirmLabel={confirmLabel}
          keyword={keyword}
          typed={typed}
          onTypedChange={setTyped}
          onSubmitKey={onConfirm}
          busy={isBusy}
          busyLabel={busyLabel}
          error={error}
          cancelNode={
            <AlertDialogCancel
              onClick={() => onOpenChange(false)}
              className="border-transparent bg-transparent shadow-none outline-none hover:bg-accent hover:text-foreground focus-visible:ring-0 focus-visible:border-transparent"
            >
              Cancel
            </AlertDialogCancel>
          }
          onConfirm={onConfirm}
        />
      </AlertDialogContent>
    </AlertDialog>
  );
}