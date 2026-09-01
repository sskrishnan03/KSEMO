/**
 * SourceCitation - Interactive inline citation component for web search and deep research.
 * 
 * This component renders citation numbers like [1], [2], etc. that:
 * - Show a source preview on hover (desktop)
 * - Open a source preview on tap (mobile)
 * - Navigate to the original source on click
 */

import { cn } from "@/lib/utils";
import type { Source } from "@shared/research";
import { useState } from "react";

interface SourceCitationProps {
  sourceId: string;
  source: Source;
  citationNumber: number;
  onClick?: (source: Source) => void;
  onHover?: (source: Source | null) => void;
  className?: string;
}

export function SourceCitation({
  sourceId,
  source,
  citationNumber,
  onClick,
  onHover,
  className,
}: SourceCitationProps) {
  const [isHovered, setIsHovered] = useState(false);

  const handleClick = () => {
    onClick?.(source);
  };

  const handleMouseEnter = () => {
    setIsHovered(true);
    onHover?.(source);
  };

  const handleMouseLeave = () => {
    setIsHovered(false);
    onHover?.(null);
  };

  return (
    <sup
      id={`citation-${sourceId}`}
      className={cn(
        "inline-flex items-center justify-center",
        "size-5 rounded-full",
        "bg-sky-100 text-sky-700",
        "dark:bg-sky-900/30 dark:text-sky-400",
        "text-xs font-medium",
        "cursor-pointer",
        "transition-colors hover:bg-sky-200 dark:hover:bg-sky-800/50",
        "select-none",
        className
      )}
      onClick={handleClick}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      title={source.title}
    >
      {citationNumber}
    </sup>
  );
}