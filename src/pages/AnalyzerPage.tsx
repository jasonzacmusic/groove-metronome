import { useState } from "react";

import { AudioAnalysisCard } from "@/components/analyzer/AudioAnalysisCard";
import { ImportZone, type DetectedKind } from "@/components/analyzer/ImportZone";
import { MidiAnalysisCard } from "@/components/analyzer/MidiAnalysisCard";
import { analyzeAudioTempo, type TempoAnalysisResult } from "@/lib/audio-tempo";
import { analyzeMidi, type MidiAnalysis } from "@/lib/midi-analyzer";

interface AnalyzerPageProps {
  onUseAsBpm: (bpm: number) => void;
  onUseAsTimeSignature: (numerator: number, denominator: number) => void;
  onAnalysisDetected: (analysis: { bpm: number; timeSignature?: { numerator: number; denominator: number } }) => void;
}

interface AudioState {
  fileName: string;
  result: TempoAnalysisResult;
}

export function AnalyzerPage({ onUseAsBpm, onUseAsTimeSignature, onAnalysisDetected }: AnalyzerPageProps) {
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | undefined>(undefined);
  const [audio, setAudio] = useState<AudioState | null>(null);
  const [midi, setMidi] = useState<MidiAnalysis | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleFile = async (file: File, kind: DetectedKind) => {
    setError(null);
    setBusy(true);
    try {
      if (kind === "audio") {
        setStatus(`Decoding ${file.name}…`);
        const result = await analyzeAudioTempo(file);
        setAudio({ fileName: file.name, result });
        onAnalysisDetected({ bpm: Math.round(result.weightedBpm || result.bpm) });
      } else if (kind === "midi") {
        setStatus(`Parsing ${file.name}…`);
        const analysis = await analyzeMidi(file);
        setMidi(analysis);
        const ts = analysis.timeSignatures[0];
        onAnalysisDetected({
          bpm: Math.round(analysis.weightedBpm || analysis.bpm),
          timeSignature: ts ? { numerator: ts.numerator, denominator: ts.denominator } : undefined,
        });
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : "Failed to analyze file.";
      setError(message);
    } finally {
      setBusy(false);
      setStatus(undefined);
    }
  };

  return (
    <div className="space-y-5 pb-12">
      <div className="rounded-lg border border-border bg-card/55 p-5">
        <h2 className="font-serif text-3xl">Tempo & MIDI Lab</h2>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          Drop audio or MIDI here. The strongest tempo result is applied to the metronome automatically, while the full analysis stays here for checking.
        </p>
      </div>

      <ImportZone onFile={handleFile} busy={busy} status={status} />

      {error && (
        <div className="rounded-md border border-destructive bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {audio && (
        <AudioAnalysisCard fileName={audio.fileName} result={audio.result} onUseAsBpm={onUseAsBpm} />
      )}

      {midi && (
        <MidiAnalysisCard
          analysis={midi}
          onUseAsBpm={onUseAsBpm}
          onUseAsTimeSignature={onUseAsTimeSignature}
        />
      )}

      {!audio && !midi && !busy && (
        <div className="rounded-md border border-border bg-card/40 p-6 text-sm text-muted-foreground">
          <p className="font-medium text-foreground mb-1">What you can do here</p>
          <ul className="list-disc pl-5 space-y-1 text-xs">
            <li>Drop an audio loop (WAV, MP3, etc.) — we run a spectral-flux + autocorrelation tempo detector and show per-window stability so you can spot drift.</li>
            <li>Drop a MIDI file — we surface the header tempo, time signature, key, polyphony, per-track stats, and tempo curve for performances.</li>
            <li>Use any detected tempo or time signature as the metronome's setting with one tap.</li>
          </ul>
        </div>
      )}
    </div>
  );
}
