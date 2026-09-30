import { describe, expect, it } from "vitest";
import { getReplyVoices, useBotReplyVoice } from "./speechVoices";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";

describe("speechVoices SSR safety", () => {
  it("reports no voices where SpeechSynthesis does not exist (SSR/node)", () => {
    expect(getReplyVoices()).toEqual([]);
  });

  it("renders without a voice selection where there is no browser window", () => {
    function Markup() {
      const { voices, voiceName } = useBotReplyVoice();
      return createElement(
        "div",
        null,
        `voices:${voices.length}`,
        `voice:${voiceName ?? "none"}`
      );
    }
    const markup = renderToStaticMarkup(createElement(Markup));
    expect(markup).toContain("voices:0");
    expect(markup).toContain("voice:none");
  });
});
