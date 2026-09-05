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