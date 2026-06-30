# Barre Chord (封閉指型) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a movable barre (封閉指型) as a first-class input: covered strings with no higher fingered note sound at the barre fret, fully integrated with capo, presses, mutes, scrolling, and chord detection.

**Architecture:** A dedicated `barre` state (`barreFret`, `barreLength`) in the `useFretboard` composable feeds an extended pure-logic `buildSelectedNotes` in `core/music-theory/fretboard.ts`. The Fretboard SVG gains a per-row "封閉" toggle column, a primary-colored barre bar with per-string note names, a length `<select>`, and dim/disable rules for cells behind the barre.

**Tech Stack:** Nuxt 4, Vue 3, TypeScript (strict, incl. `noUncheckedIndexedAccess`), Vitest.

## Global Constraints

- TypeScript strict incl. `noUncheckedIndexedAccess` — `npx nuxi typecheck` must pass 0 errors; provably-in-bounds index access uses `!`.
- No external music-theory libraries — pure hand-rolled logic in `core/`.
- ALL colors via CSS variables — no hardcoded hex. Existing tokens: `--color-primary`, `--color-accent`, `--color-text`, `--color-text-muted`, `--color-border`, `--color-surface`, `--color-on-primary`.
- **Color language:** barre = `--color-primary`; capo = `--color-accent` (capo bar unchanged).
- Strings: index 0 = low E (thickest, leftmost) … 5 = high E (thinnest, rightmost). `OPEN_STRINGS = [40,45,50,55,59,64]`. `STRING_COUNT = 6`. `MAX_FRET = 12`.
- Barre covers the **thinnest** `barreLength` strings: indices `[STRING_COUNT - barreLength .. STRING_COUNT - 1]`. Length range 2–6, default 6.
- Sounding-priority per string: muted > press strictly above barre > barre > capo > open.
- Single barre at a time.

---

## File Map

```
core/music-theory/fretboard.ts     # MODIFY: Barre type, helpers, buildSelectedNotes barre param
tests/music-theory/fretboard.test.ts # MODIFY: add barre tests
app/composables/useFretboard.ts    # MODIFY: barreFret/barreLength state + actions, feed detection
app/components/Fretboard/index.vue  # MODIFY: toggle column, barre bar + note names, length select, dim/disable
```

No new files — the barre logic belongs with the existing capo logic it mirrors.

---

## Task 1: Core — Barre type, helpers, and `buildSelectedNotes` integration

**Files:**
- Modify: `core/music-theory/fretboard.ts`
- Test: `tests/music-theory/fretboard.test.ts`

**Interfaces:**
- Consumes: `OPEN_STRINGS`, `midiToPitchClass`, `midiToNoteName` from `./notes`; `SelectedNote` from `./chord-detector`; existing `MAX_FRET`, `NoteMode`, `transposePressedFrets`.
- Produces:
  - `STRING_COUNT: number` (= 6)
  - `interface Barre { fret: number; length: number }`
  - `barreCoveredStrings(length: number): number[]`
  - `isStringBarred(stringIndex: number, barre: Barre | null): boolean`
  - `dropPressesAtOrBelow(pressedFrets: Map<number, number>, coveredStrings: number[], fret: number): Map<number, number>`
  - `transposeBarre(fret: number, delta: number, maxFret: number): number | null`
  - `buildSelectedNotes(pressedFrets, mutedStrings, capoFret, mode, barre?: Barre | null): SelectedNote[]` (new optional 5th param)

- [ ] **Step 1: Write the failing tests**

Append to `tests/music-theory/fretboard.test.ts` (keep existing tests; add new imports to the existing top import line so it reads exactly as below):

```ts
import {
  buildSelectedNotes,
  transposePressedFrets,
  transposeBarre,
  barreCoveredStrings,
  isStringBarred,
  dropPressesAtOrBelow,
  MAX_FRET,
  STRING_COUNT,
} from '../../core/music-theory/fretboard'
```

Then append these describe blocks at the end of the file:

```ts
describe('barreCoveredStrings', () => {
  it('length 6 covers all strings 0-5', () => {
    expect(barreCoveredStrings(6)).toEqual([0, 1, 2, 3, 4, 5])
  })
  it('length 5 covers strings 1-5 (drops low E)', () => {
    expect(barreCoveredStrings(5)).toEqual([1, 2, 3, 4, 5])
  })
  it('length 2 covers strings 4-5 (two thinnest)', () => {
    expect(barreCoveredStrings(2)).toEqual([4, 5])
  })
})

describe('isStringBarred', () => {
  it('null barre → never barred', () => {
    expect(isStringBarred(0, null)).toBe(false)
  })
  it('length 5 barre: string 0 not barred, string 1 barred', () => {
    const barre = { fret: 2, length: 5 }
    expect(isStringBarred(0, barre)).toBe(false)
    expect(isStringBarred(1, barre)).toBe(true)
    expect(isStringBarred(5, barre)).toBe(true)
  })
})

describe('dropPressesAtOrBelow', () => {
  it('removes covered-string presses at or below the fret, keeps the rest', () => {
    const pressed = new Map<number, number>([[1, 1], [2, 5], [0, 1]])
    // covered = strings 1..5 (length 5); fret = 1
    const result = dropPressesAtOrBelow(pressed, [1, 2, 3, 4, 5], 1)
    expect(result.has(1)).toBe(false) // 1 <= 1 on covered string → dropped
    expect(result.get(2)).toBe(5)     // 5 > 1 → kept
    expect(result.get(0)).toBe(1)     // string 0 not covered → kept
  })
  it('returns a new Map; input is not mutated', () => {
    const pressed = new Map<number, number>([[5, 1]])
    const result = dropPressesAtOrBelow(pressed, [5], 1)
    expect(result.has(5)).toBe(false)
    expect(pressed.get(5)).toBe(1)
  })
})

describe('transposeBarre', () => {
  it('shifts up within range', () => {
    expect(transposeBarre(1, 2, 12)).toBe(3)
  })
  it('returns null when pushed past maxFret', () => {
    expect(transposeBarre(11, 2, 12)).toBeNull()
  })
  it('returns null when pushed below fret 1', () => {
    expect(transposeBarre(1, -1, 12)).toBeNull()
  })
})

describe('buildSelectedNotes with a barre', () => {
  it('full F barre (fret 1, length 6) + E-shape fingers → F major sounding', () => {
    // E-shape F: low-E barre, A=3, D=3, G=2, B barre, high-E barre
    const pressed = new Map<number, number>([[1, 3], [2, 3], [3, 2]])
    const barre = { fret: 1, length: 6 }
    const sounding = buildSelectedNotes(pressed, new Set(), 0, 'sounding', barre)
    // string 0 sounds at the barre fret 1 → 40+1 = 41 (F)
    expect(noteFor(sounding, 0)!.midi).toBe(41)
    // string 1 has a higher press (3) → 45+3 = 48 (C), not the barre
    expect(noteFor(sounding, 1)!.midi).toBe(48)
    const chord = detectChord(sounding)
    expect(chord).not.toBeNull()
    expect(chord!.root).toBe('F')
    expect(chord!.symbol).toBe('')
  })

  it('partial barre (fret 2, length 5): strings 1-5 barred, string 0 stays open', () => {
    const barre = { fret: 2, length: 5 }
    const sounding = buildSelectedNotes(new Map(), new Set(), 0, 'sounding', barre)
    expect(noteFor(sounding, 0)!.midi).toBe(40)      // open low E
    expect(noteFor(sounding, 1)!.midi).toBe(47)      // 45 + 2
    expect(sounding).toHaveLength(6)
  })

  it('barre + capo in shape mode: covered string sounds at barre.fret - capoFret', () => {
    const barre = { fret: 3, length: 6 }
    const shape = buildSelectedNotes(new Map(), new Set(), 2, 'shape', barre)
    // string 0 shape = 40 + (3 - 2) = 41
    expect(noteFor(shape, 0)!.midi).toBe(41)
  })

  it('muted covered string is excluded even under a barre', () => {
    const barre = { fret: 1, length: 6 }
    const sounding = buildSelectedNotes(new Map(), new Set([5]), 0, 'sounding', barre)
    expect(noteFor(sounding, 5)).toBeUndefined()
  })

  it('covered string with a higher press sounds at the press, not the barre', () => {
    const pressed = new Map<number, number>([[3, 5]])
    const barre = { fret: 1, length: 6 }
    const sounding = buildSelectedNotes(pressed, new Set(), 0, 'sounding', barre)
    expect(noteFor(sounding, 3)!.midi).toBe(60) // 55 + 5, not 55 + 1
  })

  it('no barre argument behaves exactly as before (open strings)', () => {
    const sounding = buildSelectedNotes(new Map(), new Set(), 0, 'sounding')
    expect(sounding).toHaveLength(6)
    expect(noteFor(sounding, 0)!.midi).toBe(40)
  })
})
```

- [ ] **Step 2: Run the new tests to verify they fail**

Run: `npx vitest run tests/music-theory/fretboard.test.ts`
Expected: FAIL — `transposeBarre`, `barreCoveredStrings`, `isStringBarred`, `dropPressesAtOrBelow`, `STRING_COUNT` are not exported; barre param ignored.

- [ ] **Step 3: Rewrite `core/music-theory/fretboard.ts`**

Replace the entire file with:

```ts
import { OPEN_STRINGS, midiToPitchClass, midiToNoteName } from './notes'
import type { SelectedNote } from './chord-detector'

export type NoteMode = 'sounding' | 'shape'

// Fretboard physical limit: with DISPLAY_FRETS=5 and MAX_START_FRET=8 the
// lowest visible fret is 12.
export const MAX_FRET = 12

// Number of strings on the board.
export const STRING_COUNT = OPEN_STRINGS.length

// A barre: one finger across the thinnest `length` strings at `fret`.
export interface Barre {
  fret: number
  length: number
}

// Covered string indices for a barre length, anchored to the thinnest string
// (index STRING_COUNT-1). length 6 → [0..5]; length 5 → [1..5]; etc.
export function barreCoveredStrings(length: number): number[] {
  const start = STRING_COUNT - length
  return Array.from({ length }, (_, i) => start + i)
}

// Whether a given string is under the barre.
export function isStringBarred(stringIndex: number, barre: Barre | null): boolean {
  return barre !== null && stringIndex >= STRING_COUNT - barre.length
}

function makeNote(stringIndex: number, fret: number, midi: number): SelectedNote {
  return {
    stringIndex,
    fret,
    midi,
    pitchClass: midiToPitchClass(midi),
    noteName: midiToNoteName(midi),
  }
}

// Build the notes that sound (or that the shape implies) given a capo and an
// optional barre. Single per-string pass applying the sounding-priority rule:
// muted > press strictly above barre > barre > capo > open.
//
// sounding: a sounding fret f → OPEN_STRINGS[s] + f
// shape:    capo treated as the nut → OPEN_STRINGS[s] + (f - capoFret); open → fret 0
export function buildSelectedNotes(
  pressedFrets: Map<number, number>,
  mutedStrings: Set<number>,
  capoFret: number,
  mode: NoteMode,
  barre: Barre | null = null,
): SelectedNote[] {
  const notes: SelectedNote[] = []

  for (let s = 0; s < STRING_COUNT; s++) {
    if (mutedStrings.has(s)) continue

    const press = pressedFrets.get(s)
    const barred = isStringBarred(s, barre)

    let fret: number
    if (press !== undefined && (!barred || press > barre!.fret)) {
      fret = press
    } else if (barred) {
      fret = barre!.fret
    } else {
      // Open string: sounds at the capo (sounding) or at fret 0 (shape)
      const openMidi = OPEN_STRINGS[s]! + (mode === 'sounding' ? capoFret : 0)
      notes.push(makeNote(s, 0, openMidi))
      continue
    }

    const midi = OPEN_STRINGS[s]! + (mode === 'sounding' ? fret : fret - capoFret)
    notes.push(makeNote(s, fret, midi))
  }

  return notes
}

// Shift every pressed fret by `delta`. A press shifted above `maxFret` or
// below fret 1 is dropped — lossy. Returns a NEW Map; input is not mutated.
export function transposePressedFrets(
  pressedFrets: Map<number, number>,
  delta: number,
  maxFret: number,
): Map<number, number> {
  const result = new Map<number, number>()
  for (const [stringIndex, fret] of pressedFrets) {
    const next = fret + delta
    if (next >= 1 && next <= maxFret) {
      result.set(stringIndex, next)
    }
  }
  return result
}

// Shift a barre fret by `delta`. Returns the new fret, or null if pushed off
// the neck (above maxFret or below fret 1) — lossy, mirroring presses.
export function transposeBarre(fret: number, delta: number, maxFret: number): number | null {
  const next = fret + delta
  return next >= 1 && next <= maxFret ? next : null
}

// Remove presses on covered strings whose fret is at or below `fret` (they
// cannot sound behind the barre). Returns a NEW Map; input is not mutated.
export function dropPressesAtOrBelow(
  pressedFrets: Map<number, number>,
  coveredStrings: number[],
  fret: number,
): Map<number, number> {
  const covered = new Set(coveredStrings)
  const result = new Map<number, number>()
  for (const [stringIndex, f] of pressedFrets) {
    if (covered.has(stringIndex) && f <= fret) continue
    result.set(stringIndex, f)
  }
  return result
}
```

- [ ] **Step 4: Run the full suite to verify pass**

Run: `npx vitest run`
Expected: PASS — all existing fretboard/chord tests still green (they look up notes by `stringIndex`, so the per-string rewrite is order-safe) plus the new barre tests.

- [ ] **Step 5: Typecheck**

Run: `npx nuxi typecheck`
Expected: 0 errors.

- [ ] **Step 6: Commit**

```bash
git add core/music-theory/fretboard.ts tests/music-theory/fretboard.test.ts
git commit -m "feat: barre helpers and buildSelectedNotes barre integration in core"
```

---

## Task 2: Composable — barre state, actions, and detection wiring

**Files:**
- Modify: `app/composables/useFretboard.ts`

**Interfaces:**
- Consumes: `buildSelectedNotes`, `transposePressedFrets`, `transposeBarre`, `barreCoveredStrings`, `dropPressesAtOrBelow`, `MAX_FRET`, `type Barre` from `~~/core/music-theory/fretboard`.
- Produces (added to the object returned by `useFretboard()`):
  - `barreFret: Ref<number | null>`
  - `barreLength: Ref<number>`
  - `toggleBarre(fret: number): void`
  - `setBarreLength(len: number): void`

- [ ] **Step 1: Rewrite `app/composables/useFretboard.ts`**

Replace the entire file with:

```ts
import { ref, computed } from 'vue'
import { detectChord, type ChordResult } from '~~/core/music-theory/chord-detector'
import {
  buildSelectedNotes,
  transposePressedFrets,
  transposeBarre,
  barreCoveredStrings,
  dropPressesAtOrBelow,
  MAX_FRET,
  type Barre,
} from '~~/core/music-theory/fretboard'

// Singleton state — shared across all components
const pressedFrets = ref(new Map<number, number>())  // stringIndex → absolute fret
const mutedStrings = ref(new Set<number>())
const capoFret = ref(0)                                // 0–7 (0 = no capo)
const barreFret = ref<number | null>(null)             // barre fret; null = no barre
const barreLength = ref(6)                             // 2–6, anchored to the thinnest strings

const MAX_CAPO = 7

const barre = computed<Barre | null>(() =>
  barreFret.value === null ? null : { fret: barreFret.value, length: barreLength.value },
)

const detectedChord = computed<ChordResult | null>(() =>
  detectChord(buildSelectedNotes(pressedFrets.value, mutedStrings.value, capoFret.value, 'sounding', barre.value)),
)

const shapeChord = computed<ChordResult | null>(() =>
  detectChord(buildSelectedNotes(pressedFrets.value, mutedStrings.value, capoFret.value, 'shape', barre.value)),
)

function toggleFret(stringIndex: number, fret: number): void {
  const current = pressedFrets.value.get(stringIndex)
  if (current === fret) {
    pressedFrets.value.delete(stringIndex)
  } else {
    pressedFrets.value.set(stringIndex, fret)
    mutedStrings.value.delete(stringIndex)
  }
  pressedFrets.value = new Map(pressedFrets.value)  // trigger reactivity
}

function toggleMute(stringIndex: number): void {
  if (mutedStrings.value.has(stringIndex)) {
    mutedStrings.value.delete(stringIndex)
  } else {
    mutedStrings.value.add(stringIndex)
    pressedFrets.value.delete(stringIndex)
    pressedFrets.value = new Map(pressedFrets.value)
  }
  mutedStrings.value = new Set(mutedStrings.value)
}

function setCapo(fret: number): void {
  const next = Math.min(MAX_CAPO, Math.max(0, fret))
  const delta = next - capoFret.value
  if (delta === 0) return
  capoFret.value = next
  // Capo and shape move together: shift every press by the same delta.
  // Notes pushed past the last fret are dropped (lossy).
  pressedFrets.value = transposePressedFrets(pressedFrets.value, delta, MAX_FRET)
  // The barre moves with the capo too; if pushed off the neck it is dropped.
  if (barreFret.value !== null) {
    barreFret.value = transposeBarre(barreFret.value, delta, MAX_FRET)
  }
}

// Toggle the barre at `fret`. Re-tapping the same fret removes it; tapping a
// new fret moves the (single) barre there and drops covered-string presses at
// or below the barre fret (they cannot sound behind the barre).
function toggleBarre(fret: number): void {
  if (barreFret.value === fret) {
    barreFret.value = null
    return
  }
  barreFret.value = fret
  pressedFrets.value = dropPressesAtOrBelow(
    pressedFrets.value,
    barreCoveredStrings(barreLength.value),
    fret,
  )
}

function setBarreLength(len: number): void {
  barreLength.value = len
  if (barreFret.value !== null) {
    pressedFrets.value = dropPressesAtOrBelow(
      pressedFrets.value,
      barreCoveredStrings(len),
      barreFret.value,
    )
  }
}

function clearAll(): void {
  pressedFrets.value = new Map()
  mutedStrings.value = new Set()
  capoFret.value = 0
  barreFret.value = null
  barreLength.value = 6
}

export function useFretboard() {
  return {
    pressedFrets,
    mutedStrings,
    capoFret,
    barreFret,
    barreLength,
    detectedChord,
    shapeChord,
    toggleFret,
    toggleMute,
    setCapo,
    toggleBarre,
    setBarreLength,
    clearAll,
  }
}
```

- [ ] **Step 2: Typecheck**

Run: `npx nuxi typecheck`
Expected: 0 errors.

- [ ] **Step 3: Run the suite (no regressions)**

Run: `npx vitest run`
Expected: PASS — all tests still green (composable has no unit test; core logic is covered in Task 1).

- [ ] **Step 4: Commit**

```bash
git add app/composables/useFretboard.ts
git commit -m "feat: barre state, toggleBarre/setBarreLength, capo-linked transpose in composable"
```

---

## Task 3: Fretboard UI — toggle column, barre bar with note names, length select

**Files:**
- Modify: `app/components/Fretboard/index.vue`

**Interfaces:**
- Consumes: `useFretboard()` → `barreFret`, `barreLength`, `toggleBarre`, `setBarreLength` (plus existing `pressedFrets`, `mutedStrings`, `capoFret`, `toggleFret`, `toggleMute`, `setCapo`, `clearAll`); `midiToNoteName`, `OPEN_STRINGS` from notes.
- Produces: a visible, working barre — create/move/remove via the per-row 「封閉」 toggle, a primary-colored bar with per-string note names, and a length `<select>`. (Cell dimming / open-circle hiding is Task 4.)

- [ ] **Step 1: Widen the SVG and add barre layout constants**

In `<script setup>`, update the destructure and layout constants. Change the destructure line to:

```ts
const {
  pressedFrets, mutedStrings, capoFret, barreFret, barreLength,
  toggleFret, toggleMute, setCapo, toggleBarre, setBarreLength, clearAll,
} = useFretboard()
```

Then change the SVG width constant block. Replace:

```ts
const SVG_W = LEFT_PAD + 5 * STRING_GAP + RIGHT_PAD   // 184
const SVG_H = TOP_PAD + DISPLAY_FRETS * FRET_GAP + BOTTOM_PAD  // 262
```

with:

```ts
// Right-hand column holds the per-row 「封閉」 barre toggles.
const BARRE_COL_W = 60
const BARRE_LABEL_X = LEFT_PAD + 5 * STRING_GAP + 14   // text x
const BARRE_DOT_X = LEFT_PAD + 5 * STRING_GAP + 46     // status dot cx
const BARRE_DOT_R = 5

const SVG_W = LEFT_PAD + 5 * STRING_GAP + BARRE_COL_W   // 228
const SVG_H = TOP_PAD + DISPLAY_FRETS * FRET_GAP + BOTTOM_PAD  // 262
```

(`RIGHT_PAD` is now unused — remove its `const RIGHT_PAD = 16` declaration to keep the file clean.)

- [ ] **Step 2: Add barre computeds and a max-update of `.chord-svg` width**

In `<script setup>`, after the `capoRowIndex` computed, add:

```ts
// First covered (thickest) string index for the current barre length
const barreStartString = computed<number>(() => 6 - barreLength.value)

// Row index of the barre within the window, or null when off-window
const barreRowIndex = computed<number | null>(() => {
  const b = barreFret.value
  if (b === null || b < startFret.value || b > startFret.value + DISPLAY_FRETS - 1) return null
  return b - startFret.value
})

// Note name for each covered string that actually sounds via the barre
// (covered, not muted, no higher press). Strings with a higher press show
// their name on their own press dot instead.
const barreNoteLabels = computed<{ s: number; name: string }[]>(() => {
  const b = barreFret.value
  if (b === null || barreRowIndex.value === null) return []
  const out: { s: number; name: string }[] = []
  for (let s = barreStartString.value; s <= 5; s++) {
    if (mutedStrings.value.has(s)) continue
    const press = pressedFrets.value.get(s)
    if (press !== undefined && press > b) continue
    out.push({ s, name: noteNameAt(s, b) })
  }
  return out
})

// A barre toggle is disabled on rows at or below the capo
function barreToggleDisabled(fretNum: number): boolean {
  return fretNum <= capoFret.value
}

function onBarreLength(e: Event): void {
  setBarreLength(Number((e.target as HTMLSelectElement).value))
}
```

Also raise the SVG max-width so the wider viewBox isn't squeezed: in `<style scoped>`, change `.chord-svg { ... max-width: 240px; ... }` to `max-width: 300px;`.

- [ ] **Step 3: Add the barre bar, note labels, and toggle column to the template**

In the SVG, immediately AFTER the capo bar block (the `<!-- Layer 4c: Capo bar -->` `<rect>`), add:

```html
      <!-- Layer 4d: Barre bar -->
      <rect
        v-if="barreRowIndex !== null"
        :x="sx(barreStartString)"
        :y="TOP_PAD + barreRowIndex * FRET_GAP + FRET_GAP / 2 - 4"
        :width="sx(5) - sx(barreStartString)"
        height="8"
        rx="4"
        class="barre-bar"
      />

      <!-- Layer 4e: Barre per-string note names -->
      <text
        v-for="label in barreNoteLabels"
        :key="`barrelabel-${label.s}`"
        :x="sx(label.s)"
        :y="TOP_PAD + (barreRowIndex ?? 0) * FRET_GAP + FRET_GAP / 2"
        text-anchor="middle"
        dominant-baseline="middle"
        class="barre-label-text"
      >{{ label.name }}</text>

      <!-- Layer 7: Barre toggle column (per visible fret row) -->
      <g
        v-for="(fretNum, idx) in displayFretNums"
        :key="`barretoggle-${fretNum}`"
        v-show="!barreToggleDisabled(fretNum)"
        class="barre-toggle"
        @click="toggleBarre(fretNum)"
      >
        <rect
          :x="BARRE_LABEL_X - 4"
          :y="TOP_PAD + idx * FRET_GAP"
          :width="BARRE_COL_W - 10"
          :height="FRET_GAP"
          fill="transparent"
        />
        <text
          :x="BARRE_LABEL_X"
          :y="TOP_PAD + idx * FRET_GAP + FRET_GAP / 2"
          dominant-baseline="middle"
          class="barre-toggle-text"
        >封閉</text>
        <circle
          :cx="BARRE_DOT_X"
          :cy="TOP_PAD + idx * FRET_GAP + FRET_GAP / 2"
          :r="BARRE_DOT_R"
          class="barre-toggle-dot"
          :class="{ 'barre-toggle-dot--on': barreFret === fretNum }"
        />
      </g>
```

- [ ] **Step 4: Add the length select to the control area**

In the template, after the `<!-- Capo stepper -->` `.capo-row` div, add:

```html
    <!-- Barre length -->
    <div class="barre-row">
      <span class="capo-label">Barre</span>
      <select class="barre-select" :value="barreLength" @change="onBarreLength">
        <option v-for="n in [6, 5, 4, 3, 2]" :key="n" :value="n">{{ n }}</option>
      </select>
    </div>
```

- [ ] **Step 5: Add the barre styles**

In `<style scoped>`, after the `.capo-bar` rule, add:

```css
.barre-bar {
  fill: var(--color-primary);
}

.barre-label-text {
  font-size: 8px;
  font-weight: 600;
  fill: var(--color-on-primary);
  font-family: 'Inter', sans-serif;
  pointer-events: none;
}

.barre-toggle {
  cursor: pointer;
}

.barre-toggle-text {
  font-size: 11px;
  fill: var(--color-text-muted);
  font-family: 'Inter', sans-serif;
}

.barre-toggle-dot {
  fill: var(--color-border);
  stroke: var(--color-text-muted);
  stroke-width: 1;
}

.barre-toggle-dot--on {
  fill: var(--color-primary);
  stroke: var(--color-primary);
}

.barre-row {
  display: flex;
  align-items: center;
  gap: 12px;
}

.barre-select {
  border-radius: var(--radius-sm);
  border: 1px solid var(--color-border);
  background: var(--color-surface);
  color: var(--color-text);
  font-size: 13px;
  padding: 4px 8px;
  cursor: pointer;
}
```

- [ ] **Step 6: Typecheck**

Run: `npx nuxi typecheck`
Expected: 0 errors.

- [ ] **Step 7: Build smoke check**

Run (background) `npm run dev`, wait for ready, then:
`curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/` → `200`.
Also `curl -s http://localhost:3000/ | grep -o '封閉'` → prints `封閉` (toggle column rendered). Stop dev.

- [ ] **Step 8: Commit**

```bash
git add app/components/Fretboard/index.vue
git commit -m "feat: barre toggle column, primary barre bar with per-string note names, length select"
```

---

## Task 4: Fretboard UI — covered-string dimming and open-circle hiding

**Files:**
- Modify: `app/components/Fretboard/index.vue`

**Interfaces:**
- Consumes: the barre state and computeds added in Task 3.
- Produces: cells at/below the barre on covered strings are non-clickable and dimmed; barred unpressed strings hide their open-circle marker.

- [ ] **Step 1: Add an `isBarred` helper and a dim-cell computed**

In `<script setup>`, after `barreNoteLabels`, add:

```ts
// Is this string covered by the current barre?
function isBarred(stringIndex: number): boolean {
  return barreFret.value !== null && stringIndex >= barreStartString.value
}

// Covered-string cells strictly below the barre fret, within the window —
// dimmed and non-clickable (the finger already holds the string there).
const barreDimCells = computed<{ s: number; fi: number }[]>(() => {
  const b = barreFret.value
  if (b === null) return []
  const cells: { s: number; fi: number }[] = []
  for (let s = barreStartString.value; s <= 5; s++) {
    for (let fi = 0; fi < DISPLAY_FRETS; fi++) {
      const fretNum = displayFretNums.value[fi]!
      if (fretNum < b) cells.push({ s, fi })
    }
  }
  return cells
})
```

- [ ] **Step 2: Exclude at/below-barre covered cells from click targets**

In `<script setup>`, replace the `clickCells` computed with:

```ts
const clickCells = computed(() => {
  const cells: { s: number; fi: number }[] = []
  for (const s of STRINGS) {
    for (let fi = 0; fi < DISPLAY_FRETS; fi++) {
      const fretNum = displayFretNums.value[fi]!
      if (isDimmed(fretNum)) continue                              // capo-blocked
      if (barreFret.value !== null && isBarred(s) && fretNum <= barreFret.value) continue  // behind the barre
      cells.push({ s, fi })
    }
  }
  return cells
})
```

- [ ] **Step 3: Render dim overlays for below-barre covered cells**

In the template, immediately AFTER the `<!-- Layer 4b: Capo dim overlay -->` block, add:

```html
      <!-- Layer 4b-2: Barre dim overlay (covered-string cells below the barre) -->
      <rect
        v-for="cell in barreDimCells"
        :key="`barredim-${cell.s}-${cell.fi}`"
        :x="sx(cell.s) - STRING_GAP / 2"
        :y="TOP_PAD + cell.fi * FRET_GAP"
        :width="STRING_GAP"
        :height="FRET_GAP"
        class="capo-dim"
      />
```

(Reuses the existing `.capo-dim` style — same "blocked cell" visual language.)

- [ ] **Step 4: Hide the open-circle on barred strings**

In the template, in the `<!-- Layer 6: Open / muted string markers -->` group, change the open-circle condition from:

```html
        <circle
          v-else-if="!pressedFrets.has(s)"
```

to:

```html
        <circle
          v-else-if="!pressedFrets.has(s) && !isBarred(s)"
```

- [ ] **Step 5: Typecheck**

Run: `npx nuxi typecheck`
Expected: 0 errors.

- [ ] **Step 6: Build smoke check**

Run (background) `npm run dev`, wait for ready, then `curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/` → `200`. Stop dev.

- [ ] **Step 7: Commit**

```bash
git add app/components/Fretboard/index.vue
git commit -m "feat: dim/disable cells behind the barre and hide open-circles on barred strings"
```

---

## Manual verification (after all tasks)

Run `npm run dev` and, in the browser:
1. Tap the 「封閉」 toggle on fret 1 → a primary bar spans all 6 strings; each string shows a small note name; ChordResult updates.
2. Add fingers above the barre (e.g. tap frets to form an F shape) → those strings show press dots; the barre strings keep their labels; chord reads F.
3. Tap another row's 「封閉」 toggle → the bar moves; only one bar exists.
4. Change the Barre length select to 5/4 → the bar shortens from the bass side; the thinnest string stays covered.
5. Set a capo → the barre toggles at/below the capo disappear; the bar and the capo move together when the capo changes.
6. Cells below the barre on covered strings are dimmed and unclickable; barred strings show no open-circle above the nut.
7. Toggle dark mode → barre bar (primary) stays distinct from the capo bar (accent); labels remain legible.
```
