import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  ChatComposer,
  getLibrarySubmenuClass,
  LibraryPickerContent,
} from "./ChatComposer";

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
    const markup = renderToStaticMarkup(
      createElement(ChatComposer, {
        ...baseProps,
        attachmentNotice: { name: "brief.pdf", linked: true },
        onClearAttachment: () => undefined,
      })
    );
    expect(markup).toContain("brief.pdf");
    expect(markup).toContain("Ready in this chat");
    expect(markup).toContain("Cancel");
    expect(markup).toContain('aria-label="Cancel selected upload"');
    expect(markup.indexOf("brief.pdf")).toBeLessThan(
      markup.indexOf('aria-label="Message KSEMO"')
    );
  });

  it("renders every selected Library item as an individually removable chat attachment", () => {
    const markup = renderToStaticMarkup(
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
    expect(markup).toContain('aria-label="Remove brief.pdf"');
    expect(markup).toContain('aria-label="Remove diagram.png"');
  });

  it("keeps the mobile Library selector translated inward and height-bounded", () => {
    const librarySubmenuClass = getLibrarySubmenuClass(false);
    expect(librarySubmenuClass).not.toContain("bottom-[calc(100%+0.5rem)]");
    expect(librarySubmenuClass).toContain("left-1/2");
    expect(librarySubmenuClass).toContain("-translate-x-1/2");
    expect(librarySubmenuClass).toContain("max-h-[calc(100dvh-6rem)]");
  });

  it("hides the safety note for the centered fresh-chat composer while retaining it by default below a conversation", () => {
    const centeredMarkup = renderToStaticMarkup(
      createElement(ChatComposer, {
        ...baseProps,
        showSafetyNote: false,
      })
    );
    const conversationMarkup = renderToStaticMarkup(
      createElement(ChatComposer, { ...baseProps })
    );
    expect(centeredMarkup).not.toContain("KSEMO can make mistakes");
    expect(conversationMarkup).toContain("KSEMO can make mistakes");
  });

  it("shows a cancellable web search pill only while enabled", () => {
    const off = renderToStaticMarkup(
      createElement(ChatComposer, {
        ...baseProps,
        webSearchEnabled: false,
        onToggleWebSearch: () => undefined,
      })
    );
    expect(off).not.toContain('aria-label="Cancel web search"');

    const on = renderToStaticMarkup(
      createElement(ChatComposer, {
        ...baseProps,
        webSearchEnabled: true,
        onToggleWebSearch: () => undefined,
      })
    );
    expect(on).toContain(">Web search</span>");
    expect(on).toContain('aria-label="Cancel web search"');
  });
});
