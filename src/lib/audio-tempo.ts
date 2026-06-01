/**
 * Audio tempo detection with explainable output.
 *
 * Pipeline:
 *  1. Decode audio to mono PCM via WebAudio's OfflineAudioContext.
 *  2. Compute a spectral-flux onset envelope at ~172 frames/sec
 *     (frame size = 1024, hop = 256 at 44.1 kHz).
 *  3. Normalize and pick onset peaks above an adaptive median threshold.
 *  4. Estimate BPM via weighted beat-grid scoring, inter-onset intervals,
 *     and autocorrelation. This keeps steady musical pulse ahead of
 *     accidental double/half-time subdivision matches.
 *  5. Lock the file to a downbeat/phase so playback can start with the
 *     metronome instead of free-running from wherever the audio element lands.
 *  6. Score consistency by sliding the detected period over the file
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
  beatPeriodSec: number;
  downbeatSec: number;
  timeSignature?: { numerator: number; denominator: number; confidence: number };
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
  waveformPeaks: number[];
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
  const pickedOnsets = snapOnsetsToZeroCrossings(mono, sr, pickOnsets(onsetEnv, sr));
  const onsetTimes = mergeNearbyOnsets(
    [detectInitialTransient(mono, sr), ...pickedOnsets]
      .filter((onset): onset is number => onset !== undefined)
      .sort((a, b) => a - b),
    0.05,
  );

  const onsetWeights = onsetWeightsFromEnvelope(onsetTimes, onsetEnv, sr / HOP);
  const { bpm, confidence, candidates } = estimateBpm(onsetEnv, onsetTimes, sr, audioBuffer.duration, onsetWeights);
  const ioiRefined = normalizeMusicalBpm(refineBpmByIoi(onsetTimes, bpm), candidates);
  const beatLock = lockTempoToBeatGrid(onsetTimes, onsetWeights, ioiRefined, candidates, audioBuffer.duration);
  const refined = beatLock.bpm;
  const timeSignature = estimateTimeSignature(onsetTimes, refined);

  const period = 60 / refined;
  const jitterSec = ioiJitter(onsetTimes, period);

  const windows = scoreWindows(onsetTimes, refined, audioBuffer.duration);
  const weightedBpm = weightedWindowBpm(windows, refined);
  const waveformPeaks = buildWaveformPeaks(mono, 320);

  let explanation = `Detected ${refined.toFixed(1)} BPM from ${onsetTimes.length} onsets `;
  explanation += `via weighted beat-grid scoring, IOI checks, and autocorrelation (confidence ${(confidence * 100).toFixed(0)}%). `;
  explanation += `Downbeat lock at ${beatLock.downbeatSec.toFixed(2)}s. `;
  explanation += `Stable-window average is ${weightedBpm.toFixed(1)} BPM. `;
  if (timeSignature) {
    explanation += `Meter guess: ${timeSignature.numerator}/${timeSignature.denominator} (${(timeSignature.confidence * 100).toFixed(0)}%). `;
  }
  if (jitterSec > 0.04) {
    explanation += `Notable timing variation (jitter ${(jitterSec * 1000).toFixed(0)} ms) — `;
    explanation += `see windows below for inconsistent regions.`;
  } else {
    explanation += `Timing is steady (jitter ${(jitterSec * 1000).toFixed(0)} ms).`;
  }

  return {
    bpm: refined,
    weightedBpm,
    beatPeriodSec: period,
    downbeatSec: beatLock.downbeatSec,
    timeSignature,
    confidence,
    candidates: prioritizeCandidate(candidates, refined),
    onsets: onsetTimes,
    windows,
    durationSec: audioBuffer.duration,
    sampleRate: sr,
    waveformPeaks,
    jitterSec,
    explanation,
  };
}

function weightedWindowBpm(windows: TempoWindow[], fallback: number): number {
  let weighted = 0;
  let weightTotal = 0;
  for (const window of windows) {
    if (window.agreement < 0.28) continue;
    const bpm = normalizeLocalBpmNear(window.bpm, fallback);
    if (Math.abs(bpm - fallback) / fallback > 0.22) continue;
    const duration = Math.max(0.01, window.endSec - window.startSec);
    const weight = duration * Math.max(0.05, window.agreement);
    weighted += bpm * weight;
    weightTotal += weight;
  }
  return roundTo(weightTotal > 0 ? weighted / weightTotal : fallback, 0.1);
}

function normalizeLocalBpmNear(localBpm: number, referenceBpm: number): number {
  let bpm = localBpm;
  while (bpm > referenceBpm * 1.5) bpm /= 2;
  while (bpm < referenceBpm * 0.67) bpm *= 2;
  return bpm;
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

function snapOnsetsToZeroCrossings(mono: Float32Array, sr: number, onsets: number[]): number[] {
  const search = Math.max(4, Math.round(sr * 0.008));
  const snapped: number[] = [];
  for (const onset of onsets) {
    const center = Math.max(1, Math.min(mono.length - 2, Math.round(onset * sr)));
    let bestIndex = center;
    let bestScore = Infinity;
    for (let i = Math.max(1, center - search); i <= Math.min(mono.length - 2, center + search); i++) {
      const crosses = (mono[i - 1] <= 0 && mono[i] >= 0) || (mono[i - 1] >= 0 && mono[i] <= 0);
      if (!crosses) continue;
      const localEnergy = Math.abs(mono[i - 2] ?? 0) + Math.abs(mono[i - 1]) + Math.abs(mono[i]) + Math.abs(mono[i + 1]) + Math.abs(mono[i + 2] ?? 0);
      const distance = Math.abs(i - center) / search;
      const score = distance - localEnergy * 0.08;
      if (score < bestScore) {
        bestScore = score;
        bestIndex = i;
      }
    }
    snapped.push(bestIndex / sr);
  }
  return snapped;
}

function detectInitialTransient(mono: Float32Array, sr: number): number | undefined {
  const earlySamples = Math.min(mono.length, Math.floor(sr * 0.12));
  if (earlySamples < 8) return undefined;
  let globalPeak = 0;
  for (let i = 0; i < mono.length; i += 16) globalPeak = Math.max(globalPeak, Math.abs(mono[i]));
  if (globalPeak < 0.02) return undefined;
  let earlyPeak = 0;
  for (let i = 0; i < earlySamples; i++) earlyPeak = Math.max(earlyPeak, Math.abs(mono[i]));
  if (earlyPeak < Math.max(0.025, globalPeak * 0.16)) return undefined;
  const threshold = Math.max(0.012, earlyPeak * 0.28);
  for (let i = 0; i < earlySamples; i++) {
    if (Math.abs(mono[i]) >= threshold) return i / sr;
  }
  return undefined;
}

function mergeNearbyOnsets(onsets: number[], toleranceSec: number): number[] {
  const merged: number[] = [];
  for (const onset of onsets) {
    const previous = merged[merged.length - 1];
    if (previous !== undefined && onset - previous < toleranceSec) continue;
    merged.push(onset);
  }
  return merged;
}

function onsetWeightsFromEnvelope(onsets: number[], env: Float32Array, framesPerSec: number): number[] {
  if (onsets.length === 0) return [];
  const weights = onsets.map((onset) => {
    const frame = Math.max(0, Math.min(env.length - 1, Math.round(onset * framesPerSec)));
    const local = Math.max(
      env[frame] ?? 0,
      env[frame - 1] ?? 0,
      env[frame + 1] ?? 0,
    );
    return 0.35 + Math.min(1.65, local * 1.65);
  });
  const median = [...weights].sort((a, b) => a - b)[Math.floor(weights.length / 2)] ?? 1;
  return weights.map((weight) => Math.max(0.2, Math.min(2.4, weight / Math.max(0.25, median))));
}

function estimateBpm(
  env: Float32Array,
  onsets: number[],
  sr: number,
  durationSec: number,
  onsetWeights: number[],
): { bpm: number; confidence: number; candidates: { bpm: number; score: number }[] } {
  const framesPerSec = sr / HOP;
  const minLag = Math.floor((framesPerSec * 60) / MAX_BPM);
  const maxLag = Math.floor((framesPerSec * 60) / MIN_BPM);
  const autoScores = new Map<number, number>();
  let bestScore = 0;
  let bestLag = minLag;
  for (let lag = minLag; lag <= maxLag; lag++) {
    let sum = 0;
    for (let i = 0; i + lag < env.length; i++) sum += env[i] * env[i + lag];
    const bpm = (60 * framesPerSec) / lag;
    const key = Math.round(bpm * 2) / 2;
    autoScores.set(key, Math.max(autoScores.get(key) ?? 0, sum));
    if (sum > bestScore) {
      bestScore = sum;
      bestLag = lag;
    }
  }
  if (bestScore > 0) {
    for (const [key, score] of autoScores.entries()) autoScores.set(key, score / bestScore);
  }

  const ioiScores = buildIoiTempoScores(onsets);
  const scores: { bpm: number; score: number }[] = [];
  for (let bpm = MIN_BPM; bpm <= MAX_BPM; bpm += 0.5) {
    const key = Math.round(bpm * 2) / 2;
    const auto = lookupTempoScore(autoScores, key);
    const grid = scoreTempoGridDetailed(onsets, bpm, durationSec, onsetWeights).score;
    const ioi = lookupTempoScore(ioiScores, key);
    const score = (grid * 0.58 + ioi * 0.25 + auto * 0.17) * tempoPrior(key);
    scores.push({ bpm: key, score });
  }

  const sorted = dedupeTempoCandidates(scores.sort((a, b) => b.score - a.score));
  const selected = selectTempoLevel(sorted);
  const top = dedupeTempoCandidates([selected, ...sorted]).slice(0, 8);
  // Normalize score to confidence (peak vs median)
  const median = scores[Math.floor(scores.length / 2)].score;
  const confidence = top[0]?.score ? Math.max(0, Math.min(1, (top[0].score - median) / top[0].score)) : 0;
  const bpm = top[0]?.bpm ?? (60 * framesPerSec) / bestLag;
  return {
    bpm,
    confidence,
    candidates: top.map((c) => ({ bpm: roundTo(c.bpm, 0.1), score: top[0]?.score ? c.score / top[0].score : 0 })),
  };
}

function scoreTempoGridDetailed(
  onsets: number[],
  bpm: number,
  durationSec: number,
  weights: number[] = [],
): { score: number; phaseSec: number } {
  if (onsets.length < 4 || durationSec <= 0) return { score: 0, phaseSec: 0 };
  const period = 60 / bpm;
  const tolerance = Math.min(0.08, period * 0.18);
  let best = 0;
  let bestPhase = 0;
  const totalWeight = Math.max(1, onsets.reduce((sum, _onset, index) => sum + (weights[index] ?? 1), 0));
  const avgWeight = totalWeight / Math.max(1, onsets.length);
  const phaseSteps = 24;
  for (let phaseIndex = 0; phaseIndex < phaseSteps; phaseIndex++) {
    const phase = (phaseIndex / phaseSteps) * period;
    let score = 0;
    for (let onsetIndex = 0; onsetIndex < onsets.length; onsetIndex++) {
      const onset = onsets[onsetIndex];
      const grid = Math.round((onset - phase) / period) * period + phase;
      const err = Math.abs(onset - grid);
      if (err <= tolerance) score += (1 - err / tolerance) * (weights[onsetIndex] ?? 1);
    }
    if (score > best) {
      best = score;
      bestPhase = phase;
    }
  }
  const first = onsets[0] ?? 0;
  const last = onsets[onsets.length - 1] ?? durationSec;
  const expectedGridPulses = Math.max(1, Math.floor(Math.max(0.01, last - first) / period) + 1);
  const onsetFit = best / totalWeight;
  const gridCoverage = Math.min(1, best / Math.max(avgWeight, expectedGridPulses * avgWeight * 0.78));
  return { score: Math.max(0, Math.min(1, onsetFit * 0.72 + gridCoverage * 0.28)), phaseSec: bestPhase };
}

function tempoPrior(bpm: number): number {
  if (bpm >= 72 && bpm <= 170) return 1;
  if (bpm >= 55 && bpm < 72) return 0.9;
  if (bpm > 170 && bpm <= 210) return 0.86;
  return 0.72;
}

function dedupeTempoCandidates(scores: { bpm: number; score: number }[]): { bpm: number; score: number }[] {
  const out: { bpm: number; score: number }[] = [];
  for (const candidate of scores) {
    const bpm = Math.max(MIN_BPM, Math.min(MAX_BPM, candidate.bpm));
    const existing = out.find((item) => Math.abs(item.bpm - bpm) < 1);
    if (existing) existing.score = Math.max(existing.score, candidate.score * 0.98);
    else out.push({ bpm, score: candidate.score });
  }
  return out.sort((a, b) => b.score - a.score);
}

function selectTempoLevel(scores: { bpm: number; score: number }[]): { bpm: number; score: number } {
  const top = scores[0] ?? { bpm: 100, score: 0 };
  const half = bestNearTempo(scores, top.bpm / 2);
  if (top.bpm >= 168 && half && half.score >= top.score * 0.58) {
    return { bpm: half.bpm, score: Math.max(half.score, top.score * 0.995) };
  }
  const double = bestNearTempo(scores, top.bpm * 2);
  if (top.bpm <= 70 && double && double.score >= top.score * 0.72) {
    return { bpm: double.bpm, score: Math.max(double.score, top.score * 0.99) };
  }
  return top;
}

function bestNearTempo(scores: { bpm: number; score: number }[], target: number): { bpm: number; score: number } | undefined {
  if (target < MIN_BPM || target > MAX_BPM) return undefined;
  return scores
    .filter((candidate) => Math.abs(candidate.bpm - target) <= 2)
    .sort((a, b) => b.score - a.score)[0];
}

function normalizeMusicalBpm(bpm: number, candidates: { bpm: number; score: number }[]): number {
  const bounded = Math.max(MIN_BPM, Math.min(MAX_BPM, bpm));
  const closeCandidate = candidates.find((candidate) => Math.abs(candidate.bpm - bounded) <= 1.5);
  return roundTo(closeCandidate?.bpm ?? bounded, 0.1);
}

function buildIoiTempoScores(onsets: number[]): Map<number, number> {
  const scores = new Map<number, number>();
  for (let i = 0; i < onsets.length; i++) {
    const stop = Math.min(onsets.length, i + 10);
    for (let j = i + 1; j < stop; j++) {
      const delta = onsets[j] - onsets[i];
      if (delta < 0.12 || delta > 3.2) continue;
      for (let division = 1; division <= 8; division++) {
        const period = delta / division;
        const bpm = 60 / period;
        if (bpm < MIN_BPM || bpm > MAX_BPM) continue;
        const key = Math.round(bpm * 2) / 2;
        const weight = 1 / Math.sqrt(division) / Math.max(1, j - i);
        scores.set(key, (scores.get(key) ?? 0) + weight);
      }
    }
  }
  const max = Math.max(...scores.values(), 0.001);
  for (const [key, value] of scores.entries()) scores.set(key, value / max);
  return scores;
}

function lookupTempoScore(scores: Map<number, number>, bpm: number): number {
  const key = Math.round(bpm * 2) / 2;
  return Math.max(scores.get(key) ?? 0, scores.get(key - 0.5) ?? 0, scores.get(key + 0.5) ?? 0);
}

function lockTempoToBeatGrid(
  onsets: number[],
  weights: number[],
  bpm: number,
  candidates: { bpm: number; score: number }[],
  durationSec: number,
): { bpm: number; downbeatSec: number } {
  const options = new Map<number, number>();
  const addOption = (value: number, score = 0.5) => {
    if (value >= MIN_BPM && value <= MAX_BPM) {
      const key = roundTo(value, 0.5);
      options.set(key, Math.max(options.get(key) ?? 0, score));
    }
  };
  addOption(bpm, 1);
  addOption(bpm / 2, 0.82);
  addOption(bpm * 2, 0.82);
  for (const candidate of candidates.slice(0, 8)) {
    addOption(candidate.bpm, candidate.score);
    addOption(candidate.bpm / 2, candidate.score * 0.78);
    addOption(candidate.bpm * 2, candidate.score * 0.78);
  }

  let base = { bpm, score: -Infinity, phaseSec: 0 };
  let best = { bpm, score: -Infinity, phaseSec: 0 };
  for (const [optionBpm, priorScore] of options.entries()) {
    const grid = scoreTempoGridDetailed(onsets, optionBpm, durationSec, weights);
    const levelDistance = Math.abs(Math.log2(optionBpm / Math.max(1, bpm)));
    const levelPenalty = levelDistance > 0.55 ? 0.94 : 1;
    const score = (grid.score * 0.82 + priorScore * 0.18) * levelPenalty * tempoPrior(optionBpm);
    if (Math.abs(optionBpm - bpm) <= 0.75) base = { bpm: optionBpm, score, phaseSec: grid.phaseSec };
    if (score > best.score) best = { bpm: optionBpm, score, phaseSec: grid.phaseSec };
  }
  const octaveMove = Math.abs(Math.log2(best.bpm / Math.max(1, bpm))) >= 0.45;
  if (base.score > -Infinity && octaveMove && base.score >= 0.45) {
    best = base;
  } else if (base.score > -Infinity && Math.abs(best.bpm - bpm) > 0.75 && best.score < base.score * 1.12) {
    best = base;
  }

  const period = 60 / best.bpm;
  const firstUseful = onsets.find((onset) => onset >= 0.015) ?? 0;
  let downbeat = best.phaseSec + Math.round((firstUseful - best.phaseSec) / period) * period;
  if ((onsets[0] ?? Infinity) < period * 0.18) downbeat = 0;
  while (downbeat < -period * 0.25) downbeat += period;
  if (downbeat < 0) downbeat = 0;
  if (downbeat > durationSec - 0.05) downbeat = firstUseful;
  return { bpm: roundTo(best.bpm, 0.1), downbeatSec: roundTo(Math.max(0, downbeat), 0.001) };
}

function prioritizeCandidate(
  candidates: { bpm: number; score: number }[],
  bpm: number,
): { bpm: number; score: number }[] {
  const top = candidates[0]?.score ?? 1;
  const merged = dedupeTempoCandidates([{ bpm, score: Math.max(top, 1) }, ...candidates]);
  const bestScore = merged[0]?.score ?? 1;
  return merged.slice(0, 8).map((candidate) => ({
    bpm: roundTo(candidate.bpm, 0.1),
    score: Math.max(0, Math.min(1, candidate.score / bestScore)),
  }));
}

function estimateTimeSignature(onsets: number[], bpm: number): TempoAnalysisResult["timeSignature"] {
  if (onsets.length < 8) return undefined;
  const beat = 60 / bpm;
  const candidates = [3, 4, 5, 6, 7];
  let best = { numerator: 4, score: 0 };
  for (const numerator of candidates) {
    const bar = beat * numerator;
    let score = 0;
    for (const onset of onsets) {
      const pos = onset % bar;
      const distanceToBar = Math.min(pos, bar - pos);
      if (distanceToBar < beat * 0.22) score += 1 - distanceToBar / (beat * 0.22);
    }
    score /= onsets.length;
    if (score > best.score) best = { numerator, score };
  }
  const denominator = best.numerator === 6 ? 8 : 4;
  if (best.score < 0.42) return undefined;
  return { numerator: best.numerator, denominator, confidence: Math.max(0.1, Math.min(0.9, best.score)) };
}

function buildWaveformPeaks(mono: Float32Array, count: number): number[] {
  const peaks: number[] = [];
  const samplesPerPeak = Math.max(1, Math.floor(mono.length / count));
  for (let i = 0; i < count; i++) {
    const start = i * samplesPerPeak;
    const end = Math.min(mono.length, start + samplesPerPeak);
    let max = 0;
    for (let j = start; j < end; j++) max = Math.max(max, Math.abs(mono[j]));
    peaks.push(max);
  }
  const peakMax = Math.max(...peaks, 0.001);
  return peaks.map((peak) => roundTo(peak / peakMax, 0.001));
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
    const localBpm = roundTo(normalizeLocalBpmNear(60 / median, bpm), 0.1);
    const drift = Math.abs(localBpm - bpm) / bpm;
    const agreement = Math.max(0, 1 - drift * 4); // 25% drift -> 0 agreement
    out.push({ startSec: t, endSec: t + windowSec, bpm: localBpm, agreement });
  }
  return out;
}

function roundTo(value: number, step: number): number {
  return Math.round(value / step) * step;
}
