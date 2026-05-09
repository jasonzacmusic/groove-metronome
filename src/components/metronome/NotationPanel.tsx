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
  type PulseAccent,
  type TimeSignature,
} from "@/lib/metronome-types";

interface NotationPanelProps {
  pattern: BeatPattern[];
  timeSignature: TimeSignature;
  currentBeat: number;
  isPlaying: boolean;
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

const AMBER = "rgb(242, 190, 74)";
const FG = "rgb(247, 240, 219)";
const GHOST = "rgba(168, 186, 204, 0.58)";
const STAFF = "rgba(190, 205, 220, 0.72)";

function colorFor(accent: PulseAccent, isActive: boolean): string {
  if (isActive) return AMBER;
  switch (accent) {
    case "accent": return AMBER;
    case "normal": return FG;
    case "ghost":  return GHOST;
    case "mute":   return GHOST;
  }
}

export function NotationPanel({ pattern, timeSignature, currentBeat, isPlaying }: NotationPanelProps) {
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const host = ref.current;
    if (!host) return;
    host.innerHTML = "";

    const width = Math.max(380, host.clientWidth || 600);
    const height = 150;

    let renderer: Renderer | null = null;
    let ctx: RenderContext | null = null;

    try {
      renderer = new Renderer(host, Renderer.Backends.SVG);
      renderer.resize(width, height);
      ctx = renderer.getContext();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (ctx as any).setBackgroundFillStyle?.("transparent");

      const stave = new Stave(10, 18, width - 20);
      stave.addClef("percussion");
      stave.addTimeSignature(`${timeSignature.numerator}/${timeSignature.denominator}`);
      stave.setStyle({ strokeStyle: STAFF, fillStyle: STAFF });
      stave.setContext(ctx).draw();

      const allNotes: StaveNote[] = [];
      const beams: Beam[] = [];
      const tuplets: Tuplet[] = [];

      pattern.forEach((beat, beatIdx) => {
        const specs = pulsesToNoteSpecs(beat);
        const isActiveBeat = isPlaying && currentBeat === beatIdx;
        const beatNotes: StaveNote[] = specs.map((spec) => {
          const note = new StaveNote({
            keys: ["b/4"],
            duration: spec.rest ? `${spec.duration}r` : spec.duration,
            stem_direction: 1,
          });
          const color = colorFor(spec.accent, isActiveBeat);
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
  }, [pattern, timeSignature.numerator, timeSignature.denominator, currentBeat, isPlaying]);

  return <div ref={ref} className="w-full overflow-x-auto" />;
}

// Helper: VexFlow's StaveNote duration accessor.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function spec(n: StaveNote): string { return (n as any).duration ?? "q"; }
