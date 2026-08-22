// TypeScript types matching the Supabase database schema
// These types should be used to replace the in-memory types in server/db.ts

export type User = {
  id: number;
  open_id: string;
  name: string | null;
  email: string | null;
  login_method: string | null;
  password_hash: string | null;
  reset_token_hash: string | null;
  reset_token_expires_at: Date | null;
  role: "user" | "admin";
  created_at: Date;
  updated_at: Date;
  last_signed_in: Date;
};

export type InsertUser = Partial<Omit<User, "id" | "created_at" | "updated_at">> & {
  open_id: string;
  last_signed_in?: Date;
};

export type UserPreference = {
  user_id: number;
  selected_model: string | null;
  persona: "balanced" | "concise" | "creative" | "analytical";
  custom_instructions: string | null;
  speech_rate: number;
  auto_play_responses: boolean;
  reduce_motion: boolean;
  created_at: Date;
  updated_at: Date;
};

export type InsertUserPreference = Partial<
  Omit<UserPreference, "user_id" | "created_at" | "updated_at">
> & {
  user_id: number;
};

export type Project = {
  id: string;
  user_id: number;
  name: string;
  description: string | null;
  instructions: string | null;
  is_archived: boolean;
  created_at: Date;
  updated_at: Date;
};

export type InsertProject = Partial<
  Omit<Project, "id" | "created_at" | "updated_at">
> & {
  user_id: number;
  name: string;
};

export type Conversation = {
  id: string;
  user_id: number;
  project_id: string | null;
  title: string;
  conversation_type: "text" | "voice" | "mixed";
  is_pinned: boolean;
  is_archived: boolean;
  is_public: boolean;
  share_token: string | null;
  deleted_at: Date | null;
  created_at: Date;
  updated_at: Date;
};

export type InsertConversation = Partial<
  Omit<Conversation, "id" | "created_at" | "updated_at">
> & {
  id: string;
  user_id: number;
};

export type Message = {
  id: string;
  conversation_id: string;
  role: "user" | "assistant" | "system" | "tool";
  content: string;
  model: string | null;
  status: "sending" | "streaming" | "completed" | "failed" | "cancelled";
  created_at: Date;
  updated_at: Date;
};

export type InsertMessage = Partial<
  Omit<Message, "id" | "created_at" | "updated_at">
> & {
  id: string;
  conversation_id: string;
  role: string;
  content: string;
};

export type MessageVersion = {
  id: string;
  message_id: string;
  content: string;
  created_at: Date;
};

export type InsertMessageVersion = Omit<MessageVersion, "id" | "created_at"> & {
  id: string;
};

export type MessageFeedback = {
  id: string;
  message_id: string;
  user_id: number;
  value: "up" | "down";
  created_at: Date;
  updated_at: Date;
};

export type InsertMessageFeedback = Omit<
  MessageFeedback,
  "id" | "created_at" | "updated_at"
> & {
  id: string;
};

export type VoiceSession = {
  id: string;
  user_id: number;
  conversation_id: string;
  status:
    | "connecting"
    | "listening"
    | "speaking"
    | "processing"
    | "interrupted"
    | "ended"
    | "error";
  created_at: Date;
  updated_at: Date;
};

export type InsertVoiceSession = Omit<VoiceSession, "id" | "created_at" | "updated_at"> & {
  id: string;
};

export type KsemoFile = {
  id: string;
  user_id: number;
  project_id: string | null;
  storage_key: string;
  url: string;
  filename: string;
  mime_type: string;
  size_bytes: number;
  status: "ready" | "failed";
  created_at: Date;
  updated_at: Date;
};

export type InsertKsemoFile = Partial<
  Omit<KsemoFile, "id" | "created_at" | "updated_at">
> & {
  id: string;
  user_id: number;
  storage_key: string;
  url: string;
  filename: string;
  mime_type: string;
  size_bytes: number;
};

export type Attachment = {
  id: string;
  file_id: string;
  conversation_id: string | null;
  message_id: string | null;
  created_at: Date;
};

export type InsertAttachment = Omit<Attachment, "id" | "created_at"> & {
  id: string;
};

export type Memory = {
  id: string;
  user_id: number;
  project_id: string | null;
  category: "preference" | "fact" | "project" | "instruction";
  content: string;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
};

export type InsertMemory = Partial<
  Omit<Memory, "id" | "created_at" | "updated_at">
> & {
  id: string;
  user_id: number;
  content: string;
};

export type Task = {
  id: string;
  user_id: number;
  agent_id: string | null;
  project_id: string | null;
  conversation_id: string | null;
  title: string;
  details: string | null;
  status: "inbox" | "planned" | "in_progress" | "completed" | "cancelled";
  priority: "low" | "medium" | "high";
  due_at: Date | null;
  created_at: Date;
  updated_at: Date;
};

export type InsertTask = Partial<
  Omit<Task, "id" | "created_at" | "updated_at">
> & {
  id: string;
  user_id: number;
  title: string;
};

export type TaskActivity = {
  id: string;
  user_id: number;
  task_id: string;
  status: "queued" | "running" | "completed" | "failed" | "cancelled";
  summary: string;
  detail: string | null;
  started_at: Date | null;
  completed_at: Date | null;
  created_at: Date;
  updated_at: Date;
};

export type InsertTaskActivity = Partial<
  Omit<TaskActivity, "id" | "created_at" | "updated_at">
> & {
  id: string;
  user_id: number;
  task_id: string;
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

// Helper function to convert DB row to app type
export function dbToUser(db: DbUser): User {
  return {
    ...db,
    reset_token_expires_at: db.reset_token_expires_at
      ? new Date(db.reset_token_expires_at)
      : null,
    created_at: new Date(db.created_at),
    updated_at: new Date(db.updated_at),
    last_signed_in: new Date(db.last_signed_in),
  };
}

export function dbToConversation(db: DbConversation): Conversation {
  return {
    ...db,
    deleted_at: db.deleted_at ? new Date(db.deleted_at) : null,
    created_at: new Date(db.created_at),
    updated_at: new Date(db.updated_at),
  };
}

export function dbToMessage(db: DbMessage): Message {
  return {
    ...db,
    created_at: new Date(db.created_at),
    updated_at: new Date(db.updated_at),
  };
}
