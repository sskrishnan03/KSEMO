import React from "react";
import { cn } from "@/lib/utils";

export type SearchFilter = "all" | "chats" | "messages" | "memories";

export function SearchFilterChips({
  value,
  onChange,
  available,
}: {
  value: SearchFilter;
  onChange: (value: SearchFilter) => void;
  available: SearchFilter[];
}) {
  return (
    <div
      className="flex gap-1 overflow-x-auto px-1 py-2"
      aria-label="Search filters"
    >
      {available.map(item => (
        <button
          key={item}
          onClick={() => onChange(item)}
          aria-pressed={value === item}
          className={cn(
            "shrink-0 rounded-full px-2.5 py-1 text-[11px] font-medium capitalize",
            value === item
              ? "bg-foreground text-background"
              : "bg-muted text-muted-foreground hover:text-foreground"
          )}
        >
          {item}
        </button>
      ))}
    </div>
  );
}
