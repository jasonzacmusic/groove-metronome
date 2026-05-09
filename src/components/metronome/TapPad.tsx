import { useEffect, useState } from "react";

interface TapPadProps {
  onTap: () => void;
  count: number;
  avgBpm: number | null;
}

/**
 * Big touch-friendly tap target. Triggers on pointerdown — no click delay.
 * Shows live count and running average BPM as the user taps.
 */
export function TapPad({ onTap, count, avgBpm }: TapPadProps) {
  const [flash, setFlash] = useState(0);

  useEffect(() => {
    if (count <= 0) return;
    setFlash((f) => f + 1);
    const t = setTimeout(() => setFlash(0), 120);
    return () => clearTimeout(t);
  }, [count]);

  return (
    <button
      type="button"
      onPointerDown={(e) => {
        e.preventDefault();
        onTap();
      }}
      aria-label="Tap tempo"
      className="relative flex flex-col items-center justify-center w-full min-h-[88px] rounded-md border border-primary/40 hover:border-primary active:bg-primary/10 transition-colors select-none touch-manipulation"
      style={{
        boxShadow: flash ? "inset 0 0 24px hsla(36, 84%, 64%, 0.35)" : undefined,
      }}
    >
      <span className="tiny-caps text-xs text-muted-foreground">Tap Tempo</span>
      <div className="flex items-baseline gap-3 mt-0.5">
        <span className="font-serif text-3xl tabular text-primary leading-none">
          {avgBpm !== null ? avgBpm : "—"}
        </span>
        <span className="tiny-caps text-[10px] text-muted-foreground">BPM avg</span>
      </div>
      <span className="tiny-caps text-[10px] text-muted-foreground/70 mt-1">
        {count > 0 ? `${count} tap${count === 1 ? "" : "s"}` : "Tap or press T"}
      </span>
    </button>
  );
}
