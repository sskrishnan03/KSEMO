import React from "react";
import { cn } from "@/lib/utils";
import { ExternalLink } from "lucide-react";
import type { Source } from "@shared/research";

export function safeHostname(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

export function formatPublishedDate(value: string): string {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

/**
 * A single retrieved source as a calm, predictable row:
 * clean number → title/domain (min-width:0, wrapping title) → external glyph.
 * No overlapping columns: the number and the arrow are fixed-width, the middle
 * column owns the remaining space, and absolute positioning is avoided so the
 * card always grows to its natural height.
 */
export function SourceCard({
  source,
  index,
  active = false,
}: {
  source: Source;
  /** 0-based index; displayed as 1-based citation number. */
  index: number;
  active?: boolean;
}) {
  const hostname = source.domain || safeHostname(source.url) || "Source";
  return (
    <a
      href={source.url}
      target="_blank"
      rel="noreferrer"
      aria-label={`Source ${index + 1}: ${source.title}`}
      className={cn(
        "group flex items-start gap-2.5 rounded-lg px-2 py-1.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
        active ? "bg-accent" : "hover:bg-accent/60"
      )}
    >
      <span
        aria-hidden="true"
        className="mt-[3px] flex size-5 shrink-0 select-none items-center justify-center rounded-md bg-muted text-[11px] font-semibold tabular-nums text-muted-foreground"
      >
        {index + 1}
      </span>
      <span className="min-w-0 flex-1">
        <span className="line-clamp-2 text-[13px] font-medium leading-snug text-foreground">
          {source.title}
        </span>
        <span className="mt-0.5 block truncate text-xs text-muted-foreground">
          {source.publisher ? `${source.publisher} · ` : ""}
          {hostname}
        </span>
      </span>
      <ExternalLink
        aria-hidden="true"
        className="mt-1 size-3.5 shrink-0 text-muted-foreground/60 transition-colors group-hover:text-foreground"
      />
    </a>
  );
}