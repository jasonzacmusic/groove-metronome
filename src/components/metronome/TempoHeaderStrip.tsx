import type { BeatPattern, TimeSignature } from "@/lib/metronome-types";
import { getTempoMarking } from "@/lib/utils";

interface TempoHeaderStripProps {
  bpm: number;
  timeSignature: TimeSignature;
  pattern: BeatPattern[];
}

function dominantPulses(pattern: BeatPattern[]): number {
  if (pattern.length === 0) return 1;
  const first = pattern[0].pulses;
  return pattern.every((b) => b.pulses === first) ? first : 0;
}

function subDivGlyph(p: number): string {
  switch (p) {
    case 1: return "♩";
    case 2: return "♫";
    case 3: return "♬³";
    case 4: return "♬";
    case 5: return "♬⁵";
    case 6: return "♬⁶";
    case 7: return "♬⁷";
    case 8: return "♬⁸";
    default: return "≋";
  }
}

export function TempoHeaderStrip({ bpm, timeSignature, pattern }: TempoHeaderStripProps) {
  const dom = dominantPulses(pattern);

  return (
    <div className="grid grid-cols-3 gap-4 items-center px-4 py-4 border border-border rounded-sm bg-[hsl(var(--ink))]/60">
      <div className="flex items-baseline gap-2 min-w-0">
        <span className="tiny-caps text-[9px] text-primary/80 px-1 py-0.5 bg-primary/10 rounded-[2px]">
          Tempo (BPM)
        </span>
        <span className="font-serif text-4xl md:text-5xl tabular text-[hsl(var(--slate-cyan))] leading-none">
          {Math.round(bpm)}
        </span>
        <span className="font-serif italic text-[hsl(var(--slate-cyan))]/70 text-sm md:text-base truncate">
          {getTempoMarking(bpm)}
        </span>
      </div>

      <div className="flex flex-col items-center">
        <span className="tiny-caps text-[9px] text-primary/80 px-1 py-0.5 bg-primary/10 rounded-[2px]">
          T.S.
        </span>
        <span className="font-serif text-3xl md:text-4xl tabular text-[hsl(var(--slate-cyan))] leading-none mt-1">
          {timeSignature.numerator}<span className="text-muted-foreground/60 mx-1">/</span>{timeSignature.denominator}
        </span>
      </div>

      <div className="flex flex-col items-end">
        <span className="tiny-caps text-[9px] text-primary/80 px-1 py-0.5 bg-primary/10 rounded-[2px]">
          Sub Div.
        </span>
        <span className="text-3xl md:text-4xl text-[hsl(var(--slate-cyan))] mt-1 leading-none">
          {dom > 0 ? subDivGlyph(dom) : "≋"}
        </span>
      </div>
    </div>
  );
}
