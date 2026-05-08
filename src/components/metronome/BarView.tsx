import {
  PULSE_ACCENT_HEIGHT,
  type BeatPattern,
  type PulseAccent,
} from "@/lib/metronome-types";

interface BarViewProps {
  pattern: BeatPattern[];
  isPlaying: boolean;
  currentBeat: number;
  currentPulse: number;
  onCycleBeatSubdivision: (beatIndex: number) => void;
  onCyclePulseAccent: (beatIndex: number, pulseIndex: number) => void;
}

function pulseColor(accent: PulseAccent, active: boolean): string {
  if (active) return "hsl(var(--amber))";
  switch (accent) {
    case "accent": return "hsl(var(--amber) / 0.75)";
    case "normal": return "hsl(36 30% 70% / 0.55)";
    case "ghost":  return "hsl(36 20% 60% / 0.22)";
    case "mute":   return "hsl(36 14% 40% / 0.0)";
  }
}

function pulseBorder(accent: PulseAccent): string {
  if (accent === "mute") return "hsl(36 14% 40% / 0.55)";
  return "transparent";
}

export function BarView({
  pattern,
  isPlaying,
  currentBeat,
  currentPulse,
  onCycleBeatSubdivision,
  onCyclePulseAccent,
}: BarViewProps) {
  return (
    <div className="w-full">
      <div className="flex items-end gap-3 h-56 px-2">
        {pattern.map((beat, i) => {
          const isActiveBeat = isPlaying && currentBeat === i;
          return (
            <div key={i} className="flex-1 flex flex-col items-stretch gap-2 h-full">
              <div className="relative flex-1 flex items-end gap-[3px]">
                {/* Active beat backdrop */}
                <div
                  className="absolute inset-x-0 bottom-0 top-0 rounded-sm pointer-events-none transition-colors"
                  style={{
                    background: isActiveBeat ? "hsl(var(--slate-cyan) / 0.07)" : "transparent",
                    border: "1px solid hsl(var(--border))",
                  }}
                />
                {beat.accents.map((accent, p) => {
                  const active = isActiveBeat && currentPulse === p;
                  const heightFrac = Math.max(0.06, PULSE_ACCENT_HEIGHT[accent]);
                  return (
                    <button
                      key={p}
                      type="button"
                      onClick={() => onCyclePulseAccent(i, p)}
                      aria-label={`Beat ${i + 1} pulse ${p + 1} (${accent})`}
                      className="relative flex-1 rounded-[2px] transition-all"
                      style={{
                        height: `${heightFrac * 100}%`,
                        alignSelf: "flex-end",
                        background: pulseColor(accent, active),
                        border: `1px solid ${pulseBorder(accent)}`,
                        boxShadow: active ? "0 0 12px hsla(36, 84%, 64%, 0.6)" : undefined,
                      }}
                    />
                  );
                })}
              </div>
              <button
                type="button"
                onClick={() => onCycleBeatSubdivision(i)}
                className="flex flex-col items-center gap-0.5 py-1 transition-colors"
                aria-label={`Beat ${i + 1}: ${beat.pulses} pulses. Click to cycle.`}
              >
                <span
                  className="font-serif text-2xl leading-none transition-colors"
                  style={{ color: isActiveBeat ? "hsl(var(--slate-cyan))" : "hsl(var(--foreground) / 0.85)" }}
                >
                  {i + 1}
                </span>
                <span className="tiny-caps text-[9px] text-muted-foreground">
                  {beat.pulses}p
                </span>
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
