import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  ChatComposer,
  librarySubmenuClass,
  LibraryPickerContent,
} from "./ChatComposer";

const baseProps = {
  onSend: () => undefined,
  onCancel: () => undefined,
  onVoice: () => undefined,
  onCancelRecording: () => undefined,
  isGenerating: false,
  isTranscribing: false,
  recordingSeconds: 7,
  value: "",
  onValueChange: () => undefined,
};

describe("ChatComposer recording state", () => {
  it("keeps the message field in the original composer while recording", () => {
    const markup = renderToStaticMarkup(
      createElement(ChatComposer, { ...baseProps, isRecording: true })
    );
    expect(markup).toContain('aria-label="Message KSEMO"');
    expect(markup).toContain('aria-label="Recording 7 seconds"');
    expect(markup).toContain('aria-label="Cancel recording"');
    expect(markup).toContain('aria-label="Finish recording"');
  });

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
        isRecording: false,
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
        isRecording: false,
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
    expect(librarySubmenuClass).not.toContain("bottom-[calc(100%+0.5rem)]");
    expect(librarySubmenuClass).toContain("max-sm:left-1/2");
    expect(librarySubmenuClass).toContain("max-sm:-translate-x-1/2");
    expect(librarySubmenuClass).toContain("max-h-[calc(100dvh-2rem)]");
  });

  it("hides the safety note for the centered fresh-chat composer while retaining it by default below a conversation", () => {
    const centeredMarkup = renderToStaticMarkup(
      createElement(ChatComposer, {
        ...baseProps,
        isRecording: false,
        showSafetyNote: false,
      })
    );
    const conversationMarkup = renderToStaticMarkup(
      createElement(ChatComposer, { ...baseProps, isRecording: false })
    );
    expect(centeredMarkup).not.toContain("KSEMO can make mistakes");
    expect(conversationMarkup).toContain("KSEMO can make mistakes");
  });

  it("places the dedicated live Voice Chat control between quick recording and Send", () => {
    const markup = renderToStaticMarkup(
      createElement(ChatComposer, { ...baseProps, isRecording: false })
    );
    const recordIndex = markup.indexOf('aria-label="Use voice input"');
    const voiceChatIndex = markup.indexOf('aria-label="Start voice chat"');
    const sendIndex = markup.indexOf('aria-label="Send message"');
    expect(recordIndex).toBeGreaterThan(-1);
    expect(voiceChatIndex).toBeGreaterThan(recordIndex);
    expect(sendIndex).toBeGreaterThan(voiceChatIndex);
  });
});
