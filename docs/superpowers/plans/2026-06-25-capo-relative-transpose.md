# Capo Relative-Transpose Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Change the capo from a fixed barrier (that clears notes under it) into a relative transpose: the capo and the fingered shape move together, so raising/lowering the capo shifts the whole shape by the same number of frets and only the key changes.

**Architecture:** A new pure `transposePressedFrets` helper in `core/music-theory/fretboard.ts` shifts all pressed frets by a delta (dropping any pushed off the neck). The composable's `setCapo` calls it instead of clearing notes. The Fretboard adds a `watch` on `capoFret` that shifts the display window (`startFret`) by the same delta so the shape stays on screen. Chord detection, dual-name display, capo bar, and dimming are unchanged.

**Tech Stack:** Nuxt 4, Vue 3, TypeScript, Vitest.

## Global Constraints

- Nuxt 4 (srcDir `app/`; `~`→app, `~~`→repo root); `core/` + `tests/` at repo root; app imports core via `~~/core/…`; tests import core via relative path.
- TypeScript strict incl. `noUncheckedIndexedAccess` — verify with `npx nuxi typecheck` (0 errors). Vitest (node) does NOT replicate this; run `nuxi typecheck` for the composable/component tasks.
- No external music-theory libraries.
- Capo range 0–7; fretboard max fret `MAX_FRET = 12`; window `DISPLAY_FRETS = 5`, `MAX_START_FRET = 8`.
- All colors via CSS variables; no hardcoded hex (no new styling in this change).
- Existing test suite is 46 tests; it must stay green throughout.
- Behavior change is intentional: `setCapo` must NO LONGER clear notes at/below the capo; it must shift them.

---

## File Map

```
core/music-theory/fretboard.ts   # MODIFY — add MAX_FRET + transposePressedFrets
tests/music-theory/fretboard.test.ts # MODIFY — add transposePressedFrets tests
app/composables/useFretboard.ts  # MODIFY — rewrite setCapo to transpose, not clear
app/components/Fretboard/index.vue # MODIFY — add capoFret watcher to shift startFret
```

---

## Task 1: Core — `transposePressedFrets`

**Files:**
- Modify: `core/music-theory/fretboard.ts`
- Test: `tests/music-theory/fretboard.test.ts`

**Interfaces:**
- Produces:
  - `MAX_FRET = 12` (exported const)
  - `transposePressedFrets(pressedFrets: Map<number, number>, delta: number, maxFret: number): Map<number, number>` — returns a NEW Map with every fret shifted by `delta`; drops any entry whose shifted fret is `< 1` or `> maxFret`; does not mutate the input.

- [ ] **Step 1: Write the failing tests**

In `tests/music-theory/fretboard.test.ts`, first widen the existing import line:

```ts
import { buildSelectedNotes } from '../../core/music-theory/fretboard'
```

to:

```ts
import { buildSelectedNotes, transposePressedFrets, MAX_FRET } from '../../core/music-theory/fretboard'
```

Then append this new `describe` block at the end of the file (keep all existing tests):

```ts
describe('transposePressedFrets', () => {
  it('shifts all frets up by delta', () => {
    const input = new Map<number, number>([[1, 3], [2, 5]])
    const result = transposePressedFrets(input, 2, 12)
    expect([...result.entries()].sort()).toEqual([[1, 5], [2, 7]])
  })

  it('shifts all frets down by delta', () => {
    const result = transposePressedFrets(new Map([[1, 5]]), -1, 12)
    expect(result.get(1)).toBe(4)
  })

  it('drops frets pushed above maxFret, keeps those at maxFret', () => {
    const input = new Map<number, number>([[0, 11], [1, 10]])
    const result = transposePressedFrets(input, 2, 12) // 11+2=13 dropped, 10+2=12 kept
    expect(result.has(0)).toBe(false)
    expect(result.get(1)).toBe(12)
  })

  it('returns an empty Map when every fret is pushed off the neck', () => {
    const result = transposePressedFrets(new Map([[1, 12], [2, 11]]), 2, 12)
    expect(result.size).toBe(0)
  })

  it('drops frets shifted below fret 1 (defensive)', () => {
    const result = transposePressedFrets(new Map([[1, 1]]), -1, 12) // 1-1=0 < 1
    expect(result.has(1)).toBe(false)
  })

  it('does not mutate the input Map and returns a new object', () => {
    const input = new Map<number, number>([[1, 3]])
    const result = transposePressedFrets(input, 2, 12)
    expect(input.get(1)).toBe(3)   // unchanged
    expect(result).not.toBe(input) // new object
  })

  it('exports MAX_FRET = 12', () => {
    expect(MAX_FRET).toBe(12)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/music-theory/fretboard.test.ts`
Expected: FAIL — `transposePressedFrets`/`MAX_FRET` are not exported.

- [ ] **Step 3: Implement in `core/music-theory/fretboard.ts`**

Add near the top of the file, right after the `export type NoteMode = 'sounding' | 'shape'` line:

```ts
// Fretboard physical limit: with DISPLAY_FRETS=5 and MAX_START_FRET=8 the
// lowest visible fret is 12.
export const MAX_FRET = 12
```

Add at the END of the file (after `buildSelectedNotes`):

```ts
// Shift every pressed fret by `delta`. A press shifted above `maxFret`
// (pushed off the end of the neck) or below fret 1 is dropped — lossy, not
// remembered. Returns a NEW Map; the input is not mutated.
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
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/music-theory/fretboard.test.ts`
Expected: PASS (existing buildSelectedNotes tests + 7 new transposePressedFrets tests).

- [ ] **Step 5: Full suite + typecheck**

Run: `npm test` → expect 53 passing (46 existing + 7 new).
Run: `npx nuxi typecheck` → 0 errors.

- [ ] **Step 6: Commit**

```bash
git add core/music-theory/fretboard.ts tests/music-theory/fretboard.test.ts
git commit -m "feat: transposePressedFrets core helper for relative capo shift"
```

---

## Task 2: Composable — rewrite `setCapo` to transpose

**Files:**
- Modify: `app/composables/useFretboard.ts`

**Interfaces:**
- Consumes: `transposePressedFrets`, `MAX_FRET` from `~~/core/music-theory/fretboard` (Task 1).
- Produces: `setCapo(fret: number): void` — same signature; new behavior (shift presses by the capo delta instead of clearing presses ≤ capo).

**Behavior:** the OLD `setCapo` cleared every pressed fret `<= newCapo`. The NEW `setCapo` clamps to 0–7, computes `delta = next - capoFret`, and shifts ALL presses by `delta` (dropping any pushed past fret 12). No notes are cleared just for being near the capo.

- [ ] **Step 1: Update the import line**

In `app/composables/useFretboard.ts`, the current import is:

```ts
import { buildSelectedNotes } from '~~/core/music-theory/fretboard'
```

Replace it with:

```ts
import { buildSelectedNotes, transposePressedFrets, MAX_FRET } from '~~/core/music-theory/fretboard'
```

- [ ] **Step 2: Replace the `setCapo` function**

Replace the entire current `setCapo` function:

```ts
function setCapo(fret: number): void {
  const next = Math.min(MAX_CAPO, Math.max(0, fret))
  capoFret.value = next
  // Clear any pressed fret now at or below the capo (invalid positions)
  let changed = false
  for (const s of [...pressedFrets.value.keys()]) {
    const f = pressedFrets.value.get(s)!
    if (f <= next) {
      pressedFrets.value.delete(s)
      changed = true
    }
  }
  if (changed) pressedFrets.value = new Map(pressedFrets.value)
}
```

with:

```ts
function setCapo(fret: number): void {
  const next = Math.min(MAX_CAPO, Math.max(0, fret))
  const delta = next - capoFret.value
  if (delta === 0) return
  capoFret.value = next
  // Capo and shape move together: shift every press by the same delta.
  // Notes pushed past the last fret are dropped (lossy).
  pressedFrets.value = transposePressedFrets(pressedFrets.value, delta, MAX_FRET)
}
```

(`MAX_CAPO = 7` is already defined in this file; `clearAll`, the computeds, and the exports are unchanged.)

- [ ] **Step 3: Typecheck**

Run: `npx nuxi typecheck`
Expected: 0 errors.

- [ ] **Step 4: Full suite + dev smoke**

Run: `npm test` → expect 53 passing (unchanged — composable has no unit tests; transpose logic covered by Task 1).
Start `npm run dev`, wait for ready, `curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/` → 200, then stop dev.

- [ ] **Step 5: Commit**

```bash
git add app/composables/useFretboard.ts
git commit -m "feat: setCapo transposes the shape relative to the capo instead of clearing notes"
```

---

## Task 3: Fretboard — viewport follows the capo

**Files:**
- Modify: `app/components/Fretboard/index.vue`

**Interfaces:**
- Consumes: `capoFret` (already destructured from `useFretboard()`), `startFret` (local ref), `MAX_START_FRET` (local const = 8).

**Behavior:** when `capoFret` changes, shift `startFret` by the same delta (clamped 1–8) so the capo bar and the shape stay at the same on-screen position. With no manual scrolling this keeps the window at `startFret = capoFret + 1` (capo 0 → frets 1–5, capo 1 → 2–6, …). Position ▲▼ still scrolls independently; on a capo change the window follows the shape so high-position fingerings stay visible.

- [ ] **Step 1: Add `watch` to the Vue import**

In `app/components/Fretboard/index.vue`, change:

```ts
import { ref, computed } from 'vue'
```

to:

```ts
import { ref, computed, watch } from 'vue'
```

- [ ] **Step 2: Add the capo watcher**

In the `<script setup>` block, immediately AFTER the `displayFretNums` computed definition:

```ts
const displayFretNums = computed<number[]>(() =>
  Array.from({ length: DISPLAY_FRETS }, (_, i) => startFret.value + i)
)
```

add:

```ts
// Viewport follows the capo: shift the window by the same delta as the capo
// so the capo bar and the shape stay at the same on-screen position. With no
// manual Position scrolling this keeps startFret = capoFret + 1.
watch(capoFret, (newCapo, oldCapo) => {
  const delta = newCapo - oldCapo
  startFret.value = Math.min(MAX_START_FRET, Math.max(1, startFret.value + delta))
})
```

Note: `handleClear` already calls `clearAll()` then sets `startFret.value = 1`. When `clearAll` resets `capoFret` to 0 the watcher fires, but `handleClear`'s explicit `startFret = 1` runs after and wins — so the clear button still returns to the open position. Do not change `handleClear`.

- [ ] **Step 3: Typecheck + dev verification**

Run: `npx nuxi typecheck` → 0 errors.
Start `npm run dev`, wait for ready, `curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/` → 200, then stop dev.
Run: `npm test` → 53 passing (unchanged).

- [ ] **Step 4: Commit**

```bash
git add app/components/Fretboard/index.vue
git commit -m "feat: fretboard window follows the capo so the shape stays on screen"
```

---

## Task 4: End-to-end verification

**Files:** none (verification only).

- [ ] **Step 1: Full suite**

Run: `npm test`
Expected: 53 passing (46 original + 7 new transpose tests).

- [ ] **Step 2: Typecheck**

Run: `npx nuxi typecheck`
Expected: 0 errors.

- [ ] **Step 3: Production build**

Run: `npm run generate`
Expected: completes with no errors; output in `.output/public`.

- [ ] **Step 4: Preview smoke test**

Serve the generated output (`npx serve .output/public`), confirm HTTP 200 and the page contains `capo-row` and `fret notes`, then stop the preview server.

- [ ] **Step 5: No commit needed** (verification only; `.output` is gitignored).
