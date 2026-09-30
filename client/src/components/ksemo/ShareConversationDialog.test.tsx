import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ShareConversationPanel } from "./ShareConversationDialog";

describe("ShareConversationDialog", () => {
  it("renders side-by-side Copy link and Share via email options with KSEMO borderless styling", () => {
    const markup = renderToStaticMarkup(
      createElement(ShareConversationPanel, {
        title: "Financial Audit 2026",
        shareUrl: "https://ksemo.ai/share/abc123",
        email: "cfo@company.com",
        onEmailChange: () => undefined,
        onCopy: () => undefined,
        onEmail: () => undefined,
        onSetPublic: () => undefined,
        isPublic: true,
        enabled: true,
      })
    );
    // Header
    expect(markup).toContain("Share conversation");
    expect(markup).toContain("Financial Audit 2026");
    expect(markup).toContain("Share “Financial Audit 2026” via link or email.");

    // Side-by-side action buttons
    expect(markup).toContain("Copy link");
    expect(markup).toContain("Share via email");

    // Seamless composer-style email input rendered when email prop is provided
    expect(markup).toContain('id="share-email-input"');
    expect(markup).toContain('value="cfo@company.com"');
    expect(markup).toContain('aria-label="Send email"');

    // No redundant cancel button at bottom
    expect(markup).not.toContain("Cancel");
  });

  it("renders the scrollable preview container with white inner glow, no borderline, and strict overflow constraints", () => {
    const markup = renderToStaticMarkup(
      createElement(ShareConversationPanel, {
        title: "Q4 Strategic Roadmap",
        shareUrl: "https://ksemo.ai/share/xyz",
        email: "",
        onEmailChange: () => undefined,
        onCopy: () => undefined,
        onEmail: () => undefined,
        onSetPublic: () => undefined,
        isPublic: false,
        enabled: true,
        messages: [
          {
            id: "msg-1",
            role: "user",
            content: "What are the core priorities for next quarter?",
          },
          {
            id: "msg-2",
            role: "assistant",
            content:
              "1. Ship the real-time collaboration engine.\n2. Scale voice assistant integration.",
            attachments: [
              {
                id: "att-1",
                filename: "quarterly_goals.pdf",
              },
            ],
          },
        ],
      })
    );

    // Scrollable workspace preview container with white inner glow, no borderline, and strict width/overflow constraints
    expect(markup).toContain('aria-label="Conversation workspace preview"');
    expect(markup).toContain("border-0");
    expect(markup).toContain("overflow-x-hidden");
    expect(markup).toContain("shadow-[inset_0_0_20px_rgba(255,255,255,0.18),inset_0_0_8px_rgba(255,255,255,0.28)]");

    // Message bubbles without artificial KSEMO labels
    expect(markup).toContain("What are the core priorities for next quarter?");
    expect(markup).toContain("1. Ship the real-time collaboration engine.");
    expect(markup).toContain("quarterly_goals.pdf");
  });
});
