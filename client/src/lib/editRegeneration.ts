import { getFollowingAssistantMessageId } from "./messageEditPlan";

type EditableMessage = { id: string; role: string; content: string };

export async function saveEditedUserMessageAndRegenerate({
  message,
  editedContent,
  messages,
  save,
  regenerate,
}: {
  message: EditableMessage;
  editedContent: string;
  messages: EditableMessage[];
  save: (messageId: string, content: string) => Promise<unknown>;
  regenerate: (content: string, assistantMessageId: string) => Promise<unknown>;
}) {
  await save(message.id, editedContent);
  if (message.role !== "user") return { regenerated: false } as const;
  const assistantMessageId = getFollowingAssistantMessageId(
    messages,
    message.id
  );
  if (!assistantMessageId) return { regenerated: false } as const;
  await regenerate(editedContent, assistantMessageId);
  return { regenerated: true, assistantMessageId } as const;
}
