# Groove Metronome DAW Plugin

## Goal

Build a lean plugin version of Groove Metronome for Logic, Reaper, Ableton, Cubase, Studio One, and Pro Tools.

The plugin should not clone the full web app. It should be a reliable studio click instrument that follows the DAW timeline and uses Groove's strongest assets: musical sound choices, subdivisions, accents, voice count-ins, and simple rhythm overlays.

## Format Targets

- AUv3 / Audio Unit for Logic and macOS hosts
- VST3 for Reaper, Ableton Live, Cubase, Studio One, and most modern DAWs
- AAX for Pro Tools after the VST3/AU version is stable

## Recommended Stack

Use JUCE as the plugin shell because it can build AU, VST3, and later AAX from one codebase. Keep the sound scheduling engine separate from the UI so it can reuse the same musical rules as the web/native app.

## Version 1.0 Plugin Scope

- Host tempo sync
- Host transport sync
- Bar/beat-aware click playback
- Accent grid
- Subdivision selector
- Swing
- Sound family selector: Marimba, Wood, Clave, Tabla, Shaker, Tight
- Voice count-in slot, once studio-recorded male/female samples are ready
- Tap-free mode by default, because the DAW provides tempo
- Optional manual BPM override for standalone/plugin test use

## Defer From Plugin 1.0

- Analyzer
- Setlist Studio
- Polymeter composer
- Full notation
- Accounts, sharing, and practice history

## Audio Rules

- Default sound: Marimba
- Secondary sound: Wood
- Third sound: Clave
- All samples should be normalized to a consistent perceived loudness before packaging.
- Subdivision and assist sounds should stay inside the same instrument family whenever possible.
- The plugin must avoid sharp/jarring transients at high monitor levels.

## Build Order

1. Create JUCE plugin shell.
2. Port the shared rhythm model: time signature, beat pattern, accents, subdivisions.
3. Add DAW host tempo and position sync.
4. Load normalized WAV sample families.
5. Add compact plugin UI.
6. Test AU in Logic and VST3 in Reaper.
7. Only after AU/VST3 are stable, start AAX packaging.
