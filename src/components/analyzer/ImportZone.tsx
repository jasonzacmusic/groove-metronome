import { useCallback, useRef, useState } from "react";
import { FileAudio, FileMusic, UploadCloud } from "lucide-react";

import { cn } from "@/lib/utils";

const AUDIO_EXTS = ["wav", "mp3", "ogg", "flac", "m4a", "aac", "webm"];
const MIDI_EXTS = ["mid", "midi", "kar"];

export type DetectedKind = "audio" | "midi" | "unknown";

export function detectKind(file: File): DetectedKind {
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  if (MIDI_EXTS.includes(ext)) return "midi";
  if (AUDIO_EXTS.includes(ext)) return "audio";
  if (file.type.startsWith("audio/")) {
    if (file.type.includes("midi")) return "midi";
    return "audio";
  }
  if (file.type === "audio/midi" || file.type === "audio/x-midi") return "midi";
  return "unknown";
}

interface ImportZoneProps {
  onFile: (file: File, kind: DetectedKind) => void;
  busy?: boolean;
  status?: string;
}

/**
 * Unified drag-and-drop zone that auto-detects audio vs MIDI.
 * The same control accepts both kinds; the caller routes to the
 * right analyzer based on the returned kind.
 */
export function ImportZone({ onFile, busy, status }: ImportZoneProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [hover, setHover] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFile = useCallback(
    (f: File) => {
      const kind = detectKind(f);
      if (kind === "unknown") {
        setError(`Unrecognized format: "${f.name}". Supported: ${[...AUDIO_EXTS, ...MIDI_EXTS].join(", ")}.`);
        return;
      }
      setError(null);
      onFile(f, kind);
    },
    [onFile],
  );

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setHover(true); }}
      onDragLeave={() => setHover(false)}
      onDrop={(e) => {
        e.preventDefault();
        setHover(false);
        const f = e.dataTransfer.files?.[0];
        if (f) handleFile(f);
      }}
      onClick={() => inputRef.current?.click()}
      className={cn(
        "relative flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed p-8 cursor-pointer transition-colors",
        hover ? "border-primary bg-primary/5" : "border-border bg-card/40 hover:bg-muted/30",
        busy && "pointer-events-none opacity-70",
      )}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          inputRef.current?.click();
        }
      }}
    >
      <input
        ref={inputRef}
        type="file"
        accept={[...AUDIO_EXTS.map((e) => `.${e}`), ...MIDI_EXTS.map((e) => `.${e}`)].join(",")}
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handleFile(f);
          e.target.value = "";
        }}
      />
      <div className="flex items-center gap-3">
        <UploadCloud className="w-8 h-8 text-muted-foreground" />
        <div className="flex items-center gap-1 text-muted-foreground">
          <FileAudio className="w-5 h-5" />
          <span className="text-xs">/</span>
          <FileMusic className="w-5 h-5" />
        </div>
      </div>
      <div className="text-center">
        <p className="text-sm font-medium">Drop audio or MIDI here</p>
        <p className="text-xs text-muted-foreground mt-1">
          We&rsquo;ll auto-detect the format and explain how we got the tempo.
        </p>
      </div>
      {busy && status && (
        <div className="text-xs font-mono text-primary mt-2">{status}</div>
      )}
      {error && <div className="text-xs text-destructive mt-2">{error}</div>}
    </div>
  );
}
