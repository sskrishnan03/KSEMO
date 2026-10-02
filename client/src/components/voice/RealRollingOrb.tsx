import React from "react";
import { cn } from "@/lib/utils";
import { type BotOrbTheme } from "@/lib/botOrbTheme";

/**
 * Real 3D physical glass orb component with an infinite continuous rolling/swirling loop on a single circle.
 * The outer circle perimeter remains completely stationary with deep black framing,
 * while only the rich colors inside roll continuously.
 * No white highlights or white specular fade on top.
 */
export function RealRollingOrb({
  theme,
  size = 72,
  className,
  active = false,
}: {
  theme: BotOrbTheme;
  size?: number;
  className?: string;
  active?: boolean;
}) {
  const [r, g, b] = theme.rgb;

  return (
    <span
      aria-hidden="true"
      className={cn(
        "relative inline-flex items-center justify-center rounded-full bg-black overflow-hidden shadow-sm shrink-0 select-none",
        className
      )}
      style={{
        width: size,
        height: size,
        boxShadow: `inset 0 -3px 6px ${theme.bounceColor}, 0 6px 16px -2px rgba(0, 0, 0, 0.8), 0 0 ${active ? 20 : 10}px rgba(${r}, ${g}, ${b}, ${active ? 0.45 : 0.22})`,
      }}
    >
      {/* The single rolling energy gradient inside */}
      <span
        className="absolute inset-[-15%] rounded-full animate-orb-roll pointer-events-none"
        style={{
          background: theme.rollingGradient,
        }}
      />
      {/* Stationary dark perimeter rim so the outer circle boundary is 100% still and never appears to scroll */}
      <span
        className="absolute inset-0 rounded-full pointer-events-none"
        style={{
          background: `radial-gradient(circle at 50% 50%, transparent 58%, rgba(0, 0, 0, 0.85) 86%, #000000 100%)`,
        }}
      />
    </span>
  );
}
