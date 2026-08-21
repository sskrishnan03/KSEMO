import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { FaqPage, PrivacyPage, TermsPage } from "./SupportPage";

describe("KSEMO support information destinations", () => {
  it("renders substantive FAQ, privacy, and terms content", () => {
    expect(renderToStaticMarkup(createElement(FaqPage))).toContain(
      "What happens when I use Voice Chat?"
    );
    expect(renderToStaticMarkup(createElement(PrivacyPage))).toContain(
      "What KSEMO stores"
    );
    expect(renderToStaticMarkup(createElement(TermsPage))).toContain(
      "AI output"
    );
  });
});
