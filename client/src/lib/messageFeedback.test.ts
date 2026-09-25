import { describe, expect, it } from "vitest";
import {
  isSameMessageFeedback,
  toggleMessageFeedback,
} from "./messageFeedback";

describe("toggleMessageFeedback", () => {
  it("rates an unrated message as good", () => {
    const result = toggleMessageFeedback({}, "m1", "up");

    expect(result.value).toBe("up");
    expect(result.ratings).toEqual({ m1: "up" });
  });

  it("rates an unrated message as bad", () => {
    const result = toggleMessageFeedback({}, "m1", "down");

    expect(result.value).toBe("down");
    expect(result.ratings).toEqual({ m1: "down" });
  });

  it("clears the rating when the same thumb is pressed again", () => {
    const rated = toggleMessageFeedback({}, "m1", "up");
    const cleared = toggleMessageFeedback(rated.ratings, "m1", "up");

    expect(cleared.value).toBeNull();
    expect(cleared.ratings).toEqual({});
  });

  it("clears a bad rating when the bad thumb is pressed again", () => {
    const rated = toggleMessageFeedback({}, "m1", "down");
    const cleared = toggleMessageFeedback(rated.ratings, "m1", "down");

    expect(cleared.value).toBeNull();
    expect(cleared.ratings).toEqual({});
  });

  it("switches the rating when the opposite thumb is pressed", () => {
    const up = toggleMessageFeedback({}, "m1", "up");
    const down = toggleMessageFeedback(up.ratings, "m1", "down");

    expect(down.value).toBe("down");
    expect(down.ratings).toEqual({ m1: "down" });
  });

  it("never mutates the map it was given", () => {
    const original = { m1: "up" as const };
    const snapshot = { ...original };

    toggleMessageFeedback(original, "m1", "down");
    toggleMessageFeedback(original, "m1", "up");
    toggleMessageFeedback(original, "m2", "up");

    expect(original).toEqual(snapshot);
  });

  it("leaves other messages' ratings untouched", () => {
    const start = { a: "up" as const, b: "down" as const };
    const result = toggleMessageFeedback(start, "b", "up");

    expect(result.ratings).toEqual({ a: "up", b: "up" });
  });
});

describe("isSameMessageFeedback", () => {
  it("treats equal maps as unchanged", () => {
    expect(isSameMessageFeedback({ a: "up" }, { a: "up" })).toBe(true);
    expect(isSameMessageFeedback({}, {})).toBe(true);
  });

  it("detects a changed rating", () => {
    expect(isSameMessageFeedback({ a: "up" }, { a: "down" })).toBe(false);
  });

  it("detects an added or removed rating", () => {
    expect(isSameMessageFeedback({}, { a: "up" })).toBe(false);
    expect(isSameMessageFeedback({ a: "up" }, {})).toBe(false);
  });
});
