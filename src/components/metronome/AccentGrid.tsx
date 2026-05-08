import { ACCENT_CYCLE, ACCENT_LABELS, type AccentLevel } from "@/lib/metronome-types";

interface AccentGridProps {
  accents: AccentLevel[];
  currentBeat: number;
  onCycle: (index: number, cycle: AccentLevel[]) => void;
}

/**
 * Pro-Metronome-style row of beat indicators with cycling accent levels.
 * Beat 1 is slightly larger; tap the level chip below to cycle F → MF → P → mute.
 */
export function AccentGrid({ accents, currentBeat, onCycle }: AccentGridProps) {
  return (
    <div className="flex items-center justify-center gap-2 flex-wrap py-1">
      {accents.map((acc, i) => {
        const isActive = currentBeat === i;
        const isOne = i === 0;
        return (
          <div key={i} className="flex flex-col items-center gap-1.5">
            <div
              className={`
                rounded-full border-2 flex items-center justify-center transition-all duration-100
                ${isOne ? "w-12 h-12 md:w-14 md:h-14" : "w-10 h-10 md:w-12 md:h-12"}
                ${
                  isActive
                    ? "bg-primary border-primary shadow-[0_0_22px_rgba(226,168,50,0.55)] scale-110"
                    : "bg-card border-border"
                }
                ${acc === "mute" ? "opacity-40" : ""}
              `}
            >
              <span className={`font-mono text-sm font-bold ${isActive ? "text-primary-foreground" : "text-muted-foreground"}`}>
                {i + 1}
              </span>
            </div>
            <button
              type="button"
              onClick={() => onCycle(i, ACCENT_CYCLE)}
              className={`
                text-[10px] font-mono font-bold px-1.5 py-0.5 rounded cursor-pointer transition-colors select-none
                ${
                  acc === "f"
                    ? "bg-primary/20 text-primary"
                    : acc === "mf"
                      ? "bg-muted text-muted-foreground"
                      : acc === "p"
                        ? "bg-muted/50 text-muted-foreground/60"
                        : "bg-transparent text-muted-foreground/30"
                }
              `}
              aria-label={`Cycle accent for beat ${i + 1}`}
            >
              {ACCENT_LABELS[acc]}
            </button>
          </div>
        );
      })}
    </div>
  );
}
