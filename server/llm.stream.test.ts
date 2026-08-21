import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("./_core/env", () => ({
  ENV: {
    forgeApiKey: "test-key",
    forgeApiUrl: "https://forge.test",
  },
}));

import { streamLLM } from "./_core/llm";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("streamLLM", () => {
  it("emits only valid assistant text deltas from an SSE response", async () => {
    vi.stubEnv("LLM_BASE_URL", "https://forge.test");
    const encoder = new TextEncoder();
    const responseBody = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(
          encoder.encode(
            'data: {"choices":[{"delta":{"content":"Hello"}}]}\n\n'
          )
        );
        controller.enqueue(
          encoder.encode(
            'data: {"choices":[{"delta":{"content":" world"}}]}\n\n'
          )
        );
        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
        controller.close();
      },
    });
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response(responseBody, { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const chunks: string[] = [];
    for await (const event of streamLLM({
      messages: [{ role: "user", content: "Hello" }],
    })) {
      chunks.push(event.delta);
    }

    expect(chunks).toEqual(["Hello", " world"]);
    expect(fetchMock).toHaveBeenCalledWith(
      "https://forge.test/chat/completions",
      expect.objectContaining({ method: "POST" })
    );
  });
});
