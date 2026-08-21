import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ShareConversationPanel } from "./ShareConversationDialog";

describe("ShareConversationDialog", () => {
  it("renders the private-link and email-client sharing choices without claiming a public share", () => {
    const markup = renderToStaticMarkup(
      createElement(ShareConversationPanel, {
        shareUrl: "https://ksemo.example/share/abc",
        email: "",
        onEmailChange: () => undefined,
        onCopy: () => undefined,
        onEmail: () => undefined,
        onSetPublic: () => undefined,
        isPublic: true,
        enabled: true,
      })
    );
    expect(markup).toContain('aria-label="Public conversation link"');
    expect(markup).toContain("Public link");
    expect(markup).toContain("Email");
    expect(markup).toContain("Anyone with this link can read the conversation");
  });
});
