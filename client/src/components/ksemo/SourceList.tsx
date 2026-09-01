/**
 * SourceList - A container for displaying multiple source cards.
 * 
 * This component renders a section header and a grid of source cards.
 * Used at the end of web search and deep research answers.
 */

import { cn } from "@/lib/utils";
import { SourceCard } from "./SourceCard";
import type { Source } from "@shared/research";

interface SourceListProps {
  sources: Source[];
  onSourceClick?: (source: Source) => void;
  className?: string;
}

export function SourceList({
  sources,
  onSourceClick,
  className,
}: SourceListProps) {
  if (!sources.length) return null;

  return (
    <div className={cn("mt-6", className)}>
      <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-3">
        Sources
      </h3>
      <div className="grid gap-2">
        {sources.map((source, index) => (
          <SourceCard
            key={source.sourceId}
            source={source}
            citationNumber={index + 1}
            onClick={onSourceClick}
          />
        ))}
      </div>
    </div>
  );
}