Curated metronome samples
=========================

This folder contains a small, app-ready selection from the local
`Reapertips - Metronome Sounds` pack, converted to mono 44.1 kHz 16-bit WAV
for reliable browser, iOS, and Android playback.

`voices/` contains male and female count-off samples for beats 1-16 plus
subdivision syllables for "and", "e", and "a". They are generated as mono
44.1 kHz WAV files with short natural tails, then scheduled as preloaded Web
Audio buffers rather than live speech. Voice subdivision playback is intended
for divisions of 2, 3, and 4; denser subdivisions fall back to the main beat
count so speech does not become cluttered.

The local Avid Click II resource folder was reviewed as a tonal reference, but
its proprietary plugin assets are not bundled or redistributed in this public
repo.
