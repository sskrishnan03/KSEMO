import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { ConfirmDeleteDialogPanel } from "./ConfirmDeleteDialog";

function readDialogSource() {
  return readFileSync(
    fileURLToPath(new URL("./ConfirmDeleteDialog.tsx", import.meta.url)),
    "utf8"
  );
}

const renderPanel = (
  overrides: Partial<Parameters<typeof ConfirmDeleteDialogPanel>[0]> = {},
  busy = false
) => {
  const onConfirm = vi.fn();
  const markup = renderToStaticMarkup(
    createElement(ConfirmDeleteDialogPanel, {
      titleNode: "Are you sure you want to delete all chats?",
      descriptionNode: "Every conversation will be permanently removed.",
      confirmLabel: "Delete all",
      keyword: "",
      typed: "",
      onTypedChange: () => undefined,
      onSubmitKey: () => undefined,
      cancelNode: createElement("button", { type: "button" }, "Cancel"),
      onConfirm,
      busy,
      ...overrides,
    })
  );
  return { markup, onConfirm };
};

describe("confirmation dialog busy state", () => {
  it("shows the idle confirm label before anything is deleted", () => {
    const { markup } = renderPanel();
    expect(markup).toContain("Delete all");
    expect(markup).toContain("Cancel");
    expect(markup).not.toContain("Deleting");
    expect(markup).not.toContain("animate-spin");
    expect(markup).not.toContain('disabled=""');
  });

  it("keeps the container mounted and spins inside the button while deleting", () => {
    const { markup } = renderPanel({ busyLabel: "Deleting all…" }, true);
    // The spinner and the busy label both live inside the confirm button.
    expect(markup).toContain("animate-spin");
    expect(markup).toContain("Deleting all…");
    // The surrounding container is still rendered while the request runs.
    expect(markup).toContain("Are you sure you want to delete all chats?");
    expect(markup).toContain("Every conversation will be permanently removed.");
  });

  it("locks confirm so an in-flight delete cannot be fired twice", () => {
    const { markup, onConfirm } = renderPanel({}, true);
    expect(markup).toContain('disabled=""');
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it("surfaces a failure message inside the dialog and stays retryable", () => {
    const { markup } = renderPanel({
      error: "Chats could not be deleted. Please try again in a moment.",
    });
    expect(markup).toContain('role="alert"');
    expect(markup).toContain(
      "Chats could not be deleted. Please try again in a moment."
    );
    expect(markup).toContain("Delete all");
    expect(markup).not.toContain('disabled=""');
  });

  it("keeps delete disabled until the confirm keyword matches", () => {
    const { markup } = renderPanel({ keyword: "DELETE", typed: "nope" });
    expect(markup).toContain('disabled=""');
  });

  it("enables delete once the confirm keyword matches", () => {
    const { markup } = renderPanel({ keyword: "DELETE", typed: "delete" });
    expect(markup).not.toContain('disabled=""');
  });

  it("never traps the user: cancel and escape stay available while deleting", () => {
    const source = readDialogSource();
    // Blocking Escape/Cancel during a slow request made the dialog feel frozen
    // and left the user with no way out. Only the destructive button is locked.
    expect(source).not.toContain("onEscapeKeyDown");
    expect(source).not.toContain("Please wait");
    expect(source).toContain("aria-busy={isBusy}");
    expect(source).toContain(
      "disabled={(Boolean(keyword) && !matched) || busy}"
    );
  });
});

describe("confirmation dialog stacking", () => {
  // Regression: this dialog is always rendered inside an already-open Dialog.
  // Dialog content sits at z-[80] while AlertDialog defaults to z-50, so the
  // confirmation opened behind the opaque Settings panel and clicking
  // "Delete account" appeared to do nothing at all.
  it("renders above the Dialog layer that hosts it", () => {
    const source = readDialogSource();
    expect(source).toContain("z-[90]");
    expect(source).toContain("overlayClassName=\"z-[85]\"");
  });

  it("stays above the Dialog z-index it has to cover", () => {
    // Strip comments first: both files discuss these layers in prose, and the
    // numbers quoted there must not be mistaken for the real class values.
    const code = (src: string) =>
      src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^[ \t]*\/\/.*$/gm, "");

    const dialogSource = code(
      readFileSync(fileURLToPath(new URL("../ui/dialog.tsx", import.meta.url)), "utf8")
    );
    const hostLayer = Number(
      /z-\[(\d+)\]/.exec(dialogSource.split('data-slot="dialog-content"')[1] ?? "")?.[1]
    );
    const hostOverlay = Number(
      /z-\[(\d+)\]/.exec(dialogSource.split('data-slot="dialog-overlay"')[1] ?? "")?.[1]
    );
    const confirm = code(readDialogSource());
    const confirmLayer = Number(/z-\[(\d+)\]/.exec(confirm)?.[1]);
    const confirmOverlay = Number(/overlayClassName="z-\[(\d+)\]"/.exec(confirm)?.[1]);

    expect(hostLayer).toBeGreaterThan(0);
    expect(hostOverlay).toBeGreaterThan(0);
    // Both the confirmation and its scrim must clear the panel it opens over.
    expect(confirmLayer).toBeGreaterThan(hostLayer);
    expect(confirmOverlay).toBeGreaterThan(hostOverlay);
  });
});
