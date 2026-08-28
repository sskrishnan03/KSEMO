import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Loading } from "@/components/ui/loading";
import { trpc } from "@/lib/trpc";
import {
  fileVisualFor,
  guessMimeType,
  isSupportedUpload,
} from "@/lib/fileIcons";
import { Link2, Trash2, Upload } from "lucide-react";
import React, {
  memo,
  type ChangeEvent,
  useMemo,
  useRef,
  useState,
} from "react";
import { toast } from "sonner";

export type WorkspaceSection = "files";

function bytesLabel(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
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

export const WorkspacePanel = memo(function WorkspacePanel({
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
  const [libraryQuery, setLibraryQuery] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<{
    kind: "file";
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
  const visibleFiles = useMemo(() => {
    const normalized = libraryQuery.trim().toLowerCase();
    if (!normalized) return filesQuery.data ?? [];
    return (filesQuery.data ?? []).filter(file =>
      file.filename.toLowerCase().includes(normalized)
    );
  }, [filesQuery.data, libraryQuery]);

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
    if (file.size > 25 * 1024 * 1024) {
      toast.error("Files must be smaller than 25 MB.");
      return;
    }
    if (!isSupportedUpload(file)) {
      toast.error(
        "Supported: PDF, Word, Excel, PowerPoint, text, data, and image files."
      );
      return;
    }
    try {
      fileUpload.mutate({
        filename: file.name,
        mimeType: file.type || guessMimeType(file.name),
        dataBase64: await fileToBase64(file),
      });
    } catch {
      toast.error("KSEMO could not read that file.");
    }
  }

  function confirmDelete() {
    if (!deleteTarget) return;
    fileRemove.mutate({ id: deleteTarget.id });
    setDeleteTarget(null);
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-h-[88dvh] overflow-hidden rounded-2xl p-0 sm:max-w-3xl">
          <DialogHeader className="border-b border-border px-5 pb-4 pt-5">
            <DialogTitle className="text-xl font-semibold tracking-[-0.02em]">
              Library
            </DialogTitle>
            <DialogDescription>
              Manage private files and attach supported items to the active
              conversation.
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-[65dvh] overflow-y-auto p-4 sm:p-5">
            <section>
              <input
                ref={fileInputRef}
                onChange={uploadFile}
                type="file"
                className="sr-only"
                accept=".pdf,.txt,.md,.markdown,.csv,.tsv,.json,.log,.xml,.yml,.yaml,.png,.jpg,.jpeg,.webp,.gif,.docx,.xlsx,.xls,.pptx"
              />
              <Button
                onClick={() => fileInputRef.current?.click()}
                disabled={fileUpload.isPending}
                className="w-full rounded-xl"
              >
                <Upload className="mr-2 size-4" />
                {fileUpload.isPending ? "Adding file…" : "Add file to Library"}
              </Button>
              <p className="mt-2 text-xs leading-5 text-muted-foreground">
                PDF, Word, Excel, PowerPoint, text, data, and image files up to
                25 MB. Documents are analyzed so you can chat with them.
              </p>
              <Input
                value={libraryQuery}
                onChange={event => setLibraryQuery(event.target.value)}
                placeholder="Search your Library"
                className="mt-4 h-10 rounded-xl"
                aria-label="Search your Library"
              />
              <div className="mt-3 space-y-2">
                {filesQuery.isLoading ? (
                  <Loading />
                ) : visibleFiles.length ? (
                  visibleFiles.map(file => (
                    <div
                      key={file.id}
                      className="flex items-center gap-3 rounded-xl border border-border p-3"
                    >
                      {(() => {
                        const visual = fileVisualFor(
                          file.filename,
                          file.mimeType
                        );
                        return (
                          <visual.Icon
                            className={`size-4 ${visual.className}`}
                            aria-hidden
                          />
                        );
                      })()}
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
              "{deleteTarget?.label}" will be permanently removed from your
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
});

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
