import { describe, expect, it, vi } from "vitest";
import { restoreUserMessageVersionAndRegenerate } from "./historyRestoration";

describe("KSEMO message-history restoration", () => {
  it("restores the selected user version and regenerates only the following assistant response", async () => {
    const restore = vi.fn().mockResolvedValue(undefined);
    const regenerate = vi.fn().mockResolvedValue(undefined);
    const result = await restoreUserMessageVersionAndRegenerate({
      messageId: "user-1",
      versionId: "version-1",
      restoredContent: "Earlier request",
      messages: [
        { id: "user-1", role: "user" },
        { id: "assistant-1", role: "assistant" },
        { id: "user-2", role: "user" },
        { id: "assistant-2", role: "assistant" },
      ],
      restore,
      regenerate,
    });
    expect(restore).toHaveBeenCalledWith("user-1", "version-1");
    expect(regenerate).toHaveBeenCalledWith("Earlier request", "assistant-1");
    expect(result).toEqual({
      regenerated: true,
      assistantMessageId: "assistant-1",
    });
  });
});
