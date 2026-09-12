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
  ChevronDown,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Copy,
  CopyPlus,
  Download,
  Ellipsis,
  ExternalLink,
  FileText,
  HelpCircle,
  Library,
  Headset,
  LogOut,
  MessageCircle,
  PanelLeftClose,
  Pencil,
  Pin,
  Search,
  Settings2,
  ShieldCheck,
  SquarePen,
  Trash2,
} from "lucide-react";
import { ShareIcon } from "./icons";
import { PdfFileIcon, WordFileIcon } from "./FileBrandIcons";
import React, { memo, useMemo, useRef, useState } from "react";

type Conversation = {
  id: string;
  title: string;
  isPinned: boolean;
  isArchived: boolean;
  isPublic?: boolean;
  shareToken?: string | null;
};

export const ConversationSidebar = memo(function ConversationSidebar({
  conversations,
  activeConversationId,
  open,
  collapsed,
  onClose,
  onToggleCollapsed,
  onNew,
  onSelect,
  onRename,
  onRenameSubmit,
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
  onRenameSubmit: (id: string, title: string) => void;
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
  user: { id?: string | number; name?: string | null; email?: string | null };
  previewSupportOpen?: boolean;
}) {
  const pinned = useMemo(
    () => conversations.filter(item => item.isPinned),
    [conversations]
  );
  const recent = useMemo(
    () => conversations.filter(item => !item.isPinned),
    [conversations]
  );
  const compact = collapsed;

  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  const startRename = (conversation: Conversation) => {
    setRenamingId(conversation.id);
    setRenameValue(conversation.title);
  };
  const confirmRename = () => {
    if (!renamingId) return;
    const title = renameValue.trim();
    if (title) onRenameSubmit(renamingId, title);
    setRenamingId(null);
    setRenameValue("");
  };
  const cancelRename = () => {
    setRenamingId(null);
    setRenameValue("");
  };

  const asideRef = useRef<HTMLElement>(null);
  const navRef = useRef<HTMLElement>(null);

  const iconMotion = (label: string) =>
    ({
      "New chat":
        "group-hover:rotate-6 group-hover:scale-110 group-active:rotate-0",
      Search:
        "group-hover:translate-x-0.5 group-hover:scale-105 group-active:translate-x-0",
      Library:
        "group-hover:-translate-y-0.5 group-hover:rotate-3 group-active:translate-y-0",
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
          "group relative h-9 rounded-lg text-foreground/90 transition-[color,background-color,transform] duration-150 hover:bg-sidebar-accent hover:text-foreground active:scale-[0.97]",
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
        <TooltipContent side="right" sideOffset={8} collisionPadding={12}>
          {label}
        </TooltipContent>
      </Tooltip>
    ) : (
      button
    );
  };
  const accountButton = (
    <button
      className={cn(
        "group relative flex w-full items-center rounded-xl py-2 text-left transition-colors hover:bg-sidebar-accent focus-visible:ring-0 focus-visible:outline-none",
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
    </button>
  );

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
        ref={asideRef}
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex flex-col border-r border-border bg-sidebar px-3 py-3 transition-[width,transform] duration-200 lg:static lg:translate-x-0",
          compact ? "w-16" : "w-[17.25rem]",
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
                    className="absolute inset-0 size-8 rounded-xl opacity-0 transition-all duration-150 group-hover/brand:scale-100 group-hover/brand:opacity-100 group-focus-within/brand:scale-100 group-focus-within/brand:opacity-100 hover:bg-sidebar-accent active:scale-95"
                    aria-label="Expand sidebar"
                  >
                    <ChevronsRight className="size-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="right" sideOffset={8} collisionPadding={12}>
                  Expand sidebar
                </TooltipContent>
              </Tooltip>
            </div>
          ) : (
            <span className="min-w-0 truncate text-lg font-semibold tracking-[-0.02em]">
              KSEMO
            </span>
          )}
          {!compact && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={onToggleCollapsed}
                  className="hidden size-8 rounded-lg transition-transform duration-150 hover:bg-sidebar-accent active:scale-95 lg:inline-flex"
                  aria-label="Collapse sidebar"
                >
                  <ChevronsLeft className="size-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">Collapse sidebar</TooltipContent>
            </Tooltip>
          )}
          {!compact && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={onClose}
                  className="size-8 rounded-lg text-muted-foreground outline-none hover:bg-sidebar-accent hover:text-foreground focus-visible:ring-0 focus-visible:border-transparent lg:hidden"
                  aria-label="Close navigation"
                >
                  <PanelLeftClose className="size-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">Close sidebar</TooltipContent>
            </Tooltip>
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
          ref={navRef}
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
                  openMenuId={openMenuId}
                  onMenuOpenChange={setOpenMenuId}
                  onSelect={onSelect}
                  onRename={onRename}
                  renamingId={renamingId}
                  renameValue={renameValue}
                  onStartRename={startRename}
                  onRenameValueChange={setRenameValue}
                  onConfirmRename={confirmRename}
                  onCancelRename={cancelRename}
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
                openMenuId={openMenuId}
                onMenuOpenChange={setOpenMenuId}
                onSelect={onSelect}
                onRename={onRename}
                renamingId={renamingId}
                renameValue={renameValue}
                onStartRename={startRename}
                onRenameValueChange={setRenameValue}
                onConfirmRename={confirmRename}
                onCancelRename={cancelRename}
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
            {compact ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <DropdownMenuTrigger asChild>{accountButton}</DropdownMenuTrigger>
                </TooltipTrigger>
                <TooltipContent side="right" sideOffset={8} collisionPadding={12}>
                  Account
                </TooltipContent>
              </Tooltip>
            ) : (
              <DropdownMenuTrigger asChild>{accountButton}</DropdownMenuTrigger>
            )}
            <DropdownMenuContent
              side={compact ? "right" : "top"}
              sideOffset={10}
              align={compact ? "end" : "start"}
              collisionPadding={12}
              className="max-h-[calc(100dvh-1.5rem)] w-60 overflow-y-auto rounded-2xl border-border/80 p-1.5 shadow-xl"
            >
              <div className="px-2.5 py-2.5">
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                  Logged in as
                </p>
                <p className="mt-0.5 truncate text-sm font-semibold">
                  {user.name || "KSEMO user"}
                </p>
                <p className="mt-0.5 truncate text-xs text-muted-foreground">
                  {user.email || "Account"}
                </p>
              </div>
              <DropdownMenuItem
                onClick={onSettings}
                className="focus-visible:ring-0 focus-visible:outline-none"
              >
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
                  <DropdownMenuItem
                    onClick={() => onSupport("faq")}
                    className="focus-visible:ring-0 focus-visible:outline-none"
                  >
                    <HelpCircle className="mr-2 size-4" />
                    FAQ
                    <ExternalLink className="ml-auto size-3.5 text-muted-foreground" />
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => onSupport("privacy")}
                    className="focus-visible:ring-0 focus-visible:outline-none"
                  >
                    <ShieldCheck className="mr-2 size-4" />
                    Privacy Policy
                    <ExternalLink className="ml-auto size-3.5 text-muted-foreground" />
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => onSupport("terms")}
                    className="focus-visible:ring-0 focus-visible:outline-none"
                  >
                    <FileText className="mr-2 size-4" />
                    Terms of Service
                    <ExternalLink className="ml-auto size-3.5 text-muted-foreground" />
                  </DropdownMenuItem>
                </DropdownMenuSubContent>
              </DropdownMenuSub>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={onLogout}
                variant="destructive"
              >
                <LogOut className="mr-2 size-4" /> Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </aside>
    </>
  );
});

const ConversationGroup = memo(function ConversationGroup({
  label,
  conversations,
  activeConversationId,
  onSelect,
  onRename,
  renamingId,
  renameValue,
  onStartRename,
  onRenameValueChange,
  onConfirmRename,
  onCancelRename,
  onPin,
  onDuplicate,
  onArchive,
  onShare,
  onExport,
  onDelete,
  emptyText,
  openMenuId,
  onMenuOpenChange,
}: {
  label: string;
  conversations: Conversation[];
  activeConversationId: string | null;
  onSelect: (id: string) => void;
  onRename: (conversation: Conversation) => void;
  renamingId: string | null;
  renameValue: string;
  onStartRename: (conversation: Conversation) => void;
  onRenameValueChange: (value: string) => void;
  onConfirmRename: () => void;
  onCancelRename: () => void;
  onPin: (conversation: Conversation) => void;
  onDuplicate: (conversation: Conversation) => void;
  onArchive: (conversation: Conversation) => void;
  onShare: (conversation: Conversation) => void;
  onExport: (conversation: Conversation, format: "pdf" | "word") => void;
  onDelete: (conversation: Conversation) => void;
  emptyText?: string;
  openMenuId?: string | null;
  onMenuOpenChange?: (id: string | null) => void;
}) {
  const [expanded, setExpanded] = useState(true);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [localOpenMenuId, setLocalOpenMenuId] = useState<string | null>(null);
  const currentOpenMenuId =
    openMenuId !== undefined ? openMenuId : localOpenMenuId;
  const handleMenuOpenChange = onMenuOpenChange ?? setLocalOpenMenuId;
  return (
    <section className="mb-5">
      <button
        type="button"
        onClick={() => setExpanded(current => !current)}
        className="group flex w-full items-center gap-1.5 px-2 py-1.5 text-left text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground cursor-pointer select-none"
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
          {conversations.map(conversation => {
            const isRowActive = activeConversationId === conversation.id;
            const isHovered = hoveredId === conversation.id;
            const isMenuOpen = currentOpenMenuId === conversation.id;
            const isRenaming = renamingId === conversation.id;
            return (
              <div
                key={conversation.id}
                onMouseEnter={() => setHoveredId(conversation.id)}
                onMouseLeave={() => setHoveredId(null)}
                className={cn(
                  "group flex items-center rounded-lg pr-0",
                  (isRowActive || isHovered || isMenuOpen) &&
                    !isRenaming &&
                    "bg-sidebar-accent"
                )}
              >
                {isRenaming ? (
                  <ConversationInlineRename
                    value={renameValue}
                    onChange={onRenameValueChange}
                    onSave={() => {
                      if (renameValue.trim()) onConfirmRename();
                    }}
                    onCancel={onCancelRename}
                  />
                ) : (
                  <>
                    <ConversationTitleButton
                      conversation={conversation}
                      onSelect={onSelect}
                      isRowHovered={isHovered || isMenuOpen}
                    />
                    <ConversationActionsMenu
                      conversation={conversation}
                      isMenuOpen={isMenuOpen}
                      onMenuOpenChange={open =>
                        handleMenuOpenChange(open ? conversation.id : null)
                      }
                      onRename={() => onStartRename(conversation)}
                      onPin={onPin}
                      onDuplicate={onDuplicate}
                      onArchive={onArchive}
                      onShare={onShare}
                      onExport={onExport}
                      onDelete={onDelete}
                    />
                  </>
                )}
              </div>
            );
          })}
          {!conversations.length && emptyText && (
            <p className="px-2 py-2 text-xs leading-5 text-muted-foreground">
              {emptyText}
            </p>
          )}
        </div>
      )}
    </section>
  );
});

const ConversationInlineRename = memo(function ConversationInlineRename({
  value,
  onChange,
  onSave,
  onCancel,
}: {
  value: string;
  onChange: (value: string) => void;
  onSave: () => void;
  onCancel: () => void;
}) {
  const placeCaretAtEnd = (event: React.FocusEvent<HTMLInputElement>) => {
    const input = event.currentTarget;
    requestAnimationFrame(() => {
      const end = input.value.length;
      input.setSelectionRange(end, end);
      input.scrollLeft = input.scrollWidth;
    });
  };
  return (
    <div className="flex min-w-0 flex-1 items-center gap-2 self-stretch py-2 pl-1 pr-0">
      <MessageCircle className="size-[20px] shrink-0 text-foreground/70" />
      <input
        autoFocus
        value={value}
        onChange={event => onChange(event.target.value)}
        onFocus={placeCaretAtEnd}
        onBlur={() => onSave()}
        onKeyDown={event => {
          if (event.key === "Enter") {
            event.preventDefault();
            onSave();
          }
          if (event.key === "Escape") onCancel();
        }}
        aria-label="Rename conversation"
        className="min-w-0 flex-1 bg-transparent text-sm font-medium text-foreground caret-foreground outline-none placeholder:text-muted-foreground"
      />
    </div>
  );
});

const ConversationActionsMenu = memo(function ConversationActionsMenu({
  conversation,
  isMenuOpen,
  onMenuOpenChange,
  onRename,
  onPin,
  onDuplicate,
  onArchive,
  onShare,
  onExport,
  onDelete,
}: {
  conversation: Conversation;
  isMenuOpen: boolean;
  onMenuOpenChange: (open: boolean) => void;
  onRename: (conversation: Conversation) => void;
  onPin: (conversation: Conversation) => void;
  onDuplicate: (conversation: Conversation) => void;
  onArchive: (conversation: Conversation) => void;
  onShare: (conversation: Conversation) => void;
  onExport: (conversation: Conversation, format: "pdf" | "word") => void;
  onDelete: (conversation: Conversation) => void;
}) {
  return (
    <DropdownMenu open={isMenuOpen} onOpenChange={onMenuOpenChange}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className={cn(
            "size-8 shrink-0 rounded-md text-muted-foreground opacity-0 ml-0 mr-1.5",
            "transition-[opacity,background-color,color] duration-150",
            "group-hover:opacity-100 group-hover:text-foreground",
            "hover:bg-accent hover:text-foreground",
            "data-[state=open]:bg-accent data-[state=open]:opacity-100"
          )}
          aria-label={`Actions for ${conversation.title}`}
        >
          <Ellipsis className="size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        sideOffset={4}
        collisionPadding={8}
        className="w-44 rounded-xl"
      >
        <DropdownMenuItem onClick={() => onRename(conversation)}>
          <Pencil className="mr-2 size-4" />
          Rename
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => onPin(conversation)}>
          <Pin className="mr-2 size-4" />
          {conversation.isPinned ? "Unpin" : "Pin"}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => onShare(conversation)}>
          <ShareIcon className="mr-2 size-4" />
          Share
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => onArchive(conversation)}>
          <Archive className="mr-2 size-4" />
          Archive
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => onDuplicate(conversation)}>
          <CopyPlus className="mr-2 size-4" />
          Duplicate
        </DropdownMenuItem>
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>
            <Download className="mr-2 size-4" />
            Export
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent
            sideOffset={6}
            collisionPadding={12}
            className="w-44 rounded-xl"
          >
            <DropdownMenuItem onClick={() => onExport(conversation, "pdf")}>
              <PdfFileIcon className="mr-2 size-5" />
              Download PDF
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onExport(conversation, "word")}>
              <WordFileIcon className="mr-2 size-5" />
              Download Word
            </DropdownMenuItem>
          </DropdownMenuSubContent>
        </DropdownMenuSub>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={() => onDelete(conversation)}
          variant="destructive"
        >
          <Trash2 className="mr-2 size-4" />
          Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
});

const ConversationTitleButton = memo(function ConversationTitleButton({
  conversation,
  onSelect,
  isRowHovered,
}: {
  conversation: Conversation;
  onSelect: (id: string) => void;
  isRowHovered: boolean;
}) {
  const titleRef = useRef<HTMLSpanElement>(null);
  const fullTitle = conversation.title;
  const [displayTitle, setDisplayTitle] = useState(fullTitle);
  const [wasTruncated, setWasTruncated] = useState(false);
  const [isOverflowing, setIsOverflowing] = useState(false);
  const [showTooltip, setShowTooltip] = useState(false);

  // Word-safe truncation: the title is shortened to COMPLETE words that fit the
  // available width, with "…" appended. A word is never visually cut in half.
  React.useEffect(() => {
    const el = titleRef.current;
    if (!el) return;

    const compute = () => {
      const words = fullTitle.trim().split(/\s+/).filter(Boolean);
      if (!words.length) {
        setDisplayTitle("");
        setWasTruncated(false);
        setIsOverflowing(false);
        return;
      }

      el.textContent = fullTitle;
      const available = el.clientWidth;

      let truncated = fullTitle;
      let overflowed = false;
      if (el.scrollWidth > available) {
        overflowed = true;
        let n = words.length;
        while (n > 1 && el.scrollWidth > available) {
          n -= 1;
          truncated = words.slice(0, n).join(" ");
          el.textContent = truncated;
        }
      }

      el.textContent = truncated;
      setDisplayTitle(words.length === 1 && overflowed ? "…" : overflowed ? truncated + "…" : truncated);
      setWasTruncated(overflowed);
      setIsOverflowing(el.scrollWidth > el.clientWidth);
    };

    compute();

    const resizeObserver = new ResizeObserver(compute);
    resizeObserver.observe(el);

    return () => resizeObserver.disconnect();
  }, [fullTitle]);

  const handleMouseEnter = () => {
    if (wasTruncated) {
      setShowTooltip(true);
    }
  };

  const handleMouseLeave = () => {
    setShowTooltip(false);
  };

  return (
    <button
      onClick={() => onSelect(conversation.id)}
      aria-label={conversation.title}
      className="flex min-w-0 flex-1 items-center gap-2 self-stretch py-2 pl-1 pr-0 text-left text-sm leading-5"
    >
      <MessageCircle className="size-[20px] shrink-0 text-foreground/70 transition-colors group-hover:text-foreground" />
      <Tooltip open={showTooltip}>
        <TooltipTrigger asChild>
          <span
            ref={titleRef}
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
            className={cn(
              "min-w-0 flex-1 overflow-hidden whitespace-nowrap cursor-pointer transition-[mask-image] duration-150",
              isRowHovered && wasTruncated && [
                "[-webkit-mask-image:linear-gradient(to_right,black_calc(100%_-_36px),transparent_100%)]",
                "[mask-image:linear-gradient(to_right,black_calc(100%_-_36px),transparent_100%)]"
              ]
            )}
          >
            {displayTitle}
          </span>
        </TooltipTrigger>
        {wasTruncated && (
          <TooltipContent 
            side="right" 
            sideOffset={35} 
            collisionPadding={40}
            className="min-w-[80px] max-w-[150px] break-words whitespace-pre-wrap leading-tight px-2.5 py-1.5"
          >
            {fullTitle}
          </TooltipContent>
        )}
      </Tooltip>
    </button>
  );
});
