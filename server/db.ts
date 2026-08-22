// In-memory storage implementation
import { ENV } from "./_core/env";

// Type definitions
export type User = {
  id: number;
  openId: string;
  name: string | null;
  email: string | null;
  loginMethod: string | null;
  passwordHash: string | null;
  resetTokenHash: string | null;
  resetTokenExpiresAt: Date | null;
  role: "user" | "admin";
  createdAt: Date;
  updatedAt: Date;
  lastSignedIn: Date;
};

export type InsertUser = Partial<User> & { openId: string; lastSignedIn?: Date };

export type Conversation = {
  id: string;
  userId: number;
  projectId: string | null;
  title: string;
  conversationType: "text" | "voice" | "mixed";
  isPinned: boolean;
  isArchived: boolean;
  isPublic: boolean;
  shareToken: string | null;
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

export type Message = {
  id: string;
  conversationId: string;
  role: "user" | "assistant" | "system" | "tool";
  content: string;
  model: string | null;
  status: "sending" | "streaming" | "completed" | "failed" | "cancelled";
  createdAt: Date;
  updatedAt: Date;
};

export type UserPreference = {
  userId: number;
  selectedModel: string | null;
  persona: "balanced" | "concise" | "creative" | "analytical";
  customInstructions: string | null;
  speechRate: number;
  autoPlayResponses: boolean;
  reduceMotion: boolean;
  createdAt: Date;
  updatedAt: Date;
};

export type VoiceSession = {
  id: string;
  userId: number;
  conversationId: string;
  status: "connecting" | "listening" | "speaking" | "processing" | "interrupted" | "ended" | "error";
  createdAt: Date;
  updatedAt: Date;
};

export type MessageVersion = {
  id: string;
  messageId: string;
  content: string;
  createdAt: Date;
};

export type MessageFeedback = {
  id: string;
  messageId: string;
  userId: number;
  value: "up" | "down";
  createdAt: Date;
  updatedAt: Date;
};

export type Project = {
  id: string;
  userId: number;
  name: string;
  description: string | null;
  instructions: string | null;
  isArchived: boolean;
  createdAt: Date;
  updatedAt: Date;
};

export type KsemoFile = {
  id: string;
  userId: number;
  projectId: string | null;
  storageKey: string;
  url: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  status: "ready" | "failed";
  createdAt: Date;
  updatedAt: Date;
};

export type Attachment = {
  id: string;
  fileId: string;
  conversationId: string | null;
  messageId: string | null;
  createdAt: Date;
};

export type Memory = {
  id: string;
  userId: number;
  projectId: string | null;
  category: "preference" | "fact" | "project" | "instruction";
  content: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
};

export type Task = {
  id: string;
  userId: number;
  agentId: string | null;
  projectId: string | null;
  conversationId: string | null;
  title: string;
  details: string | null;
  status: "inbox" | "planned" | "in_progress" | "completed" | "cancelled";
  priority: "low" | "medium" | "high";
  dueAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

export type TaskActivity = {
  id: string;
  userId: number;
  taskId: string;
  status: "queued" | "running" | "completed" | "failed" | "cancelled";
  summary: string;
  detail: string | null;
  startedAt: Date | null;
  completedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

// In-memory storage
const storage = {
  users: new Map<string, User>(),
  conversations: new Map<string, Conversation>(),
  messages: new Map<string, Message>(),
  userPreferences: new Map<number, UserPreference>(),
  voiceSessions: new Map<string, VoiceSession>(),
  messageVersions: new Map<string, MessageVersion>(),
  messageFeedback: new Map<string, MessageFeedback>(),
  projects: new Map<string, Project>(),
  files: new Map<string, KsemoFile>(),
  attachments: new Map<string, Attachment>(),
  memories: new Map<string, Memory>(),
  tasks: new Map<string, Task>(),
  taskActivities: new Map<string, TaskActivity>(),
  nextUserId: 1,
};

// Helper functions
function now() {
  return new Date();
}

export async function getDb() {
  return storage; // Return storage directly for in-memory
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required for upsert");
  
  const existing = storage.users.get(user.openId);
  const nowDate = now();
  
  if (existing) {
    // Update existing user
    if (user.name !== undefined) existing.name = user.name;
    if (user.email !== undefined) existing.email = user.email;
    if (user.loginMethod !== undefined) existing.loginMethod = user.loginMethod;
    if (user.passwordHash !== undefined) existing.passwordHash = user.passwordHash;
    existing.lastSignedIn = user.lastSignedIn || nowDate;
    existing.updatedAt = nowDate;
    storage.users.set(existing.openId, existing);
  } else {
    // Create new user
    const newUser: User = {
      id: storage.nextUserId++,
      role: user.role ?? (user.openId === ENV.ownerOpenId ? "admin" : "user"),
      openId: user.openId,
      name: user.name ?? null,
      email: user.email ?? null,
      loginMethod: user.loginMethod ?? null,
      passwordHash: user.passwordHash ?? null,
      resetTokenHash: null,
      resetTokenExpiresAt: null,
      createdAt: nowDate,
      updatedAt: nowDate,
      lastSignedIn: user.lastSignedIn || nowDate,
    };
    storage.users.set(newUser.openId, newUser);
  }
}

export async function getUserByOpenId(openId: string) {
  return storage.users.get(openId);
}

export async function listConversationsForUser(
  userId: number,
  scope: "active" | "archived" | "trash" = "active"
) {
  const conversations = Array.from(storage.conversations.values())
    .filter(conv => conv.userId === userId)
    .filter(conv => {
      if (scope === "trash") return conv.deletedAt !== null;
      if (scope === "archived") return conv.isArchived && conv.deletedAt === null;
      return !conv.isArchived && conv.deletedAt === null;
    })
    .sort((a, b) => {
      if (a.isPinned !== b.isPinned) return b.isPinned ? 1 : -1;
      return b.updatedAt.getTime() - a.updatedAt.getTime();
    });
  return conversations;
}

export async function getConversationForUser(id: string, userId: number) {
  const conv = storage.conversations.get(id);
  return conv && conv.userId === userId ? conv : undefined;
}

export async function createConversationForUser(input: {
  id: string;
  userId: number;
  title?: string;
  conversationType?: "text" | "voice" | "mixed";
}) {
  const nowDate = now();
  const conv: Conversation = {
    id: input.id,
    userId: input.userId,
    projectId: null,
    title: input.title ?? "New conversation",
    conversationType: input.conversationType ?? "text",
    isPinned: false,
    isArchived: false,
    isPublic: false,
    shareToken: null,
    deletedAt: null,
    createdAt: nowDate,
    updatedAt: nowDate,
  };
  storage.conversations.set(conv.id, conv);
  return conv;
}

export async function updateConversationForUser(
  id: string,
  userId: number,
  values: Partial<
    Pick<
      Conversation,
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
  const conv = storage.conversations.get(id);
  if (!conv || conv.userId !== userId) return undefined;
  
  Object.assign(conv, values, { updatedAt: now() });
  storage.conversations.set(id, conv);
  return conv;
}

export async function getPublicConversationByToken(shareToken: string) {
  const conv = Array.from(storage.conversations.values()).find(
    c => c.shareToken === shareToken && c.isPublic && c.deletedAt === null
  );
  if (!conv) return null;
  return {
    conversation: conv,
    messages: await listMessagesForConversation(conv.id),
  };
}

export async function deleteConversationForUser(id: string, userId: number) {
  const conv = storage.conversations.get(id);
  if (conv && conv.userId === userId) {
    storage.conversations.delete(id);
    // Also delete associated messages
    Array.from(storage.messages.values())
      .filter(m => m.conversationId === id)
      .forEach(m => storage.messages.delete(m.id));
  }
}

export async function moveConversationToTrash(id: string, userId: number) {
  const conv = storage.conversations.get(id);
  if (conv && conv.userId === userId) {
    conv.deletedAt = now();
    conv.isPinned = false;
    conv.updatedAt = now();
    storage.conversations.set(id, conv);
  }
  return conv;
}

export async function restoreConversationForUser(id: string, userId: number) {
  const conv = storage.conversations.get(id);
  if (conv && conv.userId === userId) {
    conv.deletedAt = null;
    conv.isArchived = false;
    conv.updatedAt = now();
    storage.conversations.set(id, conv);
  }
  return conv;
}

export async function listMessagesForConversation(conversationId: string) {
  return Array.from(storage.messages.values())
    .filter(m => m.conversationId === conversationId)
    .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
}

export async function listMessageFilesForUser(
  messageId: string,
  userId: number
) {
  const message = storage.messages.get(messageId);
  if (!message) return [];
  
  const conversation = storage.conversations.get(message.conversationId);
  if (!conversation || conversation.userId !== userId) return [];
  
  return Array.from(storage.attachments.values())
    .filter(a => a.messageId === messageId)
    .map(a => {
      const file = storage.files.get(a.fileId);
      return file && file.userId === userId ? {
        id: file.id,
        filename: file.filename,
        mimeType: file.mimeType,
        url: file.url,
        storageKey: file.storageKey,
      } : null;
    })
    .filter((f): f is NonNullable<typeof f> => f !== null);
}

export async function attachFileToMessageForUser(input: {
  id: string;
  fileId: string;
  messageId: string;
  userId: number;
}) {
  const message = storage.messages.get(input.messageId);
  if (!message) return undefined;
  
  const file = storage.files.get(input.fileId);
  if (!file || file.userId !== input.userId) return undefined;
  
  const existing = Array.from(storage.attachments.values()).find(
    a => a.fileId === input.fileId && a.messageId === input.messageId
  );
  
  if (!existing) {
    const attachment: Attachment = {
      id: input.id,
      fileId: input.fileId,
      messageId: input.messageId,
      conversationId: message.conversationId,
      createdAt: now(),
    };
    storage.attachments.set(attachment.id, attachment);
  }
  
  return { messageId: input.messageId, fileId: input.fileId };
}

export async function createMessage(input: Message) {
  storage.messages.set(input.id, input);
  
  // Update conversation timestamp
  const conv = storage.conversations.get(input.conversationId);
  if (conv) {
    conv.updatedAt = now();
    storage.conversations.set(conv.id, conv);
  }
}

export async function updateMessage(
  id: string,
  values: Partial<Pick<Message, "content" | "model" | "status">>
) {
  const message = storage.messages.get(id);
  if (message) {
    Object.assign(message, values, { updatedAt: now() });
    storage.messages.set(id, message);
  }
}

export async function removeFollowingAssistantDuplicatesForUser(
  assistantMessageId: string,
  userId: number
) {
  const assistant = storage.messages.get(assistantMessageId);
  if (!assistant || assistant.role !== "assistant") return [];
  
  const conversationMessages = await listMessagesForConversation(assistant.conversationId);
  const index = conversationMessages.findIndex(m => m.id === assistant.id);
  if (index < 0) return [];
  
  const duplicateIds: string[] = [];
  for (let cursor = index + 1; cursor < conversationMessages.length; cursor++) {
    const message = conversationMessages[cursor];
    if (message.role === "user") break;
    if (message.role === "assistant") duplicateIds.push(message.id);
  }
  
  duplicateIds.forEach(id => storage.messages.delete(id));
  return duplicateIds;
}

export async function getMessageForUser(messageId: string, userId: number) {
  const message = storage.messages.get(messageId);
  if (!message) return undefined;
  
  const conversation = storage.conversations.get(message.conversationId);
  return conversation && conversation.userId === userId ? message : undefined;
}

export async function deleteMessageForUser(messageId: string, userId: number) {
  const message = await getMessageForUser(messageId, userId);
  if (message) {
    storage.messages.delete(messageId);
    return true;
  }
  return false;
}

export async function editMessageForUser(input: {
  id: string;
  userId: number;
  versionId: string;
  content: string;
}) {
  const message = await getMessageForUser(input.id, input.userId);
  if (!message) return undefined;
  
  // Save version
  const version: MessageVersion = {
    id: input.versionId,
    messageId: message.id,
    content: message.content,
    createdAt: now(),
  };
  storage.messageVersions.set(version.id, version);
  
  // Update message
  message.content = input.content;
  message.updatedAt = now();
  storage.messages.set(message.id, message);
  
  return message;
}

export async function listMessageVersionsForUser(
  messageId: string,
  userId: number
) {
  const message = await getMessageForUser(messageId, userId);
  if (!message) return [];
  
  return Array.from(storage.messageVersions.values())
    .filter(v => v.messageId === message.id)
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
}

export async function setMessageFeedbackForUser(input: {
  id: string;
  messageId: string;
  userId: number;
  value: "up" | "down";
}) {
  const existing = Array.from(storage.messageFeedback.values()).find(
    f => f.messageId === input.messageId && f.userId === input.userId
  );
  
  if (existing) {
    existing.value = input.value;
    existing.updatedAt = now();
    storage.messageFeedback.set(existing.id, existing);
  } else {
    const feedback: MessageFeedback = {
      id: input.id,
      messageId: input.messageId,
      userId: input.userId,
      value: input.value,
      createdAt: now(),
      updatedAt: now(),
    };
    storage.messageFeedback.set(feedback.id, feedback);
  }
}

export async function searchConversationMessages(
  userId: number,
  query: string
) {
  const pattern = query.trim().toLowerCase();
  const results: Array<{
    conversationId: string;
    conversationTitle: string;
    messageId: string;
    content: string;
    role: string;
    createdAt: Date;
  }> = [];
  
  const messages = Array.from(storage.messages.values());
  for (const message of messages) {
    const conv = storage.conversations.get(message.conversationId);
    if (conv && conv.userId === userId && !conv.isArchived && message.content.toLowerCase().includes(pattern)) {
      results.push({
        conversationId: conv.id,
        conversationTitle: conv.title,
        messageId: message.id,
        content: message.content,
        role: message.role,
        createdAt: message.createdAt,
      });
    }
  }
  
  return results.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()).slice(0, 30);
}

export async function searchConversationTitles(userId: number, query: string) {
  const pattern = query.trim().toLowerCase();
  return Array.from(storage.conversations.values())
    .filter(c => c.userId === userId && !c.isArchived && c.deletedAt === null && c.title.toLowerCase().includes(pattern))
    .map(c => ({
      id: c.id,
      title: c.title,
      updatedAt: c.updatedAt,
    }))
    .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())
    .slice(0, 12);
}

export async function getTaskForUser(taskId: string, userId: number) {
  const task = storage.tasks.get(taskId);
  return task && task.userId === userId ? task : undefined;
}

export async function listTaskActivitiesForUser(
  taskId: string,
  userId: number
) {
  return Array.from(storage.taskActivities.values())
    .filter(a => a.taskId === taskId && a.userId === userId)
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
}

export async function getTaskActivityForUser(
  activityId: string,
  userId: number
) {
  const activity = storage.taskActivities.get(activityId);
  return activity && activity.userId === userId ? activity : undefined;
}

export async function createTaskActivityForUser(input: {
  id: string;
  userId: number;
  taskId: string;
  summary: string;
  detail?: string | null;
  status?: "queued" | "running" | "completed" | "failed" | "cancelled";
}) {
  const task = await getTaskForUser(input.taskId, input.userId);
  if (!task) return undefined;
  
  const status = input.status ?? "queued";
  const nowDate = now();
  const activity: TaskActivity = {
    id: input.id,
    userId: input.userId,
    taskId: input.taskId,
    status,
    summary: input.summary,
    detail: input.detail ?? null,
    startedAt: status === "running" ? nowDate : null,
    completedAt: ["completed", "failed", "cancelled"].includes(status) ? nowDate : null,
    createdAt: nowDate,
    updatedAt: nowDate,
  };
  storage.taskActivities.set(activity.id, activity);
  return activity;
}

export async function updateTaskActivityForUser(input: {
  id: string;
  userId: number;
  summary?: string;
  detail?: string | null;
  status?: "queued" | "running" | "completed" | "failed" | "cancelled";
}) {
  const activity = await getTaskActivityForUser(input.id, input.userId);
  if (!activity) return undefined;
  
  const nowDate = now();
  const status = input.status;
  
  if (input.summary !== undefined) activity.summary = input.summary;
  if (input.detail !== undefined) activity.detail = input.detail;
  if (status !== undefined) {
    activity.status = status;
    if (status === "running" && !activity.startedAt) activity.startedAt = nowDate;
    if (["completed", "failed", "cancelled"].includes(status)) activity.completedAt = nowDate;
  }
  activity.updatedAt = nowDate;
  
  storage.taskActivities.set(activity.id, activity);
  return activity;
}

export async function getUserPreferences(userId: number) {
  return storage.userPreferences.get(userId);
}

export async function upsertUserPreferences(
  userId: number,
  values: Partial<Omit<UserPreference, "userId" | "createdAt" | "updatedAt">>
) {
  const existing = storage.userPreferences.get(userId);
  const nowDate = now();
  
  if (existing) {
    Object.assign(existing, values, { updatedAt: nowDate });
    storage.userPreferences.set(userId, existing);
  } else {
    const prefs: UserPreference = {
      userId,
      selectedModel: values.selectedModel ?? null,
      persona: values.persona ?? "balanced",
      customInstructions: values.customInstructions ?? null,
      speechRate: values.speechRate ?? 100,
      autoPlayResponses: values.autoPlayResponses ?? false,
      reduceMotion: values.reduceMotion ?? false,
      createdAt: nowDate,
      updatedAt: nowDate,
    };
    storage.userPreferences.set(userId, prefs);
  }
  
  return storage.userPreferences.get(userId);
}

export async function createVoiceSession(input: {
  id: string;
  userId: number;
  conversationId: string;
}) {
  const nowDate = now();
  const session: VoiceSession = {
    id: input.id,
    userId: input.userId,
    conversationId: input.conversationId,
    status: "connecting",
    createdAt: nowDate,
    updatedAt: nowDate,
  };
  storage.voiceSessions.set(session.id, session);
  return session;
}

export async function updateVoiceSessionForUser(
  id: string,
  userId: number,
  status: VoiceSession["status"]
) {
  const session = storage.voiceSessions.get(id);
  if (session && session.userId === userId) {
    session.status = status;
    session.updatedAt = now();
    storage.voiceSessions.set(id, session);
  }
}
