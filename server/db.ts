import { and, asc, desc, eq, ilike, or } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { isNotNull, isNull } from "drizzle-orm";
import {
  attachments,
  conversations,
  files,
  InsertUser,
  messageFeedback,
  messageVersions,
  messages,
  taskActivities,
  tasks,
  userPreferences,
  users,
  voiceSessions,
} from "../drizzle/schema";
import { ENV } from "./_core/env";

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(postgres(process.env.DATABASE_URL, { 
        prepare: false,
        connection: {
          // Force IPv4 to avoid IPv6 connection issues on Render
          family: 4
        }
      }));
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required for upsert");
  const db = await getDb();
  if (!db) return;

  const values: InsertUser = { openId: user.openId, lastSignedIn: new Date() };
  const updateSet: Record<string, unknown> = { lastSignedIn: new Date() };
  (["name", "email", "loginMethod", "passwordHash"] as const).forEach(field => {
    if (user[field] !== undefined) {
      values[field] = user[field] ?? null;
      updateSet[field] = user[field] ?? null;
    }
  });
  values.role =
    user.role ?? (user.openId === ENV.ownerOpenId ? "admin" : "user");
  updateSet.role = values.role;

  await db
    .insert(users)
    .values(values)
    .onConflictDoUpdate({ target: users.openId, set: updateSet });
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db
    .select()
    .from(users)
    .where(eq(users.openId, openId))
    .limit(1);
  return result[0];
}

export async function listConversationsForUser(
  userId: number,
  scope: "active" | "archived" | "trash" = "active"
) {
  const db = await getDb();
  if (!db) return [];
  const scopeFilter =
    scope === "trash"
      ? isNotNull(conversations.deletedAt)
      : scope === "archived"
        ? and(
            eq(conversations.isArchived, true),
            isNull(conversations.deletedAt)
          )
        : and(
            eq(conversations.isArchived, false),
            isNull(conversations.deletedAt)
          );
  return db
    .select()
    .from(conversations)
    .where(and(eq(conversations.userId, userId), scopeFilter))
    .orderBy(desc(conversations.isPinned), desc(conversations.updatedAt));
}

export async function getConversationForUser(id: string, userId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db
    .select()
    .from(conversations)
    .where(and(eq(conversations.id, id), eq(conversations.userId, userId)))
    .limit(1);
  return result[0];
}

export async function createConversationForUser(input: {
  id: string;
  userId: number;
  title?: string;
  conversationType?: "text" | "voice" | "mixed";
}) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  await db.insert(conversations).values({
    id: input.id,
    userId: input.userId,
    title: input.title ?? "New conversation",
    conversationType: input.conversationType ?? "text",
  });
  return getConversationForUser(input.id, input.userId);
}

export async function updateConversationForUser(
  id: string,
  userId: number,
  values: Partial<
    Pick<
      typeof conversations.$inferInsert,
      | "title"
      | "isPinned"
      | "isArchived"
      | "isPublic"
      | "shareToken"
      | "conversationType"
      | "projectId"
    >
  >
) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  await db
    .update(conversations)
    .set({ ...values, updatedAt: new Date() })
    .where(and(eq(conversations.id, id), eq(conversations.userId, userId)));
  return getConversationForUser(id, userId);
}

export async function getPublicConversationByToken(shareToken: string) {
  const db = await getDb();
  if (!db) return null;
  const [conversation] = await db
    .select()
    .from(conversations)
    .where(
      and(
        eq(conversations.shareToken, shareToken),
        eq(conversations.isPublic, true),
        isNull(conversations.deletedAt)
      )
    )
    .limit(1);
  if (!conversation) return null;
  return {
    conversation,
    messages: await listMessagesForConversation(conversation.id),
  };
}

export async function deleteConversationForUser(id: string, userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  await db
    .delete(conversations)
    .where(and(eq(conversations.id, id), eq(conversations.userId, userId)));
}

export async function moveConversationToTrash(id: string, userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  await db
    .update(conversations)
    .set({ deletedAt: new Date(), isPinned: false, updatedAt: new Date() })
    .where(and(eq(conversations.id, id), eq(conversations.userId, userId)));
  return getConversationForUser(id, userId);
}

export async function restoreConversationForUser(id: string, userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  await db
    .update(conversations)
    .set({ deletedAt: null, isArchived: false, updatedAt: new Date() })
    .where(and(eq(conversations.id, id), eq(conversations.userId, userId)));
  return getConversationForUser(id, userId);
}

export async function listMessagesForConversation(conversationId: string) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(messages)
    .where(eq(messages.conversationId, conversationId))
    .orderBy(asc(messages.createdAt));
}

export async function listMessageFilesForUser(
  messageId: string,
  userId: number
) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select({
      id: files.id,
      filename: files.filename,
      mimeType: files.mimeType,
      url: files.url,
      storageKey: files.storageKey,
    })
    .from(attachments)
    .innerJoin(files, eq(attachments.fileId, files.id))
    .innerJoin(messages, eq(attachments.messageId, messages.id))
    .innerJoin(conversations, eq(messages.conversationId, conversations.id))
    .where(
      and(
        eq(attachments.messageId, messageId),
        eq(conversations.userId, userId),
        eq(files.userId, userId)
      )
    );
}

export async function attachFileToMessageForUser(input: {
  id: string;
  fileId: string;
  messageId: string;
  userId: number;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  const message = await getMessageForUser(input.messageId, input.userId);
  if (!message) return undefined;
  const [file] = await db
    .select()
    .from(files)
    .where(and(eq(files.id, input.fileId), eq(files.userId, input.userId)))
    .limit(1);
  if (!file) return undefined;
  const [existing] = await db
    .select()
    .from(attachments)
    .where(
      and(
        eq(attachments.fileId, input.fileId),
        eq(attachments.messageId, input.messageId)
      )
    )
    .limit(1);
  if (!existing)
    await db
      .insert(attachments)
      .values({
        id: input.id,
        fileId: input.fileId,
        messageId: input.messageId,
        conversationId: message.conversationId,
      });
  return { messageId: input.messageId, fileId: input.fileId };
}

export async function createMessage(input: typeof messages.$inferInsert) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  await db.insert(messages).values(input);
  await db
    .update(conversations)
    .set({ updatedAt: new Date() })
    .where(eq(conversations.id, input.conversationId));
}

export async function updateMessage(
  id: string,
  values: Partial<
    Pick<typeof messages.$inferInsert, "content" | "model" | "status">
  >
) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  await db.update(messages).set(values).where(eq(messages.id, id));
}

export async function removeFollowingAssistantDuplicatesForUser(
  assistantMessageId: string,
  userId: number
) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  const assistant = await getMessageForUser(assistantMessageId, userId);
  if (!assistant || assistant.role !== "assistant") return [];
  const conversationMessages = await listMessagesForConversation(
    assistant.conversationId
  );
  const index = conversationMessages.findIndex(
    message => message.id === assistant.id
  );
  if (index < 0) return [];
  const duplicateIds: string[] = [];
  for (
    let cursor = index + 1;
    cursor < conversationMessages.length;
    cursor += 1
  ) {
    const message = conversationMessages[cursor];
    if (message.role === "user") break;
    if (message.role === "assistant") duplicateIds.push(message.id);
  }
  for (const id of duplicateIds)
    await db.delete(messages).where(eq(messages.id, id));
  return duplicateIds;
}

export async function getMessageForUser(messageId: string, userId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db
    .select({ message: messages, conversation: conversations })
    .from(messages)
    .innerJoin(conversations, eq(messages.conversationId, conversations.id))
    .where(and(eq(messages.id, messageId), eq(conversations.userId, userId)))
    .limit(1);
  return result[0]?.message;
}

export async function deleteMessageForUser(messageId: string, userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  const message = await getMessageForUser(messageId, userId);
  if (!message) return false;
  await db.delete(messages).where(eq(messages.id, message.id));
  return true;
}

export async function editMessageForUser(input: {
  id: string;
  userId: number;
  versionId: string;
  content: string;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  const message = await getMessageForUser(input.id, input.userId);
  if (!message) return undefined;
  await db
    .insert(messageVersions)
    .values({
      id: input.versionId,
      messageId: message.id,
      content: message.content,
    });
  await db
    .update(messages)
    .set({ content: input.content, updatedAt: new Date() })
    .where(eq(messages.id, message.id));
  return getMessageForUser(message.id, input.userId);
}

export async function listMessageVersionsForUser(
  messageId: string,
  userId: number
) {
  const db = await getDb();
  if (!db) return [];
  const message = await getMessageForUser(messageId, userId);
  if (!message) return undefined;
  return db
    .select()
    .from(messageVersions)
    .where(eq(messageVersions.messageId, message.id))
    .orderBy(desc(messageVersions.createdAt));
}

export async function setMessageFeedbackForUser(input: {
  id: string;
  messageId: string;
  userId: number;
  value: "up" | "down";
}) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  await db
    .insert(messageFeedback)
    .values({
      id: input.id,
      messageId: input.messageId,
      userId: input.userId,
      value: input.value,
    })
    .onConflictDoUpdate({
      target: [messageFeedback.userId, messageFeedback.messageId],
      set: { value: input.value, updatedAt: new Date() },
    });
}

export async function searchConversationMessages(
  userId: number,
  query: string
) {
  const db = await getDb();
  if (!db) return [];
  const pattern = `%${query.trim()}%`;
  return db
    .select({
      conversationId: conversations.id,
      conversationTitle: conversations.title,
      messageId: messages.id,
      content: messages.content,
      role: messages.role,
      createdAt: messages.createdAt,
    })
    .from(messages)
    .innerJoin(conversations, eq(messages.conversationId, conversations.id))
    .where(
      and(
        eq(conversations.userId, userId),
        eq(conversations.isArchived, false),
        ilike(messages.content, pattern)
      )
    )
    .orderBy(desc(messages.createdAt))
    .limit(30);
}

export async function searchConversationTitles(userId: number, query: string) {
  const db = await getDb();
  if (!db) return [];
  const pattern = `%${query.trim()}%`;
  return db
    .select({
      id: conversations.id,
      title: conversations.title,
      updatedAt: conversations.updatedAt,
    })
    .from(conversations)
    .where(
      and(
        eq(conversations.userId, userId),
        eq(conversations.isArchived, false),
        isNull(conversations.deletedAt),
        ilike(conversations.title, pattern)
      )
    )
    .orderBy(desc(conversations.updatedAt))
    .limit(12);
}

export async function getTaskForUser(taskId: string, userId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db
    .select()
    .from(tasks)
    .where(and(eq(tasks.id, taskId), eq(tasks.userId, userId)))
    .limit(1);
  return result[0];
}

export async function listTaskActivitiesForUser(
  taskId: string,
  userId: number
) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(taskActivities)
    .where(
      and(eq(taskActivities.taskId, taskId), eq(taskActivities.userId, userId))
    )
    .orderBy(desc(taskActivities.createdAt));
}

export async function getTaskActivityForUser(
  activityId: string,
  userId: number
) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db
    .select()
    .from(taskActivities)
    .where(
      and(eq(taskActivities.id, activityId), eq(taskActivities.userId, userId))
    )
    .limit(1);
  return result[0];
}

export async function createTaskActivityForUser(input: {
  id: string;
  userId: number;
  taskId: string;
  summary: string;
  detail?: string | null;
  status?: "queued" | "running" | "completed" | "failed" | "cancelled";
}) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  const task = await getTaskForUser(input.taskId, input.userId);
  if (!task) return undefined;
  const status = input.status ?? "queued";
  const now = new Date();
  await db.insert(taskActivities).values({
    ...input,
    status,
    startedAt: status === "running" ? now : null,
    completedAt: ["completed", "failed", "cancelled"].includes(status)
      ? now
      : null,
  });
  return getTaskActivityForUser(input.id, input.userId);
}

export async function updateTaskActivityForUser(input: {
  id: string;
  userId: number;
  summary?: string;
  detail?: string | null;
  status?: "queued" | "running" | "completed" | "failed" | "cancelled";
}) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  const activity = await getTaskActivityForUser(input.id, input.userId);
  if (!activity) return undefined;
  const now = new Date();
  const status = input.status;
  await db
    .update(taskActivities)
    .set({
      summary: input.summary,
      detail: input.detail,
      status,
      startedAt:
        status === "running" && !activity.startedAt ? now : activity.startedAt,
      completedAt:
        status && ["completed", "failed", "cancelled"].includes(status)
          ? now
          : activity.completedAt,
      updatedAt: now,
    })
    .where(
      and(
        eq(taskActivities.id, input.id),
        eq(taskActivities.userId, input.userId)
      )
    );
  return getTaskActivityForUser(input.id, input.userId);
}

export async function getUserPreferences(userId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db
    .select()
    .from(userPreferences)
    .where(eq(userPreferences.userId, userId))
    .limit(1);
  return result[0];
}

export async function upsertUserPreferences(
  userId: number,
  values: Partial<Omit<typeof userPreferences.$inferInsert, "userId">>
) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  await db
    .insert(userPreferences)
    .values({ userId, ...values })
    .onConflictDoUpdate({
      target: userPreferences.userId,
      set: { ...values, updatedAt: new Date() },
    });
  return getUserPreferences(userId);
}

export async function createVoiceSession(input: {
  id: string;
  userId: number;
  conversationId: string;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  await db.insert(voiceSessions).values(input);
  const result = await db
    .select()
    .from(voiceSessions)
    .where(eq(voiceSessions.id, input.id))
    .limit(1);
  return result[0];
}

export async function updateVoiceSessionForUser(
  id: string,
  userId: number,
  status:
    | "connecting"
    | "listening"
    | "speaking"
    | "processing"
    | "interrupted"
    | "ended"
    | "error"
) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  await db
    .update(voiceSessions)
    .set({ status, updatedAt: new Date() })
    .where(and(eq(voiceSessions.id, id), eq(voiceSessions.userId, userId)));
}
