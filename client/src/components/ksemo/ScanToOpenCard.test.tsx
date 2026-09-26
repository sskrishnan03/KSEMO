import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { ScanToOpenCard } from "./ScanToOpenCard";

function render() {
  return renderToStaticMarkup(createElement(ScanToOpenCard));
}

/** The tests run in a `node` env, so `window` has to be supplied by hand. */
function withViewportWidth<T>(width: number, run: () => T): T {
  const globals = globalThis as { window?: { innerWidth: number } };
  const previous = globals.window;
  globals.window = { innerWidth: width };
  try {
    return run();
  } finally {
    if (previous === undefined) delete globals.window;
    else globals.window = previous;
  }
}

describe("KSEMO scan-to-open card", () => {
  it("pins to the bottom of the viewport as a fixed, out-of-flow overlay", () => {
    const markup = render();
    // `fixed` keeps it outside the sidebar's layout and scroll.
    expect(markup).toContain("fixed");
    expect(markup).toContain("bottom-5");
    // Above the sidebar's z-50 mobile drawer, so it is never hidden behind it.
    expect(markup).toContain("z-[60]");
    // The wrapper is click-through; only the card itself accepts clicks.
    expect(markup).toContain("pointer-events-none");
    expect(markup).toContain("pointer-events-auto");
  });

  it("leaves its horizontal offset to the caller, which clears the sidebar", () => {
    // The sidebar is 17.25rem wide expanded and w-16 collapsed, so the card
    // must not hardcode a left offset of its own.
    expect(render()).not.toMatch(/class="[^"]*\bleft-/);
  });

  it("honours an offset passed in by the caller", () => {
    const markup = renderToStaticMarkup(
      createElement(ScanToOpenCard, {
        className: "left-[18.5rem]",
      })
    );
    expect(markup).toContain("left-[18.5rem]");
  });

  it("stays hidden on phones, where a scan code is useless", () => {
    // `hidden lg:block` is the CSS gate; it holds before hydration too.
    expect(render()).toContain("hidden lg:block");
  });

  it("renders nothing at phone width, so it never covers the composer", () => {
    expect(withViewportWidth(390, render)).toBe("");
    expect(withViewportWidth(1023, render)).toBe("");
  });

  it("does render at desktop width", () => {
    // Proves the mobile guard is a real branch and not an always-empty card.
    expect(withViewportWidth(1024, render)).not.toBe("");
    expect(withViewportWidth(1440, render)).toContain("Scan to open on mobile");
  });

  it("shows a large, sharp-cornered, uncropped code", () => {
    const img = /<img[^>]*alt="Scan to open[^>]*>/.exec(render())?.[0] ?? "";
    expect(img).not.toBe("");
    expect(img).toContain("size-36");
    expect(img).toContain("object-contain");
    expect(img).toContain('width="144"');
    expect(img).toContain('height="144"');
    expect(img).not.toContain("rounded");
  });

  it("pairs the code with the single mobile-scan line", () => {
    const markup = render();
    expect(markup).toContain("Scan to open on mobile");
    expect(markup).toContain("whitespace-nowrap");
  });

  it("puts a cancel control in the card's top-right corner", () => {
    const markup = render();
    expect(markup).toContain('aria-label="Dismiss scanner"');
    // Overlapping the card's top-right edge rather than sitting in the flow.
    expect(markup).toContain("-right-2.5 -top-2.5");
    expect(markup).toContain("absolute");
  });

  it("holds nothing but the code and its line", () => {
    const markup = render();
    // No sign-in button, brand mark, or promo copy.
    expect(markup).not.toContain("Sign in to KSEMO");
    expect(markup).not.toContain("KSEMO logo");
    expect(markup).not.toContain("Your conversations");
  });
});
