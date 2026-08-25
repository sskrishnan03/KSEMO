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
  const rippleRef = useRef<HTMLDivElement>(null);

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

      if (rippleRef.current) {
        if (state === "speaking") {
          const ripple = (Math.sin(time / 400) + 1) / 2;
          const rippleScale = 1 + ripple * 0.15 + smooth * 0.1;
          const opacity = 0.12 + ripple * 0.08;
          rippleRef.current.style.transform = `scale(${rippleScale.toFixed(4)})`;
          rippleRef.current.style.opacity = opacity.toFixed(3);
          rippleRef.current.style.display = "block";
        } else if (state === "listening") {
          const pulse = (Math.sin(time / 800) + 1) / 2;
          rippleRef.current.style.transform = `scale(${(1 + pulse * 0.06).toFixed(4)})`;
          rippleRef.current.style.opacity = (0.06 + pulse * 0.04).toFixed(3);
          rippleRef.current.style.display = "block";
        } else {
          rippleRef.current.style.display = "none";
        }
      }

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
      <div className="relative">
        <div
          ref={rippleRef}
          className="absolute inset-0 rounded-full"
          style={{
            background:
              state === "speaking"
                ? "radial-gradient(circle, rgba(127,29,29,0.3) 0%, rgba(127,29,29,0) 70%)"
                : "radial-gradient(circle, rgba(127,29,29,0.15) 0%, rgba(127,29,29,0) 70%)",
            display: "none",
          }}
          aria-hidden
        />
        <div
          ref={circleRef}
          className="size-44 rounded-full bg-[#240708] will-change-transform sm:size-52"
          aria-hidden
        />
      </div>
    </div>
  );
}
