import { useEffect, useRef, useState, type PointerEvent } from "react";

import { clamp, cn } from "@/lib/utils";

interface TempoScrubBarProps {
  bpm: number;
  onSetBpm: (bpm: number) => void;
  disabled?: boolean;
  compact?: boolean;
}

let scrubAudioContext: AudioContext | null = null;

function getScrubAudioContext() {
  if (typeof window === "undefined") return;
  const AudioContextClass = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioContextClass) return;
  if (!scrubAudioContext || scrubAudioContext.state === "closed") {
    scrubAudioContext = new AudioContextClass();
  }
  if (scrubAudioContext.state === "suspended") {
    void scrubAudioContext.resume().catch(() => undefined);
  }
  return scrubAudioContext;
}

function playScrubTick(direction: number, amount: number) {
  const context = getScrubAudioContext();
  if (!context) return;
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
}

function isTouchTempoDevice() {
  if (typeof navigator === "undefined" || typeof window === "undefined") return false;
  const coarsePointer = window.matchMedia?.("(pointer: coarse)").matches ?? false;
  const touchPoints = navigator.maxTouchPoints > 0;
  const mobileLike = /iPad|iPhone|iPod|Android/i.test(navigator.userAgent);
  const desktopModeIpad = /\bMacintosh\b/.test(navigator.userAgent) && navigator.maxTouchPoints > 1;
  return coarsePointer || touchPoints || mobileLike || desktopModeIpad;
}

export function TempoScrubBar({ bpm, onSetBpm, disabled = false, compact = false }: TempoScrubBarProps) {
  const dragRef = useRef<{ pointerId: number; startX: number; startBpm: number; lastBpm: number } | null>(null);
  const lastTickAtRef = useRef(0);
  const lastTouchAtRef = useRef(0);
  const [touchScrubAvailable, setTouchScrubAvailable] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const updateAvailability = () => {
      setTouchScrubAvailable(isTouchTempoDevice());
    };
    updateAvailability();
    const media = window.matchMedia?.("(pointer: coarse)");
    media?.addEventListener?.("change", updateAvailability);
    return () => media?.removeEventListener?.("change", updateAvailability);
  }, []);

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

  const canTouchScrub = !disabled && touchScrubAvailable;
  const canUsePointer = (event: PointerEvent<HTMLElement>) =>
    canTouchScrub && (event.pointerType === "touch" || event.pointerType === "pen");

  return (
    <div
      className={cn(
        "group relative select-none touch-none rounded-lg border border-border/70 bg-background/35",
        disabled ? "opacity-40" : canTouchScrub ? "cursor-ew-resize hover:border-primary/55" : "cursor-default",
        compact ? "p-2" : "p-3",
      )}
      role="slider"
      aria-label="Slide tempo"
      aria-valuemin={20}
      aria-valuemax={300}
      aria-valuenow={Math.round(bpm)}
      aria-disabled={!canTouchScrub}
      tabIndex={-1}
      onPointerDown={(event) => {
        if (!canUsePointer(event)) return;
        event.preventDefault();
        lastTouchAtRef.current = performance.now();
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
        if (!drag || drag.pointerId !== event.pointerId || !canUsePointer(event)) return;
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
        if (canTouchScrub) return;
        event.stopPropagation();
      }}
      onKeyDown={(event) => {
        if (!canTouchScrub) return;
        event.preventDefault();
      }}
      onDoubleClick={() => {
        if (canTouchScrub && performance.now() - lastTouchAtRef.current < 700) {
          setTempoWithCue(100, 100 >= bpm ? 1 : -1, Math.abs(100 - bpm));
        }
      }}
      title={canTouchScrub ? "Slide with a finger to adjust tempo." : "Touch scrub is available on phone and iPad only."}
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
      {!compact && (
        <div className="mt-2 text-center font-mono text-[10px] text-muted-foreground">
          {canTouchScrub ? "finger slide · double-tap 100" : "phone/iPad touch scrub only"}
        </div>
      )}
    </div>
  );
}
