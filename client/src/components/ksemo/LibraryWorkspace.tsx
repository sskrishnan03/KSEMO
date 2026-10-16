import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Loading } from "@/components/ui/loading";
import { trpc } from "@/lib/trpc";
import { ConfirmDeleteDialog } from "./ConfirmDeleteDialog";
import { KsemoFilePreviewOverlay } from "./KsemoFilePreviewOverlay";
import { ImageLightbox } from "@/components/ui/image-lightbox";
import { isImageFile } from "@/lib/fileKinds";
import { usePdfViewer, isViewableDocument } from "@/contexts/PdfViewerContext";
import {
  extensionOfFilename,
  guessMimeType,
  isSupportedUpload,
} from "@/lib/fileIcons";
import { getCapabilityOption } from "@/lib/capabilities";
import { Gallery3 } from "reicon-react/icons/Gallery3";
import { format, isToday, isYesterday, isThisYear } from "date-fns";
import { cn } from "@/lib/utils";
import {
  Check,
  CheckCircle2,
  Download,
  File,
  FolderOpen,
  Grid2X2,
  Library,
  List,
  ListChecks,
  MessageCircle,
  MoreVertical,
  Pencil,
  Search,
  Star,
  Upload,
  X,
  ChevronDown,
} from "lucide-react";
import { Sidebar2 } from "reicon-react/icons/Sidebar2";
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
import { ShareIcon, Trash6Icon } from "./icons";
import { downloadFile } from "@/lib/downloadFile";
import { toast } from "sonner";
import React, {
  memo,
  useCallback,
  type ChangeEvent,
  useLayoutEffect,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

export type LibraryFilter = "all" | "favorites" | "images" | "files";
export type LibraryView = "grid" | "list";
export type LibraryWorkspaceFile = {
  id: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  url: string;
  createdAt?: Date;
  isFavorite?: boolean;
};

function splitLibraryFilename(filename: string) {
  const extensionStart = filename.lastIndexOf(".");
  if (extensionStart <= 0 || extensionStart === filename.length - 1) {
    return { name: filename, extension: "" };
  }
  return {
    name: filename.slice(0, extensionStart),
    extension: filename.slice(extensionStart),
  };
}

const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;

export function filterLibraryWorkspaceItems(
  files: LibraryWorkspaceFile[],
  query: string,
  filter: LibraryFilter
) {
  const normalized = query.trim().toLowerCase();
  return files.filter(
    file =>
      (filter === "all" ||
        (filter === "favorites"
          ? Boolean(file.isFavorite)
          : filter === "images"
            ? file.mimeType?.startsWith("image/")
            : !file.mimeType?.startsWith("image/"))) &&
      (!normalized || file.filename.toLowerCase().includes(normalized))
  );
}

export function selectVisibleLibraryItems(
  selectedIds: Set<string>,
  files: LibraryWorkspaceFile[]
) {
  return new Set(Array.from(selectedIds).concat(files.map(file => file.id)));
}

async function fileToBase64(file: File) {
  const bytes = new Uint8Array(await file.arrayBuffer());
  let binary = "";
  for (let offset = 0; offset < bytes.length; offset += 0x8000)
    binary += String.fromCharCode.apply(
      null,
      bytes.subarray(offset, offset + 0x8000) as unknown as number[]
    );
  return window.btoa(binary);
}

export function LibraryWorkspace({
  onChatWithFiles,
  initialFileId,
  onClose,
  onOpenSidebar,
}: {
  onChatWithFiles?: (files: LibraryWorkspaceFile[]) => void;
  initialFileId?: string | null;
  onClose?: () => void;
  onOpenSidebar?: () => void;
}) {
  const [query, setQuery] = useState("");
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const searchControlRef = useRef<HTMLDivElement>(null);
  const [filter, setFilter] = useState<LibraryFilter>("all");
  const [view, setView] = useState<LibraryView>("grid");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [deleteTarget, setDeleteTarget] = useState<
    LibraryWorkspaceFile[] | null
  >(null);
  const [removing, setRemoving] = useState(false);
  const [removeError, setRemoveError] = useState<string | null>(null);
  const [renameTarget, setRenameTarget] = useState<LibraryWorkspaceFile | null>(
    null
  );
  const [renameValue, setRenameValue] = useState("");
  const [sharingFileId, setSharingFileId] = useState<string | null>(null);
  const [shareNotice, setShareNotice] = useState<"success" | "error" | null>(null);
  const shareNoticeTimerRef = useRef<number | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const { openPdf } = usePdfViewer();
  const [openedFile, setOpenedFile] = useState<LibraryWorkspaceFile | null>(
    null
  );
  // Images open in the in-app lightbox (never a new browser tab). Each click
  // opens just that one image — the viewer is not seeded with the rest of the
  // Library.
  const [lightboxFile, setLightboxFile] = useState<LibraryWorkspaceFile | null>(
    null
  );
  const [openMenuFileId, setOpenMenuFileId] = useState<string | null>(null);
  const initialOpenedRef = useRef(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const utils = trpc.useUtils();
  useEffect(() => () => {
    if (shareNoticeTimerRef.current !== null) {
      window.clearTimeout(shareNoticeTimerRef.current);
    }
  }, []);
  useEffect(() => {
    if (!isSearchOpen) return;
    const closeOnOutsideClick = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (searchControlRef.current?.contains(target)) return;
      if (
        target instanceof Element &&
        target.closest("[data-library-search-filter]")
      ) return;
      setIsSearchOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsSearchOpen(false);
    };
    document.addEventListener("pointerdown", closeOnOutsideClick);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsideClick);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [isSearchOpen]);
  const invalidateFiles = () => utils.workspace.files.list.invalidate();
  const filesQuery = trpc.workspace.files.list.useQuery();
  const openImage = useCallback((file: LibraryWorkspaceFile) => {
    setLightboxFile(file);
  }, []);

  useEffect(() => {
    setOpenMenuFileId(null);
  }, [query, filter, view]);
  useEffect(() => {
    if (!initialFileId || initialOpenedRef.current) return;
    const file = (filesQuery.data ?? []).find(
      item => item.id === initialFileId
    );
    if (file) {
      initialOpenedRef.current = true;
      setSelectedIds(current => new Set(current).add(file.id));
      if (isImageFile(file.filename, file.mimeType)) {
        openImage(file);
      } else if (isViewableDocument(file.filename, file.mimeType)) {
        openPdf({
          url: file.url,
          filename: file.filename,
          sizeBytes: file.sizeBytes,
          id: file.id,
        });
      } else {
        setOpenedFile(file);
      }
    }
  }, [initialFileId, filesQuery.data, openPdf, openImage]);
  const uploadMutation = trpc.workspace.files.upload.useMutation({
    onSuccess: invalidateFiles,
    onError: () => {},
  });
  const createShareLinkMutation = trpc.workspace.files.createShareLink.useMutation();
  const favoriteMutation = trpc.workspace.files.setFavorite.useMutation({
    // Optimistic: flip the star instantly, roll back only on failure.
    onMutate: async ({ id, isFavorite }) => {
      await utils.workspace.files.list.cancel();
      const previous = utils.workspace.files.list.getData();
      utils.workspace.files.list.setData(undefined, current =>
        (current ?? []).map(file =>
          file.id === id ? { ...file, isFavorite } : file
        )
      );
      return { previous };
    },
    onError: (_error, _variables, context) => {
      if (context?.previous)
        utils.workspace.files.list.setData(undefined, context.previous);
      toast.error(_error.message || "Couldn't update favorite status.");
    },
    onSettled: () => utils.workspace.files.list.invalidate(),
  });
  const removeMutation = trpc.workspace.files.remove.useMutation({
    onError: () => {},
  });
  const renameMutation = trpc.workspace.files.rename.useMutation({
    onSuccess: () => invalidateFiles(),
    onError: () => {},
  });
  const allFiles = (filesQuery.data ?? []) as LibraryWorkspaceFile[];
  const files = useMemo(
    () => filterLibraryWorkspaceItems(allFiles, query, filter),
    [allFiles, query, filter]
  );
  const selectedFiles = useMemo(
    () => allFiles.filter(file => selectedIds.has(file.id)),
    [allFiles, selectedIds]
  );
  const allVisibleSelected = useMemo(
    () => files.length > 0 && files.every(file => selectedIds.has(file.id)),
    [files, selectedIds]
  );

  function queueUploads(picked: File[]) {
    if (!picked.length) return;

    const oversized = picked.filter(file => file.size > MAX_UPLOAD_BYTES);
    if (oversized.length > 0) {
      return;
    }

    const unsupported = picked.filter(file => !isSupportedUpload(file));
    if (unsupported.length > 0) {
      return;
    }

    for (const file of picked) {
      void fileToBase64(file)
        .then(dataBase64 =>
          uploadMutation.mutate({
            filename: file.name,
            mimeType: file.type || guessMimeType(file.name),
            dataBase64,
          })
        )
        .catch(() => {});
    }
  }

  async function uploadFile(event: ChangeEvent<HTMLInputElement>) {
    const picked = Array.from(event.target.files || []);
    event.target.value = "";
    queueUploads(picked);
  }

  function handleDragOver(event: React.DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    setIsDragging(true);
  }

  function handleDragLeave(event: React.DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    setIsDragging(false);
  }

  async function handleDrop(event: React.DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    setIsDragging(false);

    const dropped = Array.from(event.dataTransfer.files);
    if (!dropped.length) return;
    queueUploads(dropped);
  }

  const toggleFile = useCallback((id: string) => {
    setOpenMenuFileId(null);
    setSelectedIds(current => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const toggleFavorite = useCallback(
    (file: LibraryWorkspaceFile) =>
      favoriteMutation.mutate({
        id: file.id,
        isFavorite: !file.isFavorite,
      }),
    [favoriteMutation]
  );

  const requestDelete = useCallback(
    (file: LibraryWorkspaceFile) => setDeleteTarget([file]),
    []
  );

  const requestRename = useCallback(
    (file: LibraryWorkspaceFile) => {
      setRenameTarget(file);
      setRenameValue(splitLibraryFilename(file.filename).name);
    },
    []
  );

  async function confirmRename() {
    if (!renameTarget) return;
    if (!renameValue.trim()) return;
    try {
      await renameMutation.mutateAsync({
        id: renameTarget.id,
        filename: renameValue.trim(),
      });
      setRenameTarget(null);
    } catch {
      // The mutation-level message provides the actionable error state.
    }
  }

  const showShareNotice = useCallback((status: "success" | "error") => {
    if (shareNoticeTimerRef.current !== null) {
      window.clearTimeout(shareNoticeTimerRef.current);
    }
    setShareNotice(status);
    shareNoticeTimerRef.current = window.setTimeout(() => {
      setShareNotice(null);
      shareNoticeTimerRef.current = null;
    }, 4000);
  }, []);
  const dismissShareNotice = useCallback(() => {
    if (shareNoticeTimerRef.current !== null) {
      window.clearTimeout(shareNoticeTimerRef.current);
      shareNoticeTimerRef.current = null;
    }
    setShareNotice(null);
  }, []);
  const requestShare = useCallback(async (file: LibraryWorkspaceFile) => {
    if (sharingFileId) return;
    setShareNotice(null);
    setSharingFileId(file.id);
    try {
      const minimumLoading = new Promise(resolve => window.setTimeout(resolve, 500));
      const { path } = await createShareLinkMutation.mutateAsync({ id: file.id });
      const shareUrl = `${window.location.origin}${path}`;
      try {
        await navigator.clipboard.writeText(shareUrl);
      } catch {
        const field = document.createElement("textarea");
        field.value = shareUrl;
        field.style.position = "fixed";
        field.style.opacity = "0";
        document.body.appendChild(field);
        try {
          field.select();
          if (!document.execCommand("copy")) throw new Error("Clipboard copy failed");
        } finally {
          field.remove();
        }
      }
      await minimumLoading;
      showShareNotice("success");
    } catch {
      showShareNotice("error");
    } finally {
      setSharingFileId(null);
      setOpenMenuFileId(null);
    }
  }, [sharingFileId, showShareNotice]);

  function selectVisibleFiles() {
    setSelectedIds(current => selectVisibleLibraryItems(current, files));
  }

  async function confirmRemoval() {
    if (!deleteTarget?.length || removing) return;
    const targets = deleteTarget;
    setRemoveError(null);
    setRemoving(true);
    try {
      // allSettled, not all: one rejected file used to discard the whole
      // batch silently, leaving the dialog with no outcome at all. Now every
      // file is attempted and the failures are reported by name.
      const results = await Promise.allSettled(
        targets.map(file => removeMutation.mutateAsync({ id: file.id }))
      );
      const removedIds = new Set<string>();
      const failures: string[] = [];
      targets.forEach((file, index) => {
        if (results[index].status === "fulfilled") {
          removedIds.add(file.id);
        } else {
          failures.push(file.filename);
        }
      });

      if (removedIds.size) {
        setSelectedIds(current => {
          const next = new Set(current);
          for (const id of removedIds) next.delete(id);
          return next;
        });
        await invalidateFiles();
      }

      if (!failures.length) {
        setDeleteTarget(null);
        return;
      }

      setRemoveError(
        failures.length === targets.length
          ? "None of the selected items could be removed. Please try again."
          : `Removed ${removedIds.size} of ${targets.length} items. Could not remove: ${failures.join(", ")}.`
      );
      // Keep only the failures pending so a retry does not re-request the
      // files that are already gone.
      setDeleteTarget(targets.filter(file => !removedIds.has(file.id)));
    } finally {
      setRemoving(false);
    }
  }

  function chatWithSelected() {
    if (!selectedFiles.length) return;
    onChatWithFiles?.(selectedFiles);
  }

  const removeActionLabel =
    selectedFiles.length === allFiles.length && allFiles.length > 1
      ? "Remove all selected"
      : "Remove selection";

  return (
    <main
      className={cn(
        "flex min-h-0 flex-1 flex-col bg-background transition-colors",
        isDragging && "bg-muted/50"
      )}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,.txt,.tsv,.json,.log,.xml,.yml,.yaml,.png,.jpg,.jpeg,.webp,.gif,.docx,.xlsx,.xls,.pptx"
        multiple
        className="sr-only"
        onChange={uploadFile}
      />
      {isDragging && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
          <div className="rounded-2xl border-2 border-dashed border-muted-foreground/40 bg-card p-8 text-center">
            <Upload className="mx-auto size-12 text-muted-foreground" />
            <p className="mt-4 text-lg font-medium">Drop files to upload</p>
            <p className="mt-2 text-sm text-muted-foreground">
              Supported: PDF, Word, Excel, PowerPoint, text, data, and images up
              to 25 MB each
            </p>
          </div>
        </div>
      )}
      <div className="mx-auto flex min-h-0 w-full max-w-5xl flex-1 flex-col px-3.5 pt-4 sm:px-8 sm:pt-8">
        <header className="flex min-w-0 items-center gap-2">
          <div className="flex min-w-0 flex-1 items-center gap-2">
            {onOpenSidebar && (
              <Button
                variant="ghost"
                size="icon"
                onClick={onOpenSidebar}
                className="size-10 shrink-0 rounded-lg border-0 bg-transparent p-0 text-foreground/90 shadow-none transition-colors hover:bg-accent/80 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring active:bg-accent lg:hidden"
                aria-label="Open conversations"
                title="Open sidebar"
              >
                <Sidebar2 size={20} strokeWidth={2} className="size-5" />
              </Button>
            )}
            <h1 className="text-2xl font-semibold tracking-[-0.03em]">
              Library
            </h1>
          </div>
          <SegmentedTags
            description="Library view"
            value={view}
            onChange={setView}
            options={LIBRARY_VIEWS}
            iconsOnlyOnMobile
            compactOnMobile
            className="sm:hidden"
          />
          <Button
            size="sm"
            className="h-9 shrink-0 rounded-xl bg-foreground px-3 text-background hover:bg-foreground/90 sm:hidden"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploadMutation.isPending}
          >
            <Upload className="mr-1.5 size-4" />
            {uploadMutation.isPending ? "Uploading…" : "Upload files"}
          </Button>
        </header>

        <section className="mt-3 flex min-w-0 flex-wrap items-center gap-2 overflow-visible py-1 sm:flex-nowrap sm:gap-3">
          {shareNotice && (
            <div
              role="status"
              aria-live="polite"
              className={cn(
                "fixed right-3 top-[max(env(safe-area-inset-top),0.75rem)] z-[100] flex items-center gap-1 rounded-lg border px-2 py-1.5 text-white shadow-lg sm:hidden",
                shareNotice === "success"
                  ? "border-emerald-400/30 bg-emerald-700"
                  : "border-rose-400/30 bg-rose-700"
              )}
            >
              <span className="text-xs font-semibold">
                {shareNotice === "success" ? "Link copied" : "Copy failed"}
              </span>
              <button type="button" onClick={dismissShareNotice} aria-label="Dismiss share message" className="flex size-5 shrink-0 items-center justify-center rounded text-white/80 hover:bg-white/15">
                <X className="size-3" />
              </button>
            </div>
          )}
          <div className="hidden sm:block">
            <SegmentedTags
              description="Filter Library"
              value={filter}
              onChange={setFilter}
              options={LIBRARY_FILTERS}
            />
          </div>
          {isSearchOpen ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  className="h-9 shrink-0 rounded-xl px-3 text-xs sm:hidden"
                  aria-label="Filter Library"
                  data-library-search-filter
                >
                  {LIBRARY_FILTERS.find(option => option.value === filter)?.label}
                  <ChevronDown className="ml-1.5 size-3.5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" data-library-search-filter>
                {LIBRARY_FILTERS.map(option => (
                  <DropdownMenuItem
                    key={option.value}
                    onSelect={() => setFilter(option.value)}
                  >
                    {option.label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <div className="sm:hidden">
              <SegmentedTags
                description="Filter Library"
                value={filter}
                onChange={setFilter}
                options={LIBRARY_FILTERS}
                comfortableOnMobile
              />
            </div>
          )}
          <div className="hidden min-w-3 flex-1 sm:block" aria-hidden="true" />
          <div
            ref={searchControlRef}
            className={cn(
              "flex items-center gap-2",
              isSearchOpen
                ? "min-w-0 flex-1 sm:flex-none sm:shrink-0"
                : "shrink-0"
            )}
          >
            {isSearchOpen && (
              <div className="relative min-w-0 flex-1 sm:w-56 sm:flex-none">
                <Input
                  autoFocus
                  value={query}
                  onChange={event => setQuery(event.target.value)}
                  className={cn(
                    "h-10 w-full rounded-xl",
                    query && "pr-8"
                  )}
                  placeholder="Search Library"
                  aria-label="Search your Library"
                />
                {query && (
                  <button
                    type="button"
                    onClick={() => setQuery("")}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-md p-1 text-muted-foreground transition-colors hover:text-foreground"
                    aria-label="Clear search query"
                  >
                    <X className="size-4" />
                  </button>
                )}
              </div>
            )}
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="size-9 shrink-0 rounded-full text-foreground transition-colors hover:border-neutral-700 hover:bg-neutral-800 active:bg-neutral-700 sm:size-10"
              onClick={() => setIsSearchOpen(open => !open)}
              aria-label={isSearchOpen ? "Close Library search" : "Search Library"}
              aria-expanded={isSearchOpen}
            >
              <Search className="size-4" />
            </Button>
          </div>
          <SegmentedTags
            description="Library view"
            value={view}
            onChange={setView}
            options={LIBRARY_VIEWS}
            iconsOnlyOnMobile
            className="hidden sm:flex"
          />
          <div className="relative order-first ml-auto hidden shrink-0 sm:order-last sm:ml-0 sm:block">
            {shareNotice && (
              <div
                role="status"
                aria-live="polite"
                className={cn(
                  "absolute bottom-full right-0 mb-2 hidden items-center gap-1.5 whitespace-nowrap rounded-lg border px-2.5 py-1.5 text-white shadow-md sm:flex",
                  shareNotice === "success"
                    ? "border-emerald-400/30 bg-emerald-700"
                    : "border-rose-400/30 bg-rose-700"
                )}
              >
                <span className="text-xs font-semibold">
                  {shareNotice === "success" ? "Link copied" : "Copy failed"}
                </span>
                <button type="button" onClick={dismissShareNotice} aria-label="Dismiss share message" className="flex size-5 shrink-0 items-center justify-center rounded text-white/80 hover:bg-white/15">
                  <X className="size-3" />
                </button>
              </div>
            )}
            <Button
              size="sm"
              className="h-10 rounded-xl bg-foreground text-background hover:bg-foreground/90"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadMutation.isPending}
            >
              <Upload className="mr-1.5 size-4" />
              {uploadMutation.isPending ? "Uploading…" : "Upload files"}
            </Button>
          </div>
        </section>

        {selectedFiles.length > 0 && (
          <>
            {/* Mobile Selection Toolbar: same dock design as desktop,
                centered horizontally at the bottom */}
            <div
              className="fixed bottom-0 inset-x-0 z-40 flex justify-center px-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:hidden select-none animate-in slide-in-from-bottom-5 duration-200"
              aria-label="Selected Library actions"
            >
              <div className="flex flex-row items-center gap-1.5 rounded-[1.25rem] border border-border/80 bg-card/95 p-2 shadow-2xl shadow-black/10 backdrop-blur-xl">
                <div
                  className="flex h-11 w-11 cursor-default flex-col items-center justify-center gap-0.5 rounded-xl bg-foreground text-background shadow-md"
                  aria-label={`${selectedFiles.length} selected`}
                >
                  <CheckCircle2 className="size-4.5" />
                  <span className="text-[11px] font-bold leading-none tabular-nums">
                    {selectedFiles.length}
                  </span>
                </div>

                <div className="h-7 w-px bg-border" aria-hidden />

                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      onClick={selectVisibleFiles}
                      disabled={allVisibleSelected}
                      className="flex h-11 w-11 items-center justify-center rounded-xl bg-neutral-900 text-neutral-50 transition-colors hover:bg-neutral-800 disabled:pointer-events-none disabled:opacity-40"
                      aria-label="Select all visible files"
                    >
                      <ListChecks className="size-4.5" strokeWidth={2.5} />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="top">Select all</TooltipContent>
                </Tooltip>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      onClick={() => setSelectedIds(new Set())}
                      className="flex h-11 w-11 items-center justify-center rounded-xl bg-neutral-900 text-neutral-50 transition-colors hover:bg-neutral-800"
                      aria-label="Clear selection"
                    >
                      <X className="size-4.5" strokeWidth={2.75} />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="top">Clear</TooltipContent>
                </Tooltip>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      onClick={chatWithSelected}
                      className="flex h-11 w-11 items-center justify-center rounded-xl bg-foreground text-background shadow-md transition-all hover:bg-foreground/90 active:scale-95"
                      aria-label="Chat with selected files"
                    >
                      <MessageCircle className="size-5" strokeWidth={2.5} />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="top">Chat</TooltipContent>
                </Tooltip>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      onClick={() => setDeleteTarget(selectedFiles)}
                      className="flex h-11 w-11 items-center justify-center rounded-xl bg-neutral-900 text-destructive transition-colors hover:bg-neutral-800"
                      aria-label={removeActionLabel}
                    >
                      <Trash6Icon className="size-4.5" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="top">
                    {removeActionLabel}
                  </TooltipContent>
                </Tooltip>
              </div>
            </div>

            {/* Desktop / Laptop Selection Dock: floating on the right edge,
                away from the search bar so it never pushes content around */}
            <div
              role="toolbar"
              aria-label="Selected Library actions"
              className="fixed right-4 top-1/2 z-50 hidden -translate-y-1/2 select-none animate-in slide-in-from-right-8 fade-in-0 duration-300 ease-out sm:block"
            >
              <div className="flex flex-col items-center gap-1.5 rounded-[1.25rem] border border-border/80 bg-card/95 p-2 shadow-2xl shadow-black/10 backdrop-blur-xl">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div
                      className="flex h-11 w-11 cursor-default flex-col items-center justify-center gap-0.5 rounded-xl bg-foreground text-background shadow-md"
                      aria-label={`${selectedFiles.length} selected`}
                    >
                      <CheckCircle2 className="size-4.5" />
                      <span className="text-[11px] font-bold leading-none tabular-nums">
                        {selectedFiles.length}
                      </span>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent side="left">
                    {selectedFiles.length}{" "}
                    {selectedFiles.length === 1 ? "file" : "files"} selected
                  </TooltipContent>
                </Tooltip>

                <div className="h-px w-7 bg-border" aria-hidden />

                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      onClick={selectVisibleFiles}
                      disabled={allVisibleSelected}
                      className="flex h-11 w-11 items-center justify-center rounded-xl bg-neutral-900 text-neutral-50 transition-colors hover:bg-neutral-800 disabled:pointer-events-none disabled:opacity-40"
                      aria-label="Select all visible files"
                    >
                      <ListChecks className="size-4.5" strokeWidth={2.5} />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="left">Select all</TooltipContent>
                </Tooltip>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      onClick={() => setSelectedIds(new Set())}
                      className="flex h-11 w-11 items-center justify-center rounded-xl bg-neutral-900 text-neutral-50 transition-colors hover:bg-neutral-800"
                      aria-label="Clear selection"
                    >
                      <X className="size-4.5" strokeWidth={2.75} />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="left">Clear</TooltipContent>
                </Tooltip>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      onClick={chatWithSelected}
                      className="mt-0.5 flex h-11 w-11 items-center justify-center rounded-xl bg-foreground text-background shadow-md transition-all hover:bg-foreground/90 active:scale-95"
                      aria-label="Chat with selected files"
                    >
                      <MessageCircle className="size-5" strokeWidth={2.5} />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="left">Chat</TooltipContent>
                </Tooltip>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      onClick={() => setDeleteTarget(selectedFiles)}
                      className="flex h-11 w-11 items-center justify-center rounded-xl bg-neutral-900 text-destructive transition-colors hover:bg-neutral-800"
                      aria-label={removeActionLabel}
                    >
                      <Trash6Icon className="size-4.5" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="left">
                    {removeActionLabel}
                  </TooltipContent>
                </Tooltip>
              </div>
            </div>
          </>
        )}

        <div className="mt-4 sm:mt-5 min-h-0 flex-1 overflow-y-auto pb-10">
          {filesQuery.isLoading ? (
            <Loading className="min-h-64" />
          ) : files.length ? (
            view === "grid" ? (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                {files.map(file => (
                  <LibraryGridCard
                    key={file.id}
                    file={file}
                    selected={selectedIds.has(file.id)}
                    selectionMode={selectedFiles.length > 0}
                    isMenuOpen={openMenuFileId === file.id}
                    onMenuOpenChange={open =>
                      setOpenMenuFileId(open ? file.id : null)
                    }
                    onToggle={toggleFile}
                    onToggleFavorite={toggleFavorite}
                    onRename={requestRename}
                    onShare={requestShare}
                    sharing={sharingFileId === file.id}
                    onDelete={requestDelete}
                    onOpenFile={openImage}
                  />
                ))}
              </div>
            ) : (
              <div className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
                {files.map(file => (
                  <LibraryListRow
                    key={file.id}
                    file={file}
                    selected={selectedIds.has(file.id)}
                    selectionMode={selectedFiles.length > 0}
                    isMenuOpen={openMenuFileId === file.id}
                    onMenuOpenChange={open =>
                      setOpenMenuFileId(open ? file.id : null)
                    }
                    onToggle={toggleFile}
                    onToggleFavorite={toggleFavorite}
                    onRename={requestRename}
                    onShare={requestShare}
                    sharing={sharingFileId === file.id}
                    onDelete={requestDelete}
                    onOpenFile={openImage}
                  />
                ))}
              </div>
            )
          ) : (
            <EmptyLibrary
              hasQuery={Boolean(query) || filter !== "all"}
              onUpload={() => fileInputRef.current?.click()}
            />
          )}
        </div>
      </div>

      <Dialog
        open={Boolean(renameTarget)}
        onOpenChange={open => {
          if (!open) setRenameTarget(null);
        }}
      >
        <DialogContent className="rounded-2xl border bg-background sm:max-w-sm">
          {renameTarget && (
            <RenameFilePanel
              file={renameTarget}
              name={renameValue}
              busy={renameMutation.isPending}
              onCancel={() => setRenameTarget(null)}
              onSave={confirmRename}
              onValueChange={setRenameValue}
            />
          )}
        </DialogContent>
      </Dialog>

      <ConfirmDeleteDialog
        open={Boolean(deleteTarget)}
        onOpenChange={open => {
          if (!open) {
            setDeleteTarget(null);
            setRemoveError(null);
          }
        }}
        title={
          deleteTarget?.length === 1
            ? "Delete this file?"
            : "Remove these files from your library?"
        }
        description={
          deleteTarget?.length === 1
            ? `“${deleteTarget[0]?.filename}” will be permanently removed from your private Library.`
            : `${deleteTarget?.length ?? 0} items will be permanently removed from your private Library.`
        }
        confirmLabel="Delete"
        busy={removing}
        error={removeError}
        onConfirm={confirmRemoval}
      />
      {openedFile && (
        <KsemoFilePreviewOverlay
          file={openedFile}
          onClose={() => setOpenedFile(null)}
        />
      )}
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
        title="Library image"
      />
    </main>
  );
}

const LIBRARY_FILTERS: readonly { value: LibraryFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "images", label: "Images" },
  { value: "files", label: "Files" },
  { value: "favorites", label: "Favorites" },
];

const LIBRARY_VIEWS: readonly {
  value: LibraryView;
  label: string;
  icon: React.ReactNode;
}[] = [
  {
    value: "grid",
    label: "Grid",
    icon: <Grid2X2 className="size-3.5 sm:size-4" />,
  },
  {
    value: "list",
    label: "List",
    icon: <List className="size-3.5 sm:size-4" />,
  },
];

function SegmentedTags<T extends string>({
  options,
  value,
  onChange,
  description,
  iconsOnlyOnMobile = false,
  compactOnMobile = false,
  comfortableOnMobile = false,
  className,
}: {
  options: readonly { value: T; label: string; icon?: React.ReactNode }[];
  value: T;
  onChange: (value: T) => void;
  description: string;
  iconsOnlyOnMobile?: boolean;
  compactOnMobile?: boolean;
  comfortableOnMobile?: boolean;
  className?: string;
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [thumb, setThumb] = useState<{ left: number; width: number } | null>(
    null
  );

  const measure = useCallback(() => {
    if (typeof window === "undefined") return;
    const track = trackRef.current;
    if (!track) return;
    let target: HTMLElement | null = null;
    for (const child of Array.from(track.children)) {
      if (
        child instanceof HTMLElement &&
        child.getAttribute("data-value") === value
      ) {
        target = child;
        break;
      }
    }
    if (!target) return;
    const trackRect = track.getBoundingClientRect();
    const targetRect = target.getBoundingClientRect();
    setThumb({
      left: targetRect.left - trackRect.left - track.clientLeft,
      width: targetRect.width,
    });
  }, [value]);

  useLayoutEffect(() => {
    measure();
  }, [measure]);

  useEffect(() => {
    const onResize = () => measure();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [measure]);

  return (
    <div
      ref={trackRef}
      className={cn(
        "animate-[ksemo-tag-pop_400ms_ease-out_both] relative flex shrink-0 items-center rounded-xl border border-border bg-card p-0.5 sm:p-1",
        className
      )}
      role="group"
      aria-label={description}
    >
      <span
        aria-hidden="true"
        className={cn(
          "absolute rounded-lg bg-foreground text-background transition-[left,width] duration-300 ease-out top-0.5 bottom-0.5 sm:top-1 sm:bottom-1",
          thumb ? "opacity-100" : "opacity-0"
        )}
        style={thumb ? { left: thumb.left, width: thumb.width } : undefined}
      />
      {options.map(option => {
        const active = option.value === value;
        return (
          <button
            type="button"
            key={option.value}
            data-value={option.value}
            onClick={() => onChange(option.value)}
            aria-pressed={active}
            className={cn(
              "relative z-10 flex items-center justify-center gap-1.5 whitespace-nowrap rounded-lg text-xs font-medium outline-none transition-colors duration-200 sm:px-3 sm:py-1.5 sm:text-sm",
              compactOnMobile
                ? "size-8 px-0 py-0 sm:size-auto"
                : comfortableOnMobile
                  ? "px-2.5 py-1.5"
                  : "px-2.5 py-1",
              active
                ? "text-background"
                : "text-muted-foreground hover:bg-accent hover:text-foreground"
            )}
          >
            {option.icon}
            <span className={iconsOnlyOnMobile ? "sr-only sm:not-sr-only" : undefined}>
              {option.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}
function SelectionCircle({ selected }: { selected: boolean }) {
  return (
    <span
      className={cn(
        "flex size-5 items-center justify-center rounded-full border transition-colors",
        selected
          ? "border-muted-foreground bg-muted-foreground text-background"
          : "border-muted-foreground/40 bg-muted-foreground/5 text-transparent"
      )}
    >
      <Check className="size-3.5 stroke-[3]" />
    </span>
  );
}
function EmptyLibrary({
  hasQuery,
  onUpload,
}: {
  hasQuery: boolean;
  onUpload: () => void;
}) {
  return (
    <div className="grid min-h-72 place-items-center rounded-2xl border border-dashed border-border bg-muted/20 p-7 text-center">
      <div>
        <FolderOpen className="mx-auto size-10 text-muted-foreground" />
        <h2 className="mt-4 text-base font-medium">
          {hasQuery ? "No items match this view" : "Your Library is ready"}
        </h2>
        <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-muted-foreground">
          {hasQuery
            ? "Try another search or choose a different filter."
            : "Upload private files or images to keep them ready for future KSEMO conversations."}
        </p>
        {!hasQuery && (
          <Button onClick={onUpload} className="mt-5 rounded-xl">
            <Upload className="mr-2 size-4" />
            Upload your first files
          </Button>
        )}
      </div>
    </div>
  );
}

function FilePreview({
  file,
  compact = false,
}: {
  file: LibraryWorkspaceFile;
  compact?: boolean;
}) {
  const image = isImageFile(file.filename, file.mimeType);
  if (image)
    return (
      <img
        src={file.url}
        alt=""
        className={cn(
          "object-cover",
          compact ? "size-11 rounded-lg" : "size-full"
        )}
      />
    );
  if (compact)
    return <LibraryFormatIcon file={file} className="size-5 shrink-0" />;
  return (
    <span className="flex size-full items-center justify-center bg-muted/45">
      <LibraryFormatIcon file={file} className="size-4" />
    </span>
  );
}

function LibraryFormatIcon({
  file,
  className,
}: {
  file: LibraryWorkspaceFile;
  className: string;
}) {
  if (isImageFile(file.filename, file.mimeType)) {
    return <Gallery3 className={cn(className, "text-foreground")} />;
  }

  const extension = extensionOfFilename(file.filename);
  const mode =
    extension === "pdf"
      ? "pdf"
      : ["doc", "docx"].includes(extension)
        ? "docx"
        : ["xls", "xlsx", "csv", "tsv"].includes(extension)
          ? "xlsx"
          : ["ppt", "pptx"].includes(extension)
            ? "pptx"
            : ["txt", "log", "md", "markdown"].includes(extension)
              ? "txt"
              : null;

  if (mode) {
    const option = getCapabilityOption(mode);
    const Icon = option.icon;
    return (
      <Icon
        className={cn(
          className,
          "text-foreground",
          (mode === "xlsx" || mode === "pptx") && "stroke-[1.5]"
        )}
      />
    );
  }

  return <File className={cn(className, "text-foreground")} />;
}

function libraryFileTypeLabel(file: LibraryWorkspaceFile): string {
  const extension = file.filename.split(".").pop()?.trim().toUpperCase();
  if (!extension || extension === file.filename.toUpperCase()) return "FILE";
  if (extension === "TXT") return "TEXT";
  return extension;
}

const LibraryGridCard = memo(function LibraryGridCard({
  file,
  selected,
  selectionMode,
  isMenuOpen = false,
  onMenuOpenChange,
  onToggle,
  onToggleFavorite,
  onRename,
  onShare,
  sharing,
  onDelete,
  onOpenFile,
}: {
  file: LibraryWorkspaceFile;
  selected: boolean;
  selectionMode: boolean;
  isMenuOpen?: boolean;
  onMenuOpenChange?: (open: boolean) => void;
  onToggle: (id: string) => void;
  onToggleFavorite: (file: LibraryWorkspaceFile) => void;
  onRename: (file: LibraryWorkspaceFile) => void;
  onShare: (file: LibraryWorkspaceFile) => void;
  sharing: boolean;
  onDelete: (file: LibraryWorkspaceFile) => void;
  onOpenFile: (file: LibraryWorkspaceFile) => void;
}) {
  const isFavorite = Boolean(file.isFavorite);
  const { openPdf } = usePdfViewer();
  const isPdfFile = isViewableDocument(file.filename, file.mimeType);
  const handleOpenFile = (event: React.MouseEvent<HTMLAnchorElement>) => {
    event.stopPropagation();
    if (selectionMode) {
      event.preventDefault();
      onToggle(file.id);
      return;
    }
    if (isImageFile(file.filename, file.mimeType)) {
      event.preventDefault();
      onOpenFile(file);
      return;
    }
    if (isPdfFile) {
      event.preventDefault();
      openPdf({
        url: file.url,
        filename: file.filename,
        sizeBytes: file.sizeBytes,
        id: file.id,
      });
    }
  };
  const selectWithKeyboard = (event: React.KeyboardEvent<HTMLElement>) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onToggle(file.id);
    }
  };
  return (
    <article
      onClick={() => onToggle(file.id)}
      onKeyDown={selectWithKeyboard}
      role="button"
      tabIndex={0}
      aria-label={`${selected ? "Deselect" : "Select"} ${file.filename}`}
      aria-pressed={selected}
      className={cn(
        "group relative cursor-pointer overflow-hidden rounded-2xl border bg-card transition-colors focus-visible:outline-none",
        selected ? "border-muted-foreground/50" : "border-border"
      )}
    >
      <div className="flex min-w-0 items-center gap-1.5 px-2 py-1">
        <a
          href={file.url}
          target={isPdfFile || isImageFile(file.filename, file.mimeType) ? undefined : "_blank"}
          rel={isPdfFile || isImageFile(file.filename, file.mimeType) ? undefined : "noreferrer"}
          onClick={handleOpenFile}
          className="min-w-0 flex-1"
          title={file.filename}
        >
          <span className="flex min-w-0 items-center gap-1.5">
            <LibraryFormatIcon file={file} className="size-4 shrink-0" />
            <span className="truncate text-xs font-medium text-foreground hover:underline">
              {file.filename}
            </span>
          </span>
        </a>
        {selectionMode ? (
          <span className="size-[30px] shrink-0" aria-hidden="true" />
        ) : (
        <DropdownMenu open={isMenuOpen} onOpenChange={onMenuOpenChange}>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              onClick={event => event.stopPropagation()}
              className={cn(
                "pointer-events-none flex size-[30px] shrink-0 items-center justify-center rounded-md text-muted-foreground opacity-0 transition-[opacity,color,background-color] group-hover:pointer-events-auto group-hover:opacity-100 group-focus-within:pointer-events-auto group-focus-within:opacity-100 focus-visible:pointer-events-auto focus-visible:opacity-100 hover:bg-accent hover:text-foreground max-lg:pointer-events-auto max-lg:opacity-100",
                isMenuOpen && "pointer-events-auto opacity-100",
                selectionMode && "pointer-events-none opacity-0"
              )}
              aria-label={`More options for ${file.filename}`}
            >
              <MoreVertical className="size-4" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44">
            <DropdownMenuItem
              onClick={event => {
                event.stopPropagation();
                void downloadFile(file.url, file.filename);
              }}
            >
              <Download className="mr-2 size-4" />
              Download
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={event => {
                event.stopPropagation();
                onRename(file);
              }}
            >
              <Pencil className="mr-2 size-4" />
              Rename
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={event => event.stopPropagation()}
              onSelect={event => {
                event.stopPropagation();
                event.preventDefault();
                onShare(file);
              }}
              aria-busy={sharing}
            >
              {sharing ? (
                <span className="loader loader-xs mr-2 text-current" aria-hidden="true" />
              ) : (
                <ShareIcon className="mr-2 size-4" />
              )}
              Share
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={event => {
                event.stopPropagation();
                onToggleFavorite(file);
              }}
            >
              <Star
                className={cn("mr-2 size-4", isFavorite && "fill-current")}
              />
              {isFavorite ? "Remove from favorites" : "Add to favorites"}
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={event => {
                event.stopPropagation();
                onDelete(file);
              }}
              variant="destructive"
            >
              <Trash6Icon className="mr-2 size-4" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        )}
      </div>
      <div className="group/preview relative">
        <a
          href={file.url}
          target={
            isPdfFile || isImageFile(file.filename, file.mimeType)
              ? undefined
              : "_blank"
          }
          rel={
            isPdfFile || isImageFile(file.filename, file.mimeType)
              ? undefined
              : "noreferrer"
          }
          onClick={handleOpenFile}
          className="block aspect-[4/3] bg-muted"
        >
          <FilePreview file={file} />
        </a>
        {!isImageFile(file.filename, file.mimeType) && (
          <span className="pointer-events-none absolute left-1 top-1 rounded bg-sidebar px-1.5 py-0.5 text-[10px] font-medium leading-3 text-sidebar-foreground shadow-sm">
            {libraryFileTypeLabel(file)}
          </span>
        )}
        <div
          className={cn(
            "pointer-events-none absolute bottom-2 left-2 flex max-w-[calc(100%-3.5rem)] items-center gap-1.5 text-xs text-white opacity-0 drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)] transition-opacity group-hover/preview:opacity-100 group-focus-within/preview:opacity-100",
            selectionMode && "invisible"
          )}
        >
          {file.createdAt && <span>{formatDateLabel(file.createdAt)}</span>}
          {isFavorite && (
            <Star className="size-4 shrink-0" />
          )}
        </div>
        <button
          type="button"
          onClick={event => {
            event.stopPropagation();
            onToggle(file.id);
          }}
          className={cn(
            "absolute bottom-3 right-2 rounded-full p-0 opacity-0 transition-opacity group-hover/preview:opacity-100 group-focus-within/preview:opacity-100 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring max-lg:opacity-100",
            (selected || selectionMode) && "opacity-100"
          )}
          aria-label={`${selected ? "Deselect" : "Select"} ${file.filename}`}
          aria-pressed={selected}
        >
          <SelectionCircle selected={selected} />
        </button>
      </div>
    </article>
  );
});

const LibraryListRow = memo(function LibraryListRow({
  file,
  selected,
  selectionMode,
  isMenuOpen = false,
  onMenuOpenChange,
  onToggle,
  onToggleFavorite,
  onRename,
  onShare,
  sharing,
  onDelete,
  onOpenFile,
}: {
  file: LibraryWorkspaceFile;
  selected: boolean;
  selectionMode: boolean;
  isMenuOpen?: boolean;
  onMenuOpenChange?: (open: boolean) => void;
  onToggle: (id: string) => void;
  onToggleFavorite: (file: LibraryWorkspaceFile) => void;
  onRename: (file: LibraryWorkspaceFile) => void;
  onShare: (file: LibraryWorkspaceFile) => void;
  sharing: boolean;
  onDelete: (file: LibraryWorkspaceFile) => void;
  onOpenFile: (file: LibraryWorkspaceFile) => void;
}) {
  const isFavorite = Boolean(file.isFavorite);
  const { openPdf } = usePdfViewer();
  const isPdfFile = isViewableDocument(file.filename, file.mimeType);
  const selectWithKeyboard = (event: React.KeyboardEvent<HTMLElement>) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onToggle(file.id);
    }
  };
  return (
    <article
      onClick={() => onToggle(file.id)}
      onKeyDown={selectWithKeyboard}
      role="button"
      tabIndex={0}
      aria-label={`${selected ? "Deselect" : "Select"} ${file.filename}`}
      aria-pressed={selected}
      className={cn(
        "group flex cursor-pointer items-center gap-3 p-3 transition-colors focus-visible:outline-none",
        selected && "bg-muted/65"
      )}
    >
      <button
        type="button"
        onClick={event => {
          event.stopPropagation();
          onToggle(file.id);
        }}
        className={cn(
          "pointer-events-none rounded-full p-0.5 transition-opacity duration-150 group-hover:pointer-events-auto group-hover:opacity-100 group-focus-within:pointer-events-auto group-focus-within:opacity-100 group-active:pointer-events-auto group-active:opacity-100 focus-visible:pointer-events-auto focus-visible:opacity-100 max-lg:pointer-events-auto max-lg:opacity-100",
          selected || isMenuOpen || selectionMode ? "opacity-100" : "opacity-0"
        )}
        aria-label={`${selected ? "Deselect" : "Select"} ${file.filename}`}
        aria-pressed={selected}
      >
        <SelectionCircle selected={selected} />
      </button>
      <a
        href={file.url}
        target={
          isPdfFile || isImageFile(file.filename, file.mimeType)
            ? undefined
            : "_blank"
        }
        rel={
          isPdfFile || isImageFile(file.filename, file.mimeType)
            ? undefined
            : "noreferrer"
        }
        onClick={event => {
          event.stopPropagation();
          if (selectionMode) {
            event.preventDefault();
            onToggle(file.id);
            return;
          }
          if (isImageFile(file.filename, file.mimeType)) {
            event.preventDefault();
            onOpenFile(file);
            return;
          }
          if (isPdfFile) {
            event.preventDefault();
            openPdf({
              url: file.url,
              filename: file.filename,
              sizeBytes: file.sizeBytes,
              id: file.id,
            });
          }
        }}
        className="shrink-0"
      >
        <FilePreview file={file} compact />
      </a>
      <a
        href={file.url}
        target={
          isPdfFile || isImageFile(file.filename, file.mimeType)
            ? undefined
            : "_blank"
        }
        rel={
          isPdfFile || isImageFile(file.filename, file.mimeType)
            ? undefined
            : "noreferrer"
        }
        onClick={event => {
          event.stopPropagation();
          if (selectionMode) {
            event.preventDefault();
            onToggle(file.id);
            return;
          }
          if (isImageFile(file.filename, file.mimeType)) {
            event.preventDefault();
            onOpenFile(file);
            return;
          }
          if (isPdfFile) {
            event.preventDefault();
            openPdf({
              url: file.url,
              filename: file.filename,
              sizeBytes: file.sizeBytes,
              id: file.id,
            });
          }
        }}
        className="min-w-0 flex-1"
      >
        <span className="flex min-w-0 items-center gap-1.5">
          <span className="min-w-0 truncate text-sm font-medium hover:underline">
            {file.filename}
          </span>
          {!isImageFile(file.filename, file.mimeType) && (
            <span className="inline-flex shrink-0 rounded bg-sidebar px-1.5 py-0.5 text-[10px] font-medium leading-3 text-sidebar-foreground shadow-sm">
              {libraryFileTypeLabel(file)}
            </span>
          )}
        </span>
        <p
          className={cn(
            "mt-0.5 text-xs text-muted-foreground",
            selectionMode && "invisible"
          )}
        >
          {formatDateLabel(file.createdAt)}
        </p>
      </a>
      <div className="shrink-0">
        {selectionMode ? (
          <span className="size-[30px]" aria-hidden="true" />
        ) : (
        <DropdownMenu open={isMenuOpen} onOpenChange={onMenuOpenChange}>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              onClick={event => event.stopPropagation()}
              className={cn(
                "pointer-events-none flex size-[30px] items-center justify-center rounded-md text-muted-foreground opacity-0 transition-[opacity,color,background-color] group-hover:pointer-events-auto group-hover:opacity-100 group-focus-within:pointer-events-auto group-focus-within:opacity-100 focus-visible:pointer-events-auto focus-visible:opacity-100 hover:bg-accent hover:text-foreground max-lg:pointer-events-auto max-lg:opacity-100",
                isMenuOpen && "pointer-events-auto opacity-100",
                selectionMode && "pointer-events-none opacity-0"
              )}
              aria-label={`More options for ${file.filename}`}
            >
              <MoreVertical className="size-4" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44">
            <DropdownMenuItem
              onClick={event => {
                event.stopPropagation();
                void downloadFile(file.url, file.filename);
              }}
            >
              <Download className="mr-2 size-4" />
              Download
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={event => {
                event.stopPropagation();
                onRename(file);
              }}
            >
              <Pencil className="mr-2 size-4" />
              Rename
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={event => event.stopPropagation()}
              onSelect={event => {
                event.stopPropagation();
                event.preventDefault();
                onShare(file);
              }}
              aria-busy={sharing}
            >
              {sharing ? (
                <span className="loader loader-xs mr-2 text-current" aria-hidden="true" />
              ) : (
                <ShareIcon className="mr-2 size-4" />
              )}
              Share
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={event => {
                event.stopPropagation();
                onToggleFavorite(file);
              }}
            >
              <Star
                className={cn("mr-2 size-4", isFavorite && "fill-current")}
              />
              {isFavorite ? "Remove from favorites" : "Add to favorites"}
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={event => {
                event.stopPropagation();
                onDelete(file);
              }}
              variant="destructive"
            >
              <Trash6Icon className="mr-2 size-4" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        )}
      </div>
    </article>
  );
});

function formatDateLabel(date: Date | undefined): string {
  if (!date) return "";
  if (isToday(date)) return "Today";
  if (isYesterday(date)) return "Yesterday";
  if (isThisYear(date)) return format(date, "MMM d");
  return format(date, "MMM d, yyyy");
}

function RenameFilePanel({
  file,
  name,
  busy,
  onCancel,
  onSave,
  onValueChange,
}: {
  file: LibraryWorkspaceFile;
  name: string;
  busy: boolean;
  onCancel: () => void;
  onSave: () => void;
  onValueChange: (value: string) => void;
}) {
  const extension = splitLibraryFilename(file.filename).extension;
  const displayedFilename = `${name}${extension}`;
  const handleFocus = (event: React.FocusEvent<HTMLInputElement>) => {
    const input = event.currentTarget;
    requestAnimationFrame(() => {
      const end = name.length;
      input.setSelectionRange(end, end);
      input.scrollLeft = input.scrollWidth;
    });
  };
  const clampSelectionToName = (
    event: React.MouseEvent<HTMLInputElement>
  ) => {
    if (!extension) return;
    const input = event.currentTarget;
    requestAnimationFrame(() => {
      const start = Math.min(input.selectionStart ?? name.length, name.length);
      const end = Math.min(input.selectionEnd ?? start, name.length);
      input.setSelectionRange(start, end);
    });
  };
  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (!extension) return;
    const input = event.currentTarget;
    const start = input.selectionStart ?? 0;
    const end = input.selectionEnd ?? start;
    if (start > name.length || end > name.length) {
      input.setSelectionRange(name.length, name.length);
    }
    if (
      (event.key === "ArrowRight" && start >= name.length) ||
      event.key === "End" ||
      (event.key === "Delete" && start >= name.length)
    ) {
      event.preventDefault();
    }
  };
  const handleNameChange = (value: string) => {
    if (!extension) {
      onValueChange(value);
      return;
    }
    const lowerValue = value.toLowerCase();
    const lowerExtension = extension.toLowerCase();
    if (lowerValue.endsWith(lowerExtension)) {
      onValueChange(value.slice(0, -extension.length));
      return;
    }
    const typedExtensionStart = value.lastIndexOf(".");
    onValueChange(
      typedExtensionStart > 0 ? value.slice(0, typedExtensionStart) : value
    );
  };
  return (
    <div className="py-1">
      <div className="space-y-1">
        <h2 className="text-lg font-semibold tracking-[-0.02em]">
          Rename file
        </h2>
        <p className="text-sm leading-relaxed text-muted-foreground">
          Rename the file while keeping its extension unchanged.
        </p>
      </div>
      <div className="mt-4">
        <Input
          autoFocus
          value={displayedFilename}
          onChange={event => handleNameChange(event.target.value)}
          onFocus={handleFocus}
          onClick={clampSelectionToName}
          onMouseUp={clampSelectionToName}
          onKeyDown={event => {
            handleKeyDown(event);
            if (event.key === "Enter") {
              event.preventDefault();
              if (name.trim()) onSave();
            }
          }}
          aria-label="New file name"
          className="h-11 rounded-xl text-base"
        />
      </div>
      <div className="mt-5 flex items-center justify-end gap-2">
        <Button
          variant="ghost"
          onClick={onCancel}
          className="h-9 rounded-lg px-4"
        >
          Cancel
        </Button>
        <Button
          onClick={onSave}
          disabled={!name.trim() || busy}
          className="h-9 rounded-lg bg-foreground px-5 text-background hover:bg-foreground/90"
        >
          {busy ? "Renaming…" : "Save"}
        </Button>
      </div>
    </div>
  );
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB"];
  let value = bytes / 1024;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value.toFixed(value >= 10 ? 0 : 1)} ${units[unit]}`;
}
