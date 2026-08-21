import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { SearchFilterChips } from "./SearchFilterChips";

describe("KSEMO search filters", () => {
  it("renders compact category filters with the active filter marked", () => {
    const markup = renderToStaticMarkup(
      createElement(SearchFilterChips, {
        value: "memories",
        onChange: () => undefined,
        available: ["all", "chats", "messages", "memories"],
      })
    );
    expect(markup).toContain('aria-label="Search filters"');
    expect(markup).toContain(">memories<");
    expect(markup).toContain("bg-foreground text-background");
  });

  it("keeps the focused memory source selectable and omits Tasks, Files, and unneeded activity filtering", () => {
    const markup = renderToStaticMarkup(
      createElement(SearchFilterChips, {
        value: "memories",
        onChange: () => undefined,
        available: ["all", "memories"],
      })
    );
    expect(markup).toContain(">memories<");
    expect(markup).toContain('aria-pressed="true"');
    expect(markup).not.toContain(">activity<");
    expect(markup).not.toContain(">tasks<");
    expect(markup).not.toContain(">files<");
    expect(markup).not.toContain(">projects<");
  });
});
