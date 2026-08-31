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
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useTheme, type ThemeMode } from "@/contexts/ThemeContext";
import { trpc } from "@/lib/trpc";
import { createPublicConversationUrl } from "@/lib/ksemoInteraction";
import { toast } from "sonner";
import { ConfirmDeleteDialog } from "./ConfirmDeleteDialog";
import {
  Archive,
  ArchiveRestore,
  Brain,
  Bug,
  Copy,
  ExternalLink,
  HelpCircle,
  KeyRound,
  Lightbulb,
  Link2,
  LogOut,
  MessageSquare,
  Palette,
  Search,
  ShieldCheck,
  ShieldOff,
  Settings2,
  Star,
  Trash2,
  Unlink,
  User,
  X,
  Zap,
} from "lucide-react";
import React, { memo, useEffect, useMemo, useRef, useState } from "react";
import { MemorySection } from "./MemorySection";

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
type User = {
  id?: number;
  name?: string | null;
  email?: string | null;
  role?: string | null;
  loginMethod?: string | null;
  createdAt?: Date | string | null;
  lastSignedIn?: Date | string | null;
};

type SettingsTab =
  | "account"
  | "security"
  | "appearance"
  | "data"
  | "memory"
  | "feedback";

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
    keywords: "theme style preferences",
  },
];

const settingsNavItems: Array<{
  id: SettingsTab;
  label: string;
  icon: typeof MessageSquare;
}> = [
  { id: "account", label: "Account", icon: User },
  { id: "security", label: "Security", icon: ShieldCheck },
  { id: "appearance", label: "Appearance", icon: Palette },
  { id: "data", label: "Data Control", icon: Trash2 },
  { id: "memory", label: "Memory", icon: Brain },
  { id: "feedback", label: "Feedback", icon: MessageSquare },
];

// Power the settings-wide search bar: every entry is searchable text (nav
// labels plus real content from each section) so phrases like "two factor",
// or "archived chats" all land on the right tab. Only things that actually
// exist in the settings are searchable — no phantom entries.
const settingsSearchIndex: Array<{
  tab: SettingsTab;
  label: string;
  hint: string;
}> = [
  {
    tab: "account",
    label: "Your account",
    hint: "Account",
  },
  {
    tab: "account",
    label: "Full name",
    hint: "Account",
  },
  {
    tab: "account",
    label: "Email",
    hint: "Account",
  },
  {
    tab: "account",
    label: "Account created",
    hint: "Account",
  },
  {
    tab: "account",
    label: "Delete account",
    hint: "Account",
  },

  {
    tab: "security",
    label: "Password",
    hint: "Security",
  },
  {
    tab: "security",
    label: "Two-factor authentication",
    hint: "Security",
  },
  {
    tab: "security",
    label: "Session",
    hint: "Security",
  },
  {
    tab: "security",
    label: "Login method",
    hint: "Security",
  },

  {
    tab: "appearance",
    label: "Theme",
    hint: "Appearance",
  },

  {
    tab: "data",
    label: "Archived chats",
    hint: "Data Control",
  },
  {
    tab: "data",
    label: "Shared chats",
    hint: "Data Control",
  },
  {
    tab: "data",
    label: "Download my data",
    hint: "Data Control",
  },
  {
    tab: "data",
    label: "Delete all chats",
    hint: "Data Control",
  },

  {
    tab: "memory",
    label: "Memory",
    hint: "Memory",
  },

  {
    tab: "feedback",
    label: "Feedback",
    hint: "Feedback",
  },
  {
    tab: "feedback",
    label: "Send feedback",
    hint: "Feedback",
  },
];

function SettingsSearch({
  onSelect,
}: {
  onSelect: (tab: SettingsTab) => void;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [highlighted, setHighlighted] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const trimmed = query.trim().toLocaleLowerCase();
  const results = useMemo(() => {
    if (!trimmed) return [];
    return settingsSearchIndex
      .map(entry => ({
        entry,
        rank: settingsNavItems.findIndex(item => item.id === entry.tab),
      }))
      .filter(({ entry }) =>
        `${entry.label} ${entry.hint}`
          .toLocaleLowerCase()
          .includes(trimmed)
      )
      .sort(
        (a, b) => a.rank - b.rank || a.entry.label.localeCompare(b.entry.label)
      );
  }, [trimmed]);

  useEffect(() => {
    setHighlighted(0);
  }, [trimmed]);

  // Close when focus leaves the whole component (input or results).
  useEffect(() => {
    function onPointerDown(event: MouseEvent) {
      if (rootRef.current?.contains(event.target as Node)) return;
      setOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, []);

  const select = (tab: SettingsTab) => {
    setOpen(false);
    onSelect(tab);
  };

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (!open && event.key !== "Escape") return;
    if (event.key === "Escape") {
      setOpen(false);
      inputRef.current?.blur();
      return;
    }
    if (results.length === 0) return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setOpen(true);
      setHighlighted(current => (current + 1) % results.length);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setOpen(true);
      setHighlighted(
        current => (current - 1 + results.length) % results.length
      );
    } else if (event.key === "Enter") {
      event.preventDefault();
      const result = results[highlighted];
      if (result) select(result.entry.tab);
    }
  };

  return (
    <div ref={rootRef} className="relative pb-3">
      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
        <input
          ref={inputRef}
          value={query}
          onChange={event => {
            setQuery(event.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          placeholder="Search settings…"
          aria-label="Search settings"
          className="h-10 w-full rounded-xl border border-border bg-muted/40 pr-9 pl-9 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-primary/40 focus:ring-2 focus:ring-primary/20"
        />
        {query && (
          <button
            type="button"
            onClick={() => setQuery("")}
            aria-label="Clear settings search"
            className="absolute top-1/2 right-2 flex size-6 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground outline-none transition-colors hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
          >
            <X className="size-3.5" />
          </button>
        )}
      </div>

      {open && trimmed && (
        <div className="absolute inset-x-0 top-full z-30 mt-1.5 overflow-hidden rounded-xl border border-border bg-popover shadow-xl">
          {results.length === 0 ? (
            <p className="px-3.5 py-3 text-xs text-muted-foreground">
              No matching settings for “{query.trim()}”.
            </p>
          ) : (
            <ul className="max-h-72 overflow-y-auto p-1.5">
              {results.map(({ entry }, index) => {
                const Icon =
                  settingsNavItems.find(item => item.id === entry.tab)?.icon ??
                  Settings2;
                return (
                  <li key={`${entry.tab}-${entry.label}`}>
                    <button
                      type="button"
                      onMouseEnter={() => setHighlighted(index)}
                      onClick={() => select(entry.tab)}
                      className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left transition-colors ${
                        index === highlighted ? "bg-accent" : "hover:bg-accent"
                      }`}
                    >
                      <Icon className="size-4 shrink-0 text-muted-foreground" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[13px] font-medium text-foreground">
                          {entry.label}
                        </span>
                        <span className="block text-[11px] text-muted-foreground">
                          {entry.hint}
                        </span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

export const SettingsDialog = memo(function SettingsDialog({
  open,
  onOpenChange,
  user,
  onSignOut,
  onAllChatsDeleted,
  onAccountDeleted,
  onOpenConversation,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: User;
  onSignOut: () => void;
  onAllChatsDeleted: () => void;
  onAccountDeleted?: () => void;
  onOpenConversation?: (conversationId: string) => void;
}) {
  const [activeTab, setActiveTab] = useState<SettingsTab>("account");
  const [archivedOpen, setArchivedOpen] = useState(false);
  const [sharedOpen, setSharedOpen] = useState(false);
  const [confirmDeleteAll, setConfirmDeleteAll] = useState(false);
  const [confirmDeleteAccount, setConfirmDeleteAccount] = useState(false);
  const utils = trpc.useUtils();
  const removeAllMutation = trpc.conversation.removeAll.useMutation({
    onSuccess: result => {
      utils.conversation.list.invalidate();
      toast.success(
        result.removed === 1
          ? "1 chat deleted"
          : `${result.removed} chats deleted`
      );
      setConfirmDeleteAll(false);
      onOpenChange(false);
      onAllChatsDeleted();
    },
    onError: () => toast.error("Could not delete all chats."),
  });
  const deleteAccountMutation = trpc.auth.deleteAccount.useMutation({
    onSuccess: () => {
      setConfirmDeleteAccount(false);
      onOpenChange(false);
      onAccountDeleted?.();
    },
    onError: () => {
      setConfirmDeleteAccount(false);
      toast.error(
        "Your account could not be deleted right now. Please try again."
      );
    },
  });

  useEffect(() => {
    if (open) setActiveTab("account");
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[70dvh] w-[60vw] !max-w-none max-md:h-[min(85dvh,520px)] max-md:w-[calc(100%-1rem)] flex-col gap-0 overflow-hidden rounded-2xl p-0">
        <DialogHeader className="sr-only">
          <DialogTitle>Settings</DialogTitle>
          <DialogDescription>
            Manage your KSEMO preferences and account.
          </DialogDescription>
        </DialogHeader>

        <div className="flex min-h-0 flex-1 flex-col md:flex-row">
          <aside className="hidden md:flex w-56 shrink-0 flex-col border-r border-border bg-sidebar px-3 py-3">
            <div className="mb-3 flex items-center gap-2 px-2 pb-2">
              <Settings2 className="size-4 text-muted-foreground" />
              <span className="text-sm font-semibold tracking-[-0.02em]">
                Settings
              </span>
            </div>
            <SettingsSearch onSelect={setActiveTab} />
            <nav className="space-y-0.5">
              {settingsNavItems.map(item => {
                const Icon = item.icon;
                const active = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => setActiveTab(item.id)}
                    className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm transition-colors outline-none focus-visible:ring-0 focus-visible:outline-none ${
                      active
                        ? "bg-accent font-medium text-foreground"
                        : "text-muted-foreground hover:bg-accent hover:text-foreground"
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
                className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm text-destructive transition-colors outline-none hover:bg-accent focus-visible:ring-0 focus-visible:outline-none"
              >
                <LogOut className="size-4 shrink-0" />
                Sign out
              </button>
            </div>
          </aside>

          <nav className="flex md:hidden overflow-x-auto border-b border-border bg-sidebar px-2 py-1.5">
            {settingsNavItems.map(item => {
              const Icon = item.icon;
              const active = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={`flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs transition-colors outline-none focus-visible:ring-0 focus-visible:outline-none ${
                    active
                      ? "bg-accent font-medium text-foreground"
                      : "text-muted-foreground hover:bg-accent hover:text-foreground"
                  }`}
                >
                  <Icon className="size-3.5 shrink-0" />
                  {item.label}
                </button>
              );
            })}
          </nav>

          <div className="flex min-h-0 flex-1 flex-col">
            <div className="min-h-0 flex-1 overflow-y-auto p-4 md:p-5">
              {activeTab === "account" && (
                <AccountSection
                  user={user}
                  deleteBusy={deleteAccountMutation.isPending}
                  onDeleteAccount={() => setConfirmDeleteAccount(true)}
                />
              )}
              {activeTab === "security" && <SecuritySection user={user} />}
              {activeTab === "appearance" && <AppearanceSection />}
              {activeTab === "data" && (
                <DataSection
                  onOpenArchived={() => setArchivedOpen(true)}
                  onOpenShared={() => setSharedOpen(true)}
                  onDeleteAll={() => setConfirmDeleteAll(true)}
                />
              )}
              {activeTab === "memory" && <MemorySection />}
              {activeTab === "feedback" && <FeedbackSection />}
            </div>
          </div>
        </div>
      </DialogContent>

      <ManagedChatsDialog
        open={archivedOpen}
        onOpenChange={setArchivedOpen}
        onCloseSettings={() => onOpenChange(false)}
        onOpenConversation={onOpenConversation}
      />
      <SharedChatsDialog
        open={sharedOpen}
        onOpenChange={setSharedOpen}
        onCloseSettings={() => onOpenChange(false)}
        onOpenConversation={onOpenConversation}
      />
      <ConfirmDeleteDialog
        open={confirmDeleteAll}
        onOpenChange={setConfirmDeleteAll}
        title="Delete all chats?"
        description="Every conversation, including archived ones, will be permanently removed."
        confirmLabel="Delete"
        confirmKeyword="DELETE"
        busy={removeAllMutation.isPending}
        onConfirm={() => removeAllMutation.mutate()}
      />
      <ConfirmDeleteDialog
        open={confirmDeleteAccount}
        onOpenChange={setConfirmDeleteAccount}
        title="Delete account?"
        description="Your account and all of your data — conversations, files, projects and settings — will be permanently removed. This cannot be undone."
        confirmLabel="Delete account"
        busyLabel="Deleting account…"
        busy={deleteAccountMutation.isPending}
        onConfirm={() => deleteAccountMutation.mutate()}
      />
    </Dialog>
  );
});

function AccountSection({
  user,
  deleteBusy,
  onDeleteAccount,
}: {
  user: User;
  deleteBusy: boolean;
  onDeleteAccount: () => void;
}) {
  const utils = trpc.useUtils();
  const [name, setName] = useState(user.name ?? "");
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved">(
    "idle"
  );
  useEffect(() => {
    setName(user.name ?? "");
  }, [user.name]);
  const updateProfileMutation = trpc.auth.updateProfile.useMutation({
    onMutate: () => setSaveState("saving"),
    onSuccess: () => {
      utils.auth.me.invalidate();
      setSaveState("saved");
    },
    onError: () => {
      setSaveState("idle");
      toast.error("Could not save your name.");
    },
  });
  useEffect(() => {
    const trimmed = name.trim();
    if (!trimmed) {
      setSaveState("idle");
      return;
    }
    if (trimmed === user.name) {
      setSaveState("idle");
      return;
    }
    setSaveState("saving");
    const timer = setTimeout(() => {
      updateProfileMutation.mutate({ name: trimmed });
    }, 800);
    return () => clearTimeout(timer);
  }, [name]);
  const createdLabel = user.createdAt
    ? new Date(user.createdAt).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : "—";

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-base font-semibold tracking-[-0.02em]">
          Your account
        </h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Manage your account information.
        </p>
      </div>

      <div className="flex items-center gap-3.5 rounded-xl border border-border p-4">
        <div className="flex size-11 items-center justify-center rounded-xl bg-muted text-sm font-bold">
          {(name.trim() || user.name || "U").charAt(0).toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">
            {name.trim() || "KSEMO user"}
          </p>
          <p className="mt-0.5 truncate text-xs text-muted-foreground">
            {user.email || "Signed in"}
          </p>
        </div>
      </div>

      <div className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="account-full-name" className="text-xs">
            Full name
          </Label>
          <Input
            id="account-full-name"
            value={name}
            maxLength={120}
            onChange={e => setName(e.target.value)}
            placeholder="Your name"
            className="h-9 rounded-lg text-sm"
          />
          <p className="text-[11px] text-muted-foreground">
            {saveState === "saving"
              ? "Saving…"
              : saveState === "saved"
                ? "Saved"
                : "Represents you across KSEMO"}
          </p>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs">Email</Label>
          <p className="truncate text-sm font-medium text-foreground">
            {user.email || "—"}
          </p>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs">Account created</Label>
          <p className="text-sm font-medium text-foreground">{createdLabel}</p>
        </div>
      </div>

      <div className="flex w-full items-center justify-between gap-3 rounded-xl border border-destructive/30 bg-destructive/5 p-3.5">
        <div className="min-w-0">
          <p className="text-sm font-medium text-destructive">Delete account</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Removes your account and all associated data
          </p>
        </div>
        <button
          type="button"
          disabled={deleteBusy}
          onClick={onDeleteAccount}
          className="shrink-0 inline-flex items-center rounded-lg bg-destructive px-3 py-1.5 text-[11px] font-semibold text-destructive-foreground transition-opacity hover:opacity-90 disabled:pointer-events-none disabled:opacity-60"
        >
          {deleteBusy ? "Deleting…" : "Delete Account"}
        </button>
      </div>
    </div>
  );
}

function SecuritySection({ user }: { user: User }) {
  const isGoogle = user.loginMethod === "google";
  const hasPassword =
    user.loginMethod === "password" || user.loginMethod === "email";
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  const changePasswordMutation = trpc.auth.changePassword.useMutation({
    onSuccess: () => {
      toast.success("Password updated. Use it the next time you sign in.");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setFormError(null);
    },
    onError: error => {
      setFormError(error.message);
      toast.error(error.message);
    },
  });

  const canSubmit =
    !changePasswordMutation.isPending &&
    currentPassword.length >= 8 &&
    newPassword.length >= 8 &&
    confirmPassword.length >= 8;

  const handleSubmitPassword = () => {
    if (newPassword !== confirmPassword) {
      setFormError("The new password and its confirmation don't match.");
      toast.error("The new password and its confirmation don't match.");
      return;
    }
    if (newPassword === currentPassword) {
      setFormError("New password must be different from your current one.");
      toast.error("New password must be different from your current one.");
      return;
    }
    setFormError(null);
    changePasswordMutation.mutate({
      currentPassword,
      newPassword,
    });
  };

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-base font-semibold tracking-[-0.02em]">Security</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Manage your password and account security.
        </p>
      </div>

      <div className="space-y-2">
        <div className="rounded-xl border border-border p-4">
          <div className="flex items-center gap-3">
            <span className="flex size-9 items-center justify-center rounded-lg bg-muted">
              <KeyRound className="size-4 text-muted-foreground" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">Password</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {isGoogle
                  ? "You sign in with Google. No local password is set, so a reset here doesn't apply."
                  : "Reset your password below. Your new password will be used the next time you sign in."}
              </p>
            </div>
          </div>

          {isGoogle ? (
            <div className="mt-3.5 rounded-lg bg-muted/60 px-3.5 py-3 text-xs text-muted-foreground">
              <p>
                You signed in through Google, which keeps your password with
                Google. Use Google's account settings to manage it.
              </p>
            </div>
          ) : (
            <div className="mt-3.5 space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="account-current-password" className="text-xs">
                  Current password
                </Label>
                <Input
                  id="account-current-password"
                  type="password"
                  value={currentPassword}
                  onChange={e => setCurrentPassword(e.target.value)}
                  className="h-9 rounded-lg text-sm"
                  placeholder="Your current password"
                  autoComplete="current-password"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="account-new-password" className="text-xs">
                  New password
                </Label>
                <Input
                  id="account-new-password"
                  type="password"
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  className="h-9 rounded-lg text-sm"
                  placeholder="At least 8 characters"
                  autoComplete="new-password"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="account-confirm-password" className="text-xs">
                  Confirm new password
                </Label>
                <Input
                  id="account-confirm-password"
                  type="password"
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  className="h-9 rounded-lg text-sm"
                  placeholder="Repeat the new password"
                  autoComplete="new-password"
                  onKeyDown={e => {
                    if (e.key === "Enter" && canSubmit) handleSubmitPassword();
                  }}
                />
              </div>

              {formError && (
                <p className="text-xs font-medium text-destructive">
                  {formError}
                </p>
              )}

              <div className="flex items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    disabled={!canSubmit}
                    onClick={handleSubmitPassword}
                    className="inline-flex items-center rounded-lg bg-foreground px-3.5 py-2 text-xs font-semibold text-background transition-opacity hover:opacity-90 disabled:pointer-events-none disabled:opacity-50"
                  >
                    {changePasswordMutation.isPending
                      ? "Updating…"
                      : "Reset password"}
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    window.location.href = "/forgot-password";
                  }}
                  className="text-xs font-medium text-muted-foreground underline-offset-2 transition-colors hover:text-foreground hover:underline"
                >
                  Forgot password?
                </button>
              </div>

              {!hasPassword && (
                <p className="text-xs text-muted-foreground">
                  No password is linked to this account yet. Use the password
                  reset link to create one.
                </p>
              )}
            </div>
          )}
        </div>

        <div className="rounded-xl border border-border p-4">
          <div className="flex items-center gap-3">
            <span className="flex size-9 items-center justify-center rounded-lg bg-muted">
              <ShieldOff className="size-4 text-muted-foreground" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">Two-factor authentication</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Add an extra layer of security to your account.
              </p>
            </div>
            <span className="rounded-full bg-muted px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              Coming soon
            </span>
          </div>
        </div>

        <div className="rounded-xl border border-border p-4">
          <div className="flex items-center gap-3">
            <span className="flex size-9 items-center justify-center rounded-lg bg-muted">
              <ShieldCheck className="size-4 text-muted-foreground" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">Session</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                You are signed in on this device. Sessions expire after 1 year.
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-border p-4">
          <div className="flex items-center gap-3">
            <span className="flex size-9 items-center justify-center rounded-lg bg-muted">
              <ExternalLink className="size-4 text-muted-foreground" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">Login method</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {isGoogle
                  ? "Connected via Google OAuth."
                  : hasPassword
                    ? "Email and password authentication."
                    : "No sign-in method recorded."}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

const themeOptions: Array<{
  value: ThemeMode;
  label: string;
  ariaLabel: string;
}> = [
  { value: "light", label: "Light", ariaLabel: "Light theme" },
  { value: "dark", label: "Dark", ariaLabel: "Dark theme" },
  { value: "system", label: "System", ariaLabel: "System theme" },
];

const THUMB_W = 112;
const THUMB_H = 72;

function MiniKsemoLight() {
  const s = {
    bg: "#F8F8FF",
    sidebar: "#D3D3D3",
    sidebarBorder: "#C2C2C2",
    surface: "#E9E9F0",
    text: "#1A1A1A",
    textSec: "#6B6B74",
    border: "#C2C2C2",
    inputBg: "#E9E9F0",
    userBubble: "#E9E9F0",
    assistantBg: "#FFFFFF",
  } as const;
  return (
    <div className="flex size-full" style={{ background: s.bg }}>
      <div
        className="flex w-[26%] shrink-0 flex-col gap-[3px] px-[4px] py-[5px]"
        style={{
          background: s.sidebar,
          borderRight: `1px solid ${s.sidebarBorder}`,
        }}
      >
        <div className="flex items-center gap-[2px]">
          <div
            className="size-[5px] rounded-[1.5px]"
            style={{ background: s.border }}
          />
          <div
            className="h-[2.5px] w-[55%] rounded-full"
            style={{ background: s.border }}
          />
        </div>
        <div className="mt-[3px] flex flex-col gap-[2.5px]">
          <div
            className="h-[2.5px] w-[72%] rounded-full"
            style={{ background: s.border }}
          />
          <div
            className="h-[2.5px] w-[60%] rounded-full"
            style={{ background: s.border }}
          />
          <div
            className="h-[2.5px] w-[66%] rounded-full"
            style={{ background: s.border }}
          />
        </div>
        <div className="mt-auto flex items-center gap-[2px]">
          <div
            className="size-[5px] rounded-full"
            style={{ background: s.border }}
          />
          <div
            className="h-[2.5px] w-[50%] rounded-full"
            style={{ background: s.border }}
          />
        </div>
      </div>
      <div className="flex min-w-0 flex-1 flex-col">
        <div
          className="flex items-center gap-[3px] px-[5px] py-[4px]"
          style={{ borderBottom: `1px solid ${s.border}` }}
        >
          <div
            className="h-[2.5px] w-[35%] rounded-full"
            style={{ background: s.textSec }}
          />
        </div>
        <div className="flex min-h-0 flex-1 flex-col justify-end gap-[3px] px-[5px] pb-[4px] pt-[3px]">
          <div className="flex justify-end">
            <div
              className="max-w-[65%] rounded-[3px] px-[4px] py-[2px]"
              style={{ background: s.userBubble }}
            >
              <div
                className="h-[2px] w-[40px] rounded-full"
                style={{ background: s.textSec }}
              />
            </div>
          </div>
          <div className="flex justify-start">
            <div
              className="max-w-[70%] rounded-[3px] px-[4px] py-[2px]"
              style={{
                background: s.assistantBg,
                border: `1px solid ${s.border}`,
              }}
            >
              <div
                className="h-[2px] w-[50px] rounded-full"
                style={{ background: s.border }}
              />
              <div
                className="mt-[1px] h-[2px] w-[32px] rounded-full"
                style={{ background: s.border }}
              />
            </div>
          </div>
        </div>
        <div className="flex items-center gap-[2px] px-[5px] pb-[4px]">
          <div
            className="h-[5px] flex-1 rounded-[2px]"
            style={{ background: s.inputBg, border: `1px solid ${s.border}` }}
          />
          <div
            className="size-[5px] rounded-[1.5px]"
            style={{ background: s.text }}
          />
        </div>
      </div>
    </div>
  );
}

function MiniKsemoDark() {
  const s = {
    bg: "#1A1A1A",
    sidebar: "#0A0A0A",
    sidebarBorder: "#262626",
    surface: "#232323",
    text: "#EDEDED",
    textSec: "#A6A6A6",
    border: "#262626",
    inputBg: "#222222",
    userBubble: "#232323",
    assistantBg: "#232323",
  } as const;
  return (
    <div className="flex size-full" style={{ background: s.bg }}>
      <div
        className="flex w-[26%] shrink-0 flex-col gap-[3px] px-[4px] py-[5px]"
        style={{
          background: s.sidebar,
          borderRight: `1px solid ${s.sidebarBorder}`,
        }}
      >
        <div className="flex items-center gap-[2px]">
          <div
            className="size-[5px] rounded-[1.5px]"
            style={{ background: s.border }}
          />
          <div
            className="h-[2.5px] w-[55%] rounded-full"
            style={{ background: s.border }}
          />
        </div>
        <div className="mt-[3px] flex flex-col gap-[2.5px]">
          <div
            className="h-[2.5px] w-[72%] rounded-full"
            style={{ background: s.border }}
          />
          <div
            className="h-[2.5px] w-[60%] rounded-full"
            style={{ background: s.border }}
          />
          <div
            className="h-[2.5px] w-[66%] rounded-full"
            style={{ background: s.border }}
          />
        </div>
        <div className="mt-auto flex items-center gap-[2px]">
          <div
            className="size-[5px] rounded-full"
            style={{ background: s.border }}
          />
          <div
            className="h-[2.5px] w-[50%] rounded-full"
            style={{ background: s.border }}
          />
        </div>
      </div>
      <div className="flex min-w-0 flex-1 flex-col">
        <div
          className="flex items-center gap-[3px] px-[5px] py-[4px]"
          style={{ borderBottom: `1px solid ${s.border}` }}
        >
          <div
            className="h-[2.5px] w-[35%] rounded-full"
            style={{ background: s.textSec }}
          />
        </div>
        <div className="flex min-h-0 flex-1 flex-col justify-end gap-[3px] px-[5px] pb-[4px] pt-[3px]">
          <div className="flex justify-end">
            <div
              className="max-w-[65%] rounded-[3px] px-[4px] py-[2px]"
              style={{
                background: s.userBubble,
                border: `1px solid ${s.border}`,
              }}
            >
              <div
                className="h-[2px] w-[40px] rounded-full"
                style={{ background: s.textSec }}
              />
            </div>
          </div>
          <div className="flex justify-start">
            <div
              className="max-w-[70%] rounded-[3px] px-[4px] py-[2px]"
              style={{
                background: s.assistantBg,
                border: `1px solid ${s.border}`,
              }}
            >
              <div
                className="h-[2px] w-[50px] rounded-full"
                style={{ background: s.border }}
              />
              <div
                className="mt-[1px] h-[2px] w-[32px] rounded-full"
                style={{ background: s.border }}
              />
            </div>
          </div>
        </div>
        <div className="flex items-center gap-[2px] px-[5px] pb-[4px]">
          <div
            className="h-[5px] flex-1 rounded-[2px]"
            style={{ background: s.inputBg, border: `1px solid ${s.border}` }}
          />
          <div
            className="size-[5px] rounded-[1.5px]"
            style={{ background: s.text }}
          />
        </div>
      </div>
    </div>
  );
}

function SystemPreviewThumb() {
  const light = {
    bg: "#F8F8FF",
    sidebar: "#D3D3D3",
    sidebarBorder: "#C2C2C2",
    border: "#C2C2C2",
    textSec: "#6B6B74",
    inputBg: "#E9E9F0",
    userBubble: "#E9E9F0",
    assistantBg: "#FFFFFF",
    text: "#1A1A1A",
  } as const;
  const dark = {
    bg: "#1A1A1A",
    sidebar: "#0A0A0A",
    sidebarBorder: "#262626",
    border: "#262626",
    textSec: "#A6A6A6",
    inputBg: "#222222",
    userBubble: "#232323",
    assistantBg: "#232323",
    text: "#EDEDED",
  } as const;

  function Half({ c }: { c: Record<string, string> }) {
    return (
      <div className="flex h-full flex-1 flex-col" style={{ background: c.bg }}>
        <div
          className="flex w-[26%] shrink-0 flex-col gap-[2px] px-[3px] py-[4px]"
          style={{
            background: c.sidebar,
            borderRight: `1px solid ${c.sidebarBorder}`,
          }}
        >
          <div className="flex items-center gap-[2px]">
            <div
              className="size-[4px] rounded-[1px]"
              style={{ background: c.border }}
            />
            <div
              className="h-[2px] w-[50%] rounded-full"
              style={{ background: c.border }}
            />
          </div>
          <div className="mt-[2px] flex flex-col gap-[2px]">
            <div
              className="h-[2px] w-[65%] rounded-full"
              style={{ background: c.border }}
            />
            <div
              className="h-[2px] w-[55%] rounded-full"
              style={{ background: c.sidebarBorder }}
            />
            <div
              className="h-[2px] w-[60%] rounded-full"
              style={{ background: c.border }}
            />
          </div>
        </div>
        <div className="flex min-w-0 flex-1 flex-col">
          <div
            className="flex items-center px-[3px] py-[2px]"
            style={{ borderBottom: `1px solid ${c.border}` }}
          >
            <div
              className="h-[1.5px] w-[30%] rounded-full"
              style={{ background: c.textSec }}
            />
          </div>
          <div className="flex min-h-0 flex-1 flex-col justify-end gap-[2px] px-[3px] pb-[3px] pt-[2px]">
            <div className="flex justify-end">
              <div
                className="max-w-[70%] rounded-[2px] px-[3px] py-[1.5px]"
                style={{
                  background: c.userBubble,
                  border: `1px solid ${c.border}`,
                }}
              >
                <div
                  className="h-[1.5px] w-[28px] rounded-full"
                  style={{ background: c.textSec }}
                />
              </div>
            </div>
            <div className="flex justify-start">
              <div
                className="max-w-[70%] rounded-[2px] px-[3px] py-[1.5px]"
                style={{
                  background: c.assistantBg,
                  border: `1px solid ${c.border}`,
                }}
              >
                <div
                  className="h-[1.5px] w-[32px] rounded-full"
                  style={{ background: c.border }}
                />
              </div>
            </div>
          </div>
          <div className="flex items-center gap-[2px] px-[3px] pb-[3px]">
            <div
              className="h-[3.5px] flex-1 rounded-[1.5px]"
              style={{ background: c.inputBg, border: `1px solid ${c.border}` }}
            />
            <div
              className="size-[3.5px] rounded-[1px]"
              style={{ background: c.text }}
            />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex size-full overflow-hidden rounded-lg">
      <Half c={light} />
      <div style={{ width: 1, background: "var(--border)" }} />
      <Half c={dark} />
    </div>
  );
}

function AppearanceSection() {
  const { mode, setMode } = useTheme();

  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-base font-semibold tracking-[-0.02em]">
          Appearance
        </h3>
      </div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
        <p className="w-20 shrink-0 pt-1 text-sm font-medium text-muted-foreground">
          Theme
        </p>
        <div className="flex flex-wrap items-start gap-4">
          {themeOptions.map(opt => {
            const active = mode === opt.value;
            return (
              <button
                key={opt.value}
                role="radio"
                aria-checked={active}
                aria-label={opt.ariaLabel}
                tabIndex={0}
                onClick={() => setMode(opt.value)}
                onKeyDown={e => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    setMode(opt.value);
                  }
                }}
                className="group flex flex-col items-center gap-2 outline-none"
              >
                <div
                  className="relative overflow-hidden rounded-xl transition-all duration-200 ease-out group-hover:-translate-y-0.5 group-hover:shadow-md group-focus-visible:shadow-md"
                  style={{
                    width: THUMB_W,
                    height: THUMB_H,
                  }}
                >
                  {opt.value === "light" && <MiniKsemoLight />}
                  {opt.value === "dark" && <MiniKsemoDark />}
                  {opt.value === "system" && <SystemPreviewThumb />}
                  {active && (
                    <span className="absolute inset-0 z-10 flex items-center justify-center bg-black/20">
                      <span className="flex size-5 items-center justify-center rounded-full bg-foreground">
                        <svg
                          className="size-3 text-background"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="3"
                        >
                          <path
                            d="M5 13l4 4L19 7"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      </span>
                    </span>
                  )}
                </div>
                <span
                  className={`text-[11px] font-medium tracking-wide ${
                    active
                      ? "text-foreground"
                      : "text-muted-foreground group-hover:text-foreground"
                  }`}
                >
                  {opt.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function DataSection({
  onOpenArchived,
  onOpenShared,
  onDeleteAll,}: {
  onOpenArchived: () => void;
  onOpenShared: () => void;
  onDeleteAll: () => void;
}) {
  const exportQuery = trpc.workspace.data.exportAll.useQuery(undefined, {
    enabled: false,
  });
  const [exportBusy, setExportBusy] = useState(false);

  const handleExport = async () => {
    if (exportBusy) return;
    setExportBusy(true);
    try {
      const result = await exportQuery.refetch();
      if (result.data) {
        const stamp = new Date().toISOString().slice(0, 10);
        const blob = new Blob([JSON.stringify(result.data, null, 2)], {
          type: "application/json",
        });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `ksemo-data-${stamp}.json`;
        document.body.appendChild(link);
        link.click();
        link.remove();
        URL.revokeObjectURL(url);
        toast.success("Your data export is ready to download.");
      } else {
        toast.error("Could not export your data right now.");
      }
    } catch {
      toast.error("Could not export your data right now.");
    } finally {
      setExportBusy(false);
    }
  };

  const manageButtonClass =
    "shrink-0 rounded-lg bg-foreground px-3 py-1.5 text-[11px] font-semibold text-background transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2";

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-base font-semibold tracking-[-0.02em]">
          Data Control
        </h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Manage your conversations, uploaded files, and personal data.
        </p>
      </div>

      <div className="space-y-2">
        <div className="flex w-full items-center justify-between gap-3 rounded-xl border border-border p-3.5">
          <div className="min-w-0">
            <p className="text-sm font-medium">Archived chats</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Hidden from your sidebar, kept safe
            </p>
          </div>
          <button
            type="button"
            onClick={onOpenArchived}
            className={manageButtonClass}
          >
            Manage
          </button>
        </div>

        <div className="flex w-full items-center justify-between gap-3 rounded-xl border border-border p-3.5">
          <div className="min-w-0">
            <p className="text-sm font-medium">Shared chats</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Chats you made public — copy a link or stop sharing
            </p>
          </div>
          <button
            type="button"
            onClick={onOpenShared}
            className={manageButtonClass}
          >
            Manage
          </button>
        </div>

        <div className="flex w-full items-center justify-between gap-3 rounded-xl border border-border p-3.5">
          <div className="min-w-0">
            <p className="text-sm font-medium">Download my data</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Export all of your conversations, files, and account data as a
              JSON file
            </p>
          </div>
          <button
            type="button"
            disabled={exportBusy}
            onClick={() => void handleExport()}
            className="shrink-0 inline-flex items-center gap-1.5 rounded-lg bg-foreground px-3 py-1.5 text-[11px] font-semibold text-background transition-opacity hover:opacity-90 disabled:pointer-events-none disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            {exportBusy ? "Exporting…" : "Export"}
          </button>
        </div>
      </div>

      <div className="flex w-full items-center justify-between gap-3 rounded-xl border border-destructive/30 bg-destructive/5 p-3.5">
        <div className="min-w-0">
          <p className="text-sm font-medium text-destructive">
            Delete all chats
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Permanent, cannot be undone
          </p>
        </div>
        <button
          type="button"
          onClick={onDeleteAll}
          className="shrink-0 rounded-lg bg-destructive px-3 py-1.5 text-[11px] font-semibold text-destructive-foreground transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          Delete all
        </button>
      </div>
    </div>
  );
}

const feedbackCategories = [
  { id: "bug", label: "Bug report", icon: Bug },
  { id: "idea", label: "Feature request", icon: Lightbulb },
  { id: "question", label: "Question", icon: HelpCircle },
  { id: "praise", label: "General feedback", icon: Star },
] as const;

type FeedbackCategoryId = (typeof feedbackCategories)[number]["id"];

function FeedbackSection() {
  const [category, setCategory] = useState<FeedbackCategoryId | "">("");
  const [feedbackText, setFeedbackText] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const sendFeedback = trpc.feedback.send.useMutation({
    onSuccess: () => {
      toast.success("Thanks for your feedback!");
      setCategory("");
      setFeedbackText("");
      setSubmitted(true);
    },
    onError: error => {
      toast.error(error.message || "Could not send your feedback.");
    },
  });

  const handleSubmit = () => {
    if (!feedbackText.trim() || !category) return;
    sendFeedback.mutate({ category, message: feedbackText.trim() });
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
                        : "border-border text-muted-foreground hover:bg-accent hover:text-foreground"
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
                  : category === "idea"
                    ? "Describe the feature you'd like to see and why it would be useful…"
                    : category === "question"
                      ? "Ask us anything or share what you'd like to know about KSEMO…"
                      : "Share your thoughts, praise, or ideas for improving KSEMO…"
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
              disabled={!feedbackText.trim() || !category || sendFeedback.isPending}
              className="rounded-lg bg-foreground text-background hover:bg-foreground/90"
            >
              {sendFeedback.isPending ? "Sending…" : "Send feedback"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function ManagedChatsDialog({
  open,
  onOpenChange,
  onCloseSettings,
  onOpenConversation,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCloseSettings?: () => void;
  onOpenConversation?: (conversationId: string) => void;
}) {
  const chatsQuery = trpc.conversation.list.useQuery(
    { scope: "archived" },
    { enabled: open }
  );
  const utils = trpc.useUtils();
  const [deleteTarget, setDeleteTarget] = useState<{
    id: string;
    title: string;
  } | null>(null);
  const restoreMutation = trpc.conversation.setArchived.useMutation({
    onSuccess: () => {
      utils.conversation.list.invalidate();
      toast.success("Chat restored to your sidebar");
    },
    onError: () => toast.error("Could not restore chat."),
  });
  const deleteMutation = trpc.conversation.remove.useMutation({
    onSuccess: () => {
      utils.conversation.list.invalidate();
      if (deleteTarget) setDeleteTarget(null);
      toast.success("Chat deleted permanently");
    },
    onError: () => toast.error("Could not delete chat."),
  });
  const conversations = (chatsQuery.data ?? []) as Array<{
    id: string;
    title: string;
    updatedAt?: Date | string | null;
  }>;

  const openChat = (id: string) => {
    onOpenConversation?.(id);
    onOpenChange(false);
    onCloseSettings?.();
  };

  const restorePending = restoreMutation.isPending;

  const restoreChat = (id: string) => {
    restoreMutation.mutate({ id, isArchived: false });
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="flex max-h-[32rem] w-[calc(100%-1.5rem)] max-w-lg flex-col gap-0 overflow-hidden rounded-2xl p-0">
          <div className="shrink-0 border-b border-border px-4 pb-3 pt-4">
            <p className="text-base font-semibold">Archived chats</p>
            <p className="text-xs text-muted-foreground">
              Tap a chat to open it, restore to unarchive, or delete
              permanently.
            </p>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto p-3">
            {chatsQuery.isLoading ? (
              <Loading className="py-6" />
            ) : !conversations.length ? (
              <div className="py-8 text-center">
                <Archive className="mx-auto size-6 text-muted-foreground" />
                <p className="mt-3 text-sm font-medium">Nothing archived</p>
              </div>
            ) : (
              <ul className="space-y-1.5">
                {conversations.map(c => (
                  <li key={c.id}>
                    <div className="group flex items-center gap-2 rounded-xl border border-border px-3 py-2 transition-colors hover:bg-accent">
                      <button
                        onClick={() => openChat(c.id)}
                        className="min-w-0 flex-1 rounded-lg py-0.5 text-left focus-visible:ring-0 focus-visible:outline-none"
                      >
                        <p className="truncate text-[13px] font-medium">
                          {c.title}
                        </p>
                        <p className="mt-0.5 text-[11px] text-muted-foreground">
                          Archived
                        </p>
                      </button>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label="Unarchive chat"
                            className="size-8 shrink-0 rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground"
                            disabled={restorePending}
                            onClick={() => restoreChat(c.id)}
                          >
                            <ArchiveRestore className="size-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent side="bottom">Unarchive</TooltipContent>
                      </Tooltip>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label="Delete chat"
                            className="size-8 shrink-0 rounded-lg text-muted-foreground hover:bg-accent hover:text-destructive"
                            disabled={deleteMutation.isPending}
                            onClick={() =>
                              setDeleteTarget({ id: c.id, title: c.title })
                            }
                          >
                            <Trash2 className="size-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent side="bottom">Delete</TooltipContent>
                      </Tooltip>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <ConfirmDeleteDialog
        open={Boolean(deleteTarget)}
        onOpenChange={openState => {
          if (!openState) setDeleteTarget(null);
        }}
        title="Delete this chat?"
        description={`“${deleteTarget?.title ?? "This chat"}” will be permanently removed.`}
        confirmLabel="Delete"
        busy={deleteMutation.isPending}
        onConfirm={() => {
          if (deleteTarget) deleteMutation.mutate({ id: deleteTarget.id });
        }}
      />
    </>
  );
}

function SharedChatsDialog({
  open,
  onOpenChange,
  onCloseSettings,
  onOpenConversation,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCloseSettings?: () => void;
  onOpenConversation?: (conversationId: string) => void;
}) {
  const chatsQuery = trpc.conversation.list.useQuery(
    { scope: "shared" },
    { enabled: open }
  );
  const utils = trpc.useUtils();
  const [deleteTarget, setDeleteTarget] = useState<{
    id: string;
    title: string;
  } | null>(null);
  const [copyPending, setCopyPending] = useState(false);
  const unpublishMutation = trpc.conversation.configurePublicShare.useMutation({
    onSuccess: () => {
      utils.conversation.list.invalidate();
      toast.success("Chat is no longer shared");
    },
    onError: () => toast.error("Could not stop sharing this chat."),
  });
  const deleteMutation = trpc.conversation.remove.useMutation({
    onSuccess: () => {
      utils.conversation.list.invalidate();
      if (deleteTarget) setDeleteTarget(null);
      toast.success("Chat deleted permanently");
    },
    onError: () => toast.error("Could not delete chat."),
  });
  const conversations = (chatsQuery.data ?? []) as Array<{
    id: string;
    title: string;
    shareToken?: string | null;
    updatedAt?: Date | string | null;
  }>;

  const openChat = (id: string) => {
    onOpenConversation?.(id);
    onOpenChange(false);
    onCloseSettings?.();
  };

  const copyLink = async (shareToken: string | null | undefined) => {
    if (!shareToken) return;
    setCopyPending(true);
    try {
      await navigator.clipboard.writeText(
        createPublicConversationUrl(window.location.origin, shareToken)
      );
      toast.success("Link copied to clipboard");
    } catch {
      toast.error("Could not copy the link");
    } finally {
      setCopyPending(false);
    }
  };

  const busy =
    unpublishMutation.isPending || deleteMutation.isPending || copyPending;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="flex max-h-[32rem] w-[calc(100%-1.5rem)] max-w-lg flex-col gap-0 overflow-hidden rounded-2xl p-0">
          <div className="shrink-0 border-b border-border px-4 pb-3 pt-4">
            <p className="text-base font-semibold">Shared chats</p>
            <p className="text-xs text-muted-foreground">
              Everything you've shared with a public link. Tap a chat to open
              it, copy its link, stop sharing, or delete it permanently.
            </p>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto p-3">
            {chatsQuery.isLoading ? (
              <Loading className="py-6" />
            ) : !conversations.length ? (
              <div className="py-8 text-center">
                <Link2 className="mx-auto size-6 text-muted-foreground" />
                <p className="mt-3 text-sm font-medium">Nothing shared yet</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Chats you make public will show up here.
                </p>
              </div>
            ) : (
              <ul className="space-y-1.5">
                {conversations.map(c => (
                  <li key={c.id}>
                    <div className="flex items-center gap-2 rounded-xl border border-border px-3 py-2 transition-colors hover:bg-accent">
                      <button
                        onClick={() => openChat(c.id)}
                        className="min-w-0 flex-1 rounded-lg py-0.5 text-left focus-visible:ring-0 focus-visible:outline-none"
                      >
                        <p className="truncate text-[13px] font-medium">
                          {c.title}
                        </p>
                        <p className="mt-0.5 text-[11px] text-muted-foreground">
                          Public link active
                        </p>
                      </button>
                      <button
                        type="button"
                        disabled={!c.shareToken || busy}
                        onClick={() => copyLink(c.shareToken)}
                        aria-label="Copy public link"
                        className="shrink-0 inline-flex items-center gap-1 rounded-lg bg-foreground px-2.5 py-1.5 text-[11px] font-semibold text-background transition-opacity hover:opacity-90 disabled:pointer-events-none disabled:opacity-50"
                      >
                        <Copy className="size-3" />
                        Copy link
                      </button>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label="Stop sharing"
                            className="size-8 shrink-0 rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground"
                            disabled={busy}
                            onClick={() =>
                              unpublishMutation.mutate({
                                id: c.id,
                                isPublic: false,
                              })
                            }
                          >
                            <Unlink className="size-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent side="bottom">
                          Stop sharing
                        </TooltipContent>
                      </Tooltip>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label="Delete chat"
                            className="size-8 shrink-0 rounded-lg text-muted-foreground hover:bg-accent hover:text-destructive"
                            disabled={busy}
                            onClick={() =>
                              setDeleteTarget({ id: c.id, title: c.title })
                            }
                          >
                            <Trash2 className="size-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent side="bottom">Delete</TooltipContent>
                      </Tooltip>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <ConfirmDeleteDialog
        open={Boolean(deleteTarget)}
        onOpenChange={openState => {
          if (!openState) setDeleteTarget(null);
        }}
        title="Delete this chat?"
        description={`“${deleteTarget?.title ?? "This chat"}” will be permanently removed.`}
        confirmLabel="Delete"
        busy={deleteMutation.isPending}
        onConfirm={() => {
          if (deleteTarget) deleteMutation.mutate({ id: deleteTarget.id });
        }}
      />
    </>
  );
}
