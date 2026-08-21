import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import React, { useEffect } from "react";
import { SearchFilterChips, type SearchFilter } from "./SearchFilterChips";
import {
  SearchResultGroups,
  type SearchChatResult,
  type SearchMemoryResult,
  type SearchMessageResult,
} from "./SearchResultGroups";

type SearchResults = {
  chats: SearchChatResult[];
  messages: SearchMessageResult[];
};
type SearchDialogBodyProps = {
  query: string;
  onQueryChange: (value: string) => void;
  filter: SearchFilter;
  onFilterChange: (filter: SearchFilter) => void;
  results?: SearchResults;
  memories?: SearchMemoryResult[];
  loading: boolean;
  onSelect: (id: string) => void;
  onOpenMemories: () => void;
};

export function SearchDialog({
  open,
  onOpenChange,
  ...bodyProps
}: SearchDialogBodyProps & {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="top-[max(1rem,8dvh)] flex max-h-[84dvh] w-[calc(100%-2rem)] translate-y-0 flex-col overflow-hidden rounded-2xl p-3 sm:max-w-2xl">
        <DialogHeader className="sr-only">
          <DialogTitle>Search KSEMO</DialogTitle>
        </DialogHeader>
        <SearchDialogBody {...bodyProps} />
      </DialogContent>
    </Dialog>
  );
}

export function SearchDialogBody({
  query,
  onQueryChange,
  filter,
  onFilterChange,
  results,
  memories = [],
  loading,
  onSelect,
  onOpenMemories,
}: SearchDialogBodyProps) {
  const canSearch = query.trim().length >= 2;
  const chats = results?.chats ?? [];
  const messages = results?.messages ?? [];
  const available =
    canSearch && !loading
      ? ([
          "all",
          ...(chats.length ? ["chats"] : []),
          ...(messages.length ? ["messages"] : []),
          ...(memories.length ? ["memories"] : []),
        ] as SearchFilter[])
      : [];
  const availableKey = available.join("|");
  useEffect(() => {
    if (available.length > 0 && !available.includes(filter))
      onFilterChange("all");
  }, [availableKey, filter, onFilterChange]);
  const shownChats = filter === "all" || filter === "chats" ? chats : [];
  const shownMessages =
    filter === "all" || filter === "messages" ? messages : [];
  const shownMemories =
    filter === "all" || filter === "memories" ? memories : [];
  const hasResults = chats.length + messages.length + memories.length > 0;

  return (
    <>
      <Input
        autoFocus
        value={query}
        onChange={event => onQueryChange(event.target.value)}
        placeholder="Search chats, messages, and memories…"
        className="h-11 shrink-0 border-0 bg-muted px-3 shadow-none focus-visible:ring-0"
      />
      {available.length > 0 && (
        <SearchFilterChips
          value={filter}
          onChange={onFilterChange}
          available={available}
        />
      )}
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain pb-2 pr-1">
        {!canSearch ? (
          <p className="px-3 py-8 text-center text-sm text-muted-foreground">
            Type at least two characters to search KSEMO.
          </p>
        ) : loading ? (
          <p className="px-3 py-8 text-center text-sm text-muted-foreground">
            Searching KSEMO…
          </p>
        ) : hasResults ? (
          <SearchResultGroups
            chats={shownChats}
            messages={shownMessages}
            memories={shownMemories}
            onSelect={onSelect}
            onOpenMemories={onOpenMemories}
          />
        ) : (
          <p className="px-3 py-8 text-center text-sm text-muted-foreground">
            No matching chats, messages, or memories found.
          </p>
        )}
      </div>
    </>
  );
}
