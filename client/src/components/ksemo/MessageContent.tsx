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
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { getFileKind } from "@/lib/fileKinds";
import { CardWheelFan } from "@/components/ui/card-wheel-fan";
import { ImageLightbox } from "@/components/ui/image-lightbox";
import { isImageFile } from "@/lib/fileKinds";
import { LibraryFileIcon } from "./LibraryFileIcon";
import { ThinkingIndicator } from "@/components/ui/thinking-indicator";
import {
  ChevronDown,
  Copy,
  Download,
  ExternalLink,
  MoreHorizontal,
  Pencil,
  RotateCcw,
  Square,
  ThumbsDown,
  ThumbsUp,
  Volume2,
  X,
} from "lucide-react";
import { BranchSplitIcon } from "./BranchSplitIcon";
import { ShareIcon } from "./icons";
import { type MessageFeedbackValue } from "./MessageFeedback";
import { usePersistFn } from "@/hooks/usePersistFn";
import { useIsMobile } from "@/hooks/useIsMobile";
import React, { memo, useEffect, useRef, useState } from "react";
import { Streamdown, defaultRehypePlugins } from "streamdown";
import { KsemoMarkdownCode } from "./code-block";
import { sanitizeAssistantText } from "@/lib/sanitizeAssistant";
import { usePdfViewer, isViewableDocument } from "@/contexts/PdfViewerContext";
import type { PptOutlinePlan } from "@shared/presentationOutline";
import {
  BotActionStatus,
  type BotActionData,
} from "@/components/voice/BotActionStatus";
import { CopySuccessIcon } from "./ActionNotice";

type KsemoMessage = {
  id: string;
  clientId?: string;
  role: "user" | "assistant" | "system" | "tool";
  content: string;
  status?: "sending" | "streaming" | "completed" | "failed" | "cancelled";
  createdAt?: Date | string | number;
  attachments?: Array<{
    id: string;
    filename: string;
    mimeType?: string;
    url: string;
    sizeBytes?: number;
  }>;
  botAction?: BotActionData;
  memoryUses?: Array<{
    id: string;
    content: string;
    category?: string;
    sourceConversationId?: string | null;
  }>;
  branchOrigin?: {
    conversationId: string;
    title: string;
    branchedAtMessageId?: string;
  };
  branchTargets?: Array<{
    conversationId: string;
    title: string;
    targetMessageId?: string;
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
    summary?: string;
    outline?: PptOutlinePlan;
    code?: string;
  };
};

const FEEDBACK_SPARK_DIRECTIONS = [
  [-19, -19],
  [-8, -23],
  [8, -23],
  [19, -19],
  [23, -8],
  [23, 8],
  [19, 19],
  [8, 23],
  [-8, 23],
  [-19, 19],
  [-23, 8],
  [-23, -8],
] as const;

function FeedbackSparkBurst({ tone }: { tone: "up" | "down" }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "pointer-events-none absolute inset-0 z-0 overflow-visible",
        tone === "up"
          ? "text-emerald-600 dark:text-emerald-500"
          : "text-rose-600 dark:text-rose-500"
      )}
    >
      {FEEDBACK_SPARK_DIRECTIONS.map(([x, y], index) => (
        <span
          key={`${x}-${y}`}
          className={cn(
            "ksemo-feedback-spark-particle",
            index % 3 === 0
              ? "ksemo-feedback-spark-star"
              : index % 3 === 1
                ? "ksemo-feedback-spark-ray"
                : "ksemo-feedback-spark-dot"
          )}
          style={
            {
              "--spark-x": `${x}px`,
              "--spark-y": `${y}px`,
              "--spark-angle": `${(Math.atan2(y, x) * 180) / Math.PI + 90}deg`,
            } as React.CSSProperties
          }
        />
      ))}
    </span>
  );
}

function formatShortResponseDuration(durationMs: number): string {
  const seconds = Math.max(1, Math.ceil(durationMs / 1000));
  return `${seconds}s`;
}

function normalizeOrderedListMarkers(markdown: string) {
  const counters = new Map<number, number>();
  let fencedCode = false;
  return markdown
    .split("\n")
    .map(line => {
      const fence = line.match(/^\s*(`{3,}|~{3,})/);
      if (fence) {
        fencedCode = !fencedCode;
        return line;
      }
      if (fencedCode) return line;

      const listItem = line.match(/^(\s*)(\d{1,9})([.)])(\s+)/);
      if (listItem && listItem[1].length < 4) {
        const indent = listItem[1].length;
        const previous = counters.get(indent);
        const number =
          previous === undefined ? Number(listItem[2]) : previous + 1;
        for (const level of counters.keys()) {
          if (level > indent) counters.delete(level);
        }
        counters.set(indent, number);
        return `${listItem[1]}${number}${listItem[3]}${listItem[4]}${line.slice(listItem[0].length)}`;
      }

      // Blank lines and nested unordered bullets can occur between numbered
      // points. Keep the parent counter through those, but reset it at prose.
      if (!line.trim() || /^\s*[-+*]\s+/.test(line)) return line;
      if (line.match(/^\s+/) && counters.size) return line;
      counters.clear();
      return line;
    })
    .join("\n");
}

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

function formatMessageTimestamp(timestamp?: Date | string | number) {
  if (timestamp === undefined || timestamp === null) return null;
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return null;
  const time = new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
  const dateKey = (value: Date) =>
    `${value.getFullYear()}-${value.getMonth()}-${value.getDate()}`;
  const now = new Date();
  if (dateKey(date) === dateKey(now)) return `Today, ${time}`;
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  if (dateKey(date) === dateKey(yesterday)) return `Yesterday, ${time}`;
  const dateLabel = new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
  return `${dateLabel}, ${time}`;
}

// List-with-arrow glyph for the message actions menu. The arrow is its own
// path so only it flips up when the menu opens — the list lines never move.
const LIST_ARROW_LINES_D =
  "M2.25 5C2.25 4.58579 2.58579 4.25 3 4.25H21C21.4142 4.25 21.75 4.58579 21.75 5C21.75 5.41421 21.4142 5.75 21 5.75H3C2.58579 5.75 2.25 5.41421 2.25 5ZM2.25 9C2.25 8.58579 2.58579 8.25 3 8.25H21C21.4142 8.25 21.75 8.58579 21.75 9C21.75 9.41421 21.4142 9.75 21 9.75H3C2.58579 9.75 2.25 9.41421 2.25 9ZM2.25 13C2.25 12.5858 2.58579 12.25 3 12.25H11C11.4142 12.25 11.75 12.5858 11.75 13C11.75 13.4142 11.4142 13.75 11 13.75H3C2.58579 13.75 2.25 13.4142 2.25 13ZM2.25 17C2.25 16.5858 2.58579 16.25 3 16.25H11C11.4142 16.25 11.75 16.5858 11.75 17C11.75 17.4142 11.4142 17.75 11 17.75H3C2.58579 17.75 2.25 17.4142 2.25 17Z";
const LIST_ARROW_ARROW_D =
  "M17.5 12.25C17.9142 12.25 18.25 12.5858 18.25 13V17.1893L19.4697 15.9697C19.7626 15.6768 20.2374 15.6768 20.5303 15.9697C20.8232 16.2626 20.8232 16.7374 20.5303 17.0303L18.0303 19.5303C17.7374 19.8232 17.2626 19.8232 16.9697 19.5303L14.4697 17.0303C14.1768 16.7374 14.1768 16.2626 14.4697 15.9697C14.7626 15.6768 15.2374 15.6768 15.5303 15.9697L16.75 17.1893V13C16.75 12.5858 17.0858 12.25 17.5 12.25Z";

const singleMarkdownBlock = (markdown: string) => (markdown ? [markdown] : []);
const STABLE_REHYPE_PLUGINS = Object.values(defaultRehypePlugins);

function ActionsMenuGlyph({ open }: { open: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={22}
      height={22}
      fill="none"
      aria-hidden="true"
      data-testid="actions-menu-glyph"
      className="size-[22px] shrink-0"
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

export const MessageContent = memo(function MessageContent({
  message,
  onSpeak,
  onPause,
  onResume,
  onStop,
  isSpeaking,
  responseStartedAt,
  isCurrentGeneration = false,
  isFileGenerating = false,
  hideTypingIndicator = false,
  onEdit,
  onRegenerate,
  onRetry,
  onFeedback,
  feedback = null,
  onShare,
  onBranch,
  onDelete,
  onFileOpen,
  isEditing = false,
  editValue = "",
  onEditValueChange,
  onSaveEdit,
  onCancelEdit,
  fileCreationNode,
  sharedAnswerPreview = false,
}: {
  message: KsemoMessage;
  fileCreationNode?: React.ReactNode;
  sharedAnswerPreview?: boolean;
  onSpeak: (text: string, messageId: string) => void;
  onPause?: () => void;
  onResume?: () => void;
  onStop: () => void;
  isSpeaking: boolean;
  responseStartedAt?: number;
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
  onShare?: (message: KsemoMessage) => void | Promise<void>;
  onBranch?: (message: KsemoMessage) => void | Promise<void>;
  onDelete?: (message: KsemoMessage) => void;
  onFileOpen?: () => void;
  isEditing?: boolean;
  editValue?: string;
  onEditValueChange?: (value: string) => void;
  onSaveEdit?: () => void;
  onCancelEdit?: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [feedbackPulse, setFeedbackPulse] =
    useState<MessageFeedbackValue | null>(null);
  const [feedbackPulseKey, setFeedbackPulseKey] = useState(0);
  const [actionsOpen, setActionsOpen] = useState(false);
  const [responseDurationMs, setResponseDurationMs] = useState<number | null>(
    null
  );
  const isMobile = useIsMobile();
  const [showMobileUserActions, setShowMobileUserActions] = useState(false);
  const mobileUserActionsRef = useRef<HTMLDivElement | null>(null);
  const userLongPressTimerRef = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (userLongPressTimerRef.current !== null) {
        window.clearTimeout(userLongPressTimerRef.current);
      }
    },
    []
  );

  const startUserLongPress = () => {
    if (!isMobile) return;
    if (userLongPressTimerRef.current !== null) {
      window.clearTimeout(userLongPressTimerRef.current);
    }
    userLongPressTimerRef.current = window.setTimeout(() => {
      setShowMobileUserActions(true);
      userLongPressTimerRef.current = null;
    }, 450);
  };

  const cancelUserLongPress = () => {
    if (userLongPressTimerRef.current !== null) {
      window.clearTimeout(userLongPressTimerRef.current);
      userLongPressTimerRef.current = null;
    }
  };

  useEffect(() => {
    if (!isMobile || !showMobileUserActions) return;

    const dismissOnOutsidePress = (event: PointerEvent) => {
      if (!mobileUserActionsRef.current?.contains(event.target as Node)) {
        setShowMobileUserActions(false);
      }
    };

    document.addEventListener("pointerdown", dismissOnOutsidePress);
    return () =>
      document.removeEventListener("pointerdown", dismissOnOutsidePress);
  }, [isMobile, showMobileUserActions]);

  useEffect(() => {
    if (
      message.role !== "assistant" ||
      message.status !== "streaming" ||
      responseStartedAt === undefined
    ) {
      setResponseDurationMs(null);
      return;
    }
    const updateElapsed = () =>
      setResponseDurationMs(Math.max(0, performance.now() - responseStartedAt));
    updateElapsed();
    const timer = window.setInterval(updateElapsed, 1000);
    return () => window.clearInterval(timer);
  }, [message.role, message.status, responseStartedAt]);

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
  const renderContent = normalizeOrderedListMarkers(cleanContent);

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

  // Stable across renders so the memoized feedback pair is not re-rendered on
  // every streaming flush.
  const handleFeedbackToggle = usePersistFn((value: MessageFeedbackValue) =>
    onFeedback?.(message.id, value)
  );

  const animateFeedbackToggle = (value: MessageFeedbackValue) => {
    setFeedbackPulse(value);
    setFeedbackPulseKey(key => key + 1);
    handleFeedbackToggle(value);
  };

  async function copyMessage() {
    await navigator.clipboard.writeText(cleanContent);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1_500);
  }

  async function shareResponse() {
    if (!onShare || sharing) return;
    setSharing(true);
    try {
      await onShare(message);
    } finally {
      setSharing(false);
    }
  }

  if (message.role === "system" || message.role === "tool") return null;

  const actionClass =
    "size-8 rounded-md text-foreground transition-colors hover:bg-accent hover:text-foreground";
  const action = (
    label: string,
    icon: React.ReactNode,
    click: () => void,
    active?: boolean,
    codeTrigger = false
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
          data-code-trigger={codeTrigger ? "true" : undefined}
        >
          {icon}
        </Button>
      </TooltipTrigger>
      <TooltipContent side="bottom">{label}</TooltipContent>
    </Tooltip>
  );

  const isCancelled = !isUser && message.status === "cancelled";
  const messageTimestamp = formatMessageTimestamp(message.createdAt);
  const isGeneratingFile = Boolean(
    isFileGenerating ||
    (message.fileGeneration && message.fileGeneration.status === "processing")
  );

  const canReadAloud = Boolean(message.content && !!onSpeak && !isCancelled);
  const canRegenerate = Boolean(onRegenerate || onRetry);
  const canRate = Boolean(onFeedback && message.content && !isCancelled);
  const canBranch = Boolean(
    message.content && onBranch && message.status !== "streaming"
  );
  const hasOverflowActions = canReadAloud || canRegenerate || canBranch;
  const actionsMenuLabel = "More message actions";

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
              ? "relative flex flex-col items-end w-fit max-w-[84%] sm:max-w-[82%]"
              : "w-full"
          )}
        >
          {isUser && message.attachments?.length
            ? (() => {
                const documents = message.attachments.filter(
                  f => !isImageFile(f.filename, f.mimeType)
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
                          const opensInDrawer = isViewableDocument(
                            file.filename,
                            file.mimeType
                          );
                          return (
                            <button
                              key={file.id}
                              type="button"
                              onClick={() => {
                                onFileOpen?.();
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
                              className="group/file flex h-14 min-w-44 max-w-[18rem] items-center gap-3 rounded-xl border border-border/70 bg-muted/70 px-3 text-left transition-all hover:border-border hover:bg-accent/80"
                              aria-label={`Preview ${file.filename}`}
                            >
                              <LibraryFileIcon
                                filename={file.filename}
                                mimeType={file.mimeType}
                                className="size-8 shrink-0"
                              />
                              <span className="min-w-0 flex-1">
                                <span className="block truncate text-[13px] font-semibold leading-tight text-foreground transition-colors group-hover/file:text-primary">
                                  {file.filename}
                                </span>
                                <span className="mt-1 block text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                                  {kind.label}
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
              onPointerDown={isUser ? startUserLongPress : undefined}
              onPointerUp={isUser ? cancelUserLongPress : undefined}
              onPointerLeave={isUser ? cancelUserLongPress : undefined}
              onPointerCancel={isUser ? cancelUserLongPress : undefined}
              onContextMenu={
                isUser && isMobile ? event => event.preventDefault() : undefined
              }
              className={cn(
                "text-[15px] leading-6",
                isUser
                  ? cn(
                      "ksemo-user-message-bubble flex flex-col items-end rounded-2xl rounded-tr-md border border-border bg-muted px-3.5 py-2.5 text-[15px] leading-6 text-foreground shadow-sm",
                      isMobile && "ksemo-mobile-user-message",
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
                          splitFirstSentence(renderContent);
                        return (
                          <>
                            {first ? (
                              <div className="ksemo-markdown prose prose-neutral max-w-none text-[15px] leading-6 dark:prose-invert">
                                <Streamdown
                                  components={KSEMO_MARKDOWN_COMPONENTS}
                                  rehypePlugins={
                                    rest ? undefined : STABLE_REHYPE_PLUGINS
                                  }
                                  parseMarkdownIntoBlocksFn={
                                    rest ? undefined : singleMarkdownBlock
                                  }
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
                                  rehypePlugins={STABLE_REHYPE_PLUGINS}
                                  parseMarkdownIntoBlocksFn={
                                    singleMarkdownBlock
                                  }
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
                      {renderContent && (
                        <div className="ksemo-markdown prose prose-neutral max-w-none text-[15px] leading-6 dark:prose-invert">
                          <Streamdown
                            components={KSEMO_MARKDOWN_COMPONENTS}
                            rehypePlugins={STABLE_REHYPE_PLUGINS}
                            parseMarkdownIntoBlocksFn={singleMarkdownBlock}
                          >
                            {renderContent}
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
                        className="inline-flex items-center gap-2"
                      >
                        <ThinkingIndicator size={24} />
                        <span className="text-sm font-medium text-muted-foreground">
                          Working for{" "}
                          {formatShortResponseDuration(responseDurationMs ?? 0)}
                        </span>
                      </div>
                    )}
                </>
              )}
              {!isUser && (message.memoryUses?.length ?? 0) > 0 && (
                <details className="mt-2 max-w-xl rounded-lg border border-border/70 px-3 py-2 text-xs text-muted-foreground">
                  <summary className="cursor-pointer select-none">
                    Used {message.memoryUses!.length} saved context{" "}
                    {message.memoryUses!.length === 1 ? "item" : "items"}
                  </summary>
                  <ul className="mt-2 space-y-1.5">
                    {message.memoryUses!.map(memory => (
                      <li key={memory.id}>
                        {memory.content}
                        {memory.sourceConversationId && (
                          <a
                            className="ml-2 underline underline-offset-2 hover:text-foreground"
                            href={`/c/${memory.sourceConversationId}`}
                          >
                            Source chat
                          </a>
                        )}
                      </li>
                    ))}
                  </ul>
                </details>
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
                              className="flex size-7 items-center justify-center rounded-md text-foreground transition-colors hover:bg-accent hover:text-foreground"
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
                    className="group/card flex h-[4.5rem] w-[21rem] max-w-full items-center gap-3 rounded-2xl border border-border/80 bg-muted/60 px-3.5 py-3 shadow-sm transition-colors hover:bg-accent"
                  >
                    <button
                      type="button"
                      onClick={() => {
                        onFileOpen?.();
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
                      <LibraryFileIcon
                        filename={file.filename}
                        mimeType={file.mimeType}
                        className="size-11 shrink-0"
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold leading-snug text-foreground">
                          {file.filename}
                        </span>
                        <span className="mt-1 block text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                          {kind.label}
                        </span>
                      </span>
                    </button>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <a
                          href={file.url}
                          download
                          aria-label={`Download ${file.filename}`}
                          className="flex size-9 shrink-0 items-center justify-center rounded-lg text-foreground transition-colors hover:bg-accent hover:text-foreground"
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
            <div
              ref={mobileUserActionsRef}
              className={cn(
                "flex items-center gap-1 transition-opacity duration-150",
                isMobile
                  ? showMobileUserActions
                    ? "absolute right-0 top-full z-30 mt-px animate-in fade-in slide-in-from-top-1 duration-150"
                    : "hidden"
                  : "mt-1.5 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100"
              )}
              role={isMobile && showMobileUserActions ? "group" : undefined}
              aria-label={
                isMobile && showMobileUserActions
                  ? "Message options"
                  : undefined
              }
            >
              {isMobile ? (
                <div className="inline-flex min-w-[132px] flex-col items-stretch gap-0 rounded-lg border border-border/70 bg-popover p-1 text-popover-foreground shadow-md">
                  {messageTimestamp && (
                    <time className="flex w-full justify-start px-2.5 pt-[10px] pb-2 text-left text-[12.5px] leading-4 tabular-nums text-muted-foreground/80">
                      {messageTimestamp}
                    </time>
                  )}
                  {onEdit && !isEditing && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-10 w-full justify-start gap-1.5 rounded-md px-2 text-sm transition-transform active:scale-[0.98] active:bg-accent"
                      onClick={() => {
                        setShowMobileUserActions(false);
                        onEdit(message);
                      }}
                    >
                      <Pencil className="size-4" />
                      Edit message
                    </Button>
                  )}
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-10 w-full justify-start gap-1.5 rounded-md px-2 text-sm transition-transform active:scale-[0.98] active:bg-accent"
                    onClick={() => {
                      setShowMobileUserActions(false);
                      void copyMessage();
                    }}
                  >
                    {copied ? (
                      <CopySuccessIcon className="size-[17px]" />
                    ) : (
                      <Copy className="size-4" />
                    )}
                    Copy message
                  </Button>
                </div>
              ) : (
                <>
                  {messageTimestamp && (
                    <time className="mr-1 flex items-center px-1 text-[12.5px] leading-4 tabular-nums text-muted-foreground/80">
                      {messageTimestamp}
                    </time>
                  )}
                  {onEdit &&
                    !isEditing &&
                    action("Edit message", <Pencil className="size-4" />, () =>
                      onEdit(message)
                    )}
                  {action(
                    "Copy message",
                    copied ? (
                      <CopySuccessIcon className="size-[17px]" />
                    ) : (
                      <Copy className="size-4" />
                    ),
                    copyMessage
                  )}
                </>
              )}
            </div>
          )}
          {!isUser &&
            !isGeneratingFile &&
            message.status !== "streaming" &&
            (message.content ||
              message.status === "failed" ||
              message.status === "cancelled" ||
              Boolean(fileCreationNode)) && (
              <div className="-ml-1 mt-1.5 flex items-center gap-1">
                {message.content &&
                  action(
                    copied ? "Copied" : "Copy response",
                    copied ? (
                      <CopySuccessIcon className="size-[17px]" />
                    ) : (
                      <Copy className="size-4" />
                    ),
                    copyMessage
                  )}
                {!sharedAnswerPreview && canRate && (
                  <>
                    {action(
                      feedback === "up" ? "Remove like" : "Like",
                      <span className="relative grid size-4 place-items-center">
                        {feedbackPulse === "up" && (
                          <FeedbackSparkBurst
                            key={feedbackPulseKey}
                            tone="up"
                          />
                        )}
                        <ThumbsUp
                          key={feedbackPulseKey}
                          className={cn(
                            "relative z-10 size-4",
                            feedback === "up" &&
                              "text-emerald-600 dark:text-emerald-400 ksemo-feedback-thumb-active",
                            feedbackPulse === "up" && "ksemo-feedback-thumb-pop"
                          )}
                        />
                      </span>,
                      () => animateFeedbackToggle("up"),
                      feedback === "up"
                    )}
                    {action(
                      feedback === "down" ? "Remove dislike" : "Dislike",
                      <span className="relative grid size-4 place-items-center">
                        {feedbackPulse === "down" && (
                          <FeedbackSparkBurst
                            key={feedbackPulseKey}
                            tone="down"
                          />
                        )}
                        <ThumbsDown
                          key={feedbackPulseKey}
                          className={cn(
                            "relative z-10 size-4",
                            feedback === "down" &&
                              "text-rose-600 dark:text-rose-400 ksemo-feedback-thumb-active",
                            feedbackPulse === "down" &&
                              "ksemo-feedback-thumb-pop"
                          )}
                        />
                      </span>,
                      () => animateFeedbackToggle("down"),
                      feedback === "down"
                    )}
                  </>
                )}
                {!sharedAnswerPreview &&
                  message.content &&
                  onShare &&
                  action(
                    sharing ? "Preparing answer link…" : "Share response",
                    sharing ? (
                      <span
                        className="loader loader-xs text-current"
                        aria-hidden="true"
                      />
                    ) : (
                      <ShareIcon className="size-4" />
                    ),
                    () => void shareResponse()
                  )}
                {!sharedAnswerPreview && hasOverflowActions && (
                  <div className="relative inline-flex shrink-0">
                    <DropdownMenu
                      open={actionsOpen}
                      onOpenChange={setActionsOpen}
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
                              <MoreHorizontal className="size-4 shrink-0" />
                            </Button>
                          </DropdownMenuTrigger>
                        </TooltipTrigger>
                        <TooltipContent side="bottom">
                          More actions
                        </TooltipContent>
                      </Tooltip>
                      <DropdownMenuContent
                        align="start"
                        side="top"
                        sideOffset={6}
                        className="w-max min-w-44 rounded-xl border-0 bg-transparent p-1 shadow-none"
                      >
                        <div className="rounded-lg border border-border/70 bg-popover p-1 shadow-sm">
                          {messageTimestamp && (
                            <time className="flex w-full justify-start px-2.5 pt-[10px] pb-2 text-left text-[12.5px] leading-4 tabular-nums text-muted-foreground/80">
                              {messageTimestamp}
                            </time>
                          )}
                          {(onRegenerate || onRetry) && (
                            <DropdownMenuItem
                              className="gap-2.5 whitespace-nowrap rounded-lg py-2 pl-2.5 pr-8"
                              onSelect={() => {
                                if (onRegenerate) onRegenerate(message);
                                else if (onRetry) onRetry(message);
                              }}
                              aria-label="Try again"
                            >
                              <RotateCcw className="size-4 text-foreground" />
                              <span>Try again</span>
                            </DropdownMenuItem>
                          )}
                          {message.content && onSpeak ? (
                            <DropdownMenuItem
                              className="group/readaloud gap-2.5 whitespace-nowrap rounded-lg py-2 pl-2.5 pr-8"
                              onSelect={() => {
                                if (isSpeaking) onStop();
                                else
                                  onSpeak(
                                    cleanContent || message.content,
                                    message.id
                                  );
                              }}
                              aria-label={
                                isSpeaking ? "Stop reading" : "Read aloud"
                              }
                            >
                              {isSpeaking ? (
                                <Square className="size-4 fill-current text-foreground" />
                              ) : (
                                <Volume2 className="size-4 text-foreground" />
                              )}
                              <span>
                                {isSpeaking ? "Stop reading" : "Read aloud"}
                              </span>
                            </DropdownMenuItem>
                          ) : null}
                          {canBranch ? (
                            <DropdownMenuItem
                              className="group/branch gap-2.5 whitespace-nowrap rounded-lg py-2 pl-2.5 pr-8"
                              onSelect={() => void onBranch?.(message)}
                              aria-label="Branch in new chat"
                            >
                              <BranchSplitIcon className="size-4 text-foreground transition-colors group-hover/branch:text-foreground" />
                              <span>Branch in new chat</span>
                            </DropdownMenuItem>
                          ) : null}
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
