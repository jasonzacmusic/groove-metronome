import { useEffect, useRef } from "react";
import {
  Articulation,
  Beam,
  Formatter,
  Renderer,
  Stave,
  StaveNote,
  Tuplet,
  Voice,
} from "vexflow";

import type { Subdivision, TimeSignature } from "@/lib/metronome-types";

interface NotationPanelProps {
  timeSignature: TimeSignature;
  subdivision: Subdivision;
  currentBeat: number;
  isPlaying: boolean;
}

/**
 * Renders one bar of rhythmic notation using VexFlow that matches the
 * current time signature + subdivision. The active beat is highlighted
 * via a CSS ::after marker overlaid on the staff.
 *
 * VexFlow is rendered into a child SVG; we re-render whenever the time
 * signature or subdivision changes (cheap operation).
 */
export function NotationPanel({ timeSignature, subdivision, currentBeat, isPlaying }: NotationPanelProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const beatPositionsRef = useRef<number[]>([]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    el.innerHTML = "";
    const width = el.clientWidth || 600;
    const height = 110;

    const renderer = new Renderer(el, Renderer.Backends.SVG);
    renderer.resize(width, height);
    const ctx = renderer.getContext();
    ctx.setFont("Arial", 12);

    // Compute the rhythm to draw based on subdivision
    const { numerator, denominator } = timeSignature;
    const stave = new Stave(8, 16, width - 16);
    stave
      .addClef("percussion")
      .addTimeSignature(`${numerator}/${denominator}`)
      .setContext(ctx)
      .draw();

    const notes: StaveNote[] = [];
    const tuplets: Tuplet[] = [];
    const beatStartIndices: number[] = [];

    // Pick a per-subdivision rhythm pattern repeated for each beat
    for (let beatIdx = 0; beatIdx < numerator; beatIdx++) {
      beatStartIndices.push(notes.length);
      const accent = beatIdx === 0;
      const startIdx = notes.length;

      switch (subdivision) {
        case "none": {
          notes.push(makeBeatNote(denominator, accent));
          break;
        }
        case "8th": {
          notes.push(makeSubNote(denominator * 2, accent));
          notes.push(makeSubNote(denominator * 2, false));
          break;
        }
        case "16th": {
          for (let i = 0; i < 4; i++) {
            notes.push(makeSubNote(denominator * 4, accent && i === 0));
          }
          break;
        }
        case "triplet": {
          for (let i = 0; i < 3; i++) {
            notes.push(makeSubNote(denominator * 2, accent && i === 0));
          }
          tuplets.push(
            new Tuplet(notes.slice(startIdx, startIdx + 3), { num_notes: 3, notes_occupied: 2 }),
          );
          break;
        }
        case "quintuplet": {
          for (let i = 0; i < 5; i++) {
            notes.push(makeSubNote(denominator * 4, accent && i === 0));
          }
          tuplets.push(
            new Tuplet(notes.slice(startIdx, startIdx + 5), { num_notes: 5, notes_occupied: 4 }),
          );
          break;
        }
        case "septuplet": {
          for (let i = 0; i < 7; i++) {
            notes.push(makeSubNote(denominator * 4, accent && i === 0));
          }
          tuplets.push(
            new Tuplet(notes.slice(startIdx, startIdx + 7), { num_notes: 7, notes_occupied: 4 }),
          );
          break;
        }
      }
    }

    // Beam consecutive flagged notes (8th and shorter)
    const beams = Beam.generateBeams(notes);

    const voice = new Voice({ num_beats: numerator, beat_value: denominator });
    voice.setStrict(false);
    voice.addTickables(notes);

    new Formatter().joinVoices([voice]).format([voice], width - 80);
    voice.draw(ctx, stave);
    beams.forEach((b) => b.setContext(ctx).draw());
    tuplets.forEach((t) => t.setContext(ctx).draw());

    // Track the X position of each beat's first note so we can draw a marker
    beatPositionsRef.current = beatStartIndices.map((idx) => {
      const n = notes[idx];
      const bbox = n.getBoundingBox();
      return bbox ? bbox.getX() + bbox.getW() / 2 : 0;
    });
  }, [timeSignature, subdivision]);

  // The "now-playing" cursor — a thin vertical line + glow on the active beat note
  const activeX = isPlaying && currentBeat >= 0 ? beatPositionsRef.current[currentBeat] : null;

  return (
    <div className="relative">
      <div ref={containerRef} className="w-full overflow-hidden rounded-md bg-white" />
      {activeX != null && (
        <div
          className="pointer-events-none absolute top-2 bottom-2 w-[3px] rounded-full bg-primary/80 transition-[left] duration-75"
          style={{ left: `${activeX}px` }}
        />
      )}
    </div>
  );
}

function makeBeatNote(denominator: number, accent: boolean): StaveNote {
  const duration = `${denominator}`;
  const note = new StaveNote({
    keys: ["b/4/x2"],
    duration,
    auto_stem: true,
  });
  if (accent) note.addModifier(new Articulation("a>").setPosition(3));
  return note;
}

function makeSubNote(unit: number, accent: boolean): StaveNote {
  const duration = `${unit}`;
  const note = new StaveNote({
    keys: ["b/4/x2"],
    duration,
    auto_stem: true,
  });
  if (accent) note.addModifier(new Articulation("a>").setPosition(3));
  return note;
}
