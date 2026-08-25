# Note-Map Page: Layout Swap + Chord Hint — Design Spec

Date: 2026-07-15

## Overview

Three adjustments to the existing `/piano-to-guitar` note-map page:

1. **Swap piano and guitar** so the piano (input) is on top and the guitar neck (output) is below.
2. **Default off-octave highlights to hidden** — only exact-pitch (solid) dots show by default; the user opts in to the faded same-note-name dots.
3. **Add a chord hint** — detect and display the chord formed by the selected piano notes, reusing the existing `ChordResult` component.

Capo support is explicitly **out of scope** for this spec (a future extension; see the final section).

This is an iteration on the feature delivered in `2026-07-14-piano-to-guitar-note-map-design.md`. It touches only the note-map page, the `usePianoNoteMap` composable, the shared `ChordResult` component (backward-compatibly), and one narrowing of a `detectChord` parameter type.

---

## Scope

### In scope
- Reorder the `/piano-to-guitar` page to: piano → chord hint → guitar neck → controls.
- Change `usePianoNoteMap`'s `showOffOctave` default to `false`; flip the control to an opt-in "show" toggle.
- Detect the chord from the selected piano notes and render it via `ChordResult`.
- Generalize `ChordResult` with optional props so it works on both pages without changing the guitar page.
- Narrow `detectChord`'s parameter type to the fields it actually uses.

### Out of scope
- Capo on this page (future extension).
- Any change to the guitar (`/guitar-to-piano`) page's behavior or appearance.
- Changes to `GuitarNeck`, `PianoKeyboard`, the palette tokens, or the core neck/note-map position logic.

---

## 1. Layout swap + chord hint placement

`app/pages/piano-to-guitar.vue` top-to-bottom order becomes:

```
┌───────────────────────────────────────────┐
│  header: fret notes   [從吉他][從鋼琴]  🌙 │
├───────────────────────────────────────────┤
│  PianoKeyboard (E2–C6, clickable, scales)  │
├───────────────────────────────────────────┤
│  ChordResult (chord from selected notes)   │
├───────────────────────────────────────────┤
│  GuitarNeck (horizontal, 6×20, scrolls →)  │
├───────────────────────────────────────────┤
│  controls: [顯示非同八度亮點]  n/6  [清除] │
└───────────────────────────────────────────┘
```

Reading order matches the mental model: play on the piano (input) → see the chord name → see where those notes live on the guitar (output) → controls. The piano and neck still scroll horizontally on narrow screens; `ChordResult` is a compact card between them.

---

## 2. Default off-octave to hidden

- `usePianoNoteMap`: `showOffOctave` ref default changes from `true` to **`false`**. With nothing shown for other octaves by default, the neck starts by highlighting only exact-pitch positions.
- The control flips from "hide" to "show":
  - Label: **顯示非同八度亮點**
  - Binding: `:checked="showOffOctave"`, `@change="showOffOctave = !showOffOctave"` (checked ⇒ `showOffOctave = true` ⇒ dim dots appear).

No change to `computeLitPositions` — it already gates dim positions on the `showOffOctave` argument.

---

## 3. Chord hint via reused `ChordResult`

### 3a. Chord source in the composable

`usePianoNoteMap` gains a `detectedChord` computed derived from the selected notes:

```ts
import { detectChord, type ChordResult } from '~~/core/music-theory/chord-detector'
import { midiToPitchClass } from '~~/core/music-theory/notes'

const detectedChord = computed<ChordResult | null>(() =>
  detectChord(
    [...selectedMidis.value.keys()].map(midi => ({
      midi,
      pitchClass: midiToPitchClass(midi),
    })),
  ),
)
```

Returned from `usePianoNoteMap()` alongside the existing values. `detectChord` already handles: fewer than 2 distinct pitch classes → `null` (empty state); slash chords via the lowest MIDI (the selected notes carry real octaves); unrecognized note sets → component-notes display.

### 3b. Narrow `detectChord`'s parameter type

`detectChord` currently takes `SelectedNote[]` but reads only `.midi` and `.pitchClass`. Narrow the parameter to exactly those fields:

```ts
export function detectChord(notes: { midi: number; pitchClass: number }[]): ChordResult | null
```

This is backward compatible: the guitar page's `SelectedNote[]` (which has `midi` and `pitchClass` plus extra fields) still satisfies the narrower type structurally, and the existing `chord-detector` tests still pass. It lets the note-map page pass `{ midi, pitchClass }` objects without fabricating `stringIndex`/`fret`/`noteName`. `SelectedNote` itself is unchanged.

### 3c. Generalize `ChordResult` with optional props (backward compatible)

Mirror the pattern used for `PianoKeyboard`: `ChordResult` gains optional props and falls back to `useFretboard()` when they are absent, so the guitar page (which passes no props) is unchanged.

```ts
import type { ChordResult } from '~~/core/music-theory/chord-detector'
const props = defineProps<{
  chord?: ChordResult | null       // undefined = fall back to useFretboard().detectedChord
  capoFret?: number                // undefined = fall back to useFretboard().capoFret
  emptyHint?: string               // undefined = default guitar-page hint
}>()

const fb = useFretboard()
const detectedChord = computed(() => props.chord !== undefined ? props.chord : fb.detectedChord.value)
const capoFret     = computed(() => props.capoFret ?? fb.capoFret.value)
const emptyHint    = computed(() => props.emptyHint ?? '點選指板上的格子來識別和弦')
```

- `undefined` (prop absent) means "use the fretboard fallback"; an explicit `null` is a valid "no chord" value. When props are provided, the fallback branches never read `fb.*`, so no reactive dependency on the guitar page's state is created.
- The empty-state text becomes `{{ emptyHint }}` instead of the hardcoded string.
- `shapeChord`/`shapeLabel` and the `形狀 · Capo` subtitle are **capo-only** (rendered under `v-if="capoFret > 0"`). The note-map page passes `capoFret = 0`, so that block never renders and `shapeChord` is never read — no need to add a `shapeChord` prop. `shapeLabel` continues to read `fb.shapeChord` but is only evaluated when `capoFret > 0`, which never happens on the note-map page.

### 3d. Wire it on the page

```vue
<ChordResult :chord="detectedChord" :capo-fret="0" empty-hint="點鋼琴鍵來識別和弦" />
```

---

## Files touched

| File | Change |
|------|--------|
| `app/pages/piano-to-guitar.vue` | Reorder to piano → ChordResult → neck → controls; add `<ChordResult>` wired to `detectedChord`; flip the toggle to "顯示非同八度亮點" |
| `app/composables/usePianoNoteMap.ts` | `showOffOctave` default `false`; add `detectedChord` computed; export it |
| `app/components/ChordResult/index.vue` | Optional props `chord` / `capoFret` / `emptyHint` with `useFretboard()` fallback; empty-state text from `emptyHint` |
| `core/music-theory/chord-detector.ts` | Narrow `detectChord` parameter type to `{ midi: number; pitchClass: number }[]` |
| `tests/music-theory/chord-detector.test.ts` | Add a case: detecting a chord from `{ midi, pitchClass }` objects (no string/fret) |

No changes to `GuitarNeck`, `PianoKeyboard`, `variables.css`, `neck.ts`, or `note-map.ts`.

---

## Testing

Core (`chord-detector.ts`), pure unit tests:
- Existing tests still pass after the parameter-type narrowing (guitar-style `SelectedNote[]` still accepted).
- New: `detectChord` with plain `{ midi, pitchClass }[]` (e.g. C major triad C4/E4/G4 → root C, symbol major) returns the correct chord — proves the note-map call site works and that no string/fret fields are needed.
- New: lowest-note slash behavior from `{ midi, pitchClass }` (e.g. A/C/E with E as the lowest MIDI → `Am/E`).

Browser-verified (on `/piano-to-guitar`):
- Layout order is piano → chord hint → neck → controls.
- Selecting notes updates the `ChordResult` (name, alternates, component-note pills, intervals) live as the piano selection changes; fewer than 2 distinct notes shows the empty hint "點鋼琴鍵來識別和弦".
- Default shows only solid exact-pitch dots (no faded dots); ticking 顯示非同八度亮點 reveals the faded dots; unticking hides them.
- The guitar (`/guitar-to-piano`) page's `ChordResult` and behavior are unchanged (backward-compat check).

---

## Future: Capo (not in this spec)

A later iteration will add a capo control to the note-map page. Intended shape: `findExactPositions` / `findPitchClassPositions` take an optional capo offset; positions below the capo fret are excluded and the open-string reference shifts up by the capo amount, so the pitch↔position mapping reflects the capo. Everything else (piano input, chord detection, layout) stays the same. Designing the position lookups to accept that offset later requires no change now.
