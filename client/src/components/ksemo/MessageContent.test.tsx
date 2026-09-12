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
    expect(markup).not.toContain('aria-label="Share message"');
    expect(markup).toContain('aria-label="Edit message"');
    expect(markup).not.toContain('aria-label="View version history"');
    expect(markup).not.toContain('aria-label="Delete message"');
    expect(markup).not.toContain("lucide-user-round");
  });

  it("renders a centered interrupted divider line and action bar regenerate when assistant response is stopped with partial content", () => {
    const markup = renderWithTooltip(
      createElement(MessageContent, {
        message: {
          id: "assistant-stopped",
          role: "assistant",
          content: "Partial answer before stopping...",
          status: "cancelled",
        },
        ...callbacks,
        isSpeaking: false,
        speechState: "idle",
        onRegenerate: () => undefined,
        onShare: () => undefined,
        onDelete: () => undefined,
      })
    );
    expect(markup).toContain("Response generation was interrupted");
    expect(markup).toContain('data-testid="stopped-response-notice"');
    expect(markup).toContain('aria-label="Regenerate response"');
    expect(markup).toContain('aria-label="Copy response"');
    expect(markup).toContain('aria-label="Share response"');
  });

  it("renders centered interrupted divider line and action bar regenerate when assistant response is stopped with no content", () => {
    const markup = renderWithTooltip(
      createElement(MessageContent, {
        message: {
          id: "assistant-stopped-empty",
          role: "assistant",
          content: "",
          status: "cancelled",
        },
        ...callbacks,
        isSpeaking: false,
        speechState: "idle",
        onRegenerate: () => undefined,
      })
    );
    expect(markup).toContain("Response generation was interrupted");
    expect(markup).toContain('data-testid="stopped-response-notice"');
    expect(markup).toContain('aria-label="Regenerate response"');
  });

  it("renders user message normally in workspace without inline editor when isEditing is true", () => {
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
    expect(markup).toContain("Original prompt");
    expect(markup).not.toContain("<textarea");
    expect(markup).not.toContain("Cancel");
    expect(markup).not.toContain("Save");
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

  it("renders fileCreationNode before assistant message action buttons", () => {
    const markup = renderWithTooltip(
      createElement(MessageContent, {
        message: assistantMessage,
        ...callbacks,
        isSpeaking: false,
        speechState: "idle",
        fileCreationNode: createElement("div", { "data-testid": "test-file-card" }, "FileCardContent"),
        onRegenerate: () => undefined,
      })
    );
    expect(markup).toContain('data-testid="test-file-card"');
    expect(markup).toContain('aria-label="Regenerate response"');
    expect(markup.indexOf('data-testid="test-file-card"')).toBeLessThan(
      markup.indexOf('aria-label="Regenerate response"')
    );
  });

  it("completely suppresses assistant action buttons while file generation is in progress", () => {
    const markup = renderWithTooltip(
      createElement(MessageContent, {
        message: {
          ...assistantMessage,
          fileGeneration: {
            stage: "generating",
            format: "pdf",
            status: "processing",
          },
        },
        ...callbacks,
        isSpeaking: false,
        speechState: "idle",
        isFileGenerating: true,
        fileCreationNode: createElement("div", { "data-testid": "drafting-card" }, "Drafting"),
        onRegenerate: () => undefined,
        onShare: () => undefined,
        onFeedback: () => undefined,
      })
    );

    // Drafting node is rendered
    expect(markup).toContain('data-testid="drafting-card"');

    // Assistant action bar must be completely hidden while generating
    expect(markup).not.toContain('aria-label="Copy response"');
    expect(markup).not.toContain('aria-label="Share response"');
    expect(markup).not.toContain('aria-label="Regenerate response"');
    expect(markup).not.toContain('aria-label="Good response"');
    expect(markup).not.toContain('aria-label="Bad response"');
    expect(markup).not.toContain('aria-label="More message actions"');
  });

  it("renders assistant action buttons once file generation completes", () => {
    const markup = renderWithTooltip(
      createElement(MessageContent, {
        message: {
          ...assistantMessage,
          fileGeneration: {
            stage: "completed",
            format: "pdf",
            status: "created",
          },
        },
        ...callbacks,
        isSpeaking: false,
        speechState: "idle",
        isFileGenerating: false,
        fileCreationNode: createElement("div", { "data-testid": "completed-card" }, "Completed"),
        onRegenerate: () => undefined,
        onShare: () => undefined,
      })
    );

    // Both completed card and action buttons are present
    expect(markup).toContain('data-testid="completed-card"');
    expect(markup).toContain('aria-label="Copy response"');
    expect(markup).toContain('aria-label="Share response"');
    expect(markup).toContain('aria-label="Regenerate response"');
  });
});
