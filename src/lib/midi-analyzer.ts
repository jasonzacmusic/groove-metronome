import { Midi } from "@tonejs/midi";

export interface MidiTrackSummary {
  name: string;
  channel: number;
  instrument: string;
  noteCount: number;
  avgVelocity: number;
  avgPitch: number;
  /** Max simultaneous notes (polyphony) for this track. */
  maxPolyphony: number;
}

export interface MidiTempoChange {
  timeSec: number;
  bpm: number;
}

export interface MidiTimeSignatureChange {
  timeSec: number;
  numerator: number;
  denominator: number;
}

export interface MidiAnalysis {
  fileName: string;
  durationSec: number;
  ppq: number;
  /** True if this looks like a "performance" rather than a quantized chart. */
  isPerformance: boolean;
  tempos: MidiTempoChange[];
  /** Stable tempo estimate (median if performance, header value otherwise). */
  bpm: number;
  bpmVariation: number;
  timeSignatures: MidiTimeSignatureChange[];
  /** Krumhansl–Schmuckler key estimate. */
  keyEstimate: { tonic: string; mode: "major" | "minor"; correlation: number };
  totalNotes: number;
  globalMaxPolyphony: number;
  tracks: MidiTrackSummary[];
  /** Free-form summary string for the UI. */
  explanation: string;
}

const PITCH_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

// Krumhansl–Schmuckler profiles (normalized below)
const MAJOR_PROFILE = [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88];
const MINOR_PROFILE = [6.33, 2.68, 3.52, 5.38, 2.6, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17];

export async function analyzeMidi(file: File): Promise<MidiAnalysis> {
  const buf = await file.arrayBuffer();
  const midi = new Midi(buf);

  const ppq = midi.header.ppq;
  const tempos: MidiTempoChange[] = midi.header.tempos.map((t) => ({
    timeSec: midi.header.ticksToSeconds(t.ticks),
    bpm: t.bpm,
  }));
  if (tempos.length === 0) tempos.push({ timeSec: 0, bpm: 120 });

  const timeSignatures: MidiTimeSignatureChange[] = midi.header.timeSignatures.map((ts) => ({
    timeSec: midi.header.ticksToSeconds(ts.ticks),
    numerator: ts.timeSignature[0],
    denominator: ts.timeSignature[1],
  }));
  if (timeSignatures.length === 0) timeSignatures.push({ timeSec: 0, numerator: 4, denominator: 4 });

  const tracks: MidiTrackSummary[] = [];
  const pitchClassDuration = new Array(12).fill(0);
  let totalNotes = 0;
  let totalVelocity = 0;
  let totalDuration = 0;
  let allOnOff: { time: number; delta: number }[] = [];

  for (const track of midi.tracks) {
    if (track.notes.length === 0) continue;
    let velSum = 0;
    let pitchSum = 0;
    const onOff: { time: number; delta: number }[] = [];
    for (const note of track.notes) {
      velSum += note.velocity;
      pitchSum += note.midi;
      pitchClassDuration[note.midi % 12] += note.duration;
      totalDuration += note.duration;
      onOff.push({ time: note.time, delta: 1 });
      onOff.push({ time: note.time + note.duration, delta: -1 });
      allOnOff.push({ time: note.time, delta: 1 });
      allOnOff.push({ time: note.time + note.duration, delta: -1 });
    }
    const maxPoly = polyphonyMax(onOff);
    tracks.push({
      name: track.name || `Track ${tracks.length + 1}`,
      channel: track.channel,
      instrument: track.instrument?.name ?? "unknown",
      noteCount: track.notes.length,
      avgVelocity: velSum / track.notes.length,
      avgPitch: pitchSum / track.notes.length,
      maxPolyphony: maxPoly,
    });
    totalNotes += track.notes.length;
    totalVelocity += velSum;
  }

  const globalMaxPolyphony = polyphonyMax(allOnOff);

  const bpms = tempos.map((t) => t.bpm).sort((a, b) => a - b);
  const medianBpm = bpms[Math.floor(bpms.length / 2)];
  const bpmVariation = bpms.length > 1 ? bpms[bpms.length - 1] - bpms[0] : 0;

  // Heuristic: if there are >5 tempo changes or wide BPM variation, it's a performance
  const isPerformance = tempos.length > 5 || bpmVariation > 5;

  const keyEstimate = estimateKey(pitchClassDuration);

  let explanation = `${midi.tracks.length} tracks, ${totalNotes} notes, ` +
    `${(midi.duration).toFixed(1)}s. `;
  explanation += `Tempo: ${medianBpm.toFixed(1)} BPM`;
  if (bpmVariation > 0.5) explanation += ` (varies by ${bpmVariation.toFixed(1)} BPM)`;
  explanation += `. Time signature: ${timeSignatures[0].numerator}/${timeSignatures[0].denominator}`;
  if (timeSignatures.length > 1) explanation += ` (${timeSignatures.length} changes)`;
  explanation += `. Estimated key: ${keyEstimate.tonic} ${keyEstimate.mode} `;
  explanation += `(corr ${keyEstimate.correlation.toFixed(2)}).`;
  if (isPerformance) explanation += " Likely a live performance — tempo varies.";

  return {
    fileName: file.name,
    durationSec: midi.duration,
    ppq,
    isPerformance,
    tempos,
    bpm: medianBpm,
    bpmVariation,
    timeSignatures,
    keyEstimate,
    totalNotes,
    globalMaxPolyphony,
    tracks,
    explanation,
  };
}

function polyphonyMax(events: { time: number; delta: number }[]): number {
  events.sort((a, b) => a.time - b.time || b.delta - a.delta);
  let cur = 0;
  let max = 0;
  for (const e of events) {
    cur += e.delta;
    if (cur > max) max = cur;
  }
  return max;
}

function estimateKey(pitchClassDuration: number[]): MidiAnalysis["keyEstimate"] {
  // Normalize pitch class vector
  const sum = pitchClassDuration.reduce((a, b) => a + b, 0) || 1;
  const x = pitchClassDuration.map((v) => v / sum);

  let bestCorr = -Infinity;
  let bestTonic = 0;
  let bestMode: "major" | "minor" = "major";

  for (let tonic = 0; tonic < 12; tonic++) {
    const major = rotate(MAJOR_PROFILE, tonic);
    const minor = rotate(MINOR_PROFILE, tonic);
    const cMaj = pearson(x, normalize(major));
    const cMin = pearson(x, normalize(minor));
    if (cMaj > bestCorr) {
      bestCorr = cMaj;
      bestTonic = tonic;
      bestMode = "major";
    }
    if (cMin > bestCorr) {
      bestCorr = cMin;
      bestTonic = tonic;
      bestMode = "minor";
    }
  }
  return { tonic: PITCH_NAMES[bestTonic], mode: bestMode, correlation: bestCorr };
}

function rotate(arr: number[], n: number): number[] {
  const out = new Array(arr.length);
  for (let i = 0; i < arr.length; i++) out[i] = arr[(i - n + arr.length) % arr.length];
  return out;
}

function normalize(arr: number[]): number[] {
  const sum = arr.reduce((a, b) => a + b, 0) || 1;
  return arr.map((v) => v / sum);
}

function pearson(a: number[], b: number[]): number {
  const n = a.length;
  let sumA = 0;
  let sumB = 0;
  for (let i = 0; i < n; i++) { sumA += a[i]; sumB += b[i]; }
  const meanA = sumA / n;
  const meanB = sumB / n;
  let num = 0;
  let denA = 0;
  let denB = 0;
  for (let i = 0; i < n; i++) {
    const da = a[i] - meanA;
    const db = b[i] - meanB;
    num += da * db;
    denA += da * da;
    denB += db * db;
  }
  const den = Math.sqrt(denA * denB);
  return den === 0 ? 0 : num / den;
}
