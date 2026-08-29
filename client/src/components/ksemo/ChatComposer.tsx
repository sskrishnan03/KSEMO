import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { filterLibraryItems } from "@/lib/ksemoInteraction";
import { getFileKind, IMAGE_EXT } from "@/lib/fileKinds";
import {
  ArrowUp,
  Check,
  FileText,
  FileUp,
  Globe,
  Image,
  Library,
  Mic,
  MonitorUp,
  Plus,
  Square,
  X,
} from "lucide-react";
import React, {
  memo,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
} from "react";

export const getLibrarySubmenuClass = (isCentered: boolean) =>
  `absolute left-1/2 -translate-x-1/2 z-50 max-h-[calc(100dvh-${isCentered ? "12rem" : "6rem"})] w-full max-w-3xl rounded-xl border border-border bg-popover p-0 text-popover-foreground shadow-xl`;

export const ChatComposer = memo(function ChatComposer({
  onSend,
  onCancel,
  onVoice,
  onCancelRecording,
  isGenerating,
  isRecording,
  isTranscribing,
  recordingSeconds,
  value,
  onValueChange,
  onAttachment,
  attachmentNotice,
  attachmentNotices,
  onClearAttachment,
  libraryFiles,
  onLibraryFile,
  initialLibraryOpen = false,
  initialToolsOpen = false,
  menuPlacement = "above",
  compactBottomSpacing = false,
  showSafetyNote = true,
  webSearchEnabled = false,
  onToggleWebSearch,
  isCentered = false,
  onTakeScreenshot,
}: {
  onSend: (content: string) => void;
  onCancel: () => void;
  onVoice: () => void;
  onCancelRecording: () => void;
  isGenerating: boolean;
  isRecording: boolean;
  isTranscribing: boolean;
  recordingSeconds: number;
  value: string;
  onValueChange: (value: string) => void;
  onAttachment?: (file: File) => void;
  attachmentNotice?: { name: string; linked: boolean; mimeType?: string; url?: string } | null;
  attachmentNotices?: Array<{ fileId: string; name: string; linked: boolean; mimeType?: string; url?: string }>;
  onClearAttachment?: (fileId?: string) => void;
  libraryFiles?: Array<{
    id: string;
    filename: string;
    mimeType?: string;
    sizeBytes?: number;
    url?: string;
  }>;
  onLibraryFile?: (
    files: Array<{
      id: string;
      filename: string;
      mimeType?: string;
      url?: string;
    }>
  ) => void;
  initialLibraryOpen?: boolean;
  initialToolsOpen?: boolean;
  menuPlacement?: "above" | "below";
  compactBottomSpacing?: boolean;
  showSafetyNote?: boolean;
  webSearchEnabled?: boolean;
  onToggleWebSearch?: () => void;
  isCentered?: boolean;
  onTakeScreenshot?: () => void;
}) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const libraryPanelRef = useRef<HTMLDivElement>(null);
  const [libraryOpen, setLibraryOpen] = useState(initialLibraryOpen);
  const [toolsOpen, setToolsOpen] = useState(initialToolsOpen);
  const [libraryQuery, setLibraryQuery] = useState("");
  const displayedLibraryFiles = useMemo(
    () => filterLibraryItems(libraryFiles, libraryQuery),
    [libraryFiles, libraryQuery]
  );
  const visibleAttachmentNotices =
    attachmentNotices ??
    (attachmentNotice
      ? [{ fileId: attachmentNotice.name, ...attachmentNotice }]
      : []);

  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    const frame = requestAnimationFrame(() => {
      const height = Math.min(textarea.scrollHeight, 180);
      if (height !== textarea.clientHeight) {
        textarea.style.height = "0px";
        textarea.style.height = `${height}px`;
      }
    });
    return () => cancelAnimationFrame(frame);
  }, [value]);

  useEffect(() => {
    if (!libraryOpen) return;
    const closeOutsidePanel = (event: PointerEvent) => {
      if (!libraryPanelRef.current?.contains(event.target as Node))
        setLibraryOpen(false);
    };
    document.addEventListener("pointerdown", closeOutsidePanel);
    return () => document.removeEventListener("pointerdown", closeOutsidePanel);
  }, [libraryOpen]);

  function submit() {
    const content = value.trim();
    if ((!content && !visibleAttachmentNotices.length) || isGenerating) return;
    onSend(content);
    onValueChange("");
  }

  function selectFile(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    event.target.value = "";
    for (const file of files) onAttachment?.(file);
  }

  function handlePaste(event: React.ClipboardEvent<HTMLTextAreaElement>) {
    const items = Array.from(event.clipboardData?.items ?? []);
    const files = items
      .filter(item => item.kind === "file")
      .map(item => item.getAsFile())
      .filter((file): file is File => file !== null);
    if (!files.length) return;
    event.preventDefault();
    for (const file of files) onAttachment?.(file);
  }

  return (
    <div
      className={cn(
        "mx-auto w-full max-w-3xl px-4 pt-3 sm:px-6",
        compactBottomSpacing ? "pb-2 sm:pb-3" : "pb-5 sm:pb-7"
      )}
    >
      <div className="relative rounded-[1.35rem] border border-border/90 bg-[oklch(0.975_0.002_80)] p-2 shadow-[0_8px_32px_rgba(0,0,0,0.08)] transition-shadow focus-within:shadow-[0_12px_40px_rgba(0,0,0,0.12)] dark:bg-[oklch(0.17_0.003_80)] dark:shadow-[0_8px_32px_rgba(0,0,0,0.3)]">
        {libraryOpen && (
          <div
            ref={libraryPanelRef}
            className={cn(
              getLibrarySubmenuClass(isCentered),
              menuPlacement === "below"
                ? "top-[calc(100%+0.5rem)]"
                : "bottom-[calc(100%+0.5rem)]"
            )}
          >
            <LibraryPickerContent
              files={displayedLibraryFiles}
              query={libraryQuery}
              onQueryChange={setLibraryQuery}
              onCancel={() => setLibraryOpen(false)}
              onSelect={files => {
                onLibraryFile?.(files);
                setLibraryOpen(false);
                setLibraryQuery("");
              }}
              listMaxHeightClass={
                menuPlacement === "below"
                  ? isCentered
                    ? "max-h-32"
                    : "max-h-64"
                  : isCentered
                    ? "max-h-16"
                    : "max-h-32"
              }
            />
          </div>
        )}
        <input
          ref={fileInputRef}
          type="file"
          multiple
          onChange={selectFile}
          accept="image/*,.pdf,.txt,.md,.csv,.json,.docx,.xlsx,.pptx,.zip,.webp,.gif"
          className="sr-only"
        />
        {visibleAttachmentNotices.length > 0 && (
          <div className="mx-2 mb-2 mt-1 flex items-center gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {visibleAttachmentNotices.map(item => {
              const isImage =
                (item.url || item.mimeType) &&
                (IMAGE_EXT.test(item.name) ||
                  (item.mimeType ?? "").startsWith("image/"));
              const kind = getFileKind(item.name, item.mimeType);
              return isImage && item.url ? (
                <div
                  key={item.fileId}
                  className="group relative size-14 shrink-0 overflow-hidden rounded-xl border border-border shadow-sm"
                  title={item.name}
                >
                  <img
                    src={item.url}
                    alt={item.name}
                    className="h-full w-full object-cover"
                  />
                  {onClearAttachment && (
                    <button
                      onClick={() => onClearAttachment(item.fileId)}
                      className="absolute right-1 top-1 flex size-6 items-center justify-center rounded-full border border-border bg-background/80 text-foreground opacity-0 shadow-md backdrop-blur outline-none transition-opacity hover:bg-background focus-visible:ring-0 group-hover:opacity-100"
                      aria-label="Remove screenshot"
                    >
                      <X className="size-3.5" />
                    </button>
                  )}
                </div>
              ) : (
                <div
                  key={item.fileId}
                  className="group flex h-14 shrink-0 items-center gap-2.5 rounded-2xl border border-border bg-muted/50 py-2 pl-2 pr-3 shadow-sm transition-colors hover:bg-muted/80"
                  title={`${item.name} · ${
                    item.linked ? "Ready in this chat" : "Saved to Library"
                  }`}
                >
                  <span
                    className={`flex size-10 shrink-0 items-center justify-center rounded-xl ${kind.colorClass}`}
                  >
                    <kind.icon className="size-5" />
                  </span>
                  <span className="flex min-w-0 flex-col">
                    <span className="max-w-[140px] truncate text-xs font-semibold text-foreground">
                      {item.name}
                    </span>
                    <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                      {kind.label}
                      {item.linked ? " · linked" : " · library"}
                    </span>
                  </span>
                  {onClearAttachment && (
                    <button
                      onClick={() => onClearAttachment(item.fileId)}
                      className="ml-1 flex size-6 shrink-0 items-center justify-center rounded-full text-muted-foreground opacity-0 outline-none transition-opacity hover:bg-muted hover:text-foreground focus-visible:ring-0 group-hover:opacity-100"
                      aria-label="Remove screenshot"
                    >
                      <X className="size-3.5" />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
        <Textarea
          ref={textareaRef}
          value={value}
          onChange={event => onValueChange(event.target.value)}
          onPaste={handlePaste}
          onKeyDown={event => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              submit();
            }
          }}
          disabled={isGenerating || isRecording || isTranscribing}
          placeholder={
            isRecording
              ? "Listening…"
              : isTranscribing
                ? "Transcribing your recording…"
                : "Ask KSEMO anything…"
          }
          className="min-h-12 max-h-44 resize-none border-0 bg-transparent px-3 pt-3 text-[15px] leading-6 shadow-none focus-visible:ring-0"
          aria-label="Message KSEMO"
        />
        <div className="flex min-h-10 items-center justify-between px-1 pt-1">
          {isRecording ? (
            <div className="flex items-center gap-1.5">
              <div className="flex h-9 items-center gap-2 rounded-full border border-border bg-muted px-2">
                <span
                  className="flex items-center gap-0.5 px-1"
                  aria-label={`Recording ${recordingSeconds} seconds`}
                >
                  {[4, 8, 12, 7, 15, 9, 5, 11].map((height, index) => (
                    <span
                      key={index}
                      className="w-px animate-pulse rounded-full bg-muted-foreground"
                      style={{ height, animationDelay: `${index * 70}ms` }}
                    />
                  ))}
                </span>
                <span className="text-[11px] font-medium tabular-nums text-muted-foreground">
                  {String(Math.floor(recordingSeconds / 60)).padStart(2, "0")}:
                  {String(recordingSeconds % 60).padStart(2, "0")}
                </span>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={onCancelRecording}
                      className="size-7 rounded-full outline-none focus-visible:ring-0 focus-visible:border-transparent"
                      aria-label="Cancel recording"
                    >
                      <X className="size-3.5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">Discard recording</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      size="icon"
                      onClick={onVoice}
                      className="size-7 rounded-full bg-foreground text-background hover:bg-foreground/90"
                      aria-label="Finish recording"
                    >
                      <Check className="size-3.5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">
                    Transcribe recording
                  </TooltipContent>
                </Tooltip>
              </div>
              {webSearchEnabled && (
                <div className="flex h-9 items-center gap-1.5 rounded-xl border border-border bg-muted pl-2.5 pr-1.5">
                  <Globe className="size-3.5 text-muted-foreground" />
                  <span className="text-xs font-medium text-foreground">
                    Web search
                  </span>
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-1">
              <DropdownMenu
              open={toolsOpen && !libraryOpen}
              onOpenChange={setToolsOpen}
            >
              <Tooltip>
                <TooltipTrigger asChild>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-9 rounded-xl text-muted-foreground hover:bg-muted hover:text-foreground"
                      aria-label="Open composer tools"
                    >
                      <Plus className="size-4" />
                    </Button>
                  </DropdownMenuTrigger>
                </TooltipTrigger>
                <TooltipContent side="bottom">
                  Add a file or browse Library
                </TooltipContent>
              </Tooltip>
              <DropdownMenuContent
                align="start"
                side={menuPlacement === "below" ? "bottom" : "top"}
                sideOffset={10}
                collisionPadding={12}
                className="w-56 rounded-xl"
              >
                <DropdownMenuItem onClick={() => fileInputRef.current?.click()}>
                  <FileUp className="mr-2 size-4" /> Upload files
                </DropdownMenuItem>
                {onTakeScreenshot && (
                  <DropdownMenuItem
                    onSelect={() => {
                      setToolsOpen(false);
                      onTakeScreenshot();
                    }}
                  >
                    <MonitorUp className="mr-2 size-4" />
                    Take Screenshot
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem
                  onSelect={() => {
                    setLibraryOpen(true);
                    setToolsOpen(false);
                  }}
                >
                  <Library className="mr-2 size-4" />
                  Browse Library
                </DropdownMenuItem>
                {onToggleWebSearch && (
                  <DropdownMenuItem
                    onSelect={() => {
                      onToggleWebSearch();
                      setToolsOpen(false);
                    }}
                  >
                    <Globe className="mr-2 size-4" />
                    Web search
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
            {!isGenerating && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={onVoice}
                    disabled={isTranscribing}
                    className="size-9 rounded-xl text-muted-foreground hover:bg-muted hover:text-foreground"
                    aria-label="Use voice input"
                  >
                    <Mic className="size-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom">
                  Record a voice message
                </TooltipContent>
              </Tooltip>
            )}
            {webSearchEnabled && (
              <div className="flex h-9 items-center gap-1.5 rounded-xl border border-border bg-muted pl-2.5 pr-1.5">
                <Globe className="size-3.5 text-muted-foreground" />
                <span className="text-xs font-medium text-foreground">
                  Web search
                </span>
                {onToggleWebSearch && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={onToggleWebSearch}
                        className="size-6 rounded-lg text-muted-foreground outline-none hover:bg-background hover:text-foreground focus-visible:ring-0 focus-visible:border-transparent"
                        aria-label="Cancel web search"
                      >
                        <X className="size-3" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="bottom">
                      Cancel web search
                    </TooltipContent>
                  </Tooltip>
                )}
              </div>
            )}
          </div>
          )}
          <div className="ml-auto flex items-center">
            {isGenerating ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    onClick={onCancel}
                    size="icon"
                    className="size-9 rounded-xl bg-foreground text-background hover:bg-foreground/90"
                    aria-label="Stop generating"
                  >
                    <Square className="size-3.5 fill-current" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom">Stop generating</TooltipContent>
              </Tooltip>
            ) : (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    onClick={submit}
                    disabled={!value.trim() && !visibleAttachmentNotices.length || isRecording || isTranscribing}
                    size="icon"
                    className="size-9 rounded-xl bg-foreground text-background hover:bg-foreground/90 disabled:bg-muted disabled:text-muted-foreground"
                    aria-label="Send message"
                  >
                    <ArrowUp className="size-[18px]" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom">Send message</TooltipContent>
              </Tooltip>
            )}
          </div>
        </div>
      </div>
      {showSafetyNote && (
        <p className="mt-2 text-center text-[11px] text-muted-foreground">
          KSEMO can make mistakes. Verify important details.
        </p>
      )}
    </div>
  );
});

export function LibraryPickerContent({
  files,
  query,
  onQueryChange,
  onSelect,
  onCancel,
  listMaxHeightClass = "max-h-32",
}: {
  files: Array<{
    id: string;
    filename: string;
    mimeType?: string;
    sizeBytes?: number;
    url?: string;
  }>;
  query: string;
  onQueryChange: (value: string) => void;
  onSelect: (
    files: Array<{
      id: string;
      filename: string;
      mimeType?: string;
      url?: string;
    }>
  ) => void;
  onCancel?: () => void;
  listMaxHeightClass?: string;
}) {
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());

  const toggleFileSelection = (fileId: string) => {
    setSelectedFiles(prev => {
      const newSet = new Set(prev);
      if (newSet.has(fileId)) {
        newSet.delete(fileId);
      } else {
        newSet.add(fileId);
      }
      return newSet;
    });
  };

  const handleConfirm = () => {
    const selected = files.filter(file => selectedFiles.has(file.id));
    if (selected.length > 0) {
      onSelect(selected);
      setSelectedFiles(new Set());
    }
  };

  return (
    <div className="space-y-2 p-2">
      <div className="flex items-center gap-2 px-1">
        <Library className="size-3.5 text-muted-foreground" />
        <p className="flex-1 text-sm font-medium">Browse Library</p>
        {onCancel && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onCancel}
            className="h-6 rounded-lg px-2 text-[11px]"
          >
            Cancel
          </Button>
        )}
      </div>
      <div className="flex items-center gap-2">
        <Input
          autoFocus
          value={query}
          onChange={event => onQueryChange(event.target.value)}
          placeholder="Search your files and images"
          className="h-8 flex-1 rounded-lg bg-background text-sm"
        />
        {selectedFiles.size > 0 && (
          <Button
            onClick={handleConfirm}
            className="h-8 rounded-xl bg-foreground text-background hover:bg-foreground/90 text-sm px-4"
            size="sm"
          >
            Add to chat
          </Button>
        )}
      </div>
      <div className={cn(listMaxHeightClass, "space-y-1 overflow-y-auto pr-1")}>
        {files.length ? (
          files.map(file => (
            <button
              key={file.id}
              onClick={() => toggleFileSelection(file.id)}
              className={cn(
                "flex w-full items-center gap-2 rounded-lg p-2 text-left transition-colors hover:bg-muted/50",
                selectedFiles.has(file.id) ? "bg-primary/5" : ""
              )}
            >
              <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-muted/50 text-muted-foreground">
                {file.mimeType?.startsWith("image/") ? (
                  <Image className="size-3" />
                ) : (
                  <FileText className="size-3" />
                )}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-xs font-medium">
                  {file.filename}
                </span>
                <span className="mt-0.5 block text-[10px] text-muted-foreground">
                  {file.mimeType?.startsWith("image/") ? "Image" : "File"}
                  {file.sizeBytes
                    ? ` · ${Math.max(1, Math.round(file.sizeBytes / 1024))} KB`
                    : ""}
                </span>
              </span>
              <button
                onClick={e => {
                  e.stopPropagation();
                  toggleFileSelection(file.id);
                }}
                className={cn(
                  "flex size-6 shrink-0 items-center justify-center rounded-md transition-colors",
                  selectedFiles.has(file.id)
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted/50 text-muted-foreground hover:bg-muted"
                )}
              >
                {selectedFiles.has(file.id) ? (
                  <Check className="size-3.5" />
                ) : (
                  <Plus className="size-3.5" />
                )}
              </button>
            </button>
          ))
        ) : (
          <p className="px-3 py-4 text-center text-xs text-muted-foreground">
            {query
              ? "No Library items match that search."
              : "Your Library is empty."}
          </p>
        )}
      </div>
    </div>
  );
}
