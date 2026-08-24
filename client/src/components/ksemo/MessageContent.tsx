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
import {
  Brain,
  Check,
  ChevronDown,
  Copy,
  Ellipsis,
  FileText,
  Globe,
  History,
  Image,
  Pencil,
  RotateCcw,
  Share2,
  Square,
  ThumbsDown,
  ThumbsUp,
  Trash2,
  Volume2,
} from "lucide-react";
import React from "react";
import { useState } from "react";
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

export function MessageContent({
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
  usedMemories,
  webSources,
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
  usedMemories?: Array<{ id: string; content: string }>;
  webSources?: Array<{ title: string; url: string }>;
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
    "size-7 rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground";
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
            : "w-full max-w-none"
        )}
      >
        {isUser && message.attachments?.length ? (
          <div className="mb-2 flex max-w-full flex-wrap justify-end gap-2">
            {message.attachments.map(file => (
              <a
                key={file.id}
                href={file.url}
                target="_blank"
                rel="noreferrer"
                className="overflow-hidden rounded-xl border border-border bg-muted/50 text-left shadow-sm"
              >
                <span className="flex min-w-44 items-center gap-2 p-2.5">
                  {file.mimeType?.startsWith("image/") ? (
                    <Image className="size-4 shrink-0 text-muted-foreground" />
                  ) : (
                    <FileText className="size-4 shrink-0 text-muted-foreground" />
                  )}
                  <span className="min-w-0">
                    <span className="block truncate text-xs font-medium">
                      {file.filename}
                    </span>
                    <span className="mt-0.5 block text-[10px] text-muted-foreground">
                      {file.mimeType?.startsWith("image/")
                        ? "Image attached"
                        : "File attached"}
                    </span>
                  </span>
                </span>
              </a>
            ))}
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
              <Streamdown components={{ code: KsemoMarkdownCode }}>
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
          ) : message.status === "streaming" ? (
            <div className="flex items-center gap-3 text-muted-foreground">
              <p>This response did not finish.</p>
              {onRetry && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onRetry(message)}
                  className="h-8 rounded-lg"
                >
                  Try again
                </Button>
              )}
            </div>
          ) : message.status === "failed" ? (
            <div className="flex items-center gap-3 text-destructive">
              <p>KSEMO could not complete this response.</p>
              {onRetry && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onRetry(message)}
                  className="h-8 rounded-lg border-destructive/30 text-destructive hover:bg-destructive/10"
                >
                  Try again
                </Button>
              )}
            </div>
          ) : null}
        </div>
        {isUser && message.content && (
          <div className="mt-1.5 flex items-center gap-1 opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-focus-within:opacity-100">
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
              action("Share message", <Share2 className="size-3.5" />, () =>
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
        {!isUser && usedMemories?.length ? (
          <UsedMemoriesChip memories={usedMemories} />
        ) : null}
        {!isUser && webSources?.length ? (
          <div className="mb-1 flex flex-wrap gap-1.5">
            {webSources.slice(0, 5).map((source, index) => (
              <a
                key={`${source.url}-${index}`}
                href={source.url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex max-w-[15rem] items-center gap-1 rounded-full border border-border bg-muted/60 px-2 py-0.5 text-[11px] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <Globe className="size-3 shrink-0" />
                <span className="truncate">{source.title}</span>
              </a>
            ))}
          </div>
        ) : null}
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
              action("Share response", <Share2 className="size-3.5" />, () =>
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
}

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
              className="size-8 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground"
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

function UsedMemoriesChip({
  memories,
}: {
  memories: Array<{ id: string; content: string }>;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="mb-1">
      <button
        onClick={() => setOpen(current => !current)}
        className="inline-flex items-center gap-1 rounded-full border border-border bg-muted/60 px-2 py-0.5 text-[11px] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        aria-expanded={open}
        aria-label={
          open ? "Hide memories used" : `Show ${memories.length} memories used`
        }
      >
        <Brain className="size-3" />
        Used {memories.length}{" "}
        {memories.length === 1 ? "memory" : "memories"}
        <ChevronDown
          className={cn(
            "size-3 transition-transform duration-150",
            open && "rotate-180"
          )}
        />
      </button>
      {open ? (
        <ul className="mt-1.5 max-w-md space-y-1 rounded-xl border border-border bg-card p-2.5 text-left shadow-sm">
          {memories.map(item => (
            <li
              key={item.id}
              className="text-xs leading-5 text-muted-foreground"
            >
              {item.content}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
