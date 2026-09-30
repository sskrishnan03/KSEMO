import React, { memo } from "react";
import { cn } from "@/lib/utils";
import { Check, ExternalLink, AlertCircle } from "lucide-react";

export type BotActionStatusType =
  | "idle"
  | "processing"
  | "searching"
  | "opening"
  | "completed"
  | "blocked"
  | "error";

export interface BotActionData {
  intent: string;
  target?: string;
  url?: string;
  query?: string;
  status: BotActionStatusType;
  statusText: string;
  errorMessage?: string;
}

export const BotActionStatus = memo(function BotActionStatus({
  action,
  className,
}: {
  action: BotActionData;
  className?: string;
}) {
  const isPending =
    action.status === "processing" ||
    action.status === "searching" ||
    action.status === "opening";

  if (action.status === "idle") return null;

  return (
    <div
      className={cn(
        "my-2 flex items-center gap-2.5 rounded-lg border border-border/60 bg-muted/40 px-3.5 py-2 text-[13px] text-foreground/90 backdrop-blur-xs select-none transition-all duration-200",
        className
      )}
      role="status"
      aria-live="polite"
    >
      {isPending ? (
        <>
          <span className="font-medium text-foreground tracking-tight">
            {action.statusText.replace(/\.\.\.$/, "")}
          </span>
          <span
            className="inline-flex items-center gap-1 text-muted-foreground"
            aria-hidden="true"
          >
            <span className="size-1 rounded-full bg-current animate-pulse [animation-duration:1s]" />
            <span className="size-1 rounded-full bg-current animate-pulse [animation-duration:1s] [animation-delay:200ms]" />
            <span className="size-1 rounded-full bg-current animate-pulse [animation-duration:1s] [animation-delay:400ms]" />
          </span>
        </>
      ) : action.status === "completed" ? (
        <div className="flex w-full items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="flex size-4 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
              <Check className="size-2.5 stroke-[3]" />
            </span>
            <span className="font-medium text-foreground tracking-tight">
              {action.statusText || "Completed"}
            </span>
          </div>
          {action.url && (
            <a
              href={action.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <span>{action.target || "Open link"}</span>
              <ExternalLink className="size-3" />
            </a>
          )}
        </div>
      ) : action.status === "blocked" ? (
        <div className="flex w-full items-center justify-between gap-3 text-amber-600 dark:text-amber-400">
          <div className="flex items-center gap-2">
            <AlertCircle className="size-4 shrink-0" />
            <span className="font-medium text-xs sm:text-[13px]">
              {action.statusText || "Popup blocked by browser."}
            </span>
          </div>
          {action.url && (
            <a
              href={action.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 rounded bg-amber-500/10 px-2 py-1 text-xs font-semibold hover:bg-amber-500/20 transition-colors"
            >
              <span>Click to open</span>
              <ExternalLink className="size-3" />
            </a>
          )}
        </div>
      ) : action.status === "error" ? (
        <div className="flex items-center gap-2 text-destructive">
          <AlertCircle className="size-4 shrink-0" />
          <span className="text-xs font-medium">
            {action.errorMessage || action.statusText || "Couldn't open that site."}
          </span>
        </div>
      ) : null}
    </div>
  );
});
