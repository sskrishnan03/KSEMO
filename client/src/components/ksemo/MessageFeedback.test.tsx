import { renderToStaticMarkup } from "react-dom/server";
import React, { createElement } from "react";
import { describe, expect, it } from "vitest";

import { TooltipProvider } from "@/components/ui/tooltip";
import { MessageFeedback } from "./MessageFeedback";

function render(element: React.ReactElement) {
  return renderToStaticMarkup(createElement(TooltipProvider, null, element));
}

function countOccurrences(haystack: string, needle: string): number {
  return haystack.split(needle).length - 1;
}

describe("MessageFeedback good/bad response toggle", () => {
  it("renders both thumbs unpressed when the message is unrated", () => {
    const markup = render(
      createElement(MessageFeedback, { value: null, onToggle: () => undefined })
    );

    expect(markup).toContain('aria-label="Good response"');
    expect(markup).toContain('aria-label="Bad response"');
    expect(markup).toContain('aria-pressed="false"');
    expect(countOccurrences(markup, 'aria-pressed="true"')).toBe(0);
    expect(markup).not.toContain("ksemo-feedback-thumb-active");
    expect(markup).not.toContain("fill-current");
    expect(markup).not.toContain("ksemo-feedback-thumb-pop");
  });

  it("animates and fills only the good thumb when rated up", () => {
    const markup = render(
      createElement(MessageFeedback, { value: "up", onToggle: () => undefined })
    );

    expect(countOccurrences(markup, 'aria-pressed="true"')).toBe(1);
    expect(countOccurrences(markup, "ksemo-feedback-thumb-pop")).toBe(1);
    expect(countOccurrences(markup, "ksemo-feedback-thumb-active")).toBe(1);
  });

  it("animates and fills only the bad thumb when rated down", () => {
    const markup = render(
      createElement(MessageFeedback, {
        value: "down",
        onToggle: () => undefined,
      })
    );

    expect(countOccurrences(markup, 'aria-pressed="true"')).toBe(1);
    expect(countOccurrences(markup, "ksemo-feedback-thumb-pop")).toBe(1);
    expect(countOccurrences(markup, "ksemo-feedback-thumb-active")).toBe(1);
  });

  it("never fills the glyph solid, which would hide the icon", () => {
    for (const value of ["up", "down"] as const) {
      const markup = render(
        createElement(MessageFeedback, { value, onToggle: () => undefined })
      );

      // `fill-current` floods an outline glyph and erases its detail; the
      // tinted fill must come from the low-opacity class instead.
      expect(markup).not.toContain("fill-current");
      expect(markup).not.toContain("fill-opacity-100");
    }
  });

  it("leaves the icon bare, with nothing drawn around it", () => {
    for (const value of ["up", "down"] as const) {
      const markup = render(
        createElement(MessageFeedback, { value, onToggle: () => undefined })
      );

      // No outline, no chip, no ring, no overlay — just the two thumb glyphs.
      expect(markup).not.toContain("<span");
      expect(markup).not.toContain("ksemo-feedback-outline-in");
      expect(markup).not.toContain("ksemo-feedback-ring");
      expect(markup).not.toContain("rounded-[");
      expect(countOccurrences(markup, "<svg")).toBe(2);
    }
  });

  it("leaves the button itself free of any border", () => {
    const markup = render(
      createElement(MessageFeedback, { value: "up", onToggle: () => undefined })
    );

    // The base button class ships an `aria-invalid:border-*` variant, so
    // variant-prefixed tokens are filtered out before checking.
    const buttonTag = markup.slice(0, markup.indexOf(">") + 1);
    const buttonClasses = buttonTag.match(/class="([^"]*)"/)?.[1] ?? "";
    const ownBorderTokens = buttonClasses
      .split(/\s+/)
      .filter(token => !token.includes(":"))
      .filter(token => token === "border" || token.startsWith("border-"));
    expect(ownBorderTokens).toEqual([]);
  });

  it("holds the chosen thumb's hover look steady so no highlight lingers", () => {
    const markup = render(
      createElement(MessageFeedback, { value: "up", onToggle: () => undefined })
    );

    const buttonTags = [...markup.matchAll(/<button[\s\S]*?>/g)].map(m => m[0]);
    expect(buttonTags).toHaveLength(2);

    const [good, bad] = buttonTags.map(
      tag => tag.match(/class="([^"]*)"/)?.[1] ?? ""
    );

    // The chosen thumb hovers to exactly the colour it already sits at, so
    // moving the pointer over it produces no change.
    expect(good).toContain("bg-accent/70");
    expect(good).toContain("hover:bg-accent/70");
    expect(good).toContain("hover:text-foreground");
    expect(good).not.toMatch(/(^|\s)hover:bg-accent(\s|$)/);

    // The unrated thumb still lights up normally on hover.
    expect(bad).toContain("hover:bg-accent");
    expect(bad).not.toContain("hover:bg-accent/70");
  });

  it("renders the thumbs in reading order", () => {
    const markup = render(
      createElement(MessageFeedback, { value: "up", onToggle: () => undefined })
    );

    expect(markup.startsWith("<button")).toBe(true);
    expect(markup.indexOf('aria-label="Good response"')).toBeLessThan(
      markup.indexOf('aria-label="Bad response"')
    );
  });
});
