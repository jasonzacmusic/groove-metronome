import { useCallback, useEffect, useRef, useState } from "react";
import * as Tone from "tone";

import {
  buildDefaultPattern,
  DOTTED_PLAYBACK_LABELS,
  JAZZ_ASSIST_LABELS,
  LEVEL_TO_ACCENT,
  nextSubdivision,
  pitchToMultiplier,
  PULSE_ACCENT_LEVEL,
  PULSE_ACCENT_VOLUME,
  SAMPLE_SOUND_SETS,
  SOUND_ENVELOPES,
  SOUND_FREQS,
  SOUND_OSCILLATORS,
  TRIPLET_ASSIST_LABELS,
  withSubdivision,
  type BeatPattern,
  type BeatSound,
  type DottedPlaybackMode,
  type JazzAssistMode,
  type MeterDenominator,
  type PolyrhythmRate,
  type PolyrhythmConfig,
  type PulseAccent,
  type SubdivisionCount,
  type TimeSignature,
  type TripletAssistMode,
} from "@/lib/metronome-types";
import { triggerMetronomeHaptic } from "@/lib/haptics";
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
  hapticsEnabled: boolean;
  practiceSeconds: number;
  toneStarted: boolean;
  tapInfo: { count: number; avgBpm: number | null };
}

type ClickRole = "accent" | "normal" | "sub";
type JazzAssistEvent = {
  offset: number;
  freq: number;
  vol: number;
  voiceIndex: number;
  downbeat: boolean;
  beatNumber: number;
};
interface StartOptions {
  delaySeconds?: number;
}

const VOICE_ACCENT_VOLUME: Record<PulseAccent, number> = {
  accent: 1,
  normal: -3,
  ghost: -12,
  mute: -Infinity,
};

function displayBpmToTransportBpm(displayBpm: number, denominator: number): number {
  void denominator;
  return displayBpm;
}

function beatDurationSeconds(displayBpm: number, denominator: number): number {
  return (60 / displayBpm) * (4 / denominator);
}

function dottedBeatSpan(mode: DottedPlaybackMode): number | null {
  if (mode === "quarter") return 1.5;
  if (mode === "eighth") return 0.75;
  if (mode === "sixteenth") return 0.375;
  return null;
}

function tripletHitsPerBar(mode: TripletAssistMode, numerator: number, denominator: number): number {
  const quarterNotesPerBar = numerator * (4 / denominator);
  if (mode === "half") return Math.max(1, Math.round((quarterNotesPerBar / 4) * 3));
  if (mode === "quarter") return Math.max(1, Math.round((quarterNotesPerBar / 2) * 3));
  if (mode === "eighth") return Math.max(1, Math.round(quarterNotesPerBar * 3));
  if (mode === "sextuplet") return Math.max(1, Math.round(quarterNotesPerBar * 6));
  return 0;
}

function jazzAssistEvents(mode: JazzAssistMode, numerator: number, beatDuration: number): JazzAssistEvent[] {
  if (mode === "off") return [];
  const events: JazzAssistEvent[] = [];
  const addBackbeat = (beatNumber: number) => {
    if (beatNumber <= numerator) {
      events.push({ offset: (beatNumber - 1) * beatDuration, freq: 520, vol: -7, voiceIndex: 1, downbeat: true, beatNumber });
    }
  };
  const addAnd = (beatNumber: number) => {
    if (beatNumber <= numerator) {
      events.push({ offset: (beatNumber - 1) * beatDuration + beatDuration * (2 / 3), freq: 760, vol: -15, voiceIndex: 2, downbeat: false, beatNumber });
    }
  };

  if (mode === "twoFour" || mode === "twoFourAnds") {
    addBackbeat(2);
    addBackbeat(4);
  }
  if (mode === "ands" || mode === "twoFourAnds") {
    for (let beat = 1; beat <= numerator; beat++) addAnd(beat);
  }
  if (mode === "charleston") {
    events.push({ offset: 0, freq: 560, vol: -9, voiceIndex: 1, downbeat: true, beatNumber: 1 });
    addAnd(2);
  }
  return events.sort((a, b) => a.offset - b.offset);
}

function normalizeMeterDenominator(value: number): MeterDenominator {
  if (value === 16) return 16;
  if (value === 8) return 8;
  return 4;
}

function polymeterBeatNumber(tick: number, laneBeatTicks: number, laneNumerator: number): number {
  const beat = Math.floor((tick + 0.000001) / laneBeatTicks) % Math.max(1, laneNumerator);
  return beat + 1;
}

function polymeterCycleTicks(lanes: Array<{ numerator: number; denominator: MeterDenominator }>): number {
  return lanes.reduce((total, lane) => total + Math.max(1, lane.numerator) * (16 / lane.denominator), 0);
}

function polymeterStepAtTick(
  absoluteTick: number,
  lanes: Array<{ numerator: number; denominator: MeterDenominator }>,
): { laneIndex: number; beatIndex: number; downbeat: boolean } | null {
  const cycleTicks = polymeterCycleTicks(lanes);
  if (cycleTicks <= 0) return null;

  const cycleTick = ((absoluteTick % cycleTicks) + cycleTicks) % cycleTicks;
  let cursor = 0;

  for (let laneIndex = 0; laneIndex < lanes.length; laneIndex++) {
    const lane = lanes[laneIndex];
    const beatTicks = 16 / lane.denominator;
    const span = Math.max(1, lane.numerator) * beatTicks;
    if (cycleTick >= cursor && cycleTick < cursor + span) {
      const localTick = cycleTick - cursor;
      if (Math.abs(localTick % beatTicks) > 0.000001) return null;
      return {
        laneIndex,
        beatIndex: polymeterBeatNumber(localTick, beatTicks, lane.numerator) - 1,
        downbeat: Math.abs(localTick) < 0.000001,
      };
    }
    cursor += span;
  }

  return null;
}

function samplePlaybackRate(pitch: number): number {
  const clamped = Math.max(0, Math.min(100, pitch));
  return 0.82 + (clamped / 100) * 0.36;
}

function numberedVoiceKey(role: ClickRole, beatNumber: number | undefined, maxBeatNumber = 16): string | null {
  if (role === "sub" || beatNumber === undefined) return null;
  const wrapped = ((Math.max(1, Math.round(beatNumber)) - 1) % maxBeatNumber) + 1;
  return `${role === "accent" ? "accent" : "normal"}-${wrapped}`;
}

function voiceSubdivisionKey(pulses: number, pulseIndex: number): string | null {
  if (pulseIndex === 0) return null;
  if (pulses === 2) return pulseIndex === 1 ? "sub-and" : null;
  if (pulses === 3) return pulseIndex === 1 ? "sub-and" : pulseIndex === 2 ? "sub-a" : null;
  if (pulses === 4) {
    if (pulseIndex === 1) return "sub-e";
    if (pulseIndex === 2) return "sub-and";
    if (pulseIndex === 3) return "sub-a";
  }
  return null;
}

/**
 * Per-beat metronome engine. Each beat in the bar carries its own subdivision count
 * (1–8) plus a per-pulse accent (normal / accent / ghost / mute). Tone.Transport
 * schedules one event per beat; sub-pulses fan out within the beat span.
 */
export function useMetronome() {
  const [bpm, setBpm] = useState(100);
  const [isPlaying, setIsPlaying] = useState(false);
  const [timeSignature, setTimeSignature] = useState<TimeSignature>({ numerator: 4, denominator: 4 });
  const [currentBeat, setCurrentBeat] = useState(-1);
  const [currentPulse, setCurrentPulse] = useState(-1);
  const [beatSound, setBeatSound] = useState<BeatSound>("tone");
  const [pitch, setPitch] = useState(50);
  const [pattern, setPattern] = useState<BeatPattern[]>(() => buildDefaultPattern(4, 1));
  const [swing, setSwing] = useState(0);
  const [barCount, setBarCount] = useState(0);
  const [polyrhythm, setPolyrhythmState] = useState<PolyrhythmConfig>({
    enabled: false,
    main: 3,
    voices: [2],
    against: 2,
    dottedMode: "off",
    tripletMode: "off",
    jazzMode: "off",
    rate: "double",
    polymeterEnabled: false,
    polymeterLanes: [
      { numerator: 4, denominator: 4 },
    ],
  });
  const [currentPoly, setCurrentPoly] = useState(-1);

  const [trainerEnabled, setTrainerEnabled] = useState(false);
  const [trainerConfig, setTrainerConfig] = useState<TrainerConfig>({ playBars: 2, muteBars: 2 });
  const [trainerPhase, setTrainerPhase] = useState<"playing" | "muted">("playing");

  const [rampEnabled, setRampEnabled] = useState(false);
  const [rampConfig, setRampConfig] = useState<RampConfig>({ startBpm: 80, endBpm: 160, durationBars: 2, loop: false });
  const [rampProgress, setRampProgress] = useState<MetronomeState["rampProgress"]>(null);
  const [hapticsEnabled, setHapticsEnabled] = useState(false);

  const [practiceSeconds, setPracticeSeconds] = useState(0);
  const [toneStarted, setToneStarted] = useState(false);

  const synthRef = useRef<Tone.Synth | null>(null);
  const polySynthsRef = useRef<Tone.Synth[] | null>(null);
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
  const hapticsEnabledRef = useRef(hapticsEnabled);

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
  useEffect(() => { hapticsEnabledRef.current = hapticsEnabled; }, [hapticsEnabled]);

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
    if (polySynthsRef.current) {
      polySynthsRef.current.forEach((synth) => synth.dispose());
      polySynthsRef.current = null;
    }
    engineSoundRef.current = null;
  }, []);

  const silenceEngine = useCallback(() => {
    try {
      const players = samplePlayersRef.current as Tone.Players & { stopAll?: (time?: Tone.Unit.Time) => Tone.Players } | null;
      players?.stopAll?.(Tone.now());
    } catch {
      // Some browsers can throw while a sample is between scheduled and started.
    }
    try {
      synthRef.current?.triggerRelease(Tone.now());
    } catch {
      // ignore release errors during rapid transport toggles
    }
    try {
      polySynthsRef.current?.forEach((synth) => synth.triggerRelease(Tone.now()));
    } catch {
      // ignore release errors during rapid transport toggles
    }
    try {
      (Tone.Draw as { cancel?: (after?: number) => void }).cancel?.(0);
    } catch {
      // ignore draw cancellation differences between Tone builds
    }
  }, []);

  const ensureSoundEngine = useCallback(() => {
    const sound = beatSoundRef.current;
    if (engineSoundRef.current === sound && (synthRef.current || samplePlayersRef.current)) return;

    disposeEngine();

    const sampleSet = SAMPLE_SOUND_SETS[sound];
    if (sampleSet) {
      samplePlayersRef.current = new Tone.Players({
        urls: sampleSet.urls,
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

  const playClick = useCallback((time: number, freq: number, vol: number, role: ClickRole, beatNumber?: number, voiceToken?: string | null) => {
    if (vol === -Infinity) return;
    try {
      const players = samplePlayersRef.current;
      const sampleSet = SAMPLE_SOUND_SETS[beatSoundRef.current];
      const voiceKey = sampleSet?.beatNumbered && voiceToken && players?.has(voiceToken)
        ? voiceToken
        : sampleSet?.beatNumbered
        ? numberedVoiceKey(role, beatNumber, sampleSet.maxBeatNumber)
        : null;
      const sampleKey = voiceKey && players?.has(voiceKey)
        ? voiceKey
        : players?.has(role)
          ? role
          : "sub";

      if (players?.loaded && players.has(sampleKey)) {
        const player = players.player(sampleKey);
        player.playbackRate = sampleSet?.pitchResponsive === false ? 1 : samplePlaybackRate(pitchRef.current);
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

  const playPolyClick = useCallback((time: number, freq: number, vol: number, voiceIndex: number, downbeat: boolean) => {
    if (!polySynthsRef.current) {
      polySynthsRef.current = Array.from({ length: 4 }, (_, index) =>
        new Tone.Synth({
          oscillator: { type: index === 0 ? "triangle" : index === 1 ? "sine" : index === 2 ? "triangle" : "sine" },
          envelope: { attack: 0.0015, decay: 0.075, sustain: 0, release: 0.045 },
        }).toDestination(),
      );
    }
    const synth = polySynthsRef.current[voiceIndex % polySynthsRef.current.length];
    synth.triggerAttackRelease(freq, downbeat ? "32n" : "64n", time, Tone.dbToGain(vol));
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
      const beatDuration = beatDurationSeconds(bpmRef.current, ts.denominator);
      const poly = polyrhythmRef.current;
      const isPolyrhythmOnly = poly.enabled && !poly.polymeterEnabled;
      const isPolyrhythmCycle = isPolyrhythmOnly && beatIdx === 0;
      const jazzAssistActive = poly.jazzMode !== "off" && !poly.enabled && !poly.polymeterEnabled;

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
        const sampleSet = SAMPLE_SOUND_SETS[sound];
        const voiceToken = sampleSet?.beatNumbered ? voiceSubdivisionKey(pulses, p) : null;
        const voiceSubdivisionAllowed = !sampleSet?.beatNumbered || isFirstPulse || Boolean(voiceToken);
        const vol = sampleSet?.beatNumbered
          ? (isFirstPulse || voiceToken ? VOICE_ACCENT_VOLUME[accent] : -Infinity)
          : PULSE_ACCENT_VOLUME[accent];
        const role: ClickRole = isFirstPulse ? (accent === "accent" ? "accent" : "normal") : "sub";
        if (!muted && !jazzAssistActive && !poly.enabled && !poly.polymeterEnabled && voiceSubdivisionAllowed) playClick(time + offset, freq, vol, role, beatIdx + 1, voiceToken);
        if (!muted && !jazzAssistActive && !poly.enabled && !poly.polymeterEnabled && isFirstPulse && hapticsEnabledRef.current) {
          Tone.Draw.schedule(() => {
            void triggerMetronomeHaptic(accent);
          }, time + offset);
        }

        const pulseIndex = p;
        Tone.Draw.schedule(() => setCurrentPulse(pulseIndex), time + offset);
      }

      if (!isPolyrhythmOnly) Tone.Draw.schedule(() => setCurrentBeat(beatIdx), time);

      if (!muted && jazzAssistActive && beatIdx === 0) {
        jazzAssistEvents(poly.jazzMode, ts.numerator, beatDuration).forEach((event) => {
          const role: ClickRole = event.downbeat ? "normal" : "sub";
          const freq = event.downbeat ? freqs.normal : freqs.sub;
          const vol = event.downbeat ? PULSE_ACCENT_VOLUME.normal : Math.max(PULSE_ACCENT_VOLUME.ghost, -14);
          playClick(time + event.offset, freq, vol, role, event.beatNumber);
          if (hapticsEnabledRef.current && event.downbeat) {
            Tone.Draw.schedule(() => {
              void triggerMetronomeHaptic("normal");
            }, time + event.offset);
          }
        });
      }

      if (isPolyrhythmCycle) {
        const barDuration = beatDuration * ts.numerator;
        const cyclesPerBar = poly.rate === "pulse" ? 1 : 2;
        const cycleDuration = barDuration / cyclesPerBar;
        const voiceCounts = [poly.main, ...poly.voices].filter((count) => count >= 2).slice(0, 4);
        for (let cycle = 0; cycle < cyclesPerBar; cycle++) {
          const cycleOffset = cycle * cycleDuration;
          voiceCounts.forEach((count, voiceIndex) => {
            const polyStep = cycleDuration / count;
            for (let k = 0; k < count; k++) {
              const offset = cycleOffset + polyStep * k;
              const isPolyDownbeat = k === 0;
              if (!muted) {
                const polyFreq = [760, 560, 430, 330][voiceIndex] ?? 420;
                const polyVol = isPolyDownbeat ? -4 - voiceIndex * 1.5 : -11 - voiceIndex * 1.5;
                playPolyClick(time + offset, polyFreq, polyVol, voiceIndex, isPolyDownbeat);
              }
              if (voiceIndex === 0) {
                const mainIdx = k;
                Tone.Draw.schedule(() => setCurrentBeat(mainIdx), time + offset);
              }
              if (voiceIndex === 1) {
                const polyIdx = k;
                Tone.Draw.schedule(() => setCurrentPoly(polyIdx), time + offset);
              }
            }
          });
        }
      }

      if (!muted && beatIdx === 0) {
        const barDuration = beatDuration * ts.numerator;
        const dottedSpan = dottedBeatSpan(poly.dottedMode);
        if (dottedSpan) {
          const step = beatDuration * dottedSpan;
          const hitCount = Math.max(1, Math.floor((barDuration + 0.0001) / step));
          for (let k = 0; k < hitCount; k++) {
            playPolyClick(time + step * k, k === 0 ? 980 : 760, k === 0 ? -9 : -15, 2, k === 0);
          }
        }

        const tripletHits = tripletHitsPerBar(poly.tripletMode, ts.numerator, ts.denominator);
        if (tripletHits > 0) {
          const step = barDuration / tripletHits;
          for (let k = 0; k < tripletHits; k++) {
            const downbeat = k === 0;
            playPolyClick(time + step * k, downbeat ? 1420 : 1040, downbeat ? -9 : -16, 3, downbeat);
          }
        }
      }

      if (!muted && poly.polymeterEnabled) {
        const primaryBeatTicks = 16 / ts.denominator;
        const sixteenthDuration = 15 / bpmRef.current;
        const windowStartTicks = (barCountRef.current * ts.numerator + beatIdx) * primaryBeatTicks;
        const windowEndTicks = windowStartTicks + primaryBeatTicks;
        const polymeterSteps = poly.polymeterLanes.slice(0, 4);
        const firstTick = Math.ceil(windowStartTicks - 0.000001);
        for (let tick = firstTick; tick < windowEndTicks - 0.000001; tick++) {
          const step = polymeterStepAtTick(tick, polymeterSteps);
          if (!step) continue;

          const offset = (tick - windowStartTicks) * sixteenthDuration;
          const role: ClickRole = step.downbeat ? "accent" : "normal";
          const freq = step.downbeat ? freqs.accent : freqs.normal;
          const vol = step.downbeat ? PULSE_ACCENT_VOLUME.accent : PULSE_ACCENT_VOLUME.normal;
          playClick(time + offset, freq, vol, role, step.beatIndex + 1);
          if (hapticsEnabledRef.current) {
            Tone.Draw.schedule(() => {
              void triggerMetronomeHaptic(step.downbeat ? "accent" : "normal");
            }, time + offset);
          }
          Tone.Draw.schedule(() => {
            setCurrentPoly(step.laneIndex);
            setCurrentBeat(step.beatIndex);
            setCurrentPulse(0);
          }, time + offset);
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
  }, [playClick, playPolyClick]);

  const startRampCycle = useCallback(() => {
    const cfg = rampConfigRef.current;
    const transport = Tone.getTransport();
    const totalBeats = cfg.durationBars * timeSignatureRef.current.numerator;
    const beatDuration = beatDurationSeconds(cfg.startBpm, timeSignatureRef.current.denominator);
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

  const start = useCallback(async (options?: StartOptions) => {
    if (!toneStarted) {
      await Tone.start();
      setToneStarted(true);
    }
    ensureSoundEngine();
    if (samplePlayersRef.current) {
      await Tone.loaded();
    }
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
    const delaySeconds = clamp(options?.delaySeconds ?? 0.01, 0.01, 8);
    transport.start(`+${delaySeconds}`);
    setIsPlaying(true);
    setPracticeSeconds(0);

    practiceIntervalRef.current = window.setInterval(() => {
      setPracticeSeconds((s) => s + 1);
    }, 1000);

    if (rampEnabledRef.current) startRampCycle();
  }, [toneStarted, ensureSoundEngine, scheduleLoop, startRampCycle]);

  const stop = useCallback(() => {
    const transport = Tone.getTransport();
    setIsPlaying(false);
    transport.stop();
    transport.cancel(0);
    transport.position = 0;
    silenceEngine();
    scheduleIdRef.current = null;
    if (practiceIntervalRef.current) {
      clearInterval(practiceIntervalRef.current);
      practiceIntervalRef.current = null;
    }
    if (rampIntervalRef.current) {
      clearInterval(rampIntervalRef.current);
      rampIntervalRef.current = null;
    }
    setCurrentBeat(-1);
    setCurrentPulse(-1);
    setCurrentPoly(-1);
    setBarCount(0);
    setRampProgress(null);
    setTrainerPhase("playing");
  }, [silenceEngine]);

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
    transport.cancel(0);
    beatRef.current = 0;
    barCountRef.current = 0;
    transport.timeSignature = timeSignature.numerator;
    scheduleLoop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeSignature.numerator, timeSignature.denominator]);

  const polyrhythmSignature = JSON.stringify({
    enabled: polyrhythm.enabled,
    main: polyrhythm.main,
    voices: polyrhythm.voices,
    rate: polyrhythm.rate,
    dottedMode: polyrhythm.dottedMode,
    tripletMode: polyrhythm.tripletMode,
    jazzMode: polyrhythm.jazzMode,
    polymeterEnabled: polyrhythm.polymeterEnabled,
    polymeterLanes: polyrhythm.polymeterLanes,
  });

  useEffect(() => {
    if (!isPlaying) return;
    const transport = Tone.getTransport();
    silenceEngine();
    transport.stop();
    transport.cancel(0);
    transport.position = 0;
    beatRef.current = 0;
    barCountRef.current = 0;
    setCurrentBeat(-1);
    setCurrentPulse(-1);
    setCurrentPoly(-1);
    scheduleLoop();
    transport.start("+0.005");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [polyrhythmSignature]);

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
          Tone.getTransport().bpm.value = displayBpmToTransportBpm(tapBpm, timeSignatureRef.current.denominator);
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
      accents[pulseIndex] = cur === "normal" ? "accent" : "normal";
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
    if (cfg.jazzMode !== undefined && cfg.jazzMode !== "off") {
      setSwing((currentSwing) => (currentSwing > 0 ? currentSwing : 60));
    }
    setPolyrhythmState((prev) => {
      const next = { ...prev, ...cfg };
      if (cfg.dottedMode !== undefined && cfg.dottedMode !== "off") {
        next.tripletMode = "off";
        next.jazzMode = "off";
        next.enabled = false;
        next.polymeterEnabled = false;
      }
      if (cfg.tripletMode !== undefined && cfg.tripletMode !== "off") {
        next.dottedMode = "off";
        next.jazzMode = "off";
        next.enabled = false;
        next.polymeterEnabled = false;
      }
      if (cfg.jazzMode !== undefined && cfg.jazzMode !== "off") {
        next.dottedMode = "off";
        next.tripletMode = "off";
        next.enabled = false;
        next.polymeterEnabled = false;
      }
      if (cfg.against !== undefined && cfg.voices === undefined) {
        next.voices = [cfg.against, ...prev.voices.slice(1)].slice(0, 3);
      }
      if (cfg.voices !== undefined) {
        next.against = cfg.voices[0] ?? next.against;
      }
      return {
        ...next,
        main: clamp(Math.round(next.main || 3), 2, 16),
        voices: (next.voices.length > 0 ? next.voices : [next.against]).slice(0, 3).map((voice) => clamp(Math.round(voice), 2, 16)),
        dottedMode: DOTTED_PLAYBACK_LABELS[next.dottedMode] ? next.dottedMode : "off",
        tripletMode: TRIPLET_ASSIST_LABELS[next.tripletMode] ? next.tripletMode : "off",
        jazzMode: JAZZ_ASSIST_LABELS[next.jazzMode] ? next.jazzMode : "off",
        rate: (["double", "pulse"] as PolyrhythmRate[]).includes(next.rate) ? next.rate : "double",
        polymeterEnabled: Boolean(next.polymeterEnabled),
        polymeterLanes: (next.polymeterLanes?.length ? next.polymeterLanes : [
          { numerator: 4, denominator: 4 },
        ]).slice(0, 4).map((lane) => ({
          numerator: clamp(Math.round(lane.numerator || 4), 1, 16),
          denominator: normalizeMeterDenominator(lane.denominator),
        })),
      };
    });
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
      hapticsEnabled,
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
    setHapticsEnabled,
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
