import { getFollowingAssistantMessageId } from "./messageEditPlan";

type MessageTurn = {
  id: string;
  role: "user" | "assistant" | "system" | "tool";
};

export async function restoreUserMessageVersionAndRegenerate({
  messageId,
  versionId,
  restoredContent,
  messages,
  restore,
  regenerate,
}: {
  messageId: string;
  versionId: string;
  restoredContent: string;
  messages: MessageTurn[];
  restore: (messageId: string, versionId: string) => Promise<void>;
  regenerate: (content: string, assistantMessageId: string) => Promise<void>;
}) {
  await restore(messageId, versionId);
  const followingAssistantMessageId = getFollowingAssistantMessageId(
    messages,
    messageId
  );
  if (!followingAssistantMessageId) return { regenerated: false } as const;
  await regenerate(restoredContent, followingAssistantMessageId);
  return {
    regenerated: true,
    assistantMessageId: followingAssistantMessageId,
  } as const;
}
