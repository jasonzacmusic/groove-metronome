import { useEffect, useState } from "react";

import { LevelMeters } from "@/components/metronome/LevelMeters";
import { NotationPanel } from "@/components/metronome/NotationPanel";
import { PatternTiles } from "@/components/metronome/PatternTiles";
import { PolyrhythmWheel } from "@/components/metronome/PolyrhythmWheel";
import { TapPad } from "@/components/metronome/TapPad";
import { TempoHeaderStrip } from "@/components/metronome/TempoHeaderStrip";
import { TransportButton } from "@/components/metronome/TransportButton";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import type { MetronomeView } from "@/App";
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

const MODE_OPTIONS: Array<{ id: MetronomeView; label: string; detail: string }> = [
  { id: "beatmap", label: "Beat Map", detail: "per-beat subdivisions" },
  { id: "wheel", label: "Wheel", detail: "circular pulse view" },
  { id: "levels", label: "Levels", detail: "accent strength" },
  { id: "polyrhythm", label: "Polyrhythm", detail: "LCM grid" },
];

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
  view: MetronomeView;
  onViewChange: (v: MetronomeView) => void;
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
    onViewChange("beatmap");
  };

  const handleViewChange = (next: MetronomeView) => {
    onViewChange(next);
    setPolyrhythm({ enabled: next === "polyrhythm" });
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
    <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_340px] gap-8 lg:gap-12 pb-16">
      {/* HERO column */}
      <section className="space-y-5">
        {/* Top digital readout strip */}
        <TempoHeaderStrip bpm={state.bpm} timeSignature={state.timeSignature} pattern={state.pattern} />

        <TransportDeck
          state={state}
          onTap={tap}
          onToggle={toggle}
          onAdjustBpm={adjustBpm}
          onSetBpm={setBpm}
        />

        <QuickSetup
          view={view}
          status={state.isPlaying ? `Bar ${state.barCount + 1}` : "Stopped"}
          timeSignature={state.timeSignature}
          beatSound={state.beatSound}
          dominantSubdivision={dominantSubdivision}
          onViewChange={handleViewChange}
          onTimeSignatureChange={setTimeSignature}
          onBeatSoundChange={setBeatSound}
          onSubdivisionChange={setGlobalSubdivision}
          onPresetChange={loadPreset}
          onResetAccents={resetAccents}
        />

        <CollapsiblePanel
          title="Classical Tempo Words"
          summary="Largo, Andante, Vivace"
          defaultOpen={false}
        >
          <TempoLearningStrip bpm={state.bpm} onSelect={setBpm} />
        </CollapsiblePanel>

        <CollapsiblePanel
          title="Subdivision Palette"
          summary={dominantSubdivision ? `${SUBDIVISION_NOTATION[dominantSubdivision].label}` : "Mixed beats"}
          defaultOpen={false}
        >
          <SubdivisionPalette
            dominantSubdivision={dominantSubdivision}
            onApply={setGlobalSubdivision}
            onReset={resetAccents}
          />
        </CollapsiblePanel>

        {/* Hero view */}
        <div className="relative">
          {view === "beatmap" ? (
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
                  return "normal";
                }),
              })}
              onCyclePulse={cyclePulse}
            />
          ) : view === "wheel" ? (
            <PolyrhythmWheel
              pattern={state.pattern}
              bpm={state.bpm}
              isPlaying={state.isPlaying}
              currentBeat={state.currentBeat}
              currentPulse={state.currentPulse}
              onCycleBeatSubdivision={cycleBeatSubdivision}
              onCyclePulseAccent={cyclePulse}
            />
          ) : view === "levels" ? (
            <LevelMeters
              pattern={state.pattern}
              isPlaying={state.isPlaying}
              currentBeat={state.currentBeat}
              currentPulse={state.currentPulse}
              onCycleBeatSubdivision={cycleBeatSubdivision}
              onSetPulseLevel={setPulseLevel}
            />
          ) : (
            <PolyrhythmMode
              numerator={state.timeSignature.numerator}
              against={state.polyrhythm.against}
              enabled={state.polyrhythm.enabled}
              isPlaying={state.isPlaying}
              currentBeat={state.currentBeat}
              currentPoly={state.currentPoly}
              onToggle={(enabled) => setPolyrhythm({ enabled })}
              onAgainst={(against) => setPolyrhythm({ against, enabled: true })}
            />
          )}
        </div>

        {/* Notation */}
        <CollapsiblePanel title="Notation Preview" summary={`${state.timeSignature.numerator}/${state.timeSignature.denominator}`} defaultOpen={false}>
          <div className="notation-surface border border-border rounded-md px-3 py-3 overflow-x-auto shadow-[0_0_0_1px_hsl(var(--accent)/0.08)]">
            <NotationPanel
              pattern={state.pattern}
              timeSignature={state.timeSignature}
              currentBeat={state.currentBeat}
              isPlaying={state.isPlaying}
            />
          </div>
        </CollapsiblePanel>

        {/* Pattern tiles (Pro-Metronome style) */}
        <CollapsiblePanel title="Pattern Tiles" summary="Apply rhythm presets" defaultOpen={false}>
          <PatternTiles
            selectedBeat={selectedBeat}
            beatCount={state.timeSignature.numerator}
            onSelectBeat={setSelectedBeat}
            onApply={(pat, beatIndex) => {
              if (beatIndex === null) applyPatternToAll(pat);
              else applyPatternToBeat(beatIndex, pat);
            }}
          />
        </CollapsiblePanel>
      </section>

      {/* SIDEBAR column */}
      <aside className="space-y-4 lg:border-l lg:border-border lg:pl-10">
        <CollapsiblePanel title="Sound Detail" summary={BEAT_SOUND_LABELS[state.beatSound]} defaultOpen={true}>
          <Field label="Pitch" trailing={<span className="tiny-caps text-[10px] text-primary">{pitchLabel(state.pitch)}</span>}>
            <Slider
              value={[state.pitch]}
              min={0}
              max={100}
              step={1}
              onValueChange={(v) => setPitch(v[0] ?? 50)}
              onDoubleClick={() => setPitch(50)}
              title="Double-click to reset pitch"
            />
          </Field>
          <div className="mt-5">
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
          </div>
        </CollapsiblePanel>

        <CollapsiblePanel title="Playlist / Setlist" summary={setlist.name} defaultOpen={false}>
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
                className="tiny-caps text-[10px] px-2 py-1 border border-primary/60 text-primary rounded-sm hover:bg-primary/10"
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
                      <span className="block tiny-caps text-[10px] text-muted-foreground">{song.bpm} BPM · {song.timeSignature.numerator}/{song.timeSignature.denominator}</span>
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
              className="tiny-caps text-[10px] text-muted-foreground hover:text-primary"
            >
              Reset to 4/4 default
            </button>
          </div>
        </CollapsiblePanel>

        {/* Tempo Ramp */}
        <CollapsiblePanel
          title="Practice Ramp"
          summary={state.rampEnabled ? `${state.rampConfig.startBpm} → ${state.rampConfig.endBpm}` : "Off"}
          trailing={<Switch checked={state.rampEnabled} onCheckedChange={setRampEnabled} />}
          defaultOpen={state.rampEnabled}
        >
          <div className="grid grid-cols-3 gap-3">
            <NumberField label="Start" value={state.rampConfig.startBpm} onChange={(v) => setRampConfig({ ...state.rampConfig, startBpm: clamp(v, 20, 300) })} />
            <NumberField label="End" value={state.rampConfig.endBpm} onChange={(v) => setRampConfig({ ...state.rampConfig, endBpm: clamp(v, 20, 300) })} />
            <NumberField label="Bars" value={state.rampConfig.durationBars} onChange={(v) => setRampConfig({ ...state.rampConfig, durationBars: Math.max(1, v) })} />
          </div>
          <label className="flex items-center gap-2 mt-3">
            <Switch checked={state.rampConfig.loop} onCheckedChange={(c) => setRampConfig({ ...state.rampConfig, loop: c })} />
            <span className="tiny-caps text-[10px] text-muted-foreground">Loop</span>
          </label>
          {state.rampProgress && (
            <div className="mt-3">
              <p className="tiny-caps text-[10px] text-primary">
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
        </CollapsiblePanel>

        {/* Mute trainer */}
        <CollapsiblePanel
          title="Mute Trainer"
          summary={state.trainerEnabled ? `${state.trainerConfig.playBars} play / ${state.trainerConfig.muteBars} mute` : "Off"}
          trailing={<Switch checked={state.trainerEnabled} onCheckedChange={setTrainerEnabled} />}
          defaultOpen={state.trainerEnabled}
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
            <p className="tiny-caps text-[10px] mt-2" style={{ color: state.trainerPhase === "muted" ? "hsl(var(--muted-foreground))" : "hsl(var(--primary))" }}>
              {state.trainerPhase}
            </p>
          )}
        </CollapsiblePanel>

        {/* Practice timer */}
        <CollapsiblePanel title="Practice Timer" summary={formatTime(state.practiceSeconds)} defaultOpen={false}>
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
        </CollapsiblePanel>

        <button
          type="button"
          onPointerDown={(e) => { e.preventDefault(); resetDefault(); }}
          className="w-full rounded-md border border-border/70 px-4 py-3 tiny-caps text-[10px] text-muted-foreground hover:border-primary/60 hover:text-primary transition-colors"
        >
          Reset to simple 4/4
        </button>
        <p className="tiny-caps text-[10px] text-muted-foreground/60 leading-relaxed">
          Space play · T tap · ↑↓ ±1 · [ ] ±5
        </p>
      </aside>
    </div>
  );
}

function SectionLabel({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="tiny-caps text-xs text-foreground">{title}</span>
      {hint && <span className="tiny-caps text-[11px] text-muted-foreground/70">{hint}</span>}
    </div>
  );
}

function TransportDeck({
  state,
  onTap,
  onToggle,
  onAdjustBpm,
  onSetBpm,
}: {
  state: UseMetronomeReturn["state"];
  onTap: () => void;
  onToggle: () => void;
  onAdjustBpm: (delta: number) => void;
  onSetBpm: (bpm: number) => void;
}) {
  return (
    <div className="rounded-md border border-border/70 bg-card/60 p-4 md:p-5">
      <div className="grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] gap-4 items-center">
        <TapPad onTap={onTap} count={state.tapInfo.count} avgBpm={state.tapInfo.avgBpm} />
        <div className="flex justify-center">
          <TransportButton isPlaying={state.isPlaying} onToggle={onToggle} />
        </div>
        <div className="flex flex-col items-center gap-2">
          <span className="tiny-caps text-xs text-muted-foreground">BPM</span>
          <div className="flex items-center gap-1">
            <Stepper label="−10" onTap={() => onAdjustBpm(-10)} />
            <Stepper label="−1" onTap={() => onAdjustBpm(-1)} primary />
            <input
              type="number"
              value={Math.round(state.bpm)}
              onChange={(e) => {
                const v = Number(e.target.value);
                if (v >= 20 && v <= 300) onSetBpm(v);
              }}
              className="w-20 bg-transparent border-b border-border text-center font-serif text-3xl tabular focus:outline-none focus:border-primary"
              min={20}
              max={300}
              aria-label="BPM"
            />
            <Stepper label="+1" onTap={() => onAdjustBpm(1)} primary />
            <Stepper label="+10" onTap={() => onAdjustBpm(10)} />
          </div>
        </div>
      </div>
      <div className="mt-4 px-2">
        <Slider
          value={[state.bpm]}
          min={20}
          max={300}
          step={1}
          onValueChange={([v]) => onSetBpm(v)}
          onDoubleClick={() => onSetBpm(120)}
          title="Double-click to reset to 120 BPM"
        />
      </div>
    </div>
  );
}

function QuickSetup({
  view,
  status,
  timeSignature,
  beatSound,
  dominantSubdivision,
  onViewChange,
  onTimeSignatureChange,
  onBeatSoundChange,
  onSubdivisionChange,
  onPresetChange,
  onResetAccents,
}: {
  view: MetronomeView;
  status: string;
  timeSignature: TimeSignature;
  beatSound: UseMetronomeReturn["state"]["beatSound"];
  dominantSubdivision: SubdivisionCount | null;
  onViewChange: (view: MetronomeView) => void;
  onTimeSignatureChange: (next: TimeSignature) => void;
  onBeatSoundChange: (sound: UseMetronomeReturn["state"]["beatSound"]) => void;
  onSubdivisionChange: (subdivision: SubdivisionCount) => void;
  onPresetChange: (idx: number) => void;
  onResetAccents: () => void;
}) {
  return (
    <div className="rounded-md border border-border/70 bg-card/60 p-4 md:p-5">
      <div className="flex items-baseline justify-between gap-4">
        <SectionLabel title="Quick Setup" hint={status} />
      </div>
      <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
        <TimeSignatureDropdown value={timeSignature} onChange={onTimeSignatureChange} />
        <SelectField label="Mode">
          <select
            value={view}
            onChange={(e) => onViewChange(e.target.value as MetronomeView)}
            className="metronome-select"
            aria-label="Metronome mode"
          >
            {MODE_OPTIONS.map((option) => (
              <option key={option.id} value={option.id} className="bg-background">
                {option.label}
              </option>
            ))}
          </select>
        </SelectField>
        <SelectField
          label="Subdivision"
          trailing={
            <button
              type="button"
              onPointerDown={(e) => { e.preventDefault(); onResetAccents(); }}
              className="tiny-caps text-[9px] text-muted-foreground hover:text-primary"
            >
              Reset
            </button>
          }
        >
          <select
            value={dominantSubdivision ?? ""}
            onChange={(e) => onSubdivisionChange(Number(e.target.value) as SubdivisionCount)}
            className="metronome-select"
            aria-label="Global subdivision"
          >
            <option value="" disabled className="bg-background">Mixed per beat</option>
            {SUBDIVISION_OPTIONS.map((n) => (
              <option key={n} value={n} className="bg-background">
                {SUBDIVISION_NOTATION[n].glyph} {n} — {SUBDIVISION_NOTATION[n].label}
              </option>
            ))}
          </select>
        </SelectField>
        <SelectField label="Sound">
          <select
            value={beatSound}
            onChange={(e) => onBeatSoundChange(e.target.value as UseMetronomeReturn["state"]["beatSound"])}
            className="metronome-select"
            aria-label="Metronome sound"
          >
            {BEAT_SOUND_OPTIONS.map((sound) => (
              <option key={sound.id} value={sound.id} className="bg-background">
                {sound.label} — {sound.family}
              </option>
            ))}
          </select>
        </SelectField>
      </div>
      <div className="mt-4">
        <SelectField label="Load Preset">
          <select
            onChange={(e) => {
              if (e.target.value !== "") onPresetChange(Number(e.target.value));
              e.currentTarget.value = "";
            }}
            defaultValue=""
            className="metronome-select"
            aria-label="Load preset pattern"
          >
            <option value="" disabled className="bg-background">Choose a pattern</option>
            {METRONOME_PRESETS.map((preset, index) => (
              <option key={preset.name} value={index} className="bg-background">
                {preset.name} · {preset.bpm} BPM
              </option>
            ))}
          </select>
        </SelectField>
      </div>
    </div>
  );
}

function SelectField({ label, trailing, children }: { label: string; trailing?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="rounded-md border border-border/60 bg-background/30 p-3">
      <div className="mb-2 flex items-center justify-between gap-3">
        <span className="tiny-caps text-xs text-muted-foreground">{label}</span>
        {trailing}
      </div>
      {children}
    </div>
  );
}

function TimeSignatureDropdown({ value, onChange }: { value: TimeSignature; onChange: (next: TimeSignature) => void }) {
  return (
    <SelectField label="Time Signature">
      <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2">
        <select
          value={value.numerator}
          onChange={(e) => onChange({ ...value, numerator: Number(e.target.value) })}
          className="metronome-select"
          aria-label="Beat count"
        >
          {Array.from({ length: 15 }, (_, i) => i + 1).map((n) => (
            <option key={n} value={n} className="bg-background">
              {n}
            </option>
          ))}
        </select>
        <span className="font-serif text-3xl text-[hsl(var(--slate-cyan))]">/</span>
        <select
          value={value.denominator}
          onChange={(e) => onChange({ ...value, denominator: Number(e.target.value) })}
          className="metronome-select"
          aria-label="Beat note value"
        >
          {[2, 4, 8, 16].map((n) => (
            <option key={n} value={n} className="bg-background">
              {n}
            </option>
          ))}
        </select>
      </div>
    </SelectField>
  );
}

function CollapsiblePanel({
  title,
  summary,
  defaultOpen = false,
  trailing,
  children,
}: {
  title: string;
  summary?: string;
  defaultOpen?: boolean;
  trailing?: React.ReactNode;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <Collapsible open={open} onOpenChange={setOpen} className="rounded-md border border-border/70 bg-card/50">
      <div className="flex items-center gap-2 px-4 py-3">
        <CollapsibleTrigger className="group flex min-w-0 flex-1 items-center justify-between gap-3 text-left">
          <span className="min-w-0">
            <span className="tiny-caps block text-xs text-foreground">{title}</span>
            {summary && <span className="mt-1 block truncate font-mono text-xs text-muted-foreground">{summary}</span>}
          </span>
          <span className="font-mono text-lg text-muted-foreground transition-transform group-data-[state=open]:rotate-45">+</span>
        </CollapsibleTrigger>
        {trailing && (
          <span
            className="shrink-0"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
          >
            {trailing}
          </span>
        )}
      </div>
      <CollapsibleContent>
        <div className="border-t border-border/60 p-4">{children}</div>
      </CollapsibleContent>
    </Collapsible>
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
              "rounded-md border px-3 py-3 text-left transition-colors " +
              (active
                ? "border-primary bg-primary/10 text-primary"
                : "border-border/70 bg-card/55 hover:border-accent/70 hover:bg-accent/5")
            }
          >
            <span className="font-serif text-lg leading-none">{preset.label}</span>
            <span className="mt-1 block font-mono text-sm tabular text-foreground/80">{preset.bpm}</span>
            <span className="tiny-caps mt-1 block text-[10px] text-muted-foreground">{descriptions[preset.label]}</span>
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
    <div className="rounded-md border border-border/70 bg-card/60 p-4">
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
                "flex items-center gap-3 rounded-sm border px-3 py-2.5 text-left transition-colors " +
                (active
                  ? "border-primary text-primary bg-primary/10"
                  : "border-border/60 text-muted-foreground hover:text-foreground hover:border-accent/60")
              }
            >
              <span className="w-12 text-center text-2xl leading-none text-foreground">{notation.glyph}</span>
              <span className="min-w-0">
                <span className="block font-mono text-sm tabular">{n}</span>
                <span className="tiny-caps block text-[10px] truncate">{notation.label}</span>
              </span>
            </button>
          );
        })}
      </div>
      <button
        type="button"
        onPointerDown={(e) => { e.preventDefault(); onReset(); }}
        className="tiny-caps mt-3 text-[10px] text-muted-foreground hover:text-primary"
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
    <div className="rounded-md border border-border/70 bg-card/60 p-4">
      <SectionLabel title="Beat Map" hint="subdivision + played pulses" />
      <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-2 gap-4">
        {pattern.map((beat, beatIndex) => {
          const activeBeat = isPlaying && currentBeat === beatIndex;
          return (
            <div
              key={beatIndex}
              className={
                "rounded-md border p-5 transition-colors " +
                (activeBeat ? "border-accent bg-accent/6" : "border-border/60 bg-background/35")
              }
            >
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-2">
                  <span
                    className="relative grid size-16 place-items-center rounded-full border"
                    style={{
                      background: subdivisionBackground(beat, activeBeat),
                      borderColor: activeBeat ? "hsl(var(--accent))" : "hsl(var(--border))",
                    }}
                  >
                    <span className="absolute inset-[30%] rounded-full bg-background/90" />
                    <span className="relative font-serif text-2xl">{beatIndex + 1}</span>
                  </span>
                  <div>
                    <span className="tiny-caps block text-[11px] text-muted-foreground">Beat</span>
                    <span className="font-mono text-lg tabular">{beat.pulses} pulse{beat.pulses > 1 ? "s" : ""}</span>
                  </div>
                </div>
              </div>
              <div className="mt-3">
                <select
                  value={beat.pulses}
                  onChange={(e) => onSetSubdivision(beatIndex, Number(e.target.value) as SubdivisionCount)}
                  className="w-full bg-transparent border-b border-border py-2 font-mono text-base focus:outline-none focus:border-primary"
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
                      className="min-h-16 rounded-sm border text-center font-mono text-lg transition-colors"
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

function ModeSwitcher({
  view,
  onChange,
  status,
}: {
  view: MetronomeView;
  onChange: (view: MetronomeView) => void;
  status: string;
}) {
  return (
    <div className="rounded-md border border-border/70 bg-card/60 p-4">
      <SectionLabel title="Mode" hint={status} />
      <div className="mt-4 grid grid-cols-2 lg:grid-cols-4 gap-2">
        {MODE_OPTIONS.map((option) => {
          const active = view === option.id;
          return (
            <button
              key={option.id}
              type="button"
              onPointerDown={(e) => { e.preventDefault(); onChange(option.id); }}
              className={
                "min-h-20 rounded-md border px-3 py-3 text-left transition-colors " +
                (active
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border/60 text-muted-foreground hover:border-accent/70 hover:text-foreground")
              }
            >
              <span className="block font-serif text-xl leading-tight">{option.label}</span>
              <span className="tiny-caps mt-2 block text-[11px] leading-relaxed">{option.detail}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function PolyrhythmMode({
  numerator,
  against,
  enabled,
  isPlaying,
  currentBeat,
  currentPoly,
  onToggle,
  onAgainst,
}: {
  numerator: number;
  against: number;
  enabled: boolean;
  isPlaying: boolean;
  currentBeat: number;
  currentPoly: number;
  onToggle: (enabled: boolean) => void;
  onAgainst: (against: number) => void;
}) {
  const sharedSlots = lcm(numerator, against);
  const mainStep = sharedSlots / numerator;
  const crossStep = sharedSlots / against;
  const mainActiveSlot = currentBeat >= 0 ? currentBeat * mainStep : -1;
  const crossActiveSlot = currentPoly >= 0 ? currentPoly * crossStep : -1;

  return (
    <div className="rounded-md border border-border/70 bg-card/60 p-5 md:p-6">
      <div className="grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_auto] gap-5 md:items-start">
        <div>
          <div className="flex items-center gap-3">
            <span className="tiny-caps text-xs text-foreground">Polyrhythm Mode</span>
            <Switch checked={enabled} onCheckedChange={onToggle} />
          </div>
          <div className="mt-3 flex flex-wrap items-end gap-4">
            <span className="font-serif text-6xl md:text-7xl leading-none tabular text-primary">
              {numerator}<span className="mx-2 text-muted-foreground">:</span>{against}
            </span>
            <span className="tiny-caps mb-2 text-xs text-muted-foreground">
              {sharedSlots} shared LCM slots
            </span>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 md:justify-end">
          {[2, 3, 4, 5, 7].map((value) => (
            <button
              key={value}
              type="button"
              onPointerDown={(e) => { e.preventDefault(); onAgainst(value); }}
              className={
                "px-3 py-2.5 rounded-sm border font-mono text-sm transition-colors " +
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

      <div className="mt-6 space-y-4">
        <PolyrhythmRow
          label="Main"
          slots={sharedSlots}
          step={mainStep}
          activeSlot={isPlaying ? mainActiveSlot : -1}
          color="hsl(var(--primary))"
        />
        <PolyrhythmRow
          label="Cross"
          slots={sharedSlots}
          step={crossStep}
          activeSlot={isPlaying && enabled ? crossActiveSlot : -1}
          color="hsl(var(--slate-cyan))"
        />
        <div className="grid gap-1.5" style={{ gridTemplateColumns: `repeat(${sharedSlots}, minmax(0, 1fr))` }}>
          {Array.from({ length: sharedSlots }, (_, index) => {
            const mainHit = index % mainStep === 0;
            const crossHit = index % crossStep === 0;
            const active = isPlaying && ((mainHit && index === mainActiveSlot) || (enabled && crossHit && index === crossActiveSlot));
            return (
              <div
                key={index}
                className="relative grid min-h-12 place-items-center rounded-sm border border-border/50 bg-background/35"
                aria-label={`LCM slot ${index + 1}${mainHit ? " main" : ""}${crossHit ? " cross" : ""}`}
              >
                <span
                  className="absolute inset-0 rounded-sm transition-opacity"
                  style={{
                    opacity: active ? 0.28 : 0,
                    background: "hsl(var(--amber))",
                  }}
                />
                <span
                  className="relative block size-4 rounded-full transition-transform"
                  style={{
                    background: mainHit && crossHit
                      ? "linear-gradient(135deg, hsl(var(--primary)) 0 50%, hsl(var(--slate-cyan)) 50% 100%)"
                      : mainHit
                        ? "hsl(var(--primary))"
                        : crossHit
                          ? "hsl(var(--slate-cyan))"
                          : "hsl(var(--border) / 0.45)",
                    transform: active ? "scale(1.35)" : "scale(1)",
                  }}
                />
              </div>
            );
          })}
        </div>
      </div>

      <div className="mt-5 grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
        <div className="rounded-sm border border-border/60 bg-background/35 p-3">
          <span className="tiny-caps block text-[11px] text-muted-foreground">Main voice</span>
          <span className="font-mono text-lg tabular">{numerator} hits</span>
        </div>
        <div className="rounded-sm border border-border/60 bg-background/35 p-3">
          <span className="tiny-caps block text-[11px] text-muted-foreground">Cross voice</span>
          <span className="font-mono text-lg tabular">{against} hits</span>
        </div>
        <div className="rounded-sm border border-border/60 bg-background/35 p-3">
          <span className="tiny-caps block text-[11px] text-muted-foreground">Meeting point</span>
          <span className="font-mono text-lg tabular">Every {sharedSlots} slots</span>
        </div>
      </div>
    </div>
  );
}

function PolyrhythmRow({
  label,
  slots,
  step,
  activeSlot,
  color,
}: {
  label: string;
  slots: number;
  step: number;
  activeSlot: number;
  color: string;
}) {
  return (
    <div className="grid grid-cols-[4.5rem_minmax(0,1fr)] items-center gap-3">
      <span className="tiny-caps text-xs text-muted-foreground">{label}</span>
      <div className="grid gap-1.5" style={{ gridTemplateColumns: `repeat(${slots}, minmax(0, 1fr))` }}>
        {Array.from({ length: slots }, (_, index) => {
          const hit = index % step === 0;
          const active = index === activeSlot;
          return (
            <span
              key={index}
              className="h-3 rounded-full transition-all"
              style={{
                background: hit ? color : "hsl(var(--border) / 0.35)",
                opacity: hit ? 1 : 0.5,
                transform: active ? "scaleY(1.8)" : "scaleY(1)",
              }}
            />
          );
        })}
      </div>
    </div>
  );
}

function gcd(a: number, b: number): number {
  let x = Math.abs(Math.round(a));
  let y = Math.abs(Math.round(b));
  while (y !== 0) {
    const next = x % y;
    x = y;
    y = next;
  }
  return x || 1;
}

function lcm(a: number, b: number): number {
  return Math.max(1, Math.abs(Math.round((a * b) / gcd(a, b))));
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
        <span className="tiny-caps text-xs text-muted-foreground">{label}</span>
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
      className={`px-2.5 py-1.5 font-mono text-xs border border-transparent hover:border-primary/40 rounded-sm transition-all touch-manipulation select-none active:scale-95 ${
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
      <label className="tiny-caps text-[10px] text-muted-foreground block">{label}</label>
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
