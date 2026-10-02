import React from "react";
import { cn } from "@/lib/utils";
import { type BotOrbTheme } from "@/lib/botOrbTheme";
import { NebulaOrbCanvas } from "./NebulaOrbCanvas";

/**
 * Fluid organic nebula orb component.
 * Completely borderless with zero visible strokes, rings, or outlines.
 * Fluid clouds naturally dissolve inside the sphere without any harsh edge.
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
  return (
    <span
      aria-hidden="true"
      className={cn(
        "relative inline-flex items-center justify-center rounded-full overflow-hidden shrink-0 select-none",
        className
      )}
      style={{
        width: size,
        height: size,
      }}
    >
      <NebulaOrbCanvas
        theme={theme}
        size={size}
        active={active}
      />
    </span>
  );
}
