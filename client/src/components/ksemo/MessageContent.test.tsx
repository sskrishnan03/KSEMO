import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import { describe, expect, it, vi } from "vitest";

vi.mock("streamdown", () => ({ Streamdown: () => null }));

import { TooltipProvider } from "@/components/ui/tooltip";
import { MessageContent } from "./MessageContent";

function renderWithTooltip(element: React.ReactElement) {
  return renderToStaticMarkup(createElement(TooltipProvider, null, element));
}

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
    const markup = renderWithTooltip(
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
    const markup = renderWithTooltip(
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
    const markup = renderWithTooltip(
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
    const markup = renderWithTooltip(
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
        onDelete: () => undefined,
      })
    );
    expect(markup).toContain('aria-label="Copy message"');
    expect(markup).toContain('aria-label="Share message"');
    expect(markup).toContain('aria-label="Edit message"');
    expect(markup).not.toContain('aria-label="View version history"');
    expect(markup).not.toContain('aria-label="Delete message"');
    expect(markup).not.toContain("lucide-user-round");
  });

  it("renders an inline editor with Cancel and Save buttons when isEditing is true", () => {
    const markup = renderWithTooltip(
      createElement(MessageContent, {
        message: {
          id: "user-1",
          role: "user",
          content: "Original prompt",
          status: "completed",
        },
        ...callbacks,
        isSpeaking: false,
        speechState: "idle",
        isEditing: true,
        editValue: "Updated prompt text",
        onEdit: () => undefined,
      })
    );
    expect(markup).toContain("Updated prompt text");
    expect(markup).toContain("Cancel");
    expect(markup).toContain("Save");
    expect(markup).toContain("border-border/80");
    expect(markup).toContain("bg-background/80");
    expect(markup).not.toContain('aria-label="Edit message"');
  });

  it("uses matched readable response typography with deliberately spaced compact action rows", () => {
    const markup = renderWithTooltip(
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

  it("renders nothing for a failed assistant response with no content", () => {
    const markup = renderWithTooltip(
      createElement(MessageContent, {
        message: { ...assistantMessage, status: "failed", content: "" },
        ...callbacks,
        isSpeaking: false,
        speechState: "idle",
        onRetry: () => undefined,
        onRegenerate: () => undefined,
      })
    );
    expect(markup).not.toContain("Try again");
    expect(markup).not.toContain('aria-label="Regenerate response"');
  });

  it("renders linked user media before the associated message text", () => {
    const markup = renderWithTooltip(
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
    expect(markup).toContain("/ksemo-storage/scene.jpg");
    expect(markup.indexOf("scene.jpg")).toBeLessThan(
      markup.indexOf("What is in this image?")
    );
  });
});
