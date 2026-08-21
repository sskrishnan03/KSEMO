import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import {
  Check,
  CheckCircle2,
  FileImage,
  FileText,
  FolderOpen,
  Grid2X2,
  Image,
  Library,
  List,
  MessageSquareText,
  Search,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import React, { type ChangeEvent, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

export type LibraryFilter = "all" | "images" | "files";
export type LibraryView = "grid" | "list";
export type LibraryWorkspaceFile = {
  id: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  url: string;
  createdAt?: Date;
};

export function filterLibraryWorkspaceItems(
  files: LibraryWorkspaceFile[],
  query: string,
  filter: LibraryFilter
) {
  const normalized = query.trim().toLowerCase();
  return files.filter(
    file =>
      (filter === "all" ||
        (filter === "images"
          ? file.mimeType.startsWith("image/")
          : !file.mimeType.startsWith("image/"))) &&
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
  for (let offset = 0; offset < bytes.length; offset += 0x8000) {
    for (
      let index = offset;
      index < Math.min(offset + 0x8000, bytes.length);
      index += 1
    )
      binary += String.fromCharCode(bytes[index]);
  }
  return window.btoa(binary);
}

export function LibraryWorkspace({
  onBackToChat,
  onChatWithFiles,
}: {
  onBackToChat: () => void;
  onChatWithFiles?: (files: LibraryWorkspaceFile[]) => void;
}) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<LibraryFilter>("all");
  const [view, setView] = useState<LibraryView>("grid");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [deleteTarget, setDeleteTarget] = useState<
    LibraryWorkspaceFile[] | null
  >(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const utils = trpc.useUtils();
  const filesQuery = trpc.workspace.files.list.useQuery();
  const uploadMutation = trpc.workspace.files.upload.useMutation({
    onSuccess: () => {
      utils.workspace.files.list.invalidate();
      toast.success("File added to your Library");
    },
    onError: error =>
      toast.error(error.message || "KSEMO could not add that file."),
  });
  const removeMutation = trpc.workspace.files.remove.useMutation({
    onError: () => toast.error("KSEMO could not remove that file."),
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
  const allVisibleSelected =
    files.length > 0 && files.every(file => selectedIds.has(file.id));

  async function uploadFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (file.size > 8 * 1024 * 1024) {
      toast.error("Files must be smaller than 8 MB.");
      return;
    }
    if (!file.type) {
      toast.error("Choose a supported file type.");
      return;
    }
    try {
      uploadMutation.mutate({
        filename: file.name,
        mimeType: file.type,
        dataBase64: await fileToBase64(file),
      });
    } catch {
      toast.error("KSEMO could not read that file.");
    }
  }

  function toggleFile(id: string) {
    setSelectedIds(current => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function selectVisibleFiles() {
    setSelectedIds(current => selectVisibleLibraryItems(current, files));
  }

  async function removeFiles() {
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
      await utils.workspace.files.list.invalidate();
      toast.success(
        `${deleteTarget.length} ${deleteTarget.length === 1 ? "Library item removed" : "Library items removed"}`
      );
    } catch {
      // The mutation-level message provides the actionable error state.
    }
  }

  function chatWithSelected() {
    if (!selectedFiles.length) return;
    onChatWithFiles?.(selectedFiles);
  }

  return (
    <main className="min-h-0 flex-1 overflow-y-auto bg-background">
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,.txt,.md,.csv,.json,.png,.jpg,.jpeg,.webp,.docx"
        className="sr-only"
        onChange={uploadFile}
      />
      <div className="mx-auto w-full max-w-6xl px-5 py-7 sm:px-8 sm:py-9">
        <header className="flex flex-col gap-5 border-b border-border pb-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-3">
              <Library className="size-6 text-muted-foreground" />
              <h1 className="text-[28px] font-semibold tracking-[-0.03em]">
                Library
              </h1>
            </div>
            <p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">
              Your private space for files and images. Select one or more items
              to chat with them together.
            </p>
          </div>
          <div className="flex shrink-0 gap-2">
            <Button
              variant="outline"
              className="rounded-xl"
              onClick={onBackToChat}
            >
              Back to chat
            </Button>
            <Button
              className="rounded-xl bg-foreground text-background hover:bg-foreground/90"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadMutation.isPending}
            >
              <Upload className="mr-2 size-4" />
              {uploadMutation.isPending ? "Uploading…" : "Upload"}
            </Button>
          </div>
        </header>

        <section className="mt-6 flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div className="relative w-full xl:max-w-md">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={event => setQuery(event.target.value)}
              className="h-10 rounded-xl pl-9"
              placeholder="Search your Library"
              aria-label="Search your Library"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <div
              className="flex rounded-xl border border-border bg-card p-1"
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
            </div>
            <div
              className="flex rounded-xl border border-border bg-card p-1"
              role="group"
              aria-label="Library view"
            >
              <ViewButton
                label="Grid"
                icon={<Grid2X2 className="size-3.5" />}
                active={view === "grid"}
                onClick={() => setView("grid")}
              />
              <ViewButton
                label="List"
                icon={<List className="size-3.5" />}
                active={view === "list"}
                onClick={() => setView("list")}
              />
            </div>
          </div>
        </section>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs text-muted-foreground">
            {files.length} {files.length === 1 ? "item" : "items"} shown · Tap
            or click any item to select it. Supported: PDF, documents, text,
            data, and images up to 8 MB.
          </p>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="rounded-lg"
            onClick={selectVisibleFiles}
            disabled={!files.length || allVisibleSelected}
          >
            Select visible
          </Button>
        </div>

        {selectedFiles.length > 0 && (
          <section
            className="sticky top-3 z-20 mt-4 flex flex-col gap-3 rounded-2xl border border-foreground/15 bg-card/95 p-3 shadow-lg backdrop-blur sm:flex-row sm:items-center sm:justify-between"
            aria-label="Selected Library actions"
          >
            <div className="flex items-center gap-2">
              <CheckCircle2 className="size-4" />
              <p className="text-sm font-medium">
                {selectedFiles.length}{" "}
                {selectedFiles.length === 1 ? "item" : "items"} selected
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                className="rounded-lg"
                onClick={chatWithSelected}
              >
                <MessageSquareText className="mr-1.5 size-3.5" />
                Chat with selected
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="rounded-lg"
                onClick={() => setDeleteTarget(selectedFiles)}
              >
                <Trash2 className="mr-1.5 size-3.5" />
                {selectedFiles.length === allFiles.length && allFiles.length > 1
                  ? "Delete all"
                  : "Delete selected"}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="rounded-lg"
                onClick={() => setSelectedIds(new Set())}
              >
                <X className="mr-1.5 size-3.5" />
                Clear
              </Button>
            </div>
          </section>
        )}

        {filesQuery.isLoading ? (
          <div className="grid min-h-64 place-items-center text-sm text-muted-foreground">
            Loading your private Library…
          </div>
        ) : files.length ? (
          view === "grid" ? (
            <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {files.map(file => (
                <LibraryGridCard
                  key={file.id}
                  file={file}
                  selected={selectedIds.has(file.id)}
                  onToggle={() => toggleFile(file.id)}
                  onRemove={() => setDeleteTarget([file])}
                />
              ))}
            </div>
          ) : (
            <div className="mt-6 divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
              {files.map(file => (
                <LibraryListRow
                  key={file.id}
                  file={file}
                  selected={selectedIds.has(file.id)}
                  onToggle={() => toggleFile(file.id)}
                  onRemove={() => setDeleteTarget([file])}
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

      <Dialog
        open={Boolean(deleteTarget)}
        onOpenChange={open => {
          if (!open) setDeleteTarget(null);
        }}
      >
        <DialogContent className="rounded-2xl sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl font-semibold tracking-[-0.02em]">
              Remove {deleteTarget?.length === 1 ? "file" : "selected files"}?
            </DialogTitle>
            <DialogDescription>
              {deleteTarget?.length === 1
                ? `“${deleteTarget[0]?.filename}” will be permanently removed from your private Library.`
                : `${deleteTarget?.length ?? 0} selected items will be permanently removed from your private Library.`}
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={removeFiles}
              disabled={removeMutation.isPending}
            >
              {removeMutation.isPending ? "Removing…" : "Delete permanently"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
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
        "rounded-lg px-3 py-1.5 text-xs font-medium transition-colors",
        active
          ? "bg-foreground text-background"
          : "text-muted-foreground hover:bg-muted hover:text-foreground"
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
        "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors",
        active
          ? "bg-foreground text-background"
          : "text-muted-foreground hover:bg-muted hover:text-foreground"
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
          ? "border-foreground bg-foreground text-background"
          : "border-muted-foreground/60 bg-background text-transparent"
      )}
    >
      <Check className="size-3" />
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
    <div className="mt-6 grid min-h-72 place-items-center rounded-2xl border border-dashed border-border bg-muted/20 p-7 text-center">
      <div>
        <FolderOpen className="mx-auto size-7 text-muted-foreground" />
        <h2 className="mt-4 text-base font-medium">
          {hasQuery ? "No items match this view" : "Your Library is ready"}
        </h2>
        <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-muted-foreground">
          {hasQuery
            ? "Try another search or choose a different filter."
            : "Upload a private file or image to keep it ready for a future KSEMO conversation."}
        </p>
        {!hasQuery && (
          <Button onClick={onUpload} className="mt-5 rounded-xl">
            <Upload className="mr-2 size-4" />
            Upload your first file
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
  const image = file.mimeType.startsWith("image/");
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
  return (
    <span
      className={cn(
        "flex items-center justify-center text-muted-foreground",
        compact ? "size-11 rounded-lg bg-muted" : "size-full bg-muted/45"
      )}
    >
      <FileText className={compact ? "size-5" : "size-9"} />
    </span>
  );
}

function LibraryGridCard({
  file,
  selected,
  onToggle,
  onRemove,
}: {
  file: LibraryWorkspaceFile;
  selected: boolean;
  onToggle: () => void;
  onRemove: () => void;
}) {
  const image = file.mimeType.startsWith("image/");
  const selectWithKeyboard = (event: React.KeyboardEvent<HTMLElement>) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onToggle();
    }
  };
  return (
    <article
      onClick={onToggle}
      onKeyDown={selectWithKeyboard}
      role="button"
      tabIndex={0}
      aria-label={`${selected ? "Deselect" : "Select"} ${file.filename}`}
      aria-pressed={selected}
      className={cn(
        "group relative cursor-pointer overflow-hidden rounded-2xl border bg-card transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        selected
          ? "border-foreground ring-1 ring-foreground/30"
          : "border-border hover:border-foreground/30"
      )}
    >
      <button
        type="button"
        onClick={event => {
          event.stopPropagation();
          onToggle();
        }}
        className={cn(
          "pointer-events-none absolute left-2.5 top-2.5 z-10 rounded-full bg-background/90 p-0.5 shadow-sm transition-[opacity,transform] duration-150 group-hover:pointer-events-auto group-hover:scale-100 group-hover:opacity-100 group-focus-within:pointer-events-auto group-focus-within:scale-100 group-focus-within:opacity-100 group-active:pointer-events-auto group-active:scale-100 group-active:opacity-100 focus-visible:pointer-events-auto focus-visible:scale-100 focus-visible:opacity-100",
          selected ? "scale-100 opacity-100" : "scale-90 opacity-0"
        )}
        aria-label={`${selected ? "Deselect" : "Select"} ${file.filename}`}
        aria-pressed={selected}
      >
        <SelectionCircle selected={selected} />
      </button>
      <a
        href={file.url}
        target="_blank"
        rel="noreferrer"
        onClick={event => event.stopPropagation()}
        className="block aspect-[4/3] bg-muted"
      >
        <FilePreview file={file} />
      </a>
      <div className="p-3">
        <div className="flex items-start gap-2">
          <span className="mt-0.5 text-muted-foreground">
            {image ? (
              <FileImage className="size-3.5" />
            ) : (
              <FileText className="size-3.5" />
            )}
          </span>
          <a
            href={file.url}
            target="_blank"
            rel="noreferrer"
            onClick={event => event.stopPropagation()}
            className="min-w-0 flex-1"
          >
            <p className="truncate text-sm font-medium hover:underline">
              {file.filename}
            </p>
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              {image ? "Image" : "File"} · {bytesLabel(file.sizeBytes)}
            </p>
          </a>
          <Button
            variant="ghost"
            size="icon"
            onClick={event => {
              event.stopPropagation();
              onRemove();
            }}
            className="size-7 rounded-lg text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100 hover:text-destructive"
            aria-label={`Remove ${file.filename}`}
          >
            <Trash2 className="size-3.5" />
          </Button>
        </div>
      </div>
    </article>
  );
}

function LibraryListRow({
  file,
  selected,
  onToggle,
  onRemove,
}: {
  file: LibraryWorkspaceFile;
  selected: boolean;
  onToggle: () => void;
  onRemove: () => void;
}) {
  const image = file.mimeType.startsWith("image/");
  const selectWithKeyboard = (event: React.KeyboardEvent<HTMLElement>) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onToggle();
    }
  };
  return (
    <article
      onClick={onToggle}
      onKeyDown={selectWithKeyboard}
      role="button"
      tabIndex={0}
      aria-label={`${selected ? "Deselect" : "Select"} ${file.filename}`}
      aria-pressed={selected}
      className={cn(
        "group flex cursor-pointer items-center gap-3 p-3 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        selected && "bg-muted/65"
      )}
    >
      <button
        type="button"
        onClick={event => {
          event.stopPropagation();
          onToggle();
        }}
        className={cn(
          "pointer-events-none rounded-full p-0.5 transition-[opacity,transform] duration-150 group-hover:pointer-events-auto group-hover:scale-100 group-hover:opacity-100 group-focus-within:pointer-events-auto group-focus-within:scale-100 group-focus-within:opacity-100 group-active:pointer-events-auto group-active:scale-100 group-active:opacity-100 focus-visible:pointer-events-auto focus-visible:scale-100 focus-visible:opacity-100",
          selected ? "scale-100 opacity-100" : "scale-90 opacity-0"
        )}
        aria-label={`${selected ? "Deselect" : "Select"} ${file.filename}`}
        aria-pressed={selected}
      >
        <SelectionCircle selected={selected} />
      </button>
      <a
        href={file.url}
        target="_blank"
        rel="noreferrer"
        onClick={event => event.stopPropagation()}
        className="shrink-0"
      >
        <FilePreview file={file} compact />
      </a>
      <a
        href={file.url}
        target="_blank"
        rel="noreferrer"
        onClick={event => event.stopPropagation()}
        className="min-w-0 flex-1"
      >
        <p className="truncate text-sm font-medium hover:underline">
          {file.filename}
        </p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {image ? "Image" : "File"} · {file.mimeType} ·{" "}
          {bytesLabel(file.sizeBytes)}
        </p>
      </a>
      <Button
        variant="ghost"
        size="icon"
        onClick={event => {
          event.stopPropagation();
          onRemove();
        }}
        className="size-8 rounded-lg text-muted-foreground hover:text-destructive"
        aria-label={`Remove ${file.filename}`}
      >
        <Trash2 className="size-3.5" />
      </Button>
    </article>
  );
}
