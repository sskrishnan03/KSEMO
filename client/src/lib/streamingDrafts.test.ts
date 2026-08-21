import { describe, expect, it } from "vitest";
import { buildStreamingDrafts } from "./streamingDrafts";

describe("KSEMO optimistic stream drafts", () => {
  it("updates an edited user turn and clears the following assistant response in the same message slot", () => {
    const result = buildStreamingDrafts(
      [
        { id: "user-1", role: "user", content: "Old", status: "completed" },
        {
          id: "assistant-1",
          role: "assistant",
          content: "Old response",
          status: "completed",
        },
      ],
      "Updated",
      {
        isRegeneration: true,
        replaceUserMessageId: "user-1",
        replaceAssistantMessageId: "assistant-1",
        now: 7,
      }
    );
    expect(result).toEqual([
      { id: "user-1", role: "user", content: "Updated", status: "completed" },
      {
        id: "assistant-1",
        role: "assistant",
        content: "",
        status: "streaming",
      },
    ]);
  });
});
