import React from "react";
import { cn } from "@/lib/utils";
import { type BotOrbTheme } from "@/lib/botOrbTheme";

/**
 * Real 3D physical glass orb component with an infinite continuous rolling/swirling loop on a single circle.
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
        boxShadow: `inset 0 1.5px 2.5px rgba(255, 255, 255, 0.45), inset 0 -3px 6px ${theme.bounceColor}, 0 6px 16px -2px rgba(0, 0, 0, 0.75), 0 0 ${active ? 20 : 10}px rgba(${r}, ${g}, ${b}, ${active ? 0.45 : 0.22})`,
      }}
    >
      {/* The single rolling energy gradient with center point looping continuously around the circle */}
      <span
        className="absolute inset-0 rounded-full animate-orb-roll pointer-events-none"
        style={{
          background: theme.rollingGradient,
        }}
      />
      {/* Static 3D glossy specular glass gleam and edge curvature */}
      <span
        className="absolute inset-0 rounded-full pointer-events-none"
        style={{
          background: `radial-gradient(circle at 30% 24%, rgba(255, 255, 255, 0.85) 0%, rgba(255, 255, 255, 0.22) 16%, transparent 34%), radial-gradient(circle at 50% 50%, transparent 40%, rgba(0, 0, 0, 0.35) 75%, rgba(0, 0, 0, 0.8) 100%)`,
        }}
      />
    </span>
  );
}
