import { describe, expect, it } from "vitest";
import { resolveUserTimeZone } from "./chatStream";

describe("resolveUserTimeZone", () => {
  it("accepts a well-formed IANA zone", () => {
    expect(resolveUserTimeZone("Asia/Kolkata")).toBe("Asia/Kolkata");
    expect(resolveUserTimeZone("America/New_York")).toBe("America/New_York");
    expect(resolveUserTimeZone("UTC")).toBe("UTC");
    expect(resolveUserTimeZone("  Europe/Paris  ")).toBe("Europe/Paris");
  });

  it("rejects anything that would make Intl throw", () => {
    // A bad zone must never 500 the request; it falls back to the server's own.
    expect(resolveUserTimeZone("Not A Zone")).toBe("");
    expect(resolveUserTimeZone("Mars/Olympus_Mons")).toBe("");
    expect(resolveUserTimeZone("Asia/Kolkata'; DROP TABLE")).toBe("");
    expect(resolveUserTimeZone("a".repeat(200))).toBe("");
  });

  it("rejects non-strings and empty values", () => {
    expect(resolveUserTimeZone(undefined)).toBe("");
    expect(resolveUserTimeZone(null)).toBe("");
    expect(resolveUserTimeZone(42)).toBe("");
    expect(resolveUserTimeZone({ timeZone: "UTC" })).toBe("");
    expect(resolveUserTimeZone("")).toBe("");
  });
});
