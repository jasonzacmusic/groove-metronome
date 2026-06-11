import { useEffect, useRef, useState, type PointerEvent } from "react";

import { beginTempoScrubHaptics, endTempoScrubHaptics, triggerTempoScrubHaptic } from "@/lib/haptics";
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
  const capacitorNative = Boolean((window as typeof window & { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor?.isNativePlatform?.());
  const coarsePointer = window.matchMedia?.("(pointer: coarse)").matches ?? false;
  const touchPoints = navigator.maxTouchPoints > 0;
  const mobileLike = /iPad|iPhone|iPod|Android/i.test(navigator.userAgent);
  const desktopModeIpad = /\bMacintosh\b/.test(navigator.userAgent) && navigator.maxTouchPoints > 1;
  return capacitorNative || coarsePointer || touchPoints || mobileLike || desktopModeIpad;
}

export function TempoScrubBar({ bpm, onSetBpm, disabled = false, compact = false }: TempoScrubBarProps) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<{ pointerId: number; startX: number; lastX: number; lastT: number; bpmFloat: number; lastBpm: number; source: "pointer" | "touch" } | null>(null);
  const unlockScrollRef = useRef<(() => void) | null>(null);
  const bpmRef = useRef(bpm);
  const onSetBpmRef = useRef(onSetBpm);
  const lastTickAtRef = useRef(0);
  const lastHapticAtRef = useRef(0);
  const lastTouchAtRef = useRef(0);
  const [touchScrubAvailable, setTouchScrubAvailable] = useState(false);

  useEffect(() => {
    bpmRef.current = bpm;
  }, [bpm]);

  useEffect(() => {
    onSetBpmRef.current = onSetBpm;
  }, [onSetBpm]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const updateAvailability = () => {
      setTouchScrubAvailable(isTouchTempoDevice());
    };
    updateAvailability();
    const media = window.matchMedia?.("(pointer: coarse)");
    media?.addEventListener?.("change", updateAvailability);
    window.addEventListener("resize", updateAvailability);
    return () => {
      media?.removeEventListener?.("change", updateAvailability);
      window.removeEventListener("resize", updateAvailability);
    };
  }, []);

  const lockMobileScroll = () => {
    if (typeof document === "undefined" || unlockScrollRef.current) return;
    const root = document.documentElement;
    const body = document.body;
    const preventScroll = (event: TouchEvent) => {
      event.preventDefault();
    };
    root.classList.add("tempo-jog-active");
    body.classList.add("tempo-jog-active");
    document.addEventListener("touchmove", preventScroll, { passive: false, capture: true });
    unlockScrollRef.current = () => {
      document.removeEventListener("touchmove", preventScroll, { capture: true });
      root.classList.remove("tempo-jog-active");
      body.classList.remove("tempo-jog-active");
      unlockScrollRef.current = null;
    };
  };

  const beginDrag = (clientX: number, pointerId: number, source: "pointer" | "touch") => {
    if (disabled || !touchScrubAvailable || dragRef.current) return false;
    lastTouchAtRef.current = performance.now();
    lockMobileScroll();
    void beginTempoScrubHaptics();
    dragRef.current = {
      pointerId,
      startX: clientX,
      lastX: clientX,
      lastT: performance.now(),
      bpmFloat: bpmRef.current,
      lastBpm: Math.round(bpmRef.current),
      source,
    };
    return true;
  };

  const setTempoWithCue = (nextBpm: number, direction: number, amount: number) => {
    const safe = clamp(Math.round(nextBpm), 20, 300);
    if (safe === Math.round(bpmRef.current)) return;
    bpmRef.current = safe;
    onSetBpmRef.current(safe);
    const now = performance.now();
    if (now - lastTickAtRef.current > 55) {
      lastTickAtRef.current = now;
      playScrubTick(direction, amount);
    }
    if (now - lastHapticAtRef.current > 90) {
      lastHapticAtRef.current = now;
      void triggerTempoScrubHaptic(amount >= 3 ? "medium" : "light");
    }
  };

  const moveDrag = (clientX: number) => {
    const drag = dragRef.current;
    if (!drag) return;
    if (Math.abs(clientX - drag.startX) < 3 && drag.lastX === drag.startX) return;
    const now = performance.now();
    const dx = clientX - drag.lastX;
    const dt = Math.max(1, now - drag.lastT);
    drag.lastX = clientX;
    drag.lastT = now;
    // Velocity-sensitive gain: slow drags step 1 BPM at a time, fast swipes
    // sweep the range like a real jog wheel.
    const speed = Math.abs(dx) / dt;
    const pxPerBpm = speed > 1.4 ? 1.1 : speed > 0.7 ? 1.9 : 3.4;
    drag.bpmFloat = clamp(drag.bpmFloat + dx / pxPerBpm, 20, 300);
    const rounded = Math.round(drag.bpmFloat);
    if (rounded === Math.round(drag.lastBpm)) return;
    setTempoWithCue(rounded, rounded > drag.lastBpm ? 1 : -1, Math.abs(rounded - drag.lastBpm));
    drag.lastBpm = rounded;
  };

  const endDrag = (pointerId?: number) => {
    if (!dragRef.current) return;
    if (pointerId !== undefined && dragRef.current.pointerId !== pointerId) return;
    dragRef.current = null;
    unlockScrollRef.current?.();
    void endTempoScrubHaptics();
  };

  useEffect(() => {
    const node = rootRef.current;
    if (!node || disabled || !touchScrubAvailable) return;

    const handleTouchStart = (event: TouchEvent) => {
      if (event.touches.length !== 1) return;
      const touch = event.touches[0];
      if (!beginDrag(touch.clientX, touch.identifier, "touch")) return;
      event.preventDefault();
      event.stopPropagation();
    };
    const handleTouchMove = (event: TouchEvent) => {
      const drag = dragRef.current;
      if (!drag || drag.source !== "touch") return;
      const touch = Array.from(event.touches).find((item) => item.identifier === drag.pointerId);
      if (!touch) return;
      event.preventDefault();
      event.stopPropagation();
      moveDrag(touch.clientX);
    };
    const handleTouchEnd = (event: TouchEvent) => {
      const drag = dragRef.current;
      if (!drag || drag.source !== "touch") return;
      const stillActive = Array.from(event.touches).some((item) => item.identifier === drag.pointerId);
      if (!stillActive) endDrag(drag.pointerId);
    };

    node.addEventListener("touchstart", handleTouchStart, { passive: false });
    node.addEventListener("touchmove", handleTouchMove, { passive: false });
    window.addEventListener("touchend", handleTouchEnd, { passive: false });
    window.addEventListener("touchcancel", handleTouchEnd, { passive: false });
    return () => {
      node.removeEventListener("touchstart", handleTouchStart);
      node.removeEventListener("touchmove", handleTouchMove);
      window.removeEventListener("touchend", handleTouchEnd);
      window.removeEventListener("touchcancel", handleTouchEnd);
      endDrag();
    };
  }, [disabled, touchScrubAvailable]);

  const canTouchScrub = !disabled && touchScrubAvailable;
  const canUsePointer = (event: PointerEvent<HTMLElement>) =>
    canTouchScrub && (event.pointerType === "touch" || event.pointerType === "pen");

  return (
    <div
      ref={rootRef}
      className={cn(
        "tempo-jog-control group relative select-none touch-none rounded-lg border border-border/70 bg-background/35",
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
        event.stopPropagation();
        try {
          event.currentTarget.setPointerCapture(event.pointerId);
        } catch {
          // Capture is best-effort; move/up handlers match on pointerId anyway.
        }
        beginDrag(event.clientX, event.pointerId, "pointer");
      }}
      onPointerMove={(event) => {
        const drag = dragRef.current;
        if (!drag || drag.source !== "pointer" || drag.pointerId !== event.pointerId || !canUsePointer(event)) return;
        event.preventDefault();
        event.stopPropagation();
        moveDrag(event.clientX);
      }}
      onPointerUp={(event) => {
        if (dragRef.current?.pointerId === event.pointerId) {
          event.preventDefault();
          event.stopPropagation();
          if (event.currentTarget.hasPointerCapture(event.pointerId)) {
            event.currentTarget.releasePointerCapture(event.pointerId);
          }
          endDrag(event.pointerId);
        }
      }}
      onPointerCancel={(event) => {
        if (dragRef.current?.pointerId === event.pointerId) {
          if (event.currentTarget.hasPointerCapture(event.pointerId)) {
            event.currentTarget.releasePointerCapture(event.pointerId);
          }
          endDrag(event.pointerId);
        }
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
          setTempoWithCue(100, 100 >= bpmRef.current ? 1 : -1, Math.abs(100 - bpmRef.current));
        }
      }}
      title={canTouchScrub ? "Slide with a finger to adjust tempo." : "Touch scrub is available on phone and iPad only."}
    >
      <div className="flex items-center justify-between gap-3">
        <span className="tiny-caps text-[9px] text-muted-foreground">Jog tempo</span>
        <span className="font-mono text-xs text-primary">{Math.round(bpm)} BPM</span>
      </div>
      <div className="tempo-jog-track mt-2 h-2 overflow-hidden rounded-full bg-primary/15">
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
