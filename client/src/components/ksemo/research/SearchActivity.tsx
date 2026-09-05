import React from "react";
import { Loader2, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ResearchMode } from "@shared/research";

function activityText(
  mode: ResearchMode,
  stage: string | undefined,
  sourceCount: number
): string {
  if (mode === "deep_research") {
    switch (stage) {
      case "understanding":
        return "Understanding your question";
      case "writing":
      case "synthesis":
        return "Writing your report";
      default:
        return stage ? stage.replace(/_/g, " ") : "Researching...";
    }
  }
  switch (stage) {
    case "searching":
      return "Searching the web...";
    case "analyzing":
      return sourceCount > 0
        ? `Found ${sourceCount} relevant sources`
        : "Analyzing results...";
    case "writing":
      return "Preparing your answer...";
    default:
      return "Searching the web...";
  }
}

/**
 * A quiet single-line status strip that explains what the search workflow is
 * doing right now. It sits ABOVE the answer (question → activity → answer →
 * sources) and collapses to a compact "Web Search · N sources" once the answer
 * is ready, so the finished message stays calm.
 */
export function SearchActivity({
  mode,
  stage,
  active,
  sourceCount,
  className,
}: {
  mode: ResearchMode;
  stage?: string | null;
  /** True while the research workflow is still running. */
  active: boolean;
  sourceCount: number;
  className?: string;
}) {
  const label = mode === "deep_research" ? "Deep Research" : "Web Search";
  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        "flex items-center gap-2 py-1 text-[13px] text-muted-foreground",
        className
      )}
    >
      <Search className="size-3.5 text-muted-foreground/70" aria-hidden="true" />
      <span className="font-medium text-foreground">{label}</span>
      {active ? (
        <>
          <span aria-hidden="true" className="text-muted-foreground/60">
            ·
          </span>
          <span className="truncate">
            {activityText(mode, stage ?? undefined, sourceCount)}
          </span>
          <Loader2
            className="size-3 animate-spin text-muted-foreground/70"
            aria-hidden="true"
          />
        </>
      ) : (
        sourceCount > 0 && (
          <>
            <span aria-hidden="true" className="text-muted-foreground/60">
              ·
            </span>
            <span className="tabular-nums">
              {sourceCount} source{sourceCount === 1 ? "" : "s"}
            </span>
          </>
        )
      )}
    </div>
  );
}