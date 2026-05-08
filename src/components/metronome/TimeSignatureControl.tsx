import type { TimeSignature } from "@/lib/metronome-types";

interface TimeSignatureControlProps {
  value: TimeSignature;
  onChange: (next: TimeSignature) => void;
}

const NOTE_VALUES = [2, 4, 8, 16];

export function TimeSignatureControl({ value, onChange }: TimeSignatureControlProps) {
  const setBeats = (delta: number) => {
    const n = Math.max(1, Math.min(15, value.numerator + delta));
    onChange({ ...value, numerator: n });
  };
  const setNote = (delta: number) => {
    const idx = NOTE_VALUES.indexOf(value.denominator);
    const next = NOTE_VALUES[Math.max(0, Math.min(NOTE_VALUES.length - 1, idx + delta))];
    onChange({ ...value, denominator: next });
  };

  return (
    <div className="flex items-center justify-between gap-3 w-full">
      <div className="flex flex-col items-center gap-1">
        <span className="tiny-caps text-[9px] text-muted-foreground">Beat</span>
        <div className="flex items-center gap-1">
          <Stepper onTap={() => setBeats(-1)} label="−" />
          <Stepper onTap={() => setBeats(+1)} label="+" />
        </div>
      </div>

      <div className="flex flex-col items-center">
        <span className="tiny-caps text-[9px] text-muted-foreground">T.S.</span>
        <div className="font-serif text-3xl tabular text-[hsl(var(--slate-cyan))] leading-none mt-1">
          {value.numerator}<span className="text-muted-foreground/60 mx-1">/</span>{value.denominator}
        </div>
      </div>

      <div className="flex flex-col items-center gap-1">
        <span className="tiny-caps text-[9px] text-muted-foreground">Note</span>
        <div className="flex items-center gap-1">
          <Stepper onTap={() => setNote(-1)} label="−" />
          <Stepper onTap={() => setNote(+1)} label="+" />
        </div>
      </div>
    </div>
  );
}

function Stepper({ onTap, label }: { onTap: () => void; label: string }) {
  return (
    <button
      type="button"
      onPointerDown={(e) => { e.preventDefault(); onTap(); }}
      className="w-9 h-9 rounded-full border border-primary/40 hover:border-primary text-primary text-base flex items-center justify-center active:scale-95 transition-all select-none touch-manipulation"
    >
      {label}
    </button>
  );
}
