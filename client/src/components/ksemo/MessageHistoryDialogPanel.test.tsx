import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { MessageHistoryDialogPanel } from "./MessageHistoryDialogPanel";

describe("KSEMO message history dialog content", () => {
  it("surfaces an earlier version row and a restore-and-regenerate control", () => {
    const markup = renderToStaticMarkup(
      createElement(MessageHistoryDialogPanel, {
        versions: [
          {
            id: "version-1",
            content: "Earlier message",
            createdAt: new Date("2026-08-20T10:00:00Z"),
          },
        ],
        loading: false,
        restoring: false,
        onRestore: () => undefined,
      })
    );
    expect(markup).toContain("Earlier version 1");
    expect(markup).toContain("Earlier message");
    expect(markup).toContain("Restore and regenerate");
  });
});
