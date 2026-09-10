// Verifies the store's durable snapshot: conversations, messages, and identity
// survive a simulated server restart (fresh module instance loading the same
// .ksemo-data store file), including Date round-tripping.

import { describe, expect, it, beforeAll, afterAll } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "ksemo-store-"));
const storeFile = path.join(tmpDir, "store.json");

describe("inMemoryStore durable persistence", () => {
  beforeAll(() => {
    process.env.NODE_ENV = "development";
    process.env.KSEMO_STORE_FILE = storeFile;
  });

  afterAll(() => {
    delete process.env.KSEMO_STORE_FILE;
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("round-trips conversations and messages across a simulated restart", async () => {
    const base = path
      .resolve(process.cwd(), "server", "inMemoryStore.ts")
      .split(path.sep)
      .join("/");
    const url = "file:///" + (base.startsWith("/") ? base : "/" + base);

    const { inMemoryStore } = await import(url);
    const uid = Array.from(inMemoryStore.users.keys())[0];

    const conv = await inMemoryStore.createConversationForUser({
      id: crypto.randomUUID(),
      userId: uid,
      conversationType: "text",
    });
    await inMemoryStore.createMessage({
      id: crypto.randomUUID(),
      conversationId: conv.id,
      role: "user",
      content: "Hello durable world",
      model: "gemini-flash-lite-latest",
      status: "completed",
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    inMemoryStore.persistNow();
    expect(fs.existsSync(storeFile)).toBe(true);

    // Fresh module instance = fresh store = simulated server restart.
    const fresh = (await import(`${url}?restart=1`)).inMemoryStore;
    const convs = await fresh.listConversationsForUser(uid, "active");
    const msgs =
      convs.length > 0
        ? await fresh.listMessagesForConversation(convs[0].id)
        : [];

    expect(convs).toHaveLength(1);
    expect(msgs).toHaveLength(1);
    expect(msgs[0].content).toBe("Hello durable world");
    expect(msgs[0].createdAt).toBeInstanceOf(Date);
    expect(fresh.getUserByOpenId).toBeDefined();
    expect(await fresh.getUserByOpenId(Array.from(fresh.users.values())[0].openId)).toBeDefined();
  });
});