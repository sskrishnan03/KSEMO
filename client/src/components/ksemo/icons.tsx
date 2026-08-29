import React from "react";
import { cn } from "@/lib/utils";

// Stroke-based share icon drawn on the same 24-unit grid as the lucide icons
// used across the app (strokeWidth 2, currentColor, round caps/joins) so it
// inherits the same color and renders at the same visual weight and size as
// every other icon (copy, download, etc.). It depicts an upward arrow breaking
// out of a rounded base — the widely recognised "share" glyph.
export function ShareIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={cn("size-4", className)}
    >
      <path d="M12 3v11" />
      <path d="m7.5 7.5 4.5-4.5 4.5 4.5" />
      <path d="M3.5 15.5v2a3 3 0 0 0 3 3h11a3 3 0 0 0 3-3v-2" />
    </svg>
  );
}