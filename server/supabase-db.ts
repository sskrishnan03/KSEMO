// Supabase database implementation for KSEMO
// This replaces the in-memory storage with persistent Supabase backend
import { createClient } from "@supabase/supabase-js";
import {
  User,
  InsertUser,
  Conversation,
  Message,
  UserPreference,
  VoiceSession,
  MessageVersion,
  MessageFeedback,
  Project,
  KsemoFile,
  Attachment,
  Memory,
  Task,
  TaskActivity,
  dbToUser,
  dbToConversation,
  dbToMessage,
  type DbUser,
  type DbConversation,
  type DbMessage,
} from "../supabase-schema/04-types";

const supabaseUrl = process.env.SUPABASE_URL || "https://vauqtdjpjwlhfgixfrij.supabase.co";
const supabaseKey = process.env.SUPABASE_ANON_KEY || "sb_publishable_wCv3g2jSb_qMbR7I3Fifbg_obIw1iuq";

const supabase = createClient(supabaseUrl, supabaseKey);

// Helper function to handle Supabase errors
function handleSupabaseError(error: any, operation: string): never {
  console.error(`[Supabase] ${operation} failed:`, error);
  throw new Error(`Database operation failed: ${operation}`);
}

// Helper function to convert database results
function toDate(dateString: string | null): Date | null {
  return dateString ? new Date(dateString) : null;
}

// ============================================
// USER FUNCTIONS
// ============================================

export async function upsertUser(user: InsertUser): Promise<void> {
  const { data, error } = await supabase.rpc("upsert_user", {
    p_open_id: user.open_id,
    p_name: user.name || null,
    p_email: user.email || null,
    p_login_method: user.login_method || null,
    p_password_hash: user.password_hash || null,
    p_last_signed_in: user.last_signed_in?.toISOString() || new Date().toISOString(),
  });

  if (error) {
    handleSupabaseError(error, "upsertUser");
  }
}

export async function getUserByOpenId(openId: string): Promise<User | undefined> {
  const { data, error } = await supabase
    .from("users")
    .select("*")
    .eq("open_id", openId)
    .single();

  if (error) {
    if (error.code === "PGRST116") return undefined; // Not found
    handleSupabaseError(error, "getUserByOpenId");
  }

  return dbToUser(data as DbUser);
}

export async function getUserByEmail(email: string): Promise<User | undefined> {
  const { data, error } = await supabase.rpc("get_user_by_email", {
    p_email: email,
  });

  if (error) {
    if (error.code === "PGRST116") return undefined;
    handleSupabaseError(error, "getUserByEmail");
  }

  if (!data || data.length === 0) return undefined;
  return dbToUser(data[0] as DbUser);
}

// ============================================
// CONVERSATION FUNCTIONS
// ============================================

export async function listConversationsForUser(
  userId: number,
  scope: "active" | "archived" | "trash" = "active"
): Promise<Conversation[]> {
  let query = supabase
    .from("conversations")
    .select("*")
    .eq("user_id", userId);

  if (scope === "trash") {
    query = query.not("deleted_at", "is", null);
  } else if (scope === "archived") {
    query = query.eq("is_archived", true).is("deleted_at", null);
  } else {
    query = query.eq("is_archived", false).is("deleted_at", null);
  }

  const { data, error } = await query.order("is_pinned", { ascending: false })
    .order("updated_at", { ascending: false });

  if (error) {
    handleSupabaseError(error, "listConversationsForUser");
  }

  return (data as DbConversation[]).map(dbToConversation);
}

export async function getConversationForUser(
  id: string,
  userId: number
): Promise<Conversation | undefined> {
  const { data, error } = await supabase
    .from("conversations")
    .select("*")
    .eq("id", id)
    .eq("user_id", userId)
    .single();

  if (error) {
    if (error.code === "PGRST116") return undefined;
    handleSupabaseError(error, "getConversationForUser");
  }

  return dbToConversation(data as DbConversation);
}

export async function createConversationForUser(input: {
  id: string;
  userId: number;
  title?: string;
  conversationType?: "text" | "voice" | "mixed";
}): Promise<Conversation> {
  const { data, error } = await supabase.from("conversations").insert({
    id: input.id,
    user_id: input.userId,
    title: input.title || "New conversation",
    conversation_type: input.conversationType || "text",
    is_pinned: false,
    is_archived: false,
    is_public: false,
    share_token: null,
    deleted_at: null,
  }).select().single();

  if (error) {
    handleSupabaseError(error, "createConversationForUser");
  }

  return dbToConversation(data as DbConversation);
}

export async function updateConversationForUser(
  id: string,
  userId: number,
  values: Partial<
    Pick<
      Conversation,
      | "title"
      | "is_pinned"
      | "is_archived"
      | "is_public"
      | "share_token"
      | "conversation_type"
      | "project_id"
    >
  >
): Promise<Conversation | undefined> {
  const updateData: any = {};
  if (values.title !== undefined) updateData.title = values.title;
  if (values.is_pinned !== undefined) updateData.is_pinned = values.is_pinned;
  if (values.is_archived !== undefined) updateData.is_archived = values.is_archived;
  if (values.is_public !== undefined) updateData.is_public = values.is_public;
  if (values.share_token !== undefined) updateData.share_token = values.share_token;
  if (values.conversation_type !== undefined) updateData.conversation_type = values.conversation_type;
  if (values.project_id !== undefined) updateData.project_id = values.project_id;

  const { data, error } = await supabase
    .from("conversations")
    .update(updateData)
    .eq("id", id)
    .eq("user_id", userId)
    .select()
    .single();

  if (error) {
    if (error.code === "PGRST116") return undefined;
    handleSupabaseError(error, "updateConversationForUser");
  }

  return dbToConversation(data as DbConversation);
}

export async function getPublicConversationByToken(shareToken: string) {
  const { data, error } = await supabase.rpc("get_public_conversation_by_token", {
    p_share_token: shareToken,
  });

  if (error) {
    if (error.code === "PGRST116") return null;
    handleSupabaseError(error, "getPublicConversationByToken");
  }

  if (!data || data.length === 0) return null;

  // Group by conversation
  const conversation = {
    id: data[0].conversation_id,
    title: data[0].title,
    conversation_type: data[0].conversation_type,
    created_at: new Date(data[0].created_at),
  };

  const messages = data
    .filter((row: any) => row.message_id !== null)
    .map((row: any) => ({
      id: row.message_id,
      conversation_id: row.conversation_id,
      role: row.message_role,
      content: row.message_content,
      created_at: new Date(row.message_created_at),
      updated_at: new Date(row.message_created_at),
    }));

  return { conversation, messages };
}

export async function deleteConversationForUser(id: string, userId: number): Promise<void> {
  const { error } = await supabase
    .from("conversations")
    .delete()
    .eq("id", id)
    .eq("user_id", userId);

  if (error) {
    handleSupabaseError(error, "deleteConversationForUser");
  }
}

export async function moveConversationToTrash(id: string, userId: number): Promise<Conversation | undefined> {
  const { data, error } = await supabase.rpc("move_conversation_to_trash", {
    p_conversation_id: id,
    p_user_id: userId,
  });

  if (error) {
    handleSupabaseError(error, "moveConversationToTrash");
  }

  if (!data) return undefined;
  return getConversationForUser(id, userId);
}

export async function restoreConversationForUser(id: string, userId: number): Promise<Conversation | undefined> {
  const { data, error } = await supabase.rpc("restore_conversation", {
    p_conversation_id: id,
    p_user_id: userId,
  });

  if (error) {
    handleSupabaseError(error, "restoreConversationForUser");
  }

  if (!data) return undefined;
  return getConversationForUser(id, userId);
}

// ============================================
// MESSAGE FUNCTIONS
// ============================================

export async function listMessagesForConversation(conversationId: string): Promise<Message[]> {
  const { data, error } = await supabase
    .from("messages")
    .select("*")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true });

  if (error) {
    handleSupabaseError(error, "listMessagesForConversation");
  }

  return (data as DbMessage[]).map(dbToMessage);
}

export async function createMessage(input: Message): Promise<void> {
  const { error } = await supabase.from("messages").insert({
    id: input.id,
    conversation_id: input.conversation_id,
    role: input.role,
    content: input.content,
    model: input.model,
    status: input.status,
  });

  if (error) {
    handleSupabaseError(error, "createMessage");
  }
}

export async function updateMessage(
  id: string,
  values: Partial<Pick<Message, "content" | "model" | "status">>
): Promise<void> {
  const { error } = await supabase
    .from("messages")
    .update(values)
    .eq("id", id);

  if (error) {
    handleSupabaseError(error, "updateMessage");
  }
}

export async function getMessageForUser(messageId: string, userId: number): Promise<Message | undefined> {
  const { data, error } = await supabase
    .from("messages")
    .select(`
      *,
      conversations!inner(user_id)
    `)
    .eq("id", messageId)
    .eq("conversations.user_id", userId)
    .single();

  if (error) {
    if (error.code === "PGRST116") return undefined;
    handleSupabaseError(error, "getMessageForUser");
  }

  return dbToMessage(data as DbMessage);
}

export async function deleteMessageForUser(messageId: string, userId: number): Promise<boolean> {
  const message = await getMessageForUser(messageId, userId);
  if (!message) return false;

  const { error } = await supabase
    .from("messages")
    .delete()
    .eq("id", messageId);

  if (error) {
    handleSupabaseError(error, "deleteMessageForUser");
  }

  return true;
}

export async function editMessageForUser(input: {
  id: string;
  userId: number;
  versionId: string;
  content: string;
}): Promise<Message | undefined> {
  const message = await getMessageForUser(input.id, input.userId);
  if (!message) return undefined;

  // Save version
  const { error: versionError } = await supabase.from("message_versions").insert({
    id: input.versionId,
    message_id: message.id,
    content: message.content,
  });

  if (versionError) {
    handleSupabaseError(versionError, "editMessageForUser (save version)");
  }

  // Update message
  const { data, error } = await supabase
    .from("messages")
    .update({ content: input.content })
    .eq("id", input.id)
    .select()
    .single();

  if (error) {
    handleSupabaseError(error, "editMessageForUser (update message)");
  }

  return dbToMessage(data as DbMessage);
}

export async function listMessageVersionsForUser(messageId: string, userId: number): Promise<MessageVersion[]> {
  const message = await getMessageForUser(messageId, userId);
  if (!message) return [];

  const { data, error } = await supabase
    .from("message_versions")
    .select("*")
    .eq("message_id", messageId)
    .order("created_at", { ascending: false });

  if (error) {
    handleSupabaseError(error, "listMessageVersionsForUser");
  }

  return (data || []).map((v: any) => ({
    id: v.id,
    message_id: v.message_id,
    content: v.content,
    created_at: new Date(v.created_at),
  }));
}

export async function setMessageFeedbackForUser(input: {
  id: string;
  messageId: string;
  userId: number;
  value: "up" | "down";
}): Promise<void> {
  const { error } = await supabase.rpc("set_message_feedback", {
    p_message_id: input.messageId,
    p_user_id: input.userId,
    p_value: input.value,
  });

  if (error) {
    handleSupabaseError(error, "setMessageFeedbackForUser");
  }
}

export async function searchConversationMessages(userId: number, query: string) {
  const { data, error } = await supabase.rpc("search_messages", {
    p_user_id: userId,
    p_query: query,
  });

  if (error) {
    handleSupabaseError(error, "searchConversationMessages");
  }

  return (data || []).map((row: any) => ({
    conversationId: row.conversation_id,
    conversationTitle: row.conversation_title,
    messageId: row.message_id,
    content: row.content,
    role: row.role,
    createdAt: new Date(row.created_at),
  }));
}

export async function searchConversationTitles(userId: number, query: string) {
  const { data, error } = await supabase.rpc("search_conversation_titles", {
    p_user_id: userId,
    p_query: query,
  });

  if (error) {
    handleSupabaseError(error, "searchConversationTitles");
  }

  return (data || []).map((row: any) => ({
    id: row.id,
    title: row.title,
    updatedAt: new Date(row.updated_at),
  }));
}

// ============================================
// USER PREFERENCES FUNCTIONS
// ============================================

export async function getUserPreferences(userId: number): Promise<UserPreference | undefined> {
  const { data, error } = await supabase
    .from("user_preferences")
    .select("*")
    .eq("user_id", userId)
    .single();

  if (error) {
    if (error.code === "PGRST116") return undefined;
    handleSupabaseError(error, "getUserPreferences");
  }

  return {
    user_id: data.user_id,
    selected_model: data.selected_model,
    persona: data.persona,
    custom_instructions: data.custom_instructions,
    speech_rate: data.speech_rate,
    auto_play_responses: data.auto_play_responses,
    reduce_motion: data.reduce_motion,
    created_at: new Date(data.created_at),
    updated_at: new Date(data.updated_at),
  };
}

export async function upsertUserPreferences(
  userId: number,
  values: Partial<Omit<UserPreference, "user_id" | "created_at" | "updated_at">>
): Promise<UserPreference | undefined> {
  const { error } = await supabase.rpc("upsert_user_preferences", {
    p_user_id: userId,
    p_selected_model: values.selected_model || null,
    p_persona: values.persona || "balanced",
    p_custom_instructions: values.custom_instructions || null,
    p_speech_rate: values.speech_rate || 100,
    p_auto_play_responses: values.auto_play_responses || false,
    p_reduce_motion: values.reduce_motion || false,
  });

  if (error) {
    handleSupabaseError(error, "upsertUserPreferences");
  }

  return getUserPreferences(userId);
}

// ============================================
// VOICE SESSION FUNCTIONS
// ============================================

export async function createVoiceSession(input: {
  id: string;
  userId: number;
  conversationId: string;
}): Promise<VoiceSession> {
  const { data, error } = await supabase.from("voice_sessions").insert({
    id: input.id,
    user_id: input.userId,
    conversation_id: input.conversationId,
    status: "connecting",
  }).select().single();

  if (error) {
    handleSupabaseError(error, "createVoiceSession");
  }

  return {
    id: data.id,
    user_id: data.user_id,
    conversation_id: data.conversation_id,
    status: data.status,
    created_at: new Date(data.created_at),
    updated_at: new Date(data.updated_at),
  };
}

export async function updateVoiceSessionForUser(
  id: string,
  userId: number,
  status: VoiceSession["status"]
): Promise<void> {
  const { error } = await supabase
    .from("voice_sessions")
    .update({ status })
    .eq("id", id)
    .eq("user_id", userId);

  if (error) {
    handleSupabaseError(error, "updateVoiceSessionForUser");
  }
}

// ============================================
// FILE FUNCTIONS
// ============================================

export async function listMessageFilesForUser(messageId: string, userId: number) {
  const message = await getMessageForUser(messageId, userId);
  if (!message) return [];

  const { data, error } = await supabase
    .from("attachments")
    .select(`
      file_id,
      files!inner(id, user_id, filename, mime_type, url, storage_key)
    `)
    .eq("message_id", messageId)
    .eq("files.user_id", userId);

  if (error) {
    handleSupabaseError(error, "listMessageFilesForUser");
  }

  return (data || []).map((row: any) => ({
    id: row.files.id,
    filename: row.files.filename,
    mimeType: row.files.mime_type,
    url: row.files.url,
    storageKey: row.files.storage_key,
  }));
}

export async function attachFileToMessageForUser(input: {
  id: string;
  fileId: string;
  messageId: string;
  userId: number;
}) {
  const message = await getMessageForUser(input.messageId, input.userId);
  if (!message) return undefined;

  // Check if file belongs to user
  const { data: fileData, error: fileError } = await supabase
    .from("files")
    .select("user_id")
    .eq("id", input.fileId)
    .single();

  if (fileError || !fileData || fileData.user_id !== input.userId) {
    return undefined;
  }

  // Check if attachment already exists
  const { data: existing } = await supabase
    .from("attachments")
    .select("*")
    .eq("file_id", input.fileId)
    .eq("message_id", input.messageId)
    .single();

  if (existing) {
    return { messageId: input.messageId, fileId: input.fileId };
  }

  const { error } = await supabase.from("attachments").insert({
    id: input.id,
    file_id: input.fileId,
    message_id: input.messageId,
    conversation_id: message.conversation_id,
  });

  if (error) {
    handleSupabaseError(error, "attachFileToMessageForUser");
  }

  return { messageId: input.messageId, fileId: input.fileId };
}

// ============================================
// PROJECT FUNCTIONS
// ============================================

export async function listProjectsForUser(userId: number): Promise<Project[]> {
  const { data, error } = await supabase
    .from("projects")
    .select("*")
    .eq("user_id", userId)
    .eq("is_archived", false)
    .order("updated_at", { ascending: false });

  if (error) {
    handleSupabaseError(error, "listProjectsForUser");
  }

  return (data || []).map((p: any) => ({
    id: p.id,
    user_id: p.user_id,
    name: p.name,
    description: p.description,
    instructions: p.instructions,
    is_archived: p.is_archived,
    created_at: new Date(p.created_at),
    updated_at: new Date(p.updated_at),
  }));
}

export async function createProjectForUser(input: {
  id: string;
  userId: number;
  name: string;
  description?: string;
  instructions?: string;
}): Promise<Project> {
  const { data, error } = await supabase.from("projects").insert({
    id: input.id,
    user_id: input.userId,
    name: input.name,
    description: input.description || null,
    instructions: input.instructions || null,
    is_archived: false,
  }).select().single();

  if (error) {
    handleSupabaseError(error, "createProjectForUser");
  }

  return {
    id: data.id,
    user_id: data.user_id,
    name: data.name,
    description: data.description,
    instructions: data.instructions,
    is_archived: data.is_archived,
    created_at: new Date(data.created_at),
    updated_at: new Date(data.updated_at),
  };
}

// ============================================
// MEMORY FUNCTIONS
// ============================================

export async function listMemoriesForUser(userId: number): Promise<Memory[]> {
  const { data, error } = await supabase
    .from("memories")
    .select("*")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false });

  if (error) {
    handleSupabaseError(error, "listMemoriesForUser");
  }

  return (data || []).map((m: any) => ({
    id: m.id,
    user_id: m.user_id,
    project_id: m.project_id,
    category: m.category,
    content: m.content,
    is_active: m.is_active,
    created_at: new Date(m.created_at),
    updated_at: new Date(m.updated_at),
  }));
}

export async function createMemoryForUser(input: {
  id: string;
  userId: number;
  content: string;
  category?: "preference" | "fact" | "project" | "instruction";
  projectId?: string;
}): Promise<Memory> {
  const { data, error } = await supabase.from("memories").insert({
    id: input.id,
    user_id: input.userId,
    content: input.content,
    category: input.category || "fact",
    project_id: input.projectId || null,
    is_active: true,
  }).select().single();

  if (error) {
    handleSupabaseError(error, "createMemoryForUser");
  }

  return {
    id: data.id,
    user_id: data.user_id,
    project_id: data.project_id,
    category: data.category,
    content: data.content,
    is_active: data.is_active,
    created_at: new Date(data.created_at),
    updated_at: new Date(data.updated_at),
  };
}

export async function searchMemoriesForUser(userId: number, query: string) {
  const { data, error } = await supabase.rpc("search_memories", {
    p_user_id: userId,
    p_query: query,
  });

  if (error) {
    handleSupabaseError(error, "searchMemoriesForUser");
  }

  return { memories: (data || []).slice(0, 8) };
}

// ============================================
// TASK FUNCTIONS
// ============================================

export async function getTaskForUser(taskId: string, userId: number): Promise<Task | undefined> {
  const { data, error } = await supabase
    .from("tasks")
    .select("*")
    .eq("id", taskId)
    .eq("user_id", userId)
    .single();

  if (error) {
    if (error.code === "PGRST116") return undefined;
    handleSupabaseError(error, "getTaskForUser");
  }

  return {
    id: data.id,
    user_id: data.user_id,
    agent_id: data.agent_id,
    project_id: data.project_id,
    conversation_id: data.conversation_id,
    title: data.title,
    details: data.details,
    status: data.status,
    priority: data.priority,
    due_at: data.due_at ? new Date(data.due_at) : null,
    created_at: new Date(data.created_at),
    updated_at: new Date(data.updated_at),
  };
}

export async function listTaskActivitiesForUser(taskId: string, userId: number) {
  const { data, error } = await supabase
    .from("task_activities")
    .select("*")
    .eq("task_id", taskId)
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) {
    handleSupabaseError(error, "listTaskActivitiesForUser");
  }

  return (data || []).map((a: any) => ({
    id: a.id,
    user_id: a.user_id,
    task_id: a.task_id,
    status: a.status,
    summary: a.summary,
    detail: a.detail,
    started_at: a.started_at ? new Date(a.started_at) : null,
    completed_at: a.completed_at ? new Date(a.completed_at) : null,
    created_at: new Date(a.created_at),
    updated_at: new Date(a.updated_at),
  }));
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

  const status = input.status || "queued";
  const now = new Date();

  const { data, error } = await supabase.from("task_activities").insert({
    id: input.id,
    user_id: input.userId,
    task_id: input.taskId,
    status,
    summary: input.summary,
    detail: input.detail || null,
    started_at: status === "running" ? now.toISOString() : null,
    completed_at: ["completed", "failed", "cancelled"].includes(status) ? now.toISOString() : null,
  }).select().single();

  if (error) {
    handleSupabaseError(error, "createTaskActivityForUser");
  }

  return {
    id: data.id,
    user_id: data.user_id,
    task_id: data.task_id,
    status: data.status,
    summary: data.summary,
    detail: data.detail,
    started_at: data.started_at ? new Date(data.started_at) : null,
    completed_at: data.completed_at ? new Date(data.completed_at) : null,
    created_at: new Date(data.created_at),
    updated_at: new Date(data.updated_at),
  };
}

export async function updateTaskActivityForUser(input: {
  id: string;
  userId: number;
  summary?: string;
  detail?: string | null;
  status?: "queued" | "running" | "completed" | "failed" | "cancelled";
}) {
  const activity = await supabase
    .from("task_activities")
    .select("*")
    .eq("id", input.id)
    .eq("user_id", input.userId)
    .single();

  if (activity.error) {
    if (activity.error.code === "PGRST116") return undefined;
    handleSupabaseError(activity.error, "updateTaskActivityForUser (get)");
  }

  const updateData: any = {};
  if (input.summary !== undefined) updateData.summary = input.summary;
  if (input.detail !== undefined) updateData.detail = input.detail;
  if (input.status !== undefined) {
    updateData.status = input.status;
    const now = new Date();
    if (input.status === "running" && !activity.data.started_at) {
      updateData.started_at = now.toISOString();
    }
    if (["completed", "failed", "cancelled"].includes(input.status)) {
      updateData.completed_at = now.toISOString();
    }
  }

  const { data, error } = await supabase
    .from("task_activities")
    .update(updateData)
    .eq("id", input.id)
    .eq("user_id", input.userId)
    .select()
    .single();

  if (error) {
    handleSupabaseError(error, "updateTaskActivityForUser (update)");
  }

  return {
    id: data.id,
    user_id: data.user_id,
    task_id: data.task_id,
    status: data.status,
    summary: data.summary,
    detail: data.detail,
    started_at: data.started_at ? new Date(data.started_at) : null,
    completed_at: data.completed_at ? new Date(data.completed_at) : null,
    created_at: new Date(data.created_at),
    updated_at: new Date(data.updated_at),
  };
}

// ============================================
// LEGACY COMPATIBILITY
// ============================================

// Export a function that matches the old getDb() signature
export async function getDb() {
  // Return a mock object that maintains compatibility with the old API
  // This allows gradual migration from in-memory to Supabase
  return {
    users: new Map(),
    conversations: new Map(),
    messages: new Map(),
    userPreferences: new Map(),
    voiceSessions: new Map(),
    messageVersions: new Map(),
    messageFeedback: new Map(),
    projects: new Map(),
    files: new Map(),
    attachments: new Map(),
    memories: new Map(),
    tasks: new Map(),
    taskActivities: new Map(),
    nextUserId: 1,
  };
}
