import { useState } from "react";
import type { ReactNode } from "react";

import {
  SUBDIVISION_NOTATION,
  SUBDIVISION_OPTIONS,
  TEMPO_PRESETS,
  type BeatPattern,
  type SubdivisionCount,
  type TimeSignature,
} from "@/lib/metronome-types";
import { getTempoMarking } from "@/lib/utils";

interface TempoHeaderStripProps {
  bpm: number;
  timeSignature: TimeSignature;
  pattern: BeatPattern[];
  onSetBpm: (bpm: number) => void;
  onSetTimeSignature: (timeSignature: TimeSignature) => void;
  onSetSubdivision: (subdivision: SubdivisionCount) => void;
}

type OpenPanel = "tempo-number" | "tempo-word" | "meter" | "subdivision" | null;

function dominantPulses(pattern: BeatPattern[]): SubdivisionCount | null {
  if (pattern.length === 0) return 1;
  const first = pattern[0].pulses;
  return pattern.every((b) => b.pulses === first) ? first : null;
}

export function TempoHeaderStrip({
  bpm,
  timeSignature,
  pattern,
  onSetBpm,
  onSetTimeSignature,
  onSetSubdivision,
}: TempoHeaderStripProps) {
  const [open, setOpen] = useState<OpenPanel>(null);
  const dom = dominantPulses(pattern);
  const tempoWord = getTempoMarking(bpm);

  const toggle = (panel: OpenPanel) => setOpen((current) => (current === panel ? null : panel));

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
      <section className="rounded-lg border border-border/70 bg-card/60 p-3 md:p-4">
        <span className="tiny-caps block text-[10px] text-muted-foreground">Tempo</span>
        <div className="mt-1 grid grid-cols-[1fr_auto] items-end gap-3">
          <button
            type="button"
            onClick={() => toggle("tempo-number")}
            onDoubleClick={() => toggle("tempo-number")}
            className="text-left font-serif text-4xl md:text-5xl leading-none text-[hsl(var(--slate-cyan))]"
          >
            {Math.round(bpm)}
          </button>
          <button
            type="button"
            onClick={() => toggle("tempo-word")}
            onDoubleClick={() => toggle("tempo-word")}
            className="pb-1 text-right font-serif italic text-base text-primary/80"
          >
            {tempoWord}
          </button>
        </div>
        {open === "tempo-number" && (
          <div className="mt-3 border-t border-border/60 pt-3">
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              value={Math.round(bpm)}
              onChange={(e) => {
                const next = Number(e.target.value.replace(/[^0-9]/g, ""));
                if (Number.isFinite(next)) onSetBpm(Math.min(300, Math.max(20, next)));
              }}
              className="w-full bg-background/50 border border-border rounded-md px-3 py-2 font-serif text-3xl tabular text-foreground focus:outline-none focus:border-primary"
              aria-label="Tempo BPM"
            />
          </div>
        )}
        {open === "tempo-word" && (
          <div className="mt-3 border-t border-border/60 pt-3">
            <select
              value={TEMPO_PRESETS.find((preset) => Math.abs(preset.bpm - bpm) < 4)?.bpm ?? ""}
              onChange={(e) => {
                if (e.target.value) onSetBpm(Number(e.target.value));
              }}
              className="metronome-select"
              aria-label="Classical tempo marking"
            >
              <option value="" className="bg-background">Choose a tempo word</option>
              {TEMPO_PRESETS.map((preset) => (
                <option key={preset.label} value={preset.bpm} className="bg-background">
                  {preset.label} · {preset.bpm}
                </option>
              ))}
            </select>
          </div>
        )}
      </section>

      <TopControlCard
        label="Time Signature"
        value={`${timeSignature.numerator}/${timeSignature.denominator}`}
        detail="meter"
        active={open === "meter"}
        onToggle={() => toggle("meter")}
        onDoubleClick={() => toggle("meter")}
      >
        <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2">
          <select
            value={timeSignature.numerator}
            onChange={(e) => onSetTimeSignature({ ...timeSignature, numerator: Number(e.target.value) })}
            className="metronome-select"
            aria-label="Beat count"
          >
            {Array.from({ length: 15 }, (_, i) => i + 1).map((n) => (
              <option key={n} value={n} className="bg-background">{n}</option>
            ))}
          </select>
          <span className="font-serif text-3xl text-primary">/</span>
          <select
            value={timeSignature.denominator}
            onChange={(e) => onSetTimeSignature({ ...timeSignature, denominator: Number(e.target.value) })}
            className="metronome-select"
            aria-label="Beat note value"
          >
            {[2, 4, 8, 16].map((n) => (
              <option key={n} value={n} className="bg-background">{n}</option>
            ))}
          </select>
        </div>
      </TopControlCard>

      <TopControlCard
        label="Subdivision"
        value={dom ? SUBDIVISION_NOTATION[dom].glyph : "Mixed"}
        detail={dom ? SUBDIVISION_NOTATION[dom].label : "per beat"}
        active={open === "subdivision"}
        onToggle={() => toggle("subdivision")}
        onDoubleClick={() => toggle("subdivision")}
      >
        <select
          value={dom ?? ""}
          onChange={(e) => onSetSubdivision(Number(e.target.value) as SubdivisionCount)}
          className="metronome-select"
          aria-label="Subdivision"
        >
          <option value="" disabled className="bg-background">Mixed per beat</option>
          {SUBDIVISION_OPTIONS.map((n) => (
            <option key={n} value={n} className="bg-background">
              {SUBDIVISION_NOTATION[n].glyph} {SUBDIVISION_NOTATION[n].label}
            </option>
          ))}
        </select>
      </TopControlCard>
    </div>
  );
}

function TopControlCard({
  label,
  value,
  detail,
  active,
  onToggle,
  onDoubleClick,
  children,
}: {
  label: string;
  value: string;
  detail: string;
  active: boolean;
  onToggle: () => void;
  onDoubleClick: () => void;
  children: ReactNode;
}) {
  return (
    <section className="rounded-lg border border-border/70 bg-card/60 p-3 md:p-4">
      <button
        type="button"
        onClick={onToggle}
        onDoubleClick={onDoubleClick}
        className="grid w-full grid-cols-[1fr_auto] items-end gap-3 text-left"
      >
        <span>
          <span className="tiny-caps block text-[10px] text-muted-foreground">{label}</span>
          <span className="mt-1 block font-serif text-4xl md:text-5xl leading-none text-[hsl(var(--slate-cyan))]">
            {value}
          </span>
        </span>
        <span className="pb-1 text-right font-serif italic text-base text-primary/80">{detail}</span>
      </button>
      {active && <div className="mt-3 border-t border-border/60 pt-3">{children}</div>}
    </section>
  );
}
