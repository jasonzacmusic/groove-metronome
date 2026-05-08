interface TransportButtonProps {
  isPlaying: boolean;
  onToggle: () => void;
}

/**
 * Thin amber-bordered transport. A triangle when stopped, two vertical strokes when playing.
 */
export function TransportButton({ isPlaying, onToggle }: TransportButtonProps) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={isPlaying ? "Stop metronome" : "Start metronome"}
      className="group relative w-16 h-16 md:w-20 md:h-20 rounded-full border border-primary/70 hover:border-primary transition-colors flex items-center justify-center"
      style={{
        boxShadow: isPlaying
          ? "0 0 0 1px hsla(36, 84%, 64%, 0.35) inset, 0 0 18px hsla(36, 84%, 64%, 0.18)"
          : "0 0 0 1px hsla(36, 84%, 64%, 0.18) inset",
      }}
    >
      <svg viewBox="0 0 32 32" className="w-7 h-7 md:w-8 md:h-8">
        {isPlaying ? (
          <g fill="hsl(var(--amber))">
            <rect x="10" y="8" width="3.5" height="16" rx="0.5" />
            <rect x="18.5" y="8" width="3.5" height="16" rx="0.5" />
          </g>
        ) : (
          <polygon
            points="11,7 25,16 11,25"
            fill="none"
            stroke="hsl(var(--amber))"
            strokeWidth="1.6"
            strokeLinejoin="round"
          />
        )}
      </svg>
    </button>
  );
}
