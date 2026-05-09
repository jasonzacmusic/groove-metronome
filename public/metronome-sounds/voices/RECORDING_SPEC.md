Human voice pack spec
=====================

For realistic voice mode, replace these WAV files with recorded or licensed
voice assets using the same names.

Required files per voice folder:

- `normal-1.wav` through `normal-16.wav`
- `accent-1.wav` through `accent-16.wav`
- `sub-and.wav`
- `sub-e.wav`
- `sub-a.wav`

Recording target:

- Mono WAV, 44.1 kHz, 16-bit PCM.
- Dry close-mic voice, no reverb or music bed.
- Short and clear, but not clipped: leave a natural consonant tail.
- Best length for 80-130 BPM is roughly 180-300 ms for numbers and 100-180 ms
  for subdivision syllables.
- Accent files should be slightly firmer, not shouted.

The app already schedules these files accurately. Better source recordings will
drop in without changing the playback code.
