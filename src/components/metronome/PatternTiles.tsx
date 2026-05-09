import { BEAT_PATTERN_TILES, type BeatPattern } from "@/lib/metronome-types";

interface PatternTilesProps {
  bpm: number;
  selectedBeat: number | null;
  beatCount: number;
  onSelectBeat: (beatIndex: number | null) => void;
  onApply: (pattern: BeatPattern, beatIndex: number | null) => void;
}

export function PatternTiles({ bpm, selectedBeat, beatCount, onSelectBeat, onApply }: PatternTilesProps) {
  const maxPulses = bpm <= 80 ? 8 : bpm <= 100 ? 5 : 4;
  const tiles = BEAT_PATTERN_TILES.filter((tile) => tile.pattern.pulses <= maxPulses);
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <span className="tiny-caps text-xs text-foreground">Pattern Tiles</span>
        <div className="flex items-center gap-2 flex-wrap">
          <span className="tiny-caps text-[10px] text-muted-foreground">Apply to</span>
          <button
            type="button"
            onPointerDown={(e) => { e.preventDefault(); onSelectBeat(null); }}
            className={`px-2 py-1 text-xs font-mono border transition-colors ${
              selectedBeat === null
                ? "border-primary text-primary"
                : "border-border text-muted-foreground hover:text-foreground"
            }`}
          >
            All
          </button>
          {Array.from({ length: beatCount }, (_, i) => (
            <button
              key={i}
              type="button"
              onPointerDown={(e) => { e.preventDefault(); onSelectBeat(i); }}
              className={`px-2 py-1 text-xs font-mono border transition-colors ${
                selectedBeat === i
                  ? "border-primary text-primary"
                  : "border-border text-muted-foreground hover:text-foreground"
              }`}
            >
              Beat {i + 1}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        {tiles.map((tile) => (
          <button
            key={tile.id}
            type="button"
            onPointerDown={(e) => { e.preventDefault(); onApply(tile.pattern, selectedBeat); }}
            className="group relative flex min-h-24 flex-col items-center justify-center overflow-hidden rounded-md border bg-background/65 px-2 py-3 transition-colors select-none touch-manipulation hover:border-primary/60"
            style={{
              borderColor: `hsl(${tile.color} / 0.38)`,
              boxShadow: `inset 0 3px 0 hsl(${tile.color} / 0.9)`,
            }}
            title={tile.label}
          >
            <span
              className="text-2xl text-foreground/90 transition-colors leading-none"
              style={{ color: `hsl(${tile.color})` }}
            >
              {tile.glyph}
            </span>
            <span className="tiny-caps text-[10px] text-foreground/80 mt-1.5 px-1 text-center leading-tight">
              {tile.label}
            </span>
            <span className="mt-2 flex w-full items-end justify-center gap-1" aria-hidden>
              {tile.pattern.accents.map((accent, index) => (
                <span
                  key={index}
                  className="block w-2 rounded-t-sm"
                  style={{
                    height: accent === "accent" ? 18 : accent === "normal" ? 14 : accent === "ghost" ? 8 : 3,
                    background: accent === "mute" ? "hsl(var(--border))" : `hsl(${tile.color} / ${accent === "ghost" ? 0.45 : 0.9})`,
                  }}
                />
              ))}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
