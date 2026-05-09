import { useCallback, useEffect, useRef, useState } from "react";
import * as Tone from "tone";

import {
  buildDefaultPattern,
  LEVEL_TO_ACCENT,
  nextSubdivision,
  pitchToMultiplier,
  PULSE_ACCENT_CYCLE,
  PULSE_ACCENT_LEVEL,
  PULSE_ACCENT_VOLUME,
  SAMPLE_SOUND_SETS,
  SOUND_ENVELOPES,
  SOUND_FREQS,
  SOUND_OSCILLATORS,
  withSubdivision,
  type BeatPattern,
  type BeatSound,
  type PolyrhythmConfig,
  type PulseAccent,
  type SubdivisionCount,
  type TimeSignature,
} from "@/lib/metronome-types";
import { clamp } from "@/lib/utils";

export interface RampConfig {
  startBpm: number;
  endBpm: number;
  durationBars: number;
  loop: boolean;
}

export interface TrainerConfig {
  playBars: number;
  muteBars: number;
}

export interface MetronomeState {
  bpm: number;
  isPlaying: boolean;
  timeSignature: TimeSignature;
  beatSound: BeatSound;
  pitch: number;
  pattern: BeatPattern[];
  swing: number;
  polyrhythm: PolyrhythmConfig;
  currentBeat: number;
  currentPulse: number;
  currentPoly: number;
  barCount: number;
  trainerEnabled: boolean;
  trainerPhase: "playing" | "muted";
  trainerConfig: TrainerConfig;
  rampEnabled: boolean;
  rampConfig: RampConfig;
  rampProgress: { bar: number; currentBpm: number } | null;
  practiceSeconds: number;
  toneStarted: boolean;
  tapInfo: { count: number; avgBpm: number | null };
}

type ClickRole = "accent" | "normal" | "sub";

function displayBpmToTransportBpm(displayBpm: number, denominator: number): number {
  return displayBpm * (4 / denominator);
}

function samplePlaybackRate(pitch: number): number {
  const clamped = Math.max(0, Math.min(100, pitch));
  return 0.82 + (clamped / 100) * 0.36;
}

/**
 * Per-beat metronome engine. Each beat in the bar carries its own subdivision count
 * (1–8) plus a per-pulse accent (normal / accent / ghost / mute). Tone.Transport
 * schedules one event per beat; sub-pulses fan out within the beat span.
 */
export function useMetronome() {
  const [bpm, setBpm] = useState(120);
  const [isPlaying, setIsPlaying] = useState(false);
  const [timeSignature, setTimeSignature] = useState<TimeSignature>({ numerator: 4, denominator: 4 });
  const [currentBeat, setCurrentBeat] = useState(-1);
  const [currentPulse, setCurrentPulse] = useState(-1);
  const [beatSound, setBeatSound] = useState<BeatSound>("tone");
  const [pitch, setPitch] = useState(50);
  const [pattern, setPattern] = useState<BeatPattern[]>(() => buildDefaultPattern(4, 1));
  const [swing, setSwing] = useState(0);
  const [barCount, setBarCount] = useState(0);
  const [polyrhythm, setPolyrhythmState] = useState<PolyrhythmConfig>({ enabled: false, against: 3 });
  const [currentPoly, setCurrentPoly] = useState(-1);

  const [trainerEnabled, setTrainerEnabled] = useState(false);
  const [trainerConfig, setTrainerConfig] = useState<TrainerConfig>({ playBars: 2, muteBars: 2 });
  const [trainerPhase, setTrainerPhase] = useState<"playing" | "muted">("playing");

  const [rampEnabled, setRampEnabled] = useState(false);
  const [rampConfig, setRampConfig] = useState<RampConfig>({ startBpm: 80, endBpm: 160, durationBars: 2, loop: false });
  const [rampProgress, setRampProgress] = useState<MetronomeState["rampProgress"]>(null);

  const [practiceSeconds, setPracticeSeconds] = useState(0);
  const [toneStarted, setToneStarted] = useState(false);

  const synthRef = useRef<Tone.Synth | null>(null);
  const samplePlayersRef = useRef<Tone.Players | null>(null);
  const engineSoundRef = useRef<BeatSound | null>(null);
  const scheduleIdRef = useRef<number | null>(null);
  const beatRef = useRef(0);
  const barCountRef = useRef(0);
  const rampIntervalRef = useRef<number | null>(null);
  const practiceIntervalRef = useRef<number | null>(null);

  const patternRef = useRef(pattern);
  const swingRef = useRef(swing);
  const polyrhythmRef = useRef(polyrhythm);
  const beatSoundRef = useRef(beatSound);
  const pitchRef = useRef(pitch);
  const timeSignatureRef = useRef(timeSignature);
  const bpmRef = useRef(bpm);
  const trainerEnabledRef = useRef(trainerEnabled);
  const trainerConfigRef = useRef(trainerConfig);
  const rampEnabledRef = useRef(rampEnabled);
  const rampConfigRef = useRef(rampConfig);

  useEffect(() => { patternRef.current = pattern; }, [pattern]);
  useEffect(() => { swingRef.current = swing; }, [swing]);
  useEffect(() => { polyrhythmRef.current = polyrhythm; }, [polyrhythm]);
  useEffect(() => { beatSoundRef.current = beatSound; }, [beatSound]);
  useEffect(() => { pitchRef.current = pitch; }, [pitch]);
  useEffect(() => { timeSignatureRef.current = timeSignature; }, [timeSignature]);
  useEffect(() => { bpmRef.current = bpm; }, [bpm]);
  useEffect(() => { trainerEnabledRef.current = trainerEnabled; }, [trainerEnabled]);
  useEffect(() => { trainerConfigRef.current = trainerConfig; }, [trainerConfig]);
  useEffect(() => { rampEnabledRef.current = rampEnabled; }, [rampEnabled]);
  useEffect(() => { rampConfigRef.current = rampConfig; }, [rampConfig]);

  // Resize pattern when numerator changes
  useEffect(() => {
    setPattern((prev) => {
      const n = timeSignature.numerator;
      if (prev.length === n) return prev;
      const next: BeatPattern[] = [];
      for (let i = 0; i < n; i++) {
        if (i < prev.length) next.push(prev[i]);
        else next.push({ pulses: 1, accents: ["normal"] });
      }
      if (next.length > 0 && next[0].accents[0] === "ghost") {
        next[0] = { ...next[0], accents: ["accent", ...next[0].accents.slice(1)] };
      }
      return next;
    });
  }, [timeSignature.numerator]);

  const disposeEngine = useCallback(() => {
    if (synthRef.current) {
      synthRef.current.dispose();
      synthRef.current = null;
    }
    if (samplePlayersRef.current) {
      samplePlayersRef.current.dispose();
      samplePlayersRef.current = null;
    }
    engineSoundRef.current = null;
  }, []);

  const ensureSoundEngine = useCallback(() => {
    const sound = beatSoundRef.current;
    if (engineSoundRef.current === sound && (synthRef.current || samplePlayersRef.current)) return;

    disposeEngine();

    const sampleSet = SAMPLE_SOUND_SETS[sound];
    if (sampleSet) {
      samplePlayersRef.current = new Tone.Players({
        urls: {
          accent: sampleSet.accent,
          normal: sampleSet.normal,
          sub: sampleSet.sub,
        },
        fadeOut: 0.006,
        volume: sampleSet.gainDb ?? 0,
      }).toDestination();
      engineSoundRef.current = sound;
      return;
    }

    const env = SOUND_ENVELOPES[sound];
    synthRef.current = new Tone.Synth({
      oscillator: { type: SOUND_OSCILLATORS[sound] ?? "sine" },
      envelope: env,
    }).toDestination();
    synthRef.current.triggerAttackRelease(1, "128n", Tone.now(), 0);
    engineSoundRef.current = sound;
  }, [disposeEngine]);

  const playClick = useCallback((time: number, freq: number, vol: number, role: ClickRole) => {
    if (vol === -Infinity) return;
    try {
      const players = samplePlayersRef.current;
      if (players?.loaded && players.has(role)) {
        const player = players.player(role);
        player.playbackRate = samplePlaybackRate(pitchRef.current);
        player.volume.setValueAtTime(vol, time);
        player.start(time);
        return;
      }

      if (!synthRef.current) return;
      synthRef.current.triggerAttackRelease(freq, "32n", time, Tone.dbToGain(vol));
    } catch {
      // ignore rapid trigger errors
    }
  }, []);

  const scheduleLoop = useCallback(() => {
    const id = Tone.getTransport().scheduleRepeat((time) => {
      const beatIdx = beatRef.current;
      const ts = timeSignatureRef.current;
      const pat = patternRef.current;
      const sound = beatSoundRef.current;
      const baseFreqs = SOUND_FREQS[sound];
      const pitchMul = pitchToMultiplier(pitchRef.current);
      const freqs = {
        accent: baseFreqs.accent * pitchMul,
        normal: baseFreqs.normal * pitchMul,
        sub: baseFreqs.sub * pitchMul,
      };
      const sw = swingRef.current;
      const beatPat = pat[beatIdx] ?? { pulses: 1 as SubdivisionCount, accents: ["normal" as PulseAccent] };
      const beatDuration = 60 / bpmRef.current;

      let muted = false;
      if (trainerEnabledRef.current) {
        const { playBars, muteBars } = trainerConfigRef.current;
        const total = Math.max(1, playBars + muteBars);
        const phaseIdx = barCountRef.current % total;
        muted = phaseIdx >= playBars;
        if (beatIdx === 0) {
          const phase: "playing" | "muted" = muted ? "muted" : "playing";
          Tone.Draw.schedule(() => setTrainerPhase(phase), time);
        }
      }

      const pulses = beatPat.pulses;
      for (let p = 0; p < pulses; p++) {
        let offset = (beatDuration / pulses) * p;
        // Apply swing only when there are exactly 2 pulses (8th-note feel)
        if (sw !== 0 && pulses === 2 && p === 1) {
          offset += (sw / 100) * (beatDuration / 6);
        }
        const accent: PulseAccent = beatPat.accents[p] ?? "normal";
        const isFirstPulse = p === 0;
        const freq = isFirstPulse
          ? (accent === "accent" ? freqs.accent : freqs.normal)
          : freqs.sub;
        const vol = PULSE_ACCENT_VOLUME[accent];
        const role: ClickRole = isFirstPulse ? (accent === "accent" ? "accent" : "normal") : "sub";
        if (!muted) playClick(time + offset, freq, vol, role);

        const pulseIndex = p;
        Tone.Draw.schedule(() => setCurrentPulse(pulseIndex), time + offset);
      }

      Tone.Draw.schedule(() => setCurrentBeat(beatIdx), time);

      // Polyrhythm cross-voice — schedule N evenly-spaced clicks across the bar
      // at the start of every bar. Uses a brighter/different pitch (clave-like).
      const poly = polyrhythmRef.current;
      if (beatIdx === 0 && poly.enabled && poly.against >= 2) {
        const barDuration = beatDuration * ts.numerator;
        const polyStep = barDuration / poly.against;
        for (let k = 0; k < poly.against; k++) {
          const offset = polyStep * k;
          const isPolyDownbeat = k === 0;
          if (!muted) {
            const polyFreq = isPolyDownbeat ? 1800 : 1500;
            playClick(time + offset, polyFreq, isPolyDownbeat ? -4 : -10, isPolyDownbeat ? "accent" : "normal");
          }
          const polyIdx = k;
          Tone.Draw.schedule(() => setCurrentPoly(polyIdx), time + offset);
        }
      }

      beatRef.current = (beatIdx + 1) % ts.numerator;
      if (beatRef.current === 0) {
        barCountRef.current++;
        const bc = barCountRef.current;
        Tone.Draw.schedule(() => setBarCount(bc), time);
      }
    }, `${timeSignatureRef.current.denominator}n`);

    scheduleIdRef.current = id;
  }, [playClick]);

  const startRampCycle = useCallback(() => {
    const cfg = rampConfigRef.current;
    const transport = Tone.getTransport();
    const totalBeats = cfg.durationBars * timeSignatureRef.current.numerator;
    const beatDuration = 60 / cfg.startBpm;
    const totalTime = totalBeats * beatDuration;
    transport.bpm.value = displayBpmToTransportBpm(cfg.startBpm, timeSignatureRef.current.denominator);
    setBpm(cfg.startBpm);
    transport.bpm.rampTo(displayBpmToTransportBpm(cfg.endBpm, timeSignatureRef.current.denominator), totalTime);
    setRampProgress({ bar: 1, currentBpm: cfg.startBpm });

    const startTime = Date.now();
    if (rampIntervalRef.current) clearInterval(rampIntervalRef.current);
    rampIntervalRef.current = window.setInterval(() => {
      const elapsed = (Date.now() - startTime) / 1000;
      const progress = Math.min(elapsed / totalTime, 1);
      const currentBpmVal = cfg.startBpm + (cfg.endBpm - cfg.startBpm) * progress;
      const currentBar = Math.min(Math.floor(progress * cfg.durationBars) + 1, cfg.durationBars);
      setBpm(Math.round(currentBpmVal));
      setRampProgress({ bar: currentBar, currentBpm: Math.round(currentBpmVal) });
      if (progress >= 1) {
        if (rampIntervalRef.current) clearInterval(rampIntervalRef.current);
        if (rampConfigRef.current.loop) {
          startRampCycle();
        } else {
          setBpm(cfg.endBpm);
          setRampEnabled(false);
          setRampProgress(null);
        }
      }
    }, 200);
  }, []);

  const start = useCallback(async () => {
    if (!toneStarted) {
      await Tone.start();
      setToneStarted(true);
    }
    ensureSoundEngine();
    beatRef.current = 0;
    barCountRef.current = 0;
    setCurrentBeat(-1);
    setCurrentPulse(-1);

    const transport = Tone.getTransport();
    transport.bpm.value = displayBpmToTransportBpm(bpmRef.current, timeSignatureRef.current.denominator);
    transport.timeSignature = timeSignatureRef.current.numerator;
    transport.cancel();
    transport.position = 0;

    scheduleLoop();
    Tone.getContext().lookAhead = 0.01;
    transport.start("+0.01");
    setIsPlaying(true);
    setPracticeSeconds(0);

    practiceIntervalRef.current = window.setInterval(() => {
      setPracticeSeconds((s) => s + 1);
    }, 1000);

    if (rampEnabledRef.current) startRampCycle();
  }, [toneStarted, ensureSoundEngine, scheduleLoop, startRampCycle]);

  const stop = useCallback(() => {
    const transport = Tone.getTransport();
    transport.stop();
    transport.cancel();
    scheduleIdRef.current = null;
    if (practiceIntervalRef.current) {
      clearInterval(practiceIntervalRef.current);
      practiceIntervalRef.current = null;
    }
    if (rampIntervalRef.current) {
      clearInterval(rampIntervalRef.current);
      rampIntervalRef.current = null;
    }
    setIsPlaying(false);
    setCurrentBeat(-1);
    setCurrentPulse(-1);
    setCurrentPoly(-1);
    setBarCount(0);
    setRampProgress(null);
    setTrainerPhase("playing");
  }, []);

  const toggle = useCallback(() => {
    if (isPlaying) stop();
    else void start();
  }, [isPlaying, start, stop]);

  useEffect(() => {
    if (isPlaying && !rampEnabled) {
      Tone.getTransport().bpm.value = displayBpmToTransportBpm(bpm, timeSignature.denominator);
    }
  }, [bpm, isPlaying, rampEnabled, timeSignature.denominator]);

  // Reschedule when time signature changes mid-play (subdivisions are read live from ref)
  useEffect(() => {
    if (!isPlaying) return;
    const transport = Tone.getTransport();
    transport.cancel();
    beatRef.current = 0;
    barCountRef.current = 0;
    transport.timeSignature = timeSignature.numerator;
    scheduleLoop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeSignature.numerator, timeSignature.denominator]);

  useEffect(() => {
    if (isPlaying || toneStarted) ensureSoundEngine();
  }, [beatSound, isPlaying, toneStarted, ensureSoundEngine]);

  // Pre-init Tone on first user gesture
  useEffect(() => {
    const init = () => {
      if (!toneStarted) {
        void Tone.start().then(() => {
          setToneStarted(true);
          ensureSoundEngine();
          Tone.getContext().lookAhead = 0.01;
        });
      }
      document.removeEventListener("pointerdown", init);
      document.removeEventListener("keydown", init);
    };
    document.addEventListener("pointerdown", init);
    document.addEventListener("keydown", init);
    return () => {
      document.removeEventListener("pointerdown", init);
      document.removeEventListener("keydown", init);
    };
  }, [toneStarted, ensureSoundEngine]);

  useEffect(() => {
    return () => {
      const transport = Tone.getTransport();
      transport.stop();
      transport.cancel();
      disposeEngine();
      if (practiceIntervalRef.current) clearInterval(practiceIntervalRef.current);
      if (rampIntervalRef.current) clearInterval(rampIntervalRef.current);
    };
  }, [disposeEngine]);

  // --- Tap tempo ---
  const tapTimesRef = useRef<number[]>([]);
  const [tapInfo, setTapInfo] = useState<{ count: number; avgBpm: number | null }>({ count: 0, avgBpm: null });
  const tapResetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const tap = useCallback(() => {
    const now = performance.now();
    const taps = tapTimesRef.current;

    if (taps.length > 0 && now - taps[taps.length - 1] > 2500) {
      tapTimesRef.current = [now];
      setTapInfo({ count: 1, avgBpm: null });
      return;
    }
    taps.push(now);
    if (taps.length > 12) taps.shift();

    if (tapResetTimerRef.current) clearTimeout(tapResetTimerRef.current);
    tapResetTimerRef.current = setTimeout(() => setTapInfo({ count: 0, avgBpm: null }), 3000);

    if (!toneStarted) {
      void Tone.start().then(() => { setToneStarted(true); ensureSoundEngine(); });
    }

    if (taps.length >= 2) {
      const intervals: number[] = [];
      for (let i = 1; i < taps.length; i++) intervals.push(taps[i] - taps[i - 1]);
      const avg = intervals.reduce((a, b) => a + b, 0) / intervals.length;
      const tapBpm = Math.round(60000 / avg);
      if (tapBpm >= 20 && tapBpm <= 300) {
        setBpm(tapBpm);
        setTapInfo({ count: taps.length, avgBpm: tapBpm });
        if (isPlaying && !rampEnabled) {
          Tone.getTransport().bpm.value = tapBpm;
        }
      }
    } else {
      setTapInfo({ count: 1, avgBpm: null });
    }
  }, [toneStarted, ensureSoundEngine, isPlaying, rampEnabled]);

  // --- Pattern setters ---
  const adjustBpm = useCallback((delta: number) => {
    setBpm((b) => clamp(Math.round((b + delta) * 10) / 10, 20, 300));
  }, []);

  const setBeatSubdivision = useCallback((beatIndex: number, pulses: SubdivisionCount) => {
    setPattern((prev) => {
      if (beatIndex < 0 || beatIndex >= prev.length) return prev;
      const next = [...prev];
      next[beatIndex] = withSubdivision(prev[beatIndex], pulses);
      return next;
    });
  }, []);

  const cycleBeatSubdivision = useCallback((beatIndex: number) => {
    setPattern((prev) => {
      if (beatIndex < 0 || beatIndex >= prev.length) return prev;
      const next = [...prev];
      const cur = prev[beatIndex];
      next[beatIndex] = withSubdivision(cur, nextSubdivision(cur.pulses));
      return next;
    });
  }, []);

  const cyclePulse = useCallback((beatIndex: number, pulseIndex: number) => {
    setPattern((prev) => {
      if (beatIndex < 0 || beatIndex >= prev.length) return prev;
      const beat = prev[beatIndex];
      if (pulseIndex < 0 || pulseIndex >= beat.accents.length) return prev;
      const accents = [...beat.accents];
      const cur = accents[pulseIndex];
      const idx = PULSE_ACCENT_CYCLE.indexOf(cur);
      accents[pulseIndex] = PULSE_ACCENT_CYCLE[(idx + 1) % PULSE_ACCENT_CYCLE.length];
      const next = [...prev];
      next[beatIndex] = { ...beat, accents };
      return next;
    });
  }, []);

  const setPulseLevel = useCallback((beatIndex: number, pulseIndex: number, level: number) => {
    const lvl = Math.max(0, Math.min(3, Math.round(level)));
    setPattern((prev) => {
      if (beatIndex < 0 || beatIndex >= prev.length) return prev;
      const beat = prev[beatIndex];
      if (pulseIndex < 0 || pulseIndex >= beat.accents.length) return prev;
      const accents = [...beat.accents];
      accents[pulseIndex] = LEVEL_TO_ACCENT[lvl];
      const next = [...prev];
      next[beatIndex] = { ...beat, accents };
      return next;
    });
  }, []);

  const cyclePulseLevel = useCallback((beatIndex: number, pulseIndex: number) => {
    setPattern((prev) => {
      if (beatIndex < 0 || beatIndex >= prev.length) return prev;
      const beat = prev[beatIndex];
      if (pulseIndex < 0 || pulseIndex >= beat.accents.length) return prev;
      const accents = [...beat.accents];
      const cur = accents[pulseIndex];
      const lvl = (PULSE_ACCENT_LEVEL[cur] + 1) % 4;
      accents[pulseIndex] = LEVEL_TO_ACCENT[lvl];
      const next = [...prev];
      next[beatIndex] = { ...beat, accents };
      return next;
    });
  }, []);

  const applyPatternToBeat = useCallback((beatIndex: number, pat: BeatPattern) => {
    setPattern((prev) => {
      if (beatIndex < 0 || beatIndex >= prev.length) return prev;
      const next = [...prev];
      next[beatIndex] = { pulses: pat.pulses, accents: [...pat.accents] };
      return next;
    });
  }, []);

  const applyPatternToAll = useCallback((pat: BeatPattern) => {
    setPattern((prev) => prev.map(() => ({ pulses: pat.pulses, accents: [...pat.accents] })));
  }, []);

  const setPolyrhythm = useCallback((cfg: Partial<PolyrhythmConfig>) => {
    setPolyrhythmState((prev) => ({ ...prev, ...cfg }));
  }, []);

  const setGlobalSubdivision = useCallback((pulses: SubdivisionCount) => {
    setPattern((prev) => prev.map((beat) => withSubdivision(beat, pulses)));
  }, []);

  const resetAccents = useCallback(() => {
    setPattern((prev) =>
      prev.map((beat, i) => ({
        pulses: beat.pulses,
        accents: Array.from({ length: beat.pulses }, (_, p) => {
          if (i === 0 && p === 0) return "accent" as PulseAccent;
          if (p === 0) return "normal" as PulseAccent;
          return "ghost" as PulseAccent;
        }),
      })),
    );
  }, []);

  return {
    state: {
      bpm,
      isPlaying,
      timeSignature,
      beatSound,
      pitch,
      pattern,
      swing,
      polyrhythm,
      currentBeat,
      currentPulse,
      currentPoly,
      barCount,
      trainerEnabled,
      trainerConfig,
      trainerPhase,
      rampEnabled,
      rampConfig,
      rampProgress,
      practiceSeconds,
      toneStarted,
      tapInfo,
    } as MetronomeState,
    setBpm,
    setTimeSignature,
    setBeatSound,
    setPitch,
    setPattern,
    setSwing,
    setTrainerEnabled,
    setTrainerConfig,
    setRampEnabled,
    setRampConfig,
    start,
    stop,
    toggle,
    tap,
    adjustBpm,
    setBeatSubdivision,
    cycleBeatSubdivision,
    cyclePulse,
    cyclePulseLevel,
    setPulseLevel,
    applyPatternToBeat,
    applyPatternToAll,
    setGlobalSubdivision,
    resetAccents,
    setPolyrhythm,
  };
}

export type UseMetronomeReturn = ReturnType<typeof useMetronome>;
