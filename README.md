# @workspace/metronome

A standalone, web-first metronome and rhythm/MIDI analyzer. Pro-Metronome–inspired UI with a circular tempo dial, beat-light tick ring, accent grid per beat, VexFlow rhythm notation, tempo ramp, mute trainer, practice timer, and an analyzer that detects tempo from audio loops or MIDI files (with explainability — confidence, alternatives, and per-window stability).

The app is purely client-side, so it can be hosted as a static site or wrapped with Capacitor for iOS/Android.

## Develop

```bash
pnpm install                                # once, from repo root
pnpm --filter @workspace/metronome dev      # http://localhost:5174
```

## Build & typecheck

```bash
pnpm --filter @workspace/metronome typecheck
pnpm --filter @workspace/metronome build    # output: dist/public/
```

## Deploy (Vercel)

This artifact ships its own `vercel.json`. Create a new Vercel project and set:

- **Root Directory**: `artifacts/metronome`
- **Framework Preset**: Other (the `vercel.json` here defines the build commands)
- **Production branch**: whichever branch you ship from

Add the custom domain in the Vercel project's Domains tab, then create a `CNAME` record at your DNS provider pointing the subdomain to `cname.vercel-dns.com`.

A health endpoint is exposed at `/api/healthz` for uptime monitors.

## Mobile (Capacitor)

`capacitor.config.ts` is included. To add native shells:

```bash
cd artifacts/metronome
pnpm add -D @capacitor/cli
pnpm add @capacitor/core @capacitor/ios @capacitor/android
pnpm build
npx cap add ios
npx cap add android
npx cap sync
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
