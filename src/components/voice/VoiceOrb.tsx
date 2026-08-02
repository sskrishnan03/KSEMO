import { useEffect, useRef } from 'react';
import { cn } from '../../lib/utils';

interface VoiceOrbProps {
  state: 'idle' | 'listening' | 'thinking' | 'speaking' | 'interrupted' | 'error' | 'reconnecting';
  voiceLevel: number;
  className?: string;
}

export function VoiceOrb({ state, voiceLevel, className }: VoiceOrbProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>();
  const timeRef = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const render = () => {
      timeRef.current += 1;
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;

      // Resize canvas dynamically
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
      }

      ctx.clearRect(0, 0, w, h);

      // Base radius
      let baseRadius = Math.min(w, h) * 0.35;
      if (baseRadius < 100) baseRadius = 100;

      // Color based on state
      let color = '#000000';
      let glowColor = 'rgba(0, 0, 0, 0.1)';
      let intensity = 0;

      switch (state) {
        case 'listening':
          color = '#000000';
          glowColor = 'rgba(0, 0, 0, 0.15)';
          intensity = voiceLevel;
          break;
        case 'thinking':
          color = '#1a1a1a';
          glowColor = 'rgba(0, 0, 0, 0.1)';
          intensity = 0.1 + Math.abs(Math.sin(timeRef.current * 0.05)) * 0.1;
          break;
        case 'speaking':
          color = '#000000';
          glowColor = 'rgba(0, 0, 0, 0.2)';
          intensity = 0.3 + Math.abs(Math.sin(timeRef.current * 0.1)) * 0.4;
          break;
        case 'interrupted':
          color = '#2a1a1a';
          glowColor = 'rgba(255, 0, 0, 0.1)';
          intensity = 0.2;
          break;
        case 'error':
          color = '#2a1a1a';
          glowColor = 'rgba(255, 0, 0, 0.15)';
          intensity = 0.15;
          break;
        case 'reconnecting':
          color = '#2a2a1a';
          glowColor = 'rgba(255, 200, 0, 0.15)';
          intensity = 0.2 + Math.abs(Math.sin(timeRef.current * 0.15)) * 0.1;
          break;
        default:
          color = '#000000';
          glowColor = 'rgba(0, 0, 0, 0.05)';
          intensity = 0.05;
      }

      // Draw glow
      const gradient = ctx.createRadialGradient(w / 2, h / 2, baseRadius * 0.5, w / 2, h / 2, baseRadius * 1.5);
      gradient.addColorStop(0, glowColor);
      gradient.addColorStop(1, 'transparent');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, w, h);

      // Draw wobbly organic circle
      const numPoints = 120;
      ctx.beginPath();

      for (let i = 0; i <= numPoints; i++) {
        const theta = (i / numPoints) * Math.PI * 2;

        // Multi-frequency wave layers for liquid organic wobble
        const w1 = Math.sin(theta * 4 + timeRef.current * 0.04) * 3;
        const w2 = Math.cos(theta * 7 - timeRef.current * 0.1) * (2 + intensity * 25);
        const w3 = Math.sin(theta * 13 + timeRef.current * 0.07) * (1 + intensity * 12);

        const r = baseRadius + w1 + w2 + w3;
        const x = w / 2 + Math.cos(theta) * r;
        const y = h / 2 + Math.sin(theta) * r;

        if (i === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      }

      ctx.closePath();
      ctx.fillStyle = color;
      ctx.fill();

      // Draw inner ring for speaking state
      if (state === 'speaking') {
        ctx.beginPath();
        ctx.arc(w / 2, h / 2, baseRadius * 0.6, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
        ctx.lineWidth = 2;
        ctx.stroke();
      }

      animationRef.current = requestAnimationFrame(render);
    };

    render();

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [state, voiceLevel]);

  return (
    <canvas
      ref={canvasRef}
      className={cn('w-full h-full', className)}
      style={{ width: '100%', height: '100%' }}
    />
  );
}
