import { useEffect, useRef, useState } from "react";

interface WaveformProps {
  audioLevel: number; // 0-1 normalized audio level
  active: boolean;
}

const BAR_COUNT = 60;

export function Waveform({ audioLevel, active }: WaveformProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const animationFrameRef = useRef<number>();
  const [bars, setBars] = useState<number[]>(new Array(BAR_COUNT).fill(0));

  useEffect(() => {
    if (!active) {
      setBars(new Array(BAR_COUNT).fill(0));
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      return;
    }

    const updateWaveform = () => {
      setBars((prevBars) => {
        // Create a new array with the current audio level
        const newBars = [...prevBars];
        // Shift bars to the left
        newBars.shift();
        // Add new bar at the end with some smoothing
        const smoothedLevel = audioLevel * 0.8 + (prevBars[prevBars.length - 1] || 0) * 0.2;
        newBars.push(smoothedLevel);
        return newBars;
      });

      animationFrameRef.current = requestAnimationFrame(updateWaveform);
    };

    animationFrameRef.current = requestAnimationFrame(updateWaveform);

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [audioLevel, active]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Set canvas size to match container
    const container = containerRef.current;
    if (container) {
      const rect = container.getBoundingClientRect();
      canvas.width = rect.width * window.devicePixelRatio;
      canvas.height = rect.height * window.devicePixelRatio;
      ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
    }

    const width = container?.clientWidth || 800;
    const height = container?.clientHeight || 64;
    const barCount = bars.length;
    const barWidth = width / barCount;

    ctx.clearRect(0, 0, width, height);

    bars.forEach((bar, index) => {
      const barHeight = Math.max(2, bar * height * 0.9); // Use 90% of height max, min 2px
      const x = index * barWidth;
      const y = (height - barHeight) / 2;

      // Create gradient for visual appeal
      const gradient = ctx.createLinearGradient(0, 0, 0, height);
      const intensity = Math.min(1, bar * 1.5);
      gradient.addColorStop(0, `rgba(59, 130, 246, ${intensity})`); // blue-500
      gradient.addColorStop(0.5, `rgba(139, 92, 246, ${intensity})`); // violet-500
      gradient.addColorStop(1, `rgba(236, 72, 153, ${intensity})`); // pink-500

      ctx.fillStyle = gradient;
      ctx.fillRect(x, y, Math.max(1, barWidth - 2), barHeight);
    });
  }, [bars]);

  return (
    <div ref={containerRef} className="h-16 w-full rounded-lg border border-slate-800 bg-slate-900/30">
      <canvas ref={canvasRef} className="h-full w-full" />
    </div>
  );
}

