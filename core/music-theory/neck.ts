import { OPEN_STRINGS, midiToPitchClass } from './notes'

// Full-neck length for the note-map reference diagram.
export const NECK_FRETS = 20

export interface Position {
  stringIndex: number
  fret: number
}

// Every (string, fret) on a NECK_FRETS board (standard tuning) that sounds
// exactly `midi`. Includes open strings (fret 0). Ordered by string index.
export function findExactPositions(midi: number, maxFret = NECK_FRETS): Position[] {
  const out: Position[] = []
  for (let s = 0; s < OPEN_STRINGS.length; s++) {
    const fret = midi - OPEN_STRINGS[s]!
    if (fret >= 0 && fret <= maxFret) out.push({ stringIndex: s, fret })
  }
  return out
}

// Every (string, fret) whose pitch class equals `pc`. Ordered by string, then fret.
export function findPitchClassPositions(pc: number, maxFret = NECK_FRETS): Position[] {
  const out: Position[] = []
  for (let s = 0; s < OPEN_STRINGS.length; s++) {
    for (let fret = 0; fret <= maxFret; fret++) {
      if (midiToPitchClass(OPEN_STRINGS[s]! + fret) === pc) out.push({ stringIndex: s, fret })
    }
  }
  return out
}
