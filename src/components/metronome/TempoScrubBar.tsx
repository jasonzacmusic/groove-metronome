import { useRef } from "react";

import { clamp, cn } from "@/lib/utils";

interface TempoScrubBarProps {
  bpm: number;
  onSetBpm: (bpm: number) => void;
  disabled?: boolean;
  compact?: boolean;
}

function playScrubTick(direction: number, amount: number) {
  if (typeof window === "undefined") return;
  const AudioContextClass = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioContextClass) return;

  const context = new AudioContextClass();
  const now = context.currentTime;
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  const lift = clamp(amount, 1, 8);
  oscillator.type = "sine";
  oscillator.frequency.value = direction >= 0 ? 540 + lift * 34 : 360 - lift * 12;
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(0.024, now + 0.008);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.055);
  oscillator.connect(gain);
  gain.connect(context.destination);
  oscillator.start(now);
  oscillator.stop(now + 0.06);
  window.setTimeout(() => void context.close().catch(() => undefined), 90);
}

export function TempoScrubBar({ bpm, onSetBpm, disabled = false, compact = false }: TempoScrubBarProps) {
  const dragRef = useRef<{ pointerId: number; startX: number; startBpm: number; lastBpm: number } | null>(null);
  const lastTickAtRef = useRef(0);

  const setTempoWithCue = (nextBpm: number, direction: number, amount: number) => {
    const safe = clamp(Math.round(nextBpm), 20, 300);
    if (safe === Math.round(bpm)) return;
    onSetBpm(safe);
    const now = performance.now();
    if (now - lastTickAtRef.current > 55) {
      lastTickAtRef.current = now;
      playScrubTick(direction, amount);
    }
  };

  return (
    <div
      className={cn(
        "group relative select-none touch-none rounded-lg border border-border/70 bg-background/35",
        disabled ? "opacity-40" : "cursor-ew-resize hover:border-primary/55",
        compact ? "p-2" : "p-3",
      )}
      role="slider"
      aria-label="Slide tempo"
      aria-valuemin={20}
      aria-valuemax={300}
      aria-valuenow={Math.round(bpm)}
      tabIndex={disabled ? -1 : 0}
      onPointerDown={(event) => {
        if (disabled) return;
        event.preventDefault();
        event.currentTarget.setPointerCapture(event.pointerId);
        dragRef.current = {
          pointerId: event.pointerId,
          startX: event.clientX,
          startBpm: bpm,
          lastBpm: bpm,
        };
      }}
      onPointerMove={(event) => {
        const drag = dragRef.current;
        if (!drag || drag.pointerId !== event.pointerId || disabled) return;
        event.preventDefault();
        const delta = event.clientX - drag.startX;
        if (Math.abs(delta) < 3) return;
        const next = drag.startBpm + delta / 4;
        const rounded = clamp(Math.round(next), 20, 300);
        if (rounded === Math.round(drag.lastBpm)) return;
        setTempoWithCue(rounded, rounded > drag.lastBpm ? 1 : -1, Math.abs(rounded - drag.lastBpm));
        drag.lastBpm = rounded;
      }}
      onPointerUp={(event) => {
        if (dragRef.current?.pointerId === event.pointerId) dragRef.current = null;
      }}
      onPointerCancel={() => {
        dragRef.current = null;
      }}
      onWheel={(event) => {
        if (disabled) return;
        event.preventDefault();
        const rawDelta = Math.abs(event.deltaX) > Math.abs(event.deltaY) ? -event.deltaX : -event.deltaY;
        if (Math.abs(rawDelta) < 1) return;
        const amount = clamp(Math.round(Math.abs(rawDelta) / 18), 1, 5);
        setTempoWithCue(bpm + Math.sign(rawDelta) * amount, Math.sign(rawDelta), amount);
      }}
      onKeyDown={(event) => {
        if (disabled) return;
        if (event.key === "ArrowLeft" || event.key === "ArrowDown") {
          event.preventDefault();
          setTempoWithCue(bpm - 1, -1, 1);
        }
        if (event.key === "ArrowRight" || event.key === "ArrowUp") {
          event.preventDefault();
          setTempoWithCue(bpm + 1, 1, 1);
        }
      }}
      onDoubleClick={() => {
        if (!disabled) setTempoWithCue(100, 100 >= bpm ? 1 : -1, Math.abs(100 - bpm));
      }}
      title="Slide to adjust tempo. Trackpad scroll also works. Double-click to reset to 100 BPM."
    >
      <div className="flex items-center justify-between gap-3">
        <span className="tiny-caps text-[9px] text-muted-foreground">Slide tempo</span>
        <span className="font-mono text-xs text-primary">{Math.round(bpm)} BPM</span>
      </div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-primary/15">
        <div
          className="h-full rounded-full bg-primary transition-[width]"
          style={{ width: `${((clamp(bpm, 20, 300) - 20) / 280) * 100}%` }}
        />
      </div>
      {!compact && <div className="mt-2 text-center font-mono text-[10px] text-muted-foreground">drag left/right · scroll trackpad · double-click 100</div>}
    </div>
  );
}
