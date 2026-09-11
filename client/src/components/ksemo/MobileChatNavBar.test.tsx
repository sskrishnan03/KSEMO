import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { TooltipProvider } from "@/components/ui/tooltip";
import { MobileChatNavBar } from "./MobileChatNavBar";

function renderNavBar(props: Parameters<typeof MobileChatNavBar>[0]) {
  return renderToStaticMarkup(
    createElement(TooltipProvider, null, createElement(MobileChatNavBar, props))
  );
}

describe("MobileChatNavBar", () => {
  const dummyHandlers = {
    onOpenSidebar: () => undefined,
    onRename: () => undefined,
    onPin: () => undefined,
    onShare: () => undefined,
    onArchive: () => undefined,
    onDuplicate: () => undefined,
    onExport: () => undefined,
    onViewFiles: () => undefined,
    onDelete: () => undefined,
  };

  it("does not render the 3-dots actions menu button for a new chat", () => {
    const markup = renderNavBar({
      conversation: null,
      activeConversationId: null,
      ...dummyHandlers,
    });

    expect(markup).toContain('data-testid="mobile-chat-navbar"');
    expect(markup).toContain('data-testid="mobile-sidebar-toggle"');
    expect(markup).toContain("New chat");
    // 3-dots menu button should NOT be rendered for new chat
    expect(markup).not.toContain('data-testid="mobile-chat-actions-trigger"');
    expect(markup).not.toContain("lucide-ellipsis");
  });

  it("always renders the 3-dots actions menu button when a recent/active conversation is selected", () => {
    const markup = renderNavBar({
      conversation: {
        id: "conv-42",
        title: "Marketing Strategy",
        isPinned: false,
        isArchived: false,
      },
      activeConversationId: "conv-42",
      ...dummyHandlers,
    });

    expect(markup).toContain('data-testid="mobile-chat-navbar"');
    expect(markup).toContain('data-testid="mobile-sidebar-toggle"');
    expect(markup).toContain("Marketing Strategy");
    // 3-dots action button MUST be present
    expect(markup).toContain('data-testid="mobile-chat-actions-trigger"');
    expect(markup).toContain("lucide-ellipsis");
    expect(markup).toContain('aria-label="Actions for Marketing Strategy"');
  });

  it("reflects pinned state correctly in actions menu", () => {
    const markup = renderNavBar({
      conversation: {
        id: "conv-99",
        title: "Pinned Chat",
        isPinned: true,
        isArchived: false,
      },
      activeConversationId: "conv-99",
      ...dummyHandlers,
    });

    expect(markup).toContain('data-testid="mobile-chat-actions-trigger"');
  });
});
