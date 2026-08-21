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
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { Brain, Plus, Search, Sparkles, Trash2, X } from "lucide-react";
import React, { type ChangeEvent, useMemo, useState } from "react";
import { toast } from "sonner";

export type MemoryFilter = "all" | "active" | "disabled";
export type MemoryItem = {
  id: string;
  content: string;
  category: "preference" | "fact" | "project" | "instruction";
  isActive: boolean;
  createdAt?: Date;
};

export function filterMemoryItems(
  memories: MemoryItem[],
  query: string,
  filter: MemoryFilter
) {
  const normalized = query.trim().toLowerCase();
  return memories.filter(
    memory =>
      (filter === "all" ||
        (filter === "active" ? memory.isActive : !memory.isActive)) &&
      (!normalized || memory.content.toLowerCase().includes(normalized))
  );
}

const CATEGORY_LABELS: Record<MemoryItem["category"], string> = {
  preference: "Preference",
  fact: "Fact",
  project: "Project",
  instruction: "Instruction",
};

function formatDate(value?: Date) {
  if (!value) return "";
  return new Date(value).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function MemoryWorkspace({
  onBackToChat,
}: {
  onBackToChat: () => void;
}) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<MemoryFilter>("all");
  const [addOpen, setAddOpen] = useState(false);
  const [draftContent, setDraftContent] = useState("");
  const [draftCategory, setDraftCategory] =
    useState<MemoryItem["category"]>("fact");
  const [deleteTarget, setDeleteTarget] = useState<MemoryItem | null>(null);
  const utils = trpc.useUtils();
  const memoriesQuery = trpc.workspace.memories.list.useQuery();
  const createMutation = trpc.workspace.memories.create.useMutation({
    onSuccess: () => {
      utils.workspace.memories.list.invalidate();
      toast.success("Memory saved");
    },
    onError: () => toast.error("KSEMO could not save that memory."),
  });
  const activeMutation = trpc.workspace.memories.setActive.useMutation({
    onSuccess: () => utils.workspace.memories.list.invalidate(),
    onError: () => toast.error("KSEMO could not update that memory."),
  });
  const removeMutation = trpc.workspace.memories.remove.useMutation({
    onSuccess: () => {
      utils.workspace.memories.list.invalidate();
      toast.success("Memory removed");
    },
    onError: () => toast.error("KSEMO could not remove that memory."),
  });

  const allMemories = (memoriesQuery.data ?? []) as MemoryItem[];
  const memories = useMemo(
    () => filterMemoryItems(allMemories, query, filter),
    [allMemories, query, filter]
  );
  const activeCount = allMemories.filter(memory => memory.isActive).length;

  function saveMemory() {
    const content = draftContent.trim();
    if (!content) return;
    createMutation.mutate({ content, category: draftCategory });
    setDraftContent("");
    setDraftCategory("fact");
    setAddOpen(false);
  }

  async function removeMemory() {
    if (!deleteTarget) return;
    await removeMutation.mutateAsync({ id: deleteTarget.id });
    setDeleteTarget(null);
  }

  return (
    <main className="min-h-0 flex-1 overflow-y-auto bg-background">
      <div className="mx-auto w-full max-w-5xl px-5 py-6 sm:px-8 sm:py-8">
        <header className="flex flex-col gap-4 border-b border-border pb-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-3">
              <Brain className="size-6 text-muted-foreground" />
              <h1 className="text-2xl font-semibold tracking-[-0.03em]">
                Memories
              </h1>
            </div>
            <p className="mt-1.5 max-w-xl text-sm leading-6 text-muted-foreground">
              Everything KSEMO remembers across your conversations. Only
              memories you add yourself are kept, and you stay in control of
              each one.
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
              onClick={() => setAddOpen(true)}
            >
              <Plus className="mr-2 size-4" />
              Add memory
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
              placeholder="Search your memories"
              aria-label="Search your memories"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <div
              className="flex rounded-xl border border-border bg-card p-1"
              role="group"
              aria-label="Filter memories"
            >
              <FilterButton
                label="All"
                active={filter === "all"}
                onClick={() => setFilter("all")}
              />
              <FilterButton
                label="Active"
                active={filter === "active"}
                onClick={() => setFilter("active")}
              />
              <FilterButton
                label="Disabled"
                active={filter === "disabled"}
                onClick={() => setFilter("disabled")}
              />
            </div>
          </div>
        </section>

        <div className="mt-4">
          <p className="text-xs text-muted-foreground">
            {memories.length} {memories.length === 1 ? "memory" : "memories"}{" "}
            shown · {activeCount} active · KSEMO only uses active memories while
            responding.
          </p>
        </div>

        {memoriesQuery.isLoading ? (
          <div className="grid min-h-64 place-items-center text-sm text-muted-foreground">
            Loading your memories…
          </div>
        ) : memories.length ? (
          <div className="mt-5 grid grid-cols-1 gap-2.5 sm:grid-cols-2 xl:grid-cols-3">
            {memories.map(memory => (
              <MemoryCard
                key={memory.id}
                memory={memory}
                onToggleActive={() =>
                  activeMutation.mutate({
                    id: memory.id,
                    isActive: !memory.isActive,
                  })
                }
                onRemove={() => setDeleteTarget(memory)}
              />
            ))}
          </div>
        ) : (
          <EmptyMemories
            hasQuery={Boolean(query) || filter !== "all"}
            onAdd={() => setAddOpen(true)}
          />
        )}
      </div>

      <Dialog
        open={addOpen}
        onOpenChange={next => {
          if (!next) {
            setAddOpen(false);
            setDraftContent("");
            setDraftCategory("fact");
          }
        }}
      >
        <DialogContent className="rounded-2xl sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-xl font-semibold tracking-[-0.02em]">
              Add a memory
            </DialogTitle>
            <DialogDescription>
              Write something you want KSEMO to remember in future
              conversations.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="memory-content">Memory</Label>
              <Textarea
                id="memory-content"
                value={draftContent}
                onChange={event => setDraftContent(event.target.value)}
                maxLength={2000}
                className="min-h-28 resize-none rounded-xl"
                placeholder="For example: I prefer concise answers with practical examples."
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <Label>Category</Label>
              <div className="flex flex-wrap gap-2">
                {(
                  Object.keys(CATEGORY_LABELS) as Array<MemoryItem["category"]>
                ).map(category => (
                  <button
                    key={category}
                    type="button"
                    onClick={() => setDraftCategory(category)}
                    aria-pressed={draftCategory === category}
                    className={cn(
                      "rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors",
                      draftCategory === category
                        ? "border-foreground bg-foreground text-background"
                        : "border-border text-muted-foreground hover:bg-muted hover:text-foreground"
                    )}
                  >
                    {CATEGORY_LABELS[category]}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setAddOpen(false)}>
                Cancel
              </Button>
              <Button
                className="rounded-xl"
                onClick={saveMemory}
                disabled={!draftContent.trim() || createMutation.isPending}
              >
                {createMutation.isPending ? "Saving…" : "Save memory"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(deleteTarget)}
        onOpenChange={open => {
          if (!open) setDeleteTarget(null);
        }}
      >
        <DialogContent className="rounded-2xl sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl font-semibold tracking-[-0.02em]">
              Remove this memory?
            </DialogTitle>
            <DialogDescription>
              KSEMO will stop using “{deleteTarget?.content.slice(0, 80)}
              {deleteTarget && deleteTarget.content.length > 80 ? "…" : ""}” in
              future conversations. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={removeMemory}
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

function EmptyMemories({
  hasQuery,
  onAdd,
}: {
  hasQuery: boolean;
  onAdd: () => void;
}) {
  return (
    <div className="mt-5 grid min-h-56 place-items-center rounded-2xl border border-dashed border-border bg-muted/20 p-7 text-center">
      <div>
        <Sparkles className="mx-auto size-7 text-muted-foreground" />
        <h2 className="mt-4 text-base font-medium">
          {hasQuery
            ? "No memories match this view"
            : "Your memory space is ready"}
        </h2>
        <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-muted-foreground">
          {hasQuery
            ? "Try another search or choose a different filter."
            : "Add the preferences, facts, and instructions you want KSEMO to remember in every conversation."}
        </p>
        {!hasQuery && (
          <Button onClick={onAdd} className="mt-5 rounded-xl">
            <Plus className="mr-2 size-4" />
            Add your first memory
          </Button>
        )}
      </div>
    </div>
  );
}

function MemoryCard({
  memory,
  onToggleActive,
  onRemove,
}: {
  memory: MemoryItem;
  onToggleActive: () => void;
  onRemove: () => void;
}) {
  return (
    <article
      className={cn(
        "group relative rounded-xl border bg-card px-3 py-2.5 transition-colors",
        memory.isActive ? "border-border" : "border-border bg-muted/30"
      )}
    >
      <div className="flex items-center gap-2">
        <span
          className={cn(
            "rounded-md px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-[0.08em]",
            memory.isActive
              ? "bg-muted text-muted-foreground"
              : "bg-background text-muted-foreground/70"
          )}
        >
          {CATEGORY_LABELS[memory.category]}
        </span>
        <span className="ml-auto text-[10px] text-muted-foreground">
          {formatDate(memory.createdAt)}
        </span>
        <Switch
          checked={memory.isActive}
          onCheckedChange={onToggleActive}
          aria-label={`${memory.isActive ? "Disable" : "Enable"} memory`}
        />
        <Button
          variant="ghost"
          size="icon"
          onClick={onRemove}
          className="size-7 rounded-lg text-muted-foreground opacity-0 transition-opacity hover:text-destructive focus:opacity-100 focus-visible:opacity-100 group-hover:opacity-100 group-focus-within:opacity-100"
          aria-label="Remove memory"
        >
          <Trash2 className="size-3.5" />
        </Button>
      </div>
      <p
        className={cn(
          "mt-1.5 whitespace-pre-wrap break-words text-[13px] leading-5",
          memory.isActive ? "text-foreground" : "text-muted-foreground"
        )}
      >
        {memory.content}
      </p>
    </article>
  );
}
