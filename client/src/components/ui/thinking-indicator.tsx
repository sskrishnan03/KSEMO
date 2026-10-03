import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

interface CosmicLoaderProps {
  className?: string;
  size?: number;
}

const PATH_1 =
  "M 23.8 0.5 C 17.5 -1.4 1.4 20.9 9.9 27.3 C 14.2 30.5 21.9 22.9 23.8 17.8 C 28 7 2.1 3.3 0.4 11.6 C -0.4 15.9 10 18.3 12.6 18.7 C 25.2 20.5 31.5 2.9 23.8 0.5";

const PATH_2 =
  "M 0.4 11.6 C 2.1 3.3 28 7 23.8 17.8 C 21.9 22.9 14.2 30.5 9.9 27.3 C 1.4 20.9 17.5 -1.4 23.8 0.5 C 31.5 2.9 25.2 20.5 12.6 18.7 C 10 18.3 -0.4 15.9 0.4 11.6";

const DUR_1 = 3.5;
const DUR_2 = 4.0;

// The exact 10 particles on Path 1 (purple -> cyan -> white)
const STREAM_1_PARTICLES = [
  { fill: "#4b0082", r: 0.4, offset: 0.00 },
  { fill: "#5c00a3", r: 0.5, offset: 0.05 },
  { fill: "#6d00c4", r: 0.6, offset: 0.10 },
  { fill: "#7e00e5", r: 0.7, offset: 0.15 },
  { fill: "#8f00ff", r: 0.8, offset: 0.20 },
  { fill: "#00b7eb", r: 0.9, offset: 0.25 },
  { fill: "#00d4ff", r: 1.0, offset: 0.30 },
  { fill: "#00f0ff", r: 1.1, offset: 0.35 },
  { fill: "#e0ffff", r: 1.2, offset: 0.40 },
  { fill: "#ffffff", r: 1.3, offset: 0.45 },
];

// The exact 5 counter particles on Path 2 (cyan -> white)
const STREAM_2_PARTICLES = [
  { fill: "#00f0ff", r: 0.8, offset: 0.10 },
  { fill: "#66f8ff", r: 0.9, offset: 0.15 },
  { fill: "#99fbff", r: 1.0, offset: 0.20 },
  { fill: "#ccfdff", r: 1.1, offset: 0.25 },
  { fill: "#ffffff", r: 1.2, offset: 0.30 },
];

const BEZIER_SEGMENTS_1 = [
  { p0: [23.8, 0.5], p1: [17.5, -1.4], p2: [1.4, 20.9], p3: [9.9, 27.3] },
  { p0: [9.9, 27.3], p1: [14.2, 30.5], p2: [21.9, 22.9], p3: [23.8, 17.8] },
  { p0: [23.8, 17.8], p1: [28, 7], p2: [2.1, 3.3], p3: [0.4, 11.6] },
  { p0: [0.4, 11.6], p1: [-0.4, 15.9], p2: [10, 18.3], p3: [12.6, 18.7] },
  { p0: [12.6, 18.7], p1: [25.2, 20.5], p2: [31.5, 2.9], p3: [23.8, 0.5] },
];

const BEZIER_SEGMENTS_2 = [
  { p0: [0.4, 11.6], p1: [2.1, 3.3], p2: [28, 7], p3: [23.8, 17.8] },
  { p0: [23.8, 17.8], p1: [21.9, 22.9], p2: [14.2, 30.5], p3: [9.9, 27.3] },
  { p0: [9.9, 27.3], p1: [1.4, 20.9], p2: [17.5, -1.4], p3: [23.8, 0.5] },
  { p0: [23.8, 0.5], p1: [31.5, 2.9], p2: [25.2, 20.5], p3: [12.6, 18.7] },
  { p0: [12.6, 18.7], p1: [10, 18.3], p2: [-0.4, 15.9], p3: [0.4, 11.6] },
];

const TABLE_SIZE = 1200;
let cachedTable1: Float32Array | null = null;
let cachedTable2: Float32Array | null = null;

function buildPointTable(pathD: string): Float32Array {
  const table = new Float32Array(TABLE_SIZE * 2);

  if (typeof document !== "undefined") {
    try {
      const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
      path.setAttribute("d", pathD);
      const totalLength = path.getTotalLength ? path.getTotalLength() : 0;
      if (totalLength > 0 && typeof path.getPointAtLength === "function") {
        for (let i = 0; i < TABLE_SIZE; i++) {
          const pt = path.getPointAtLength((i / TABLE_SIZE) * totalLength);
          table[i * 2] = pt.x;
          table[i * 2 + 1] = pt.y;
        }
        return table;
      }
    } catch {
      // Fallback to analytical Bezier below
    }
  }

  // Analytical cubic Bézier fallback
  const segments = pathD === PATH_1 ? BEZIER_SEGMENTS_1 : BEZIER_SEGMENTS_2;
  for (let i = 0; i < TABLE_SIZE; i++) {
    const t = (i / TABLE_SIZE) * segments.length;
    const segIdx = Math.min(Math.floor(t), segments.length - 1);
    const u = t - segIdx;
    const seg = segments[segIdx];
    const u1 = 1 - u;
    const x =
      u1 * u1 * u1 * seg.p0[0] +
      3 * u1 * u1 * u * seg.p1[0] +
      3 * u1 * u * u * seg.p2[0] +
      u * u * u * seg.p3[0];
    const y =
      u1 * u1 * u1 * seg.p0[1] +
      3 * u1 * u1 * u * seg.p1[1] +
      3 * u1 * u * u * seg.p2[1] +
      u * u * u * seg.p3[1];
    table[i * 2] = x;
    table[i * 2 + 1] = y;
  }
  return table;
}

function getTable1(): Float32Array {
  if (!cachedTable1) cachedTable1 = buildPointTable(PATH_1);
  return cachedTable1;
}

function getTable2(): Float32Array {
  if (!cachedTable2) cachedTable2 = buildPointTable(PATH_2);
  return cachedTable2;
}

const getContinuousTime = () => {
  return typeof performance !== "undefined" ? performance.now() / 1000 : 0;
};

export function CosmicLoader({
  className,
  size = 42,
}: CosmicLoaderProps) {
  const filterId = "cosmic-glow-filter";

  const circles1Ref = useRef<(SVGCircleElement | null)[]>([]);
  const circles2Ref = useRef<(SVGCircleElement | null)[]>([]);

  const table1 = getTable1();
  const table2 = getTable2();

  // Evaluate initial frame at current real time so there is zero position snap on mount
  const currentT = getContinuousTime();

  useEffect(() => {
    let animId: number;

    const render = (timestamp: number) => {
      const t = timestamp / 1000;

      // Stream 1 (10 circles)
      for (let i = 0; i < STREAM_1_PARTICLES.length; i++) {
        const el = circles1Ref.current[i];
        if (!el) continue;
        const progress = ((t + STREAM_1_PARTICLES[i].offset) % DUR_1) / DUR_1;
        const floatIdx = progress * TABLE_SIZE;
        const i0 = Math.floor(floatIdx);
        const i1 = (i0 + 1) % TABLE_SIZE;
        const frac = floatIdx - i0;
        const x = table1[i0 * 2] * (1 - frac) + table1[i1 * 2] * frac;
        const y = table1[i0 * 2 + 1] * (1 - frac) + table1[i1 * 2 + 1] * frac;
        el.setAttribute("cx", x.toFixed(2));
        el.setAttribute("cy", y.toFixed(2));
      }

      // Stream 2 (5 circles)
      for (let i = 0; i < STREAM_2_PARTICLES.length; i++) {
        const el = circles2Ref.current[i];
        if (!el) continue;
        const progress = ((t + STREAM_2_PARTICLES[i].offset) % DUR_2) / DUR_2;
        const floatIdx = progress * TABLE_SIZE;
        const i0 = Math.floor(floatIdx);
        const i1 = (i0 + 1) % TABLE_SIZE;
        const frac = floatIdx - i0;
        const x = table2[i0 * 2] * (1 - frac) + table2[i1 * 2] * frac;
        const y = table2[i0 * 2 + 1] * (1 - frac) + table2[i1 * 2 + 1] * frac;
        el.setAttribute("cx", x.toFixed(2));
        el.setAttribute("cy", y.toFixed(2));
      }

      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);
    return () => {
      cancelAnimationFrame(animId);
    };
  }, [table1, table2]);

  return (
    <div
      role="status"
      aria-label="Thinking"
      className={cn("inline-flex items-center justify-center select-none py-1", className)}
      style={{ contain: "layout paint" }}
    >
      <svg
        width={size}
        height={size}
        viewBox="-5 -5 40 40"
        xmlns="http://www.w3.org/2000/svg"
        className="overflow-visible"
        preserveAspectRatio="xMidYMid meet"
      >
        <defs>
          <filter id={filterId} x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="0.8" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Forward Stream (10 particles) */}
        {STREAM_1_PARTICLES.map((p, idx) => {
          const progress = ((currentT + p.offset) % DUR_1) / DUR_1;
          const floatIdx = progress * TABLE_SIZE;
          const i0 = Math.floor(floatIdx);
          const i1 = (i0 + 1) % TABLE_SIZE;
          const frac = floatIdx - i0;
          const initX = table1[i0 * 2] * (1 - frac) + table1[i1 * 2] * frac;
          const initY = table1[i0 * 2 + 1] * (1 - frac) + table1[i1 * 2 + 1] * frac;
          return (
            <circle
              key={`s1-${idx}`}
              ref={(el) => {
                circles1Ref.current[idx] = el;
              }}
              cx={initX.toFixed(2)}
              cy={initY.toFixed(2)}
              fill={p.fill}
              r={p.r}
              filter={`url(#${filterId})`}
            />
          );
        })}

        {/* Counter Stream (5 particles) */}
        {STREAM_2_PARTICLES.map((p, idx) => {
          const progress = ((currentT + p.offset) % DUR_2) / DUR_2;
          const floatIdx = progress * TABLE_SIZE;
          const i0 = Math.floor(floatIdx);
          const i1 = (i0 + 1) % TABLE_SIZE;
          const frac = floatIdx - i0;
          const initX = table2[i0 * 2] * (1 - frac) + table2[i1 * 2] * frac;
          const initY = table2[i0 * 2 + 1] * (1 - frac) + table2[i1 * 2 + 1] * frac;
          return (
            <circle
              key={`s2-${idx}`}
              ref={(el) => {
                circles2Ref.current[idx] = el;
              }}
              cx={initX.toFixed(2)}
              cy={initY.toFixed(2)}
              fill={p.fill}
              r={p.r}
              filter={`url(#${filterId})`}
            />
          );
        })}
      </svg>
    </div>
  );
}

export function ThinkingIndicator({
  className,
  size,
}: CosmicLoaderProps) {
  return <CosmicLoader className={className} size={size} />;
}

export default ThinkingIndicator;