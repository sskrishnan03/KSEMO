import { memo, useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

interface ThinkingIndicatorProps {
  className?: string;
  size?: number;
}

const DOTS = [
  { cx: 9.5, phase: 0 },
  { cx: 16, phase: (Math.PI * 2) / 3 },
  { cx: 22.5, phase: (Math.PI * 4) / 3 },
];

function getDotFrame(timeSeconds: number, phaseOffset: number) {
  const wave = Math.sin((timeSeconds * Math.PI * 2) / 1.35 - phaseOffset);
  const lift = (wave + 1) / 2;
  return {
    cy: 14 - lift * 4.2,
    radius: 2.4 + lift * 0.4,
    opacity: 0.68 + lift * 0.32,
  };
}

export const CosmicLoader = memo(function CosmicLoader({
  className,
  size = 32,
}: ThinkingIndicatorProps) {
  const dotRefs = useRef<(SVGCircleElement | null)[]>([]);
  const initialTime =
    typeof performance !== "undefined" ? performance.now() / 1000 : 0;

  useEffect(() => {
    let frameId = 0;
    let running = false;
    const motionPreference = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    );
    const shouldAnimate = () =>
      !motionPreference.matches &&
      !document.documentElement.classList.contains("ksemo-reduce-motion");
    const setRestingDots = () => {
      for (const dot of dotRefs.current) {
        if (!dot) continue;
        dot.setAttribute("cy", "14");
        dot.setAttribute("r", "2.6");
        dot.setAttribute("opacity", "1");
      }
    };
    const stop = () => {
      running = false;
      if (frameId) cancelAnimationFrame(frameId);
      frameId = 0;
      setRestingDots();
    };
    const render = (timestamp: number) => {
      if (!shouldAnimate()) {
        stop();
        return;
      }
      const timeSeconds = timestamp / 1000;
      DOTS.forEach((dot, index) => {
        const element = dotRefs.current[index];
        if (!element) return;
        const frame = getDotFrame(timeSeconds, dot.phase);
        element.setAttribute("cy", frame.cy.toFixed(2));
        element.setAttribute("r", frame.radius.toFixed(2));
        element.setAttribute("opacity", frame.opacity.toFixed(2));
      });
      frameId = requestAnimationFrame(render);
    };
    const start = () => {
      if (!running && shouldAnimate()) {
        running = true;
        frameId = requestAnimationFrame(render);
      } else if (!shouldAnimate()) {
        stop();
      }
    };
    const motionObserver = new MutationObserver(start);
    motionObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });
    motionPreference.addEventListener("change", start);
    start();

    return () => {
      stop();
      motionObserver.disconnect();
      motionPreference.removeEventListener("change", start);
    };
  }, []);

  return (
    <div
      role="status"
      aria-label="Thinking"
      className={cn("inline-flex items-center justify-center select-none text-foreground", className)}
    >
      <svg
        width={size}
        height={size}
        viewBox="0 0 32 26"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
        className="ksemo-dot-loader"
      >
        {DOTS.map((dot, index) => {
          const initialFrame = getDotFrame(initialTime, dot.phase);
          return (
            <circle
              key={index}
              ref={element => {
                dotRefs.current[index] = element;
              }}
              cx={dot.cx}
              cy={initialFrame.cy.toFixed(2)}
              r={initialFrame.radius.toFixed(2)}
              opacity={initialFrame.opacity.toFixed(2)}
              fill="currentColor"
            />
          );
        })}
      </svg>
    </div>
  );
});

export function ThinkingIndicator({
  className,
  size,
}: ThinkingIndicatorProps) {
  return <CosmicLoader className={className} size={size} />;
}

export default ThinkingIndicator;
