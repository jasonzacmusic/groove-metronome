import { useEffect, useRef, useState, type ReactNode } from "react";
import { ChevronLeft, ChevronRight, Download, Plus, Share2, Shield, Trash2, Upload } from "lucide-react";

import { Button } from "@/components/ui/button";
import { PolyrhythmWheel } from "@/components/metronome/PolyrhythmWheel";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import type { UseMetronomeReturn } from "@/hooks/useMetronome";
import {
  BEAT_SOUND_OPTIONS,
  buildDefaultPattern,
  pitchLabel,
  SUBDIVISION_NOTATION,
  SUBDIVISION_OPTIONS,
  type BeatPattern,
  type BeatSound,
  type MeterDenominator,
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

interface SetlistPageProps {
  metronome: UseMetronomeReturn;
  active?: boolean;
}

export function SetlistPage({ metronome, active = true }: SetlistPageProps) {
  const { state, setBpm, setTimeSignature, setBeatSound, setPitch, setPattern, setSwing, setGlobalSubdivision, setPolyrhythm, setTrainerEnabled, setRampEnabled, toggle, adjustBpm } = metronome;
  const [setlist, setSetlist] = useState<SetlistState>(() => readSetlist());
  const [songName, setSongName] = useState("New song");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [stageLock, setStageLock] = useState(false);
  const importRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    window.localStorage.setItem(SETLIST_STORAGE_KEY, JSON.stringify(setlist));
  }, [setlist]);

  const selectedSong = setlist.songs[selectedIndex] ?? null;
  const nextSong = setlist.songs[selectedIndex + 1] ?? null;

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
    if (navigator.share && (!nav.canShare || nav.canShare({ files: [file] }))) {
      await navigator.share({ title: setlist.name, text: "Groove Metronome setlist backup", files: [file] });
      return;
    }
    exportSetlist();
  };

  const importSetlist = async (file: File) => {
    const raw = await file.text();
    const incoming = readSetlistBackup(JSON.parse(raw));
    if (!incoming) return;
    setSetlist(incoming);
    setSelectedIndex(0);
    if (incoming.songs[0]) loadSong(incoming.songs[0], 0);
  };

  return (
    <div className="space-y-5 pb-12">
      <section className="rounded-lg border border-primary/35 bg-card/80 p-4 md:p-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="min-w-0">
            <span className="tiny-caps text-[10px] text-primary">Setlist Studio</span>
            <input
              value={setlist.name}
              onChange={(event) => setSetlist((prev) => ({ ...prev, name: event.target.value }))}
              className="mt-1 block w-full min-w-0 bg-transparent font-serif text-3xl outline-none focus:text-primary md:text-4xl"
              aria-label="Setlist name"
            />
          </div>
          <div className="flex flex-wrap gap-2">
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
            setPattern(buildDefaultPattern(timeSignature.numerator, subdivision));
          }}
          onSetSubdivision={setGlobalSubdivision}
          onSetBeatSound={setBeatSound}
          onSetPitch={setPitch}
          onSetSwing={setSwing}
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
  stageLock,
  onStageLock,
  onPrev,
  onNext,
  onToggle,
  onAdjustBpm,
  onSetBpm,
  onSetTimeSignature,
  onSetSubdivision,
  onSetBeatSound,
  onSetPitch,
  onSetSwing,
}: {
  active: boolean;
  song: SavedSong | null;
  nextSong: SavedSong | null;
  songIndex: number;
  songCount: number;
  state: UseMetronomeReturn["state"];
  stageLock: boolean;
  onStageLock: (locked: boolean) => void;
  onPrev: () => void;
  onNext: () => void;
  onToggle: () => void;
  onAdjustBpm: (delta: number) => void;
  onSetBpm: (bpm: number) => void;
  onSetTimeSignature: (timeSignature: TimeSignature) => void;
  onSetSubdivision: (subdivision: SubdivisionCount) => void;
  onSetBeatSound: (sound: BeatSound) => void;
  onSetPitch: (pitch: number) => void;
  onSetSwing: (swing: number) => void;
}) {
  const tapsRef = useRef<number[]>([]);
  const bpmInputRef = useRef<HTMLInputElement | null>(null);
  const [tapPreview, setTapPreview] = useState<{ count: number; bpm: number | null }>({ count: 0, bpm: null });
  const [bpmDraft, setBpmDraft] = useState(String(Math.round(state.bpm)));
  const activeSubdivision = dominantSubdivision(state.pattern);

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
      if (editable || (event.key !== "t" && event.key !== "T")) return;
      event.preventDefault();
      tap();
    };
    window.addEventListener("keydown", handler, { capture: true });
    return () => window.removeEventListener("keydown", handler, { capture: true });
  });

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
          className={
            "inline-flex min-h-10 items-center gap-2 rounded-md border px-3 tiny-caps text-[10px] transition-colors " +
            (stageLock ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:text-foreground")
          }
        >
          <Shield className="size-4" />
          {stageLock ? "Songs locked" : "Lock songs"}
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
            <div className="mt-2 grid grid-cols-[minmax(0,1fr)_5.5rem] items-end gap-3">
              <div className="font-serif text-6xl leading-none text-primary">{Math.round(state.bpm)}</div>
              <input
                ref={bpmInputRef}
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                value={bpmDraft}
                onChange={(event) => setBpmDraft(event.target.value)}
                onBlur={(event) => commitBpmDraft(event.currentTarget.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    commitBpmDraft(event.currentTarget.value);
                    event.currentTarget.blur();
                  }
                }}
                className="min-h-12 rounded-md border border-border bg-background/55 px-2 text-center font-mono text-lg outline-none focus:border-primary"
                aria-label="Stage tempo"
              />
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-primary/30 bg-[linear-gradient(145deg,hsl(var(--primary)/0.10),hsl(var(--background)/0.50))] p-3 md:p-5">
          <PolyrhythmWheel
            pattern={state.pattern}
            bpm={state.bpm}
            isPlaying={state.isPlaying}
            currentBeat={state.currentBeat}
            currentPulse={state.currentPulse}
            onCycleBeatSubdivision={() => {}}
            onCyclePulseAccent={() => {}}
            onTapTempo={tap}
          />
        </div>

        <div className="grid gap-3 sm:grid-cols-[1fr_1.45fr_1fr]">
          <StageButton label="Previous" icon={<ChevronLeft className="size-6" />} disabled={stageLock || songIndex <= 0} onClick={onPrev} />
          <StagePlayButton playing={state.isPlaying} onToggle={onToggle} />
          <StageButton label="Next" icon={<ChevronRight className="size-6" />} disabled={stageLock || songIndex >= songCount - 1} onClick={onNext} />
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <StageSettingsPanel title="Tempo Nudges" summary="-1 / +1 / -5 / +5">
            <div className="grid grid-cols-4 gap-2">
              <StageButton label="-1" onClick={() => onAdjustBpm(-1)} compact />
              <StageButton label="+1" onClick={() => onAdjustBpm(1)} compact />
              <StageButton label="-5" onClick={() => onAdjustBpm(-5)} compact />
              <StageButton label="+5" onClick={() => onAdjustBpm(5)} compact />
            </div>
          </StageSettingsPanel>

          <StageSettingsPanel title="Time Signature" summary={`${state.timeSignature.numerator}/${state.timeSignature.denominator}`}>
            <div className="grid grid-cols-3 gap-2">
              <StageButton label="4/4" compact onClick={() => setMeter(4, 4)} />
              <StageButton label="3/4" compact onClick={() => setMeter(3, 4)} />
              <StageButton label="6/8" compact onClick={() => setMeter(6, 8)} />
            </div>
            <div className="mt-3 grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2">
              <select
                value={state.timeSignature.numerator}
                onChange={(event) => setMeter(Number(event.target.value), state.timeSignature.denominator as MeterDenominator)}
                className="stage-select"
                aria-label="Stage beat count"
              >
                {Array.from({ length: 16 }, (_, index) => index + 1).map((value) => (
                  <option key={value} value={value} className="bg-background">{value}</option>
                ))}
              </select>
              <span className="font-serif text-3xl text-primary">/</span>
              <select
                value={state.timeSignature.denominator}
                onChange={(event) => setMeter(state.timeSignature.numerator, Number(event.target.value) as MeterDenominator)}
                className="stage-select"
                aria-label="Stage beat unit"
              >
                {[2, 4, 8, 16].map((value) => (
                  <option key={value} value={value} className="bg-background">{value}</option>
                ))}
              </select>
            </div>
          </StageSettingsPanel>

          <StageSettingsPanel
            title="Subdivision"
            summary={activeSubdivision ? `${SUBDIVISION_NOTATION[activeSubdivision].glyph} ${SUBDIVISION_NOTATION[activeSubdivision].label}` : "Mixed beats"}
          >
            <div className="grid grid-cols-4 gap-2">
              {SUBDIVISION_OPTIONS.map((subdivision) => (
                <button
                  key={subdivision}
                  type="button"
                  onPointerDown={(event) => {
                    event.preventDefault();
                    onSetSubdivision(subdivision);
                  }}
                  className={
                    "min-h-16 rounded-lg border px-2 text-center transition-colors " +
                    (activeSubdivision === subdivision
                      ? "border-primary bg-primary/15 text-primary"
                      : "border-border bg-background/45 text-muted-foreground hover:border-primary/70 hover:text-primary")
                  }
                  aria-pressed={activeSubdivision === subdivision}
                >
                  <span className="block font-serif text-2xl leading-none">{SUBDIVISION_NOTATION[subdivision].glyph}</span>
                  <span className="tiny-caps mt-1 block text-[9px]">{subdivision}</span>
                </button>
              ))}
            </div>
          </StageSettingsPanel>

          <StageSettingsPanel title="Swing" summary={`${state.swing}%`}>
            <label className="mt-3 block">
              <span className="tiny-caps text-[10px] text-muted-foreground">Swing</span>
              <input
                type="range"
                min={0}
                max={70}
                step={5}
                value={clamp(state.swing, 0, 70)}
                onChange={(event) => onSetSwing(Number(event.target.value))}
                className="mt-2 w-full accent-primary"
                aria-label="Stage swing"
              />
            </label>
          </StageSettingsPanel>

          <StageSettingsPanel title="Sound" summary={`${BEAT_SOUND_OPTIONS.find((sound) => sound.id === state.beatSound)?.label ?? "Click"} · ${pitchLabel(state.pitch)}`}>
            <label className="block">
              <span className="tiny-caps text-[10px] text-muted-foreground">Click sound</span>
              <select
                value={state.beatSound}
                onChange={(event) => onSetBeatSound(event.target.value as BeatSound)}
                className="stage-select mt-2"
                aria-label="Stage sound"
              >
                {BEAT_SOUND_OPTIONS.map((sound) => (
                  <option key={sound.id} value={sound.id} className="bg-background">
                    {sound.label} - {sound.family}
                  </option>
                ))}
              </select>
            </label>
            <label className="mt-4 block">
              <span className="tiny-caps text-[10px] text-muted-foreground">Pitch</span>
              <input
                type="range"
                min={0}
                max={100}
                step={1}
                value={state.pitch}
                onChange={(event) => onSetPitch(Number(event.target.value))}
                onDoubleClick={() => onSetPitch(50)}
                className="mt-2 w-full accent-primary"
                aria-label="Stage pitch"
                title="Double-click to reset pitch"
              />
            </label>
          </StageSettingsPanel>

          <StageSettingsPanel title="Tap Preview" summary={tapPreview.bpm ? `${tapPreview.bpm} BPM` : "Preview only"}>
            <TapPreview preview={tapPreview} onTap={tap} onSetBpm={onSetBpm} />
          </StageSettingsPanel>

          <StageSettingsPanel title="Timer" summary={formatTime(state.practiceSeconds)}>
            <div className="font-mono text-3xl tabular">{formatTime(state.practiceSeconds)}</div>
          </StageSettingsPanel>
        </div>
      </div>
    </section>
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

function TapPreview({ preview, onTap, onSetBpm }: { preview: { count: number; bpm: number | null }; onTap: () => void; onSetBpm: (bpm: number) => void }) {
  return (
    <div>
      <button
        type="button"
        onPointerDown={(event) => { event.preventDefault(); onTap(); }}
        className="min-h-16 w-full rounded-lg border border-primary/60 bg-primary/10 font-serif text-3xl text-primary transition-colors hover:bg-primary/15"
      >
        Tap
      </button>
      <div className="mt-3 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
        <div>
          <span className="block font-mono text-3xl tabular">{preview.bpm ?? "—"}</span>
          <span className="tiny-caps text-[10px] text-muted-foreground">{preview.count} taps · preview</span>
        </div>
        <Button disabled={!preview.bpm} onClick={() => preview.bpm && onSetBpm(preview.bpm)}>
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

function safeFileName(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "groove-setlist";
}
