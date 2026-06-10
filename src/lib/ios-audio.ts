/**
 * iOS / iPadOS WebKit audio reliability helpers.
 *
 * Two well-known WebKit behaviors break metronome audio on iPhone and iPad
 * (both in Safari and inside the native Capacitor shell):
 *
 * 1. Web Audio output is treated as "ambient" sound, so the hardware
 *    ring/silent switch mutes it. Playing a looping HTML5 media element —
 *    even a silent one — promotes the page's audio session to "playback",
 *    which ignores the silent switch. This is the same trick the popular
 *    `unmute.js` shim uses.
 * 2. After an audio interruption (phone call, Siri, alarm, some notification
 *    banners), the AudioContext can keep reporting `state === "running"`
 *    while its clock is frozen and no sound renders. The only fix is to
 *    detect the frozen clock and force a suspend/resume cycle.
 */

function isAppleTouchDevice(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent || "";
  const classicIos = /iPhone|iPad|iPod/i.test(ua);
  // iPadOS 13+ reports itself as a Mac, but Macs have no touch points.
  const modernIpad = /Macintosh/i.test(ua) && navigator.maxTouchPoints > 1;
  return classicIos || modernIpad;
}

function buildSilentWavDataUri(): string {
  // 0.08 s of 8 kHz mono 8-bit silence (~640 bytes) built at runtime so we
  // do not ship a binary asset.
  const sampleRate = 8000;
  const sampleCount = Math.round(sampleRate * 0.08);
  const dataSize = sampleCount;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);
  const writeAscii = (offset: number, text: string) => {
    for (let i = 0; i < text.length; i++) view.setUint8(offset + i, text.charCodeAt(i));
  };
  writeAscii(0, "RIFF");
  view.setUint32(4, 36 + dataSize, true);
  writeAscii(8, "WAVE");
  writeAscii(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate, true); // byte rate (8-bit mono)
  view.setUint16(32, 1, true); // block align
  view.setUint16(34, 8, true); // bits per sample
  writeAscii(36, "data");
  view.setUint32(40, dataSize, true);
  for (let i = 0; i < sampleCount; i++) view.setUint8(44 + i, 128); // 8-bit silence midpoint
  let binary = "";
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return `data:audio/wav;base64,${btoa(binary)}`;
}

let keepaliveElement: HTMLAudioElement | null = null;

/**
 * Start (or re-start) the silent looping keep-alive element. Must be called
 * from inside a user gesture the first time. Safe to call repeatedly.
 */
export function ensureSilentAudioKeepalive(): void {
  if (typeof document === "undefined" || !isAppleTouchDevice()) return;
  if (!keepaliveElement) {
    const el = document.createElement("audio");
    el.src = buildSilentWavDataUri();
    el.loop = true;
    el.preload = "auto";
    el.setAttribute("playsinline", "");
    el.setAttribute("aria-hidden", "true");
    el.style.position = "absolute";
    el.style.width = "0";
    el.style.height = "0";
    el.style.opacity = "0";
    el.style.pointerEvents = "none";
    document.body.appendChild(el);
    keepaliveElement = el;
  }
  const playPromise = keepaliveElement.play();
  if (playPromise) playPromise.catch(() => undefined);
}

/**
 * Pause the keep-alive loop so the page releases its "playback" audio session
 * (lets the user's music app resume normally once the click is stopped).
 */
export function pauseSilentAudioKeepalive(): void {
  try {
    keepaliveElement?.pause();
  } catch {
    // Pausing is best-effort; a stale element is recreated on next play.
  }
}

type ResumableAudioContext = AudioContext & { state: AudioContextState | "interrupted" };

/**
 * Verify that a supposedly running AudioContext is actually rendering.
 * Returns once the context is healthy (or after a best-effort recovery).
 */
export async function recoverFrozenAudioContext(context: AudioContext | null): Promise<void> {
  if (!context || context.state === "closed") return;
  const ctx = context as ResumableAudioContext;

  if (ctx.state === "suspended" || ctx.state === "interrupted") {
    try {
      await ctx.resume();
    } catch {
      // A later user gesture will retry.
    }
  }

  const before = ctx.currentTime;
  await new Promise<void>((resolve) => window.setTimeout(resolve, 140));
  const frozen = ctx.state === "running" && ctx.currentTime === before;
  if (!frozen) return;

  try {
    await ctx.suspend();
    await ctx.resume();
  } catch {
    // If WebKit refuses, the next user gesture (tap on play) retries the unlock.
  }
  ensureSilentAudioKeepalive();
}
