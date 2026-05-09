import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  BarChart3,
  ChevronLeft,
  ChevronRight,
  CircleHelp,
  Copy,
  Download,
  Gauge,
  Hand,
  ListMusic,
  Music2,
  Network,
  Plus,
  RotateCcw,
  Share2,
  SlidersHorizontal,
  Timer,
  TrendingUp,
  Upload,
  Volume2,
  VolumeX,
  Waves,
  X,
} from "lucide-react";

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
  DOTTED_PLAYBACK_LABELS,
  METRONOME_PRESETS,
  pitchLabel,
  SUBDIVISION_NOTATION,
  SUBDIVISION_OPTIONS,
  TRIPLET_ASSIST_LABELS,
  type BeatPattern,
  type DottedPlaybackMode,
  type MeterDenominator,
  type PolymeterLane,
  type PolyrhythmRate,
  type PolyrhythmConfig,
  type PulseAccent,
  type SubdivisionCount,
  type TimeSignature,
  type TripletAssistMode,
} from "@/lib/metronome-types";
import { clamp, cn, formatTime } from "@/lib/utils";

const SETLIST_STORAGE_KEY = "groove-metronome.setlists.v1";

const MODE_OPTIONS: Array<{ id: MetronomeView; label: string; detail: string }> = [
  { id: "beatmap", label: "Beat Map", detail: "per-beat subdivisions" },
  { id: "levels", label: "Levels", detail: "accent strength" },
  { id: "polyrhythm", label: "Polyrhythm", detail: "LCM grid" },
  { id: "polymeter", label: "Polymeter", detail: "meter chain" },
];

const MODE_ICON: Record<MetronomeView, ReactNode> = {
  beatmap: <Waves className="size-5" aria-hidden />,
  levels: <BarChart3 className="size-5" aria-hidden />,
  polyrhythm: <Network className="size-5" aria-hidden />,
  polymeter: <PolymeterGlyph />,
};

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
  active?: boolean;
}

export function MetronomePage({ metronome, view, onViewChange, active = true }: MetronomePageProps) {
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
    setHapticsEnabled,
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
  const [showHaptics, setShowHaptics] = useState(false);
  const [concertMode, setConcertMode] = useState(false);
  const [concertIndex, setConcertIndex] = useState(0);
  const setlistImportRef = useRef<HTMLInputElement | null>(null);
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

  useEffect(() => {
    const ua = navigator.userAgent;
    const platform = navigator.platform;
    const isIOS = /iPad|iPhone|iPod/.test(ua) || (platform === "MacIntel" && navigator.maxTouchPoints > 1);
    setShowHaptics(isIOS);
  }, []);

  // Keep selectedBeat in range if numerator changes
  useEffect(() => {
    if (selectedBeat !== null && selectedBeat >= state.timeSignature.numerator) {
      setSelectedBeat(null);
    }
  }, [state.timeSignature.numerator, selectedBeat]);

  // Keyboard shortcuts
  useEffect(() => {
    if (!active) return;
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.code === "Space") { e.preventDefault(); }
      else if (e.code === "ArrowUp") { e.preventDefault(); adjustBpm(1); }
      else if (e.code === "ArrowDown") { e.preventDefault(); adjustBpm(-1); }
      else if (concertMode && (e.key === "t" || e.key === "T")) { e.preventDefault(); }
      else if (e.key === "t" || e.key === "T") tap();
      else if (e.key === "[") { e.preventDefault(); adjustBpm(-5); }
      else if (e.key === "]") { e.preventDefault(); adjustBpm(5); }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [active, adjustBpm, concertMode, tap]);

  const loadPreset = (idx: number) => {
    const p = METRONOME_PRESETS[idx];
    if (!p) return;
    setBpm(p.bpm);
    setTimeSignature({ numerator: p.timeSig[0], denominator: p.timeSig[1] });
    setSwing(p.swing);
    setPattern(p.pattern);
  };

  const resetDefault = () => {
    setBpm(100);
    setTimeSignature({ numerator: 4, denominator: 4 });
    setSwing(0);
    setPattern(buildDefaultPattern(4, 1));
    setPolyrhythm({
      enabled: false,
      main: 3,
      voices: [2],
      against: 2,
      dottedMode: "off",
      tripletMode: "off",
      rate: "double",
      polymeterEnabled: false,
      polymeterLanes: [
        { numerator: 4, denominator: 4 },
      ],
    });
    onViewChange("beatmap");
  };

  const handleViewChange = (next: MetronomeView) => {
    onViewChange(next);
    const firstPolymeterLane = state.polyrhythm.polymeterLanes[0] ?? {
      numerator: state.timeSignature.numerator,
      denominator: (state.timeSignature.denominator === 16 ? 16 : state.timeSignature.denominator === 8 ? 8 : 4) as MeterDenominator,
    };
    const starterPolymeterLanes = state.polyrhythm.polymeterLanes.length >= 2
      ? state.polyrhythm.polymeterLanes
      : [firstPolymeterLane, { numerator: 3, denominator: 8 }, { numerator: 5, denominator: 16 }] as PolymeterLane[];
    setPolyrhythm({
      enabled: next === "polyrhythm",
      polymeterEnabled: next === "polymeter",
      ...(next === "polymeter" ? { polymeterLanes: starterPolymeterLanes } : {}),
    });
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

  const openConcertMode = () => {
    const nextIndex = Math.min(concertIndex, Math.max(0, setlist.songs.length - 1));
    setConcertIndex(nextIndex);
    if (setlist.songs[nextIndex]) loadSong(setlist.songs[nextIndex]);
    setConcertMode(true);
  };

  const setAllPulseAccents = (accent: PulseAccent) => {
    setPattern((prev) => prev.map((beat) => ({
      ...beat,
      accents: Array.from({ length: beat.pulses }, () => accent),
    })));
  };

  const setlistBackupFileName = () => `${safeFileName(setlist.name || "groove-setlist")}.groove-setlist.json`;

  const exportSetlist = () => {
    const file = new Blob([JSON.stringify({ version: 1, exportedAt: new Date().toISOString(), setlist }, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(file);
    const link = document.createElement("a");
    link.href = url;
    link.download = setlistBackupFileName();
    link.click();
    URL.revokeObjectURL(url);
  };

  const shareSetlist = async () => {
    const payload = JSON.stringify({ version: 1, exportedAt: new Date().toISOString(), setlist }, null, 2);
    const file = new File([payload], setlistBackupFileName(), { type: "application/json" });
    const nav = navigator as Navigator & { canShare?: (data: ShareData) => boolean };
    if (navigator.share && (!nav.canShare || nav.canShare({ files: [file] }))) {
      await navigator.share({ title: setlist.name, text: "Groove Metronome setlist backup", files: [file] });
      return;
    }
    exportSetlist();
  };

  const importSetlist = async (file: File) => {
    const raw = await file.text();
    const parsed = JSON.parse(raw) as unknown;
    const incoming = readSetlistBackup(parsed);
    if (!incoming) return;
    if (!incoming || typeof incoming.name !== "string" || !Array.isArray(incoming.songs)) return;
    setSetlist({
      name: incoming.name,
      songs: incoming.songs.filter((song: SavedSong) => song && typeof song.name === "string").map((song: SavedSong) => ({
        ...song,
        id: song.id || `${Date.now()}-${Math.random().toString(16).slice(2)}`,
        pattern: song.pattern?.length ? song.pattern : buildDefaultPattern(song.timeSignature?.numerator ?? 4, 1),
        timeSignature: song.timeSignature ?? { numerator: 4, denominator: 4 },
        swing: song.swing ?? 0,
      })),
    });
  };

  const dominantSubdivision: SubdivisionCount | null = (() => {
    if (state.pattern.length === 0) return null;
    const first = state.pattern[0].pulses;
    return state.pattern.every((b) => b.pulses === first) ? first : null;
  })();

  if (concertMode) {
    return (
      <ConcertMode
        setlist={setlist}
        index={concertIndex}
        state={state}
        onClose={() => setConcertMode(false)}
        onSelectSong={(nextIndex) => {
          const safeIndex = clamp(nextIndex, 0, Math.max(0, setlist.songs.length - 1));
          setConcertIndex(safeIndex);
          const song = setlist.songs[safeIndex];
          if (song) loadSong(song);
        }}
        onToggle={toggle}
        onAdjustBpm={adjustBpm}
        onSetBpm={setBpm}
      />
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_340px] gap-8 lg:gap-12 pb-16">
      {/* HERO column */}
      <section className="space-y-5">
        <TempoHeaderStrip
          bpm={state.bpm}
          timeSignature={state.timeSignature}
          pattern={state.pattern}
          onSetBpm={setBpm}
          onSetTimeSignature={setTimeSignature}
          onSetSubdivision={setGlobalSubdivision}
        />

        <HeroPracticeBar
          practiceSeconds={state.practiceSeconds}
          targetMinutes={targetMinutes}
          onTargetMinutes={setTargetMinutes}
          onReset={resetDefault}
          onResetAccents={resetAccents}
        />

        <WheelStage
          view={view}
          pattern={state.pattern}
          polyrhythm={state.polyrhythm}
          bpm={state.bpm}
          isPlaying={state.isPlaying}
          currentBeat={state.currentBeat}
          currentPulse={state.currentPulse}
          currentPoly={state.currentPoly}
          onCycleBeatSubdivision={cycleBeatSubdivision}
          onCyclePulseAccent={cyclePulse}
          onTap={tap}
        />

        <TransportDeck
          state={state}
          onTap={tap}
          onToggle={toggle}
          onAdjustBpm={adjustBpm}
          onSetBpm={setBpm}
        />

        {/* Mode detail */}
        <div className="relative">
          {view === "beatmap" ? (
            <BeatMapRow
              bpm={state.bpm}
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
          ) : view === "levels" ? (
            <LevelMeters
              pattern={state.pattern}
              isPlaying={state.isPlaying}
              currentBeat={state.currentBeat}
              currentPulse={state.currentPulse}
              onCycleBeatSubdivision={cycleBeatSubdivision}
              onSetPulseLevel={setPulseLevel}
            />
          ) : view === "polyrhythm" ? (
            <PolyrhythmMode
              main={state.polyrhythm.main}
              voices={state.polyrhythm.voices}
              enabled={state.polyrhythm.enabled}
              isPlaying={state.isPlaying}
              currentBeat={state.currentBeat}
              currentPoly={state.currentPoly}
              onToggle={(enabled) => setPolyrhythm({ enabled })}
              onMain={(main) => setPolyrhythm({ main, enabled: true })}
              onVoices={(voices) => setPolyrhythm({ voices, enabled: true })}
              rate={state.polyrhythm.rate}
              onRate={(rate) => setPolyrhythm({ rate, enabled: true })}
            />
          ) : (
            <PolymeterPanel
              enabled={state.polyrhythm.polymeterEnabled}
              lanes={state.polyrhythm.polymeterLanes}
              onEnabled={(polymeterEnabled) => setPolyrhythm({ polymeterEnabled, enabled: false })}
              onLanes={(polymeterLanes) => setPolyrhythm({ polymeterLanes, polymeterEnabled: true, enabled: false })}
              framed
            />
          )}
        </div>

        <NotationStage
          view={view}
          pattern={state.pattern}
          polyrhythm={state.polyrhythm}
          timeSignature={state.timeSignature}
          currentBeat={state.currentBeat}
          currentPulse={state.currentPulse}
          currentPoly={state.currentPoly}
          isPlaying={state.isPlaying}
          onCyclePulse={cyclePulse}
          onCycleBeatSubdivision={cycleBeatSubdivision}
        />

        <QuickSetup
          status={state.isPlaying ? `Bar ${state.barCount + 1}` : "Stopped"}
          beatSound={state.beatSound}
          onBeatSoundChange={setBeatSound}
          onPresetChange={loadPreset}
          onResetAccents={resetAccents}
          onSetAllPulseAccents={setAllPulseAccents}
        />
      </section>

      {/* SIDEBAR column */}
      <aside className="space-y-4 lg:border-l lg:border-border lg:pl-10">
        <CollapsiblePanel title="Guide" summary="How this works" icon={<CircleHelp className="size-4" />} defaultOpen={false}>
          <AppGuide />
        </CollapsiblePanel>

        <VisualModePanel view={view} onChange={handleViewChange} />

        <RhythmAssistPanel
          dottedMode={state.polyrhythm.dottedMode}
          tripletMode={state.polyrhythm.tripletMode}
          onDottedMode={(dottedMode) => setPolyrhythm({ dottedMode })}
          onTripletMode={(tripletMode) => setPolyrhythm({ tripletMode })}
        />

        <CollapsiblePanel
          title="Subdivision"
          summary={dominantSubdivision ? `${SUBDIVISION_NOTATION[dominantSubdivision].label}` : "Mixed beats"}
          icon={<Waves className="size-4" />}
          defaultOpen={false}
        >
          <SubdivisionPalette
            bpm={state.bpm}
            dominantSubdivision={dominantSubdivision}
            onApply={setGlobalSubdivision}
            onReset={resetAccents}
          />
        </CollapsiblePanel>

        <CollapsiblePanel title="Patterns" summary="Apply rhythm tiles" icon={<Music2 className="size-4" />} defaultOpen={false}>
          <PatternTiles
            bpm={state.bpm}
            selectedBeat={selectedBeat}
            beatCount={state.timeSignature.numerator}
            onSelectBeat={setSelectedBeat}
            onApply={(pat, beatIndex) => {
              if (beatIndex === null) applyPatternToAll(pat);
              else applyPatternToBeat(beatIndex, pat);
            }}
          />
        </CollapsiblePanel>

        <CollapsiblePanel title="Sound" summary={BEAT_SOUND_LABELS[state.beatSound]} icon={<Volume2 className="size-4" />} defaultOpen={true}>
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

        {showHaptics && (
          <CollapsiblePanel
            title="Assist"
            summary={state.hapticsEnabled ? "Haptics on" : "Haptics off"}
            icon={<Hand className="size-4" />}
            trailing={<Switch aria-label="Haptic pulse" checked={state.hapticsEnabled} onCheckedChange={setHapticsEnabled} />}
            defaultOpen={false}
          >
            <p className="text-sm leading-relaxed text-muted-foreground">
              Haptics follow the main beat on supported iPhone and iPad browsers. Accents feel stronger, ghost notes lighter, and muted beats stay silent.
            </p>
          </CollapsiblePanel>
        )}

        <CollapsiblePanel title="Setlist Studio" summary={setlist.name} icon={<ListMusic className="size-4" />} defaultOpen={false}>
          <div className="space-y-3">
            <PremiumToolNote label="Setlist vault" body="Build a concert book, keep it in this browser, export a backup, and share it before a show." />
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
            <input
              ref={setlistImportRef}
              type="file"
              accept=".json,.groove-setlist.json,application/json"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void importSetlist(file);
                e.currentTarget.value = "";
              }}
            />
            <div className="grid grid-cols-3 gap-2">
              <SetlistAction label="Share" icon={<Share2 className="size-3.5" />} onClick={() => void shareSetlist()} />
              <SetlistAction label="Backup" icon={<Download className="size-3.5" />} onClick={exportSetlist} />
              <SetlistAction label="Restore" icon={<Upload className="size-3.5" />} onClick={() => setlistImportRef.current?.click()} />
            </div>
            <button
              type="button"
              disabled={setlist.songs.length === 0}
              onPointerDown={(e) => {
                e.preventDefault();
                if (setlist.songs.length > 0) openConcertMode();
              }}
              className="w-full rounded-md border border-primary bg-primary px-3 py-3 tiny-caps text-[10px] text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:border-border disabled:bg-muted/30 disabled:text-muted-foreground"
            >
              Concert Mode
            </button>
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
          icon={<TrendingUp className="size-4" />}
          trailing={<Switch checked={state.rampEnabled} onCheckedChange={setRampEnabled} />}
          defaultOpen
        >
          <PremiumToolNote label="Practice builder" body="Ramp gradually across a phrase so speed increases feel musical, not sudden." />
          <div className="mt-3 grid grid-cols-3 gap-2.5">
            <NumberField label="Start" value={state.rampConfig.startBpm} onChange={(v) => setRampConfig({ ...state.rampConfig, startBpm: clamp(v, 20, 300) })} />
            <NumberField label="End" value={state.rampConfig.endBpm} onChange={(v) => setRampConfig({ ...state.rampConfig, endBpm: clamp(v, 20, 300) })} />
            <NumberField label="Bars" value={state.rampConfig.durationBars} onChange={(v) => setRampConfig({ ...state.rampConfig, durationBars: Math.max(1, v) })} />
          </div>
          <label className="mt-3 flex min-h-11 items-center justify-between gap-3 rounded-md border border-border/70 bg-background/55 px-3">
            <span className="tiny-caps text-[10px] text-foreground/90">Loop ramp</span>
            <Switch checked={state.rampConfig.loop} onCheckedChange={(c) => setRampConfig({ ...state.rampConfig, loop: c })} />
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
          icon={<VolumeX className="size-4" />}
          trailing={<Switch checked={state.trainerEnabled} onCheckedChange={setTrainerEnabled} />}
          defaultOpen
        >
          <PremiumToolNote label="Inner clock" body="Alternate playing and silent bars to test whether your pulse survives without the click." />
          <div className="mt-3 grid grid-cols-2 gap-2.5">
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

function WheelStage({
  view,
  pattern,
  polyrhythm,
  bpm,
  isPlaying,
  currentBeat,
  currentPulse,
  currentPoly,
  onCycleBeatSubdivision,
  onCyclePulseAccent,
  onTap,
}: {
  view: MetronomeView;
  pattern: BeatPattern[];
  polyrhythm: PolyrhythmConfig;
  bpm: number;
  isPlaying: boolean;
  currentBeat: number;
  currentPulse: number;
  currentPoly: number;
  onCycleBeatSubdivision: (beatIndex: number) => void;
  onCyclePulseAccent: (beatIndex: number, pulseIndex: number) => void;
  onTap: () => void;
}) {
  const activePolymeterLane = view === "polymeter" && polyrhythm.polymeterEnabled
    ? polyrhythm.polymeterLanes[Math.max(0, currentPoly)] ?? polyrhythm.polymeterLanes[0]
    : null;
  const wheelPattern: BeatPattern[] = activePolymeterLane
    ? Array.from({ length: activePolymeterLane.numerator }, (_, index) => ({
      pulses: 1,
      accents: [index === 0 ? "accent" : "normal"],
    }))
    : view === "polyrhythm" && polyrhythm.enabled
      ? Array.from({ length: polyrhythm.main }, (_, index) => ({
        pulses: 1,
        accents: [index === 0 ? "accent" : "normal"],
      }))
      : pattern;

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-lg border border-border/70 bg-card/70 p-3 md:p-5",
        view === "polymeter" && "border-primary/35 bg-[linear-gradient(135deg,hsl(var(--primary)/0.12),hsl(var(--card)/0.74)_38%,hsl(var(--accent)/0.12))]",
      )}
    >
      <div className="relative flex justify-center">
        <PolyrhythmWheel
          pattern={wheelPattern}
          bpm={bpm}
          isPlaying={isPlaying}
          currentBeat={currentBeat}
          currentPulse={currentPulse}
          onCycleBeatSubdivision={onCycleBeatSubdivision}
          onCyclePulseAccent={onCyclePulseAccent}
          onTapTempo={onTap}
        />
      </div>
      {view === "polymeter" && polyrhythm.polymeterEnabled && (
        <PolymeterStackVisual
          lanes={polyrhythm.polymeterLanes}
          isPlaying={isPlaying}
          currentBeat={currentBeat}
          currentPoly={currentPoly}
        />
      )}
    </div>
  );
}

function PolymeterStackVisual({
  lanes,
  isPlaying,
  currentBeat,
  currentPoly,
}: {
  lanes: PolymeterLane[];
  isPlaying: boolean;
  currentBeat: number;
  currentPoly: number;
}) {
  const visibleLanes = lanes.slice(0, 4);
  const activeIndex = isPlaying && currentPoly >= 0 ? Math.min(currentPoly, visibleLanes.length - 1) : -1;
  const totalTicks = visibleLanes.reduce((sum, lane) => sum + polymeterLaneTicks(lane), 0) || 1;

  return (
    <div className="mt-4 rounded-lg border border-primary/25 bg-background/45 p-3 shadow-[0_0_34px_hsl(var(--primary)/0.10)] md:p-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <span className="tiny-caps block text-[10px] text-primary">Polymeter Phrase</span>
          <div className="mt-1 font-mono text-sm text-foreground">
            {visibleLanes.map((lane) => `${lane.numerator}/${lane.denominator}`).join(" -> ")}
          </div>
        </div>
        <div className="rounded-full border border-border/70 bg-card/60 px-3 py-1.5 font-mono text-xs text-muted-foreground">
          {Math.round(totalTicks)} sixteenth steps
        </div>
      </div>

      <div className="mt-4 flex h-2 overflow-hidden rounded-full bg-card">
        {visibleLanes.map((lane, laneIndex) => {
          const color = polymeterLaneColor(laneIndex);
          const activeStep = laneIndex === activeIndex;
          return (
            <div
              key={`${lane.numerator}-${lane.denominator}-${laneIndex}-rail`}
              className="h-full transition-all"
              style={{
                width: `${(polymeterLaneTicks(lane) / totalTicks) * 100}%`,
                background: activeStep ? color : `color-mix(in srgb, ${color} 42%, transparent)`,
                opacity: isPlaying && !activeStep ? 0.38 : 1,
              }}
            />
          );
        })}
      </div>

      <div className="mt-4 overflow-x-auto">
        <div className="flex min-w-max items-stretch gap-3">
          {visibleLanes.map((lane, laneIndex) => {
            const color = polymeterLaneColor(laneIndex);
            const activeStep = laneIndex === activeIndex;
            const dotSize = polymeterDotSize(lane.denominator);
            const cardWidth = lane.denominator === 4 ? "18rem" : lane.denominator === 8 ? "14rem" : "11rem";
            return (
              <div key={`${lane.numerator}-${lane.denominator}-${laneIndex}`} className="flex items-stretch gap-3">
                <div
                  className="relative overflow-hidden rounded-lg border p-3 transition-all"
                  style={{
                    width: cardWidth,
                    borderColor: activeStep ? color : "hsl(var(--border) / 0.65)",
                    background: activeStep
                      ? `linear-gradient(145deg, color-mix(in srgb, ${color} 20%, transparent), hsl(var(--card) / 0.82))`
                      : "hsl(var(--card) / 0.52)",
                    boxShadow: activeStep ? `0 0 0 1px ${color}, 0 16px 34px color-mix(in srgb, ${color} 18%, transparent)` : "none",
                  }}
                >
                  <div
                    className="absolute inset-y-0 left-0 w-1"
                    style={{ background: color, opacity: activeStep ? 1 : 0.54 }}
                    aria-hidden
                  />
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <span className="tiny-caps text-[9px] text-muted-foreground">Step {laneIndex + 1}</span>
                    <span className="font-serif text-2xl leading-none text-foreground">
                      {lane.numerator} <span className="text-muted-foreground">|</span> {lane.denominator}
                    </span>
                  </div>
                  <div className="mb-3 flex items-baseline justify-between gap-3">
                    <span className="font-mono text-xs text-muted-foreground">{polymeterUnitLabel(lane.denominator)}</span>
                    <span className="tiny-caps text-[9px]" style={{ color }}>{polymeterLaneTicks(lane)} ticks</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {Array.from({ length: lane.numerator }, (_, beatIndex) => {
                      const activeBeat = activeStep && currentBeat === beatIndex;
                      return (
                        <span
                          key={beatIndex}
                          className="grid place-items-center rounded-full border font-mono text-[10px] transition-all"
                          style={{
                            width: dotSize,
                            height: dotSize,
                            borderColor: activeBeat ? color : `color-mix(in srgb, ${color} 58%, hsl(var(--border)))`,
                            background: activeBeat ? color : `color-mix(in srgb, ${color} 16%, transparent)`,
                            color: activeBeat ? "hsl(var(--background))" : "hsl(var(--muted-foreground))",
                            boxShadow: activeBeat ? `0 0 18px ${color}` : "none",
                            transform: activeBeat ? "scale(1.12)" : "scale(1)",
                          }}
                        >
                          {lane.denominator === 16 ? "" : beatIndex + 1}
                        </span>
                      );
                    })}
                  </div>
                </div>
                {laneIndex < visibleLanes.length - 1 && (
                  <div className="flex w-7 items-center" aria-hidden>
                    <span className="h-px flex-1 bg-primary/45" />
                    <span className="size-2 rotate-45 border-r border-t border-primary/45" />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function polymeterLaneTicks(lane: PolymeterLane): number {
  return lane.numerator * (16 / lane.denominator);
}

function polymeterDotSize(denominator: MeterDenominator): string {
  if (denominator === 4) return "2.65rem";
  if (denominator === 8) return "1.85rem";
  return "1.15rem";
}

function polymeterUnitLabel(denominator: MeterDenominator): string {
  if (denominator === 4) return "quarter-note meter";
  if (denominator === 8) return "eighth-note meter";
  return "sixteenth-note meter";
}

function polymeterLaneColor(index: number): string {
  return ["hsl(var(--amber))", "hsl(var(--slate-cyan))", "hsl(338 82% 66%)", "hsl(var(--primary))"][index] ?? "hsl(var(--primary))";
}

function NotationStage({
  view,
  pattern,
  polyrhythm,
  timeSignature,
  currentBeat,
  currentPulse,
  currentPoly,
  isPlaying,
  onCyclePulse,
  onCycleBeatSubdivision,
}: {
  view: MetronomeView;
  pattern: BeatPattern[];
  polyrhythm: PolyrhythmConfig;
  timeSignature: TimeSignature;
  currentBeat: number;
  currentPulse: number;
  currentPoly: number;
  isPlaying: boolean;
  onCyclePulse: (beatIndex: number, pulseIndex: number) => void;
  onCycleBeatSubdivision: (beatIndex: number) => void;
}) {
  const previewHint = view === "polyrhythm" && polyrhythm.enabled
    ? `${polyrhythm.main}:${polyrhythm.voices.join(":") || polyrhythm.against}`
    : view === "polymeter" && polyrhythm.polymeterEnabled
    ? polyrhythm.polymeterLanes.map((lane) => `${lane.numerator}/${lane.denominator}`).join(" -> ")
    : `${timeSignature.numerator}/${timeSignature.denominator}`;

  return (
    <section className="rounded-lg border border-border/70 bg-card/55 p-4">
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <SectionLabel title="Notation Preview" hint={previewHint} />
        <span className="tiny-caps text-[10px] text-primary/85">touch notes</span>
      </div>
      <div className="notation-surface border border-border rounded-md px-3 py-3 overflow-x-auto shadow-[0_0_0_1px_hsl(var(--accent)/0.08)]">
        <NotationPanel
          view={view}
          pattern={pattern}
          polyrhythm={polyrhythm}
          timeSignature={timeSignature}
          currentBeat={currentBeat}
          currentPulse={currentPulse}
          currentPoly={currentPoly}
          isPlaying={isPlaying}
          onCyclePulse={onCyclePulse}
          onCycleBeatSubdivision={onCycleBeatSubdivision}
        />
      </div>
      <AssistNotationStrip dottedMode={polyrhythm.dottedMode} tripletMode={polyrhythm.tripletMode} />
    </section>
  );
}

function ConcertMode({
  setlist,
  index,
  state,
  onClose,
  onSelectSong,
  onToggle,
  onAdjustBpm,
  onSetBpm,
}: {
  setlist: SetlistState;
  index: number;
  state: UseMetronomeReturn["state"];
  onClose: () => void;
  onSelectSong: (index: number) => void;
  onToggle: () => void;
  onAdjustBpm: (delta: number) => void;
  onSetBpm: (bpm: number) => void;
}) {
  const song = setlist.songs[index] ?? null;
  const nextSong = setlist.songs[index + 1] ?? null;

  return (
    <section className="min-h-[calc(100vh-9rem)] space-y-4 pb-8">
      <div className="rounded-lg border border-primary/35 bg-card/80 p-4 md:p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <span className="tiny-caps text-[10px] text-muted-foreground">Concert Mode</span>
            <h2 className="mt-1 truncate font-serif text-3xl md:text-4xl">{setlist.name}</h2>
          </div>
          <button
            type="button"
            onPointerDown={(e) => { e.preventDefault(); onClose(); }}
            className="rounded-md border border-border bg-background/45 px-4 py-3 tiny-caps text-[10px] text-muted-foreground hover:border-primary hover:text-primary"
          >
            Exit
          </button>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="rounded-lg border border-border bg-card/70 p-4 md:p-6">
          <div className="grid min-h-[18rem] gap-5">
            <div>
              <span className="tiny-caps text-[10px] text-muted-foreground">Current song</span>
              <h3 className="mt-2 break-words font-serif text-5xl leading-none md:text-7xl">
                {song?.name ?? "No song saved"}
              </h3>
              <div className="mt-3 flex flex-wrap items-center gap-2 font-mono text-sm text-muted-foreground">
                <span>{index + 1}/{Math.max(1, setlist.songs.length)}</span>
                <span>·</span>
                <span>{state.timeSignature.numerator}/{state.timeSignature.denominator}</span>
                {nextSong && (
                  <>
                    <span>·</span>
                    <span className="truncate">Next: {nextSong.name}</span>
                  </>
                )}
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-[1fr_auto_1fr] sm:items-end">
              <StageButton
                label="Previous"
                icon={<ChevronLeft className="size-6" />}
                disabled={index <= 0}
                onClick={() => onSelectSong(index - 1)}
              />
              <button
                type="button"
                onPointerDown={(e) => { e.preventDefault(); onToggle(); }}
                className={
                  "min-h-28 rounded-lg border px-8 py-5 font-serif text-4xl transition-colors " +
                  (state.isPlaying
                    ? "border-destructive bg-destructive/15 text-destructive hover:bg-destructive/20"
                    : "border-primary bg-primary text-primary-foreground hover:bg-primary/90")
                }
              >
                {state.isPlaying ? "Stop" : "Start"}
              </button>
              <StageButton
                label="Next"
                icon={<ChevronRight className="size-6" />}
                disabled={index >= setlist.songs.length - 1}
                onClick={() => onSelectSong(index + 1)}
              />
            </div>
          </div>
        </div>

        <aside className="space-y-4">
          <div className="rounded-lg border border-border bg-card/70 p-4">
            <span className="tiny-caps text-[10px] text-muted-foreground">Live tempo</span>
            <div className="mt-2 font-serif text-6xl leading-none text-primary">{Math.round(state.bpm)}</div>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <StageButton label="-1" onClick={() => onAdjustBpm(-1)} compact />
              <StageButton label="+1" onClick={() => onAdjustBpm(1)} compact />
              <StageButton label="-5" onClick={() => onAdjustBpm(-5)} compact />
              <StageButton label="+5" onClick={() => onAdjustBpm(5)} compact />
            </div>
          </div>

          <ConcertTapPreview onSetBpm={onSetBpm} />

          <div className="rounded-lg border border-border bg-card/70 p-4">
            <span className="tiny-caps text-[10px] text-muted-foreground">Practice time</span>
            <div className="mt-2 font-mono text-3xl tabular text-foreground">{formatTime(state.practiceSeconds)}</div>
            <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
              Setlist is saved locally and can be shared or backed up from Setlist Studio.
            </p>
          </div>
        </aside>
      </div>
    </section>
  );
}

function ConcertTapPreview({ onSetBpm }: { onSetBpm: (bpm: number) => void }) {
  const tapsRef = useRef<number[]>([]);
  const [preview, setPreview] = useState<{ count: number; bpm: number | null }>({ count: 0, bpm: null });

  const tapPreview = () => {
    const now = performance.now();
    const taps = tapsRef.current;
    if (taps.length > 0 && now - taps[taps.length - 1] > 2500) taps.length = 0;
    taps.push(now);
    if (taps.length > 8) taps.shift();
    if (taps.length < 2) {
      setPreview({ count: taps.length, bpm: null });
      return;
    }
    const intervals: number[] = [];
    for (let i = 1; i < taps.length; i++) intervals.push(taps[i] - taps[i - 1]);
    const avg = intervals.reduce((a, b) => a + b, 0) / intervals.length;
    const bpm = clamp(Math.round(60000 / avg), 20, 300);
    setPreview({ count: taps.length, bpm });
  };

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      const target = event.target;
      const editable = target instanceof HTMLInputElement
        || target instanceof HTMLSelectElement
        || target instanceof HTMLTextAreaElement
        || (target instanceof HTMLElement && target.isContentEditable);
      if (editable || (event.key !== "t" && event.key !== "T")) return;
      event.preventDefault();
      tapPreview();
    };
    window.addEventListener("keydown", handler, { capture: true });
    return () => window.removeEventListener("keydown", handler, { capture: true });
  });

  return (
    <div className="rounded-lg border border-border bg-card/70 p-4">
      <span className="tiny-caps text-[10px] text-muted-foreground">Tap preview</span>
      <button
        type="button"
        onPointerDown={(e) => { e.preventDefault(); tapPreview(); }}
        className="mt-2 min-h-24 w-full rounded-lg border border-primary/60 bg-primary/10 font-serif text-3xl text-primary transition-colors hover:bg-primary/15"
      >
        Tap
      </button>
      <div className="mt-3 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
        <div>
          <span className="block font-mono text-3xl tabular text-foreground">{preview.bpm ? `${preview.bpm}` : "—"}</span>
          <span className="tiny-caps text-[10px] text-muted-foreground">{preview.count} taps · preview only</span>
        </div>
        <button
          type="button"
          disabled={!preview.bpm}
          onPointerDown={(e) => {
            e.preventDefault();
            if (preview.bpm) onSetBpm(preview.bpm);
          }}
          className="min-h-14 rounded-md border border-primary bg-primary px-4 tiny-caps text-[10px] text-primary-foreground disabled:cursor-not-allowed disabled:border-border disabled:bg-muted/30 disabled:text-muted-foreground"
        >
          Use BPM
        </button>
      </div>
    </div>
  );
}

function StageButton({
  label,
  icon,
  disabled,
  compact = false,
  onClick,
}: {
  label: string;
  icon?: ReactNode;
  disabled?: boolean;
  compact?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onPointerDown={(e) => {
        e.preventDefault();
        if (!disabled) onClick();
      }}
      className={
        "inline-flex items-center justify-center gap-2 rounded-lg border border-border bg-background/45 font-mono text-foreground transition-colors hover:border-primary hover:text-primary disabled:cursor-not-allowed disabled:opacity-35 " +
        (compact ? "min-h-14 px-4 text-xl" : "min-h-20 px-5 text-lg")
      }
    >
      {icon}
      {label}
    </button>
  );
}

function HeroPracticeBar({
  practiceSeconds,
  targetMinutes,
  onTargetMinutes,
  onReset,
  onResetAccents,
}: {
  practiceSeconds: number;
  targetMinutes: number;
  onTargetMinutes: (minutes: number) => void;
  onReset: () => void;
  onResetAccents: () => void;
}) {
  const progress = targetMinutes > 0 ? Math.min(100, (practiceSeconds / (targetMinutes * 60)) * 100) : 0;
  return (
    <section className="rounded-lg border border-primary/35 bg-primary/10 p-4 md:p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <span className="tiny-caps block text-[10px] text-muted-foreground">Practice Timer</span>
          <span className="font-serif text-5xl leading-none tabular text-foreground">{formatTime(practiceSeconds)}</span>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <NumberField label="Target min" value={targetMinutes} onChange={(v) => onTargetMinutes(Math.max(0, v))} compact />
          <div className="flex items-end gap-1.5">
            <button
              type="button"
              onPointerDown={(e) => { e.preventDefault(); onReset(); }}
              className="inline-flex min-h-8 items-center gap-1.5 rounded-sm border border-primary/70 bg-primary/10 px-2.5 py-1.5 tiny-caps text-[9px] text-primary transition-colors hover:bg-primary/15"
            >
              <RotateCcw className="size-3.5" />
              Reset 4/4
            </button>
            <button
              type="button"
              onPointerDown={(e) => { e.preventDefault(); onResetAccents(); }}
              className="min-h-8 rounded-sm border border-border/70 bg-background/40 px-2.5 py-1.5 tiny-caps text-[9px] text-muted-foreground transition-colors hover:border-primary/70 hover:text-primary"
            >
              Reset accents
            </button>
          </div>
        </div>
      </div>
      {targetMinutes > 0 && (
        <div className="mt-4 h-1 overflow-hidden rounded-full bg-background/65">
          <div className="h-full rounded-full bg-primary transition-all duration-1000" style={{ width: `${progress}%` }} />
        </div>
      )}
    </section>
  );
}

function AssistNotationStrip({ dottedMode, tripletMode }: { dottedMode: DottedPlaybackMode; tripletMode: TripletAssistMode }) {
  const items = [
    dottedMode !== "off" ? assistNotationForDotted(dottedMode) : null,
    tripletMode !== "off" ? assistNotationForTriplet(tripletMode) : null,
  ].filter(Boolean) as Array<{ label: string; glyph: string; detail: string }>;
  if (items.length === 0) return null;
  return (
    <div className="mt-3 grid gap-2 sm:grid-cols-2">
      {items.map((item) => (
        <div key={item.label} className="rounded-md border border-border/70 bg-background/55 px-3 py-2">
          <span className="tiny-caps block text-[9px] text-muted-foreground">{item.label}</span>
          <span className="mt-1 flex items-baseline gap-3">
            <span className="font-serif text-3xl leading-none text-primary">{item.glyph}</span>
            <span className="font-mono text-xs text-muted-foreground">{item.detail}</span>
          </span>
        </div>
      ))}
    </div>
  );
}

function assistNotationForDotted(mode: DottedPlaybackMode) {
  if (mode === "quarter") return { label: "Dotted Assist", glyph: "♩.", detail: "dotted quarter pulse" };
  if (mode === "eighth") return { label: "Dotted Assist", glyph: "♪.", detail: "dotted eighth pulse" };
  return { label: "Dotted Assist", glyph: "♬.", detail: "dotted sixteenth pulse" };
}

function assistNotationForTriplet(mode: TripletAssistMode) {
  if (mode === "half") return { label: "Triplet Assist", glyph: "𝅗𝅥³", detail: "3 across the bar" };
  if (mode === "quarter") return { label: "Triplet Assist", glyph: "♩³", detail: "quarter-note triplets" };
  if (mode === "eighth") return { label: "Triplet Assist", glyph: "♪³", detail: "eighth-note triplets" };
  return { label: "Triplet Assist", glyph: "♬⁶", detail: "sextuplets" };
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
          onDoubleClick={() => onSetBpm(100)}
          title="Double-click to reset to 100 BPM"
        />
      </div>
    </div>
  );
}

function QuickSetup({
  status,
  beatSound,
  onBeatSoundChange,
  onPresetChange,
  onResetAccents,
  onSetAllPulseAccents,
}: {
  status: string;
  beatSound: UseMetronomeReturn["state"]["beatSound"];
  onBeatSoundChange: (sound: UseMetronomeReturn["state"]["beatSound"]) => void;
  onPresetChange: (idx: number) => void;
  onResetAccents: () => void;
  onSetAllPulseAccents: (accent: PulseAccent) => void;
}) {
  return (
    <div className="rounded-lg border border-border/70 bg-card/80 p-4 md:p-5 shadow-[0_1px_0_hsl(var(--accent)/0.08)]">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <SectionLabel title="Quick Setup" hint={status} />
        </div>
        <div className="flex flex-wrap gap-2">
          <SetupPill label="Sound" value={BEAT_SOUND_LABELS[beatSound]} />
        </div>
      </div>
      <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
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
      <div className="mt-3 rounded-md border border-border/60 bg-background/30 p-2">
        <div className="mb-2 tiny-caps text-[10px] text-muted-foreground">Make every pulse</div>
        <div className="grid grid-cols-3 gap-1.5">
          <UniformAccentButton label="Loud" onClick={() => onSetAllPulseAccents("accent")} />
          <UniformAccentButton label="Soft" onClick={() => onSetAllPulseAccents("normal")} />
          <UniformAccentButton label="Softer" onClick={() => onSetAllPulseAccents("ghost")} />
        </div>
      </div>
      <button
        type="button"
        onPointerDown={(e) => { e.preventDefault(); onResetAccents(); }}
        className="tiny-caps mt-3 text-[10px] text-muted-foreground hover:text-primary"
      >
        Reset accents
      </button>
    </div>
  );
}

function UniformAccentButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onPointerDown={(e) => {
        e.preventDefault();
        onClick();
      }}
      className="rounded-sm border border-border/70 px-2 py-2 tiny-caps text-[10px] text-muted-foreground transition-colors hover:border-primary hover:bg-primary/10 hover:text-primary"
    >
      {label}
    </button>
  );
}

function SetupPill({ label, value }: { label: string; value: string }) {
  return (
    <span className="rounded-full border border-border/70 bg-background/70 px-3 py-1.5">
      <span className="tiny-caps mr-2 text-[9px] text-muted-foreground/90">{label}</span>
      <span className="font-mono text-xs text-foreground">{value}</span>
    </span>
  );
}

function SelectField({ label, trailing, children }: { label: string; trailing?: ReactNode; children: ReactNode }) {
  return (
    <div className="rounded-md border border-border/70 bg-background/65 p-3">
      <div className="mb-2 flex items-center justify-between gap-3">
        <span className="tiny-caps text-xs text-foreground/85">{label}</span>
        {trailing}
      </div>
      {children}
    </div>
  );
}

function AppGuide() {
  return (
    <div className="space-y-3 text-sm leading-relaxed text-muted-foreground">
      <GuideRow
        icon={<Gauge className="size-4" />}
        title="Start"
        body="Tap the tempo, meter, or subdivision cards at the top to edit the essentials."
      />
      <GuideRow
        icon={<Waves className="size-4" />}
        title="Shape"
        body="Use Beat Map for per-beat subdivisions, Levels for accents, and Polyrhythm for layered pulses."
      />
      <GuideRow
        icon={<Music2 className="size-4" />}
        title="Listen"
        body="Choose a sound, then use pitch and swing only when the click needs a different feel."
      />
      <GuideRow
        icon={<SlidersHorizontal className="size-4" />}
        title="Practice"
        body="Setlists, ramping, muting, haptics, and timer live on the right so the wheel stays clean."
      />
    </div>
  );
}

function GuideRow({ icon, title, body }: { icon: ReactNode; title: string; body: string }) {
  return (
    <div className="grid grid-cols-[1.75rem_minmax(0,1fr)] gap-3">
      <span className="mt-0.5 text-primary" aria-hidden>{icon}</span>
      <span>
        <span className="tiny-caps block text-[10px] text-foreground">{title}</span>
        <span>{body}</span>
      </span>
    </div>
  );
}

function safeFileName(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "groove-setlist";
}

function readSetlistBackup(value: unknown): SetlistState | null {
  if (!value || typeof value !== "object") return null;
  const candidate = value as { name?: unknown; songs?: unknown; setlist?: unknown };
  const setlist = candidate.setlist && typeof candidate.setlist === "object"
    ? candidate.setlist as { name?: unknown; songs?: unknown }
    : candidate;
  if (typeof setlist.name !== "string" || !Array.isArray(setlist.songs)) return null;
  return setlist as SetlistState;
}

function IconButton({
  label,
  onPress,
  disabled = false,
  children,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      disabled={disabled}
      onPointerDown={(e) => {
        e.preventDefault();
        if (!disabled) onPress();
      }}
      className="grid size-8 place-items-center rounded-sm border border-border/70 bg-card/65 text-muted-foreground transition-colors hover:border-primary/70 hover:text-primary disabled:cursor-not-allowed disabled:opacity-35"
    >
      {children}
    </button>
  );
}

function SetlistAction({ label, icon, onClick }: { label: string; icon: ReactNode; onClick: () => void }) {
  return (
    <button
      type="button"
      onPointerDown={(e) => {
        e.preventDefault();
        onClick();
      }}
      className="tiny-caps flex min-h-9 items-center justify-center gap-1.5 rounded-sm border border-border/70 bg-background/35 px-2 text-[10px] text-muted-foreground transition-colors hover:border-primary/70 hover:text-primary"
    >
      {icon}
      {label}
    </button>
  );
}

function VisualModePanel({ view, onChange }: { view: MetronomeView; onChange: (view: MetronomeView) => void }) {
  return (
    <div className="rounded-md border border-border/70 bg-card/50 p-4">
      <SectionLabel title="View" hint={MODE_OPTIONS.find((option) => option.id === view)?.label} />
      <div className="mt-3 grid gap-2">
        {MODE_OPTIONS.map((option) => {
          const active = view === option.id;
          return (
            <button
              key={option.id}
              type="button"
              onPointerDown={(e) => { e.preventDefault(); onChange(option.id); }}
              className={
                "grid min-h-16 grid-cols-[2.25rem_minmax(0,1fr)] items-center gap-3 rounded-md border px-3 py-3 text-left transition-colors " +
                (active
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border/60 text-muted-foreground hover:border-accent/70 hover:text-foreground")
              }
              aria-pressed={active}
            >
              <span
                className="grid size-9 place-items-center rounded-full border"
                style={{
                  borderColor: active ? "hsl(var(--primary))" : "hsl(var(--border))",
                  background: active ? "hsl(var(--primary) / 0.14)" : "hsl(var(--background) / 0.35)",
                }}
              >
                {MODE_ICON[option.id]}
              </span>
              <span className="min-w-0">
                <span className="block font-serif text-xl leading-none">{option.label}</span>
                <span className="tiny-caps mt-1 block text-[10px] leading-relaxed">{option.detail}</span>
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function RhythmAssistPanel({
  dottedMode,
  tripletMode,
  onDottedMode,
  onTripletMode,
}: {
  dottedMode: DottedPlaybackMode;
  tripletMode: TripletAssistMode;
  onDottedMode: (mode: DottedPlaybackMode) => void;
  onTripletMode: (mode: TripletAssistMode) => void;
}) {
  const activeHint = [
    dottedMode !== "off" ? DOTTED_PLAYBACK_LABELS[dottedMode] : null,
    tripletMode !== "off" ? TRIPLET_ASSIST_LABELS[tripletMode] : null,
  ].filter(Boolean).join(" + ") || "Off";

  return (
    <CollapsiblePanel title="Rhythm Assist" summary={activeHint} icon={<Timer className="size-4" />} defaultOpen={false}>
      <div className="space-y-3">
        <SelectField label="Dotted Playback">
          <select
            value={dottedMode}
            onChange={(e) => onDottedMode(e.target.value as DottedPlaybackMode)}
            className="metronome-select"
            aria-label="Dotted playback mode"
          >
            {(Object.keys(DOTTED_PLAYBACK_LABELS) as DottedPlaybackMode[]).map((mode) => (
              <option key={mode} value={mode} className="bg-background">
                {DOTTED_PLAYBACK_LABELS[mode]}
              </option>
            ))}
          </select>
        </SelectField>
        <SelectField label="Triplet Assistant">
          <select
            value={tripletMode}
            onChange={(e) => onTripletMode(e.target.value as TripletAssistMode)}
            className="metronome-select"
            aria-label="Triplet assistant mode"
          >
            {(Object.keys(TRIPLET_ASSIST_LABELS) as TripletAssistMode[]).map((mode) => (
              <option key={mode} value={mode} className="bg-background">
                {TRIPLET_ASSIST_LABELS[mode]}
              </option>
            ))}
          </select>
        </SelectField>
      </div>
    </CollapsiblePanel>
  );
}

function PolymeterPanel({
  enabled,
  lanes,
  onEnabled,
  onLanes,
  framed = false,
}: {
  enabled: boolean;
  lanes: PolymeterLane[];
  onEnabled: (enabled: boolean) => void;
  onLanes: (lanes: PolymeterLane[]) => void;
  framed?: boolean;
}) {
  const setLane = (index: number, patch: Partial<PolymeterLane>) => {
    onLanes(lanes.map((lane, i) => i === index ? { ...lane, ...patch } : lane));
  };
  const addLane = () => {
    if (lanes.length >= 4) return;
    onLanes([...lanes, { numerator: lanes.length === 1 ? 3 : 5, denominator: lanes.length === 1 ? 8 : 16 }]);
  };
  const addLaneFrom = (lane: PolymeterLane) => {
    if (lanes.length >= 4) {
      onLanes([...lanes.slice(0, 3), lane]);
      return;
    }
    onLanes([...lanes, lane]);
  };
  const insertLaneAfter = (index: number, lane: PolymeterLane) => {
    if (lanes.length >= 4) {
      onLanes([...lanes.slice(0, index + 1), lane, ...lanes.slice(index + 1, 3)]);
      return;
    }
    onLanes([...lanes.slice(0, index + 1), lane, ...lanes.slice(index + 1)]);
  };
  const removeLane = (index: number) => {
    if (lanes.length <= 1) return;
    onLanes(lanes.filter((_, i) => i !== index));
  };
  const quickStacks: Array<{ label: string; lanes: PolymeterLane[] }> = [
    { label: "4/4 -> 3/8 -> 5/16", lanes: [{ numerator: 4, denominator: 4 }, { numerator: 3, denominator: 8 }, { numerator: 5, denominator: 16 }] },
    { label: "4/4 -> 4/8 -> 4/16", lanes: [{ numerator: 4, denominator: 4 }, { numerator: 4, denominator: 8 }, { numerator: 4, denominator: 16 }] },
    { label: "5/4 -> 5/8 -> 5/16", lanes: [{ numerator: 5, denominator: 4 }, { numerator: 5, denominator: 8 }, { numerator: 5, denominator: 16 }] },
    { label: "4/4 -> 7/8", lanes: [{ numerator: 4, denominator: 4 }, { numerator: 7, denominator: 8 }] },
  ];
  const quickMeters: PolymeterLane[] = [
    { numerator: 3, denominator: 4 },
    { numerator: 4, denominator: 4 },
    { numerator: 5, denominator: 4 },
    { numerator: 5, denominator: 8 },
    { numerator: 7, denominator: 8 },
    { numerator: 3, denominator: 16 },
    { numerator: 5, denominator: 16 },
  ];
  const summary = enabled ? lanes.map((lane) => `${lane.numerator}/${lane.denominator}`).join(" -> ") : "Hidden";

  const content = (
    <>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <span className="tiny-caps block text-[10px] text-primary">Phrase chain</span>
          <p className="mt-1 font-mono text-sm text-primary">{lanes.map((lane) => `${lane.numerator}/${lane.denominator}`).join(" -> ")}</p>
        </div>
        <Switch checked={enabled} onCheckedChange={onEnabled} />
      </div>

      <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
        Polymeter plays one meter, then feeds into the next meter, then loops the whole chain as one phrase.
      </p>

      <div className="mt-4 space-y-4">
        <div>
          <span className="tiny-caps block text-[10px] text-muted-foreground">Start chain</span>
          <div className="mt-2 grid gap-2">
            {quickStacks.map((stack) => (
              <button
                key={stack.label}
                type="button"
                onPointerDown={(e) => {
                  e.preventDefault();
                  onEnabled(true);
                  onLanes(stack.lanes);
                }}
                className="rounded-sm border border-border/70 bg-background/55 px-3 py-2.5 text-left font-mono text-sm text-muted-foreground transition-colors hover:border-primary/70 hover:text-primary"
                style={{
                  background: "linear-gradient(135deg, hsl(var(--background) / 0.66), hsl(var(--primary) / 0.07))",
                }}
              >
                {stack.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <span className="tiny-caps block text-[10px] text-muted-foreground">Add step</span>
          <div className="mt-2 flex flex-wrap gap-2">
            {quickMeters.map((meter) => (
              <button
                key={`${meter.numerator}/${meter.denominator}`}
                type="button"
                onPointerDown={(e) => {
                  e.preventDefault();
                  onEnabled(true);
                  addLaneFrom(meter);
                }}
                className="rounded-full border border-border/70 bg-background/55 px-3 py-2 font-mono text-sm text-muted-foreground transition-colors hover:border-accent/70 hover:text-foreground"
              >
                {meter.numerator}/{meter.denominator}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-3">
          {lanes.map((lane, index) => (
            <div
              key={`${lane.numerator}-${lane.denominator}-${index}`}
              className="rounded-md border bg-background/35 p-3"
              style={{ borderColor: `color-mix(in srgb, ${polymeterLaneColor(index)} 34%, hsl(var(--border)))` }}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <span className="tiny-caps block text-[10px]" style={{ color: polymeterLaneColor(index) }}>Step {index + 1}</span>
                  <span className="mt-1 block font-serif text-3xl leading-none text-foreground">
                    {lane.numerator} <span className="text-muted-foreground">|</span> {lane.denominator}
                  </span>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <IconButton
                    label={`Duplicate step ${lane.numerator}/${lane.denominator}`}
                    onPress={() => insertLaneAfter(index, lane)}
                    disabled={lanes.length >= 4}
                  >
                    <Copy className="size-4" />
                  </IconButton>
                  <IconButton
                    label={`Add step after ${index + 1}`}
                    onPress={() => insertLaneAfter(index, { numerator: 4, denominator: lane.denominator })}
                    disabled={lanes.length >= 4}
                  >
                    <Plus className="size-4" />
                  </IconButton>
                  <IconButton
                    label={`Remove step ${index + 1}`}
                    onPress={() => removeLane(index)}
                    disabled={lanes.length <= 1}
                  >
                    <X className="size-4" />
                  </IconButton>
                </div>
              </div>
              <PolymeterLanePreview lane={lane} active={enabled} index={index} />
              <div className="mt-3 grid grid-cols-[minmax(0,1fr)_5.25rem] gap-2">
                <NumberField
                  label="Beats"
                  value={lane.numerator}
                  compact
                  onChange={(value) => setLane(index, { numerator: clamp(value, 1, 16) })}
                />
                <SelectField label="Unit">
                  <select
                    value={lane.denominator}
                    onChange={(e) => setLane(index, { denominator: Number(e.target.value) as MeterDenominator })}
                    className="metronome-select"
                    aria-label={`Step ${index + 1} denominator`}
                  >
                    {[4, 8, 16].map((denom) => (
                      <option key={denom} value={denom} className="bg-background">/{denom}</option>
                    ))}
                  </select>
                </SelectField>
              </div>
            </div>
          ))}
        </div>

        {lanes.length < 4 && (
          <button
            type="button"
            onPointerDown={(e) => { e.preventDefault(); onEnabled(true); addLane(); }}
            className="w-full rounded-sm border border-border/70 px-3 py-3 tiny-caps text-[10px] text-muted-foreground hover:text-primary"
          >
            Add meter step
          </button>
        )}
      </div>
    </>
  );

  if (framed) {
    return (
      <section className="rounded-lg border border-border/70 bg-card/60 p-4">
        <SectionLabel title="Polymeter" hint={summary} />
        <div className="mt-4">{content}</div>
      </section>
    );
  }

  return (
    <CollapsiblePanel title="Polymeter" summary={summary} icon={<PolymeterGlyph />} defaultOpen={false}>
      {content}
    </CollapsiblePanel>
  );
}

function PolymeterGlyph() {
  return (
    <svg viewBox="0 0 24 24" className="size-4" aria-hidden>
      <path d="M4 7h5M9 7l3 5-3 5H4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M13 7h7M13 12h5M13 17h7" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function CollapsiblePanel({
  title,
  summary,
  defaultOpen = false,
  trailing,
  icon,
  children,
}: {
  title: string;
  summary?: string;
  defaultOpen?: boolean;
  trailing?: ReactNode;
  icon?: ReactNode;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <Collapsible open={open} onOpenChange={setOpen} className="rounded-md border border-border/70 bg-card/50">
      <div className="flex items-center gap-2 px-4 py-3">
        <CollapsibleTrigger className="group flex min-w-0 flex-1 items-center justify-between gap-3 text-left">
          <span className="grid min-w-0 grid-cols-[auto_minmax(0,1fr)] items-center gap-3">
            {icon && <span className="text-primary/85" aria-hidden>{icon}</span>}
            <span className="min-w-0">
              <span className="tiny-caps block text-xs text-foreground">{title}</span>
              {summary && <span className="mt-1 block truncate font-mono text-xs text-muted-foreground">{summary}</span>}
            </span>
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

function SubdivisionPalette({
  bpm,
  dominantSubdivision,
  onApply,
  onReset,
}: {
  bpm: number;
  dominantSubdivision: SubdivisionCount | null;
  onApply: (subdivision: SubdivisionCount) => void;
  onReset: () => void;
}) {
  const options = subdivisionOptionsForBpm(bpm);
  return (
    <div className="rounded-md border border-border/70 bg-card/60 p-4">
      <SectionLabel
        title="Subdivision"
        hint={dominantSubdivision ? `${dominantSubdivision}` : "mixed"}
      />
      <div className="mt-3 grid grid-cols-2 xl:grid-cols-1 gap-1.5">
        {options.map((n) => {
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

function BeatMapRow({
  bpm,
  pattern,
  isPlaying,
  currentBeat,
  currentPulse,
  onSetSubdivision,
  onCyclePulse,
}: {
  bpm: number;
  pattern: BeatPattern[];
  isPlaying: boolean;
  currentBeat: number;
  currentPulse: number;
  onSetSubdivision: (beatIndex: number, pulses: SubdivisionCount) => void;
  onCyclePulse: (beatIndex: number, pulseIndex: number) => void;
}) {
  const options = subdivisionOptionsForBpm(bpm);
  return (
    <div className="rounded-lg border border-border/70 bg-card/60 p-4">
      <SectionLabel title="Beat Map" hint="beats in one row" />
      <div className="mt-4 overflow-x-auto pb-2">
        <div className="grid min-w-max auto-cols-[minmax(150px,1fr)] grid-flow-col gap-3">
        {pattern.map((beat, beatIndex) => {
          const activeBeat = isPlaying && currentBeat === beatIndex;
          const color = subdivisionColor(beat.pulses, activeBeat ? 0.74 : 0.48);
          return (
            <div
              key={beatIndex}
              className={
                "rounded-md border p-3 transition-colors " +
                (activeBeat ? "bg-background/65" : "bg-background/35")
              }
              style={{ borderColor: color }}
            >
              <div className="flex flex-col items-center gap-3">
                  <span
                    className="relative grid size-14 place-items-center rounded-full border"
                    style={{
                      background: subdivisionBackground(beat, activeBeat),
                      borderColor: color,
                    }}
                  >
                    <span className="absolute inset-[30%] rounded-full bg-background/90" />
                    <span className="relative font-serif text-2xl leading-none">{beatIndex + 1}</span>
                  </span>
                <div className="text-center">
                  <span className="tiny-caps block text-[9px] text-muted-foreground">Beat {beatIndex + 1}</span>
                  <span className="font-mono text-sm tabular">{beat.pulses} pulse{beat.pulses > 1 ? "s" : ""}</span>
                </div>
              </div>
              <div className="mt-3">
                <select
                  value={beat.pulses}
                  onChange={(e) => onSetSubdivision(beatIndex, Number(e.target.value) as SubdivisionCount)}
                  className="metronome-select min-h-10 text-xs"
                  aria-label={`Subdivision for beat ${beatIndex + 1}`}
                >
                  {options.map((n) => (
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
                      className="min-h-10 rounded-sm border text-center font-mono text-sm transition-colors"
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
    </div>
  );
}

function subdivisionOptionsForBpm(bpm: number): SubdivisionCount[] {
  if (bpm <= 80) return [1, 2, 3, 4, 5, 6, 7, 8];
  if (bpm <= 100) return [1, 2, 3, 4, 5];
  return [1, 2, 3, 4];
}

function PremiumToolNote({ label, body }: { label: string; body: string }) {
  return (
    <div className="rounded-md border border-primary/45 bg-[linear-gradient(135deg,hsl(var(--primary)/0.16),hsl(var(--background)/0.72))] p-3 shadow-[0_0_0_1px_hsl(var(--background)/0.32)_inset]">
      <span className="tiny-caps text-[9px] text-primary">{label}</span>
      <p className="mt-1 text-sm leading-relaxed text-foreground/88">{body}</p>
    </div>
  );
}

function PolyrhythmMode({
  main,
  voices,
  enabled,
  rate,
  isPlaying,
  currentBeat,
  currentPoly,
  onToggle,
  onMain,
  onVoices,
  onRate,
}: {
  main: number;
  voices: number[];
  enabled: boolean;
  rate: PolyrhythmRate;
  isPlaying: boolean;
  currentBeat: number;
  currentPoly: number;
  onToggle: (enabled: boolean) => void;
  onMain: (main: number) => void;
  onVoices: (voices: number[]) => void;
  onRate: (rate: PolyrhythmRate) => void;
}) {
  const allVoices = [main, ...voices].slice(0, 4);
  const sharedSlots = lcmMany(allVoices);
  const mainStep = sharedSlots / main;
  const crossStep = sharedSlots / (voices[0] ?? 2);
  const mainActiveSlot = currentBeat >= 0 ? (currentBeat % main) * mainStep : -1;
  const crossActiveSlot = currentPoly >= 0 ? (currentPoly % (voices[0] ?? 2)) * crossStep : -1;
  const pairLabel = `${main}:${voices.join(":")}`;

  const setVoice = (index: number, value: number) => {
    const next = [...voices];
    next[index] = clamp(value, 2, 16);
    onVoices(next);
  };

  const addVoice = () => {
    if (voices.length >= 3) return;
    onVoices([...voices, voices[voices.length - 1] + 1 || 3]);
  };

  const removeVoice = (index: number) => {
    if (voices.length <= 1) return;
    onVoices(voices.filter((_, i) => i !== index));
  };

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
              {pairLabel}
            </span>
            <span className="tiny-caps mb-2 text-xs text-muted-foreground">
              {sharedSlots} shared LCM slots
            </span>
          </div>
          <div className="mt-4 inline-grid grid-cols-2 rounded-md border border-border/70 bg-background/35 p-1">
            {[
              ["double", "Double"],
              ["pulse", "Pulse"],
            ].map(([id, label]) => {
              const active = rate === id;
              return (
                <button
                  key={id}
                  type="button"
                  onPointerDown={(e) => {
                    e.preventDefault();
                    onRate(id as PolyrhythmRate);
                  }}
                  className={
                    "rounded-sm px-3 py-2 tiny-caps text-[10px] transition-colors " +
                    (active ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground")
                  }
                  aria-pressed={active}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 md:justify-end">
          {[
            [3, 2],
            [2, 3],
            [4, 3],
            [5, 4],
          ].map(([presetMain, presetCross]) => (
            <button
              key={`${presetMain}:${presetCross}`}
              type="button"
              onPointerDown={(e) => {
                e.preventDefault();
                onMain(presetMain);
                onVoices([presetCross]);
              }}
              className={
                "px-3 py-2.5 rounded-sm border font-mono text-sm transition-colors " +
                (main === presetMain && voices[0] === presetCross && enabled
                  ? "border-primary text-primary bg-primary/10"
                  : "border-border text-muted-foreground hover:text-foreground hover:border-accent/70")
              }
            >
              {presetMain}:{presetCross}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-5 grid grid-cols-1 md:grid-cols-2 gap-3">
        <NumberField label="Main" value={main} onChange={(value) => onMain(clamp(value, 2, 16))} />
        {voices.map((voice, index) => (
          <div key={index} className="grid grid-cols-[minmax(0,1fr)_auto] gap-2">
            <NumberField label={`Voice ${index + 2}`} value={voice} onChange={(value) => setVoice(index, value)} />
            <button
              type="button"
              onPointerDown={(e) => { e.preventDefault(); removeVoice(index); }}
              className="self-end rounded-sm border border-border/70 px-3 py-2 tiny-caps text-[10px] text-muted-foreground hover:text-primary"
              disabled={voices.length <= 1}
            >
              Remove
            </button>
          </div>
        ))}
        {voices.length < 3 && (
          <button
            type="button"
            onPointerDown={(e) => { e.preventDefault(); addVoice(); }}
            className="rounded-sm border border-border/70 px-3 py-3 tiny-caps text-[10px] text-muted-foreground hover:text-primary md:col-span-2"
          >
            Add voice
          </button>
        )}
      </div>

      <div className="mt-6 space-y-4">
        {allVoices.map((voice, index) => (
          <PolyrhythmRow
            key={`${voice}-${index}`}
            label={index === 0 ? "Main" : `Voice ${index + 1}`}
            slots={sharedSlots}
            step={sharedSlots / voice}
            activeSlot={isPlaying && enabled ? (index === 0 ? mainActiveSlot : index === 1 ? crossActiveSlot : -1) : -1}
            color={["hsl(var(--primary))", "hsl(var(--slate-cyan))", "hsl(var(--amber))", "hsl(338 82% 66%)"][index]}
          />
        ))}
        <div className="grid gap-1.5" style={{ gridTemplateColumns: `repeat(${sharedSlots}, minmax(0, 1fr))` }}>
          {Array.from({ length: sharedSlots }, (_, index) => {
            const hits = allVoices.map((voice) => index % (sharedSlots / voice) === 0);
            const mainHit = hits[0];
            const crossHit = hits.slice(1).some(Boolean);
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
                    background: hits.filter(Boolean).length > 1
                      ? "linear-gradient(135deg, hsl(var(--primary)) 0 34%, hsl(var(--slate-cyan)) 34% 67%, hsl(var(--amber)) 67% 100%)"
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
          <span className="font-mono text-lg tabular">{main} hits</span>
        </div>
        <div className="rounded-sm border border-border/60 bg-background/35 p-3">
          <span className="tiny-caps block text-[11px] text-muted-foreground">Other voices</span>
          <span className="font-mono text-lg tabular">{voices.join(" / ")}</span>
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

function PolymeterLanePreview({ lane, active, index }: { lane: PolymeterLane; active: boolean; index: number }) {
  const cellSize = lane.denominator === 4 ? "2rem" : lane.denominator === 8 ? "1.35rem" : "0.82rem";
  const color = polymeterLaneColor(index);

  return (
    <div className="mt-3 overflow-x-auto rounded-md border border-border/50 bg-card/45 p-2.5">
      <div className="flex min-w-max items-center justify-between gap-4">
        <div className="flex items-center gap-1.5">
          {Array.from({ length: lane.numerator }, (_, beatIndex) => (
            <span
              key={beatIndex}
              className="grid place-items-center rounded-full border font-mono text-[9px] transition-all"
              style={{
                width: cellSize,
                height: cellSize,
                borderColor: `color-mix(in srgb, ${color} 55%, hsl(var(--border)))`,
                background: active ? `color-mix(in srgb, ${color} ${beatIndex === 0 ? 82 : 36}%, transparent)` : "hsl(var(--border) / 0.25)",
                color: beatIndex === 0 && active ? "hsl(var(--background))" : "hsl(var(--muted-foreground))",
              }}
              title={`Beat ${beatIndex + 1} of ${lane.numerator}/${lane.denominator}`}
            >
              {lane.denominator === 16 ? "" : beatIndex + 1}
            </span>
          ))}
        </div>
        <div className="shrink-0 text-right">
          <span className="block font-mono text-xs text-foreground">{polymeterLaneTicks(lane)} sixteenths</span>
          <span className="tiny-caps text-[9px] text-muted-foreground">{polymeterUnitLabel(lane.denominator)}</span>
        </div>
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

function lcmMany(values: number[]): number {
  return values.reduce((acc, value) => lcm(acc, value), 1);
}

function subdivisionColor(pulses: number, alpha = 1): string {
  const palette: Record<number, string> = {
    1: `hsl(var(--amber) / ${alpha})`,
    2: `hsl(var(--slate-cyan) / ${alpha})`,
    3: `hsl(262 83% 70% / ${alpha})`,
    4: `hsl(146 70% 55% / ${alpha})`,
    5: `hsl(338 82% 66% / ${alpha})`,
    6: `hsl(210 88% 64% / ${alpha})`,
    7: `hsl(24 92% 64% / ${alpha})`,
    8: `hsl(82 78% 58% / ${alpha})`,
  };
  return palette[pulses] ?? `hsl(var(--border) / ${alpha})`;
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
      const color = accent === "normal" || accent === "accent"
        ? subdivisionColor(beat.pulses, active ? 0.9 : accent === "accent" ? 0.78 : 0.58)
        : accentColor(accent, active);
      return `${color} ${start}% ${end}%`;
    })
    .join(", ")})`;
}

function Field({ label, trailing, children }: { label: string; trailing?: ReactNode; children: ReactNode }) {
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
      <label className="tiny-caps block text-[10px] text-foreground/85">{label}</label>
      <input
        type="number"
        value={draft}
        onChange={(e) => commit(e.target.value)}
        onBlur={() => {
          if (draft.trim() === "") setDraft(String(value));
        }}
        className={`mt-1 min-h-10 w-full rounded-md border border-border/75 bg-background/58 px-2.5 py-1 ${compact ? "text-right" : "text-left"} font-mono text-base text-foreground shadow-[0_1px_0_hsl(var(--foreground)/0.04)_inset] focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/45`}
      />
    </div>
  );
}
