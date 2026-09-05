import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { getFileKind } from "@/lib/fileKinds";
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Copy,
  Download,
  Ellipsis,
  ExternalLink,
  History,
  Pencil,
  RotateCcw,
  Square,
  ThumbsDown,
  ThumbsUp,
  Trash2,
  Volume2,
  X,
} from "lucide-react";
import { ShareIcon } from "./icons";
import React, { memo, useEffect, useMemo, useState } from "react";
import { Streamdown } from "streamdown";
import { KsemoMarkdownCode } from "./code-block";
import { FileResultCard } from "./FileResultCard";
import { SourcesControl } from "./research/SourcesControl";
import { SearchActivity } from "./research/SearchActivity";
import { SourceCitation } from "./SourceCitation";
import { sanitizeAssistantText } from "@/lib/sanitizeAssistant";
import { parseContentWithSources, type ResearchMode, type Source } from "@shared/research";

type KsemoMessage = {
  id: string;
  role: "user" | "assistant" | "system" | "tool";
  content: string;
  status?: "sending" | "streaming" | "completed" | "failed" | "cancelled";
  attachments?: Array<{
    id: string;
    filename: string;
    mimeType?: string;
    url: string;
    sizeBytes?: number;
  }>;
  fileGeneration?: {
    stage: string;
    format: string;
    status: "processing" | "created" | "error";
    errorMessage?: string;
  };
  researchProgress?: {
    stage: "understanding" | "planning" | "searching" | "retrieving" | "analyzing" | "comparing" | "writing" | "completed" | "error";
    mode?: ResearchMode;
    errorMessage?: string;
  };
  /** Live sources streamed while a web search / deep research runs. */
  sources?: Source[];
};

// Stable Streamdown component map so the internal `marked.Lexer` cache is not
// invalidated on every render (a fresh `components` object defeats Streamdown's
// memo and forces a full re-parse of the message on each streaming flush).
const KSEMO_MARKDOWN_COMPONENTS = {
  code: KsemoMarkdownCode,
  a: KsemoMarkdownSourceLink,
};

type KsemoFile = NonNullable<KsemoMessage["attachments"]>[number];

/**
 * Living reference to the current message's sources, read by the custom
 * markdown link renderer (KsemoMarkdownSourceLink). Kept as a module ref so the
 * Streamdown `components` map stays object-identical across renders and is not
 * re-parsed on every streaming flush.
 */
const citationSourcesRef: { current: Source[] } = { current: [] };

/**
 * Callback wired by MessageContent so hovering an inline citation also
 * highlights the matching card in the Sources panel.
 */
const citationHoverRef: {
  current: ((source: Source | null) => void) | null;
} = { current: null };

/** Sentinel protocol marking a generated inline citation link. */
const CITE_PROTOCOL = "ksemocite:";

/**
 * Rewrites inline citation markers like [1] or [1][2] into real markdown links
 * that route to our citation component. Only markers that map to an existing
 * source are converted; anything else is left untouched so no broken citation
 * is ever rendered.
 */
function prepareCitationMarkdown(content: string): string {
  if (citationSourcesRef.current.length === 0) return content;
  return content.replace(/\[(\d+)\]/g, (match, num) => {
    const index = Number(num);
    if (
      !Number.isInteger(index) ||
      index < 1 ||
      index > citationSourcesRef.current.length
    ) {
      return match;
    }
    return `[${num}](${CITE_PROTOCOL}//${index})`;
  });
}

/**
 * Builds a clean plain-text representation (answer + numbered sources) so the
 * clipboard copy never includes embedded source metadata or broken objects.
 */
function buildCopyText(answer: string, sources: Source[]): string {
  let text = answer;
  if (sources.length > 0) {
    const sourceLines = sources
      .map((s, i) => `${i + 1}. ${s.title} — ${s.url}`)
      .join("\n");
    text = `${answer.trimEnd()}\n\nSources:\n${sourceLines}`;
  }
  return text;
}

/**
 * Custom renderer for markdown anchors. Links whose href uses the citation
 * sentinel programmatically become clickable SourceCitation pills (opening the
 * exact mapped source and showing a preview on hover/focus/tap). All other
 * links render as safe external links.
 */
function KsemoMarkdownSourceLink({
  href,
  children,
  ...props
}: React.AnchorHTMLAttributes<HTMLAnchorElement>) {
  if (href?.startsWith(CITE_PROTOCOL)) {
    const index = Number(href.slice(CITE_PROTOCOL.length + 2));
    const source = citationSourcesRef.current[index - 1];
    if (source) {
      return (
        <SourceCitation
          source={source}
          citationNumber={index}
          onHover={src => citationHoverRef.current?.(src)}
        />
      );
    }
    // Fall back to plain text marker if the source is not available.
    return <span>{`[${index}]`}</span>;
  }

  if (href && !/^(https?:|mailto:|#)/i.test(href)) {
    // Block dangerous javascript: URIs and other non-safe schemes.
    return <span {...props}>{children}</span>;
  }

  return (
    <a href={href} target="_blank" rel="noreferrer" {...props}>
      {children}
    </a>
  );
}

function formatBytes(bytes?: number): string | null {
  if (typeof bytes !== "number" || Number.isNaN(bytes) || bytes < 0) return null;
  const units = ["B", "KB", "MB", "GB"];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  const digits = unit === 0 || value >= 100 ? 0 : value >= 10 ? 1 : 2;
  return `${value.toFixed(digits)} ${units[unit]}`;
}

export const MessageContent = memo(function MessageContent({
  message,
  onSpeak,
  onPause,
  onResume,
  onStop,
  isSpeaking,
  speechState,
  isCurrentGeneration = false,
  hideTypingIndicator = false,
  onEdit,
  onRegenerate,
  onRetry,
  onFeedback,
  onShare,
  onDelete,
  onViewHistory,
}: {
  message: KsemoMessage;
  onSpeak: (text: string, messageId: string) => void;
  onPause: () => void;
  onResume: () => void;
  onStop: () => void;
  isSpeaking: boolean;
  speechState: "idle" | "playing" | "paused";
  isCurrentGeneration?: boolean;
  hideTypingIndicator?: boolean;
  onEdit?: (message: KsemoMessage) => void;
  onRegenerate?: (message: KsemoMessage) => void;
  onRetry?: (message: KsemoMessage) => void;
  onFeedback?: (messageId: string, value: "up" | "down") => void;
  onShare?: (message: KsemoMessage) => void;
  onDelete?: (message: KsemoMessage) => void;
  onViewHistory?: (message: KsemoMessage) => void;
}) {
  const [copied, setCopied] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [previewFile, setPreviewFile] = useState<KsemoFile | null>(null);
  const isUser = message.role === "user";
  const images = (message.attachments ?? []).filter(f =>
    f.mimeType?.startsWith("image/")
  );
  const previewKind = previewFile
    ? getFileKind(previewFile.filename, previewFile.mimeType)
    : null;

  // Parse sources from message content for research results. The sanitizer is a
  // render-level safety net: the server strips internal markers per streamed
  // delta, but this pass guarantees one that spanned two deltas (or lives in a
  // legacy row) never reaches the visible answer or the clipboard.
  const { answer: cleanContent, sources } = parseContentWithSources(
    sanitizeAssistantText(message.content)
  );

  // While a research run is live, prefer the sources streamed to the message so
  // the Sources panel fills in before the final answer settles. Once the run
  // completes (or on a reload), the embedded sources in `sources` win.
  const activeSources =
    message.sources && message.sources.length > 0
      ? message.sources
      : sources;

  const researchProgress = message.researchProgress;
  const researchInProgress = Boolean(
    researchProgress &&
      researchProgress.stage !== "completed" &&
      researchProgress.stage !== "error"
  );
  // Whether the message belongs to a web-search or deep-research workflow
  // (either still running or already finished with sources).
  const hasResearchWorkflow = Boolean(
    researchProgress || activeSources.length > 0
  );

  // Publish the current sources to the citation link renderer (module-level ref
  // keeps the Streamdown components map stable so it is not re-parsed on every
  // streaming flush).
  citationSourcesRef.current = activeSources;
  const [hoveredSource, setHoveredSource] = useState<Source | null>(null);
  const hoveredSourceId = hoveredSource?.sourceId ?? null;
  citationHoverRef.current = (source: Source | null) =>
    setHoveredSource(source);

  const citationContent = useMemo(
    () => prepareCitationMarkdown(cleanContent),
    [cleanContent]
  );

  useEffect(() => {
    if (lightboxIndex === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setLightboxIndex(null);
      else if (e.key === "ArrowRight")
        setLightboxIndex(i => (i! + 1) % images.length);
      else if (e.key === "ArrowLeft")
        setLightboxIndex(i => (i! - 1 + images.length) % images.length);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [lightboxIndex, images.length]);

  useEffect(() => {
    if (!previewFile) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setPreviewFile(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [previewFile]);

  useEffect(() => {
    if (!hoveredSource) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setHoveredSource(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [hoveredSource]);

  async function copyMessage() {
    const copyText = buildCopyText(cleanContent, sources);
    await navigator.clipboard.writeText(copyText);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1_500);
  }

  if (message.role === "system" || message.role === "tool") return null;

  const actionClass =
    "size-7 rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground";
  const action = (label: string, icon: React.ReactNode, click: () => void) => (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className={actionClass}
          onClick={click}
          aria-label={label}
        >
          {icon}
        </Button>
      </TooltipTrigger>
      <TooltipContent side="bottom">{label}</TooltipContent>
    </Tooltip>
  );

  return (
    <>
      <article
        className={cn("group flex", isUser ? "justify-end" : "justify-start")}
      >
      <div
        className={cn(
          "min-w-0",
          isUser
            ? "flex w-fit max-w-[84%] flex-col items-end sm:max-w-[68%]"
            : "w-full"
        )}
      >
        {isUser && message.attachments?.length ? (
          (() => {
            const documents = message.attachments.filter(
              f => !f.mimeType?.startsWith("image/")
            );
            const extra = images.length - 4;
            return (
              <div className="mb-2 flex max-w-full flex-wrap items-end gap-2">
                {images.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {images.slice(0, 4).map((file, i) => {
                      const isLastShown = i === 3;
                      return (
                        <button
                          key={file.id}
                          type="button"
                          onClick={() => setLightboxIndex(i)}
                          className="group relative size-16 shrink-0 overflow-hidden rounded-lg border border-border bg-muted/50"
                          aria-label={`View ${file.filename}`}
                        >
                          <img
                            src={file.url}
                            alt={file.filename}
                            className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-105"
                          />
                          {isLastShown && extra > 0 && (
                            <span className="absolute inset-0 flex items-center justify-center bg-black/55 text-base font-semibold text-white">
                              +{extra}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
                {documents.length > 0 && (
                  <div className="flex max-w-full flex-wrap justify-end gap-2">
                    {documents.map(file => {
                      const kind = getFileKind(file.filename, file.mimeType);
                      return (
                        <a
                          key={file.id}
                          href={file.url}
                          target="_blank"
                          rel="noreferrer"
                          className="overflow-hidden rounded-xl border border-border bg-muted/50 text-left shadow-sm"
                        >
                          <span className="flex min-w-44 items-center gap-2 p-2.5">
                            <span
                              className={`flex size-8 shrink-0 items-center justify-center rounded-lg ${kind.colorClass}`}
                            >
                              <kind.icon className="size-4" />
                            </span>
                            <span className="min-w-0">
                              <span className="block truncate text-xs font-medium">
                                {file.filename}
                              </span>
                              <span className="mt-0.5 block text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                                {kind.label}
                              </span>
                            </span>
                          </span>
                        </a>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })()
        ) : null}
        {/* Search activity — quiet status line, sits directly above the answer */}
        {!isUser && hasResearchWorkflow && (
          <SearchActivity
            mode={message.researchProgress?.mode ?? "web_search"}
            stage={message.researchProgress?.stage}
            active={researchInProgress}
            sourceCount={activeSources.length}
            className="mb-1"
          />
        )}

        {!isUser &&
          message.researchProgress?.stage === "error" &&
          message.researchProgress.errorMessage && (
            <div className="mt-3 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
              {message.researchProgress.errorMessage}
            </div>
          )}

        <div
          className={cn(
            "text-[15px] leading-6",
            isUser
              ? "w-fit rounded-2xl rounded-tr-md border border-border bg-muted px-3.5 py-2.5 text-[15px] leading-6 text-foreground shadow-sm"
              : "max-w-none rounded-tl-md bg-transparent px-0 py-0 text-foreground"
          )}
        >
          {isUser ? (
            <p className="whitespace-pre-wrap">{message.content}</p>
          ) : cleanContent ? (
            <div className="ksemo-markdown prose prose-neutral max-w-none text-[15px] leading-6 dark:prose-invert">
              <Streamdown
                components={KSEMO_MARKDOWN_COMPONENTS}
              >
                {citationContent}
              </Streamdown>
            </div>
          ) : message.status === "streaming" &&
            isCurrentGeneration &&
            !hideTypingIndicator ? (
            <div
              className="flex h-7 items-center gap-1.5"
              aria-label="KSEMO is responding"
            >
              <span className="size-1.5 animate-pulse rounded-full bg-muted-foreground" />
              <span className="size-1.5 animate-pulse rounded-full bg-muted-foreground [animation-delay:150ms]" />
              <span className="size-1.5 animate-pulse rounded-full bg-muted-foreground [animation-delay:300ms]" />
            </div>
          ) : null}
        </div>

        {/* Sources control for web search and deep research */}
        {!isUser && activeSources.length > 0 && (
          <SourcesControl
            sources={activeSources}
            activeSourceId={hoveredSourceId}
            className="mt-3"
          />
        )}
        
        {/* File generation result card */}
        {!isUser && message.fileGeneration && message.fileGeneration.status === "created" && message.attachments?.length === 1 && (
          <div className="mt-3">
            <FileResultCard
              file={{
                filename: message.attachments[0].filename,
                mimeType: message.attachments[0].mimeType || "application/octet-stream",
                size: message.attachments[0].sizeBytes || 0,
                downloadUrl: message.attachments[0].url,
                status: "completed",
              }}
              onDownload={() => {
                const link = document.createElement('a');
                link.href = message.attachments![0].url;
                link.download = message.attachments![0].filename;
                link.click();
              }}
            />
          </div>
        )}
        
        {/* File generation error state */}
        {!isUser && message.fileGeneration && message.fileGeneration.status === "error" && (
          <div className="mt-3 p-3 rounded-lg border border-red-200 bg-red-50 dark:border-red-900/30 dark:bg-red-950/20">
            <p className="text-sm text-red-800 dark:text-red-200">
              {message.fileGeneration.errorMessage || "Failed to generate file. Please try again."}
            </p>
          </div>
        )}
        
        {!isUser && message.attachments?.length ? (
          <div className="mt-2 flex max-w-full flex-col items-start gap-2">
            {message.attachments.map(file => {
              const kind = getFileKind(file.filename, file.mimeType);
              const size = formatBytes(file.sizeBytes);
              const isImage = file.mimeType?.startsWith("image/");
              if (isImage) {
                return (
                  <div
                    key={file.id}
                    className="group/card w-fit max-w-[15rem] overflow-hidden rounded-xl border border-border bg-muted/50 shadow-sm"
                  >
                    <button
                      type="button"
                      onClick={() => setPreviewFile(file)}
                      className="block w-full"
                      aria-label={`View ${file.filename}`}
                    >
                      <img
                        src={file.url}
                        alt={file.filename}
                        className="aspect-video w-full object-cover"
                      />
                    </button>
                    <div className="flex items-center justify-end border-t border-border bg-background/40 px-1 py-0.5">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <a
                            href={file.url}
                            download
                            aria-label={`Download ${file.filename}`}
                            className="flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                          >
                            <Download className="size-3.5" />
                          </a>
                        </TooltipTrigger>
                        <TooltipContent side="bottom">Download image</TooltipContent>
                      </Tooltip>
                    </div>
                  </div>
                );
              }
              return (
                <div
                  key={file.id}
                  className="group/card flex h-14 w-72 max-w-full items-center gap-1 rounded-xl border border-border bg-muted/50 p-2 pr-1 shadow-sm transition-colors hover:border-primary/30 hover:bg-accent"
                >
                  <button
                    type="button"
                    onClick={() => setPreviewFile(file)}
                    className="flex min-w-0 flex-1 items-center gap-2.5 overflow-hidden rounded-lg text-left"
                    aria-label={`Preview ${file.filename}`}
                  >
                    <span
                      className={`flex size-9 shrink-0 items-center justify-center rounded-lg ${kind.colorClass}`}
                    >
                      <kind.icon className="size-4" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-xs font-medium leading-snug text-foreground">
                        {file.filename}
                      </span>
                      <span className="mt-0.5 flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                        <span>{kind.label}</span>
                        {size ? (
                          <span className="opacity-80">· {size}</span>
                        ) : null}
                      </span>
                    </span>
                  </button>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <a
                        href={file.url}
                        download
                        aria-label={`Download ${file.filename}`}
                        className="flex size-9 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                      >
                        <Download className="size-4" />
                      </a>
                    </TooltipTrigger>
                    <TooltipContent side="bottom">
                      Download {kind.label}
                    </TooltipContent>
                  </Tooltip>
                </div>
              );
            })}
          </div>
        ) : null}
        {isUser && message.content && (
          <div className="mt-1.5 flex items-center gap-1 max-lg:opacity-100 opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-focus-within:opacity-100">
            {action(
              "Copy message",
              copied ? (
                <Check className="size-3.5" />
              ) : (
                <Copy className="size-3.5" />
              ),
              copyMessage
            )}
            {onShare &&
              action("Share message", <ShareIcon className="size-3.5" />, () =>
                onShare(message)
              )}
            {onEdit &&
              action("Edit message", <Pencil className="size-3.5" />, () =>
                onEdit(message)
              )}
            {onViewHistory &&
              action(
                "View version history",
                <History className="size-3.5" />,
                () => onViewHistory(message)
              )}
          </div>
        )}
        {!isUser && (message.content || message.status === "failed") && (
          <div className="mt-1.5 flex items-center gap-1">
            {message.content &&
              action(
                copied ? "Copied" : "Copy response",
                copied ? (
                  <Check className="size-3.5" />
                ) : (
                  <Copy className="size-3.5" />
                ),
                copyMessage
              )}
            {message.content &&
              onShare &&
              action("Share response", <ShareIcon className="size-3.5" />, () =>
                onShare(message)
              )}
            {message.status !== "failed" &&
              onRegenerate &&
              action(
                "Regenerate response",
                <RotateCcw className="size-3.5" />,
                () => onRegenerate(message)
              )}
            {onFeedback && (
              <>
                {action(
                  "Helpful response",
                  <ThumbsUp className="size-3.5" />,
                  () => onFeedback(message.id, "up")
                )}
                {action(
                  "Unhelpful response",
                  <ThumbsDown className="size-3.5" />,
                  () => onFeedback(message.id, "down")
                )}
              </>
            )}
            <MessageOverflow
              message={message}
              onReadAloud={
                message.content
                  ? () => onSpeak(message.content, message.id)
                  : undefined
              }
              onStopReading={isSpeaking ? onStop : undefined}
              onDelete={onDelete}
            />
          </div>
        )}
      </div>
    </article>

      {lightboxIndex !== null && images.length > 0 && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90"
          onClick={() => setLightboxIndex(null)}
        >
          <button
            type="button"
            onClick={() => setLightboxIndex(null)}
            aria-label="Close"
            className="absolute top-4 right-4 z-10 rounded-full bg-white/10 p-2 text-white transition-colors hover:bg-white/25"
          >
            <X className="size-5" />
          </button>

          {images.length > 1 && (
            <>
              <button
                type="button"
                onClick={e => {
                  e.stopPropagation();
                  setLightboxIndex(
                    (lightboxIndex - 1 + images.length) % images.length
                  );
                }}
                aria-label="Previous image"
                className="absolute top-1/2 left-3 z-10 -translate-y-1/2 rounded-full bg-white/10 p-2.5 text-white transition-colors hover:bg-white/25"
              >
                <ChevronLeft className="size-5" />
              </button>
              <button
                type="button"
                onClick={e => {
                  e.stopPropagation();
                  setLightboxIndex((lightboxIndex + 1) % images.length);
                }}
                aria-label="Next image"
                className="absolute top-1/2 right-3 z-10 -translate-y-1/2 rounded-full bg-white/10 p-2.5 text-white transition-colors hover:bg-white/25"
              >
                <ChevronRight className="size-5" />
              </button>
            </>
          )}

          <img
            src={images[lightboxIndex].url}
            alt={images[lightboxIndex].filename}
            onClick={e => e.stopPropagation()}
            className="max-h-[85vh] max-w-[90vw] rounded-lg object-contain shadow-2xl"
          />

          <span className="absolute bottom-4 left-1/2 -translate-x-1/2 text-sm font-medium text-white/90">
            {lightboxIndex + 1} / {images.length}
          </span>
        </div>
      )}

      {previewFile && previewKind && (
        <div
          className="fixed inset-0 z-[110] flex items-center justify-center bg-black/80 p-4"
          onClick={() => setPreviewFile(null)}
        >
          <div
            className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-border bg-background shadow-2xl"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
              <div className="flex min-w-0 items-center gap-2.5">
                <span
                  className={`flex size-8 shrink-0 items-center justify-center rounded-lg ${previewKind.colorClass}`}
                >
                  <previewKind.icon className="size-4" />
                </span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-foreground">
                    {previewFile.filename}
                  </p>
                  <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                    {previewKind.label}
                    {previewFile.sizeBytes !== undefined
                      ? ` · ${formatBytes(previewFile.sizeBytes) ?? ""}`
                      : ""}
                  </p>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <Button variant="ghost" size="icon" aria-label="Open file" asChild>
                  <a href={previewFile.url} target="_blank" rel="noreferrer">
                    <ExternalLink className="size-4" />
                  </a>
                </Button>
                <Button variant="ghost" size="icon" aria-label="Download file" asChild>
                  <a href={previewFile.url} target="_blank" rel="noreferrer" download>
                    <Download className="size-4" />
                  </a>
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setPreviewFile(null)}
                  aria-label="Close preview"
                >
                  <X className="size-4" />
                </Button>
              </div>
            </div>
            <div className="min-h-0 flex-1 overflow-hidden bg-muted/30">
              {previewFile.mimeType?.startsWith("image/") ? (
                <img
                  src={previewFile.url}
                  alt={previewFile.filename}
                  className="mx-auto h-full max-h-[70vh] w-auto object-contain"
                />
              ) : previewFile.mimeType === "application/pdf" ||
                /\.pdf$/i.test(previewFile.filename) ? (
                <iframe
                  src={previewFile.url}
                  title={previewFile.filename}
                  className="h-[70vh] w-full"
                />
              ) : (
                <div className="flex h-[50vh] flex-col items-center justify-center gap-3 p-6 text-center">
                  <span
                    className={`flex size-12 items-center justify-center rounded-xl ${previewKind.colorClass}`}
                  >
                    <previewKind.icon className="size-6" />
                  </span>
                  <p className="text-sm text-muted-foreground">
                    This file type can't be previewed inline.
                  </p>
                  <Button asChild size="sm">
                    <a
                      href={previewFile.url}
                      target="_blank"
                      rel="noreferrer"
                      download
                    >
                      <Download className="size-4" />
                      Download file
                    </a>
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
      </>
  );
});
function MessageOverflow({
  message,
  onReadAloud,
  onStopReading,
  onDelete,
}: {
  message: KsemoMessage;
  onReadAloud?: () => void;
  onStopReading?: () => void;
  onDelete?: (message: KsemoMessage) => void;
}) {
  if (!onReadAloud && !onStopReading && !onDelete) return null;
  return (
    <DropdownMenu>
      <Tooltip>
        <TooltipTrigger asChild>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="size-8 rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground"
              aria-label="More message actions"
              data-has-delete={onDelete ? "true" : "false"}
            >
              <Ellipsis className="size-3.5" />
            </Button>
          </DropdownMenuTrigger>
        </TooltipTrigger>
        <TooltipContent side="bottom">More actions</TooltipContent>
      </Tooltip>
      <DropdownMenuContent
        side="top"
        sideOffset={8}
        align="end"
        className="w-44 rounded-xl"
      >
        {onStopReading ? (
          <DropdownMenuItem onClick={onStopReading}>
            <Square className="mr-2 size-3.5 fill-current" />
            Stop reading
          </DropdownMenuItem>
        ) : (
          onReadAloud && (
            <DropdownMenuItem onClick={onReadAloud}>
              <Volume2 className="mr-2 size-3.5" />
              Read aloud
            </DropdownMenuItem>
          )
        )}
        {(onReadAloud || onStopReading) && onDelete && (
          <DropdownMenuSeparator />
        )}
        {onDelete && (
          <DropdownMenuItem
            onClick={() => onDelete(message)}
            variant="destructive"
          >
            <Trash2 className="mr-2 size-3.5" />
            Delete message
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export type { KsemoMessage };
