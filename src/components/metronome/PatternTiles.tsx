import { BEAT_PATTERN_TILES, type BeatPattern } from "@/lib/metronome-types";

interface PatternTilesProps {
  selectedBeat: number | null;
  beatCount: number;
  onSelectBeat: (beatIndex: number | null) => void;
  onApply: (pattern: BeatPattern, beatIndex: number | null) => void;
}

export function PatternTiles({ selectedBeat, beatCount, onSelectBeat, onApply }: PatternTilesProps) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <span className="tiny-caps text-[10px] text-foreground">Pattern Tiles</span>
        <div className="flex items-center gap-2 flex-wrap">
          <span className="tiny-caps text-[9px] text-muted-foreground">Apply to</span>
          <button
            type="button"
            onPointerDown={(e) => { e.preventDefault(); onSelectBeat(null); }}
            className={`px-2 py-1 text-[10px] font-mono border transition-colors ${
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
              className={`px-2 py-1 text-[10px] font-mono border transition-colors ${
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

      <div className="grid grid-cols-4 gap-2">
        {BEAT_PATTERN_TILES.map((tile) => (
          <button
            key={tile.id}
            type="button"
            onPointerDown={(e) => { e.preventDefault(); onApply(tile.pattern, selectedBeat); }}
            className="group flex flex-col items-center justify-center aspect-square border border-border hover:border-primary/60 rounded-sm bg-[hsl(var(--ink))] transition-colors select-none touch-manipulation"
            title={tile.label}
          >
            <span className="text-2xl text-foreground/85 group-hover:text-primary transition-colors leading-none">
              {tile.glyph}
            </span>
            <span className="tiny-caps text-[8px] text-muted-foreground mt-1.5 px-1 text-center leading-tight">
              {tile.label}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
