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

// User operations
export async function upsertUser(user: InsertUser): Promise<void> {
  await inMemoryStore.upsertUser(user);
  if (isSupabaseConfigured && user.openId) {
    try {
      const memUser = await inMemoryStore.getUserByOpenId(user.openId);
      if (memUser) {
        await supabase.from("users").upsert({
          id: memUser.id,
          open_id: memUser.openId,
          name: memUser.name,
          email: memUser.email,
          role: memUser.role,
        });
      }
    } catch (e) {
      // Non-critical background sync
    }
  }
}

export async function getUserByOpenId(openId: string): Promise<User | undefined> {
  return inMemoryStore.getUserByOpenId(openId);
}

export async function getUserByEmail(email: string): Promise<User | undefined> {
  return inMemoryStore.getUserByEmail(email);
}

export async function updateUserProfile(
  userId: number,
  nameOrValues: string | { name?: string | null }
): Promise<User | undefined> {
  const name = typeof nameOrValues === "string" ? nameOrValues : nameOrValues?.name ?? "";
  return inMemoryStore.updateUserProfile(userId, name);
}

export async function deleteUserAccount(userId: number): Promise<boolean> {
  return inMemoryStore.deleteUserAccount(userId);
}

// Conversation operations
export async function listConversationsForUser(
  userId: number,
  scope: "active" | "archived" | "trash" | "shared" = "active"
): Promise<Conversation[]> {
  return inMemoryStore.listConversationsForUser(userId, scope);
}

export async function getConversationForUser(
  id: string,
  userId: number
): Promise<Conversation | undefined> {
  return inMemoryStore.getConversationForUser(id, userId);
}

export async function createConversationForUser(input: {
  id: string;
  userId: number;
  title?: string;
  conversationType?: "text" | "voice" | "mixed";
}): Promise<Conversation> {
  return inMemoryStore.createConversationForUser(input);
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
  return inMemoryStore.updateConversationForUser(id, userId, values);
}

export async function getPublicConversationByToken(
  shareToken: string
): Promise<any> {
  return inMemoryStore.getPublicConversationByToken(shareToken);
}

export async function deleteConversationForUser(
  id: string,
  userId: number
): Promise<void> {
  return inMemoryStore.deleteConversationForUser(id, userId);
}

export async function deleteAllConversationsForUser(
  userId: number
): Promise<number> {
  return inMemoryStore.deleteAllConversationsForUser(userId);
}

export async function moveConversationToTrash(
  id: string,
  userId: number
): Promise<Conversation | undefined> {
  return inMemoryStore.moveConversationToTrash(id, userId);
}

export async function restoreConversationForUser(
  id: string,
  userId: number
): Promise<Conversation | undefined> {
  return inMemoryStore.restoreConversationForUser(id, userId);
}

// Message operations
export async function listMessagesForConversation(
  conversationId: string
): Promise<Message[]> {
  return inMemoryStore.listMessagesForConversation(conversationId);
}

export async function createMessage(input: Message): Promise<Message> {
  return inMemoryStore.createMessage(input);
}

export async function updateMessage(
  id: string,
  values: Partial<Pick<Message, "content" | "model" | "status">>
): Promise<void> {
  return inMemoryStore.updateMessage(id, values);
}

export async function getMessageForUser(
  messageId: string,
  userId: number
): Promise<Message | undefined> {
  return inMemoryStore.getMessageForUser(messageId, userId);
}

export async function deleteMessageForUser(
  messageId: string,
  userId: number
): Promise<boolean> {
  return inMemoryStore.deleteMessageForUser(messageId, userId);
}

export async function removeFollowingAssistantDuplicatesForUser(
  messageId: string,
  userId: number
): Promise<string[]> {
  return inMemoryStore.removeFollowingAssistantDuplicatesForUser(messageId, userId);
}

export async function editMessageForUser(input: {
  id: string;
  userId: number;
  content: string;
  versionId: string;
}): Promise<Message | undefined> {
  return inMemoryStore.editMessageForUser(input);
}

export async function listMessageVersionsForUser(
  messageId: string,
  userId: number
): Promise<MessageVersion[]> {
  return inMemoryStore.listMessageVersionsForUser(messageId, userId);
}

export async function setMessageFeedbackForUser(input: {
  id: string;
  messageId: string;
  userId: number;
  value: "up" | "down";
}): Promise<void> {
  return inMemoryStore.setMessageFeedbackForUser(input);
}

export async function searchConversationMessages(
  userId: number,
  query: string
): Promise<any[]> {
  return inMemoryStore.searchConversationMessages(userId, query);
}

export async function searchConversationTitles(
  userId: number,
  query: string
): Promise<any[]> {
  return inMemoryStore.searchConversationTitles(userId, query);
}

// User preferences
export async function getUserPreferences(
  userId: number
): Promise<UserPreference | undefined> {
  return inMemoryStore.getUserPreferences(userId);
}

export async function upsertUserPreferences(
  userIdOrInput: number | InsertUserPreference,
  maybeInput?: any
): Promise<void> {
  if (typeof userIdOrInput === "number") {
    await inMemoryStore.upsertUserPreferences(userIdOrInput, maybeInput || {});
    return;
  }
  const { userId, ...rest } = userIdOrInput;
  await inMemoryStore.upsertUserPreferences(userId, rest);
}

// Memory operations
export async function getMemorySettings(
  userId: number
): Promise<MemorySettings | undefined> {
  return inMemoryStore.getMemorySettings(userId);
}

export async function upsertMemorySettings(
  userId: number,
  settings: {
    memoryEnabled?: boolean;
    generateFromChats?: boolean;
    sensitiveMemoryEnabled?: boolean;
  }
): Promise<any> {
  return inMemoryStore.upsertMemorySettings(userId, settings);
}

export async function listUserMemories(userId: number): Promise<Memory[]> {
  return inMemoryStore.listUserMemories(userId);
}

export async function saveUserMemoryFacts(
  userId: number,
  conversationIdOrFacts: string | null | Array<MemoryFactToSave>,
  factsArg?: Array<MemoryFactToSave>
): Promise<number> {
  const conversationId =
    typeof conversationIdOrFacts === "string" ? conversationIdOrFacts : undefined;
  const facts = Array.isArray(conversationIdOrFacts)
    ? conversationIdOrFacts
    : factsArg || [];
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

// Voice sessions
export async function createVoiceSession(input: {
  id: string;
  userId: number;
  conversationId: string;
}): Promise<VoiceSession> {
  return inMemoryStore.createVoiceSession(input);
}

export async function updateVoiceSessionForUser(
  id: string,
  userId: number,
  status: VoiceSession["status"]
): Promise<void> {
  return inMemoryStore.updateVoiceSessionForUser(id, userId, status);
}

// Projects & Files
export async function listProjectsForUser(userId: number): Promise<Project[]> {
  return inMemoryStore.listProjectsForUser(userId);
}

export async function createProjectForUser(input: {
  id: string;
  userId: number;
  name: string;
  description?: string;
  instructions?: string;
}): Promise<Project> {
  return inMemoryStore.createProjectForUser(input);
}

export async function createFileForUser(file: KsemoFile): Promise<KsemoFile> {
  await inMemoryStore.createFileForUser(file);
  if (isSupabaseConfigured) {
    try {
      if (file.userId > 0) {
        const { error } = await supabase.from("files").upsert({
          id: file.id,
          user_id: file.userId,
          project_id: file.projectId,
          storage_key: file.storageKey,
          url: file.url,
          filename: file.filename,
          mime_type: file.mimeType,
          size_bytes: file.sizeBytes,
          status: file.status,
          content_text: file.contentText,
          created_at: file.createdAt.toISOString(),
          updated_at: file.updatedAt.toISOString(),
        });
        if (error) {
          console.warn("[supabase-db] Supabase file sync warning:", error.message);
        }
      }
    } catch (err) {
      console.warn("[supabase-db] Supabase file sync caught error:", err);
    }
  }
  return file;
}

export async function getFileForUser(
  id: string,
  userId?: number
): Promise<KsemoFile | undefined> {
  const local = await inMemoryStore.getFileForUser(id, userId);
  if (local) return local;
  if (isSupabaseConfigured && userId !== undefined && userId > 0) {
    try {
      const { data } = await supabase
        .from("files")
        .select("*")
        .eq("id", id)
        .eq("user_id", userId)
        .single();
      if (data) {
        const file: KsemoFile = {
          id: data.id,
          userId: data.user_id,
          projectId: data.project_id ?? null,
          storageKey: data.storage_key,
          url: data.url,
          filename: data.filename,
          mimeType: data.mime_type,
          sizeBytes: Number(data.size_bytes),
          status: data.status === "failed" ? "failed" : "ready",
          contentText: data.content_text ?? null,
          createdAt: new Date(data.created_at),
          updatedAt: new Date(data.updated_at),
        };
        await inMemoryStore.createFileForUser(file);
        return file;
      }
    } catch {}
  }
  return undefined;
}

export async function listFilesForUser(userId: number): Promise<KsemoFile[]> {
  const localFiles = await inMemoryStore.listFilesForUser(userId);
  if (!isSupabaseConfigured || userId <= 0) {
    return localFiles;
  }
  try {
    const { data } = await supabase
      .from("files")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });
    if (data && Array.isArray(data)) {
      const localIds = new Set(localFiles.map(f => f.id));
      for (const row of data) {
        if (!localIds.has(row.id)) {
          const file: KsemoFile = {
            id: row.id,
            userId: row.user_id,
            projectId: row.project_id ?? null,
            storageKey: row.storage_key,
            url: row.url,
            filename: row.filename,
            mimeType: row.mime_type,
            sizeBytes: Number(row.size_bytes),
            status: row.status === "failed" ? "failed" : "ready",
            contentText: row.content_text ?? null,
            createdAt: new Date(row.created_at),
            updatedAt: new Date(row.updated_at),
          };
          localFiles.push(file);
          void inMemoryStore.createFileForUser(file);
        }
      }
    }
  } catch (err) {
    console.warn("[supabase-db] Supabase file listing fallback to memory:", err);
  }
  return localFiles.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
}

export async function updateFileForUser(
  id: string,
  userId: number,
  values: Partial<KsemoFile>
): Promise<void> {
  await inMemoryStore.updateFile(id, values);
  if (isSupabaseConfigured && userId > 0) {
    try {
      const updateData: Record<string, any> = {};
      if (values.filename !== undefined) updateData.filename = values.filename;
      if (values.contentText !== undefined) updateData.content_text = values.contentText;
      if (values.status !== undefined) updateData.status = values.status;
      if (Object.keys(updateData).length > 0) {
        await supabase.from("files").update(updateData).eq("id", id).eq("user_id", userId);
      }
    } catch {}
  }
}

export async function deleteFileForUser(id: string, userId: number): Promise<boolean> {
  const deleted = await inMemoryStore.deleteFile(id, userId);
  if (isSupabaseConfigured && userId > 0) {
    try {
      await supabase.from("files").delete().eq("id", id).eq("user_id", userId);
    } catch {}
  }
  return deleted;
}

export async function listMessageFilesForUser(
  messageId: string,
  userId: number
): Promise<any[]> {
  const localResults = await inMemoryStore.listMessageFilesForUser(messageId, userId);
  if (localResults.length > 0) return localResults;

  if (isSupabaseConfigured) {
    try {
      const { data, error } = await supabase
        .from("files")
        .select(
          "id, filename, mime_type, size_bytes, url, storage_key, content_text, user_id"
        )
        .in(
          "id",
          (
            await supabase
              .from("attachments")
              .select("file_id")
              .eq("message_id", messageId)
          ).data?.map((a: any) => a.file_id) ?? []
        );

      if (!error && data?.length) {
        return data.map((row: any) => ({
          id: row.id,
          filename: row.filename,
          mimeType: row.mime_type,
          sizeBytes: row.size_bytes,
          url: row.url,
          storageKey: row.storage_key,
          contentText: row.content_text ?? null,
        }));
      }
    } catch {}
  }
  return localResults;
}

export async function listConversationFilesForUser(
  conversationId: string,
  userId: number
): Promise<any[]> {
  return inMemoryStore.listConversationFiles(conversationId, userId);
}

export async function attachFileToMessageForUser(input: {
  id: string;
  fileId: string;
  messageId: string;
  conversationId?: string | null;
  userId: number;
}): Promise<any> {
  const att = await inMemoryStore.attachFileToMessageForUser(input);
  if (isSupabaseConfigured && input.userId > 0) {
    try {
      await supabase.from("attachments").insert({
        id: input.id,
        file_id: input.fileId,
        conversation_id: input.conversationId ?? null,
        message_id: input.messageId,
      });
    } catch (error: any) {
      // Non-critical background sync warning - memory store already guarantees turn success
      console.warn("[Attach] Supabase sync notice:", error?.message || error);
    }
  }
  return att;
}

export async function attachFileToConversationForUser(input: {
  id: string;
  fileId: string;
  conversationId: string;
  userId: number;
}): Promise<any> {
  const att = await inMemoryStore.attachFileToConversationForUser(input);
  if (isSupabaseConfigured && input.userId > 0) {
    try {
      await supabase.from("attachments").insert({
        id: input.id,
        file_id: input.fileId,
        conversation_id: input.conversationId,
        message_id: null,
      });
    } catch (error: any) {
      console.warn("[Attach] Supabase conversation sync notice:", error?.message || error);
    }
  }
  return att;
}

// Tasks & activities
export async function getTaskForUser(
  taskId: string,
  userId: number
): Promise<Task | undefined> {
  return inMemoryStore.getTaskForUser(taskId, userId);
}

export async function listTaskActivitiesForUser(
  taskId: string,
  userId: number
): Promise<any[]> {
  return inMemoryStore.listTaskActivitiesForUser(taskId, userId);
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
  return inMemoryStore.createTaskActivityForUser(input);
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
  return inMemoryStore.updateTaskActivityForUser(id, userId, values);
}
