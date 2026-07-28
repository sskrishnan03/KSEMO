export type Role = 'user' | 'moderator' | 'admin';

export interface Profile {
  id: string;
  username: string;
  full_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  role: Role;
  created_at: string;
  updated_at: string;
}

export interface Chat {
  id: string;
  user_id: string;
  title: string;
  model: string;
  temperature: number;
  max_tokens: number;
  pinned: boolean;
  archived: boolean;
  category: string | null;
  type: string | null;
  created_at: string;
  updated_at: string;
}

export type MessageRole = 'user' | 'assistant' | 'system';

export interface Message {
  id: string;
  chat_id: string;
  user_id: string;
  role: MessageRole;
  content: string;
  model: string | null;
  tokens: number | null;
  meta: Record<string, unknown> | null;
  created_at: string;
}

export interface Favorite {
  id: string;
  user_id: string;
  message_id: string;
  note: string | null;
  created_at: string;
  message?: Message;
  chat?: Pick<Chat, 'id' | 'title'>;
}

export interface Upload {
  id: string;
  user_id: string;
  chat_id: string | null;
  name: string;
  size: number;
  type: string;
  storage_path: string;
  url: string | null;
  created_at: string;
}

export interface Notification {
  id: string;
  user_id: string;
  type: string;
  title: string;
  body: string | null;
  read: boolean;
  meta: Record<string, unknown> | null;
  created_at: string;
}

export interface UserSettings {
  user_id: string;
  preferences: AppPreferences;
  updated_at: string;
}

export interface AppPreferences {
  send_on_enter?: boolean;
  show_token_count?: boolean;
  streaming?: boolean;
  language?: string;
  reduce_motion?: boolean;
  compact_mode?: boolean;
  notifications_email?: boolean;
  notifications_security?: boolean;
  notifications_product?: boolean;
  notifications_in_app?: boolean;
  notifications_sound?: boolean;
  theme?: 'dark' | 'light' | 'system';
  font_size?: 'small' | 'medium' | 'large';
  auto_rename_chats?: boolean;
  voice_input_enabled?: boolean;
  file_attachment_enabled?: boolean;
  read_aloud_enabled?: boolean;
  suggestions_enabled?: boolean;
  sidebar_auto_collapse?: boolean;
  shortcut_new_chat?: boolean;
  shortcut_search?: boolean;
  shortcut_settings?: boolean;
  shortcut_toggle_sidebar?: boolean;
  shortcut_stop_generation?: boolean;
  shortcut_voice_chat?: boolean;


  shortcut_files?: boolean;
  shortcut_history?: boolean;
}

export interface AIUsage {
  id: string;
  user_id: string;
  model: string;
  prompt_tokens: number;
  completion_tokens: number;
  latency_ms: number | null;
  created_at: string;
}

export interface Feedback {
  id: string;
  user_id: string;
  category: string;
  subject: string;
  body: string;
  status: string;
  created_at: string;
}

export interface Announcement {
  id: string;
  title: string;
  body: string;
  active: boolean;
  created_at: string;
}
