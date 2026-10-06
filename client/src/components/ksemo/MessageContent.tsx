import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { getFileKind } from "@/lib/fileKinds";
import { CardWheelFan } from "@/components/ui/card-wheel-fan";
import { ImageLightbox } from "@/components/ui/image-lightbox";
import { isImageFile } from "@/lib/fileKinds";
import { ThinkingIndicator } from "@/components/ui/thinking-indicator";
import {
  Check,
  ChevronDown,
  ChevronRight,
  Copy,
  Download,
  ExternalLink,
  Pencil,
  RotateCcw,
  Square,
  ThumbsDown,
  ThumbsUp,
  Volume2,
  X,
} from "lucide-react";
import { type MessageFeedbackValue } from "./MessageFeedback";
import { EMOJI_GROUPS } from "@/data/emojiGroups";
import { usePersistFn } from "@/hooks/usePersistFn";
import React, { memo, useEffect, useRef, useState } from "react";
import { Streamdown } from "streamdown";
import { KsemoMarkdownCode } from "./code-block";
import { sanitizeAssistantText } from "@/lib/sanitizeAssistant";
import { usePdfViewer, isViewableDocument } from "@/contexts/PdfViewerContext";
import type { PptOutlinePlan } from "@shared/presentationOutline";
import {
  BotActionStatus,
  type BotActionData,
} from "@/components/voice/BotActionStatus";
import { useSpeechWaveBars } from "@/lib/speechReactive";

type KsemoMessage = {
  id: string;
  clientId?: string;
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
  botAction?: BotActionData;
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
    summary?: string;
    outline?: PptOutlinePlan;
    code?: string;
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

// List-with-arrow glyph for the message actions menu. The arrow is its own
// path so only it flips up when the menu opens — the list lines never move.
const LIST_ARROW_LINES_D =
  "M2.25 5C2.25 4.58579 2.58579 4.25 3 4.25H21C21.4142 4.25 21.75 4.58579 21.75 5C21.75 5.41421 21.4142 5.75 21 5.75H3C2.58579 5.75 2.25 5.41421 2.25 5ZM2.25 9C2.25 8.58579 2.58579 8.25 3 8.25H21C21.4142 8.25 21.75 8.58579 21.75 9C21.75 9.41421 21.4142 9.75 21 9.75H3C2.58579 9.75 2.25 9.41421 2.25 9ZM2.25 13C2.25 12.5858 2.58579 12.25 3 12.25H11C11.4142 12.25 11.75 12.5858 11.75 13C11.75 13.4142 11.4142 13.75 11 13.75H3C2.58579 13.75 2.25 13.4142 2.25 13ZM2.25 17C2.25 16.5858 2.58579 16.25 3 16.25H11C11.4142 16.25 11.75 16.5858 11.75 17C11.75 17.4142 11.4142 17.75 11 17.75H3C2.58579 17.75 2.25 17.4142 2.25 17Z";
const LIST_ARROW_ARROW_D =
  "M17.5 12.25C17.9142 12.25 18.25 12.5858 18.25 13V17.1893L19.4697 15.9697C19.7626 15.6768 20.2374 15.6768 20.5303 15.9697C20.8232 16.2626 20.8232 16.7374 20.5303 17.0303L18.0303 19.5303C17.7374 19.8232 17.2626 19.8232 16.9697 19.5303L14.4697 17.0303C14.1768 16.7374 14.1768 16.2626 14.4697 15.9697C14.7626 15.6768 15.2374 15.6768 15.5303 15.9697L16.75 17.1893V13C16.75 12.5858 17.0858 12.25 17.5 12.25Z";

// Compact reaction strip pinned to the top of the More menu: :) :D :| :( :O ;)
const MESSAGE_REACTIONS = [
  { emoji: "🙂", label: "React with slightly smiling face" },
  { emoji: "😀", label: "React with grinning face" },
  { emoji: "😐", label: "React with neutral face" },
  { emoji: "🙁", label: "React with slightly frowning face" },
  { emoji: "😮", label: "React with surprised face" },
  { emoji: "😉", label: "React with winking face" },
] as const;

const VISIBLE_EMOJI_GROUPS = EMOJI_GROUPS.filter(
  group => group.name !== "Flags" && group.name !== "Symbols"
);

function ActionsMenuGlyph({ open }: { open: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={24}
      height={24}
      fill="none"
      aria-hidden="true"
      data-testid="actions-menu-glyph"
      className="size-6 shrink-0"
    >
      <path
        fill="currentColor"
        fillRule="evenodd"
        clipRule="evenodd"
        d={LIST_ARROW_LINES_D}
      />
      <path
        fill="currentColor"
        d={LIST_ARROW_ARROW_D}
        className="transition-transform duration-300 ease-out"
        style={{
          transformBox: "fill-box",
          transformOrigin: "center",
          transform: open ? "rotate(180deg)" : "rotate(0deg)",
        }}
      />
    </svg>
  );
}

export function splitFirstSentence(content: string): {
  first: string;
  rest: string;
} {
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

function RealtimeSpeechEqualizer({
  isSpeaking,
  speechState,
  messageId,
}: {
  isSpeaking: boolean;
  speechState?: "idle" | "buffering" | "playing" | "paused";
  messageId: string;
}) {
  const { heights, isBuffering } = useSpeechWaveBars(
    isSpeaking,
    speechState ?? "playing",
    messageId
  );

  return (
    <span
      className={cn(
        "group-hover/readaloud:hidden flex size-4 items-center justify-center gap-[2px] text-current",
        isBuffering && "opacity-60 animate-pulse"
      )}
    >
      <span
        className="ksemo-eq-bar-1 w-[2px] rounded-full bg-current transition-all duration-75 ease-out"
        style={{ height: `${heights[0]}px` }}
      />
      <span
        className="ksemo-eq-bar-2 w-[2px] rounded-full bg-current transition-all duration-75 ease-out"
        style={{ height: `${heights[1]}px` }}
      />
      <span
        className="ksemo-eq-bar-3 w-[2px] rounded-full bg-current transition-all duration-75 ease-out"
        style={{ height: `${heights[2]}px` }}
      />
      <span
        className="ksemo-eq-bar-4 w-[2px] rounded-full bg-current transition-all duration-75 ease-out"
        style={{ height: `${heights[3]}px` }}
      />
    </span>
  );
}

export const MessageContent = memo(function MessageContent({
  message,
  onSpeak,
  onPause,
  onResume,
  onStop,
  isSpeaking,
  speechState,
  isPreparingSpeech = false,
  isCurrentGeneration = false,
  isFileGenerating = false,
  hideTypingIndicator = false,
  onEdit,
  onRegenerate,
  onRetry,
  onFeedback,
  feedback = null,
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
  speechState?: "idle" | "buffering" | "playing" | "paused";
  isPreparingSpeech?: boolean;
  isCurrentGeneration?: boolean;
  isFileGenerating?: boolean;
  hideTypingIndicator?: boolean;
  onEdit?: (message: KsemoMessage) => void;
  onRegenerate?: (message: KsemoMessage) => void;
  onRetry?: (message: KsemoMessage) => void;
  onFeedback?: (messageId: string, value: "up" | "down") => void;
  feedback?: MessageFeedbackValue | null;
  onShare?: (message: KsemoMessage) => void;
  onDelete?: (message: KsemoMessage) => void;
  isEditing?: boolean;
  editValue?: string;
  onEditValueChange?: (value: string) => void;
  onSaveEdit?: () => void;
  onCancelEdit?: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const [actionsOpen, setActionsOpen] = useState(false);
  const [reaction, setReaction] = useState<string | null>(null);
  const [allEmojisOpen, setAllEmojisOpen] = useState(false);
  const [visibleGroupCount, setVisibleGroupCount] = useState(1);
  const [previewFile, setPreviewFile] = useState<KsemoFile | null>(null);
  const [lightboxFile, setLightboxFile] = useState<KsemoFile | null>(null);
  const { openPdf } = usePdfViewer();
  const [userExpanded, setUserExpanded] = useState(false);
  const [userLong, setUserLong] = useState(false);
  const userTextRef = useRef<HTMLParagraphElement | null>(null);
  const isUser = message.role === "user";
  const images = (message.attachments ?? []).filter(f =>
    isImageFile(f.filename, f.mimeType)
  );

  // Sanitize assistant content
  const rawClean = sanitizeAssistantText(message.content);
  // Interrupted/cancelled responses must not display default fallback errors
  const cleanContent =
    message.status === "cancelled" &&
    /^I[’']m sorry, I couldn[’']t generate a response\.?$/i.test(
      rawClean.trim()
    )
      ? ""
      : rawClean;

  useEffect(() => {
    if (!previewFile) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setPreviewFile(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [previewFile]);

  useEffect(() => {
    if (!allEmojisOpen) {
      setVisibleGroupCount(1);
      return;
    }
    let frame = 0;
    let count = 1;
    const tick = () => {
      count += 1;
      setVisibleGroupCount(count);
      if (count < VISIBLE_EMOJI_GROUPS.length) {
        frame = requestAnimationFrame(tick);
      }
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [allEmojisOpen]);

  useEffect(() => {
    if (!actionsOpen || !allEmojisOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        setAllEmojisOpen(false);
      }
    };
    document.addEventListener("keydown", onKeyDown, true);
    return () => document.removeEventListener("keydown", onKeyDown, true);
  }, [actionsOpen, allEmojisOpen]);

  useEffect(() => {
    if (!allEmojisOpen) return;
    const onPointerDown = (event: Event) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      if (
        target.closest('[role="menu"]') ||
        target.closest('[aria-haspopup="menu"]') ||
        target.closest('[data-slot^="dropdown-menu"]')
      ) {
        return;
      }
      setAllEmojisOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [allEmojisOpen]);

  useEffect(() => {
    if (!isUser || !userTextRef.current) return;
    const el = userTextRef.current;
    const overflows = el.scrollHeight > el.clientHeight + 1;
    setUserLong(overflows);
  }, [isUser, message.content]);

  // Stable across renders so the memoized feedback pair is not re-rendered on
  // every streaming flush.
  const handleFeedbackToggle = usePersistFn((value: MessageFeedbackValue) =>
    onFeedback?.(message.id, value)
  );

  async function copyMessage() {
    await navigator.clipboard.writeText(cleanContent);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1_500);
  }

  if (message.role === "system" || message.role === "tool") return null;

  const actionClass =
    "size-8 rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground";
  const action = (
    label: string,
    icon: React.ReactNode,
    click: () => void,
    active?: boolean
  ) => (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className={cn(
            actionClass,
            active &&
              "bg-accent/70 text-foreground hover:bg-accent/70 hover:text-foreground"
          )}
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

  const canReadAloud = Boolean(message.content && onSpeak);
  const canRegenerate = Boolean(onRegenerate || onRetry);
  const canRate = Boolean(onFeedback && message.content);
  const hasOverflowActions = canReadAloud || canRegenerate || canRate;
  const hasActiveIndicator =
    canRate && (feedback === "up" || feedback === "down");
  const actionsMenuLabel = isPreparingSpeech
    ? "Preparing audio"
    : isSpeaking
      ? "Stop reading"
      : hasActiveIndicator
        ? `Remove ${feedback === "up" ? "good" : "bad"} response`
        : "More message actions";

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
                return (
                  <div className="mb-2 flex max-w-full flex-col items-end gap-2">
                    {images.length > 0 && (
                      <CardWheelFan
                        images={images.map(file => ({
                          src: file.url,
                          alt: file.filename,
                          label: file.filename,
                        }))}
                        size="lg"
                      />
                    )}
                    {documents.length > 0 && (
                      <div className="flex max-w-full flex-wrap items-center justify-end gap-1">
                        {documents.map(file => {
                          const kind = getFileKind(
                            file.filename,
                            file.mimeType
                          );
                          const size = formatBytes(file.sizeBytes);
                          const opensInDrawer = isViewableDocument(
                            file.filename,
                            file.mimeType
                          );
                          return (
                            <button
                              key={file.id}
                              type="button"
                              onClick={() => {
                                if (opensInDrawer) {
                                  openPdf({
                                    url: file.url,
                                    filename: file.filename,
                                    sizeBytes: file.sizeBytes,
                                    id: file.id,
                                  });
                                } else {
                                  setPreviewFile(file);
                                }
                              }}
                              className="group/file flex h-10 min-w-36 max-w-[14rem] items-center gap-2 rounded-lg border border-border/70 bg-muted/70 py-1.5 pl-1.5 pr-2.5 text-left transition-all hover:border-border hover:bg-accent/80"
                              aria-label={`Preview ${file.filename}`}
                            >
                              <kind.icon className="size-7 shrink-0" />
                              <span className="min-w-0 flex-1">
                                <span className="block truncate text-[11px] font-semibold leading-tight text-foreground transition-colors group-hover/file:text-primary">
                                  {file.filename}
                                </span>
                                <span className="mt-0.5 flex items-center gap-1 text-[9px] font-medium uppercase tracking-wide text-muted-foreground">
                                  <span>{kind.label}</span>
                                  {size ? (
                                    <span className="opacity-80">· {size}</span>
                                  ) : null}
                                </span>
                              </span>
                            </button>
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
                        <span className="absolute -bottom-2.5 -right-3.5 flex items-center gap-1 rounded-full bg-accent px-3 py-1 text-[13px] font-bold text-foreground/70 transition-colors hover:text-foreground">
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
                        className="absolute -bottom-2.5 -right-3.5 flex items-center gap-1 rounded-full bg-accent px-3 py-1 text-[13px] font-bold text-foreground/70 transition-colors hover:text-foreground"
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
                        const { first, rest } =
                          splitFirstSentence(cleanContent);
                        return (
                          <>
                            {first ? (
                              <div className="ksemo-markdown prose prose-neutral max-w-none text-[15px] leading-6 dark:prose-invert">
                                <Streamdown
                                  components={KSEMO_MARKDOWN_COMPONENTS}
                                >
                                  {first}
                                </Streamdown>
                              </div>
                            ) : null}

                            <div className="my-2">{fileCreationNode}</div>

                            {rest ? (
                              <div className="ksemo-markdown prose prose-neutral max-w-none text-[15px] leading-6 dark:prose-invert mt-2">
                                <Streamdown
                                  components={KSEMO_MARKDOWN_COMPONENTS}
                                >
                                  {rest}
                                </Streamdown>
                              </div>
                            ) : null}
                          </>
                        );
                      })()}
                    </>
                  ) : (
                    <>
                      {message.botAction && (
                        <BotActionStatus action={message.botAction} />
                      )}
                      {cleanContent && (
                        <div className="ksemo-markdown prose prose-neutral max-w-none text-[15px] leading-6 dark:prose-invert">
                          <Streamdown components={KSEMO_MARKDOWN_COMPONENTS}>
                            {cleanContent}
                          </Streamdown>
                        </div>
                      )}
                    </>
                  )}
                  {isCancelled && renderStoppedNotice()}
                </>
              ) : message.botAction ? (
                <>
                  <BotActionStatus action={message.botAction} />
                  {isCancelled && renderStoppedNotice()}
                </>
              ) : fileCreationNode ? (
                <>
                  <div className="my-2">{fileCreationNode}</div>
                  {isCancelled && renderStoppedNotice()}
                </>
              ) : isCancelled ? (
                renderStoppedNotice()
              ) : (
                <>
                  {message.status === "streaming" &&
                    isCurrentGeneration &&
                    !hideTypingIndicator &&
                    !message.botAction &&
                    !message.fileGeneration &&
                    !fileCreationNode &&
                    !(message.attachments?.length && !isUser) && (
                      <div
                        aria-label="KSEMO is responding"
                        className="inline-flex items-center"
                      >
                        <ThinkingIndicator />
                      </div>
                    )}
                </>
              )}
            </div>
          )}

          {/* Attachments (e.g. images, uploaded files; generated document is presented via primary FileCreationCard) */}
          {!isUser &&
          message.attachments?.length &&
          !message.fileGeneration &&
          !fileCreationNode ? (
            <div className="mt-2 flex max-w-full flex-col items-start gap-2">
              {message.attachments.map(file => {
                const kind = getFileKind(file.filename, file.mimeType);
                const size = formatBytes(file.sizeBytes);
                const isImage = isImageFile(file.filename, file.mimeType);
                if (isImage) {
                  return (
                    <div
                      key={file.id}
                      className="group/card w-fit max-w-[15rem] overflow-hidden rounded-xl border border-border bg-muted/50 shadow-sm"
                    >
                      <button
                        type="button"
                        onClick={() => setLightboxFile(file)}
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
                            id: file.id,
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
                  <Check className="size-[17px]" />
                ) : (
                  <Copy className="size-[17px]" />
                ),
                copyMessage
              )}
              {onEdit &&
                !isEditing &&
                action("Edit message", <Pencil className="size-[17px]" />, () =>
                  onEdit(message)
                )}
            </div>
          )}
          {!isUser &&
            !isGeneratingFile &&
            (message.content ||
              message.status === "failed" ||
              message.status === "cancelled" ||
              Boolean(fileCreationNode)) && (
              <div className="mt-1.5 flex items-center gap-1">
                {message.content &&
                  action(
                    copied ? "Copied" : "Copy response",
                    copied ? (
                      <Check className="size-[17px]" />
                    ) : (
                      <Copy className="size-[17px]" />
                    ),
                    copyMessage
                  )}
                {hasActiveIndicator &&
                  action(
                    feedback === "up"
                      ? "Remove good response"
                      : "Remove bad response",
                    feedback === "up" ? (
                      <ThumbsUp
                        className={cn(
                          "size-[17px] text-emerald-600 dark:text-emerald-400",
                          "ksemo-feedback-thumb-active"
                        )}
                      />
                    ) : (
                      <ThumbsDown
                        className={cn(
                          "size-[17px] text-rose-600 dark:text-rose-400",
                          "ksemo-feedback-thumb-active"
                        )}
                      />
                    ),
                    () => handleFeedbackToggle(feedback as "up" | "down")
                  )}
                {hasOverflowActions && (
                  <div className="relative inline-flex shrink-0">
                    <DropdownMenu
                      open={actionsOpen}
                      onOpenChange={open => {
                        setActionsOpen(open);
                        if (!open) setAllEmojisOpen(false);
                      }}
                    >
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <DropdownMenuTrigger asChild>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className={cn(
                                actionClass,
                                actionsOpen &&
                                  "bg-accent/70 text-foreground hover:bg-accent/70 hover:text-foreground"
                              )}
                              aria-label={actionsMenuLabel}
                              aria-live="polite"
                            >
                              {isPreparingSpeech ? (
                                <span className="flex size-6 shrink-0 items-center justify-center">
                                  <span
                                    className="loader text-current"
                                    style={{ width: 16 }}
                                    aria-hidden
                                  />
                                </span>
                              ) : isSpeaking ? (
                                <span className="flex size-6 shrink-0 items-center justify-center">
                                  <RealtimeSpeechEqualizer
                                    isSpeaking={isSpeaking}
                                    speechState={speechState}
                                    messageId={message.id}
                                  />
                                </span>
                              ) : (
                                <ActionsMenuGlyph open={actionsOpen} />
                              )}
                            </Button>
                          </DropdownMenuTrigger>
                        </TooltipTrigger>
                        <TooltipContent side="bottom">More</TooltipContent>
                      </Tooltip>
                      <DropdownMenuContent
                        align="start"
                        side="top"
                        sideOffset={6}
                        onPointerDownOutside={event => {
                          if (allEmojisOpen) {
                            event.preventDefault();
                            setAllEmojisOpen(false);
                          }
                        }}
                        onFocusOutside={event => {
                          if (allEmojisOpen) event.preventDefault();
                        }}
                        className="w-max min-w-44 rounded-xl border-0 bg-transparent p-1 shadow-none"
                      >
                        <div className="mb-0.5 rounded-lg border border-border/70 bg-popover px-1.5 py-1.5 shadow-sm">
                          <div
                            role="group"
                            aria-label="Reactions"
                            className="flex items-center gap-0.5"
                          >
                            {MESSAGE_REACTIONS.slice(0, 5).map(
                              ({ emoji, label }) => (
                                <DropdownMenuItem
                                  key={label}
                                  className="group flex-1 justify-center rounded-md px-0 py-1.5 text-2xl leading-none select-none hover:bg-transparent focus:bg-transparent data-[selected=true]:bg-accent data-[selected=true]:text-foreground"
                                  data-selected={
                                    reaction === emoji ? "true" : undefined
                                  }
                                  aria-label={label}
                                  onSelect={event => {
                                    event.preventDefault();
                                    setReaction(prev =>
                                      prev === emoji ? null : emoji
                                    );
                                  }}
                                >
                                  <span
                                    aria-hidden="true"
                                    className="transition-transform duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)] group-hover:scale-150 group-active:scale-95 motion-reduce:transform-none"
                                  >
                                    {emoji}
                                  </span>
                                </DropdownMenuItem>
                              )
                            )}
                            <DropdownMenuSub
                              open={allEmojisOpen}
                              onOpenChange={open => {
                                if (open) setAllEmojisOpen(true);
                              }}
                            >
                              <DropdownMenuSubTrigger
                                aria-label="More emojis"
                                onPointerMove={event => {
                                  if (event.pointerType === "mouse") {
                                    event.preventDefault();
                                  }
                                }}
                                className="size-9 justify-center gap-0 rounded-md px-0 py-0 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus:bg-accent focus:text-foreground data-[state=open]:bg-accent data-[state=open]:text-foreground [&>svg:last-child]:hidden"
                              >
                                <ChevronRight className="size-5" />
                              </DropdownMenuSubTrigger>
                              <DropdownMenuSubContent
                                sideOffset={8}
                                style={
                                  {
                                    "--tw-enter-translate-x": "0",
                                  } as React.CSSProperties
                                }
                                className="w-78 rounded-xl p-1 data-[side=left]:slide-in-from-bottom-2 data-[side=right]:slide-in-from-bottom-2"
                              >
                                <div
                                  role="group"
                                  aria-label="All emojis"
                                  className="h-[260px] overflow-x-hidden overflow-y-auto overscroll-contain"
                                >
                                  {VISIBLE_EMOJI_GROUPS.slice(
                                    0,
                                    visibleGroupCount
                                  ).map(group => (
                                    <div
                                      key={group.name}
                                      role="group"
                                      aria-label={group.name}
                                    >
                                      <div className="sticky top-0 bg-popover px-1 pt-1.5 pb-1 text-[11px] font-medium leading-4 text-muted-foreground">
                                        {group.name}
                                      </div>
                                      <div className="grid grid-cols-7">
                                        {group.emojis.map(({ emoji, name }) => (
                                          <button
                                            key={`${group.name}-${name}`}
                                            type="button"
                                            aria-label={name}
                                            aria-pressed={reaction === emoji}
                                            onClick={() =>
                                              setReaction(prev =>
                                                prev === emoji ? null : emoji
                                              )
                                            }
                                            className={cn(
                                              "group flex h-9 items-center justify-center rounded-md text-2xl leading-none select-none transition-colors focus-visible:ring-0 focus-visible:outline-none",
                                              reaction === emoji &&
                                                "bg-accent text-foreground"
                                            )}
                                          >
                                            <span
                                              aria-hidden="true"
                                              className="transition-transform duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)] group-hover:scale-150 group-active:scale-95 motion-reduce:transform-none"
                                            >
                                              {emoji}
                                            </span>
                                          </button>
                                        ))}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </DropdownMenuSubContent>
                            </DropdownMenuSub>
                          </div>
                        </div>
                        <div className="rounded-lg border border-border/70 bg-popover p-1 shadow-sm">
                          {message.content && onSpeak ? (
                            <DropdownMenuItem
                              className="group/readaloud gap-2.5 whitespace-nowrap rounded-lg py-2 pl-2.5 pr-8"
                              onSelect={() => {
                                if (isPreparingSpeech) return;
                                if (isSpeaking) onStop();
                                else
                                  onSpeak(
                                    cleanContent || message.content,
                                    message.id
                                  );
                              }}
                              disabled={isPreparingSpeech}
                              aria-label={
                                isPreparingSpeech
                                  ? "Preparing audio"
                                  : isSpeaking
                                    ? "Stop reading"
                                    : "Read aloud"
                              }
                            >
                              {isPreparingSpeech ? (
                                <span className="flex size-4 items-center justify-center text-foreground">
                                  <span
                                    className="loader text-foreground"
                                    style={{ width: 16 }}
                                    aria-hidden
                                  />
                                </span>
                              ) : isSpeaking ? (
                                <>
                                  <RealtimeSpeechEqualizer
                                    isSpeaking={isSpeaking}
                                    speechState={speechState}
                                    messageId={message.id}
                                  />
                                  <Square className="size-3.5 fill-current group-hover/readaloud:hidden" />
                                </>
                              ) : (
                                <Volume2 className="size-4 text-muted-foreground" />
                              )}
                              <span>
                                {isPreparingSpeech
                                  ? "Preparing audio…"
                                  : isSpeaking
                                    ? "Stop reading"
                                    : "Read aloud"}
                              </span>
                            </DropdownMenuItem>
                          ) : null}
                          {(onRegenerate || onRetry) && (
                            <DropdownMenuItem
                              className="gap-2.5 whitespace-nowrap rounded-lg py-2 pl-2.5 pr-8"
                              onSelect={() => {
                                if (onRegenerate) onRegenerate(message);
                                else if (onRetry) onRetry(message);
                              }}
                              aria-label={
                                onRegenerate
                                  ? "Regenerate response"
                                  : "Retry response"
                              }
                            >
                              <RotateCcw className="size-4 text-muted-foreground" />
                              <span>
                                {onRegenerate
                                  ? "Regenerate response"
                                  : "Retry response"}
                              </span>
                            </DropdownMenuItem>
                          )}
                          {canRate && (
                            <>
                              {canReadAloud ? (
                                <DropdownMenuSeparator className="my-1" />
                              ) : null}
                              <DropdownMenuItem
                                className="gap-2.5 whitespace-nowrap rounded-lg py-2 pl-2.5 pr-2.5 data-[active=true]:text-emerald-600 dark:data-[active=true]:text-emerald-400"
                                data-active={feedback === "up"}
                                onSelect={() => handleFeedbackToggle("up")}
                                aria-label="Good response"
                              >
                                <ThumbsUp
                                  className={cn(
                                    "size-4",
                                    feedback === "up"
                                      ? "text-emerald-600 dark:text-emerald-400 ksemo-feedback-thumb-active"
                                      : "text-muted-foreground"
                                  )}
                                />
                                <span>
                                  {feedback === "up"
                                    ? "Remove good response"
                                    : "Good response"}
                                </span>
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                className="gap-2.5 whitespace-nowrap rounded-lg py-2 pl-2.5 pr-2.5 data-[active=true]:text-rose-600 dark:data-[active=true]:text-rose-400"
                                data-active={feedback === "down"}
                                onSelect={() => handleFeedbackToggle("down")}
                                aria-label="Bad response"
                              >
                                <ThumbsDown
                                  className={cn(
                                    "size-4",
                                    feedback === "down"
                                      ? "text-rose-600 dark:text-rose-400 ksemo-feedback-thumb-active"
                                      : "text-muted-foreground"
                                  )}
                                />
                                <span>
                                  {feedback === "down"
                                    ? "Remove bad response"
                                    : "Bad response"}
                                </span>
                              </DropdownMenuItem>
                            </>
                          )}
                        </div>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                )}
              </div>
            )}
        </div>
      </article>

      <ImageLightbox
        images={
          lightboxFile
            ? [
                {
                  src: lightboxFile.url,
                  alt: lightboxFile.filename,
                  label: lightboxFile.filename,
                  downloadUrl: lightboxFile.url,
                  downloadName: lightboxFile.filename,
                },
              ]
            : []
        }
        index={lightboxFile ? 0 : null}
        onIndexChange={() => {}}
        onClose={() => setLightboxFile(null)}
        title="Image viewer"
      />

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

export type { KsemoMessage };
