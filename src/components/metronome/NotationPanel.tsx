import { useEffect, useRef } from "react";
import {
  Beam,
  Formatter,
  Renderer,
  Stave,
  StaveNote,
  Tuplet,
  Voice,
  type RenderContext,
} from "vexflow";

import {
  type BeatPattern,
  type PolyrhythmConfig,
  type PulseAccent,
  type TimeSignature,
} from "@/lib/metronome-types";

interface NotationPanelProps {
  view?: "beatmap" | "levels" | "polyrhythm" | "polymeter";
  pattern: BeatPattern[];
  polyrhythm?: PolyrhythmConfig;
  timeSignature: TimeSignature;
  currentBeat: number;
  currentPulse?: number;
  currentPoly?: number;
  isPlaying: boolean;
  onCyclePulse?: (beatIndex: number, pulseIndex: number) => void;
  onCycleBeatSubdivision?: (beatIndex: number) => void;
}

interface NoteSpec {
  duration: string;
  rest: boolean;
  accent: PulseAccent;
}

function pulsesToNoteSpecs(pat: BeatPattern): NoteSpec[] {
  const notes: NoteSpec[] = [];
  const baseDuration = (() => {
    switch (pat.pulses) {
      case 1: return "q";
      case 2: return "8";
      case 3: return "8";
      case 4: return "16";
      case 5: return "16";
      case 6: return "16";
      case 7: return "16";
      case 8: return "32";
      default: return "16";
    }
  })();
  for (let i = 0; i < pat.pulses; i++) {
    const acc = pat.accents[i] ?? "normal";
    notes.push({ duration: baseDuration, rest: acc === "mute", accent: acc });
  }
  return notes;
}

const AMBER = "rgb(174, 112, 16)";
const FG = "rgb(17, 24, 39)";
const GHOST = "rgba(17, 24, 39, 0.42)";
const STAFF = "rgba(17, 24, 39, 0.68)";

function colorFor(accent: PulseAccent, isActive: boolean): string {
  if (isActive) return AMBER;
  switch (accent) {
    case "accent": return AMBER;
    case "normal": return FG;
    case "ghost":  return GHOST;
    case "mute":   return GHOST;
  }
}

export function NotationPanel({
  view = "beatmap",
  pattern,
  polyrhythm,
  timeSignature,
  currentBeat,
  currentPulse = -1,
  currentPoly = -1,
  isPlaying,
  onCyclePulse,
  onCycleBeatSubdivision,
}: NotationPanelProps) {
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const host = ref.current;
    if (!host) return;
    host.innerHTML = "";

    const width = Math.max(380, host.clientWidth || 600);
    const polyVoiceCounts = polyrhythm?.enabled ? [polyrhythm.main, ...polyrhythm.voices].filter((count) => count >= 2).slice(0, 4) : [];
    const isPolyPreview = view === "polyrhythm" && polyVoiceCounts.length > 0;
    const polymeterSteps = polyrhythm?.polymeterEnabled ? polyrhythm.polymeterLanes.slice(0, 4) : [];
    const isPolymeterPreview = view === "polymeter" && polymeterSteps.length > 0;
    const height = isPolyPreview
      ? Math.max(170, 64 + polyVoiceCounts.length * 58)
      : isPolymeterPreview
      ? Math.max(170, 74 + polymeterSteps.length * 48)
      : 170;

    let renderer: Renderer | null = null;
    let ctx: RenderContext | null = null;

    try {
      renderer = new Renderer(host, Renderer.Backends.SVG);
      renderer.resize(width, height);
      ctx = renderer.getContext();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (ctx as any).setBackgroundFillStyle?.("transparent");

      if (isPolyPreview) {
        drawPolyrhythmNotation(ctx, host, width, polyVoiceCounts, currentBeat, currentPoly, isPlaying);
        return;
      }
      if (isPolymeterPreview) {
        drawPolymeterNotation(ctx, host, width, polymeterSteps, currentBeat, currentPoly, isPlaying);
        return;
      }

      const stave = new Stave(10, 26, width - 20);
      stave.addClef("percussion");
      stave.addTimeSignature(`${timeSignature.numerator}/${timeSignature.denominator}`);
      stave.setStyle({ strokeStyle: STAFF, fillStyle: STAFF });
      stave.setContext(ctx).draw();

      const allNotes: StaveNote[] = [];
      const beams: Beam[] = [];
      const tuplets: Tuplet[] = [];

      pattern.forEach((beat, beatIdx) => {
        const specs = pulsesToNoteSpecs(beat);
        const beatNotes: StaveNote[] = specs.map((spec, pulseIdx) => {
          const note = new StaveNote({
            keys: ["b/4"],
            duration: spec.rest ? `${spec.duration}r` : spec.duration,
            stem_direction: 1,
          });
          const color = colorFor(spec.accent, isPlaying && currentBeat === beatIdx && currentPulse === pulseIdx);
          note.setStyle({ fillStyle: color, strokeStyle: color });
          if (spec.accent === "ghost" && !spec.rest) {
            // Visual cue for ghost: smaller / parenthesized — VexFlow has limited support here,
            // so we lean on the dimmer color to denote ghost.
          }
          return note;
        });
        allNotes.push(...beatNotes);

        // Beaming: only beam non-rest sequences of 8th/16th/32nd within a beat
        const beamable = beatNotes.filter((n, i) => !specs[i].rest && spec(n) !== "q");
        if (beamable.length >= 2) {
          beams.push(new Beam(beamable));
        }

        // Tuplets for non-power-of-2 pulse counts
        if (beat.pulses === 3) {
          tuplets.push(new Tuplet(beatNotes, { num_notes: 3, notes_occupied: 2 }));
        } else if (beat.pulses === 5) {
          tuplets.push(new Tuplet(beatNotes, { num_notes: 5, notes_occupied: 4 }));
        } else if (beat.pulses === 6) {
          tuplets.push(new Tuplet(beatNotes, { num_notes: 6, notes_occupied: 4 }));
        } else if (beat.pulses === 7) {
          tuplets.push(new Tuplet(beatNotes, { num_notes: 7, notes_occupied: 4 }));
        }
      });

      const voice = new Voice({ num_beats: timeSignature.numerator, beat_value: timeSignature.denominator });
      voice.setStrict(false);
      voice.addTickables(allNotes);

      new Formatter().joinVoices([voice]).format([voice], width - 130);
      voice.draw(ctx, stave);
      beams.forEach((b) => b.setContext(ctx as RenderContext).draw());
      tuplets.forEach((t) => t.setContext(ctx as RenderContext).draw());
    } catch {
      // Swallow render errors so a malformed pattern doesn't blow up the page.
      host.innerHTML = "";
    }
    return () => {
      if (host) host.innerHTML = "";
    };
  }, [view, pattern, polyrhythm, timeSignature.numerator, timeSignature.denominator, currentBeat, currentPulse, currentPoly, isPlaying]);

  const canEditNotation = view !== "polyrhythm" && Boolean(onCyclePulse);

  return (
    <div className="relative">
      <div ref={ref} className="w-full overflow-x-auto" />
      {canEditNotation && (
        <div className="absolute inset-x-2 top-12 bottom-8 grid" style={{ gridTemplateColumns: `repeat(${Math.max(1, pattern.length)}, minmax(0, 1fr))` }}>
          {pattern.map((beat, beatIndex) => (
            <div key={beatIndex} className="grid" style={{ gridTemplateColumns: `repeat(${beat.pulses}, minmax(0, 1fr))` }}>
              {beat.accents.map((accent, pulseIndex) => (
                <button
                  key={`${beatIndex}-${pulseIndex}`}
                  type="button"
                  className="rounded-sm border border-transparent hover:border-primary/40 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/70"
                  title={`Beat ${beatIndex + 1}, pulse ${pulseIndex + 1}: ${accent}. Click to toggle accent, double-click to change subdivision.`}
                  aria-label={`Edit beat ${beatIndex + 1}, pulse ${pulseIndex + 1}`}
                  onPointerDown={(e) => e.preventDefault()}
                  onClick={(e) => {
                    e.preventDefault();
                    onCyclePulse?.(beatIndex, pulseIndex);
                  }}
                  onDoubleClick={(e) => {
                    e.preventDefault();
                    onCycleBeatSubdivision?.(beatIndex);
                  }}
                />
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// Helper: VexFlow's StaveNote duration accessor.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function spec(n: StaveNote): string { return (n as any).duration ?? "q"; }

function drawPolyrhythmNotation(
  ctx: RenderContext,
  host: HTMLDivElement,
  width: number,
  voiceCounts: number[],
  currentBeat: number,
  currentPoly: number,
  isPlaying: boolean,
) {
  const voices: Voice[] = [];
  const staves: Stave[] = [];
  const labels = ["Main", "Voice 2", "Voice 3", "Voice 4"];
  const colors = ["rgb(174, 112, 16)", "rgb(31, 119, 142)", "rgb(124, 92, 188)", "rgb(198, 89, 82)"];

  voiceCounts.forEach((count, row) => {
    const y = 18 + row * 58;
    const stave = new Stave(62, y, width - 78);
    stave.setStyle({ strokeStyle: STAFF, fillStyle: STAFF });
    stave.setContext(ctx).draw();
    staves.push(stave);

    const notes = Array.from({ length: count }, (_, index) => {
      const note = new StaveNote({ keys: ["b/4"], duration: "q", stem_direction: 1 });
      const isActive = isPlaying && ((row === 0 && currentBeat === index) || (row === 1 && currentPoly === index));
      const color = isActive || index === 0 ? colors[row] ?? FG : row === 0 ? FG : "rgba(17, 24, 39, 0.54)";
      note.setStyle({ fillStyle: color, strokeStyle: color });
      return note;
    });
    const voice = new Voice({ num_beats: count, beat_value: 4 });
    voice.setStrict(false);
    voice.addTickables(notes);
    voices.push(voice);
  });

  voices.forEach((voice) => {
    new Formatter().format([voice], Math.max(220, width - 150));
  });
  voices.forEach((voice, index) => voice.draw(ctx, staves[index]));

  const svg = host.querySelector("svg");
  if (!svg) return;
  voiceCounts.forEach((count, row) => {
    appendSvgText(svg, labels[row] ?? `Voice ${row + 1}`, 14, 48 + row * 58, colors[row] ?? FG, "11", "700");
    appendSvgText(svg, String(count), 47, 48 + row * 58, colors[row] ?? FG, "18", "500");
  });
}

function drawPolymeterNotation(
  ctx: RenderContext,
  host: HTMLDivElement,
  width: number,
  steps: Array<{ numerator: number; denominator: 4 | 8 | 16 }>,
  currentBeat: number,
  currentStep: number,
  isPlaying: boolean,
) {
  const colors = ["rgb(174, 112, 16)", "rgb(31, 119, 142)", "rgb(124, 92, 188)", "rgb(198, 89, 82)"];
  const voices: Voice[] = [];
  const staves: Stave[] = [];

  steps.forEach((step, row) => {
    const y = 18 + row * 48;
    const stave = new Stave(78, y, width - 94);
    stave.addTimeSignature(`${step.numerator}/${step.denominator}`);
    stave.setStyle({ strokeStyle: STAFF, fillStyle: STAFF });
    stave.setContext(ctx).draw();
    staves.push(stave);

    const duration = step.denominator === 4 ? "q" : step.denominator === 8 ? "8" : "16";
    const notes = Array.from({ length: step.numerator }, (_, index) => {
      const note = new StaveNote({ keys: ["b/4"], duration, stem_direction: 1 });
      const isActive = isPlaying && currentStep === row && currentBeat === index;
      const color = isActive || index === 0 ? colors[row] ?? FG : "rgba(17, 24, 39, 0.58)";
      note.setStyle({ fillStyle: color, strokeStyle: color });
      return note;
    });
    const voice = new Voice({ num_beats: step.numerator, beat_value: step.denominator });
    voice.setStrict(false);
    voice.addTickables(notes);
    voices.push(voice);
  });

  voices.forEach((voice) => new Formatter().format([voice], Math.max(220, width - 170)));
  voices.forEach((voice, index) => voice.draw(ctx, staves[index]));

  const svg = host.querySelector("svg");
  if (!svg) return;
  steps.forEach((_, row) => {
    appendSvgText(svg, `Step ${row + 1}`, 14, 48 + row * 48, colors[row] ?? FG, "11", "700");
  });
}

function appendSvgText(svg: Element, text: string, x: number, y: number, fill: string, size: string, weight: string) {
  const node = document.createElementNS("http://www.w3.org/2000/svg", "text");
  node.setAttribute("x", String(x));
  node.setAttribute("y", String(y));
  node.setAttribute("fill", fill);
  node.setAttribute("font-size", size);
  node.setAttribute("font-family", "var(--app-font-mono)");
  node.setAttribute("font-weight", weight);
  node.textContent = text;
  svg.appendChild(node);
}
