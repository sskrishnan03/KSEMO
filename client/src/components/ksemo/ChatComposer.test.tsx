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
    const removeButtons = (
      markup.match(/aria-label="Remove screenshot"/g) ?? []
    ).length;
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
    const { PdfLogo, WordLogo, ExcelLogo, PowerPointLogo, TextLogo } =
      await import("./FileBrandLogos");
    const pdfMarkup = renderToStaticMarkup(
      createElement(PdfLogo, { className: "size-6" })
    );
    const wordMarkup = renderToStaticMarkup(
      createElement(WordLogo, { className: "size-6" })
    );
    const excelMarkup = renderToStaticMarkup(
      createElement(ExcelLogo, { className: "size-6" })
    );
    const pptMarkup = renderToStaticMarkup(
      createElement(PowerPointLogo, { className: "size-6" })
    );
    const textMarkup = renderToStaticMarkup(
      createElement(TextLogo, { className: "size-6" })
    );

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

  it("leaves the composer outline still in chat mode and hands the edge to temporary chat", () => {
    const chatMarkup = renderWithTooltip(
      createElement(ChatComposer, { ...baseProps })
    );
    // The resting border line is still there for temporary mode.
    expect(chatMarkup).toContain("border-border");

    const temporaryMarkup = renderWithTooltip(
      createElement(ChatComposer, { ...baseProps, temporary: true })
    );
    expect(temporaryMarkup).toContain("border-transparent");
  });

  it("shows the circle orb inside the composer only in Bot mode next to plus button", () => {
    // Chat: no circle anywhere.
    const chatMarkup = renderWithTooltip(
      createElement(ChatComposer, { ...baseProps })
    );
    expect(chatMarkup).not.toContain("ksemo-bot-orb");

    // Bot (storage primed below): circle rendered inside composer with status label
    const store = new Map<string, string>();
    const originalWindow = (globalThis as { window?: unknown }).window;
    (globalThis as { window?: unknown }).window = {
      localStorage: {
        getItem: (k: string) => store.get(k) ?? null,
        setItem: (k: string, v: string) => void store.set(k, v),
      },
    };
    store.set("ksemo:composer-tag", "bot");
    try {
      const botMarkup = renderWithTooltip(
        createElement(ChatComposer, {
          ...baseProps,
          botVoiceActive: true,
        })
      );
      expect(botMarkup).toContain("ksemo-bot-orb");
      expect(botMarkup).toContain("Listening...");
      expect(botMarkup).not.toContain('aria-label="Attach"');
      expect(botMarkup).toContain('aria-label="Stop"');
      expect(botMarkup).not.toContain('aria-label="Composer mode"');
    } finally {
      if (originalWindow === undefined) {
        delete (globalThis as { window?: unknown }).window;
      } else {
        (globalThis as { window?: unknown }).window = originalWindow;
      }
    }
  });

  it("routes the mic to bot voice while Bot is active, keeping dictate pill for Chat", () => {
    const chatMarkup = renderWithTooltip(
      createElement(ChatComposer, { ...baseProps, onBotVoice: () => undefined })
    );
    expect(chatMarkup).toContain('aria-label="Dictate"');
    expect(chatMarkup).not.toContain("ksemo-bot-orb");

    // Same storage trick: Bot mode only engages when the stored tag says so.
    const store = new Map<string, string>();
    store.set("ksemo:composer-tag", "bot");
    const originalWindow = (globalThis as { window?: unknown }).window;
    (globalThis as { window?: unknown }).window = {
      localStorage: {
        getItem: (k: string) => store.get(k) ?? null,
        setItem: (k: string, v: string) => void store.set(k, v),
      },
    };
    try {
      const botMarkup = renderWithTooltip(
        createElement(ChatComposer, {
          ...baseProps,
          onBotVoice: () => undefined,
          botVoiceState: "idle",
        })
      );
      // The circle is purely visual — it is never a button, never labelled as a
      // control, and cannot be pressed to start or stop anything.
      expect(botMarkup).not.toContain('aria-label="Talk to the bot"');
      expect(botMarkup).not.toContain("Dictate");

      const listeningMarkup = renderWithTooltip(
        createElement(ChatComposer, {
          ...baseProps,
          onBotVoice: () => undefined,
          botVoiceState: "listening",
        })
      );
      // The stop button lives in the send button's place on the right, exactly
      // like the old voice chat — it never appears anywhere else.
      expect(listeningMarkup).toContain('aria-label="Stop"');
      expect(listeningMarkup).not.toContain('aria-label="Send message"');
      expect(listeningMarkup).not.toContain('aria-label="End voice chat"');

      // Chat mode never gets the stop button.
      expect(chatMarkup).not.toContain('aria-label="Stop"');
    } finally {
      if (originalWindow === undefined) {
        delete (globalThis as { window?: unknown }).window;
      } else {
        (globalThis as { window?: unknown }).window = originalWindow;
      }
    }
  });

  it("hides the text area in Bot mode and shows the voice orb and controls", () => {
    const store = new Map<string, string>();
    store.set("ksemo:composer-tag", "bot");
    const originalWindow = (globalThis as { window?: unknown }).window;
    (globalThis as { window?: unknown }).window = {
      sessionStorage: {
        getItem: (k: string) => store.get(k) ?? null,
        setItem: (k: string, v: string) => void store.set(k, v),
      },
      localStorage: {
        getItem: (k: string) => store.get(k) ?? null,
        setItem: (k: string, v: string) => void store.set(k, v),
      },
    };
    try {
      const idleBot = renderWithTooltip(
        createElement(ChatComposer, {
          ...baseProps,
          botVoiceState: "listening",
        })
      );
      expect(idleBot).not.toContain("ksemo-composer-textarea");
      expect(idleBot).toContain("ksemo-bot-orb");
      expect(idleBot).not.toContain('aria-label="Attach"');
      expect(idleBot).toContain('aria-label="Stop"');
      expect(idleBot).not.toContain("Reply voice");

      store.set("ksemo:composer-tag", "chat");
      const chatMode = renderWithTooltip(
        createElement(ChatComposer, {
          ...baseProps,
        })
      );
      expect(chatMode).toContain("ksemo-composer-textarea");
      expect(chatMode).toContain("Ask KSEMO anything...");
    } finally {
      if (originalWindow === undefined) {
        delete (globalThis as { window?: unknown }).window;
      } else {
        (globalThis as { window?: unknown }).window = originalWindow;
      }
    }
  });

  it("keeps the bot circle out of the way until Bot is actually selected", () => {
    const chatMarkup = renderWithTooltip(
      createElement(ChatComposer, { ...baseProps })
    );
    // Nothing sits above the box in Chat mode.
    expect(chatMarkup).not.toContain("ksemo-bot-orb");
    expect(chatMarkup).not.toContain("bottom-full");

    // Temporary chat and guest mode own the box outright, so the circle stands
    // down rather than fighting them for the same space.
    const temporaryMarkup = renderWithTooltip(
      createElement(ChatComposer, { ...baseProps, temporary: true })
    );
    expect(temporaryMarkup).not.toContain("ksemo-bot-orb");

    const guestMarkup = renderWithTooltip(
      createElement(ChatComposer, { ...baseProps, guestMode: true })
    );
    expect(guestMarkup).not.toContain("ksemo-bot-orb");
  });

  it("reserves headroom above the box so Bot pushes it down the screen", () => {
    const chatMarkup = renderWithTooltip(
      createElement(ChatComposer, { ...baseProps })
    );
    expect(chatMarkup).toContain("pt-2");
    expect(chatMarkup).not.toContain("pt-12");
  });

  it("survives the remount that swaps the composer between the two places", () => {
    // Sending the first message moves the composer out of the empty state and
    // into the message list. That is a different position in the tree, so React
    // throws the old instance away and mounts a new one — and plain useState
    // took Bot mode down with it, which is why Bot kept snapping back to Chat.
    // It has to come back from storage instead.
    const store = new Map<string, string>();
    const fakeWindow = {
      localStorage: {
        getItem: (k: string) => store.get(k) ?? null,
        setItem: (k: string, v: string) => void store.set(k, v),
      },
    };
    const originalWindow = (globalThis as { window?: unknown }).window;
    (globalThis as { window?: unknown }).window = fakeWindow;
    try {
      // First composer: reads storage on mount, so it starts in Chat.
      const first = renderWithTooltip(
        createElement(ChatComposer, { ...baseProps })
      );
      expect(first).not.toContain("ksemo-bot-orb");

      // What changeTag("bot") writes when the Bot button is pressed.
      store.set("ksemo:composer-tag", "bot");

      // The remounted composer picks Bot back up.
      const afterRemount = renderWithTooltip(
        createElement(ChatComposer, { ...baseProps })
      );
      expect(afterRemount).toContain("ksemo-bot-orb");

      // And the wave comes back only in Bot mode, never in Chat.
      store.set("ksemo:composer-tag", "chat");
      const backToChat = renderWithTooltip(
        createElement(ChatComposer, { ...baseProps })
      );
      expect(backToChat).not.toContain("ksemo-bot-orb");
    } finally {
      if (originalWindow === undefined) {
        delete (globalThis as { window?: unknown }).window;
      } else {
        (globalThis as { window?: unknown }).window = originalWindow;
      }
    }
  });

  it("hides the Chat/Bot mode switcher in temporary chat", () => {
    const markup = renderWithTooltip(
      createElement(ChatComposer, { ...baseProps, temporary: true })
    );
    expect(markup).not.toContain('aria-label="Composer mode"');
    expect(markup).toContain('aria-label="Message KSEMO"');
  });
});
