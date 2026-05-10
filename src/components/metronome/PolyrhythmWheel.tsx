import { useMemo } from "react";

import {
  PULSE_ACCENT_HEIGHT,
  type BeatPattern,
  type PulseAccent,
  type SubdivisionCount,
} from "@/lib/metronome-types";
import { useSubdivisionShortcut } from "@/hooks/useSubdivisionShortcut";
import { getTempoMarking } from "@/lib/utils";

interface PolyrhythmWheelProps {
  pattern: BeatPattern[];
  bpm: number;
  isPlaying: boolean;
  currentBeat: number;
  currentPulse: number;
  onToggleBeat: (beatIndex: number) => void;
  onSetBeatSubdivision?: (beatIndex: number, pulses: SubdivisionCount) => void;
  onCyclePulseStrength: (beatIndex: number, pulseIndex: number) => void;
  onTapTempo: () => void;
}

const VIEW = 440;
const CX = VIEW / 2;
const CY = VIEW / 2;
const R_LABEL = 208;
const R_OUTER = 188;
const R_INNER = 96;
const R_CORE = 84;
const R_HAND = 174;

function polar(cx: number, cy: number, r: number, angle: number) {
  return { x: cx + r * Math.cos(angle), y: cy + r * Math.sin(angle) };
}

function arcPath(a1: number, a2: number, r1: number, r2: number) {
  const large = a2 - a1 > Math.PI ? 1 : 0;
  const p1 = polar(CX, CY, r2, a1);
  const p2 = polar(CX, CY, r2, a2);
  const p3 = polar(CX, CY, r1, a2);
  const p4 = polar(CX, CY, r1, a1);
  return [
    `M ${p1.x.toFixed(2)} ${p1.y.toFixed(2)}`,
    `A ${r2} ${r2} 0 ${large} 1 ${p2.x.toFixed(2)} ${p2.y.toFixed(2)}`,
    `L ${p3.x.toFixed(2)} ${p3.y.toFixed(2)}`,
    `A ${r1} ${r1} 0 ${large} 0 ${p4.x.toFixed(2)} ${p4.y.toFixed(2)}`,
    "Z",
  ].join(" ");
}

function pulseFill(accent: PulseAccent, active: boolean): { fill: string; stroke: string; opacity: number } {
  if (active) {
    return { fill: "hsl(var(--amber))", stroke: "hsl(var(--amber))", opacity: 1 };
  }
  switch (accent) {
    case "accent":
      return { fill: "hsl(var(--amber) / 0.55)", stroke: "hsl(var(--amber) / 0.85)", opacity: 1 };
    case "normal":
      return { fill: "hsl(var(--slate-cyan) / 0.34)", stroke: "hsl(var(--slate-cyan) / 0.65)", opacity: 1 };
    case "ghost":
      return { fill: "hsl(210 24% 75% / 0.12)", stroke: "hsl(210 24% 75% / 0.36)", opacity: 1 };
    case "mute":
      return { fill: "transparent", stroke: "hsl(214 16% 48% / 0.55)", opacity: 1 };
  }
}

export function PolyrhythmWheel({
  pattern,
  bpm,
  isPlaying,
  currentBeat,
  currentPulse,
  onToggleBeat,
  onSetBeatSubdivision,
  onCyclePulseStrength,
  onTapTempo,
}: PolyrhythmWheelProps) {
  const numerator = pattern.length;
  const beatSpan = (2 * Math.PI) / Math.max(1, numerator);
  const readSubdivisionShortcut = useSubdivisionShortcut(bpm);

  const applySubdivisionShortcut = (beatIndex: number) => {
    const shortcutSubdivision = readSubdivisionShortcut();
    if (!shortcutSubdivision || !onSetBeatSubdivision) return false;
    onSetBeatSubdivision(beatIndex, shortcutSubdivision);
    return true;
  };

  const handAngle = useMemo(() => {
    if (!isPlaying) return null;
    if (currentBeat < 0 || currentPulse < 0 || numerator === 0) return null;
    const beat = pattern[currentBeat];
    if (!beat) return null;
    const pulses = beat.pulses;
    const pulseSpan = beatSpan / pulses;
    const beatStart = -Math.PI / 2 + beatSpan * currentBeat;
    return beatStart + pulseSpan * (currentPulse + 0.5);
  }, [currentBeat, currentPulse, isPlaying, pattern, beatSpan, numerator]);

  return (
    <div className="relative w-full max-w-[560px] mx-auto select-none">
      <svg
        viewBox={`0 0 ${VIEW} ${VIEW}`}
        className="block w-full h-auto touch-none"
        role="group"
        aria-label="Polyrhythm wheel"
      >
        <defs>
          <radialGradient id="wheel-core" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="hsl(var(--ink))" />
            <stop offset="100%" stopColor="hsl(var(--graphite))" />
          </radialGradient>
          <radialGradient id="wheel-back" cx="50%" cy="50%" r="55%">
            <stop offset="0%" stopColor="hsla(181, 47%, 61%, 0.06)" />
            <stop offset="70%" stopColor="hsla(181, 47%, 61%, 0)" />
          </radialGradient>
        </defs>

        {/* Outer faint backdrop */}
        <circle cx={CX} cy={CY} r={R_LABEL + 12} fill="url(#wheel-back)" />

        {/* Hairline outer ring */}
        <circle cx={CX} cy={CY} r={R_OUTER + 6} fill="none" stroke="hsl(var(--border))" strokeWidth="0.6" />
        <circle cx={CX} cy={CY} r={R_INNER - 6} fill="none" stroke="hsl(var(--border))" strokeWidth="0.6" />

        {/* Beat segments — backdrop wedges (active beat tinted slate-cyan) */}
        {pattern.map((_, i) => {
          const a1 = -Math.PI / 2 + beatSpan * i;
          const a2 = a1 + beatSpan;
          const isActiveBeat = isPlaying && currentBeat === i;
          return (
            <path
              key={`bg-${i}`}
              d={arcPath(a1, a2, R_INNER, R_OUTER)}
              fill={isActiveBeat ? "hsl(var(--slate-cyan) / 0.10)" : "hsl(220 17% 8% / 0.78)"}
              stroke="hsl(var(--border))"
              strokeWidth="0.5"
              style={{ cursor: "pointer" }}
              onPointerDown={(event) => {
                event.preventDefault();
                if (!applySubdivisionShortcut(i)) onCyclePulseStrength(i, 0);
              }}
              aria-label={`Beat ${i + 1}. Tap to cycle soft, normal, and accented. Hold a number while tapping to divide this beat.`}
            />
          );
        })}

        {/* Pulse arcs */}
        {pattern.map((beat, i) => {
          const beatStart = -Math.PI / 2 + beatSpan * i;
          const pulses = beat.pulses;
          const pulseSpan = beatSpan / pulses;
          const isActiveBeat = isPlaying && currentBeat === i;
          return beat.accents.map((accent, p) => {
            const a1 = beatStart + pulseSpan * p + 0.012;
            const a2 = beatStart + pulseSpan * (p + 1) - 0.012;
            const active = isActiveBeat && currentPulse === p;
            const heightFrac = PULSE_ACCENT_HEIGHT[accent];
            const r1 = R_INNER + 4;
            const r2 = R_INNER + 4 + (R_OUTER - R_INNER - 8) * heightFrac;
            const { fill, stroke } = pulseFill(accent, active);
            return (
              <path
                key={`p-${i}-${p}`}
                d={arcPath(a1, a2, r1, r2)}
                fill={fill}
                stroke={stroke}
                strokeWidth={active ? 1.4 : 0.8}
                style={{
                  cursor: "pointer",
                  transition: "fill 120ms linear, stroke 120ms linear",
                  filter: active ? "drop-shadow(0 0 6px hsla(36, 84%, 64%, 0.55))" : undefined,
                }}
                onPointerDown={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  if (!applySubdivisionShortcut(i)) onCyclePulseStrength(i, p);
                }}
                aria-label={`Beat ${i + 1} pulse ${p + 1} (${accent}). Tap to cycle soft, normal, and accented. Hold a number while tapping to divide this beat.`}
              />
            );
          });
        })}

        {/* Beat number labels: tap toggles the beat, number-hold assigns subdivision. */}
        {pattern.map((beat, i) => {
          const a = -Math.PI / 2 + beatSpan * (i + 0.5);
          const pos = polar(CX, CY, R_LABEL, a);
          const isActiveBeat = isPlaying && currentBeat === i;
          const isMuted = beat.accents.every((accent) => accent === "mute");
          return (
            <g
              key={`lbl-${i}`}
              style={{ cursor: "pointer" }}
              onPointerDown={(event) => {
                event.preventDefault();
                if (!applySubdivisionShortcut(i)) onToggleBeat(i);
              }}
              aria-label={`Beat ${i + 1}, ${beat.pulses} pulse${beat.pulses > 1 ? "s" : ""}. Tap to toggle beat on or off, or hold a number while tapping to set subdivision.`}
            >
              <circle
                cx={pos.x}
                cy={pos.y}
                r={20}
                fill={isMuted ? "hsl(var(--background) / 0.38)" : "hsl(var(--ink))"}
                stroke={isActiveBeat ? "hsl(var(--slate-cyan))" : isMuted ? "hsl(var(--muted-foreground) / 0.42)" : "hsl(var(--border))"}
                strokeWidth={isActiveBeat ? 1.2 : 0.7}
                style={{ transition: "stroke 120ms linear" }}
              />
              <text
                x={pos.x}
                y={pos.y + 0.5}
                textAnchor="middle"
                dominantBaseline="central"
                fontFamily="var(--app-font-serif)"
                fontSize="22"
                fill={isActiveBeat ? "hsl(var(--slate-cyan))" : isMuted ? "hsl(var(--muted-foreground) / 0.48)" : "hsl(var(--foreground) / 0.85)"}
              >
                {i + 1}
              </text>
              <text
                x={pos.x}
                y={pos.y + 32}
                textAnchor="middle"
                fontFamily="var(--app-font-mono)"
                fontSize="8"
                letterSpacing="2"
                fill="hsl(var(--muted-foreground))"
              >
                {beat.pulses}
              </text>
            </g>
          );
        })}

        {/* Vinyl-grooved core (concentric thin lines) */}
        <circle cx={CX} cy={CY} r={R_CORE} fill="url(#wheel-core)" stroke="hsl(var(--border))" strokeWidth="0.6" />
        {Array.from({ length: 7 }, (_, i) => (
          <circle
            key={`gr-${i}`}
            cx={CX}
            cy={CY}
            r={R_CORE - 8 - i * 8}
            fill="none"
            stroke="hsl(var(--slate-cyan) / 0.06)"
            strokeWidth="0.6"
          />
        ))}
        {isPlaying && <circle cx={CX} cy={CY} r={2.2} fill="hsl(var(--amber) / 0.65)" />}

        {/* Sweep hand */}
        {handAngle !== null && (
          <g
            style={{
              transformOrigin: `${CX}px ${CY}px`,
              transform: `rotate(${(handAngle * 180) / Math.PI + 90}deg)`,
              transition: "transform 80ms cubic-bezier(0.5, 0, 0.2, 1)",
            }}
          >
            <line
              x1={CX}
              y1={CY - R_CORE - 8}
              x2={CX}
              y2={CY - R_HAND}
              stroke="hsl(var(--amber))"
              strokeWidth="1.2"
              strokeLinecap="round"
              opacity="0.85"
            />
            <circle cx={CX} cy={CY - R_HAND} r="3" fill="hsl(var(--amber))" />
          </g>
        )}
      </svg>

      {/* Center BPM readout — overlay so DM Serif Display renders crisply */}
      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
        <button
          type="button"
          onPointerDown={(event) => {
            event.preventDefault();
            onTapTempo();
          }}
          className="pointer-events-auto rounded-full px-8 py-7 text-center transition-colors hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary"
          aria-label="Tap tempo from wheel center"
        >
          <span className="tiny-caps block text-xs text-muted-foreground/80">{getTempoMarking(bpm)}</span>
          <span
            className="block font-serif tabular leading-none text-foreground"
            style={{ fontSize: "clamp(4rem, 16vw, 6.5rem)" }}
          >
            {Math.round(bpm)}
          </span>
          <span className="tiny-caps mt-1 block text-[10px] text-muted-foreground/70">Tap tempo</span>
        </button>
      </div>
    </div>
  );
}
