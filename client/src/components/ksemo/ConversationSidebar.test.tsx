import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
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

/** Signed-out sidebar: `locked` is what swaps in the guest sign-in block. */
function renderLockedSidebar() {
  return renderWithTooltip(
    createElement(ConversationSidebar, {
      conversations: [],
      activeConversationId: null,
      open: true,
      collapsed: false,
      locked: true,
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
}

function readSidebarSource() {
  return readFileSync(
    fileURLToPath(new URL("./ConversationSidebar.tsx", import.meta.url)),
    "utf8"
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
    // Conversation rows use reicon's ChatLine (asserted via its outline path).
    expect(markup).toContain("M10.4606 1.25H13.5394");
    expect(markup).not.toContain("lucide-message-circle");
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

  it("keeps the scan-to-open code out of the sidebar entirely", () => {
    const markup = renderLockedSidebar();
    // The code lives outside the sidebar now, as a viewport-anchored sibling.
    expect(markup).not.toContain("Scan to open");
    expect(markup).not.toContain('alt="Dismiss scanner"');
  });

  it("restores the guest sign-in block the sidebar had before the scanner existed", () => {
    const markup = renderLockedSidebar();
    expect(markup).toContain('alt="KSEMO logo"');
    expect(markup).toContain("Sign in to KSEMO");
    expect(markup).toContain(
      "Your conversations, files, and creations"
    );
    expect(markup).toContain("bg-[oklch(0.95_0.003_80)]");
  });

  it("keeps the rest of the signed-out sidebar intact alongside the sign-in block", () => {
    const markup = renderLockedSidebar();
    expect(markup).toContain('aria-label="Conversations"');
    expect(markup).toContain("New chat");
    expect(markup).toContain("Search");
    expect(markup).toContain("Library");
  });

  it("shows the compact signed-out rail its icon-only sign-in affordance", () => {
    const markup = renderWithTooltip(
      createElement(ConversationSidebar, {
        conversations: [],
        activeConversationId: null,
        open: true,
        collapsed: true,
        locked: true,
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
    // No room for the block in the rail, so only the icon remains.
    expect(markup).toContain('aria-label="Sign in"');
    expect(markup).not.toContain("Sign in to KSEMO");
  });
});

describe("KSEMO signed-out sidebar sign-in container", () => {
  function renderLocked() {
    return renderWithTooltip(
      createElement(ConversationSidebar, {
        conversations: [],
        activeConversationId: null,
        open: true,
        collapsed: false,
        locked: true,
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
  }

  it("leaves the standing guest card alone until a locked action is tapped", () => {
    const markup = renderLocked();
    // Static markup only ever shows the pre-click state, which is the guest
    // card. The intent container is click-driven and covered below.
    expect(markup).not.toContain('role="alertdialog"');
    expect(markup).toContain("Sign in to KSEMO");
  });

  it("keeps one intent per action so the copy can name what was tapped", () => {
    const source = readSidebarSource();
    expect(source).toContain('setLockedIntent("new")');
    expect(source).toContain('setLockedIntent("search")');
    expect(source).toContain('setLockedIntent("library")');
    // Each one short-circuits instead of running the real action.
    expect(source).toMatch(
      /if \(locked\) \{\s*setLockedIntent\("new"\);\s*return;/
    );
    expect(source).toMatch(
      /if \(locked\) \{\s*setLockedIntent\("search"\);\s*return;/
    );
    expect(source).toMatch(
      /if \(locked\) \{\s*setLockedIntent\("library"\);\s*return;/
    );
  });

  it("answers inside the sidebar instead of raising a dialog over the chat", () => {
    const source = readSidebarSource();
    // The container lives in the sidebar and is announced as a dialog for the
    // sign-in requirement, with its own copy per action and a cancel.
    expect(source).toContain('role="alertdialog"');
    expect(source).toContain('aria-label="Sign in required"');
    expect(source).toContain("LOCKED_INTENT_COPY[lockedIntent].title");
    expect(source).toContain("LOCKED_INTENT_COPY[lockedIntent].body");
    expect(source).toContain('aria-label="Cancel"');
    expect(source).toContain("setLockedIntent(null)");
    // And it no longer defers to a parent-owned prompt for these three actions.
    expect(source).not.toContain("onLoginPrompt");
  });

  it("leaves the composer's sign-in prompt alone", () => {
    // Sending a message while signed out still routes through the bottom-right
    // prompt; only the sidebar's own utility row moved in-sidebar.
    const home = readFileSync(
      fileURLToPath(new URL("../../pages/Home.tsx", import.meta.url)),
      "utf8"
    );
    expect(home).toContain("setGuestPromptOpen(true)");
  });
});
