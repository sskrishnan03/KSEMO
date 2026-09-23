import { Button } from "@/components/ui/button";
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
import { CAPABILITY_SECTIONS, getCapabilityOption } from "@/lib/capabilities";
import { type CapabilityMode } from "@shared/capabilities";
import { type PresentationConfig } from "@shared/presentation";
import { useIsMobile } from "@/hooks/useIsMobile";
import { PptConfigStrip } from "./PptConfigStrip";
import {
  ArrowUp,
  AudioLines,
  Check,
  ChevronDown,
  Camera,
  FilePlus2,
  Library,
  Loader2,
  MessageCircle,
  Mic,
  Paperclip,
  Plus,
  Square,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";
import React, {
  memo,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
} from "react";
import { FileResultCard } from "./FileResultCard";

export const getLibrarySubmenuClass = (isCentered: boolean) =>
  `absolute left-1/2 -translate-x-1/2 z-50 max-h-[calc(100dvh-${isCentered ? "12rem" : "6rem"})] w-full max-w-3xl rounded-xl border border-border bg-popover p-0 text-popover-foreground shadow-xl`;

const CHAT_PLACEHOLDER = "Ask KSEMO anything...";
const TEMP_PLACEHOLDER = "Start a temporary conversation...";

const VOICE_PLACEHOLDER = "Ask me out loud or type your question here...";

const COMPACT_INPUT_MAX_HEIGHT = 192;
const EXPANDED_INPUT_MAX_HEIGHT = 320;
const MIN_INPUT_HEIGHT = 40;

const MENU_TITLE = "Attach";

const MODE_TOKEN_COLORS: Record<string, string> = {
  pdf: "#ef4444",
  docx: "#2563eb",
  xlsx: "#059669",
  pptx: "#f97316",
  txt: "#0ea5e9",
};

/*
 * KSEMO's own bot mark for the Composer "Bot" mode — a simple, clean robot:
 * rounded head, antenna with a dot, two plain eye dots and a small smile.
 * Nothing extra; inherits pill colors via currentColor.
 */
export const KseBotModeIcon = memo(function KseBotModeIcon({
  className,
}: {
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <rect x="3.5" y="5.5" width="17" height="15" rx="4.5" />
      <path d="M12 5.5V3.6" />
      <circle cx="12" cy="2.7" r="0.9" fill="currentColor" stroke="none" />
      <circle cx="9" cy="11.8" r="1.3" fill="currentColor" stroke="none" />
      <circle cx="15" cy="11.8" r="1.3" fill="currentColor" stroke="none" />
      <path d="M9.6 16.4h4.8" />
    </svg>
  );
});

const MODE_TOKEN_LABELS: Record<string, string> = {
  pdf: "pdf",
  docx: "docx",
  xlsx: "xlsx",
  pptx: "pptx",
  txt: "txt",
};

function getModeToken(mode: CapabilityMode): string {
  return MODE_TOKEN_LABELS[mode] ?? getCapabilityOption(mode).title;
}

export const DictateRecordingPill = memo(function DictateRecordingPill({
  recordingSeconds,
  audioBars,
  audioLevel = 0,
  onStop,
  onTranscribe,
}: {
  recordingSeconds: number;
  audioBars?: number[];
  audioLevel?: number;
  onStop: () => void;
  onTranscribe: () => void;
}) {
  const bars =
    audioBars && audioBars.length > 0
      ? audioBars
      : [
          0.15, 0.35, 0.65, 0.85, 0.45, 0.95, 0.75, 0.35, 0.85, 0.55, 0.25,
          0.45,
        ];

  return (
    <div
      className="flex min-w-0 items-center justify-between gap-1.5 overflow-hidden rounded-full border border-border bg-muted/80 backdrop-blur-xs px-2.5 py-1 shadow-sm animate-in fade-in zoom-in-95 duration-150 sm:min-w-[250px] sm:gap-3 sm:px-4 sm:py-1.5"
      role="region"
      aria-label="Dictation recording controls"
    >
      <div className="flex h-6 items-center gap-0.5 sm:gap-1" aria-hidden="true">
        {bars.map((val, index) => {
          const height = Math.max(4, Math.min(22, Math.round(4 + val * 18)));
          return (
            <span
              key={index}
              className={cn(
                "w-0.5 rounded-full transition-all duration-75 ease-out sm:w-1",
                val > 0.25 ? "bg-primary" : "bg-muted-foreground/50"
              )}
              style={{ height: `${height}px` }}
            />
          );
        })}
      </div>
      <span className="text-xs font-semibold tabular-nums text-foreground tracking-tight select-none sm:text-[13px]">
        {String(Math.floor(recordingSeconds / 60)).padStart(2, "0")}:
        {String(recordingSeconds % 60).padStart(2, "0")}
      </span>
      <div className="flex items-center gap-1 sm:gap-1.5">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={onStop}
              className="size-7 rounded-full text-foreground/80 hover:bg-destructive/15 hover:text-destructive transition-colors"
              aria-label="Stop"
            >
              <Square className="size-2.5 fill-current" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">Stop</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              size="icon"
              onClick={onTranscribe}
              className="size-7 rounded-full bg-foreground text-background hover:bg-foreground/90 transition-colors shadow-xs"
              aria-label="Transcribe"
            >
              <Check className="size-3.5 stroke-[2.5]" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">Transcribe</TooltipContent>
        </Tooltip>
      </div>
    </div>
  );
});

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
  pptConfig,
  onPptConfigChange,
  hideVoiceInput = false,
  voiceChatActive = false,
  voiceChatMuted = false,
  onVoiceChatMicToggle,
  onVoiceChatEnd,
  voices,
  selectedVoiceName,
  onVoiceChatVoiceSelect,
  isEditingMessage = false,
  onSaveEdit,
  onCancelEdit,
  audioBars,
  audioLevel,
  focusToken = 0,
  temporary = false,
  guestMode = false,
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
  audioBars?: number[];
  audioLevel?: number;
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
  /** PowerPoint design options for the strip shown above the composer. */
  pptConfig?: PresentationConfig;
  onPptConfigChange?: (config: PresentationConfig) => void;
  hideVoiceInput?: boolean;
  voiceChatActive?: boolean;
  voiceChatMuted?: boolean;
  onVoiceChatMicToggle?: () => void;
  onVoiceChatEnd?: () => void;
  voices?: Array<{ name: string; lang: string; default: boolean }>;
  selectedVoiceName?: string | null;
  onVoiceChatVoiceSelect?: (name: string) => void;
  isEditingMessage?: boolean;
  onSaveEdit?: () => void;
  onCancelEdit?: () => void;
  focusToken?: number;
  /** Temporary ("incognito") chat: renders a soft white glow around the input. */
  temporary?: boolean;
  /** Signed-out guest mode: disables attachments, voice, and create-file tools. */
  guestMode?: boolean;
}) {
  const editorRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const libraryPanelRef = useRef<HTMLDivElement>(null);
  const isMobile = useIsMobile();
  const [libraryOpen, setLibraryOpen] = useState(initialLibraryOpen);
  const [toolsOpen, setToolsOpen] = useState(initialToolsOpen);
  const [libraryQuery, setLibraryQuery] = useState("");
  const [isDragActive, setIsDragActive] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [canExpand, setCanExpand] = useState(false);
  const [activeTag, setActiveTag] = useState<"chat" | "bot">("chat");
  const dragCounterRef = useRef(0);
  const editorModeRef = useRef<CapabilityMode>("chat");
  const lastSyncedValueRef = useRef<string | null>(null);
  const activeModeOption =
    activeMode && activeMode !== "chat"
      ? getCapabilityOption(activeMode)
      : null;
  const isEditorDisabled = isGenerating || isRecording || isTranscribing;
  const displayedLibraryFiles = useMemo(
    () => filterLibraryItems(libraryFiles, libraryQuery),
    [libraryFiles, libraryQuery]
  );
  const visibleAttachmentNotices = isEditingMessage
    ? []
    : (attachmentNotices ??
      (attachmentNotice
        ? [{ fileId: attachmentNotice.name, ...attachmentNotice }]
        : []));
  const canSend =
    Boolean(value.trim()) ||
    visibleAttachmentNotices.length > 0 ||
    Boolean(activeMode && activeMode !== "chat");

  useEffect(() => {
    if (isEditingMessage) {
      requestAnimationFrame(() => {
        placeCaretAtEnd();
      });
    }
  }, [isEditingMessage]);

  // ---- Slash command ("/") menu state ----
  const slashPanelRef = useRef<HTMLDivElement>(null);
  const [slashHighlight, setSlashHighlight] = useState(0);
  const slashCreateOptions = useMemo(
    () => CAPABILITY_SECTIONS.find(s => s.id === "create")?.options ?? [],
    []
  );
  const isSlashActive =
    !isEditingMessage &&
    !guestMode &&
    !voiceChatActive &&
    activeMode === "chat" &&
    value.startsWith("/") &&
    !value.startsWith("//") &&
    value.length >= 1;
  const slashQuery = isSlashActive ? value.slice(1) : "";
  const slashFiltered = useMemo(() => {
    if (!isSlashActive) return [];
    const q = slashQuery.trim().toLowerCase();
    if (!q) return slashCreateOptions;
    return slashCreateOptions.filter(
      o =>
        o.title.toLowerCase().includes(q) ||
        o.mode.toLowerCase().includes(q) ||
        o.description.toLowerCase().includes(q)
    );
  }, [isSlashActive, slashQuery, slashCreateOptions]);

  useEffect(() => {
    if (isSlashActive) setSlashHighlight(0);
  }, [slashQuery, isSlashActive]);

  useEffect(() => {
    if (!isSlashActive) return;
    const closeSlash = (event: PointerEvent) => {
      const clickedInPanel = slashPanelRef.current?.contains(
        event.target as Node
      );
      const clickedInEditor = editorRef.current?.contains(event.target as Node);
      if (!clickedInPanel && !clickedInEditor) {
        onValueChange("");
      }
    };
    document.addEventListener("pointerdown", closeSlash);
    return () => document.removeEventListener("pointerdown", closeSlash);
  }, [isSlashActive, onValueChange]);

  function selectSlashOption(mode: CapabilityMode) {
    onValueChange("");
    onModeChange?.(mode);
    requestAnimationFrame(() => {
      placeCaretAtEnd();
    });
  }

  function renderEditorDom(nextMode: CapabilityMode, nextValue: string) {
    const editor = editorRef.current;
    if (!editor) return;
    editor.textContent = "";
    if (nextMode !== "chat") {
      const token = document.createElement("span");
      token.dataset.mode = nextMode;
      token.style.color = MODE_TOKEN_COLORS[nextMode] ?? "inherit";
      token.style.fontWeight = "600";
      token.textContent = `/${getModeToken(nextMode)}`;
      editor.appendChild(token);
      editor.appendChild(document.createTextNode(" "));
    }
    if (nextValue) {
      editor.appendChild(document.createTextNode(nextValue));
    }
    editorModeRef.current = nextMode;
    lastSyncedValueRef.current = nextValue;
  }

  function placeCaretAtEnd() {
    const editor = editorRef.current;
    if (!editor) return;
    editor.focus({ preventScroll: true });
    const range = document.createRange();
    range.selectNodeContents(editor);
    range.collapse(false);
    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
  }

  function isBackspaceTargetingModeToken(
    editor: HTMLDivElement,
    nextValue: string
  ): boolean {
    const selection = window.getSelection();
    if (!selection || !selection.isCollapsed) return false;
    const range = selection.getRangeAt(0);
    const container = range.startContainer;
    const token = editor.querySelector("[data-mode]") as HTMLElement | null;
    if (token && (container === token || token.contains(container)))
      return true;
    if (nextValue === "") return true;
    const question = editor.lastChild;
    if (question && container === question && range.startOffset === 0)
      return true;
    return false;
  }

  function handleEditorInput() {
    const editor = editorRef.current;
    if (!editor) return;
    const full = editor.textContent ?? "";
    const mode = editorModeRef.current;
    let nextMode = mode;
    let typed = full;
    if (mode !== "chat") {
      const token = `/${getModeToken(mode)}`;
      if (full.startsWith(token)) {
        typed = full.slice(token.length).replace(/^ /, "");
      } else {
        nextMode = "chat";
        typed = full;
      }
    }
    editorModeRef.current = nextMode;
    lastSyncedValueRef.current = typed;
    if (nextMode === "chat" && mode !== "chat") {
      onModeChange?.(null);
    }
    onValueChange(typed);
  }

  useLayoutEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;
    const mode = activeMode ?? "chat";
    const changed =
      editorModeRef.current !== mode || lastSyncedValueRef.current !== value;
    if (changed) {
      renderEditorDom(mode, value);
      if (mode !== "chat" || value !== "") {
        placeCaretAtEnd();
      }
    }
  }, [activeMode, value]);

  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;
    const frame = requestAnimationFrame(() => {
      // Reset to auto first to allow shrinking
      editor.style.height = "auto";
      // Then size to actual scrollHeight, capped by the current mode
      const cap = expanded
        ? EXPANDED_INPUT_MAX_HEIGHT
        : COMPACT_INPUT_MAX_HEIGHT;
      const height = Math.max(
        Math.min(editor.scrollHeight, cap),
        MIN_INPUT_HEIGHT
      );
      editor.style.height = `${height}px`;
      setCanExpand(editor.scrollHeight > COMPACT_INPUT_MAX_HEIGHT);
    });
    return () => cancelAnimationFrame(frame);
  }, [value, expanded, activeMode]);

  useEffect(() => {
    if (expanded && !canExpand) setExpanded(false);
  }, [expanded, canExpand]);

  // When a chat is opened (new chat or an existing conversation), focus the
  // input so the user can start typing immediately. Runs on mount too, so the
  // composer that appears after messages finish loading also grabs focus.
  useEffect(() => {
    if (!focusToken) return;
    const frame = requestAnimationFrame(() => {
      const editor = editorRef.current;
      if (!editor || isEditorDisabled) return;
      editor.focus({ preventScroll: true });
      const range = document.createRange();
      range.selectNodeContents(editor);
      range.collapse(false);
      const selection = window.getSelection();
      selection?.removeAllRanges();
      selection?.addRange(range);
    });
    return () => cancelAnimationFrame(frame);
  }, [focusToken]);

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
    if (isEditingMessage) {
      if (value.trim() && !isRecording && !isTranscribing) {
        onSaveEdit?.();
      }
      return;
    }
    const content = value.trim();
    if (
      (!content &&
        !visibleAttachmentNotices.length &&
        (!activeMode || activeMode === "chat")) ||
      isGenerating
    )
      return;
    const finalContent =
      content ||
      (activeMode && activeMode !== "chat"
        ? `Create this in ${getModeToken(activeMode)}`
        : "");
    if (!finalContent && !visibleAttachmentNotices.length) return;
    const payload =
      activeMode && activeMode !== "chat"
        ? `${getModeToken(activeMode)} ${finalContent}`
        : finalContent;
    onSend(payload.trim());
    onValueChange("");
    onModeChange?.(null);
  }

  function selectFile(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    event.target.value = "";
    for (const file of files) onAttachment?.(file);
  }

  function handlePaste(event: React.ClipboardEvent<HTMLDivElement>) {
    const items = Array.from(event.clipboardData?.items ?? []);
    const files = items
      .filter(item => item.kind === "file")
      .map(item => item.getAsFile())
      .filter((file): file is File => file !== null);
    if (files.length && !guestMode) {
      event.preventDefault();
      for (const file of files) onAttachment?.(file);
      return;
    }
    const text = event.clipboardData?.getData("text/plain");
    if (text) {
      event.preventDefault();
      document.execCommand("insertText", false, text);
    }
  }

  useEffect(() => {
    if (guestMode) return;
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
  }, [onAttachment, guestMode]);

  return (
    <div
      className={cn(
        "mx-auto w-full max-w-3xl px-4 pt-2",
        compactBottomSpacing ? "pb-5" : "pb-4"
      )}
    >
      {activeMode === "pptx" && pptConfig && onPptConfigChange && (
        <PptConfigStrip
          config={pptConfig}
          onChange={onPptConfigChange}
          isCentered={isCentered}
        />
      )}
      <div
        className={cn(
          "relative rounded-[20px] border border-border bg-popover p-1.5 shadow-sm text-popover-foreground",
          // Temporary "incognito" mode: no hard border line at all; only a
          // soft glow hugs the edge of the box. The glow adapts to the theme —
          // dark in light mode so it stays visible, white in dark mode.
          temporary &&
            "border-transparent shadow-[0_0_12px_3px_rgba(0,0,0,0.16)] dark:shadow-[0_0_12px_3px_rgba(255,255,255,0.14)]"
        )}
      >
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
              isMobile || menuPlacement !== "below"
                ? "bottom-[calc(100%+0.5rem)]"
                : "top-[calc(100%+0.5rem)]"
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
              visibleCount={isCentered ? 2 : 4}
            />
          </div>
        )}
        <input
          ref={fileInputRef}
          type="file"
          multiple
          onChange={selectFile}
          accept="image/*,audio/*,video/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.tsv,.md,.markdown,.json,.xml,.yml,.yaml,.ts,.tsx,.js,.jsx,.py,.c,.cpp,.h,.hpp,.cs,.rb,.go,.rs,.php,.sql,.sh,.bat,.ps1,.zip,.tar,.gz"
          className="sr-only"
        />
        {visibleAttachmentNotices.length > 0 && (
          <div className="mx-1 mb-0.5 flex items-center gap-2 overflow-x-auto px-2 pt-2 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {visibleAttachmentNotices.map(item => {
              const isImage =
                (item.url || item.mimeType) &&
                (IMAGE_EXT.test(item.name) ||
                  (item.mimeType ?? "").startsWith("image/"));
              const kind = getFileKind(item.name, item.mimeType);
              return isImage && item.url ? (
                <div
                  key={item.fileId}
                  className="group relative size-16 shrink-0"
                >
                  <img
                    src={item.url}
                    alt={item.name}
                    className="h-full w-full rounded-xl border border-border object-cover shadow-sm"
                  />
                  {onClearAttachment && (
                    <button
                      type="button"
                      onClick={() => onClearAttachment(item.fileId)}
                      className="absolute -right-1.5 -top-1.5 z-10 flex size-5 items-center justify-center rounded-full bg-white text-black shadow-md border border-neutral-300/80 outline-none max-md:opacity-100 max-md:scale-100 md:opacity-0 md:scale-90 transition-all duration-150 group-hover:opacity-100 group-hover:scale-100 group-focus-within:opacity-100 group-focus-within:scale-100 focus-visible:opacity-100 focus-visible:scale-100 hover:scale-110 hover:bg-neutral-100 focus-visible:ring-2 focus-visible:ring-primary"
                      aria-label="Remove screenshot"
                    >
                      <X className="size-3 stroke-[2.5]" />
                    </button>
                  )}
                </div>
              ) : (
                <div
                  key={item.fileId}
                  className="group flex h-16 shrink-0 items-center gap-3 rounded-xl border border-border bg-muted py-2 pl-2 pr-3 shadow-sm transition-colors hover:bg-accent"
                >
                  <span
                    className={`flex size-11 shrink-0 items-center justify-center rounded-lg ${kind.colorClass}`}
                  >
                    <kind.icon className="size-10 shrink-0" />
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
                      type="button"
                      onClick={() => onClearAttachment(item.fileId)}
                      className="ml-auto flex size-5 shrink-0 items-center justify-center rounded-full bg-white text-black shadow-md border border-neutral-300/80 outline-none max-md:opacity-100 max-md:scale-100 md:opacity-0 md:scale-90 transition-all duration-150 group-hover:opacity-100 group-hover:scale-100 group-focus-within:opacity-100 group-focus-within:scale-100 focus-visible:opacity-100 focus-visible:scale-100 hover:scale-110 hover:bg-neutral-100 focus-visible:ring-2 focus-visible:ring-primary"
                      aria-label="Remove screenshot"
                    >
                      <X className="size-3 stroke-[2.5]" />
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
          <div className="relative flex flex-1 items-start">
            <div
              id="ksemo-composer-textarea"
              ref={editorRef}
              contentEditable={isEditorDisabled ? "false" : "true"}
              suppressContentEditableWarning
              spellCheck={false}
              autoCorrect="off"
              autoCapitalize="off"
              role="textbox"
              aria-multiline="true"
              aria-label={
                isEditingMessage ? "Edit your message" : "Message KSEMO"
              }
              onInput={handleEditorInput}
              onPaste={handlePaste}
              onKeyDown={event => {
                if (isEditingMessage && event.key === "Escape") {
                  event.preventDefault();
                  onCancelEdit?.();
                  return;
                }
                if (isSlashActive) {
                  if (event.key === "Escape") {
                    event.preventDefault();
                    onValueChange("");
                    return;
                  }
                  if (event.key === "ArrowDown") {
                    event.preventDefault();
                    setSlashHighlight(current => {
                      const max = Math.max(0, slashFiltered.length - 1);
                      return Math.min(max, current + 1);
                    });
                    return;
                  }
                  if (event.key === "ArrowUp") {
                    event.preventDefault();
                    setSlashHighlight(current => Math.max(0, current - 1));
                    return;
                  }
                  if (
                    event.key === "Tab" ||
                    (event.key === "Enter" && !event.shiftKey)
                  ) {
                    event.preventDefault();
                    const option =
                      slashFiltered[slashHighlight] ?? slashFiltered[0];
                    if (option) selectSlashOption(option.mode);
                    return;
                  }
                }
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  submit();
                }
                if (
                  event.key === "Backspace" &&
                  activeMode &&
                  activeMode !== "chat" &&
                  editorRef.current &&
                  isBackspaceTargetingModeToken(editorRef.current, value)
                ) {
                  event.preventDefault();
                  onModeChange?.(null);
                }
              }}
              className={cn(
                "min-h-10 min-w-0 flex-1 overflow-y-auto whitespace-pre-wrap border-0 !bg-transparent pl-2.5 py-1 text-[15px] leading-6 md:text-[15px] shadow-none focus-visible:ring-0 outline-none dark:!bg-transparent",
                expanded ? "max-h-80" : "max-h-48",
                canExpand ? "pr-10" : "pr-1"
              )}
              style={{ height: "40px" }}
            />
            {canExpand && (
              <div
                className="pointer-events-none absolute inset-x-0 -bottom-1 h-9 bg-gradient-to-t from-popover to-transparent"
                aria-hidden="true"
              />
            )}
            {canExpand && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    tabIndex={-1}
                    onClick={() => setExpanded(current => !current)}
                    className="absolute right-1.5 top-1.5 z-10 flex size-8 items-center justify-center rounded-full bg-transparent text-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:ring-0 focus-visible:outline-none"
                    aria-label={expanded ? "Collapse" : "Expand"}
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
                  {expanded ? "Collapse" : "Expand"}
                </TooltipContent>
              </Tooltip>
            )}
            {value.length === 0 && !activeModeOption && (
              <span
                key={
                  isEditingMessage
                    ? "edit"
                    : voiceChatActive
                      ? "voice"
                      : temporary
                        ? "temporary"
                        : activeMode && activeMode !== "chat"
                          ? activeMode
                          : "chat"
                }
                className="pointer-events-none absolute left-2.5 top-[7px] text-[15px] leading-6 text-muted-foreground animate-[ksemo-placeholder-rise_800ms_ease-out]"
                aria-hidden="true"
              >
                {isEditingMessage
                  ? "Edit your message…"
                  : voiceChatActive
                    ? VOICE_PLACEHOLDER
                    : temporary
                      ? TEMP_PLACEHOLDER
                      : CHAT_PLACEHOLDER}
              </span>
            )}
          </div>

          {/* Bottom Control Row */}
          <div className="flex flex-wrap items-center justify-between gap-x-1.5 gap-y-1.5 pt-1">
            {/* Left Side Controls */}
            <div className="flex items-center gap-1.5">
              {!isEditingMessage && !guestMode && (
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
                          aria-label="Attach"
                        >
                          <Plus className="size-5" />
                        </Button>
                      </DropdownMenuTrigger>
                    </TooltipTrigger>
                    <TooltipContent side="bottom">{MENU_TITLE}</TooltipContent>
                  </Tooltip>
                  <DropdownMenuContent
                    align="start"
                    side={isMobile ? "top" : (menuPlacement === "below" ? "bottom" : "top")}
                    sideOffset={8}
                    alignOffset={-8}
                    collisionPadding={12}
                    className="ksemo-thin-scroll w-48 rounded-xl max-h-[16rem] overflow-y-auto"
                  >
                    <DropdownMenuItem
                      onClick={() => fileInputRef.current?.click()}
                    >
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
                        <DropdownMenuSub>
                          <DropdownMenuSubTrigger>
                            <FilePlus2 className="mr-2 size-4" />
                            Create Files
                          </DropdownMenuSubTrigger>
                          <DropdownMenuSubContent
                            sideOffset={6}
                            alignOffset={-84}
                            collisionPadding={16}
                            className="ksemo-thin-scroll w-44 rounded-xl max-h-[16rem] overflow-y-auto shadow-md"
                          >
                            {CAPABILITY_SECTIONS.find(
                              s => s.id === "create"
                            )?.options.map(option => {
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
                                      requestAnimationFrame(() => {
                                        placeCaretAtEnd();
                                      });
                                    }
                                    setToolsOpen(false);
                                  }}
                                >
                                  <Icon className="mr-2 size-5" />
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
              )}

              {!isEditingMessage && !guestMode && (
                <div
                  className="animate-[ksemo-tag-pop_400ms_ease-out_both] relative flex h-8 w-20 shrink-0 items-center rounded-full border border-border bg-popover p-0.5 shadow-sm sm:w-[10.5rem]"
                  role="group"
                  aria-label="Composer mode"
                >
                  <span
                    aria-hidden="true"
                    className={cn(
                      "absolute top-0.5 bottom-0.5 w-[calc(50%-2px)] rounded-full bg-foreground text-background shadow-sm transition-[left] duration-300 ease-out",
                      activeTag === "bot" ? "left-1/2" : "left-0.5"
                    )}
                  />
                  <button
                    type="button"
                    onClick={() => setActiveTag("chat")}
                    aria-pressed={activeTag === "chat"}
                    aria-label="Chat mode"
                    className={cn(
                      "relative z-10 flex h-full flex-1 items-center justify-center gap-1.5 rounded-full text-[13px] font-medium outline-none transition-colors duration-200",
                      activeTag === "chat"
                        ? "text-background"
                        : "text-foreground hover:bg-accent/60 hover:text-foreground"
                    )}
                  >
                    <MessageCircle className="size-4" />
                    <span className="hidden sm:inline">Chat</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTag("bot")}
                    aria-pressed={activeTag === "bot"}
                    aria-label="Bot mode"
                    className={cn(
                      "relative z-10 flex h-full flex-1 items-center justify-center gap-1.5 rounded-full text-[13px] font-medium outline-none transition-colors duration-200",
                      activeTag === "bot"
                        ? "text-background"
                        : "text-foreground hover:bg-accent/60 hover:text-foreground"
                    )}
                  >
                    <KseBotModeIcon className="size-[18px]" />
                    <span className="hidden sm:inline">Bot</span>
                  </button>
                </div>
              )}
            </div>

            {/* Right Side Controls */}
            <div className="ml-auto flex items-center gap-1.5">
              {isEditingMessage ? (
                <>
                  {/* Recorded audio / Mic button */}
                  {!hideVoiceInput && (
                    <>
                      {isRecording ? (
                        <DictateRecordingPill
                          recordingSeconds={recordingSeconds}
                          audioBars={audioBars}
                          audioLevel={audioLevel}
                          onStop={onCancelRecording}
                          onTranscribe={onVoice}
                        />
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
                              <div className="loader" style={{ width: 18 }} aria-hidden />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent side="bottom">
                            Transcribing…
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
                              aria-label="Dictate"
                            >
                              <Mic className="size-4.5" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent side="bottom">Dictate</TooltipContent>
                        </Tooltip>
                      )}
                    </>
                  )}

                  {/* Cancel Button */}
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={onCancelEdit}
                        disabled={isRecording || isTranscribing}
                        className="size-10 rounded-full bg-transparent text-foreground hover:bg-accent hover:text-foreground transition-colors"
                        aria-label="Cancel edit"
                      >
                        <X className="size-4.5" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="bottom">Cancel edit</TooltipContent>
                  </Tooltip>

                  {/* Save Button (Tick mark) */}
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        type="button"
                        size="icon"
                        onClick={onSaveEdit}
                        disabled={
                          !value.trim() || isRecording || isTranscribing
                        }
                        className="size-10 rounded-full bg-foreground text-background hover:bg-foreground/90 disabled:bg-muted disabled:text-muted-foreground transition-colors"
                        aria-label="Save edit"
                      >
                        <Check className="size-4.5" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="bottom">Save edit</TooltipContent>
                  </Tooltip>
                </>
              ) : voiceChatActive ? (
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
                        <DictateRecordingPill
                          recordingSeconds={recordingSeconds}
                          audioBars={audioBars}
                          audioLevel={audioLevel}
                          onStop={onCancelRecording}
                          onTranscribe={onVoice}
                        />
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
                              <div className="loader" style={{ width: 18 }} aria-hidden />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent side="bottom">
                            Transcribing…
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
                              aria-label="Dictate"
                            >
                              <Mic className="size-4.5" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent side="bottom">Dictate</TooltipContent>
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
                      <TooltipContent side="bottom">
                        Stop generating
                      </TooltipContent>
                    </Tooltip>
                  ) : !temporary &&
                    !guestMode &&
                    !value.trim() &&
                    !visibleAttachmentNotices.length &&
                    (!activeMode || activeMode === "chat") &&
                    !isRecording &&
                    !isTranscribing ? (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          onClick={onVoiceChat}
                          disabled={isRecording || isTranscribing}
                          size="icon"
                          className="size-10 rounded-full bg-muted text-foreground hover:bg-accent transition-colors"
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
                      <TooltipContent side="bottom">
                        Start voice chat
                      </TooltipContent>
                    </Tooltip>
                  ) : !isRecording && !isTranscribing ? (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          onClick={submit}
                          disabled={isRecording || isTranscribing}
                          size="icon"
                          className={cn(
                            "size-10 rounded-full transition-colors",
                            canSend
                              ? "bg-foreground text-background hover:bg-foreground/90"
                              : "bg-muted text-muted-foreground hover:bg-accent"
                          )}
                          aria-label="Send message"
                        >
                          <ArrowUp className="size-4.5" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent side="bottom">
                        Send message
                      </TooltipContent>
                    </Tooltip>
                  ) : null}
                </>
              )}
            </div>
          </div>
        </div>

        {/* Slash command ("/") menu — matches the Create Files submenu exactly */}
        {isSlashActive && (
          <div
            ref={slashPanelRef}
            className={cn(
              "ksemo-thin-scroll absolute left-0 z-50 w-44 max-h-[min(16rem,40vh)] overflow-y-auto rounded-xl border border-border bg-popover p-1 text-popover-foreground shadow-md",
              isMobile || menuPlacement === "above"
                ? "bottom-[calc(100%+2px)]"
                : "top-[calc(100%+2px)]"
            )}
          >
            {slashFiltered.length === 0 ? (
              <div className="px-2 py-1.5 text-sm text-muted-foreground">
                No matches
              </div>
            ) : (
              slashFiltered.map((option, index) => {
                const Icon = option.icon;
                const isActive = activeMode === option.mode;
                return (
                  <div
                    key={option.mode}
                    role="menuitem"
                    tabIndex={-1}
                    onMouseEnter={() => setSlashHighlight(index)}
                    onPointerDown={event => {
                      event.preventDefault();
                      selectSlashOption(option.mode);
                    }}
                    onClick={() => selectSlashOption(option.mode)}
                    className={cn(
                      "flex cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-hidden transition-colors",
                      index === slashHighlight
                        ? "bg-accent text-accent-foreground"
                        : "hover:bg-accent hover:text-accent-foreground"
                    )}
                  >
                    <Icon className="mr-2 size-5 text-muted-foreground" />
                    {option.title}
                    {isActive && (
                      <Check className="ml-auto size-4 text-foreground" />
                    )}
                  </div>
                );
              })
            )}
          </div>
        )}
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
    englishVoices && englishVoices.length > 0 ? englishVoices : (voices ?? []);

  return (
    <div
      className="flex items-center gap-1.5"
      role="group"
      aria-label="Voice chat controls"
    >
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
  visibleCount = 3,
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
  visibleCount?: number;
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

  const listMaxHeightStyle =
    files.length > visibleCount
      ? { maxHeight: `${visibleCount * 68 - 4}px` }
      : undefined;

  return (
    <div className="space-y-2 p-2">
      <div className="flex items-center gap-2 px-1">
        <Library className="size-4 text-muted-foreground" />
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
      <div className="overflow-y-auto" style={listMaxHeightStyle}>
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
                      className="size-11 shrink-0 rounded-lg object-cover"
                    />
                  ) : (
                    <kind.icon className="size-10 shrink-0" />
                  )}
                  <div className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate text-sm font-medium text-foreground">
                      {file.filename}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {kind.label}
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
