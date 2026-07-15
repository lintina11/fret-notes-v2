# Note-Map Layout Swap + Chord Hint Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** On the `/piano-to-guitar` note-map page, swap piano above guitar, default off-octave highlights to hidden, and add a chord hint driven by the selected piano notes.

**Architecture:** Reuse `ChordResult` by giving it optional props (chord/capoFret/emptyHint) with a `useFretboard()` fallback so the guitar page is untouched; narrow `detectChord`'s parameter type to the two fields it uses so the note-map composable can feed it `{midi,pitchClass}` objects; add a `detectedChord` computed to `usePianoNoteMap`; reorder the page and flip the off-octave toggle to opt-in.

**Tech Stack:** Nuxt 4 (Vue 3 + TS), Vitest, SCSS modules.

## Global Constraints

- No changes to the guitar (`/guitar-to-piano`) page's behavior or appearance; `ChordResult` must stay backward compatible when rendered with no props.
- No new dependencies. No changes to `GuitarNeck`, `PianoKeyboard`, `variables.css`, `neck.ts`, or `note-map.ts`.
- Capo is OUT of scope this iteration.
- Pure logic tests are node-env with relative imports (no `~~`/`~` aliases under `tests/`). Vue/composable/page changes are verified in the browser.
- Traditional-Chinese UI copy. New toggle label: **顯示非同八度亮點**. New-page empty hint: **點鋼琴鍵來識別和弦**.
- Layout order on the note-map page: piano → chord hint → guitar neck → controls.
- Work on the existing `feature-piano-to-guitar` branch. Dev server: `preview_start { name: "fret-notes" }` (port 3000). Tests: `npx vitest run`. Commit after each task.

---

### Task 1: Narrow `detectChord`'s parameter type + tests

**Files:**
- Modify: `core/music-theory/chord-detector.ts:30`
- Test: `tests/music-theory/chord-detector.test.ts`

**Interfaces:**
- Consumes: nothing new.
- Produces: `detectChord(notes: { midi: number; pitchClass: number }[]): ChordResult | null` (was `SelectedNote[]`). `SelectedNote` remains exported and unchanged.

Note on TDD: this is a type-narrowing, not a behavior change, so there is no runtime "red" — the new tests pass at runtime both before and after (JS ignores the absent fields). Their value is guarding the runtime contract for the new `{midi,pitchClass}` call shape that the note-map composable will use, and the change is what makes that shape type-check.

- [ ] **Step 1: Add tests for the plain `{midi,pitchClass}` call shape**

Append these two tests inside the `describe('detectChord', ...)` block in `tests/music-theory/chord-detector.test.ts` (before its closing `})`):

```typescript
  it('detects a chord from plain {midi,pitchClass} objects (no string/fret)', () => {
    // C major triad: C4(60,pc0) E4(64,pc4) G4(67,pc7)
    const result = detectChord([
      { midi: 60, pitchClass: 0 },
      { midi: 64, pitchClass: 4 },
      { midi: 67, pitchClass: 7 },
    ])
    expect(result).not.toBeNull()
    expect(result!.root).toBe('C')
    expect(result!.symbol).toBe('')
    expect(result!.bassNote).toBeNull()
  })

  it('detects a slash chord from {midi,pitchClass} using the lowest midi as bass', () => {
    // Am/E: E3(52,pc4) is lowest, A3(57,pc9), C4(60,pc0)
    const result = detectChord([
      { midi: 52, pitchClass: 4 },
      { midi: 57, pitchClass: 9 },
      { midi: 60, pitchClass: 0 },
    ])
    expect(result).not.toBeNull()
    expect(result!.root).toBe('A')
    expect(result!.symbol).toBe('m')
    expect(result!.bassNote).toBe('E')
  })
```

- [ ] **Step 2: Run the new tests (they pass at runtime — documents the contract)**

Run: `npx vitest run tests/music-theory/chord-detector.test.ts`
Expected: PASS (all, including the two new tests). They pass because `detectChord` only reads `.midi`/`.pitchClass` at runtime.

- [ ] **Step 3: Narrow the parameter type**

In `core/music-theory/chord-detector.ts`, change the signature (line 30) from:

```typescript
export function detectChord(notes: SelectedNote[]): ChordResult | null {
```

to:

```typescript
export function detectChord(notes: { midi: number; pitchClass: number }[]): ChordResult | null {
```

Leave the entire function body and the `SelectedNote` interface unchanged. (`SelectedNote` stays exported for the guitar-side callers; a `SelectedNote[]` still satisfies the narrower parameter type structurally.)

- [ ] **Step 4: Run the full suite**

Run: `npx vitest run`
Expected: PASS — the existing `SelectedNote[]`-based tests still compile/run (guitar-style notes satisfy the narrower type), plus the two new tests. No regressions.

- [ ] **Step 5: Commit**

```bash
git add core/music-theory/chord-detector.ts tests/music-theory/chord-detector.test.ts
git commit -m "refactor: narrow detectChord param to {midi,pitchClass}[]"
```

---

### Task 2: Generalize `ChordResult` with optional props (backward compatible)

**Files:**
- Modify: `app/components/ChordResult/index.vue`

**Interfaces:**
- Consumes: `ChordResult` type from `~~/core/music-theory/chord-detector`; `useFretboard()` (existing).
- Produces: `<ChordResult>` with optional props `chord?: ChordResult | null`, `capoFret?: number`, `emptyHint?: string`. With no props, behavior is identical to today (reads `useFretboard()`).

- [ ] **Step 1: Replace the `<script setup>` block**

In `app/components/ChordResult/index.vue`, replace the entire `<script setup lang="ts">…</script>` block with:

```vue
<script setup lang="ts">
import { computed } from 'vue'
import { useFretboard } from '~/composables/useFretboard'
import type { ChordResult } from '~~/core/music-theory/chord-detector'

const props = defineProps<{
  chord?: ChordResult | null   // undefined ⇒ fall back to useFretboard().detectedChord
  capoFret?: number            // undefined ⇒ fall back to useFretboard().capoFret
  emptyHint?: string           // undefined ⇒ default guitar-page hint
}>()

const fb = useFretboard()

const detectedChord = computed(() => props.chord !== undefined ? props.chord : fb.detectedChord.value)
const capoFret = computed(() => props.capoFret ?? fb.capoFret.value)
const emptyHint = computed(() => props.emptyHint ?? '點選指板上的格子來識別和弦')

const shapeLabel = computed(() => {
  const s = fb.shapeChord.value
  if (!s) return ''
  if (s.unrecognized) return '(音集)'
  return `${s.root}${s.symbol}${s.bassNote ? '/' + s.bassNote : ''}`
})

const chordKey = computed(() => {
  const capo = capoFret.value
  if (!detectedChord.value) return 'empty'
  if (detectedChord.value.unrecognized) {
    return `unknown:${detectedChord.value.notes.map(n => n.noteName).join(',')}:capo${capo}`
  }
  return `${detectedChord.value.root}${detectedChord.value.symbol}${detectedChord.value.bassNote ?? ''}:capo${capo}`
})
</script>
```

Key points: `detectedChord`, `capoFret`, `shapeLabel`, `chordKey` keep the exact names the template already uses. `shapeLabel` now reads `fb.shapeChord.value` directly, but the template only renders it under `v-if="capoFret > 0"`, so it is never evaluated (and never creates a dependency on `fb.shapeChord`) when `capoFret` is 0.

- [ ] **Step 2: Use `emptyHint` in the empty-state template**

In the same file, replace the empty-state block:

```vue
    <div v-else class="empty-state">
      <p>點選指板上的格子來識別和弦</p>
    </div>
```

with:

```vue
    <div v-else class="empty-state">
      <p>{{ emptyHint }}</p>
    </div>
```

Leave the rest of the template and the `<style>` block unchanged.

- [ ] **Step 3: Verify the guitar page is unchanged in the browser**

`preview_start { name: "fret-notes" }`. On `/guitar-to-piano` (renders `<ChordResult />` with no props):
- Press frets to form a chord → the chord name, type name, alternates, component-note pills and interval labels appear exactly as before.
- Clear → empty state shows the original hint "點選指板上的格子來識別和弦".
- Set a capo and press a shape → the `形狀：… · Capo N` subtitle still renders.
- `read_console_messages` → no errors.
Screenshot as proof.

- [ ] **Step 4: Commit**

```bash
git add app/components/ChordResult/index.vue
git commit -m "feat: ChordResult optional chord/capoFret/emptyHint props (backward compatible)"
```

---

### Task 3: Note-map composable chord + page layout swap + toggle flip

**Files:**
- Modify: `app/composables/usePianoNoteMap.ts`
- Modify: `app/pages/piano-to-guitar.vue`

**Interfaces:**
- Consumes: `detectChord` + `ChordResult` type from `~~/core/music-theory/chord-detector`; `midiToPitchClass` from `~~/core/music-theory/notes`; `<ChordResult>` optional props from Task 2.
- Produces: `usePianoNoteMap()` additionally returns `detectedChord: ComputedRef<ChordResult | null>`; `showOffOctave` now defaults to `false`. The page renders piano → ChordResult → GuitarNeck → controls with an opt-in "顯示非同八度亮點" toggle.

- [ ] **Step 1: Update the composable**

Replace the entire contents of `app/composables/usePianoNoteMap.ts` with:

```typescript
import { ref, computed } from 'vue'
import {
  MAX_NOTES,
  nextFreeColor,
  computeLitPositions,
  type LitPosition,
} from '~~/core/music-theory/note-map'
import { detectChord, type ChordResult } from '~~/core/music-theory/chord-detector'
import { midiToPitchClass } from '~~/core/music-theory/notes'

// Singleton state for the piano→guitar page. Independent of useFretboard.
const selectedMidis = ref(new Map<number, number>())  // midi → colorIndex
const showOffOctave = ref(false)                        // off-octave dots hidden by default

// Toggle a note: remove (freeing its color) if present; otherwise assign the
// lowest free color, ignoring the click once MAX_NOTES are already selected.
function toggleNote(midi: number): void {
  if (selectedMidis.value.has(midi)) {
    selectedMidis.value.delete(midi)
    selectedMidis.value = new Map(selectedMidis.value)
    return
  }
  if (selectedMidis.value.size >= MAX_NOTES) return
  const color = nextFreeColor(selectedMidis.value.values())
  if (color === null) return
  selectedMidis.value.set(midi, color)
  selectedMidis.value = new Map(selectedMidis.value)
}

function clear(): void {
  selectedMidis.value = new Map()
}

const litPositions = computed<LitPosition[]>(() =>
  computeLitPositions(selectedMidis.value, showOffOctave.value),
)

// Chord detected from the selected notes. detectChord only needs midi + pitch
// class; the selected notes carry real octaves, so slash chords resolve too.
const detectedChord = computed<ChordResult | null>(() =>
  detectChord(
    [...selectedMidis.value.keys()].map(midi => ({
      midi,
      pitchClass: midiToPitchClass(midi),
    })),
  ),
)

export function usePianoNoteMap() {
  return { selectedMidis, showOffOctave, litPositions, detectedChord, toggleNote, clear }
}
```

- [ ] **Step 2: Rewrite the page (layout swap, chord hint, toggle flip)**

Replace the `<template>` and `<script setup>` of `app/pages/piano-to-guitar.vue` with the following (leave the `<style scoped>` block exactly as it is):

```vue
<template>
  <div class="note-map-page">
    <div class="note-map-piano">
      <PianoKeyboard
        interactive
        :fixed-range="{ startMidi: 40, endMidi: 84 }"
        :active-color-map="selectedMidis"
        @toggle="toggleNote"
      />
    </div>

    <ChordResult :chord="detectedChord" :capo-fret="0" empty-hint="點鋼琴鍵來識別和弦" />

    <GuitarNeck :positions="litPositions" />

    <div class="note-map-controls">
      <label class="control-toggle">
        <input type="checkbox" :checked="showOffOctave" @change="showOffOctave = !showOffOctave" />
        顯示非同八度亮點
      </label>
      <span class="control-count">{{ selectedMidis.size }} / {{ MAX_NOTES }}</span>
      <button class="control-clear" @click="clear">清除</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { usePianoNoteMap } from '~/composables/usePianoNoteMap'
import { MAX_NOTES } from '~~/core/music-theory/note-map'

const { selectedMidis, showOffOctave, litPositions, detectedChord, toggleNote, clear } = usePianoNoteMap()
</script>
```

(`ChordResult`, `GuitarNeck`, `PianoKeyboard` are Nuxt auto-imported — no explicit component imports needed.)

- [ ] **Step 3: Verify the full feature end-to-end in the browser**

`preview_start { name: "fret-notes" }`. On `/piano-to-guitar` (drive the UI with `read_page`/`computer`, or dispatch DOM click events via `javascript_tool` if pixel clicks on the scaled keyboard are unreliable):
- Layout order top-to-bottom is: piano keyboard → chord hint → guitar neck → controls.
- With nothing selected, the chord area shows the empty hint "點鋼琴鍵來識別和弦".
- Select C4 + E4 + G4 → the chord hint shows a C major chord (name + component-note pills + intervals) and the neck lights those positions; the chord updates live as the selection changes.
- Select notes whose lowest is not the root (e.g. E, A, C with E lowest) → the hint shows the slash chord (Am/E).
- Default shows only solid exact-pitch dots (no faded dots). Tick **顯示非同八度亮點** → faded other-octave dots appear; untick → they disappear.
- `n / 6` count and 清除 still work; 清除 empties the neck and returns the empty hint.
- Switch to **從吉他** and back → state is independent; the guitar tool is unaffected.
- Resize to mobile → keyboard and neck scroll horizontally, page body does not overflow.
- `read_console_messages` → no errors. Then run `npx vitest run` → all pass.
Screenshot(s) as proof.

- [ ] **Step 4: Commit**

```bash
git add app/composables/usePianoNoteMap.ts app/pages/piano-to-guitar.vue
git commit -m "feat: note-map chord hint + piano-above-guitar layout + opt-in off-octave"
```

---

## Self-Review

**Spec coverage:**
- Layout swap piano→chord→neck→controls — Task 3 Step 2. ✓
- Off-octave default hidden + opt-in "顯示非同八度亮點" toggle — Task 3 Steps 1–2. ✓
- Chord source from selected notes — Task 3 Step 1 (`detectedChord`). ✓
- `detectChord` param narrowed to `{midi,pitchClass}[]` — Task 1. ✓
- `ChordResult` optional props + fallback + `emptyHint`, guitar page unchanged — Task 2. ✓
- New-page empty hint "點鋼琴鍵來識別和弦"; capoFret=0 passed — Task 3 Step 2. ✓
- No changes to GuitarNeck/PianoKeyboard/variables.css/neck.ts/note-map.ts — respected across all tasks. ✓
- Tests: existing pass after narrowing + new `{midi,pitchClass}` and slash tests — Task 1. ✓
- Capo out of scope — no task touches it. ✓

**Placeholder scan:** No TBD/TODO. Every code step shows full code.

**Type consistency:** `detectChord(notes: {midi:number;pitchClass:number}[])` defined in Task 1, called with that exact shape in Task 3. `ChordResult` type imported in Tasks 2 and 3. `usePianoNoteMap()` return adds `detectedChord`, consumed by the page destructure in Task 3. `<ChordResult>` props (`chord`, `capoFret`, `emptyHint`) defined in Task 2, passed in Task 3 (`:chord`, `:capo-fret`, `empty-hint`). Toggle binding `:checked="showOffOctave"` matches the `showOffOctave` default `false` from Task 3 Step 1.
