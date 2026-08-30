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
  FileUp,
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
  attachmentNotice?: {
    name: string;
    linked: boolean;
    mimeType?: string;
    url?: string;
  } | null;
  attachmentNotices?: Array<{
    fileId: string;
    name: string;
    linked: boolean;
    mimeType?: string;
    url?: string;
  }>;
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
      // Reset to auto first to allow shrinking
      textarea.style.height = "auto";
      // Then set to actual scrollHeight with max constraint
      const height = Math.min(textarea.scrollHeight, 128);
      // Ensure minimum height of 40px for consistent layout
      const finalHeight = Math.max(height, 40);
      textarea.style.height = `${finalHeight}px`;
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
      <div className="relative rounded-[1.35rem] border border-[#242424] bg-[#0B0B0B] p-2 shadow-[0_8px_32px_rgba(0,0,0,0.08)] transition-shadow focus-within:shadow-[0_12px_40px_rgba(0,0,0,0.12)]">
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
          <div className="mx-1 mb-1 flex items-center gap-2 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {visibleAttachmentNotices.map(item => {
              const isImage =
                (item.url || item.mimeType) &&
                (IMAGE_EXT.test(item.name) ||
                  (item.mimeType ?? "").startsWith("image/"));
              const kind = getFileKind(item.name, item.mimeType);
              return isImage && item.url ? (
                <div
                  key={item.fileId}
                  className="group relative size-10 shrink-0 overflow-hidden rounded-lg border border-border shadow-sm"
                >
                  <img
                    src={item.url}
                    alt={item.name}
                    className="h-full w-full object-cover"
                  />
                  {onClearAttachment && (
                    <button
                      onClick={() => onClearAttachment(item.fileId)}
                      className="absolute right-0.5 top-0.5 flex size-4 items-center justify-center rounded-full border border-border bg-background/80 text-foreground opacity-0 shadow-md backdrop-blur outline-none transition-opacity hover:bg-[#0A0A0A] focus-visible:ring-0 group-hover:opacity-100"
                      aria-label="Remove screenshot"
                    >
                      <X className="size-2.5" />
                    </button>
                  )}
                </div>
              ) : (
                <div
                  key={item.fileId}
                  className="group flex h-10 shrink-0 items-center gap-2 rounded-lg border border-border bg-transparent py-1.5 px-2 shadow-sm transition-colors hover:bg-[#0A0A0A]"
                >
                  <span
                    className={`flex size-6 shrink-0 items-center justify-center rounded-lg ${kind.colorClass}`}
                  >
                    <kind.icon className="size-3" />
                  </span>
                  <span className="flex min-w-0 flex-col">
                    <span className="max-w-[120px] truncate text-[10px] font-semibold text-foreground">
                      {item.name}
                    </span>
                    <span className="text-[9px] font-medium uppercase tracking-wide text-muted-foreground">
                      {kind.label}
                      {item.linked ? " · linked" : " · library"}
                    </span>
                  </span>
                  {onClearAttachment && (
                    <button
                      onClick={() => onClearAttachment(item.fileId)}
                      className="ml-1 flex size-4 shrink-0 items-center justify-center rounded-full text-muted-foreground opacity-0 outline-none transition-opacity hover:bg-[#0A0A0A] hover:text-foreground focus-visible:ring-0 group-hover:opacity-100"
                      aria-label="Remove screenshot"
                    >
                      <X className="size-2.5" />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
        <div className="flex items-end gap-2 bg-transparent">
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
            className="min-h-10 max-h-32 resize-none border-0 !bg-transparent px-2 py-2 text-[14px] leading-5 shadow-none focus-visible:ring-0 focus-visible:ring-0 placeholder:text-muted-foreground dark:!bg-transparent flex-1"
            aria-label="Message KSEMO"
          />
          <div className="flex items-center gap-1 bg-transparent">
            {isRecording ? (
              <div className="flex items-center gap-1">
                <div className="flex h-7 items-center gap-1.5 rounded-full border border-border bg-transparent px-2">
                  <span
                    className="flex items-center gap-0.5 px-0.5"
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
                  <span className="text-[10px] font-medium tabular-nums text-muted-foreground">
                    {String(Math.floor(recordingSeconds / 60)).padStart(2, "0")}:
                    {String(recordingSeconds % 60).padStart(2, "0")}
                  </span>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={onCancelRecording}
                        className="size-6 rounded-full outline-none focus-visible:ring-0 focus-visible:border-transparent"
                        aria-label="Cancel recording"
                      >
                        <X className="size-3" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="bottom">
                      Discard recording
                    </TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        size="icon"
                        onClick={onVoice}
                        className="size-6 rounded-full bg-foreground text-background hover:bg-[#0A0A0A]"
                        aria-label="Finish recording"
                      >
                        <Check className="size-3" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="bottom">
                      Transcribe recording
                    </TooltipContent>
                  </Tooltip>
                </div>
              </div>
            ) : (
              <>
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
                          className="size-8 rounded-lg text-muted-foreground hover:bg-[#0A0A0A] hover:text-foreground"
                          aria-label="Open composer tools"
                        >
                          <Plus className="size-3.5" />
                        </Button>
                      </DropdownMenuTrigger>
                    </TooltipTrigger>
                    <TooltipContent side="bottom">
                      Add a file or browse Library
                    </TooltipContent>
                  </DropdownMenu>
                  <DropdownMenuContent
                    align="start"
                    side={menuPlacement === "bottom" ? "bottom" : "top"}
                    sideOffset={10}
                    collisionPadding={12}
                    className="w-56 rounded-xl"
                  >
                    <DropdownMenuItem
                      onClick={() => fileInputRef.current?.click()}
                    >
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
                        className="size-8 rounded-lg text-muted-foreground hover:bg-[#0A0A0A] hover:text-foreground"
                        aria-label="Use voice input"
                      >
                        <Mic className="size-3.5" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="bottom">
                      Record a voice message
                    </TooltipContent>
                  </Tooltip>
                )}
              </>
            )}
            {isGenerating ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    onClick={onCancel}
                    size="icon"
                    className="size-8 rounded-lg bg-foreground text-background hover:bg-[#0A0A0A]"
                    aria-label="Stop generating"
                  >
                    <Square className="size-3 fill-current" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom">Stop generating</TooltipContent>
              </Tooltip>
            ) : (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    onClick={submit}
                    disabled={
                      (!value.trim() && !visibleAttachmentNotices.length) ||
                      isRecording ||
                      isTranscribing
                    }
                    size="icon"
                    className="size-8 rounded-lg bg-foreground text-background hover:bg-[#0A0A0A] disabled:bg-muted disabled:text-muted-foreground"
                    aria-label="Send message"
                  >
                    <ArrowUp className="size-[16px]" />
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
            className="h-8 rounded-xl bg-foreground text-background hover:bg-[#0A0A0A] text-sm px-4"
            size="sm"
          >
            Add to chat
          </Button>
        )}
      </div>
      <div className={cn("overflow-y-auto", listMaxHeightClass)}>
        {files.length === 0 ? (
          <div className="py-8 text-center text-sm text-muted-foreground">
            {query ? "No files match your search" : "No files in library"}
          </div>
        ) : (
          <div className="space-y-1">
            {files.map(file => {
              const isImage =
                (file.url || file.mimeType) &&
                (IMAGE_EXT.test(file.filename) ||
                  (file.mimeType ?? "").startsWith("image/"));
              const kind = getFileKind(file.filename, file.mimeType);
              const isSelected = selectedFiles.has(file.id);
              return (
                <button
                  key={file.id}
                  onClick={() => toggleFileSelection(file.id)}
                  className={cn(
                    "flex w-full items-center gap-2 rounded-lg p-2 text-left transition-colors",
                    isSelected
                      ? "bg-muted/50 hover:bg-[#0A0A0A]"
                      : "hover:bg-[#0A0A0A]"
                  )}
                >
                  {isImage && file.url ? (
                    <img
                      src={file.url}
                      alt={file.filename}
                      className="size-10 shrink-0 rounded-md object-cover"
                    />
                  ) : (
                    <span
                      className={`flex size-10 shrink-0 items-center justify-center rounded-md ${kind.colorClass}`}
                    >
                      <kind.icon className="size-5" />
                    </span>
                  )}
                  <div className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate text-sm font-medium text-foreground">
                      {file.filename}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {kind.label}
                      {file.sizeBytes && (
                        <span className="ml-1">
                          ({(file.sizeBytes / 1024).toFixed(1)} KB)
                        </span>
                      )}
                    </span>
                  </div>
                  {isSelected && (
                    <div className="flex size-5 items-center justify-center rounded-full bg-foreground text-background">
                      <Check className="size-3" />
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
