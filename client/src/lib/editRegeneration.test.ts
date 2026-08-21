import { describe, expect, it, vi } from "vitest";
import { saveEditedUserMessageAndRegenerate } from "./editRegeneration";

describe("KSEMO edited user-message regeneration", () => {
  it("persists the edit then regenerates the following assistant response without creating another user turn", async () => {
    const events: string[] = [];
    const save = vi.fn(async (id: string, content: string) => {
      events.push(`save:${id}:${content}`);
    });
    const regenerate = vi.fn(async (content: string, assistantId: string) => {
      events.push(`regenerate:${assistantId}:${content}`);
    });
    const result = await saveEditedUserMessageAndRegenerate({
      message: { id: "user-1", role: "user", content: "Old" },
      editedContent: "Updated",
      messages: [
        { id: "user-1", role: "user", content: "Old" },
        { id: "assistant-1", role: "assistant", content: "Old answer" },
      ],
      save,
      regenerate,
    });
    expect(events).toEqual([
      "save:user-1:Updated",
      "regenerate:assistant-1:Updated",
    ]);
    expect(result).toEqual({
      regenerated: true,
      assistantMessageId: "assistant-1",
    });
    expect(regenerate).toHaveBeenCalledTimes(1);
  });

  it("does not issue a regeneration when there is no following assistant response", async () => {
    const regenerate = vi.fn(async () => undefined);
    const result = await saveEditedUserMessageAndRegenerate({
      message: { id: "user-1", role: "user", content: "Old" },
      editedContent: "Updated",
      messages: [{ id: "user-1", role: "user", content: "Old" }],
      save: async () => undefined,
      regenerate,
    });
    expect(result).toEqual({ regenerated: false });
    expect(regenerate).not.toHaveBeenCalled();
  });
});
