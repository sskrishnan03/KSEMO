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
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import {
  MEMORY_CATEGORIES,
  memoryCategoryLabel,
  type MemoryCategoryId,
} from "@shared/memory";
import { useEffect, useMemo, useState } from "react";
import { ConfirmDeleteDialog } from "./ConfirmDeleteDialog";
import { Brain, Pencil, Plus, Search, Trash2, X } from "lucide-react";

type MemoryRow = {
  id: string;
  title: string;
  content: string;
  category: MemoryCategoryId;
  isSensitive: boolean;
  source: "manual" | "chat";
  createdAt: Date | string;
  updatedAt: Date | string;
  sourceConversationId: string | null;
};

type EditorState = {
  id: string | null;
  title: string;
  content: string;
  category: MemoryCategoryId;
} | null;

function formatDate(value: Date | string | null | undefined): string {
  if (!value) return "";
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function truncate(text: string, max = 220): string {
  const cleaned = text.replace(/\s+/g, " ").trim();
  return cleaned.length <= max ? cleaned : `${cleaned.slice(0, max - 1).trimEnd()}…`;
}

export function MemoryManagerDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const utils = trpc.useUtils();
  const memoriesQuery = trpc.memory.list.useQuery(undefined, { enabled: open });
  const memories = (memoriesQuery.data ?? []) as MemoryRow[];

  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<MemoryCategoryId | "all">("all");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [editor, setEditor] = useState<EditorState>(null);
  const [deleteTarget, setDeleteTarget] = useState<MemoryRow | null>(null);
  const [deleteSelectedOpen, setDeleteSelectedOpen] = useState(false);
  const [deleteAllOpen, setDeleteAllOpen] = useState(false);

  useEffect(() => {
    if (!open) {
      setQuery("");
      setCategory("all");
      setSelected(new Set());
      setEditor(null);
      setDeleteTarget(null);
    }
  }, [open]);

  const removeMutation = trpc.memory.remove.useMutation({
    onSuccess: () => {
      utils.memory.list.invalidate();
      if (deleteTarget) {
        toast.success("Memory deleted");
        setDeleteTarget(null);
      }
    },
    onError: () => toast.error("Could not delete memory."),
  });

  const clearMutation = trpc.memory.clear.useMutation({
    onSuccess: result => {
      utils.memory.list.invalidate();
      setSelected(new Set());
      toast.success(
        result.removed === 1
          ? "1 memory deleted"
          : `${result.removed} memories deleted`
      );
    },
    onError: () => toast.error("Could not delete memories."),
  });

  const updateMutation = trpc.memory.update.useMutation({
    onSuccess: () => {
      utils.memory.list.invalidate();
      setEditor(null);
      toast.success("Memory updated");
    },
    onError: () => toast.error("Could not update memory."),
  });

  const createMutation = trpc.memory.create.useMutation({
    onSuccess: () => {
      utils.memory.list.invalidate();
      setEditor(null);
      toast.success("Memory saved");
    },
    onError: () => toast.error("Could not save memory."),
  });

  const visible = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase();
    return memories.filter(memory => {
      if (category !== "all" && memory.category !== category) return false;
      if (!needle) return true;
      return (
        memory.title.toLocaleLowerCase().includes(needle) ||
        memory.content.toLocaleLowerCase().includes(needle)
      );
    });
  }, [memories, query, category]);

  const toggleSelect = (id: string) => {
    setSelected(current => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAllVisible = () => {
    const allVisibleSelected = visible.every(m => selected.has(m.id));
    setSelected(current => {
      const next = new Set(current);
      for (const memory of visible) {
        if (allVisibleSelected) next.delete(memory.id);
        else next.add(memory.id);
      }
      return next;
    });
  };

  const deleteMany = async () => {
    const ids = Array.from(selected);
    try {
      for (const id of ids) {
        await removeMutation.mutateAsync({ id });
      }
      toast.success(
        ids.length === 1 ? "1 memory deleted" : `${ids.length} memories deleted`
      );
    } catch {
      toast.error("Could not delete all selected memories.");
    } finally {
      setSelected(new Set());
      setDeleteSelectedOpen(false);
    }
  };

  const saveEditor = () => {
    if (!editor) return;
    if (!editor.title.trim() || !editor.content.trim()) {
      toast.error("Title and content are required.");
      return;
    }
    if (editor.id) {
      updateMutation.mutate({
        id: editor.id,
        title: editor.title.trim(),
        content: editor.content.trim(),
        category: editor.category,
      });
    } else {
      createMutation.mutate({
        title: editor.title.trim(),
        content: editor.content.trim(),
        category: editor.category,
        source: "manual",
      });
    }
  };

  const startEdit = (memory: MemoryRow) => {
    setEditor({
      id: memory.id,
      title: memory.title,
      content: memory.content,
      category: memory.category,
    });
  };

  const busy =
    memoriesQuery.isLoading ||
    removeMutation.isPending ||
    clearMutation.isPending;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="flex max-h-[36rem] w-[calc(100%-1.5rem)] max-w-2xl flex-col gap-0 overflow-hidden rounded-2xl p-0">
          <DialogHeader className="shrink-0 border-b border-border px-4 pb-3 pt-4">
            <DialogTitle className="text-base">Memories</DialogTitle>
            <DialogDescription>
              View, search, edit, and delete the facts saved for your account.
            </DialogDescription>
          </DialogHeader>

          <div className="shrink-0 space-y-2 border-b border-border px-4 py-3">
            <div className="relative">
              <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Search memories…"
                className="h-9 rounded-lg pl-8 text-sm"
              />
            </div>
            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={() => setCategory("all")}
                className={`rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors ${
                  category === "all"
                    ? "border-primary bg-primary/5 text-foreground"
                    : "border-border text-muted-foreground hover:bg-muted/50"
                }`}
              >
                All
              </button>
              {MEMORY_CATEGORIES.map(cat => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setCategory(cat.id)}
                  className={`rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors ${
                    category === cat.id
                      ? "border-primary bg-primary/5 text-foreground"
                      : "border-border text-muted-foreground hover:bg-muted/50"
                  }`}
                >
                  {cat.label}
                  {cat.sensitive ? " •" : ""}
                </button>
              ))}
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto p-3">
            {memoriesQuery.isLoading ? (
              <Loading className="py-6" />
            ) : memories.length === 0 ? (
              <div className="py-10 text-center">
                <Brain className="mx-auto size-6 text-muted-foreground" />
                <p className="mt-3 text-sm font-medium">No memories yet</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Add one below, or generate memory ideas from your chats.
                </p>
              </div>
            ) : visible.length === 0 ? (
              <div className="py-10 text-center text-sm text-muted-foreground">
                No memories match your filters.
              </div>
            ) : (
              <ul className="space-y-2">
                {visible.map(memory => (
                  <li key={memory.id}>
                    <div className="flex items-start gap-2 rounded-xl border border-border p-3 transition-colors hover:bg-muted/40">
                      <Checkbox
                        checked={selected.has(memory.id)}
                        onCheckedChange={() => toggleSelect(memory.id)}
                        aria-label={`Select ${memory.title}`}
                        className="mt-1 shrink-0"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <p className="text-[13px] font-medium">
                            {memory.title}
                          </p>
                          <span
                            className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                              memory.isSensitive
                                ? "bg-destructive/10 text-destructive"
                                : "bg-muted text-muted-foreground"
                            }`}
                          >
                            {memoryCategoryLabel(memory.category)}
                          </span>
                          {memory.isSensitive && (
                            <span className="rounded-full bg-destructive/10 px-2 py-0.5 text-[10px] font-medium text-destructive">
                              Sensitive
                            </span>
                          )}
                        </div>
                        <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                          {truncate(memory.content)}
                        </p>
                        <p className="mt-1.5 text-[10px] text-muted-foreground/80">
                          {memory.source === "chat" ? "From chat" : "Manual"} ·
                          Created {formatDate(memory.createdAt)}
                          {memory.updatedAt !== memory.createdAt &&
                          formatDate(memory.updatedAt)
                            ? ` · Updated ${formatDate(memory.updatedAt)}`
                            : ""}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label="Edit memory"
                          className="size-8 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground"
                          onClick={() => startEdit(memory)}
                        >
                          <Pencil className="size-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label="Delete memory"
                          className="size-8 rounded-lg text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                          onClick={() => setDeleteTarget(memory)}
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="shrink-0 flex flex-wrap items-center justify-between gap-3 border-t border-border px-4 py-3">
            <div className="flex items-center gap-2">
              {visible.length > 0 && (
                <label className="flex cursor-pointer items-center gap-2 text-xs text-muted-foreground">
                  <Checkbox
                    checked={
                      visible.length > 0 &&
                      visible.every(m => selected.has(m.id))
                    }
                    onCheckedChange={toggleSelectAllVisible}
                    aria-label="Select all visible memories"
                  />
                  All visible
                </label>
              )}
              <span className="text-xs text-muted-foreground">
                {visible.length} of {memories.length}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                disabled={selected.size === 0 || busy}
                onClick={() => setDeleteSelectedOpen(true)}
              >
                Delete selected{selected.size > 0 ? ` (${selected.size})` : ""}
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={memories.length === 0 || busy}
                className="text-destructive hover:text-destructive"
                onClick={() => setDeleteAllOpen(true)}
              >
                Delete all
              </Button>
            </div>
          </div>

          {editor ? (
            <div className="shrink-0 space-y-3 border-t border-border p-4">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold">
                  {editor.id ? "Edit memory" : "Add memory"}
                </p>
                <button
                  type="button"
                  onClick={() => setEditor(null)}
                  aria-label="Cancel editing"
                  className="rounded-lg p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                >
                  <X className="size-4" aria-hidden />
                </button>
              </div>
              <div className="space-y-2">
                <Label className="text-xs">Title</Label>
                <Input
                  value={editor.title}
                  maxLength={160}
                  onChange={e =>
                    setEditor({ ...editor, title: e.target.value })
                  }
                  className="h-9 rounded-lg text-sm"
                  placeholder="Short label for this memory"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs">Content</Label>
                <Textarea
                  value={editor.content}
                  maxLength={4000}
                  onChange={e =>
                    setEditor({ ...editor, content: e.target.value })
                  }
                  className="min-h-20 max-h-36 resize-none overflow-y-auto rounded-lg border border-border text-sm"
                  placeholder="What do you want KSEMO to remember?"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs">Category</Label>
                <div className="flex flex-wrap gap-1.5">
                  {MEMORY_CATEGORIES.map(cat => (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() =>
                        setEditor({ ...editor, category: cat.id })
                      }
                      className={`rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors ${
                        editor.category === cat.id
                          ? "border-primary bg-primary/5 text-foreground"
                          : "border-border text-muted-foreground hover:bg-muted/50"
                      }`}
                    >
                      {cat.label}
                      {cat.sensitive ? " •" : ""}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setEditor(null)}
                >
                  Cancel
                </Button>
                <Button
                  size="sm"
                  disabled={
                    updateMutation.isPending || createMutation.isPending
                  }
                  onClick={saveEditor}
                >
                  {editor.id ? "Save changes" : "Add memory"}
                </Button>
              </div>
            </div>
          ) : (
            <div className="shrink-0 border-t border-border px-4 py-3">
              <Button
                size="sm"
                variant="outline"
                className="w-full"
                onClick={() =>
                  setEditor({
                    id: null,
                    title: "",
                    content: "",
                    category: "general",
                  })
                }
              >
                <Plus className="mr-1.5 size-4" />
                Add memory
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <ConfirmDeleteDialog
        open={Boolean(deleteTarget)}
        onOpenChange={openState => {
          if (!openState) setDeleteTarget(null);
        }}
        title="Delete this memory?"
        description={`“${deleteTarget?.title ?? "This memory"}” will be permanently removed and no longer used in your conversations.`}
        confirmLabel="Delete"
        busy={removeMutation.isPending}
        onConfirm={() => {
          if (deleteTarget) removeMutation.mutate({ id: deleteTarget.id });
        }}
      />
      <ConfirmDeleteDialog
        open={deleteSelectedOpen}
        onOpenChange={setDeleteSelectedOpen}
        title={`Delete ${selected.size} selected ${
          selected.size === 1 ? "memory" : "memories"
        }?`}
        description="The selected memories will be permanently removed and no longer used in your conversations."
        confirmLabel="Delete"
        busy={removeMutation.isPending}
        onConfirm={() => void deleteMany()}
      />
      <ConfirmDeleteDialog
        open={deleteAllOpen}
        onOpenChange={setDeleteAllOpen}
        title="Delete all memories?"
        description="Every saved memory will be permanently removed. This cannot be undone."
        confirmLabel="Delete all"
        confirmKeyword="DELETE"
        busy={clearMutation.isPending}
        onConfirm={() => clearMutation.mutate()}
      />
    </>
  );
}