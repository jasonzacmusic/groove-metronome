import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

export function formatTime(secs: number) {
  const m = Math.floor(secs / 60);
  const s = Math.floor(secs % 60);
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export function getTempoMarking(b: number) {
  if (b < 40) return "Grave";
  if (b < 55) return "Largo";
  if (b < 65) return "Larghetto";
  if (b < 73) return "Adagio";
  if (b < 85) return "Andante";
  if (b < 98) return "Moderato";
  if (b < 109) return "Andante moderato";
  if (b < 120) return "Allegretto";
  if (b < 156) return "Allegro";
  if (b < 176) return "Vivace";
  if (b < 200) return "Presto";
  return "Prestissimo";
}
