import { OPEN_STRINGS, midiToPitchClass, midiToNoteName } from './notes'
import type { SelectedNote } from './chord-detector'

export type NoteMode = 'sounding' | 'shape'

// Fretboard physical limit: with DISPLAY_FRETS=5 and MAX_START_FRET=8 the
// lowest visible fret is 12.
export const MAX_FRET = 12

// Build the notes that sound (or that the shape implies) given a capo.
// pressedFrets: stringIndex → absolute fret (callers ensure fret > capoFret)
// capoFret: 0–7 (0 = no capo)
//
// sounding: open string sounds at the capo fret; fingered string sounds at its absolute fret
// shape:    capo is treated as the nut, so subtract capoFret (open → fret 0)
export function buildSelectedNotes(
  pressedFrets: Map<number, number>,
  mutedStrings: Set<number>,
  capoFret: number,
  mode: NoteMode,
): SelectedNote[] {
  const notes: SelectedNote[] = []

  // Pressed strings first, preserving Map iteration order (matches prior behavior)
  for (const [s, f] of pressedFrets) {
    if (mutedStrings.has(s)) continue
    const midi = OPEN_STRINGS[s]! + (mode === 'sounding' ? f : f - capoFret)
    notes.push({
      stringIndex: s,
      fret: f,
      midi,
      pitchClass: midiToPitchClass(midi),
      noteName: midiToNoteName(midi),
    })
  }

  // Then open (unpressed, unmuted) strings in string-index order
  for (let s = 0; s < OPEN_STRINGS.length; s++) {
    if (pressedFrets.has(s) || mutedStrings.has(s)) continue
    const midi = OPEN_STRINGS[s]! + (mode === 'sounding' ? capoFret : 0)
    notes.push({
      stringIndex: s,
      fret: 0,
      midi,
      pitchClass: midiToPitchClass(midi),
      noteName: midiToNoteName(midi),
    })
  }

  return notes
}

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
