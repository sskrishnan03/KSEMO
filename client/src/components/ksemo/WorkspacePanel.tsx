import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import {
  Archive,
  Brain,
  Check,
  FileText,
  Library,
  Link2,
  Plus,
  Trash2,
  Upload,
} from "lucide-react";
import React, { type ChangeEvent, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

export type WorkspaceSection = "files" | "memories";

function bytesLabel(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

async function fileToBase64(file: File) {
  const bytes = new Uint8Array(await file.arrayBuffer());
  let binary = "";
  for (let offset = 0; offset < bytes.length; offset += 0x8000)
    for (
      let index = offset;
      index < Math.min(offset + 0x8000, bytes.length);
      index += 1
    )
      binary += String.fromCharCode(bytes[index]);
  return window.btoa(binary);
}

export function WorkspacePanel({
  open,
  onOpenChange,
  initialSection,
  activeConversationId,
  initialDeletePreview = false,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialSection: WorkspaceSection;
  activeConversationId?: string | null;
  initialDeletePreview?: boolean;
}) {
  const [section, setSection] = useState<WorkspaceSection>(initialSection);
  const [memoryText, setMemoryText] = useState("");
  const [libraryQuery, setLibraryQuery] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<{
    kind: "file" | "memory";
    id: string;
    label: string;
  } | null>(
    initialDeletePreview
      ? { kind: "file", id: "preview-file", label: "interview.docx" }
      : null
  );
  const fileInputRef = useRef<HTMLInputElement>(null);
  const utils = trpc.useUtils();
  const filesQuery = trpc.workspace.files.list.useQuery(undefined, {
    enabled: open,
  });
  const memoriesQuery = trpc.workspace.memories.list.useQuery(undefined, {
    enabled: open,
  });
  const visibleFiles = (filesQuery.data ?? []).filter(file =>
    file.filename.toLowerCase().includes(libraryQuery.trim().toLowerCase())
  );
  useEffect(() => setSection(initialSection), [initialSection, open]);

  const memoryCreate = trpc.workspace.memories.create.useMutation({
    onSuccess: () => {
      utils.workspace.memories.list.invalidate();
      setMemoryText("");
      toast.success("Memory saved");
    },
    onError: () => toast.error("Memory could not be saved."),
  });
  const memoryActive = trpc.workspace.memories.setActive.useMutation({
    onSuccess: () => utils.workspace.memories.list.invalidate(),
  });
  const memoryRemove = trpc.workspace.memories.remove.useMutation({
    onSuccess: () => utils.workspace.memories.list.invalidate(),
  });
  const fileUpload = trpc.workspace.files.upload.useMutation({
    onSuccess: () => {
      utils.workspace.files.list.invalidate();
      toast.success("File added to Library");
    },
    onError: error =>
      toast.error(error.message || "File could not be uploaded."),
  });
  const fileRemove = trpc.workspace.files.remove.useMutation({
    onSuccess: () => utils.workspace.files.list.invalidate(),
  });
  const fileAttach = trpc.workspace.files.attachToConversation.useMutation({
    onSuccess: () => toast.success("File attached to the active conversation"),
    onError: () =>
      toast.error("File could not be attached to this conversation."),
  });

  async function uploadFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (file.size > 8 * 1024 * 1024) {
      toast.error("Files must be smaller than 8 MB.");
      return;
    }
    if (!file.type) {
      toast.error("KSEMO needs a recognized file type for Library uploads.");
      return;
    }
    try {
      fileUpload.mutate({
        filename: file.name,
        mimeType: file.type,
        dataBase64: await fileToBase64(file),
      });
    } catch {
      toast.error("KSEMO could not read that file.");
    }
  }

  function confirmDelete() {
    if (!deleteTarget) return;
    if (deleteTarget.kind === "file")
      fileRemove.mutate({ id: deleteTarget.id });
    else memoryRemove.mutate({ id: deleteTarget.id });
    setDeleteTarget(null);
  }

  const title = section === "files" ? "Library" : "Memories";
  const description =
    section === "files"
      ? "Manage private files and attach supported items to the active conversation."
      : "Review only the memories you explicitly choose for KSEMO to retain.";
  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-h-[88dvh] overflow-hidden rounded-2xl p-0 sm:max-w-3xl">
          <DialogHeader className="border-b border-border px-5 pb-4 pt-5">
            <DialogTitle className="text-xl font-semibold tracking-[-0.02em]">
              {title}
            </DialogTitle>
            <DialogDescription>{description}</DialogDescription>
          </DialogHeader>
          <div className="max-h-[65dvh] overflow-y-auto p-4 sm:p-5">
            {section === "files" ? (
              <section>
                <input
                  ref={fileInputRef}
                  onChange={uploadFile}
                  type="file"
                  className="sr-only"
                  accept=".pdf,.txt,.md,.csv,.json,.png,.jpg,.jpeg,.webp,.docx"
                />
                <Button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={fileUpload.isPending}
                  className="w-full rounded-xl"
                >
                  <Upload className="mr-2 size-4" />
                  {fileUpload.isPending
                    ? "Adding file…"
                    : "Add file to Library"}
                </Button>
                <p className="mt-2 text-xs leading-5 text-muted-foreground">
                  PDF, text, Markdown, CSV, JSON, images, and DOCX up to 8 MB.
                  Files stay private until you attach them to a conversation.
                </p>
                <Input
                  value={libraryQuery}
                  onChange={event => setLibraryQuery(event.target.value)}
                  placeholder="Search your Library"
                  className="mt-4 h-10 rounded-xl"
                  aria-label="Search your Library"
                />
                <div className="mt-3 space-y-2">
                  {visibleFiles.length ? (
                    visibleFiles.map(file => (
                      <div
                        key={file.id}
                        className="flex items-center gap-3 rounded-xl border border-border p-3"
                      >
                        <FileText className="size-4 text-muted-foreground" />
                        <a
                          href={file.url}
                          target="_blank"
                          rel="noreferrer"
                          className="min-w-0 flex-1"
                        >
                          <p className="truncate text-sm font-medium hover:underline">
                            {file.filename}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {file.mimeType} · {bytesLabel(file.sizeBytes)}
                          </p>
                        </a>
                        {activeConversationId && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() =>
                              fileAttach.mutate({
                                fileId: file.id,
                                conversationId: activeConversationId,
                              })
                            }
                            aria-label={`Attach ${file.filename} to active conversation`}
                          >
                            <Link2 className="size-4" />
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() =>
                            setDeleteTarget({
                              kind: "file",
                              id: file.id,
                              label: file.filename,
                            })
                          }
                          aria-label={`Remove ${file.filename}`}
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </div>
                    ))
                  ) : (
                    <p className="py-10 text-center text-sm text-muted-foreground">
                      {libraryQuery
                        ? "No Library items match that search."
                        : "Your private Library is empty."}
                    </p>
                  )}
                </div>
              </section>
            ) : (
              <section>
                <Textarea
                  value={memoryText}
                  onChange={event => setMemoryText(event.target.value)}
                  placeholder="Save something KSEMO should remember only because you explicitly choose to."
                  maxLength={2000}
                  className="min-h-24 resize-none"
                />
                <div className="mt-2 flex justify-end">
                  <Button
                    onClick={() =>
                      memoryText.trim() &&
                      memoryCreate.mutate({ content: memoryText.trim() })
                    }
                    disabled={memoryCreate.isPending || !memoryText.trim()}
                  >
                    <Plus className="mr-1.5 size-4" />
                    Save memory
                  </Button>
                </div>
                <p className="mt-2 text-xs leading-5 text-muted-foreground">
                  Memories are never created automatically from conversation
                  text. You can disable or remove each item at any time.
                </p>
                <div className="mt-5 space-y-2">
                  {memoriesQuery.data?.length ? (
                    memoriesQuery.data.map(memory => (
                      <div
                        key={memory.id}
                        className="flex items-start gap-3 rounded-xl border border-border p-3"
                      >
                        <Brain className="mt-0.5 size-4 text-muted-foreground" />
                        <p
                          className={
                            memory.isActive
                              ? "min-w-0 flex-1 text-sm leading-6"
                              : "min-w-0 flex-1 text-sm leading-6 text-muted-foreground line-through"
                          }
                        >
                          {memory.content}
                        </p>
                        <div className="flex shrink-0">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() =>
                              memoryActive.mutate({
                                id: memory.id,
                                isActive: !memory.isActive,
                              })
                            }
                            aria-label={
                              memory.isActive
                                ? "Disable memory"
                                : "Enable memory"
                            }
                          >
                            {memory.isActive ? (
                              <Archive className="size-4" />
                            ) : (
                              <Check className="size-4" />
                            )}
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() =>
                              setDeleteTarget({
                                kind: "memory",
                                id: memory.id,
                                label: "this memory",
                              })
                            }
                            aria-label="Remove memory"
                          >
                            <Trash2 className="size-4" />
                          </Button>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="py-10 text-center text-sm text-muted-foreground">
                      No memories are active. Add only the details you want
                      KSEMO to retain.
                    </p>
                  )}
                </div>
              </section>
            )}
          </div>
        </DialogContent>
      </Dialog>
      <Dialog
        open={Boolean(deleteTarget)}
        onOpenChange={next => {
          if (!next) setDeleteTarget(null);
        }}
      >
        <DialogContent className="rounded-2xl sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl font-semibold tracking-[-0.02em]">
              Remove {deleteTarget?.kind ?? "item"}?
            </DialogTitle>
            <DialogDescription>
              “{deleteTarget?.label}” will be permanently removed from your
              KSEMO workspace.
            </DialogDescription>
          </DialogHeader>
          {deleteTarget && (
            <WorkspaceDeleteConfirmPanel
              onCancel={() => setDeleteTarget(null)}
              onConfirm={confirmDelete}
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

export function WorkspaceDeleteConfirmPanel({
  onCancel,
  onConfirm,
}: {
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <>
      <div className="rounded-xl border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-muted-foreground">
        This action cannot be undone.
      </div>
      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
        <Button
          onClick={onConfirm}
          className="rounded-xl bg-destructive text-destructive-foreground hover:bg-destructive/90"
        >
          Delete permanently
        </Button>
      </div>
    </>
  );
}
