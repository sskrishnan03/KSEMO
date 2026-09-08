import crypto from "crypto";
import type {
  User,
  InsertUser,
  Conversation,
  Message,
  UserPreference,
  MessageVersion,
  MessageFeedback,
  Project,
  KsemoFile,
  Attachment,
  Task,
  TaskActivity,
  Memory,
  MemorySettings,
  InsertMemory,
  VoiceSession,
  DbUser,
  DbConversation,
  DbMessage,
} from "../supabase-schema/04-types";

class InMemoryStore {
  users = new Map<number, User>();
  usersByOpenId = new Map<string, number>();
  usersByEmail = new Map<string, number>();

  conversations = new Map<string, Conversation>();
  messages = new Map<string, Message>();
  messageVersions = new Map<string, MessageVersion[]>(); // keyed by messageId
  messageFeedback = new Map<string, MessageFeedback>(); // keyed by messageId:userId

  userPreferences = new Map<number, UserPreference>();
  memories = new Map<string, Memory>();
  memorySettings = new Map<number, MemorySettings>();

  projects = new Map<string, Project>();
  files = new Map<string, KsemoFile>();
  attachments = new Map<string, Attachment>();
  voiceSessions = new Map<string, VoiceSession>();
  tasks = new Map<string, Task>();
  taskActivities = new Map<string, TaskActivity[]>();

  private nextUserId = 1;

  constructor() {
    this.seedDefaults();
  }

  private seedDefaults() {
    const demoUser: User = {
      id: this.nextUserId++,
      openId: "email_demo",
      name: "Demo User",
      email: "demo@ksemo.ai",
      loginMethod: "password",
      passwordHash:
        "scrypt:7156211e18c7c2af40cd60e77f785a70:af2a9bc34774a9ea079aaf1059eda9f717a0b6979fdab8f2c36e9e145b9ecf5f6f9d374db723fa74e19f16599dda477107090b5a11e46f1901ac2b8664714dff", // password123
      resetTokenHash: null,
      resetTokenExpiresAt: null,
      role: "user",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    };

    this.users.set(demoUser.id, demoUser);
    this.usersByOpenId.set(demoUser.openId, demoUser.id);
    if (demoUser.email) {
      this.usersByEmail.set(demoUser.email.toLowerCase(), demoUser.id);
    }

    this.userPreferences.set(demoUser.id, {
      userId: demoUser.id,
      selectedModel: "gemini-2.5-flash",
      persona: "balanced",
      customInstructions: null,
      speechRate: 1.0,
      autoPlayResponses: false,
      reduceMotion: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    this.memorySettings.set(demoUser.id, {
      userId: demoUser.id,
      memoryEnabled: true,
      generateFromChats: true,
      sensitiveMemoryEnabled: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }

  // --- Users ---

  async upsertUser(user: InsertUser): Promise<void> {
    const existingId = this.usersByOpenId.get(user.openId);
    const now = new Date();

    if (existingId) {
      const existing = this.users.get(existingId)!;
      const updated: User = {
        ...existing,
        ...user,
        name: user.name !== undefined ? user.name : existing.name,
        email: user.email !== undefined ? user.email : existing.email,
        loginMethod:
          user.loginMethod !== undefined ? user.loginMethod : existing.loginMethod,
        passwordHash:
          user.passwordHash !== undefined ? user.passwordHash : existing.passwordHash,
        resetTokenHash:
          user.resetTokenHash !== undefined
            ? user.resetTokenHash
            : existing.resetTokenHash,
        resetTokenExpiresAt:
          user.resetTokenExpiresAt !== undefined
            ? user.resetTokenExpiresAt
            : existing.resetTokenExpiresAt,
        role: user.role !== undefined ? user.role : existing.role,
        lastSignedIn: user.lastSignedIn ?? now,
        updatedAt: now,
      };
      this.users.set(existingId, updated);
      if (updated.email) {
        this.usersByEmail.set(updated.email.toLowerCase(), existingId);
      }
    } else {
      const id = this.nextUserId++;
      const newUser: User = {
        id,
        openId: user.openId,
        name: user.name ?? null,
        email: user.email ?? null,
        loginMethod: user.loginMethod ?? null,
        passwordHash: user.passwordHash ?? null,
        resetTokenHash: user.resetTokenHash ?? null,
        resetTokenExpiresAt: user.resetTokenExpiresAt ?? null,
        role: user.role ?? "user",
        createdAt: now,
        updatedAt: now,
        lastSignedIn: user.lastSignedIn ?? now,
      };
      this.users.set(id, newUser);
      this.usersByOpenId.set(newUser.openId, id);
      if (newUser.email) {
        this.usersByEmail.set(newUser.email.toLowerCase(), id);
      }
    }
  }

  async getUserByOpenId(openId: string): Promise<User | undefined> {
    const id = this.usersByOpenId.get(openId);
    if (!id) return undefined;
    return this.users.get(id);
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const id = this.usersByEmail.get(email.toLowerCase().trim());
    if (!id) return undefined;
    return this.users.get(id);
  }

  async updateUserProfile(userId: number, name: string): Promise<User | undefined> {
    const user = this.users.get(userId);
    if (!user) return undefined;
    user.name = name;
    user.updatedAt = new Date();
    return user;
  }

  async deleteUserAccount(userId: number): Promise<boolean> {
    const user = this.users.get(userId);
    if (!user) return false;
    this.users.delete(userId);
    this.usersByOpenId.delete(user.openId);
    if (user.email) this.usersByEmail.delete(user.email.toLowerCase());
    return true;
  }

  // --- Conversations ---

  async listConversationsForUser(
    userId: number,
    scope: "active" | "archived" | "trash" | "shared" = "active"
  ): Promise<Conversation[]> {
    const list: Conversation[] = [];
    for (const conv of this.conversations.values()) {
      if (conv.userId !== userId) continue;
      if (scope === "active" && conv.deletedAt === null && !conv.isArchived) {
        list.push(conv);
      } else if (scope === "archived" && conv.isArchived && conv.deletedAt === null) {
        list.push(conv);
      } else if (scope === "trash" && conv.deletedAt !== null) {
        list.push(conv);
      } else if (scope === "shared" && conv.isPublic) {
        list.push(conv);
      }
    }
    return list.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
  }

  async getConversationForUser(
    id: string,
    userId: number
  ): Promise<Conversation | undefined> {
    const conv = this.conversations.get(id);
    if (!conv || conv.userId !== userId) return undefined;
    return conv;
  }

  async createConversationForUser(input: {
    id: string;
    userId: number;
    title?: string;
    conversationType?: "text" | "voice" | "mixed";
  }): Promise<Conversation> {
    const now = new Date();
    const conv: Conversation = {
      id: input.id,
      userId: input.userId,
      title: input.title || "New Chat",
      conversationType: input.conversationType || "text",
      isPinned: false,
      isArchived: false,
      isPublic: false,
      shareToken: null,
      projectId: null,
      deletedAt: null,
      createdAt: now,
      updatedAt: now,
    };
    this.conversations.set(conv.id, conv);
    return conv;
  }

  async updateConversationForUser(
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
  ): Promise<Conversation | undefined> {
    const conv = this.conversations.get(id);
    if (!conv || conv.userId !== userId) return undefined;

    Object.assign(conv, values, { updatedAt: new Date() });
    return conv;
  }

  async getPublicConversationByToken(shareToken: string): Promise<any> {
    for (const conv of this.conversations.values()) {
      if (conv.shareToken === shareToken && conv.isPublic) {
        const msgs = await this.listMessagesForConversation(conv.id);
        return {
          id: conv.id,
          title: conv.title,
          conversation_type: conv.conversationType,
          created_at: conv.createdAt.toISOString(),
          messages: msgs.map(m => ({
            id: m.id,
            role: m.role,
            content: m.content,
            model: m.model,
            created_at: m.createdAt.toISOString(),
          })),
        };
      }
    }
    return null;
  }

  async deleteConversationForUser(id: string, userId: number): Promise<void> {
    const conv = this.conversations.get(id);
    if (conv && conv.userId === userId) {
      this.conversations.delete(id);
      for (const [msgId, msg] of this.messages.entries()) {
        if (msg.conversationId === id) {
          this.messages.delete(msgId);
        }
      }
    }
  }

  async deleteAllConversationsForUser(userId: number): Promise<number> {
    let count = 0;
    for (const [id, conv] of this.conversations.entries()) {
      if (conv.userId === userId) {
        this.conversations.delete(id);
        count++;
      }
    }
    return count;
  }

  async moveConversationToTrash(
    id: string,
    userId: number
  ): Promise<Conversation | undefined> {
    const conv = this.conversations.get(id);
    if (!conv || conv.userId !== userId) return undefined;
    conv.deletedAt = new Date();
    conv.updatedAt = new Date();
    return conv;
  }

  async restoreConversationForUser(
    id: string,
    userId: number
  ): Promise<Conversation | undefined> {
    const conv = this.conversations.get(id);
    if (!conv || conv.userId !== userId) return undefined;
    conv.deletedAt = null;
    conv.updatedAt = new Date();
    return conv;
  }

  // --- Messages ---

  async listMessagesForConversation(conversationId: string): Promise<Message[]> {
    const list: Message[] = [];
    for (const msg of this.messages.values()) {
      if (msg.conversationId === conversationId) {
        list.push(msg);
      }
    }
    return list.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  }

  async createMessage(input: Message): Promise<Message> {
    const msg: Message = {
      ...input,
      createdAt: input.createdAt ?? new Date(),
      updatedAt: input.updatedAt ?? new Date(),
    };
    this.messages.set(msg.id, msg);

    // Update conversation timestamp
    const conv = this.conversations.get(msg.conversationId);
    if (conv) conv.updatedAt = new Date();

    return msg;
  }

  async updateMessage(
    id: string,
    values: Partial<Pick<Message, "content" | "model" | "status">>
  ): Promise<void> {
    const msg = this.messages.get(id);
    if (!msg) return;
    Object.assign(msg, values, { updatedAt: new Date() });
  }

  async getMessageForUser(
    messageId: string,
    userId: number
  ): Promise<Message | undefined> {
    const msg = this.messages.get(messageId);
    if (!msg) return undefined;
    const conv = this.conversations.get(msg.conversationId);
    if (!conv || conv.userId !== userId) return undefined;
    return msg;
  }

  async deleteMessageForUser(
    messageId: string,
    userId: number
  ): Promise<boolean> {
    const msg = this.messages.get(messageId);
    if (!msg) return false;
    const conv = this.conversations.get(msg.conversationId);
    if (!conv || conv.userId !== userId) return false;
    this.messages.delete(messageId);
    return true;
  }

  async removeFollowingAssistantDuplicatesForUser(
    assistantMessageId: string,
    userId: number
  ): Promise<string[]> {
    const msg = this.messages.get(assistantMessageId);
    if (!msg) return [];
    const conv = this.conversations.get(msg.conversationId);
    if (!conv || conv.userId !== userId) return [];

    const msgs = await this.listMessagesForConversation(msg.conversationId);
    const index = msgs.findIndex(m => m.id === assistantMessageId);
    if (index === -1) return [];

    const deletedIds: string[] = [];
    for (let i = index + 1; i < msgs.length; i++) {
      if (msgs[i].role === "assistant") {
        this.messages.delete(msgs[i].id);
        deletedIds.push(msgs[i].id);
      } else {
        break;
      }
    }
    return deletedIds;
  }

  async editMessageForUser(input: {
    id: string;
    userId: number;
    versionId: string;
    content: string;
  }): Promise<Message | undefined> {
    const msg = this.messages.get(input.id);
    if (!msg) return undefined;
    const conv = this.conversations.get(msg.conversationId);
    if (!conv || conv.userId !== input.userId) return undefined;

    // Store version
    const existingVersions = this.messageVersions.get(input.id) || [];
    existingVersions.push({
      id: input.versionId,
      messageId: input.id,
      content: msg.content,
      createdAt: new Date(),
    });
    this.messageVersions.set(input.id, existingVersions);

    msg.content = input.content;
    msg.updatedAt = new Date();
    return msg;
  }

  async listMessageVersionsForUser(
    messageId: string,
    userId: number
  ): Promise<MessageVersion[]> {
    const msg = this.messages.get(messageId);
    if (!msg) return [];
    const conv = this.conversations.get(msg.conversationId);
    if (!conv || conv.userId !== userId) return [];
    return this.messageVersions.get(messageId) || [];
  }

  async setMessageFeedbackForUser(input: {
    id: string;
    messageId: string;
    userId: number;
    value: "up" | "down";
  }): Promise<void> {
    const key = `${input.messageId}:${input.userId}`;
    this.messageFeedback.set(key, {
      id: input.id,
      messageId: input.messageId,
      userId: input.userId,
      value: input.value,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }

  async searchConversationMessages(userId: number, query: string): Promise<any[]> {
    const q = query.toLowerCase().trim();
    if (!q) return [];
    const results: any[] = [];
    for (const msg of this.messages.values()) {
      const conv = this.conversations.get(msg.conversationId);
      if (!conv || conv.userId !== userId || conv.deletedAt !== null) continue;
      if (msg.content.toLowerCase().includes(q)) {
        results.push({
          message_id: msg.id,
          conversation_id: msg.conversationId,
          conversation_title: conv.title,
          role: msg.role,
          content: msg.content,
          created_at: msg.createdAt.toISOString(),
        });
      }
    }
    return results;
  }

  async searchConversationTitles(userId: number, query: string): Promise<any[]> {
    const q = query.toLowerCase().trim();
    if (!q) return [];
    const results: any[] = [];
    for (const conv of this.conversations.values()) {
      if (conv.userId !== userId || conv.deletedAt !== null) continue;
      if (conv.title.toLowerCase().includes(q)) {
        results.push({
          conversation_id: conv.id,
          title: conv.title,
          created_at: conv.createdAt.toISOString(),
          updated_at: conv.updatedAt.toISOString(),
        });
      }
    }
    return results;
  }

  // --- Preferences ---

  async getUserPreferences(userId: number): Promise<UserPreference | undefined> {
    return this.userPreferences.get(userId);
  }

  async upsertUserPreferences(
    userId: number,
    values: Partial<Omit<UserPreference, "userId" | "createdAt" | "updatedAt">>
  ): Promise<UserPreference | undefined> {
    const now = new Date();
    const existing = this.userPreferences.get(userId);
    if (existing) {
      Object.assign(existing, values, { updatedAt: now });
      return existing;
    }
    const created: UserPreference = {
      userId,
      selectedModel: values.selectedModel ?? "gemini-2.5-flash",
      persona: values.persona ?? "balanced",
      customInstructions: values.customInstructions ?? null,
      speechRate: values.speechRate ?? 1.0,
      autoPlayResponses: values.autoPlayResponses ?? false,
      reduceMotion: values.reduceMotion ?? false,
      createdAt: now,
      updatedAt: now,
    };
    this.userPreferences.set(userId, created);
    return created;
  }

  // --- Memory ---

  async getMemorySettings(userId: number): Promise<MemorySettings | undefined> {
    return this.memorySettings.get(userId);
  }

  async upsertMemorySettings(
    userId: number,
    values: Partial<Omit<MemorySettings, "userId" | "createdAt" | "updatedAt">>
  ): Promise<MemorySettings> {
    const now = new Date();
    const existing = this.memorySettings.get(userId);
    if (existing) {
      Object.assign(existing, values, { updatedAt: now });
      return existing;
    }
    const created: MemorySettings = {
      userId,
      memoryEnabled: values.memoryEnabled ?? true,
      generateFromChats: values.generateFromChats ?? true,
      sensitiveMemoryEnabled: values.sensitiveMemoryEnabled ?? false,
      createdAt: now,
      updatedAt: now,
    };
    this.memorySettings.set(userId, created);
    return created;
  }

  async listUserMemories(
    userId: number,
    opts?: { query?: string; category?: string }
  ): Promise<Memory[]> {
    const list: Memory[] = [];
    for (const mem of this.memories.values()) {
      if (mem.userId !== userId) continue;
      if (opts?.category && mem.category !== opts.category) continue;
      if (
        opts?.query &&
        !mem.title.toLowerCase().includes(opts.query.toLowerCase()) &&
        !mem.content.toLowerCase().includes(opts.query.toLowerCase())
      )
        continue;
      list.push(mem);
    }
    return list.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
  }

  async saveUserMemoryFacts(
    userId: number,
    arg2: string | any[],
    arg3?: any
  ): Promise<number> {
    const conversationId = typeof arg2 === "string" ? arg2 : (typeof arg3 === "string" ? arg3 : "");
    const facts = Array.isArray(arg2) ? arg2 : (Array.isArray(arg3) ? arg3 : []);
    let saved = 0;
    const now = new Date();
    for (const fact of facts) {
      const id = crypto.randomUUID();
      this.memories.set(id, {
        id,
        userId,
        title: fact.title || "Memory",
        content: fact.content || "",
        category: (fact.category as any) || "general",
        isSensitive: Boolean(fact.isSensitive),
        source: fact.source || "chat",
        sourceConversationId: conversationId || null,
        consentStatus: "explicit",
        createdAt: now,
        updatedAt: now,
      });
      saved++;
    }
    return saved;
  }

  // --- Voice ---

  async createVoiceSession(input: {
    id: string;
    userId: number;
    conversationId: string;
  }): Promise<VoiceSession> {
    const session: VoiceSession = {
      id: input.id,
      userId: input.userId,
      conversationId: input.conversationId,
      status: "listening",
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.voiceSessions.set(session.id, session);
    return session;
  }

  async updateVoiceSessionForUser(
    id: string,
    userId: number,
    status: VoiceSession["status"]
  ): Promise<void> {
    const session = this.voiceSessions.get(id);
    if (session && session.userId === userId) {
      session.status = status;
      session.updatedAt = new Date();
    }
  }

  // --- Projects & Files ---

  async listProjectsForUser(userId: number): Promise<Project[]> {
    const list: Project[] = [];
    for (const p of this.projects.values()) {
      if (p.userId === userId && !p.isArchived) {
        list.push(p);
      }
    }
    return list.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
  }

  async createProjectForUser(input: {
    id: string;
    userId: number;
    name: string;
    description?: string;
    instructions?: string;
  }): Promise<Project> {
    const now = new Date();
    const project: Project = {
      id: input.id,
      userId: input.userId,
      name: input.name,
      description: input.description ?? null,
      instructions: input.instructions ?? null,
      isArchived: false,
      createdAt: now,
      updatedAt: now,
    };
    this.projects.set(project.id, project);
    return project;
  }

  async listMessageFilesForUser(messageId: string, userId: number): Promise<any[]> {
    const results: any[] = [];
    for (const att of this.attachments.values()) {
      if (att.messageId === messageId) {
        const file = this.files.get(att.fileId);
        if (file && file.userId === userId) {
          results.push({
            id: file.id,
            filename: file.filename,
            mimeType: file.mimeType,
            sizeBytes: file.sizeBytes,
            url: file.url,
          });
        }
      }
    }
    return results;
  }

  async attachFileToMessageForUser(input: {
    id: string;
    fileId: string;
    messageId: string;
    userId: number;
  }): Promise<any> {
    const att: Attachment = {
      id: input.id,
      fileId: input.fileId,
      conversationId: null,
      messageId: input.messageId,
      createdAt: new Date(),
    };
    this.attachments.set(att.id, att);
    return att;
  }

  async getTaskForUser(taskId: string, userId: number): Promise<Task | undefined> {
    const task = this.tasks.get(taskId);
    if (!task || task.userId !== userId) return undefined;
    return task;
  }

  async listTaskActivitiesForUser(taskId: string, userId: number): Promise<any[]> {
    return this.taskActivities.get(taskId) || [];
  }

  async createTaskActivityForUser(input: any): Promise<any> {
    const list = this.taskActivities.get(input.taskId) || [];
    const item = { ...input, createdAt: new Date() };
    list.push(item);
    this.taskActivities.set(input.taskId, list);
    return item;
  }

  async updateTaskActivityForUser(
    id: string,
    userId: number,
    values: any
  ): Promise<void> {
    for (const list of this.taskActivities.values()) {
      const item = list.find((a: any) => a.id === id);
      if (item && item.userId === userId) {
        Object.assign(item, values);
        break;
      }
    }
  }
}

export const inMemoryStore = new InMemoryStore();

/**
 * A lightweight Supabase query builder mock that allows direct calls like
 * `supabase.from("users").update(...).eq(...)` to function against in-memory data.
 */
export function createMockSupabaseClient() {
  return {
    from(table: string) {
      return new MockQueryBuilder(table);
    },
    rpc(fnName: string, args: Record<string, any> = {}) {
      if (fnName === "search_messages") {
        return inMemoryStore
          .searchConversationMessages(args.p_user_id, args.p_query)
          .then(data => ({ data, error: null }));
      }
      if (fnName === "search_conversation_titles") {
        return inMemoryStore
          .searchConversationTitles(args.p_user_id, args.p_query)
          .then(data => ({ data, error: null }));
      }
      if (fnName === "move_conversation_to_trash") {
        return inMemoryStore
          .moveConversationToTrash(args.p_conversation_id, args.p_user_id)
          .then(conv => ({
            data: conv
              ? {
                  id: conv.id,
                  user_id: conv.userId,
                  title: conv.title,
                  deleted_at: conv.deletedAt?.toISOString() ?? null,
                }
              : null,
            error: null,
          }));
      }
      if (fnName === "restore_conversation") {
        return inMemoryStore
          .restoreConversationForUser(args.p_conversation_id, args.p_user_id)
          .then(conv => ({
            data: conv
              ? {
                  id: conv.id,
                  user_id: conv.userId,
                  title: conv.title,
                  deleted_at: null,
                }
              : null,
            error: null,
          }));
      }
      if (fnName === "set_message_feedback") {
        return inMemoryStore
          .setMessageFeedbackForUser({
            id: crypto.randomUUID(),
            messageId: args.p_message_id,
            userId: args.p_user_id,
            value: args.p_value,
          })
          .then(() => ({ data: true, error: null }));
      }
      return Promise.resolve({ data: null, error: null });
    },
  };
}

class MockQueryBuilder implements PromiseLike<any> {
  private operation: "select" | "insert" | "update" | "delete" | "upsert" = "select";
  private selectColumns = "*";
  private insertData: any = null;
  private updateData: any = null;
  private filters: Array<(row: any) => boolean> = [];
  private orderColumn?: string;
  private orderAsc = true;
  private limitCount?: number;
  private isSingle = false;

  constructor(private table: string) {}

  select(columns = "*") {
    if (!this.operation || this.operation === "select") {
      this.operation = "select";
    }
    this.selectColumns = columns;
    return this;
  }

  insert(data: any) {
    this.operation = "insert";
    this.insertData = data;
    return this;
  }

  update(data: any) {
    this.operation = "update";
    this.updateData = data;
    return this;
  }

  delete() {
    this.operation = "delete";
    return this;
  }

  upsert(data: any) {
    this.operation = "upsert";
    this.insertData = data;
    return this;
  }

  eq(column: string, value: any) {
    this.filters.push((row: any) => {
      const val = row[column] !== undefined ? row[column] : row[toCamelCase(column)];
      return val === value;
    });
    return this;
  }

  neq(column: string, value: any) {
    this.filters.push((row: any) => {
      const val = row[column] !== undefined ? row[column] : row[toCamelCase(column)];
      return val !== value;
    });
    return this;
  }

  gt(column: string, value: any) {
    this.filters.push((row: any) => {
      const val = row[column] !== undefined ? row[column] : row[toCamelCase(column)];
      return val > value;
    });
    return this;
  }

  gte(column: string, value: any) {
    this.filters.push((row: any) => {
      const val = row[column] !== undefined ? row[column] : row[toCamelCase(column)];
      return val >= value;
    });
    return this;
  }

  lt(column: string, value: any) {
    this.filters.push((row: any) => {
      const val = row[column] !== undefined ? row[column] : row[toCamelCase(column)];
      return val < value;
    });
    return this;
  }

  lte(column: string, value: any) {
    this.filters.push((row: any) => {
      const val = row[column] !== undefined ? row[column] : row[toCamelCase(column)];
      return val <= value;
    });
    return this;
  }

  is(column: string, value: any) {
    return this.eq(column, value);
  }

  in(column: string, values: any[]) {
    this.filters.push((row: any) => {
      const val = row[column] !== undefined ? row[column] : row[toCamelCase(column)];
      return values.includes(val);
    });
    return this;
  }

  order(column: string, options: { ascending?: boolean } = {}) {
    this.orderColumn = column;
    this.orderAsc = options.ascending ?? true;
    return this;
  }

  limit(count: number) {
    this.limitCount = count;
    return this;
  }

  range(_from: number, to: number) {
    this.limitCount = to + 1;
    return this;
  }

  single() {
    this.isSingle = true;
    return this;
  }

  maybeSingle() {
    this.isSingle = true;
    return this;
  }

  private getTableRows(): any[] {
    switch (this.table) {
      case "users":
        return Array.from(inMemoryStore.users.values()).map(u => ({
          id: u.id,
          open_id: u.openId,
          name: u.name,
          email: u.email,
          login_method: u.loginMethod,
          password_hash: u.passwordHash,
          reset_token_hash: u.resetTokenHash,
          reset_token_expires_at: u.resetTokenExpiresAt?.toISOString() ?? null,
          role: u.role,
          created_at: u.createdAt.toISOString(),
          updated_at: u.updatedAt.toISOString(),
          last_signed_in: u.lastSignedIn.toISOString(),
        }));
      case "conversations":
        return Array.from(inMemoryStore.conversations.values()).map(c => ({
          id: c.id,
          user_id: c.userId,
          title: c.title,
          conversation_type: c.conversationType,
          is_pinned: c.isPinned,
          is_archived: c.isArchived,
          is_public: c.isPublic,
          share_token: c.shareToken,
          project_id: c.projectId,
          deleted_at: c.deletedAt?.toISOString() ?? null,
          created_at: c.createdAt.toISOString(),
          updated_at: c.updatedAt.toISOString(),
        }));
      case "messages":
        return Array.from(inMemoryStore.messages.values()).map(m => ({
          id: m.id,
          conversation_id: m.conversationId,
          role: m.role,
          content: m.content,
          model: m.model,
          status: m.status,
          created_at: m.createdAt.toISOString(),
          updated_at: m.updatedAt.toISOString(),
        }));
      case "files":
        return Array.from(inMemoryStore.files.values()).map(f => ({
          id: f.id,
          user_id: f.userId,
          filename: f.filename,
          mime_type: f.mimeType,
          size_bytes: f.sizeBytes,
          storage_key: f.storageKey,
          url: f.url,
          status: f.status,
          created_at: f.createdAt.toISOString(),
          updated_at: f.updatedAt.toISOString(),
        }));
      case "projects":
        return Array.from(inMemoryStore.projects.values()).map(p => ({
          id: p.id,
          user_id: p.userId,
          name: p.name,
          description: p.description,
          instructions: p.instructions,
          is_archived: p.isArchived,
          created_at: p.createdAt.toISOString(),
          updated_at: p.updatedAt.toISOString(),
        }));
      case "attachments":
        return Array.from(inMemoryStore.attachments.values()).map(a => ({
          id: a.id,
          file_id: a.fileId,
          conversation_id: a.conversationId,
          message_id: a.messageId,
          created_at: a.createdAt.toISOString(),
        }));
      default:
        return [];
    }
  }

  async execute(): Promise<{ data: any; error: any; count: number | null }> {
    try {
      if (this.operation === "insert" || this.operation === "upsert") {
        const rows = Array.isArray(this.insertData)
          ? this.insertData
          : [this.insertData];
        const inserted: any[] = [];

        for (const row of rows) {
          if (this.table === "files") {
            const file: KsemoFile = {
              id: row.id || crypto.randomUUID(),
              userId: row.user_id || row.userId,
              projectId: row.project_id || row.projectId || null,
              filename: row.filename,
              mimeType: row.mime_type || row.mimeType,
              sizeBytes: row.size_bytes || row.sizeBytes || 0,
              storageKey: row.storage_key || row.storageKey || "",
              url: row.url || "",
              status: "ready",
              createdAt: new Date(),
              updatedAt: new Date(),
            };
            inMemoryStore.files.set(file.id, file);
            inserted.push(row);
          } else if (this.table === "projects") {
            const project: Project = {
              id: row.id || crypto.randomUUID(),
              userId: row.user_id || row.userId,
              name: row.name,
              description: row.description ?? null,
              instructions: row.instructions ?? null,
              isArchived: Boolean(row.is_archived || row.isArchived),
              createdAt: new Date(),
              updatedAt: new Date(),
            };
            inMemoryStore.projects.set(project.id, project);
            inserted.push(row);
          } else if (this.table === "attachments") {
            const att: Attachment = {
              id: row.id || crypto.randomUUID(),
              fileId: row.file_id || row.fileId,
              conversationId: row.conversation_id || row.conversationId || null,
              messageId: row.message_id || row.messageId || null,
              createdAt: new Date(),
            };
            inMemoryStore.attachments.set(att.id, att);
            inserted.push(row);
          }
        }

        const res = this.isSingle ? inserted[0] ?? null : inserted;
        return { data: res, error: null, count: inserted.length };
      }

      if (this.operation === "update") {
        const rows = this.getTableRows().filter(row =>
          this.filters.every(f => f(row))
        );

        for (const row of rows) {
          if (this.table === "users") {
            const user = inMemoryStore.users.get(row.id);
            if (user) {
              if (this.updateData.password_hash !== undefined)
                user.passwordHash = this.updateData.password_hash;
              if (this.updateData.reset_token_hash !== undefined)
                user.resetTokenHash = this.updateData.reset_token_hash;
              if (this.updateData.reset_token_expires_at !== undefined)
                user.resetTokenExpiresAt = this.updateData.reset_token_expires_at
                  ? new Date(this.updateData.reset_token_expires_at)
                  : null;
              if (this.updateData.name !== undefined)
                user.name = this.updateData.name;
              user.updatedAt = new Date();
            }
          } else if (this.table === "files") {
            const file = inMemoryStore.files.get(row.id);
            if (file) {
              if (this.updateData.filename !== undefined)
                file.filename = this.updateData.filename;
              file.updatedAt = new Date();
            }
          } else if (this.table === "projects") {
            const project = inMemoryStore.projects.get(row.id);
            if (project) {
              if (this.updateData.name !== undefined)
                project.name = this.updateData.name;
              if (this.updateData.description !== undefined)
                project.description = this.updateData.description;
              if (this.updateData.instructions !== undefined)
                project.instructions = this.updateData.instructions;
              if (this.updateData.is_archived !== undefined)
                project.isArchived = Boolean(this.updateData.is_archived);
              project.updatedAt = new Date();
            }
          } else if (this.table === "conversations") {
            const conv = inMemoryStore.conversations.get(row.id);
            if (conv) {
              if (this.updateData.title !== undefined)
                conv.title = this.updateData.title;
              if (this.updateData.is_pinned !== undefined)
                conv.isPinned = Boolean(this.updateData.is_pinned);
              if (this.updateData.is_archived !== undefined)
                conv.isArchived = Boolean(this.updateData.is_archived);
              if (this.updateData.project_id !== undefined)
                conv.projectId = this.updateData.project_id;
              conv.updatedAt = new Date();
            }
          }
        }
        return { data: rows, error: null, count: rows.length };
      }

      if (this.operation === "delete") {
        const rows = this.getTableRows().filter(row =>
          this.filters.every(f => f(row))
        );
        for (const row of rows) {
          if (this.table === "files") inMemoryStore.files.delete(row.id);
          else if (this.table === "projects") inMemoryStore.projects.delete(row.id);
          else if (this.table === "attachments") inMemoryStore.attachments.delete(row.id);
          else if (this.table === "conversations") inMemoryStore.conversations.delete(row.id);
        }
        return { data: rows, error: null, count: rows.length };
      }

      // Default: select
      let rows = this.getTableRows();
      if (this.filters.length > 0) {
        rows = rows.filter(row => this.filters.every(f => f(row)));
      }

      if (this.orderColumn) {
        const col = this.orderColumn;
        const asc = this.orderAsc;
        rows.sort((a, b) => {
          const valA = a[col] ?? "";
          const valB = b[col] ?? "";
          if (valA < valB) return asc ? -1 : 1;
          if (valA > valB) return asc ? 1 : -1;
          return 0;
        });
      }

      if (this.limitCount !== undefined) {
        rows = rows.slice(0, this.limitCount);
      }

      if (this.isSingle) {
        const singleRow = rows[0] ?? null;
        return {
          data: singleRow,
          error: singleRow ? null : { code: "PGRST116", message: "Row not found" },
          count: singleRow ? 1 : 0,
        };
      }

      return { data: rows, error: null, count: rows.length };
    } catch (err: any) {
      return { data: null, error: { message: err?.message || String(err) }, count: null };
    }
  }

  then<TResult1 = any, TResult2 = never>(
    onfulfilled?: ((value: any) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | null
  ): Promise<TResult1 | TResult2> {
    return this.execute().then(onfulfilled, onrejected);
  }
}

function toCamelCase(str: string): string {
  return str.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
}
