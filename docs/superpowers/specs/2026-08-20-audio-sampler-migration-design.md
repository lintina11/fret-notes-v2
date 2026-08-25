# Audio — Sampler Migration Design
Date: 2026-08-20

**Supersedes the synthesis approach** in `2026-08-19-audio-playback-design.md`.
The Web Audio oscillator synthesis (VOICES, ADSR, compressor, attack-noise) is
replaced by real sampled instruments via Tone.js `Tone.Sampler`. The wiring
(single trigger points, ▶ button, mute toggle) is unchanged; only the sound
engine and its loading/asset story change.

## Why

Oscillator synthesis has a realism ceiling — it always reads as "synthy". The
user wants realistic guitar and piano. Sampled instruments are the fix.

## Locked-in decisions (from grilling, 2026-08-20)

1. **Scope:** replace **both** instruments with samples; remove all synthesis code.
2. **Source:** `tonejs-instruments` sample packs, **CC-BY 3.0** → commercial use OK **with attribution**.
3. **Hosting:** **self-host** the chosen sample files under `public/` (keeps the static deploy self-contained; no external CDN dependency).
4. **Instruments:** guitar = **acoustic** (University of Iowa); piano = **VSCO2** (Versilian).
5. **Sample density:** **sparse subset** (~minor-third grid); `Tone.Sampler` repitches to fill the gaps. Smaller payload, negligible artifacts within a minor third.
6. **Format:** **mp3 only** (universal, incl. Safari; ogg/wav dropped).
7. **Preload:** on entering a page, preload **that page's** instrument, **always** (not gated on the mute toggle) — simpler.
8. **No fallback:** if offline / a sample fails to load, the product simply has **no sound**. No synth fallback, no retry engine.
9. **Ring:** single notes **ring their natural sample decay** (supersedes the old 1.5× synth tweak).
10. **Loading UI:** until the current page's instrument is ready, the header 🔊 button is **semi-transparent and not clickable**; it lights up when ready.
11. **Credit:** a **minimal site footer** line attributing the sample sources (CC-BY compliance).

---

## Architecture

### Dependency

- Add `tone` to `package.json`. Tone touches `window`/`AudioContext`, so it is
  **imported client-only** — a dynamic `await import('tone')` inside `useAudio`,
  never at module top level (SSR/prerender would `ReferenceError`).

### Assets

- `public/samples/guitar-acoustic/*.mp3` and `public/samples/piano/*.mp3`.
- Sparse minor-third grid across the app's needed range (guitar ~E2, piano note
  map up to C6/MIDI 84). Representative guitar anchors: `D2 F2 Gs2 B2 D3 F3 Gs3
  B3 D4 F4 Gs4 B4 D5` (pack covers D2–D5; Tone repitches out to E2…C6). Piano: a
  similar grid across ~C2–C6. **Final note list is validated against the pack's
  available files during implementation.**

### `core/audio/` — pure, testable (unchanged + one new data file)

- `synth.ts` **stays**: `midiToFrequency` (fed to `triggerAttack`) and
  `chordSchedule` (still drives the guitar strum stagger / piano block).
- **`instruments.ts` is deleted** (VOICES/AttackNoise no longer exist).
- **New `sample-map.ts`** — pure data: per instrument, the `baseUrl` and the
  `{ noteName: fileName }` map handed to `Tone.Sampler`. Testable (assert the
  map is non-empty and note names are well-formed).

### `app/composables/useAudio.ts` — rewritten over Tone.Sampler

State (singleton):
- `enabled` ref + `toggleEnabled()` + `hydrateAudioPreference()` — **unchanged**, still localStorage-persisted.
- `ready: Record<Instrument, boolean>` — reactive, flips true on each sampler's `onload`.
- `activeInstrument` ref — the current page sets it; the header reads
  `ready[activeInstrument]` to drive the loading state.

Behaviour:
- `preload(instrument)` — idempotent: client-only `import('tone')`, build a
  `Tone.Sampler` from `sample-map`, set `ready` on load. Called from each page's
  `onMounted` for its own instrument.
- `playNote(midi, instrument)` — no-op unless `enabled` and the sampler is
  ready; else `Tone.start()` (first gesture) then `sampler.triggerAttack(midiToFrequency(midi))`.
- `playChord(midis, instrument)` — `chordSchedule` → `triggerAttack` at
  `now + delay` per note (guitar strum / piano block). Notes ring naturally.
- Removed: `playVoice`, oscillator graph, `DynamicsCompressor`, noise buffer,
  `MASTER_GAIN` (Tone manages output; a per-sampler `volume` handles balance).

### Wiring — unchanged trigger points

`useFretboard.toggleFret` → `playNote(..,'guitar')`; `usePianoNoteMap.toggleNote`
→ `playNote(..,'piano')`; `ChordResult` ▶ → `playChord`. Each page sets
`activeInstrument` and calls `preload` for its instrument on mount.

### `app.vue`

- Header 🔊 button: add `disabled` + a `is-loading` class (semi-transparent,
  `pointer-events:none`) bound to `!ready[activeInstrument]`.
- Add a minimal **footer**: e.g. "音色取樣：Acoustic Guitar — University of Iowa
  Electronic Music Studios · Piano — Versilian Studios (VSCO2) · CC-BY 3.0"
  (final wording + links in implementation).

---

## Files touched

- `package.json` — add `tone`.
- `public/samples/**` — new mp3 assets.
- `core/audio/sample-map.ts` — new; `core/audio/instruments.ts` — deleted.
- `core/audio/synth.ts` — unchanged.
- `app/composables/useAudio.ts` — rewritten.
- `app/app.vue` — loading state on 🔊 + footer credit.
- Pages set `activeInstrument` / call `preload` on mount.
- `tests/audio/synth.test.ts` stays; add `sample-map` sanity test.

## Non-goals

- Instrument switching UI (acoustic/electric/nylon picker).
- Velocity/dynamics, sustain pedal, reverb.
- Offline caching / service worker for samples.
- Retry/backoff on failed sample loads (no-sound is acceptable).

## Test strategy

Pure `core/audio` (`synth`, `sample-map`) unit-tested under Node. Tone.Sampler
loading/playback is browser-only and Web-Audio-bound — verified manually in the
running dev server (Node 22), not unit-tested.
