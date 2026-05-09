export type PulseAccent = "normal" | "accent" | "ghost" | "mute";
export type SubdivisionCount = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;
export type BeatSound =
  | "tone"
  | "studio"
  | "wood"
  | "cowbell"
  | "sample-tight"
  | "sample-clave"
  | "sample-marimba"
  | "sample-rim"
  | "sample-ping";

export const BEAT_SOUND_LABELS: Record<BeatSound, string> = {
  tone: "Tone",
  studio: "Studio",
  wood: "Wood",
  cowbell: "Bell",
  "sample-tight": "Tight",
  "sample-clave": "Clave",
  "sample-marimba": "Marimba",
  "sample-rim": "Rim",
  "sample-ping": "Ping",
};

export interface BeatSoundOption {
  id: BeatSound;
  label: string;
  family: "Modeled" | "Sampled";
}

export const BEAT_SOUND_OPTIONS: BeatSoundOption[] = [
  { id: "tone", label: BEAT_SOUND_LABELS.tone, family: "Modeled" },
  { id: "studio", label: BEAT_SOUND_LABELS.studio, family: "Modeled" },
  { id: "wood", label: BEAT_SOUND_LABELS.wood, family: "Modeled" },
  { id: "cowbell", label: BEAT_SOUND_LABELS.cowbell, family: "Modeled" },
  { id: "sample-tight", label: BEAT_SOUND_LABELS["sample-tight"], family: "Sampled" },
  { id: "sample-clave", label: BEAT_SOUND_LABELS["sample-clave"], family: "Sampled" },
  { id: "sample-marimba", label: BEAT_SOUND_LABELS["sample-marimba"], family: "Sampled" },
  { id: "sample-rim", label: BEAT_SOUND_LABELS["sample-rim"], family: "Sampled" },
  { id: "sample-ping", label: BEAT_SOUND_LABELS["sample-ping"], family: "Sampled" },
];

export interface SampleSoundSet {
  accent: string;
  normal: string;
  sub: string;
  gainDb?: number;
}

export const SAMPLE_SOUND_SETS: Partial<Record<BeatSound, SampleSoundSet>> = {
  "sample-tight": {
    accent: "/metronome-sounds/reapertips/tight-accent.wav",
    normal: "/metronome-sounds/reapertips/tight-normal.wav",
    sub: "/metronome-sounds/reapertips/tight-sub.wav",
    gainDb: -2,
  },
  "sample-clave": {
    accent: "/metronome-sounds/reapertips/clave-accent.wav",
    normal: "/metronome-sounds/reapertips/clave-normal.wav",
    sub: "/metronome-sounds/reapertips/clave-sub.wav",
    gainDb: -1,
  },
  "sample-marimba": {
    accent: "/metronome-sounds/reapertips/marimba-accent.wav",
    normal: "/metronome-sounds/reapertips/marimba-normal.wav",
    sub: "/metronome-sounds/reapertips/marimba-sub.wav",
    gainDb: -3,
  },
  "sample-rim": {
    accent: "/metronome-sounds/reapertips/rim-accent.wav",
    normal: "/metronome-sounds/reapertips/rim-normal.wav",
    sub: "/metronome-sounds/reapertips/rim-sub.wav",
    gainDb: -5,
  },
  "sample-ping": {
    accent: "/metronome-sounds/reapertips/ping-accent.wav",
    normal: "/metronome-sounds/reapertips/ping-normal.wav",
    sub: "/metronome-sounds/reapertips/ping-sub.wav",
    gainDb: -6,
  },
};

export interface BeatPattern {
  pulses: SubdivisionCount;
  accents: PulseAccent[];
}

export const PULSE_ACCENT_CYCLE: PulseAccent[] = ["normal", "accent", "ghost", "mute"];

export const PULSE_ACCENT_LABELS: Record<PulseAccent, string> = {
  accent: "ACC",
  normal: "NRM",
  ghost: "GHO",
  mute: "—",
};

export const PULSE_ACCENT_VOLUME: Record<PulseAccent, number> = {
  accent: 0,
  normal: -8,
  ghost: -22,
  mute: -Infinity,
};

export const PULSE_ACCENT_HEIGHT: Record<PulseAccent, number> = {
  accent: 1,
  normal: 0.66,
  ghost: 0.32,
  mute: 0.06,
};

/** Discrete level (0..3) used by the level-meter view. */
export const PULSE_ACCENT_LEVEL: Record<PulseAccent, number> = {
  accent: 3,
  normal: 2,
  ghost: 1,
  mute: 0,
};

export const LEVEL_TO_ACCENT: PulseAccent[] = ["mute", "ghost", "normal", "accent"];

export const SUBDIVISION_OPTIONS: SubdivisionCount[] = [1, 2, 3, 4, 5, 6, 7, 8];

export const SUBDIVISION_NOTATION: Record<SubdivisionCount, { glyph: string; label: string }> = {
  1: { glyph: "♩", label: "Crotchet" },
  2: { glyph: "♫", label: "2 quavers" },
  3: { glyph: "♬³", label: "Triplet" },
  4: { glyph: "♬♬", label: "4 semiquavers" },
  5: { glyph: "♬⁵", label: "Quintuplet" },
  6: { glyph: "♬⁶", label: "Sextuplet" },
  7: { glyph: "♬⁷", label: "Septuplet" },
  8: { glyph: "♬⁸", label: "8 demisemiquavers" },
};

/** A picker tile that applies a preset rhythmic pattern to a beat. */
export interface BeatPatternTile {
  id: string;
  label: string;
  glyph: string; // unicode music glyph(s)
  pattern: BeatPattern;
}

export const BEAT_PATTERN_TILES: BeatPatternTile[] = [
  { id: "quarter",        label: "Quarter",         glyph: "♩",   pattern: { pulses: 1, accents: ["normal"] } },
  { id: "eighths",        label: "Eighths",         glyph: "♫",   pattern: { pulses: 2, accents: ["normal", "ghost"] } },
  { id: "dotted",         label: "Dotted-8 + 16",   glyph: "♪.♬", pattern: { pulses: 4, accents: ["normal", "mute", "mute", "ghost"] } },
  { id: "triplet",        label: "Triplet",         glyph: "♬³",  pattern: { pulses: 3, accents: ["normal", "ghost", "ghost"] } },
  { id: "tripletRestA",   label: "Trip · Rest first", glyph: "𝄾♬", pattern: { pulses: 3, accents: ["mute", "ghost", "ghost"] } },
  { id: "tripletRestB",   label: "Trip · Rest mid",   glyph: "♬𝄾", pattern: { pulses: 3, accents: ["ghost", "mute", "ghost"] } },
  { id: "tripletRestC",   label: "Trip · Rest last",  glyph: "♬♬𝄾", pattern: { pulses: 3, accents: ["ghost", "ghost", "mute"] } },
  { id: "sixteenths",     label: "Sixteenths",      glyph: "♬♬",  pattern: { pulses: 4, accents: ["normal", "ghost", "ghost", "ghost"] } },
  { id: "quintuplet",     label: "5-let",           glyph: "♬⁵",  pattern: { pulses: 5, accents: ["normal", "ghost", "ghost", "ghost", "ghost"] } },
  { id: "sextuplet",      label: "6-let",           glyph: "♬⁶",  pattern: { pulses: 6, accents: ["normal", "ghost", "ghost", "ghost", "ghost", "ghost"] } },
  { id: "septuplet",      label: "7-let",           glyph: "♬⁷",  pattern: { pulses: 7, accents: ["normal", "ghost", "ghost", "ghost", "ghost", "ghost", "ghost"] } },
  { id: "rest",           label: "Silent beat",     glyph: "𝄽",   pattern: { pulses: 1, accents: ["mute"] } },
];

/** Polyrhythm: cross-voice fires `against` evenly-spaced clicks per bar. 0/1 = off. */
export interface PolyrhythmConfig {
  enabled: boolean;
  against: number; // 2..16
}

/**
 * Base frequencies (Hz) at neutral pitch. The pitch slider multiplies all three
 * proportionally, so accent / normal / sub spacing is preserved across pitch.
 */
export const SOUND_FREQS: Record<BeatSound, { accent: number; normal: number; sub: number }> = {
  tone:             { accent: 1000, normal: 800,  sub: 600 },
  studio:           { accent: 1750, normal: 1350, sub: 950 },
  wood:             { accent: 760,  normal: 560,  sub: 420 },
  cowbell:          { accent: 1120, normal: 840,  sub: 620 },
  "sample-tight":   { accent: 1000, normal: 800,  sub: 600 },
  "sample-clave":   { accent: 2200, normal: 1800, sub: 1400 },
  "sample-marimba": { accent: 820,  normal: 620,  sub: 460 },
  "sample-rim":     { accent: 1700, normal: 1300, sub: 900 },
  "sample-ping":    { accent: 1400, normal: 1050, sub: 760 },
};

export const SOUND_ENVELOPES: Record<BeatSound, { attack: number; decay: number; sustain: number; release: number }> = {
  tone:             { attack: 0.001, decay: 0.05, sustain: 0,    release: 0.05 },
  studio:           { attack: 0.001, decay: 0.025, sustain: 0,    release: 0.018 },
  wood:             { attack: 0.001, decay: 0.09, sustain: 0.01, release: 0.04 },
  cowbell:          { attack: 0.001, decay: 0.13, sustain: 0.02, release: 0.08 },
  "sample-tight":   { attack: 0.001, decay: 0.05, sustain: 0,    release: 0.05 },
  "sample-clave":   { attack: 0.001, decay: 0.03, sustain: 0,    release: 0.02 },
  "sample-marimba": { attack: 0.001, decay: 0.12, sustain: 0.01, release: 0.05 },
  "sample-rim":     { attack: 0.001, decay: 0.09, sustain: 0,    release: 0.04 },
  "sample-ping":    { attack: 0.001, decay: 0.12, sustain: 0,    release: 0.08 },
};

export type SynthOscillatorType = "sine" | "triangle" | "square";

export const SOUND_OSCILLATORS: Partial<Record<BeatSound, SynthOscillatorType>> = {
  tone: "sine",
  studio: "triangle",
  wood: "square",
  cowbell: "square",
};

/**
 * Pitch slider: 0..100, neutral = 50.
 * Maps to a frequency multiplier on a log curve from 0.4× (deep) to 2.5× (piercing).
 */
export function pitchToMultiplier(pitch: number): number {
  const clamped = Math.max(0, Math.min(100, pitch));
  return 0.4 * Math.pow(6.25, clamped / 100);
}

/** A friendly word for where the slider is sitting — no numbers required. */
export function pitchLabel(pitch: number): string {
  if (pitch < 18) return "Deep";
  if (pitch < 40) return "Wood";
  if (pitch < 62) return "Click";
  if (pitch < 82) return "Bright";
  return "Piercing";
}

export interface TimeSignature {
  numerator: number;
  denominator: number;
}

export interface MetronomePreset {
  name: string;
  bpm: number;
  timeSig: [number, number];
  pattern: BeatPattern[];
  swing: number;
}

export const TEMPO_PRESETS: { label: string; bpm: number }[] = [
  { label: "Largo", bpm: 50 },
  { label: "Adagio", bpm: 72 },
  { label: "Andante", bpm: 92 },
  { label: "Moderato", bpm: 108 },
  { label: "Allegro", bpm: 132 },
  { label: "Vivace", bpm: 168 },
  { label: "Presto", bpm: 190 },
];

function pattern(beats: Array<[SubdivisionCount, PulseAccent[]]>): BeatPattern[] {
  return beats.map(([pulses, accents]) => ({ pulses, accents: accents.slice(0, pulses) }));
}

function uniformBeat(numerator: number, pulses: SubdivisionCount, accents: PulseAccent[]): BeatPattern[] {
  return Array.from({ length: numerator }, (_, i) => ({
    pulses,
    accents: Array.from({ length: pulses }, (_, p) => {
      if (p === 0) return i === 0 ? "accent" : accents[0] ?? "normal";
      return accents[p] ?? "normal";
    }),
  }));
}

export const METRONOME_PRESETS: MetronomePreset[] = [
  {
    name: "Basic 4/4",
    bpm: 120,
    timeSig: [4, 4],
    swing: 0,
    pattern: uniformBeat(4, 1, ["accent"]),
  },
  {
    name: "Waltz 3/4",
    bpm: 108,
    timeSig: [3, 4],
    swing: 0,
    pattern: pattern([
      [1, ["accent"]],
      [1, ["ghost"]],
      [1, ["ghost"]],
    ]),
  },
  {
    name: "Jazz Swing",
    bpm: 140,
    timeSig: [4, 4],
    swing: 40,
    pattern: pattern([
      [3, ["accent", "ghost", "normal"]],
      [3, ["normal", "ghost", "normal"]],
      [3, ["normal", "ghost", "normal"]],
      [3, ["normal", "ghost", "normal"]],
    ]),
  },
  {
    name: "March 2/4",
    bpm: 120,
    timeSig: [2, 4],
    swing: 0,
    pattern: uniformBeat(2, 2, ["normal", "ghost"]),
  },
  {
    name: "6/8 Compound",
    bpm: 80,
    timeSig: [6, 8],
    swing: 0,
    pattern: pattern([
      [1, ["accent"]],
      [1, ["ghost"]],
      [1, ["ghost"]],
      [1, ["normal"]],
      [1, ["ghost"]],
      [1, ["ghost"]],
    ]),
  },
  {
    name: "5/4 Odd",
    bpm: 160,
    timeSig: [5, 4],
    swing: 0,
    pattern: pattern([
      [1, ["accent"]],
      [1, ["normal"]],
      [1, ["normal"]],
      [1, ["normal"]],
      [1, ["ghost"]],
    ]),
  },
  {
    name: "7/8 Balkan",
    bpm: 140,
    timeSig: [7, 8],
    swing: 0,
    pattern: pattern([
      [1, ["accent"]],
      [1, ["normal"]],
      [1, ["normal"]],
      [1, ["normal"]],
      [1, ["ghost"]],
      [1, ["normal"]],
      [1, ["ghost"]],
    ]),
  },
  {
    name: "Polyrhythm 3:4",
    bpm: 100,
    timeSig: [4, 4],
    swing: 0,
    pattern: pattern([
      [3, ["accent", "ghost", "normal"]],
      [3, ["normal", "ghost", "normal"]],
      [3, ["normal", "ghost", "normal"]],
      [3, ["normal", "ghost", "normal"]],
    ]),
  },
  {
    name: "Mixed Beat Study",
    bpm: 92,
    timeSig: [4, 4],
    swing: 0,
    pattern: pattern([
      [1, ["accent"]],
      [2, ["mute", "normal"]],
      [3, ["normal", "mute", "normal"]],
      [4, ["normal", "normal", "normal", "normal"]],
    ]),
  },
  {
    name: "Bossa 2-feel",
    bpm: 130,
    timeSig: [4, 4],
    swing: 0,
    pattern: pattern([
      [2, ["accent", "ghost"]],
      [2, ["ghost", "normal"]],
      [2, ["normal", "ghost"]],
      [2, ["ghost", "normal"]],
    ]),
  },
  {
    name: "Samba",
    bpm: 100,
    timeSig: [2, 4],
    swing: 0,
    pattern: uniformBeat(2, 4, ["accent", "ghost", "normal", "ghost"]),
  },
  {
    name: "5-let Study",
    bpm: 92,
    timeSig: [4, 4],
    swing: 0,
    pattern: uniformBeat(4, 5, ["accent", "ghost", "ghost", "ghost", "ghost"]),
  },
  {
    name: "7-let Study",
    bpm: 86,
    timeSig: [4, 4],
    swing: 0,
    pattern: uniformBeat(4, 7, ["accent", "ghost", "ghost", "ghost", "ghost", "ghost", "ghost"]),
  },
];

export function buildDefaultPattern(numerator: number, pulses: SubdivisionCount = 1): BeatPattern[] {
  return Array.from({ length: numerator }, (_, i) => ({
    pulses,
    accents: Array.from({ length: pulses }, (_, p) => {
      if (i === 0 && p === 0) return "accent";
      if (p === 0) return "normal";
      return "ghost";
    }),
  }));
}

export function nextSubdivision(n: SubdivisionCount): SubdivisionCount {
  return ((n % 8) + 1) as SubdivisionCount;
}

export function withSubdivision(beat: BeatPattern, pulses: SubdivisionCount): BeatPattern {
  const accents: PulseAccent[] = Array.from({ length: pulses }, (_, p) => {
    if (p < beat.accents.length) return beat.accents[p];
    return "normal";
  });
  if (accents.length > 0 && accents[0] === "mute") accents[0] = "normal";
  return { pulses, accents };
}
