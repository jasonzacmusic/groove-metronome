import type { PulseAccent } from "@/lib/metronome-types";

type CapacitorHapticsModule = typeof import("@capacitor/haptics");

let hapticsModulePromise: Promise<CapacitorHapticsModule> | null = null;
let tempoSelectionActive = false;

function getHapticsModule() {
  hapticsModulePromise ??= import("@capacitor/haptics");
  return hapticsModulePromise;
}

function vibrationLength(accent: PulseAccent) {
  if (accent === "accent") return 32;
  if (accent === "ghost") return 10;
  if (accent === "mute") return 0;
  return 20;
}

export async function triggerMetronomeHaptic(accent: PulseAccent) {
  if (accent === "mute") return;

  try {
    const { Haptics, ImpactStyle } = await getHapticsModule();
    const style =
      accent === "accent"
        ? ImpactStyle.Heavy
        : accent === "ghost"
          ? ImpactStyle.Light
          : ImpactStyle.Medium;
    await Haptics.impact({ style });
    return;
  } catch {
    // Browser vibration is a best-effort fallback for Android/web contexts.
  }

  if (typeof navigator !== "undefined" && "vibrate" in navigator) {
    navigator.vibrate(vibrationLength(accent));
  }
}

export async function beginTempoScrubHaptics() {
  try {
    const { Haptics } = await getHapticsModule();
    await Haptics.selectionStart();
    tempoSelectionActive = true;
  } catch {
    tempoSelectionActive = false;
  }
}

export async function triggerTempoScrubHaptic(strength: "light" | "medium" = "light") {
  try {
    const { Haptics, ImpactStyle } = await getHapticsModule();
    if (tempoSelectionActive) {
      await Haptics.selectionChanged();
    } else {
      await Haptics.impact({ style: strength === "medium" ? ImpactStyle.Medium : ImpactStyle.Light });
      return;
    }
    if (strength === "medium") {
      await Haptics.impact({ style: ImpactStyle.Medium });
    }
    return;
  } catch {
    // Browser vibration is a best-effort fallback for Android/web contexts.
  }

  if (typeof navigator !== "undefined" && "vibrate" in navigator) {
    navigator.vibrate(strength === "medium" ? 18 : 8);
  }
}

export async function endTempoScrubHaptics() {
  if (!tempoSelectionActive) return;
  tempoSelectionActive = false;
  try {
    const { Haptics } = await getHapticsModule();
    await Haptics.selectionEnd();
  } catch {
    // Selection haptics are native-only; silence unsupported contexts.
  }
}
