import { cn } from "@/lib/utils";
import React, { useEffect, useRef } from "react";

/** A solid-black orb that responds to live voice activity without changing color. */
export function BotVoiceOrb({
  size = 44,
  className,
  active = false,
  isSpeaking = false,
  levelRef,
}: {
  /** Live microphone level used to swell the orb while listening. */
  levelRef?: React.RefObject<number>;
  active?: boolean;
  isSpeaking?: boolean;
  isThinking?: boolean;
  halo?: boolean;
  /** Render size in pixels. */
  size?: number;
  className?: string;
}) {
  const orbRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const orb = orbRef.current;
    if (!orb || !active || isSpeaking) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let frame = 0;
    const followVoice = () => {
      const inputLevel = Math.max(0, Math.min(1, levelRef?.current ?? 0));
      orb.style.transform = `scale(${1 + inputLevel * 0.24})`;
      frame = requestAnimationFrame(followVoice);
    };
    frame = requestAnimationFrame(followVoice);
    return () => {
      cancelAnimationFrame(frame);
      orb.style.removeProperty("transform");
    };
  }, [active, isSpeaking, levelRef]);

  return (
    <span
      ref={orbRef}
      aria-hidden="true"
      style={{ width: size, height: size, backgroundColor: "#000000" }}
      className={cn(
        "ksemo-bot-orb relative inline-flex shrink-0 select-none rounded-full",
        active && "ksemo-bot-orb--listening",
        isSpeaking && "ksemo-bot-orb--speaking",
        className
      )}
    />
  );
}
