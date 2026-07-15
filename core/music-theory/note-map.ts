import { OPEN_STRINGS, midiToPitchClass, midiToNoteName, midiToOctave } from './notes'
import { findExactPositions, findPitchClassPositions, type Position } from './neck'

export const MAX_NOTES = 6
export const NOTE_PALETTE_SIZE = 6

export interface LitPosition {
  stringIndex: number
  fret: number
  noteName: string
  octave: number
  colorIndex: number
  dim: boolean
}

// Lowest palette index (0..NOTE_PALETTE_SIZE-1) not already in use, or null if full.
export function nextFreeColor(usedColors: Iterable<number>): number | null {
  const used = new Set(usedColors)
  for (let i = 0; i < NOTE_PALETTE_SIZE; i++) {
    if (!used.has(i)) return i
  }
  return null
}

function posKey(p: Position): string {
  return `${p.stringIndex}:${p.fret}`
}

function toLit(p: Position, colorIndex: number, dim: boolean): LitPosition {
  const midi = OPEN_STRINGS[p.stringIndex]! + p.fret
  return {
    stringIndex: p.stringIndex,
    fret: p.fret,
    noteName: midiToNoteName(midi),
    octave: midiToOctave(midi),
    colorIndex,
    dim,
  }
}

// Every fret position to light for the currently selected notes.
// `selected` maps a MIDI note to its palette color index.
// Exact-pitch positions are solid (dim=false); when `showOffOctave` is on,
// same-pitch-class positions in other octaves are added dim (dim=true),
// excluding any that are already exact.
export function computeLitPositions(
  selected: Map<number, number>,
  showOffOctave: boolean,
): LitPosition[] {
  const out: LitPosition[] = []
  for (const [midi, colorIndex] of selected) {
    const exact = findExactPositions(midi)
    const exactKeys = new Set(exact.map(posKey))
    for (const p of exact) out.push(toLit(p, colorIndex, false))

    if (showOffOctave) {
      const pc = midiToPitchClass(midi)
      for (const p of findPitchClassPositions(pc)) {
        if (exactKeys.has(posKey(p))) continue
        out.push(toLit(p, colorIndex, true))
      }
    }
  }
  return out
}
