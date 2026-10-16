import { cn } from "@/lib/utils";
import React from "react";
import { KSEMO_ORB_THEME } from "@/lib/botOrbTheme";
import { NebulaOrbCanvas } from "./NebulaOrbCanvas";

/**
 * A pure-black, water-edged orb. Its outline ripples with voice activity while
 * the overall circle size stays fixed.
 */
export function BotVoiceOrb({
  levelRef,
  active = false,
  isSpeaking = false,
  isThinking = false,
  size = 44,
  className,
}: {
  /** Live voice level in 0..1, mutated in place by useBotVoice each frame. */
  levelRef?: React.RefObject<number>;
  /** When true the circle is listening to the user and swells with the mic level. */
  active?: boolean;
  /** When true the bot is answering aloud and the circle dynamically pulses. */
  isSpeaking?: boolean;
  /** When true the bot is generating/thinking. */
  isThinking?: boolean;
  /** Adds a soft glow around the orb. */
  halo?: boolean;
  /** Render size in pixels. */
  size?: number;
  className?: string;
}) {
  const theme = KSEMO_ORB_THEME;

  return (
    <span
      aria-hidden="true"
      style={{ width: size, height: size }}
      className={cn(
        "ksemo-bot-orb relative inline-flex items-center justify-center rounded-full shrink-0 select-none",
        className
      )}
    >
      <NebulaOrbCanvas
        theme={theme}
        size={size}
        fill
        levelRef={levelRef}
        active={isSpeaking || isThinking || active}
        activity={
          isSpeaking
            ? 0.8
            : isThinking
              ? 0.35
              : 0
        }
      />
    </span>
  );
}
