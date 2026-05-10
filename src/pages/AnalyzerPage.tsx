import { useEffect, useRef, useState } from "react";
import { Midi } from "@tonejs/midi";
import * as Tone from "tone";
import { FileAudio, FileMusic, Mic, Pause, Play, RotateCcw, Square, Tag, X } from "lucide-react";

import { ImportZone, type DetectedKind } from "@/components/analyzer/ImportZone";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { analyzeAudioTempo, type TempoAnalysisResult } from "@/lib/audio-tempo";
import { analyzeMidi, type MidiAnalysis, type MidiPreviewNote } from "@/lib/midi-analyzer";
import { cn } from "@/lib/utils";
import type { UseMetronomeReturn } from "@/hooks/useMetronome";

interface AnalyzerPageProps {
  metronome: UseMetronomeReturn;
  active?: boolean;
  analyzerStartDelay: number;
  onAnalyzerStartDelayChange: (delaySeconds: number) => void;
  onPrepareAnalyzerClick: () => void;
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

type MidiInstrument = "keys" | "guitar" | "drums";

export function AnalyzerPage({
  metronome,
  active = true,
  analyzerStartDelay,
  onAnalyzerStartDelayChange,
  onPrepareAnalyzerClick,
  onUseAsBpm,
  onUseAsTimeSignature,
}: AnalyzerPageProps) {
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
          setItems((prev) => prev.map((entry) => entry.id === item.id && entry.kind === "audio" ? {
            ...entry,
            status: "ready",
            result,
            markers: markersFromAudio(result),
          } : entry));
        } else {
          const result = await analyzeMidi(item.file);
          setItems((prev) => prev.map((entry) => entry.id === item.id && entry.kind === "midi" ? {
            ...entry,
            status: "ready",
            result,
            markers: result.markers.map((marker) => ({ id: makeId(), timeSec: marker.timeSec, label: marker.label })),
          } : entry));
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
          Import up to five files, hear them in place, mark sections, then apply tempo or meter only when you choose.
        </p>
      </div>

      <AnalyzerMetronomeDock metronome={metronome} startDelay={analyzerStartDelay} onPrepare={onPrepareAnalyzerClick} />

      <ImportZone onFiles={handleFiles} busy={busy} status={status} />
      <LiveRecorder onRecorded={(file) => handleFiles([{ file, kind: "audio" }])} busy={busy} />

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
              active={active}
              onUseAsBpm={onUseAsBpm}
              onUseAsTimeSignature={onUseAsTimeSignature}
              onAnalyzerStartDelayChange={onAnalyzerStartDelayChange}
            />
          )}
        </div>
      )}

      {items.length === 0 && !busy && (
        <div className="rounded-md border border-border bg-card/40 p-6 text-sm text-muted-foreground">
          <p className="font-medium text-foreground mb-1">Drop audio or MIDI</p>
          <p className="text-xs leading-relaxed">
            Audio shows waveform, markers, and tempo candidates. MIDI shows playback, tempo map, sections, harmony clues, and track summaries.
          </p>
        </div>
      )}
    </div>
  );
}

function AnalyzerMetronomeDock({
  metronome,
  startDelay,
  onPrepare,
}: {
  metronome: UseMetronomeReturn;
  startDelay: number;
  onPrepare: () => void;
}) {
  const { state, start, stop, setBpm, adjustBpm } = metronome;
  const [draft, setDraft] = useState(String(Math.round(state.bpm)));

  useEffect(() => {
    setDraft(String(Math.round(state.bpm)));
  }, [state.bpm]);

  const commitDraft = () => {
    const value = Number(draft);
    if (Number.isFinite(value)) setBpm(Math.max(20, Math.min(300, Math.round(value))));
  };
  const toggleAnalyzerClick = () => {
    onPrepare();
    if (state.isPlaying) stop();
    else void start({ delaySeconds: startDelay });
  };

  return (
    <div className="rounded-lg border border-border bg-card/60 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="tiny-caps text-[10px] text-muted-foreground">Metronome while analyzing</div>
          <div className="mt-1 flex items-center gap-2">
            <input
              value={draft}
              onChange={(event) => setDraft(event.target.value.replace(/[^0-9.]/g, ""))}
              onBlur={commitDraft}
              onKeyDown={(event) => {
                if (event.key === "Enter") commitDraft();
              }}
              className="w-24 bg-transparent border-b border-border text-center font-serif text-4xl tabular text-primary outline-none focus:border-primary"
              inputMode="decimal"
              aria-label="Analyzer metronome BPM"
            />
            <span className="font-mono text-xs text-muted-foreground">BPM</span>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" variant="outline" onClick={() => adjustBpm(-1)}>-1</Button>
          <Button size="sm" onClick={toggleAnalyzerClick}>
            {state.isPlaying ? <Pause className="mr-2 size-4" /> : <Play className="mr-2 size-4" />}
            {state.isPlaying ? "Stop click" : "Play click"}
          </Button>
          <Button size="sm" variant="outline" onClick={() => adjustBpm(1)}>+1</Button>
          <Button size="sm" variant="outline" onClick={() => setBpm(Math.max(20, Math.round(state.bpm / 2)))}>Half</Button>
          <Button size="sm" variant="outline" onClick={() => setBpm(Math.min(300, Math.round(state.bpm * 2)))}>Double</Button>
        </div>
      </div>
    </div>
  );
}

function LiveRecorder({ onRecorded, busy }: { onRecorded: (file: File) => void; busy: boolean }) {
  const [recording, setRecording] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);

  const stop = () => {
    recorderRef.current?.stop();
  };

  const start = async () => {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      chunksRef.current = [];
      const recorder = new MediaRecorder(stream);
      recorderRef.current = recorder;
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };
      recorder.onstop = () => {
        stream.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
        setRecording(false);
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || "audio/webm" });
        if (blob.size > 0) {
          const ext = recorder.mimeType.includes("mp4") ? "m4a" : "webm";
          onRecorded(new File([blob], `live-tempo-${Date.now()}.${ext}`, { type: blob.type }));
        }
      };
      recorder.start();
      setRecording(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Microphone recording is unavailable.");
      setRecording(false);
    }
  };

  useEffect(() => {
    return () => {
      recorderRef.current?.stop();
      streamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  return (
    <div className="rounded-md border border-border bg-card/45 p-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="tiny-caps text-[10px] text-muted-foreground">Live tempo capture</div>
          <p className="mt-1 text-xs text-muted-foreground">Record a short sung, clapped, or played idea and analyze it like an imported audio file.</p>
        </div>
        <Button size="sm" variant={recording ? "destructive" : "outline"} disabled={busy} onClick={recording ? stop : start}>
          {recording ? <Square className="mr-2 size-4" /> : <Mic className="mr-2 size-4" />}
          {recording ? "Stop & analyze" : "Record"}
        </Button>
      </div>
      {error && <p className="mt-2 text-xs text-destructive">{error}</p>}
    </div>
  );
}

function AnalysisWorkspace({
  item,
  onRemove,
  onAddMarker,
  active,
  onUseAsBpm,
  onUseAsTimeSignature,
  onAnalyzerStartDelayChange,
}: {
  item: AnalyzerItem;
  onRemove: () => void;
  onAddMarker: (timeSec: number) => void;
  active: boolean;
  onUseAsBpm: (bpm: number) => void;
  onUseAsTimeSignature: (numerator: number, denominator: number) => void;
  onAnalyzerStartDelayChange: (delaySeconds: number) => void;
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
          <AudioWorkspace
            item={item}
            active={active}
            onAddMarker={onAddMarker}
            onUseAsBpm={onUseAsBpm}
            onUseAsTimeSignature={onUseAsTimeSignature}
            onAnalyzerStartDelayChange={onAnalyzerStartDelayChange}
          />
        ) : (
          <MidiWorkspace item={item} active={active} onUseAsBpm={onUseAsBpm} onUseAsTimeSignature={onUseAsTimeSignature} />
        )}
      </CardContent>
    </Card>
  );
}

function AudioWorkspace({
  item,
  active,
  onAddMarker,
  onUseAsBpm,
  onUseAsTimeSignature,
  onAnalyzerStartDelayChange,
}: {
  item: Extract<AnalyzerItem, { kind: "audio" }>;
  active: boolean;
  onAddMarker: (timeSec: number) => void;
  onUseAsBpm: (bpm: number) => void;
  onUseAsTimeSignature: (numerator: number, denominator: number) => void;
  onAnalyzerStartDelayChange: (delaySeconds: number) => void;
}) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const clickSynthRef = useRef<Tone.Synth | null>(null);
  const clickTimerRef = useRef<number | null>(null);
  const lastClickTimeRef = useRef(-Infinity);
  const [currentTime, setCurrentTime] = useState(0);
  const [trackClick, setTrackClick] = useState(false);
  const result = item.result;

  const duration = result?.durationSec ?? audioRef.current?.duration ?? 0;
  const updateAnalyzerDelay = () => {
    const audio = audioRef.current;
    if (!result || !audio || audio.paused || audio.ended) {
      onAnalyzerStartDelayChange(0);
      return;
    }
    onAnalyzerStartDelayChange(nextOnsetDelay(result.onsets, audio.currentTime));
  };

  useEffect(() => {
    if (!active) return;
    const handler = (event: KeyboardEvent) => {
      const target = event.target;
      const editable = target instanceof HTMLInputElement
        || target instanceof HTMLSelectElement
        || target instanceof HTMLTextAreaElement
        || (target instanceof HTMLElement && target.isContentEditable);
      if (editable || event.key.toLowerCase() !== "p" || !audioRef.current) return;
      event.preventDefault();
      if (audioRef.current.paused) void audioRef.current.play();
      else audioRef.current.pause();
    };
    window.addEventListener("keydown", handler, { capture: true });
    return () => window.removeEventListener("keydown", handler, { capture: true });
  }, [active]);

  useEffect(() => {
    updateAnalyzerDelay();
    return () => onAnalyzerStartDelayChange(0);
    // The delay is recalculated from audio element events below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item.id, result]);

  useEffect(() => {
    if (!active || !result) return;
    const timer = window.setInterval(updateAnalyzerDelay, 40);
    return () => window.clearInterval(timer);
    // Keep the parent start delay close to the next transient while audio rolls.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, result]);

  useEffect(() => {
    if (!trackClick || !result || !audioRef.current) {
      if (clickTimerRef.current) window.clearInterval(clickTimerRef.current);
      clickTimerRef.current = null;
      return;
    }

    const anchor = result.onsets.find((onset) => onset > 0.025) ?? 0;
    const period = 60 / result.bpm;

    clickSynthRef.current ??= new Tone.Synth({
      oscillator: { type: "triangle" },
      envelope: { attack: 0.001, decay: 0.035, sustain: 0, release: 0.02 },
    }).toDestination();

    clickTimerRef.current = window.setInterval(() => {
      const audio = audioRef.current;
      const synth = clickSynthRef.current;
      if (!audio || !synth || audio.paused || audio.ended) return;
      const t = audio.currentTime;
      const nextIndex = Math.max(0, Math.ceil((t - anchor - 0.015) / period));
      let clickAt = anchor + nextIndex * period;
      const nearbyOnset = nearestOnsetTime(result.onsets, clickAt, Math.min(0.04, period * 0.14));
      if (nearbyOnset !== undefined) clickAt = nearbyOnset;
      if (clickAt < t - 0.035 || clickAt > t + 0.055) return;
      if (Math.abs(clickAt - lastClickTimeRef.current) < period * 0.45) return;
      const downbeat = nextIndex % 4 === 0;
      lastClickTimeRef.current = clickAt;
      synth.triggerAttackRelease(downbeat ? 1320 : 940, downbeat ? "32n" : "64n", Tone.now() + Math.max(0.005, clickAt - t), downbeat ? 0.62 : 0.36);
    }, 18);

    return () => {
      if (clickTimerRef.current) window.clearInterval(clickTimerRef.current);
      clickTimerRef.current = null;
    };
  }, [trackClick, result]);

  useEffect(() => {
    return () => {
      if (clickTimerRef.current) window.clearInterval(clickTimerRef.current);
      clickSynthRef.current?.dispose();
    };
  }, []);

  return (
    <div className="space-y-5">
      <audio
        ref={audioRef}
        src={item.url}
        controls
        className="w-full"
        onTimeUpdate={(e) => {
          setCurrentTime(e.currentTarget.currentTime);
          updateAnalyzerDelay();
        }}
        onPlay={updateAnalyzerDelay}
        onPause={updateAnalyzerDelay}
        onLoadedMetadata={(e) => {
          setCurrentTime(e.currentTarget.currentTime);
          updateAnalyzerDelay();
        }}
        onSeeked={() => {
          lastClickTimeRef.current = -Infinity;
          updateAnalyzerDelay();
        }}
      />

      <WaveformLane
        peaks={result?.waveformPeaks}
        durationSec={duration}
        currentTime={currentTime}
        markers={item.markers}
        onSeek={(timeSec) => {
          if (audioRef.current) audioRef.current.currentTime = timeSec;
          setCurrentTime(timeSec);
          updateAnalyzerDelay();
        }}
      />

      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="outline" onClick={() => onAddMarker(audioRef.current?.currentTime ?? currentTime)}>
          <Tag className="mr-2 size-4" /> Add marker
        </Button>
        {result && (
          <Button
            size="sm"
            variant={trackClick ? "default" : "outline"}
            onClick={() => {
              void Tone.start();
              setTrackClick((value) => !value);
            }}
          >
            {trackClick ? "Locked click on" : "Locked click off"}
          </Button>
        )}
        {result && (
          <Button size="sm" onClick={() => onUseAsBpm(Math.round(result.bpm))}>
            Apply {Math.round(result.bpm)} BPM
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
  const [customBpm, setCustomBpm] = useState(String(Math.round(result.bpm)));
  useEffect(() => {
    setCustomBpm(String(Math.round(result.bpm)));
  }, [result.bpm]);
  const applyCustom = () => {
    const value = Number(customBpm);
    if (Number.isFinite(value)) onUseAsBpm(Math.max(20, Math.min(300, Math.round(value))));
  };
  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-[auto_minmax(0,1fr)]">
        <div>
          <div className="tiny-caps text-xs text-muted-foreground">Tempo</div>
          <div className="font-mono tabular-nums text-5xl font-bold text-primary leading-none">{result.bpm.toFixed(1)}</div>
          <div className="font-mono text-xs text-muted-foreground">stable avg {result.weightedBpm.toFixed(1)} BPM</div>
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
      <div className="rounded-md border border-border bg-background/45 p-3">
        <div className="tiny-caps mb-2 text-[10px] text-muted-foreground">Fine tune tempo</div>
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" onClick={() => onUseAsBpm(Math.round(result.bpm))}>
            Use {Math.round(result.bpm)}
          </Button>
          <input
            value={customBpm}
            onChange={(event) => setCustomBpm(event.target.value.replace(/[^0-9.]/g, ""))}
            className="h-9 w-24 rounded-md border border-border bg-card px-2 font-mono text-sm text-foreground outline-none focus:border-primary"
            inputMode="decimal"
            aria-label="Custom BPM"
          />
          <Button size="sm" variant="outline" onClick={applyCustom}>Set</Button>
        </div>
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
  active,
  onUseAsBpm,
  onUseAsTimeSignature,
}: {
  item: Extract<AnalyzerItem, { kind: "midi" }>;
  active: boolean;
  onUseAsBpm: (bpm: number) => void;
  onUseAsTimeSignature: (numerator: number, denominator: number) => void;
}) {
  const analysis = item.result;
  const ts = analysis?.timeSignatures[0];
  const [selectedSectionIds, setSelectedSectionIds] = useState<number[]>([]);
  const [splitMidi, setSplitMidi] = useState(60);
  const autoLockedRef = useRef<string | null>(null);

  useEffect(() => {
    setSelectedSectionIds([]);
  }, [item.id]);

  useEffect(() => {
    if (!analysis || autoLockedRef.current === item.id) return;
    autoLockedRef.current = item.id;
    if (analysis.hasExplicitTempo) {
      onUseAsBpm(Math.round(midiLockBpm(analysis)));
    }
    const firstMeter = analysis.timeSignatures[0];
    if (analysis.hasExplicitTimeSignature && firstMeter) {
      onUseAsTimeSignature(firstMeter.numerator, firstMeter.denominator);
    }
  }, [analysis, item.id, onUseAsBpm, onUseAsTimeSignature]);

  return (
    <div className="space-y-5">
      <MidiPlayer
        file={item.file}
        durationSec={analysis?.durationSec ?? 0}
        active={active}
        analysis={analysis}
        selectedSectionIds={selectedSectionIds}
      />

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
          <MidiReadout
            analysis={analysis}
            selectedSectionIds={selectedSectionIds}
            onSectionSelect={setSelectedSectionIds}
            splitMidi={splitMidi}
            onSplitMidiChange={setSplitMidi}
          />
        </>
      ) : (
        <LoadingAnalysis label="Reading MIDI…" />
      )}
    </div>
  );
}

function midiLockBpm(analysis: MidiAnalysis): number {
  if (analysis.tempos.length === 1) return analysis.tempos[0].bpm;
  if (analysis.bpmVariation <= 1.5) return analysis.weightedBpm || analysis.bpm;
  return analysis.tempos[0]?.bpm ?? analysis.weightedBpm ?? analysis.bpm;
}

function MidiPlayer({
  file,
  durationSec,
  active,
  analysis,
  selectedSectionIds,
}: {
  file: File;
  durationSec: number;
  active: boolean;
  analysis?: MidiAnalysis;
  selectedSectionIds: number[];
}) {
  const [playing, setPlaying] = useState(false);
  const [instrument, setInstrument] = useState<MidiInstrument>("keys");
  const disposablesRef = useRef<Tone.ToneAudioNode[]>([]);
  const stopTimerRef = useRef<number | null>(null);
  const loopTimerRef = useRef<number | null>(null);
  const playingRef = useRef(false);

  const stop = () => {
    disposablesRef.current.forEach((node) => node.dispose());
    disposablesRef.current = [];
    if (stopTimerRef.current) window.clearTimeout(stopTimerRef.current);
    stopTimerRef.current = null;
    if (loopTimerRef.current) window.clearTimeout(loopTimerRef.current);
    loopTimerRef.current = null;
    playingRef.current = false;
    setPlaying(false);
  };

  useEffect(() => stop, []);

  useEffect(() => {
    if (!active) return;
    const handler = (event: KeyboardEvent) => {
      const target = event.target;
      const editable = target instanceof HTMLInputElement
        || target instanceof HTMLSelectElement
        || target instanceof HTMLTextAreaElement
        || (target instanceof HTMLElement && target.isContentEditable);
      if (editable || event.key.toLowerCase() !== "p") return;
      event.preventDefault();
      void play();
    };
    window.addEventListener("keydown", handler, { capture: true });
    return () => window.removeEventListener("keydown", handler, { capture: true });
    // play intentionally closes over the latest instrument/playing state.
  });

  const play = async () => {
    if (playing) {
      stop();
      return;
    }
    await Tone.start();
    const midi = new Midi(await file.arrayBuffer());
    const synths = createMidiInstrument(instrument);
    await Tone.loaded();
    disposablesRef.current = synths.nodes;
    const sourceNotes = buildSustainAwareMidiNotes(midi).slice(0, 5000);
    const loopNotes = selectedSectionIds.length > 0 && analysis
      ? notesForSelectedSections(sourceNotes, analysis.sections.filter((section) => selectedSectionIds.includes(section.index)))
      : { notes: sourceNotes, duration: midi.duration };

    const schedule = () => {
      const now = Tone.now() + 0.08;
      for (const note of loopNotes.notes) {
        const velocity = Math.max(0.08, note.velocity);
        if (instrument === "drums") {
          triggerDrum(synths, note.midi, now + note.time, velocity);
        } else {
          synths.poly?.triggerAttackRelease(note.name, Math.max(0.03, note.duration), now + note.time, velocity);
        }
      }
      if (selectedSectionIds.length > 0 && playingRef.current) {
        loopTimerRef.current = window.setTimeout(schedule, Math.max(700, (loopNotes.duration + 0.12) * 1000));
      }
    };

    playingRef.current = true;
    schedule();
    setPlaying(true);
    if (selectedSectionIds.length === 0) {
      stopTimerRef.current = window.setTimeout(stop, Math.max(800, (midi.duration + 0.5) * 1000));
    }
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
          <option value="keys" className="bg-background">Light Piano</option>
          <option value="guitar" className="bg-background">Clean Guitar</option>
          <option value="drums" className="bg-background">Drums</option>
        </select>
        <span className="font-mono text-xs text-muted-foreground">{formatClock(durationSec)}</span>
        {selectedSectionIds.length > 0 && (
          <span className="rounded-full border border-primary/40 bg-primary/10 px-2 py-1 font-mono text-[10px] text-primary">
            looping {selectedSectionIds.length} section{selectedSectionIds.length === 1 ? "" : "s"}
          </span>
        )}
      </div>
    </div>
  );
}

function MidiReadout({
  analysis,
  selectedSectionIds,
  onSectionSelect,
  splitMidi,
  onSplitMidiChange,
}: {
  analysis: MidiAnalysis;
  selectedSectionIds: number[];
  onSectionSelect: (ids: number[]) => void;
  splitMidi: number;
  onSplitMidiChange: (midi: number) => void;
}) {
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
      <MidiPianoPreview notes={analysis.previewNotes} splitMidi={splitMidi} onSplitMidiChange={onSplitMidiChange} />
      {analysis.sections.length > 0 && (
        <div>
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <div className="tiny-caps text-[10px] text-muted-foreground">Musical sections</div>
            <div className="font-mono text-[10px] text-muted-foreground">Command-click sections to build a loop</div>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            {analysis.sections.map((section) => (
              <button
                key={section.index}
                type="button"
                onClick={(event) => {
                  if (event.metaKey || event.ctrlKey) {
                    const exists = selectedSectionIds.includes(section.index);
                    onSectionSelect(exists
                      ? selectedSectionIds.filter((id) => id !== section.index)
                      : [...selectedSectionIds, section.index]);
                  } else {
                    onSectionSelect(selectedSectionIds.length === 1 && selectedSectionIds[0] === section.index ? [] : [section.index]);
                  }
                }}
                className={cn(
                  "rounded-md border p-3 text-left transition-colors",
                  selectedSectionIds.includes(section.index) ? "border-primary bg-primary/10 ring-1 ring-primary/30" : "border-border bg-muted/20 hover:border-primary/40",
                )}
                style={{ borderLeftColor: midiSectionColor(section.colorIndex), borderLeftWidth: 5 }}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="flex min-w-0 items-center gap-2">
                    <span
                      className="size-3 rounded-full"
                      style={{ backgroundColor: midiSectionColor(section.colorIndex) }}
                      aria-hidden="true"
                    />
                    <span className="truncate font-serif text-lg">{section.label}</span>
                  </span>
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
              </button>
            ))}
          </div>
        </div>
      )}
      {analysis.markers.length > 0 && (
        <div>
          <div className="tiny-caps mb-2 text-[10px] text-muted-foreground">Auto markers</div>
          <div className="flex flex-wrap gap-1.5">
            {analysis.markers.map((marker, index) => (
              <span key={`${marker.timeSec}-${marker.label}-${index}`} className="rounded-full border border-border bg-muted/20 px-2 py-1 font-mono text-[11px] text-muted-foreground">
                {formatClock(marker.timeSec)} · {marker.label}
              </span>
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

function MidiPianoPreview({
  notes,
  splitMidi,
  onSplitMidiChange,
}: {
  notes: MidiPreviewNote[];
  splitMidi: number;
  onSplitMidiChange: (midi: number) => void;
}) {
  const firstKey = 48;
  const lastKey = 84;
  const keys = Array.from({ length: lastKey - firstKey + 1 }, (_, index) => firstKey + index);
  const activity = new Map<number, number>();
  notes.forEach((note) => {
    const current = activity.get(note.midi) ?? 0;
    activity.set(note.midi, current + note.durationSec * Math.max(0.08, note.velocity));
  });
  const maxActivity = Math.max(...Array.from(activity.values()), 0.01);
  const leftCount = notes.filter((note) => note.midi <= splitMidi).length;
  const rightCount = Math.max(0, notes.length - leftCount);

  return (
    <div className="rounded-md border border-border bg-background/45 p-3">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="tiny-caps text-[10px] text-muted-foreground">Piano map</div>
          <div className="font-mono text-[10px] text-muted-foreground">
            Split at {midiName(splitMidi)} · Shift-click or Command-click a key to move it
          </div>
        </div>
        <div className="flex gap-2 font-mono text-[10px] text-muted-foreground">
          <span className="rounded-full bg-primary/15 px-2 py-1 text-primary">LH {leftCount}</span>
          <span className="rounded-full bg-accent/15 px-2 py-1 text-accent">RH {rightCount}</span>
        </div>
      </div>
      <div className="relative h-24 overflow-hidden rounded-md border border-border bg-muted/20 p-1">
        <div className="flex h-full gap-px">
          {keys.map((midi) => {
            const black = [1, 3, 6, 8, 10].includes(midi % 12);
            const level = Math.min(1, (activity.get(midi) ?? 0) / maxActivity);
            const handClass = midi <= splitMidi ? "bg-primary" : "bg-accent";
            return (
              <button
                key={midi}
                type="button"
                title={`${midiName(midi)} ${midi <= splitMidi ? "left hand" : "right hand"}`}
                onClick={(event) => {
                  if (event.shiftKey || event.metaKey || event.ctrlKey) onSplitMidiChange(midi);
                }}
                className={cn(
                  "relative h-full flex-1 rounded-sm border transition-transform hover:-translate-y-0.5",
                  black ? "border-background bg-foreground/85" : "border-border bg-card",
                  midi === splitMidi && "ring-2 ring-primary",
                )}
                aria-label={`Set split to ${midiName(midi)}`}
              >
                <span
                  className={cn("absolute inset-x-0 bottom-0 rounded-sm opacity-70", handClass)}
                  style={{ height: `${Math.max(5, level * 78)}%` }}
                />
                {midi % 12 === 0 && (
                  <span className="absolute bottom-1 left-1/2 -translate-x-1/2 font-mono text-[8px] text-muted-foreground">
                    {midiName(midi)}
                  </span>
                )}
              </button>
            );
          })}
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

type MidiScheduledNote = {
  time: number;
  duration: number;
  name: string;
  midi: number;
  velocity: number;
  channel: number;
};

type SustainEvent = {
  time: number;
  down: boolean;
};

function buildSustainAwareMidiNotes(midi: Midi): MidiScheduledNote[] {
  const notesByChannel = new Map<number, MidiScheduledNote[]>();
  const sustainByChannel = new Map<number, SustainEvent[]>();

  for (const track of midi.tracks) {
    const channel = track.channel ?? 0;
    const channelNotes = notesByChannel.get(channel) ?? [];
    for (const note of track.notes) {
      channelNotes.push({
        time: note.time,
        duration: note.duration,
        name: note.name,
        midi: note.midi,
        velocity: note.velocity,
        channel,
      });
    }
    notesByChannel.set(channel, channelNotes);

    const sustainChanges = (track.controlChanges[64] ?? track.controlChanges.sustain ?? [])
      .map((cc) => ({ time: cc.time, down: cc.value >= 0.5 }))
      .sort((a, b) => a.time - b.time);
    if (sustainChanges.length > 0) {
      const existing = sustainByChannel.get(channel) ?? [];
      sustainByChannel.set(channel, [...existing, ...sustainChanges].sort((a, b) => a.time - b.time));
    }
  }

  const adjusted: MidiScheduledNote[] = [];
  for (const [channel, notes] of notesByChannel) {
    const sustainEvents = sustainByChannel.get(channel) ?? [];
    const byPitch = new Map<number, MidiScheduledNote[]>();
    for (const note of notes) {
      const group = byPitch.get(note.midi) ?? [];
      group.push(note);
      byPitch.set(note.midi, group);
    }

    for (const group of byPitch.values()) {
      group.sort((a, b) => a.time - b.time);
      group.forEach((note, index) => {
        const naturalEnd = note.time + note.duration;
        const sustainedEnd = findSustainRelease(naturalEnd, sustainEvents);
        const nextSamePitchStart = group[index + 1]?.time ?? Infinity;
        const end = Math.min(sustainedEnd, nextSamePitchStart, note.time + 12);
        adjusted.push({
          ...note,
          duration: Math.max(0.03, end - note.time),
        });
      });
    }
  }

  return adjusted.sort((a, b) => a.time - b.time || a.midi - b.midi);
}

function findSustainRelease(noteEnd: number, events: SustainEvent[]): number {
  let pedalDown = false;
  for (const event of events) {
    if (event.time <= noteEnd) {
      pedalDown = event.down;
      continue;
    }
    if (pedalDown && !event.down) return event.time;
    if (!pedalDown) return noteEnd;
  }
  return pedalDown ? noteEnd + 1.2 : noteEnd;
}

function notesForSelectedSections(
  notes: MidiScheduledNote[],
  sections: MidiAnalysis["sections"],
): { notes: MidiScheduledNote[]; duration: number } {
  if (sections.length === 0) {
    const duration = notes.reduce((max, note) => Math.max(max, note.time + note.duration), 0);
    return { notes, duration };
  }
  const ordered = [...sections].sort((a, b) => a.startSec - b.startSec);
  let offset = 0;
  const looped: MidiScheduledNote[] = [];
  for (const section of ordered) {
    const sectionDuration = Math.max(0.15, section.endSec - section.startSec);
    for (const note of notes) {
      if (note.time + note.duration < section.startSec || note.time > section.endSec) continue;
      const clippedStart = Math.max(note.time, section.startSec);
      const clippedEnd = Math.min(note.time + note.duration, section.endSec);
      if (clippedEnd <= clippedStart) continue;
      looped.push({
        ...note,
        time: offset + clippedStart - section.startSec,
        duration: Math.max(0.03, clippedEnd - clippedStart),
      });
    }
    offset += sectionDuration;
  }
  return { notes: looped.slice(0, 3500), duration: Math.max(0.15, offset) };
}

function createMidiInstrument(instrument: MidiInstrument): {
  nodes: Tone.ToneAudioNode[];
  poly?: Tone.PolySynth;
  kick?: Tone.MembraneSynth;
  snare?: Tone.NoiseSynth;
  hat?: Tone.MetalSynth;
} {
  if (instrument === "keys") {
    const keys = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: "triangle8" },
      envelope: { attack: 0.004, decay: 0.2, sustain: 0.22, release: 0.26 },
      volume: -8,
    });
    const tone = new Tone.Filter(4200, "lowpass").toDestination();
    keys.connect(tone);
    return { nodes: [keys, tone], poly: keys };
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

function midiName(midi: number): string {
  const names = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
  return `${names[((midi % 12) + 12) % 12]}${Math.floor(midi / 12) - 1}`;
}

function midiSectionColor(index: number): string {
  const colors = [
    "hsl(var(--primary))",
    "hsl(var(--accent))",
    "hsl(var(--amber))",
    "hsl(338 82% 66%)",
    "hsl(210 92% 70%)",
    "hsl(var(--secondary))",
    "hsl(var(--ring))",
    "hsl(var(--foreground))",
  ];
  return colors[((index % colors.length) + colors.length) % colors.length];
}

function nearestOnsetTime(onsets: number[], target: number, tolerance: number): number | undefined {
  let best: number | undefined;
  let bestDistance = tolerance;
  for (const onset of onsets) {
    const distance = Math.abs(onset - target);
    if (distance < bestDistance) {
      best = onset;
      bestDistance = distance;
    }
    if (onset > target + tolerance) break;
  }
  return best;
}

function nextOnsetDelay(onsets: number[], currentTime: number): number {
  for (const onset of onsets) {
    const delay = onset - currentTime;
    if (delay > 0.018) return Math.min(8, delay);
  }
  return 0;
}

function markersFromAudio(result: TempoAnalysisResult): Marker[] {
  const useful = result.windows
    .filter((window) => window.agreement >= 0.62)
    .slice(0, 5);
  if (useful.length === 0) return [];
  return useful.map((window, index) => ({
    id: makeId(),
    timeSec: window.startSec,
    label: index === 0 ? `${Math.round(result.bpm)} BPM` : `Stable ${index + 1}`,
  }));
}

function makeId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}
