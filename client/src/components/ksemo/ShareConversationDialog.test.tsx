import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ShareConversationPanel } from "./ShareConversationDialog";

describe("ShareConversationDialog", () => {
  it("renders Public state with Public/Private option selector, Anyone with link tagline, and Copy link card", () => {
    const markup = renderToStaticMarkup(
      createElement(ShareConversationPanel, {
        title: "Financial Audit 2026",
        shareUrl: "https://ksemo.ai/share/abc123",
        email: "",
        onEmailChange: () => undefined,
        onCopy: () => undefined,
        onEmail: () => undefined,
        onSetPublic: () => undefined,
        isPublic: true,
        enabled: true,
      })
    );
    // Header without the removed subtitle
    expect(markup).toContain("Share conversation");
    expect(markup).not.toContain("Share via link or email.");

    // No project name mention anywhere
    expect(markup).not.toContain("KSEMO");
    expect(markup).not.toContain("share-project-name");

    // Conversation badge on the right side
    expect(markup).toContain('data-testid="share-conversation-badge"');

    // Side-by-side action buttons
    expect(markup).toContain("Create link");
    expect(markup).toContain("Share via email");

    // Public/Private selector with taglines
    expect(markup).toContain("Public");
    expect(markup).toContain("Anyone with link");
    expect(markup).toContain("Private");
    expect(markup).toContain("Only you have access");

    // Link card with URL and Copy link button below itself
    expect(markup).toContain("https://ksemo.ai/share/abc123");
    expect(markup).toContain("Copy link");

    // Mutually exclusive: email input is NOT rendered when link section is active
    expect(markup).not.toContain('id="share-email-input"');

    // No redundant cancel button at bottom
    expect(markup).not.toContain("Cancel");
  });

  it("renders exclusive Share via email section when email is active without mixing up link options", () => {
    const markup = renderToStaticMarkup(
      createElement(ShareConversationPanel, {
        title: "Financial Audit 2026",
        shareUrl: "https://ksemo.ai/share/abc123",
        email: "cfo@company.com",
        onEmailChange: () => undefined,
        onCopy: () => undefined,
        onEmail: () => undefined,
        onSetPublic: () => undefined,
        isPublic: false,
        enabled: true,
      })
    );

    // Email input rendered
    expect(markup).toContain('id="share-email-input"');
    expect(markup).toContain('value="cfo@company.com"');
    expect(markup).toContain('aria-label="Send email"');

    // Mutually exclusive: Public/Private selector not rendered
    expect(markup).not.toContain("Anyone with link");
  });

  it("renders uncreated state with Create link and Share via email side-by-side and right-aligned Conversation badge", () => {
    const markup = renderToStaticMarkup(
      createElement(ShareConversationPanel, {
        title: "Private Strategy Doc",
        shareUrl: "",
        email: "",
        onEmailChange: () => undefined,
        onCopy: () => undefined,
        onEmail: () => undefined,
        onSetPublic: () => undefined,
        isPublic: false,
        enabled: true,
      })
    );

    // Header & Conversation badge
    expect(markup).toContain('data-testid="share-conversation-badge"');
    expect(markup).toContain("Conversation");
    expect(markup).toContain("Private Strategy Doc");

    // Top buttons side-by-side
    expect(markup).toContain("Create link");
    expect(markup).toContain("Share via email");

    // No project name
    expect(markup).not.toContain("KSEMO");

    // Closed by default when neither link nor email is active
    expect(markup).not.toContain('id="share-email-input"');
  });

  it("renders the shared conversation tile with conversation title and no project name or message preview", () => {
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

    // Shared conversation details card
    expect(markup).toContain('aria-label="Shared conversation details"');
    expect(markup).not.toContain("KSEMO");
    expect(markup).not.toContain("share-project-name");
    expect(markup).toContain('data-testid="share-conversation-title"');
    expect(markup).toContain("Q4 Strategic Roadmap");

    // No marquee/ticker animations
    expect(markup).not.toContain("ksemo-marquee-track");
    expect(markup).not.toContain("ksemo-marquee-container");

    // No logo or "Shared Chat"
    expect(markup).not.toContain("KSEMOlogo.png");
    expect(markup).not.toContain("Shared Chat");

    // No live preview message bubbles or attachments
    expect(markup).not.toContain("What are the core priorities for next quarter?");
    expect(markup).not.toContain("quarterly_goals.pdf");

    // No ambient inner glow ("blow inside")
    expect(markup).not.toContain("shadow-[inset_0_0_20px");
  });

  it("renders the top-right close button when onCancel is provided", () => {
    const markup = renderToStaticMarkup(
      createElement(ShareConversationPanel, {
        title: "Team Sync",
        shareUrl: "https://ksemo.ai/share/team-sync",
        email: "",
        onEmailChange: () => undefined,
        onCopy: () => undefined,
        onEmail: () => undefined,
        onSetPublic: () => undefined,
        onCancel: () => undefined,
        isPublic: false,
        enabled: true,
      })
    );

    expect(markup).toContain('aria-label="Close share dialog"');
  });
});

