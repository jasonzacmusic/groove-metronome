# Groove Metronome Plugin

This is the first DAW-plugin scaffold for Groove Metronome. It is intentionally lean: the plugin follows DAW transport and tempo, outputs a musical click, and can be printed/bounced like any other audio-generating plugin track.

## Current Formats

- AU for Logic and macOS AU hosts
- VST3 for Reaper, Ableton Live, Cubase, Studio One, and most modern DAWs
- Standalone for quick engine testing

AAX is not part of this first scaffold because it requires the Avid AAX SDK and separate signing/distribution work.

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

## Rendering / Printing To Audio

Plugins cannot create new tracks or force a bounce in every DAW. The reliable cross-DAW standard is: the plugin outputs audio, and the host records, freezes, bounces, or renders that output.

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

- Print length selector: 4 bars, 8 bars, whole song region
- Count-in-only mode
- Click follows arrangement markers
- Separate accent/subdivision output channels
- Sidechain ducking-friendly click bus
- MIDI note trigger mode for custom click samples
- Human voice count-in loaded from studio-recorded packs
- Preset export/import for producers and teachers
- Session-safe panic mute
