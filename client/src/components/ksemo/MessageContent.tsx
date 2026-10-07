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
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { getFileKind } from "@/lib/fileKinds";
import { CardWheelFan } from "@/components/ui/card-wheel-fan";
import { ImageLightbox } from "@/components/ui/image-lightbox";
import { isImageFile } from "@/lib/fileKinds";
import { ThinkingIndicator } from "@/components/ui/thinking-indicator";
import {
  Check,
  ChevronDown,
  Copy,
  Download,
  ExternalLink,
  MoreHorizontal,
  Pencil,
  Search,
  RotateCcw,
  SmilePlus,
  Square,
  ThumbsDown,
  ThumbsUp,
  Volume2,
  X,
} from "lucide-react";
import { type MessageFeedbackValue } from "./MessageFeedback";
import { EMOJI_GROUPS } from "@/data/emojiGroups";
import { usePersistFn } from "@/hooks/usePersistFn";
import { useIsMobile } from "@/hooks/useIsMobile";
import React, { memo, useEffect, useRef, useState } from "react";
import {
  Streamdown,
  defaultRehypePlugins,
  type StreamdownProps,
} from "streamdown";
import { KsemoMarkdownCode } from "./code-block";
import { sanitizeAssistantText } from "@/lib/sanitizeAssistant";
import { usePdfViewer, isViewableDocument } from "@/contexts/PdfViewerContext";
import type { PptOutlinePlan } from "@shared/presentationOutline";
import {
  BotActionStatus,
  type BotActionData,
} from "@/components/voice/BotActionStatus";

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
const ReactionsContext = React.createContext<string[]>([]);

function ReactionsSpan({
  node: _node,
  ...rest
}: React.ComponentPropsWithoutRef<"span"> & { node?: unknown }) {
  const reactions = React.useContext(ReactionsContext);
  if ("data-ksemo-reactions" in rest) {
    return (
      <>
        {reactions.map(emoji => (
          <span key={emoji} className="ksemo-inline-reaction">
            {emoji}
          </span>
        ))}
      </>
    );
  }
  return <span {...rest} />;
}

const KSEMO_MARKDOWN_COMPONENTS = {
  code: KsemoMarkdownCode,
  a: KsemoMarkdownLink,
  span: ReactionsSpan,
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

const VISIBLE_EMOJI_GROUPS = EMOJI_GROUPS.filter(
  group => group.name !== "Flags" && group.name !== "Symbols"
);

/**
 * Full emoji grid behind the "all emojis" submenu. Extracted as a memo so that
 * ticking a reaction re-renders only the changed button instead of the whole
 * panel of hundreds of emojis.
 */
const AllEmojiGrid = memo(function AllEmojiGrid({
  reactions,
  onToggle,
  isMobile,
  searchQuery,
}: {
  reactions: string[];
  onToggle: (emoji: string) => void;
  isMobile: boolean;
  searchQuery: string;
}) {
  const [visibleGroupCount, setVisibleGroupCount] = useState(1);
  const normalizedSearch = searchQuery.trim().toLocaleLowerCase();
  const matchingGroups = normalizedSearch
    ? VISIBLE_EMOJI_GROUPS.map(group => ({
        ...group,
        emojis: group.emojis.filter(
          ({ emoji, name }) =>
            name.toLocaleLowerCase().includes(normalizedSearch) ||
            emoji.includes(normalizedSearch)
        ),
      })).filter(group => group.emojis.length > 0)
    : VISIBLE_EMOJI_GROUPS.slice(0, visibleGroupCount);

  return (
    <div
      role="group"
      aria-label="All emojis"
      className={cn(
        "overflow-x-hidden overflow-y-auto overscroll-contain",
        isMobile ? "h-[min(220px,42vh)]" : "h-[260px]"
      )}
      onScroll={event => {
        const element = event.currentTarget;
        if (
          element.scrollTop + element.clientHeight >=
          element.scrollHeight - 100
        ) {
          setVisibleGroupCount(current =>
            Math.min(VISIBLE_EMOJI_GROUPS.length, current + 2)
          );
        }
      }}
    >
      {matchingGroups.map(group => (
        <div key={group.name} role="group" aria-label={group.name}>
          <div className="sticky top-0 bg-popover px-1 pt-1.5 pb-1 text-[11px] font-medium leading-4 text-muted-foreground">
            {group.name}
          </div>
          <div className={cn("grid", isMobile ? "grid-cols-8" : "grid-cols-7")}>
            {group.emojis.map(({ emoji, name }) => (
              <button
                key={`${group.name}-${name}`}
                type="button"
                aria-label={name}
                aria-pressed={reactions.includes(emoji)}
                onClick={() => onToggle(emoji)}
                className={cn(
                  cn(
                    "group flex items-center justify-center rounded-md leading-none select-none transition-colors focus-visible:ring-0 focus-visible:outline-none",
                    isMobile ? "h-8 text-xl" : "h-9 text-2xl"
                  ),
                  reactions.includes(emoji) && "bg-accent text-foreground"
                )}
              >
                <span
                  aria-hidden="true"
                  className="transition-transform duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)] group-hover:scale-[1.7] group-active:scale-95 motion-reduce:transform-none"
                >
                  {emoji}
                </span>
              </button>
            ))}
          </div>
        </div>
      ))}
      {normalizedSearch && matchingGroups.length === 0 && (
        <p className="px-2 py-8 text-center text-sm text-muted-foreground">
          No emojis found
        </p>
      )}
    </div>
  );
});

type HastNode = {
  type: string;
  tagName?: string;
  properties?: Record<string, unknown>;
  children?: HastNode[];
  value?: string;
};

const REACTION_BLOCK_TAGS = new Set([
  "p",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "ul",
  "ol",
  "li",
  "dl",
  "dt",
  "dd",
  "blockquote",
  "pre",
  "table",
  "thead",
  "tbody",
  "tfoot",
  "tr",
  "th",
  "td",
  "figure",
  "figcaption",
  "section",
  "article",
  "div",
]);

const singleMarkdownBlock = (markdown: string) => (markdown ? [markdown] : []);

const appendReactionsPlaceholder = () => (tree: HastNode) => {
  let block = tree;
  for (;;) {
    const children = block.children;
    if (!children || children.length === 0) break;
    const last = children[children.length - 1];
    if (
      last.type === "element" &&
      last.tagName !== undefined &&
      REACTION_BLOCK_TAGS.has(last.tagName) &&
      last.children &&
      last.children.length > 0
    ) {
      block = last;
      continue;
    }
    break;
  }
  if (!block.children) return;
  block.children.push({
    type: "element",
    tagName: "span",
    properties: { dataKsemoReactions: "" },
    children: [],
  });
};

const STABLE_REHYPE_PLUGINS: StreamdownProps["rehypePlugins"] = [
  ...Object.values(defaultRehypePlugins),
  appendReactionsPlaceholder,
];

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
  onPause?: () => void;
  onResume?: () => void;
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
  const reactionsStorageKey = `ksemo-reactions:${message.id}`;
  const [reactions, setReactions] = useState<string[]>(() => {
    try {
      const stored = localStorage.getItem(reactionsStorageKey);
      const parsed: unknown = stored ? JSON.parse(stored) : [];
      return Array.isArray(parsed)
        ? parsed
            .filter((item): item is string => typeof item === "string")
            .slice(0, 3)
        : [];
    } catch {
      return [];
    }
  });
  const [emojiPickerOpen, setEmojiPickerOpen] = useState(false);
  const [emojiSearch, setEmojiSearch] = useState("");
  const isMobile = useIsMobile();

  useEffect(() => {
    try {
      localStorage.setItem(reactionsStorageKey, JSON.stringify(reactions));
    } catch {
      // storage unavailable; reactions stay in memory for this session
    }
  }, [reactionsStorageKey, reactions]);

  const toggleReaction = usePersistFn((emoji: string) => {
    setReactions(prev =>
      prev.includes(emoji)
        ? prev.filter(item => item !== emoji)
        : prev.length < 3
          ? [...prev, emoji]
          : prev
    );
  });
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
  const messageTimestamp = formatMessageTimestamp(message.createdAt);
  const isGeneratingFile = Boolean(
    isFileGenerating ||
    (message.fileGeneration && message.fileGeneration.status === "processing")
  );

  const canReadAloud = Boolean(message.content && !!onSpeak && !isCancelled);
  const canRegenerate = Boolean(onRegenerate || onRetry);
  const canRate = Boolean(onFeedback && message.content && !isCancelled);
  const hasOverflowActions = canReadAloud || canRegenerate || canRate;
  const hasActiveIndicator =
    canRate && (feedback === "up" || feedback === "down");
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
          <ReactionsContext.Provider value={reactions}>
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
                      onClick={
                        userLong ? () => setUserExpanded(true) : undefined
                      }
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
                        {cleanContent && (
                          <div className="ksemo-markdown prose prose-neutral max-w-none text-[15px] leading-6 dark:prose-invert">
                            <Streamdown
                              components={KSEMO_MARKDOWN_COMPONENTS}
                              rehypePlugins={STABLE_REHYPE_PLUGINS}
                              parseMarkdownIntoBlocksFn={singleMarkdownBlock}
                            >
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
          </ReactionsContext.Provider>

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
                  <Check className="size-4" />
                ) : (
                  <Copy className="size-4" />
                ),
                copyMessage
              )}
              {onEdit &&
                !isEditing &&
                action("Edit message", <Pencil className="size-4" />, () =>
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
                      <Check className="size-4" />
                    ) : (
                      <Copy className="size-4" />
                    ),
                    copyMessage
                  )}
                {hasActiveIndicator &&
                  action(
                    feedback === "up"
                      ? "Liked"
                      : "Disliked",
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
                    () => handleFeedbackToggle(feedback as "up" | "down"),
                    true
                  )}{" "}
                {message.content && !isCancelled && (
                  <Popover
                    open={emojiPickerOpen}
                    onOpenChange={open => {
                      setEmojiPickerOpen(open);
                      if (!open) setEmojiSearch("");
                    }}
                  >
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <PopoverTrigger asChild>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className={cn(
                              actionClass,
                              emojiPickerOpen &&
                                "bg-accent/70 text-foreground hover:bg-accent/70 hover:text-foreground"
                            )}
                            aria-label="Add reaction"
                          >
                            <SmilePlus className="size-[18px]" />
                          </Button>
                        </PopoverTrigger>
                      </TooltipTrigger>
                      <TooltipContent side="bottom">React</TooltipContent>
                    </Tooltip>
                    <PopoverContent
                      side="top"
                      align="start"
                      sideOffset={8}
                      collisionPadding={8}
                      className="w-[min(20rem,calc(100vw-1rem))] rounded-xl border border-border/70 p-2 shadow-lg data-[state=open]:animate-none data-[state=closed]:animate-none data-[state=open]:transition-none data-[state=closed]:transition-none"
                    >
                      {!isMobile && (
                        <div className="mb-2 flex min-h-9 items-center gap-2 rounded-lg bg-muted/60 px-2.5">
                          <Search className="size-4 shrink-0 text-muted-foreground" />
                          <input
                            type="text"
                            value={emojiSearch}
                            onChange={event =>
                              setEmojiSearch(event.target.value)
                            }
                            placeholder="Search emoji"
                            aria-label="Search emojis"
                            autoComplete="off"
                            className="min-w-0 flex-1 bg-transparent py-2 text-sm outline-none placeholder:text-muted-foreground"
                          />
                          {reactions.length > 0 && (
                            <span
                              className="flex shrink-0 items-center gap-0.5 border-l border-border/50 pl-1"
                              aria-label={`${reactions.length} selected reactions`}
                            >
                              {reactions.map(emoji => {
                                const name = EMOJI_GROUPS.flatMap(
                                  group => group.emojis
                                ).find(item => item.emoji === emoji)?.name;
                                return (
                                  <button
                                    key={emoji}
                                    type="button"
                                    aria-label={`Undo ${name ?? "emoji"} reaction`}
                                    title={`Undo ${name ?? "emoji"} reaction`}
                                    onClick={() => toggleReaction(emoji)}
                                    className="flex size-8 shrink-0 items-center justify-center rounded-md text-2xl hover:bg-accent focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                                  >
                                    <span aria-hidden="true">{emoji}</span>
                                  </button>
                                );
                              })}
                            </span>
                          )}
                        </div>
                      )}
                      <AllEmojiGrid
                        reactions={reactions}
                        onToggle={toggleReaction}
                        isMobile={isMobile}
                        searchQuery={isMobile ? "" : emojiSearch}
                      />
                    </PopoverContent>
                  </Popover>
                )}
                {hasOverflowActions && (
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
                              <MoreHorizontal
                                className="size-[22px] shrink-0"
                                style={{ width: 22, height: 22 }}
                              />
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
                            <time className="flex w-full justify-start px-2.5 pt-1 pb-2 text-left text-xs leading-4 tabular-nums text-muted-foreground/80">
                              {messageTimestamp}
                            </time>
                          )}
                          {canRate && (
                            <>
                              <DropdownMenuItem
                                className="gap-2.5 whitespace-nowrap rounded-lg py-2 pl-2.5 pr-2.5 data-[active=true]:text-emerald-600 dark:data-[active=true]:text-emerald-400"
                                data-active={feedback === "up"}
                                onSelect={() => handleFeedbackToggle("up")}
                                aria-label={
                                  feedback === "up" ? "Liked" : "Like"
                                }
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
                                  {feedback === "up" ? "Liked" : "Like"}
                                </span>
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                className="gap-2.5 whitespace-nowrap rounded-lg py-2 pl-2.5 pr-2.5 data-[active=true]:text-rose-600 dark:data-[active=true]:text-rose-400"
                                data-active={feedback === "down"}
                                onSelect={() => handleFeedbackToggle("down")}
                                aria-label={
                                  feedback === "down" ? "Disliked" : "Dislike"
                                }
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
                                  {feedback === "down" ? "Disliked" : "Dislike"}
                                </span>
                              </DropdownMenuItem>
                            </>
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
                              <RotateCcw className="size-4 text-muted-foreground" />
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
                                <Square className="size-3.5 fill-current text-muted-foreground" />
                              ) : (
                                <Volume2 className="size-4 text-muted-foreground" />
                              )}
                              <span>
                                {isSpeaking ? "Stop reading" : "Read aloud"}
                              </span>
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
