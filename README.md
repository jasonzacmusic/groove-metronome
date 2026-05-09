# NSM Groove Metronome

A standalone, web-first metronome and rhythm/MIDI analyzer. Pro-Metronome–inspired UI with a circular tempo dial, beat-light tick ring, accent grid per beat, VexFlow rhythm notation, tempo ramp, mute trainer, practice timer, and an analyzer that detects tempo from audio loops or MIDI files (with explainability — confidence, alternatives, and per-window stability).

The app is purely client-side, so it can be hosted as a static site or wrapped with Capacitor for iOS/Android.

## Develop

```bash
pnpm install
pnpm dev      # http://localhost:5174
```

## Build & typecheck

```bash
pnpm typecheck
pnpm build    # output: dist/public/
```

## Deploy (Vercel)

This repo is linked to Vercel. Push `main` to deploy the public web app at
`metronome.nathanielschool.com`.

A health endpoint is exposed at `/api/healthz` for uptime monitors.

## Mobile (Capacitor)

Native iOS/iPadOS and Android shells are committed through Capacitor. The iOS
project also includes a native watchOS companion target.

```bash
pnpm build
npx cap sync
```

Open iOS/iPad/watch work in Xcode:

```bash
npx cap open ios
```

Build Android locally:

```bash
cd android
./gradlew assembleDebug
```

## Project layout

```
src/
  hooks/useMetronome.ts          # Tone.js engine, accents, swing, ramp, trainer
  lib/
    metronome-types.ts           # Shared types + presets
    audio-tempo.ts               # Spectral-flux + autocorrelation tempo detection
    midi-analyzer.ts             # @tonejs/midi parsing + Krumhansl–Schmuckler key estimate
    utils.ts                     # cn(), clamp(), formatTime(), getTempoMarking()
  components/
    metronome/                   # BPMDial, AccentGrid, TransportButton, NotationPanel
    analyzer/                    # ImportZone, AudioAnalysisCard, MidiAnalysisCard
    ui/                          # Radix-based primitives (button, slider, select, …)
  pages/
    MetronomePage.tsx
    AnalyzerPage.tsx
api/
  healthz.ts                     # Serverless uptime endpoint
```

## Keyboard shortcuts

| Key | Action |
| --- | --- |
| Space | Play / stop |
| T | Tap tempo |
| ↑ / ↓ | BPM ±1 |
| [ / ] | BPM ±5 |
