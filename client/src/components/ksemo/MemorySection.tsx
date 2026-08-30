import { Loading } from "@/components/ui/loading";
import { Switch } from "@/components/ui/switch";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { useState } from "react";
import { Brain, Loader2 } from "lucide-react";

export function MemorySection() {
  const utils = trpc.useUtils();
  const settingsQuery = trpc.memory.settings.get.useQuery();
  const memoriesQuery = trpc.memory.list.useQuery();

  // Local optimistic mirror of the toggle so the switch flips instantly on
  // click. It is cleared once the server settles (success or error), at which
  // point the refetched server state takes over again.
  const [optimisticEnabled, setOptimisticEnabled] = useState<boolean | null>(
    null
  );

  const settingsMutation = trpc.memory.settings.update.useMutation({
    onError: () => {
      setOptimisticEnabled(null);
      toast.error("Could not update memory settings.");
    },
    onSettled: () => {
      setOptimisticEnabled(null);
      utils.memory.settings.get.invalidate();
      utils.memory.list.invalidate();
    },
  });

  if (settingsQuery.isLoading || memoriesQuery.isLoading) {
    return (
      <div className="space-y-4">
        <div>
          <h3 className="text-base font-semibold tracking-[-0.02em]">Memory</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Automatically remember what matters from your conversations.
          </p>
        </div>
        <Loading className="py-8" />
      </div>
    );
  }

  // No settings row yet means the user is starting fresh — memory is off.
  const memoryEnabled =
    optimisticEnabled ?? settingsQuery.data?.memoryEnabled ?? false;
  const memoryCount = memoriesQuery.data?.length ?? 0;
  const settingsBusy = settingsMutation.isPending;

  const loadFailed = settingsQuery.isError || memoriesQuery.isError;

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold tracking-[-0.02em]">Memory</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            KSEMO automatically analyzes your conversations, remembers the
            facts, preferences, and context that matter, and uses them to give
            you consistent, personal answers. Everything is saved automatically
            and stays in your account.
          </p>
        </div>
        <Brain className="mt-1 size-5 shrink-0 text-muted-foreground" />
      </div>

      {loadFailed && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-3.5">
          <p className="text-sm font-medium text-destructive">
            Memory couldn't be loaded
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            KSEMO couldn't reach the memory store. Check that your database is
            reachable and that the{" "}
            <code className="rounded bg-muted px-1 py-0.5">
              conversation_memories
            </code>{" "}
            and{" "}
            <code className="rounded bg-muted px-1 py-0.5">
              memory_settings
            </code>{" "}
            tables exist, then try again.
          </p>
        </div>
      )}

      <div className="flex w-full items-center justify-between gap-3 rounded-xl border border-border p-3.5">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-sm font-medium">Memory</p>
            {settingsBusy && (
              <Loader2 className="size-3 animate-spin text-muted-foreground" />
            )}
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {memoryEnabled
              ? "On — KSEMO remembers facts from your conversations automatically"
              : "Off — no conversations are analyzed or remembered right now"}
          </p>
        </div>
        <Switch
          checked={memoryEnabled}
          disabled={settingsBusy}
          onCheckedChange={next => {
            setOptimisticEnabled(next);
            settingsMutation.mutate({ memoryEnabled: next });
          }}
          aria-label="Toggle memory"
        />
      </div>

      {!memoryEnabled ? (
        <div className="rounded-xl border border-border bg-muted/40 p-3.5">
          <p className="text-sm font-medium">Memory is off</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            New conversations are not analyzed and existing memories are not
            used in your replies. Turn on Memory to start remembering.
          </p>
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-muted/40 p-3.5">
          <p className="text-sm font-medium">
            {memoryCount === 0
              ? "Nothing saved yet"
              : `${memoryCount} saved ${memoryCount === 1 ? "memory" : "memories"}`}
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {memoryCount === 0
              ? "After your next conversation, KSEMO will remember the important facts automatically and use them in future replies."
              : "These memories are used automatically when they are relevant to a conversation. Turn Memory off at any time to stop saving and using them."}
          </p>
        </div>
      )}
    </div>
  );
}
