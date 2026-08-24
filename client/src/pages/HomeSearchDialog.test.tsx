import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { SearchDialogBody } from "../components/ksemo/SearchDialog";
import { SearchResultGroups } from "../components/ksemo/SearchResultGroups";

describe("KSEMO grouped search results", () => {
  it("renders accessible result counts for both Chats and Memory groups", () => {
    const markup = renderToStaticMarkup(
      createElement(SearchResultGroups, {
        chats: [
          {
            conversationId: "conversation-1",
            conversationTitle: "Planning",
            createdAt: new Date("2026-08-20T10:00:00Z"),
          },
        ],
        messages: [],
        memories: [
          {
            id: "memory-1",
            content: "Remember the launch date",
            category: "preference",
          },
        ],
        onSelect: () => undefined,
        onOpenMemories: () => undefined,
      })
    );
    expect(markup).toContain("Chats");
    expect(markup).toContain('aria-label="1 chats results"');
    expect(markup).toContain("Memories");
    expect(markup).toContain('aria-label="1 memories results"');
  });

  it("searches immediately from the first character typed", () => {
    const baseProps = {
      onQueryChange: () => undefined,
      filter: "all" as const,
      onFilterChange: () => undefined,
      loading: false,
      chats: [
        {
          conversationId: "conversation-1",
          conversationTitle: "Planning",
          createdAt: new Date("2026-08-20T10:00:00Z"),
        },
      ],
      memories: [
        {
          id: "memory-1",
          content: "Remember the launch date",
          category: "preference",
        },
      ],
      onSelect: () => undefined,
      onOpenMemories: () => undefined,
    };
    const preSearchMarkup = renderToStaticMarkup(
      createElement(SearchDialogBody, { ...baseProps, query: "a" })
    );
    const searchedMarkup = renderToStaticMarkup(
      createElement(SearchDialogBody, {
        ...baseProps,
        query: "la",
        results: { chats: baseProps.chats, messages: [] },
        memories: baseProps.memories,
      })
    );

    expect(preSearchMarkup).not.toContain(
      "Type to search your chats, messages, and memories."
    );
    expect(preSearchMarkup).not.toContain('aria-label="1 chats results"');
    expect(searchedMarkup).toContain('aria-label="1 chats results"');
    expect(searchedMarkup).toContain('aria-label="1 memories results"');
  });
});
