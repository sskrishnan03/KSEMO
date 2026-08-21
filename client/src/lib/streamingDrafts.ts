export type StreamDraftMessage = {
  id: string;
  role: "user" | "assistant" | "system" | "tool";
  content: string;
  status?: string;
  attachments?: Array<{
    id: string;
    filename: string;
    mimeType?: string;
    url: string;
  }>;
};

export function buildStreamingDrafts(
  knownMessages: StreamDraftMessage[],
  content: string,
  options: {
    isRegeneration?: boolean;
    replaceUserMessageId?: string;
    replaceAssistantMessageId?: string;
    attachments?: StreamDraftMessage["attachments"];
    now?: number;
  } = {}
) {
  const now = options.now ?? Date.now();
  const messages = knownMessages.map(message =>
    message.id === options.replaceUserMessageId
      ? { ...message, content }
      : message
  );
  const assistant: StreamDraftMessage = {
    id: `local-assistant-${now}`,
    role: "assistant",
    content: "",
    status: "streaming",
  };
  if (options.isRegeneration && options.replaceAssistantMessageId)
    return messages.map(message =>
      message.id === options.replaceAssistantMessageId
        ? { ...message, content: "", status: "streaming" }
        : message
    );
  if (options.isRegeneration) return [...messages, assistant];
  return [
    ...messages,
    {
      id: `local-user-${now}`,
      role: "user",
      content,
      status: "completed",
      attachments: options.attachments,
    },
    assistant,
  ];
}
