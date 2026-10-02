import { cn } from "@/lib/utils";
import React, { useEffect, useRef } from "react";
import {
  BOT_ORB_THEMES,
  DEFAULT_BOT_ORB_THEME_ID,
  useBotOrbTheme,
  type BotOrbThemeId,
} from "@/lib/botOrbTheme";
import { NebulaOrbCanvas } from "./NebulaOrbCanvas";

/**
 * The 3D realistic circle / orb that floats in the composer in Bot mode.
 * Purely visual — strictly borderless, zero outer fade or drop-shadow.
 * Looks completely identical to the settings orb design.
 *
 * Dynamic responsiveness:
 * 1. Bot speaking (`isSpeaking`): Gentle rhythmic acoustic pulsing.
 * 2. User speaking (`active`): Swells naturally with microphone audio level.
 * 3. Bot thinking (`isThinking`): Smooth gentle breathing pulse.
 * 4. Idle: Calm resting nebula sphere.
 */
export function BotVoiceOrb({
  levelRef,
  active = false,
  isSpeaking = false,
  isThinking = false,
  themeId: propThemeId,
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
  /** Optional theme override; defaults to user's saved selection from settings. */
  themeId?: BotOrbThemeId;
  className?: string;
}) {
  const { theme: activeTheme } = useBotOrbTheme();
  const theme = propThemeId
    ? BOT_ORB_THEMES[propThemeId] || activeTheme
    : activeTheme || BOT_ORB_THEMES[DEFAULT_BOT_ORB_THEME_ID];

  const themeRef = useRef(theme);
  themeRef.current = theme;

  const nodeRef = useRef<HTMLSpanElement>(null);
  const activeRef = useRef(active);
  activeRef.current = active;
  const isSpeakingRef = useRef(isSpeaking);
  isSpeakingRef.current = isSpeaking;
  const isThinkingRef = useRef(isThinking);
  isThinkingRef.current = isThinking;

  const smoothedRef = useRef(0);

  useEffect(() => {
    let frame: number | null = null;

    const tick = () => {
      const node = nodeRef.current;
      const now = performance.now();
      let target = 0;

      if (isSpeakingRef.current) {
        // Organic harmonic speech waveform simulation
        const t = now * 0.007;
        const speechEnvelope =
          Math.sin(t * 2.1) * 0.18 +
          Math.sin(t * 4.3 + 1.2) * 0.12 +
          Math.sin(t * 1.3) * 0.16 +
          0.42;
        target = Math.max(0.12, Math.min(1.0, speechEnvelope));
      } else if (isThinkingRef.current) {
        // Gentle rhythmic breathing pulse while thinking
        const t = now * 0.0035;
        target = (Math.sin(t) * 0.5 + 0.5) * 0.22;
      } else if (activeRef.current) {
        // User speaking - mic audio level
        target = levelRef?.current ?? 0;
      }

      // Ease toward the target level so the circle glides naturally
      const easeFactor = isSpeakingRef.current ? 0.28 : 0.22;
      smoothedRef.current += (target - smoothedRef.current) * easeFactor;

      if (node) {
        let scale = 1.0;

        if (isSpeakingRef.current) {
          scale = 1 + smoothedRef.current * 0.16;
        } else if (isThinkingRef.current) {
          scale = 1 + smoothedRef.current * 0.08;
        } else if (activeRef.current) {
          scale = 1 + smoothedRef.current * 0.12;
        }

        node.style.transform = `scale(${scale.toFixed(3)})`;
        // Strictly zero fade or shadow outside the circle
        node.style.boxShadow = "none";
      }

      frame = requestAnimationFrame(tick);
    };

    frame = requestAnimationFrame(tick);
    return () => {
      if (frame !== null) cancelAnimationFrame(frame);
    };
  }, [levelRef]);

  return (
    <span
      ref={nodeRef}
      aria-hidden="true"
      className={cn(
        "ksemo-bot-orb relative inline-flex items-center justify-center rounded-full bg-black overflow-hidden will-change-transform shrink-0 select-none",
        className
      )}
    >
      <NebulaOrbCanvas
        theme={theme}
        size={52}
        active={active || isSpeaking || isThinking}
        activity={isSpeaking ? 0.8 : isThinking ? 0.35 : active ? 0.5 : 0}
      />
    </span>
  );
}
