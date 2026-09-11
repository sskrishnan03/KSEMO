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
  Archive,
  CopyPlus,
  Download,
  FolderOpen,
  Menu,
  MoreHorizontal,
  Pencil,
  Pin,
  Trash2,
} from "lucide-react";
import { ShareIcon } from "./icons";
import { PdfFileIcon, WordFileIcon } from "./FileBrandIcons";
import React, { memo } from "react";

export type MobileChatNavBarConversation = {
  id: string;
  title: string;
  isPinned?: boolean;
  isArchived?: boolean;
  isPublic?: boolean;
  shareToken?: string | null;
};

export type MobileChatNavBarProps = {
  conversation: MobileChatNavBarConversation | null;
  activeConversationId: string | null;
  onOpenSidebar: () => void;
  onRename: (conversation: { id: string; title: string }) => void;
  onPin: (conversation: { id: string; isPinned: boolean }) => void;
  onShare: (conversation: {
    id: string;
    title: string;
    isPublic?: boolean;
    shareToken?: string | null;
  }) => void;
  onArchive: (conversation: { id: string }) => void;
  onDuplicate: (conversation: { id: string }) => void;
  onExport: (conversation: { id: string }, format: "pdf" | "word") => void;
  onViewFiles: () => void;
  onDelete: (conversation: { id: string; title: string }) => void;
};

export const MobileChatNavBar = memo(function MobileChatNavBar({
  conversation,
  activeConversationId,
  onOpenSidebar,
  onRename,
  onPin,
  onShare,
  onArchive,
  onDuplicate,
  onExport,
  onViewFiles,
  onDelete,
}: MobileChatNavBarProps) {
  const isRecentChat = Boolean(activeConversationId && conversation);

  return (
    <header
      data-testid="mobile-chat-navbar"
      className="sticky top-0 z-20 flex h-14 w-full shrink-0 items-center justify-between border-b border-border/40 bg-background/95 px-3 backdrop-blur supports-[backdrop-filter]:bg-background/80 lg:hidden"
    >
      <Button
        variant="ghost"
        size="icon"
        onClick={onOpenSidebar}
        className="size-9 shrink-0 rounded-xl text-foreground hover:bg-accent focus-visible:ring-0"
        aria-label="Open conversations"
        data-testid="mobile-sidebar-toggle"
      >
        <Menu className="size-5" />
      </Button>

      <div className="flex min-w-0 flex-1 items-center justify-center px-2">
        <span
          data-testid="mobile-chat-title"
          className="truncate text-center text-sm font-semibold tracking-[-0.01em] text-foreground"
        >
          {isRecentChat ? conversation?.title : "New chat"}
        </span>
      </div>

      <div className="flex size-9 shrink-0 items-center justify-center">
        {isRecentChat && conversation ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="size-9 rounded-xl text-foreground hover:bg-accent focus-visible:ring-0"
                aria-label={`Actions for ${conversation.title}`}
                data-testid="mobile-chat-actions-trigger"
              >
                <MoreHorizontal className="size-5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              sideOffset={6}
              collisionPadding={8}
              className="w-48 rounded-xl shadow-lg"
              data-testid="mobile-chat-actions-content"
            >
              <DropdownMenuItem
                onClick={() => onRename(conversation)}
                data-testid="mobile-action-rename"
              >
                <Pencil className="mr-2 size-4" />
                Rename
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() =>
                  onPin({
                    id: conversation.id,
                    isPinned: Boolean(conversation.isPinned),
                  })
                }
                data-testid="mobile-action-pin"
              >
                <Pin className="mr-2 size-4" />
                {conversation.isPinned ? "Unpin" : "Pin"}
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => onShare(conversation)}
                data-testid="mobile-action-share"
              >
                <ShareIcon className="mr-2 size-4" />
                Share
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => onArchive(conversation)}
                data-testid="mobile-action-archive"
              >
                <Archive className="mr-2 size-4" />
                Archive
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => onDuplicate(conversation)}
                data-testid="mobile-action-duplicate"
              >
                <CopyPlus className="mr-2 size-4" />
                Duplicate
              </DropdownMenuItem>
              <DropdownMenuSub>
                <DropdownMenuSubTrigger data-testid="mobile-action-export">
                  <Download className="mr-2 size-4" />
                  Export
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent
                  sideOffset={6}
                  collisionPadding={12}
                  className="w-44 rounded-xl"
                >
                  <DropdownMenuItem
                    onClick={() => onExport(conversation, "pdf")}
                    data-testid="mobile-action-export-pdf"
                  >
                    <PdfFileIcon className="mr-2 size-5" />
                    Download PDF
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => onExport(conversation, "word")}
                    data-testid="mobile-action-export-word"
                  >
                    <WordFileIcon className="mr-2 size-5" />
                    Download Word
                  </DropdownMenuItem>
                </DropdownMenuSubContent>
              </DropdownMenuSub>
              <DropdownMenuItem
                onClick={onViewFiles}
                data-testid="mobile-action-files"
              >
                <FolderOpen className="mr-2 size-4" />
                View files
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                variant="destructive"
                onClick={() =>
                  onDelete({ id: conversation.id, title: conversation.title })
                }
                data-testid="mobile-action-delete"
              >
                <Trash2 className="mr-2 size-4" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null}
      </div>
    </header>
  );
});
