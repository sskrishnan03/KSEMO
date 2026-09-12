import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
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
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Copy,
  Download,
  Ellipsis,
  ExternalLink,
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
import React, { memo, useEffect, useRef, useState } from "react";
import { Streamdown } from "streamdown";
import { KsemoMarkdownCode } from "./code-block";
import { sanitizeAssistantText } from "@/lib/sanitizeAssistant";
import { usePdfViewer, isViewableDocument } from "@/contexts/PdfViewerContext";

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
    message?: string;
    researchSourceCount?: number;
    sources?: Array<{ title: string; url: string; publisher?: string }>;
    metrics?: {
      pages?: number;
      sheets?: number;
      slides?: number;
      words?: number;
    };
  };
};

function KsemoMarkdownLink({
  href,
  children,
  ...props
}: React.AnchorHTMLAttributes<HTMLAnchorElement>) {
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

// Stable Streamdown component map so the internal `marked.Lexer` cache is not
// invalidated on every render (a fresh `components` object defeats Streamdown's
// memo and forces a full re-parse of the message on each streaming flush).
const KSEMO_MARKDOWN_COMPONENTS = {
  code: KsemoMarkdownCode,
  a: KsemoMarkdownLink,
};

type KsemoFile = NonNullable<KsemoMessage["attachments"]>[number];

function formatBytes(bytes?: number): string | null {
  if (typeof bytes !== "number" || Number.isNaN(bytes) || bytes < 0)
    return null;
  const units = ["B", "KB", "MB", "GB"];
  let value = bytes;
  let unit = 0;
  const digits = unit === 0 || value >= 100 ? 0 : value >= 10 ? 1 : 2;
  return `${value.toFixed(digits)} ${units[unit]}`;
}

export function splitFirstSentence(content: string): { first: string; rest: string } {
  const text = content.trim();
  if (!text) return { first: "", rest: "" };

  // 1. Double newline indicates separate paragraphs - standard markdown separation
  const doubleNewline = text.indexOf("\n\n");
  if (doubleNewline !== -1) {
    return {
      first: text.slice(0, doubleNewline).trim(),
      rest: text.slice(doubleNewline + 2).trim(),
    };
  }

  // 2. Single newline
  const singleNewline = text.indexOf("\n");
  if (singleNewline !== -1) {
    return {
      first: text.slice(0, singleNewline).trim(),
      rest: text.slice(singleNewline + 1).trim(),
    };
  }

  // 3. Sentence boundary within a single line (ending with . ! ? followed by whitespace and a capital/number/markdown header)
  const sentenceMatch = text.match(/^([^.!?]+[.!?])\s+([A-Z0-9#*-].*)$/s);
  if (sentenceMatch) {
    return {
      first: sentenceMatch[1].trim(),
      rest: sentenceMatch[2].trim(),
    };
  }

  return {
    first: text,
    rest: "",
  };
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
  isFileGenerating = false,
  hideTypingIndicator = false,
  onEdit,
  onRegenerate,
  onRetry,
  onFeedback,
  onShare,
  onDelete,
  isEditing = false,
  editValue = "",
  onEditValueChange,
  onSaveEdit,
  onCancelEdit,
  fileCreationNode,
}: {
  message: KsemoMessage;
  fileCreationNode?: React.ReactNode;
  onSpeak: (text: string, messageId: string) => void;
  onPause: () => void;
  onResume: () => void;
  onStop: () => void;
  isSpeaking: boolean;
  speechState: "idle" | "playing" | "paused";
  isCurrentGeneration?: boolean;
  isFileGenerating?: boolean;
  hideTypingIndicator?: boolean;
  onEdit?: (message: KsemoMessage) => void;
  onRegenerate?: (message: KsemoMessage) => void;
  onRetry?: (message: KsemoMessage) => void;
  onFeedback?: (messageId: string, value: "up" | "down") => void;
  onShare?: (message: KsemoMessage) => void;
  onDelete?: (message: KsemoMessage) => void;
  isEditing?: boolean;
  editValue?: string;
  onEditValueChange?: (value: string) => void;
  onSaveEdit?: () => void;
  onCancelEdit?: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [previewFile, setPreviewFile] = useState<KsemoFile | null>(null);
  const { openPdf } = usePdfViewer();
  const [userExpanded, setUserExpanded] = useState(false);
  const [userLong, setUserLong] = useState(false);
  const userTextRef = useRef<HTMLParagraphElement | null>(null);
  const isUser = message.role === "user";
  const images = (message.attachments ?? []).filter(f =>
    f.mimeType?.startsWith("image/")
  );

  // Sanitize assistant content
  const rawClean = sanitizeAssistantText(message.content);
  // Interrupted/cancelled responses must not display default fallback errors
  const cleanContent =
    message.status === "cancelled" &&
    /^I[’']m sorry, I couldn[’']t generate a response\.?$/i.test(rawClean.trim())
      ? ""
      : rawClean;

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
    if (!isUser || !userTextRef.current) return;
    const el = userTextRef.current;
    const overflows = el.scrollHeight > el.clientHeight + 1;
    setUserLong(overflows);
  }, [isUser, message.content]);

  async function copyMessage() {
    await navigator.clipboard.writeText(cleanContent);
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

  const isCancelled = !isUser && message.status === "cancelled";
  const isGeneratingFile = Boolean(
    isFileGenerating ||
    (message.fileGeneration && message.fileGeneration.status === "processing")
  );

  const renderStoppedNotice = () => (
    <div
      data-testid="stopped-response-notice"
      className={cn(
        "flex items-center gap-3 py-2.5 select-none",
        cleanContent ? "mt-3 mb-1.5" : "my-1.5"
      )}
    >
      <div className="h-px flex-1 bg-border/70" />
      <span className="shrink-0 text-sm font-medium text-muted-foreground/90">
        Response generation was interrupted
      </span>
      <div className="h-px flex-1 bg-border/70" />
    </div>
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
              ? "flex flex-col items-end w-fit max-w-[84%] sm:max-w-[68%]"
              : "w-full"
          )}
        >
          {isUser && message.attachments?.length
            ? (() => {
                const documents = message.attachments.filter(
                  f => !f.mimeType?.startsWith("image/")
                );
                const extra = images.length - 4;
                return (
                  <div className="mb-2 flex max-w-full flex-wrap items-end gap-2.5">
                    {images.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {images.slice(0, 4).map((file, i) => {
                          const isLastShown = i === 3;
                          const isSingle = images.length === 1;
                          return (
                            <button
                              key={file.id}
                              type="button"
                              onClick={() => setLightboxIndex(i)}
                              className={cn(
                                "group relative shrink-0 overflow-hidden rounded-xl border border-border/80 bg-muted/50 shadow-sm transition-all hover:border-border hover:shadow-md",
                                isSingle ? "size-28 sm:size-32" : "size-24 sm:size-28"
                              )}
                              aria-label={`View ${file.filename}`}
                            >
                              <img
                                src={file.url}
                                alt={file.filename}
                                className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-105"
                              />
                              {isLastShown && extra > 0 && (
                                <span className="absolute inset-0 flex items-center justify-center bg-black/55 text-lg font-semibold text-white">
                                  +{extra}
                                </span>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    )}
                    {documents.length > 0 && (
                      <div className="flex max-w-full flex-wrap justify-end gap-2.5">
                        {documents.map(file => {
                          const kind = getFileKind(
                            file.filename,
                            file.mimeType
                          );
                          const size = formatBytes(file.sizeBytes);
                          return (
                            <a
                              key={file.id}
                              href={file.url}
                              target="_blank"
                              rel="noreferrer"
                              className="group/file flex h-16 min-w-56 max-w-xs items-center gap-3 rounded-2xl border border-border/80 bg-muted/70 py-2.5 pl-2.5 pr-4 text-left shadow-sm transition-all hover:border-border hover:bg-accent/80 hover:shadow-md"
                            >
                              <kind.icon className="size-10 shrink-0" />
                              <span className="min-w-0 flex-1">
                                <span className="block truncate text-[13px] font-semibold text-foreground group-hover/file:text-primary transition-colors">
                                  {file.filename}
                                </span>
                                <span className="mt-0.5 flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                                  <span>{kind.label}</span>
                                  {size ? (
                                    <span className="opacity-80">· {size}</span>
                                  ) : null}
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
            : null}
          {(!isUser || message.content.trim().length > 0) && (
            <div
              className={cn(
                "text-[15px] leading-6",
                isUser
                  ? cn(
                      "flex flex-col items-end rounded-2xl rounded-tr-md border border-border bg-muted px-3.5 py-2.5 text-[15px] leading-6 text-foreground shadow-sm",
                      isEditing && "ring-1 ring-primary/40 border-primary/40"
                    )
                  : "max-w-none rounded-tl-md bg-transparent px-0 py-0 text-foreground"
              )}
            >
            {isUser ? (
              !userExpanded ? (
                <div
                  role={userLong ? "button" : undefined}
                  tabIndex={userLong ? 0 : undefined}
                  aria-expanded={userLong ? false : undefined}
                  onClick={userLong ? () => setUserExpanded(true) : undefined}
                  onKeyDown={
                    userLong
                      ? e => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            setUserExpanded(true);
                          }
                        }
                      : undefined
                  }
                  className="relative w-full cursor-pointer text-left"
                >
                  <p
                    ref={userTextRef}
                    className="w-full whitespace-pre-wrap text-left line-clamp-8"
                  >
                    {message.content}
                  </p>
                  {userLong && (
                    <>
                      <div
                        className="pointer-events-none absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-muted to-transparent"
                        aria-hidden="true"
                      />
                      <span className="absolute -bottom-2.5 -right-3.5 flex items-center gap-1 rounded-full bg-sidebar px-3 py-1 text-[15px] text-foreground/70 transition-colors hover:bg-accent hover:text-foreground">
                        Show more
                        <ChevronDown className="size-3.5" />
                      </span>
                    </>
                  )}
                </div>
              ) : (
                <div className="relative w-full pb-9">
                  <p
                    ref={userTextRef}
                    className="w-full whitespace-pre-wrap text-left"
                  >
                    {message.content}
                  </p>
                  {userLong && (
                    <button
                      type="button"
                      onClick={() => setUserExpanded(false)}
                      className="absolute -bottom-2.5 -right-3.5 flex items-center gap-1 rounded-full bg-sidebar px-3 py-1 text-[15px] text-foreground/70 transition-colors hover:bg-accent hover:text-foreground"
                    >
                      Show less
                      <ChevronDown className="size-3.5 rotate-180 transition-transform" />
                    </button>
                  )}
                </div>
              )
            ) : cleanContent ? (
              <>
                {fileCreationNode ? (
                  <>
                    {(() => {
                      const { first, rest } = splitFirstSentence(cleanContent);
                      return (
                        <>
                          {first ? (
                            <div className="ksemo-markdown prose prose-neutral max-w-none text-[15px] leading-6 dark:prose-invert">
                              <Streamdown components={KSEMO_MARKDOWN_COMPONENTS}>
                                {first}
                              </Streamdown>
                            </div>
                          ) : null}

                          <div className="my-2">
                            {fileCreationNode}
                          </div>

                          {rest ? (
                            <div className="ksemo-markdown prose prose-neutral max-w-none text-[15px] leading-6 dark:prose-invert mt-2">
                              <Streamdown components={KSEMO_MARKDOWN_COMPONENTS}>
                                {rest}
                              </Streamdown>
                            </div>
                          ) : null}
                        </>
                      );
                    })()}
                  </>
                ) : (
                  <div className="ksemo-markdown prose prose-neutral max-w-none text-[15px] leading-6 dark:prose-invert">
                    <Streamdown components={KSEMO_MARKDOWN_COMPONENTS}>
                      {cleanContent}
                    </Streamdown>
                  </div>
                )}
                {isCancelled && renderStoppedNotice()}
              </>
            ) : fileCreationNode ? (
              <>
                <div className="my-2">
                  {fileCreationNode}
                </div>
                {isCancelled && renderStoppedNotice()}
              </>
            ) : isCancelled ? (
              renderStoppedNotice()
            ) : message.status === "streaming" &&
              isCurrentGeneration &&
              !hideTypingIndicator &&
              !message.fileGeneration &&
              !fileCreationNode &&
              !(message.attachments?.length && !isUser) ? (
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
          )}

          {/* Attachments (e.g. images, uploaded files; generated document is presented via primary FileCreationCard) */}
          {!isUser && message.attachments?.length && !message.fileGeneration && !fileCreationNode ? (
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
                          <TooltipContent side="bottom">
                            Download image
                          </TooltipContent>
                        </Tooltip>
                      </div>
                    </div>
                  );
                }
                return (
                  <div
                    key={file.id}
                    className="group/card flex h-16 w-80 max-w-full items-center gap-2 rounded-2xl border border-border/80 bg-muted/60 p-2.5 pr-2 shadow-sm transition-colors hover:bg-accent"
                  >
                    <button
                      type="button"
                      onClick={() => {
                        if (isViewableDocument(file.filename, file.mimeType)) {
                          openPdf({
                            url: file.url,
                            filename: file.filename,
                            sizeBytes: file.sizeBytes,
                          });
                        } else {
                          setPreviewFile(file);
                        }
                      }}
                      className="flex min-w-0 flex-1 items-center gap-3 overflow-hidden rounded-lg text-left"
                      aria-label={`Preview ${file.filename}`}
                    >
                      <kind.icon className="size-10 shrink-0" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[13px] font-semibold leading-snug text-foreground">
                          {file.filename}
                        </span>
                        <span className="mt-0.5 flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
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
                  <Check className="size-4" />
                ) : (
                  <Copy className="size-4" />
                ),
                copyMessage
              )}
              {onEdit && !isEditing &&
                action("Edit message", <Pencil className="size-4" />, () =>
                  onEdit(message)
                )}
            </div>
          )}
          {!isUser && !isGeneratingFile && (message.content || message.status === "failed" || message.status === "cancelled" || Boolean(fileCreationNode)) && (
            <div className="mt-1.5 flex items-center gap-1">
              {message.content &&
                action(
                  copied ? "Copied" : "Copy response",
                  copied ? (
                    <Check className="size-4" />
                  ) : (
                    <Copy className="size-4" />
                  ),
                  copyMessage
                )}
              {message.content &&
                onShare &&
                action("Share response", <ShareIcon className="size-4" />, () =>
                  onShare(message)
                )}
              {(onRegenerate || onRetry) &&
                action(
                  message.status === "failed" ? "Retry response" : "Regenerate response",
                  <RotateCcw className="size-4" />,
                  () => (onRegenerate ? onRegenerate(message) : onRetry?.(message))
                )}
              {onFeedback && message.content && (
                <>
                  {action(
                    "Good response",
                    <ThumbsUp className="size-4" />,
                    () => onFeedback(message.id, "up")
                  )}
                  {action(
                    "Bad response",
                    <ThumbsDown className="size-4" />,
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

      {previewFile && (
        <div
          className="fixed inset-0 z-[110] flex items-center justify-center bg-black/80 p-4"
          onClick={() => setPreviewFile(null)}
        >
          <div
            className="flex h-[calc(100vh-2rem)] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-border bg-background shadow-2xl"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
              <p className="truncate text-sm font-medium text-foreground">
                {previewFile.filename}
              </p>
              <div className="flex shrink-0 items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Open file"
                  asChild
                >
                  <a href={previewFile.url} target="_blank" rel="noreferrer">
                    <ExternalLink className="size-4" />
                  </a>
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Download file"
                  asChild
                >
                  <a
                    href={previewFile.url}
                    target="_blank"
                    rel="noreferrer"
                    download
                  >
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
            <div className="min-h-0 flex-1 overflow-auto bg-muted/30">
              {previewFile.mimeType?.startsWith("image/") ? (
                <div className="flex h-full w-full items-center justify-center p-4">
                  <img
                    src={previewFile.url}
                    alt={previewFile.filename}
                    className="max-h-full max-w-full object-contain"
                  />
                </div>
              ) : previewFile.mimeType === "application/pdf" ||
                /\.pdf$/i.test(previewFile.filename) ? (
                <iframe
                  src={previewFile.url}
                  title={previewFile.filename}
                  className="h-full w-full"
                />
              ) : (
                <div className="flex min-h-full w-full flex-col items-center justify-center gap-3 p-6 text-center">
                  <p className="text-sm text-muted-foreground">
                    Can't preview this file type inline.
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
              className="size-7 rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
              aria-label="More message actions"
              data-has-delete={onDelete ? "true" : "false"}
            >
              <Ellipsis className="size-4" />
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
            <Square className="mr-2 size-4 fill-current" />
            Stop reading
          </DropdownMenuItem>
        ) : (
          onReadAloud && (
            <DropdownMenuItem onClick={onReadAloud}>
              <Volume2 className="mr-2 size-4" />
              Read aloud
            </DropdownMenuItem>
          )
        )}
        {onDelete && (
          <DropdownMenuItem
            onClick={() => onDelete(message)}
            variant="destructive"
          >
            <Trash2 className="mr-2 size-4" />
            Delete message
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export type { KsemoMessage };
