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

## Track Workflow

Yes: the intended workflow is to create a dedicated DAW track, insert Groove Metronome as a plugin, and let it follow the DAW's tempo, time signature, playhead, and transport.

Recommended default:

- Track name: `Groove Click`
- Plugin: Groove Metronome
- Follow host tempo: on
- Output gain: around -8 dB
- Sound: Marimba
- Subdivision: project-specific
- Route: main monitor, click bus, or a dedicated headphone/cue mix

This should replace the DAW metronome by giving the user a better-sounding, more controllable click that can be automated, bounced, muted, routed, and shared with the session.

## Rendering The Plugin As Audio

Important constraint: a plugin cannot reliably create tracks or start a bounce in every DAW. Hosts intentionally control track creation, rendering, freezing, and bounce operations.

So the cross-DAW solution is:

1. Groove Metronome outputs audio sample-accurately as a plugin.
2. The DAW records, freezes, bounces, or renders that plugin output.
3. We document one-click-ish workflows per DAW.

DAW workflows:

- Reaper: insert VST3 on `Groove Click`, then use `Render/freeze tracks > Render tracks to stereo stem tracks`.
- Logic Pro: insert AU, then use Bounce in Place or route to a bus and record to an audio track.
- Ableton Live: route plugin output to a second audio track and record, or freeze/flatten where supported.
- Cubase: use Render In Place.
- Studio One: use Transform To Audio or bounce the event/track.
- Pro Tools: later AAX build, then commit/freeze/record to audio track.

## DAW-Only Feature Ideas

These features make sense inside DAWs and do not need to clutter the web/mobile app:

- Print Click: prepare a click for selected bars or whole arrangement.
- Count-In Only: play 1, 2, 4, or 8 bars, then stop.
- Marker-Aware Click: different click sound/pattern per song section.
- Cue Mix Outputs: accent and subdivision layers on separate outputs.
- Click Sidechain: a clean click bus that can trigger compressors or visual meters.
- MIDI Trigger Mode: output MIDI notes for users who want their own drum rack/click sampler.
- Voice Count-In Track: render spoken counts only at markers or section starts.
- Tempo Map Follow: lock to tempo automation and meter changes.
- Humanize Micro-Feel: tiny controlled timing/velocity variation for practice references, disabled by default.
- Session Notes Preset: save the click setup inside the DAW session and export a `.groove-click` preset.
