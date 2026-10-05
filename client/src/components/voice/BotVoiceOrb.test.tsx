import { createElement, type ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { BotVoiceOrb } from "@/components/voice/BotVoiceOrb";

function renderOrb(element: ReactElement) {
  return renderToStaticMarkup(element);
}

describe("BotVoiceOrb", () => {
  it("renders a compact, borderless elemental orb", () => {
    const markup = renderOrb(createElement(BotVoiceOrb, {}));
    expect(markup).toContain("ksemo-bot-orb");
    expect(markup).toContain("rounded-full");
    expect(markup).toContain("elemental-orb--water");
    expect(markup).not.toContain("svg");
    expect(markup).not.toContain("stroke");
  });

  it("is purely visual — a hidden from screen readers span, never a button", () => {
    const markup = renderOrb(createElement(BotVoiceOrb, {}));
    expect(markup).toContain("<span");
    expect(markup).toContain('aria-hidden="true"');
    expect(markup).not.toContain("<button");
    expect(markup).not.toContain("onclick");
  });

  it("honours caller sizing and positioning, e.g. the chat box's top-left corner", () => {
    const markup = renderOrb(
      createElement(BotVoiceOrb, {
        className: "absolute bottom-full left-3 mb-1 size-12",
      })
    );
    expect(markup).toContain("absolute bottom-full left-3 mb-1 size-12");
  });
});
