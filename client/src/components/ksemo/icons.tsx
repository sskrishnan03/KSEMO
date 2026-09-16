import React, { useId } from "react";
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
// radiating marks were removed. The bubble outline is clipped exactly where it
// would pass under the clock so the clock always reads as a clean, perfect
// circle. Tightened viewBox and heavier strokes make the glyph read larger and
// bolder at small sizes. When `active` (temporary mode on) the three dots
// bounce like a loading indicator and the clock hands spin around like a
// running timer.
export function TemporaryChatIcon({
  className,
  active = false,
  ...props
}: TemporaryChatIconProps) {
  const id = useId();
  const clipId = `ksemo-tc-clip-${id}`;

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="334 327.6 356 356"
      fill="none"
      aria-hidden="true"
      className={cn("size-4 shrink-0 select-none", className)}
      {...props}
    >
      <defs>
        {/* Carve the clock circle out of the bubble so nothing draws inside it */}
        <clipPath id={clipId}>
          <path
            d="M 334 327.6 H 690 V 683.6 H 334 Z 
               M 545.5 580.2 A 59 59 0 1 0 663.5 580.2 A 59 59 0 1 0 545.5 580.2 Z"
            fillRule="evenodd"
          />
        </clipPath>
      </defs>

      {/* Chat Bubble Outline (clipped where it passes under the clock) */}
      <g clipPath={`url(#${clipId})`}>
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
          fill="none"
          fillOpacity={0}
        />

        {/* Three Horizontal Dots Inside Chat Bubble. In temporary (active)
            mode they bounce up and down in sequence like a loading indicator,
            staying in their full bold color. Eased motion keeps it smooth. */}
        <g>
          {active && (
            <animateTransform
              attributeName="transform"
              type="translate"
              values="0 0; 0 -8; 0 0"
              keyTimes="0; 0.5; 1"
              calcMode="spline"
              keySplines="0.3 0 0.7 1; 0.3 0 0.7 1"
              dur="1s"
              begin="0s"
              repeatCount="indefinite"
            />
          )}
          <circle cx="445.4" cy="490.4" r="19" fill="currentColor" />
        </g>
        <g>
          {active && (
            <animateTransform
              attributeName="transform"
              type="translate"
              values="0 0; 0 -8; 0 0"
              keyTimes="0; 0.5; 1"
              calcMode="spline"
              keySplines="0.3 0 0.7 1; 0.3 0 0.7 1"
              dur="1s"
              begin="0.33s"
              repeatCount="indefinite"
            />
          )}
          <circle cx="501.3" cy="490.4" r="19" fill="currentColor" />
        </g>
        <g>
          {active && (
            <animateTransform
              attributeName="transform"
              type="translate"
              values="0 0; 0 -8; 0 0"
              keyTimes="0; 0.5; 1"
              calcMode="spline"
              keySplines="0.3 0 0.7 1; 0.3 0 0.7 1"
              dur="1s"
              begin="0.66s"
              repeatCount="indefinite"
            />
          )}
          <circle cx="558.2" cy="490.4" r="19" fill="currentColor" />
        </g>
      </g>

      {/* Clock Circle overlapping lower-right, drawn on top (perfect circle) */}
      <circle
        cx="604.5"
        cy="580.2"
        r="59"
        stroke="currentColor"
        strokeWidth="22"
        fill="none"
        fillOpacity={0}
      />

      {/* Clock Hands (L-shape). In temporary mode they spin around the clock
          like a running timer. */}
      <g>
        {active && (
          <animateTransform
            attributeName="transform"
            type="rotate"
            from="0 604.5 580.2"
            to="360 604.5 580.2"
            dur="5s"
            repeatCount="indefinite"
          />
        )}
        <path
          d="M 604.5 556 
             L 604.5 580.2 
             L 628.5 580.2"
          stroke="currentColor"
          strokeWidth="17"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </g>
    </svg>
  );
}