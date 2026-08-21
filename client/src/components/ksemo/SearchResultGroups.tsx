import React from "react";

export type SearchChatResult = {
  conversationId: string;
  conversationTitle: string;
  createdAt: Date;
};
export type SearchMessageResult = {
  conversationId: string;
  conversationTitle: string;
  messageId: string;
  content: string;
  createdAt: Date;
};
export type SearchMemoryResult = {
  id: string;
  content: string;
  category: string;
};

export function SearchResultGroups({
  chats,
  messages,
  memories,
  onSelect,
  onOpenMemories,
}: {
  chats: SearchChatResult[];
  messages: SearchMessageResult[];
  memories: SearchMemoryResult[];
  onSelect: (id: string) => void;
  onOpenMemories: () => void;
}) {
  return (
    <>
      {chats.length > 0 && (
        <SearchGroup label="Chats" count={chats.length}>
          {chats.map(chat => (
            <button
              key={chat.conversationId}
              onClick={() => onSelect(chat.conversationId)}
              className="w-full rounded-xl px-3 py-2.5 text-left transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <p className="truncate text-sm font-medium">
                {chat.conversationTitle}
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Conversation title match
              </p>
            </button>
          ))}
        </SearchGroup>
      )}
      {messages.length > 0 && (
        <SearchGroup label="Messages" count={messages.length}>
          {messages.map(message => (
            <button
              key={message.messageId}
              onClick={() => onSelect(message.conversationId)}
              className="w-full rounded-xl px-3 py-2.5 text-left transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <p className="truncate text-sm font-medium">
                {message.conversationTitle}
              </p>
              <p className="mt-0.5 line-clamp-2 text-xs leading-5 text-muted-foreground">
                {message.content}
              </p>
            </button>
          ))}
        </SearchGroup>
      )}
      {memories.length > 0 && (
        <SearchGroup label="Memories" count={memories.length}>
          {memories.map(memory => (
            <button
              key={memory.id}
              onClick={onOpenMemories}
              className="w-full rounded-xl px-3 py-2.5 text-left transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <p className="line-clamp-2 text-sm font-medium">
                {memory.content}
              </p>
              <p className="mt-0.5 text-xs capitalize text-muted-foreground">
                {memory.category} memory
              </p>
            </button>
          ))}
        </SearchGroup>
      )}
    </>
  );
}

function SearchGroup({
  label,
  count,
  children,
}: {
  label: string;
  count: number;
  children: React.ReactNode;
}) {
  return (
    <div className="mt-2 border-t border-border pt-2">
      <p className="px-3 pb-1 text-[10px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
        {label}{" "}
        <span aria-label={`${count} ${label.toLowerCase()} results`}>
          ({count})
        </span>
      </p>
      {children}
    </div>
  );
}
