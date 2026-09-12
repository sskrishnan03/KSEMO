import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ChatFilesDialog } from "./ChatFilesDialog";

describe("ChatFilesDialog", () => {
  it("renders nothing when closed", () => {
    const markup = renderToStaticMarkup(
      createElement(ChatFilesDialog, {
        open: false,
        onOpenChange: () => undefined,
        files: [],
      })
    );
    expect(markup).toBe("");
  });

  it("renders empty state when open with no files", () => {
    const markup = renderToStaticMarkup(
      createElement(ChatFilesDialog, {
        open: true,
        onOpenChange: () => undefined,
        files: [],
      })
    );
    expect(markup).toContain("Files in this chat");
    expect(markup).toContain("No files in this chat");
    expect(markup).toContain("fixed right-2 top-2");
    expect(markup).toContain("h-[calc(100dvh-1.75rem)]");
    expect(markup).not.toContain("0 files");
  });

  it("renders file items with title, type, and link without file counts", () => {
    const markup = renderToStaticMarkup(
      createElement(ChatFilesDialog, {
        open: true,
        onOpenChange: () => undefined,
        files: [
          {
            id: "f1",
            filename: "Q3_Financial_Summary.pdf",
            mimeType: "application/pdf",
            url: "/api/documents/doc-123",
          },
          {
            id: "f2",
            filename: "analysis_data.xlsx",
            mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            url: "/api/documents/doc-456",
          },
        ],
      })
    );
    expect(markup).toContain("Files in this chat");
    expect(markup).not.toContain("files shared");
    expect(markup).toContain("Q3_Financial_Summary.pdf");
    expect(markup).toContain("analysis_data.xlsx");
    expect(markup).toContain("/api/documents/doc-123");
    expect(markup).toContain("/api/documents/doc-456");
  });
});
