import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { formatDistanceToNowStrict } from "date-fns";
import {
  Brain,
  Ellipsis,
  Eye,
  HelpCircle,
  Pencil,
  Plus,
  Power,
  Search,
  Settings2,
  Sparkles,
  Trash2,
} from "lucide-react";
import React, { useMemo, useState } from "react";
import { toast } from "sonner";

// ============================================
// Types & labels
// ============================================

export const USER_MEMORY_CATEGORIES = [
  "preference",
  "personal_info",
  "communication_style",
  "interest",
  "skill_experience",
  "instruction",
  "goal",
  "other",
] as const;

type UserMemoryCategory = (typeof USER_MEMORY_CATEGORIES)[number];

const CATEGORY_LABELS: Record<UserMemoryCategory, string> = {
  preference: "Preference",
  personal_info: "Personal Information",
  communication_style: "Communication Style",
  interest: "Interest",
  skill_experience: "Skill / Experience",
  instruction: "Instruction",
  goal: "Goal",
  other: "Other",
};

const CATEGORY_FILTERS: Array<{ value: UserMemoryCategory | "all"; label: string }> =
  [
    { value: "all", label: "All" },
    { value: "preference", label: "Preference" },
    { value: "personal_info", label: "Personal" },
    { value: "communication_style", label: "Communication" },
    { value: "interest", label: "Interest" },
    { value: "skill_experience", label: "Skill" },
    { value: "instruction", label: "Instruction" },
    { value: "goal", label: "Goal" },
    { value: "other", label: "Other" },
  ];

type MemoryImportance = "low" | "medium" | "high";

type UserMemoryItem = {
  id: string;
  content: string;
  category: UserMemoryCategory;
  status: "active" | "disabled";
  importance: MemoryImportance;
  confidence: number;
  source: "explicit" | "inferred" | "suggested";
  explanation: string | null;
  createdAt: Date;
  lastUsedAt: Date | null;
  expiresAt: Date | null;
  usageCount: number;
};

type ConversationMemoryItem = {
  id: string;
  content: string;
  category: UserMemoryCategory;
  importance: MemoryImportance;
  createdAt: Date;
};

type SuggestionItem = {
  id: string;
  content: string;
  category: UserMemoryCategory;
  importance: MemoryImportance;
  reason: string | null;
  meta: {
    kind?: "new" | "duplicate" | "conflict";
    similarTo?: Array<{ id: string; content: string }>;
  } | null;
};

type MemoryTab = "user" | "conversation";
export type StatusFilter = "all" | "active" | "disabled" | "suggestions";

function formatDate(value?: Date | null) {
  if (!value) return "";
  return new Date(value).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatRelative(value: Date) {
  try {
    return `${formatDistanceToNowStrict(new Date(value))} ago`;
  } catch {
    return formatDate(value);
  }
}

// ============================================
// Filtering helpers (exported for reuse/tests)
// ============================================

export function filterUserMemories(
  memories: UserMemoryItem[],
  query: string,
  filter: StatusFilter,
  category: UserMemoryCategory | "all"
) {
  const normalized = query.trim().toLowerCase();
  return memories.filter(memory => {
    if (
      normalized &&
      !`${memory.content} ${CATEGORY_LABELS[memory.category]}`
        .toLowerCase()
        .includes(normalized)
    )
      return false;
    if (filter === "active" && memory.status !== "active") return false;
    if (filter === "disabled" && memory.status !== "disabled") return false;
    if (category !== "all" && memory.category !== category) return false;
    return true;
  });
}

export function filterConversationMemories(
  memories: ConversationMemoryItem[],
  query: string
) {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return memories;
  return memories.filter(
    memory =>
      memory.content.toLowerCase().includes(normalized) ||
      CATEGORY_LABELS[memory.category].toLowerCase().includes(normalized)
  );
}

// ============================================
// Main component
// ============================================

export function MemoryWorkspace({
  onBackToChat,
  activeConversationId,
  conversationMemoryPaused,
  initialStatusFilter,
}: {
  onBackToChat: () => void;
  activeConversationId: string | null;
  conversationMemoryPaused: boolean;
  initialStatusFilter?: StatusFilter;
}) {
  const utils = trpc.useUtils();
  const [tab, setTab] = useState<MemoryTab>("user");
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>(
    initialStatusFilter ?? "all"
  );
  const [categoryFilter, setCategoryFilter] = useState<
    UserMemoryCategory | "all"
  >("all");
  const [addOpen, setAddOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<UserMemoryItem | null>(null);
  const [editConvTarget, setEditConvTarget] =
    useState<ConversationMemoryItem | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{
    kind: "user" | "conversation";
    id: string;
    content: string;
  } | null>(null);
  const [whyTarget, setWhyTarget] = useState<UserMemoryItem | null>(null);
  const [clearAllConfirm, setClearAllConfirm] = useState(false);
  const [clearAllEverythingConfirm, setClearAllEverythingConfirm] =
    useState(false);
  // Conflict/duplicate resolution state for accepting suggestions.
  const [resolveTarget, setResolveTarget] = useState<SuggestionItem | null>(
    null
  );
  const [mergeDraft, setMergeDraft] = useState("");

  const userMemoriesQuery = trpc.memory.userMemories.list.useQuery();
  const conversationMemoriesQuery =
    trpc.memory.conversationMemories.list.useQuery(
      { conversationId: activeConversationId ?? "none" },
      { enabled: Boolean(activeConversationId) }
    );
  const suggestionsQuery = trpc.memory.suggestions.list.useQuery();
  const settingsQuery = trpc.memory.settings.get.useQuery();

  const invalidateAll = () => {
    utils.memory.userMemories.list.invalidate();
    utils.memory.suggestions.list.invalidate();
    utils.memory.conversationMemories.list.invalidate();
  };

  const createUserMutation = trpc.memory.userMemories.create.useMutation({
    onSuccess: () => {
      invalidateAll();
      toast.success("Memory saved");
    },
    onError: () => toast.error("KSEMO could not save that memory."),
  });
  const updateUserMutation = trpc.memory.userMemories.update.useMutation({
    onSuccess: () => {
      invalidateAll();
      toast.success("Memory updated");
    },
    onError: () => toast.error("KSEMO could not update that memory."),
  });
  const removeUserMutation = trpc.memory.userMemories.remove.useMutation({
    onSuccess: () => {
      invalidateAll();
      toast.success("Memory removed");
    },
    onError: () => toast.error("KSEMO could not remove that memory."),
  });
  const removeAllMutation = trpc.memory.userMemories.removeAll.useMutation({
    onSuccess: data => {
      invalidateAll();
      toast.success(`Removed ${data.removed} memories`);
    },
    onError: () => toast.error("KSEMO could not clear your memories."),
  });
  const createConvMutation = trpc.memory.conversationMemories.create.useMutation(
    {
      onSuccess: () => {
        invalidateAll();
        toast.success("Memory saved to this conversation");
      },
      onError: () => toast.error("KSEMO could not save that memory."),
    }
  );
  const updateConvMutation = trpc.memory.conversationMemories.update.useMutation({
    onSuccess: () => {
      invalidateAll();
      toast.success("Memory updated");
    },
    onError: () => toast.error("KSEMO could not update that memory."),
  });
  const removeConvMutation = trpc.memory.conversationMemories.remove.useMutation({
    onSuccess: () => {
      invalidateAll();
      toast.success("Memory forgotten");
    },
    onError: () => toast.error("KSEMO could not forget that memory."),
  });
  const clearConvMutation =
    trpc.memory.conversationMemories.clearAll.useMutation({
      onSuccess: data => {
        invalidateAll();
        toast.success(`Cleared ${data.removed} conversation memories`);
      },
      onError: () => toast.error("KSEMO could not clear this conversation's memory."),
    });
  const acceptSuggestionMutation =
    trpc.memory.suggestions.accept.useMutation({
      onSuccess: () => {
        invalidateAll();
        toast.success("Saved to your memories");
      },
      onError: () => toast.error("KSEMO could not save that suggestion."),
    });
  const dismissSuggestionMutation =
    trpc.memory.suggestions.dismiss.useMutation({
      onSuccess: () => {
        invalidateAll();
        toast.success("Suggestion ignored");
      },
      onError: () => toast.error("KSEMO could not dismiss that suggestion."),
    });
  const updateSettingsMutation = trpc.memory.settings.update.useMutation({
    onSuccess: () => utils.memory.settings.get.invalidate(),
    onError: () => toast.error("KSEMO could not save memory settings."),
  });
  const pauseMemoryMutation =
    trpc.memory.conversationControl.setPaused.useMutation({
      onSuccess: () => {
        utils.conversation.get.invalidate();
        toast.success(
          conversationMemoryPaused
            ? "Memory resumed for this conversation"
            : "Memory paused for this conversation"
        );
      },
      onError: () => toast.error("KSEMO could not update memory for this chat."),
    });

  const allUserMemories = (userMemoriesQuery.data ?? []) as UserMemoryItem[];
  const allConversationMemories = (conversationMemoriesQuery.data ??
    []) as ConversationMemoryItem[];
  const pendingSuggestions = (suggestionsQuery.data ?? []) as SuggestionItem[];

  const visibleUserMemories = useMemo(
    () =>
      statusFilter === "suggestions"
        ? []
        : filterUserMemories(allUserMemories, query, statusFilter, categoryFilter),
    [allUserMemories, query, statusFilter, categoryFilter]
  );
  const visibleConversationMemories = useMemo(
    () => filterConversationMemories(allConversationMemories, query),
    [allConversationMemories, query]
  );

  function openResolutionDialog(suggestion: SuggestionItem) {
    const kind = suggestion.meta?.kind ?? "new";
    if ((kind === "conflict" || kind === "duplicate") && suggestion.meta?.similarTo?.length) {
      setMergeDraft(suggestion.content);
      setResolveTarget(suggestion);
      return;
    }
    acceptSuggestionMutation.mutate({ id: suggestion.id, resolution: "keep_both" });
  }

  return (
    <main className="min-h-0 flex-1 overflow-y-auto bg-background">
      <div className="mx-auto w-full max-w-5xl px-5 py-6 sm:px-8 sm:py-8">
        <header className="flex flex-col gap-4 border-b border-border pb-5 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="flex items-center gap-3">
              <Brain className="size-6 text-muted-foreground" />
              <h1 className="text-2xl font-semibold tracking-[-0.03em]">
                Memory
              </h1>
            </div>
            <p className="mt-1.5 max-w-xl text-sm leading-6 text-muted-foreground">
              Your AI remembers what matters to you. You choose what stays, what
              gets ignored, and what gets forgotten.
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap gap-2">
            <Button variant="outline" className="rounded-xl" onClick={onBackToChat}>
              Back to chat
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="size-10 rounded-xl"
              aria-label="Memory settings"
              onClick={() => setSettingsOpen(true)}
            >
              <Settings2 className="size-4" />
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

        {/* Toolbar: search, then one consolidated control bar */}
        <section className="mt-6 space-y-3">
          <div className="relative w-full lg:max-w-md">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={event => setQuery(event.target.value)}
              className="h-10 rounded-xl pl-9"
              placeholder="Search memories..."
              aria-label="Search memories"
            />
          </div>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <div
              className="flex rounded-xl border border-border bg-card p-1"
              role="tablist"
              aria-label="Memory type"
            >
              <TabButton
                label="User Memory"
                active={tab === "user"}
                onClick={() => setTab("user")}
              />
              <TabButton
                label="Conversation Memory"
                active={tab === "conversation"}
                onClick={() => setTab("conversation")}
              />
            </div>
            {tab === "user" && (
              <>
                <div
                  className="flex rounded-xl border border-border bg-card p-1"
                  role="group"
                  aria-label="Filter memories by status"
                >
                  {(["all", "active", "disabled", "suggestions"] as const).map(
                    value => (
                      <FilterButton
                        key={value}
                        label={
                          value === "all"
                            ? "All"
                            : value === "active"
                              ? "Active"
                              : value === "disabled"
                                ? "Disabled"
                                : "Suggestions"
                        }
                        active={statusFilter === value}
                        onClick={() => setStatusFilter(value)}
                      />
                    )
                  )}
                </div>
                {statusFilter !== "suggestions" && (
                  <Select
                    value={categoryFilter}
                    onValueChange={value =>
                      setCategoryFilter(value as UserMemoryCategory | "all")
                    }
                  >
                    <SelectTrigger
                      className="h-9 w-[170px] rounded-xl text-xs"
                      aria-label="Filter memories by category"
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All categories</SelectItem>
                      {CATEGORY_FILTERS.map(item => (
                        <SelectItem key={item.value} value={item.value}>
                          {item.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </>
            )}
          </div>
        </section>

        {/* Content */}
        <div className="mt-5 pb-10">
          {tab === "user" ? (
            statusFilter === "suggestions" ? (
              <SuggestionList
                suggestions={pendingSuggestions.filter(suggestion =>
                  query.trim()
                    ? suggestion.content
                        .toLowerCase()
                        .includes(query.trim().toLowerCase())
                    : true
                )}
                loading={suggestionsQuery.isLoading}
                hasQuery={Boolean(query.trim())}
                onAccept={openResolutionDialog}
                onDismiss={id => dismissSuggestionMutation.mutate({ id })}
                resolving={acceptSuggestionMutation.isPending}
              />
            ) : (
              <UserMemoryList
                memories={visibleUserMemories}
                loading={userMemoriesQuery.isLoading}
                hasFilters={Boolean(query.trim()) || categoryFilter !== "all" || statusFilter !== "all"}
                onEdit={setEditTarget}
                onToggle={memory =>
                  updateUserMutation.mutate({
                    id: memory.id,
                    status: memory.status === "active" ? "disabled" : "active",
                  })
                }
                onDelete={memory =>
                  setDeleteTarget({
                    kind: "user",
                    id: memory.id,
                    content: memory.content,
                  })
                }
                onWhy={setWhyTarget}
                toggling={updateUserMutation.isPending}
              />
            )
          ) : !activeConversationId ? (
            <EmptyBlock
              title="No conversation open"
              body="Start chatting, then come back here to see what KSEMO keeps in mind for this conversation."
            />
          ) : (
            <>
              <div className="mb-3 flex items-center justify-between gap-3">
                <p className="text-xs text-muted-foreground">
                  Current conversation
                </p>
                {allConversationMemories.length > 0 && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 rounded-lg text-destructive hover:bg-destructive/10 hover:text-destructive"
                    onClick={() => setClearAllConfirm(true)}
                  >
                    Clear conversation memory
                  </Button>
                )}
              </div>
              <ConversationMemoryList
                memories={visibleConversationMemories}
                loading={conversationMemoriesQuery.isLoading}
                hasQuery={Boolean(query.trim())}
                onEdit={setEditConvTarget}
                onForget={memory =>
                  setDeleteTarget({
                    kind: "conversation",
                    id: memory.id,
                    content: memory.content,
                  })
                }
              />
            </>
          )}
        </div>
      </div>

      {/* Add memory */}
      <AddMemoryDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        conversationId={activeConversationId}
        onCreateUser={input =>
          createUserMutation.mutateAsync(input).then(() => undefined)
        }
        onCreateConversation={input =>
          createConvMutation.mutateAsync(input).then(() => undefined)
        }
        creating={createUserMutation.isPending || createConvMutation.isPending}
      />

      {/* Edit user memory */}
      <EditUserMemoryDialog
        memory={editTarget}
        onClose={() => setEditTarget(null)}
        onSave={values => {
          if (!editTarget) return;
          updateUserMutation.mutate(
            { id: editTarget.id, ...values },
            { onSuccess: () => setEditTarget(null) }
          );
        }}
        saving={updateUserMutation.isPending}
      />

      {/* Edit conversation memory */}
      <EditConversationMemoryDialog
        memory={editConvTarget}
        onClose={() => setEditConvTarget(null)}
        onSave={values => {
          if (!editConvTarget) return;
          updateConvMutation.mutate(
            { id: editConvTarget.id, ...values },
            { onSuccess: () => setEditConvTarget(null) }
          );
        }}
        saving={updateConvMutation.isPending}
      />

      {/* Delete single memory */}
      <Dialog
        open={Boolean(deleteTarget)}
        onOpenChange={open => {
          if (!open) setDeleteTarget(null);
        }}
      >
        <DialogContent className="rounded-2xl sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl font-semibold tracking-[-0.02em]">
              Forget this memory?
            </DialogTitle>
            <DialogDescription>
              KSEMO will stop using “{deleteTarget?.content.slice(0, 80)}
              {deleteTarget && deleteTarget.content.length > 80 ? "…" : ""}”.
              This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={removeUserMutation.isPending || removeConvMutation.isPending}
              onClick={() => {
                if (!deleteTarget) return;
                if (deleteTarget.kind === "user")
                  removeUserMutation.mutate({ id: deleteTarget.id });
                else removeConvMutation.mutate({ id: deleteTarget.id });
                setDeleteTarget(null);
              }}
            >
              Forget
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Clear all conversation memory */}
      <Dialog
        open={clearAllConfirm}
        onOpenChange={setClearAllConfirm}
      >
        <DialogContent className="rounded-2xl sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl font-semibold tracking-[-0.02em]">
              Clear all memory from this conversation?
            </DialogTitle>
            <DialogDescription>
              The chat messages will remain, but KSEMO will no longer use the
              stored conversation memory.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setClearAllConfirm(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={clearConvMutation.isPending}
              onClick={() => {
                if (!activeConversationId) return;
                clearConvMutation.mutate(
                  { conversationId: activeConversationId },
                  { onSuccess: () => setClearAllConfirm(false) }
                );
              }}
            >
              Clear Memory
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Why remembered */}
      <Dialog
        open={Boolean(whyTarget)}
        onOpenChange={open => {
          if (!open) setWhyTarget(null);
        }}
      >
        <DialogContent className="rounded-2xl sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl font-semibold tracking-[-0.02em]">
              <HelpCircle className="size-5 text-muted-foreground" />
              Why was this remembered?
            </DialogTitle>
            <DialogDescription className="whitespace-pre-wrap">
              {whyTarget?.source === "explicit"
                ? `You explicitly asked me to remember:\n“${whyTarget?.content}”`
                : whyTarget?.explanation ||
                  "This was detected automatically from your conversations."}
            </DialogDescription>
          </DialogHeader>
        </DialogContent>
      </Dialog>

      {/* Conflict / duplicate resolution */}
      <ResolveSuggestionDialog
        target={resolveTarget}
        mergeDraft={mergeDraft}
        onMergeDraftChange={setMergeDraft}
        onClose={() => setResolveTarget(null)}
        onResolve={(resolution, mergedContent) => {
          if (!resolveTarget) return;
          acceptSuggestionMutation.mutate(
            {
              id: resolveTarget.id,
              resolution,
              mergedContent,
            },
            { onSuccess: () => setResolveTarget(null) }
          );
        }}
        resolving={acceptSuggestionMutation.isPending}
      />

      {/* Delete ALL user memories */}
      <Dialog
        open={clearAllEverythingConfirm}
        onOpenChange={setClearAllEverythingConfirm}
      >
        <DialogContent className="rounded-2xl sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl font-semibold tracking-[-0.02em]">
              Forget everything you remember about me?
            </DialogTitle>
              <DialogDescription>
                All long-term memories will be permanently deleted.
                Your chats are not affected.
              </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2">
            <Button
              variant="ghost"
              onClick={() => setClearAllEverythingConfirm(false)}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={removeAllMutation.isPending}
              onClick={() =>
                removeAllMutation.mutate(undefined, {
                  onSuccess: () => setClearAllEverythingConfirm(false),
                })
              }
            >
              Forget everything
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Memory settings */}
      <Dialog
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
      >
        <DialogContent className="rounded-2xl sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl font-semibold tracking-[-0.02em]">
              Memory settings
            </DialogTitle>
            <DialogDescription>
              You stay in control of everything KSEMO remembers.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <SettingRow
              title="Memory"
              description="Turn memory off and nothing new is suggested or used."
              checked={settingsQuery.data?.memoryEnabled ?? true}
              disabled={updateSettingsMutation.isPending}
              onCheckedChange={value =>
                updateSettingsMutation.mutate({ memoryEnabled: value })
              }
            />
            <SettingRow
              title="Automatically suggest memories"
              description="KSEMO proposes memories it thinks are worth keeping."
              checked={settingsQuery.data?.autoSuggest ?? true}
              disabled={updateSettingsMutation.isPending}
              onCheckedChange={value =>
                updateSettingsMutation.mutate({ autoSuggest: value })
              }
            />
            <SettingRow
              title="Automatically save inferred memories"
              description="Save detected preferences without asking first."
              checked={settingsQuery.data?.autoSaveInferred ?? false}
              disabled={updateSettingsMutation.isPending}
              onCheckedChange={value =>
                updateSettingsMutation.mutate({ autoSaveInferred: value })
              }
            />
            <SettingRow
              title="Show memory usage"
              description="Show which memories were used under a response."
              checked={settingsQuery.data?.showMemoryUsage ?? true}
              disabled={updateSettingsMutation.isPending}
              onCheckedChange={value =>
                updateSettingsMutation.mutate({ showMemoryUsage: value })
              }
            />
            {activeConversationId && (
              <SettingRow
                title="Pause memory for this conversation"
                description="Messages keep working normally, but this conversation ignores memory."
                checked={conversationMemoryPaused}
                disabled={pauseMemoryMutation.isPending}
                onCheckedChange={value =>
                  pauseMemoryMutation.mutate({
                    conversationId: activeConversationId,
                    paused: value,
                  })
                }
              />
            )}
            <div className="border-t border-border pt-3">
              <Button
                variant="outline"
                size="sm"
                className="w-full rounded-lg text-destructive hover:bg-destructive/10 hover:text-destructive"
                disabled={!allUserMemories.length}
                  onClick={() => {
                    setSettingsOpen(false);
                    setClearAllEverythingConfirm(true);
                  }}
              >
                <Trash2 className="mr-2 size-3.5" />
                Forget everything you remember about me
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </main>
  );
}

// ============================================
// Small building blocks
// ============================================

function TabButton({
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
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={cn(
        "rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors",
        active
          ? "bg-foreground text-background"
          : "text-muted-foreground hover:bg-muted hover:text-foreground"
      )}
    >
      {label}
    </button>
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

function SettingRow({
  title,
  description,
  checked,
  disabled,
  onCheckedChange,
}: {
  title: string;
  description: string;
  checked: boolean;
  disabled?: boolean;
  onCheckedChange: (value: boolean) => void;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div>
        <Label className="text-sm font-medium">{title}</Label>
        <p className="mt-0.5 text-xs leading-5 text-muted-foreground">
          {description}
        </p>
      </div>
      <Switch
        checked={checked}
        disabled={disabled}
        onCheckedChange={onCheckedChange}
        aria-label={title}
      />
    </div>
  );
}

function EmptyBlock({ title, body }: { title: string; body: string }) {
  return (
    <div className="grid min-h-56 place-items-center rounded-2xl border border-dashed border-border bg-muted/20 p-7 text-center">
      <div>
        <Sparkles className="mx-auto size-7 text-muted-foreground" />
        <h2 className="mt-4 text-base font-medium">{title}</h2>
        <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-muted-foreground">
          {body}
        </p>
      </div>
    </div>
  );
}

function ImportanceBadge({ importance }: { importance: MemoryImportance }) {
  if (importance === "high")
    return (
      <span className="rounded-md bg-amber-500/15 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-[0.08em] text-amber-600 dark:text-amber-400">
        High
      </span>
    );
  return null;
}

// ============================================
// Lists
// ============================================

function UserMemoryList({
  memories,
  loading,
  hasFilters,
  onEdit,
  onToggle,
  onDelete,
  onWhy,
  toggling,
}: {
  memories: UserMemoryItem[];
  loading: boolean;
  hasFilters: boolean;
  onEdit: (memory: UserMemoryItem) => void;
  onToggle: (memory: UserMemoryItem) => void;
  onDelete: (memory: UserMemoryItem) => void;
  onWhy: (memory: UserMemoryItem) => void;
  toggling: boolean;
}) {
  if (loading)
    return (
      <div className="grid min-h-64 place-items-center text-sm text-muted-foreground">
        Loading your memories…
      </div>
    );
  if (!memories.length)
    return (
      <EmptyBlock
        title={hasFilters ? "No memories match this view" : "No user memories yet"}
        body={
          hasFilters
            ? "Try another search or choose a different filter."
            : "Preferences, instructions, and facts you save here apply to every conversation. You can also just tell KSEMO “remember that…” in a chat."
        }
      />
    );
  return (
    <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 xl:grid-cols-3">
      {memories.map(memory => (
        <article
            key={memory.id}
            className={cn(
              "group relative flex flex-col rounded-2xl border bg-card p-3 transition-colors",
              memory.status === "active"
                ? "border-border hover:border-foreground/25"
                : "border-border bg-muted/30 opacity-80"
            )}
        >
          <div className="flex items-start justify-between gap-1.5">
            <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5">
              <span className="text-[9px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                {CATEGORY_LABELS[memory.category]}
              </span>
              <ImportanceBadge importance={memory.importance} />
              {!memory.expiresAt && (
                <span className="text-[9px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
                  Global
                </span>
              )}
              <span
                className={cn(
                  "text-[9px] font-semibold uppercase tracking-[0.08em]",
                  memory.status === "active"
                    ? "text-emerald-600 dark:text-emerald-400"
                    : "text-muted-foreground"
                )}
              >
                {memory.status === "active" ? "Active" : "Disabled"}
              </span>
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-7 rounded-lg text-muted-foreground opacity-0 transition-opacity focus:opacity-100 group-hover:opacity-100 group-focus-within:opacity-100"
                  aria-label="More memory actions"
                >
                  <Ellipsis className="size-3.5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52 rounded-xl">
                <DropdownMenuItem onClick={() => onWhy(memory)}>
                  <HelpCircle className="mr-2 size-3.5" /> Why was this
                  remembered?
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() =>
                    navigator.clipboard?.writeText(memory.content).catch(() => undefined)
                  }
                >
                  <Eye className="mr-2 size-3.5" /> Copy text
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => onDelete(memory)}
                  className="text-destructive focus:text-destructive"
                >
                  <Trash2 className="mr-2 size-3.5" /> Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
            <p
              className={cn(
                "mt-2 max-h-20 overflow-y-auto whitespace-pre-wrap break-words text-[13px] leading-5",
                memory.status === "active" ? "text-foreground" : "text-muted-foreground"
              )}
            >
              {memory.content}
            </p>
            <div className="mt-auto pt-1.5 flex items-center gap-x-3 gap-y-0.5 text-[10px] text-muted-foreground">
              <span className="min-w-0 truncate">
                Created {formatDate(memory.createdAt)}
                {memory.lastUsedAt && ` · Used ${formatDate(memory.lastUsedAt)}`}
                {memory.expiresAt && ` · Expires ${formatDate(memory.expiresAt)}`}
              </span>
              <span className="ml-auto flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-7 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground"
                      onClick={() => onEdit(memory)}
                      aria-label="Edit memory"
                    >
                      <Pencil className="size-3.5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">Edit</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-7 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground"
                      disabled={toggling}
                      onClick={() => onToggle(memory)}
                      aria-label={
                        memory.status === "active" ? "Disable memory" : "Enable memory"
                      }
                    >
                      <Power className="size-3.5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">
                    {memory.status === "active" ? "Disable" : "Enable"}
                  </TooltipContent>
                </Tooltip>
              </span>
            </div>
        </article>
      ))}
    </div>
  );
}

function ConversationMemoryList({
  memories,
  loading,
  hasQuery,
  onEdit,
  onForget,
}: {
  memories: ConversationMemoryItem[];
  loading: boolean;
  hasQuery: boolean;
  onEdit: (memory: ConversationMemoryItem) => void;
  onForget: (memory: ConversationMemoryItem) => void;
}) {
  if (loading)
    return (
      <div className="grid min-h-64 place-items-center text-sm text-muted-foreground">
        Loading conversation memory…
      </div>
    );
  if (!memories.length)
    return (
      <EmptyBlock
        title={hasQuery ? "No memories match your search" : "Nothing stored for this conversation yet"}
        body={
          hasQuery
            ? "Try a different search."
            : "As you chat, KSEMO quietly keeps track of important details, decisions, and requirements here. Temporary information never becomes permanent memory unless you approve it."
        }
      />
    );
    return (
      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 xl:grid-cols-3">
        {memories.map(memory => (
          <article
            key={memory.id}
            className="group relative flex flex-col rounded-2xl border border-border bg-card p-3 transition-colors hover:border-foreground/25"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5">
                <span
                  aria-hidden
                  className="size-1.5 shrink-0 rounded-full bg-sky-500/70"
                />
                <span className="text-[9px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                  {CATEGORY_LABELS[memory.category]}
                </span>
                <ImportanceBadge importance={memory.importance} />
              </div>
            </div>
            <p className="mt-2 max-h-20 overflow-y-auto whitespace-pre-wrap break-words text-[13px] leading-5">
              {memory.content}
            </p>
            <div className="mt-auto flex items-center gap-x-3 pt-1.5 text-[10px] text-muted-foreground">
              <span className="min-w-0 truncate">
                Added {formatRelative(memory.createdAt)}
              </span>
              <span className="ml-auto flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-7 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground"
                      onClick={() => onEdit(memory)}
                      aria-label="Edit memory"
                    >
                      <Pencil className="size-3.5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">Edit</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-7 rounded-lg text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                      onClick={() => onForget(memory)}
                      aria-label="Forget memory"
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">Forget</TooltipContent>
                </Tooltip>
              </span>
            </div>
          </article>
        ))}
      </div>
    );
  }

function SuggestionList({
  suggestions,
  loading,
  hasQuery,
  onAccept,
  onDismiss,
  resolving,
}: {
  suggestions: SuggestionItem[];
  loading: boolean;
  hasQuery: boolean;
  onAccept: (suggestion: SuggestionItem) => void;
  onDismiss: (id: string) => void;
  resolving: boolean;
}) {
  if (loading)
    return (
      <div className="grid min-h-64 place-items-center text-sm text-muted-foreground">
        Loading suggestions…
      </div>
    );
  if (!suggestions.length)
    return (
      <EmptyBlock
        title={hasQuery ? "No suggestions match your search" : "No pending suggestions"}
        body={
          hasQuery
            ? "Try a different search."
            : "When KSEMO notices something that could be useful long-term, it asks you here before remembering anything."
        }
      />
    );
  return (
    <div className="space-y-2.5">
      <p className="text-xs text-muted-foreground">
        Suggested Memory · you decide what becomes permanent.
      </p>
      {suggestions.map(suggestion => {
        const kind = suggestion.meta?.kind ?? "new";
        return (
          <article
            key={suggestion.id}
            className={cn(
              "rounded-2xl border bg-card px-4 py-3.5",
              kind === "conflict"
                ? "border-amber-500/40"
                : kind === "duplicate"
                  ? "border-sky-500/40"
                  : "border-border"
            )}
          >
            {kind !== "new" && (
              <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-amber-600 dark:text-amber-400">
                ⚠ {kind === "conflict" ? "Possible memory conflict" : "Similar memory found"}
              </p>
            )}
            <p className="whitespace-pre-wrap break-words text-[13px] leading-5">
              {suggestion.content}
            </p>
            {kind !== "new" && suggestion.meta?.similarTo?.[0] && (
              <p className="mt-2 rounded-lg bg-muted/60 px-2.5 py-1.5 text-[11px] leading-4 text-muted-foreground">
                You already have: “{suggestion.meta.similarTo[0].content}”
              </p>
            )}
            {kind === "new" && (
              <p className="mt-1.5 text-[10px] text-muted-foreground">
                {CATEGORY_LABELS[suggestion.category]}
                {suggestion.reason ? ` · ${suggestion.reason}` : ""}
              </p>
            )}
            <div className="mt-3 flex gap-1.5">
              <Button
                size="sm"
                className="h-7 rounded-lg bg-foreground px-3 text-xs text-background hover:bg-foreground/90"
                disabled={resolving}
                onClick={() => onAccept(suggestion)}
              >
                Remember
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-7 rounded-lg px-3 text-xs"
                disabled={resolving}
                onClick={() => onDismiss(suggestion.id)}
              >
                Ignore
              </Button>
            </div>
          </article>
        );
      })}
    </div>
  );
}

// ============================================
// Add dialog
// ============================================

const EXPIRY_OPTIONS = [
  { value: "never", label: "Never expires" },
  { value: "30", label: "30 days" },
  { value: "90", label: "90 days" },
  { value: "365", label: "1 year" },
] as const;

function expiryToDays(value: string): number | null {
  if (value === "never") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function AddMemoryDialog({
  open,
  onOpenChange,
  conversationId,
  onCreateUser,
  onCreateConversation,
  creating,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  conversationId: string | null;
  onCreateUser: (input: {
    content: string;
    category: UserMemoryCategory;
    importance: MemoryImportance;
    expires: { days: number } | null;
  }) => Promise<void>;
  onCreateConversation: (input: {
    conversationId: string;
    content: string;
    category: UserMemoryCategory;
    importance: MemoryImportance;
  }) => Promise<void>;
  creating: boolean;
}) {
  const [scope, setScope] = useState<"user" | "conversation">("user");
  const [content, setContent] = useState("");
  const [category, setCategory] = useState<UserMemoryCategory>("preference");
  const [importance, setImportance] = useState<MemoryImportance>("medium");
  const [expiry, setExpiry] = useState<string>("never");

  async function save() {
    const trimmed = content.trim();
    if (!trimmed) return;
    if (scope === "conversation") {
      if (!conversationId) return;
      await onCreateConversation({
        conversationId,
        content: trimmed,
        category,
        importance,
      });
    } else {
      await onCreateUser({
        content: trimmed,
        category,
        importance,
        expires: expiryToDays(expiry)
          ? { days: expiryToDays(expiry)! }
          : null,
      });
    }
    setContent("");
    onOpenChange(false);
  }

  return (
    <Dialog
      open={open}
      onOpenChange={next => {
        if (!next) onOpenChange(false);
      }}
    >
      <DialogContent className="rounded-2xl sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold tracking-[-0.02em]">
            Add a memory
          </DialogTitle>
          <DialogDescription>
            Write something you want KSEMO to remember.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          {conversationId && (
            <div className="flex rounded-xl border border-border bg-card p-1">
              <FilterButton
                label="User memory (global)"
                active={scope === "user"}
                onClick={() => setScope("user")}
              />
              <FilterButton
                label="This conversation only"
                active={scope === "conversation"}
                onClick={() => setScope("conversation")}
              />
            </div>
          )}
          <Textarea
            id="memory-content"
            value={content}
            onChange={event => setContent(event.target.value)}
              maxLength={2000}
              className="max-h-40 min-h-[68px] resize-none overflow-y-auto rounded-xl"
              placeholder="For example: I prefer concise answers with practical examples."
            autoFocus
            aria-label="Memory"
          />
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Category</Label>
              <Select value={category} onValueChange={value => setCategory(value as UserMemoryCategory)}>
                <SelectTrigger className="h-9 w-full rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {USER_MEMORY_CATEGORIES.map(value => (
                    <SelectItem key={value} value={value}>
                      {CATEGORY_LABELS[value]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Importance</Label>
              <Select
                value={importance}
                onValueChange={value => setImportance(value as MemoryImportance)}
              >
                <SelectTrigger className="h-9 w-full rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {scope === "user" && (
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Expiration</Label>
                <Select value={expiry} onValueChange={setExpiry}>
                  <SelectTrigger className="h-9 w-full rounded-xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {EXPIRY_OPTIONS.map(option => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              className="rounded-xl"
              onClick={() => void save()}
              disabled={!content.trim() || creating}
            >
              {creating ? "Saving…" : "Save memory"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ============================================
// Edit dialogs
// ============================================

function EditUserMemoryDialog({
  memory,
  onClose,
  onSave,
  saving,
}: {
  memory: UserMemoryItem | null;
  onClose: () => void;
  onSave: (values: {
    content: string;
    category: UserMemoryCategory;
    status: "active" | "disabled";
    importance: MemoryImportance;
    expires: { days: number } | null;
  }) => void;
  saving: boolean;
}) {
  const [content, setContent] = useState("");
  const [category, setCategory] = useState<UserMemoryCategory>("other");
  const [status, setStatus] = useState<"active" | "disabled">("active");
  const [importance, setImportance] = useState<MemoryImportance>("medium");
  const [expiry, setExpiry] = useState("never");
  const [initializedFor, setInitializedFor] = useState<string | null>(null);

  if (memory && initializedFor !== memory.id) {
    setInitializedFor(memory.id);
    setContent(memory.content);
    setCategory(memory.category);
    setStatus(memory.status);
    setImportance(memory.importance);
    setExpiry(
      memory.expiresAt
        ? String(
            Math.max(
              1,
              Math.round(
                (memory.expiresAt.getTime() - Date.now()) / (24 * 60 * 60 * 1000)
              )
            )
          )
        : "never"
    );
  }

  return (
    <Dialog
      open={Boolean(memory)}
      onOpenChange={next => {
        if (!next) {
          setInitializedFor(null);
          onClose();
        }
      }}
    >
      <DialogContent className="rounded-2xl sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold tracking-[-0.02em]">
            Edit memory
          </DialogTitle>
          <DialogDescription>
            Change anything about what KSEMO remembers.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="edit-memory-content">Memory</Label>
            <Textarea
                id="edit-memory-content"
                value={content}
                onChange={event => setContent(event.target.value)}
                maxLength={2000}
                className="max-h-40 min-h-20 resize-none overflow-y-auto rounded-xl"
            />
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Category</Label>
              <Select
                value={category}
                onValueChange={value => setCategory(value as UserMemoryCategory)}
              >
                <SelectTrigger className="w-full rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {USER_MEMORY_CATEGORIES.map(value => (
                    <SelectItem key={value} value={value}>
                      {CATEGORY_LABELS[value]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Importance</Label>
              <Select
                value={importance}
                onValueChange={value => setImportance(value as MemoryImportance)}
              >
                <SelectTrigger className="w-full rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select
                value={status}
                onValueChange={value => setStatus(value as "active" | "disabled")}
              >
                <SelectTrigger className="w-full rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="disabled">Disabled</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Expiration</Label>
              <Select value={expiry} onValueChange={setExpiry}>
                <SelectTrigger className="w-full rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="never">Never expires</SelectItem>
                  <SelectItem value="30">30 days</SelectItem>
                  <SelectItem value="90">90 days</SelectItem>
                  <SelectItem value="365">1 year</SelectItem>
                  <SelectItem value="__custom__">Custom…</SelectItem>
                </SelectContent>
              </Select>
              {expiry === "__custom__" && (
                <Input
                  type="date"
                  className="rounded-xl"
                  onChange={event => {
                    const picked = event.target.value
                      ? new Date(`${event.target.value}T12:00:00`)
                      : null;
                    if (!picked) {
                      setExpiry("never");
                      return;
                    }
                    setExpiry(
                      String(
                        Math.max(
                          1,
                          Math.round(
                            (picked.getTime() - Date.now()) / (24 * 60 * 60 * 1000)
                          )
                        )
                      )
                    );
                  }}
                />
              )}
            </div>
          </div>
          <dl className="grid grid-cols-3 gap-2 rounded-xl bg-muted/40 p-3 text-[11px] text-muted-foreground">
            <div>
              <dt className="font-medium uppercase tracking-[0.06em]">Created</dt>
              <dd className="mt-0.5">{formatDate(memory?.createdAt)}</dd>
            </div>
              <div>
                <dt className="font-medium uppercase tracking-[0.06em]">Last used</dt>
                <dd className="mt-0.5">
                  {memory?.lastUsedAt ? formatDate(memory.lastUsedAt) : "Never"}
                </dd>
              </div>
            </dl>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button
              className="rounded-xl"
              disabled={saving || !content.trim()}
              onClick={() =>
                onSave({
                  content: content.trim(),
                  category,
                  status,
                  importance,
                  expires: expiryToDays(expiry) ? { days: expiryToDays(expiry)! } : null,
                })
              }
            >
              {saving ? "Saving…" : "Save changes"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function EditConversationMemoryDialog({
  memory,
  onClose,
  onSave,
  saving,
}: {
  memory: ConversationMemoryItem | null;
  onClose: () => void;
  onSave: (values: {
    content: string;
    category: UserMemoryCategory;
    importance: MemoryImportance;
  }) => void;
  saving: boolean;
}) {
  const [content, setContent] = useState("");
  const [category, setCategory] = useState<UserMemoryCategory>("other");
  const [importance, setImportance] = useState<MemoryImportance>("medium");
  const [initializedFor, setInitializedFor] = useState<string | null>(null);

  if (memory && initializedFor !== memory.id) {
    setInitializedFor(memory.id);
    setContent(memory.content);
    setCategory(memory.category);
    setImportance(memory.importance);
  }

  return (
    <Dialog
      open={Boolean(memory)}
      onOpenChange={next => {
        if (!next) {
          setInitializedFor(null);
          onClose();
        }
      }}
    >
      <DialogContent className="rounded-2xl sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold tracking-[-0.02em]">
            Edit conversation memory
          </DialogTitle>
          <DialogDescription>
            This memory belongs only to the current conversation.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="edit-conversation-memory-content">Memory</Label>
            <Textarea
                id="edit-conversation-memory-content"
                value={content}
                onChange={event => setContent(event.target.value)}
                maxLength={2000}
                className="max-h-40 min-h-20 resize-none overflow-y-auto rounded-xl"
            />
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Category</Label>
              <Select
                value={category}
                onValueChange={value => setCategory(value as UserMemoryCategory)}
              >
                <SelectTrigger className="w-full rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {USER_MEMORY_CATEGORIES.map(value => (
                    <SelectItem key={value} value={value}>
                      {CATEGORY_LABELS[value]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Importance</Label>
              <Select
                value={importance}
                onValueChange={value => setImportance(value as MemoryImportance)}
              >
                <SelectTrigger className="w-full rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button
              className="rounded-xl"
              disabled={saving || !content.trim()}
              onClick={() =>
                onSave({ content: content.trim(), category, importance })
              }
            >
              {saving ? "Saving…" : "Save changes"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ============================================
// Conflict / duplicate resolution dialog
// ============================================

function ResolveSuggestionDialog({
  target,
  mergeDraft,
  onMergeDraftChange,
  onClose,
  onResolve,
  resolving,
}: {
  target: SuggestionItem | null;
  mergeDraft: string;
  onMergeDraftChange: (value: string) => void;
  onClose: () => void;
  onResolve: (
    resolution: "keep_both" | "replace" | "merge",
    mergedContent?: string
  ) => void;
  resolving: boolean;
}) {
  const kind = target?.meta?.kind;
  const existing = target?.meta?.similarTo?.[0];
  const isConflict = kind === "conflict";
  const [mergeMode, setMergeMode] = useState(false);

  return (
    <Dialog
      open={Boolean(target)}
      onOpenChange={next => {
        if (!next) {
          setMergeMode(false);
          onClose();
        }
      }}
    >
      <DialogContent className="rounded-2xl sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold tracking-[-0.02em]">
            {isConflict ? "⚠ Possible memory conflict" : "Similar memory found"}
          </DialogTitle>
          <DialogDescription>
            New memory: “{target?.content}”
            {existing ? (
              <>
                <br />
                {isConflict ? "You already have:" : "Existing memory:"} “
                {existing.content}”
              </>
            ) : null}
          </DialogDescription>
        </DialogHeader>
        {mergeMode ? (
          <div className="space-y-3">
            <Label htmlFor="merge-memory">Merged memory</Label>
            <Textarea
              id="merge-memory"
              value={mergeDraft}
              onChange={event => onMergeDraftChange(event.target.value)}
                maxLength={2000}
                className="max-h-40 min-h-24 resize-none overflow-y-auto rounded-xl"
                autoFocus
            />
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setMergeMode(false)}>
                Back
              </Button>
              <Button
                className="rounded-xl"
                disabled={resolving || mergeDraft.trim().length < 2}
                onClick={() => onResolve("merge", mergeDraft.trim())}
              >
                Save merged memory
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap justify-end gap-2">
            {isConflict ? (
              <>
                <Button
                  variant="outline"
                  className="rounded-xl"
                  disabled={resolving}
                  onClick={() => onResolve("keep_both")}
                >
                  Keep Both
                </Button>
                <Button
                  variant="outline"
                  className="rounded-xl"
                  disabled={resolving}
                  onClick={() => onResolve("replace")}
                >
                  Replace Old
                </Button>
                <Button
                  className="rounded-xl"
                  disabled={resolving}
                  onClick={() => setMergeMode(true)}
                >
                  Merge
                </Button>
                <Button variant="ghost" onClick={onClose}>
                  Cancel
                </Button>
              </>
            ) : (
              <>
                <Button
                  variant="outline"
                  className="rounded-xl"
                  disabled={resolving}
                  onClick={() => onResolve("replace")}
                >
                  Update existing memory
                </Button>
                <Button
                  variant="outline"
                  className="rounded-xl"
                  disabled={resolving}
                  onClick={() => onResolve("keep_both")}
                >
                  Create separate memory
                </Button>
                <Button variant="ghost" onClick={onClose}>
                  Cancel
                </Button>
              </>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
