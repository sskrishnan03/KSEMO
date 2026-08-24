import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import {
  Archive,
  Bug,
  CheckCircle2,
  Database,
  HelpCircle,
  Lightbulb,
  MessageSquare,
  RotateCcw,
  Send,
  Settings2,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Trash2,
  UserRound,
} from "lucide-react";
import React, { useEffect, useMemo, useState } from "react";

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
type Section = "account" | "security" | "preferences" | "data" | "feedback";
type User = { name?: string | null; email?: string | null };

export const settingsSections: Array<{
  id: Section;
  label: string;
  icon: typeof UserRound;
  keywords: string;
}> = [
  {
    id: "account",
    label: "Account",
    icon: UserRound,
    keywords: "profile name email account",
  },
  {
    id: "security",
    label: "Security",
    icon: ShieldCheck,
    keywords: "security sign in sharing google",
  },
  {
    id: "preferences",
    label: "Preferences",
    icon: SlidersHorizontal,
    keywords: "voice style accessibility instructions",
  },
  {
    id: "data",
    label: "Data controls",
    icon: Database,
    keywords: "data library memory conversations privacy",
  },
  {
    id: "feedback",
    label: "Feedback",
    icon: MessageSquare,
    keywords: "feedback support bug idea question praise report contact",
  },
];

export function SettingsAccessibilityPanel({
  reduceMotion,
  onReduceMotionChange,
  online,
  onReload,
}: {
  reduceMotion: boolean;
  onReduceMotionChange: (value: boolean) => void;
  online: boolean;
  onReload: () => void;
}) {
  return (
    <>
      <div className="flex items-center justify-between rounded-xl border border-border p-3.5">
        <div>
          <Label htmlFor="reduce-motion" className="text-sm">
            Reduce motion
          </Label>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            Minimize nonessential visual movement throughout KSEMO.
          </p>
        </div>
        <Switch
          id="reduce-motion"
          checked={reduceMotion}
          onCheckedChange={onReduceMotionChange}
        />
      </div>
      <section
        className="rounded-xl border border-border p-3.5"
        aria-labelledby="shortcuts-title"
      >
        <h3 id="shortcuts-title" className="text-sm font-medium">
          Keyboard shortcuts
        </h3>
        <div className="mt-3 grid grid-cols-[1fr_auto] gap-x-4 gap-y-2 text-xs">
          <span className="text-muted-foreground">Search conversations</span>
          <kbd className="rounded border border-border bg-muted px-1.5 py-0.5 font-sans text-[10px]">
            ⌘/Ctrl K
          </kbd>
          <span className="text-muted-foreground">New conversation</span>
          <kbd className="rounded border border-border bg-muted px-1.5 py-0.5 font-sans text-[10px]">
            ⌘/Ctrl Shift O
          </kbd>
          <span className="text-muted-foreground">Stop or close</span>
          <kbd className="rounded border border-border bg-muted px-1.5 py-0.5 font-sans text-[10px]">
            Esc
          </kbd>
          <span className="text-muted-foreground">Send / new line</span>
          <kbd className="rounded border border-border bg-muted px-1.5 py-0.5 font-sans text-[10px]">
            Enter / Shift Enter
          </kbd>
        </div>
      </section>
      <section
        className="rounded-xl border border-border bg-muted/30 p-3.5"
        aria-labelledby="recovery-title"
      >
        <h3 id="recovery-title" className="text-sm font-medium">
          Connection and recovery
        </h3>
        <p className="mt-1 text-xs leading-5 text-muted-foreground">
          KSEMO keeps saved conversations on the server. If a connection or
          response fails, stop the current response, then reload to reconnect
          without losing completed messages.
        </p>
        <div className="mt-3 flex items-center justify-between gap-3">
          <span className="text-xs text-muted-foreground">
            Browser status: {online ? "Online" : "Offline"}
          </span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="rounded-lg"
            onClick={onReload}
          >
            Reload KSEMO
          </Button>
        </div>
      </section>
    </>
  );
}

export function SettingsDialog({
  open,
  onOpenChange,
  preferences,
  onSave,
  saving,
  user,
  onSignOut,
  onOpenWorkspace,
  onOpenSupport,
  onAllChatsDeleted,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  preferences: Preferences;
  onSave: (value: NonNullable<Preferences>) => void;
  saving: boolean;
  user: User;
  onSignOut: () => void;
  onOpenWorkspace: (section: "files" | "memories") => void;
  onOpenSupport: (topic: "privacy" | "terms" | "faq") => void;
  onAllChatsDeleted: () => void;
}) {
      const [draft, setDraft] = useState<NonNullable<Preferences>>({
        persona: "balanced",
        customInstructions: "",
        speechRate: 100,
        autoPlayResponses: false,
        reduceMotion: false,
      });
  const [activeSection, setActiveSection] = useState<Section>("account");
  const [search, setSearch] = useState("");
  useEffect(() => {
    if (open) {
      setDraft({
        persona: preferences?.persona ?? "balanced",
        customInstructions: preferences?.customInstructions ?? "",
        speechRate: preferences?.speechRate ?? 100,
        autoPlayResponses: preferences?.autoPlayResponses ?? false,
          reduceMotion: preferences?.reduceMotion ?? false,
        });
      setActiveSection("account");
      setSearch("");
    }
  }, [open, preferences]);
  const visibleSections = useMemo(
    () =>
      settingsSections.filter(section =>
        `${section.label} ${section.keywords}`
          .toLowerCase()
          .includes(search.toLowerCase().trim())
      ),
    [search]
  );
  const openWorkspace = (section: "files" | "memories") => {
    onOpenChange(false);
    onOpenWorkspace(section);
  };
  const openSupport = (topic: "privacy" | "terms" | "faq") => {
    onOpenChange(false);
    onOpenSupport(topic);
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[min(42rem,88dvh)] w-[calc(100%-1.5rem)] max-w-5xl flex-col gap-0 overflow-hidden rounded-2xl p-0 sm:!max-w-5xl">
        <DialogHeader className="shrink-0 border-b border-border px-4 pb-3 pt-3.5 sm:px-5">
          <div className="flex items-center gap-2">
            <Settings2 className="size-4 text-muted-foreground" />
            <DialogTitle className="text-lg font-semibold tracking-[-0.02em]">
              Settings
            </DialogTitle>
          </div>
          <DialogDescription>
            Manage your KSEMO account experience, saved preferences, and data
            controls.
          </DialogDescription>
          <Input
            value={search}
            onChange={event => setSearch(event.target.value)}
            placeholder="Search settings…"
            className="mt-2 h-9 max-w-xs rounded-lg text-sm"
            aria-label="Search settings"
          />
        </DialogHeader>
        <div className="min-h-0 flex-1 overflow-y-auto sm:grid sm:grid-cols-[12rem_minmax(0,1fr)] sm:overflow-hidden">
          <nav className="flex gap-1 overflow-x-auto border-b border-border p-2 sm:block sm:space-y-0.5 sm:overflow-y-auto sm:border-b-0 sm:border-r sm:p-3">
            {visibleSections.map(section => {
              const Icon = section.icon;
              return (
                <button
                  key={section.id}
                  onClick={() => setActiveSection(section.id)}
                  className={cn(
                    "flex shrink-0 items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-[13px] transition-colors sm:w-full",
                    activeSection === section.id
                      ? "bg-muted font-medium text-foreground"
                      : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                  )}
                >
                  <Icon className="size-3.5" />
                  {section.label}
                </button>
              );
            })}
            {!visibleSections.length && (
              <p className="p-2 text-xs text-muted-foreground">
                No settings match that search.
              </p>
            )}
          </nav>
          <section className="min-w-0 p-4 sm:overflow-y-auto sm:p-5">
            {activeSection === "account" && <AccountPanel user={user} />}
            {activeSection === "security" && (
              <SecurityPanel onSignOut={onSignOut} />
            )}
            {activeSection === "preferences" && (
              <PreferencesPanel draft={draft} setDraft={setDraft} />
            )}
            {activeSection === "data" && (
              <DataControlsPanel
                onOpenWorkspace={openWorkspace}
                onOpenSupport={openSupport}
                onAllChatsDeleted={() => {
                  onOpenChange(false);
                  onAllChatsDeleted();
                }}
              />
            )}
            {activeSection === "feedback" && <FeedbackPanel user={user} />}
          </section>
        </div>
        {activeSection === "preferences" && (
          <div className="shrink-0 flex justify-end gap-2 border-t border-border px-4 py-2.5 sm:px-5">
            <Button size="sm" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={() => onSave(draft)}
              disabled={saving}
              className="rounded-lg bg-foreground text-background hover:bg-foreground/90"
            >
              {saving ? "Saving…" : "Save preferences"}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function SectionHeading({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="mb-4">
      <h2 className="text-lg font-semibold tracking-[-0.025em]">{title}</h2>
      <p className="mt-1 max-w-xl text-sm leading-6 text-muted-foreground">
        {description}
      </p>
    </div>
  );
}
function AccountPanel({ user }: { user: User }) {
  return (
    <>
      <SectionHeading
        title="Account"
        description="Profile details are securely managed through your Google account."
      />
      <div className="space-y-5 rounded-2xl border border-border p-5">
        <div className="flex size-10 items-center justify-center rounded-xl bg-muted text-sm font-semibold">
          {user.name?.trim().charAt(0).toUpperCase() || "U"}
        </div>
        <div className="space-y-2.5">
          <Label>Email</Label>
          <Input
            value={user.email || "Not available"}
            readOnly
            className="h-10 rounded-xl bg-muted/40"
          />
        </div>
        <div className="space-y-2.5">
          <Label>Display name</Label>
          <Input
            value={user.name || "KSEMO user"}
            readOnly
            className="h-10 rounded-xl bg-muted/40"
          />
        </div>
        <p className="pt-1 text-xs leading-5 text-muted-foreground">
          To update account identity details, use your Google account controls.
        </p>
      </div>
    </>
  );
}
function SecurityPanel({ onSignOut }: { onSignOut: () => void }) {
  return (
    <>
      <SectionHeading
        title="Security"
        description="KSEMO uses Google authentication to protect your signed-in session and account."
      />
      <div className="space-y-4">
        <article className="rounded-2xl border border-border p-5">
          <h3 className="text-sm font-medium">Secure account access</h3>
          <p className="mt-1.5 text-xs leading-5 text-muted-foreground">
            Your KSEMO session uses the secure Google account flow. Do not share
            a device session with people you do not trust.
          </p>
        </article>
        <article className="rounded-2xl border border-border p-5">
          <h3 className="text-sm font-medium">Your Google account</h3>
          <p className="mt-1.5 text-xs leading-5 text-muted-foreground">
            Sign-in, password, and two-step verification are managed by
            Google. Strengthening your Google account strengthens KSEMO too.
          </p>
          <Button asChild variant="outline" size="sm" className="mt-3 rounded-lg">
            <a
              href="https://myaccount.google.com/security"
              target="_blank"
              rel="noreferrer noopener"
            >
              Manage Google security
            </a>
          </Button>
        </article>
        <article className="rounded-2xl border border-border p-5">
          <h3 className="text-sm font-medium">Conversation sharing</h3>
          <p className="mt-1.5 text-xs leading-5 text-muted-foreground">
            Sharing is opt-in. Review every public share link and disable it
            when it is no longer needed.
          </p>
        </article>
        <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-5">
          <h3 className="text-sm font-medium">Sign out of KSEMO</h3>
          <p className="mt-1.5 text-xs leading-5 text-muted-foreground">
            End this browser session and return to the secure KSEMO access
            screen.
          </p>
          <Button
            variant="outline"
            className="mt-4 border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive"
            onClick={onSignOut}
          >
            Sign out
          </Button>
        </div>
      </div>
    </>
  );
}
function PreferencesPanel({
  draft,
  setDraft,
}: {
  draft: NonNullable<Preferences>;
  setDraft: React.Dispatch<React.SetStateAction<NonNullable<Preferences>>>;
}) {
  return (
    <>
      <SectionHeading
        title="Preferences"
        description="Choose how KSEMO responds, speaks, and behaves in your workspace."
      />
      <div className="space-y-5">
        <div className="space-y-2">
          <Label htmlFor="persona">Response style</Label>
          <Select
            value={draft.persona}
            onValueChange={persona =>
              setDraft(current => ({
                ...current,
                persona: persona as NonNullable<Preferences>["persona"],
              }))
            }
          >
            <SelectTrigger id="persona" className="h-10 rounded-xl">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="balanced">Balanced</SelectItem>
              <SelectItem value="concise">Concise</SelectItem>
              <SelectItem value="creative">Creative</SelectItem>
              <SelectItem value="analytical">Analytical</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="instructions">Custom instructions</Label>
          <Textarea
            id="instructions"
            value={draft.customInstructions ?? ""}
            onChange={event =>
              setDraft(current => ({
                ...current,
                customInstructions: event.target.value,
              }))
            }
            maxLength={2000}
            className="min-h-28 resize-none rounded-xl"
            placeholder="For example: Prioritize practical examples and explain technical terms simply."
          />
          <p className="text-right text-[11px] text-muted-foreground">
            {draft.customInstructions?.length ?? 0}/2000
          </p>
        </div>
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label htmlFor="rate">Speech rate</Label>
            <span className="text-xs tabular-nums text-muted-foreground">
              {(draft.speechRate ?? 100) / 100}×
            </span>
          </div>
          <Slider
            id="rate"
            min={60}
            max={180}
            step={10}
            value={[draft.speechRate ?? 100]}
            onValueChange={([speechRate]) =>
              setDraft(current => ({ ...current, speechRate }))
            }
          />
        </div>
        <div className="flex items-center justify-between rounded-xl border border-border p-3.5">
          <div>
            <Label htmlFor="autoplay" className="text-sm">
              Auto-play responses
            </Label>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              Read KSEMO responses aloud after they finish.
            </p>
          </div>
            <Switch
              id="autoplay"
              checked={draft.autoPlayResponses}
              onCheckedChange={autoPlayResponses =>
                setDraft(current => ({ ...current, autoPlayResponses }))
              }
            />
          </div>
        <SettingsAccessibilityPanel
          reduceMotion={Boolean(draft.reduceMotion)}
          onReduceMotionChange={reduceMotion =>
            setDraft(current => ({ ...current, reduceMotion }))
          }
          online={typeof navigator !== "undefined" && navigator.onLine}
          onReload={() => window.location.reload()}
        />
      </div>
    </>
  );
}
function useWorkspaceStats() {
  const active = trpc.conversation.list.useQuery({ scope: "active" });
  const archived = trpc.conversation.list.useQuery({ scope: "archived" });
  const trash = trpc.conversation.list.useQuery({ scope: "trash" });
  const files = trpc.workspace.files.list.useQuery();
  const memories = trpc.workspace.memories.list.useQuery();
  return [
    { label: "Chats", value: active.data?.length },
    { label: "Archived", value: archived.data?.length },
    { label: "In trash", value: trash.data?.length },
    { label: "Library files", value: files.data?.length },
    { label: "Memories", value: memories.data?.length },
  ];
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
      toast.success("Chat restored to your sidebar");
    },
    onError: () => toast.error("KSEMO could not restore that chat."),
  });
  const deleteMutation = trpc.conversation.remove.useMutation({
    onSuccess: () => {
      utils.conversation.list.invalidate();
      toast.success("Chat permanently deleted");
    },
    onError: () => toast.error("KSEMO could not delete that chat."),
  });
  const conversations = (trashQuery.data ?? []) as Array<{
    id: string;
    title: string;
    updatedAt?: Date | string | null;
  }>;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[32rem] w-[calc(100%-1.5rem)] max-w-lg flex-col gap-0 overflow-hidden rounded-2xl p-0 sm:!max-w-lg">
        <DialogHeader className="shrink-0 border-b border-border px-4 pb-3 pt-4">
          <DialogTitle className="text-base font-semibold tracking-[-0.02em]">
            Trashed chats
          </DialogTitle>
          <DialogDescription>
            Restore chats back to your sidebar, or delete them forever.
          </DialogDescription>
        </DialogHeader>
        <div className="min-h-0 flex-1 overflow-y-auto p-3">
          {trashQuery.isLoading ? (
            <p className="px-1 py-6 text-center text-sm text-muted-foreground">
              Loading trashed chats…
            </p>
          ) : !conversations.length ? (
            <div className="px-1 py-8 text-center">
              <Trash2 className="mx-auto size-6 text-muted-foreground" />
              <p className="mt-3 text-sm font-medium">Trash is empty</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Chats you move to trash will appear here until you remove them.
              </p>
            </div>
          ) : (
            <ul className="space-y-1.5">
              {conversations.map(conversation => (
                <li
                  key={conversation.id}
                  className="flex items-center gap-2 rounded-xl border border-border px-3 py-2"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-medium">
                      {conversation.title}
                    </p>
                    {conversation.updatedAt && (
                      <p className="text-[11px] text-muted-foreground">
                        Updated{" "}
                        {new Date(conversation.updatedAt).toLocaleDateString()}
                      </p>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-7 shrink-0 rounded-lg"
                    disabled={restoreMutation.isPending}
                    aria-label={`Restore ${conversation.title}`}
                    onClick={() =>
                      restoreMutation.mutate({ id: conversation.id })
                    }
                  >
                    <RotateCcw className="size-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-7 shrink-0 rounded-lg text-destructive hover:bg-destructive/10 hover:text-destructive"
                    disabled={deleteMutation.isPending}
                    aria-label={`Delete ${conversation.title}`}
                    onClick={() => {
                      if (
                        window.confirm(
                          `Permanently delete “${conversation.title}”? This cannot be undone.`
                        )
                      ) {
                        deleteMutation.mutate({ id: conversation.id });
                      }
                    }}
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

function DataControlsPanel({
  onOpenWorkspace,
  onOpenSupport,
  onAllChatsDeleted,
}: {
  onOpenWorkspace: (section: "files" | "memories") => void;
  onOpenSupport: (topic: "privacy" | "terms" | "faq") => void;
  onAllChatsDeleted: () => void;
}) {
  const [archivedOpen, setArchivedOpen] = useState(false);
  const [trashOpen, setTrashOpen] = useState(false);
  const [confirmDeleteAll, setConfirmDeleteAll] = useState(false);
  const utils = trpc.useUtils();
  const stats = useWorkspaceStats();
  const removeAllMutation = trpc.conversation.removeAll.useMutation({
    onSuccess: result => {
      utils.conversation.list.invalidate();
      toast.success(
        result.removed === 1
          ? "1 chat permanently deleted"
          : `${result.removed} chats permanently deleted`
      );
      setConfirmDeleteAll(false);
      onAllChatsDeleted();
    },
    onError: () => {
      toast.error("KSEMO could not delete all chats.");
      setConfirmDeleteAll(false);
    },
  });

  return (
    <>
      <SectionHeading
        title="Data controls"
        description="Review and manage the content you keep in KSEMO. You control what is saved, attached, shared, and remembered."
      />
      <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-5" aria-label="Workspace data summary">
        {stats.map(stat => (
          <div
            key={stat.label}
            className="rounded-xl border border-border bg-muted/30 px-3 py-2.5"
          >
            <p className="text-lg font-semibold tabular-nums leading-6">
              {stat.value ?? "…"}
            </p>
            <p className="text-[11px] text-muted-foreground">{stat.label}</p>
          </div>
        ))}
      </div>
      <div className="space-y-3">
        <article className="rounded-2xl border border-border p-4">
          <h3 className="text-sm font-medium">Trashed chats</h3>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            Chats you moved to trash wait here. Restore them or remove them
            permanently.
          </p>
          <Button
            variant="outline"
            size="sm"
            className="mt-3 rounded-lg"
            onClick={() => setTrashOpen(true)}
          >
            <Trash2 className="size-3.5" />
            Manage trash
          </Button>
        </article>
        <article className="rounded-2xl border border-border p-4">
          <h3 className="text-sm font-medium">Archived chats</h3>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            Archived conversations are hidden from your sidebar but kept safe.
            Restore them or delete them permanently.
          </p>
          <Button
            variant="outline"
            size="sm"
            className="mt-3 rounded-lg"
            onClick={() => setArchivedOpen(true)}
          >
            <Archive className="size-3.5" />
            Manage archived
          </Button>
        </article>
        <article className="rounded-2xl border border-border p-4">
          <h3 className="text-sm font-medium">Private Library</h3>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            Manage uploaded files and images. Library items are only included
            with AI requests when you attach or select them.
          </p>
          <Button
            variant="outline"
            size="sm"
            className="mt-3 rounded-lg"
            onClick={() => onOpenWorkspace("files")}
          >
            Manage Library
          </Button>
        </article>
        <article className="rounded-2xl border border-border p-4">
          <h3 className="text-sm font-medium">Explicit memories</h3>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            KSEMO saves memories only when you add them. You can disable or
            remove each memory at any time.
          </p>
          <Button
            variant="outline"
            size="sm"
            className="mt-3 rounded-lg"
            onClick={() => onOpenWorkspace("memories")}
          >
            Manage memories
          </Button>
        </article>
        <article className="rounded-2xl border border-destructive/30 bg-destructive/5 p-4">
          <h3 className="text-sm font-medium">Delete all chats</h3>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            Permanently deletes every conversation — active, archived, and
            trashed. Messages, versions, and attachments references cannot be
            recovered.
          </p>
          <Button
            variant="outline"
            size="sm"
            className="mt-3 border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive"
            disabled={removeAllMutation.isPending}
            onClick={() => setConfirmDeleteAll(true)}
          >
            <Trash2 className="size-3.5" />
            {removeAllMutation.isPending ? "Deleting…" : "Delete all chats"}
          </Button>
        </article>
        <article className="rounded-2xl border border-border p-4">
          <h3 className="text-sm font-medium">Privacy and terms</h3>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            Read how KSEMO handles conversations, voice transcripts, files, and
            sharing.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              className="rounded-lg"
              onClick={() => onOpenSupport("faq")}
            >
              FAQ
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="rounded-lg"
              onClick={() => onOpenSupport("privacy")}
            >
              Privacy Policy
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="rounded-lg"
              onClick={() => onOpenSupport("terms")}
            >
              Terms of Service
            </Button>
          </div>
        </article>
      </div>

      <TrashedChatsDialog open={trashOpen} onOpenChange={setTrashOpen} />
      <ArchivedChatsDialog open={archivedOpen} onOpenChange={setArchivedOpen} />

      <AlertDialog open={confirmDeleteAll} onOpenChange={setConfirmDeleteAll}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete all chats?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes every conversation in your account,
              including archived ones. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-white hover:bg-destructive/90"
              disabled={removeAllMutation.isPending}
              onClick={event => {
                event.preventDefault();
                removeAllMutation.mutate();
              }}
            >
              {removeAllMutation.isPending ? "Deleting…" : "Delete everything"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
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
    onError: () => toast.error("KSEMO could not restore that chat."),
  });
  const deleteMutation = trpc.conversation.remove.useMutation({
    onSuccess: () => {
      utils.conversation.list.invalidate();
      toast.success("Chat permanently deleted");
    },
    onError: () => toast.error("KSEMO could not delete that chat."),
  });
  const conversations = (archivedQuery.data ?? []) as Array<{
    id: string;
    title: string;
    updatedAt?: Date | string | null;
  }>;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[32rem] w-[calc(100%-1.5rem)] max-w-lg flex-col gap-0 overflow-hidden rounded-2xl p-0 sm:!max-w-lg">
        <DialogHeader className="shrink-0 border-b border-border px-4 pb-3 pt-4">
          <DialogTitle className="text-base font-semibold tracking-[-0.02em]">
            Archived chats
          </DialogTitle>
          <DialogDescription>
            Restore chats back to your sidebar, or delete them forever.
          </DialogDescription>
        </DialogHeader>
        <div className="min-h-0 flex-1 overflow-y-auto p-3">
          {archivedQuery.isLoading ? (
            <p className="px-1 py-6 text-center text-sm text-muted-foreground">
              Loading archived chats…
            </p>
          ) : !conversations.length ? (
            <div className="px-1 py-8 text-center">
              <Archive className="mx-auto size-6 text-muted-foreground" />
              <p className="mt-3 text-sm font-medium">Nothing archived</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Chats you archive from the sidebar will appear here.
              </p>
            </div>
          ) : (
            <ul className="space-y-1.5">
              {conversations.map(conversation => (
                <li
                  key={conversation.id}
                  className="flex items-center gap-2 rounded-xl border border-border px-3 py-2"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-medium">
                      {conversation.title}
                    </p>
                    {conversation.updatedAt && (
                      <p className="text-[11px] text-muted-foreground">
                        Updated{" "}
                        {new Date(conversation.updatedAt).toLocaleDateString()}
                      </p>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-7 shrink-0 rounded-lg"
                    disabled={restoreMutation.isPending}
                    aria-label={`Restore ${conversation.title}`}
                    onClick={() =>
                      restoreMutation.mutate({
                        id: conversation.id,
                        isArchived: false,
                      })
                    }
                  >
                    <RotateCcw className="size-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-7 shrink-0 rounded-lg text-destructive hover:bg-destructive/10 hover:text-destructive"
                    disabled={deleteMutation.isPending}
                    aria-label={`Delete ${conversation.title}`}
                    onClick={() => {
                      if (
                        window.confirm(
                          `Permanently delete “${conversation.title}”? This cannot be undone.`
                        )
                      ) {
                        deleteMutation.mutate({ id: conversation.id });
                      }
                    }}
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
const FEEDBACK_CATEGORIES = [
  {
    id: "bug" as const,
    label: "Bug report",
    description: "Something broke or behaved oddly",
    icon: Bug,
  },
  {
    id: "idea" as const,
    label: "Feature idea",
    description: "What would make KSEMO more useful?",
    icon: Lightbulb,
  },
  {
    id: "question" as const,
    label: "Question",
    description: "Confused about a feature or setting",
    icon: HelpCircle,
  },
  {
    id: "praise" as const,
    label: "Praise",
    description: "Tell us what you love",
    icon: Sparkles,
  },
];

function FeedbackPanel({ user }: { user: User }) {
  const [category, setCategory] = useState<
    (typeof FEEDBACK_CATEGORIES)[number]["id"] | null
  >(null);
  const [message, setMessage] = useState("");
  const [sent, setSent] = useState(false);
  const sendMutation = trpc.feedback.send.useMutation({
    onSuccess: () => {
      toast.success("Thanks! Your feedback reached the KSEMO team.");
      setSent(true);
    },
    onError: error => {
      toast.error(
        error.message || "KSEMO could not send that feedback right now."
      );
    },
  });
  const trimmedLength = message.trim().length;
  const canSend =
    category !== null && trimmedLength >= 10 && !sendMutation.isPending;

  function submit() {
    if (!canSend || category === null) return;
    sendMutation.mutate({ category, message: message.trim() });
  }

  if (sent) {
    return (
      <>
        <SectionHeading
          title="Feedback"
          description="Tell us what worked, what did not, or what would make KSEMO more useful."
        />
        <div className="rounded-2xl border border-border bg-muted/30 p-8 text-center">
          <CheckCircle2 className="mx-auto size-7 text-foreground" />
          <h3 className="mt-4 text-base font-medium">Feedback sent</h3>
          <p className="mx-auto mt-1.5 max-w-sm text-sm leading-6 text-muted-foreground">
            Thank you for helping improve KSEMO. We read every note, and we
            may reply to {user.email || "your account email"} if we need more
            detail.
          </p>
          <Button
            variant="outline"
            size="sm"
            className="mt-5 rounded-lg"
            onClick={() => {
              setCategory(null);
              setMessage("");
              setSent(false);
            }}
          >
            Send more feedback
          </Button>
        </div>
      </>
    );
  }

  return (
    <>
      <SectionHeading
        title="Feedback"
        description="Report a problem, share an idea, or tell us what is working well — it all goes straight to the KSEMO team."
      />
      <div className="space-y-5">
        <fieldset className="space-y-2.5">
          <legend className="text-sm font-medium">What is this about?</legend>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {FEEDBACK_CATEGORIES.map(item => {
              const Icon = item.icon;
              const selected = category === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => setCategory(item.id)}
                  className={cn(
                    "flex items-start gap-3 rounded-xl border p-3 text-left transition-colors",
                    selected
                      ? "border-foreground/60 bg-muted"
                      : "border-border hover:border-muted-foreground/40 hover:bg-muted/40"
                  )}
                >
                  <Icon
                    className={cn(
                      "mt-0.5 size-4 shrink-0",
                      selected ? "text-foreground" : "text-muted-foreground"
                    )}
                  />
                  <span className="min-w-0">
                    <span className="block text-[13px] font-medium leading-5">
                      {item.label}
                    </span>
                    <span className="mt-0.5 block text-xs leading-5 text-muted-foreground">
                      {item.description}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        </fieldset>
        <div className="space-y-2">
          <Label htmlFor="feedback-message">Your message</Label>
          <Textarea
            id="feedback-message"
            value={message}
            onChange={event => setMessage(event.target.value)}
            maxLength={4000}
            className="min-h-32 resize-none rounded-xl"
            placeholder={
              category === "bug"
                ? "What happened, and what did you expect instead? Any steps to reproduce help a lot."
                : category === "idea"
                  ? "Describe the improvement you have in mind and the problem it would solve."
                  : category === "question"
                    ? "Ask away — include which feature or setting the question is about."
                    : "We would love to hear what KSEMO helps you do best."
            }
          />
          <div className="flex items-center justify-between text-[11px] text-muted-foreground">
            <span>
              {trimmedLength < 10
                ? "A little more detail, please (at least 10 characters)."
                : "Your name and account email are attached so we can reply."}
            </span>
            <span className="tabular-nums">{message.length}/4000</span>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <Button
            onClick={submit}
            disabled={!canSend}
            className="rounded-xl bg-foreground text-background hover:bg-foreground/90 disabled:bg-muted disabled:text-muted-foreground"
          >
            {sendMutation.isPending ? (
              "Sending…"
            ) : (
              <>
                <Send className="size-3.5" />
                Send feedback
              </>
            )}
          </Button>
          <span className="text-xs text-muted-foreground">
            Prefer email?{" "}
            <a
              href={`mailto:support@ksemo.app?subject=KSEMO%20${encodeURIComponent(category ?? "feedback")}`}
              className="underline underline-offset-2 hover:text-foreground"
            >
              support@ksemo.app
            </a>
          </span>
        </div>
      </div>
    </>
  );
}
