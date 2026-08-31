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
  Copy,
  Ellipsis,
  History,
  Pencil,
  RotateCcw,
  Square,
  ThumbsDown,
  ThumbsUp,
  Trash2,
  Volume2,
} from "lucide-react";
import { ShareIcon } from "./icons";
import React, { memo, useState } from "react";
import { Streamdown } from "streamdown";
import { KsemoMarkdownCode } from "./code-block";

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
  }>;
};

// Stable Streamdown component map so the internal `marked.Lexer` cache is not
// invalidated on every render (a fresh `components` object defeats Streamdown's
// memo and forces a full re-parse of the message on each streaming flush).
const KSEMO_MARKDOWN_COMPONENTS = { code: KsemoMarkdownCode };

export const MessageContent = memo(function MessageContent({
  message,
  onSpeak,
  onPause,
  onResume,
  onStop,
  isSpeaking,
  speechState,
  isCurrentGeneration = false,
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
  onEdit?: (message: KsemoMessage) => void;
  onRegenerate?: (message: KsemoMessage) => void;
  onRetry?: (message: KsemoMessage) => void;
  onFeedback?: (messageId: string, value: "up" | "down") => void;
  onShare?: (message: KsemoMessage) => void;
  onDelete?: (message: KsemoMessage) => void;
  onViewHistory?: (message: KsemoMessage) => void;
}) {
  const [copied, setCopied] = useState(false);
  const isUser = message.role === "user";

  async function copyMessage() {
    await navigator.clipboard.writeText(message.content);
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
          <div className="mb-2 flex max-w-full flex-wrap justify-end gap-2">
            {message.attachments.map(file => {
              const kind = getFileKind(file.filename, file.mimeType);
              return file.mimeType?.startsWith("image/") ? (
                <button
                  key={file.id}
                  type="button"
                  onClick={() => window.open(file.url, "_blank")}
                  className="group overflow-hidden rounded-xl border border-border bg-muted/50 text-left shadow-sm transition-opacity hover:opacity-90"
                  aria-label={`View ${file.filename}`}
                >
                  <img
                    src={file.url}
                    alt={file.filename}
                    className="block max-h-40 max-w-64 rounded-xl object-cover"
                  />
                </button>
              ) : (
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
        ) : null}
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
          ) : message.content ? (
            <div className="ksemo-markdown prose prose-neutral max-w-none text-[15px] leading-6 dark:prose-invert">
              <Streamdown
                mode={message.status === "streaming" ? "streaming" : "static"}
                components={KSEMO_MARKDOWN_COMPONENTS}
              >
                {message.content}
              </Streamdown>
            </div>
          ) : message.status === "streaming" && isCurrentGeneration ? (
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
            className="text-destructive focus:text-destructive"
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
