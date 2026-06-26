# Barre Chord (封閉指型) — Design Spec
Date: 2026-06-26

## Overview

Add a **barre** (封閉指型) as a first-class input mechanism to the existing guitar
fretboard tool. A barre is a finger held across several strings at one fret. Strings
covered by the barre that have no higher fingered note sound at the barre fret; this
lets a user enter chords like F major (full barre at fret 1 + a few higher fingers)
without tapping every string.

This builds on the shipped capo feature, which already renders a full-width bar that
acts as the nut. A barre reuses the same architecture but is a movable, possibly
partial finger that sounds at its own fret rather than acting as a nut.

**Approach (chosen):** dedicated `barre` state in the composable + extended pure-logic
`buildSelectedNotes` in `core/music-theory/fretboard.ts`. The barre stays a separable,
testable concept distinct from individual presses and from the capo.

---

## Current architecture (context)

- State (`app/composables/useFretboard.ts`): `pressedFrets: Map<stringIndex, absoluteFret>`
  (one fret per string), `mutedStrings: Set<number>`, `capoFret: 0–7`.
- Core (`core/music-theory/fretboard.ts`): `buildSelectedNotes(pressedFrets, mutedStrings,
  capoFret, mode)` produces the notes for `'sounding'` (capo transposes) or `'shape'`
  (capo treated as nut). `transposePressedFrets` shifts presses when the capo moves.
- Fretboard (`app/components/Fretboard/index.vue`): SVG chord diagram, 5-fret scrollable
  window over a 12-fret neck (`MAX_FRET = 12`), capo bar (accent, full width) + dimmed
  rows at/below the capo, per-string press dots, open/mute markers above the nut.
- Strings: index 0 = low E (thickest, leftmost on screen) … index 5 = high E (thinnest,
  rightmost). `OPEN_STRINGS = [40,45,50,55,59,64]`. Guitar "1st string" = high E = index 5.

---

## Sounding-priority rule (closed set)

For each string, the sounding note is decided by the first rule that applies:

1. **Muted** → string excluded entirely.
2. **Higher explicit press** (a pressed fret strictly above the barre fret) → sounds at
   that press.
3. **Barre covers the string** (and no higher press) → sounds at the barre fret.
4. **Capo** (string not barred, not pressed) → sounds at the capo fret.
5. **Open** → sounds at fret 0.

Corollaries (consequences of the rule, not new features):

- On a barred string, frets **at or below** the barre fret cannot sound (the finger
  already holds the string). Those cells are dimmed and non-clickable (like capo rows).
- Placing or extending a barre **drops** any covered-string press at or below the barre
  fret (physically impossible behind the barre).
- A barred string with no higher press reads visually as *barred*, not *open*: its
  open-circle marker above the nut is hidden.

---

## Section 1 — State & core logic

### Composable state (`app/composables/useFretboard.ts`)

```ts
const barreFret  = ref<number | null>(null)  // fret the barre sits on; null = no barre
const barreLength = ref(6)                    // 2–6, default 6; anchored to the thinnest strings
```

Covered strings = indices `[STRING_COUNT - barreLength .. STRING_COUNT - 1]` where
`STRING_COUNT = 6`. So length 6 → strings 0–5 (all); 5 → 1–5; 4 → 2–5; 3 → 3–5; 2 → 4–5.
The thinnest string (index 5, 1st string) is always included.

### Actions

- `toggleBarre(fret)`: if `barreFret === fret`, clear (`barreFret = null`); otherwise set
  `barreFret = fret` and drop covered-string presses at or below `fret`. `fret` is always
  `> capoFret` (the toggle is disabled at/below the capo).
- `setBarreLength(len)`: set `barreLength = len`; if a barre exists, drop presses at or
  below `barreFret` on the newly covered strings.
- `setCapo(fret)` (extend existing): when the capo shifts by `delta`, also shift
  `barreFret` by `delta`. If the shifted barre falls outside `[1, MAX_FRET]`, drop it
  (`barreFret = null`) — lossy, matching how presses behave.
- `clearAll` (extend): also reset `barreFret = null`, `barreLength = 6`.

### Core pure functions (`core/music-theory/fretboard.ts`)

- `barreCoveredStrings(length: number): number[]` — returns the covered string indices.
- `buildSelectedNotes(pressedFrets, mutedStrings, capoFret, mode, barre?)` — add an
  optional `barre: { fret: number; length: number } | null` parameter and rewrite the body
  as a **single per-string pass** (strings 0→5) that applies the sounding-priority rule
  above. For a barred, unpressed string: sounding note = `OPEN_STRINGS[s] + barre.fret`;
  shape note = `OPEN_STRINGS[s] + (barre.fret - capoFret)`.
- `dropPressesAtOrBelow(pressedFrets, coveredStrings, fret): Map<number, number>` — returns
  a new Map with covered-string presses `<= fret` removed. Used on barre create / length
  change.

> Note: the existing `buildSelectedNotes` iterates pressed strings first, then open strings.
> Chord detection picks the bass by lowest MIDI, not array order, so rewriting to a single
> ordered per-string pass does not change detection results.

---

## Section 2 — Fretboard UI (`app/components/Fretboard/index.vue`)

### Barre toggle column (one per displayed fret row)

- A new column on the right of the board (right of string index 5). Widen the SVG by
  ~50px to fit it.
- Each displayed fret row shows the label **「封閉」** (plain text, no background fill)
  plus a status dot beside it:
  - dot **off**: light grey (`--color-text-muted` / `--color-border`).
  - dot **on** (`barreFret === this row's fret`): lit `--color-primary`.
  - **disabled** when `fretNum <= capoFret` (cannot barre at or below the capo): hidden /
    greyed and non-clickable.
- Tapping a row's toggle calls `toggleBarre(absoluteFret)`.

### Barre bar

- When `barreFret` is inside the current 5-fret window, draw a rounded rect from
  `sx(startString)` to `sx(5)`, where `startString = STRING_COUNT - barreLength`, centered
  on the barre row, filled `--color-primary`.
- Color language: **barre = `--color-primary`**, **capo = `--color-accent`** (capo bar
  unchanged). Two features, two colors.
- Not drawn when scrolled out of the window (same as press dots).

### Covered-string visuals

- Barred, unpressed strings: hide the open-circle marker above the nut.
- On covered strings, cells with `fretNum < barreFret` (and above the capo) are dimmed and
  non-clickable. Cells above the barre fret stay clickable (to add a higher finger). Cells
  on non-covered strings are unaffected (other than existing capo behavior).
- A covered string that also has a higher press still shows its press dot normally.

### Barre length select

- A `<select>` in the nav/capo control area with options 6 / 5 / 4 / 3 / 2, labelled
  「Barre」, bound to `barreLength` (calls `setBarreLength`). Visible and editable even when
  no barre exists (the value applies to the next barre created).

---

## Section 3 — Testing

### Core unit tests (`tests/music-theory/`)

- `buildSelectedNotes` with a barre:
  - Full barre F shape (barre at fret 1 + higher presses) → correct sounding notes.
  - Partial barre (length 5 and 4, thinnest-string anchored) → correct covered strings.
  - Barre + capo in `'shape'` mode (covered string note = `barre.fret - capoFret`).
  - Muted covered string → excluded (mute precedence).
  - Covered string with a higher press → sounds at the press, not the barre.
- `barreCoveredStrings(length)` → correct indices (6→0–5, 5→1–5, 4→2–5, 3→3–5, 2→4–5).
- `dropPressesAtOrBelow` → removes covered-string presses `<= fret`, leaves others.
- Capo transpose of the barre: a barre pushed past `MAX_FRET` (or below fret 1) is dropped.

### Component layer

- `npx nuxi typecheck` 0 errors + `npm run dev` build returns HTTP 200 (smoke check),
  consistent with prior tasks. Interaction details verified manually / via screenshots.

---

## Scope

### In scope
- Single barre at a time (one bar on the board, replacing any prior bar on toggle).
- Length 2–6, anchored to the thinnest strings.
- Full integration with capo, presses, mutes, scrolling, and chord detection
  (sounding + shape).

### Out of scope (YAGNI)
- Multiple simultaneous barres / secondary partial barres.
- Barres anchored to the bass side (covering the thickest strings instead of thinnest).
- Auto-detecting/suggesting a barre from a hand-entered shape.
- Finger-number annotations on the barre.
