import { cn } from "@/lib/utils";
import React, { useEffect, useRef } from "react";

/**
 * The black circle that floats above the top-left corner of the chat box
 * in Bot mode. Purely visual — it is deliberately not a control and cannot be
 * pressed. Voice chat turns on the moment Bot is selected, and the one and only
 * way to hang up is the stop button inside the box.
 *
 * Visual states:
 * 1. Bot speaking (`isSpeaking`): The circle blows up and organically pulses with
 *    simulated speech acoustics and cadence.
 * 2. User speaking (`active`): Swells dynamically with the microphone live volume level.
 * 3. Bot thinking (`isThinking`): Smooth gentle breathing pulse while generating response.
 * 4. Idle: Calm resting circle.
 *
 * All animation runs directly on the DOM node via requestAnimationFrame for 60fps
 * stutter-free performance without triggering React re-renders.
 */

export function BotVoiceOrb({
  levelRef,
  active = false,
  isSpeaking = false,
  isThinking = false,
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
  className?: string;
}) {
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
        let shadow = "";

        if (isSpeakingRef.current) {
          // Dynamic blow-up effect while bot is speaking
          scale = 1 + smoothedRef.current * 0.42;
          const glowAlpha = Math.min(0.5, 0.15 + smoothedRef.current * 0.35);
          const spread = Math.round(4 + smoothedRef.current * 14);
          shadow = `0 0 ${spread}px rgba(0, 0, 0, ${glowAlpha.toFixed(2)}), 0 0 ${Math.round(spread * 1.8)}px rgba(0, 0, 0, ${(glowAlpha * 0.4).toFixed(2)})`;
        } else if (isThinkingRef.current) {
          scale = 1 + smoothedRef.current * 0.2;
          shadow = "0 0 8px rgba(0, 0, 0, 0.12)";
        } else if (activeRef.current) {
          scale = 1 + smoothedRef.current * 0.32;
          const glowAlpha = Math.min(0.4, 0.1 + smoothedRef.current * 0.3);
          const spread = Math.round(smoothedRef.current * 10);
          shadow = spread > 1 ? `0 0 ${spread}px rgba(0, 0, 0, ${glowAlpha.toFixed(2)})` : "";
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
      className={cn(
        "ksemo-bot-orb rounded-full bg-black shadow-sm transition-[box-shadow]",
        className
      )}
    />
  );
}
