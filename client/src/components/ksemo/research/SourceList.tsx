import { useState } from "react";
import { ChevronDown, Layers, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ResearchSummary, Source } from "@shared/research";
import { SourceCard } from "./SourceCard";

/**
 * The "Sources" panel shown below a Web Search / Deep Research answer. It is
 * collapsed by default (like the files section) and expands to reveal the full,
 * numbered source cards. A live progress summary appears while research is still
 * running; a category breakdown appears once a Deep Research run completes.
 */
export function SourceList({
  sources,
  summary,
  loading = false,
  activeSourceId,
  className,
}: {
  sources: Source[];
  summary?: ResearchSummary | null;
  loading?: boolean;
  /** sourceId of the currently-hovered inline citation (auto-scroll target). */
  activeSourceId?: string | null;
  className?: string;
}) {
  const [open, setOpen] = useState(false);

  if (!sources.length && !loading) return null;

  const shown = summary ? summary.sourcesUsed : sources.length;
  return (
    <div
      className={cn(
        "mt-3 w-full overflow-hidden rounded-xl border border-border",
        className
      )}
    >
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="flex w-full items-center justify-between gap-2 bg-muted/40 px-3 py-2 text-left transition-colors hover:bg-accent/50"
      >
        <span className="flex items-center gap-2 text-sm font-medium text-foreground">
          {loading ? (
            <Loader2 className="size-4 animate-spin text-muted-foreground" />
          ) : (
            <Layers className="size-4 text-muted-foreground" />
          )}
          Sources
          {shown > 0 ? (
            <span className="text-xs font-normal text-muted-foreground">
              · {shown}
            </span>
          ) : null}
        </span>
        <ChevronDown
          className={cn(
            "size-4 text-muted-foreground transition-transform",
            open && "rotate-180"
          )}
        />
      </button>

      {summary && (
        <div className="flex flex-wrap items-center gap-1.5 border-t border-border px-3 py-2">
          {Object.entries(summary.byCategory).map(([category, count]) =>
            count ? (
              <span
                key={category}
                className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground"
              >
                {category} · {count}
              </span>
            ) : null
          )}
          {summary.sourcesUsed > 0 ? (
            <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
              {summary.sourcesUsed} sources
            </span>
          ) : null}
        </div>
      )}

      {open && (
        <div
          className="flex max-h-80 flex-col gap-1.5 overflow-y-auto border-t border-border p-2"
          id="ksemo-source-list"
        >
          {sources.map((source, index) => (
            <SourceCard
              key={source.sourceId}
              source={source}
              index={index}
              active={activeSourceId === source.sourceId}
            />
          ))}
        </div>
      )}
    </div>
  );
}
