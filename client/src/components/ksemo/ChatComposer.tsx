import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
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
import { Input } from "@/components/ui/input";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { filterLibraryItems } from "@/lib/ksemoInteraction";
import { getFileKind, IMAGE_EXT } from "@/lib/fileKinds";
import {
  CAPABILITY_SECTIONS,
  getCapabilityOption,
} from "@/lib/capabilities";
import { type CapabilityMode } from "@shared/research";
import {
  ArrowUp,
  AudioLines,
  Check,
  ChevronDown,
  Camera,
  FilePlus2,
  Library,
  Loader2,
  Mic,
  Paperclip,
  Plus,
  Sparkles,
  Square,
  Volume2,
  VolumeX,
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
import { SourceList } from "./SourceList";
import { FileResultCard } from "./FileResultCard";
import { ResearchProgress } from "./ResearchProgress";
import { parseContentWithSources } from "@shared/research";

export const getLibrarySubmenuClass = (isCentered: boolean) =>
  `absolute left-1/2 -translate-x-1/2 z-50 max-h-[calc(100dvh-${isCentered ? "12rem" : "6rem"})] w-full max-w-3xl rounded-xl border border-border bg-popover p-0 text-popover-foreground shadow-xl`;

const CHAT_PLACEHOLDER = "Ask KSEMO anything you need...";

const VOICE_PLACEHOLDER =
  "Ask me out loud or type your question here...";

const COMPACT_INPUT_MAX_HEIGHT = 112;
const EXPANDED_INPUT_MAX_HEIGHT = 320;
const MIN_INPUT_HEIGHT = 40;

const MENU_TITLE = "Create, Search & Research";

export const ChatComposer = memo(function ChatComposer({
  onSend,
  onCancel,
  onVoice,
  onVoiceChat,
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
  isCentered = false,
  onTakeScreenshot,
  activeMode,
  onModeChange,
  hideVoiceInput = false,
  voiceChatActive = false,
  voiceChatMuted = false,
  onVoiceChatMicToggle,
  onVoiceChatEnd,
  voices,
  selectedVoiceName,
  onVoiceChatVoiceSelect,
}: {
  onSend: (content: string) => void;
  onCancel: () => void;
  onVoice: () => void;
  onVoiceChat?: () => void;
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
  isCentered?: boolean;
  onTakeScreenshot?: () => void;
  activeMode?: CapabilityMode;
  onModeChange?: (mode: CapabilityMode | null) => void;
  hideVoiceInput?: boolean;
  voiceChatActive?: boolean;
  voiceChatMuted?: boolean;
  onVoiceChatMicToggle?: () => void;
  onVoiceChatEnd?: () => void;
  voices?: Array<{ name: string; lang: string; default: boolean }>;
  selectedVoiceName?: string | null;
  onVoiceChatVoiceSelect?: (name: string) => void;
}) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const libraryPanelRef = useRef<HTMLDivElement>(null);
  const [libraryOpen, setLibraryOpen] = useState(initialLibraryOpen);
  const [toolsOpen, setToolsOpen] = useState(initialToolsOpen);
  const [libraryQuery, setLibraryQuery] = useState("");
  const [isDragActive, setIsDragActive] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [canExpand, setCanExpand] = useState(false);
  const dragCounterRef = useRef(0);
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
      // Then size to actual scrollHeight, capped by the current mode
      const cap = expanded
        ? EXPANDED_INPUT_MAX_HEIGHT
        : COMPACT_INPUT_MAX_HEIGHT;
      const height = Math.max(
        Math.min(textarea.scrollHeight, cap),
        MIN_INPUT_HEIGHT
      );
      textarea.style.height = `${height}px`;
      setCanExpand(textarea.scrollHeight > COMPACT_INPUT_MAX_HEIGHT);
    });
    return () => cancelAnimationFrame(frame);
  }, [value, expanded]);

  useEffect(() => {
    if (expanded && !canExpand) setExpanded(false);
  }, [expanded, canExpand]);

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

  useEffect(() => {
    const dragHasFiles = (e: DragEvent) =>
      Array.from(e.dataTransfer?.types ?? []).includes("Files");
    const onDragEnter = (e: DragEvent) => {
      if (!dragHasFiles(e)) return;
      e.preventDefault();
      dragCounterRef.current += 1;
      setIsDragActive(true);
    };
    const onDragOver = (e: DragEvent) => {
      if (!dragHasFiles(e)) return;
      e.preventDefault();
      if (e.dataTransfer) e.dataTransfer.dropEffect = "copy";
    };
    const onDragLeave = (e: DragEvent) => {
      if (!dragHasFiles(e)) return;
      dragCounterRef.current -= 1;
      if (dragCounterRef.current <= 0) {
        dragCounterRef.current = 0;
        setIsDragActive(false);
      }
    };
    const onDrop = (e: DragEvent) => {
      if (!dragHasFiles(e)) return;
      e.preventDefault();
      dragCounterRef.current = 0;
      setIsDragActive(false);
      const files = Array.from(e.dataTransfer?.files ?? []);
      e.dataTransfer?.clearData?.();
      for (const file of files) onAttachment?.(file);
    };
    document.addEventListener("dragenter", onDragEnter);
    document.addEventListener("dragover", onDragOver);
    document.addEventListener("dragleave", onDragLeave);
    document.addEventListener("drop", onDrop);
    return () => {
      document.removeEventListener("dragenter", onDragEnter);
      document.removeEventListener("dragover", onDragOver);
      document.removeEventListener("dragleave", onDragLeave);
      document.removeEventListener("drop", onDrop);
    };
  }, [onAttachment]);

  return (
    <div
      className={cn(
        "mx-auto w-full max-w-3xl px-4 pt-2",
        compactBottomSpacing ? "pb-5" : "pb-4"
      )}
    >
      <div className="relative rounded-2xl p-1.5 shadow-sm transition-shadow focus-within:shadow-md" style={{ backgroundColor: "#20201F", border: "1px solid #353534" }}>
        {isDragActive && (
          <div className="pointer-events-none fixed inset-0 z-[100] flex items-center justify-center bg-card/80 backdrop-blur-sm">
            <div className="rounded-2xl border-2 border-dashed border-primary/60 bg-card px-10 py-8 shadow-xl">
              <p className="text-sm font-medium text-foreground">
                Drop to attach files or images
              </p>
            </div>
          </div>
        )}
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
          accept="image/*,.pdf,.txt,.json,.docx,.xlsx,.pptx,.zip,.webp,.gif"
          className="sr-only"
        />
        {visibleAttachmentNotices.length > 0 && (
          <div className="mx-1 mb-0.5 flex items-center gap-2 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {visibleAttachmentNotices.map(item => {
              const isImage =
                (item.url || item.mimeType) &&
                (IMAGE_EXT.test(item.name) ||
                  (item.mimeType ?? "").startsWith("image/"));
              const kind = getFileKind(item.name, item.mimeType);
              return isImage && item.url ? (
                <div
                  key={item.fileId}
                  className="group relative size-16 shrink-0 overflow-hidden rounded-xl border border-border shadow-sm"
                >
                  <img
                    src={item.url}
                    alt={item.name}
                    className="h-full w-full object-cover"
                  />
                  {onClearAttachment && (
                    <button
                      onClick={() => onClearAttachment(item.fileId)}
                      className="absolute right-1 top-1 flex size-5 items-center justify-center rounded-full border border-border bg-card/90 text-foreground opacity-0 shadow-md backdrop-blur outline-none transition-opacity hover:bg-muted focus-visible:ring-0 group-hover:opacity-100"
                      aria-label="Remove screenshot"
                    >
                      <X className="size-3" />
                    </button>
                  )}
                </div>
              ) : (
                <div
                  key={item.fileId}
                  className="group flex h-16 shrink-0 items-center gap-3 rounded-xl border border-border bg-muted py-2 pl-2 pr-3 shadow-sm transition-colors hover:bg-accent"
                >
                  <span
                    className={`flex size-10 shrink-0 items-center justify-center rounded-lg ${kind.colorClass}`}
                  >
                    <kind.icon className="size-5" />
                  </span>
                  <span className="flex min-w-0 flex-col">
                    <span className="max-w-[150px] truncate text-[13px] font-semibold text-foreground">
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
                      className="ml-1.5 flex size-6 shrink-0 items-center justify-center rounded-full text-muted-foreground opacity-0 outline-none transition-all hover:bg-accent hover:text-foreground focus-visible:ring-0 group-hover:opacity-100"
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


        {/* Main Composer Content */}
        <div className="flex flex-col">
          {/* Text Input Area */}
          <div className="relative flex flex-1">
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
              className={cn(
                "min-h-10 resize-none border-0 !bg-transparent pl-2.5 py-1 text-[15px] leading-6 md:text-[15px] shadow-none focus-visible:ring-0 dark:!bg-transparent flex-1 ![field-sizing:manual]",
                expanded ? "max-h-80" : "max-h-28",
                canExpand ? "pr-10" : "pr-1"
              )}
              aria-label="Message KSEMO"
            />
            {canExpand && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    tabIndex={-1}
                    onClick={() => setExpanded(current => !current)}
                    className="absolute right-1.5 top-1.5 z-10 flex size-8 items-center justify-center rounded-full bg-transparent text-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:ring-0 focus-visible:outline-none"
                    aria-label={expanded ? "Collapse input" : "Expand input"}
                    aria-pressed={expanded}
                  >
                    <ChevronDown
                      className={cn(
                        "size-5 transition-transform duration-200",
                        expanded ? "rotate-180" : ""
                      )}
                    />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="bottom">
                  {expanded ? "Collapse input" : "Expand input"}
                </TooltipContent>
              </Tooltip>
            )}
            {value.length === 0 && (
              <span
                key={
                  voiceChatActive
                    ? "voice"
                    : activeMode && activeMode !== "chat"
                      ? activeMode
                      : "chat"
                }
                className="pointer-events-none absolute left-2.5 top-1 text-[15px] leading-6 text-muted-foreground animate-[ksemo-placeholder-rise_800ms_ease-out]"
                aria-hidden="true"
              >
                {voiceChatActive
                  ? VOICE_PLACEHOLDER
                  : activeMode && activeMode !== "chat"
                    ? getCapabilityOption(activeMode).placeholder
                    : CHAT_PLACEHOLDER}
              </span>
            )}
          </div>

          {/* Bottom Control Row */}
          <div className="flex items-center justify-between pt-1">
            {/* Left Side Controls */}
            <div className="flex items-center gap-1.5">
              {/* Plus Button */}
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
                        className="size-10 rounded-full bg-transparent text-foreground hover:bg-accent hover:text-foreground transition-colors"
                        aria-label="Open composer tools"
                      >
                        <Plus className="size-5" />
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
sideOffset={8}
                  collisionPadding={12}
                  className="ksemo-thin-scroll w-56 rounded-xl max-h-[16rem] overflow-y-auto"
                >
                  <DropdownMenuItem onClick={() => fileInputRef.current?.click()}>
                    <Paperclip className="mr-2 size-4" /> Upload files
                  </DropdownMenuItem>
                  {onTakeScreenshot && (
                    <DropdownMenuItem
                      onSelect={() => {
                        setToolsOpen(false);
                        onTakeScreenshot();
                      }}
                    >
                      <Camera className="mr-2 size-4" />
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
                  {!voiceChatActive && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuSub>
                        <DropdownMenuSubTrigger>
                          <FilePlus2 className="mr-2 size-4" />
                          Create Files
                        </DropdownMenuSubTrigger>
                        <DropdownMenuSubContent
                          sideOffset={6}
                          alignOffset={-56}
                          className="w-48 max-h-[14rem] overflow-y-auto"
                          style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
                        >
                          {CAPABILITY_SECTIONS.find(s => s.id === "create")?.options.map(option => {
                            const Icon = option.icon;
                            const isActive = activeMode === option.mode;
                            return (
                              <DropdownMenuItem
                                key={option.mode}
                                onSelect={() => {
                                  if (isActive) {
                                    onModeChange?.(null);
                                  } else {
                                    onModeChange?.(option.mode);
                                  }
                                  setToolsOpen(false);
                                }}
                              >
                                <Icon className={`mr-2 size-4 ${option.iconColor}`} />
                                {option.title}
                                {isActive && (
                                  <Check className="ml-auto size-4 text-foreground" />
                                )}
                              </DropdownMenuItem>
                            );
                          })}
                        </DropdownMenuSubContent>
                      </DropdownMenuSub>
                      <DropdownMenuSub>
                        <DropdownMenuSubTrigger>
                          <Sparkles className="mr-2 size-4" />
                          Search & Research
                        </DropdownMenuSubTrigger>
                        <DropdownMenuSubContent
                          sideOffset={6}
                          alignOffset={-56}
                          className="w-48 max-h-[14rem] overflow-y-auto"
                          style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
                        >
                          {CAPABILITY_SECTIONS.find(s => s.id === "research")?.options.map(option => {
                            const Icon = option.icon;
                            const isActive = activeMode === option.mode;
                            return (
                              <DropdownMenuItem
                                key={option.mode}
                                onSelect={() => {
                                  if (isActive) {
                                    onModeChange?.(null);
                                  } else {
                                    onModeChange?.(option.mode);
                                  }
                                  setToolsOpen(false);
                                }}
                              >
                                <Icon className={`mr-2 size-4 ${option.iconColor}`} />
                                {option.title}
                                {isActive && (
                                  <Check className="ml-auto size-4 text-foreground" />
                                )}
                              </DropdownMenuItem>
                            );
                          })}
                        </DropdownMenuSubContent>
                      </DropdownMenuSub>
                    </>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
              {/* Active mode indicator (after the + button) */}
              {activeMode && activeMode !== "chat" && (
                <span className="flex items-center gap-1.5 rounded-full border border-border bg-muted py-1 pl-1.5 pr-1 text-xs font-medium text-foreground">
                  {(() => {
                    const option = getCapabilityOption(activeMode);
                    const Icon = option.icon;
                    return (
                      <>
                        <Icon className={`size-4 shrink-0 ${option.iconColor}`} />
                        <span className="whitespace-nowrap">
                          {option.chipLabel}
                        </span>
                      </>
                    );
                  })()}
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        type="button"
                        onClick={() => onModeChange?.(null)}
                        className="flex size-5 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                        aria-label="Cancel active mode"
                      >
                        <X className="size-3" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="bottom">Cancel</TooltipContent>
                  </Tooltip>
                </span>
              )}
            </div>

            {/* Right Side Controls */}
            <div className="flex items-center gap-1.5">
              {voiceChatActive ? (
                <VoiceChatInlineControls
                  muted={voiceChatMuted ?? false}
                  onMicToggle={onVoiceChatMicToggle ?? (() => undefined)}
                  onEnd={onVoiceChatEnd ?? (() => undefined)}
                  voices={voices}
                  selectedVoiceName={selectedVoiceName}
                  onVoiceSelect={onVoiceChatVoiceSelect}
                />
              ) : (
                <>
              {/* Recording / Transcribing / Mic — opens in place of the mic when clicked */}
              {!hideVoiceInput && (
                <>
                  {isRecording ? (
                <div className="flex items-center gap-2 overflow-hidden rounded-full border border-border bg-muted px-3 py-1.5 shadow-sm">
                  <div className="flex items-end gap-0.5 overflow-hidden">
                    {[4, 8, 12, 7, 15, 9, 5, 11].map((height, index) => (
                      <span
                        key={index}
                        className="w-1 animate-pulse rounded-full bg-muted-foreground/80"
                        style={{ height, animationDelay: `${index * 70}ms` }}
                      />
                    ))}
                  </div>
                  <span className="text-[12px] font-medium tabular-nums text-foreground">
                    {String(Math.floor(recordingSeconds / 60)).padStart(2, "0")}:
                    {String(recordingSeconds % 60).padStart(2, "0")}
                  </span>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={onCancelRecording}
                        className="size-6 rounded-full text-foreground/80 hover:bg-accent hover:text-foreground transition-colors"
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
                        className="size-6 rounded-full bg-foreground text-background hover:bg-foreground/90 transition-colors"
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
              ) : isTranscribing ? (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      disabled
                      className="size-10 rounded-full bg-transparent text-muted-foreground transition-colors"
                      aria-label="Converting speech to text"
                    >
                      <Loader2 className="size-4.5 animate-spin" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">
                    Converting speech to text…
                  </TooltipContent>
                </Tooltip>
              ) : (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={onVoice}
                      disabled={isTranscribing}
                      className="size-10 rounded-full bg-transparent text-foreground hover:bg-accent hover:text-foreground transition-colors"
                      aria-label="Use voice input"
                    >
                      <Mic className="size-4.5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">
                    Record a voice message
                  </TooltipContent>
                </Tooltip>
                )}
                </>
              )}
              {/* Send / Voice / Stop Button */}
              {isGenerating ? (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      onClick={onCancel}
                      size="icon"
                      className="size-10 rounded-full bg-foreground text-background hover:bg-foreground/90 transition-colors"
                      aria-label="Stop generating"
                    >
                      <Square className="size-4 fill-current" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">Stop generating</TooltipContent>
                </Tooltip>
              ) : !value.trim() && !visibleAttachmentNotices.length && !isRecording && !isTranscribing ? (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      onClick={onVoiceChat}
                      disabled={isRecording || isTranscribing}
                      size="icon"
                      className="size-10 rounded-full bg-muted text-foreground hover:bg-[#333333] transition-colors"
                      aria-label="Start voice chat"
                    >
                      <span className="flex items-center justify-center gap-[3px]">
                        {[0, 1, 2, 3].map(i => (
                          <span
                            key={i}
                            className="ksemo-voice-bar w-[3px] rounded-full bg-foreground/70"
                            style={{
                              height: 4,
                              animation: `ksemo-voice-bar 1s ease-in-out ${i * 0.15}s infinite`,
                            }}
                          />
                        ))}
                      </span>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">Start voice chat</TooltipContent>
                </Tooltip>
              ) : !isRecording && !isTranscribing ? (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      onClick={submit}
                      disabled={isRecording || isTranscribing}
                      size="icon"
                      className="size-10 rounded-full bg-foreground text-background hover:bg-foreground/90 disabled:bg-muted disabled:text-muted-foreground transition-colors"
                      aria-label="Send message"
                    >
                      <ArrowUp className="size-4.5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">Send message</TooltipContent>
                </Tooltip>
              ) : null}
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
});

function VoiceChatInlineControls({
  muted,
  onMicToggle,
  onEnd,
  voices,
  selectedVoiceName,
  onVoiceSelect,
}: {
  muted: boolean;
  onMicToggle: () => void;
  onEnd: () => void;
  voices?: Array<{ name: string; lang: string; default: boolean }>;
  selectedVoiceName?: string | null;
  onVoiceSelect?: (name: string) => void;
}) {
  const [voiceMenuOpen, setVoiceMenuOpen] = useState(false);
  const englishVoices = voices?.filter(voice =>
    voice.lang.toLowerCase().startsWith("en")
  );
  const displayVoices =
    englishVoices && englishVoices.length > 0 ? englishVoices : voices ?? [];

  return (
    <div className="flex items-center gap-1.5" role="group" aria-label="Voice chat controls">
      <DropdownMenu open={voiceMenuOpen} onOpenChange={setVoiceMenuOpen}>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            className="h-10 gap-1.5 rounded-full px-3.5 text-foreground transition-colors hover:bg-accent hover:text-foreground"
            aria-label="Choose KSEMO's voice"
          >
            <AudioLines className="size-4" />
            <span className="text-sm font-medium leading-none">Voice</span>
            <ChevronDown
              className={cn(
                "size-4 text-muted-foreground transition-transform duration-200",
                voiceMenuOpen ? "rotate-180" : ""
              )}
            />
          </Button>
        </DropdownMenuTrigger>
<DropdownMenuContent
            align="end"
            side="top"
            sideOffset={10}
            collisionPadding={12}
            className="ksemo-thin-scroll w-60 max-h-72 overflow-y-auto"
          >
            {displayVoices.length > 0 ? (
            displayVoices.map(voice => (
              <DropdownMenuItem
                key={voice.name}
                onSelect={() => {
                  onVoiceSelect?.(voice.name);
                  setVoiceMenuOpen(false);
                }}
              >
                <span className="min-w-0 flex-1 truncate">{voice.name}</span>
                <span className="shrink-0 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                  {voice.lang}
                </span>
                {selectedVoiceName === voice.name && (
                  <Check className="ml-2 size-4 shrink-0 text-foreground" />
                )}
              </DropdownMenuItem>
            ))
          ) : (
            <p className="px-3 py-2 text-xs text-muted-foreground">
              No voices available on this device.
            </p>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            onClick={onMicToggle}
            aria-pressed={!muted}
            className="size-10 rounded-full bg-transparent text-foreground transition-colors hover:bg-accent hover:text-foreground"
            aria-label={muted ? "Unmute microphone" : "Mute microphone"}
          >
            {muted ? (
              <VolumeX className="size-5" />
            ) : (
              <Volume2 className="size-5" />
            )}
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom">
          {muted ? "Unmute microphone" : "Mute microphone"}
        </TooltipContent>
      </Tooltip>

      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            onClick={onEnd}
            size="icon"
            className="size-10 rounded-full bg-foreground text-background hover:bg-foreground/90 transition-colors"
            aria-label="End voice chat"
          >
            <Square className="size-4 fill-current" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom">End voice chat</TooltipContent>
      </Tooltip>
    </div>
  );
}

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
                      ? "bg-muted/50 hover:bg-accent"
                      : "hover:bg-accent"
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
