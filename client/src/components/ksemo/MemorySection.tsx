import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Loading } from "@/components/ui/loading";
import { Switch } from "@/components/ui/switch";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { MEMORY_CATEGORIES } from "@shared/memory";
import { useState } from "react";
import { Brain, ShieldAlert } from "lucide-react";
import { MemoryGenerateDialog } from "./MemoryGenerateDialog";
import { MemoryManagerDialog } from "./MemoryManagerDialog";

export function MemorySection() {
  const utils = trpc.useUtils();
  const settingsQuery = trpc.memory.settings.get.useQuery();
  const memoriesQuery = trpc.memory.list.useQuery();
  const [managerOpen, setManagerOpen] = useState(false);
  const [generateOpen, setGenerateOpen] = useState(false);
  const [sensitiveConfirmOpen, setSensitiveConfirmOpen] = useState(false);
  const [pendingSensitiveValue, setPendingSensitiveValue] = useState(false);

  const settingsMutation = trpc.memory.settings.update.useMutation({
    onSuccess: () => {
      utils.memory.settings.get.invalidate();
    },
    onError: () => toast.error("Could not update memory settings."),
  });

  const applySettings = (
    patch: {
      memoryEnabled?: boolean;
      generateFromChats?: boolean;
      sensitiveMemoryEnabled?: boolean;
    },
    successMessage?: string
  ) => {
    settingsMutation.mutate(patch);
    if (successMessage) toast.success(successMessage);
  };

  const toggleSensitive = (next: boolean) => {
    if (next) {
      setPendingSensitiveValue(true);
      setSensitiveConfirmOpen(true);
      return;
    }
    applySettings(
      { sensitiveMemoryEnabled: false },
      "Sensitive topics are off."
    );
  };

  if (settingsQuery.isLoading || memoriesQuery.isLoading) {
    return (
      <div className="space-y-4">
        <div>
          <h3 className="text-base font-semibold tracking-[-0.02em]">
            Memory
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Save facts about you and use them to give more personal answers.
          </p>
        </div>
        <Loading className="py-8" />
      </div>
    );
  }

  // No settings row yet means the user is starting fresh — every flag is off.
  const resolvedSettings = settingsQuery.data ?? {
    memoryEnabled: false,
    generateFromChats: false,
    sensitiveMemoryEnabled: false,
  };
  const memoryCount = memoriesQuery.data?.length ?? 0;
  const settingsBusy = settingsMutation.isPending;

  const sensitiveCategories = MEMORY_CATEGORIES.filter(
    category => category.sensitive
  );

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold tracking-[-0.02em]">
            Memory
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Save facts about you and let KSEMO use them to give more personal
            answers. Everything is opt-in — nothing is stored without your
            control.
          </p>
        </div>
        <Brain className="mt-1 size-5 shrink-0 text-muted-foreground" />
      </div>

      <div className="flex w-full items-center justify-between gap-3 rounded-xl border border-border p-3.5">
        <div className="min-w-0">
          <p className="text-sm font-medium">Memory</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {resolvedSettings.memoryEnabled
              ? "On — saved memories can be used in your conversations"
              : "Off — no memories are saved or used right now"}
          </p>
        </div>
        <Switch
          checked={resolvedSettings.memoryEnabled}
          disabled={settingsBusy}
          onCheckedChange={next =>
            applySettings({
              memoryEnabled: next,
              ...(next ? {} : { generateFromChats: false }),
            })
          }
          aria-label="Toggle memory"
        />
      </div>

      {!resolvedSettings.memoryEnabled && (
        <div className="rounded-xl border border-border bg-muted/40 p-3.5">
          <p className="text-sm font-medium">Memory is off</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            New memories are not saved, and existing memories are not used in
            your conversations. Turn on Memory to start saving facts.
          </p>
        </div>
      )}

      <div className="flex w-full items-center justify-between gap-3 rounded-xl border border-border p-3.5">
        <div className="min-w-0">
          <p className="text-sm font-medium">Generate memory from chats</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Create memory ideas from your existing chats. You pick the chats,
            and every idea is shown for your review — nothing is saved
            automatically.
          </p>
        </div>
        <Switch
          checked={resolvedSettings.generateFromChats}
          disabled={settingsBusy || !resolvedSettings.memoryEnabled}
          onCheckedChange={next =>
            applySettings(
              { generateFromChats: next },
              next
                ? "You can now generate memory ideas from your chats."
                : "Generation from chats is off."
            )
          }
          aria-label="Toggle memory generation from chats"
        />
      </div>

      <div className="flex w-full items-center justify-between gap-3 rounded-xl border border-border p-3.5">
        <div className="min-w-0">
          <p className="text-sm font-medium">Generate memory ideas</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {resolvedSettings.generateFromChats
              ? "Choose the chats to look through, review the ideas, and save the ones you want."
              : "Turn on “Generate memory from chats” above to create ideas from your conversations."}
          </p>
        </div>
        <button
          type="button"
          disabled={
            !resolvedSettings.memoryEnabled ||
            !resolvedSettings.generateFromChats
          }
          onClick={() => setGenerateOpen(true)}
          className="shrink-0 rounded-lg bg-foreground px-3 py-1.5 text-[11px] font-semibold text-background transition-opacity hover:opacity-90 disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          Generate
        </button>
      </div>

      <div className="flex w-full items-center justify-between gap-3 rounded-xl border border-border p-3.5">
        <div className="min-w-0">
          <p className="text-sm font-medium">Sensitive topics</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {resolvedSettings.sensitiveMemoryEnabled
              ? "On — you can review and save sensitive information, always with your confirmation"
              : "Off — health, religion, politics, financial details, and relationships are never saved"}
          </p>
        </div>
        <Switch
          checked={resolvedSettings.sensitiveMemoryEnabled}
          disabled={settingsBusy}
          onCheckedChange={toggleSensitive}
          aria-label="Toggle sensitive topics"
        />
      </div>

      {resolvedSettings.sensitiveMemoryEnabled ? (
        <div className="space-y-1.5">
          {sensitiveCategories.map(category => (
            <div
              key={category.id}
              className="flex items-start gap-2 rounded-lg border border-border p-2.5 text-xs"
            >
              <ShieldAlert className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
              <p className="text-muted-foreground">
                <span className="font-medium text-foreground">
                  {category.label}
                </span>{" "}
                — {category.description}
              </p>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-[11px] text-muted-foreground">
          Sensitive categories:{" "}
          {sensitiveCategories.map(category => category.label).join(", ")}.
          Each is only ever saved after you review and confirm it.
        </p>
      )}

      <div className="flex w-full items-center justify-between gap-3 rounded-xl border border-border p-3.5">
        <div className="min-w-0">
          <p className="text-sm font-medium">Manage memories</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {memoryCount === 0
              ? "No memories saved yet"
              : `${memoryCount} saved ${memoryCount === 1 ? "memory" : "memories"}`}
          </p>
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={() => setManagerOpen(true)}
        >
          Manage
        </Button>
      </div>

      <MemoryManagerDialog open={managerOpen} onOpenChange={setManagerOpen} />
      <MemoryGenerateDialog
        open={generateOpen}
        onOpenChange={setGenerateOpen}
      />

      <Dialog
        open={sensitiveConfirmOpen}
        onOpenChange={setSensitiveConfirmOpen}
      >
        <DialogContent className="w-[calc(100%-1.5rem)] max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle>Enable sensitive topics?</DialogTitle>
            <DialogDescription>
              Turning this on lets you review and save sensitive information
              like health, religion, politics, financial details, and
              relationships. Sensitive memories are only ever saved after you
              explicitly confirm each one — nothing is captured silently.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2">
            <Button
              variant="ghost"
              onClick={() => setSensitiveConfirmOpen(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={() => {
                setSensitiveConfirmOpen(false);
                applySettings(
                  { sensitiveMemoryEnabled: pendingSensitiveValue },
                  "Sensitive topics are on."
                );
              }}
            >
              Enable
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}