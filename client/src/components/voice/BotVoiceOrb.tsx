import { cn } from "@/lib/utils";
import React, { useEffect, useRef } from "react";
import {
  BOT_ORB_THEMES,
  DEFAULT_BOT_ORB_THEME_ID,
  getSphereStyle,
  useBotOrbTheme,
  type BotOrbThemeId,
} from "@/lib/botOrbTheme";

/**
 * The 3D realistic circle / orb that floats above the top-left corner of the chat box
 * in Bot mode. Purely visual — it is deliberately not a control and cannot be
 * pressed. Voice chat turns on the moment Bot is selected, and the one and only
 * way to hang up is the stop button inside the box.
 *
 * Visual states:
 * 1. Bot speaking (`isSpeaking`): The circle blows up and organically pulses with
 *    simulated speech acoustics, glowing with the chosen combination's inner color.
 * 2. User speaking (`active`): Swells dynamically with the microphone live volume level.
 * 3. Bot thinking (`isThinking`): Smooth gentle breathing pulse while generating response.
 * 4. Idle: Calm resting 3D sphere with realistic specular highlight and deep black volume.
 *
 * All animation runs directly on the DOM node via requestAnimationFrame for 60fps
 * stutter-free performance without triggering React re-renders.
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
  /** When true the bot is answering aloud and the circle dynamically pulses/blows up. */
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
      const currentTheme = themeRef.current;
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

      if (node && currentTheme) {
        let scale = 1.0;
        const [r, g, b] = currentTheme.rgb;
        const baseShadow = `inset 0 1px 1.5px rgba(255, 255, 255, 0.5), inset 0 -2.5px 5px ${currentTheme.bounceColor}, 0 4px 10px -1px rgba(0, 0, 0, 0.65)`;
        let shadow = `${baseShadow}, 0 0 6px rgba(${r}, ${g}, ${b}, 0.2)`;

        if (isSpeakingRef.current) {
          // Dynamic blow-up effect with rich color glow while bot is speaking
          scale = 1 + smoothedRef.current * 0.42;
          const glowAlpha = Math.min(0.75, 0.22 + smoothedRef.current * 0.5);
          const spread = Math.round(5 + smoothedRef.current * 18);
          shadow = `${baseShadow}, 0 0 ${spread}px rgba(${r}, ${g}, ${b}, ${glowAlpha.toFixed(2)}), 0 0 ${Math.round(spread * 1.7)}px rgba(${r}, ${g}, ${b}, ${(glowAlpha * 0.4).toFixed(2)})`;
        } else if (isThinkingRef.current) {
          scale = 1 + smoothedRef.current * 0.18;
          const glowAlpha = (0.2 + smoothedRef.current * 0.45).toFixed(2);
          const spread = Math.round(6 + smoothedRef.current * 10);
          shadow = `${baseShadow}, 0 0 ${spread}px rgba(${r}, ${g}, ${b}, ${glowAlpha})`;
        } else if (activeRef.current) {
          scale = 1 + smoothedRef.current * 0.32;
          const glowAlpha = Math.min(0.65, 0.18 + smoothedRef.current * 0.4);
          const spread = Math.round(4 + smoothedRef.current * 14);
          shadow = `${baseShadow}, 0 0 ${spread}px rgba(${r}, ${g}, ${b}, ${glowAlpha.toFixed(2)})`;
        }

        node.style.transform = `scale(${scale.toFixed(3)})`;
        node.style.boxShadow = shadow;
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
      style={getSphereStyle(theme)}
      className={cn(
        "ksemo-bot-orb relative inline-flex items-center justify-center rounded-full bg-black overflow-hidden shadow-sm transition-[box-shadow] will-change-transform",
        className
      )}
    >
      {/* The single rolling energy gradient looping continuously around the circle */}
      <span
        className="absolute inset-0 rounded-full animate-orb-roll pointer-events-none"
        style={{
          background: theme.rollingGradient,
        }}
      />
      {/* Top 3D glossy specular glass gleam and edge curvature */}
      <span
        className="absolute inset-0 rounded-full pointer-events-none"
        style={{
          background: `radial-gradient(circle at 30% 24%, rgba(255, 255, 255, 0.85) 0%, rgba(255, 255, 255, 0.22) 16%, transparent 34%), radial-gradient(circle at 50% 50%, transparent 40%, rgba(0, 0, 0, 0.35) 75%, rgba(0, 0, 0, 0.8) 100%)`,
        }}
      />
    </span>
  );
}
