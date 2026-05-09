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
  onFiles: (files: Array<{ file: File; kind: DetectedKind }>) => void;
  busy?: boolean;
  status?: string;
}

/**
 * Unified drag-and-drop zone that auto-detects audio vs MIDI.
 * The same control accepts both kinds; the caller routes to the
 * right analyzer based on the returned kind.
 */
export function ImportZone({ onFiles, busy, status }: ImportZoneProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [hover, setHover] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFiles = useCallback(
    (incoming: FileList | File[]) => {
      const parsed = Array.from(incoming).slice(0, 5).map((file) => ({ file, kind: detectKind(file) }));
      const unknown = parsed.find((item) => item.kind === "unknown");
      if (unknown) {
        setError(`Unrecognized format: "${unknown.file.name}". Supported: ${[...AUDIO_EXTS, ...MIDI_EXTS].join(", ")}.`);
        return;
      }
      const usable = parsed.filter((item): item is { file: File; kind: Exclude<DetectedKind, "unknown"> } => item.kind !== "unknown");
      if (usable.length === 0) return;
      setError(null);
      onFiles(usable);
    },
    [onFiles],
  );

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setHover(true); }}
      onDragLeave={() => setHover(false)}
      onDrop={(e) => {
        e.preventDefault();
        setHover(false);
        const files = e.dataTransfer.files;
        if (files?.length) handleFiles(files);
      }}
      onClick={() => inputRef.current?.click()}
      className={cn(
        "relative rounded-lg border-2 border-dashed p-4 cursor-pointer transition-colors",
        hover ? "border-primary bg-primary/5" : "border-border bg-card/55 hover:bg-muted/30",
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
        multiple
        accept={[...AUDIO_EXTS.map((e) => `.${e}`), ...MIDI_EXTS.map((e) => `.${e}`)].join(",")}
        className="hidden"
        onChange={(e) => {
          const files = e.target.files;
          if (files?.length) handleFiles(files);
          e.target.value = "";
        }}
      />
      <div className="grid gap-3 md:grid-cols-[1fr_auto_1fr] items-stretch">
        <div className="rounded-md border border-border/70 bg-background/35 p-5">
          <FileAudio className="mb-3 size-6 text-primary" />
          <p className="font-serif text-xl">Audio</p>
          <p className="mt-1 text-xs text-muted-foreground">WAV, MP3, FLAC, M4A, OGG, AAC, WEBM</p>
        </div>
        <div className="hidden md:grid place-items-center">
          <UploadCloud className="size-7 text-muted-foreground" />
        </div>
        <div className="rounded-md border border-border/70 bg-background/35 p-5">
          <FileMusic className="mb-3 size-6 text-accent" />
          <p className="font-serif text-xl">MIDI</p>
          <p className="mt-1 text-xs text-muted-foreground">Tempo map, sections, key, chords, tracks</p>
        </div>
      </div>
      <div className="mt-4 text-center">
        <p className="text-sm font-medium">Drop up to five audio or MIDI files here</p>
        <p className="text-xs text-muted-foreground mt-1">Works with Files/iCloud, phone share imports, WhatsApp downloads, and desktop drag-and-drop.</p>
      </div>
      {busy && status && (
        <div className="text-xs font-mono text-primary mt-2">{status}</div>
      )}
      {error && <div className="text-xs text-destructive mt-2">{error}</div>}
    </div>
  );
}
