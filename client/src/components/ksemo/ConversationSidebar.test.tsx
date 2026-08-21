import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ConversationSidebar } from "./ConversationSidebar";

describe("KSEMO conversation sidebar disclosure", () => {
  it("renders label-adjacent Pinned and Recent disclosure controls without conversation counts", () => {
    const markup = renderToStaticMarkup(
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
        onPin: () => undefined,
        onDuplicate: () => undefined,
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
    expect(markup).toContain('data-disclosure-group="recent"');
    expect(markup).toContain("lucide-message-circle");
    expect(markup).not.toContain("bg-muted-foreground/10");
    expect(markup).toContain("lucide-square-pen");
    expect(markup).not.toContain(">Tasks<");
    expect(markup).not.toContain("lucide-list-todo");
    expect(markup).not.toContain("data-conversation-count");
  });

  it("renders an accessible expand control inside the collapsed brand exchange", () => {
    const markup = renderToStaticMarkup(
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
        onPin: () => undefined,
        onDuplicate: () => undefined,
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
});
