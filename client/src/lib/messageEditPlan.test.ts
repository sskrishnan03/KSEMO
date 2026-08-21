import { describe, expect, it } from "vitest";
import { getFollowingAssistantMessageId } from "./messageEditPlan";

describe("KSEMO edited-message regeneration planning", () => {
  it("finds the following assistant response to regenerate after a user edit", () => {
    expect(
      getFollowingAssistantMessageId(
        [
          { id: "user-1", role: "user" },
          { id: "assistant-1", role: "assistant" },
        ],
        "user-1"
      )
    ).toBe("assistant-1");
  });

  it("does not target a response when the edited user turn has none", () => {
    expect(
      getFollowingAssistantMessageId([{ id: "user-1", role: "user" }], "user-1")
    ).toBeUndefined();
  });
});
