export type ConversationType = "text" | "voice" | "mixed";

export function typeAfterVoiceSession(
  current: ConversationType
): ConversationType {
  return current === "text" ? "mixed" : current;
}