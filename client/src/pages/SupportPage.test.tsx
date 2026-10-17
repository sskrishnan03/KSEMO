import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { PrivacyPage, TermsPage } from "./SupportPage";

describe("KSEMO support information destinations", () => {
  it("renders substantive privacy and terms content", () => {
    expect(renderToStaticMarkup(createElement(PrivacyPage))).toContain(
      "The short version"
    );
    expect(renderToStaticMarkup(createElement(TermsPage))).toContain(
      "AI responses"
    );
  });
});
