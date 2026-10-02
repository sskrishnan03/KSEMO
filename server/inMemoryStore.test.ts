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

  it("archives every active conversation and leaves already-archived and trashed ones alone", async () => {
    const base = path
      .resolve(process.cwd(), "server", "inMemoryStore.ts")
      .split(path.sep)
      .join("/");
    const url = "file:///" + (base.startsWith("/") ? base : "/" + base);

    const { inMemoryStore } = await import(`${url}?archiveAllTest=1`);
    const uid = Array.from(inMemoryStore.users.keys())[0];

    const active = await inMemoryStore.createConversationForUser({
      id: crypto.randomUUID(),
      userId: uid,
      conversationType: "text",
    });
    const alreadyArchived = await inMemoryStore.createConversationForUser({
      id: crypto.randomUUID(),
      userId: uid,
      conversationType: "text",
    });
    await inMemoryStore.updateConversationForUser(alreadyArchived.id, uid, {
      isArchived: true,
    });
    const trashed = await inMemoryStore.createConversationForUser({
      id: crypto.randomUUID(),
      userId: uid,
      conversationType: "text",
    });
    await inMemoryStore.moveConversationToTrash(trashed.id, uid);

    const archivedCount = await inMemoryStore.archiveAllConversationsForUser(uid);
    expect(archivedCount).toBeGreaterThanOrEqual(1);

    const activeList = await inMemoryStore.listConversationsForUser(uid, "active");
    const archivedList = await inMemoryStore.listConversationsForUser(uid, "archived");
    const trashList = await inMemoryStore.listConversationsForUser(uid, "trash");

    expect(activeList).toHaveLength(0);
    expect(archivedList.map(c => c.id)).toEqual(
      expect.arrayContaining([active.id, alreadyArchived.id])
    );
    expect(trashList.map(c => c.id)).toEqual([trashed.id]);
    expect(archivedList.find(c => c.id === active.id)?.isPinned).toBe(false);
  });

  it("retrieves public conversations by shareToken and conversations by ID or token", async () => {
    const base = path
      .resolve(process.cwd(), "server", "inMemoryStore.ts")
      .split(path.sep)
      .join("/");
    const url = "file:///" + (base.startsWith("/") ? base : "/" + base);

    const { inMemoryStore } = await import(`${url}?shareTest=1`);
    const uid = Array.from(inMemoryStore.users.keys())[0];

    const conv = await inMemoryStore.createConversationForUser({
      id: crypto.randomUUID(),
      userId: uid,
      title: "Shared Discussion",
      conversationType: "text",
    });

    await inMemoryStore.updateConversationForUser(conv.id, uid, {
      isPublic: true,
      shareToken: "token-abc-1234567890",
    });

    await inMemoryStore.createMessage({
      id: crypto.randomUUID(),
      conversationId: conv.id,
      role: "user",
      content: "Hello from shared test",
      model: "gemini",
      status: "completed",
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const publicConv = await inMemoryStore.getPublicConversationByToken("token-abc-1234567890");
    expect(publicConv).toBeDefined();
    expect(publicConv.title).toBe("Shared Discussion");
    expect(publicConv.userId).toBe(uid);
    expect(publicConv.messages).toHaveLength(1);
    expect(publicConv.messages[0].content).toBe("Hello from shared test");

    const byId = await inMemoryStore.getConversationById(conv.id);
    expect(byId).toBeDefined();
    expect(byId?.title).toBe("Shared Discussion");

    const byToken = await inMemoryStore.getConversationByShareToken("token-abc-1234567890");
    expect(byToken).toBeDefined();
    expect(byToken?.id).toBe(conv.id);
  });

  it("deletes every conversation for the user together with their messages", async () => {
    const base = path
      .resolve(process.cwd(), "server", "inMemoryStore.ts")
      .split(path.sep)
      .join("/");
    const url = "file:///" + (base.startsWith("/") ? base : "/" + base);

    const { inMemoryStore } = await import(`${url}?deleteAllTest=1`);
    const uid = Array.from(inMemoryStore.users.keys())[0];

    const ids: string[] = [];
    for (const title of ["Alpha", "Beta", "Gamma"]) {
      const conv = await inMemoryStore.createConversationForUser({
        id: crypto.randomUUID(),
        userId: uid,
        title,
        conversationType: "text",
      });
      ids.push(conv.id);
      await inMemoryStore.createMessage({
        id: crypto.randomUUID(),
        conversationId: conv.id,
        role: "user",
        content: `message in ${title}`,
        model: "gemini",
        status: "completed",
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }
    // An archived conversation must go too - "delete all" is not limited to
    // what the sidebar happens to show.
    const archived = await inMemoryStore.createConversationForUser({
      id: crypto.randomUUID(),
      userId: uid,
      title: "Archived one",
      conversationType: "text",
    });
    await inMemoryStore.updateConversationForUser(archived.id, uid, {
      isArchived: true,
    });
    ids.push(archived.id);

    expect(inMemoryStore.messages.size).toBeGreaterThanOrEqual(ids.length);

    const removed = await inMemoryStore.deleteAllConversationsForUser(uid);
    expect(removed).toBeGreaterThanOrEqual(ids.length);

    for (const id of ids) {
      expect(inMemoryStore.conversations.has(id)).toBe(false);
    }
    // No orphaned messages survive, otherwise a later id reuse or a disk
    // reload would resurrect deleted content.
    for (const message of inMemoryStore.messages.values()) {
      expect(ids).not.toContain(message.conversationId);
    }

    expect(await inMemoryStore.listConversationsForUser(uid, "active")).toHaveLength(0);
    expect(await inMemoryStore.listConversationsForUser(uid, "archived")).toHaveLength(0);
    expect(await inMemoryStore.listConversationsForUser(uid, "trash")).toHaveLength(0);
  });
});