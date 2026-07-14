# Piano-to-Fretboard Note Map — Design Spec

Date: 2026-07-14

## Overview

A second, read-only reference page: the user clicks single notes on a piano keyboard (up to 6), and a full 20-fret guitar neck lights up **every** position that can produce those notes. Pure display — no chord detection, no fingering suggestions, no interaction on the guitar side.

This is the mirror direction of the existing tool (guitar → piano). The two directions are **separate pages** and do **not** share playing state. Some UI components are shared at the source-code level (see below), but each page owns its own state.

**Naming (tentative):**
- Header tabs: **從吉他** (guitar → piano, the existing tool) / **從鋼琴** (this new tool)
- Routes: `/guitar-to-piano` and `/piano-to-guitar`

---

## Scope

### In scope
- New `/piano-to-guitar` page
- Clickable piano keyboard (fixed range E2–C6), up to 6 simultaneous notes
- Full-neck horizontal guitar diagram: 6 strings × 20 frets, standard tuning
- Per-note color coding (each pressed note gets its own color)
- Exact-pitch highlights (solid) + same-note-name/different-octave highlights (dim)
- A toggle to hide the off-octave (dim) highlights
- Clear button
- Header navigation between the two directions

### Out of scope
- Suggesting playable chord shapes / fingerings from the notes
- Harmonics, alternate tunings, capo on this page
- Any interaction on the guitar neck (it is display-only)
- Persisting selections across reloads

---

## Routing

The project currently has no `pages/` directory — Nuxt renders `app.vue` directly. This feature introduces standard Nuxt file-based routing.

- `app.vue` → becomes the layout shell: header (title + theme toggle + **nav tabs**) wrapping `<NuxtPage />`.
- `app/pages/guitar-to-piano.vue` → the existing feature. The current `app.vue` body (Fretboard + ChordResult + PianoKeyboard layout) moves here unchanged.
- `app/pages/piano-to-guitar.vue` → the new feature.
- `app/pages/index.vue` → redirects to `/guitar-to-piano` (via `definePageMeta({ redirect: '/guitar-to-piano' })`), so the default entry point is the original tool.

Nav tabs use `<NuxtLink>` with active-class styling. Switching tabs is a route change; because each page instantiates its own composable, the two directions keep independent state naturally.

---

## Components

### `<GuitarNeck />` — new, display-only

Horizontal full-neck diagram.

- **Layout:** 6 strings × 20 frets. Nut on the **left**, fret 20 on the **right**. High E (string index 5) on the **top** line, low E (string index 0) on the **bottom** line (standard tab convention).
- **Tuning:** standard, reused from `OPEN_STRINGS` (E2 A2 D3 G3 B3 E4).
- **Inlay markers:** single dots at frets 3, 5, 7, 9, 15, 17, 19 and a double dot at fret 12 (realistic feel).
- **Props:** a list of lit positions. Each item: `{ stringIndex, fret, noteName, octave, colorIndex, dim }`.
- **Rendering:** at each lit position, draw a filled dot in the note's palette color; `dim: true` renders at reduced opacity. The dot shows **note name + octave** inside (e.g. `C4`), small.
- **Responsive:** horizontal scroll on narrow screens (a 20-fret neck is wide).
- No click handlers — purely presentational.

### `<PianoKeyboard />` — refactor existing, backward-compatible

The existing component is read-only and auto-ranges to the active notes. New optional props extend it without changing current behavior.

- **New props (all optional):**
  - `interactive?: boolean` (default `false`) — when true, keys are clickable.
  - `fixedRange?: { startMidi: number; endMidi: number } | null` (default `null`) — when set, use this range instead of `computePianoRange(...)`.
  - `activeColorMap?: Map<number, number> | null` (default `null`) — when set, "active" means the key's MIDI is in the map, and the key/label is colored by its `colorIndex` (palette). When null, behavior falls back to the current `useFretboard().selectedNotes` source.
- **New emit:** `toggle(midi: number)` — fired on click when `interactive`.
- **Backward compatibility:** the existing page renders `<PianoKeyboard />` with no props → identical current behavior (auto-range, read-only, colored by `selectedNotes`). The existing auto-scale-to-fit-width logic is untouched and is what lets the new page show the full E2–C6 range scaled into its container.

### Piano keyboard range on the new page

The new page passes `fixedRange = { startMidi: 40, endMidi: 84 }` (**E2–C6**). This exactly covers what a 20-fret standard-tuned guitar can sound: lowest = low-E open (MIDI 40), highest = high-E string at fret 20 (MIDI 84). All 45 keys render at once and the existing auto-scale shrinks them to fit the container (horizontal scroll on mobile). No pan/slide controls — keeping every selected note visible at all times is the point of a multi-note selection tool.

### Page controls (inline in `piano-to-guitar.vue`)

A small controls row:
- **隱藏非同八度亮點** toggle → drives `showOffOctave`.
- **清除** button → clears all selected notes.
- A count indicator (e.g. `3 / 6`).

---

## State — `usePianoNoteMap()` composable

New composable, module-level singleton, fully separate from `useFretboard`.

```ts
selectedMidis: Ref<Map<number, number>>   // midi → colorIndex (0..5), max 6 entries
showOffOctave: Ref<boolean>               // default true

toggleNote(midi)   // present → remove & free its color;
                   // absent & size < 6 → assign the lowest free colorIndex;
                   // absent & size === 6 → ignored (no-op)
clear()

litPositions: ComputedRef<LitPosition[]>  // fed to <GuitarNeck />
```

- `MAX_NOTES = 6`. A 7th distinct note is ignored; deselecting an already-selected note is always allowed.
- **Colors:** a fixed 6-color palette indexed 0–5. Colors are assigned by lowest free index, so removing a middle note frees its slot for reuse.

### Lit-position computation

For each `(midi, colorIndex)` in `selectedMidis`:
- **Exact positions** (`findExactPositions(midi)`) → `dim: false`, palette color `colorIndex`.
- If `showOffOctave`: **pitch-class positions** (`findPitchClassPositions(pc)`) minus the exact ones → `dim: true`, same `colorIndex`.

Each emitted `LitPosition` carries `noteName` and `octave` derived from the sounding MIDI at that position, so the guitar dot label reflects the actual pitch there (dim dots show their own octave, e.g. a C3 dot when C4 was pressed).

---

## Core music theory — `core/music-theory/neck.ts` (new)

Pure, UI-independent, unit-testable — same layer as `chord-detector.ts`.

```ts
export const NECK_FRETS = 20

export interface Position { stringIndex: number; fret: number }

// All (string, fret) on a NECK_FRETS board (standard tuning) that sound exactly `midi`.
// Includes open strings (fret 0).
export function findExactPositions(midi: number, maxFret = NECK_FRETS): Position[]

// All (string, fret) whose pitch class equals `pc`.
export function findPitchClassPositions(pc: number, maxFret = NECK_FRETS): Position[]
```

Both derive pitches from `OPEN_STRINGS` + fret. No new tuning data is introduced.

---

## Highlight rules (summary)

Each pressed piano note has its own palette color. For every pressed note:
- **Exact same pitch** positions → solid color.
- **Same note name, different octave** positions → dim (reduced opacity) same color.
- `showOffOctave` off → only the solid (exact) dots remain.
- Every lit dot shows **note name + octave** (e.g. `C4`).
- By construction every E2–C6 pitch has at least one exact position within 20 frets, so an "unmatched" state does not occur for exact highlights.

---

## Layout

```
┌───────────────────────────────────────────┐
│  header: fret notes   [從吉他][從鋼琴]  🌙 │
├───────────────────────────────────────────┤
│  GuitarNeck (horizontal, 6×20, scrolls →)  │
├───────────────────────────────────────────┤
│  controls: [隱藏非同八度亮點]  3/6  [清除] │
├───────────────────────────────────────────┤
│  PianoKeyboard (E2–C6, clickable, scales)  │
└───────────────────────────────────────────┘
```

Guitar neck on top (output), piano on the bottom (input). Both scroll horizontally on narrow screens.

---

## Visual design

- **Note palette:** 6 visually distinct, theme-aware colors defined as CSS variables (`--note-color-0` … `--note-color-5`) with light/dark values. Dim highlights reuse the same color at reduced opacity (~35%).
- Follows the existing token system (`variables.css`) and SCSS module-per-component pattern already used by Fretboard / PianoKeyboard / ChordResult.
- The nav tabs adopt the existing header styling; the active tab is marked via `NuxtLink` active class.

---

## Testing

Core (`neck.ts`), pure unit tests:
- `findExactPositions(40)` (E2) → only `[{0,0}]` (low-E open) — low boundary.
- `findExactPositions(84)` (C6) → only `[{5,20}]` (high-E, fret 20) — high boundary.
- `findExactPositions(60)` (C4) → the five expected positions across strings 0–4.
- `findPitchClassPositions(0)` (C) → includes every C within 20 frets, and excludes non-C.

Composable (`usePianoNoteMap`):
- Selecting 6 notes assigns colors 0–5; a 7th distinct note is a no-op.
- Removing a middle note frees its color; the next added note reuses the lowest free index.
- `showOffOctave` toggles the presence of dim positions in `litPositions`.

Component-level behavior (interactive PianoKeyboard, GuitarNeck rendering) is verified in the browser preview after implementation.

---

## Files touched

| File | Change |
|------|--------|
| `app/app.vue` | Becomes layout shell (header + nav tabs + `<NuxtPage />`) |
| `app/pages/index.vue` | New — redirect to `/guitar-to-piano` |
| `app/pages/guitar-to-piano.vue` | New — existing feature moved here |
| `app/pages/piano-to-guitar.vue` | New — this feature |
| `app/components/GuitarNeck/index.vue` | New — horizontal 6×20 neck |
| `app/components/PianoKeyboard/index.vue` | Refactor — optional `interactive` / `fixedRange` / `activeColorMap` props + `toggle` emit |
| `app/composables/usePianoNoteMap.ts` | New — selected notes, colors, lit positions |
| `core/music-theory/neck.ts` | New — `findExactPositions`, `findPitchClassPositions` |
| `app/assets/styles/variables.css` | Add 6 note-palette color tokens (light/dark) |
| `app/assets/styles/guitarNeck.scss` | New — neck styles |
| `tests/music-theory/neck.test.ts` | New — core position tests |
