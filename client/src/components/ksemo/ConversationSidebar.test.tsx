import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { TooltipProvider } from "@/components/ui/tooltip";
import {
  ConversationSidebar,
  ConversationActionsMenu,
  ConversationActionsMenuItems,
  MobileExportMenuItems,
  MobileSupportMenuItems,
} from "./ConversationSidebar";

function renderWithTooltip(element: React.ReactElement) {
  return renderToStaticMarkup(createElement(TooltipProvider, null, element));
}

import * as DropdownMenuPrimitive from "@radix-ui/react-dropdown-menu";

function renderInMenu(element: React.ReactElement) {
  return renderToStaticMarkup(
    createElement(
      DropdownMenuPrimitive.Root,
      { open: true },
      createElement(DropdownMenuPrimitive.Content, null, element)
    )
  );
}

describe("KSEMO conversation sidebar disclosure", () => {
  it("renders label-adjacent Pinned and Conversations disclosure controls without conversation counts", () => {
    const markup = renderWithTooltip(
      createElement(ConversationSidebar, {
        conversations: [
          {
            id: "conversation-pinned",
            title: "Pinned work",
            isPinned: true,
            isArchived: false,
          },
          {
            id: "conversation-recent",
            title: "Recent work",
            isPinned: false,
            isArchived: false,
          },
        ],
        activeConversationId: null,
        open: true,
        collapsed: false,
        onClose: () => undefined,
        onToggleCollapsed: () => undefined,
        onNew: () => undefined,
        onSelect: () => undefined,
        onRename: () => undefined,
        onRenameSubmit: () => undefined,
        onPin: () => undefined,
        onArchive: () => undefined,
        onShare: () => undefined,
        onExport: () => undefined,
        onDelete: () => undefined,
        onSearch: () => undefined,
        onWorkspace: () => undefined,
        onSettings: () => undefined,
        onSupport: () => undefined,
        onLogout: () => undefined,
        user: { name: "KSEMO user", email: "user@example.com" },
      })
    );
    expect(markup).toContain('data-disclosure-group="pinned"');
    expect(markup).toContain('data-disclosure-group="conversations"');
    expect(markup).toContain("w-full");
    expect(markup).toContain("cursor-pointer");
    expect(markup).toContain("lucide-message-circle");
    expect(markup).not.toContain("bg-muted-foreground/10");
    expect(markup).toContain("lucide-square-pen");
    expect(markup).not.toContain(">Tasks<");
    expect(markup).not.toContain("lucide-list-todo");
    expect(markup).not.toContain("data-conversation-count");
  });

  it("renders an accessible expand control inside the collapsed brand exchange", () => {
    const markup = renderWithTooltip(
      createElement(ConversationSidebar, {
        conversations: [],
        activeConversationId: null,
        open: true,
        collapsed: true,
        onClose: () => undefined,
        onToggleCollapsed: () => undefined,
        onNew: () => undefined,
        onSelect: () => undefined,
        onRename: () => undefined,
        onRenameSubmit: () => undefined,
        onPin: () => undefined,
        onArchive: () => undefined,
        onShare: () => undefined,
        onExport: () => undefined,
        onDelete: () => undefined,
        onSearch: () => undefined,
        onWorkspace: () => undefined,
        onSettings: () => undefined,
        onSupport: () => undefined,
        onLogout: () => undefined,
        user: { name: "KSEMO user", email: "user@example.com" },
      })
    );
    expect(markup).toContain('aria-label="Expand sidebar"');
    expect(markup).toContain("group/brand");
    expect(markup).toContain("group-focus-within/brand");
  });

  it("renders mobile Help & Support options with all three choices (FAQ, Privacy Policy, Terms of Service)", () => {
    const markup = renderInMenu(
      createElement(MobileSupportMenuItems, {
        onSupport: () => undefined,
      })
    );
    expect(markup).toContain('data-testid="mobile-support-menu-items"');
    expect(markup).toContain("FAQ");
    expect(markup).toContain("Privacy Policy");
    expect(markup).toContain("Terms of Service");
    expect(markup).toContain("lucide-circle-help");
    expect(markup).toContain("lucide-shield-check");
    expect(markup).toContain("lucide-file-text");
    expect(markup).toContain("lucide-external-link");
  });

  it("renders mobile Export options with PDF and Word download options", () => {
    const markup = renderInMenu(
      createElement(MobileExportMenuItems, {
        conversation: {
          id: "test-conv",
          title: "Test chat",
          isPinned: false,
          isArchived: false,
        },
        onExport: () => undefined,
      })
    );
    expect(markup).toContain('data-testid="mobile-export-menu-items"');
    expect(markup).toContain("Download PDF");
    expect(markup).toContain("Download Word");
  });

  it("renders the 3-dots conversation actions trigger button", () => {
    const markup = renderWithTooltip(
      createElement(ConversationActionsMenu, {
        conversation: {
          id: "test-conv",
          title: "Test chat",
          isPinned: false,
          isArchived: false,
        },
        isMenuOpen: false,
        onMenuOpenChange: () => undefined,
        onRename: () => undefined,
        onPin: () => undefined,
        onArchive: () => undefined,
        onShare: () => undefined,
        onExport: () => undefined,
        onDelete: () => undefined,
        isMobile: true,
      })
    );
    expect(markup).toContain('aria-label="Actions for Test chat"');
    expect(markup).toContain("lucide-ellipsis");
  });

  it("renders mobile ConversationActionsMenu with aligned Download PDF and Download Word matching other options", () => {
    const markup = renderInMenu(
      createElement(ConversationActionsMenuItems, {
        conversation: {
          id: "test-conv",
          title: "Test chat",
          isPinned: false,
          isArchived: false,
        },
        onRename: () => undefined,
        onPin: () => undefined,
        onArchive: () => undefined,
        onShare: () => undefined,
        onExport: () => undefined,
        onDelete: () => undefined,
        isMobile: true,
      })
    );
    expect(markup).toContain("Download PDF");
    expect(markup).toContain("Download Word");
    expect(markup).toContain("Rename");
    expect(markup).toContain("lucide-pencil");
    // PDF and Word get distinct branded marks (not the same generic icon).
    expect(markup).toContain('role="img"');
    expect(markup).toContain(">PDF<");
    expect(markup).toContain(">WORD<");
  });
});
