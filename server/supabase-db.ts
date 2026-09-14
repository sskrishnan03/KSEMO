import { createClient } from "@supabase/supabase-js";
import { inMemoryStore, createMockSupabaseClient } from "./inMemoryStore";
import type {
  User,
  InsertUser,
  Conversation,
  Message,
  UserPreference,
  InsertUserPreference,
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
import {
  dbToUser,
  dbToConversation,
  dbToMessage,
  dbToUserPreference,
  dbToMemorySettings,
  dbToMemory,
} from "../supabase-schema/04-types";

export type {
  User,
  InsertUser,
  Conversation,
  Message,
  UserPreference,
  InsertUserPreference,
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
};

export interface MemoryFactToSave {
  content: string;
  category?: string;
  title?: string;
  isSensitive?: boolean;
  source?: "manual" | "chat";
}

/**
 * Thrown when Supabase is configured but a query fails (network outage,
 * invalid credentials, schema mismatch, timeout, ...). Callers that care
 * (the auth session pipeline) use this to distinguish "the database is
 * temporarily unavailable" from "this session is genuinely invalid".
 */
export class DatabaseUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DatabaseUnavailableError";
  }
}

export const isSupabaseConfigured = Boolean(
  process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
);

const supabaseUrl =
  process.env.SUPABASE_URL || "https://vauqtdjpjwlhfgixfrij.supabase.co";
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const SUPABASE_REQUEST_TIMEOUT_MS = 20_000;

function createBoundedFetch(): typeof fetch {
  return (input, init) => {
    const controller = new AbortController();
    const timer = setTimeout(
      () =>
        controller.abort(
          new Error(
            `Supabase request timed out after ${SUPABASE_REQUEST_TIMEOUT_MS}ms`
          )
        ),
      SUPABASE_REQUEST_TIMEOUT_MS
    );
    const upstreamSignal = init?.signal;
    if (upstreamSignal) {
      if (upstreamSignal.aborted) controller.abort(upstreamSignal.reason);
      else
        upstreamSignal.addEventListener(
          "abort",
          () => controller.abort(upstreamSignal.reason),
          { once: true }
        );
    }
    return fetch(input, { ...init, signal: controller.signal }).finally(() =>
      clearTimeout(timer)
    );
  };
}

// The server always talks to Supabase with the service-role key (bypasses
// RLS). Ownership safety therefore comes from every query strictly filtering
// by `user_id`; never trust a client-supplied id alone.
export const supabase: any = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseKey!, {
      global: {
        fetch: createBoundedFetch(),
      },
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    })
  : createMockSupabaseClient();

export function getDb(): any {
  return supabase;
}

function throwDb(label: string, error: unknown): never {
  const message =
    error && typeof error === "object" && "message" in error
      ? String((error as any).message)
      : String(error);
  console.error(`[supabase-db] ${label} failed:`, error);
  throw new DatabaseUnavailableError(`[supabase-db] ${label}: ${message}`);
}

function isNotFound(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const code = (error as any).code;
  return code === "PGRST116";
}

function nowIso(): string {
  return new Date().toISOString();
}

// When Supabase is NOT configured every exported function falls back to the
// in-memory store so local development and the test suite keep working
// without a database.
const useMemoryFallback = (): boolean => !isSupabaseConfigured;

// ============================================================================
// User operations
// ============================================================================

export async function upsertUser(user: InsertUser): Promise<void> {
  if (useMemoryFallback()) {
    await inMemoryStore.upsertUser(user);
    return;
  }

  // The upsert_user SQL function COALESCEs existing columns with the new
  // values, so a partial update like `{ openId, lastSignedIn }` can never wipe
  // name/email/password_hash. It also lets Postgres generate/keep `id`.
  const { error } = await supabase.rpc("upsert_user", {
    p_open_id: user.openId,
    p_name: user.name ?? null,
    p_email: user.email ?? null,
    p_login_method: user.loginMethod ?? null,
    p_password_hash: user.passwordHash ?? null,
    p_last_signed_in: (user.lastSignedIn ?? new Date()).toISOString(),
  });
  if (error) throwDb("upsert_user", error);
}

export async function getUserByOpenId(
  openId: string
): Promise<User | undefined> {
  if (useMemoryFallback()) {
    return inMemoryStore.getUserByOpenId(openId);
  }
  const { data, error } = await supabase
    .from("users")
    .select("*")
    .eq("open_id", openId)
    .maybeSingle();
  if (error && !isNotFound(error)) throwDb("getUserByOpenId", error);
  return data ? dbToUser(data) : undefined;
}

export async function getUserByEmail(
  email: string
): Promise<User | undefined> {
  if (useMemoryFallback()) {
    return inMemoryStore.getUserByEmail(email);
  }
  const { data, error } = await supabase
    .from("users")
    .select("*")
    .eq("email", email.toLowerCase().trim())
    .maybeSingle();
  if (error && !isNotFound(error)) throwDb("getUserByEmail", error);
  return data ? dbToUser(data) : undefined;
}

export async function updateUserProfile(
  userId: number,
  nameOrValues: string | { name?: string | null }
): Promise<User | undefined> {
  const name =
    typeof nameOrValues === "string"
      ? nameOrValues
      : (nameOrValues?.name ?? "");
  if (useMemoryFallback()) {
    return inMemoryStore.updateUserProfile(userId, name);
  }
  const { data, error } = await supabase
    .from("users")
    .update({ name, updated_at: nowIso() })
    .eq("id", userId)
    .select("*")
    .maybeSingle();
  if (error && !isNotFound(error)) throwDb("updateUserProfile", error);
  return data ? dbToUser(data) : undefined;
}

export async function deleteUserAccount(userId: number): Promise<boolean> {
  if (useMemoryFallback()) {
    return inMemoryStore.deleteUserAccount(userId);
  }
  // Cascading foreign keys remove every piece of the user's data.
  const { data, error } = await supabase
    .from("users")
    .delete()
    .eq("id", userId)
    .select("id");
  if (error) throwDb("deleteUserAccount", error);
  return Array.isArray(data) && data.length > 0;
}

// ============================================================================
// Conversation operations
// ============================================================================

export async function listConversationsForUser(
  userId: number,
  scope: "active" | "archived" | "trash" | "shared" = "active"
): Promise<Conversation[]> {
  if (useMemoryFallback()) {
    return inMemoryStore.listConversationsForUser(userId, scope);
  }
  let query = supabase.from("conversations").select("*").eq("user_id", userId);
  if (scope === "active") {
    query = query.is("deleted_at", null).eq("is_archived", false);
  } else if (scope === "archived") {
    query = query.eq("is_archived", true).is("deleted_at", null);
  } else if (scope === "trash") {
    query = query.not("deleted_at", "is", null);
  } else if (scope === "shared") {
    query = query.eq("is_public", true);
  }
  const { data, error } = await query.order("updated_at", { ascending: false });
  if (error) throwDb("listConversationsForUser", error);
  return (data || []).map((row: any) => dbToConversation(row));
}

export async function getConversationForUser(
  id: string,
  userId: number
): Promise<Conversation | undefined> {
  if (useMemoryFallback()) {
    return inMemoryStore.getConversationForUser(id, userId);
  }
  const { data, error } = await supabase
    .from("conversations")
    .select("*")
    .eq("id", id)
    .eq("user_id", userId)
    .maybeSingle();
  if (error && !isNotFound(error)) throwDb("getConversationForUser", error);
  return data ? dbToConversation(data) : undefined;
}

export async function createConversationForUser(input: {
  id: string;
  userId: number;
  title?: string;
  conversationType?: "text" | "voice" | "mixed";
}): Promise<Conversation> {
  if (useMemoryFallback()) {
    return inMemoryStore.createConversationForUser(input);
  }
  const { data, error } = await supabase
    .from("conversations")
    .insert({
      id: input.id,
      user_id: input.userId,
      title: input.title || "New Chat",
      conversation_type: input.conversationType || "text",
      is_pinned: false,
      is_archived: false,
      is_public: false,
      share_token: null,
      project_id: null,
      deleted_at: null,
    })
    .select("*")
    .single();
  if (error) throwDb("createConversationForUser", error);
  return dbToConversation(data);
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
): Promise<Conversation | undefined> {
  if (useMemoryFallback()) {
    return inMemoryStore.updateConversationForUser(id, userId, values);
  }
  const update: Record<string, any> = {};
  if (values.title !== undefined) update.title = values.title;
  if (values.isPinned !== undefined) update.is_pinned = values.isPinned;
  if (values.isArchived !== undefined) update.is_archived = values.isArchived;
  if (values.isPublic !== undefined) update.is_public = values.isPublic;
  if (values.shareToken !== undefined) update.share_token = values.shareToken;
  if (values.conversationType !== undefined)
    update.conversation_type = values.conversationType;
  if (values.projectId !== undefined) update.project_id = values.projectId;
  if (Object.keys(update).length === 0) {
    return getConversationForUser(id, userId);
  }
  const { data, error } = await supabase
    .from("conversations")
    .update(update)
    .eq("id", id)
    .eq("user_id", userId)
    .select("*")
    .maybeSingle();
  if (error && !isNotFound(error)) throwDb("updateConversationForUser", error);
  return data ? dbToConversation(data) : undefined;
}

export async function getPublicConversationByToken(
  shareToken: string
): Promise<any> {
  if (useMemoryFallback()) {
    return inMemoryStore.getPublicConversationByToken(shareToken);
  }
  const { data: conv, error } = await supabase
    .from("conversations")
    .select("*")
    .eq("share_token", shareToken)
    .eq("is_public", true)
    .is("deleted_at", null)
    .maybeSingle();
  if (error && !isNotFound(error)) throwDb("getPublicConversationByToken", error);
  if (!conv) return null;
  const { data: messages, error: msgError } = await supabase
    .from("messages")
    .select("id, role, content, model, created_at")
    .eq("conversation_id", conv.id)
    .in("role", ["user", "assistant"])
    .order("created_at", { ascending: true });
  if (msgError) throwDb("getPublicConversationByToken.messages", msgError);
  return {
    id: conv.id,
    title: conv.title,
    conversation_type: conv.conversation_type,
    created_at: conv.created_at,
    messages: (messages || []).map((m: any) => ({
      id: m.id,
      role: m.role,
      content: m.content,
      model: m.model,
      created_at: m.created_at,
    })),
  };
}

export async function deleteConversationForUser(
  id: string,
  userId: number
): Promise<void> {
  if (useMemoryFallback()) {
    return inMemoryStore.deleteConversationForUser(id, userId);
  }
  const { error } = await supabase
    .from("conversations")
    .delete()
    .eq("id", id)
    .eq("user_id", userId);
  if (error) throwDb("deleteConversationForUser", error);
}

export async function deleteAllConversationsForUser(
  userId: number
): Promise<number> {
  if (useMemoryFallback()) {
    return inMemoryStore.deleteAllConversationsForUser(userId);
  }
  const { data, error } = await supabase
    .from("conversations")
    .delete()
    .eq("user_id", userId)
    .select("id");
  if (error) throwDb("deleteAllConversationsForUser", error);
  return Array.isArray(data) ? data.length : 0;
}

export async function moveConversationToTrash(
  id: string,
  userId: number
): Promise<Conversation | undefined> {
  if (useMemoryFallback()) {
    return inMemoryStore.moveConversationToTrash(id, userId);
  }
  const { data, error } = await supabase.rpc("move_conversation_to_trash", {
    p_conversation_id: id,
    p_user_id: userId,
  });
  if (error) throwDb("moveConversationToTrash", error);
  if (!data) return undefined;
  return getConversationForUser(id, userId);
}

export async function restoreConversationForUser(
  id: string,
  userId: number
): Promise<Conversation | undefined> {
  if (useMemoryFallback()) {
    return inMemoryStore.restoreConversationForUser(id, userId);
  }
  const { data, error } = await supabase.rpc("restore_conversation", {
    p_conversation_id: id,
    p_user_id: userId,
  });
  if (error) throwDb("restoreConversationForUser", error);
  if (!data) return undefined;
  return getConversationForUser(id, userId);
}

// ============================================================================
// Message operations
// ============================================================================

// The messages table has no user_id column; ownership is enforced by the
// callers, which resolve the conversation through getConversationForUser /
// requireConversation first. ChatStream and the conversation router both do
// that before loading history.
export async function listMessagesForConversation(
  conversationId: string
): Promise<Message[]> {
  if (useMemoryFallback()) {
    return inMemoryStore.listMessagesForConversation(conversationId);
  }
  const { data, error } = await supabase
    .from("messages")
    .select("*")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true })
    .order("id", { ascending: true });
  if (error) throwDb("listMessagesForConversation", error);
  return (data || []).map((row: any) => dbToMessage(row));
}

export async function createMessage(input: Message): Promise<Message> {
  if (useMemoryFallback()) {
    return inMemoryStore.createMessage(input);
  }
  const { data, error } = await supabase
    .from("messages")
    .insert({
      id: input.id,
      conversation_id: input.conversationId,
      role: input.role,
      content: input.content,
      model: input.model ?? null,
      status: input.status,
      created_at: input.createdAt.toISOString(),
      updated_at: input.updatedAt.toISOString(),
    })
    .select("*")
    .single();
  if (error) throwDb("createMessage", error);
  return dbToMessage(data);
}

export async function updateMessage(
  id: string,
  values: Partial<Pick<Message, "content" | "model" | "status">>
): Promise<void> {
  if (useMemoryFallback()) {
    return inMemoryStore.updateMessage(id, values);
  }
  const update: Record<string, any> = { updated_at: nowIso() };
  if (values.content !== undefined) update.content = values.content;
  if (values.model !== undefined) update.model = values.model;
  if (values.status !== undefined) update.status = values.status;
  const { error } = await supabase
    .from("messages")
    .update(update)
    .eq("id", id);
  if (error) throwDb("updateMessage", error);
}

export async function getMessageForUser(
  messageId: string,
  userId: number
): Promise<Message | undefined> {
  if (useMemoryFallback()) {
    return inMemoryStore.getMessageForUser(messageId, userId);
  }
  const { data, error } = await supabase
    .from("messages")
    .select("*, conversations!inner(user_id)")
    .eq("id", messageId)
    .eq("conversations.user_id", userId)
    .maybeSingle();
  if (error && !isNotFound(error)) throwDb("getMessageForUser", error);
  if (!data) return undefined;
  return dbToMessage(data);
}

export async function deleteMessageForUser(
  messageId: string,
  userId: number
): Promise<boolean> {
  if (useMemoryFallback()) {
    return inMemoryStore.deleteMessageForUser(messageId, userId);
  }
  const existing = await getMessageForUser(messageId, userId);
  if (!existing) return false;
  const { error } = await supabase
    .from("messages")
    .delete()
    .eq("id", messageId);
  if (error) throwDb("deleteMessageForUser", error);
  return true;
}

export async function removeFollowingAssistantDuplicatesForUser(
  messageId: string,
  userId: number
): Promise<string[]> {
  if (useMemoryFallback()) {
    return inMemoryStore.removeFollowingAssistantDuplicatesForUser(
      messageId,
      userId
    );
  }
  const anchor = await getMessageForUser(messageId, userId);
  if (!anchor) return [];
  const { data, error } = await supabase
    .from("messages")
    .select("id, role, created_at")
    .eq("conversation_id", anchor.conversationId)
    .order("created_at", { ascending: true })
    .order("id", { ascending: true });
  if (error) throwDb("removeFollowingAssistantDuplicatesForUser", error);
  const rows = (data || []) as Array<{ id: string; role: string }>;
  const index = rows.findIndex(row => row.id === messageId);
  if (index === -1) return [];
  const deletedIds: string[] = [];
  for (let i = index + 1; i < rows.length; i++) {
    if (rows[i].role === "assistant") deletedIds.push(rows[i].id);
    else break;
  }
  if (deletedIds.length > 0) {
    const { error: delError } = await supabase
      .from("messages")
      .delete()
      .in("id", deletedIds);
    if (delError) throwDb("removeFollowingAssistantDuplicatesForUser.delete", delError);
  }
  return deletedIds;
}

export async function editMessageForUser(input: {
  id: string;
  userId: number;
  content: string;
  versionId: string;
}): Promise<Message | undefined> {
  if (useMemoryFallback()) {
    return inMemoryStore.editMessageForUser(input);
  }
  const existing = await getMessageForUser(input.id, input.userId);
  if (!existing) return undefined;

  const { error: versionError } = await supabase.from("message_versions").insert({
    id: input.versionId,
    message_id: input.id,
    content: existing.content,
  });
  if (versionError) throwDb("editMessageForUser.version", versionError);

  const { data, error } = await supabase
    .from("messages")
    .update({ content: input.content, updated_at: nowIso() })
    .eq("id", input.id)
    .select("*")
    .single();
  if (error) throwDb("editMessageForUser", error);
  return dbToMessage(data);
}

export async function listMessageVersionsForUser(
  messageId: string,
  userId: number
): Promise<MessageVersion[]> {
  if (useMemoryFallback()) {
    return inMemoryStore.listMessageVersionsForUser(messageId, userId);
  }
  const existing = await getMessageForUser(messageId, userId);
  if (!existing) return [];
  const { data, error } = await supabase
    .from("message_versions")
    .select("id, message_id, content, created_at")
    .eq("message_id", messageId)
    .order("created_at", { ascending: true });
  if (error) throwDb("listMessageVersionsForUser", error);
  return (data || []).map((row: any) => ({
    id: row.id,
    messageId: row.message_id,
    content: row.content,
    createdAt: new Date(row.created_at),
  }));
}

export async function setMessageFeedbackForUser(input: {
  id: string;
  messageId: string;
  userId: number;
  value: "up" | "down";
}): Promise<void> {
  if (useMemoryFallback()) {
    return inMemoryStore.setMessageFeedbackForUser(input);
  }
  const { error } = await supabase.rpc("set_message_feedback", {
    p_message_id: input.messageId,
    p_user_id: input.userId,
    p_value: input.value,
  });
  if (error) throwDb("setMessageFeedbackForUser", error);
}

export async function searchConversationMessages(
  userId: number,
  query: string
): Promise<any[]> {
  if (useMemoryFallback()) {
    return inMemoryStore.searchConversationMessages(userId, query);
  }
  const { data, error } = await supabase.rpc("search_messages", {
    p_user_id: userId,
    p_query: query,
  });
  if (error) throwDb("searchConversationMessages", error);
  return (data || []).map((row: any) => ({
    messageId: row.message_id,
    conversationId: row.conversation_id,
    conversationTitle: row.conversation_title,
    role: row.role,
    content: row.content,
    createdAt: row.created_at ? new Date(row.created_at) : undefined,
  }));
}

export async function searchConversationTitles(
  userId: number,
  query: string
): Promise<any[]> {
  if (useMemoryFallback()) {
    return inMemoryStore.searchConversationTitles(userId, query);
  }
  const { data, error } = await supabase.rpc("search_conversation_titles", {
    p_user_id: userId,
    p_query: query,
  });
  if (error) throwDb("searchConversationTitles", error);
  return (data || []).map((row: any) => ({
    id: row.id,
    title: row.title,
    createdAt: row.created_at ? new Date(row.created_at) : undefined,
    updatedAt: row.updated_at ? new Date(row.updated_at) : undefined,
  }));
}

// ============================================================================
// User preferences
// ============================================================================

export async function getUserPreferences(
  userId: number
): Promise<UserPreference | undefined> {
  if (useMemoryFallback()) {
    return inMemoryStore.getUserPreferences(userId);
  }
  const { data, error } = await supabase
    .from("user_preferences")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();
  if (error && !isNotFound(error)) throwDb("getUserPreferences", error);
  return data ? dbToUserPreference(data) : undefined;
}

export async function upsertUserPreferences(
  userIdOrInput: number | InsertUserPreference,
  maybeInput?: any
): Promise<void> {
  let userId: number;
  let values: Partial<any>;
  if (typeof userIdOrInput === "number") {
    userId = userIdOrInput;
    values = maybeInput || {};
  } else {
    userId = userIdOrInput.userId;
    const rest: Partial<any> = { ...(userIdOrInput as any) };
    delete rest.userId;
    delete rest.createdAt;
    delete rest.updatedAt;
    values = rest;
  }

  if (useMemoryFallback()) {
    await inMemoryStore.upsertUserPreferences(userId, values);
    return;
  }

  const { data: existing, error: findError } = await supabase
    .from("user_preferences")
    .select("user_id")
    .eq("user_id", userId)
    .maybeSingle();
  if (findError && !isNotFound(findError)) throwDb("upsertUserPreferences.find", findError);

  const row: Record<string, any> = {};
  if (values.selectedModel !== undefined) row.selected_model = values.selectedModel;
  if (values.persona !== undefined) row.persona = values.persona;
  if (values.customInstructions !== undefined)
    row.custom_instructions = values.customInstructions;
  if (values.speechRate !== undefined) row.speech_rate = values.speechRate;
  if (values.autoPlayResponses !== undefined)
    row.auto_play_responses = values.autoPlayResponses;
  if (values.reduceMotion !== undefined) row.reduce_motion = values.reduceMotion;

  if (existing) {
    if (Object.keys(row).length === 0) return;
    row.updated_at = nowIso();
    const { error } = await supabase
      .from("user_preferences")
      .update(row)
      .eq("user_id", userId);
    if (error) throwDb("upsertUserPreferences.update", error);
  } else {
    const { error } = await supabase
      .from("user_preferences")
      .insert({ user_id: userId, ...row });
    if (error) throwDb("upsertUserPreferences.insert", error);
  }
}

// ============================================================================
// Memory operations
// ============================================================================

export async function getMemorySettings(
  userId: number
): Promise<MemorySettings | undefined> {
  if (useMemoryFallback()) {
    return inMemoryStore.getMemorySettings(userId);
  }
  const { data, error } = await supabase
    .from("memory_settings")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();
  if (error && !isNotFound(error)) throwDb("getMemorySettings", error);
  return data ? dbToMemorySettings(data) : undefined;
}

export async function upsertMemorySettings(
  userId: number,
  settings: {
    memoryEnabled?: boolean;
    generateFromChats?: boolean;
    sensitiveMemoryEnabled?: boolean;
  }
): Promise<any> {
  if (useMemoryFallback()) {
    return inMemoryStore.upsertMemorySettings(userId, settings);
  }

  const row: Record<string, any> = {};
  if (settings.memoryEnabled !== undefined)
    row.memory_enabled = settings.memoryEnabled;
  if (settings.generateFromChats !== undefined)
    row.generate_from_chats = settings.generateFromChats;
  if (settings.sensitiveMemoryEnabled !== undefined)
    row.sensitive_memory_enabled = settings.sensitiveMemoryEnabled;

  const { data: existing, error: findError } = await supabase
    .from("memory_settings")
    .select("user_id")
    .eq("user_id", userId)
    .maybeSingle();
  if (findError && !isNotFound(findError)) throwDb("upsertMemorySettings.find", findError);

  if (existing) {
    row.updated_at = nowIso();
    const { error } = await supabase
      .from("memory_settings")
      .update(row)
      .eq("user_id", userId);
    if (error) throwDb("upsertMemorySettings.update", error);
  } else {
    const { error } = await supabase
      .from("memory_settings")
      .insert({ user_id: userId, ...row });
    if (error) throwDb("upsertMemorySettings.insert", error);
  }

  return getMemorySettings(userId);
}

// Live memories are stored in conversation_memories; the `memories` table is
// reserved for explicit/manual memories. Everything the app exposes maps from
// conversation_memories (see dbToMemory in supabase-schema/04-types.ts).
export async function listUserMemories(userId: number): Promise<Memory[]> {
  if (useMemoryFallback()) {
    return inMemoryStore.listUserMemories(userId);
  }
  const { data, error } = await supabase
    .from("conversation_memories")
    .select("*")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false });
  if (error) throwDb("listUserMemories", error);
  return (data || []).map((row: any) => dbToMemory(row));
}

export async function saveUserMemoryFacts(
  userId: number,
  conversationIdOrFacts: string | null | Array<MemoryFactToSave>,
  factsArg?: Array<MemoryFactToSave>
): Promise<number> {
  const conversationId =
    typeof conversationIdOrFacts === "string" ? conversationIdOrFacts : null;
  const facts = Array.isArray(conversationIdOrFacts)
    ? conversationIdOrFacts
    : (factsArg || []);

  if (useMemoryFallback()) {
    return inMemoryStore.saveUserMemoryFacts(
      userId,
      conversationId || "",
      facts.map(f => ({
        title: f.title || "Memory",
        content: f.content,
        category: f.category,
        isSensitive: f.isSensitive,
        source: f.source,
      }))
    );
  }

  if (facts.length === 0) return 0;
  const rows = facts.map(fact => ({
    user_id: userId,
    conversation_id: conversationId ?? null,
    content: fact.content || "",
    category: fact.category || "general",
  }));
  const { error } = await supabase.from("conversation_memories").insert(rows);
  if (error) throwDb("saveUserMemoryFacts", error);
  return rows.length;
}

// ============================================================================
// Voice sessions
// ============================================================================

export async function createVoiceSession(input: {
  id: string;
  userId: number;
  conversationId: string;
}): Promise<VoiceSession> {
  if (useMemoryFallback()) {
    return inMemoryStore.createVoiceSession(input);
  }
  const { data, error } = await supabase
    .from("voice_sessions")
    .insert({
      id: input.id,
      user_id: input.userId,
      conversation_id: input.conversationId,
      status: "listening",
    })
    .select("*")
    .single();
  if (error) throwDb("createVoiceSession", error);
  return {
    id: data.id,
    userId: data.user_id,
    conversationId: data.conversation_id,
    status: data.status,
    createdAt: new Date(data.created_at),
    updatedAt: new Date(data.updated_at),
  };
}

export async function updateVoiceSessionForUser(
  id: string,
  userId: number,
  status: VoiceSession["status"]
): Promise<void> {
  if (useMemoryFallback()) {
    return inMemoryStore.updateVoiceSessionForUser(id, userId, status);
  }
  const { error } = await supabase
    .from("voice_sessions")
    .update({ status, updated_at: nowIso() })
    .eq("id", id)
    .eq("user_id", userId);
  if (error) throwDb("updateVoiceSessionForUser", error);
}

// ============================================================================
// Projects & Files
// ============================================================================

export async function listProjectsForUser(userId: number): Promise<Project[]> {
  if (useMemoryFallback()) {
    return inMemoryStore.listProjectsForUser(userId);
  }
  const { data, error } = await supabase
    .from("projects")
    .select("*")
    .eq("user_id", userId)
    .eq("is_archived", false)
    .order("updated_at", { ascending: false });
  if (error) throwDb("listProjectsForUser", error);
  return (data || []).map((row: any) => ({
    id: row.id,
    userId: row.user_id,
    name: row.name,
    description: row.description ?? null,
    instructions: row.instructions ?? null,
    isArchived: row.is_archived,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  }));
}

export async function createProjectForUser(input: {
  id: string;
  userId: number;
  name: string;
  description?: string;
  instructions?: string;
}): Promise<Project> {
  if (useMemoryFallback()) {
    return inMemoryStore.createProjectForUser(input);
  }
  const { data, error } = await supabase
    .from("projects")
    .insert({
      id: input.id,
      user_id: input.userId,
      name: input.name,
      description: input.description ?? null,
      instructions: input.instructions ?? null,
      is_archived: false,
    })
    .select("*")
    .single();
  if (error) throwDb("createProjectForUser", error);
  return {
    id: data.id,
    userId: data.user_id,
    name: data.name,
    description: data.description ?? null,
    instructions: data.instructions ?? null,
    isArchived: data.is_archived,
    createdAt: new Date(data.created_at),
    updatedAt: new Date(data.updated_at),
  };
}

function dbFileToKsemoFile(row: any): KsemoFile {
  return {
    id: row.id,
    userId: row.user_id,
    projectId: row.project_id ?? null,
    storageKey: row.storage_key,
    url: row.url,
    filename: row.filename,
    mimeType: row.mime_type,
    sizeBytes: Number(row.size_bytes),
    contentText: row.content_text ?? null,
    status: row.status === "failed" ? "failed" : "ready",
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}

export async function createFileForUser(file: KsemoFile): Promise<KsemoFile> {
  if (useMemoryFallback()) {
    return inMemoryStore.createFileForUser(file);
  }
  const { data, error } = await supabase
    .from("files")
    .insert({
      id: file.id,
      user_id: file.userId,
      project_id: file.projectId ?? null,
      storage_key: file.storageKey,
      url: file.url,
      filename: file.filename,
      mime_type: file.mimeType,
      size_bytes: file.sizeBytes,
      status: file.status,
      content_text: file.contentText ?? null,
    })
    .select("*")
    .single();
  if (error) throwDb("createFileForUser", error);
  return dbFileToKsemoFile(data);
}

export async function getFileForUser(
  id: string,
  userId?: number
): Promise<KsemoFile | undefined> {
  if (useMemoryFallback()) {
    return inMemoryStore.getFileForUser(id, userId);
  }
  let query = supabase.from("files").select("*").eq("id", id);
  if (userId !== undefined && userId > 0) {
    query = query.eq("user_id", userId);
  }
  const { data, error } = await query.maybeSingle();
  if (error && !isNotFound(error)) throwDb("getFileForUser", error);
  return data ? dbFileToKsemoFile(data) : undefined;
}

export async function listFilesForUser(userId: number): Promise<KsemoFile[]> {
  if (useMemoryFallback()) {
    return inMemoryStore.listFilesForUser(userId);
  }
  const { data, error } = await supabase
    .from("files")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (error) throwDb("listFilesForUser", error);
  return (data || []).map((row: any) => dbFileToKsemoFile(row));
}

export async function updateFileForUser(
  id: string,
  userId: number,
  values: Partial<KsemoFile>
): Promise<void> {
  if (useMemoryFallback()) {
    await inMemoryStore.updateFile(id, values);
    return;
  }
  const update: Record<string, any> = { updated_at: nowIso() };
  if (values.filename !== undefined) update.filename = values.filename;
  if (values.contentText !== undefined) update.content_text = values.contentText;
  if (values.status !== undefined) update.status = values.status;
  if (values.sizeBytes !== undefined) update.size_bytes = values.sizeBytes;
  const { error } = await supabase
    .from("files")
    .update(update)
    .eq("id", id)
    .eq("user_id", userId);
  if (error) throwDb("updateFileForUser", error);
}

export async function deleteFileForUser(
  id: string,
  userId: number
): Promise<boolean> {
  if (useMemoryFallback()) {
    return inMemoryStore.deleteFile(id, userId);
  }
  const existing = await getFileForUser(id, userId);
  if (!existing) return false;
  const { error } = await supabase
    .from("files")
    .delete()
    .eq("id", id)
    .eq("user_id", userId);
  if (error) throwDb("deleteFileForUser", error);
  return true;
}

export async function listMessageFilesForUser(
  messageId: string,
  userId: number
): Promise<any[]> {
  if (useMemoryFallback()) {
    return inMemoryStore.listMessageFilesForUser(messageId, userId);
  }
  const { data: atts, error: attError } = await supabase
    .from("attachments")
    .select("file_id")
    .eq("message_id", messageId);
  if (attError) throwDb("listMessageFilesForUser.attachments", attError);

  const fileIds = Array.from(
    new Set((atts || []).map((a: any) => a.file_id))
  );
  if (fileIds.length === 0) return [];

  const { data, error } = await supabase
    .from("files")
    .select("id, filename, mime_type, size_bytes, url, storage_key, content_text, user_id")
    .in("id", fileIds)
    .eq("user_id", userId);
  if (error) throwDb("listMessageFilesForUser", error);
  return (data || []).map((row: any) => ({
    id: row.id,
    filename: row.filename,
    mimeType: row.mime_type,
    sizeBytes: Number(row.size_bytes),
    url: row.url,
    storageKey: row.storage_key,
    contentText: row.content_text ?? null,
    metadata: null,
  }));
}

export async function listConversationFilesForUser(
  conversationId: string,
  userId: number
): Promise<any[]> {
  if (useMemoryFallback()) {
    return inMemoryStore.listConversationFiles(conversationId, userId);
  }
  const { data: atts, error: attError } = await supabase
    .from("attachments")
    .select("file_id")
    .eq("conversation_id", conversationId);
  if (attError) throwDb("listConversationFilesForUser.attachments", attError);

  const fileIds = Array.from(
    new Set((atts || []).map((a: any) => a.file_id))
  );
  if (fileIds.length === 0) return [];

  const { data, error } = await supabase
    .from("files")
    .select("id, filename, mime_type, size_bytes, url, storage_key, content_text, user_id")
    .in("id", fileIds)
    .eq("user_id", userId);
  if (error) throwDb("listConversationFilesForUser", error);
  return (data || []).map((row: any) => ({
    id: row.id,
    filename: row.filename,
    mimeType: row.mime_type,
    sizeBytes: Number(row.size_bytes),
    url: row.url,
    storageKey: row.storage_key,
    contentText: row.content_text ?? null,
    metadata: null,
  }));
}

export async function attachFileToMessageForUser(input: {
  id: string;
  fileId: string;
  messageId: string;
  conversationId?: string | null;
  userId: number;
}): Promise<any> {
  if (useMemoryFallback()) {
    return inMemoryStore.attachFileToMessageForUser(input);
  }
  const { data, error } = await supabase
    .from("attachments")
    .insert({
      id: input.id,
      file_id: input.fileId,
      conversation_id: input.conversationId ?? null,
      message_id: input.messageId,
    })
    .select("*")
    .single();
  if (error) throwDb("attachFileToMessageForUser", error);
  return {
    id: data.id,
    fileId: data.file_id,
    conversationId: data.conversation_id ?? null,
    messageId: data.message_id ?? null,
    createdAt: new Date(data.created_at),
  };
}

export async function attachFileToConversationForUser(input: {
  id: string;
  fileId: string;
  conversationId: string;
  userId: number;
}): Promise<any> {
  if (useMemoryFallback()) {
    return inMemoryStore.attachFileToConversationForUser(input);
  }
  const { data, error } = await supabase
    .from("attachments")
    .insert({
      id: input.id,
      file_id: input.fileId,
      conversation_id: input.conversationId,
      message_id: null,
    })
    .select("*")
    .single();
  if (error) throwDb("attachFileToConversationForUser", error);
  return {
    id: data.id,
    fileId: data.file_id,
    conversationId: data.conversation_id ?? null,
    messageId: null,
    createdAt: new Date(data.created_at),
  };
}

// ============================================================================
// Tasks & activities
// ============================================================================

export async function getTaskForUser(
  taskId: string,
  userId: number
): Promise<Task | undefined> {
  if (useMemoryFallback()) {
    return inMemoryStore.getTaskForUser(taskId, userId);
  }
  const { data, error } = await supabase
    .from("tasks")
    .select("*")
    .eq("id", taskId)
    .eq("user_id", userId)
    .maybeSingle();
  if (error && !isNotFound(error)) throwDb("getTaskForUser", error);
  if (!data) return undefined;
  return {
    id: data.id,
    userId: data.user_id,
    agentId: data.agent_id ?? null,
    projectId: data.project_id ?? null,
    conversationId: data.conversation_id ?? null,
    title: data.title,
    details: data.details ?? null,
    status: data.status,
    priority: data.priority,
    dueAt: data.due_at ? new Date(data.due_at) : null,
    createdAt: new Date(data.created_at),
    updatedAt: new Date(data.updated_at),
  };
}

export async function listTaskActivitiesForUser(
  taskId: string,
  userId: number
): Promise<any[]> {
  if (useMemoryFallback()) {
    return inMemoryStore.listTaskActivitiesForUser(taskId, userId);
  }
  const { data, error } = await supabase
    .from("task_activities")
    .select("*, tasks!inner(user_id)")
    .eq("task_id", taskId)
    .eq("tasks.user_id", userId)
    .order("created_at", { ascending: true });
  if (error) throwDb("listTaskActivitiesForUser", error);
  return (data || []).map((row: any) => ({
    id: row.id,
    userId: row.tasks?.user_id ?? userId,
    taskId: row.task_id,
    status: row.status,
    summary: row.summary,
    detail: row.detail ?? null,
    startedAt: row.started_at ? new Date(row.started_at) : null,
    completedAt: row.completed_at ? new Date(row.completed_at) : null,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  }));
}

export async function createTaskActivityForUser(input: {
  id: string;
  userId: number;
  taskId: string;
  summary: string;
  detail?: string | null;
  status?: TaskActivity["status"];
  startedAt?: Date | null;
  completedAt?: Date | null;
}): Promise<any> {
  if (useMemoryFallback()) {
    return inMemoryStore.createTaskActivityForUser(input);
  }
  const createdAt = new Date();
  const { error } = await supabase.from("task_activities").insert({
    id: input.id,
    user_id: input.userId,
    task_id: input.taskId,
    summary: input.summary,
    detail: input.detail ?? null,
    status: input.status ?? "queued",
    started_at: input.startedAt?.toISOString() ?? null,
    completed_at: input.completedAt?.toISOString() ?? null,
  });
  if (error) throwDb("createTaskActivityForUser", error);
  return {
    id: input.id,
    userId: input.userId,
    taskId: input.taskId,
    summary: input.summary,
    detail: input.detail ?? null,
    status: input.status ?? "queued",
    startedAt: input.startedAt ?? null,
    completedAt: input.completedAt ?? null,
    createdAt,
  };
}

export async function updateTaskActivityForUser(
  id: string,
  userId: number,
  values: Partial<
    Pick<
      TaskActivity,
      "summary" | "detail" | "status" | "startedAt" | "completedAt"
    >
  >
): Promise<void> {
  if (useMemoryFallback()) {
    return inMemoryStore.updateTaskActivityForUser(id, userId, values);
  }
  const update: Record<string, any> = { updated_at: nowIso() };
  if (values.summary !== undefined) update.summary = values.summary;
  if (values.detail !== undefined) update.detail = values.detail;
  if (values.status !== undefined) update.status = values.status;
  if (values.startedAt !== undefined)
    update.started_at = values.startedAt ? values.startedAt.toISOString() : null;
  if (values.completedAt !== undefined)
    update.completed_at = values.completedAt
      ? values.completedAt.toISOString()
      : null;
  const { error } = await supabase
    .from("task_activities")
    .update(update)
    .eq("id", id)
    .eq("user_id", userId);
  if (error) throwDb("updateTaskActivityForUser", error);
}