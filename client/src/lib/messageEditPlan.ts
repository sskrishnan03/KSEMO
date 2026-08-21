export function getFollowingAssistantMessageId(
  messages: Array<{ id: string; role: string }>,
  userMessageId: string
) {
  const userIndex = messages.findIndex(message => message.id === userMessageId);
  if (userIndex < 0) return undefined;
  return messages
    .slice(userIndex + 1)
    .find(message => message.role === "assistant")?.id;
}
