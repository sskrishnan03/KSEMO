import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

function anonymousContext(): TrpcContext {
  return {
    user: null,
    req: {} as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

function authenticatedContext(): TrpcContext {
  return {
    user: {
      id: 7,
      openId: "ksemo-test-user",
      name: "KSEMO Tester",
      email: "test@example.com",
      loginMethod: "google",
      role: "user",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    },
    req: {} as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

describe("KSEMO protected contracts", () => {
  it("does not expose conversation history to an unauthenticated caller", async () => {
    const caller = appRouter.createCaller(anonymousContext());
    await expect(caller.conversation.list()).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
  });

  it("protects message edits and assistant feedback behind the authenticated API boundary", async () => {
    const caller = appRouter.createCaller(anonymousContext());
    await expect(
      caller.message.edit({ id: "message-123", content: "Changed text" })
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    await expect(
      caller.message.history({ id: "message-123" })
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    await expect(
      caller.message.restoreVersion({
        id: "message-123",
        versionId: "version-123",
      })
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    await expect(
      caller.message.feedback({ messageId: "message-123", value: "up" })
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("protects projects, files, and memories behind the authenticated API boundary", async () => {
    const caller = appRouter.createCaller(anonymousContext());
    await expect(caller.workspace.projects.list()).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
    await expect(caller.workspace.files.list()).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
    await expect(caller.workspace.memories.list()).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
  });

  it("rejects unsupported microphone recording formats before storage or transcription", async () => {
    const caller = appRouter.createCaller(authenticatedContext());
    await expect(
      caller.voice.transcribe({
        audioBase64: "dGVzdA==",
        mimeType: "text/plain",
      })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });
});
