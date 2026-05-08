import { Pause, Play } from "lucide-react";

interface TransportButtonProps {
  isPlaying: boolean;
  onToggle: () => void;
}

export function TransportButton({ isPlaying, onToggle }: TransportButtonProps) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={isPlaying ? "Stop metronome" : "Start metronome"}
      className={`
        w-20 h-20 md:w-24 md:h-24 rounded-full flex items-center justify-center
        transition-all duration-150 active:scale-95 shadow-lg
        ${isPlaying ? "bg-coral shadow-coral/30" : "bg-primary shadow-primary/40"}
      `}
    >
      {isPlaying ? (
        <Pause className="w-8 h-8 md:w-10 md:h-10 text-white" fill="white" />
      ) : (
        <Play className="w-8 h-8 md:w-10 md:h-10 text-white ml-1" fill="white" />
      )}
    </button>
  );
}
