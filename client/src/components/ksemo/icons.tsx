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

export interface TemporaryChatIconProps extends React.SVGProps<SVGSVGElement> {
  className?: string;
  active?: boolean;
}

// Temporary chat icon: bold monochrome recreation of the reference design.
// Contains only the rounded chat bubble with three dots and the small timer
// clock overlapping its lower-right corner; the decorative outer ring and
// radiating marks were removed. Tightened viewBox makes the glyph read larger,
// with heavier strokes for a bolder look at small sizes.
export function TemporaryChatIcon({
  className,
  active = false,
  ...props
}: TemporaryChatIconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="334 327.6 356 356"
      fill="none"
      aria-hidden="true"
      className={cn("size-4 shrink-0 select-none", className)}
      {...props}
    >
      {/* Chat Bubble Outline */}
      <path
        d="M 645 537 
           L 645 460 
           C 645 405 600 375 540 375 
           L 460 375 
           C 400 375 363.5 405 363.5 460 
           L 363.5 510 
           C 363.5 535 380 555 388 568 
           C 392 575 378 605 368 624 
           L 438 591 
           L 546.5 591"
        stroke="currentColor"
        strokeWidth="28"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill={active ? "currentColor" : "none"}
        fillOpacity={active ? 0.16 : 0}
      />

      {/* Three Horizontal Dots Inside Chat Bubble */}
      <circle cx="445.4" cy="490.4" r="19" fill="currentColor" />
      <circle cx="501.3" cy="490.4" r="19" fill="currentColor" />
      <circle cx="558.2" cy="490.4" r="19" fill="currentColor" />

      {/* Clock Circle overlapping lower-right (clean transparent background) */}
      <circle
        cx="604.5"
        cy="580.2"
        r="59"
        stroke="currentColor"
        strokeWidth="22"
        fill={active ? "currentColor" : "none"}
        fillOpacity={active ? 0.12 : 0}
      />

      {/* Clock Hands (L-shape) */}
      <path
        d="M 604.5 556 
           L 604.5 580.2 
           L 628.5 580.2"
        stroke="currentColor"
        strokeWidth="17"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}