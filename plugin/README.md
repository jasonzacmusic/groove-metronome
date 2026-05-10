# Groove Metronome Plugin

This is the DAW-plugin build of Groove Metronome. The goal is web-app parity: the same visual language, the same Reapertips click families, and the same Beat Map, Levels, Polyrhythm, and Polymeter workflow, adapted for DAW tempo sync and rendering.

The current build replaces the generic JUCE editor with a branded Vintage Graphite interface and embeds the same click sample families used by the web app. Full rhythm-model parity is being moved in stages so the browser, mobile, and DAW builds stay consistent instead of drifting.

## Current Formats

- AU for Logic and macOS AU hosts
- VST3 for Reaper, Ableton Live, Cubase, Studio One, and most modern DAWs
- Standalone for quick engine testing

AAX is not part of this first scaffold because it requires the Avid AAX SDK and separate signing/distribution work.

## Installer / Buyer Package

Use the guide and installer scripts in this folder:

- `GUIDE.md`
- `installers/install-mac.command`
- `installers/install-windows.ps1`

Recommended download layout:

```text
Groove Metronome Plugin/
  GUIDE.md
  Install Groove Metronome.command
  Install-Groove-Metronome-Windows.ps1
  Mac/
    Groove Metronome.component
    Groove Metronome.vst3
  Windows/
    Groove Metronome.vst3
```

## Build

Requirements:

- Xcode command-line tools
- CMake 3.22+
- Internet access for the first configure step, because CMake fetches JUCE 8.0.12

```bash
cd plugin
cmake -S . -B build -G Xcode
cmake --build build --config Release
```

The CMake project uses `COPY_PLUGIN_AFTER_BUILD`, so successful AU/VST3 builds should be copied to the standard local plugin folders by JUCE.

## DAW Usage Model

Create one track named `Groove Click`, insert the Groove Metronome plugin, and let it follow the DAW tempo and transport.

Recommended track setup:

- Track type: audio track or instrument track, depending on DAW host behavior
- Plugin mode: Follow Host Tempo on
- Output: route to main monitoring or a click bus
- Gain: start at -8 dB
- Sound: Marimba first, Wood or Clave for denser sessions

## Local Install Notes

The Release build copies AU and VST3 bundles to the current user's standard plugin folders:

- `~/Library/Audio/Plug-Ins/Components/Groove Metronome.component`
- `~/Library/Audio/Plug-Ins/VST3/Groove Metronome.vst3`

Logic uses the AU. Reaper should use the VST3. If Reaper only scans system VST3 paths, copy the VST3 bundle to `/Library/Audio/Plug-Ins/VST3/Groove Metronome.vst3` or add `~/Library/Audio/Plug-Ins/VST3` to Reaper's VST paths, then run a VST re-scan.

For Reaper on this Mac, run the installer script to create a ready-made VST3 click track and track template:

```bash
/Applications/REAPER.app/Contents/MacOS/REAPER -nonewinst scripts/reaper-install-groove-click.lua
```

The script intentionally refuses to fall back to the AU, so the template remains a normal Reaper VST3 setup. It saves:

- `~/Library/Application Support/REAPER/TrackTemplates/Groove Click - Groove Metronome.RTrackTemplate`

For Logic Pro, the AU component is the correct install target. Validate it with:

```bash
auval -v aufx Gmtr Nsmg
```

Logic should list it under Audio FX > Audio Units > Nathaniel School of Music > Groove Metronome after its Audio Unit scan.

## Rendering / Printing To Audio

Plugins cannot create new tracks or force a bounce in every DAW. The reliable cross-DAW standard is: the plugin outputs audio, and the host records, freezes, bounces, or renders that output.

The UI includes `Print current track` and `Print new track` as the product targets. The safe implementation path is host-specific companion workflows: Reaper scripts, Logic bounce/bus workflows or helper automation, and each DAW's own render/freeze tools. This avoids fragile behavior on stage or in paid studio sessions.

### Reaper

1. Create a track named `Groove Click`.
2. Insert the VST3 plugin.
3. Set the project tempo/time signature.
4. Arm a second audio track if you want to record the click in real time, or use Reaper's render/freeze tools.
5. To print quickly, use `Track > Render/freeze tracks > Render tracks to stereo stem tracks`.

### Logic Pro

1. Create a software instrument or audio instrument-style track that can host the AU.
2. Insert Groove Metronome.
3. Set the project tempo/time signature.
4. Use Bounce in Place or route the click track to a bus and record it to a new audio track.
5. Keep the live plugin muted after printing if you only want the rendered click.

### Ableton Live

1. Create an audio track.
2. Insert the VST3 plugin if Live accepts it on an audio track.
3. Route the output to a second audio track.
4. Arm the second track and record, or freeze/flatten if supported by the host/plugin layout.

### Cubase / Studio One

1. Add an audio or instrument track that can host the VST3.
2. Insert Groove Metronome.
3. Use Render In Place / Transform To Audio to print the click.

## DAW-Only Features To Build Next

- Shared rhythm engine parity with the web app: Beat Map, Levels, Polyrhythm, and Polymeter
- Host-aware print buttons for current track and new track
- Print length selector: 4 bars, 8 bars, whole song region
- Count-in-only mode
- Click follows arrangement markers
- Separate accent/subdivision output channels
- Sidechain ducking-friendly click bus
- MIDI note trigger mode for custom click samples
- Human voice count-in loaded from studio-recorded packs
- Preset export/import for producers and teachers
- Session-safe panic mute
