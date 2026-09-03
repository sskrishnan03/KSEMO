import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loading } from "@/components/ui/loading";
import { cn } from "@/lib/utils";
import { trpc } from "@/lib/trpc";
import {
  MessageCircle,
  Search,
  Pin,
} from "lucide-react";
import { memo, useEffect, useMemo, useState } from "react";
import { formatDistanceToNow, format, isToday, isYesterday, isThisWeek, isThisYear } from "date-fns";

type SearchResult = {
  conversationId: string;
  title: string;
  isPinned: boolean;
  snippet?: string;
  role?: string;
  createdAt?: Date;
};

function snippetFromContent(content: string, maxLen = 80): string {
  const clean = content.replace(/\s+/g, " ").trim();
  if (clean.length <= maxLen) return clean;
  return clean.slice(0, maxLen) + "…";
}

function formatRelativeDate(date: Date): string {
  if (isToday(date)) {
    return 'Today';
  }
  if (isYesterday(date)) {
    return 'Yesterday';
  }
  if (isThisYear(date)) {
    return format(date, 'MMM d');
  }
  return format(date, 'MMM d, yyyy');
}

function groupConversationsByDate(conversations: SearchResult[]): Record<string, SearchResult[]> {
  const groups: Record<string, SearchResult[]> = {
    today: [],
    yesterday: [],
    older: [],
  };

  conversations.forEach(conv => {
    if (!conv.createdAt) {
      groups.older.push(conv);
      return;
    }
    
    if (isToday(conv.createdAt)) {
      groups.today.push(conv);
    } else if (isYesterday(conv.createdAt)) {
      groups.yesterday.push(conv);
    } else {
      groups.older.push(conv);
    }
  });

  return groups;
}

export function SearchWorkspace({
  onBackToChat,
  conversations,
  onSelectConversation,
}: {
  onBackToChat: () => void;
  conversations: Array<{
    id: string;
    title: string;
    isPinned: boolean;
  }>;
  onSelectConversation: (conversationId: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const trimmed = query.trim().toLowerCase();

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedQuery(query), 250);
    return () => window.clearTimeout(timer);
  }, [query]);

  const { data: serverData, isFetching: searchLoading } =
    trpc.conversation.search.useQuery(
      { query: debouncedQuery.trim() },
      { enabled: debouncedQuery.trim().length >= 1 }
    );

  const { data: allConversations, isLoading: isLoadingAll } = trpc.conversation.getAllConversations.useQuery(
    undefined,
    { enabled: true }
  );

  const titleMatches = useMemo(() => {
    if (!trimmed) return [];
    return conversations.filter(c => c.title.toLowerCase().includes(trimmed));
  }, [conversations, trimmed]);

  const messageMatches = useMemo(() => {
    if (!serverData) return [];
    const titleIds = new Set(titleMatches.map(c => c.id));
    const results: SearchResult[] = [];
    const seen = new Set<string>();

    for (const msg of serverData.messages) {
      if (seen.has(msg.conversationId) || titleIds.has(msg.conversationId))
        continue;
      seen.add(msg.conversationId);
      results.push({
        conversationId: msg.conversationId,
        title: msg.conversationTitle,
        isPinned: false,
        snippet: snippetFromContent(msg.content),
        role: msg.role,
        createdAt: msg.createdAt,
      });
    }

    return results;
  }, [serverData, titleMatches]);

  const results = useMemo(() => {
    const titleResults: SearchResult[] = titleMatches.map(c => ({
      conversationId: c.id,
      title: c.title,
      isPinned: c.isPinned,
    }));

    // Add message previews for title matches from server data
    const titleResultsWithPreviews = titleResults.map(result => {
      const serverChat = serverData?.chats.find(c => c.conversationId === result.conversationId);
      if (serverChat?.messagePreview) {
        return {
          ...result,
          snippet: snippetFromContent(serverChat.messagePreview.content),
          role: serverChat.messagePreview.role,
          createdAt: serverChat.createdAt,
        };
      }
      return result;
    });

    const combined = [...titleResultsWithPreviews, ...messageMatches];
    
    // Sort pinned items first
    return combined.sort((a, b) => {
      if (a.isPinned && !b.isPinned) return -1;
      if (!a.isPinned && b.isPinned) return 1;
      return 0;
    });
  }, [titleMatches, messageMatches, serverData]);

  // Use all conversations with previews when no search query
  const allResults = useMemo(() => {
    if (!allConversations) return [];
    return allConversations.map(conv => ({
      conversationId: conv.conversationId,
      title: conv.conversationTitle,
      isPinned: conv.isPinned,
      snippet: conv.messagePreview ? snippetFromContent(conv.messagePreview.content) : undefined,
      role: conv.messagePreview?.role,
      createdAt: conv.createdAt,
    }));
  }, [allConversations]);

  const handleSelect = (id: string) => {
    onSelectConversation(id);
    onBackToChat();
  };

  return (
    <main className="min-h-0 flex-1 overflow-y-auto bg-background">
      <div className="mx-auto w-full max-w-5xl px-5 py-6 sm:px-8 sm:py-8">
        <header className="flex flex-col gap-4 border-b border-border pb-5 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="flex items-center gap-3">
              <Search className="size-6 text-muted-foreground" />
              <h1 className="text-2xl font-semibold tracking-[-0.03em]">
                Search
              </h1>
            </div>
            <p className="mt-1.5 max-w-xl text-sm leading-6 text-muted-foreground">
              Search across your conversations and messages. Find specific chats
              or message content quickly.
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap gap-2">
            <Button
              variant="outline"
              className="rounded-xl"
              onClick={onBackToChat}
            >
              Back to chat
            </Button>
          </div>
        </header>

        <section className="mt-6">
          <div className="relative w-full max-w-md">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={event => setQuery(event.target.value)}
              className="h-10 rounded-xl pl-9"
              placeholder="Search conversations and messages"
              aria-label="Search conversations and messages"
            />
          </div>
        </section>

        <div className="mt-5 pb-10">
          {trimmed ? (
            searchLoading && titleMatches.length === 0 ? (
              <Loading className="min-h-64" />
            ) : results.length > 0 ? (
              <div className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
                {results.map((result) => (
                  <button
                    key={result.conversationId}
                    onClick={() => handleSelect(result.conversationId)}
                    className="flex w-full items-center gap-4 px-5 py-4 text-left transition-colors hover:bg-accent"
                  >
                    <MessageCircle className="size-5 shrink-0 text-foreground/70" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="truncate text-base font-medium">
                          {result.title}
                        </span>
                        {result.isPinned && (
                          <Pin className="size-3.5 shrink-0 text-primary" />
                        )}
                      </div>
                      {result.snippet && (
                        <p className="mt-1 line-clamp-1 text-sm text-muted-foreground">
                          {result.role === "user" ? "You: " : ""}
                          {result.snippet}
                        </p>
                      )}
                    </div>
                    {result.createdAt && (
                      <span className="shrink-0 text-xs text-muted-foreground">
                        {formatRelativeDate(result.createdAt)}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            ) : (
              <div className="grid min-h-72 place-items-center rounded-2xl border border-dashed border-border bg-muted/20 p-7 text-center">
                <div>
                  <Search className="mx-auto size-7 text-muted-foreground" />
                  <h2 className="mt-4 text-base font-medium">
                    No results found
                  </h2>
                  <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-muted-foreground">
                    No conversations or messages match "{query.trim()}".
                    Try different keywords.
                  </p>
                </div>
              </div>
            )
          ) : (
            <div className="space-y-6">
              {isLoadingAll ? (
                <Loading className="min-h-64" />
              ) : allResults.length > 0 ? (
                (() => {
                  const grouped = groupConversationsByDate(allResults);
                  return (
                    <>
                      {grouped.today.length > 0 && (
                        <div>
                          <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Today</h3>
                          <div className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
                            {grouped.today.map((result) => (
                              <button
                                key={result.conversationId}
                                onClick={() => handleSelect(result.conversationId)}
                                className="flex w-full items-center gap-4 px-5 py-4 text-left transition-colors hover:bg-accent"
                              >
                                <MessageCircle className="size-5 shrink-0 text-foreground/70" />
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-center gap-2">
                                    <span className="truncate text-base font-medium">
                                      {result.title}
                                    </span>
                                    {result.isPinned && (
                                      <Pin className="size-3.5 shrink-0 text-primary" />
                                    )}
                                  </div>
                                  {result.snippet && (
                                    <p className="mt-1 line-clamp-1 text-sm text-muted-foreground">
                                      {result.role === "user" ? "You: " : ""}
                                      {result.snippet}
                                    </p>
                                  )}
                                </div>
                                {result.createdAt && (
                                  <span className="shrink-0 text-xs text-muted-foreground">
                                    {formatRelativeDate(result.createdAt)}
                                  </span>
                                )}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                      {grouped.yesterday.length > 0 && (
                        <div>
                          <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Yesterday</h3>
                          <div className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
                            {grouped.yesterday.map((result) => (
                              <button
                                key={result.conversationId}
                                onClick={() => handleSelect(result.conversationId)}
                                className="flex w-full items-center gap-4 px-5 py-4 text-left transition-colors hover:bg-accent"
                              >
                                <MessageCircle className="size-5 shrink-0 text-foreground/70" />
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-center gap-2">
                                    <span className="truncate text-base font-medium">
                                      {result.title}
                                    </span>
                                    {result.isPinned && (
                                      <Pin className="size-3.5 shrink-0 text-primary" />
                                    )}
                                  </div>
                                  {result.snippet && (
                                    <p className="mt-1 line-clamp-1 text-sm text-muted-foreground">
                                      {result.role === "user" ? "You: " : ""}
                                      {result.snippet}
                                    </p>
                                  )}
                                </div>
                                {result.createdAt && (
                                  <span className="shrink-0 text-xs text-muted-foreground">
                                    {formatRelativeDate(result.createdAt)}
                                  </span>
                                )}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                      {grouped.older.length > 0 && (
                        <div>
                          <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Older</h3>
                          <div className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
                            {grouped.older.map((result) => (
                              <button
                                key={result.conversationId}
                                onClick={() => handleSelect(result.conversationId)}
                                className="flex w-full items-center gap-4 px-5 py-4 text-left transition-colors hover:bg-accent"
                              >
                                <MessageCircle className="size-5 shrink-0 text-foreground/70" />
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-center gap-2">
                                    <span className="truncate text-base font-medium">
                                      {result.title}
                                    </span>
                                    {result.isPinned && (
                                      <Pin className="size-3.5 shrink-0 text-primary" />
                                    )}
                                  </div>
                                  {result.snippet && (
                                    <p className="mt-1 line-clamp-1 text-sm text-muted-foreground">
                                      {result.role === "user" ? "You: " : ""}
                                      {result.snippet}
                                    </p>
                                  )}
                                </div>
                                {result.createdAt && (
                                  <span className="shrink-0 text-xs text-muted-foreground">
                                    {formatRelativeDate(result.createdAt)}
                                  </span>
                                )}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </>
                  );
                })()
              ) : (
                <div className="grid min-h-72 place-items-center rounded-2xl border border-dashed border-border bg-muted/20 p-7 text-center">
                  <div>
                    <MessageCircle className="mx-auto size-7 text-muted-foreground" />
                    <h2 className="mt-4 text-base font-medium">
                      No conversations yet
                    </h2>
                    <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-muted-foreground">
                      Start a new chat to begin searching.
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}