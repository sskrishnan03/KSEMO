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
import { Loading } from "@/components/ui/loading";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useTheme, type ThemeMode } from "@/contexts/ThemeContext";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import {
  Archive,
  Bug,
  ExternalLink,
  KeyRound,
  Lightbulb,
  LogOut,
  MessageSquare,
  Palette,
  Share2,
  ShieldCheck,
  ShieldOff,
  Settings2,
  Star,
  Trash2,
  User,
  Zap,
} from "lucide-react";
import React, { memo, useEffect, useState } from "react";

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
  name?: string | null;
  email?: string | null;
  role?: string | null;
  loginMethod?: string | null;
  createdAt?: Date | string | null;
  lastSignedIn?: Date | string | null;
};

type SettingsTab = "account" | "security" | "appearance" | "data" | "feedback";

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
  { id: "feedback", label: "Feedback", icon: MessageSquare },
];

export const SettingsDialog = memo(function SettingsDialog({
  open,
  onOpenChange,
  user,
  onSignOut,
  onOpenWorkspace,
  onAllChatsDeleted,
  onOpenSharedLinks,
  onDeleteAccount,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: User;
  onSignOut: () => void;
  onOpenWorkspace: (section: "files") => void;
  onAllChatsDeleted: () => void;
  onOpenSharedLinks?: () => void;
  onDeleteAccount?: () => void;
}) {
  const [activeTab, setActiveTab] = useState<SettingsTab>("account");
  const [archivedOpen, setArchivedOpen] = useState(false);
  const [confirmDeleteAll, setConfirmDeleteAll] = useState(false);
  const [confirmDeleteAccount, setConfirmDeleteAccount] = useState(false);

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
          <aside className="hidden md:flex w-56 shrink-0 flex-col border-r border-border bg-[oklch(0.975_0.002_80)] px-3 py-3 dark:bg-[oklch(0.17_0.003_80)]">
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

          <nav className="flex md:hidden overflow-x-auto border-b border-border bg-[oklch(0.975_0.002_80)] px-2 py-1.5 dark:bg-[oklch(0.17_0.003_80)]">
            {settingsNavItems.map(item => {
              const Icon = item.icon;
              const active = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={`flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs transition-colors ${
                    active
                      ? "bg-muted font-medium text-foreground"
                      : "text-muted-foreground hover:bg-muted/70 hover:text-foreground"
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
              {activeTab === "account" && <AccountSection user={user} />}
              {activeTab === "security" && <SecuritySection user={user} />}
              {activeTab === "appearance" && <AppearanceSection />}
              {activeTab === "data" && (
                <DataSection
                  onOpenWorkspace={onOpenWorkspace}
                  onOpenArchived={() => setArchivedOpen(true)}
                  onDeleteAll={() => setConfirmDeleteAll(true)}
                  onOpenSharedLinks={onOpenSharedLinks}
                  onDeleteAccount={() => setConfirmDeleteAccount(true)}
                />
              )}
              {activeTab === "feedback" && <FeedbackSection />}
            </div>
          </div>
        </div>
      </DialogContent>

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
      <AlertDialog open={confirmDeleteAccount} onOpenChange={setConfirmDeleteAccount}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Account?</AlertDialogTitle>
            <AlertDialogDescription>
              Permanently delete your account and associated data. Deletions are
              immediate and cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setConfirmDeleteAccount(false)}>
              Cancel
            </AlertDialogCancel>
            <Button
              className="bg-destructive text-white hover:bg-destructive/90"
              onClick={() => {
                setConfirmDeleteAccount(false);
                onOpenChange(false);
                onDeleteAccount?.();
              }}
            >
              Delete Account
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Dialog>
  );
});

function AccountSection({ user }: { user: User }) {
  const formatDate = (d?: Date | string | null) => {
    if (!d) return "—";
    const date = typeof d === "string" ? new Date(d) : d;
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };
  const loginLabel =
    user.loginMethod === "google"
      ? "Google"
      : user.loginMethod === "email"
        ? "Email & password"
        : user.loginMethod || "—";

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
      <div className="space-y-2">
        <div className="flex items-center justify-between rounded-xl border border-border px-4 py-3">
          <p className="text-sm text-muted-foreground">Email</p>
          <p className="truncate text-sm font-medium">{user.email || "—"}</p>
        </div>
        <div className="flex items-center justify-between rounded-xl border border-border px-4 py-3">
          <p className="text-sm text-muted-foreground">Role</p>
          <p className="truncate text-sm font-medium capitalize">
            {user.role || "user"}
          </p>
        </div>
        <div className="flex items-center justify-between rounded-xl border border-border px-4 py-3">
          <p className="text-sm text-muted-foreground">Sign-in method</p>
          <p className="truncate text-sm font-medium">{loginLabel}</p>
        </div>
        <div className="flex items-center justify-between rounded-xl border border-border px-4 py-3">
          <p className="text-sm text-muted-foreground">Member since</p>
          <p className="truncate text-sm font-medium">
            {formatDate(user.createdAt)}
          </p>
        </div>
        <div className="flex items-center justify-between rounded-xl border border-border px-4 py-3">
          <p className="text-sm text-muted-foreground">Last signed in</p>
          <p className="truncate text-sm font-medium">
            {formatDate(user.lastSignedIn)}
          </p>
        </div>
      </div>
    </div>
  );
}

function SecuritySection({ user }: { user: User }) {
  const hasPassword = !!user.loginMethod;
  const isGoogle = user.loginMethod === "google";

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
                  ? "You sign in with Google. No local password set."
                  : "Reset your password via email."}
              </p>
            </div>
            {!isGoogle && (
              <Button
                variant="outline"
                size="sm"
                className="shrink-0 rounded-lg text-xs"
                disabled={!user.email}
                onClick={() => {
                  window.location.href = "/forgot-password";
                }}
              >
                Reset password
              </Button>
            )}
          </div>
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
    bg: "#FFFFFF",
    sidebar: "#F9FAFB",
    sidebarBorder: "#E5E7EB",
    surface: "#F3F4F6",
    text: "#111111",
    textSec: "#6B7280",
    border: "#E5E7EB",
    inputBg: "#F3F4F6",
    userBubble: "#F3F4F6",
    assistantBg: "#FFFFFF",
  } as const;
  return (
    <div className="flex size-full" style={{ background: s.bg }}>
      <div
        className="flex w-[26%] shrink-0 flex-col gap-[3px] px-[4px] py-[5px]"
        style={{ background: s.sidebar, borderRight: `1px solid ${s.sidebarBorder}` }}
      >
        <div className="flex items-center gap-[2px]">
          <div className="size-[5px] rounded-[1.5px]" style={{ background: s.border }} />
          <div className="h-[2.5px] w-[55%] rounded-full" style={{ background: s.border }} />
        </div>
        <div className="mt-[3px] flex flex-col gap-[2.5px]">
          <div className="h-[2.5px] w-[72%] rounded-full" style={{ background: s.border }} />
          <div className="h-[2.5px] w-[60%] rounded-full" style={{ background: s.border }} />
          <div className="h-[2.5px] w-[66%] rounded-full" style={{ background: s.border }} />
        </div>
        <div className="mt-auto flex items-center gap-[2px]">
          <div className="size-[5px] rounded-full" style={{ background: s.border }} />
          <div className="h-[2.5px] w-[50%] rounded-full" style={{ background: s.border }} />
        </div>
      </div>
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-center gap-[3px] px-[5px] py-[4px]" style={{ borderBottom: `1px solid ${s.border}` }}>
          <div className="h-[2.5px] w-[35%] rounded-full" style={{ background: s.textSec }} />
        </div>
        <div className="flex min-h-0 flex-1 flex-col justify-end gap-[3px] px-[5px] pb-[4px] pt-[3px]">
          <div className="flex justify-end">
            <div className="max-w-[65%] rounded-[3px] px-[4px] py-[2px]" style={{ background: s.userBubble }}>
              <div className="h-[2px] w-[40px] rounded-full" style={{ background: s.textSec }} />
            </div>
          </div>
          <div className="flex justify-start">
            <div className="max-w-[70%] rounded-[3px] px-[4px] py-[2px]" style={{ background: s.assistantBg, border: `1px solid ${s.border}` }}>
              <div className="h-[2px] w-[50px] rounded-full" style={{ background: s.border }} />
              <div className="mt-[1px] h-[2px] w-[32px] rounded-full" style={{ background: s.border }} />
            </div>
          </div>
        </div>
        <div className="flex items-center gap-[2px] px-[5px] pb-[4px]">
          <div className="h-[5px] flex-1 rounded-[2px]" style={{ background: s.inputBg, border: `1px solid ${s.border}` }} />
          <div className="size-[5px] rounded-[1.5px]" style={{ background: s.text }} />
        </div>
      </div>
    </div>
  );
}

function MiniKsemoDark() {
  const s = {
    bg: "#0A0A0A",
    sidebar: "#111111",
    sidebarBorder: "#222222",
    surface: "#1A1A1A",
    text: "#FFFFFF",
    textSec: "#888888",
    border: "#222222",
    inputBg: "#141414",
    userBubble: "#1A1A1A",
    assistantBg: "#111111",
  } as const;
  return (
    <div className="flex size-full" style={{ background: s.bg }}>
      <div
        className="flex w-[26%] shrink-0 flex-col gap-[3px] px-[4px] py-[5px]"
        style={{ background: s.sidebar, borderRight: `1px solid ${s.sidebarBorder}` }}
      >
        <div className="flex items-center gap-[2px]">
          <div className="size-[5px] rounded-[1.5px]" style={{ background: s.border }} />
          <div className="h-[2.5px] w-[55%] rounded-full" style={{ background: s.border }} />
        </div>
        <div className="mt-[3px] flex flex-col gap-[2.5px]">
          <div className="h-[2.5px] w-[72%] rounded-full" style={{ background: s.border }} />
          <div className="h-[2.5px] w-[60%] rounded-full" style={{ background: s.border }} />
          <div className="h-[2.5px] w-[66%] rounded-full" style={{ background: s.border }} />
        </div>
        <div className="mt-auto flex items-center gap-[2px]">
          <div className="size-[5px] rounded-full" style={{ background: s.border }} />
          <div className="h-[2.5px] w-[50%] rounded-full" style={{ background: s.border }} />
        </div>
      </div>
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-center gap-[3px] px-[5px] py-[4px]" style={{ borderBottom: `1px solid ${s.border}` }}>
          <div className="h-[2.5px] w-[35%] rounded-full" style={{ background: s.textSec }} />
        </div>
        <div className="flex min-h-0 flex-1 flex-col justify-end gap-[3px] px-[5px] pb-[4px] pt-[3px]">
          <div className="flex justify-end">
            <div className="max-w-[65%] rounded-[3px] px-[4px] py-[2px]" style={{ background: s.userBubble, border: `1px solid ${s.border}` }}>
              <div className="h-[2px] w-[40px] rounded-full" style={{ background: s.textSec }} />
            </div>
          </div>
          <div className="flex justify-start">
            <div className="max-w-[70%] rounded-[3px] px-[4px] py-[2px]" style={{ background: s.assistantBg, border: `1px solid ${s.border}` }}>
              <div className="h-[2px] w-[50px] rounded-full" style={{ background: s.border }} />
              <div className="mt-[1px] h-[2px] w-[32px] rounded-full" style={{ background: s.border }} />
            </div>
          </div>
        </div>
        <div className="flex items-center gap-[2px] px-[5px] pb-[4px]">
          <div className="h-[5px] flex-1 rounded-[2px]" style={{ background: s.inputBg, border: `1px solid ${s.border}` }} />
          <div className="size-[5px] rounded-[1.5px]" style={{ background: s.text }} />
        </div>
      </div>
    </div>
  );
}

function SystemPreviewThumb() {
  const light = {
    bg: "#FFFFFF",
    sidebar: "#F9FAFB",
    sidebarBorder: "#E5E7EB",
    border: "#E5E7EB",
    textSec: "#6B7280",
    inputBg: "#F3F4F6",
    userBubble: "#F3F4F6",
    assistantBg: "#FFFFFF",
    text: "#111111",
  } as const;
  const dark = {
    bg: "#0A0A0A",
    sidebar: "#111111",
    sidebarBorder: "#222222",
    border: "#222222",
    textSec: "#888888",
    inputBg: "#141414",
    userBubble: "#1A1A1A",
    assistantBg: "#111111",
    text: "#FFFFFF",
  } as const;

  function Half({ c }: { c: Record<string, string> }) {
    return (
      <div className="flex h-full flex-1 flex-col" style={{ background: c.bg }}>
        <div
          className="flex w-[26%] shrink-0 flex-col gap-[2px] px-[3px] py-[4px]"
          style={{ background: c.sidebar, borderRight: `1px solid ${c.sidebarBorder}` }}
        >
          <div className="flex items-center gap-[2px]">
            <div className="size-[4px] rounded-[1px]" style={{ background: c.border }} />
            <div className="h-[2px] w-[50%] rounded-full" style={{ background: c.border }} />
          </div>
          <div className="mt-[2px] flex flex-col gap-[2px]">
            <div className="h-[2px] w-[65%] rounded-full" style={{ background: c.border }} />
            <div className="h-[2px] w-[55%] rounded-full" style={{ background: c.sidebarBorder }} />
            <div className="h-[2px] w-[60%] rounded-full" style={{ background: c.border }} />
          </div>
        </div>
        <div className="flex min-w-0 flex-1 flex-col">
          <div
            className="flex items-center px-[3px] py-[2px]"
            style={{ borderBottom: `1px solid ${c.border}` }}
          >
            <div className="h-[1.5px] w-[30%] rounded-full" style={{ background: c.textSec }} />
          </div>
          <div className="flex min-h-0 flex-1 flex-col justify-end gap-[2px] px-[3px] pb-[3px] pt-[2px]">
            <div className="flex justify-end">
              <div
                className="max-w-[70%] rounded-[2px] px-[3px] py-[1.5px]"
                style={{ background: c.userBubble, border: `1px solid ${c.border}` }}
              >
                <div className="h-[1.5px] w-[28px] rounded-full" style={{ background: c.textSec }} />
              </div>
            </div>
            <div className="flex justify-start">
              <div
                className="max-w-[70%] rounded-[2px] px-[3px] py-[1.5px]"
                style={{ background: c.assistantBg, border: `1px solid ${c.border}` }}
              >
                <div className="h-[1.5px] w-[32px] rounded-full" style={{ background: c.border }} />
              </div>
            </div>
          </div>
          <div className="flex items-center gap-[2px] px-[3px] pb-[3px]">
            <div
              className="h-[3.5px] flex-1 rounded-[1.5px]"
              style={{ background: c.inputBg, border: `1px solid ${c.border}` }}
            />
            <div className="size-[3.5px] rounded-[1px]" style={{ background: c.text }} />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex size-full overflow-hidden rounded-lg">
      <Half c={light} />
      <div style={{ width: 1, background: "#D1D5DB" }} />
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
  onOpenWorkspace,
  onOpenArchived,
  onDeleteAll,
  onOpenSharedLinks,
  onDeleteAccount,
}: {
  onOpenWorkspace: (section: "files") => void;
  onOpenArchived: () => void;
  onDeleteAll: () => void;
  onOpenSharedLinks?: () => void;
  onDeleteAccount?: () => void;
}) {
  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-base font-semibold tracking-[-0.02em]">
          Data Control
        </h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Manage your conversations and uploaded files.
        </p>
      </div>
      <div className="space-y-2">
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
        <button
          onClick={onOpenSharedLinks}
          className="flex w-full items-center justify-between rounded-xl border border-border p-3.5 text-left transition-colors hover:bg-muted/50"
        >
          <div>
            <p className="text-sm font-medium">See Shared Links</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              See all the shared links you have created. You can also delete
              them and revoke access here.
            </p>
          </div>
          <Share2 className="size-4 text-muted-foreground" />
        </button>
      </div>
      <button
        onClick={onDeleteAll}
        className="flex w-full items-center justify-between rounded-xl border border-destructive/30 bg-destructive/5 p-3.5 text-left transition-colors hover:bg-destructive/10"
      >
        <div>
          <p className="text-sm font-medium text-destructive">
            Delete all chats
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Permanent, cannot be undone
          </p>
        </div>
        <Trash2 className="size-4 text-destructive" />
      </button>
      <button
        onClick={onDeleteAccount}
        className="flex w-full items-center justify-between rounded-xl border border-destructive/30 bg-destructive/5 p-3.5 text-left transition-colors hover:bg-destructive/10"
      >
        <div>
          <p className="text-sm font-medium text-destructive">
            Delete Account
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Permanently delete your account and associated data. Deletions are
            immediate and cannot be undone.
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
          Type{" "}
          <span className="font-mono font-medium text-foreground">DELETE</span>{" "}
          to confirm:
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
            <Loading className="py-6" />
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
                    <p className="truncate text-[13px] font-medium">
                      {c.title}
                    </p>
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
