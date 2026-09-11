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
    onPin: () => undefined,
    onShare: () => undefined,
    onViewFiles: () => undefined,
    onDelete: () => undefined,
  };

  it("renders the sidebar toggle and 3-dots actions trigger with no title in the center", () => {
    const markup = renderNavBar({
      conversation: {
        id: "conv-42",
        title: "Marketing Strategy",
        isPinned: false,
      },
      activeConversationId: "conv-42",
      ...dummyHandlers,
    });

    expect(markup).toContain('data-testid="mobile-chat-navbar"');
    expect(markup).toContain('data-testid="mobile-sidebar-toggle"');
    expect(markup).toContain('data-testid="mobile-chat-actions-trigger"');
    // Does NOT render conversation title or "New chat" in the center
    expect(markup).not.toContain("Marketing Strategy");
    expect(markup).not.toContain("New chat");
  });

  it("renders the 3-dots action trigger with correct icon and attributes", () => {
    const markup = renderNavBar({
      conversation: {
        id: "conv-42",
        title: "Marketing Strategy",
        isPinned: false,
      },
      activeConversationId: "conv-42",
      ...dummyHandlers,
    });

    expect(markup).toContain('aria-label="Chat actions"');
    expect(markup).toContain("lucide-ellipsis");
  });
});
