import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import { describe, expect, it, vi } from "vitest";

vi.mock("streamdown", () => ({ Streamdown: () => null }));

import { MessageContent } from "./MessageContent";

const assistantMessage = {
  id: "assistant-1",
  role: "assistant" as const,
  content: "A clear assistant response.",
  status: "completed" as const,
};

const callbacks = {
  onSpeak: () => undefined,
  onPause: () => undefined,
  onResume: () => undefined,
  onStop: () => undefined,
};

describe("MessageContent speech controls", () => {
  it("renders a compact overflow entry for idle assistant read-aloud", () => {
    const markup = renderToStaticMarkup(
      createElement(MessageContent, {
        message: assistantMessage,
        ...callbacks,
        isSpeaking: false,
        speechState: "idle",
      })
    );
    expect(markup).toContain('aria-label="More message actions"');
  });

  it("keeps active speech controls available through the assistant overflow", () => {
    const markup = renderToStaticMarkup(
      createElement(MessageContent, {
        message: assistantMessage,
        ...callbacks,
        isSpeaking: true,
        speechState: "playing",
      })
    );
    expect(markup).toContain('aria-label="More message actions"');
  });

  it("renders share, regenerate, and compact overflow entry points when those real handlers are available", () => {
    const markup = renderToStaticMarkup(
      createElement(MessageContent, {
        message: assistantMessage,
        ...callbacks,
        isSpeaking: false,
        speechState: "idle",
        onShare: () => undefined,
        onRegenerate: () => undefined,
        onDelete: () => undefined,
      })
    );
    expect(markup).toContain('aria-label="Share response"');
    expect(markup).toContain('aria-label="Regenerate response"');
    expect(markup).toContain('aria-label="More message actions"');
    expect(markup).toContain('data-has-delete="true"');
  });

  it("keeps user actions hover-oriented with direct version history and without an avatar or delete control", () => {
    const markup = renderToStaticMarkup(
      createElement(MessageContent, {
        message: {
          id: "user-1",
          role: "user",
          content: "Edited request",
          status: "completed",
        },
        ...callbacks,
        isSpeaking: false,
        speechState: "idle",
        onShare: () => undefined,
        onEdit: () => undefined,
        onViewHistory: () => undefined,
        onDelete: () => undefined,
      })
    );
    expect(markup).toContain('aria-label="Copy message"');
    expect(markup).toContain('aria-label="Share message"');
    expect(markup).toContain('aria-label="Edit message"');
    expect(markup).toContain('aria-label="View version history"');
    expect(markup).not.toContain('aria-label="Delete message"');
    expect(markup).not.toContain("lucide-user-round");
  });

  it("uses matched readable response typography with deliberately spaced compact action rows", () => {
    const markup = renderToStaticMarkup(
      createElement(MessageContent, {
        message: assistantMessage,
        ...callbacks,
        isSpeaking: false,
        speechState: "idle",
      })
    );
    expect(markup).toContain("text-[15px]");
    expect(markup).toContain("gap-1");
  });

  it("surfaces a retry action for a failed assistant response instead of the completed-response regenerate control", () => {
    const markup = renderToStaticMarkup(
      createElement(MessageContent, {
        message: { ...assistantMessage, status: "failed", content: "" },
        ...callbacks,
        isSpeaking: false,
        speechState: "idle",
        onRetry: () => undefined,
        onRegenerate: () => undefined,
      })
    );
    expect(markup).toContain("Try again");
    expect(markup).not.toContain('aria-label="Regenerate response"');
  });

  it("renders linked user media before the associated message text", () => {
    const markup = renderToStaticMarkup(
      createElement(MessageContent, {
        message: {
          id: "user-media",
          role: "user",
          content: "What is in this image?",
          status: "completed",
          attachments: [
            {
              id: "file-1",
              filename: "scene.jpg",
              mimeType: "image/jpeg",
              url: "/ksemo-storage/scene.jpg",
            },
          ],
        },
        ...callbacks,
        isSpeaking: false,
        speechState: "idle",
      })
    );
    expect(markup).toContain("scene.jpg");
    expect(markup).toContain("Image attached");
    expect(markup.indexOf("scene.jpg")).toBeLessThan(
      markup.indexOf("What is in this image?")
    );
  });
});
