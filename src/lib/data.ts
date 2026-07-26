import { supabase } from './supabase';
import type { Chat, Message, Notification, Profile, Upload, UserSettings, AppPreferences, Favorite } from './types';

// Flag to stick to local storage if DB is not set up
let dbFailed = false;

function getLocal<T>(key: string, def: T): T {
  try {
    const val = localStorage.getItem(`ksemo_${key}`);
    return val ? JSON.parse(val) : def;
  } catch {
    return def;
  }
}

function setLocal<T>(key: string, val: T): void {
  try {
    localStorage.setItem(`ksemo_${key}`, JSON.stringify(val));
  } catch (err) {
    console.error('localStorage write failed', err);
  }
}

// ---------- Profiles ----------
export async function getProfile(userId: string): Promise<Profile | null> {
  if (!dbFailed) {
    try {
      const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle();
      if (!error) return data as Profile | null;
      console.warn('Supabase getProfile failed, using fallback:', error.message);
      dbFailed = true;
    } catch {
      dbFailed = true;
    }
  }
  return getLocal<Profile | null>(`profile_${userId}`, null);
}

export async function updateProfile(userId: string, patch: Partial<Profile>): Promise<Profile | null> {
  if (!dbFailed) {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .update({ ...patch, updated_at: new Date().toISOString() })
        .eq('id', userId)
        .select()
        .maybeSingle();
      if (!error) return data as Profile | null;
    } catch {}
  }
  const current = getLocal<Profile | null>(`profile_${userId}`, null) || {
    id: userId,
    username: 'user',
    full_name: 'Guest User',
    avatar_url: '',
    bio: '',
    role: 'user',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };
  const updated = { ...current, ...patch, updated_at: new Date().toISOString() };
  setLocal(`profile_${userId}`, updated);
  return updated;
}

// ---------- Chats ----------
export async function listChats(filter?: { archived?: boolean }): Promise<Chat[]> {
  if (!dbFailed) {
    try {
      let q = supabase.from('chats').select('*').order('pinned', { ascending: false }).order('updated_at', { ascending: false });
      if (filter?.archived !== undefined) q = q.eq('archived', filter.archived);
      const { data, error } = await q;
      if (!error) return (data ?? []) as Chat[];
      console.error("Supabase listChats error:", error);
      dbFailed = true;
    } catch (e) {
      console.error("Supabase listChats exception:", e);
      dbFailed = true;
    }
  }
  let chats = getLocal<Chat[]>('chats', []);
  if (filter?.archived !== undefined) chats = chats.filter(c => c.archived === filter.archived);
  return chats.sort((a, b) => {
    if (a.pinned && !b.pinned) return -1;
    if (!a.pinned && b.pinned) return 1;
    return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
  });
}

export async function createChat(patch?: Partial<Chat>): Promise<Chat | null> {
  if (!dbFailed) {
    try {
      const dbPatch = { ...patch };
      delete dbPatch.type;
      const { data, error } = await supabase.from('chats').insert(dbPatch).select().maybeSingle();
      if (!error) return data as Chat | null;
      console.error("Supabase createChat error:", error);
      dbFailed = true;
    } catch (e) {
      console.error("Supabase createChat exception:", e);
      dbFailed = true;
    }
  }
  const chats = getLocal<Chat[]>('chats', []);
  const newChat: Chat = {
    id: crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2),
    user_id: 'local',
    title: 'New chat',
    model: 'ksemo-pro',
    temperature: 0.7,
    max_tokens: 2048,
    pinned: false,
    archived: false,
    category: null,
    type: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...patch
  };
  chats.push(newChat);
  setLocal('chats', chats);
  return newChat;
}

export async function updateChat(id: string, patch: Partial<Chat>): Promise<void> {
  if (!dbFailed) {
    try {
      const dbPatch = { ...patch };
      delete dbPatch.type;
      const { error } = await supabase.from('chats').update(dbPatch).eq('id', id);
      if (!error) return;
      console.error("Supabase updateChat error:", error);
      dbFailed = true;
    } catch (e) {
      console.error("Supabase updateChat exception:", e);
      dbFailed = true;
    }
  }
  const chats = getLocal<Chat[]>('chats', []);
  const idx = chats.findIndex(c => c.id === id);
  if (idx !== -1) {
    chats[idx] = { ...chats[idx], ...patch, updated_at: new Date().toISOString() };
    setLocal('chats', chats);
  }
}

export async function deleteChat(id: string): Promise<void> {
  if (!dbFailed) {
    try {
      const { error } = await supabase.from('chats').delete().eq('id', id);
      if (!error) return;
      console.error("Supabase deleteChat error:", error);
      dbFailed = true;
    } catch (e) {
      console.error("Supabase deleteChat exception:", e);
      dbFailed = true;
    }
  }
  const chats = getLocal<Chat[]>('chats', []);
  setLocal('chats', chats.filter(c => c.id !== id));
}

export async function togglePin(id: string, pinned: boolean): Promise<void> {
  await updateChat(id, { pinned });
}

// ---------- Messages ----------
export async function listMessages(chatId: string): Promise<Message[]> {
  if (!dbFailed) {
    try {
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .eq('chat_id', chatId)
        .order('created_at', { ascending: true });
      if (!error) return (data ?? []) as Message[];
      console.error("Supabase listMessages error:", error);
      dbFailed = true;
    } catch (e) {
      console.error("Supabase listMessages exception:", e);
      dbFailed = true;
    }
  }
  const msgs = getLocal<Message[]>('messages', []);
  return msgs.filter(m => m.chat_id === chatId).sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
}

export async function insertMessage(msg: { chat_id: string; role: Message['role']; content: string; model?: string | null; tokens?: number | null; meta?: Record<string, unknown> | null }): Promise<Message | null> {
  if (!dbFailed) {
    try {
      const { data, error } = await supabase
        .from('messages')
        .insert(msg)
        .select()
        .maybeSingle();
      if (!error) return data as Message | null;
      console.error("Supabase insertMessage error:", error);
      dbFailed = true;
    } catch (e) {
      console.error("Supabase insertMessage exception:", e);
      dbFailed = true;
    }
  }
  const msgs = getLocal<Message[]>('messages', []);
  const newMsg: Message = {
    id: crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2),
    created_at: new Date().toISOString(),
    ...msg
  } as Message;
  msgs.push(newMsg);
  setLocal('messages', msgs);
  
  await updateChat(msg.chat_id, { updated_at: new Date().toISOString() });
  
  return newMsg;
}

export async function updateMessage(id: string, patch: Partial<Message>): Promise<void> {
  if (!dbFailed) {
    try {
      const { error } = await supabase.from('messages').update(patch).eq('id', id);
      if (!error) return;
      dbFailed = true;
    } catch {
      dbFailed = true;
    }
  }
  const msgs = getLocal<Message[]>('messages', []);
  const idx = msgs.findIndex(m => m.id === id);
  if (idx !== -1) {
    msgs[idx] = { ...msgs[idx], ...patch };
    setLocal('messages', msgs);
  }
}

export async function deleteMessage(id: string): Promise<void> {
  if (!dbFailed) {
    try {
      const { error } = await supabase.from('messages').delete().eq('id', id);
      if (!error) return;
      dbFailed = true;
    } catch {
      dbFailed = true;
    }
  }
  const msgs = getLocal<Message[]>('messages', []);
  setLocal('messages', msgs.filter(m => m.id !== id));
}

// ---------- Favorites ----------
export async function listFavorites(): Promise<(Favorite & { message?: Message; chat?: { id: string; title: string } })[]> {
  if (!dbFailed) {
    try {
      const { data, error } = await supabase
        .from('favorites')
        .select('*, message:messages(*), chat:chats(id, title)')
        .order('created_at', { ascending: false });
      if (!error) return (data ?? []) as any[];
      dbFailed = true;
    } catch {
      dbFailed = true;
    }
  }
  const favs = getLocal<Favorite[]>('favorites', []);
  const msgs = getLocal<Message[]>('messages', []);
  const chats = getLocal<Chat[]>('chats', []);
  return favs.map(f => {
    const msg = msgs.find(m => m.id === f.message_id);
    const chat = msg ? chats.find(c => c.id === msg.chat_id) : undefined;
    return {
      ...f,
      message: msg,
      chat: chat ? { id: chat.id, title: chat.title } : undefined
    };
  }).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
}

export async function addFavorite(messageId: string, note?: string): Promise<void> {
  if (!dbFailed) {
    try {
      const { error } = await supabase.from('favorites').upsert({ message_id: messageId, note });
      if (!error || error.code === '23505') return;
    } catch {}
  }
  const favs = getLocal<Favorite[]>('favorites', []);
  if (!favs.some(f => f.message_id === messageId)) {
    favs.push({
      id: crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2),
      message_id: messageId,
      note,
      created_at: new Date().toISOString()
    } as Favorite);
    setLocal('favorites', favs);
  }
}

export async function removeFavorite(messageId: string): Promise<void> {
  if (!dbFailed) {
    try {
      const { error } = await supabase.from('favorites').delete().eq('message_id', messageId);
      if (!error) return;
    } catch {}
  }
  const favs = getLocal<Favorite[]>('favorites', []);
  setLocal('favorites', favs.filter(f => f.message_id !== messageId));
}

export async function isFavorite(messageId: string): Promise<boolean> {
  if (!dbFailed) {
    try {
      const { count, error } = await supabase
        .from('favorites')
        .select('id', { count: 'exact', head: true })
        .eq('message_id', messageId);
      if (!error) return (count ?? 0) > 0;
      dbFailed = true;
    } catch {
      dbFailed = true;
    }
  }
  const favs = getLocal<Favorite[]>('favorites', []);
  return favs.some(f => f.message_id === messageId);
}

// ---------- Notifications ----------
export async function listNotifications(): Promise<Notification[]> {
  if (!dbFailed) {
    try {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);
      if (!error) return (data ?? []) as Notification[];
      dbFailed = true;
    } catch {
      dbFailed = true;
    }
  }
  return getLocal<Notification[]>('notifications', []);
}

export async function markNotificationRead(id: string): Promise<void> {
  if (!dbFailed) {
    try {
      const { error } = await supabase.from('notifications').update({ read: true }).eq('id', id);
      if (!error) return;
    } catch {}
  }
  const notifs = getLocal<Notification[]>('notifications', []);
  const idx = notifs.findIndex(n => n.id === id);
  if (idx !== -1) {
    notifs[idx].read = true;
    setLocal('notifications', notifs);
  }
}

export async function markAllNotificationsRead(): Promise<void> {
  if (!dbFailed) {
    try {
      const { error } = await supabase.from('notifications').update({ read: true }).neq('read', true);
      if (!error) return;
    } catch {}
  }
  const notifs = getLocal<Notification[]>('notifications', []);
  notifs.forEach(n => n.read = true);
  setLocal('notifications', notifs);
}

// ---------- Settings ----------
export async function getSettings(userId: string): Promise<UserSettings | null> {
  if (!dbFailed) {
    try {
      const { data, error } = await supabase
        .from('user_settings')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();
      if (!error) return data as UserSettings | null;
      dbFailed = true;
    } catch {
      dbFailed = true;
    }
  }
  return getLocal<UserSettings | null>(`settings_${userId}`, null);
}

export async function upsertSettings(userId: string, prefs: AppPreferences): Promise<void> {
  if (!dbFailed) {
    try {
      const { error } = await supabase
        .from('user_settings')
        .upsert({ user_id: userId, preferences: prefs as Record<string, unknown>, updated_at: new Date().toISOString() });
      if (!error) return;
    } catch {}
  }
  setLocal(`settings_${userId}`, {
    user_id: userId,
    preferences: prefs,
    updated_at: new Date().toISOString()
  });
}

// ---------- Uploads ----------
export async function listUploads(): Promise<Upload[]> {
  if (!dbFailed) {
    try {
      const { data, error } = await supabase.from('uploads').select('*').order('created_at', { ascending: false });
      if (!error) return (data ?? []) as Upload[];
      dbFailed = true;
    } catch {
      dbFailed = true;
    }
  }
  return getLocal<Upload[]>('uploads', []);
}

export async function deleteUpload(id: string): Promise<void> {
  if (!dbFailed) {
    try {
      const { error } = await supabase.from('uploads').delete().eq('id', id);
      if (!error) return;
      dbFailed = true;
    } catch {
      dbFailed = true;
    }
  }
  const uploads = getLocal<Upload[]>('uploads', []);
  setLocal('uploads', uploads.filter(u => u.id !== id));
}

export async function createUpload(patch: Partial<Upload>): Promise<Upload> {
  if (!dbFailed) {
    try {
      const { id, user_id, ...dbPayload } = patch;
      const { data, error } = await supabase.from('uploads').insert(dbPayload).select().maybeSingle();
      if (!error && data) return data as Upload;
      dbFailed = true;
    } catch {
      dbFailed = true;
    }
  }

  const uploads = getLocal<Upload[]>('uploads', []);
  const newUpload: Upload = {
    id: crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2),
    user_id: 'local',
    chat_id: patch.chat_id || null,
    name: patch.name || 'Untitled File',
    size: patch.size || 0,
    type: patch.type || 'application/octet-stream',
    storage_path: patch.storage_path || '',
    url: patch.url || null,
    created_at: new Date().toISOString(),
    ...patch
  };
  uploads.unshift(newUpload);
  setLocal('uploads', uploads);
  return newUpload;
}

export async function updateUpload(id: string, patch: Partial<Upload>): Promise<void> {
  if (!dbFailed) {
    try {
      const { error } = await supabase.from('uploads').update(patch).eq('id', id);
      if (!error) return;
      dbFailed = true;
    } catch {
      dbFailed = true;
    }
  }
  const uploads = getLocal<Upload[]>('uploads', []);
  const idx = uploads.findIndex(u => u.id === id);
  if (idx !== -1) {
    uploads[idx] = { ...uploads[idx], ...patch };
    setLocal('uploads', uploads);
  }
}

// ---------- Feedback ----------
export async function submitFeedback(category: string, subject: string, body: string): Promise<void> {
  if (!dbFailed) {
    try {
      const { error } = await supabase.from('feedback').insert({ category, subject, body });
      if (!error) return;
    } catch {}
  }
  console.log('Feedback submitted locally:', { category, subject, body });
}

// ---------- Search ----------
export async function searchChats(query: string): Promise<Chat[]> {
  if (!dbFailed) {
    try {
      const { data, error } = await supabase
        .from('chats')
        .select('*')
        .ilike('title', `%${query}%`)
        .order('updated_at', { ascending: false })
        .limit(30);
      if (!error) return (data ?? []) as Chat[];
      dbFailed = true;
    } catch {
      dbFailed = true;
    }
  }
  const chats = getLocal<Chat[]>('chats', []);
  return chats.filter(c => c.title.toLowerCase().includes(query.toLowerCase())).sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
}

export async function searchMessages(query: string): Promise<(Message & { chat?: { id: string; title: string } })[]> {
  if (!dbFailed) {
    try {
      const { data, error } = await supabase
        .from('messages')
        .select('*, chat:chats(id, title)')
        .ilike('content', `%${query}%`)
        .order('created_at', { ascending: false })
        .limit(40);
      if (!error) return (data ?? []) as any[];
      dbFailed = true;
    } catch {
      dbFailed = true;
    }
  }
  const msgs = getLocal<Message[]>('messages', []);
  const chats = getLocal<Chat[]>('chats', []);
  return msgs
    .filter(m => m.content.toLowerCase().includes(query.toLowerCase()))
    .map(m => {
      const chat = chats.find(c => c.id === m.chat_id);
      return {
        ...m,
        chat: chat ? { id: chat.id, title: chat.title } : undefined
      };
    })
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
}

// ---------- AI usage logging ----------
export async function logUsage(model: string, promptTokens: number, completionTokens: number, latencyMs: number): Promise<void> {
  if (!dbFailed) {
    try {
      const { error } = await supabase
        .from('ai_usage')
        .insert({ model, prompt_tokens: promptTokens, completion_tokens: completionTokens, latency_ms: latencyMs });
      if (!error) return;
    } catch {}
  }
  console.log('Usage logged locally:', { model, promptTokens, completionTokens, latencyMs });
}

// ---------- Simulated Email Notifications ----------
export function dispatchSimulatedEmail(email: string, fullName: string, type: 'signup' | 'signin') {
  const key = 'ksemo_sent_emails';
  const existing = JSON.parse(localStorage.getItem(key) || '[]');
  const newEmail = {
    id: Math.random().toString(36).substring(2, 9),
    email,
    fullName,
    type,
    subject: `Welcome to Ksemo! 🚀 Your creative AI workspace is ready.`,
    body: `Hello ${fullName || 'User'},\n\nThank you for choosing Ksemo, your ultimate workspace for AI chat, smart search, and file intelligence. We are dedicated to providing you with a seamless and highly productive environment to build your ideas.\n\nLet's explore your workspace, start a chat, or upload files to begin.\n\nBest regards,\nThe Ksemo Team`,
    timestamp: new Date().toISOString()
  };
  localStorage.setItem(key, JSON.stringify([newEmail, ...existing]));

  // Log in console with nice colors
  console.log(
    `%c[EMAIL DISPATCHED] To: ${email} | Subject: ${newEmail.subject}`,
    "background: #10b981; color: white; padding: 4px 8px; border-radius: 4px; font-weight: bold;"
  );
  console.log(newEmail.body);

  // Dispatch global window event
  window.dispatchEvent(new CustomEvent('ksemo-email-sent', { detail: newEmail }));
}
