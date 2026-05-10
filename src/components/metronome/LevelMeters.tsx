import {
  PULSE_ACCENT_LEVEL,
  type BeatPattern,
  type PulseAccent,
  type SubdivisionCount,
} from "@/lib/metronome-types";
import { useSubdivisionShortcut } from "@/hooks/useSubdivisionShortcut";

interface LevelMetersProps {
  pattern: BeatPattern[];
  bpm: number;
  isPlaying: boolean;
  currentBeat: number;
  currentPulse: number;
  onToggleBeat: (beatIndex: number) => void;
  onSetBeatSubdivision: (beatIndex: number, pulses: SubdivisionCount) => void;
  onCyclePulse: (beatIndex: number, pulseIndex: number) => void;
  onSetPulseLevel: (beatIndex: number, pulseIndex: number, level: number) => void;
}

const SEGMENTS = 3;

function segmentColor(filled: boolean, accent: PulseAccent, isActive: boolean): string {
  if (!filled) return "transparent";
  if (isActive) return "hsl(var(--amber))";
  if (accent === "accent") return "hsl(var(--amber) / 0.85)";
  if (accent === "ghost") return "hsl(var(--slate-cyan) / 0.45)";
  return "hsl(var(--slate-cyan) / 0.7)";
}

export function LevelMeters({
  pattern,
  bpm,
  isPlaying,
  currentBeat,
  currentPulse,
  onToggleBeat,
  onSetBeatSubdivision,
  onCyclePulse,
  onSetPulseLevel,
}: LevelMetersProps) {
  const readSubdivisionShortcut = useSubdivisionShortcut(bpm);

  return (
    <div className="w-full">
      <div className="flex items-stretch gap-3 h-64">
        {pattern.map((beat, i) => {
          const isActiveBeat = isPlaying && currentBeat === i;
          return (
            <div key={i} className="flex-1 flex flex-col items-stretch gap-2">
              {/* Pulse columns inside this beat */}
              <div
                className="relative flex-1 flex items-stretch gap-1 p-1 rounded-sm transition-colors"
                style={{
                  border: `1px solid ${isActiveBeat ? "hsl(var(--slate-cyan) / 0.5)" : "hsl(var(--border))"}`,
                  background: isActiveBeat ? "hsl(var(--slate-cyan) / 0.05)" : "transparent",
                }}
              >
                {beat.accents.map((accent, p) => {
                  const level = PULSE_ACCENT_LEVEL[accent];
                  const active = isActiveBeat && currentPulse === p;
                  return (
                    <div key={p} className="flex-1 flex flex-col-reverse gap-1 select-none">
                      <button
                        type="button"
                        onPointerDown={(e) => {
                          e.preventDefault();
                          onCyclePulse(i, p);
                        }}
                        aria-label={`Beat ${i + 1} pulse ${p + 1}: tap to toggle normal and off`}
                        className="mb-1 min-h-7 rounded-sm border border-border/70 font-mono text-[10px] text-muted-foreground transition-colors hover:border-primary hover:text-primary"
                      >
                        {accent === "mute" ? "off" : "on"}
                      </button>
                      {Array.from({ length: SEGMENTS }, (_, segIdx) => {
                        const filled = level >= segIdx + 1;
                        return (
                          <button
                            key={segIdx}
                            type="button"
                            onPointerDown={(e) => {
                              e.preventDefault();
                              // Tapping segment N sets level to N+1 unless already exactly N+1, in which case mute.
                              const targetLevel = filled && level === segIdx + 1 ? 0 : segIdx + 1;
                              onSetPulseLevel(i, p, targetLevel);
                            }}
                            aria-label={`Beat ${i + 1} pulse ${p + 1} level ${segIdx + 1}`}
                            className="flex-1 transition-colors"
                            style={{
                              background: segmentColor(filled, accent, active),
                              border: `1px solid ${filled ? "transparent" : "hsl(var(--border))"}`,
                              borderRadius: "1px",
                              boxShadow: active && filled ? "0 0 8px hsla(36, 84%, 64%, 0.5)" : undefined,
                              minHeight: "10px",
                            }}
                          />
                        );
                      })}
                    </div>
                  );
                })}
              </div>
              {/* Beat label */}
              <button
                type="button"
                onPointerDown={(e) => {
                  e.preventDefault();
                  const shortcutSubdivision = readSubdivisionShortcut();
                  if (shortcutSubdivision) onSetBeatSubdivision(i, shortcutSubdivision);
                  else onToggleBeat(i);
                }}
                className="flex flex-col items-center gap-0.5 py-1 transition-colors"
                aria-label={`Beat ${i + 1}: ${beat.pulses} pulses. Tap to toggle beat on or off, or hold a number while tapping to set subdivision.`}
              >
                <span
                  className="font-serif text-2xl leading-none transition-colors"
                  style={{ color: isActiveBeat ? "hsl(var(--slate-cyan))" : "hsl(var(--foreground) / 0.85)" }}
                >
                  {i + 1}
                </span>
                <span className="tiny-caps text-[10px] text-muted-foreground">{beat.pulses}p</span>
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
