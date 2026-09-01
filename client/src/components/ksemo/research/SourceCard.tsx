import { cn } from "@/lib/utils";
import { BookOpen, ExternalLink } from "lucide-react";
import type { Source } from "@shared/research";

/**
 * Displays a single retrieved source as a compact, clickable card with its
 * real favicon, title, publisher/domain, snippet and a category badge.
 *
 * The whole card opens the original source URL in a new tab. `active` lets the
 * parent highlight the card matching the currently-hovered inline citation.
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
  const hostname = safeHostname(source.url) || source.domain;
  return (
    <a
      href={source.url}
      target="_blank"
      rel="noreferrer"
      className={cn(
        "group flex w-full items-start gap-3 rounded-xl border px-3 py-2.5 text-left transition-colors",
        active
          ? "border-primary/40 bg-accent"
          : "border-border hover:border-primary/30 hover:bg-accent/60"
      )}
    >
      <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted">
        {source.faviconUrl ? (
          <img
            src={source.faviconUrl}
            alt=""
            className="size-4"
            loading="lazy"
          />
        ) : (
          <BookOpen className="size-4 text-muted-foreground" />
        )}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium text-foreground">
          {source.title}
        </span>
        <span className="mt-0.5 block truncate text-xs text-muted-foreground">
          {source.publisher ? `${source.publisher} · ` : ""}
          {hostname}
          {source.publishedDate
            ? ` · ${formatPublishedDate(source.publishedDate)}`
            : ""}
        </span>
        {source.description ? (
          <span className="mt-1 block truncate text-xs text-muted-foreground/90">
            {source.description}
          </span>
        ) : null}
      </span>
      <span className="flex shrink-0 items-center gap-2 self-center">
        <span className="flex size-5 items-center justify-center rounded-md bg-muted text-[10px] font-semibold text-muted-foreground">
          {index + 1}
        </span>
        <ExternalLink className="size-3.5 text-muted-foreground transition-colors group-hover:text-foreground" />
      </span>
    </a>
  );
}

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
