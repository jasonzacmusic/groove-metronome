import { useEffect, useState } from "react";

import { BarView } from "@/components/metronome/BarView";
import { PolyrhythmWheel } from "@/components/metronome/PolyrhythmWheel";
import { TransportButton } from "@/components/metronome/TransportButton";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import type { UseMetronomeReturn } from "@/hooks/useMetronome";
import {
  METRONOME_PRESETS,
  SUBDIVISION_OPTIONS,
  TEMPO_PRESETS,
  type BeatSound,
  type SubdivisionCount,
} from "@/lib/metronome-types";
import { clamp, formatTime } from "@/lib/utils";

const SOUNDS: BeatSound[] = ["click", "woodblock", "rimshot", "cowbell", "clave"];

interface MetronomePageProps {
  metronome: UseMetronomeReturn;
  view: "wheel" | "bar";
  onViewChange: (v: "wheel" | "bar") => void;
}

export function MetronomePage({ metronome, view, onViewChange }: MetronomePageProps) {
  const {
    state,
    setBpm,
    setTimeSignature,
    setBeatSound,
    setPattern,
    setSwing,
    setTrainerEnabled,
    setTrainerConfig,
    setRampEnabled,
    setRampConfig,
    toggle,
    tap,
    adjustBpm,
    cycleBeatSubdivision,
    cyclePulse,
    setGlobalSubdivision,
    resetAccents,
  } = metronome;

  const [targetMinutes, setTargetMinutes] = useState(5);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.code === "Space") { e.preventDefault(); toggle(); }
      else if (e.code === "ArrowUp") { e.preventDefault(); adjustBpm(1); }
      else if (e.code === "ArrowDown") { e.preventDefault(); adjustBpm(-1); }
      else if (e.key === "t" || e.key === "T") tap();
      else if (e.key === "[") { e.preventDefault(); adjustBpm(-5); }
      else if (e.key === "]") { e.preventDefault(); adjustBpm(5); }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [toggle, adjustBpm, tap]);

  const loadPreset = (idx: number) => {
    const p = METRONOME_PRESETS[idx];
    if (!p) return;
    setBpm(p.bpm);
    setTimeSignature({ numerator: p.timeSig[0], denominator: p.timeSig[1] });
    setSwing(p.swing);
    setPattern(p.pattern);
  };

  const dominantSubdivision: SubdivisionCount | null = (() => {
    if (state.pattern.length === 0) return null;
    const first = state.pattern[0].pulses;
    return state.pattern.every((b) => b.pulses === first) ? first : null;
  })();

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_320px] gap-10 lg:gap-14 pb-16">
      {/* HERO column */}
      <section className="space-y-7">
        {/* View toggle */}
        <div className="flex items-center justify-between">
          <span className="tiny-caps text-[10px] text-muted-foreground">
            {state.timeSignature.numerator}/{state.timeSignature.denominator}
            {" · "}
            {state.isPlaying ? `Bar ${state.barCount + 1}` : "Stopped"}
          </span>
          <div className="inline-flex items-center gap-3 tiny-caps text-[10px]">
            <button
              type="button"
              onClick={() => onViewChange("wheel")}
              className={view === "wheel" ? "text-primary" : "text-muted-foreground hover:text-foreground"}
            >
              Wheel
            </button>
            <span className="text-border">/</span>
            <button
              type="button"
              onClick={() => onViewChange("bar")}
              className={view === "bar" ? "text-primary" : "text-muted-foreground hover:text-foreground"}
            >
              Bar
            </button>
          </div>
        </div>

        {/* The hero itself */}
        <div className="relative">
          {view === "wheel" ? (
            <PolyrhythmWheel
              pattern={state.pattern}
              bpm={state.bpm}
              isPlaying={state.isPlaying}
              currentBeat={state.currentBeat}
              currentPulse={state.currentPulse}
              onCycleBeatSubdivision={cycleBeatSubdivision}
              onCyclePulseAccent={cyclePulse}
            />
          ) : (
            <div className="space-y-5">
              <div className="text-center">
                <span className="tiny-caps text-[10px] text-muted-foreground/80">{state.bpm < 200 ? "Tempo" : "Prestissimo"}</span>
                <div className="font-serif tabular leading-none text-foreground" style={{ fontSize: "clamp(3rem, 12vw, 5rem)" }}>
                  {Math.round(state.bpm)}
                </div>
                <span className="tiny-caps text-[9px] text-muted-foreground/70">BPM</span>
              </div>
              <BarView
                pattern={state.pattern}
                isPlaying={state.isPlaying}
                currentBeat={state.currentBeat}
                currentPulse={state.currentPulse}
                onCycleBeatSubdivision={cycleBeatSubdivision}
                onCyclePulseAccent={cyclePulse}
              />
            </div>
          )}
        </div>

        {/* Transport row */}
        <div className="space-y-5">
          <div className="flex items-center justify-center gap-5">
            <button
              type="button"
              onClick={tap}
              className="tiny-caps text-[11px] px-4 py-2 border border-border rounded-sm hover:border-primary/60 transition-colors"
            >
              Tap{state.tapInfo.count > 0 ? ` · ${state.tapInfo.count}${state.tapInfo.avgBpm ? `/${state.tapInfo.avgBpm}` : ""}` : ""}
            </button>
            <TransportButton isPlaying={state.isPlaying} onToggle={toggle} />
            <div className="flex items-center gap-1">
              <Stepper label="−10" onClick={() => adjustBpm(-10)} />
              <Stepper label="−1" onClick={() => adjustBpm(-1)} primary />
              <input
                type="number"
                value={Math.round(state.bpm)}
                onChange={(e) => {
                  const v = Number(e.target.value);
                  if (v >= 20 && v <= 300) setBpm(v);
                }}
                className="w-16 bg-transparent border-b border-border text-center font-serif text-2xl tabular focus:outline-none focus:border-primary"
                min={20}
                max={300}
                aria-label="BPM"
              />
              <Stepper label="+1" onClick={() => adjustBpm(1)} primary />
              <Stepper label="+10" onClick={() => adjustBpm(10)} />
            </div>
          </div>

          <div className="px-2">
            <Slider value={[state.bpm]} min={20} max={300} step={1} onValueChange={([v]) => setBpm(v)} />
          </div>

          <div className="flex flex-wrap justify-center gap-x-5 gap-y-2 tiny-caps text-[10px]">
            {TEMPO_PRESETS.map((p) => (
              <button
                key={p.label}
                type="button"
                onClick={() => setBpm(p.bpm)}
                className={
                  Math.abs(state.bpm - p.bpm) < 5
                    ? "text-primary"
                    : "text-muted-foreground hover:text-foreground transition-colors"
                }
              >
                {p.label} <span className="opacity-50">{p.bpm}</span>
              </button>
            ))}
          </div>
        </div>

        <hr className="rule" />

        {/* Subdivisions row — applies globally */}
        <div className="space-y-3">
          <SectionLabel
            title="Subdivision"
            hint={dominantSubdivision !== null ? `Uniform · ${dominantSubdivision} pulse${dominantSubdivision > 1 ? "s" : ""}` : "Mixed per beat"}
          />
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex flex-wrap gap-1.5">
              {SUBDIVISION_OPTIONS.map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setGlobalSubdivision(n)}
                  className={`px-3 py-1.5 text-xs font-mono border transition-colors ${
                    dominantSubdivision === n
                      ? "border-primary text-primary"
                      : "border-border text-muted-foreground hover:text-foreground hover:border-foreground/40"
                  }`}
                >
                  {n}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={resetAccents}
              className="tiny-caps text-[10px] text-muted-foreground hover:text-primary transition-colors"
            >
              Reset accents
            </button>
          </div>
          <p className="tiny-caps text-[9px] text-muted-foreground/60">
            Click a beat numeral to cycle 1→8 · Click a pulse to cycle accent
          </p>
        </div>
      </section>

      {/* SIDEBAR column */}
      <aside className="space-y-8 lg:border-l lg:border-border lg:pl-10">
        {/* Preset */}
        <Field label="Preset">
          <select
            onChange={(e) => loadPreset(Number(e.target.value))}
            defaultValue=""
            className="w-full bg-transparent border-b border-border py-2 font-serif text-base focus:outline-none focus:border-primary"
          >
            <option value="" disabled className="bg-background">— Load a pattern —</option>
            {METRONOME_PRESETS.map((p, i) => (
              <option key={p.name} value={i} className="bg-background">
                {p.name} · {p.bpm}
              </option>
            ))}
          </select>
        </Field>

        {/* Time signature */}
        <Field label="Time Signature">
          <div className="flex items-baseline gap-2">
            <select
              value={state.timeSignature.numerator}
              onChange={(e) => setTimeSignature({ ...state.timeSignature, numerator: Number(e.target.value) })}
              className="bg-transparent border-b border-border py-1 font-serif text-3xl text-foreground focus:outline-none focus:border-primary"
            >
              {Array.from({ length: 15 }, (_, i) => i + 1).map((n) => (
                <option key={n} value={n} className="bg-background font-sans text-base">{n}</option>
              ))}
            </select>
            <span className="font-serif text-3xl text-muted-foreground">/</span>
            <select
              value={state.timeSignature.denominator}
              onChange={(e) => setTimeSignature({ ...state.timeSignature, denominator: Number(e.target.value) })}
              className="bg-transparent border-b border-border py-1 font-serif text-3xl text-foreground focus:outline-none focus:border-primary"
            >
              {[2, 4, 8, 16].map((d) => (
                <option key={d} value={d} className="bg-background font-sans text-base">{d}</option>
              ))}
            </select>
          </div>
        </Field>

        {/* Sound */}
        <Field label="Sound">
          <div className="flex flex-wrap gap-x-4 gap-y-2 tiny-caps text-[10px]">
            {SOUNDS.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setBeatSound(s)}
                className={state.beatSound === s ? "text-primary" : "text-muted-foreground hover:text-foreground transition-colors"}
              >
                {s}
              </button>
            ))}
          </div>
        </Field>

        {/* Swing */}
        <Field label="Swing" trailing={<span className="tiny-caps text-[10px] text-muted-foreground tabular">{state.swing > 0 ? "+" : ""}{state.swing}%</span>}>
          <Slider value={[state.swing]} min={-100} max={100} step={1} onValueChange={([v]) => setSwing(v)} />
        </Field>

        <hr className="rule" />

        {/* Tempo Ramp */}
        <Field
          label="Tempo Ramp"
          trailing={<Switch checked={state.rampEnabled} onCheckedChange={setRampEnabled} />}
        >
          <div className="grid grid-cols-3 gap-3">
            <NumberField label="Start" value={state.rampConfig.startBpm} onChange={(v) => setRampConfig({ ...state.rampConfig, startBpm: clamp(v, 20, 300) })} />
            <NumberField label="End" value={state.rampConfig.endBpm} onChange={(v) => setRampConfig({ ...state.rampConfig, endBpm: clamp(v, 20, 300) })} />
            <NumberField label="Bars" value={state.rampConfig.durationBars} onChange={(v) => setRampConfig({ ...state.rampConfig, durationBars: Math.max(1, v) })} />
          </div>
          <label className="flex items-center gap-2 mt-3">
            <Switch checked={state.rampConfig.loop} onCheckedChange={(c) => setRampConfig({ ...state.rampConfig, loop: c })} />
            <span className="tiny-caps text-[9px] text-muted-foreground">Loop</span>
          </label>
          {state.rampProgress && (
            <div className="mt-3">
              <p className="tiny-caps text-[9px] text-primary">
                Bar {state.rampProgress.bar}/{state.rampConfig.durationBars} · {state.rampProgress.currentBpm} → {state.rampConfig.endBpm}
              </p>
              <div className="mt-1 w-full bg-border h-px overflow-hidden">
                <div
                  className="h-full bg-primary transition-all duration-200"
                  style={{ width: `${(state.rampProgress.bar / state.rampConfig.durationBars) * 100}%`, height: "1px" }}
                />
              </div>
            </div>
          )}
        </Field>

        {/* Mute trainer */}
        <Field
          label="Mute Trainer"
          trailing={<Switch checked={state.trainerEnabled} onCheckedChange={setTrainerEnabled} />}
        >
          <div className="grid grid-cols-2 gap-3">
            <NumberField label="Play" value={state.trainerConfig.playBars} onChange={(v) => setTrainerConfig({ ...state.trainerConfig, playBars: Math.max(1, v) })} />
            <NumberField label="Mute" value={state.trainerConfig.muteBars} onChange={(v) => setTrainerConfig({ ...state.trainerConfig, muteBars: Math.max(1, v) })} />
          </div>
          <div className="flex gap-0.5 mt-3 h-1.5">
            {Array.from({ length: state.trainerConfig.playBars + state.trainerConfig.muteBars }).map((_, i) => (
              <div
                key={i}
                className={`flex-1 ${i < state.trainerConfig.playBars ? "bg-primary/70" : "bg-border"}`}
              />
            ))}
          </div>
          {state.trainerEnabled && state.isPlaying && (
            <p className="tiny-caps text-[9px] mt-2" style={{ color: state.trainerPhase === "muted" ? "hsl(var(--muted-foreground))" : "hsl(var(--primary))" }}>
              {state.trainerPhase}
            </p>
          )}
        </Field>

        {/* Practice timer */}
        <Field label="Practice">
          <div className="flex items-baseline justify-between">
            <span className="font-serif text-3xl tabular text-foreground">{formatTime(state.practiceSeconds)}</span>
            <NumberField label="Target min" value={targetMinutes} onChange={(v) => setTargetMinutes(Math.max(0, v))} compact />
          </div>
          {targetMinutes > 0 && (
            <div className="mt-2 w-full h-px bg-border overflow-hidden">
              <div
                className="bg-primary transition-all duration-1000"
                style={{ width: `${Math.min(100, (state.practiceSeconds / (targetMinutes * 60)) * 100)}%`, height: "1px" }}
              />
            </div>
          )}
        </Field>

        <hr className="rule" />
        <p className="tiny-caps text-[9px] text-muted-foreground/60 leading-relaxed">
          Space play · T tap · ↑↓ ±1 · [ ] ±5
        </p>
      </aside>
    </div>
  );
}

function SectionLabel({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="tiny-caps text-[10px] text-foreground">{title}</span>
      {hint && <span className="tiny-caps text-[9px] text-muted-foreground/70">{hint}</span>}
    </div>
  );
}

function Field({ label, trailing, children }: { label: string; trailing?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <span className="tiny-caps text-[10px] text-muted-foreground">{label}</span>
        {trailing}
      </div>
      {children}
    </div>
  );
}

function Stepper({ label, onClick, primary }: { label: string; onClick: () => void; primary?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-1.5 py-1 font-mono text-[10px] transition-colors ${
        primary ? "text-foreground hover:text-primary" : "text-muted-foreground hover:text-foreground"
      }`}
    >
      {label}
    </button>
  );
}

function NumberField({ label, value, onChange, compact = false }: { label: string; value: number; onChange: (v: number) => void; compact?: boolean }) {
  return (
    <div className={compact ? "text-right" : ""}>
      <label className="tiny-caps text-[9px] text-muted-foreground block">{label}</label>
      <input
        type="number"
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className={`w-full bg-transparent border-b border-border py-1 ${compact ? "text-right" : "text-left"} font-mono text-sm focus:outline-none focus:border-primary`}
      />
    </div>
  );
}
