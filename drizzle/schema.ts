import {
  boolean,
  index,
  integer,
  pgEnum,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/pg-core";

export const userRoleEnum = pgEnum("userRole", ["user", "admin"]);
export const conversationTypeEnum = pgEnum("conversationType", [
  "text",
  "voice",
  "mixed",
]);
export const messageRoleEnum = pgEnum("messageRole", [
  "user",
  "assistant",
  "system",
  "tool",
]);
export const messageStatusEnum = pgEnum("messageStatus", [
  "sending",
  "streaming",
  "completed",
  "failed",
  "cancelled",
]);
export const personaEnum = pgEnum("persona", [
  "balanced",
  "concise",
  "creative",
  "analytical",
]);
export const feedbackValueEnum = pgEnum("feedbackValue", ["up", "down"]);
export const fileStatusEnum = pgEnum("fileStatus", ["ready", "failed"]);
export const memoryCategoryEnum = pgEnum("memoryCategory", [
  "preference",
  "fact",
  "project",
  "instruction",
]);
export const taskStatusEnum = pgEnum("taskStatus", [
  "inbox",
  "planned",
  "in_progress",
  "completed",
  "cancelled",
]);
export const taskPriorityEnum = pgEnum("taskPriority", [
  "low",
  "medium",
  "high",
]);
export const taskAgentRoleEnum = pgEnum("taskAgentRole", [
  "assistant",
  "specialist",
  "custom",
]);
export const taskAgentStatusEnum = pgEnum("taskAgentStatus", [
  "active",
  "disabled",
]);
export const taskActivityStatusEnum = pgEnum("taskActivityStatus", [
  "queued",
  "running",
  "completed",
  "failed",
  "cancelled",
]);
export const voiceSessionStatusEnum = pgEnum("voiceSessionStatus", [
  "connecting",
  "listening",
  "speaking",
  "processing",
  "interrupted",
  "ended",
  "error",
]);

export const users = pgTable(
  "users",
  {
    id: serial("id").primaryKey(),
    openId: varchar("openId", { length: 64 }).notNull().unique(),
    name: text("name"),
    email: varchar("email", { length: 320 }),
    loginMethod: varchar("loginMethod", { length: 64 }),
    passwordHash: text("passwordHash"),
    resetTokenHash: varchar("resetTokenHash", { length: 128 }),
    resetTokenExpiresAt: timestamp("resetTokenExpiresAt"),
    role: userRoleEnum("role").default("user").notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().notNull(),
    lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
  },
  table => ({ byEmail: index("users_email_idx").on(table.email) })
);

export const projects = pgTable(
  "projects",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    userId: integer("userId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 120 }).notNull(),
    description: text("description"),
    instructions: text("instructions"),
    isArchived: boolean("isArchived").notNull().default(false),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().notNull(),
  },
  table => ({
    byUserUpdated: index("projects_user_updated_idx").on(
      table.userId,
      table.updatedAt
    ),
  })
);

export const conversations = pgTable(
  "conversations",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    userId: integer("userId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    projectId: varchar("projectId", { length: 36 }).references(
      () => projects.id,
      { onDelete: "set null" }
    ),
    title: varchar("title", { length: 120 })
      .notNull()
      .default("New conversation"),
    conversationType: conversationTypeEnum("conversationType")
      .notNull()
      .default("text"),
    isPinned: boolean("isPinned").notNull().default(false),
    isArchived: boolean("isArchived").notNull().default(false),
    isPublic: boolean("isPublic").notNull().default(false),
    shareToken: varchar("shareToken", { length: 64 }),
    deletedAt: timestamp("deletedAt"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().notNull(),
  },
  table => ({
    byUserUpdated: index("conversations_user_updated_idx").on(
      table.userId,
      table.updatedAt
    ),
    byUserPinned: index("conversations_user_pinned_idx").on(
      table.userId,
      table.isPinned
    ),
    byPublicShareToken: uniqueIndex("conversations_share_token_uq").on(
      table.shareToken
    ),
    byUserDeleted: index("conversations_user_deleted_idx").on(
      table.userId,
      table.deletedAt,
      table.updatedAt
    ),
    byProjectUpdated: index("conversations_project_updated_idx").on(
      table.projectId,
      table.updatedAt
    ),
  })
);

export const messages = pgTable(
  "messages",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    conversationId: varchar("conversationId", { length: 36 })
      .notNull()
      .references(() => conversations.id, { onDelete: "cascade" }),
    role: messageRoleEnum("role").notNull(),
    content: text("content").notNull(),
    model: varchar("model", { length: 160 }),
    status: messageStatusEnum("status").notNull().default("completed"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().notNull(),
  },
  table => ({
    byConversationCreated: index("messages_conversation_created_idx").on(
      table.conversationId,
      table.createdAt
    ),
  })
);

export const userPreferences = pgTable("userPreferences", {
  userId: integer("userId")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  selectedModel: varchar("selectedModel", { length: 160 }),
  persona: personaEnum("persona").notNull().default("balanced"),
  customInstructions: text("customInstructions"),
  speechRate: integer("speechRate").notNull().default(100),
  autoPlayResponses: boolean("autoPlayResponses").notNull().default(false),
  reduceMotion: boolean("reduceMotion").notNull().default(false),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

export const messageVersions = pgTable(
  "messageVersions",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    messageId: varchar("messageId", { length: 36 })
      .notNull()
      .references(() => messages.id, { onDelete: "cascade" }),
    content: text("content").notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => ({
    byMessageCreated: index("message_versions_message_created_idx").on(
      table.messageId,
      table.createdAt
    ),
  })
);

export const messageFeedback = pgTable(
  "messageFeedback",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    messageId: varchar("messageId", { length: 36 })
      .notNull()
      .references(() => messages.id, { onDelete: "cascade" }),
    userId: integer("userId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    value: feedbackValueEnum("value").notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().notNull(),
  },
  table => ({
    byUserMessage: uniqueIndex("message_feedback_user_message_uidx").on(
      table.userId,
      table.messageId
    ),
  })
);

export const files = pgTable(
  "files",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    userId: integer("userId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    projectId: varchar("projectId", { length: 36 }).references(
      () => projects.id,
      { onDelete: "set null" }
    ),
    storageKey: varchar("storageKey", { length: 512 }).notNull(),
    url: varchar("url", { length: 1024 }).notNull(),
    filename: varchar("filename", { length: 255 }).notNull(),
    mimeType: varchar("mimeType", { length: 160 }).notNull(),
    sizeBytes: integer("sizeBytes").notNull(),
    status: fileStatusEnum("status").notNull().default("ready"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().notNull(),
  },
  table => ({
    byUserCreated: index("files_user_created_idx").on(
      table.userId,
      table.createdAt
    ),
    byProjectCreated: index("files_project_created_idx").on(
      table.projectId,
      table.createdAt
    ),
  })
);

export const attachments = pgTable(
  "attachments",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    fileId: varchar("fileId", { length: 36 })
      .notNull()
      .references(() => files.id, { onDelete: "cascade" }),
    conversationId: varchar("conversationId", { length: 36 }).references(
      () => conversations.id,
      { onDelete: "cascade" }
    ),
    messageId: varchar("messageId", { length: 36 }).references(
      () => messages.id,
      { onDelete: "cascade" }
    ),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => ({
    byConversation: index("attachments_conversation_idx").on(
      table.conversationId
    ),
    byMessage: index("attachments_message_idx").on(table.messageId),
  })
);

export const memories = pgTable(
  "memories",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    userId: integer("userId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    projectId: varchar("projectId", { length: 36 }).references(
      () => projects.id,
      { onDelete: "set null" }
    ),
    category: memoryCategoryEnum("category").notNull().default("fact"),
    content: text("content").notNull(),
    isActive: boolean("isActive").notNull().default(true),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().notNull(),
  },
  table => ({
    byUserActive: index("memories_user_active_idx").on(
      table.userId,
      table.isActive,
      table.updatedAt
    ),
  })
);

export const tasks = pgTable(
  "tasks",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    userId: integer("userId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    agentId: varchar("agentId", { length: 36 }).references(
      () => taskAgents.id,
      { onDelete: "set null" }
    ),
    projectId: varchar("projectId", { length: 36 }).references(
      () => projects.id,
      { onDelete: "set null" }
    ),
    conversationId: varchar("conversationId", { length: 36 }).references(
      () => conversations.id,
      { onDelete: "set null" }
    ),
    title: varchar("title", { length: 180 }).notNull(),
    details: text("details"),
    status: taskStatusEnum("status").notNull().default("inbox"),
    priority: taskPriorityEnum("priority").notNull().default("medium"),
    dueAt: timestamp("dueAt"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().notNull(),
  },
  table => ({
    byUserStatusUpdated: index("tasks_user_status_updated_idx").on(
      table.userId,
      table.status,
      table.updatedAt
    ),
    byProjectUpdated: index("tasks_project_updated_idx").on(
      table.projectId,
      table.updatedAt
    ),
    byAgentUpdated: index("tasks_agent_updated_idx").on(
      table.agentId,
      table.updatedAt
    ),
  })
);

export const taskAgents = pgTable(
  "taskAgents",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    userId: integer("userId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 120 }).notNull(),
    role: taskAgentRoleEnum("role").notNull().default("assistant"),
    status: taskAgentStatusEnum("status").notNull().default("active"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().notNull(),
  },
  table => ({
    byUserStatusUpdated: index("task_agents_user_status_updated_idx").on(
      table.userId,
      table.status,
      table.updatedAt
    ),
  })
);

export const taskActivities = pgTable(
  "taskActivities",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    userId: integer("userId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    taskId: varchar("taskId", { length: 36 })
      .notNull()
      .references(() => tasks.id, { onDelete: "cascade" }),
    status: taskActivityStatusEnum("status").notNull().default("queued"),
    summary: varchar("summary", { length: 500 }).notNull(),
    detail: text("detail"),
    startedAt: timestamp("startedAt"),
    completedAt: timestamp("completedAt"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().notNull(),
  },
  table => ({
    byTaskCreated: index("task_activities_task_created_idx").on(
      table.taskId,
      table.createdAt
    ),
    byUserStatusUpdated: index("task_activities_user_status_updated_idx").on(
      table.userId,
      table.status,
      table.updatedAt
    ),
  })
);

export const voiceSessions = pgTable(
  "voiceSessions",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    userId: integer("userId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    conversationId: varchar("conversationId", { length: 36 })
      .notNull()
      .references(() => conversations.id, { onDelete: "cascade" }),
    status: voiceSessionStatusEnum("status").notNull().default("connecting"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().notNull(),
  },
  table => ({
    byUserUpdated: index("voice_sessions_user_updated_idx").on(
      table.userId,
      table.updatedAt
    ),
    byConversation: index("voice_sessions_conversation_idx").on(
      table.conversationId
    ),
  })
);

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
export type Conversation = typeof conversations.$inferSelect;
export type Message = typeof messages.$inferSelect;
export type UserPreference = typeof userPreferences.$inferSelect;
export type VoiceSession = typeof voiceSessions.$inferSelect;
export type MessageVersion = typeof messageVersions.$inferSelect;
export type MessageFeedback = typeof messageFeedback.$inferSelect;
export type Project = typeof projects.$inferSelect;
export type KsemoFile = typeof files.$inferSelect;
export type Attachment = typeof attachments.$inferSelect;
export type Memory = typeof memories.$inferSelect;
export type Task = typeof tasks.$inferSelect;
export type TaskActivity = typeof taskActivities.$inferSelect;
export type TaskAgent = typeof taskAgents.$inferSelect;
