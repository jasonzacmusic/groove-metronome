import { useEffect, useState } from "react";

import { LevelMeters } from "@/components/metronome/LevelMeters";
import { NotationPanel } from "@/components/metronome/NotationPanel";
import { PatternTiles } from "@/components/metronome/PatternTiles";
import { PolyrhythmWheel } from "@/components/metronome/PolyrhythmWheel";
import { TapPad } from "@/components/metronome/TapPad";
import { TempoHeaderStrip } from "@/components/metronome/TempoHeaderStrip";
import { TimeSignatureControl } from "@/components/metronome/TimeSignatureControl";
import { TransportButton } from "@/components/metronome/TransportButton";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import type { UseMetronomeReturn } from "@/hooks/useMetronome";
import {
  BEAT_SOUND_LABELS,
  BEAT_SOUND_OPTIONS,
  buildDefaultPattern,
  METRONOME_PRESETS,
  pitchLabel,
  SUBDIVISION_NOTATION,
  SUBDIVISION_OPTIONS,
  TEMPO_PRESETS,
  type BeatPattern,
  type PulseAccent,
  type SubdivisionCount,
  type TimeSignature,
} from "@/lib/metronome-types";
import { clamp, formatTime } from "@/lib/utils";

const SETLIST_STORAGE_KEY = "groove-metronome.setlists.v1";

interface SavedSong {
  id: string;
  name: string;
  bpm: number;
  timeSignature: TimeSignature;
  pattern: BeatPattern[];
  swing: number;
}

interface SetlistState {
  name: string;
  songs: SavedSong[];
}

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
    setPitch,
    setPattern,
    setSwing,
    setTrainerEnabled,
    setTrainerConfig,
    setRampEnabled,
    setRampConfig,
    setPolyrhythm,
    toggle,
    tap,
    adjustBpm,
    cycleBeatSubdivision,
    cyclePulse,
    setPulseLevel,
    applyPatternToBeat,
    applyPatternToAll,
    setGlobalSubdivision,
    resetAccents,
  } = metronome;

  const [targetMinutes, setTargetMinutes] = useState(5);
  const [selectedBeat, setSelectedBeat] = useState<number | null>(null);
  const [songName, setSongName] = useState("New song");
  const [setlist, setSetlist] = useState<SetlistState>(() => {
    try {
      const saved = window.localStorage.getItem(SETLIST_STORAGE_KEY);
      if (saved) return JSON.parse(saved) as SetlistState;
    } catch {
      // Ignore corrupted local storage and start with a clean concert list.
    }
    return { name: "My Band / Concert", songs: [] };
  });

  useEffect(() => {
    window.localStorage.setItem(SETLIST_STORAGE_KEY, JSON.stringify(setlist));
  }, [setlist]);

  // Keep selectedBeat in range if numerator changes
  useEffect(() => {
    if (selectedBeat !== null && selectedBeat >= state.timeSignature.numerator) {
      setSelectedBeat(null);
    }
  }, [state.timeSignature.numerator, selectedBeat]);

  // Keyboard shortcuts
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

  const resetDefault = () => {
    setBpm(120);
    setTimeSignature({ numerator: 4, denominator: 4 });
    setSwing(0);
    setPattern(buildDefaultPattern(4, 1));
    setPolyrhythm({ enabled: false, against: 3 });
  };

  const saveCurrentSong = () => {
    const trimmed = songName.trim() || `Song ${setlist.songs.length + 1}`;
    const nextSong: SavedSong = {
      id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      name: trimmed,
      bpm: Math.round(state.bpm),
      timeSignature: state.timeSignature,
      pattern: state.pattern.map((beat) => ({ pulses: beat.pulses, accents: [...beat.accents] })),
      swing: state.swing,
    };
    setSetlist((prev) => ({ ...prev, songs: [...prev.songs, nextSong] }));
    setSongName(`Song ${setlist.songs.length + 2}`);
  };

  const loadSong = (song: SavedSong) => {
    setBpm(song.bpm);
    setTimeSignature(song.timeSignature);
    setSwing(song.swing);
    setPattern(song.pattern.map((beat) => ({ pulses: beat.pulses, accents: [...beat.accents] })));
  };

  const dominantSubdivision: SubdivisionCount | null = (() => {
    if (state.pattern.length === 0) return null;
    const first = state.pattern[0].pulses;
    return state.pattern.every((b) => b.pulses === first) ? first : null;
  })();

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_320px] gap-10 lg:gap-14 pb-16">
      {/* HERO column */}
      <section className="space-y-6">
        {/* Top digital readout strip */}
        <TempoHeaderStrip bpm={state.bpm} timeSignature={state.timeSignature} pattern={state.pattern} />

        <TempoLearningStrip bpm={state.bpm} onSelect={setBpm} />

        <div className="grid grid-cols-1 xl:grid-cols-[190px_minmax(0,1fr)] gap-4">
          <SubdivisionPalette
            dominantSubdivision={dominantSubdivision}
            onApply={setGlobalSubdivision}
            onReset={resetAccents}
          />
          <BeatSubdivisionEditor
            pattern={state.pattern}
            isPlaying={state.isPlaying}
            currentBeat={state.currentBeat}
            currentPulse={state.currentPulse}
            onSetSubdivision={(beatIndex, pulses) => applyPatternToBeat(beatIndex, {
              pulses,
              accents: Array.from({ length: pulses }, (_, pulseIndex) => {
                const existing = state.pattern[beatIndex]?.accents[pulseIndex];
                if (existing) return existing;
                return pulseIndex === 0 ? "normal" : "mute";
              }),
            })}
            onCyclePulse={cyclePulse}
          />
        </div>

        <PolyrhythmIntro
          numerator={state.timeSignature.numerator}
          against={state.polyrhythm.against}
          enabled={state.polyrhythm.enabled}
          onToggle={(enabled) => setPolyrhythm({ enabled })}
          onAgainst={(against) => setPolyrhythm({ against })}
        />

        {/* View toggle */}
        <div className="flex items-center justify-between">
          <span className="tiny-caps text-[10px] text-muted-foreground">
            {state.isPlaying ? `Bar ${state.barCount + 1}` : "Stopped"}
          </span>
          <div className="inline-flex items-center gap-3 tiny-caps text-[10px]">
            <button
              type="button"
              onPointerDown={(e) => { e.preventDefault(); onViewChange("wheel"); }}
              className={view === "wheel" ? "text-primary" : "text-muted-foreground hover:text-foreground"}
            >
              Wheel
            </button>
            <span className="text-border">/</span>
            <button
              type="button"
              onPointerDown={(e) => { e.preventDefault(); onViewChange("bar"); }}
              className={view === "bar" ? "text-primary" : "text-muted-foreground hover:text-foreground"}
            >
              Levels
            </button>
          </div>
        </div>

        {/* Hero view */}
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
            <LevelMeters
              pattern={state.pattern}
              isPlaying={state.isPlaying}
              currentBeat={state.currentBeat}
              currentPulse={state.currentPulse}
              onCycleBeatSubdivision={cycleBeatSubdivision}
              onSetPulseLevel={setPulseLevel}
            />
          )}
        </div>

        {/* Notation */}
        <div className="space-y-2">
          <span className="tiny-caps text-[10px] text-foreground">Notation</span>
          <div className="notation-surface border border-border rounded-md px-2 py-2 overflow-x-auto shadow-[0_0_0_1px_hsl(var(--accent)/0.08)]">
            <NotationPanel
              pattern={state.pattern}
              timeSignature={state.timeSignature}
              currentBeat={state.currentBeat}
              isPlaying={state.isPlaying}
            />
          </div>
        </div>

        {/* Pattern tiles (Pro-Metronome style) */}
        <PatternTiles
          selectedBeat={selectedBeat}
          beatCount={state.timeSignature.numerator}
          onSelectBeat={setSelectedBeat}
          onApply={(pat, beatIndex) => {
            if (beatIndex === null) applyPatternToAll(pat);
            else applyPatternToBeat(beatIndex, pat);
          }}
        />

        <hr className="rule" />

        {/* Transport row: Tap pad | Play | BPM stepper */}
        <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_1fr] gap-4 items-center">
          <TapPad onTap={tap} count={state.tapInfo.count} avgBpm={state.tapInfo.avgBpm} />
          <div className="flex justify-center">
            <TransportButton isPlaying={state.isPlaying} onToggle={toggle} />
          </div>
          <div className="flex flex-col items-center gap-2">
            <span className="tiny-caps text-[10px] text-muted-foreground">BPM</span>
            <div className="flex items-center gap-1">
              <Stepper label="−10" onTap={() => adjustBpm(-10)} />
              <Stepper label="−1" onTap={() => adjustBpm(-1)} primary />
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
              <Stepper label="+1" onTap={() => adjustBpm(1)} primary />
              <Stepper label="+10" onTap={() => adjustBpm(10)} />
            </div>
          </div>
        </div>

        <div className="px-2">
          <Slider
            value={[state.bpm]}
            min={20}
            max={300}
            step={1}
            onValueChange={([v]) => setBpm(v)}
            onDoubleClick={() => setBpm(120)}
            title="Double-click to reset to 120 BPM"
          />
        </div>

        <hr className="rule" />
      </section>

      {/* SIDEBAR column */}
      <aside className="space-y-8 lg:border-l lg:border-border lg:pl-10">
        {/* Time signature */}
        <Field label="Time Signature">
          <TimeSignatureControl value={state.timeSignature} onChange={setTimeSignature} />
        </Field>

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

        <Field label="Playlist / Setlist">
          <div className="space-y-3">
            <input
              value={setlist.name}
              onChange={(e) => setSetlist((prev) => ({ ...prev, name: e.target.value }))}
              className="w-full bg-transparent border-b border-border py-1 font-serif text-base focus:outline-none focus:border-primary"
              aria-label="Band or concert name"
            />
            <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2">
              <input
                value={songName}
                onChange={(e) => setSongName(e.target.value)}
                className="min-w-0 bg-transparent border-b border-border py-1 font-mono text-xs focus:outline-none focus:border-primary"
                aria-label="Song name"
              />
              <button
                type="button"
                onPointerDown={(e) => { e.preventDefault(); saveCurrentSong(); }}
                className="tiny-caps text-[9px] px-2 py-1 border border-primary/60 text-primary rounded-sm hover:bg-primary/10"
              >
                Save
              </button>
            </div>
            {setlist.songs.length > 0 && (
              <div className="space-y-1.5 max-h-48 overflow-auto pr-1">
                {setlist.songs.map((song, index) => (
                  <div key={song.id} className="grid grid-cols-[1.5rem_minmax(0,1fr)_auto] gap-2 items-center rounded-sm border border-border/60 px-2 py-1.5">
                    <span className="font-mono text-[10px] text-muted-foreground tabular">{index + 1}</span>
                    <button
                      type="button"
                      onPointerDown={(e) => { e.preventDefault(); loadSong(song); }}
                      className="min-w-0 text-left"
                    >
                      <span className="block truncate text-xs text-foreground">{song.name}</span>
                      <span className="block tiny-caps text-[8px] text-muted-foreground">{song.bpm} BPM · {song.timeSignature.numerator}/{song.timeSignature.denominator}</span>
                    </button>
                    <button
                      type="button"
                      onPointerDown={(e) => {
                        e.preventDefault();
                        setSetlist((prev) => ({ ...prev, songs: prev.songs.filter((s) => s.id !== song.id) }));
                      }}
                      className="text-muted-foreground hover:text-destructive text-xs"
                      aria-label={`Remove ${song.name}`}
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}
            <button
              type="button"
              onPointerDown={(e) => { e.preventDefault(); resetDefault(); }}
              className="tiny-caps text-[9px] text-muted-foreground hover:text-primary"
            >
              Reset to 4/4 default
            </button>
          </div>
        </Field>

        {/* Sound */}
        <Field label="Sound">
          <div className="space-y-3">
            <div className="grid grid-cols-3 gap-2">
              {BEAT_SOUND_OPTIONS.map((sound) => {
                const active = state.beatSound === sound.id;
                return (
                  <button
                    key={sound.id}
                    type="button"
                    onPointerDown={(e) => { e.preventDefault(); setBeatSound(sound.id); }}
                    className={
                      "min-h-14 px-1.5 py-2 rounded-md border transition-colors touch-manipulation " +
                      (active
                        ? "border-primary text-primary bg-primary/5"
                        : "border-border/60 text-muted-foreground hover:text-foreground hover:border-border")
                    }
                  >
                    <span className="tiny-caps block text-[10px] tracking-[0.12em]">{BEAT_SOUND_LABELS[sound.id]}</span>
                    <span className="tiny-caps block mt-1 text-[7px] tracking-[0.12em] opacity-50">{sound.family}</span>
                  </button>
                );
              })}
            </div>

            <div className="space-y-1.5">
              <div className="flex items-baseline justify-between tiny-caps text-[9px] tracking-[0.2em]">
                <span className="text-muted-foreground/60">Deep</span>
                <span className="text-primary">{pitchLabel(state.pitch)}</span>
                <span className="text-muted-foreground/60">Piercing</span>
              </div>
              <Slider
                value={[state.pitch]}
                min={0}
                max={100}
                step={1}
                onValueChange={(v) => setPitch(v[0] ?? 50)}
                onDoubleClick={() => setPitch(50)}
                title="Double-click to reset pitch"
              />
            </div>
          </div>
        </Field>

        {/* Swing */}
        <Field label="Swing" trailing={<span className="tiny-caps text-[10px] text-muted-foreground tabular">{state.swing > 0 ? "+" : ""}{state.swing}%</span>}>
          <Slider
            value={[state.swing]}
            min={-100}
            max={100}
            step={1}
            onValueChange={([v]) => setSwing(v)}
            onDoubleClick={() => setSwing(0)}
            title="Double-click to reset swing"
          />
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

function TempoLearningStrip({ bpm, onSelect }: { bpm: number; onSelect: (bpm: number) => void }) {
  const descriptions: Record<string, string> = {
    Largo: "broad",
    Adagio: "restful",
    Andante: "walking",
    Moderato: "measured",
    Allegro: "lively",
    Vivace: "brilliant",
    Presto: "swift",
  };

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
      {TEMPO_PRESETS.map((preset) => {
        const active = Math.abs(bpm - preset.bpm) < 5;
        return (
          <button
            key={preset.label}
            type="button"
            onPointerDown={(e) => { e.preventDefault(); onSelect(preset.bpm); }}
            className={
              "rounded-md border px-3 py-2 text-left transition-colors " +
              (active
                ? "border-primary bg-primary/10 text-primary"
                : "border-border/70 bg-card/55 hover:border-accent/70 hover:bg-accent/5")
            }
          >
            <span className="font-serif text-base leading-none">{preset.label}</span>
            <span className="mt-1 block font-mono text-[11px] tabular text-foreground/80">{preset.bpm}</span>
            <span className="tiny-caps mt-1 block text-[7px] text-muted-foreground">{descriptions[preset.label]}</span>
          </button>
        );
      })}
    </div>
  );
}

function SubdivisionPalette({
  dominantSubdivision,
  onApply,
  onReset,
}: {
  dominantSubdivision: SubdivisionCount | null;
  onApply: (subdivision: SubdivisionCount) => void;
  onReset: () => void;
}) {
  return (
    <div className="rounded-md border border-border/70 bg-card/60 p-3">
      <SectionLabel
        title="Subdivision"
        hint={dominantSubdivision ? `${dominantSubdivision}` : "mixed"}
      />
      <div className="mt-3 grid grid-cols-2 xl:grid-cols-1 gap-1.5">
        {SUBDIVISION_OPTIONS.map((n) => {
          const notation = SUBDIVISION_NOTATION[n];
          const active = dominantSubdivision === n;
          return (
            <button
              key={n}
              type="button"
              onPointerDown={(e) => { e.preventDefault(); onApply(n); }}
              className={
                "flex items-center gap-2 rounded-sm border px-2 py-1.5 text-left transition-colors " +
                (active
                  ? "border-primary text-primary bg-primary/10"
                  : "border-border/60 text-muted-foreground hover:text-foreground hover:border-accent/60")
              }
            >
              <span className="w-10 text-center text-lg leading-none text-foreground">{notation.glyph}</span>
              <span className="min-w-0">
                <span className="block font-mono text-[11px] tabular">{n}</span>
                <span className="tiny-caps block text-[7px] truncate">{notation.label}</span>
              </span>
            </button>
          );
        })}
      </div>
      <button
        type="button"
        onPointerDown={(e) => { e.preventDefault(); onReset(); }}
        className="tiny-caps mt-3 text-[9px] text-muted-foreground hover:text-primary"
      >
        Reset accents
      </button>
    </div>
  );
}

function BeatSubdivisionEditor({
  pattern,
  isPlaying,
  currentBeat,
  currentPulse,
  onSetSubdivision,
  onCyclePulse,
}: {
  pattern: BeatPattern[];
  isPlaying: boolean;
  currentBeat: number;
  currentPulse: number;
  onSetSubdivision: (beatIndex: number, pulses: SubdivisionCount) => void;
  onCyclePulse: (beatIndex: number, pulseIndex: number) => void;
}) {
  return (
    <div className="rounded-md border border-border/70 bg-card/60 p-3">
      <SectionLabel title="Beat Map" hint="subdivision + played pulses" />
      <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
        {pattern.map((beat, beatIndex) => {
          const activeBeat = isPlaying && currentBeat === beatIndex;
          return (
            <div
              key={beatIndex}
              className={
                "rounded-md border p-3 transition-colors " +
                (activeBeat ? "border-accent bg-accent/6" : "border-border/60 bg-background/35")
              }
            >
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-2">
                  <span
                    className="relative grid size-10 place-items-center rounded-full border"
                    style={{
                      background: subdivisionBackground(beat, activeBeat),
                      borderColor: activeBeat ? "hsl(var(--accent))" : "hsl(var(--border))",
                    }}
                  >
                    <span className="absolute inset-[30%] rounded-full bg-background/90" />
                    <span className="relative font-serif text-base">{beatIndex + 1}</span>
                  </span>
                  <div>
                    <span className="tiny-caps block text-[8px] text-muted-foreground">Beat</span>
                    <span className="font-mono text-xs tabular">{beat.pulses} pulse{beat.pulses > 1 ? "s" : ""}</span>
                  </div>
                </div>
              </div>
              <div className="mt-3">
                <select
                  value={beat.pulses}
                  onChange={(e) => onSetSubdivision(beatIndex, Number(e.target.value) as SubdivisionCount)}
                  className="w-full bg-transparent border-b border-border py-1 font-mono text-xs focus:outline-none focus:border-primary"
                  aria-label={`Subdivision for beat ${beatIndex + 1}`}
                >
                  {SUBDIVISION_OPTIONS.map((n) => (
                    <option key={n} value={n} className="bg-background">
                      {SUBDIVISION_NOTATION[n].glyph} {n}
                    </option>
                  ))}
                </select>
              </div>
              <div className="mt-3 grid gap-1" style={{ gridTemplateColumns: `repeat(${beat.pulses}, minmax(0, 1fr))` }}>
                {beat.accents.map((accent, pulseIndex) => {
                  const activePulse = activeBeat && currentPulse === pulseIndex;
                  return (
                    <button
                      key={pulseIndex}
                      type="button"
                      onPointerDown={(e) => { e.preventDefault(); onCyclePulse(beatIndex, pulseIndex); }}
                      className="min-h-10 rounded-sm border text-center font-mono text-[11px] transition-colors"
                      style={{
                        borderColor: activePulse ? "hsl(var(--primary))" : "hsl(var(--border))",
                        background: accentColor(accent, activePulse),
                        color: accent === "mute" ? "hsl(var(--muted-foreground))" : "hsl(var(--background))",
                      }}
                      aria-label={`Beat ${beatIndex + 1} pulse ${pulseIndex + 1}: ${accent}`}
                    >
                      {pulseSymbol(accent)}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function PolyrhythmIntro({
  numerator,
  against,
  enabled,
  onToggle,
  onAgainst,
}: {
  numerator: number;
  against: number;
  enabled: boolean;
  onToggle: (enabled: boolean) => void;
  onAgainst: (against: number) => void;
}) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_auto] gap-4 rounded-md border border-border/70 bg-card/55 p-4">
      <div>
        <div className="flex items-center gap-3">
          <span className="tiny-caps text-[10px] text-foreground">Polyrhythm</span>
          <Switch checked={enabled} onCheckedChange={onToggle} />
        </div>
        <div className="mt-2 flex items-baseline gap-3">
          <span className="font-serif text-4xl tabular text-primary">
            {numerator}<span className="mx-1 text-muted-foreground">:</span>{against}
          </span>
          <span className="tiny-caps text-[9px] text-muted-foreground">main bar vs cross voice</span>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2 md:justify-end">
        {[2, 3, 4, 5, 7].map((value) => (
          <button
            key={value}
            type="button"
            onPointerDown={(e) => { e.preventDefault(); onAgainst(value); onToggle(true); }}
            className={
              "px-3 py-2 rounded-sm border font-mono text-xs transition-colors " +
              (against === value && enabled
                ? "border-primary text-primary bg-primary/10"
                : "border-border text-muted-foreground hover:text-foreground hover:border-accent/70")
            }
          >
            {numerator}:{value}
          </button>
        ))}
        <Stepper label="−" onTap={() => onAgainst(Math.max(2, against - 1))} />
        <Stepper label="+" onTap={() => onAgainst(Math.min(16, against + 1))} />
      </div>
    </div>
  );
}

function accentColor(accent: PulseAccent, active: boolean): string {
  if (active) return "hsl(var(--amber))";
  if (accent === "accent") return "hsl(var(--amber) / 0.72)";
  if (accent === "normal") return "hsl(var(--slate-cyan) / 0.62)";
  if (accent === "ghost") return "hsl(210 30% 78% / 0.28)";
  return "hsl(var(--ink))";
}

function pulseSymbol(accent: PulseAccent): string {
  if (accent === "accent") return "●";
  if (accent === "normal") return "•";
  if (accent === "ghost") return "○";
  return "–";
}

function subdivisionBackground(beat: BeatPattern, active: boolean): string {
  const slice = 100 / beat.pulses;
  return `conic-gradient(${beat.accents
    .map((accent, index) => {
      const start = index * slice;
      const end = (index + 1) * slice;
      return `${accentColor(accent, active)} ${start}% ${end}%`;
    })
    .join(", ")})`;
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

function Stepper({ label, onTap, primary }: { label: string; onTap: () => void; primary?: boolean }) {
  return (
    <button
      type="button"
      onPointerDown={(e) => { e.preventDefault(); onTap(); }}
      className={`px-2 py-1 font-mono text-[10px] border border-transparent hover:border-primary/40 rounded-sm transition-all touch-manipulation select-none active:scale-95 ${
        primary ? "text-foreground hover:text-primary" : "text-muted-foreground hover:text-foreground"
      }`}
    >
      {label}
    </button>
  );
}

function NumberField({ label, value, onChange, compact = false }: { label: string; value: number; onChange: (v: number) => void; compact?: boolean }) {
  const [draft, setDraft] = useState(String(value));

  useEffect(() => {
    setDraft(String(value));
  }, [value]);

  const commit = (next: string) => {
    setDraft(next);
    if (next.trim() === "") return;
    const parsed = Number(next);
    if (Number.isFinite(parsed)) onChange(parsed);
  };

  return (
    <div className={compact ? "text-right" : ""}>
      <label className="tiny-caps text-[9px] text-muted-foreground block">{label}</label>
      <input
        type="number"
        value={draft}
        onChange={(e) => commit(e.target.value)}
        onBlur={() => {
          if (draft.trim() === "") setDraft(String(value));
        }}
        className={`w-full bg-transparent border-b border-border py-1 ${compact ? "text-right" : "text-left"} font-mono text-sm focus:outline-none focus:border-primary`}
      />
    </div>
  );
}
