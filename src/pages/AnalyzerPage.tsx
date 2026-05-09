import { useEffect, useRef, useState } from "react";
import { Midi } from "@tonejs/midi";
import * as Tone from "tone";
import { FileAudio, FileMusic, Pause, Play, RotateCcw, Tag, X } from "lucide-react";

import { ImportZone, type DetectedKind } from "@/components/analyzer/ImportZone";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { analyzeAudioTempo, type TempoAnalysisResult } from "@/lib/audio-tempo";
import { analyzeMidi, type MidiAnalysis } from "@/lib/midi-analyzer";
import { cn } from "@/lib/utils";

interface AnalyzerPageProps {
  onUseAsBpm: (bpm: number) => void;
  onUseAsTimeSignature: (numerator: number, denominator: number) => void;
}

type AnalyzerItem =
  | {
      id: string;
      kind: "audio";
      file: File;
      name: string;
      url: string;
      status: "ready" | "analyzing" | "error";
      error?: string;
      result?: TempoAnalysisResult;
      markers: Marker[];
    }
  | {
      id: string;
      kind: "midi";
      file: File;
      name: string;
      url: string;
      status: "ready" | "analyzing" | "error";
      error?: string;
      result?: MidiAnalysis;
      markers: Marker[];
    };

interface Marker {
  id: string;
  timeSec: number;
  label: string;
}

type MidiInstrument = "piano" | "guitar" | "drums";

export function AnalyzerPage({ onUseAsBpm, onUseAsTimeSignature }: AnalyzerPageProps) {
  const [items, setItems] = useState<AnalyzerItem[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | undefined>(undefined);

  useEffect(() => {
    return () => {
      items.forEach((item) => URL.revokeObjectURL(item.url));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selected = items.find((item) => item.id === selectedId) ?? items[0] ?? null;

  const handleFiles = async (incoming: Array<{ file: File; kind: DetectedKind }>) => {
    const usable = incoming.filter((item): item is { file: File; kind: "audio" | "midi" } => item.kind !== "unknown").slice(0, 5);
    if (usable.length === 0) return;

    setBusy(true);
    const created: AnalyzerItem[] = usable.map(({ file, kind }) => ({
      id: makeId(),
      kind,
      file,
      name: file.name,
      url: URL.createObjectURL(file),
      status: "analyzing",
      markers: [],
    } as AnalyzerItem));

    setItems((prev) => {
      const next = [...created, ...prev].slice(0, 5);
      const removed = [...created, ...prev].slice(5);
      removed.forEach((item) => URL.revokeObjectURL(item.url));
      return next;
    });
    setSelectedId(created[0]?.id ?? null);

    for (const item of created) {
      try {
        setStatus(item.kind === "audio" ? `Analyzing audio: ${item.name}` : `Reading MIDI: ${item.name}`);
        if (item.kind === "audio") {
          const result = await analyzeAudioTempo(item.file);
          setItems((prev) => prev.map((entry) => entry.id === item.id && entry.kind === "audio" ? { ...entry, status: "ready", result } : entry));
        } else {
          const result = await analyzeMidi(item.file);
          setItems((prev) => prev.map((entry) => entry.id === item.id && entry.kind === "midi" ? { ...entry, status: "ready", result } : entry));
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : "Could not analyze this file.";
        setItems((prev) => prev.map((entry) => entry.id === item.id ? { ...entry, status: "error", error: message } : entry));
      }
    }
    setStatus(undefined);
    setBusy(false);
  };

  const removeItem = (id: string) => {
    setItems((prev) => {
      const removed = prev.find((item) => item.id === id);
      if (removed) URL.revokeObjectURL(removed.url);
      const next = prev.filter((item) => item.id !== id);
      if (selectedId === id) setSelectedId(next[0]?.id ?? null);
      return next;
    });
  };

  const addMarker = (itemId: string, timeSec: number) => {
    setItems((prev) => prev.map((item) => item.id === itemId ? {
      ...item,
      markers: [...item.markers, { id: makeId(), timeSec, label: `M${item.markers.length + 1}` }],
    } : item));
  };

  return (
    <div className="space-y-5 pb-12">
      <div className="rounded-lg border border-border bg-card/55 p-5">
        <h2 className="font-serif text-3xl">Media & MIDI Lab</h2>
        <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
          Import up to five files, listen in place, inspect tempo guesses, add markers, then explicitly apply a tempo or meter only when you choose.
        </p>
      </div>

      <ImportZone onFiles={handleFiles} busy={busy} status={status} />

      {items.length > 0 && (
        <div className="grid gap-5 lg:grid-cols-[280px_minmax(0,1fr)]">
          <aside className="space-y-2">
            {items.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setSelectedId(item.id)}
                className={cn(
                  "w-full rounded-md border p-3 text-left transition-colors",
                  selected?.id === item.id ? "border-primary bg-primary/10" : "border-border bg-card/45 hover:border-accent/70",
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="flex min-w-0 items-center gap-2">
                    {item.kind === "audio" ? <FileAudio className="size-4 text-primary" /> : <FileMusic className="size-4 text-accent" />}
                    <span className="truncate font-medium text-sm">{item.name}</span>
                  </span>
                  <Badge variant={item.status === "error" ? "destructive" : "outline"} className="font-mono text-[10px]">
                    {item.kind}
                  </Badge>
                </div>
                <div className="mt-2 flex items-center justify-between gap-2 font-mono text-xs text-muted-foreground">
                  <span>{item.status}</span>
                  <span>{item.markers.length} markers</span>
                </div>
              </button>
            ))}
          </aside>

          {selected && (
            <AnalysisWorkspace
              item={selected}
              onRemove={() => removeItem(selected.id)}
              onAddMarker={(timeSec) => addMarker(selected.id, timeSec)}
              onUseAsBpm={onUseAsBpm}
              onUseAsTimeSignature={onUseAsTimeSignature}
            />
          )}
        </div>
      )}

      {items.length === 0 && !busy && (
        <div className="rounded-md border border-border bg-card/40 p-6 text-sm text-muted-foreground">
          <p className="font-medium text-foreground mb-1">What this does</p>
          <p className="text-xs leading-relaxed">
            Audio files get a playable waveform, marker lane, tempo candidates, and an optional meter guess. MIDI files get playback, tempo map, sections, key/chord clues, and track summaries.
          </p>
        </div>
      )}
    </div>
  );
}

function AnalysisWorkspace({
  item,
  onRemove,
  onAddMarker,
  onUseAsBpm,
  onUseAsTimeSignature,
}: {
  item: AnalyzerItem;
  onRemove: () => void;
  onAddMarker: (timeSec: number) => void;
  onUseAsBpm: (bpm: number) => void;
  onUseAsTimeSignature: (numerator: number, denominator: number) => void;
}) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <CardTitle className="truncate text-lg">{item.name}</CardTitle>
            <p className="mt-1 text-xs text-muted-foreground">{item.kind === "audio" ? "Audio analysis and waveform" : "MIDI playback and musical analysis"}</p>
          </div>
          <Button variant="outline" size="sm" onClick={onRemove}>
            <X className="mr-2 size-4" /> Remove
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        {item.status === "error" && (
          <div className="rounded-md border border-destructive bg-destructive/10 p-3 text-sm text-destructive">
            {item.error}
          </div>
        )}

        {item.kind === "audio" ? (
          <AudioWorkspace item={item} onAddMarker={onAddMarker} onUseAsBpm={onUseAsBpm} onUseAsTimeSignature={onUseAsTimeSignature} />
        ) : (
          <MidiWorkspace item={item} onUseAsBpm={onUseAsBpm} onUseAsTimeSignature={onUseAsTimeSignature} />
        )}
      </CardContent>
    </Card>
  );
}

function AudioWorkspace({
  item,
  onAddMarker,
  onUseAsBpm,
  onUseAsTimeSignature,
}: {
  item: Extract<AnalyzerItem, { kind: "audio" }>;
  onAddMarker: (timeSec: number) => void;
  onUseAsBpm: (bpm: number) => void;
  onUseAsTimeSignature: (numerator: number, denominator: number) => void;
}) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const result = item.result;

  const duration = result?.durationSec ?? audioRef.current?.duration ?? 0;

  return (
    <div className="space-y-5">
      <audio
        ref={audioRef}
        src={item.url}
        controls
        className="w-full"
        onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
        onLoadedMetadata={(e) => setCurrentTime(e.currentTarget.currentTime)}
      />

      <WaveformLane
        peaks={result?.waveformPeaks}
        durationSec={duration}
        currentTime={currentTime}
        markers={item.markers}
        onSeek={(timeSec) => {
          if (audioRef.current) audioRef.current.currentTime = timeSec;
          setCurrentTime(timeSec);
        }}
      />

      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="outline" onClick={() => onAddMarker(audioRef.current?.currentTime ?? currentTime)}>
          <Tag className="mr-2 size-4" /> Add marker
        </Button>
        {result && (
          <Button size="sm" onClick={() => onUseAsBpm(Math.round(result.weightedBpm || result.bpm))}>
            Apply {Math.round(result.weightedBpm || result.bpm)} BPM
          </Button>
        )}
        {result?.timeSignature && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => onUseAsTimeSignature(result.timeSignature!.numerator, result.timeSignature!.denominator)}
          >
            Apply {result.timeSignature.numerator}/{result.timeSignature.denominator}
          </Button>
        )}
      </div>

      {result ? <AudioReadout result={result} onUseAsBpm={onUseAsBpm} /> : <LoadingAnalysis label="Analyzing audio tempo…" />}
    </div>
  );
}

function AudioReadout({ result, onUseAsBpm }: { result: TempoAnalysisResult; onUseAsBpm: (bpm: number) => void }) {
  const tightness = result.jitterSec < 0.02 ? "tight" : result.jitterSec < 0.05 ? "moderate" : "loose";
  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-[auto_minmax(0,1fr)]">
        <div>
          <div className="tiny-caps text-xs text-muted-foreground">Tempo</div>
          <div className="font-mono tabular-nums text-5xl font-bold text-primary leading-none">{result.bpm.toFixed(1)}</div>
          <div className="font-mono text-xs text-muted-foreground">weighted {result.weightedBpm.toFixed(1)} BPM</div>
        </div>
        <div className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
          <Stat label="Confidence" value={`${(result.confidence * 100).toFixed(0)}%`} />
          <Stat label="Onsets" value={String(result.onsets.length)} />
          <Stat label="Jitter" value={`${(result.jitterSec * 1000).toFixed(0)} ms`} />
          <Stat label="Tightness" value={tightness} />
        </div>
      </div>
      <div className="rounded-md border border-border bg-muted/20 p-3 text-xs leading-relaxed text-muted-foreground">
        {result.explanation}
      </div>
      {result.candidates.length > 1 && (
        <div>
          <div className="tiny-caps mb-2 text-[10px] text-muted-foreground">Tempo candidates</div>
          <div className="flex flex-wrap gap-1.5">
            {result.candidates.map((candidate) => (
              <button
                key={`${candidate.bpm}-${candidate.score}`}
                onClick={() => onUseAsBpm(Math.round(candidate.bpm))}
                className="rounded-full bg-muted/40 px-2 py-1 font-mono text-[11px] transition-colors hover:bg-muted/70"
              >
                {candidate.bpm.toFixed(1)} · {(candidate.score * 100).toFixed(0)}%
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function MidiWorkspace({
  item,
  onUseAsBpm,
  onUseAsTimeSignature,
}: {
  item: Extract<AnalyzerItem, { kind: "midi" }>;
  onUseAsBpm: (bpm: number) => void;
  onUseAsTimeSignature: (numerator: number, denominator: number) => void;
}) {
  const analysis = item.result;
  const ts = analysis?.timeSignatures[0];

  return (
    <div className="space-y-5">
      <MidiPlayer file={item.file} durationSec={analysis?.durationSec ?? 0} />

      {analysis ? (
        <>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" onClick={() => onUseAsBpm(Math.round(analysis.weightedBpm || analysis.bpm))}>
              Apply {Math.round(analysis.weightedBpm || analysis.bpm)} BPM
            </Button>
            {ts && (
              <Button size="sm" variant="outline" onClick={() => onUseAsTimeSignature(ts.numerator, ts.denominator)}>
                Apply {ts.numerator}/{ts.denominator}
              </Button>
            )}
          </div>
          <MidiReadout analysis={analysis} />
        </>
      ) : (
        <LoadingAnalysis label="Reading MIDI…" />
      )}
    </div>
  );
}

function MidiPlayer({ file, durationSec }: { file: File; durationSec: number }) {
  const [playing, setPlaying] = useState(false);
  const [instrument, setInstrument] = useState<MidiInstrument>("piano");
  const disposablesRef = useRef<Tone.ToneAudioNode[]>([]);
  const stopTimerRef = useRef<number | null>(null);

  const stop = () => {
    disposablesRef.current.forEach((node) => node.dispose());
    disposablesRef.current = [];
    if (stopTimerRef.current) window.clearTimeout(stopTimerRef.current);
    stopTimerRef.current = null;
    setPlaying(false);
  };

  useEffect(() => stop, []);

  const play = async () => {
    if (playing) {
      stop();
      return;
    }
    await Tone.start();
    const midi = new Midi(await file.arrayBuffer());
    const now = Tone.now() + 0.08;
    const synths = createMidiInstrument(instrument);
    disposablesRef.current = synths.nodes;
    const notes = midi.tracks.flatMap((track) => track.notes.map((note) => ({
      time: note.time,
      duration: note.duration,
      name: note.name,
      midi: note.midi,
      velocity: note.velocity,
      channel: track.channel,
    }))).slice(0, 3500);
    for (const note of notes) {
      const velocity = Math.max(0.08, note.velocity);
      if (instrument === "drums") {
        triggerDrum(synths, note.midi, now + note.time, velocity);
      } else {
        synths.poly?.triggerAttackRelease(note.name, Math.max(0.03, note.duration), now + note.time, velocity);
      }
    }
    setPlaying(true);
    stopTimerRef.current = window.setTimeout(stop, Math.max(800, (midi.duration + 0.5) * 1000));
  };

  return (
    <div className="rounded-md border border-border bg-muted/20 p-3">
      <div className="flex flex-wrap items-center gap-3">
        <Button size="sm" onClick={play}>
          {playing ? <Pause className="mr-2 size-4" /> : <Play className="mr-2 size-4" />}
          {playing ? "Stop MIDI" : "Play MIDI"}
        </Button>
        <select
          value={instrument}
          onChange={(e) => setInstrument(e.target.value as MidiInstrument)}
          className="metronome-select max-w-44"
          aria-label="MIDI instrument"
        >
          <option value="piano" className="bg-background">Salamander Piano</option>
          <option value="guitar" className="bg-background">Clean Guitar</option>
          <option value="drums" className="bg-background">Drums</option>
        </select>
        <span className="font-mono text-xs text-muted-foreground">{formatClock(durationSec)}</span>
      </div>
    </div>
  );
}

function MidiReadout({ analysis }: { analysis: MidiAnalysis }) {
  const ts = analysis.timeSignatures[0];
  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-[auto_minmax(0,1fr)]">
        <div>
          <div className="tiny-caps text-xs text-muted-foreground">MIDI Tempo</div>
          <div className="font-mono tabular-nums text-5xl font-bold text-primary leading-none">{analysis.bpm.toFixed(1)}</div>
          <div className="font-mono text-xs text-muted-foreground">weighted {analysis.weightedBpm.toFixed(1)} BPM</div>
        </div>
        <div className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
          <Stat label="Time sig" value={`${ts.numerator}/${ts.denominator}`} />
          <Stat label="Key" value={`${analysis.keyEstimate.tonic} ${analysis.keyEstimate.mode}`} />
          <Stat label="Notes" value={analysis.totalNotes.toLocaleString()} />
          <Stat label="Sections" value={String(analysis.sections.length)} />
        </div>
      </div>
      <div className="rounded-md border border-border bg-muted/20 p-3 text-xs leading-relaxed text-muted-foreground">
        {analysis.explanation}
      </div>
      {analysis.sections.length > 0 && (
        <div>
          <div className="tiny-caps mb-2 text-[10px] text-muted-foreground">Musical sections</div>
          <div className="grid gap-2 sm:grid-cols-2">
            {analysis.sections.map((section) => (
              <div key={section.index} className="rounded-md border border-border bg-muted/20 p-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-serif text-lg">Part {section.index}</span>
                  <span className="font-mono text-xs text-primary">{section.bpm.toFixed(1)} BPM</span>
                </div>
                <div className="mt-2 grid grid-cols-3 gap-2 font-mono text-[10px] text-muted-foreground">
                  <span>{formatClock(section.startSec)}-{formatClock(section.endSec)}</span>
                  <span>{section.estimatedBars} bars</span>
                  <span>{section.noteCount} notes</span>
                  <span>{section.topChord}</span>
                  <span>{section.keyEstimate.tonic} {section.keyEstimate.mode}</span>
                  <span>{section.density.toFixed(1)} n/s</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      <div>
        <div className="tiny-caps mb-2 text-[10px] text-muted-foreground">Tracks</div>
        <div className="space-y-1.5">
          {analysis.tracks.map((track, index) => (
            <div key={`${track.name}-${index}`} className="flex items-center justify-between gap-2 rounded-md bg-muted/20 px-3 py-2 text-xs">
              <div className="min-w-0">
                <div className="truncate font-medium">{track.name}</div>
                <div className="font-mono text-[10px] text-muted-foreground">{track.instrument} · ch {track.channel + 1}</div>
              </div>
              <div className="flex items-center gap-3 font-mono tabular-nums text-[11px] text-muted-foreground">
                <span>{track.noteCount}n</span>
                <span>v{Math.round(track.avgVelocity * 127)}</span>
                <span>p{track.maxPolyphony}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function WaveformLane({
  peaks,
  durationSec,
  currentTime,
  markers,
  onSeek,
}: {
  peaks?: number[];
  durationSec: number;
  currentTime: number;
  markers: Marker[];
  onSeek: (timeSec: number) => void;
}) {
  const laneRef = useRef<HTMLDivElement | null>(null);
  const displayPeaks = peaks?.length ? peaks : Array.from({ length: 96 }, (_, i) => 0.15 + Math.abs(Math.sin(i * 0.37)) * 0.35);
  const playhead = durationSec > 0 ? (currentTime / durationSec) * 100 : 0;

  return (
    <div
      ref={laneRef}
      className="relative overflow-x-auto rounded-md border border-border bg-background/45 p-3"
      onClick={(event) => {
        if (!laneRef.current || durationSec <= 0) return;
        const rect = laneRef.current.getBoundingClientRect();
        const ratio = Math.max(0, Math.min(1, (event.clientX - rect.left + laneRef.current.scrollLeft) / laneRef.current.scrollWidth));
        onSeek(ratio * durationSec);
      }}
    >
      <div className="relative flex h-28 min-w-[720px] items-center gap-0.5">
        {displayPeaks.map((peak, index) => (
          <span
            key={index}
            className="flex-1 rounded-full bg-primary/60"
            style={{ height: `${Math.max(6, peak * 92)}px` }}
          />
        ))}
        <span className="absolute inset-y-0 w-px bg-accent shadow-[0_0_10px_hsl(var(--accent))]" style={{ left: `${playhead}%` }} />
        {markers.map((marker) => (
          <span
            key={marker.id}
            className="absolute top-1 rounded-sm bg-amber px-1.5 py-0.5 font-mono text-[9px] text-background"
            style={{ left: `${durationSec > 0 ? (marker.timeSec / durationSec) * 100 : 0}%` }}
            title={`${marker.label} ${formatClock(marker.timeSec)}`}
          >
            {marker.label}
          </span>
        ))}
      </div>
      <div className="mt-2 flex justify-between font-mono text-[10px] text-muted-foreground">
        <span>{formatClock(currentTime)}</span>
        <span>{formatClock(durationSec)}</span>
      </div>
    </div>
  );
}

function createMidiInstrument(instrument: MidiInstrument): {
  nodes: Tone.ToneAudioNode[];
  poly?: Tone.PolySynth | Tone.Sampler;
  kick?: Tone.MembraneSynth;
  snare?: Tone.NoiseSynth;
  hat?: Tone.MetalSynth;
} {
  if (instrument === "piano") {
    const sampler = new Tone.Sampler({
      urls: {
        A0: "A0.mp3",
        C1: "C1.mp3",
        "D#1": "Ds1.mp3",
        "F#1": "Fs1.mp3",
        A1: "A1.mp3",
        C2: "C2.mp3",
        "D#2": "Ds2.mp3",
        "F#2": "Fs2.mp3",
        A2: "A2.mp3",
        C3: "C3.mp3",
        "D#3": "Ds3.mp3",
        "F#3": "Fs3.mp3",
        A3: "A3.mp3",
        C4: "C4.mp3",
        "D#4": "Ds4.mp3",
        "F#4": "Fs4.mp3",
        A4: "A4.mp3",
        C5: "C5.mp3",
        "D#5": "Ds5.mp3",
        "F#5": "Fs5.mp3",
        A5: "A5.mp3",
        C6: "C6.mp3",
        "D#6": "Ds6.mp3",
        "F#6": "Fs6.mp3",
        A6: "A6.mp3",
        C7: "C7.mp3",
        "D#7": "Ds7.mp3",
        "F#7": "Fs7.mp3",
        A7: "A7.mp3",
        C8: "C8.mp3",
      },
      release: 1,
      baseUrl: "https://tonejs.github.io/audio/salamander/",
    }).toDestination();
    return { nodes: [sampler], poly: sampler };
  }
  if (instrument === "guitar") {
    const guitar = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: "fmsquare" },
      envelope: { attack: 0.003, decay: 0.18, sustain: 0.12, release: 0.18 },
    }).toDestination();
    return { nodes: [guitar], poly: guitar };
  }
  const kick = new Tone.MembraneSynth({ pitchDecay: 0.025, octaves: 6 }).toDestination();
  const snare = new Tone.NoiseSynth({ envelope: { attack: 0.001, decay: 0.12, sustain: 0 } }).toDestination();
  const hat = new Tone.MetalSynth({ envelope: { attack: 0.001, decay: 0.05, release: 0.02 } }).toDestination();
  return { nodes: [kick, snare, hat], kick, snare, hat };
}

function triggerDrum(synths: ReturnType<typeof createMidiInstrument>, midi: number, time: number, velocity: number) {
  if ([35, 36].includes(midi)) synths.kick?.triggerAttackRelease("C2", "16n", time, velocity);
  else if ([38, 40].includes(midi)) synths.snare?.triggerAttackRelease("16n", time, velocity);
  else synths.hat?.triggerAttackRelease("32n", time, velocity * 0.75);
}

function LoadingAnalysis({ label }: { label: string }) {
  return (
    <div className="rounded-md border border-border bg-muted/20 p-4 text-sm text-muted-foreground">
      <RotateCcw className="mr-2 inline size-4 animate-spin text-primary" />
      {label}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md bg-muted/20 px-2 py-1.5">
      <div className="tiny-caps text-[9px] text-muted-foreground">{label}</div>
      <div className="font-mono tabular-nums text-sm">{value}</div>
    </div>
  );
}

function formatClock(sec: number): string {
  if (!Number.isFinite(sec) || sec <= 0) return "0:00";
  const minutes = Math.floor(sec / 60);
  const seconds = Math.floor(sec % 60);
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function makeId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}
