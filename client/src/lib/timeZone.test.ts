import { describe, expect, it } from "vitest";
import { currentTimeZone } from "./timeZone";

describe("currentTimeZone", () => {
  it("returns the runtime's IANA zone", () => {
    // Node ships full ICU, so a zone is always resolvable in tests. The value
    // only has to be a non-empty string the server can hand to Intl.
    expect(currentTimeZone()).toBeTruthy();
    expect(currentTimeZone()).toBe(
      Intl.DateTimeFormat().resolvedOptions().timeZone
    );
  });
});
