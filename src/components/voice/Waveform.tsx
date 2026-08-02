import { useEffect, useRef } from 'react';
import { cn } from '../../lib/utils';

interface WaveformProps {
  audioData: Uint8Array;
  state: 'idle' | 'listening' | 'thinking' | 'speaking' | 'interrupted' | 'error' | 'reconnecting';
  className?: string;
}

export function Waveform({ audioData, state, className }: WaveformProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const render = () => {
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;

      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
      }

      ctx.clearRect(0, 0, w, h);

      if (state === 'idle' || audioData.length === 0) {
        // Draw flat line
        ctx.beginPath();
        ctx.moveTo(0, h / 2);
        ctx.lineTo(w, h / 2);
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
        ctx.lineWidth = 2;
        ctx.stroke();
        animationRef.current = requestAnimationFrame(render);
        return;
      }

      // Draw waveform
      const barCount = 64;
      const barWidth = w / barCount;
      const step = Math.floor(audioData.length / barCount);

      ctx.fillStyle = state === 'speaking' ? 'rgba(255, 255, 255, 0.8)' : 'rgba(255, 255, 255, 0.5)';

      for (let i = 0; i < barCount; i++) {
        const value = audioData[i * step] || 0;
        const barHeight = (value / 255) * h * 0.8;
        const x = i * barWidth;
        const y = (h - barHeight) / 2;

        // Rounded bars
        const radius = barWidth / 2;
        ctx.beginPath();
        ctx.roundRect(x + 1, y, barWidth - 2, barHeight, radius);
        ctx.fill();
      }

      animationRef.current = requestAnimationFrame(render);
    };

    render();

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [audioData, state]);

  return (
    <canvas
      ref={canvasRef}
      className={cn('w-full h-full', className)}
      style={{ width: '100%', height: '100%' }}
    />
  );
}
