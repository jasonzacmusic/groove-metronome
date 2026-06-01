import { useCallback, useEffect, useRef, useState } from "react";
import * as Tone from "tone";

import {
  accentForLevel,
  buildDefaultPattern,
  DOTTED_PLAYBACK_LABELS,
  getSubdivisionOptionsForBpm,
  JAZZ_ASSIST_LABELS,
  nextPulseStrengthAccent,
  nextPulseTapAccent,
  pitchToMultiplier,
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
  type SwingFeel,
  type TimeSignature,
  type TripletAssistMode,
} from "@/lib/metronome-types";
import { triggerMetronomeHaptic } from "@/lib/haptics";
import { clamp } from "@/lib/utils";

export interface RampConfig {
  startBpm: number;
  endBpm: number;
  durationBars: number;
  stepBpm: number;
  loop: boolean;
}

export interface TrainerConfig {
  phraseBars: number;
  mutePercent: number;
  randomness: number;
}

export interface MetronomeState {
  bpm: number;
  isPlaying: boolean;
  timeSignature: TimeSignature;
  beatSound: BeatSound;
  pitch: number;
  pattern: BeatPattern[];
  swing: number;
  swingFeel: SwingFeel;
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
  accentVolumes: Record<PulseAccent, number>;
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

type ToneContextWithRaw = Tone.Context & {
  rawContext?: AudioContext;
  _context?: AudioContext;
};

const POLYRHYTHM_VOICE_FREQS = [760, 560, 430, 330];
const POLYRHYTHM_VOICE_OSCILLATORS = ["triangle", "sine", "triangle", "sine"] as const;
const AUDIO_UNLOCK_TIMEOUT_MS = 160;
const SAMPLE_START_TIMEOUT_MS = 250;

function shortAudioWait() {
  return new Promise<void>((resolve) => window.setTimeout(resolve, AUDIO_UNLOCK_TIMEOUT_MS));
}

async function settleAudioUnlock(promise: Promise<unknown>) {
  await Promise.race([promise.then(() => undefined), shortAudioWait()]).catch(() => undefined);
}

function polyVoiceProfile(sound: BeatSound): { freqs: number[]; oscillators: Array<"sine" | "triangle" | "square">; gain: number } {
  if (sound === "sample-tabla") {
    return { freqs: [440, 540, 660, 780], oscillators: ["sine", "triangle", "sine", "triangle"], gain: -1 };
  }
  if (sound === "sample-shaker") {
    return { freqs: [2400, 1800, 1300, 950], oscillators: ["triangle", "triangle", "sine", "sine"], gain: -5 };
  }
  if (sound === "sample-clave" || sound === "sample-rim" || sound === "sample-ping") {
    return { freqs: [1180, 860, 650, 500], oscillators: ["triangle", "square", "triangle", "sine"], gain: -2 };
  }
  if (sound === "sample-marimba" || sound === "wood") {
    return { freqs: [720, 540, 410, 320], oscillators: ["triangle", "sine", "triangle", "sine"], gain: 0 };
  }
  if (sound === "voice-male" || sound === "voice-female") {
    return { freqs: [650, 490, 380, 300], oscillators: ["triangle", "sine", "triangle", "sine"], gain: -3 };
  }
  return { freqs: POLYRHYTHM_VOICE_FREQS, oscillators: [...POLYRHYTHM_VOICE_OSCILLATORS], gain: 0 };
}

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

function swingPulseOffset(beatDuration: number, pulses: number, pulseIndex: number, swing: number, feel: SwingFeel): number {
  if (swing === 0 || pulseIndex === 0) return 0;
  const amount = clamp(swing / 100, -1, 1);

  const canEighthSwing = pulses === 2 || pulses === 4;
  const eighthPulse = pulses / 2;
  if ((feel === "eighth" || (feel === "auto" && pulses === 2)) && canEighthSwing && pulseIndex === eighthPulse) {
    return amount * (beatDuration / 6);
  }

  const canSixteenthSwing = pulses >= 4 && pulses % 4 === 0;
  const sixteenthPulse = pulses / 4;
  const isOddSixteenth = canSixteenthSwing
    && pulseIndex % sixteenthPulse === 0
    && Math.floor(pulseIndex / sixteenthPulse) % 2 === 1;
  if ((feel === "sixteenth" || (feel === "auto" && canSixteenthSwing)) && isOddSixteenth) {
    return amount * (beatDuration / 12);
  }

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

function rawToneContext(): AudioContext | null {
  const context = Tone.getContext() as ToneContextWithRaw;
  return context.rawContext ?? context._context ?? null;
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
  const [bpm, setBpmState] = useState(100);
  const [isPlaying, setIsPlaying] = useState(false);
  const [timeSignature, setTimeSignature] = useState<TimeSignature>({ numerator: 4, denominator: 4 });
  const [currentBeat, setCurrentBeat] = useState(-1);
  const [currentPulse, setCurrentPulse] = useState(-1);
  const [beatSound, setBeatSound] = useState<BeatSound>("sample-marimba");
  const [pitch, setPitch] = useState(50);
  const [pattern, setPattern] = useState<BeatPattern[]>(() => buildDefaultPattern(4, 1));
  const [accentVolumes, setAccentVolumes] = useState<Record<PulseAccent, number>>({ ...PULSE_ACCENT_VOLUME });
  const [swing, setSwing] = useState(0);
  const [swingFeel, setSwingFeel] = useState<SwingFeel>("auto");
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
  const [trainerConfig, setTrainerConfig] = useState<TrainerConfig>({ phraseBars: 2, mutePercent: 50, randomness: 70 });
  const [trainerPhase, setTrainerPhase] = useState<"playing" | "muted">("playing");

  const [rampEnabled, setRampEnabled] = useState(false);
  const [rampConfig, setRampConfig] = useState<RampConfig>({ startBpm: 80, endBpm: 160, durationBars: 2, stepBpm: 5, loop: false });
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
  const accentVolumesRef = useRef(accentVolumes);
  const swingRef = useRef(swing);
  const swingFeelRef = useRef(swingFeel);
  const polyrhythmRef = useRef(polyrhythm);
  const beatSoundRef = useRef(beatSound);
  const pitchRef = useRef(pitch);
  const timeSignatureRef = useRef(timeSignature);
  const bpmRef = useRef(bpm);
  const isPlayingRef = useRef(isPlaying);
  const trainerEnabledRef = useRef(trainerEnabled);
  const trainerConfigRef = useRef(trainerConfig);
  const trainerPhraseRef = useRef({ index: -1, muted: false, mutedRun: 0, playRun: 0 });
  const rampEnabledRef = useRef(rampEnabled);
  const rampConfigRef = useRef(rampConfig);
  const hapticsEnabledRef = useRef(hapticsEnabled);
  const unlockedOnceRef = useRef(false);

  useEffect(() => { patternRef.current = pattern; }, [pattern]);
  useEffect(() => { accentVolumesRef.current = accentVolumes; }, [accentVolumes]);
  useEffect(() => { swingRef.current = swing; }, [swing]);
  useEffect(() => { swingFeelRef.current = swingFeel; }, [swingFeel]);
  useEffect(() => { polyrhythmRef.current = polyrhythm; }, [polyrhythm]);
  useEffect(() => { beatSoundRef.current = beatSound; }, [beatSound]);
  useEffect(() => { pitchRef.current = pitch; }, [pitch]);
  useEffect(() => { timeSignatureRef.current = timeSignature; }, [timeSignature]);
  useEffect(() => { bpmRef.current = bpm; }, [bpm]);
  useEffect(() => { isPlayingRef.current = isPlaying; }, [isPlaying]);
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

  const safariAudioUnlockPulse = useCallback(() => {
    if (typeof window === "undefined") return;
    const context = rawToneContext();
    if (!context || context.state === "closed") return;

    try {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      const now = context.currentTime;
      oscillator.type = "sine";
      oscillator.frequency.setValueAtTime(440, now);
      gain.gain.setValueAtTime(0.00001, now);
      oscillator.connect(gain);
      gain.connect(context.destination);
      oscillator.start(now);
      oscillator.stop(now + 0.025);
    } catch {
      // Safari can throw if it is still completing the user-gesture resume.
    }
  }, []);

  const unlockAudio = useCallback(async () => {
    await settleAudioUnlock(Tone.start());
    const context = rawToneContext();
    if (context && context.state !== "running") {
      await settleAudioUnlock(context.resume());
    }
    Tone.getContext().lookAhead = 0.02;
    safariAudioUnlockPulse();
    unlockedOnceRef.current = true;
    setToneStarted(true);
  }, [safariAudioUnlockPulse]);

  const ensureSoundEngine = useCallback(() => {
    const sound = beatSoundRef.current;
    if (engineSoundRef.current === sound && (synthRef.current || samplePlayersRef.current)) return;

    disposeEngine();

    const modeledSound: BeatSound = sound === "cowbell" ? "cowbell" : sound === "studio" ? "studio" : sound === "tone" ? "tone" : "wood";
    synthRef.current = new Tone.Synth({
      oscillator: { type: SOUND_OSCILLATORS[modeledSound] ?? "sine" },
      envelope: SOUND_ENVELOPES[modeledSound],
    }).toDestination();

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

    synthRef.current.triggerAttackRelease(1, "128n", Tone.now(), 0);
    engineSoundRef.current = sound;
  }, [disposeEngine]);

  const setBpm = useCallback((nextBpm: number | ((current: number) => number)) => {
    if (typeof nextBpm !== "function") {
      const safe = clamp(Math.round(nextBpm * 10) / 10, 20, 300);
      bpmRef.current = safe;
      if (isPlayingRef.current && !rampEnabledRef.current) {
        Tone.getTransport().bpm.value = displayBpmToTransportBpm(safe, timeSignatureRef.current.denominator);
      }
      setBpmState(safe);
      return;
    }
    setBpmState((previous) => {
      const raw = nextBpm(previous);
      const safe = clamp(Math.round(raw * 10) / 10, 20, 300);
      bpmRef.current = safe;
      if (isPlayingRef.current && !rampEnabledRef.current) {
        Tone.getTransport().bpm.value = displayBpmToTransportBpm(safe, timeSignatureRef.current.denominator);
      }
      return safe;
    });
  }, []);

  const playClick = useCallback((time: number, freq: number, vol: number, role: ClickRole, beatNumber?: number, voiceToken?: string | null) => {
    if (vol === -Infinity) return;
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
      try {
        const player = players.player(sampleKey);
        player.playbackRate = sampleSet?.pitchResponsive === false ? 1 : samplePlaybackRate(pitchRef.current);
        player.volume.setValueAtTime(vol, time);
        player.start(time);
        return;
      } catch {
        // Fall through to the modeled click. Safari can reject a decoded buffer
        // start while recovering from a suspended/interrupted audio context.
      }
    }

    try {
      if (!synthRef.current) return;
      synthRef.current.triggerAttackRelease(freq, "32n", time, Tone.dbToGain(vol));
    } catch {
      // ignore rapid trigger errors
    }
  }, []);

  const playPolyClick = useCallback((time: number, freq: number, vol: number, voiceIndex: number, downbeat: boolean) => {
    const profile = polyVoiceProfile(beatSoundRef.current);
    if (!polySynthsRef.current) {
      polySynthsRef.current = Array.from({ length: 4 }, (_, index) =>
        new Tone.Synth({
          oscillator: { type: profile.oscillators[index] ?? "sine" },
          envelope: { attack: 0.0015, decay: downbeat ? 0.09 : 0.065, sustain: 0, release: 0.045 },
        }).toDestination(),
      );
    }
    const synth = polySynthsRef.current[voiceIndex % polySynthsRef.current.length];
    synth.triggerAttackRelease(profile.freqs[voiceIndex] ?? freq, downbeat ? "32n" : "64n", time, Tone.dbToGain(vol + profile.gain));
  }, []);

  const scheduleLoop = useCallback(() => {
    const transport = Tone.getTransport();
    if (scheduleIdRef.current !== null) {
      transport.clear(scheduleIdRef.current);
      scheduleIdRef.current = null;
    }

    const id = transport.scheduleRepeat((time) => {
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
      const swingFeel = swingFeelRef.current;
      const beatPat = pat[beatIdx] ?? { pulses: 1 as SubdivisionCount, accents: ["normal" as PulseAccent] };
      const beatDuration = beatDurationSeconds(bpmRef.current, ts.denominator);
      const poly = polyrhythmRef.current;
      const isPolyrhythmOnly = poly.enabled && !poly.polymeterEnabled;
      const isPolyrhythmCycle = isPolyrhythmOnly && beatIdx === 0;
      const jazzAssistActive = poly.jazzMode !== "off" && !poly.enabled && !poly.polymeterEnabled;

      let muted = false;
      if (trainerEnabledRef.current) {
        const cfg = trainerConfigRef.current;
        const phraseBars = Math.max(1, Math.round(cfg.phraseBars));
        const beatsPerPhrase = Math.max(1, phraseBars * ts.numerator);
        const globalBeat = barCountRef.current * ts.numerator + beatIdx;
        const phraseIndex = Math.floor(globalBeat / beatsPerPhrase);

        if (phraseIndex !== trainerPhraseRef.current.index) {
          const baseChance = clamp(cfg.mutePercent / 100, 0, 1);
          const randomAmount = clamp(cfg.randomness / 100, 0, 1);
          const jitter = (Math.random() - 0.5) * 0.44 * randomAmount;
          let muteChance = clamp(baseChance + jitter, 0, 1);

          if (trainerPhraseRef.current.mutedRun >= 2) muteChance = Math.min(muteChance, 0.18);
          if (trainerPhraseRef.current.playRun >= 3 && baseChance > 0.05) muteChance = Math.max(muteChance, 0.72);

          const nextMuted = baseChance >= 1 ? true : baseChance <= 0 ? false : Math.random() < muteChance;
          trainerPhraseRef.current = {
            index: phraseIndex,
            muted: nextMuted,
            mutedRun: nextMuted ? trainerPhraseRef.current.mutedRun + 1 : 0,
            playRun: nextMuted ? 0 : trainerPhraseRef.current.playRun + 1,
          };
          Tone.Draw.schedule(() => setTrainerPhase(nextMuted ? "muted" : "playing"), time);
        }
        muted = trainerPhraseRef.current.muted;
      }

      const pulses = beatPat.pulses;
      for (let p = 0; p < pulses; p++) {
        const offset = (beatDuration / pulses) * p + swingPulseOffset(beatDuration, pulses, p, sw, swingFeel);
        const accent: PulseAccent = beatPat.accents[p] ?? "normal";
        const isFirstPulse = p === 0;
        const freq = isFirstPulse
          ? (accent === "accent" ? freqs.accent : freqs.normal)
          : freqs.sub;
        const sampleSet = SAMPLE_SOUND_SETS[sound];
        const voiceToken = sampleSet?.beatNumbered ? voiceSubdivisionKey(pulses, p) : null;
        const voiceSubdivisionAllowed = !sampleSet?.beatNumbered || isFirstPulse || Boolean(voiceToken);
        const accentVolume = accentVolumesRef.current[accent];
        const vol = sampleSet?.beatNumbered
          ? (isFirstPulse || voiceToken ? VOICE_ACCENT_VOLUME[accent] : -Infinity)
          : accentVolume;
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
          const vol = event.downbeat ? accentVolumesRef.current.normal : Math.max(accentVolumesRef.current.ghost, -14);
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
                const polyFreq = POLYRHYTHM_VOICE_FREQS[voiceIndex] ?? 420;
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
          const vol = step.downbeat ? accentVolumesRef.current.accent : accentVolumesRef.current.normal;
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

        if (rampEnabledRef.current) {
          const cfg = rampConfigRef.current;
          const barsPerStep = Math.max(1, Math.round(cfg.durationBars));
          const barInStep = ((bc - 1) % barsPerStep) + 1;
          let nextBpm = bpmRef.current;
          let shouldFinish = false;

          if (barInStep === barsPerStep) {
            const direction = cfg.endBpm >= cfg.startBpm ? 1 : -1;
            const step = Math.max(0.1, Math.abs(cfg.stepBpm || 1));
            const reachedTarget = direction > 0 ? nextBpm >= cfg.endBpm : nextBpm <= cfg.endBpm;

            if (reachedTarget) {
              if (cfg.loop) {
                nextBpm = cfg.startBpm;
              } else {
                shouldFinish = true;
              }
            } else {
              nextBpm = direction > 0
                ? Math.min(cfg.endBpm, nextBpm + step)
                : Math.max(cfg.endBpm, nextBpm - step);
              shouldFinish = nextBpm === cfg.endBpm && !cfg.loop;
            }

            if (!shouldFinish || nextBpm !== bpmRef.current) {
              bpmRef.current = nextBpm;
              Tone.getTransport().bpm.value = displayBpmToTransportBpm(nextBpm, ts.denominator);
            }
          }

          const progressBar = shouldFinish ? barsPerStep : barInStep;
          const currentRampBpm = nextBpm;
          Tone.Draw.schedule(() => {
            setBpmState(currentRampBpm);
            setRampProgress({ bar: progressBar, currentBpm: Math.round(currentRampBpm * 10) / 10 });
            if (shouldFinish) setRampEnabled(false);
          }, time);
        }
      }
    }, `${timeSignatureRef.current.denominator}n`);

    scheduleIdRef.current = id;
  }, [playClick, playPolyClick]);

  const startRampCycle = useCallback(() => {
    const cfg = rampConfigRef.current;
    const transport = Tone.getTransport();
    if (rampIntervalRef.current) {
      clearInterval(rampIntervalRef.current);
      rampIntervalRef.current = null;
    }
    transport.bpm.value = displayBpmToTransportBpm(cfg.startBpm, timeSignatureRef.current.denominator);
    bpmRef.current = cfg.startBpm;
    setBpm(cfg.startBpm);
    setRampProgress({ bar: 0, currentBpm: cfg.startBpm });
  }, []);

  const start = useCallback(async (options?: StartOptions) => {
    await unlockAudio();
    ensureSoundEngine();
    if (samplePlayersRef.current) {
      await Promise.race([
        Tone.loaded(),
        new Promise<void>((resolve) => window.setTimeout(resolve, SAMPLE_START_TIMEOUT_MS)),
      ]);
    }
    void unlockAudio();
    beatRef.current = 0;
    barCountRef.current = 0;
    trainerPhraseRef.current = { index: -1, muted: false, mutedRun: 0, playRun: 0 };
    setCurrentBeat(-1);
    setCurrentPulse(-1);

    const transport = Tone.getTransport();
    transport.bpm.value = displayBpmToTransportBpm(bpmRef.current, timeSignatureRef.current.denominator);
    transport.timeSignature = timeSignatureRef.current.numerator;
    transport.cancel();
    transport.position = 0;

    scheduleLoop();
    Tone.getContext().lookAhead = 0.02;
    const delaySeconds = clamp(options?.delaySeconds ?? 0.01, 0.01, 8);
    transport.start(`+${delaySeconds}`);
    isPlayingRef.current = true;
    setIsPlaying(true);
    setPracticeSeconds(0);

    practiceIntervalRef.current = window.setInterval(() => {
      setPracticeSeconds((s) => s + 1);
    }, 1000);

    if (rampEnabledRef.current) startRampCycle();
  }, [unlockAudio, ensureSoundEngine, scheduleLoop, startRampCycle]);

  const stop = useCallback(() => {
    const transport = Tone.getTransport();
    isPlayingRef.current = false;
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
    trainerPhraseRef.current = { index: -1, muted: false, mutedRun: 0, playRun: 0 };
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

  // Keep the master clock running while meter edits change what gets played.
  useEffect(() => {
    if (!isPlaying) return;
    const transport = Tone.getTransport();
    const safeNumerator = Math.max(1, timeSignature.numerator);
    beatRef.current = beatRef.current % safeNumerator;
    setCurrentBeat((beat) => (beat >= 0 ? beat % safeNumerator : beat));
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
    const safeNumerator = Math.max(1, timeSignatureRef.current.numerator);
    const beat = beatRef.current % safeNumerator;
    setCurrentBeat((current) => (current >= 0 ? current % safeNumerator : beat));
    setCurrentPulse((current) => (current >= 0 ? current : 0));
    setCurrentPoly((current) => (current >= 0 ? current : 0));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [polyrhythmSignature]);

  useEffect(() => {
    if (isPlaying || toneStarted) ensureSoundEngine();
  }, [beatSound, isPlaying, toneStarted, ensureSoundEngine]);

  // Pre-init Tone on first user gesture
  useEffect(() => {
    const init = () => {
      if (!unlockedOnceRef.current) {
        void unlockAudio().then(() => {
          ensureSoundEngine();
        });
      }
      document.removeEventListener("pointerdown", init);
      document.removeEventListener("touchend", init);
      document.removeEventListener("click", init);
      document.removeEventListener("keydown", init);
    };
    document.addEventListener("pointerdown", init);
    document.addEventListener("touchend", init);
    document.addEventListener("click", init);
    document.addEventListener("keydown", init);
    return () => {
      document.removeEventListener("pointerdown", init);
      document.removeEventListener("touchend", init);
      document.removeEventListener("click", init);
      document.removeEventListener("keydown", init);
    };
  }, [unlockAudio, ensureSoundEngine]);

  useEffect(() => {
    const resumeIfPlaying = () => {
      if (!isPlayingRef.current || !unlockedOnceRef.current) return;
      void unlockAudio();
    };
    const handleVisibility = () => {
      if (document.visibilityState === "visible") resumeIfPlaying();
    };
    document.addEventListener("visibilitychange", handleVisibility);
    window.addEventListener("pageshow", resumeIfPlaying);
    window.addEventListener("focus", resumeIfPlaying);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("pageshow", resumeIfPlaying);
      window.removeEventListener("focus", resumeIfPlaying);
    };
  }, [unlockAudio]);

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

    if (!unlockedOnceRef.current) {
      void unlockAudio().then(() => { ensureSoundEngine(); });
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

  const setAccentVolume = useCallback((accent: Exclude<PulseAccent, "mute">, volume: number) => {
    setAccentVolumes((prev) => ({
      ...prev,
      [accent]: clamp(Math.round(volume), -30, 0),
      mute: -Infinity,
    }));
  }, []);

  const setBeatSubdivision = useCallback((beatIndex: number, pulses: SubdivisionCount) => {
    setPattern((prev) => {
      if (beatIndex < 0 || beatIndex >= prev.length) return prev;
      const next = [...prev];
      next[beatIndex] = withSubdivision(prev[beatIndex], pulses);
      return next;
    });
  }, []);

  const toggleBeatEnabled = useCallback((beatIndex: number) => {
    setPattern((prev) => {
      if (beatIndex < 0 || beatIndex >= prev.length) return prev;
      const beat = prev[beatIndex];
      const isMuted = beat.accents.every((accent) => accent === "mute");
      const next = [...prev];
      next[beatIndex] = {
        ...beat,
        accents: Array.from({ length: beat.pulses }, (_, pulseIndex) => {
          if (!isMuted) return "mute" as PulseAccent;
          return pulseIndex === 0 ? "normal" as PulseAccent : "ghost" as PulseAccent;
        }),
      };
      return next;
    });
  }, []);

  const cycleBeatSubdivision = useCallback((beatIndex: number) => {
    setPattern((prev) => {
      if (beatIndex < 0 || beatIndex >= prev.length) return prev;
      const next = [...prev];
      const cur = prev[beatIndex];
      const options = getSubdivisionOptionsForBpm(bpm);
      const currentIndex = options.indexOf(cur.pulses);
      const nextPulses = options[(currentIndex + 1) % options.length] ?? options[0] ?? 1;
      next[beatIndex] = withSubdivision(cur, nextPulses);
      return next;
    });
  }, [bpm]);

  const cyclePulse = useCallback((beatIndex: number, pulseIndex: number) => {
    setPattern((prev) => {
      if (beatIndex < 0 || beatIndex >= prev.length) return prev;
      const beat = prev[beatIndex];
      if (pulseIndex < 0 || pulseIndex >= beat.accents.length) return prev;
      const accents = [...beat.accents];
      accents[pulseIndex] = nextPulseTapAccent(accents[pulseIndex]);
      const next = [...prev];
      next[beatIndex] = { ...beat, accents };
      return next;
    });
  }, []);

  const cyclePulseStrength = useCallback((beatIndex: number, pulseIndex: number) => {
    setPattern((prev) => {
      if (beatIndex < 0 || beatIndex >= prev.length) return prev;
      const beat = prev[beatIndex];
      if (pulseIndex < 0 || pulseIndex >= beat.accents.length) return prev;
      const accents = [...beat.accents];
      accents[pulseIndex] = nextPulseStrengthAccent(accents[pulseIndex]);
      const next = [...prev];
      next[beatIndex] = { ...beat, accents };
      return next;
    });
  }, []);

  const setPulseLevel = useCallback((beatIndex: number, pulseIndex: number, level: number) => {
    setPattern((prev) => {
      if (beatIndex < 0 || beatIndex >= prev.length) return prev;
      const beat = prev[beatIndex];
      if (pulseIndex < 0 || pulseIndex >= beat.accents.length) return prev;
      const accents = [...beat.accents];
      accents[pulseIndex] = accentForLevel(level);
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
      accents[pulseIndex] = nextPulseTapAccent(accents[pulseIndex]);
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
      swingFeel,
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
      accentVolumes,
    } as MetronomeState,
    setBpm,
    setTimeSignature,
    setBeatSound,
    setPitch,
    setPattern,
    setSwing,
    setSwingFeel,
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
    setAccentVolume,
    setBeatSubdivision,
    toggleBeatEnabled,
    cycleBeatSubdivision,
    cyclePulse,
    cyclePulseStrength,
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
