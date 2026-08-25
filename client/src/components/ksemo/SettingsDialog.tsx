import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useTheme, type ThemeMode } from "@/contexts/ThemeContext";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import {
  Archive,
  Bug,
  ExternalLink,
  Lightbulb,
  LogOut,
  MessageSquare,
  Monitor,
  Moon,
  Palette,
  Settings2,
  Star,
  Sun,
  Trash2,
  User,
  Zap,
} from "lucide-react";
import React, { useEffect, useState } from "react";

type Preferences =
  | {
      persona?: "balanced" | "concise" | "creative" | "analytical";
      customInstructions?: string | null;
      speechRate?: number;
      autoPlayResponses?: boolean;
      reduceMotion?: boolean;
    }
  | null
  | undefined;
type User = { name?: string | null; email?: string | null };

type SettingsTab = "account" | "appearance" | "data" | "feedback";

export const settingsSections: Array<{
  id: string;
  label: string;
  icon: typeof MessageSquare;
  keywords: string;
}> = [
  {
    id: "general",
    label: "General",
    icon: Settings2,
    keywords: "theme style voice preferences",
  },
];

const settingsNavItems: Array<{
  id: SettingsTab;
  label: string;
  icon: typeof MessageSquare;
}> = [
  { id: "account", label: "Account", icon: User },
  { id: "appearance", label: "Appearance", icon: Palette },
  { id: "data", label: "Data Control", icon: Trash2 },
  { id: "feedback", label: "Feedback", icon: MessageSquare },
];

export function SettingsDialog({
  open,
  onOpenChange,
  user,
  onSignOut,
  onOpenWorkspace,
  onAllChatsDeleted,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: User;
  onSignOut: () => void;
  onOpenWorkspace: (section: "files") => void;
  onAllChatsDeleted: () => void;
}) {
  const [activeTab, setActiveTab] = useState<SettingsTab>("account");
  const [trashOpen, setTrashOpen] = useState(false);
  const [archivedOpen, setArchivedOpen] = useState(false);
  const [confirmDeleteAll, setConfirmDeleteAll] = useState(false);

  useEffect(() => {
    if (open) setActiveTab("account");
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[min(65dvh,520px)] w-[min(60vw,720px)] max-sm:h-[min(80dvh,520px)] max-sm:w-[calc(100%-2rem)] flex-col gap-0 overflow-hidden rounded-2xl p-0">
        <DialogHeader className="sr-only">
          <DialogTitle>Settings</DialogTitle>
          <DialogDescription>
            Manage your KSEMO preferences and account.
          </DialogDescription>
        </DialogHeader>

        <div className="flex min-h-0 flex-1">
          <aside className="flex w-52 shrink-0 flex-col border-r border-border bg-[oklch(0.975_0.002_80)] px-3 py-3 dark:bg-[oklch(0.17_0.003_80)]">
            <div className="mb-3 flex items-center gap-2 px-2 pb-2">
              <Settings2 className="size-4 text-muted-foreground" />
              <span className="text-sm font-semibold tracking-[-0.02em]">
                Settings
              </span>
            </div>
            <nav className="space-y-0.5">
              {settingsNavItems.map(item => {
                const Icon = item.icon;
                const active = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => setActiveTab(item.id)}
                    className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm transition-colors ${
                      active
                        ? "bg-muted font-medium text-foreground"
                        : "text-muted-foreground hover:bg-muted/70 hover:text-foreground"
                    }`}
                  >
                    <Icon className="size-4 shrink-0" />
                    {item.label}
                  </button>
                );
              })}
            </nav>
            <div className="mt-auto border-t border-border pt-3">
              <button
                onClick={() => {
                  onOpenChange(false);
                  onSignOut();
                }}
                className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm text-destructive transition-colors hover:bg-destructive/10"
              >
                <LogOut className="size-4 shrink-0" />
                Sign out
              </button>
            </div>
          </aside>

          <div className="flex min-h-0 flex-1 flex-col">
            <div className="min-h-0 flex-1 overflow-y-auto p-5">
              {activeTab === "account" && <AccountSection user={user} />}
              {activeTab === "appearance" && <AppearanceSection />}
              {activeTab === "data" && (
                <DataSection
                  onOpenWorkspace={onOpenWorkspace}
                  onOpenTrash={() => setTrashOpen(true)}
                  onOpenArchived={() => setArchivedOpen(true)}
                  onDeleteAll={() => setConfirmDeleteAll(true)}
                />
              )}
              {activeTab === "feedback" && <FeedbackSection />}
            </div>
          </div>
        </div>
      </DialogContent>

      <TrashedChatsDialog open={trashOpen} onOpenChange={setTrashOpen} />
      <ArchivedChatsDialog open={archivedOpen} onOpenChange={setArchivedOpen} />
      <AlertDialog open={confirmDeleteAll} onOpenChange={setConfirmDeleteAll}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete all chats?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes every conversation, including archived
              ones. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <DeleteAllConfirm
            onDone={() => {
              setConfirmDeleteAll(false);
              onOpenChange(false);
              onAllChatsDeleted();
            }}
            onCancel={() => setConfirmDeleteAll(false)}
          />
        </AlertDialogContent>
      </AlertDialog>
    </Dialog>
  );
}

function AccountSection({ user }: { user: User }) {
  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-base font-semibold tracking-[-0.02em]">Account</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Your account details and information.
        </p>
      </div>
      <div className="flex items-center gap-3.5 rounded-xl border border-border p-4">
        <div className="flex size-11 items-center justify-center rounded-xl bg-muted text-sm font-bold">
          {user.name?.trim().charAt(0).toUpperCase() || "U"}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">
            {user.name || "KSEMO user"}
          </p>
          <p className="mt-0.5 truncate text-xs text-muted-foreground">
            {user.email || "Signed in"}
          </p>
        </div>
      </div>
    </div>
  );
}

const themeOptions: Array<{ value: ThemeMode; label: string; icon: typeof Sun }> = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "system", label: "System", icon: Monitor },
];

function AppearanceSection() {
  const { mode, setMode } = useTheme();

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-base font-semibold tracking-[-0.02em]">Appearance</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Choose how KSEMO looks on your device.
        </p>
      </div>
      <div className="space-y-3">
        {themeOptions.map(opt => {
          const Icon = opt.icon;
          const active = mode === opt.value;
          return (
            <button
              key={opt.value}
              onClick={() => setMode(opt.value)}
              className={`flex w-full items-center gap-3 rounded-xl border p-3.5 text-left transition-colors ${
                active
                  ? "border-primary bg-primary/5"
                  : "border-border hover:bg-muted/50"
              }`}
            >
              <span
                className={`flex size-9 items-center justify-center rounded-lg transition-colors ${
                  active
                    ? "bg-primary/10 text-primary"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                <Icon className="size-4" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">{opt.label}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {opt.value === "light" && "Use the light theme"}
                  {opt.value === "dark" && "Use the dark theme"}
                  {opt.value === "system" && "Match your system setting"}
                </p>
              </div>
              {active && (
                <span className="flex size-5 items-center justify-center rounded-full bg-primary text-white">
                  <svg className="size-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                    <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function DataSection({
  onOpenWorkspace,
  onOpenTrash,
  onOpenArchived,
  onDeleteAll,
}: {
  onOpenWorkspace: (section: "files") => void;
  onOpenTrash: () => void;
  onOpenArchived: () => void;
  onDeleteAll: () => void;
}) {
  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-base font-semibold tracking-[-0.02em]">Data Control</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Manage your conversations and uploaded files.
        </p>
      </div>
      <div className="space-y-2">
        <button
          onClick={onOpenTrash}
          className="flex w-full items-center justify-between rounded-xl border border-border p-3.5 text-left transition-colors hover:bg-muted/50"
        >
          <div>
            <p className="text-sm font-medium">Trashed chats</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Restore or permanently delete
            </p>
          </div>
          <Trash2 className="size-4 text-muted-foreground" />
        </button>
        <button
          onClick={onOpenArchived}
          className="flex w-full items-center justify-between rounded-xl border border-border p-3.5 text-left transition-colors hover:bg-muted/50"
        >
          <div>
            <p className="text-sm font-medium">Archived chats</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Hidden from sidebar, kept safe
            </p>
          </div>
          <Archive className="size-4 text-muted-foreground" />
        </button>
        <button
          onClick={() => onOpenWorkspace("files")}
          className="flex w-full items-center justify-between rounded-xl border border-border p-3.5 text-left transition-colors hover:bg-muted/50"
        >
          <div>
            <p className="text-sm font-medium">Library</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Manage uploaded files and images
            </p>
          </div>
          <ExternalLink className="size-4 text-muted-foreground" />
        </button>
      </div>
      <button
        onClick={onDeleteAll}
        className="flex w-full items-center justify-between rounded-xl border border-destructive/30 bg-destructive/5 p-3.5 text-left transition-colors hover:bg-destructive/10"
      >
        <div>
          <p className="text-sm font-medium text-destructive">Delete all chats</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Permanent, cannot be undone
          </p>
        </div>
        <Trash2 className="size-4 text-destructive" />
      </button>
    </div>
  );
}

const feedbackCategories = [
  { id: "bug", label: "Bug report", icon: Bug },
  { id: "feature", label: "Feature request", icon: Lightbulb },
  { id: "improvement", label: "Improvement", icon: Zap },
  { id: "general", label: "General feedback", icon: Star },
] as const;

function FeedbackSection() {
  const [category, setCategory] = useState<string>("");
  const [email, setEmail] = useState("");
  const [feedbackText, setFeedbackText] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = () => {
    if (!feedbackText.trim() || !category) return;
    toast.success("Thanks for your feedback!");
    setCategory("");
    setEmail("");
    setFeedbackText("");
    setSubmitted(true);
  };

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-base font-semibold tracking-[-0.02em]">Feedback</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Tell us what you think, report a problem, or suggest something new.
          Your feedback directly helps us improve KSEMO.
        </p>
      </div>
      {submitted ? (
        <div className="rounded-xl border border-border p-6 text-center">
          <p className="text-sm font-medium">Thank you for your feedback!</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Your input helps us build a better experience.
          </p>
          <Button
            size="sm"
            variant="ghost"
            className="mt-3"
            onClick={() => setSubmitted(false)}
          >
            Send another
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="space-y-2">
            <Label className="text-sm">Category</Label>
            <div className="grid grid-cols-2 gap-2">
              {feedbackCategories.map(cat => {
                const Icon = cat.icon;
                const active = category === cat.id;
                return (
                  <button
                    key={cat.id}
                    onClick={() => setCategory(cat.id)}
                    className={`flex items-center gap-2 rounded-xl border p-2.5 text-left text-sm transition-colors ${
                      active
                        ? "border-primary bg-primary/5 font-medium text-foreground"
                        : "border-border text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                    }`}
                  >
                    <Icon className="size-4 shrink-0" />
                    {cat.label}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="feedback-email" className="text-sm">
              Email <span className="text-muted-foreground">(optional)</span>
            </Label>
            <Input
              id="feedback-email"
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="h-9 rounded-lg text-sm"
              placeholder="We'll only use this to follow up"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="feedback-text" className="text-sm">
              Your feedback
            </Label>
            <Textarea
              id="feedback-text"
              value={feedbackText}
              onChange={e => setFeedbackText(e.target.value)}
              maxLength={2000}
              className="min-h-24 max-h-40 resize-none overflow-y-auto rounded-xl border border-border text-sm"
              placeholder={
                category === "bug"
                  ? "Describe the issue: what happened, what you expected, and steps to reproduce…"
                  : category === "feature"
                    ? "Describe the feature you'd like to see and why it would be useful…"
                    : category === "improvement"
                      ? "What could be better and how would you improve it…"
                      : "Share your thoughts, ideas, or anything else…"
              }
            />
            <p className="text-right text-[11px] text-muted-foreground">
              {feedbackText.length}/2000
            </p>
          </div>
          <div className="flex justify-end">
            <Button
              size="sm"
              onClick={handleSubmit}
              disabled={!feedbackText.trim() || !category}
              className="rounded-lg bg-foreground text-background hover:bg-foreground/90"
            >
              Send feedback
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function DeleteAllConfirm({
  onDone,
  onCancel,
}: {
  onDone: () => void;
  onCancel: () => void;
}) {
  const [confirmText, setConfirmText] = useState("");
  const utils = trpc.useUtils();
  const removeAllMutation = trpc.conversation.removeAll.useMutation({
    onSuccess: result => {
      utils.conversation.list.invalidate();
      toast.success(
        result.removed === 1
          ? "1 chat deleted"
          : `${result.removed} chats deleted`
      );
      onDone();
    },
    onError: () => toast.error("Could not delete all chats."),
  });

  const matches = confirmText.trim() === "DELETE";

  return (
    <>
      <div className="px-6 pb-4">
        <p className="text-sm text-muted-foreground">
          Type <span className="font-mono font-medium text-foreground">DELETE</span> to confirm:
        </p>
        <Input
          autoFocus
          value={confirmText}
          onChange={e => setConfirmText(e.target.value)}
          className="mt-2 h-9 rounded-lg font-mono text-sm"
          placeholder="DELETE"
          onKeyDown={e => {
            if (e.key === "Enter" && matches) {
              e.preventDefault();
              removeAllMutation.mutate();
            }
          }}
        />
      </div>
      <AlertDialogFooter>
        <AlertDialogCancel onClick={onCancel}>Cancel</AlertDialogCancel>
        <Button
          className="bg-destructive text-white hover:bg-destructive/90"
          disabled={!matches || removeAllMutation.isPending}
          onClick={() => {
            if (matches) removeAllMutation.mutate();
          }}
        >
          {removeAllMutation.isPending ? "Deleting…" : "Delete everything"}
        </Button>
      </AlertDialogFooter>
    </>
  );
}

function TrashedChatsDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const trashQuery = trpc.conversation.list.useQuery(
    { scope: "trash" },
    { enabled: open }
  );
  const utils = trpc.useUtils();
  const restoreMutation = trpc.conversation.restore.useMutation({
    onSuccess: () => {
      utils.conversation.list.invalidate();
      toast.success("Chat restored");
    },
    onError: () => toast.error("Could not restore chat."),
  });
  const deleteMutation = trpc.conversation.remove.useMutation({
    onSuccess: () => {
      utils.conversation.list.invalidate();
      toast.success("Chat deleted");
    },
    onError: () => toast.error("Could not delete chat."),
  });
  const conversations = (trashQuery.data ?? []) as Array<{
    id: string;
    title: string;
    updatedAt?: Date | string | null;
  }>;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[32rem] w-[calc(100%-1.5rem)] max-w-lg flex-col gap-0 overflow-hidden rounded-2xl p-0">
        <div className="shrink-0 border-b border-border px-4 pb-3 pt-4">
          <p className="text-base font-semibold">Trashed chats</p>
          <p className="text-xs text-muted-foreground">
            Restore or delete permanently.
          </p>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-3">
          {trashQuery.isLoading ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Loading…
            </p>
          ) : !conversations.length ? (
            <div className="py-8 text-center">
              <Trash2 className="mx-auto size-6 text-muted-foreground" />
              <p className="mt-3 text-sm font-medium">Trash is empty</p>
            </div>
          ) : (
            <ul className="space-y-1.5">
              {conversations.map(c => (
                <li
                  key={c.id}
                  className="flex items-center gap-2 rounded-xl border border-border px-3 py-2"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-medium">{c.title}</p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-7 shrink-0 rounded-lg"
                    disabled={restoreMutation.isPending}
                    onClick={() => restoreMutation.mutate({ id: c.id })}
                  >
                    <span className="text-xs">Restore</span>
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-7 shrink-0 rounded-lg text-destructive"
                    disabled={deleteMutation.isPending}
                    onClick={() => deleteMutation.mutate({ id: c.id })}
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ArchivedChatsDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const archivedQuery = trpc.conversation.list.useQuery(
    { scope: "archived" },
    { enabled: open }
  );
  const utils = trpc.useUtils();
  const restoreMutation = trpc.conversation.setArchived.useMutation({
    onSuccess: () => {
      utils.conversation.list.invalidate();
      toast.success("Chat restored");
    },
    onError: () => toast.error("Could not restore chat."),
  });
  const deleteMutation = trpc.conversation.remove.useMutation({
    onSuccess: () => {
      utils.conversation.list.invalidate();
      toast.success("Chat deleted");
    },
    onError: () => toast.error("Could not delete chat."),
  });
  const conversations = (archivedQuery.data ?? []) as Array<{
    id: string;
    title: string;
    updatedAt?: Date | string | null;
  }>;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[32rem] w-[calc(100%-1.5rem)] max-w-lg flex-col gap-0 overflow-hidden rounded-2xl p-0">
        <div className="shrink-0 border-b border-border px-4 pb-3 pt-4">
          <p className="text-base font-semibold">Archived chats</p>
          <p className="text-xs text-muted-foreground">
            Restore or delete permanently.
          </p>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-3">
          {archivedQuery.isLoading ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Loading…
            </p>
          ) : !conversations.length ? (
            <div className="py-8 text-center">
              <Archive className="mx-auto size-6 text-muted-foreground" />
              <p className="mt-3 text-sm font-medium">Nothing archived</p>
            </div>
          ) : (
            <ul className="space-y-1.5">
              {conversations.map(c => (
                <li
                  key={c.id}
                  className="flex items-center gap-2 rounded-xl border border-border px-3 py-2"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-medium">{c.title}</p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-7 shrink-0 rounded-lg"
                    disabled={restoreMutation.isPending}
                    onClick={() =>
                      restoreMutation.mutate({
                        id: c.id,
                        isArchived: false,
                      })
                    }
                  >
                    <span className="text-xs">Restore</span>
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-7 shrink-0 rounded-lg text-destructive"
                    disabled={deleteMutation.isPending}
                    onClick={() => deleteMutation.mutate({ id: c.id })}
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
