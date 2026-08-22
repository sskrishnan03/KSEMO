// TypeScript types matching the Supabase database schema
// These types should be used to replace the in-memory types in server/db.ts

// Application-facing types (camelCase) - what the rest of the app expects
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

export type InsertUser = Partial<Omit<User, "id" | "createdAt" | "updatedAt">> & {
  openId: string;
  lastSignedIn?: Date;
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

export type InsertUserPreference = Partial<
  Omit<UserPreference, "userId" | "createdAt" | "updatedAt">
> & {
  userId: number;
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

export type InsertProject = Partial<
  Omit<Project, "id" | "createdAt" | "updatedAt">
> & {
  userId: number;
  name: string;
};

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

export type InsertConversation = Partial<
  Omit<Conversation, "id" | "createdAt" | "updatedAt">
> & {
  id: string;
  userId: number;
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

export type InsertMessage = Partial<
  Omit<Message, "id" | "createdAt" | "updatedAt">
> & {
  id: string;
  conversationId: string;
  role: string;
  content: string;
};

export type MessageVersion = {
  id: string;
  messageId: string;
  content: string;
  createdAt: Date;
};

export type InsertMessageVersion = Omit<MessageVersion, "id" | "createdAt"> & {
  id: string;
};

export type MessageFeedback = {
  id: string;
  messageId: string;
  userId: number;
  value: "up" | "down";
  createdAt: Date;
  updatedAt: Date;
};

export type InsertMessageFeedback = Omit<
  MessageFeedback,
  "id" | "createdAt" | "updatedAt"
> & {
  id: string;
};

export type VoiceSession = {
  id: string;
  userId: number;
  conversationId: string;
  status:
    | "connecting"
    | "listening"
    | "speaking"
    | "processing"
    | "interrupted"
    | "ended"
    | "error";
  createdAt: Date;
  updatedAt: Date;
};

export type InsertVoiceSession = Omit<VoiceSession, "id" | "createdAt" | "updatedAt"> & {
  id: string;
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

export type InsertKsemoFile = Partial<
  Omit<KsemoFile, "id" | "createdAt" | "updatedAt">
> & {
  id: string;
  userId: number;
  storageKey: string;
  url: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
};

export type Attachment = {
  id: string;
  fileId: string;
  conversationId: string | null;
  messageId: string | null;
  createdAt: Date;
};

export type InsertAttachment = Omit<Attachment, "id" | "createdAt"> & {
  id: string;
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

export type InsertMemory = Partial<
  Omit<Memory, "id" | "createdAt" | "updatedAt">
> & {
  id: string;
  userId: number;
  content: string;
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

export type InsertTask = Partial<
  Omit<Task, "id" | "createdAt" | "updatedAt">
> & {
  id: string;
  userId: number;
  title: string;
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

export type InsertTaskActivity = Partial<
  Omit<TaskActivity, "id" | "createdAt" | "updatedAt">
> & {
  id: string;
  userId: number;
  taskId: string;
  summary: string;
};

// Database row types (snake_case as stored in Supabase)
export type DbUser = {
  id: number;
  open_id: string;
  name: string | null;
  email: string | null;
  login_method: string | null;
  password_hash: string | null;
  reset_token_hash: string | null;
  reset_token_expires_at: string | null;
  role: "user" | "admin";
  created_at: string;
  updated_at: string;
  last_signed_in: string;
};

export type DbConversation = {
  id: string;
  user_id: number;
  project_id: string | null;
  title: string;
  conversation_type: "text" | "voice" | "mixed";
  is_pinned: boolean;
  is_archived: boolean;
  is_public: boolean;
  share_token: string | null;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
};

export type DbMessage = {
  id: string;
  conversation_id: string;
  role: "user" | "assistant" | "system" | "tool";
  content: string;
  model: string | null;
  status: "sending" | "streaming" | "completed" | "failed" | "cancelled";
  created_at: string;
  updated_at: string;
};

export type DbUserPreference = {
  user_id: number;
  selected_model: string | null;
  persona: "balanced" | "concise" | "creative" | "analytical";
  custom_instructions: string | null;
  speech_rate: number;
  auto_play_responses: boolean;
  reduce_motion: boolean;
  created_at: string;
  updated_at: string;
};

// Helper function to convert DB row to app type
export function dbToUser(db: DbUser): User {
  return {
    id: db.id,
    openId: db.open_id,
    name: db.name,
    email: db.email,
    loginMethod: db.login_method,
    passwordHash: db.password_hash,
    resetTokenHash: db.reset_token_hash,
    resetTokenExpiresAt: db.reset_token_expires_at
      ? new Date(db.reset_token_expires_at)
      : null,
    role: db.role,
    createdAt: new Date(db.created_at),
    updatedAt: new Date(db.updated_at),
    lastSignedIn: new Date(db.last_signed_in),
  };
}

export function dbToConversation(db: DbConversation): Conversation {
  return {
    id: db.id,
    userId: db.user_id,
    projectId: db.project_id,
    title: db.title,
    conversationType: db.conversation_type,
    isPinned: db.is_pinned,
    isArchived: db.is_archived,
    isPublic: db.is_public,
    shareToken: db.share_token,
    deletedAt: db.deleted_at ? new Date(db.deleted_at) : null,
    createdAt: new Date(db.created_at),
    updatedAt: new Date(db.updated_at),
  };
}

export function dbToMessage(db: DbMessage): Message {
  return {
    id: db.id,
    conversationId: db.conversation_id,
    role: db.role,
    content: db.content,
    model: db.model,
    status: db.status,
    createdAt: new Date(db.created_at),
    updatedAt: new Date(db.updated_at),
  };
}

export function dbToUserPreference(db: DbUserPreference): UserPreference {
  return {
    userId: db.user_id,
    selectedModel: db.selected_model,
    persona: db.persona,
    customInstructions: db.custom_instructions,
    speechRate: db.speech_rate,
    autoPlayResponses: db.auto_play_responses,
    reduceMotion: db.reduce_motion,
    createdAt: new Date(db.created_at),
    updatedAt: new Date(db.updated_at),
  };
}

// Helper function to convert app type to DB format
export function userToDb(user: Partial<User>): Partial<DbUser> {
  const db: Partial<DbUser> = {};
  if (user.openId !== undefined) db.open_id = user.openId;
  if (user.name !== undefined) db.name = user.name;
  if (user.email !== undefined) db.email = user.email;
  if (user.loginMethod !== undefined) db.login_method = user.loginMethod;
  if (user.passwordHash !== undefined) db.password_hash = user.passwordHash;
  if (user.resetTokenHash !== undefined) db.reset_token_hash = user.resetTokenHash;
  if (user.resetTokenExpiresAt !== undefined) db.reset_token_expires_at = user.resetTokenExpiresAt ? user.resetTokenExpiresAt.toISOString() : null;
  if (user.role !== undefined) db.role = user.role;
  if (user.lastSignedIn !== undefined) db.last_signed_in = user.lastSignedIn.toISOString();
  return db;
}

export function conversationToDb(conv: Partial<Conversation>): Partial<DbConversation> {
  const db: Partial<DbConversation> = {};
  if (conv.userId !== undefined) db.user_id = conv.userId;
  if (conv.projectId !== undefined) db.project_id = conv.projectId;
  if (conv.title !== undefined) db.title = conv.title;
  if (conv.conversationType !== undefined) db.conversation_type = conv.conversationType;
  if (conv.isPinned !== undefined) db.is_pinned = conv.isPinned;
  if (conv.isArchived !== undefined) db.is_archived = conv.isArchived;
  if (conv.isPublic !== undefined) db.is_public = conv.isPublic;
  if (conv.shareToken !== undefined) db.share_token = conv.shareToken;
  if (conv.deletedAt !== undefined) db.deleted_at = conv.deletedAt ? conv.deletedAt.toISOString() : null;
  return db;
}

export function messageToDb(msg: Partial<Message>): Partial<DbMessage> {
  const db: Partial<DbMessage> = {};
  if (msg.conversationId !== undefined) db.conversation_id = msg.conversationId;
  if (msg.role !== undefined) db.role = msg.role;
  if (msg.content !== undefined) db.content = msg.content;
  if (msg.model !== undefined) db.model = msg.model;
  if (msg.status !== undefined) db.status = msg.status;
  return db;
}
