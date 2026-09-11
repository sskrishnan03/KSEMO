import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  FolderOpen,
  Menu,
  MoreHorizontal,
  Pin,
  Trash2,
} from "lucide-react";
import { ShareIcon } from "./icons";
import React, { memo } from "react";

export type MobileChatNavBarConversation = {
  id: string;
  title: string;
  isPinned?: boolean;
  isPublic?: boolean;
  shareToken?: string | null;
};

export type MobileChatNavBarProps = {
  conversation: MobileChatNavBarConversation | null;
  activeConversationId: string | null;
  onOpenSidebar: () => void;
  onPin: (conversation: { id: string; isPinned: boolean }) => void;
  onShare: (conversation: {
    id: string;
    title: string;
    isPublic?: boolean;
    shareToken?: string | null;
  }) => void;
  onViewFiles: () => void;
  onDelete: (conversation: { id: string; title: string }) => void;
};

export const MobileChatNavBar = memo(function MobileChatNavBar({
  conversation,
  activeConversationId,
  onOpenSidebar,
  onPin,
  onShare,
  onViewFiles,
  onDelete,
}: MobileChatNavBarProps) {
  const isPinned = Boolean(conversation?.isPinned);

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

      {/* Center is clean without title or name */}
      <div className="flex-1" />

      <div className="flex size-9 shrink-0 items-center justify-center">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="size-9 rounded-xl text-foreground hover:bg-accent focus-visible:ring-0"
              aria-label="Chat actions"
              data-testid="mobile-chat-actions-trigger"
            >
              <MoreHorizontal className="size-5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            sideOffset={6}
            collisionPadding={8}
            className="w-44 rounded-xl shadow-lg"
            data-testid="mobile-chat-actions-content"
          >
            <DropdownMenuItem
              disabled={!activeConversationId}
              onClick={() => {
                if (activeConversationId) {
                  onPin({
                    id: activeConversationId,
                    isPinned,
                  });
                }
              }}
              data-testid="mobile-action-pin"
            >
              <Pin className="mr-2 size-4" />
              {isPinned ? "Unpin" : "Pin"}
            </DropdownMenuItem>
            <DropdownMenuItem
              disabled={!activeConversationId}
              onClick={() => {
                if (activeConversationId) {
                  onShare(
                    conversation
                      ? {
                          id: activeConversationId,
                          title: conversation.title,
                          isPublic: conversation.isPublic,
                          shareToken: conversation.shareToken,
                        }
                      : {
                          id: activeConversationId,
                          title: "this conversation",
                        }
                  );
                }
              }}
              data-testid="mobile-action-share"
            >
              <ShareIcon className="mr-2 size-4" />
              Share
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={onViewFiles}
              data-testid="mobile-action-files"
            >
              <FolderOpen className="mr-2 size-4" />
              View files
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              disabled={!activeConversationId}
              variant="destructive"
              onClick={() => {
                if (activeConversationId) {
                  onDelete({
                    id: activeConversationId,
                    title: conversation?.title ?? "this conversation",
                  });
                }
              }}
              data-testid="mobile-action-delete"
            >
              <Trash2 className="mr-2 size-4" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
});
