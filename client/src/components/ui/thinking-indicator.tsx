import { cn } from "@/lib/utils";

interface ThinkingIndicatorProps {
  className?: string;
  size?: number;
}

const DOTS = [
  { cx: 9.5, cy: 14, delay: "0ms" },
  { cx: 16, cy: 14, delay: "140ms" },
  { cx: 22.5, cy: 14, delay: "280ms" },
];

export function CosmicLoader({
  className,
  size = 32,
}: ThinkingIndicatorProps) {
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
        {DOTS.map((dot, index) => (
          <circle
            key={index}
            cx={dot.cx}
            cy={dot.cy}
            r="2.6"
            fill="currentColor"
            className="ksemo-dot-loader-particle"
            style={{ animationDelay: dot.delay }}
          />
        ))}
      </svg>
    </div>
  );
}

export function ThinkingIndicator({
  className,
  size,
}: ThinkingIndicatorProps) {
  return <CosmicLoader className={className} size={size} />;
}

export default ThinkingIndicator;
