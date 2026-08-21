import { describe, expect, it } from "vitest";
import { typeAfterVoiceSession } from "./conversationTypes";

describe("voice conversation metadata", () => {
  it("changes an existing text conversation to mixed when voice mode begins", () => {
    expect(typeAfterVoiceSession("text")).toBe("mixed");
  });

  it("preserves voice and mixed conversation types", () => {
    expect(typeAfterVoiceSession("voice")).toBe("voice");
    expect(typeAfterVoiceSession("mixed")).toBe("mixed");
  });
});
