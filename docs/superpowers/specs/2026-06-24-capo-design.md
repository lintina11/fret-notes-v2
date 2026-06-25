# Capo (移調夾) Feature — Design Spec
Date: 2026-06-24

## Overview

Add capo support to the fret-notes guitar chord tool. When a capo is placed at fret N, the capo becomes the new nut: the player fingers shapes relative to the capo, and the tool reports both the **shape name** (the chord shape being fingered, as if the capo were the nut) and the **sounding name** (what actually sounds — the shape transposed up N semitones).

This extends the existing guitar→chord detection. It does not change the core `detectChord` algorithm; capo is expressed entirely through how selected notes are built.

**Scope:** This spec covers capo display only (the "B" use case). Reverse lookup (chord → suggested capo + shapes, "C") is a separate future spec and is out of scope.

---

## Background: current architecture

- `core/music-theory/` — pure chord-detection engine (`detectChord(notes: SelectedNote[]): ChordResult | null`), pitch-class based.
- `app/composables/useFretboard.ts` — singleton reactive state: `pressedFrets: Map<number, number>` (stringIndex → absolute fret), `mutedStrings: Set<number>`. Builds `SelectedNote[]` and exposes `detectedChord`.
- `app/components/Fretboard/index.vue` — SVG chord diagram with a 5-fret display window and ▲▼ navigation (`startFret` 1–8).
- `app/components/ChordResult/index.vue` — renders `detectedChord` (name, slash, alternates, note pills + intervals; "音集" view for unrecognized sets; empty state when null).
- `app/components/PianoKeyboard/index.vue` — read-only 2-octave piano, highlights by **pitch class** (every matching key in the window lights, octave-agnostic).

---

## Capo semantics

Capo at fret `C` (1–7) clamps all strings at fret `C`. For a string:

| String state | Sounding MIDI | Shape MIDI |
|--------------|---------------|------------|
| muted | (excluded) | (excluded) |
| fingered at absolute fret `f` (`f > C`) | `OPEN_STRINGS[s] + f` | `OPEN_STRINGS[s] + (f - C)` |
| open (unfingered, unmuted) | `OPEN_STRINGS[s] + C` | `OPEN_STRINGS[s] + 0` |

So **shape = sounding transposed down by `C` semitones**. When `C = 0` (no capo), shape and sounding are identical and behavior matches the current app exactly.

The displayed **sounding** chord = `detectChord(soundingNotes)`; the **shape** chord = `detectChord(shapeNotes)`. Running detection independently on each note set yields fully-formatted results (including slash chords and alternates) for both, with no fragile string transposition.

**Capo range:** 0–7 (0 = no capo).

---

## Components

### `core/music-theory/fretboard.ts` (new)

```ts
import type { SelectedNote } from './chord-detector'

export type NoteMode = 'sounding' | 'shape'

// pressedFrets: stringIndex → absolute fret (f > capoFret for valid presses)
// capoFret: 0–7
export function buildSelectedNotes(
  pressedFrets: Map<number, number>,
  mutedStrings: Set<number>,
  capoFret: number,
  mode: NoteMode,
): SelectedNote[]
```

Per string (0–5):
- muted → skip
- fingered at absolute `f` → sounding `OPEN_STRINGS[s] + f`; shape `OPEN_STRINGS[s] + (f - capoFret)`
- open (not pressed, not muted) → sounding `OPEN_STRINGS[s] + capoFret`; shape `OPEN_STRINGS[s] + 0`

Each note carries `{ stringIndex, fret, midi, pitchClass, noteName }` (`fret` = the absolute fret for fingered, 0 for open — same convention as today). Pure and unit-tested.

This **replaces** the inline `getSelectedNotes` currently in `useFretboard.ts`. With `capoFret = 0`, either mode reproduces the existing behavior.

### `app/composables/useFretboard.ts` (modified)

New state and exports:

```ts
const capoFret = ref(0)   // 0–7, singleton

const detectedChord = computed(() =>          // SOUNDING — drives piano + primary name
  detectChord(buildSelectedNotes(pressedFrets.value, mutedStrings.value, capoFret.value, 'sounding'))
)
const shapeChord = computed(() =>             // SHAPE — drives the subtitle
  detectChord(buildSelectedNotes(pressedFrets.value, mutedStrings.value, capoFret.value, 'shape'))
)

function setCapo(fret: number): void          // clamp to 0–7
```

- `setCapo`: clamps to 0–7. After setting, clears any pressed fret with `absoluteFret <= capoFret` (now below/at the capo — invalid), mirroring the existing `navigate()` cleanup pattern.
- `clearAll`: also resets `capoFret` to 0.
- Exports: `{ pressedFrets, mutedStrings, capoFret, detectedChord, shapeChord, toggleFret, toggleMute, setCapo, clearAll }`.

### `app/components/Fretboard/index.vue` (modified)

**Capo stepper** in the nav row, matching the existing ▲▼ style but laid out horizontally:
```
Capo: ▼ 0 ▲      (0–7; 0 may render as "0"/"Off")
```
Calls `setCapo`.

**Visual (when capo fret N is within the visible window):**
- Draw a capo bar at fret N using `--color-accent` (coral), visually distinct from the nut and regular fret lines.
- Frets 1…N (inclusive of the capo fret) are dimmed (greyed overlay/fill).
- Click targets for dimmed frets are disabled: a cell is clickable only when it is in the display window AND its fret `> capoFret`.
- Open-string markers (circle/×) keep their current semantics; the open circle now represents the capo-fret pitch.

**Scroll edge case:**
- If the capo is above the visible window (e.g. capo 2, window showing frets 6–10), nothing is dimmed (all visible frets are above the capo and playable); show a small "Capo N" indicator (e.g. in/near the nav label) so the user knows the capo is still active.
- The capo can never be below the visible window: `capoFret ≤ 7` and the lowest `startFret` is 8, so when scrolled to the bottom the capo is always above the window.

**Interaction limits:**
- `toggleFret` is only invoked for frets `> capoFret` (UI prevents tapping dimmed cells).
- Changing the capo clears presses at/below it (handled by `setCapo`).

### `app/components/ChordResult/index.vue` (modified)

**Capo = 0:** unchanged — single chord name, exactly as today.

**Capo > 0:**
```
┌──────────────────────────────┐
│  D                           │  ← large: SOUNDING name (detectedChord)
│  也可能是 …                  │  ← SOUNDING alternates
│  形狀：C · Capo 2            │  ← small subtitle: shapeChord name + capo fret
├──────────────────────────────┤
│  組成音  D  F#  A            │  ← SOUNDING note pills + interval labels
└──────────────────────────────┘
```
- Large name, note pills, intervals, alternates all use **`detectedChord`** (sounding).
- Subtitle uses **`shapeChord`**: `形狀：{shapeChord.root}{shapeChord.symbol} · Capo {capoFret}`.
- Unrecognized set + capo: the large area uses the sounding "音集" view (as today); the subtitle shows `形狀：(音集) · Capo {capoFret}` (or, if shape is also unrecognized, simply `Capo {capoFret}`).
- Empty state (no notes) unchanged.

### `app/components/PianoKeyboard/index.vue` — no change

Already consumes `detectedChord.notes`, which is now the sounding chord. Sounding pitch classes highlight correctly. (Pitch-class-only highlighting is a known existing limitation — see Out of Scope.)

---

## Data flow

```
user taps fret / sets capo
  → useFretboard updates pressedFrets / capoFret
  → buildSelectedNotes(..., 'sounding') → detectChord → detectedChord → ChordResult (big) + PianoKeyboard
  → buildSelectedNotes(..., 'shape')    → detectChord → shapeChord    → ChordResult (subtitle)
```

---

## Testing

**Unit (`tests/music-theory/fretboard.test.ts`, new):**
- capo = 0: sounding and shape both equal the pre-capo note set (open strings at fret 0, fingered at absolute fret).
- capo = 2, a fingered string at absolute fret 4: sounding MIDI = open+4, shape MIDI = open+2.
- capo = 2, an open (unfingered) string: sounding MIDI = open+2, shape MIDI = open+0.
- muted strings excluded in both modes.
- shape == sounding transposed down by capoFret (pitch-class check across a sample chord).
- A real example: open C-shape fingering with capo 2 → shape detects as C major, sounding detects as D major.

**Existing tests:** `detectChord` and the 40 current tests are unchanged and must still pass (capo logic lives outside `detectChord`).

**Build gate:** `npx nuxi typecheck` 0 errors; `npm run generate` succeeds; dev server renders.

---

## Out of scope (future specs)

- **Reverse lookup (C):** chord → suggested capo position + list of possible shapes.
- **Octave-accurate piano voicing:** the piano highlights by pitch class only; making it show true sounding octaves requires carrying MIDI/octave through `NoteInfo` + `detectChord` and redesigning the keyboard range. Independent of capo; deferred.
- Alternate tunings, drop tunings.

---

## Constraints

- Nuxt 4 (srcDir `app/`; `~`→app, `~~`→repo root); `core/` + `tests/` at repo root; app imports core via `~~/core/…`.
- TypeScript strict incl. `noUncheckedIndexedAccess` — provably-in-bounds index access uses `!`; verify with `npx nuxi typecheck`.
- No external music-theory libraries.
- All colors via CSS variables (existing tokens incl. `--color-accent`); no hardcoded hex.
- Touch targets ≥ 44px.
- `capoFret = 0` must reproduce current behavior exactly (backward compatible).
