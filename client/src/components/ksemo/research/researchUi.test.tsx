import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import { describe, expect, it } from "vitest";
import type { Source } from "@shared/research";
import { SourceCard } from "./SourceCard";
import { SourcesControl } from "./SourcesControl";
import { SearchActivity } from "./SearchActivity";

function makeSources(count: number): Source[] {
  return Array.from({ length: count }, (_, i) => ({
    sourceId: `id-${i + 1}`,
    title: `Source ${i + 1} title`,
    url: `https://example.com/${i + 1}`,
    domain: "example.com",
    publisher: "Example",
    retrievedDate: "2026-01-01T00:00:00.000Z",
  }));
}

describe("SourceCard", () => {
  it("renders a numbered, accessible, hierarchy-clean row", () => {
    const markup = renderToStaticMarkup(
      createElement(SourceCard, { source: makeSources(1)[0], index: 0 })
    );
    expect(markup).toContain('aria-label="Source 1: Source 1 title"');
    expect(markup).toContain(">1<");
    expect(markup).toContain("Source 1 title");
    expect(markup).toContain("example.com");
    expect(markup).toContain('target="_blank"');
    expect(markup).not.toContain("img");
  });
});

describe("SourcesControl", () => {
  it("renders a compact trigger that shows the source count, with the panel closed", () => {
    const markup = renderToStaticMarkup(
      createElement(SourcesControl, { sources: makeSources(8) })
    );
    expect(markup).toContain("Sources");
    expect(markup).toContain("· 8");
    expect(markup).toContain('aria-expanded="false"');
    expect(markup).toContain('aria-haspopup="dialog"');
    // The overlay panel is only rendered on demand, so no source rows appear.
    expect(markup).not.toContain("Source 1 title");
  });

  it("renders nothing when there are no sources", () => {
    const markup = renderToStaticMarkup(
      createElement(SourcesControl, { sources: [] })
    );
    expect(markup).toBe("");
  });
});

describe("SearchActivity", () => {
  it("shows the searching message while active with no sources yet", () => {
    const markup = renderToStaticMarkup(
      createElement(SearchActivity, {
        mode: "web_search",
        stage: "searching",
        active: true,
        sourceCount: 0,
      })
    );
    expect(markup).toContain("Web Search");
    expect(markup).toContain("Searching the web...");
  });

  it("reports the found-source count before writing the answer", () => {
    const markup = renderToStaticMarkup(
      createElement(SearchActivity, {
        mode: "web_search",
        stage: "analyzing",
        active: true,
        sourceCount: 8,
      })
    );
    expect(markup).toContain("Found 8 relevant sources");
  });

  it("collapses to a compact count once finished", () => {
    const markup = renderToStaticMarkup(
      createElement(SearchActivity, {
        mode: "web_search",
        stage: "completed",
        active: false,
        sourceCount: 4,
      })
    );
    expect(markup).toContain("Web Search");
    expect(markup).toContain("4 sources");
    expect(markup).not.toContain("Searching");
  });
});