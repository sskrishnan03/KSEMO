/**
 * SourceCard - A compact source card displayed in the Sources section.
 * 
 * This component is used to display sources at the end of web search and deep research answers.
 * It shows:
 * - Website favicon
 * - Source title
 * - Publisher name
 * - Domain
 * - Click to navigate to original source
 */

import { cn } from "@/lib/utils";
import { ExternalLink, Globe } from "lucide-react";
import type { Source } from "@shared/research";

interface SourceCardProps {
  source: Source;
  citationNumber: number;
  onClick?: (source: Source) => void;
  className?: string;
}

export function SourceCard({
  source,
  citationNumber,
  onClick,
  className,
}: SourceCardProps) {
  const handleClick = () => {
    onClick?.(source);
  };

  return (
    <button
      onClick={handleClick}
      className={cn(
        "group flex items-start gap-3 w-full text-left",
        "p-3 rounded-lg border border-border",
        "bg-card hover:bg-accent/50",
        "transition-colors",
        "focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
        className
      )}
    >
      {/* Citation number */}
      <div className="flex size-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium text-muted-foreground">
        {citationNumber}
      </div>

      {/* Favicon */}
      {source.faviconUrl ? (
        <img
          src={source.faviconUrl}
          alt=""
          className="size-5 rounded shrink-0 mt-0.5"
          onError={e => {
            (e.target as HTMLImageElement).style.display = "none";
          }}
        />
      ) : (
        <div className="flex size-5 items-center justify-center rounded bg-muted shrink-0 mt-0.5">
          <Globe className="size-3 text-muted-foreground" />
        </div>
      )}

      {/* Source info */}
      <div className="flex-1 min-w-0">
        <h4 className="text-sm font-medium text-foreground line-clamp-2 group-hover:text-primary transition-colors">
          {source.title}
        </h4>
        <div className="text-xs text-muted-foreground mt-1">
          {source.publisher && <span>{source.publisher}</span>}
          {source.publisher && source.domain && <span> · </span>}
          {source.domain && <span className="font-mono">{source.domain}</span>}
        </div>
      </div>

      {/* External link icon */}
      <ExternalLink className="size-4 text-muted-foreground shrink-0 mt-0.5 opacity-0 group-hover:opacity-100 transition-opacity" />
    </button>
  );
}