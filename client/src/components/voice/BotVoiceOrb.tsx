import { cn } from "@/lib/utils";
import React from "react";

/** One fixed, solid-black orb. Voice activity never changes its color. */
export function BotVoiceOrb({
  size = 44,
  className,
}: {
  /** Kept for existing callers; audio activity does not recolor the orb. */
  levelRef?: React.RefObject<number>;
  active?: boolean;
  isSpeaking?: boolean;
  isThinking?: boolean;
  halo?: boolean;
  /** Render size in pixels. */
  size?: number;
  className?: string;
}) {
  return (
    <span
      aria-hidden="true"
      style={{ width: size, height: size, backgroundColor: "#000000" }}
      className={cn(
        "ksemo-bot-orb relative inline-flex shrink-0 select-none rounded-full",
        className
      )}
    />
  );
}
