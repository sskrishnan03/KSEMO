export type ConversationType = "text" | "voice" | "mixed";

export function typeAfterVoiceSession(
  current: ConversationType
): ConversationType {
  return current === "text" ? "mixed" : current;
}

// Temporary ("incognito") chats are persisted like normal conversations so the
// streaming/file pipeline keeps working, but they are tagged with this title
// prefix. Every conversation listing skips tagged rows, so a temporary chat
// never shows up in recent chats, history, archived, or trash. They are also
// hard-deleted when the temporary session ends.
export const EPHEMERAL_TITLE_PREFIX = "ksemo-ephemeral::";

export function isEphemeralConversationTitle(
  title: string | null | undefined
): boolean {
  return typeof title === "string" && title.startsWith(EPHEMERAL_TITLE_PREFIX);
}
