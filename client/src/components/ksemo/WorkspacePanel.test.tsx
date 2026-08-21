import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { WorkspaceDeleteConfirmPanel } from "./WorkspacePanel";

describe("KSEMO workspace deletion safeguard", () => {
  it("renders branded cancellation and permanent-delete choices before removal", () => {
    const markup = renderToStaticMarkup(
      createElement(WorkspaceDeleteConfirmPanel, {
        onCancel: () => undefined,
        onConfirm: () => undefined,
      })
    );
    expect(markup).toContain("This action cannot be undone.");
    expect(markup).toContain("Cancel");
    expect(markup).toContain("Delete permanently");
  });
});
