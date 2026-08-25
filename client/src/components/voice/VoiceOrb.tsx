import { type VoiceSessionState } from "@/hooks/useVoiceSession";
import { useEffect, useRef, useCallback } from "react";

const RED_PRIMARY = [229, 9, 20] as const;
const RED_DEEP = [127, 29, 29] as const;
const BLACK = [0, 0, 0] as const;

export function VoiceOrb({
  state,
  levelRef,
  freqDataRef,
}: {
  state: VoiceSessionState;
  levelRef: React.RefObject<number>;
  freqDataRef: React.RefObject<Uint8Array>;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef<VoiceSessionState>(state);
  const smoothLevelRef = useRef(0);
  const energyRef = useRef(0);
  const prevTimeRef = useRef(0);
  const frameRef = useRef<number>(0);
  const breathPhaseRef = useRef(0);
  const rotationRef = useRef(0);
  const ripplePhasesRef = useRef([0, 0, 0, 0]);
  const internalWavesRef = useRef(
    Array.from({ length: 6 }, () => ({
      phase: Math.random() * Math.PI * 2,
      speed: 0.3 + Math.random() * 0.5,
      amplitude: 0,
      targetAmplitude: 0,
    })),
  );

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

  const draw = useCallback(
    (time: number) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      const dpr = window.devicePixelRatio || 1;
      const size = canvas.clientWidth;
      if (canvas.width !== size * dpr || canvas.height !== size * dpr) {
        canvas.width = size * dpr;
        canvas.height = size * dpr;
        ctx.scale(dpr, dpr);
      }

      const dt = prevTimeRef.current
        ? Math.min((time - prevTimeRef.current) / 1000, 0.05)
        : 0.016;
      prevTimeRef.current = time;

      const cx = size / 2;
      const cy = size / 2;
      const baseRadius = size * 0.42;

      const rawLevel = levelRef.current ?? 0;
      smoothLevelRef.current += (rawLevel - smoothLevelRef.current) * 0.15;
      const level = smoothLevelRef.current;

      const currentState = stateRef.current;
      let targetEnergy = 0;
      switch (currentState) {
        case "listening":
          targetEnergy = 0.3 + level * 0.5;
          break;
        case "processing":
          targetEnergy = 0.55 + Math.sin(time * 0.003) * 0.1;
          break;
        case "speaking":
          targetEnergy = 0.4 + level * 0.6;
          break;
        default:
          targetEnergy = 0;
      }
      energyRef.current += (targetEnergy - energyRef.current) * dt * 3;

      const energy = energyRef.current;
      breathPhaseRef.current += dt * (0.6 + energy * 1.2);
      rotationRef.current += dt * (0.15 + energy * 0.4);

      ctx.clearRect(0, 0, size, size);

      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, cy, baseRadius, 0, Math.PI * 2);
      ctx.clip();

      const orbGrad = ctx.createRadialGradient(
        cx - baseRadius * 0.15,
        cy - baseRadius * 0.15,
        0,
        cx,
        cy,
        baseRadius,
      );
      const orbR = Math.round(lerp(BLACK[0], RED_DEEP[0], energy * 0.5));
      const orbG = Math.round(lerp(BLACK[1], RED_DEEP[1], energy * 0.5));
      const orbB = Math.round(lerp(BLACK[2], RED_DEEP[2], energy * 0.5));
      orbGrad.addColorStop(0, `rgb(${orbR + 12}, ${orbG + 4}, ${orbB + 4})`);
      orbGrad.addColorStop(0.6, `rgb(${orbR}, ${orbG}, ${orbB})`);
      orbGrad.addColorStop(
        1,
        `rgb(${Math.round(orbR * 0.4)}, ${Math.round(orbG * 0.4)}, ${Math.round(orbB * 0.4)})`,
      );

      ctx.beginPath();
      ctx.arc(cx, cy, baseRadius, 0, Math.PI * 2);
      ctx.fillStyle = orbGrad;
      ctx.fill();

      const ambientGlow =
        0.08 + energy * 0.2 + Math.sin(breathPhaseRef.current) * 0.03;
      const ambientGrad = ctx.createRadialGradient(
        cx,
        cy,
        baseRadius * 0.3,
        cx,
        cy,
        baseRadius,
      );
      ambientGrad.addColorStop(
        0,
        `rgba(${RED_DEEP[0]}, ${RED_DEEP[1]}, ${RED_DEEP[2]}, ${ambientGlow * 0.5})`,
      );
      ambientGrad.addColorStop(
        0.6,
        `rgba(${RED_PRIMARY[0]}, ${RED_PRIMARY[1]}, ${RED_PRIMARY[2]}, ${ambientGlow * 0.2})`,
      );
      ambientGrad.addColorStop(1, `rgba(0, 0, 0, 0)`);
      ctx.fillStyle = ambientGrad;
      ctx.fillRect(0, 0, size, size);

      if (currentState === "listening" || currentState === "speaking") {
        for (let i = 0; i < ripplePhasesRef.current.length; i++) {
          ripplePhasesRef.current[i] += dt * (1.5 + energy * 2 + i * 0.3);
          const rp = ripplePhasesRef.current[i];
          const progress = (rp % (Math.PI * 2)) / (Math.PI * 2);
          const rippleRadius = baseRadius * (0.5 + progress * 0.5);
          const rippleOpacity =
            (1 - progress) * energy * 0.2 * (i === 0 ? 1 : 0.6);
          ctx.beginPath();
          ctx.arc(cx, cy, rippleRadius, 0, Math.PI * 2);
          ctx.strokeStyle = `rgba(${RED_PRIMARY[0]}, ${RED_PRIMARY[1]}, ${RED_PRIMARY[2]}, ${rippleOpacity})`;
          ctx.lineWidth = 2 - progress * 1.5;
          ctx.stroke();
        }
      }

      if (energy > 0.01) {
        const freq = freqDataRef.current;
        const freqLen = freq?.length ?? 0;

        internalWavesRef.current.forEach((wave, i) => {
          wave.targetAmplitude =
            energy * (0.3 + ((freq?.[i * 8] ?? 0) / 255) * 0.7);
          wave.amplitude +=
            (wave.targetAmplitude - wave.amplitude) * dt * 4;
          wave.phase += dt * wave.speed * (1 + energy);
        });

        internalWavesRef.current.forEach((wave, i) => {
          if (wave.amplitude < 0.005) return;
          ctx.beginPath();
          const segments = 120;
          for (let s = 0; s <= segments; s++) {
            const angle = (s / segments) * Math.PI * 2;
            const freqIndex = Math.floor(
              (s / segments) * Math.min(freqLen, 32),
            );
            const freqMod = freq
              ? 1 + (freq[freqIndex] / 255) * 0.3 * energy
              : 1;
            const waveR =
              baseRadius *
              (0.35 + i * 0.1) *
              (1 +
                Math.sin(angle * (2 + i) + wave.phase) *
                  wave.amplitude *
                  0.5) *
              freqMod;
            const x =
              cx +
              Math.cos(angle + rotationRef.current * (0.3 + i * 0.1)) *
                waveR;
            const y =
              cy +
              Math.sin(angle + rotationRef.current * (0.3 + i * 0.1)) *
                waveR;
            if (s === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
          }
          ctx.closePath();
          const waveAlpha = wave.amplitude * 0.4;
          ctx.strokeStyle = `rgba(${RED_PRIMARY[0]}, ${RED_PRIMARY[1]}, ${RED_PRIMARY[2]}, ${waveAlpha})`;
          ctx.lineWidth = 1 + wave.amplitude * 2;
          ctx.stroke();
        });
      }

      if (energy > 0.02) {
        const freq = freqDataRef.current;
        const freqLen = freq?.length ?? 0;
        const barCount = Math.min(48, freqLen);
        const barAngleStep = (Math.PI * 2) / barCount;
        for (let i = 0; i < barCount; i++) {
          const value = freq ? freq[i] / 255 : 0;
          const barHeight = value * energy * baseRadius * 0.3;
          if (barHeight < 1) continue;
          const angle = i * barAngleStep + rotationRef.current * 0.2;
          const innerR = baseRadius - 2;
          const x1 = cx + Math.cos(angle) * innerR;
          const y1 = cy + Math.sin(angle) * innerR;
          const x2 = cx + Math.cos(angle) * (innerR - barHeight);
          const y2 = cy + Math.sin(angle) * (innerR - barHeight);
          ctx.beginPath();
          ctx.moveTo(x1, y1);
          ctx.lineTo(x2, y2);
          ctx.strokeStyle = `rgba(${RED_PRIMARY[0]}, ${RED_PRIMARY[1]}, ${RED_PRIMARY[2]}, ${0.15 + value * 0.4})`;
          ctx.lineWidth = 2;
          ctx.stroke();
        }
      }

      if (currentState === "processing") {
        const particleCount = Math.floor(6 + energy * 10);
        for (let i = 0; i < particleCount; i++) {
          const angle =
            (i / particleCount) * Math.PI * 2 +
            time * 0.001 * (0.5 + (i % 3) * 0.3);
          const dist =
            baseRadius *
            (0.5 + Math.sin(time * 0.003 + i * 1.7) * 0.3);
          const px = cx + Math.cos(angle) * dist;
          const py = cy + Math.sin(angle) * dist;
          const s = 1.5 + energy * 2;
          const opacity = 0.2 + Math.sin(time * 0.005 + i) * 0.1;
          ctx.beginPath();
          ctx.arc(px, py, s, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(${RED_PRIMARY[0]}, ${RED_PRIMARY[1]}, ${RED_PRIMARY[2]}, ${opacity * energy})`;
          ctx.fill();
        }
      }

      const innerHighlight = energy * 0.1;
      if (innerHighlight > 0.005) {
        const hlGrad = ctx.createRadialGradient(
          cx - baseRadius * 0.2,
          cy - baseRadius * 0.25,
          0,
          cx,
          cy,
          baseRadius * 0.7,
        );
        hlGrad.addColorStop(0, `rgba(255, 255, 255, ${innerHighlight})`);
        hlGrad.addColorStop(1, `rgba(255, 255, 255, 0)`);
        ctx.beginPath();
        ctx.arc(cx, cy, baseRadius, 0, Math.PI * 2);
        ctx.fillStyle = hlGrad;
        ctx.fill();
      }

      ctx.restore();

      const edgeGlow = 0.06 + energy * 0.15;
      ctx.beginPath();
      ctx.arc(cx, cy, baseRadius, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(40, 40, 40, ${edgeGlow})`;
      ctx.lineWidth = 1.5;
      ctx.stroke();

      if (energy > 0.05) {
        const glowSize = 8 + energy * 15;
        ctx.beginPath();
        ctx.arc(cx, cy, baseRadius + glowSize / 2, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(${RED_PRIMARY[0]}, ${RED_PRIMARY[1]}, ${RED_PRIMARY[2]}, ${energy * 0.06})`;
        ctx.lineWidth = glowSize;
        ctx.stroke();
      }

      frameRef.current = requestAnimationFrame(draw);
    },
    [levelRef, freqDataRef, lerp],
  );

  useEffect(() => {
    frameRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(frameRef.current);
  }, [draw]);

  return (
    <div
      className="grid size-[min(38vw,12rem)] place-items-center overflow-hidden rounded-full bg-black sm:size-[min(30vw,13.5rem)]"
      role="img"
      aria-label={
        state === "idle" ? "KSEMO microphone muted" : `KSEMO is ${state}`
      }
    >
      <canvas
        ref={canvasRef}
        className="h-full w-full"
      />
    </div>
  );
}
