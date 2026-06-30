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
