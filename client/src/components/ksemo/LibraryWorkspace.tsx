import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loading } from "@/components/ui/loading";
import { trpc } from "@/lib/trpc";
import { ConfirmDeleteDialog } from "./ConfirmDeleteDialog";
import { KsemoFilePreviewOverlay } from "./KsemoFilePreviewOverlay";
import { usePdfViewer, isViewableDocument } from "@/contexts/PdfViewerContext";
import {
  fileVisualFor,
  guessMimeType,
  isSupportedUpload,
} from "@/lib/fileIcons";
import { format, isToday, isYesterday, isThisYear } from "date-fns";
import { cn } from "@/lib/utils";
import {
  Check,
  CheckCheck,
  CheckCircle2,
  ChevronsRight,
  Download,
  FolderOpen,
  Grid2X2,
  Library,
  List,
  MessageCircle,
  MoreVertical,
  Pencil,
  Search,
  Star,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ShareIcon } from "./icons";
import { downloadFile } from "@/lib/downloadFile";
import React, {
  memo,
  useCallback,
  type ChangeEvent,
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

function bytesLabel(bytes: number) {
  return bytes < 1024
    ? `${bytes} B`
    : bytes < 1024 * 1024
      ? `${Math.round(bytes / 1024)} KB`
      : `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
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
  const [filter, setFilter] = useState<LibraryFilter>("all");
  const [view, setView] = useState<LibraryView>("grid");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [deleteTarget, setDeleteTarget] = useState<
    LibraryWorkspaceFile[] | null
  >(null);
  const [renameTarget, setRenameTarget] = useState<LibraryWorkspaceFile | null>(
    null
  );
  const [shareTarget, setShareTarget] = useState<LibraryWorkspaceFile | null>(
    null
  );
  const [isDragging, setIsDragging] = useState(false);
  const { openPdf } = usePdfViewer();
  const [openedFile, setOpenedFile] = useState<LibraryWorkspaceFile | null>(
    null
  );
  const [openMenuFileId, setOpenMenuFileId] = useState<string | null>(null);
  const initialOpenedRef = useRef(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const utils = trpc.useUtils();
  const invalidateFiles = () => utils.workspace.files.list.invalidate();
  const filesQuery = trpc.workspace.files.list.useQuery();

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
      if (isViewableDocument(file.filename, file.mimeType)) {
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
  }, [initialFileId, filesQuery.data, openPdf]);
  const uploadMutation = trpc.workspace.files.upload.useMutation({
    onSuccess: invalidateFiles,
    onError: () => {},
  });
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
    (file: LibraryWorkspaceFile) => setRenameTarget(file),
    []
  );

  async function confirmRename() {
    if (!renameTarget) return;
    const newName = renameTarget.filename.trim();
    if (!newName) return;
    try {
      await renameMutation.mutateAsync({
        id: renameTarget.id,
        filename: newName,
      });
      setRenameTarget(null);
    } catch {
      // The mutation-level message provides the actionable error state.
    }
  }

  const requestShare = useCallback(
    (file: LibraryWorkspaceFile) => setShareTarget(file),
    []
  );

  function selectVisibleFiles() {
    setSelectedIds(current => selectVisibleLibraryItems(current, files));
  }

  async function confirmRemoval() {
    if (!deleteTarget?.length) return;
    try {
      await Promise.all(
        deleteTarget.map(file => removeMutation.mutateAsync({ id: file.id }))
      );
      setSelectedIds(current => {
        const next = new Set(current);
        for (const file of deleteTarget) next.delete(file.id);
        return next;
      });
      setDeleteTarget(null);
      await invalidateFiles();
    } catch {
      // The mutation-level message provides the actionable error state.
    }
  }

  function chatWithSelected() {
    if (!selectedFiles.length) return;
    onChatWithFiles?.(selectedFiles);
  }

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
        <header className="flex flex-col gap-3 border-b border-border pb-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex w-full items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 sm:gap-3">
                {onOpenSidebar && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={onOpenSidebar}
                    className="size-8 sm:size-9 shrink-0 rounded-xl text-foreground transition-colors hover:bg-accent active:scale-95 lg:hidden"
                    aria-label="Open conversations"
                    title="Open sidebar"
                  >
                    <ChevronsRight className="size-4 sm:size-5" />
                  </Button>
                )}
                <h1 className="text-2xl font-semibold tracking-[-0.03em]">
                  Library
                </h1>
              </div>
              <p className="mt-1 max-w-xl text-xs sm:text-sm text-muted-foreground">
                Your private space for files and images you can chat about.
              </p>
            </div>
            <Button
              size="sm"
              className="h-8 rounded-xl bg-foreground text-xs text-background hover:bg-foreground/90 sm:hidden"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadMutation.isPending}
            >
              <Upload className="mr-1.5 size-3.5" />
              {uploadMutation.isPending ? "Uploading…" : "Upload files"}
            </Button>
          </div>
          <div className="hidden shrink-0 flex-wrap items-center gap-2 sm:flex">
            <Button
              size="sm"
              className="h-8 sm:h-9 rounded-xl bg-foreground text-xs sm:text-sm text-background hover:bg-foreground/90"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadMutation.isPending}
            >
              <Upload className="mr-1.5 sm:mr-2 size-3.5 sm:size-4" />
              {uploadMutation.isPending ? "Uploading…" : "Upload files"}
            </Button>
          </div>
        </header>

        <section className="mt-3.5 sm:mt-6 flex flex-col gap-2.5 xl:flex-row xl:items-center xl:justify-between">
          <div className="relative w-full xl:max-w-md">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={event => setQuery(event.target.value)}
              className={cn("h-9 sm:h-10 rounded-xl pl-9 text-xs sm:text-sm", query && "pr-9")}
              placeholder="Search your Library"
              aria-label="Search your Library"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-md p-1 text-muted-foreground transition-colors hover:text-foreground"
                aria-label="Clear search query"
              >
                <X className="size-3.5 sm:size-4" />
              </button>
            )}
          </div>
          <div className="flex items-center justify-between gap-1.5 sm:gap-2 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <div
              className="flex shrink-0 rounded-xl border border-border bg-card p-0.5 sm:p-1"
              role="group"
              aria-label="Filter Library"
            >
              <FilterButton
                label="All"
                active={filter === "all"}
                onClick={() => setFilter("all")}
              />
              <FilterButton
                label="Images"
                active={filter === "images"}
                onClick={() => setFilter("images")}
              />
              <FilterButton
                label="Files"
                active={filter === "files"}
                onClick={() => setFilter("files")}
              />
              <FilterButton
                label="Favorites"
                active={filter === "favorites"}
                onClick={() => setFilter("favorites")}
              />
            </div>
            <div
              className="flex shrink-0 rounded-xl border border-border bg-card p-0.5 sm:p-1"
              role="group"
              aria-label="Library view"
            >
              <ViewButton
                label="Grid"
                icon={<Grid2X2 className="size-3.5 sm:size-4" />}
                active={view === "grid"}
                onClick={() => setView("grid")}
              />
              <ViewButton
                label="List"
                icon={<List className="size-3.5 sm:size-4" />}
                active={view === "list"}
                onClick={() => setView("list")}
              />
            </div>
          </div>
        </section>

        {selectedFiles.length > 0 && (
          <>
            {/* Mobile Selection Toolbar: Decent bottom-fixed action bar */}
            <div
              className="fixed bottom-0 inset-x-0 z-40 flex sm:hidden items-center justify-between gap-2 border-t border-border/80 bg-card/95 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-2xl backdrop-blur-xl animate-in slide-in-from-bottom-5 duration-200 select-none"
              aria-label="Selected Library actions"
            >
              <div className="flex items-center gap-2 min-w-0">
                <div className="flex h-8 shrink-0 items-center gap-1.5 rounded-full bg-foreground px-3 text-background shadow-xs">
                  <CheckCircle2 className="size-3.5" />
                  <span className="text-xs font-bold tabular-nums">
                    {selectedFiles.length}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedIds(new Set())}
                  className="flex h-8 items-center gap-1.5 rounded-full bg-muted/70 px-3 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground active:scale-95"
                >
                  <X className="size-3.5" />
                  <span>Clear</span>
                </button>
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={selectVisibleFiles}
                  disabled={allVisibleSelected}
                  className="flex h-8 items-center gap-1.5 rounded-full bg-muted/70 px-3 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground disabled:opacity-40 active:scale-95"
                >
                  <CheckCheck className="size-3.5" />
                  <span>All</span>
                </button>

                <button
                  type="button"
                  onClick={chatWithSelected}
                  className="flex h-8 items-center gap-1.5 rounded-full bg-foreground px-4 text-xs font-semibold text-background shadow-sm transition-all hover:bg-foreground/90 active:scale-95"
                >
                  <MessageCircle className="size-3.5" />
                  <span>Chat</span>
                </button>

                <button
                  type="button"
                  onClick={() => setDeleteTarget(selectedFiles)}
                  className="flex size-8 items-center justify-center rounded-full bg-muted/70 text-muted-foreground transition-all hover:bg-destructive/10 hover:text-destructive active:scale-95"
                  aria-label="Remove selected"
                >
                  <Trash2 className="size-4" />
                </button>
              </div>
            </div>

            {/* Desktop / Laptop Selection Toolbar: exact original design preserved */}
            <div
              className="hidden sm:flex sticky top-3 z-20 mt-4 w-fit max-w-full flex-wrap items-center justify-center gap-1.5 rounded-[1.25rem] border border-border/70 bg-card/95 p-1.5 pl-2 shadow-xl shadow-black/5 backdrop-blur-lg select-none"
              aria-label="Selected Library actions"
            >
              <div className="flex h-9 min-w-0 items-center gap-1.5 rounded-full bg-foreground px-3.5 text-background shadow-md">
                <CheckCircle2 className="size-4" />
                <span className="text-sm font-bold tracking-[-0.02em]">
                  {selectedFiles.length}
                </span>
                <span className="text-xs font-medium text-background/70">
                  selected
                </span>
              </div>

              <button
                type="button"
                onClick={selectVisibleFiles}
                disabled={allVisibleSelected}
                className="flex h-9 items-center gap-1.5 rounded-full bg-muted/60 px-3.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:pointer-events-none disabled:opacity-40"
              >
                <CheckCheck className="size-4" />
                <span className="text-xs font-semibold">Select all</span>
              </button>

              <button
                type="button"
                onClick={() => setSelectedIds(new Set())}
                className="flex h-9 items-center gap-1.5 rounded-full bg-muted/60 px-3.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              >
                <X className="size-4" />
                <span className="text-xs font-semibold">Clear</span>
              </button>

              <button
                type="button"
                onClick={chatWithSelected}
                className="flex h-9 items-center gap-1.5 rounded-full bg-foreground px-4.5 text-background shadow-md transition-colors hover:bg-foreground/90"
              >
                <MessageCircle className="size-4" />
                <span className="text-xs font-semibold">Chat</span>
              </button>

              <button
                type="button"
                onClick={() => setDeleteTarget(selectedFiles)}
                className="flex h-9 items-center gap-1.5 rounded-full bg-muted/60 px-3.5 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
              >
                <Trash2 className="size-4" />
                <span className="text-xs font-semibold">
                  {selectedFiles.length === allFiles.length &&
                  allFiles.length > 1
                    ? "Remove all"
                    : "Remove"}
                </span>
              </button>
            </div>
          </>
        )}

        <div
          className={cn(
            "mt-4 sm:mt-5 min-h-0 flex-1 overflow-y-auto pb-10",
            selectedFiles.length > 0 && "pb-24 sm:pb-10"
          )}
        >
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
                    isMenuOpen={openMenuFileId === file.id}
                    onMenuOpenChange={open =>
                      setOpenMenuFileId(open ? file.id : null)
                    }
                    onToggle={toggleFile}
                    onToggleFavorite={toggleFavorite}
                    onRename={requestRename}
                    onShare={requestShare}
                    onDelete={requestDelete}
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
                    isMenuOpen={openMenuFileId === file.id}
                    onMenuOpenChange={open =>
                      setOpenMenuFileId(open ? file.id : null)
                    }
                    onToggle={toggleFile}
                    onToggleFavorite={toggleFavorite}
                    onRename={requestRename}
                    onShare={requestShare}
                    onDelete={requestDelete}
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
              busy={renameMutation.isPending}
              onCancel={() => setRenameTarget(null)}
              onSave={confirmRename}
              onValueChange={filename =>
                setRenameTarget(current =>
                  current ? { ...current, filename } : current
                )
              }
            />
          )}
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(shareTarget)}
        onOpenChange={open => {
          if (!open) setShareTarget(null);
        }}
      >
        <DialogContent className="rounded-2xl sm:max-w-md">
          {shareTarget && (
            <ShareFilePanel
              file={shareTarget}
              onClose={() => setShareTarget(null)}
            />
          )}
        </DialogContent>
      </Dialog>

      <ConfirmDeleteDialog
        open={Boolean(deleteTarget)}
        onOpenChange={open => {
          if (!open) setDeleteTarget(null);
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
        busy={removeMutation.isPending}
        onConfirm={confirmRemoval}
      />
      {openedFile && (
        <KsemoFilePreviewOverlay
          file={openedFile}
          onClose={() => setOpenedFile(null)}
        />
      )}
    </main>
  );
}

function FilterButton({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "rounded-lg px-2.5 sm:px-3 py-1 sm:py-1.5 text-xs sm:text-sm font-medium transition-colors",
        active
          ? "bg-foreground text-background"
          : "text-muted-foreground hover:bg-accent hover:text-foreground"
      )}
    >
      {label}
    </button>
  );
}
function ViewButton({
  label,
  icon,
  active,
  onClick,
}: {
  label: string;
  icon: React.ReactNode;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex items-center gap-1 sm:gap-1.5 rounded-lg px-2 sm:px-3 py-1 sm:py-1.5 text-xs sm:text-sm font-medium transition-colors",
        active
          ? "bg-foreground text-background"
          : "text-muted-foreground hover:bg-accent hover:text-foreground"
      )}
      aria-pressed={active}
    >
      {icon}
      {label}
    </button>
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
  const image = file.mimeType?.startsWith("image/");
  const visual = fileVisualFor(file.filename, file.mimeType);
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
    return <visual.Icon className={cn("size-10 shrink-0", visual.className)} />;
  return (
    <span className="flex size-full items-center justify-center bg-muted/45">
      <visual.Icon className={cn("size-12", visual.className)} />
    </span>
  );
}

const LibraryGridCard = memo(function LibraryGridCard({
  file,
  selected,
  isMenuOpen = false,
  onMenuOpenChange,
  onToggle,
  onToggleFavorite,
  onRename,
  onShare,
  onDelete,
}: {
  file: LibraryWorkspaceFile;
  selected: boolean;
  isMenuOpen?: boolean;
  onMenuOpenChange?: (open: boolean) => void;
  onToggle: (id: string) => void;
  onToggleFavorite: (file: LibraryWorkspaceFile) => void;
  onRename: (file: LibraryWorkspaceFile) => void;
  onShare: (file: LibraryWorkspaceFile) => void;
  onDelete: (file: LibraryWorkspaceFile) => void;
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
        "group relative cursor-pointer overflow-hidden rounded-2xl border bg-card transition-colors focus-visible:outline-none",
        selected ? "border-muted-foreground/50" : "border-border"
      )}
    >
      <button
        type="button"
        onClick={event => {
          event.stopPropagation();
          onToggle(file.id);
        }}
        className={cn(
          "pointer-events-none absolute left-2.5 top-2.5 z-10 rounded-full p-0.5 transition-[opacity,transform] duration-150 group-hover:pointer-events-auto group-hover:scale-100 group-hover:opacity-100 group-focus-within:pointer-events-auto group-focus-within:scale-100 group-focus-within:opacity-100 group-active:pointer-events-auto group-active:scale-100 group-active:opacity-100 focus-visible:pointer-events-auto focus-visible:scale-100 focus-visible:opacity-100 max-lg:pointer-events-auto max-lg:scale-100 max-lg:opacity-100",
          selected || isMenuOpen
            ? "scale-100 opacity-100"
            : "scale-90 opacity-0"
        )}
        aria-label={`${selected ? "Deselect" : "Select"} ${file.filename}`}
        aria-pressed={selected}
      >
        <SelectionCircle selected={selected} />
      </button>
      {!selected && (
        <div
          className={cn(
            "pointer-events-none absolute right-2.5 top-2.5 z-10 scale-90 opacity-0 transition-[opacity,transform] duration-150 group-hover:pointer-events-auto group-hover:scale-100 group-hover:opacity-100 group-focus-within:pointer-events-auto group-focus-within:scale-100 group-focus-within:opacity-100 group-active:pointer-events-auto group-active:scale-100 group-active:opacity-100 focus-visible:pointer-events-auto focus-visible:scale-100 focus-visible:opacity-100 max-lg:pointer-events-auto max-lg:scale-100 max-lg:opacity-100",
            isMenuOpen && "pointer-events-auto scale-100 opacity-100"
          )}
        >
          <DropdownMenu open={isMenuOpen} onOpenChange={onMenuOpenChange}>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                onClick={event => event.stopPropagation()}
                className="flex size-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
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
                onClick={event => {
                  event.stopPropagation();
                  onShare(file);
                }}
              >
                <ShareIcon className="mr-2 size-4" />
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
                <Trash2 className="mr-2 size-4" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )}
      <a
        href={file.url}
        target={isPdfFile ? undefined : "_blank"}
        rel={isPdfFile ? undefined : "noreferrer"}
        onClick={event => {
          event.stopPropagation();
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
        className="block aspect-[4/3] bg-muted"
      >
        <FilePreview file={file} />
      </a>
      <div className="p-3">
        <a
          href={file.url}
          target={isPdfFile ? undefined : "_blank"}
          rel={isPdfFile ? undefined : "noreferrer"}
          onClick={event => {
            event.stopPropagation();
            if (isPdfFile) {
              event.preventDefault();
              openPdf({
                url: file.url,
                filename: file.filename,
                sizeBytes: file.sizeBytes,
              });
            }
          }}
          className="block"
        >
          <p className="truncate text-sm font-medium hover:underline">
            {file.filename}
          </p>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            {formatDateLabel(file.createdAt)}
          </p>
        </a>
      </div>
    </article>
  );
});

const LibraryListRow = memo(function LibraryListRow({
  file,
  selected,
  isMenuOpen = false,
  onMenuOpenChange,
  onToggle,
  onToggleFavorite,
  onRename,
  onShare,
  onDelete,
}: {
  file: LibraryWorkspaceFile;
  selected: boolean;
  isMenuOpen?: boolean;
  onMenuOpenChange?: (open: boolean) => void;
  onToggle: (id: string) => void;
  onToggleFavorite: (file: LibraryWorkspaceFile) => void;
  onRename: (file: LibraryWorkspaceFile) => void;
  onShare: (file: LibraryWorkspaceFile) => void;
  onDelete: (file: LibraryWorkspaceFile) => void;
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
          "pointer-events-none rounded-full p-0.5 transition-[opacity,transform] duration-150 group-hover:pointer-events-auto group-hover:scale-100 group-hover:opacity-100 group-focus-within:pointer-events-auto group-focus-within:scale-100 group-focus-within:opacity-100 group-active:pointer-events-auto group-active:scale-100 group-active:opacity-100 focus-visible:pointer-events-auto focus-visible:scale-100 focus-visible:opacity-100 max-lg:pointer-events-auto max-lg:scale-100 max-lg:opacity-100",
          selected || isMenuOpen
            ? "scale-100 opacity-100"
            : "scale-90 opacity-0"
        )}
        aria-label={`${selected ? "Deselect" : "Select"} ${file.filename}`}
        aria-pressed={selected}
      >
        <SelectionCircle selected={selected} />
      </button>
      <a
        href={file.url}
        target={isPdfFile ? undefined : "_blank"}
        rel={isPdfFile ? undefined : "noreferrer"}
        onClick={event => {
          event.stopPropagation();
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
        target={isPdfFile ? undefined : "_blank"}
        rel={isPdfFile ? undefined : "noreferrer"}
        onClick={event => {
          event.stopPropagation();
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
        <p className="truncate text-sm font-medium hover:underline">
          {file.filename}
        </p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {formatDateLabel(file.createdAt)}
        </p>
      </a>
      {!selected && (
        <div
          className={cn(
            "pointer-events-none scale-90 opacity-0 transition-[opacity,transform] duration-150 group-hover:pointer-events-auto group-hover:scale-100 group-hover:opacity-100 group-focus-within:pointer-events-auto group-focus-within:scale-100 group-focus-within:opacity-100 group-active:pointer-events-auto group-active:scale-100 group-active:opacity-100 focus-visible:pointer-events-auto focus-visible:scale-100 focus-visible:opacity-100 max-lg:pointer-events-auto max-lg:scale-100 max-lg:opacity-100",
            isMenuOpen && "pointer-events-auto scale-100 opacity-100"
          )}
        >
          <DropdownMenu open={isMenuOpen} onOpenChange={onMenuOpenChange}>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                onClick={event => event.stopPropagation()}
                className="flex size-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
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
                onClick={event => {
                  event.stopPropagation();
                  onShare(file);
                }}
              >
                <ShareIcon className="mr-2 size-4" />
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
                <Trash2 className="mr-2 size-4" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )}
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
  busy,
  onCancel,
  onSave,
  onValueChange,
}: {
  file: LibraryWorkspaceFile;
  busy: boolean;
  onCancel: () => void;
  onSave: () => void;
  onValueChange: (value: string) => void;
}) {
  const handleFocus = (event: React.FocusEvent<HTMLInputElement>) => {
    const input = event.currentTarget;
    requestAnimationFrame(() => {
      const end = input.value.length;
      input.setSelectionRange(end, end);
      input.scrollLeft = input.scrollWidth;
    });
  };
  return (
    <div className="py-1">
      <div className="space-y-1">
        <h2 className="text-lg font-semibold tracking-[-0.02em]">
          Rename file
        </h2>
        <p className="text-sm leading-relaxed text-muted-foreground">
          Give this file a new name. Its format will stay the same.
        </p>
      </div>
      <div className="mt-4">
        <Input
          autoFocus
          value={file.filename}
          onChange={event => onValueChange(event.target.value)}
          onFocus={handleFocus}
          onKeyDown={event => {
            if (event.key === "Enter") {
              event.preventDefault();
              if (file.filename.trim()) onSave();
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
          disabled={!file.filename.trim() || busy}
          className="h-9 rounded-lg bg-foreground px-5 text-background hover:bg-foreground/90"
        >
          {busy ? "Renaming…" : "Save"}
        </Button>
      </div>
    </div>
  );
}

function ShareFilePanel({
  file,
  onClose,
}: {
  file: LibraryWorkspaceFile;
  onClose: () => void;
}) {
  const [email, setEmail] = useState("");
  const shareUrl = file.url;
  async function copyLink() {
    try {
      await navigator.clipboard.writeText(shareUrl);
    } catch {
      // ignore copy failure
    }
  }
  function emailLink() {
    const subject = encodeURIComponent(`Share: ${file.filename}`);
    const body = encodeURIComponent(`${file.filename}\n\n${shareUrl}`);
    window.location.href = `mailto:${email.trim()}?subject=${subject}&body=${body}`;
  }
  return (
    <div className="space-y-4 py-2">
      <DialogHeader className="text-left">
        <DialogTitle className="text-xl font-semibold tracking-[-0.02em]">
          Share file
        </DialogTitle>
        <DialogDescription>
          Send “{file.filename}” to anyone by sharing its link.
        </DialogDescription>
      </DialogHeader>
      <div className="rounded-xl border border-border bg-muted/60 p-3">
        <p className="text-sm font-medium">File link</p>
        <p className="mt-1 text-xs leading-5 text-muted-foreground">
          Anyone with this link can open the file. Only you can delete or rename
          it.
        </p>
        <div className="mt-3 flex gap-2">
          <Input
            value={shareUrl}
            readOnly
            className="h-9 min-w-0 rounded-lg text-xs"
            aria-label="File link"
          />
          <Button onClick={copyLink} className="h-9 shrink-0 rounded-lg">
            Copy link
          </Button>
        </div>
      </div>
      <div className="rounded-xl border border-border p-3">
        <Label htmlFor="share-file-email" className="text-sm">
          Email
        </Label>
        <p className="mt-1 text-xs leading-5 text-muted-foreground">
          Open your email app with the link included. Sending remains under your
          control.
        </p>
        <div className="mt-3 flex gap-2">
          <Input
            id="share-file-email"
            value={email}
            onChange={event => setEmail(event.target.value)}
            placeholder="recipient@example.com"
            type="email"
            className="h-9 rounded-lg"
          />
          <Button
            onClick={emailLink}
            className="h-9 shrink-0 rounded-lg"
            disabled={!email.trim()}
          >
            Email
          </Button>
        </div>
      </div>
    </div>
  );
}
