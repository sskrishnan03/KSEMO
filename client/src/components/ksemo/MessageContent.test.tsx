import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import { describe, expect, it, vi } from "vitest";

vi.mock("streamdown", () => ({
  Streamdown: () => null,
  defaultRehypePlugins: {},
}));

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

const OVERFLOW_LABEL = 'aria-label="More message actions"';

describe("MessageContent speech controls", () => {
  it("keeps read-aloud behind the overflow menu for an idle assistant message", () => {
    const markup = renderWithTooltip(
      createElement(MessageContent, {
        message: assistantMessage,
        ...callbacks,
        isSpeaking: false,
        speechState: "idle",
      })
    );
    expect(markup).toContain(OVERFLOW_LABEL);
    // One plain list-arrow button opens the menu — no sliders glyph, no chevron.
    expect(markup).toContain('data-testid="actions-menu-glyph"');
    expect(markup).not.toContain("lucide-plus");
    expect(markup).not.toContain("lucide-sliders-horizontal");
    expect(markup).not.toContain("lucide-chevron-down");
    expect(markup).not.toContain("lucide-ellipsis");
    expect(markup).not.toContain(">Actions</span>");
    // Same plain icon surface across Copy, rating, and the menu trigger.
    expect(markup).toContain("size-8 rounded-md");
    // Copy sits at 17px while the menu trigger glyph stays 24px.
    expect(markup).toContain("lucide lucide-copy size-[17px]");
    expect(markup).toContain(
      'hover:text-foreground" type="button" aria-label="More message actions"'
    );
    // Only the arrow inside the glyph flips while the menu is open.
    expect(markup).toContain("transition-transform duration-300");
    expect(markup).toContain('aria-label="Copy response"');
    expect(markup).not.toContain('aria-label="Read aloud"');
  });

  it("keeps the icon-only trigger and reflects the rating in its accessible name", () => {
    const markup = renderWithTooltip(
      createElement(MessageContent, {
        message: assistantMessage,
        ...callbacks,
        isSpeaking: false,
        speechState: "idle",
        onFeedback: () => undefined,
        feedback: "up",
      })
    );
    expect(markup).toContain('aria-label="Remove good response"');
    expect(markup).toContain('data-testid="actions-menu-glyph"');
    expect(markup).not.toContain(">Rated</span>");
    // Rating shows as a real 17px thumb icon button after Copy, not a corner dot.
    expect(markup).toContain("lucide-thumbs-up");
    expect(markup).toContain("size-[17px] text-emerald-600");
    expect(markup).toContain("text-emerald-600");
    expect(markup).not.toContain("size-1.5 rounded-full ring-2 ring-card");
  });

  it("surfaces the live equalizer on the overflow trigger while speech is playing", () => {
    const markup = renderWithTooltip(
      createElement(MessageContent, {
        message: assistantMessage,
        ...callbacks,
        isSpeaking: true,
        speechState: "playing",
      })
    );
    expect(markup).toContain('aria-label="Stop reading"');
    // The trigger swaps the plus for the equalizer and keeps no chevron.
    expect(markup).not.toContain("lucide-sliders-horizontal");
    expect(markup).not.toContain("lucide-chevron-down");
    expect(markup).not.toContain(">Stop</span>");
    // The equalizer sits in a fixed 24px box so the pill never resizes.
    expect(markup).toContain("size-6 shrink-0");
  });

  it("shows the same segmented ring used by Dictate transcribing while audio is preparing", () => {
    const markup = renderWithTooltip(
      createElement(MessageContent, {
        message: assistantMessage,
        ...callbacks,
        isSpeaking: true,
        speechState: "buffering",
        isPreparingSpeech: true,
      })
    );
    expect(markup).toContain('aria-label="Preparing audio"');
    expect(markup).toContain('aria-live="polite"');
    expect(markup).toContain('aria-label="Copy response"');
    expect(markup).toContain('class="loader text-current"');
    expect(markup).toContain("width:16px");
    expect(markup).not.toContain(">Preparing</span>");
  });

  it("groups copy, read aloud, and regenerate without share or delete controls", () => {
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
    expect(markup).toContain('aria-label="Copy response"');
    expect(markup).toContain(OVERFLOW_LABEL);
    expect(markup).not.toContain('aria-label="Share response"');
    expect(markup).not.toContain('aria-label="Delete message"');
    expect(markup).not.toContain("lucide-share-2");
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
    expect(markup).not.toContain(OVERFLOW_LABEL);
  });

  it("renders a centered interrupted divider line and action bar when stopped with partial content", () => {
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
    expect(markup).toContain(OVERFLOW_LABEL);
    expect(markup).toContain('aria-label="Copy response"');
    expect(markup).not.toContain('aria-label="Share response"');
  });

  it("renders centered interrupted divider line when stopped with no content", () => {
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
    expect(markup).toContain(OVERFLOW_LABEL);
    expect(markup).not.toContain('aria-label="Copy response"');
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
    // No inline retry banner, no copy (no content) — only the overflow menu.
    expect(markup).not.toContain("Try again");
    expect(markup).not.toContain('aria-label="Copy response"');
    expect(markup).not.toContain("lucide-copy");
    expect(markup).toContain(OVERFLOW_LABEL);
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
        fileCreationNode: createElement(
          "div",
          { "data-testid": "test-file-card" },
          "FileCardContent"
        ),
        onRegenerate: () => undefined,
      })
    );
    expect(markup).toContain('data-testid="test-file-card"');
    expect(markup).toContain(OVERFLOW_LABEL);
    expect(markup.indexOf('data-testid="test-file-card"')).toBeLessThan(
      markup.indexOf(OVERFLOW_LABEL)
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
        fileCreationNode: createElement(
          "div",
          { "data-testid": "drafting-card" },
          "Drafting"
        ),
        onRegenerate: () => undefined,
        onShare: () => undefined,
        onFeedback: () => undefined,
      })
    );

    // Drafting node is rendered
    expect(markup).toContain('data-testid="drafting-card"');

    // Assistant action bar must be completely hidden while generating
    expect(markup).not.toContain('aria-label="Copy response"');
    expect(markup).not.toContain('aria-label="Read aloud"');
    expect(markup).not.toContain('aria-label="Share response"');
    expect(markup).not.toContain(OVERFLOW_LABEL);
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
        fileCreationNode: createElement(
          "div",
          { "data-testid": "completed-card" },
          "Completed"
        ),
        onRegenerate: () => undefined,
        onShare: () => undefined,
      })
    );

    // Both completed card and action buttons are present
    expect(markup).toContain('data-testid="completed-card"');
    expect(markup).toContain('aria-label="Copy response"');
    expect(markup).toContain(OVERFLOW_LABEL);
    expect(markup).not.toContain('aria-label="Share response"');
  });
});

describe("MessageContent response feedback", () => {
  function renderFeedback(feedback: "up" | "down" | null) {
    return renderWithTooltip(
      createElement(MessageContent, {
        message: assistantMessage,
        ...callbacks,
        isSpeaking: false,
        speechState: "idle",
        onFeedback: () => undefined,
        feedback,
      })
    );
  }

  it("collapses the thumbs into the overflow menu for an unrated response", () => {
    const markup = renderFeedback(null);

    expect(markup).toContain(OVERFLOW_LABEL);
    expect(markup).not.toContain('aria-label="Good response"');
    expect(markup).not.toContain('aria-label="Bad response"');
    // No rating icon until a rating is chosen.
    expect(markup).not.toContain("text-emerald-600");
    expect(markup).not.toContain("text-rose-600");
    expect(markup).not.toContain("ksemo-feedback-thumb-active");
    // Icon-only trigger: no visible word.
    expect(markup).not.toContain(">Actions</span>");
  });

  it("shows a green thumb icon after Copy when rated up", () => {
    const markup = renderFeedback("up");

    expect(markup).toContain('aria-label="Remove good response"');
    expect(markup).toContain("lucide-thumbs-up");
    expect(markup).toContain("text-emerald-600");
    expect(markup).not.toContain("lucide-thumbs-down");
  });

  it("shows a red thumb icon after Copy when rated down", () => {
    const markup = renderFeedback("down");

    expect(markup).toContain('aria-label="Remove bad response"');
    expect(markup).toContain("lucide-thumbs-down");
    expect(markup).toContain("text-rose-600");
    expect(markup).not.toContain("lucide-thumbs-up");
  });

  it("hides the overflow menu when no feedback handler is supplied", () => {
    const markup = renderWithTooltip(
      createElement(MessageContent, {
        message: assistantMessage,
        ...callbacks,
        isSpeaking: false,
        speechState: "idle",
        feedback: "up",
      })
    );

    expect(markup).not.toContain("bg-emerald-500");
    expect(markup).not.toContain("bg-rose-500");
  });
});
