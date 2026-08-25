// Supabase database implementation for KSEMO
import { createClient } from "@supabase/supabase-js";
import {
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
  dbToUser,
  dbToConversation,
  dbToMessage,
  dbToUserPreference,
  userToDb,
  conversationToDb,
  messageToDb,
  type DbUser,
  type DbConversation,
  type DbMessage,
  type DbUserPreference,
} from "../supabase-schema/04-types";

// Re-export types for external use
export type {
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
};

// Export the supabase client for direct access when needed
export { supabase };

const supabaseUrl =
  process.env.SUPABASE_URL || "https://vauqtdjpjwlhfgixfrij.supabase.co";
// Service role key is REQUIRED for backend operations to bypass RLS policies
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseKey) {
  console.error(
    "[Supabase] ERROR: SUPABASE_SERVICE_ROLE_KEY environment variable is required for backend operations"
  );
  console.error(
    "[Supabase] Using anon key as fallback - this will cause RLS policy violations"
  );
}

// A stalled database call must never hang a request (or an open SSE stream)
// forever. Every query is bounded; timeouts surface as normal errors that the
// existing error handling already reports to the client.
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
          {
            once: true,
          }
        );
    }
    return fetch(input, { ...init, signal: controller.signal }).finally(() =>
      clearTimeout(timer)
    );
  };
}

const supabase = createClient(
  supabaseUrl,
  supabaseKey || process.env.SUPABASE_ANON_KEY || "",
  {
    global: {
      fetch: createBoundedFetch(),
    },
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);

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
  const dbValues = userToDb(user);

  console.log(
    "[Supabase] Attempting upsertUser with data:",
    JSON.stringify(dbValues)
  );
  console.log(
    "[Supabase] Using service role key:",
    !!process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  // First try to get existing user
  const { data: existingUser, error: fetchError } = await supabase
    .from("users")
    .select("*")
    .eq("open_id", dbValues.open_id)
    .single();

  if (fetchError && fetchError.code !== "PGRST116") {
    // Real error (not "not found")
    console.error(
      "[Supabase] Fetch user error:",
      JSON.stringify(fetchError, null, 2)
    );
    handleSupabaseError(fetchError, "fetchUser");
  }

  if (existingUser) {
    // User exists - update them
    console.log("[Supabase] User exists, updating:", existingUser.id);
    const { data: updateData, error: updateError } = await supabase
      .from("users")
      .update({
        name: dbValues.name ?? existingUser.name,
        email: dbValues.email ?? existingUser.email,
        login_method: dbValues.login_method ?? existingUser.login_method,
        last_signed_in: dbValues.last_signed_in,
        updated_at: new Date().toISOString(),
      })
      .eq("id", existingUser.id)
      .select()
      .single();

    if (updateError) {
      console.error(
        "[Supabase] Update user error:",
        JSON.stringify(updateError, null, 2)
      );
      handleSupabaseError(updateError, "updateUser");
    }

    console.log("[Supabase] User updated successfully:", updateData);
  } else {
    // User doesn't exist - insert them
    console.log("[Supabase] User doesn't exist, inserting new user");
    const insertData: any = {
      open_id: dbValues.open_id,
      name: dbValues.name,
      email: dbValues.email,
      login_method: dbValues.login_method,
      last_signed_in: dbValues.last_signed_in,
    };

    const { data: insertResult, error: insertError } = await supabase
      .from("users")
      .insert(insertData)
      .select()
      .single();

    if (insertError) {
      console.error(
        "[Supabase] Insert user error:",
        JSON.stringify(insertError, null, 2)
      );
      handleSupabaseError(insertError, "insertUser");
    }

    console.log("[Supabase] User inserted successfully:", insertResult);
  }
}

export async function getUserByOpenId(
  openId: string
): Promise<User | undefined> {
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
  const { data, error } = await supabase
    .from("users")
    .select("*")
    .eq("email", email)
    .single();

  if (error) {
    if (error.code === "PGRST116") return undefined; // Not found
    console.error(
      "[Supabase] getUserByEmail error:",
      JSON.stringify(error, null, 2)
    );
    handleSupabaseError(error, "getUserByEmail");
  }

  return dbToUser(data as DbUser);
}

// ============================================
// CONVERSATION FUNCTIONS
// ============================================

export async function listConversationsForUser(
  userId: number,
  scope: "active" | "archived" | "trash" = "active"
): Promise<Conversation[]> {
  let query = supabase.from("conversations").select("*").eq("user_id", userId);

  if (scope === "trash") {
    query = query.not("deleted_at", "is", null);
  } else if (scope === "archived") {
    query = query.eq("is_archived", true).is("deleted_at", null);
  } else {
    query = query.eq("is_archived", false).is("deleted_at", null);
  }

  const { data, error } = await query
    .order("is_pinned", { ascending: false })
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
  conversationType?: "text";
}): Promise<Conversation> {
  const { data, error } = await supabase
    .from("conversations")
    .insert({
      id: input.id,
      user_id: input.userId,
      title: input.title || "New conversation",
      conversation_type: input.conversationType || "text",
      is_pinned: false,
      is_archived: false,
      is_public: false,
      share_token: null,
      deleted_at: null,
    })
    .select()
    .single();

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
      | "isPinned"
      | "isArchived"
      | "isPublic"
      | "shareToken"
      | "conversationType"
      | "projectId"
    >
  >
): Promise<Conversation | undefined> {
  const updateData: any = {};
  if (values.title !== undefined) updateData.title = values.title;
  if (values.isPinned !== undefined) updateData.is_pinned = values.isPinned;
  if (values.isArchived !== undefined)
    updateData.is_archived = values.isArchived;
  if (values.isPublic !== undefined) updateData.is_public = values.isPublic;
  if (values.shareToken !== undefined)
    updateData.share_token = values.shareToken;
  if (values.conversationType !== undefined)
    updateData.conversation_type = values.conversationType;
  if (values.projectId !== undefined) updateData.project_id = values.projectId;

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
  const { data, error } = await supabase.rpc(
    "get_public_conversation_by_token",
    {
      p_share_token: shareToken,
    }
  );

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

export async function deleteConversationForUser(
  id: string,
  userId: number
): Promise<void> {
  const { error } = await supabase
    .from("conversations")
    .delete()
    .eq("id", id)
    .eq("user_id", userId);

  if (error) {
    handleSupabaseError(error, "deleteConversationForUser");
  }
}

export async function deleteAllConversationsForUser(
  userId: number
): Promise<number> {
  const { data, error } = await supabase
    .from("conversations")
    .delete()
    .eq("user_id", userId)
    .select("id");

  if (error) {
    handleSupabaseError(error, "deleteAllConversationsForUser");
  }

  return data?.length ?? 0;
}

export async function moveConversationToTrash(
  id: string,
  userId: number
): Promise<Conversation | undefined> {
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

export async function restoreConversationForUser(
  id: string,
  userId: number
): Promise<Conversation | undefined> {
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

export async function listMessagesForConversation(
  conversationId: string
): Promise<Message[]> {
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
  const dbValues = messageToDb(input);
  const { error } = await supabase.from("messages").insert(dbValues);

  if (error) {
    handleSupabaseError(error, "createMessage");
  }
}

export async function updateMessage(
  id: string,
  values: Partial<Pick<Message, "content" | "model" | "status">>
): Promise<void> {
  const { error } = await supabase.from("messages").update(values).eq("id", id);

  if (error) {
    handleSupabaseError(error, "updateMessage");
  }
}

export async function getMessageForUser(
  messageId: string,
  userId: number
): Promise<Message | undefined> {
  const { data, error } = await supabase
    .from("messages")
    .select(
      `
      *,
      conversations!inner(user_id)
    `
    )
    .eq("id", messageId)
    .eq("conversations.user_id", userId)
    .single();

  if (error) {
    if (error.code === "PGRST116") return undefined;
    handleSupabaseError(error, "getMessageForUser");
  }

  return dbToMessage(data as DbMessage);
}

export async function deleteMessageForUser(
  messageId: string,
  userId: number
): Promise<boolean> {
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

export async function removeFollowingAssistantDuplicatesForUser(
  assistantMessageId: string,
  userId: number
) {
  const assistant = await getMessageForUser(assistantMessageId, userId);
  if (!assistant || assistant.role !== "assistant") return [];

  const conversationMessages = await listMessagesForConversation(
    assistant.conversationId
  );
  const index = conversationMessages.findIndex(m => m.id === assistant.id);
  if (index < 0) return [];

  const duplicateIds: string[] = [];
  for (let cursor = index + 1; cursor < conversationMessages.length; cursor++) {
    const message = conversationMessages[cursor];
    if (message.role === "user") break;
    if (message.role === "assistant") duplicateIds.push(message.id);
  }

  // Delete all duplicate messages
  for (const id of duplicateIds) {
    const { error } = await supabase.from("messages").delete().eq("id", id);

    if (error) {
      console.error(`Failed to delete duplicate message ${id}:`, error);
    }
  }

  return duplicateIds;
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
  const { error: versionError } = await supabase
    .from("message_versions")
    .insert({
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

export async function listMessageVersionsForUser(
  messageId: string,
  userId: number
): Promise<MessageVersion[]> {
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
    messageId: v.message_id,
    content: v.content,
    createdAt: new Date(v.created_at),
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

export async function searchConversationMessages(
  userId: number,
  query: string
) {
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

export async function getUserPreferences(
  userId: number
): Promise<UserPreference | undefined> {
  const { data, error } = await supabase
    .from("user_preferences")
    .select("*")
    .eq("user_id", userId)
    .single();

  if (error) {
    if (error.code === "PGRST116") return undefined;
    handleSupabaseError(error, "getUserPreferences");
  }

  return dbToUserPreference(data as DbUserPreference);
}

export async function upsertUserPreferences(
  userId: number,
  values: Partial<Omit<UserPreference, "userId" | "createdAt" | "updatedAt">>
): Promise<UserPreference | undefined> {
  const dbValues: any = {
    user_id: userId,
    selected_model: values.selectedModel || null,
    persona: values.persona || "balanced",
    custom_instructions: values.customInstructions || null,
    speech_rate: values.speechRate || 100,
    auto_play_responses: values.autoPlayResponses || false,
    reduce_motion: values.reduceMotion || false,
  };

  const { error } = await supabase
    .from("user_preferences")
    .upsert(dbValues)
    .select()
    .single();

  if (error) {
    handleSupabaseError(error, "upsertUserPreferences");
  }

  return getUserPreferences(userId);
}

// ============================================
// FILE FUNCTIONS
// ============================================

export async function listMessageFilesForUser(
  messageId: string,
  userId: number
) {
  const message = await getMessageForUser(messageId, userId);
  if (!message) return [];

  // content_text exists only after 06-library-lite.sql has been applied.
  let data: any[] | null = null;
  let error: any = null;
  ({ data, error } = await supabase
    .from("attachments")
    .select(
      `
      file_id,
      files!inner(id, user_id, filename, mime_type, url, storage_key, content_text)
    `
    )
    .eq("message_id", messageId)
    .eq("files.user_id", userId));

  if (error) {
    ({ data, error } = await supabase
      .from("attachments")
      .select(
        `
        file_id,
        files!inner(id, user_id, filename, mime_type, url, storage_key)
      `
      )
      .eq("message_id", messageId)
      .eq("files.user_id", userId));
  }

  if (error) {
    handleSupabaseError(error, "listMessageFilesForUser");
  }

  return (data || []).map((row: any) => ({
    id: row.files.id,
    filename: row.files.filename,
    mimeType: row.files.mime_type,
    url: row.files.url,
    storageKey: row.files.storage_key,
    contentText: (row.files.content_text as string | null) ?? null,
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
    conversation_id: message.conversationId,
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
    userId: p.user_id,
    name: p.name,
    description: p.description,
    instructions: p.instructions,
    isArchived: p.is_archived,
    createdAt: new Date(p.created_at),
    updatedAt: new Date(p.updated_at),
  }));
}

export async function createProjectForUser(input: {
  id: string;
  userId: number;
  name: string;
  description?: string;
  instructions?: string;
}): Promise<Project> {
  const { data, error } = await supabase
    .from("projects")
    .insert({
      id: input.id,
      user_id: input.userId,
      name: input.name,
      description: input.description || null,
      instructions: input.instructions || null,
      is_archived: false,
    })
    .select()
    .single();

  if (error) {
    handleSupabaseError(error, "createProjectForUser");
  }

  return {
    id: data.id,
    userId: data.user_id,
    name: data.name,
    description: data.description,
    instructions: data.instructions,
    isArchived: data.is_archived,
    createdAt: new Date(data.created_at),
    updatedAt: new Date(data.updated_at),
  };
}

// ============================================
// TASK FUNCTIONS
// ============================================

export async function getTaskForUser(
  taskId: string,
  userId: number
): Promise<Task | undefined> {
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
    userId: data.user_id,
    agentId: data.agent_id,
    projectId: data.project_id,
    conversationId: data.conversation_id,
    title: data.title,
    details: data.details,
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
) {
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
    userId: a.user_id,
    taskId: a.task_id,
    status: a.status,
    summary: a.summary,
    detail: a.detail,
    startedAt: a.started_at ? new Date(a.started_at) : null,
    completedAt: a.completed_at ? new Date(a.completed_at) : null,
    createdAt: new Date(a.created_at),
    updatedAt: new Date(a.updated_at),
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

  const { data, error } = await supabase
    .from("task_activities")
    .insert({
      id: input.id,
      user_id: input.userId,
      task_id: input.taskId,
      status,
      summary: input.summary,
      detail: input.detail || null,
      started_at: status === "running" ? now.toISOString() : null,
      completed_at: ["completed", "failed", "cancelled"].includes(status)
        ? now.toISOString()
        : null,
    })
    .select()
    .single();

  if (error) {
    handleSupabaseError(error, "createTaskActivityForUser");
  }

  return {
    id: data.id,
    userId: data.user_id,
    taskId: data.task_id,
    status: data.status,
    summary: data.summary,
    detail: data.detail,
    startedAt: data.started_at ? new Date(data.started_at) : null,
    completedAt: data.completed_at ? new Date(data.completed_at) : null,
    createdAt: new Date(data.created_at),
    updatedAt: new Date(data.updated_at),
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
  return {
    users: new Map(),
    conversations: new Map(),
    messages: new Map(),
    userPreferences: new Map(),
    messageVersions: new Map(),
    messageFeedback: new Map(),
    projects: new Map(),
    files: new Map(),
    attachments: new Map(),
    tasks: new Map(),
    taskActivities: new Map(),
    nextUserId: 1,
  };
}
