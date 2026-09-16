import { describe, expect, it } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { TemporaryChatIcon } from "./icons";

describe("TemporaryChatIcon", () => {
  it("renders with correct tight viewBox and SVG attributes without black background", () => {
    const markup = renderToStaticMarkup(<TemporaryChatIcon className="size-[26px]" />);
    expect(markup).toContain('viewBox="334 327.6 356 356"');
    expect(markup).toContain('aria-hidden="true"');
    expect(markup).toContain('size-[26px]');
    expect(markup).not.toContain('stop-color="#0e0f12"');
  });

  it("contains bubble, 3 dots, clock and hands, and no decorative outer ring", () => {
    const markup = renderToStaticMarkup(<TemporaryChatIcon />);

    // Verify 3 dots
    expect(markup).toContain('cx="445.4" cy="490.4" r="19" fill="currentColor"');
    expect(markup).toContain('cx="501.3" cy="490.4" r="19" fill="currentColor"');
    expect(markup).toContain('cx="558.2" cy="490.4" r="19" fill="currentColor"');

    // Verify clock circle & hands
    expect(markup).toContain('cx="604.5" cy="580.2" r="59"');
    expect(markup).toContain('604.5 556');
    expect(markup).toContain('628.5 580.2');

    // Verify the bubble is clipped so it never draws inside the clock circle
    expect(markup).toContain('<clipPath');
    expect(markup).toContain('fill-rule="evenodd"');
    expect(markup).toContain('clip-path="url(');

    // Verify the outer arcs and radiating marks were removed
    expect(markup).not.toContain('A 216 216 0 0 1');
    expect(markup).not.toContain('A 219 219 0 0 1');
    expect(markup).not.toContain('A 234 234 0 0 1');
    expect(markup).not.toContain('L 661.3 268.6');
    expect(markup).not.toContain('L 735.8 308.8');
    expect(markup).not.toContain('L 760.5 384.5');
    expect(markup).not.toContain('<linearGradient');
  });

  it("keeps the monochrome outline in active state and adds loading animations instead", () => {
    const defaultMarkup = renderToStaticMarkup(<TemporaryChatIcon active={false} />);
    const activeMarkup = renderToStaticMarkup(<TemporaryChatIcon active={true} />);

    // The icon never tints its own bubble/clock (no white wash on click);
    // active state only differs by the loading animations.
    expect(defaultMarkup).toContain('fill-opacity="0"');
    expect(activeMarkup).toContain('fill-opacity="0"');

    // Active adds the dots loading animation and the spinning clock.
    expect(defaultMarkup).not.toContain("animateTransform");
    expect(activeMarkup).toContain("animateTransform");
    expect(activeMarkup).toContain('type="translate"');
    expect(activeMarkup).toContain('type="rotate"');
  });
});