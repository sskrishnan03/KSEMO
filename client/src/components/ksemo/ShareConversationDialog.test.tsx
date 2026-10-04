import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ShareConversationPanel } from "./ShareConversationDialog";

describe("ShareConversationDialog", () => {
  it("renders Public state with access mode pill, link field, and inline actions", () => {
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

    // Header
    expect(markup).toContain("Share conversation");

    // Conversation title tile to view the title
    expect(markup).toContain('aria-label="Shared conversation details"');
    expect(markup).toContain('data-testid="share-conversation-badge"');
    expect(markup).toContain('data-testid="share-conversation-title"');
    expect(markup).toContain("Conversation");
    expect(markup).toContain("Financial Audit 2026");

    // Access mode pill (Chat/Bot-style 3-option sliding toggle) with a label above
    expect(markup).toContain("Who can access");
    expect(markup).toContain("Public");
    expect(markup).toContain("Private");
    expect(markup).toContain("Restricted");
    expect(markup).toContain("Anyone with the link");
    expect(markup).toContain("Only you have access");
    expect(markup).toContain("Only invited people");
    expect(markup).toContain('aria-label="Access mode"');
    expect(markup).not.toContain("Access control");

    // Share link field with URL, inline open-in-new-tab icon and Copy link button
    expect(markup).toContain('data-testid="share-active-url"');
    expect(markup).toContain("https://ksemo.ai/share/abc123");
    expect(markup).toContain('aria-label="Open link in new tab"');
    expect(markup).toContain("Copy link");

    // Email compose box, always open at the bottom, with a visible label
    expect(markup).toContain("Share through email");
    expect(markup).toContain('id="share-email-input"');
    expect(markup).toContain('aria-label="Send email"');
    expect(markup).toContain(">Send</span>");

    // Order: conversation title → access mode → link → email
    expect(
      markup.indexOf('data-testid="share-conversation-title"')
    ).toBeLessThan(markup.indexOf('aria-label="Access mode"'));
    expect(markup.indexOf('aria-label="Access mode"')).toBeLessThan(
      markup.indexOf('data-testid="share-active-url"')
    );
    expect(markup.indexOf('data-testid="share-active-url"')).toBeLessThan(
      markup.indexOf('id="share-email-input"')
    );

    expect(markup).not.toContain("QR Code");
    expect(markup).not.toContain('aria-label="Link options"');

    // Removed captions
    expect(markup).not.toContain(
      "All access is log-only, restricted to view and comment as selected."
    );

    // Email box always open — never a closed state
    expect(markup).not.toContain("Create link");
    expect(markup).not.toContain("Share via email");

    // No redundant cancel button at bottom
    expect(markup).not.toContain("Cancel");
  });

  it("renders Private state with private subtext and private link", () => {
    const markup = renderToStaticMarkup(
      createElement(ShareConversationPanel, {
        title: "Financial Audit 2026",
        shareUrl: "https://ksemo.ai/share/abc123",
        email: "",
        onEmailChange: () => undefined,
        onCopy: () => undefined,
        onEmail: () => undefined,
        onSetPublic: () => undefined,
        isPublic: false,
        enabled: true,
      })
    );

    // Private subtext replaces the public one
    expect(markup).toContain("Only you have access");
    expect(markup).not.toContain("Anyone with the link can access");

    // Private link is shown instead of the share token URL
    expect(markup).toContain("?conversation=private");
    expect(markup).not.toContain("https://ksemo.ai/share/abc123");
  });

  it("renders the always-open email compose box first with a send button below it", () => {
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

    // Email compose field with the full-width white Send button below it
    expect(markup).toContain('id="share-email-input"');
    expect(markup).toContain('value="cfo@company.com"');
    expect(markup).toContain('aria-label="Send email"');
    expect(markup).toContain(">Send</span>");

    // The rest of the modal is untouched by the email box
    expect(markup).toContain("Anyone with the link");
    expect(markup).toContain("Copy link");
    expect(markup).not.toContain("QR Code");
  });

  it("renders uncreated state with a preview link and the full access control layout", () => {
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

    expect(markup).toContain("Share conversation");
    expect(markup).toContain("Private Strategy Doc");
    expect(markup).toContain("Only you have access");
    expect(markup).toContain("?conversation=private");
    expect(markup).toContain("Copy link");
    expect(markup).not.toContain("QR Code");

    // No project name
    expect(markup).not.toContain("KSEMO");
  });

  it("renders the share title without message previews, attachments, or ticker markup", () => {
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

    expect(markup).toContain("Share conversation");
    expect(markup).toContain("Q4 Strategic Roadmap");
    expect(markup).not.toContain("KSEMO");

    // No marquee/ticker animations
    expect(markup).not.toContain("ksemo-marquee-track");
    expect(markup).not.toContain("ksemo-marquee-container");

    // No logo or "Shared Chat"
    expect(markup).not.toContain("KSEMOlogo.png");
    expect(markup).not.toContain("Shared Chat");

    // No live preview message bubbles or attachments
    expect(markup).not.toContain(
      "What are the core priorities for next quarter?"
    );
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
