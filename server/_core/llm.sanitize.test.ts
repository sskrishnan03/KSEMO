import { describe, expect, it } from "vitest";
import { sanitizeAssistantText } from "./llm";

describe("sanitizeAssistantText", () => {
  it("strips a bare internal marker", () => {
    expect(sanitizeAssistantText("The match ended. [blocked]")).toBe(
      "The match ended."
    );
  });

  it("removes the ellipsis frame the model writes around a blocked fragment", () => {
    expect(sanitizeAssistantText("He scored 5 goals... [blocked]")).toBe(
      "He scored 5 goals"
    );
  });

  it("is case-insensitive across marker variants", () => {
    expect(sanitizeAssistantText("[ERROR]")).toBe("");
    expect(sanitizeAssistantText("[Failed]")).toBe("");
    expect(sanitizeAssistantText("[UnDeFiNeD]")).toBe("");
    expect(sanitizeAssistantText("[null]")).toBe("");
  });

  it("strips [object Object]", () => {
    expect(sanitizeAssistantText("Value was [object Object]")).toBe("Value was");
  });

  it("keeps real sentence punctuation while stripping the marker after it", () => {
    expect(sanitizeAssistantText("结果如下。[blocked]")).toBe("结果如下。");
  });

  it("collapses repeated horizontal whitespace", () => {
    expect(sanitizeAssistantText("a   b\t\tc")).toBe("a b c");
  });

  it("leaves numeric citations intact", () => {
    expect(sanitizeAssistantText("[1] He hit 99 centuries [2].")).toBe(
      "[1] He hit 99 centuries [2]."
    );
  });

  it("leaves ordinary prose untouched", () => {
    const prose = "Sachin Tendulkar is widely regarded as one of the greatest batsmen.";
    expect(sanitizeAssistantText(prose)).toBe(prose);
  });
});