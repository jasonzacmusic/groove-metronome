export type AccentLevel = "f" | "mf" | "p" | "mute";
export type BeatSound = "click" | "woodblock" | "rimshot" | "cowbell" | "clave";
export type Subdivision = "none" | "8th" | "16th" | "triplet" | "quintuplet" | "septuplet";

export const ACCENT_CYCLE: AccentLevel[] = ["f", "mf", "p", "mute"];
export const ACCENT_LABELS: Record<AccentLevel, string> = { f: "F", mf: "MF", p: "P", mute: "—" };
export const ACCENT_VOLUME: Record<AccentLevel, number> = { f: 0, mf: -8, p: -16, mute: -Infinity };

export const SOUND_FREQS: Record<BeatSound, { accent: number; normal: number; sub: number }> = {
  click:     { accent: 1000, normal: 800, sub: 600 },
  woodblock: { accent: 900,  normal: 700, sub: 500 },
  rimshot:   { accent: 1100, normal: 850, sub: 650 },
  cowbell:   { accent: 800,  normal: 650, sub: 480 },
  clave:     { accent: 2500, normal: 2000, sub: 1500 },
};

export const SOUND_ENVELOPES: Record<BeatSound, { attack: number; decay: number; sustain: number; release: number }> = {
  click:     { attack: 0.001, decay: 0.05,  sustain: 0,    release: 0.05 },
  woodblock: { attack: 0.001, decay: 0.08,  sustain: 0,    release: 0.06 },
  rimshot:   { attack: 0.001, decay: 0.04,  sustain: 0,    release: 0.03 },
  cowbell:   { attack: 0.001, decay: 0.15,  sustain: 0.02, release: 0.1  },
  clave:     { attack: 0.001, decay: 0.03,  sustain: 0,    release: 0.02 },
};

export const SUBDIVISION_COUNTS: Record<Subdivision, number> = {
  none: 1, "8th": 2, "16th": 4, triplet: 3, quintuplet: 5, septuplet: 7,
};

export interface TimeSignature {
  numerator: number;
  denominator: number;
}

export interface MetronomePreset {
  name: string;
  bpm: number;
  timeSig: [number, number];
  subdivision: Subdivision;
  swing: number;
  accents: AccentLevel[];
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

export const METRONOME_PRESETS: MetronomePreset[] = [
  { name: "Basic 4/4", bpm: 120, timeSig: [4, 4], subdivision: "none", swing: 0, accents: ["f","mf","mf","mf"] },
  { name: "Waltz 3/4", bpm: 108, timeSig: [3, 4], subdivision: "none", swing: 0, accents: ["f","p","p"] },
  { name: "Jazz Swing", bpm: 140, timeSig: [4, 4], subdivision: "triplet", swing: 40, accents: ["f","mf","mf","mf"] },
  { name: "March 2/4", bpm: 120, timeSig: [2, 4], subdivision: "none", swing: 0, accents: ["f","mf"] },
  { name: "6/8 Compound", bpm: 80, timeSig: [6, 8], subdivision: "none", swing: 0, accents: ["f","p","p","mf","p","p"] },
  { name: "5/4 Odd Meter", bpm: 160, timeSig: [5, 4], subdivision: "none", swing: 0, accents: ["f","mf","mf","mf","mf"] },
  { name: "7/8 Balkan", bpm: 140, timeSig: [7, 8], subdivision: "none", swing: 0, accents: ["f","mf","mf","mf","p","mf","p"] },
  { name: "Blues Shuffle", bpm: 100, timeSig: [4, 4], subdivision: "triplet", swing: 60, accents: ["f","mf","mf","mf"] },
  { name: "Bossa 2-feel", bpm: 130, timeSig: [4, 4], subdivision: "8th", swing: 0, accents: ["f","p","mf","p"] },
  { name: "Fast Bebop", bpm: 220, timeSig: [4, 4], subdivision: "none", swing: 30, accents: ["f","p","mf","p"] },
  { name: "12/8 Slow Blues", bpm: 60, timeSig: [12, 8], subdivision: "none", swing: 0, accents: ["f","p","p","mf","p","p","mf","p","p","mf","p","p"] },
  { name: "Samba", bpm: 100, timeSig: [2, 4], subdivision: "16th", swing: 0, accents: ["f","mf"] },
];

export function buildAccents(numerator: number): AccentLevel[] {
  return Array.from({ length: numerator }, (_, i) => (i === 0 ? "f" : "mf"));
}
