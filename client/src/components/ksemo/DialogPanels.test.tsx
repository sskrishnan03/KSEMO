import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { KsemoConfirmDialogPanel, KsemoTextDialogPanel } from "./DialogPanels";

describe("KSEMO branded action dialog panels", () => {
  it("renders the shared in-product rename and edit form controls", () => {
    const markup = renderToStaticMarkup(
      createElement(KsemoTextDialogPanel, {
        label: "Conversation title",
        value: "Roadmap",
        onValueChange: () => undefined,
        actionLabel: "Save name",
        onCancel: () => undefined,
        onAction: () => undefined,
      })
    );
    expect(markup).toContain("Conversation title");
    expect(markup).toContain("Save name");
    expect(markup).toContain("Cancel");
  });

  it("renders the in-product irreversible delete confirmation", () => {
    const markup = renderToStaticMarkup(
      createElement(KsemoConfirmDialogPanel, {
        actionLabel: "Delete permanently",
        onCancel: () => undefined,
        onAction: () => undefined,
      })
    );
    expect(markup).toContain("This action cannot be undone.");
    expect(markup).toContain("Delete permanently");
  });

  it("renders the branded multiline message-edit surface", () => {
    const markup = renderToStaticMarkup(
      createElement(KsemoTextDialogPanel, {
        label: "Message",
        value: "Original text",
        onValueChange: () => undefined,
        multiline: true,
        actionLabel: "Save edit",
        onCancel: () => undefined,
        onAction: () => undefined,
      })
    );
    expect(markup).toContain("Save edit");
    expect(markup).toContain("textarea");
  });
});
