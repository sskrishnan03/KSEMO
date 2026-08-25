import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { MessageCircle, Search, Clock, ArrowRight } from "lucide-react";
import { useMemo, useState } from "react";

type Conversation = {
  id: string;
  title: string;
  isPinned: boolean;
  isArchived: boolean;
};

function timeAgo(date: Date) {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return date.toLocaleDateString();
}

export function SearchWorkspace({
  conversations,
  onBackToChat,
  onSelectConversation,
}: {
  conversations: Conversation[];
  onBackToChat: () => void;
  onSelectConversation: (conversationId: string) => void;
}) {
  const [query, setQuery] = useState("");
  const trimmed = query.trim().toLowerCase();

  const matched = useMemo(() => {
    if (!trimmed) return [];
    return conversations.filter(c =>
      c.title.toLowerCase().includes(trimmed)
    );
  }, [conversations, trimmed]);

  return (
    <main className="min-h-0 flex-1 overflow-y-auto bg-background transition-colors">
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
              Find any conversation by name. Click a result to open it.
            </p>
          </div>
          <Button
            variant="outline"
            className="shrink-0 rounded-xl"
            onClick={onBackToChat}
          >
            Back to chat
          </Button>
        </header>

        <section className="mt-6">
          <div className="relative w-full xl:max-w-md">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={event => setQuery(event.target.value)}
              className="h-10 rounded-xl pl-9"
              placeholder="Search conversations…"
              aria-label="Search conversations"
              autoFocus
            />
          </div>
        </section>

        <div className="mt-5 pb-10">
          {!trimmed ? (
            <EmptySearch count={conversations.length} />
          ) : matched.length > 0 ? (
            <div className="space-y-2">
              {matched.map(conversation => (
                <button
                  key={conversation.id}
                  onClick={() => onSelectConversation(conversation.id)}
                  className="group flex w-full items-center gap-3 rounded-xl border border-border bg-card p-3.5 text-left transition-colors hover:bg-muted/70 active:bg-muted"
                >
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground transition-colors group-hover:bg-primary/10 group-hover:text-primary">
                    <MessageCircle className="size-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">
                      {conversation.title}
                    </p>
                    {conversation.isPinned && (
                      <span className="mt-0.5 inline-block rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">
                        Pinned
                      </span>
                    )}
                  </div>
                  <ArrowRight className="size-4 shrink-0 text-muted-foreground transition-all duration-150 group-hover:translate-x-0.5 group-hover:text-foreground" />
                </button>
              ))}
            </div>
          ) : (
            <div className="grid min-h-72 place-items-center rounded-2xl border border-dashed border-border bg-muted/20 p-7 text-center">
              <div>
                <Search className="mx-auto size-7 text-muted-foreground" />
                <h2 className="mt-4 text-base font-medium">No results found</h2>
                <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-muted-foreground">
                  No conversations match "{query.trim()}". Try a different
                  search term.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}

function EmptySearch({ count }: { count: number }) {
  return (
    <div className="grid min-h-72 place-items-center rounded-2xl border border-dashed border-border bg-muted/20 p-7 text-center">
      <div>
        <Search className="mx-auto size-7 text-muted-foreground" />
        <h2 className="mt-4 text-base font-medium">Search your conversations</h2>
        <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-muted-foreground">
          {count > 0
            ? `Type to search across ${count} ${count === 1 ? "conversation" : "conversations"}.`
            : "Start a conversation and it will appear here."}
        </p>
      </div>
    </div>
  );
}
