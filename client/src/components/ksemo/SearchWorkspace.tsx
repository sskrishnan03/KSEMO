import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { trpc } from "@/lib/trpc";
import { MessageCircle, Search } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

type SearchResult = {
  conversationId: string;
  title: string;
  isPinned: boolean;
  snippet?: string;
  role?: string;
};

function snippetFromContent(content: string, maxLen = 120): string {
  const clean = content.replace(/\s+/g, " ").trim();
  if (clean.length <= maxLen) return clean;
  return clean.slice(0, maxLen) + "…";
}

export function SearchDialog({
  open,
  onOpenChange,
  conversations,
  onSelectConversation,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  conversations: Array<{
    id: string;
    title: string;
    isPinned: boolean;
  }>;
  onSelectConversation: (conversationId: string) => void;
}) {
  const [query, setQuery] = useState("");
  const trimmed = query.trim().toLowerCase();
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setQuery("");
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  const { data: serverData } = trpc.conversation.search.useQuery(
    { query: query.trim() },
    { enabled: open && query.trim().length >= 1 }
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
    return [...titleResults, ...messageMatches];
  }, [titleMatches, messageMatches]);

  const handleSelect = (id: string) => {
    onOpenChange(false);
    onSelectConversation(id);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[70dvh] w-[min(55vw,580px)] max-sm:w-[calc(100%-2rem)] flex-col gap-0 overflow-hidden rounded-2xl p-0">
        <DialogTitle className="sr-only">Search</DialogTitle>
        <DialogDescription className="sr-only">
          Search conversations and messages
        </DialogDescription>

        <div className="shrink-0 border-b border-border px-4 pb-3 pt-4 pr-12">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              ref={inputRef}
              value={query}
              onChange={e => setQuery(e.target.value)}
              className="h-10 rounded-xl pl-9 text-sm"
              placeholder="Search chats and messages…"
              aria-label="Search conversations and messages"
            />
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-2">
          {trimmed ? (
            results.length > 0 ? (
              <div className="space-y-0.5">
                {results.map(result => (
                  <button
                    key={result.conversationId}
                    onClick={() => handleSelect(result.conversationId)}
                    className="group flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left transition-colors hover:bg-muted/70"
                  >
                    <MessageCircle className="size-[18px] shrink-0 stroke-[2.4] text-foreground/85 transition-colors group-hover:text-foreground" />
                    <div className="min-w-0 flex-1">
                      <span className="block truncate text-[13px] leading-5">
                        {result.title}
                      </span>
                      {result.snippet && (
                        <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
                          {result.role === "user" ? "You: " : ""}
                          {result.snippet}
                        </p>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              <div className="grid min-h-32 place-items-center p-5 text-center">
                <div>
                  <p className="text-sm font-medium">No results found</p>
                  <p className="mx-auto mt-1 max-w-xs text-xs text-muted-foreground">
                    No conversations or messages match "{query.trim()}".
                  </p>
                </div>
              </div>
            )
          ) : (
            <div className="space-y-0.5">
              {conversations.length > 0 ? (
                conversations.map(c => (
                  <button
                    key={c.id}
                    onClick={() => handleSelect(c.id)}
                    className="group flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left transition-colors hover:bg-muted/70"
                  >
                    <MessageCircle className="size-[18px] shrink-0 stroke-[2.4] text-foreground/85 transition-colors group-hover:text-foreground" />
                    <span className="truncate text-[13px] leading-5">
                      {c.title}
                    </span>
                  </button>
                ))
              ) : (
                <p className="px-2.5 py-4 text-center text-sm text-muted-foreground">
                  No conversations yet.
                </p>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
