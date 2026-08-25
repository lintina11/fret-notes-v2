# Audio Playback — Design
Date: 2026-08-19

## Overview

Add sound to the tool. Every note the user selects plays back immediately, and
a play button strums/plays the whole detected chord. Timbres differ per
instrument: the guitar page sounds like a plucked string, the piano page like a
struck string. Pure Web Audio synthesis — no audio assets, static deploy stays
asset-free.

- **Primary users:** same as the base tool — guitarists, basic-to-intermediate theory
- **Decisions locked in:** Web Audio synthesis · point-and-play + play-chord button · two timbres · guitar strum / piano block

---

## Architecture

Two layers, mirroring the existing `core/` vs `app/composables/` split.

### `core/audio/` — pure, Node-testable (no DOM, no Web Audio)

- **`synth.ts`**
  - `midiToFrequency(midi)` → equal-tempered Hz (A4 = 440).
  - `chordSchedule(midis, instrument)` → notes sorted low→high, each with a
    start `delay` (seconds). Guitar staggers by `GUITAR_STRUM_STEP` (down-strum);
    piano uses delay 0 (block). De-dupes MIDI values.
- **`instruments.ts`**
  - `VOICES: Record<Instrument, Voice>` — timbre as plain data (oscillator
    layers, ADSR, lowpass sweep, duration, optional `attackNoise`). The node
    graph reads these numbers; the config lives here so timbre is centralised
    and reviewable.
  - Guitar: triangle body + a touch of sawtooth for edge, tuned exactly (no
    detune, to keep pitch clean), gentle lowpass, long-ish ring. Chosen over a
    raw saw to kill the buzzy/harsh character.
  - Piano: sine fundamental + triangle body + an octave-up sine for brilliance
    (宏亮), a bright lowpass, long ring, plus an `attackNoise` knock — a short
    band-passed noise burst at onset for the hammer's 咚/扣.

### `app/composables/useAudio.ts` — Web Audio side effects (singleton)

- Lazy `AudioContext`, created/resumed on the first playback (always inside a
  click/tap gesture, satisfying browser autoplay policy). SSR-safe: every path
  guards `typeof window`.
- `playNote(midi, instrument)` — one voice at `ctx.currentTime`.
- `playChord(midis, instrument)` — schedules voices via `chordSchedule`.
- `enabled` ref (default on) + `toggleEnabled()`, persisted to
  `localStorage['fret-notes:sound-enabled']`. The stored value is applied by
  `hydrateAudioPreference()` **after mount** (called from `app.vue` `onMounted`)
  to avoid a hydration mismatch on the prerendered header icon.
- Signal chain ends in a shared master gain → `DynamicsCompressor` (soft
  limiter) → destination. The compressor tames the summed peaks of a strummed
  chord so it doesn't clip/distort (the guitar "爆料" fix).

Each voice = oscillator layers → per-layer mix gain → lowpass filter → ADSR amp
→ master. Envelopes use exponential ramps floored at a small epsilon (they can't
reach true zero). A voice with `attackNoise` also fires a short band-passed
white-noise burst (from a reused 200 ms buffer) straight to master, bypassing
the tonal lowpass so the knock stays audible.

---

## Wiring — where sound triggers

Single choke point per interaction, so components stay dumb:

| Trigger | Source | Call |
|---|---|---|
| Press a fret | `useFretboard.toggleFret` (on add only) | `playNote(OPEN_STRINGS[s] + fret, 'guitar')` |
| Press a piano key | `usePianoNoteMap.toggleNote` (on add only) | `playNote(midi, 'piano')` |
| ▶ play chord | `ChordResult` button | `playChord(midis, instrument)` |
| Sound on/off | header 🔊/🔇 | `toggleEnabled()` |

`ChordResult` gains optional `playMidis` + `instrument` props. Guitar page: both
omitted → falls back to `fb.selectedNotes` + `'guitar'`. Piano page: passes the
selected MIDIs + `'piano'`. Removing/muting a note is silent — only additions
sound.

---

## Non-goals (this phase)

- Sampled/realistic instruments (interface leaves room; not built).
- Velocity / dynamics, sustain pedal, reverb.
- Playback of muted-string handling nuance — point-and-play sounds the pressed
  fret's own pitch, which is the intended feedback.

## Tests

`tests/audio/synth.test.ts` covers `midiToFrequency` (A4 anchor, octave
doubling, middle C) and `chordSchedule` (sort, piano block, guitar stagger,
de-dupe, empty). Web Audio effects in `useAudio` are not unit-tested (no DOM in
the Node test env); verified manually in the running dev server.
