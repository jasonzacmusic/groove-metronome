import { useEffect, useRef, useState, type ReactNode } from "react";
import { ChevronLeft, ChevronRight, Download, Lock, Plus, RotateCcw, Share2, Trash2, Unlock, Upload, Volume2, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { PolyrhythmWheel } from "@/components/metronome/PolyrhythmWheel";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import type { UseMetronomeReturn } from "@/hooks/useMetronome";
import {
  BEAT_SOUND_OPTIONS,
  buildDefaultPattern,
  DOTTED_PLAYBACK_LABELS,
  getSubdivisionOptionsForBpm,
  JAZZ_ASSIST_LABELS,
  SUBDIVISION_NOTATION,
  TRIPLET_ASSIST_LABELS,
  type BeatPattern,
  type BeatSound,
  type DottedPlaybackMode,
  type JazzAssistMode,
  type MeterDenominator,
  type PolyrhythmConfig,
  type PulseAccent,
  type SubdivisionCount,
  type TimeSignature,
  type TripletAssistMode,
} from "@/lib/metronome-types";
import { clamp } from "@/lib/utils";

const SETLIST_STORAGE_KEY = "groove-metronome.setlists.v1";
const CONCERT_SESSION_STORAGE_KEY = "groove-metronome.concert-session.v1";

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

interface SongDurationLog {
  name: string;
  ms: number;
  lastPlayedAt: number;
}

interface ConcertSessionState {
  concertAccumulatedMs: number;
  concertActiveSince: number | null;
  activeSongId: string | null;
  songActiveSince: number | null;
  songDurations: Record<string, SongDurationLog>;
}

interface SetlistPageProps {
  metronome: UseMetronomeReturn;
  active?: boolean;
}

export function SetlistPage({ metronome, active = true }: SetlistPageProps) {
  const { state, setBpm, setTimeSignature, setBeatSound, setPitch, setPattern, setSwing, setGlobalSubdivision, setPolyrhythm, setTrainerEnabled, setRampEnabled, setAccentVolume, toggle, adjustBpm, setBeatSubdivision, toggleBeatEnabled, cyclePulseStrength } = metronome;
  const [setlist, setSetlist] = useState<SetlistState>(() => readSetlist());
  const [songName, setSongName] = useState("New song");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [stageLock, setStageLock] = useState(false);
  const [clockNow, setClockNow] = useState(() => Date.now());
  const [concertSession, setConcertSession] = useState<ConcertSessionState>(() => readConcertSession());
  const stageInitializedRef = useRef(false);
  const importRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    try {
      window.localStorage.setItem(SETLIST_STORAGE_KEY, JSON.stringify(setlist));
    } catch {
      // Keep the stage deck running even if browser storage is unavailable.
    }
  }, [setlist]);

  const selectedSong = setlist.songs[selectedIndex] ?? null;
  const nextSong = setlist.songs[selectedIndex + 1] ?? null;
  const concertElapsedMs = getConcertElapsedMs(concertSession, clockNow);
  const songElapsedMs = getCurrentSongElapsedMs(concertSession, selectedSong?.id ?? null, clockNow);
  const songLogs = Object.values(concertSession.songDurations).sort((a, b) => b.lastPlayedAt - a.lastPlayedAt);

  useEffect(() => {
    const id = window.setInterval(() => setClockNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    try {
      window.sessionStorage.setItem(CONCERT_SESSION_STORAGE_KEY, JSON.stringify(concertSession));
    } catch {
      // Stage timing is helpful but should never risk the show.
    }
  }, [concertSession]);

  useEffect(() => {
    const now = Date.now();
    setClockNow(now);
    setConcertSession((prev) => syncConcertSession(prev, {
      now,
      playing: active && state.isPlaying,
      songId: selectedSong?.id ?? null,
      songName: selectedSong?.name ?? "Live stage",
    }));
  }, [active, selectedSong?.id, selectedSong?.name, state.isPlaying]);

  useEffect(() => {
    if (!active || stageInitializedRef.current || selectedSong) return;
    stageInitializedRef.current = true;
    const subdivision = dominantSubdivision(state.pattern) ?? 1;
    setPattern(buildNeutralPattern(state.timeSignature.numerator, subdivision));
    setPolyrhythm({ enabled: false, dottedMode: "off", tripletMode: "off", jazzMode: "off", polymeterEnabled: false });
  }, [active, selectedSong, setPattern, setPolyrhythm, state.pattern, state.timeSignature.numerator]);

  const loadSong = (song: SavedSong, index = selectedIndex) => {
    setSelectedIndex(index);
    setBpm(song.bpm);
    setTimeSignature(song.timeSignature);
    setPattern(song.pattern.map((beat) => ({ pulses: beat.pulses, accents: [...beat.accents] })));
    setSwing(song.swing);
    setTrainerEnabled(false);
    setRampEnabled(false);
    setPolyrhythm({
      enabled: false,
      dottedMode: "off",
      tripletMode: "off",
      jazzMode: "off",
      rate: "double",
      polymeterEnabled: false,
      polymeterLanes: [{ numerator: song.timeSignature.numerator, denominator: song.timeSignature.denominator === 16 ? 16 : song.timeSignature.denominator === 8 ? 8 : 4 }],
    });
  };

  const addCurrentSong = () => {
    const name = songName.trim() || `Song ${setlist.songs.length + 1}`;
    const song: SavedSong = {
      id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      name,
      bpm: Math.round(state.bpm),
      timeSignature: state.timeSignature,
      pattern: state.pattern.map((beat) => ({ pulses: beat.pulses, accents: [...beat.accents] })),
      swing: state.swing,
    };
    setSetlist((prev) => ({ ...prev, songs: [...prev.songs, song] }));
    setSelectedIndex(setlist.songs.length);
    setSongName(`Song ${setlist.songs.length + 2}`);
  };

  const removeSong = (id: string) => {
    setSetlist((prev) => {
      const songs = prev.songs.filter((song) => song.id !== id);
      setSelectedIndex((index) => clamp(index, 0, Math.max(0, songs.length - 1)));
      return { ...prev, songs };
    });
  };

  const goToSong = (index: number) => {
    const safeIndex = clamp(index, 0, Math.max(0, setlist.songs.length - 1));
    const song = setlist.songs[safeIndex];
    if (song) loadSong(song, safeIndex);
  };

  const setlistFileName = () => `${safeFileName(setlist.name || "groove-setlist")}.groove-setlist.json`;

  const exportSetlist = () => {
    const file = new Blob([JSON.stringify({ version: 1, exportedAt: new Date().toISOString(), setlist }, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(file);
    const link = document.createElement("a");
    link.href = url;
    link.download = setlistFileName();
    link.click();
    URL.revokeObjectURL(url);
  };

  const shareSetlist = async () => {
    const payload = JSON.stringify({ version: 1, exportedAt: new Date().toISOString(), setlist }, null, 2);
    const file = new File([payload], setlistFileName(), { type: "application/json" });
    const nav = navigator as Navigator & { canShare?: (data: ShareData) => boolean };
    try {
      if (navigator.share && (!nav.canShare || nav.canShare({ files: [file] }))) {
        await navigator.share({ title: setlist.name, text: "Groove Metronome setlist backup", files: [file] });
        return;
      }
    } catch {
      // Native share can be cancelled on stage; fall back to a downloadable backup.
    }
    exportSetlist();
  };

  const importSetlist = async (file: File) => {
    try {
      const raw = await file.text();
      const incoming = readSetlistBackup(JSON.parse(raw));
      if (!incoming) return;
      setSetlist(incoming);
      setSelectedIndex(0);
      if (incoming.songs[0]) loadSong(incoming.songs[0], 0);
    } catch {
      // Ignore invalid backups rather than interrupting concert mode.
    }
  };

  return (
    <div className="space-y-5 pb-12">
      <section className="rounded-lg border border-primary/35 bg-card/80 p-3 md:p-4">
        <div className="flex flex-wrap items-end gap-3 md:gap-4">
          <div className="w-full max-w-xl md:w-[24rem]">
            <span className="tiny-caps text-[10px] text-primary">Setlist Studio</span>
            <input
              value={setlist.name}
              onChange={(event) => setSetlist((prev) => ({ ...prev, name: event.target.value }))}
              className="mt-1 block w-full min-w-0 bg-transparent font-serif text-3xl leading-none outline-none focus:text-primary md:text-4xl"
              aria-label="Setlist name"
            />
          </div>
          <div className="flex flex-wrap gap-2 pb-0.5">
            <StageAction label="Share" icon={<Share2 className="size-4" />} onClick={() => void shareSetlist()} />
            <StageAction label="Back up" icon={<Download className="size-4" />} onClick={exportSetlist} />
            <StageAction label="Restore" icon={<Upload className="size-4" />} onClick={() => importRef.current?.click()} />
          </div>
        </div>
        <input
          ref={importRef}
          type="file"
          accept=".json,.groove-setlist.json,application/json"
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void importSetlist(file);
            event.currentTarget.value = "";
          }}
        />
      </section>

      <div className="grid gap-5 lg:grid-cols-[340px_minmax(0,1fr)]">
        <aside className="space-y-4">
          <div className="rounded-lg border border-border bg-card/60 p-4">
            <span className="tiny-caps text-[10px] text-muted-foreground">Add current setup</span>
            <div className="mt-3 grid grid-cols-[minmax(0,1fr)_auto] gap-2">
              <input
                value={songName}
                onChange={(event) => setSongName(event.target.value)}
                placeholder="Song name"
                className="min-h-11 min-w-0 rounded-md border border-border bg-background/35 px-3 font-mono text-sm outline-none focus:border-primary"
                aria-label="Song name"
              />
              <Button onClick={addCurrentSong}>
                <Plus className="size-4" /> Add
              </Button>
            </div>
          </div>

          <div className="max-h-[42rem] space-y-2 overflow-auto pr-1">
            {setlist.songs.map((song, index) => (
              <button
                key={song.id}
                type="button"
                onClick={() => goToSong(index)}
                className={
                  "grid w-full grid-cols-[2rem_minmax(0,1fr)_auto] items-center gap-2 rounded-md border px-3 py-3 text-left transition-colors " +
                  (index === selectedIndex ? "border-primary bg-primary/10" : "border-border bg-card/45 hover:border-primary/60")
                }
              >
                <span className="font-mono text-xs text-muted-foreground">{index + 1}</span>
                <span className="min-w-0">
                  <span className="block truncate text-sm text-foreground">{song.name}</span>
                  <span className="tiny-caps text-[10px] text-muted-foreground">{song.bpm} BPM · {song.timeSignature.numerator}/{song.timeSignature.denominator}</span>
                </span>
                <span
                  role="button"
                  tabIndex={0}
                  onClick={(event) => {
                    event.stopPropagation();
                    removeSong(song.id);
                  }}
                  className="rounded-sm p-2 text-muted-foreground hover:text-destructive"
                  aria-label={`Remove ${song.name}`}
                >
                  <Trash2 className="size-4" />
                </span>
              </button>
            ))}
            {setlist.songs.length === 0 && (
              <div className="rounded-md border border-border bg-card/40 p-4 text-sm text-muted-foreground">
                Add a song from the current metronome, then run the show from the stage deck.
              </div>
            )}
          </div>
        </aside>

        <ConcertDeck
          active={active}
          song={selectedSong}
          nextSong={nextSong}
          songIndex={selectedIndex}
          songCount={setlist.songs.length}
          state={state}
          nowMs={clockNow}
          concertElapsedMs={concertElapsedMs}
          songElapsedMs={songElapsedMs}
          songLogs={songLogs}
          stageLock={stageLock}
          onStageLock={setStageLock}
          onPrev={() => goToSong(selectedIndex - 1)}
          onNext={() => goToSong(selectedIndex + 1)}
          onToggle={toggle}
          onAdjustBpm={adjustBpm}
          onSetBpm={setBpm}
          onSetTimeSignature={(timeSignature) => {
            const subdivision = dominantSubdivision(state.pattern) ?? 1;
            setTimeSignature(timeSignature);
            setPattern(buildNeutralPattern(timeSignature.numerator, subdivision));
          }}
          onSetSubdivision={setGlobalSubdivision}
          onToggleBeat={toggleBeatEnabled}
          onSetBeatSubdivision={setBeatSubdivision}
          onCyclePulseStrength={cyclePulseStrength}
          onSetAllAccents={(accent) => {
            setPattern(state.pattern.map((beat) => ({ ...beat, accents: beat.accents.map(() => accent) })));
          }}
          onSetBeatSound={setBeatSound}
          onSetPitch={setPitch}
          onSetSwing={setSwing}
          onSetAccentVolume={setAccentVolume}
          onSetPolyrhythm={setPolyrhythm}
        />
      </div>
    </div>
  );
}

function ConcertDeck({
  active,
  song,
  nextSong,
  songIndex,
  songCount,
  state,
  nowMs,
  concertElapsedMs,
  songElapsedMs,
  songLogs,
  stageLock,
  onStageLock,
  onPrev,
  onNext,
  onToggle,
  onAdjustBpm,
  onSetBpm,
  onSetTimeSignature,
  onSetSubdivision,
  onToggleBeat,
  onSetBeatSubdivision,
  onCyclePulseStrength,
  onSetAllAccents,
  onSetBeatSound,
  onSetPitch,
  onSetSwing,
  onSetAccentVolume,
  onSetPolyrhythm,
}: {
  active: boolean;
  song: SavedSong | null;
  nextSong: SavedSong | null;
  songIndex: number;
  songCount: number;
  state: UseMetronomeReturn["state"];
  nowMs: number;
  concertElapsedMs: number;
  songElapsedMs: number;
  songLogs: SongDurationLog[];
  stageLock: boolean;
  onStageLock: (locked: boolean) => void;
  onPrev: () => void;
  onNext: () => void;
  onToggle: () => void;
  onAdjustBpm: (delta: number) => void;
  onSetBpm: (bpm: number) => void;
  onSetTimeSignature: (timeSignature: TimeSignature) => void;
  onSetSubdivision: (subdivision: SubdivisionCount) => void;
  onToggleBeat: (beatIndex: number) => void;
  onSetBeatSubdivision: (beatIndex: number, pulses: SubdivisionCount) => void;
  onCyclePulseStrength: (beatIndex: number, pulseIndex: number) => void;
  onSetAllAccents: (accent: PulseAccent) => void;
  onSetBeatSound: (sound: BeatSound) => void;
  onSetPitch: (pitch: number) => void;
  onSetSwing: (swing: number) => void;
  onSetAccentVolume: (accent: Exclude<PulseAccent, "mute">, volume: number) => void;
  onSetPolyrhythm: (config: Partial<PolyrhythmConfig>) => void;
}) {
  const tapsRef = useRef<number[]>([]);
  const bpmInputRef = useRef<HTMLInputElement | null>(null);
  const [tapPreview, setTapPreview] = useState<{ count: number; bpm: number | null }>({ count: 0, bpm: null });
  const [bpmDraft, setBpmDraft] = useState(String(Math.round(state.bpm)));
  const [stageApplyAllSubdivision, setStageApplyAllSubdivision] = useState<SubdivisionCount | null>(null);
  const activeSubdivision = dominantSubdivision(state.pattern);
  const subdivisionOptions = getSubdivisionOptionsForBpm(state.bpm);
  const controlsLocked = stageLock;
  const activeAssist = stageAssistSummary(state.polyrhythm);

  useEffect(() => {
    if (document.activeElement !== bpmInputRef.current) {
      setBpmDraft(String(Math.round(state.bpm)));
    }
  }, [state.bpm]);

  const tap = () => {
    const now = performance.now();
    const taps = tapsRef.current;
    if (taps.length > 0 && now - taps[taps.length - 1] > 2500) taps.length = 0;
    taps.push(now);
    if (taps.length > 8) taps.shift();
    if (taps.length < 2) {
      setTapPreview({ count: taps.length, bpm: null });
      return;
    }
    const intervals = taps.slice(1).map((time, index) => time - taps[index]);
    const avg = intervals.reduce((a, b) => a + b, 0) / intervals.length;
    setTapPreview({ count: taps.length, bpm: clamp(Math.round(60000 / avg), 20, 300) });
  };

  useEffect(() => {
    if (!active) return;
    const handler = (event: KeyboardEvent) => {
      const target = event.target;
      const editable = target instanceof HTMLInputElement
        || target instanceof HTMLSelectElement
        || target instanceof HTMLTextAreaElement
        || (target instanceof HTMLElement && target.isContentEditable);
      if (editable) return;
      if (event.key !== "t" && event.key !== "T") return;
      event.preventDefault();
      tap();
    };
    window.addEventListener("keydown", handler, { capture: true });
    return () => window.removeEventListener("keydown", handler, { capture: true });
  }, [active, tap]);

  const setMeter = (numerator: number, denominator: MeterDenominator) => {
    onSetTimeSignature({ numerator, denominator });
  };

  const commitBpmDraft = (rawValue = bpmDraft) => {
    const next = clamp(Number(rawValue) || state.bpm, 20, 300);
    onSetBpm(next);
    setBpmDraft(String(Math.round(next)));
  };

  return (
    <section className="rounded-lg border border-border bg-card/70 p-4 md:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="tiny-caps text-[10px] text-primary">Stage metronome</span>
        <button
          type="button"
          onClick={() => onStageLock(!stageLock)}
          aria-pressed={stageLock}
          aria-label={stageLock ? "Unlock stage controls" : "Lock stage controls"}
          className={
            "inline-flex min-h-10 items-center gap-2 rounded-md border px-3 tiny-caps text-[10px] transition-colors " +
            (stageLock ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:text-foreground")
          }
        >
          {stageLock ? <Lock className="size-4" /> : <Unlock className="size-4" />}
          {stageLock ? "Locked" : "Ready"}
        </button>
      </div>

      <div className="mt-5 space-y-4">
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_17rem]">
          <div className="rounded-lg border border-border bg-background/35 p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <span className="tiny-caps text-[10px] text-muted-foreground">Song</span>
                <h2 className="mt-2 break-words font-serif text-4xl leading-none md:text-6xl">
                  {song?.name ?? "No song loaded"}
                </h2>
              </div>
              <div className="rounded-full border border-border bg-card/55 px-3 py-1.5 font-mono text-xs text-muted-foreground">
                {songCount ? `${songIndex + 1}/${songCount}` : "0/0"} · {state.timeSignature.numerator}/{state.timeSignature.denominator}
              </div>
            </div>
            {nextSong && <div className="mt-3 truncate font-mono text-sm text-muted-foreground">Next: {nextSong.name}</div>}
          </div>
          <div className="rounded-lg border border-border bg-background/35 p-4">
            <span className="tiny-caps text-[10px] text-muted-foreground">Tempo</span>
            <div className="mt-2">
              <input
                ref={bpmInputRef}
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                value={bpmDraft}
                disabled={controlsLocked}
                onChange={(event) => setBpmDraft(event.target.value)}
                onFocus={(event) => event.currentTarget.select()}
                onBlur={(event) => commitBpmDraft(event.currentTarget.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    commitBpmDraft(event.currentTarget.value);
                    event.currentTarget.blur();
                  }
                }}
                className="w-full rounded-md border border-border bg-background/55 px-2 py-2 text-center font-serif text-6xl leading-none text-primary outline-none focus:border-primary disabled:cursor-not-allowed disabled:opacity-45"
                aria-label="Stage tempo"
              />
            </div>
            <StageTempoNudges disabled={controlsLocked} onAdjustBpm={onAdjustBpm} />
          </div>
        </div>

        <StageClockStrip
          nowMs={nowMs}
          concertElapsedMs={concertElapsedMs}
          songElapsedMs={songElapsedMs}
          songLogs={songLogs}
        />

        <StageTopPerformanceControls
          timeSignature={state.timeSignature}
          pattern={state.pattern}
          controlsLocked={controlsLocked}
          onSetMeter={setMeter}
          onSetAllAccents={onSetAllAccents}
        />

        <div className="relative rounded-lg border border-primary/30 bg-[linear-gradient(145deg,hsl(var(--primary)/0.10),hsl(var(--background)/0.50))] p-3 md:p-5">
          <PolyrhythmWheel
            pattern={state.pattern}
            bpm={state.bpm}
            isPlaying={state.isPlaying}
            currentBeat={state.currentBeat}
            currentPulse={state.currentPulse}
            onToggleBeat={(beatIndex) => {
              if (!controlsLocked) onToggleBeat(beatIndex);
            }}
            onSetBeatSubdivision={(beatIndex, pulses) => {
              if (!controlsLocked) {
                onSetBeatSubdivision(beatIndex, pulses);
                setStageApplyAllSubdivision(pulses);
              }
            }}
            onCyclePulseStrength={(beatIndex, pulseIndex) => {
              if (!controlsLocked) onCyclePulseStrength(beatIndex, pulseIndex);
            }}
            onTapTempo={tap}
          />
          <StageSubdivisionApplyAllTool
            subdivision={controlsLocked ? null : stageApplyAllSubdivision}
            onApply={() => {
              if (!controlsLocked && stageApplyAllSubdivision) onSetSubdivision(stageApplyAllSubdivision);
              setStageApplyAllSubdivision(null);
            }}
            onClose={() => setStageApplyAllSubdivision(null)}
          />
        </div>

        <div className="grid gap-3 sm:grid-cols-[1fr_1.45fr_1fr]">
          <StageButton label="Previous" icon={<ChevronLeft className="size-6" />} disabled={controlsLocked || songIndex <= 0} onClick={onPrev} />
          <StagePlayButton playing={state.isPlaying} onToggle={onToggle} />
          <StageButton label="Next" icon={<ChevronRight className="size-6" />} disabled={controlsLocked || songIndex >= songCount - 1} onClick={onNext} />
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <StageSettingsPanel title="Tap" summary={tapPreview.bpm ? `${tapPreview.bpm} BPM` : `${tapPreview.count} taps`} defaultOpen>
            <TapPreview preview={tapPreview} onTap={tap} onSetBpm={onSetBpm} disabled={controlsLocked} />
          </StageSettingsPanel>

          <StageSettingsPanel
            title="Subdivision"
            summary={activeSubdivision ? SUBDIVISION_NOTATION[activeSubdivision].glyph : "Mix"}
          >
            <div className="grid grid-cols-4 gap-2">
              {subdivisionOptions.map((subdivision) => (
                <StageTile
                  key={subdivision}
                  label={SUBDIVISION_NOTATION[subdivision].label}
                  active={activeSubdivision === subdivision}
                  disabled={controlsLocked}
                  onPress={() => onSetSubdivision(subdivision)}
                >
                  <span className="block font-serif text-2xl leading-none">{SUBDIVISION_NOTATION[subdivision].glyph}</span>
                  <span className="tiny-caps mt-1 block text-[9px]">{subdivision}</span>
                </StageTile>
              ))}
            </div>
          </StageSettingsPanel>

          <StageSettingsPanel title="Sound" summary={`${BEAT_SOUND_OPTIONS.find((sound) => sound.id === state.beatSound)?.label ?? "Tone"} · ${state.swing}%`}>
            <div className="grid grid-cols-3 gap-2">
              {BEAT_SOUND_OPTIONS.map((sound) => (
                <StageTile
                  key={sound.id}
                  label={sound.label}
                  active={state.beatSound === sound.id}
                  disabled={controlsLocked}
                  onPress={() => onSetBeatSound(sound.id)}
                >
                  <Volume2 className="size-4" />
                  <span className="tiny-caps text-[9px]">{sound.label}</span>
                </StageTile>
              ))}
            </div>
            <div className="mt-3 grid grid-cols-2 gap-3">
              <StageVerticalSlider label="Pitch" value={state.pitch} min={0} max={100} step={1} disabled={controlsLocked} onChange={onSetPitch} onReset={() => onSetPitch(50)} />
              <StageVerticalSlider label="Swing" value={clamp(state.swing, 0, 70)} min={0} max={70} step={5} disabled={controlsLocked} onChange={onSetSwing} />
            </div>
            <StageAccentVolumeControls
              accentVolumes={state.accentVolumes}
              disabled={controlsLocked}
              onSetAccentVolume={onSetAccentVolume}
            />
          </StageSettingsPanel>

          <StageSettingsPanel title="Rhythm Assist" summary={activeAssist}>
            <StageRhythmAssist
              dottedMode={state.polyrhythm.dottedMode}
              tripletMode={state.polyrhythm.tripletMode}
              jazzMode={state.polyrhythm.jazzMode}
              disabled={controlsLocked}
              onDottedMode={(dottedMode) => onSetPolyrhythm({ dottedMode })}
              onTripletMode={(tripletMode) => onSetPolyrhythm({ tripletMode })}
              onJazzMode={(jazzMode) => onSetPolyrhythm({ jazzMode })}
            />
          </StageSettingsPanel>
        </div>
      </div>
    </section>
  );
}

function StageSubdivisionApplyAllTool({
  subdivision,
  onApply,
  onClose,
}: {
  subdivision: SubdivisionCount | null;
  onApply: () => void;
  onClose: () => void;
}) {
  if (!subdivision) return null;
  const notation = SUBDIVISION_NOTATION[subdivision];
  return (
    <div className="absolute right-3 top-3 z-20 w-[min(13rem,calc(100%-1.5rem))] rounded-lg border border-primary/45 bg-background/95 p-2.5 shadow-xl shadow-background/30 backdrop-blur">
      <div className="flex items-start gap-2">
        <div className="grid size-11 shrink-0 place-items-center rounded-md border border-primary/40 bg-primary/15 font-serif text-2xl text-primary">
          {notation.glyph}
        </div>
        <div className="min-w-0 flex-1">
          <div className="tiny-caps text-[9px] text-muted-foreground">Divide by {subdivision}</div>
          <div className="truncate text-sm font-semibold text-foreground">{notation.label}</div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="grid size-7 shrink-0 place-items-center rounded-md border border-border text-muted-foreground transition-colors hover:text-foreground"
          aria-label="Close subdivision action"
        >
          <X className="size-3.5" aria-hidden />
        </button>
      </div>
      <button
        type="button"
        onClick={onApply}
        className="mt-2 min-h-9 w-full rounded-md border border-primary/55 bg-primary/15 px-3 tiny-caps text-[10px] text-primary transition-colors hover:bg-primary/22"
      >
        Apply to all beats
      </button>
    </div>
  );
}

function StageClockStrip({
  nowMs,
  concertElapsedMs,
  songElapsedMs,
  songLogs,
}: {
  nowMs: number;
  concertElapsedMs: number;
  songElapsedMs: number;
  songLogs: SongDurationLog[];
}) {
  const localTimeZone = getLocalTimeZone();
  const localLabel = getTimeZoneLabel(nowMs, localTimeZone);
  return (
    <div className="rounded-lg border border-border bg-background/35 p-2.5">
      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
        <StageClockTile label={`Geo ${localLabel}`} value={formatZoneTime(nowMs, localTimeZone)} tone="cyan" />
        <StageClockTile label="IST" value={formatZoneTime(nowMs, "Asia/Kolkata")} tone="gold" />
        <StageClockTile label="Concert" value={formatStageDuration(concertElapsedMs)} tone="green" />
        <StageClockTile label="Song" value={formatStageDuration(songElapsedMs)} tone="rose" />
      </div>
      <div className="mt-2 flex gap-2 overflow-x-auto pb-1">
        {songLogs.slice(0, 5).map((log) => (
          <span key={log.name} className="shrink-0 rounded-full border border-border bg-card/60 px-3 py-1 font-mono text-[11px] text-muted-foreground">
            {log.name}: {formatStageDuration(log.ms)}
          </span>
        ))}
        {songLogs.length === 0 && (
          <span className="font-mono text-xs text-muted-foreground">Song lengths are saved for this browser session.</span>
        )}
      </div>
    </div>
  );
}

function StageClockTile({ label, value, tone }: { label: string; value: string; tone: "cyan" | "gold" | "green" | "rose" }) {
  const toneClass = {
    cyan: "border-accent/45 bg-accent/8 text-accent",
    gold: "border-primary/45 bg-primary/10 text-primary",
    green: "border-emerald-400/35 bg-emerald-400/10 text-emerald-200",
    rose: "border-rose-400/35 bg-rose-400/10 text-rose-200",
  }[tone];
  return (
    <div className={`rounded-md border px-3 py-2 ${toneClass}`}>
      <span className="tiny-caps block text-[9px] opacity-75">{label}</span>
      <span className="mt-0.5 block font-mono text-2xl font-semibold tabular leading-none tracking-wide">
        {value}
      </span>
    </div>
  );
}

function getLocalTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "Asia/Kolkata";
  } catch {
    return "Asia/Kolkata";
  }
}

function getTimeZoneLabel(ms: number, timeZone: string): string {
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone,
      hour: "numeric",
      timeZoneName: "short",
    }).formatToParts(new Date(ms));
    return parts.find((part) => part.type === "timeZoneName")?.value ?? shortTimeZoneName(timeZone);
  } catch {
    return shortTimeZoneName(timeZone);
  }
}

function shortTimeZoneName(timeZone: string): string {
  const parts = timeZone.split("/");
  return (parts[parts.length - 1] ?? "Local").replace(/_/g, " ");
}

function formatZoneTime(ms: number, timeZone: string): string {
  try {
    return new Intl.DateTimeFormat("en-IN", {
      timeZone,
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    }).format(new Date(ms)).toLowerCase();
  } catch {
    return formatIstTime(ms);
  }
}

function StageTempoNudges({ disabled, onAdjustBpm }: { disabled?: boolean; onAdjustBpm: (delta: number) => void }) {
  return (
    <div className="mt-3 grid grid-cols-3 gap-2" aria-label="Stage tempo adjustments">
      {[1, 2, 5].map((amount) => (
        <div key={amount} className="grid grid-cols-2 overflow-hidden rounded-lg border border-border bg-background/35">
          <button
            type="button"
            disabled={disabled}
            onPointerDown={(event) => {
              event.preventDefault();
              if (!disabled) onAdjustBpm(-amount);
            }}
            className="min-h-14 border-r border-border px-2 font-mono text-lg text-muted-foreground transition-colors hover:bg-destructive/12 hover:text-destructive disabled:cursor-not-allowed disabled:opacity-35"
            aria-label={`Decrease tempo by ${amount}`}
          >
            -{amount}
          </button>
          <button
            type="button"
            disabled={disabled}
            onPointerDown={(event) => {
              event.preventDefault();
              if (!disabled) onAdjustBpm(amount);
            }}
            className="min-h-14 px-2 font-mono text-lg text-primary transition-colors hover:bg-primary/14 disabled:cursor-not-allowed disabled:opacity-35"
            aria-label={`Increase tempo by ${amount}`}
          >
            +{amount}
          </button>
        </div>
      ))}
    </div>
  );
}

function StageTopPerformanceControls({
  timeSignature,
  pattern,
  controlsLocked,
  onSetMeter,
  onSetAllAccents,
}: {
  timeSignature: TimeSignature;
  pattern: BeatPattern[];
  controlsLocked: boolean;
  onSetMeter: (numerator: number, denominator: MeterDenominator) => void;
  onSetAllAccents: (accent: PulseAccent) => void;
}) {
  return (
    <div className="grid gap-3 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
      <StageSettingsPanel title="Time Signature" summary={`${timeSignature.numerator}/${timeSignature.denominator}`}>
        <div className="grid grid-cols-2 gap-3">
          <StageStepper
            label="Beats"
            value={timeSignature.numerator}
            onMinus={() => onSetMeter(clamp(timeSignature.numerator - 1, 1, 16), timeSignature.denominator as MeterDenominator)}
            onPlus={() => onSetMeter(clamp(timeSignature.numerator + 1, 1, 16), timeSignature.denominator as MeterDenominator)}
            disabled={controlsLocked}
          />
          <StageDenominatorPad
            value={timeSignature.denominator as MeterDenominator}
            onChange={(denominator) => onSetMeter(timeSignature.numerator, denominator)}
            disabled={controlsLocked}
          />
        </div>
        <div className="mt-3 grid grid-cols-4 gap-2">
          {([3, 4, 5, 6, 7, 9, 11, 12] as const).map((numerator) => (
            <StageTile
              key={numerator}
              label={`${numerator}/${timeSignature.denominator}`}
              active={timeSignature.numerator === numerator}
              disabled={controlsLocked}
              onPress={() => onSetMeter(numerator, timeSignature.denominator as MeterDenominator)}
            >
              {numerator}
            </StageTile>
          ))}
        </div>
      </StageSettingsPanel>

      <div className="rounded-lg border border-border bg-background/35 p-3">
        <div className="flex min-h-10 items-center justify-between gap-3">
          <span>
            <span className="tiny-caps block text-[10px] text-muted-foreground">Accents</span>
            <span className="mt-1 block font-mono text-xs text-foreground/85">0 · ● ◆</span>
          </span>
          <RotateCcw className="size-4 text-primary" aria-hidden />
        </div>
        <div className="mt-3 grid grid-cols-5 gap-2">
          <StageAccentTile label="Mute all" symbol="0" active={allPulsesAre(pattern, "mute")} disabled={controlsLocked} onPress={() => onSetAllAccents("mute")} />
          <StageAccentTile label="Ghost all" symbol="·" active={allPulsesAre(pattern, "ghost")} disabled={controlsLocked} onPress={() => onSetAllAccents("ghost")} />
          <StageAccentTile label="Normal all" symbol="●" active={allPulsesAre(pattern, "normal")} disabled={controlsLocked} onPress={() => onSetAllAccents("normal")} />
          <StageAccentTile label="Accent all" symbol="◆" active={allPulsesAre(pattern, "accent")} disabled={controlsLocked} onPress={() => onSetAllAccents("accent")} />
          <StageTile label="Reset live accents" disabled={controlsLocked} onPress={() => onSetAllAccents("normal")}>
            <RotateCcw className="size-5" />
          </StageTile>
        </div>
      </div>
    </div>
  );
}

function StageSettingsPanel({ title, summary, defaultOpen = false, children }: { title: string; summary: string; defaultOpen?: boolean; children: ReactNode }) {
  return (
    <Collapsible defaultOpen={defaultOpen} className="rounded-lg border border-border bg-background/35">
      <CollapsibleTrigger className="flex min-h-14 w-full items-center justify-between gap-3 px-4 text-left">
        <span>
          <span className="tiny-caps block text-[10px] text-muted-foreground">{title}</span>
          <span className="mt-1 block truncate font-mono text-xs text-foreground/85">{summary}</span>
        </span>
        <span className="font-serif text-2xl leading-none text-primary">+</span>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="border-t border-border/70 p-4">
          {children}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

function StageStepper({ label, value, onMinus, onPlus, disabled }: { label: string; value: number; onMinus: () => void; onPlus: () => void; disabled?: boolean }) {
  return (
    <div className="rounded-lg border border-border/70 bg-background/35 p-2">
      <span className="sr-only">{label}</span>
      <div className="grid grid-cols-[2.75rem_minmax(0,1fr)_2.75rem] items-center gap-2">
        <StageTile label={`${label} down`} disabled={disabled} onPress={onMinus}>-</StageTile>
        <div className="grid min-h-14 place-items-center rounded-md border border-primary/35 bg-primary/10 font-serif text-4xl text-primary">{value}</div>
        <StageTile label={`${label} up`} disabled={disabled} onPress={onPlus}>+</StageTile>
      </div>
    </div>
  );
}

function StageDenominatorPad({ value, onChange, disabled }: { value: MeterDenominator; onChange: (value: MeterDenominator) => void; disabled?: boolean }) {
  return (
    <div className="grid grid-cols-3 gap-2">
      {([4, 8, 16] as MeterDenominator[]).map((denominator) => (
        <StageTile
          key={denominator}
          label={`Beat unit ${denominator}`}
          active={value === denominator}
          disabled={disabled}
          onPress={() => onChange(denominator)}
        >
          {denominator}
        </StageTile>
      ))}
    </div>
  );
}

function StageTile({ label, active = false, disabled = false, onPress, children }: { label: string; active?: boolean; disabled?: boolean; onPress: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={active}
      disabled={disabled}
      onPointerDown={(event) => {
        event.preventDefault();
        if (!disabled) onPress();
      }}
      className={
        "inline-flex min-h-14 items-center justify-center gap-1.5 rounded-lg border px-2 text-center font-mono text-lg transition-colors disabled:cursor-not-allowed disabled:opacity-35 " +
        (active
          ? "border-primary bg-primary/18 text-primary shadow-[0_0_18px_hsl(var(--primary)/0.14)]"
          : "border-border bg-background/45 text-muted-foreground hover:border-primary/70 hover:text-primary")
      }
    >
      {children}
    </button>
  );
}

function StageAccentTile({ label, symbol, active, disabled, onPress }: { label: string; symbol: string; active: boolean; disabled?: boolean; onPress: () => void }) {
  return (
    <StageTile label={label} active={active} disabled={disabled} onPress={onPress}>
      <span className="font-serif text-3xl leading-none">{symbol}</span>
    </StageTile>
  );
}

function StageVerticalSlider({
  label,
  value,
  min,
  max,
  step,
  disabled,
  onChange,
  onReset,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  disabled?: boolean;
  onChange: (value: number) => void;
  onReset?: () => void;
}) {
  return (
    <label className="grid min-h-28 grid-cols-[2.5rem_minmax(0,1fr)] items-center gap-3 rounded-lg border border-border/70 bg-background/35 p-3">
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(Number(event.target.value))}
        onDoubleClick={onReset}
        className="h-24 w-8 accent-primary disabled:opacity-35"
        style={{ writingMode: "vertical-lr", direction: "rtl" }}
        aria-label={`Stage ${label.toLowerCase()}`}
        title={onReset ? "Double-click to reset" : label}
      />
      <span>
        <span className="tiny-caps block text-[10px] text-muted-foreground">{label}</span>
        <span className="font-mono text-lg text-foreground">{value}</span>
      </span>
    </label>
  );
}

function StageAccentVolumeControls({
  accentVolumes,
  disabled,
  onSetAccentVolume,
}: {
  accentVolumes: Record<PulseAccent, number>;
  disabled?: boolean;
  onSetAccentVolume: (accent: Exclude<PulseAccent, "mute">, volume: number) => void;
}) {
  return (
    <div className="mt-3 rounded-lg border border-border/70 bg-background/35 p-3">
      <span className="tiny-caps block text-[10px] text-muted-foreground">Live levels</span>
      {([
        ["accent", "Loud"],
        ["normal", "Soft"],
        ["ghost", "Softer"],
      ] as Array<[Exclude<PulseAccent, "mute">, string]>).map(([accent, label]) => (
        <label key={accent} className="mt-2 grid grid-cols-[4.4rem_minmax(0,1fr)_3rem] items-center gap-2">
          <span className="tiny-caps text-[9px] text-muted-foreground">{label}</span>
          <input
            type="range"
            min={-30}
            max={0}
            step={1}
            value={accentVolumes[accent]}
            disabled={disabled}
            onChange={(event) => onSetAccentVolume(accent, Number(event.target.value))}
            className="accent-primary disabled:opacity-35"
            aria-label={`Stage ${label.toLowerCase()} level`}
          />
          <span className="font-mono text-[10px] text-muted-foreground tabular">{accentVolumes[accent]} dB</span>
        </label>
      ))}
    </div>
  );
}

function StageRhythmAssist({
  dottedMode,
  tripletMode,
  jazzMode,
  disabled,
  onDottedMode,
  onTripletMode,
  onJazzMode,
}: {
  dottedMode: DottedPlaybackMode;
  tripletMode: TripletAssistMode;
  jazzMode: JazzAssistMode;
  disabled?: boolean;
  onDottedMode: (mode: DottedPlaybackMode) => void;
  onTripletMode: (mode: TripletAssistMode) => void;
  onJazzMode: (mode: JazzAssistMode) => void;
}) {
  const toggleDotted = (mode: DottedPlaybackMode) => onDottedMode(dottedMode === mode ? "off" : mode);
  const toggleTriplet = (mode: TripletAssistMode) => onTripletMode(tripletMode === mode ? "off" : mode);
  const toggleJazz = (mode: JazzAssistMode) => onJazzMode(jazzMode === mode ? "off" : mode);

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-4 gap-2">
        <StageTile label="Dotted quarter" active={dottedMode === "quarter"} disabled={disabled} onPress={() => toggleDotted("quarter")}>♩.</StageTile>
        <StageTile label="Dotted eighth" active={dottedMode === "eighth"} disabled={disabled} onPress={() => toggleDotted("eighth")}>♪.</StageTile>
        <StageTile label="Dotted sixteenth" active={dottedMode === "sixteenth"} disabled={disabled} onPress={() => toggleDotted("sixteenth")}>♬.</StageTile>
        <StageTile label="Rhythm assist off" active={dottedMode === "off" && tripletMode === "off" && jazzMode === "off"} disabled={disabled} onPress={() => {
          onDottedMode("off");
          onTripletMode("off");
          onJazzMode("off");
        }}>0</StageTile>
      </div>
      <div className="grid grid-cols-4 gap-2">
        <StageTile label="Half triplet" active={tripletMode === "half"} disabled={disabled} onPress={() => toggleTriplet("half")}>𝅗𝅥³</StageTile>
        <StageTile label="Quarter triplet" active={tripletMode === "quarter"} disabled={disabled} onPress={() => toggleTriplet("quarter")}>♩³</StageTile>
        <StageTile label="Eighth triplet" active={tripletMode === "eighth"} disabled={disabled} onPress={() => toggleTriplet("eighth")}>♪³</StageTile>
        <StageTile label="Sextuplet" active={tripletMode === "sextuplet"} disabled={disabled} onPress={() => toggleTriplet("sextuplet")}>♬⁶</StageTile>
      </div>
      <Collapsible defaultOpen={jazzMode !== "off"} className="rounded-lg border border-primary/30 bg-primary/5">
        <CollapsibleTrigger className="flex min-h-12 w-full items-center justify-between px-3 text-left">
          <span className="tiny-caps text-[10px] text-primary">Jazz</span>
          <span className="font-serif text-2xl leading-none text-primary">+</span>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="grid grid-cols-4 gap-2 border-t border-primary/20 p-2">
            <StageTile label="Jazz 2 and 4" active={jazzMode === "twoFour"} disabled={disabled} onPress={() => toggleJazz("twoFour")}>2·4</StageTile>
            <StageTile label="Jazz ands" active={jazzMode === "ands"} disabled={disabled} onPress={() => toggleJazz("ands")}>{"&"}</StageTile>
            <StageTile label="Jazz 2 and 4 plus ands" active={jazzMode === "twoFourAnds"} disabled={disabled} onPress={() => toggleJazz("twoFourAnds")}>{"2&4"}</StageTile>
            <StageTile label="Charleston" active={jazzMode === "charleston"} disabled={disabled} onPress={() => toggleJazz("charleston")}>{"1&"}</StageTile>
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}

function TapPreview({ preview, onTap, onSetBpm, disabled = false }: { preview: { count: number; bpm: number | null }; onTap: () => void; onSetBpm: (bpm: number) => void; disabled?: boolean }) {
  return (
    <div>
      <button
        type="button"
        disabled={disabled}
        onPointerDown={(event) => {
          event.preventDefault();
          if (!disabled) onTap();
        }}
        className="min-h-28 w-full rounded-lg border border-primary/60 bg-primary/10 font-serif text-5xl text-primary transition-colors hover:bg-primary/15 disabled:cursor-not-allowed disabled:opacity-35"
      >
        Tap
      </button>
      <div className="mt-3 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
        <div>
          <span className="block font-mono text-3xl tabular">{preview.bpm ?? "—"}</span>
          <span className="tiny-caps text-[10px] text-muted-foreground">{preview.count} taps · preview</span>
        </div>
        <Button disabled={!preview.bpm || disabled} onClick={() => preview.bpm && onSetBpm(preview.bpm)}>
          Use BPM
        </Button>
      </div>
    </div>
  );
}

function StagePlayButton({ playing, onToggle }: { playing: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onPointerDown={(event) => { event.preventDefault(); onToggle(); }}
      className={
        "min-h-24 rounded-lg border px-6 py-5 font-serif text-5xl transition-colors " +
        (playing
          ? "border-destructive bg-destructive/15 text-destructive hover:bg-destructive/20"
          : "border-primary bg-primary text-primary-foreground hover:bg-primary/90")
      }
    >
      {playing ? "Stop" : "Start"}
    </button>
  );
}

function StageButton({ label, icon, disabled, compact, onClick }: { label: string; icon?: ReactNode; disabled?: boolean; compact?: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onPointerDown={(event) => {
        event.preventDefault();
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

function StageAction({ label, icon, onClick }: { label: string; icon: ReactNode; onClick: () => void }) {
  return (
    <button
      type="button"
      onPointerDown={(event) => {
        event.preventDefault();
        onClick();
      }}
      className="inline-flex min-h-10 items-center gap-2 rounded-md border border-border bg-background/45 px-3 tiny-caps text-[10px] text-muted-foreground transition-colors hover:border-primary hover:text-primary"
    >
      {icon}
      {label}
    </button>
  );
}

function readSetlist(): SetlistState {
  try {
    const saved = window.localStorage.getItem(SETLIST_STORAGE_KEY);
    if (saved) {
      const parsed = readSetlistBackup(JSON.parse(saved));
      if (parsed) return parsed;
    }
  } catch {
    // Ignore corrupted local storage.
  }
  return { name: "My Band / Concert", songs: [] };
}

function emptyConcertSession(): ConcertSessionState {
  return {
    concertAccumulatedMs: 0,
    concertActiveSince: null,
    activeSongId: null,
    songActiveSince: null,
    songDurations: {},
  };
}

function readConcertSession(): ConcertSessionState {
  try {
    const saved = window.sessionStorage.getItem(CONCERT_SESSION_STORAGE_KEY);
    if (!saved) return emptyConcertSession();
    const parsed = JSON.parse(saved) as Partial<ConcertSessionState>;
    const songDurations = parsed.songDurations && typeof parsed.songDurations === "object" ? parsed.songDurations : {};
    return {
      concertAccumulatedMs: Number.isFinite(parsed.concertAccumulatedMs) ? Math.max(0, Number(parsed.concertAccumulatedMs)) : 0,
      concertActiveSince: typeof parsed.concertActiveSince === "number" ? parsed.concertActiveSince : null,
      activeSongId: typeof parsed.activeSongId === "string" ? parsed.activeSongId : null,
      songActiveSince: typeof parsed.songActiveSince === "number" ? parsed.songActiveSince : null,
      songDurations: Object.fromEntries(
        Object.entries(songDurations)
          .filter((entry): entry is [string, SongDurationLog] => {
            const log = entry[1] as SongDurationLog;
            return Boolean(log) && typeof log.name === "string" && typeof log.ms === "number";
          })
          .map(([id, log]) => [id, {
            name: log.name,
            ms: Math.max(0, log.ms),
            lastPlayedAt: typeof log.lastPlayedAt === "number" ? log.lastPlayedAt : Date.now(),
          }]),
      ),
    };
  } catch {
    return emptyConcertSession();
  }
}

function syncConcertSession(
  prev: ConcertSessionState,
  nextState: { now: number; playing: boolean; songId: string | null; songName: string },
): ConcertSessionState {
  const next: ConcertSessionState = {
    ...prev,
    songDurations: { ...prev.songDurations },
  };
  const closeConcertSpan = () => {
    if (next.concertActiveSince !== null) {
      next.concertAccumulatedMs += Math.max(0, nextState.now - next.concertActiveSince);
      next.concertActiveSince = null;
    }
  };
  const closeSongSpan = () => {
    if (next.songActiveSince !== null && next.activeSongId) {
      const existing = next.songDurations[next.activeSongId] ?? { name: nextState.songName, ms: 0, lastPlayedAt: nextState.now };
      next.songDurations[next.activeSongId] = {
        name: existing.name,
        ms: existing.ms + Math.max(0, nextState.now - next.songActiveSince),
        lastPlayedAt: nextState.now,
      };
      next.songActiveSince = null;
    }
  };

  if (!nextState.playing) {
    closeConcertSpan();
    closeSongSpan();
    next.activeSongId = nextState.songId;
    if (nextState.songId) {
      next.songDurations[nextState.songId] = {
        name: nextState.songName,
        ms: next.songDurations[nextState.songId]?.ms ?? 0,
        lastPlayedAt: next.songDurations[nextState.songId]?.lastPlayedAt ?? nextState.now,
      };
    }
    return next;
  }

  if (next.concertActiveSince === null) next.concertActiveSince = nextState.now;
  if (next.activeSongId !== nextState.songId) {
    closeSongSpan();
    next.activeSongId = nextState.songId;
    next.songActiveSince = nextState.songId ? nextState.now : null;
  } else if (nextState.songId && next.songActiveSince === null) {
    next.songActiveSince = nextState.now;
  }

  if (nextState.songId) {
    next.songDurations[nextState.songId] = {
      name: nextState.songName,
      ms: next.songDurations[nextState.songId]?.ms ?? 0,
      lastPlayedAt: next.songDurations[nextState.songId]?.lastPlayedAt ?? nextState.now,
    };
  }
  return next;
}

function getConcertElapsedMs(session: ConcertSessionState, now: number): number {
  return session.concertAccumulatedMs + (session.concertActiveSince === null ? 0 : Math.max(0, now - session.concertActiveSince));
}

function getCurrentSongElapsedMs(session: ConcertSessionState, songId: string | null, now: number): number {
  if (!songId) return 0;
  const saved = session.songDurations[songId]?.ms ?? 0;
  const live = session.activeSongId === songId && session.songActiveSince !== null ? Math.max(0, now - session.songActiveSince) : 0;
  return saved + live;
}

function formatStageDuration(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  if (hours > 0) return `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function formatIstTime(ms: number): string {
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(new Date(ms)).toLowerCase();
}

function readSetlistBackup(value: unknown): SetlistState | null {
  if (!value || typeof value !== "object") return null;
  const candidate = value as { name?: unknown; songs?: unknown; setlist?: unknown };
  const setlist = candidate.setlist && typeof candidate.setlist === "object"
    ? candidate.setlist as { name?: unknown; songs?: unknown }
    : candidate;
  if (typeof setlist.name !== "string" || !Array.isArray(setlist.songs)) return null;
  return {
    name: setlist.name,
    songs: setlist.songs
      .filter((song): song is SavedSong => Boolean(song) && typeof (song as SavedSong).name === "string")
      .map((song) => ({
        ...song,
        id: song.id || `${Date.now()}-${Math.random().toString(16).slice(2)}`,
        bpm: clamp(Math.round(song.bpm || 100), 20, 300),
        timeSignature: song.timeSignature || { numerator: 4, denominator: 4 },
        pattern: song.pattern?.length ? song.pattern : buildDefaultPattern(song.timeSignature?.numerator ?? 4, 1),
        swing: song.swing ?? 0,
      })),
  };
}

function dominantSubdivision(pattern: BeatPattern[]): SubdivisionCount | null {
  if (pattern.length === 0) return null;
  const first = pattern[0]?.pulses;
  return first && pattern.every((beat) => beat.pulses === first) ? first : null;
}

function buildNeutralPattern(numerator: number, pulses: SubdivisionCount): BeatPattern[] {
  return Array.from({ length: clamp(Math.round(numerator || 4), 1, 16) }, () => ({
    pulses,
    accents: Array.from({ length: pulses }, () => "normal" as PulseAccent),
  }));
}

function allPulsesAre(pattern: BeatPattern[], accent: PulseAccent): boolean {
  return pattern.length > 0 && pattern.every((beat) => beat.accents.length > 0 && beat.accents.every((pulse) => pulse === accent));
}

function stageAssistSummary(polyrhythm: PolyrhythmConfig): string {
  if (polyrhythm.dottedMode !== "off") return DOTTED_PLAYBACK_LABELS[polyrhythm.dottedMode];
  if (polyrhythm.tripletMode !== "off") return TRIPLET_ASSIST_LABELS[polyrhythm.tripletMode];
  if (polyrhythm.jazzMode !== "off") return JAZZ_ASSIST_LABELS[polyrhythm.jazzMode];
  return "0";
}

function safeFileName(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "groove-setlist";
}
