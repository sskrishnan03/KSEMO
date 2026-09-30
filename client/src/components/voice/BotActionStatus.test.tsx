import { describe, expect, it } from "vitest";
import React from "react";
import { renderToString } from "react-dom/server";
import { BotActionStatus } from "./BotActionStatus";

describe("BotActionStatus", () => {
  it("renders pending animated state for opening", () => {
    const html = renderToString(
      <BotActionStatus
        action={{
          intent: "navigate",
          target: "YouTube",
          status: "opening",
          statusText: "Opening YouTube...",
        }}
      />
    );
    expect(html).toContain("Opening YouTube");
    expect(html).toContain("animate-pulse");
  });

  it("renders pending animated state for searching", () => {
    const html = renderToString(
      <BotActionStatus
        action={{
          intent: "web_search",
          status: "searching",
          statusText: "Searching the web...",
        }}
      />
    );
    expect(html).toContain("Searching the web");
  });

  it("renders completed state with target link", () => {
    const html = renderToString(
      <BotActionStatus
        action={{
          intent: "navigate",
          target: "YouTube",
          url: "https://www.youtube.com/",
          status: "completed",
          statusText: "Opened YouTube",
        }}
      />
    );
    expect(html).toContain("Opened YouTube");
    expect(html).toContain("https://www.youtube.com/");
    expect(html).toContain("noopener noreferrer");
  });

  it("renders blocked state with fallback open link", () => {
    const html = renderToString(
      <BotActionStatus
        action={{
          intent: "navigate",
          target: "YouTube",
          url: "https://www.youtube.com/",
          status: "blocked",
          statusText: "Popup was blocked by the browser.",
        }}
      />
    );
    expect(html).toContain("Popup was blocked");
    expect(html).toContain("Click to open");
  });
});
