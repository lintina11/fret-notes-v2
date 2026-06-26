# Capo Relative-Transpose Logic — Design Spec
Date: 2026-06-25

## Overview

Change how the capo interacts with the fingered shape. Today the capo is a fixed barrier: raising it **clears** any pressed note at or below the new capo fret, destroying part of the shape. This spec changes the capo into a **relative transpose**: the capo and the fingered shape move together, so raising/lowering the capo shifts the whole shape by the same number of frets. From the player's view the shape (and its position on screen) stays put — only the key changes.

**Example:** Finger a C shape at capo 0, then set capo 1. Every pressed note moves up one fret along with the capo; the shape is still a "C shape" but now sounds as C#. Nothing in the shape is cleared.

This is a behavior change to the existing capo feature (shipped on `main`). It does **not** change the sounding/shape chord detection model, the dual-name display, the capo bar, or the dimming — those already follow naturally once the presses and capo shift together.

---

## Current architecture (unchanged pieces)

- `core/music-theory/fretboard.ts` — `buildSelectedNotes(pressedFrets, mutedStrings, capoFret, mode)` builds the note set for `'sounding'` or `'shape'`. **Unchanged.**
- `app/composables/useFretboard.ts` — singleton state `pressedFrets: Map<number, number>` (stringIndex → absolute fret), `mutedStrings`, `capoFret` (0–7); computes `detectedChord` (sounding) and `shapeChord` (shape). Only `setCapo` changes.
- `app/components/Fretboard/index.vue` — SVG diagram with a 5-fret window (`startFret` 1–8, `DISPLAY_FRETS = 5`, `MAX_START_FRET = 8`), capo stepper, capo bar, dimming of frets ≤ capo, Position ▲▼ scroll. Adds one capo watcher.
- `app/components/ChordResult/index.vue` — sounding name + shape subtitle. **Unchanged.**

Because `detectedChord` (sounding) and `shapeChord` (shape) are pure functions of `pressedFrets` + `capoFret`, shifting both by the same delta makes the sounding chord transpose by that delta and leaves the shape name invariant — automatically, with no edit to detection.

---

## The change

### 1. `core/music-theory/fretboard.ts` — new pure helper

```ts
// Shift every pressed fret by `delta`. A press shifted above `maxFret`
// (pushed off the end of the neck) is dropped — lossy, not remembered.
// A press shifted below fret 1 is also dropped (defensive; should not occur
// in normal capo use). Returns a NEW Map; the input is not mutated.
export function transposePressedFrets(
  pressedFrets: Map<number, number>,
  delta: number,
  maxFret: number,
): Map<number, number>
```

Logic: for each `[stringIndex, fret]`, compute `next = fret + delta`; keep it only when `1 <= next <= maxFret`; collect survivors into a new `Map`.

`maxFret` is the fretboard's physical limit, **12** (with `DISPLAY_FRETS = 5`, `MAX_START_FRET = 8`, the lowest window bottom is fret 12). Expose a `MAX_FRET = 12` constant in this module for reuse.

### 2. `app/composables/useFretboard.ts` — rewrite `setCapo`

Replace the current "clamp, then clear presses `<= newCapo`" body with a relative transpose:

```ts
function setCapo(fret: number): void {
  const next = Math.min(MAX_CAPO, Math.max(0, fret))   // clamp 0–7
  const delta = next - capoFret.value
  if (delta === 0) return
  capoFret.value = next
  pressedFrets.value = transposePressedFrets(pressedFrets.value, delta, MAX_FRET)
}
```

- Raising the capo shifts all presses up by `delta` (shape rises, sounding key rises).
- Lowering shifts all presses down by `delta`.
- Notes pushed past fret 12 are dropped by `transposePressedFrets`.
- `detectedChord`, `shapeChord`, `clearAll` (resets capo to 0), `toggleFret`, `toggleMute` — all unchanged.

### 3. `app/components/Fretboard/index.vue` — viewport follows the capo

Add a watcher so the display window shifts with the capo, keeping the capo bar and the shape at the same screen position:

```ts
watch(capoFret, (newCapo, oldCapo) => {
  const delta = newCapo - oldCapo
  startFret.value = Math.min(MAX_START_FRET, Math.max(1, startFret.value + delta))
})
```

- With no manual scrolling, the window naturally stays at `startFret = capoFret + 1` (capo 0 → frets 1–5, capo 1 → 2–6, capo 2 → 3–7, …) — the desired default view.
- Position ▲▼ still scrolls independently, so the player can finger high-position shapes (e.g. capo 2 while fingering frets 8–10); on a capo change the window shifts with the shape, keeping it on screen.
- Everything else in the component (capo stepper, capo bar, dimming/disabling frets ≤ capo, press-above-capo guard, `navigate()`) is unchanged.

---

## Behavior & boundaries

1. **Lossy transpose:** a note pushed past fret 12 is dropped and is **not** remembered or restored when the capo is later lowered.
2. **Viewport clamp:** `startFret` is clamped to 1–8. If the window is already scrolled to the bottom (`startFret = 8`) and the capo rises, the follow is imperfect by one row (the shape shifts one row on screen). Rare edge; acceptable.
3. **Clear / 清除 button:** `clearAll` sets capo to 0; `handleClear` then sets `startFret = 1` explicitly (after `clearAll`), so the final view is the open position regardless of the watcher's transient shift.
4. **Position scroll:** manual Position ▲▼ still clears presses that scroll out of the visible window (existing behavior, unchanged).
5. **Lower bound:** presses always sit above the capo; lowering the capo shifts them down but they remain ≥ 1, so the lower-bound drop in `transposePressedFrets` is defensive only.

---

## Testing

**Unit (`tests/music-theory/fretboard.test.ts`, extend):** `transposePressedFrets`
- shift up: `{1:3, 2:5}` delta +2 → `{1:5, 2:7}`
- shift down: `{1:5}` delta −1 → `{1:4}`
- drop above maxFret: `{0:11, 1:10}` delta +2, maxFret 12 → `{1:12}` (11+2=13 dropped, 10+2=12 kept)
- all pushed off: every press > maxFret → empty Map
- defensive lower drop: a press whose `fret + delta < 1` → dropped
- input Map not mutated (the returned Map is a new object)

**Unchanged:** the 6 existing `buildSelectedNotes` tests and all `detectChord` tests stay green (their logic is untouched).

**Build gate:** `npx nuxi typecheck` 0 errors; `npm test` all pass; `npm run generate` succeeds; preview HTTP 200.

---

## Out of scope

- The sounding/shape detection model, dual-name display, capo bar visuals, dimming, and capo range (0–7) are unchanged.
- Octave-accurate piano voicing and reverse lookup remain deferred (separate future specs).

---

## Constraints

- Nuxt 4 (srcDir `app/`; `~`→app, `~~`→repo root); `core/` + `tests/` at repo root; app imports core via `~~/core/…`; tests import core via relative path.
- TypeScript strict incl. `noUncheckedIndexedAccess`; verify with `npx nuxi typecheck`.
- No external music-theory libraries.
- All colors via CSS variables; no hardcoded hex (no new styling expected in this change).
- Capo range 0–7; fretboard max fret 12.
