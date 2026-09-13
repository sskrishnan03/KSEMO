import { type VoiceSessionState } from "@/hooks/useVoiceSession";
import { cn } from "@/lib/utils";
import React, { useEffect, useRef, useState } from "react";

export function VoiceVisual({
  state,
  muted = false,
  levelRef,
  className,
}: {
  state: VoiceSessionState;
  muted?: boolean;
  levelRef?: React.RefObject<number>;
  className?: string;
}) {
  const label = muted
    ? "Microphone muted"
    : state === "processing"
      ? "KSEMO is thinking"
      : state === "speaking"
        ? "KSEMO is speaking"
        : state === "listening"
          ? "Listening"
          : "Ready";

  const [visualLevel, setVisualLevel] = useState(0);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    let active = true;
    const update = () => {
      if (!active) return;
      const currentLevel = levelRef?.current ?? 0;
      setVisualLevel(prev => prev + (currentLevel - prev) * 0.35);
      rafRef.current = requestAnimationFrame(update);
    };
    rafRef.current = requestAnimationFrame(update);
    return () => {
      active = false;
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [levelRef]);

  const scale =
    state === "listening"
      ? 1 + Math.min(0.1, visualLevel * 0.4)
      : state === "speaking"
        ? 1.03 + Math.sin(Date.now() / 300) * 0.02
        : state === "processing"
          ? 1.01
          : 1;

  return (
    <div
      className={cn("relative flex items-center justify-center select-none", className)}
      role="img"
      aria-label={label}
    >
      <div
        className={cn(
          "size-full rounded-full bg-black border border-neutral-700/50",
          muted && "opacity-50"
        )}
        style={{
          transform: `scale(${scale})`,
        }}
      />
    </div>
  );
}