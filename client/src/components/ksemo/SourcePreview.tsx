/**
 * SourcePreview - A premium source preview card that appears on hover/tap.
 * 
 * This component displays:
 * - Website favicon
 * - Publisher or website name
 * - Source title
 * - Domain
 * - Short preview
 * - Open source action
 */

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ExternalLink, Globe } from "lucide-react";
import type { Source } from "@shared/research";

interface SourcePreviewProps {
  source: Source;
  onOpenSource?: (source: Source) => void;
  onClose?: () => void;
  className?: string;
}

export function SourcePreview({
  source,
  onOpenSource,
  onClose,
  className,
}: SourcePreviewProps) {
  const handleOpenSource = () => {
    onOpenSource?.(source);
  };

  return (
    <div
      className={cn(
        "w-80 rounded-xl border border-border bg-card p-4 shadow-lg",
        "animate-in fade-in zoom-in-95 duration-200",
        className
      )}
    >
      {/* Header with favicon and publisher */}
      <div className="flex items-start gap-3 mb-3">
        {source.faviconUrl ? (
          <img
            src={source.faviconUrl}
            alt=""
            className="size-5 rounded shrink-0"
            onError={e => {
              (e.target as HTMLImageElement).style.display = "none";
            }}
          />
        ) : (
          <div className="flex size-5 items-center justify-center rounded bg-muted">
            <Globe className="size-3 text-muted-foreground" />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium text-foreground truncate">
            {source.publisher || source.domain}
          </div>
          <div className="text-xs text-muted-foreground truncate">
            {source.domain}
          </div>
        </div>
      </div>

      {/* Source title */}
      <h3 className="text-sm font-semibold text-foreground mb-2 line-clamp-2">
        {source.title}
      </h3>

      {/* Description/preview */}
      {source.description && (
        <p className="text-xs text-muted-foreground mb-3 line-clamp-3">
          {source.description}
        </p>
      )}

      {/* Metadata */}
      <div className="flex items-center gap-2 mb-3 text-xs text-muted-foreground">
        {source.publishedDate && (
          <span>
            {new Date(source.publishedDate).toLocaleDateString()}
          </span>
        )}
        {source.sourceType && (
          <span className="uppercase tracking-wide">
            {source.sourceType}
          </span>
        )}
      </div>

      {/* Open source button */}
      <Button
        variant="outline"
        size="sm"
        onClick={handleOpenSource}
        className="w-full gap-2"
      >
        <ExternalLink className="size-4" />
        Open Source
      </Button>
    </div>
  );
}