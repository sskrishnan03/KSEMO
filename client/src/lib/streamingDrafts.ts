export type StreamDraftMessage = {
  id: string;
  clientId?: string;
  role: "user" | "assistant" | "system" | "tool";
  content: string;
  status?: string;
  createdAt?: Date | string | number;
  attachments?: Array<{
    id: string;
    filename: string;
    mimeType?: string;
    url: string;
    sizeBytes?: number;
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
    clientId: `local-assistant-${now}`,
    role: "assistant",
    content: "",
    status: "streaming",
    createdAt: now,
  };
  if (options.isRegeneration && options.replaceAssistantMessageId)
    return messages.map(message =>
      message.id === options.replaceAssistantMessageId
        ? { ...message, content: "", status: "streaming", createdAt: now }
        : message
    );
  if (options.isRegeneration) return [...messages, assistant];
  return [
    ...messages,
    {
      id: `local-user-${now}`,
      clientId: `local-user-${now}`,
      role: "user",
      content,
      status: "completed",
      createdAt: now,
      attachments: options.attachments,
    },
    assistant,
  ];
}
