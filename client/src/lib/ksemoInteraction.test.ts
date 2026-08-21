import { describe, expect, it } from "vitest";
import {
  createPrivateConversationUrl,
  createPublicConversationUrl,
  filterLibraryItems,
} from "./ksemoInteraction";

describe("KSEMO interaction helpers", () => {
  it("creates an encoded private conversation reference", () => {
    expect(
      createPrivateConversationUrl("https://ksemo.example", "conversation / 1")
    ).toBe("https://ksemo.example/?conversation=conversation%20%2F%201");
  });

  it("creates an encoded public conversation route from an explicit share token", () => {
    expect(
      createPublicConversationUrl("https://ksemo.example", "token / 1")
    ).toBe("https://ksemo.example/share/token%20%2F%201");
  });

  it("filters private Library items case-insensitively without hiding results when search is empty", () => {
    const items = [
      { id: "1", filename: "Roadmap.PDF" },
      { id: "2", filename: "Product image.png", mimeType: "image/png" },
    ];
    expect(filterLibraryItems(items, "")).toHaveLength(2);
    expect(filterLibraryItems(items, "image").map(item => item.id)).toEqual([
      "2",
    ]);
    expect(filterLibraryItems(items, "missing")).toEqual([]);
  });
});
