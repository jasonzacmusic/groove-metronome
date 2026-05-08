import { useCallback, useEffect, useRef, useState } from "react";

import { clamp, getTempoMarking } from "@/lib/utils";

interface BPMDialProps {
  bpm: number;
  onChange: (bpm: number) => void;
  isPlaying: boolean;
  currentBeat: number;
  beatsPerBar: number;
  min?: number;
  max?: number;
}

/**
 * Circular tempo dial inspired by Pro Metronome's main wheel.
 * Drag around the ring to set BPM; tick marks pulse on each beat.
 * Designed for thumb-friendly use on phones.
 */
export function BPMDial({ bpm, onChange, isPlaying, currentBeat, beatsPerBar, min = 20, max = 300 }: BPMDialProps) {
  const ringRef = useRef<SVGSVGElement | null>(null);
  const draggingRef = useRef(false);
  const lastAngleRef = useRef<number | null>(null);
  const [pulse, setPulse] = useState(0);

  // Pulse the outer ring on each beat for visual feedback
  useEffect(() => {
    if (currentBeat < 0) return;
    setPulse((p) => p + 1);
  }, [currentBeat]);

  const angleOf = (e: PointerEvent | React.PointerEvent): number => {
    const rect = ringRef.current!.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const dx = e.clientX - cx;
    const dy = e.clientY - cy;
    return Math.atan2(dy, dx);
  };

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    (e.target as Element).setPointerCapture?.(e.pointerId);
    draggingRef.current = true;
    lastAngleRef.current = angleOf(e);
  }, []);

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!draggingRef.current || lastAngleRef.current == null) return;
      const a = angleOf(e);
      let delta = a - lastAngleRef.current;
      if (delta > Math.PI) delta -= 2 * Math.PI;
      if (delta < -Math.PI) delta += 2 * Math.PI;
      lastAngleRef.current = a;
      // ~120 BPM per full rotation -> sensitive enough for fine tuning
      const bpmDelta = (delta / (2 * Math.PI)) * 120;
      onChange(clamp(Math.round((bpm + bpmDelta) * 10) / 10, min, max));
    },
    [bpm, max, min, onChange],
  );

  const onPointerUp = useCallback(() => {
    draggingRef.current = false;
    lastAngleRef.current = null;
  }, []);

  // Tick marks around the ring; the active beat tick lights up
  const ticks = Array.from({ length: beatsPerBar }, (_, i) => i);

  return (
    <div className="relative mx-auto w-full max-w-[320px] aspect-square select-none">
      <svg
        ref={ringRef}
        viewBox="0 0 200 200"
        className="absolute inset-0 w-full h-full touch-none"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        role="slider"
        aria-label="Tempo"
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuenow={Math.round(bpm)}
      >
        {/* Outer ring */}
        <circle cx="100" cy="100" r="92" fill="none" stroke="hsl(var(--border))" strokeWidth="2" />
        {/* Active progress arc — show portion of BPM range */}
        <circle
          cx="100"
          cy="100"
          r="92"
          fill="none"
          stroke="hsl(var(--primary))"
          strokeWidth="3"
          strokeLinecap="round"
          strokeDasharray={`${(2 * Math.PI * 92 * (bpm - min)) / (max - min)} 9999`}
          transform="rotate(-90 100 100)"
          opacity="0.7"
        />
        {/* Beat ticks */}
        {ticks.map((i) => {
          const angle = (-Math.PI / 2) + (i / beatsPerBar) * 2 * Math.PI;
          const x1 = 100 + Math.cos(angle) * 78;
          const y1 = 100 + Math.sin(angle) * 78;
          const x2 = 100 + Math.cos(angle) * 86;
          const y2 = 100 + Math.sin(angle) * 86;
          const isActive = isPlaying && currentBeat === i;
          const isOne = i === 0;
          return (
            <line
              key={i}
              x1={x1}
              y1={y1}
              x2={x2}
              y2={y2}
              stroke={isActive ? "hsl(var(--primary))" : isOne ? "hsl(var(--primary) / 0.5)" : "hsl(var(--muted-foreground) / 0.5)"}
              strokeWidth={isActive ? 4 : isOne ? 3 : 2}
              strokeLinecap="round"
            />
          );
        })}
        {/* Inner well */}
        <circle cx="100" cy="100" r="74" fill="hsl(var(--card))" />
      </svg>
      {/* Center readout */}
      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
        <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground font-mono">
          {getTempoMarking(bpm)}
        </div>
        <div
          key={pulse}
          className={`font-mono tabular-nums text-7xl font-bold leading-none ${
            isPlaying ? "text-primary" : "text-foreground"
          } transition-transform`}
        >
          {Math.round(bpm)}
        </div>
        <div className="text-[10px] uppercase tracking-widest text-muted-foreground mt-1 font-mono">BPM</div>
      </div>
    </div>
  );
}
