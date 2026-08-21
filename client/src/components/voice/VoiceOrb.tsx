import { type VoiceSessionState } from "@/hooks/useVoiceSession";
import { useEffect, useRef } from "react";

export function VoiceOrb({
  state,
  levelRef,
}: {
  state: VoiceSessionState;
  levelRef: React.RefObject<number>;
}) {
  const circleRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const reducedMotion =
      window.matchMedia("(prefers-reduced-motion: reduce)").matches ||
      document.documentElement.classList.contains("ksemo-reduce-motion");
    if (reducedMotion) return;
    let frame = 0;
    let smooth = 0;
    const tick = (time: number) => {
      const reactive = state === "listening" || state === "speaking";
      const target = reactive ? Math.min(1, levelRef.current * 1.9) : 0;
      smooth += (target - smooth) * 0.12;
      const breath = Math.sin(time / 1400) * 0.012;
      const scale = 1 + breath + smooth * 0.07;
      if (circleRef.current)
        circleRef.current.style.transform = `scale(${scale.toFixed(4)})`;
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [state, levelRef]);

  return (
    <div
      className="grid size-[min(72vw,17rem)] place-items-center"
      role="img"
      aria-label={
        state === "idle" ? "KSEMO microphone muted" : `KSEMO is ${state}`
      }
    >
      <div
        ref={circleRef}
        className="size-44 rounded-full bg-black will-change-transform sm:size-52"
        aria-hidden
      />
    </div>
  );
}
