/**
 * Audio tempo detection with explainable output.
 *
 * Pipeline:
 *  1. Decode audio to mono PCM via WebAudio's OfflineAudioContext.
 *  2. Compute a spectral-flux onset envelope at ~172 frames/sec
 *     (frame size = 1024, hop = 256 at 44.1 kHz).
 *  3. Normalize and pick onset peaks above an adaptive median threshold.
 *  4. Estimate BPM via autocorrelation of the onset envelope across
 *     candidate periods (40–240 BPM), then refine using inter-onset
 *     intervals around the autocorrelation peak.
 *  5. Score consistency by sliding the detected period over the file
 *     in windows; report per-window BPM so the UI can highlight where
 *     the tempo drifted.
 *
 * Returns the BPM estimate, confidence (0..1), and per-window
 * BPM/consistency data so the caller can show "how we got the tempo".
 */

export interface TempoWindow {
  startSec: number;
  endSec: number;
  bpm: number;
  /** 0..1 — how strongly this window's onsets matched the global period. */
  agreement: number;
}

export interface TempoAnalysisResult {
  bpm: number;
  weightedBpm: number;
  /** Overall confidence 0..1 from autocorrelation peak prominence. */
  confidence: number;
  /** All BPM candidates in descending score, useful for UI alternatives. */
  candidates: { bpm: number; score: number }[];
  /** Detected onset times in seconds. */
  onsets: number[];
  /** Per-window BPM stability — used to pinpoint inconsistent regions. */
  windows: TempoWindow[];
  durationSec: number;
  sampleRate: number;
  /** Median absolute deviation of inter-onset interval from the period (sec). */
  jitterSec: number;
  /** A short human-readable explanation. */
  explanation: string;
}

const FRAME = 1024;
const HOP = 256;
const MIN_BPM = 40;
const MAX_BPM = 240;

export async function analyzeAudioTempo(file: File): Promise<TempoAnalysisResult> {
  const arrayBuffer = await file.arrayBuffer();
  const ctx = new OfflineAudioContext(1, 44100, 44100);
  const audioBuffer = await ctx.decodeAudioData(arrayBuffer.slice(0));

  const sr = audioBuffer.sampleRate;
  const channelCount = audioBuffer.numberOfChannels;
  const length = audioBuffer.length;
  // Mix to mono
  const mono = new Float32Array(length);
  for (let c = 0; c < channelCount; c++) {
    const data = audioBuffer.getChannelData(c);
    for (let i = 0; i < length; i++) mono[i] += data[i] / channelCount;
  }

  const onsetEnv = computeOnsetEnvelope(mono, sr);
  const onsetTimes = pickOnsets(onsetEnv, sr);

  const { bpm, confidence, candidates } = estimateBpm(onsetEnv, sr);
  const refined = refineBpmByIoi(onsetTimes, bpm);

  const period = 60 / refined;
  const jitterSec = ioiJitter(onsetTimes, period);

  const windows = scoreWindows(onsetTimes, refined, audioBuffer.duration);
  const weightedBpm = weightedWindowBpm(windows, refined);

  let explanation = `Detected ${refined.toFixed(1)} BPM from ${onsetTimes.length} onsets `;
  explanation += `via spectral-flux + autocorrelation (peak score ${(confidence * 100).toFixed(0)}%). `;
  explanation += `Weighted average across stable windows is ${weightedBpm.toFixed(1)} BPM. `;
  if (jitterSec > 0.04) {
    explanation += `Notable timing variation (jitter ${(jitterSec * 1000).toFixed(0)} ms) — `;
    explanation += `see windows below for inconsistent regions.`;
  } else {
    explanation += `Timing is steady (jitter ${(jitterSec * 1000).toFixed(0)} ms).`;
  }

  return {
    bpm: refined,
    weightedBpm,
    confidence,
    candidates,
    onsets: onsetTimes,
    windows,
    durationSec: audioBuffer.duration,
    sampleRate: sr,
    jitterSec,
    explanation,
  };
}

function weightedWindowBpm(windows: TempoWindow[], fallback: number): number {
  let weighted = 0;
  let weightTotal = 0;
  for (const window of windows) {
    const duration = Math.max(0.01, window.endSec - window.startSec);
    const weight = duration * Math.max(0.05, window.agreement);
    weighted += window.bpm * weight;
    weightTotal += weight;
  }
  return roundTo(weightTotal > 0 ? weighted / weightTotal : fallback, 0.1);
}

/** Spectral flux onset envelope using a Hann-windowed STFT magnitude diff. */
function computeOnsetEnvelope(mono: Float32Array, sr: number): Float32Array {
  const numFrames = Math.max(0, Math.floor((mono.length - FRAME) / HOP) + 1);
  const env = new Float32Array(numFrames);
  const window = hann(FRAME);
  const re = new Float32Array(FRAME);
  const im = new Float32Array(FRAME);
  let prevMag = new Float32Array(FRAME / 2);

  for (let f = 0; f < numFrames; f++) {
    const offset = f * HOP;
    for (let i = 0; i < FRAME; i++) {
      re[i] = mono[offset + i] * window[i];
      im[i] = 0;
    }
    fftInPlace(re, im);
    const mag = new Float32Array(FRAME / 2);
    for (let i = 0; i < FRAME / 2; i++) {
      mag[i] = Math.sqrt(re[i] * re[i] + im[i] * im[i]);
    }
    let flux = 0;
    for (let i = 0; i < mag.length; i++) {
      const d = mag[i] - prevMag[i];
      if (d > 0) flux += d;
    }
    env[f] = flux;
    prevMag = mag;
  }
  // Normalize to 0..1
  let max = 0;
  for (let i = 0; i < env.length; i++) if (env[i] > max) max = env[i];
  if (max > 0) for (let i = 0; i < env.length; i++) env[i] /= max;
  // Subtract a moving median baseline for adaptive thresholding
  const baseline = movingMedian(env, Math.max(20, Math.floor(sr / HOP)));
  for (let i = 0; i < env.length; i++) {
    env[i] = Math.max(0, env[i] - baseline[i]);
  }
  return env;
}

function hann(n: number): Float32Array {
  const w = new Float32Array(n);
  for (let i = 0; i < n; i++) w[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (n - 1));
  return w;
}

/** Iterative radix-2 FFT (in-place). FRAME must be a power of two. */
function fftInPlace(re: Float32Array, im: Float32Array): void {
  const n = re.length;
  // Bit-reversal
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      [re[i], re[j]] = [re[j], re[i]];
      [im[i], im[j]] = [im[j], im[i]];
    }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const half = len >> 1;
    const ang = (-2 * Math.PI) / len;
    const wRe = Math.cos(ang);
    const wIm = Math.sin(ang);
    for (let i = 0; i < n; i += len) {
      let curRe = 1;
      let curIm = 0;
      for (let k = 0; k < half; k++) {
        const tRe = curRe * re[i + k + half] - curIm * im[i + k + half];
        const tIm = curRe * im[i + k + half] + curIm * re[i + k + half];
        re[i + k + half] = re[i + k] - tRe;
        im[i + k + half] = im[i + k] - tIm;
        re[i + k] += tRe;
        im[i + k] += tIm;
        const newRe = curRe * wRe - curIm * wIm;
        curIm = curRe * wIm + curIm * wRe;
        curRe = newRe;
      }
    }
  }
}

function movingMedian(a: Float32Array, win: number): Float32Array {
  const out = new Float32Array(a.length);
  const half = Math.floor(win / 2);
  const buf: number[] = [];
  for (let i = 0; i < a.length; i++) {
    const lo = Math.max(0, i - half);
    const hi = Math.min(a.length, i + half);
    buf.length = 0;
    for (let j = lo; j < hi; j++) buf.push(a[j]);
    buf.sort((x, y) => x - y);
    out[i] = buf[Math.floor(buf.length / 2)] ?? 0;
  }
  return out;
}

function pickOnsets(env: Float32Array, sr: number): number[] {
  const framesPerSec = sr / HOP;
  const minSpacing = Math.floor(framesPerSec * 0.08); // ~80 ms refractory
  const onsets: number[] = [];
  let lastIdx = -minSpacing - 1;
  // Threshold = max(0.08, 1.4 * local mean)
  const localWin = Math.floor(framesPerSec * 0.5);
  for (let i = 1; i < env.length - 1; i++) {
    const lo = Math.max(0, i - localWin);
    const hi = Math.min(env.length, i + localWin);
    let sum = 0;
    for (let j = lo; j < hi; j++) sum += env[j];
    const mean = sum / (hi - lo);
    const thr = Math.max(0.08, mean * 1.4);
    if (env[i] > thr && env[i] >= env[i - 1] && env[i] >= env[i + 1]) {
      if (i - lastIdx >= minSpacing) {
        onsets.push(i / framesPerSec);
        lastIdx = i;
      }
    }
  }
  return onsets;
}

function estimateBpm(env: Float32Array, sr: number): { bpm: number; confidence: number; candidates: { bpm: number; score: number }[] } {
  const framesPerSec = sr / HOP;
  const minLag = Math.floor((framesPerSec * 60) / MAX_BPM);
  const maxLag = Math.floor((framesPerSec * 60) / MIN_BPM);
  const scores: { bpm: number; score: number }[] = [];
  let bestScore = 0;
  let bestLag = minLag;
  for (let lag = minLag; lag <= maxLag; lag++) {
    let sum = 0;
    for (let i = 0; i + lag < env.length; i++) sum += env[i] * env[i + lag];
    const bpm = (60 * framesPerSec) / lag;
    scores.push({ bpm, score: sum });
    if (sum > bestScore) {
      bestScore = sum;
      bestLag = lag;
    }
  }
  scores.sort((a, b) => b.score - a.score);
  const top = scores.slice(0, 5);
  // Normalize score to confidence (peak vs median)
  const median = scores[Math.floor(scores.length / 2)].score;
  const confidence = bestScore > 0 ? Math.min(1, (bestScore - median) / bestScore) : 0;
  const bpm = (60 * framesPerSec) / bestLag;
  return {
    bpm,
    confidence,
    candidates: top.map((c) => ({ bpm: roundTo(c.bpm, 0.1), score: c.score / bestScore })),
  };
}

function refineBpmByIoi(onsets: number[], coarseBpm: number): number {
  if (onsets.length < 4) return roundTo(coarseBpm, 0.1);
  const period = 60 / coarseBpm;
  const iois: number[] = [];
  for (let i = 1; i < onsets.length; i++) {
    const d = onsets[i] - onsets[i - 1];
    // Snap multiples of the period (e.g., when notes skip a beat)
    const ratio = d / period;
    const snapped = d / Math.max(1, Math.round(ratio));
    if (snapped > period * 0.6 && snapped < period * 1.4) iois.push(snapped);
  }
  if (iois.length === 0) return roundTo(coarseBpm, 0.1);
  const median = iois.sort((a, b) => a - b)[Math.floor(iois.length / 2)];
  return roundTo(60 / median, 0.1);
}

function ioiJitter(onsets: number[], period: number): number {
  if (onsets.length < 3) return 0;
  const errors: number[] = [];
  for (let i = 1; i < onsets.length; i++) {
    const d = onsets[i] - onsets[i - 1];
    const closest = Math.max(1, Math.round(d / period)) * period;
    errors.push(Math.abs(d - closest));
  }
  errors.sort((a, b) => a - b);
  return errors[Math.floor(errors.length / 2)];
}

function scoreWindows(onsets: number[], bpm: number, durationSec: number): TempoWindow[] {
  const period = 60 / bpm;
  const windowSec = Math.max(2, Math.min(8, durationSec / 6));
  const out: TempoWindow[] = [];
  for (let t = 0; t + windowSec <= durationSec + 0.01; t += windowSec) {
    const region = onsets.filter((o) => o >= t && o < t + windowSec);
    if (region.length < 2) {
      out.push({ startSec: t, endSec: t + windowSec, bpm, agreement: 0 });
      continue;
    }
    const iois: number[] = [];
    for (let i = 1; i < region.length; i++) iois.push(region[i] - region[i - 1]);
    const median = iois.sort((a, b) => a - b)[Math.floor(iois.length / 2)];
    const localBpm = roundTo(60 / median, 0.1);
    const drift = Math.abs(localBpm - bpm) / bpm;
    const agreement = Math.max(0, 1 - drift * 4); // 25% drift -> 0 agreement
    out.push({ startSec: t, endSec: t + windowSec, bpm: localBpm, agreement });
  }
  return out;
}

function roundTo(value: number, step: number): number {
  return Math.round(value / step) * step;
}
