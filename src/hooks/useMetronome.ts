import { useCallback, useEffect, useRef, useState } from "react";
import * as Tone from "tone";

import {
  ACCENT_VOLUME,
  buildAccents,
  SOUND_ENVELOPES,
  SOUND_FREQS,
  SUBDIVISION_COUNTS,
  type AccentLevel,
  type BeatSound,
  type Subdivision,
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
  accents: AccentLevel[];
  subdivision: Subdivision;
  swing: number;
  currentBeat: number;
  barCount: number;
  trainerEnabled: boolean;
  trainerPhase: "playing" | "muted";
  trainerConfig: TrainerConfig;
  rampEnabled: boolean;
  rampConfig: RampConfig;
  rampProgress: { bar: number; currentBpm: number } | null;
  practiceSeconds: number;
  toneStarted: boolean;
}

/**
 * Sample-accurate metronome engine driven by Tone.Transport.
 * Returns state + setters + transport controls. Mirrors the Pro-Metronome feature set:
 * accents, swing, subdivisions up to septuplets, tempo ramp, mute trainer, practice timer.
 */
export function useMetronome() {
  // --- Core state ---
  const [bpm, setBpm] = useState(120);
  const [isPlaying, setIsPlaying] = useState(false);
  const [timeSignature, setTimeSignature] = useState<TimeSignature>({ numerator: 4, denominator: 4 });
  const [currentBeat, setCurrentBeat] = useState(-1);
  const [beatSound, setBeatSound] = useState<BeatSound>("click");
  const [accents, setAccents] = useState<AccentLevel[]>(buildAccents(4));
  const [subdivision, setSubdivision] = useState<Subdivision>("none");
  const [swing, setSwing] = useState(0);
  const [barCount, setBarCount] = useState(0);

  // --- Trainer ---
  const [trainerEnabled, setTrainerEnabled] = useState(false);
  const [trainerConfig, setTrainerConfig] = useState<TrainerConfig>({ playBars: 2, muteBars: 2 });
  const [trainerPhase, setTrainerPhase] = useState<"playing" | "muted">("playing");

  // --- Ramp ---
  const [rampEnabled, setRampEnabled] = useState(false);
  const [rampConfig, setRampConfig] = useState<RampConfig>({ startBpm: 80, endBpm: 160, durationBars: 8, loop: false });
  const [rampProgress, setRampProgress] = useState<MetronomeState["rampProgress"]>(null);

  // --- Practice timer ---
  const [practiceSeconds, setPracticeSeconds] = useState(0);

  // --- Tone ---
  const [toneStarted, setToneStarted] = useState(false);

  // --- Refs ---
  const synthRef = useRef<Tone.Synth | null>(null);
  const scheduleIdRef = useRef<number | null>(null);
  const beatRef = useRef(0);
  const barCountRef = useRef(0);
  const rampIntervalRef = useRef<number | null>(null);
  const practiceIntervalRef = useRef<number | null>(null);

  const accentsRef = useRef(accents);
  const subdivisionRef = useRef(subdivision);
  const swingRef = useRef(swing);
  const beatSoundRef = useRef(beatSound);
  const timeSignatureRef = useRef(timeSignature);
  const bpmRef = useRef(bpm);
  const trainerEnabledRef = useRef(trainerEnabled);
  const trainerConfigRef = useRef(trainerConfig);
  const rampEnabledRef = useRef(rampEnabled);
  const rampConfigRef = useRef(rampConfig);

  useEffect(() => { accentsRef.current = accents; }, [accents]);
  useEffect(() => { subdivisionRef.current = subdivision; }, [subdivision]);
  useEffect(() => { swingRef.current = swing; }, [swing]);
  useEffect(() => { beatSoundRef.current = beatSound; }, [beatSound]);
  useEffect(() => { timeSignatureRef.current = timeSignature; }, [timeSignature]);
  useEffect(() => { bpmRef.current = bpm; }, [bpm]);
  useEffect(() => { trainerEnabledRef.current = trainerEnabled; }, [trainerEnabled]);
  useEffect(() => { trainerConfigRef.current = trainerConfig; }, [trainerConfig]);
  useEffect(() => { rampEnabledRef.current = rampEnabled; }, [rampEnabled]);
  useEffect(() => { rampConfigRef.current = rampConfig; }, [rampConfig]);

  // Sync accents length when numerator changes
  useEffect(() => {
    setAccents((prev) => {
      const n = timeSignature.numerator;
      if (prev.length === n) return prev;
      const next = buildAccents(n);
      for (let i = 0; i < Math.min(prev.length, n); i++) next[i] = prev[i];
      if (next[0] !== "f" && next[0] !== "mute") next[0] = "f";
      return next;
    });
  }, [timeSignature.numerator]);

  const ensureSynth = useCallback(() => {
    if (synthRef.current) synthRef.current.dispose();
    const env = SOUND_ENVELOPES[beatSoundRef.current];
    synthRef.current = new Tone.Synth({
      oscillator: { type: beatSoundRef.current === "cowbell" ? "square" : "sine" },
      envelope: env,
    }).toDestination();
    // Warm up synth to avoid first-note latency
    synthRef.current.triggerAttackRelease(1, "128n", Tone.now(), 0);
  }, []);

  const playClick = useCallback((time: number, freq: number, vol: number) => {
    if (!synthRef.current || vol === -Infinity) return;
    try {
      synthRef.current.triggerAttackRelease(freq, "32n", time, Tone.dbToGain(vol));
    } catch {
      // ignore rapid trigger errors
    }
  }, []);

  const scheduleLoop = useCallback(() => {
    const id = Tone.getTransport().scheduleRepeat((time) => {
      const beat = beatRef.current;
      const ts = timeSignatureRef.current;
      const accs = accentsRef.current;
      const sound = beatSoundRef.current;
      const freqs = SOUND_FREQS[sound];
      const sw = swingRef.current;
      const subCount = SUBDIVISION_COUNTS[subdivisionRef.current];

      let muted = false;
      if (trainerEnabledRef.current) {
        const { playBars, muteBars } = trainerConfigRef.current;
        const total = Math.max(1, playBars + muteBars);
        const phaseIdx = barCountRef.current % total;
        muted = phaseIdx >= playBars;
        if (beat === 0) {
          const phase: "playing" | "muted" = muted ? "muted" : "playing";
          Tone.Draw.schedule(() => setTrainerPhase(phase), time);
        }
      }

      const accentLevel = accs[beat] ?? "mf";
      const isAccent = beat === 0;
      const freq = isAccent ? freqs.accent : freqs.normal;
      const vol = ACCENT_VOLUME[accentLevel];
      if (!muted) playClick(time, freq, vol);

      if (subCount > 1 && !muted) {
        const beatDuration = 60 / bpmRef.current;
        for (let s = 1; s < subCount; s++) {
          let offset = (beatDuration / subCount) * s;
          if (sw !== 0 && s % 2 === 1 && subCount === 2) {
            offset += (sw / 100) * (beatDuration / 6);
          }
          playClick(time + offset, freqs.sub, vol - 6);
        }
      }

      Tone.Draw.schedule(() => setCurrentBeat(beat), time);

      beatRef.current = (beat + 1) % ts.numerator;
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
    transport.bpm.value = cfg.startBpm;
    setBpm(cfg.startBpm);
    transport.bpm.rampTo(cfg.endBpm, totalTime);
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
    ensureSynth();
    beatRef.current = 0;
    barCountRef.current = 0;
    setCurrentBeat(-1);

    const transport = Tone.getTransport();
    transport.bpm.value = bpmRef.current;
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
  }, [toneStarted, ensureSynth, scheduleLoop, startRampCycle]);

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
    setBarCount(0);
    setRampProgress(null);
    setTrainerPhase("playing");
  }, []);

  const toggle = useCallback(() => {
    if (isPlaying) stop();
    else void start();
  }, [isPlaying, start, stop]);

  // Live BPM updates while playing (and not ramping)
  useEffect(() => {
    if (isPlaying && !rampEnabled) {
      Tone.getTransport().bpm.value = bpm;
    }
  }, [bpm, isPlaying, rampEnabled]);

  // Reschedule when subdivision/time signature changes mid-play
  useEffect(() => {
    if (!isPlaying) return;
    const transport = Tone.getTransport();
    transport.cancel();
    beatRef.current = 0;
    barCountRef.current = 0;
    transport.timeSignature = timeSignature.numerator;
    scheduleLoop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subdivision, timeSignature.numerator, timeSignature.denominator]);

  // Recreate synth when sound changes during playback
  useEffect(() => {
    if (isPlaying) ensureSynth();
  }, [beatSound, isPlaying, ensureSynth]);

  // Pre-init Tone on first user gesture so the very first start is instant
  useEffect(() => {
    const init = () => {
      if (!toneStarted) {
        void Tone.start().then(() => {
          setToneStarted(true);
          ensureSynth();
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
  }, [toneStarted, ensureSynth]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      const transport = Tone.getTransport();
      transport.stop();
      transport.cancel();
      if (synthRef.current) synthRef.current.dispose();
      if (practiceIntervalRef.current) clearInterval(practiceIntervalRef.current);
      if (rampIntervalRef.current) clearInterval(rampIntervalRef.current);
    };
  }, []);

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
      void Tone.start().then(() => { setToneStarted(true); ensureSynth(); });
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
  }, [toneStarted, ensureSynth, isPlaying, rampEnabled]);

  // --- Helpers ---
  const adjustBpm = useCallback((delta: number) => {
    setBpm((b) => clamp(Math.round((b + delta) * 10) / 10, 20, 300));
  }, []);

  const cycleAccent = useCallback((index: number, cycle: AccentLevel[]) => {
    setAccents((prev) => {
      const next = [...prev];
      const idx = cycle.indexOf(next[index]);
      next[index] = cycle[(idx + 1) % cycle.length];
      return next;
    });
  }, []);

  return {
    state: {
      bpm,
      isPlaying,
      timeSignature,
      beatSound,
      accents,
      subdivision,
      swing,
      currentBeat,
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
    },
    setBpm,
    setTimeSignature,
    setBeatSound,
    setAccents,
    setSubdivision,
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
    cycleAccent,
  };
}

export type UseMetronomeReturn = ReturnType<typeof useMetronome>;
