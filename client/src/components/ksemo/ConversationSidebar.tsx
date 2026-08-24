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
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import {
  Archive,
  Brain,
  ChevronDown,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Copy,
  Download,
  Ellipsis,
  Eraser,
  ExternalLink,
  FileText,
  HelpCircle,
  Library,
  LogOut,
  MessageCircle,
  PanelLeftClose,
  Pencil,
  Pin,
  Search,
  Settings2,
  Share2,
  ShieldCheck,
  SquarePen,
  Trash2,
} from "lucide-react";
import React, { useState } from "react";

type Conversation = {
  id: string;
  title: string;
  isPinned: boolean;
  isArchived: boolean;
  isPublic?: boolean;
  shareToken?: string | null;
  memoryDisabled?: boolean;
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
  onToggleMemory,
  onClearConversationMemory,
  onSettings,
  onSupport,
  onLogout,
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
  onWorkspace: (section: "files" | "memories") => void;
  onToggleMemory?: (conversation: Conversation) => void;
  onClearConversationMemory?: (conversation: Conversation) => void;
  onSettings: () => void;
  onSupport: (topic: "faq" | "privacy" | "terms") => void;
  onLogout: () => void;
  user: { name?: string | null; email?: string | null };
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
      Memory:
        "group-hover:scale-110 group-hover:-rotate-3 group-active:rotate-0",
    })[label] ?? "group-hover:scale-105";
  const utility = (
    label: string,
    icon: React.ReactNode,
    action: () => void
  ) => {
    const button = (
      <Button
        onClick={action}
        variant="ghost"
        className={cn(
          "group h-9 rounded-lg text-foreground/90 transition-[color,background-color,transform] duration-150 hover:bg-muted hover:text-foreground active:scale-[0.97]",
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
      </Button>
    );
    return compact ? (
      <Tooltip>
        <TooltipTrigger asChild>{button}</TooltipTrigger>
        <TooltipContent side="right">{label}</TooltipContent>
      </Tooltip>
    ) : (
      button
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
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={onToggleCollapsed}
                    className="absolute inset-0 size-8 rounded-xl opacity-0 transition-all duration-150 group-hover/brand:scale-100 group-hover/brand:opacity-100 group-focus-within/brand:scale-100 group-focus-within/brand:opacity-100 hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring active:scale-95"
                    aria-label="Expand sidebar"
                  >
                    <ChevronsRight className="size-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="right" sideOffset={10}>
                  Expand sidebar
                </TooltipContent>
              </Tooltip>
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
          {utility("Memory", <Brain className="size-4" />, () =>
            onWorkspace("memories")
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
                  onToggleMemory={onToggleMemory}
                  onClearConversationMemory={onClearConversationMemory}
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
                onToggleMemory={onToggleMemory}
                onClearConversationMemory={onClearConversationMemory}
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
                  "flex w-full items-center rounded-xl py-2 text-left transition-colors hover:bg-muted",
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
                  <span className="block truncate text-[11px] text-muted-foreground">
                    {user.email || "Signed in"}
                  </span>
                </span>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              side={compact ? "right" : "top"}
              sideOffset={10}
              align={compact ? "end" : "start"}
              collisionPadding={12}
              className="w-52 rounded-xl"
            >
              <div className="px-2 py-2">
                <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
                  Logged in as
                </p>
                <p className="mt-0.5 truncate text-xs font-medium">
                  {user.name || "KSEMO user"}
                </p>
              </div>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={onSettings}>
                <Settings2 className="mr-2 size-4" /> Settings
              </DropdownMenuItem>
              <DropdownMenuSub open={previewSupportOpen || undefined}>
                <DropdownMenuSubTrigger>
                  <HelpCircle className="mr-2 size-4" />
                  Help &amp; Support
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent
                  sideOffset={8}
                  collisionPadding={12}
                  className="max-h-[calc(100dvh-1.5rem)] w-52 overflow-y-auto rounded-xl"
                >
                  <DropdownMenuItem onClick={() => onSupport("faq")}>
                    <HelpCircle className="mr-2 size-4" />
                    FAQ
                    <ExternalLink className="ml-auto size-3.5 text-muted-foreground" />
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => onSupport("privacy")}>
                    <ShieldCheck className="mr-2 size-4" />
                    Privacy Policy
                    <ExternalLink className="ml-auto size-3.5 text-muted-foreground" />
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => onSupport("terms")}>
                    <FileText className="mr-2 size-4" />
                    Terms of Service
                    <ExternalLink className="ml-auto size-3.5 text-muted-foreground" />
                  </DropdownMenuItem>
                </DropdownMenuSubContent>
              </DropdownMenuSub>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={onLogout}
                className="text-destructive focus:text-destructive"
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
  onToggleMemory,
  onClearConversationMemory,
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
  onToggleMemory?: (conversation: Conversation) => void;
  onClearConversationMemory?: (conversation: Conversation) => void;
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
                  {onToggleMemory && (
                    <DropdownMenuItem onClick={() => onToggleMemory(conversation)}>
                      <Brain className="mr-2 size-3.5" />
                      {conversation.memoryDisabled
                        ? "Use memory for this chat"
                        : "Don't use memory for this chat"}
                    </DropdownMenuItem>
                  )}
                  {onClearConversationMemory && (
                    <DropdownMenuItem
                      onClick={() => onClearConversationMemory(conversation)}
                    >
                      <Eraser className="mr-2 size-3.5" />
                      Delete conversation memory
                    </DropdownMenuItem>
                  )}
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
