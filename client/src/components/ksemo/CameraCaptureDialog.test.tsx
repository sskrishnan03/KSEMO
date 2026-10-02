import { createElement, type ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { CameraCaptureDialog } from "./CameraCaptureDialog";

describe("CameraCaptureDialog", () => {
  it("renders when closed without rendering dialog content", () => {
    const markup = renderToStaticMarkup(
      createElement(CameraCaptureDialog, {
        open: false,
        onOpenChange: () => undefined,
        onCapture: () => undefined,
      })
    );
    expect(markup).not.toContain("Back Camera");
    expect(markup).not.toContain("Front Camera");
  });

  it("renders the camera viewfinder elements and fallback trigger when open", () => {
    const markup = renderToStaticMarkup(
      createElement(CameraCaptureDialog, {
        open: true,
        onOpenChange: () => undefined,
        onCapture: () => undefined,
      })
    );
    // In server/static rendering, open dialog renders the camera dialog structure
    expect(markup).toContain("Back Camera");
    expect(markup).toContain('aria-label="Take photo"');
    expect(markup).toContain('aria-label="Switch camera front and back"');
    expect(markup).toContain('aria-label="Use system camera"');
    expect(markup).toContain('aria-label="Close camera"');
  });

  it("includes a hidden file input with capture attribute as a resilient mobile fallback", () => {
    const markup = renderToStaticMarkup(
      createElement(CameraCaptureDialog, {
        open: true,
        onOpenChange: () => undefined,
        onCapture: () => undefined,
      })
    );
    expect(markup).toContain('type="file"');
    expect(markup).toContain('accept="image/*"');
    expect(markup).toContain('capture="environment"');
  });
});
