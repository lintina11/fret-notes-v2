// Standard tuning MIDI values: E2 A2 D3 G3 B3 E4
export const OPEN_STRINGS = [40, 45, 50, 55, 59, 64]

export const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']

export function midiToPitchClass(midi: number): number {
  return ((midi % 12) + 12) % 12
}

export function midiToNoteName(midi: number): string {
  return NOTE_NAMES[midiToPitchClass(midi)]!
}

export function fretToMidi(stringIndex: number, fret: number): number {
  return OPEN_STRINGS[stringIndex]! + fret
}

export function fretToPitchClass(stringIndex: number, fret: number): number {
  return midiToPitchClass(fretToMidi(stringIndex, fret))
}
