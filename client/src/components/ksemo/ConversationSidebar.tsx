import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import {
  ArrowLeftRight,
  Archive,
  Check,
  ChevronDown,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Copy,
  Download,
  Ellipsis,
  ExternalLink,
  FileText,
  HelpCircle,
  Library,
  Headset,
  Loader2,
  LogOut,
  MessageCircle,
  PanelLeftClose,
  Pencil,
  Pin,
  Plus,
  Search,
  Settings2,
  Share2,
  ShieldCheck,
  SquarePen,
  Trash2,
  X,
} from "lucide-react";
import React, { useState } from "react";

type Conversation = {
  id: string;
  title: string;
  isPinned: boolean;
  isArchived: boolean;
  isPublic?: boolean;
  shareToken?: string | null;
};

export function ConversationSidebar({
  conversations,
  activeConversationId,
  open,
  collapsed,
  onClose,
  onToggleCollapsed,
  onNew,
  onSelect,
  onRename,
  onPin,
  onDuplicate,
  onArchive,
  onShare,
  onExport,
  onDelete,
  onSearch,
  onWorkspace,
  onSettings,
  onSupport,
  onLogout,
  accounts = [],
  onSwitchAccount,
  onAddAccount,
  onRemoveAccount,
  switchingAccountId,
  user,
  previewSupportOpen = false,
}: {
  conversations: Conversation[];
  activeConversationId: string | null;
  open: boolean;
  collapsed: boolean;
  onClose: () => void;
  onToggleCollapsed: () => void;
  onNew: () => void;
  onSelect: (id: string) => void;
  onRename: (conversation: Conversation) => void;
  onPin: (conversation: Conversation) => void;
  onDuplicate: (conversation: Conversation) => void;
  onArchive: (conversation: Conversation) => void;
  onShare: (conversation: Conversation) => void;
  onExport: (conversation: Conversation, format: "pdf" | "word") => void;
  onDelete: (conversation: Conversation) => void;
  onSearch: () => void;
  onWorkspace: (section: "files") => void;
  onSettings: () => void;
  onSupport: (topic: "faq" | "privacy" | "terms") => void;
  onLogout: () => void;
  accounts?: Array<{ id: string; name?: string | null; email?: string | null }>;
  onSwitchAccount?: (account: {
    id: string;
    name?: string | null;
    email?: string | null;
  }) => void;
  onAddAccount?: () => void;
  onRemoveAccount?: (account: {
    id: string;
    name?: string | null;
    email?: string | null;
  }) => void;
  switchingAccountId?: string | null;
  user: { id?: string | number; name?: string | null; email?: string | null };
  previewSupportOpen?: boolean;
}) {
  const pinned = conversations.filter(item => item.isPinned);
  const recent = conversations.filter(item => !item.isPinned);
  const compact = collapsed;
  const iconMotion = (label: string) =>
    ({
      "New chat":
        "group-hover:rotate-6 group-hover:scale-110 group-active:rotate-0",
      Search:
        "group-hover:translate-x-0.5 group-hover:scale-105 group-active:translate-x-0",
      Library:
        "group-hover:-translate-y-0.5 group-hover:rotate-3 group-active:translate-y-0",
    })[label] ?? "group-hover:scale-105";
  const railTip = (label: string) =>
    compact ? (
      <span
        aria-hidden
        className="pointer-events-none absolute left-full top-1/2 z-[70] ml-2 -translate-y-1/2 whitespace-nowrap rounded-md bg-foreground px-2 py-1 text-xs font-medium text-background opacity-0 shadow-md transition-opacity duration-150 group-hover:opacity-100 group-focus-visible:opacity-100 motion-reduce:transition-none"
      >
        {label}
      </span>
    ) : null;
  const utility = (
    label: string,
    icon: React.ReactNode,
    action: () => void
  ) => {
    return (
      <Button
        onClick={action}
        variant="ghost"
        className={cn(
          "group relative h-9 rounded-lg text-foreground/90 transition-[color,background-color,transform] duration-150 hover:bg-muted hover:text-foreground active:scale-[0.97]",
          compact ? "w-10 px-0" : "w-full justify-start gap-2 px-2"
        )}
      >
        <span
          className={cn(
            "transition-transform duration-150 ease-out motion-reduce:transform-none",
            iconMotion(label)
          )}
        >
          {icon}
        </span>
        <span className={compact ? "sr-only" : "text-sm font-semibold"}>
          {label}
        </span>
        {railTip(label)}
      </Button>
    );
  };

  return (
    <>
      {open && (
        <button
          onClick={onClose}
          className="fixed inset-0 z-40 bg-foreground/20 lg:hidden"
          aria-label="Close navigation"
        />
      )}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex flex-col border-r border-border bg-[oklch(0.975_0.002_80)] px-3 py-3 transition-[width,transform] duration-200 dark:bg-[oklch(0.17_0.003_80)] lg:static lg:translate-x-0",
          compact ? "w-16" : "w-[18.5rem]",
          open ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div
          className={cn(
            "relative flex items-center pb-4 pt-1",
            compact ? "justify-center" : "justify-between px-2"
          )}
        >
          {compact ? (
            <div className="group/brand relative hidden size-8 lg:block">
              <div className="size-8 overflow-hidden rounded-lg border border-border bg-card shadow-sm transition-all duration-150 group-hover/brand:scale-90 group-hover/brand:opacity-0 group-focus-within/brand:scale-90 group-focus-within/brand:opacity-0">
                <img
                  src="/KSEMOlogo.png"
                  alt="KSEMO logo"
                  className="size-full object-cover"
                />
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={onToggleCollapsed}
                className="absolute inset-0 size-8 rounded-xl opacity-0 transition-all duration-150 group-hover/brand:scale-100 group-hover/brand:opacity-100 group-focus-within/brand:scale-100 group-focus-within/brand:opacity-100 hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring active:scale-95"
                aria-label="Expand sidebar"
              >
                <ChevronsRight className="size-4" />
                <span
                  aria-hidden
                  className="pointer-events-none absolute left-full top-1/2 z-[70] ml-2 -translate-y-1/2 whitespace-nowrap rounded-md bg-foreground px-2 py-1 text-xs font-medium text-background opacity-0 shadow-md transition-opacity duration-150 group-hover/brand:opacity-100 group-focus-within/brand:opacity-100 motion-reduce:transition-none"
                >
                  Expand sidebar
                </span>
              </Button>
            </div>
          ) : (
            <div className="flex min-w-0 items-center gap-2.5">
              <div className="size-8 shrink-0 overflow-hidden rounded-lg border border-border bg-card shadow-sm">
                <img
                  src="/KSEMOlogo.png"
                  alt="KSEMO logo"
                  className="size-full object-cover"
                />
              </div>
              <span className="text-sm font-semibold tracking-[-0.02em]">
                KSEMO
              </span>
            </div>
          )}
          {!compact && (
            <Button
              variant="ghost"
              size="icon"
              onClick={onToggleCollapsed}
              className="hidden size-8 rounded-lg transition-transform duration-150 hover:bg-muted active:scale-95 lg:inline-flex"
              aria-label="Collapse sidebar"
            >
              <ChevronsLeft className="size-4" />
            </Button>
          )}
          {!compact && (
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              className="size-8 rounded-lg lg:hidden"
              aria-label="Close navigation"
            >
              <PanelLeftClose className="size-4" />
            </Button>
          )}
        </div>
        <div className="space-y-1">
          {utility("New chat", <SquarePen className="size-4" />, onNew)}
          {utility("Search", <Search className="size-4" />, onSearch)}
          {utility("Library", <Library className="size-4" />, () =>
            onWorkspace("files")
          )}
        </div>
        <nav
          className="mt-4 min-h-0 flex-1 overflow-y-auto"
          aria-label="Conversations"
        >
          {!compact && (
            <>
              {pinned.length > 0 && (
                <ConversationGroup
                  label="Pinned"
                  conversations={pinned}
                  activeConversationId={activeConversationId}
                  onSelect={onSelect}
                  onRename={onRename}
                  onPin={onPin}
                  onDuplicate={onDuplicate}
                  onArchive={onArchive}
                  onShare={onShare}
                  onExport={onExport}
                  onDelete={onDelete}
                />
              )}
              <ConversationGroup
                label="Recent"
                conversations={recent}
                activeConversationId={activeConversationId}
                onSelect={onSelect}
                onRename={onRename}
                onPin={onPin}
                onDuplicate={onDuplicate}
                onArchive={onArchive}
                onShare={onShare}
                onExport={onExport}
                onDelete={onDelete}
                emptyText="Your conversations will appear here."
              />
            </>
          )}
        </nav>
        <div className="mt-3 border-t border-border pt-3">
          <DropdownMenu open={previewSupportOpen || undefined}>
            <DropdownMenuTrigger asChild>
              <button
                className={cn(
                  "group relative flex w-full items-center rounded-xl py-2 text-left transition-colors hover:bg-muted focus-visible:ring-0 focus-visible:outline-none",
                  compact ? "justify-center" : "gap-2.5 px-2"
                )}
                aria-label="Open profile menu"
              >
                <span className="flex size-7 shrink-0 items-center justify-center rounded-lg border border-border bg-card text-[11px] font-semibold">
                  {user.name?.trim().charAt(0).toUpperCase() ?? "U"}
                </span>
                <span className={compact ? "sr-only" : "min-w-0 flex-1"}>
                  <span className="block truncate text-sm font-medium">
                    {user.name || "KSEMO user"}
                  </span>
                </span>
                {railTip("Account")}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              side={compact ? "right" : "top"}
              sideOffset={10}
              align={compact ? "end" : "start"}
              collisionPadding={12}
              className="w-60 rounded-2xl border-border/80 p-1.5 shadow-xl"
            >
              <div className="rounded-xl bg-muted/60 px-2.5 py-2.5">
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                  Logged in as
                </p>
                <p className="mt-1 truncate text-sm font-semibold">
                  {user.name || "KSEMO user"}
                </p>
                <p className="mt-0.5 truncate text-xs text-muted-foreground">
                  {user.email || "Account"}
                </p>
              </div>
              <DropdownMenuSeparator />
              <DropdownMenuSub>
                <DropdownMenuSubTrigger className="focus-visible:ring-0 focus-visible:outline-none">
                  <ArrowLeftRight className="mr-2 size-4" /> Switch account
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent
                  sideOffset={8}
                  collisionPadding={12}
                  className="w-60 rounded-2xl p-1.5"
                >
                  <p className="px-2.5 pb-1 pt-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                    Accounts ({accounts.length}/2)
                  </p>
                  {accounts.map(account => {
                    const selected = account.id === String(user.id) || account.email === user.email;
                    const switching = switchingAccountId === account.id;
                    return (
                      <DropdownMenuItem
                        key={account.id}
                        disabled={selected || switching}
                        onClick={() => onSwitchAccount?.(account)}
                        className="h-11 rounded-xl px-2.5 focus-visible:ring-0 focus-visible:outline-none"
                      >
                        <span className="mr-2.5 flex size-7 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-[10px] font-bold text-primary">
                          {switching ? (
                            <Loader2 className="size-3.5 animate-spin" />
                          ) : (
                            account.name?.trim().charAt(0).toUpperCase() || account.email?.charAt(0).toUpperCase() || "U"
                          )}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-xs font-semibold">{account.name || "KSEMO user"}</span>
                          <span className="block truncate text-[10px] text-muted-foreground">
                            {switching ? "Switching…" : account.email}
                          </span>
                        </span>
                        {selected ? (
                          <Check className="size-3.5 text-primary" aria-label="Current account" />
                        ) : switching ? null : (
                          <button
                            type="button"
                            onClick={event => {
                              event.stopPropagation();
                              onRemoveAccount?.(account);
                            }}
                            className="ml-1 rounded-md p-0.5 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                            aria-label={`Remove ${account.name || account.email}`}
                          >
                            <X className="size-3" />
                          </button>
                        )}
                      </DropdownMenuItem>
                    );
                  })}
                  {onAddAccount && (
                    <DropdownMenuItem onClick={onAddAccount} className="mt-1 h-9 rounded-xl text-xs font-medium focus-visible:ring-0 focus-visible:outline-none">
                      <Plus className="mr-2 size-3.5" /> Add account
                    </DropdownMenuItem>
                  )}
                </DropdownMenuSubContent>
              </DropdownMenuSub>
              <DropdownMenuItem onClick={onSettings} className="focus-visible:ring-0 focus-visible:outline-none">
                <Settings2 className="mr-2 size-4" /> Settings
              </DropdownMenuItem>
              <DropdownMenuSub open={previewSupportOpen || undefined}>
                <DropdownMenuSubTrigger className="focus-visible:ring-0 focus-visible:outline-none">
                   <Headset className="mr-2 size-4" />
                  Help &amp; Support
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent
                  sideOffset={8}
                  collisionPadding={12}
                  className="max-h-[calc(100dvh-1.5rem)] w-52 overflow-y-auto rounded-xl"
                >
                  <DropdownMenuItem onClick={() => onSupport("faq")} className="focus-visible:ring-0 focus-visible:outline-none">
                    <HelpCircle className="mr-2 size-4" />
                    FAQ
                    <ExternalLink className="ml-auto size-3.5 text-muted-foreground" />
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => onSupport("privacy")} className="focus-visible:ring-0 focus-visible:outline-none">
                    <ShieldCheck className="mr-2 size-4" />
                    Privacy Policy
                    <ExternalLink className="ml-auto size-3.5 text-muted-foreground" />
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => onSupport("terms")} className="focus-visible:ring-0 focus-visible:outline-none">
                    <FileText className="mr-2 size-4" />
                    Terms of Service
                    <ExternalLink className="ml-auto size-3.5 text-muted-foreground" />
                  </DropdownMenuItem>
                </DropdownMenuSubContent>
              </DropdownMenuSub>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={onLogout}
                className="text-destructive focus:text-destructive focus-visible:ring-0 focus-visible:outline-none"
              >
                <LogOut className="mr-2 size-4" /> Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </aside>
    </>
  );
}

function ConversationGroup({
  label,
  conversations,
  activeConversationId,
  onSelect,
  onRename,
  onPin,
  onDuplicate,
  onArchive,
  onShare,
  onExport,
  onDelete,
  emptyText,
}: {
  label: string;
  conversations: Conversation[];
  activeConversationId: string | null;
  onSelect: (id: string) => void;
  onRename: (conversation: Conversation) => void;
  onPin: (conversation: Conversation) => void;
  onDuplicate: (conversation: Conversation) => void;
  onArchive: (conversation: Conversation) => void;
  onShare: (conversation: Conversation) => void;
  onExport: (conversation: Conversation, format: "pdf" | "word") => void;
  onDelete: (conversation: Conversation) => void;
  emptyText?: string;
}) {
  const [expanded, setExpanded] = useState(true);
  return (
    <section className="mb-5">
      <button
        onClick={() => setExpanded(current => !current)}
        className="group flex items-center gap-1.5 px-2 py-1.5 text-left text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground"
        aria-expanded={expanded}
        data-disclosure-group={label.toLowerCase()}
      >
        {label}
        <span className="opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
          {expanded ? (
            <ChevronDown className="size-3.5" />
          ) : (
            <ChevronRight className="size-3.5" />
          )}
        </span>
      </button>
      {expanded && (
        <div className="mt-0.5 space-y-0.5">
          {conversations.map(conversation => (
            <div
              key={conversation.id}
              className={cn(
                "group flex items-center rounded-lg",
                activeConversationId === conversation.id
                  ? "bg-muted"
                  : "hover:bg-muted/70"
              )}
            >
              <button
                onClick={() => onSelect(conversation.id)}
                className="flex min-w-0 flex-1 items-center gap-2 truncate px-2.5 py-2 text-left text-[13px] leading-5"
              >
                <MessageCircle className="size-[18px] shrink-0 stroke-[2.4] text-foreground/85 transition-colors group-hover:text-foreground" />
                <span className="truncate">{conversation.title}</span>
              </button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="mr-1 size-7 rounded-md opacity-0 transition-opacity group-hover:opacity-100 focus:opacity-100 group-focus-within:opacity-100"
                    aria-label={`Actions for ${conversation.title}`}
                  >
                    <Ellipsis className="size-3.5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-44 rounded-xl">
                  <DropdownMenuItem onClick={() => onRename(conversation)}>
                    <Pencil className="mr-2 size-3.5" />
                    Rename
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => onPin(conversation)}>
                    <Pin className="mr-2 size-3.5" />
                    {conversation.isPinned ? "Unpin" : "Pin"}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => onShare(conversation)}>
                    <Share2 className="mr-2 size-3.5" />
                    Share
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => onArchive(conversation)}>
                    <Archive className="mr-2 size-3.5" />
                    Archive
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => onDuplicate(conversation)}>
                    <Copy className="mr-2 size-3.5" />
                    Duplicate
                  </DropdownMenuItem>
                  <DropdownMenuSub>
                    <DropdownMenuSubTrigger>
                      <Download className="mr-2 size-3.5" />
                      Export
                    </DropdownMenuSubTrigger>
                    <DropdownMenuSubContent className="ml-2 w-44 rounded-xl">
                      <DropdownMenuItem
                        onClick={() => onExport(conversation, "pdf")}
                      >
                        <FileText className="mr-2 size-3.5" />
                        Download PDF
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => onExport(conversation, "word")}
                      >
                        <FileText className="mr-2 size-3.5" />
                        Download Word
                      </DropdownMenuItem>
                    </DropdownMenuSubContent>
                  </DropdownMenuSub>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => onDelete(conversation)}
                    className="text-destructive focus:text-destructive"
                  >
                    <Trash2 className="mr-2 size-3.5" />
                    Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          ))}
          {!conversations.length && emptyText && (
            <p className="px-2 py-2 text-xs leading-5 text-muted-foreground">
              {emptyText}
            </p>
          )}
        </div>
      )}
    </section>
  );
}
