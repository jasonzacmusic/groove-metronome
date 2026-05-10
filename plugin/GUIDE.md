# Groove Metronome Plugin Guide

Groove Metronome is the DAW version of the Nathaniel School of Music metronome: the same musical click language, the same core sound families, and the same goal as the web app - see it, count it, lock it in.

## What You Get

- AU for Logic Pro and other macOS Audio Unit hosts
- VST3 for Reaper, Ableton Live, Cubase, Studio One, FL Studio, Bitwig, and most modern DAWs
- A matching Vintage Graphite plugin interface
- Host tempo and transport sync
- Manual BPM override for testing or non-tempo-grid work
- Marimba, Wood, Clave, Tabla, Shaker, and Tight click families embedded inside the plugin
- Beat Map, Levels, Polyrhythm, and Polymeter sections in the interface for the full Groove workflow
- Print buttons reserved for the DAW companion workflow: current track or new track

## Install On Mac

1. Quit your DAW.
2. Open `Install Groove Metronome.command`.
3. If macOS blocks it, right-click the file and choose `Open`.
4. Reopen your DAW and rescan plugins if needed.

The installer copies:

- AU: `~/Library/Audio/Plug-Ins/Components/Groove Metronome.component`
- VST3: `~/Library/Audio/Plug-Ins/VST3/Groove Metronome.vst3`

Logic Pro uses the AU. Reaper and most other DAWs should use the VST3.

## Install On Windows

The Windows installer expects the Windows-built VST3 bundle in the `Windows` folder. A macOS build cannot produce the real Windows binary; the packaging step should add `Windows/Groove Metronome.vst3` from the Windows CI or Windows build machine before sale/download.

1. Quit your DAW.
2. Right-click `Install-Groove-Metronome-Windows.ps1`.
3. Choose `Run with PowerShell`.
4. Reopen your DAW and rescan plugins.

The installer copies the VST3 to:

`C:\Program Files\Common Files\VST3\Groove Metronome.vst3`

If Windows asks for administrator permission, approve it. If the installer cannot write to the system folder, it will tell you the exact path to copy manually.

## First Run

1. Create a track called `Groove Click`.
2. Insert `Groove Metronome`.
3. Keep `Follow Host Tempo` on.
4. Press play in your DAW.
5. Set the sound family, subdivision, swing, and accents.

Suggested first setup:

- Tempo: host tempo
- Sound: Marimba
- Accents: Downbeat
- Subdivision: Quarter
- Output: around -8 dB

## Logic Pro

Use:

`Audio FX > Audio Units > Nathaniel School of Music > Groove Metronome`

If it does not show up:

1. Open `Logic Pro > Settings > Plug-in Manager`.
2. Search `Groove Metronome`.
3. Rescan the plugin.
4. Restart Logic if needed.

To print the click as audio today, use Bounce in Place or route the plugin track to a bus and record that bus to an audio track.

## Reaper

Use:

`FX > VST3 > Nathaniel School of Music > Groove Metronome`

For a fast setup, run the included Reaper helper script in this repo:

```bash
/Applications/REAPER.app/Contents/MacOS/REAPER -nonewinst scripts/reaper-install-groove-click.lua
```

To print the click as audio today, use:

`Track > Render/freeze tracks > Render tracks to stereo stem tracks`

## Printing Click To Audio

The plugin will output audio like any instrument or effect. The DAW owns track creation and rendering, so a single plugin cannot safely create tracks in every host by itself.

The product design still keeps two print targets:

- `Print current track`
- `Print new track`

Implementation plan:

- Reaper: companion script can create the track or stem render directly.
- Logic Pro: companion workflow uses Bounce in Place, bus record, or a signed helper.
- Ableton/Cubase/Studio One: use each host's render/freeze/transform command.

This keeps the live plugin stable while giving each DAW the most natural print path.

## Troubleshooting

If you hear no click:

- Make sure the DAW transport is playing.
- Turn `Follow Host Tempo` off and set Manual BPM to test outside the DAW timeline.
- Check that the track is not muted and its output is routed to your speakers/headphones.
- Raise Output toward `-6 dB`.

If the plugin is missing:

- Quit the DAW and run the installer again.
- Rescan plugins in your DAW.
- On macOS, restart the Audio Unit scanner by restarting the computer or opening Logic's Plug-in Manager.

If macOS blocks the installer:

- Right-click the installer.
- Choose `Open`.
- Confirm once. macOS will remember it after that.

## Roadmap To Exact Web Parity

This DAW plugin now uses the same bundled Reapertips click families as the web app and a matching Vintage Graphite interface. The next parity pass is to move the shared web rhythm model into a reusable package so Beat Map, Levels, Polyrhythm, and Polymeter behave identically in browser, mobile, and DAW builds.
