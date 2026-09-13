import { describe, expect, it } from "vitest";
import { sanitizeAssistantText } from "./sanitizeAssistant";

describe("sanitizeAssistantText (client safety net)", () => {
  it("strips an internal marker that spanned two streamed deltas", () => {
    // Delta 1 ends mid-token; the assembled text still must never show it.
    expect(sanitizeAssistantText("The innings of 2005 [bl" + "ocked]...")).toBe(
      "The innings of 2005"
    );
  });

  it("strips all marker variants", () => {
    expect(sanitizeAssistantText("[blocked] [error] [failed] [null] [object Object]")).toBe("");
  });

  it("strips markers from persisted legacy text", () => {
    expect(
      sanitizeAssistantText("He made 15,921 Test runs. [blocked] [1]")
    ).toBe("He made 15,921 Test runs. [1]");
  });

  it("leaves ordinary prose and citations untouched", () => {
    const prose =
      "[1] Widely considered among the greatest batsmen, he retired in 2013. [2]";
    expect(sanitizeAssistantText(prose)).toBe(prose);
  });
});

import { cleanTextForSpeech, selectBestHumanVoice } from "@/hooks/useVoiceSession";

describe("cleanTextForSpeech", () => {
  it("strips markdown formatting, backticks, emojis, and raw links for natural speaking", () => {
    const raw = "Hello **world**! Here is `const x = 1;` and [OpenAI](https://openai.com) with emojis 😊🚀! • Point one & two.";
    const cleaned = cleanTextForSpeech(raw);
    expect(cleaned).not.toContain("**");
    expect(cleaned).not.toContain("`");
    expect(cleaned).not.toContain("https://");
    expect(cleaned).not.toContain("•");
    expect(cleaned).not.toContain("😊");
    expect(cleaned).toContain("Hello world");
    expect(cleaned).toContain("OpenAI");
    expect(cleaned).toContain("Point one and two");
  });

  it("converts symbols into spoken words", () => {
    expect(cleanTextForSpeech("Revenue up 25% & costs cut $50")).toContain("25 percent and costs cut 50 dollars");
  });
});

describe("selectBestHumanVoice", () => {
  it("prioritizes online natural neural voices over robotic synthesizers", () => {
    const voices = [
      { name: "Microsoft David - English (United States)", lang: "en-US", default: true, localService: true, voiceURI: "" },
      { name: "Microsoft Zira - English (United States)", lang: "en-US", default: false, localService: true, voiceURI: "" },
      { name: "Microsoft Jenny Online (Natural) - English (United States)", lang: "en-US", default: false, localService: false, voiceURI: "" },
    ] as unknown as SpeechSynthesisVoice[];

    const selected = selectBestHumanVoice(voices);
    expect(selected?.name).toBe("Microsoft Jenny Online (Natural) - English (United States)");
  });

  it("respects user preferred voice when selected", () => {
    const voices = [
      { name: "Microsoft David - English (United States)", lang: "en-US", default: true, localService: true, voiceURI: "" },
      { name: "Custom Warm Voice", lang: "en-US", default: false, localService: true, voiceURI: "" },
    ] as unknown as SpeechSynthesisVoice[];

    const selected = selectBestHumanVoice(voices, "Custom Warm Voice");
    expect(selected?.name).toBe("Custom Warm Voice");
  });
});