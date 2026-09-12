import { createElement, type ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { TooltipProvider } from "@/components/ui/tooltip";
import {
  ChatComposer,
  getLibrarySubmenuClass,
  LibraryPickerContent,
} from "./ChatComposer";

function renderWithTooltip(element: ReactElement) {
  return renderToStaticMarkup(createElement(TooltipProvider, null, element));
}

const baseProps = {
  onSend: () => undefined,
  onCancel: () => undefined,
  onVoice: () => undefined,
  onCancelRecording: () => undefined,
  isGenerating: false,
  isRecording: false,
  isTranscribing: false,
  recordingSeconds: 0,
  value: "",
  onValueChange: () => undefined,
};

describe("ChatComposer", () => {
  it("renders a searchable cancellable Library flyout with a selectable private file", () => {
    const markup = renderToStaticMarkup(
      createElement(LibraryPickerContent, {
        files: [
          {
            id: "file-1",
            filename: "Interview.docx",
            mimeType:
              "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            sizeBytes: 2_048,
          },
        ],
        query: "",
        onQueryChange: () => undefined,
        onSelect: () => undefined,
        onCancel: () => undefined,
      })
    );
    expect(markup).toContain("Search your files and images");
    expect(markup).toContain("Interview.docx");
    expect(markup).toContain("Cancel");
  });

  it("shows a clear cancel action for a selected chat upload notice", () => {
    const markup = renderWithTooltip(
      createElement(ChatComposer, {
        ...baseProps,
        attachmentNotice: { name: "brief.pdf", linked: true },
        onClearAttachment: () => undefined,
      })
    );
    expect(markup).toContain("brief.pdf");
    expect(markup).toContain("linked");
    expect(markup).toContain('aria-label="Remove screenshot"');
    expect(markup.indexOf("brief.pdf")).toBeLessThan(
      markup.indexOf('aria-label="Message KSEMO"')
    );
  });

  it("renders every selected Library item as an individually removable chat attachment", () => {
    const markup = renderWithTooltip(
      createElement(ChatComposer, {
        ...baseProps,
        attachmentNotices: [
          { fileId: "doc-1", name: "brief.pdf", linked: false },
          { fileId: "image-1", name: "diagram.png", linked: false },
        ],
        onClearAttachment: () => undefined,
      })
    );
    expect(markup).toContain("brief.pdf");
    expect(markup).toContain("diagram.png");
    const removeButtons = (markup.match(/aria-label="Remove screenshot"/g) ?? []).length;
    expect(removeButtons).toBe(2);
  });

  it("keeps the mobile Library selector translated inward and height-bounded", () => {
    const librarySubmenuClass = getLibrarySubmenuClass(false);
    expect(librarySubmenuClass).not.toContain("bottom-[calc(100%+0.5rem)]");
    expect(librarySubmenuClass).toContain("left-1/2");
    expect(librarySubmenuClass).toContain("-translate-x-1/2");
    expect(librarySubmenuClass).toContain("max-h-[calc(100dvh-6rem)]");
  });

  it("does not render the stale safety/disclaimer note in any composer variant", () => {
    const centeredMarkup = renderWithTooltip(
      createElement(ChatComposer, { ...baseProps })
    );
    expect(centeredMarkup).not.toContain("KSEMO can make mistakes");
  });

  it("renders single-word Dictate tooltip and aria-label for voice input", () => {
    const markup = renderWithTooltip(
      createElement(ChatComposer, { ...baseProps })
    );
    expect(markup).toContain('aria-label="Dictate"');
    expect(markup).toContain("Dictate");
  });

  it("renders single-word Stop and Transcribe tooltips when recording", () => {
    const markup = renderWithTooltip(
      createElement(ChatComposer, { ...baseProps, isRecording: true })
    );
    expect(markup).toContain("Stop");
    expect(markup).toContain("Transcribe");
    expect(markup).not.toContain("Discard");
  });

  it("renders single-word Attach tooltip and aria-label for the composer plus button", () => {
    const markup = renderWithTooltip(
      createElement(ChatComposer, { ...baseProps })
    );
    expect(markup).toContain('aria-label="Attach"');
    expect(markup).not.toContain('aria-label="Open composer tools"');
    expect(markup).not.toContain("Create");
  });

  it("renders Cancel icon and Save tick mark inside the chat box when editing user message", () => {
    const markup = renderWithTooltip(
      createElement(ChatComposer, {
        ...baseProps,
        isEditingMessage: true,
        value: "Editing my previous message",
        onSaveEdit: () => undefined,
        onCancelEdit: () => undefined,
      })
    );
    expect(markup).toContain('aria-label="Cancel edit"');
    expect(markup).toContain('aria-label="Save edit"');
    expect(markup).toContain('aria-label="Dictate"');
    expect(markup).not.toContain('aria-label="Attach"');
    expect(markup).not.toContain('aria-label="Send message"');
    expect(markup).not.toContain('aria-label="Start voice chat"');
    expect(markup).toContain('aria-label="Edit your message"');
  });

  it("renders Edit your message placeholder when editing and value is empty", () => {
    const markup = renderWithTooltip(
      createElement(ChatComposer, {
        ...baseProps,
        isEditingMessage: true,
        value: "",
        onSaveEdit: () => undefined,
        onCancelEdit: () => undefined,
      })
    );
    expect(markup).toContain("Edit your message…");
    expect(markup).toContain('aria-label="Cancel edit"');
    expect(markup).toContain('aria-label="Save edit"');
  });

  it("renders all 5 file brand icons with cohesive white document page, folded corner, and embedded format words", async () => {
    const { PdfLogo, WordLogo, ExcelLogo, PowerPointLogo, TextLogo } = await import("./FileBrandLogos");
    const pdfMarkup = renderToStaticMarkup(createElement(PdfLogo, { className: "size-6" }));
    const wordMarkup = renderToStaticMarkup(createElement(WordLogo, { className: "size-6" }));
    const excelMarkup = renderToStaticMarkup(createElement(ExcelLogo, { className: "size-6" }));
    const pptMarkup = renderToStaticMarkup(createElement(PowerPointLogo, { className: "size-6" }));
    const textMarkup = renderToStaticMarkup(createElement(TextLogo, { className: "size-6" }));

    // Each icon has its signature format word embedded directly in the badge
    expect(pdfMarkup).toContain("PDF");
    expect(wordMarkup).toContain("WORD");
    expect(excelMarkup).toContain("EXCEL");
    expect(pptMarkup).toContain("PPT");
    expect(textMarkup).toContain("TEXT");

    // All logos share the unified white document surface with soft drop shadow
    expect(pdfMarkup).toContain("ellipse");
    expect(wordMarkup).toContain("ellipse");
    expect(excelMarkup).toContain("ellipse");
    expect(pptMarkup).toContain("ellipse");
    expect(textMarkup).toContain("ellipse");

    expect(pdfMarkup).toContain("#ffffff");
    expect(wordMarkup).toContain("#ffffff");
    expect(excelMarkup).toContain("#ffffff");
    expect(pptMarkup).toContain("#ffffff");
    expect(textMarkup).toContain("#ffffff");
  });
});
