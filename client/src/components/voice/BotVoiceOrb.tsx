import { cn } from "@/lib/utils";
import React, { useEffect, useRef } from "react";
import { KSEMO_ORB_THEME } from "@/lib/botOrbTheme";
import { NebulaOrbCanvas } from "./NebulaOrbCanvas";

/**
 * The 3D realistic circle / orb that floats in the composer in Bot mode.
 * One fixed aurora design, with a soft matching halo and live voice response.
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
  halo = true,
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

  const nodeRef = useRef<HTMLSpanElement>(null);
  const activeRef = useRef(active);
  activeRef.current = active;
  const isSpeakingRef = useRef(isSpeaking);
  isSpeakingRef.current = isSpeaking;
  const isThinkingRef = useRef(isThinking);
  isThinkingRef.current = isThinking;
  const haloRef = useRef(halo);
  haloRef.current = halo;

  const smoothedRef = useRef(0);

  // The canvas fills this span with CSS rather than being told a pixel size, so
  // it always matches the caller's box exactly without any measuring — and
  // without re-creating the WebGL context when the box changes.

  useEffect(() => {
    let frame: number | null = null;

    const tick = () => {
      const node = nodeRef.current;
      const now = performance.now();
      const microphoneLevel = activeRef.current
        ? Math.max(0, levelRef?.current ?? 0)
        : 0;
      // Ignore mic noise and meter jitter while the user is silent. Keeping
      // the listening state active is necessary for capture, but it should
      // not make the orb look like it is still speaking.
      const userIsSpeaking = microphoneLevel > 0.06;
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
      } else if (userIsSpeaking) {
        // User speaking - mic audio level
        target = microphoneLevel;
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
        } else if (userIsSpeaking) {
          scale = 1 + smoothedRef.current * 0.12;
        }

        node.style.transform = `scale(${scale.toFixed(3)})`;
        node.style.filter = !haloRef.current
          ? "none"
          : isSpeakingRef.current || userIsSpeaking
            ? "drop-shadow(0 0 13px rgba(82, 215, 255, 0.48))"
            : "drop-shadow(0 0 8px rgba(82, 180, 255, 0.24))";
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
      style={{ width: size, height: size }}
      className={cn(
        "ksemo-bot-orb relative inline-flex items-center justify-center rounded-full will-change-transform shrink-0 select-none",
        className
      )}
    >
      <NebulaOrbCanvas
        theme={theme}
        size={size}
        fill
        active={
          isSpeaking ||
          isThinking ||
          (active && (levelRef?.current ?? 0) > 0.06)
        }
        activity={
          isSpeaking
            ? 0.8
            : isThinking
              ? 0.35
              : active && (levelRef?.current ?? 0) > 0.06
                ? 0.5
                : 0
        }
      />
    </span>
  );
}
