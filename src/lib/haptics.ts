import type { PulseAccent } from "@/lib/metronome-types";

type CapacitorHapticsModule = typeof import("@capacitor/haptics");

let hapticsModulePromise: Promise<CapacitorHapticsModule> | null = null;

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

  if ("vibrate" in navigator) {
    navigator.vibrate(vibrationLength(accent));
  }
}
