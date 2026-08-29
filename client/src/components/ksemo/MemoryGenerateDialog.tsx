import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Loading } from "@/components/ui/loading";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import {
  memoryCategoryLabel,
  type MemoryCategoryId,
} from "@shared/memory";
import { useEffect, useState } from "react";
import { ArrowLeft, Check, MessageSquare, ShieldAlert } from "lucide-react";

type CandidateDraft = {
  key: string;
  title: string;
  content: string;
  category: MemoryCategoryId;
  sensitive: boolean;
  sourceConversationId: string | null;
  approved: boolean;
};

type ConversationRow = {
  id: string;
  title: string;
  updatedAt?: Date | string | null;
};

function formatDate(value: Date | string | null | undefined): string {
  if (!value) return "";
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function MemoryGenerateDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const utils = trpc.useUtils();
  const chatsQuery = trpc.conversation.list.useQuery(
    { scope: "active" },
    { enabled: open }
  );
  const conversations = (chatsQuery.data ?? []) as ConversationRow[];

  const [stage, setStage] = useState<"select" | "review">("select");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [candidates, setCandidates] = useState<CandidateDraft[]>([]);
  const [blockedSensitive, setBlockedSensitive] = useState(0);

  useEffect(() => {
    if (!open) {
      setStage("select");
      setSelected(new Set());
      setCandidates([]);
      setBlockedSensitive(0);
    }
  }, [open]);

  const generateMutation = trpc.memory.generate.useMutation({
    onSuccess: result => {
      setCandidates(
        result.candidates.map((candidate, index) => ({
          key: `${candidate.sourceConversationId ?? "chat"}-${index}-${candidate.content}`,
          title: candidate.title,
          content: candidate.content,
          category: candidate.category,
          sensitive: candidate.sensitive,
          sourceConversationId: candidate.sourceConversationId,
          approved: true,
        }))
      );
      setBlockedSensitive(result.blockedSensitive);
      setStage("review");
    },
    onError: () => {
      toast.error("Could not analyze your chats. Please try again.");
    },
  });

  const approveMutation = trpc.memory.approveGenerated.useMutation({
    onSuccess: result => {
      utils.memory.list.invalidate();
      const saved = result.saved;
      toast.success(
        saved === 1
          ? "1 memory saved to your account"
          : `${saved} memories saved to your account`
      );
      onOpenChange(false);
      setStage("select");
      setSelected(new Set());
      setCandidates([]);
      setBlockedSensitive(0);
    },
    onError: () => {
      toast.error("Could not save your memories. Please try again.");
    },
  });

  const toggleConversation = (id: string) => {
    setSelected(current => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    setSelected(current => {
      const allSelected =
        conversations.length > 0 &&
        conversations.every(conversation => current.has(conversation.id));
      const next = new Set<string>();
      if (!allSelected) {
        for (const conversation of conversations) next.add(conversation.id);
      }
      return next;
    });
  };

  const updateCandidate = (key: string, patch: Partial<CandidateDraft>) => {
    setCandidates(current =>
      current.map(candidate =>
        candidate.key === key ? { ...candidate, ...patch } : candidate
      )
    );
  };

  const runGenerate = () => {
    if (selected.size === 0) return;
    generateMutation.mutate({ conversationIds: Array.from(selected) });
  };

  const saveApproved = () => {
    const approvedItems = candidates
      .filter(candidate => candidate.approved)
      .map(candidate => ({
        title: candidate.title.trim(),
        content: candidate.content.trim(),
        category: candidate.category,
        sourceConversationId: candidate.sourceConversationId ?? undefined,
      }))
      .filter(item => item.title.length > 0 && item.content.length > 0);
    if (approvedItems.length === 0) {
      toast.error("Select at least one memory idea to save.");
      return;
    }
    approveMutation.mutate({ items: approvedItems });
  };

  const approvedCount = candidates.filter(candidate => candidate.approved)
    .length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[36rem] w-[calc(100%-1.5rem)] max-w-xl flex-col gap-0 overflow-hidden rounded-2xl p-0">
        <DialogHeader className="shrink-0 border-b border-border px-4 pb-3 pt-4">
          <DialogTitle className="text-base">
            Generate memory from chats
          </DialogTitle>
        </DialogHeader>

        {stage === "select" ? (
          <>
            <div className="shrink-0 border-b border-border px-4 py-3 text-xs text-muted-foreground">
              Pick the chats to look through. Ideas are only suggestions —
              nothing is saved until you review and approve it.
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto p-3">
              {chatsQuery.isLoading ? (
                <Loading className="py-6" />
              ) : conversations.length === 0 ? (
                <div className="py-10 text-center">
                  <MessageSquare className="mx-auto size-6 text-muted-foreground" />
                  <p className="mt-3 text-sm font-medium">No active chats</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Start a conversation first, then come back to generate
                    memory ideas.
                  </p>
                </div>
              ) : (
                <>
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-[11px] text-muted-foreground">
                      {selected.size === 0
                        ? "No chats selected"
                        : `${selected.size} ${
                            selected.size === 1 ? "chat" : "chats"
                          } selected`}
                    </span>
                    <button
                      type="button"
                      onClick={toggleSelectAll}
                      className="text-[11px] font-medium text-foreground hover:underline"
                    >
                      {conversations.length > 0 &&
                      conversations.every(conversation =>
                        selected.has(conversation.id)
                      )
                        ? "Clear all"
                        : "Select all"}
                    </button>
                  </div>
                  <ul className="space-y-1.5">
                    {conversations.map(conversation => (
                      <li key={conversation.id}>
                        <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-border px-3 py-2.5 transition-colors hover:bg-muted/50">
                          <Checkbox
                            checked={selected.has(conversation.id)}
                            onCheckedChange={() =>
                              toggleConversation(conversation.id)
                            }
                            aria-label={`Select ${conversation.title}`}
                          />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-[13px] font-medium">
                              {conversation.title}
                            </span>
                            <span className="block text-[11px] text-muted-foreground">
                              Updated {formatDate(conversation.updatedAt)}
                            </span>
                          </span>
                        </label>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </div>
            <div className="shrink-0 flex items-center justify-between gap-3 border-t border-border px-4 py-3">
              <span className="text-[11px] text-muted-foreground">
                Only the chats you select are analyzed.
              </span>
              <Button
                size="sm"
                disabled={
                  selected.size === 0 || generateMutation.isPending
                }
                onClick={runGenerate}
              >
                {generateMutation.isPending
                  ? "Analyzing…"
                  : `Generate ideas${selected.size > 0 ? ` (${selected.size})` : ""}`}
              </Button>
            </div>
          </>
        ) : (
          <>
            <div className="shrink-0 flex items-center gap-3 border-b border-border px-4 py-2.5">
              <Button
                variant="ghost"
                size="sm"
                className="-ml-2 text-muted-foreground"
                disabled={generateMutation.isPending}
                onClick={() => setStage("select")}
              >
                <ArrowLeft className="mr-1 size-3.5" />
                Change chats
              </Button>
              <span className="ml-auto text-[11px] text-muted-foreground">
                {candidates.length} idea{candidates.length === 1 ? "" : "s"} ·{" "}
                {approvedCount} selected
              </span>
            </div>

            {blockedSensitive > 0 && (
              <div className="flex shrink-0 items-start gap-2 border-b border-border bg-muted/40 px-4 py-2.5 text-xs text-muted-foreground">
                <ShieldAlert className="mt-0.5 size-3.5 shrink-0" />
                <p>
                  {blockedSensitive}{" "}
                  {blockedSensitive === 1
                    ? "part"
                    : "parts"}{" "}
                  mention sensitive topics and were skipped because Sensitive
                  topics is off. Enable it in Memory settings to review them.
                </p>
              </div>
            )}

            <div className="min-h-0 flex-1 overflow-y-auto p-3">
              {generateMutation.isPending ? (
                <Loading className="py-6" />
              ) : candidates.length === 0 ? (
                <div className="py-10 text-center">
                  <Check className="mx-auto size-6 text-muted-foreground" />
                  <p className="mt-3 text-sm font-medium">
                    No memory ideas found
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Nothing in the selected chats looked like something worth
                    remembering. Try a different set of chats.
                  </p>
                </div>
              ) : (
                <ul className="space-y-2">
                  {candidates.map(candidate => (
                    <li key={candidate.key}>
                      <div className="rounded-xl border border-border p-3">
                        <div className="flex items-start gap-2">
                          <Checkbox
                            checked={candidate.approved}
                            onCheckedChange={next =>
                              updateCandidate(candidate.key, {
                                approved: Boolean(next),
                              })
                            }
                            aria-label="Save this memory idea"
                            className="mt-1 shrink-0"
                          />
                          <div className="min-w-0 flex-1 space-y-2">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <span
                                className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                                  candidate.sensitive
                                    ? "bg-destructive/10 text-destructive"
                                    : "bg-muted text-muted-foreground"
                                }`}
                              >
                                {memoryCategoryLabel(candidate.category)}
                              </span>
                              {candidate.sensitive && (
                                <span className="rounded-full bg-destructive/10 px-2 py-0.5 text-[10px] font-medium text-destructive">
                                  Sensitive
                                </span>
                              )}
                              {!candidate.approved && (
                                <span className="text-[10px] text-muted-foreground">
                                  Skipped
                                </span>
                              )}
                            </div>
                            <Input
                              value={candidate.title}
                              maxLength={160}
                              onChange={e =>
                                updateCandidate(candidate.key, {
                                  title: e.target.value,
                                })
                              }
                              className="h-8 rounded-lg text-[13px] font-medium"
                              aria-label="Memory title"
                            />
                            <Textarea
                              value={candidate.content}
                              maxLength={4000}
                              onChange={e =>
                                updateCandidate(candidate.key, {
                                  content: e.target.value,
                                })
                              }
                              className="min-h-14 resize-none rounded-lg border border-border text-xs"
                              aria-label="Memory content"
                            />
                          </div>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="shrink-0 flex items-center justify-between gap-3 border-t border-border px-4 py-3">
              <span className="text-[11px] text-muted-foreground">
                Saving is explicit — only approved ideas are stored.
              </span>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={approveMutation.isPending}
                  onClick={() => {
                    setCandidates([]);
                    setStage("select");
                  }}
                >
                  Discard all
                </Button>
                <Button
                  size="sm"
                  disabled={approvedCount === 0 || approveMutation.isPending}
                  onClick={saveApproved}
                >
                  {approveMutation.isPending
                    ? "Saving…"
                    : `Save ${approvedCount} selected${approvedCount === 1 ? " memory" : " memories"}`}
                </Button>
              </div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}