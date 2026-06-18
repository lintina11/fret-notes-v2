import { describe, it, expect } from 'vitest'
import { detectChord, type SelectedNote } from '../../core/music-theory/chord-detector'
import { fretToMidi, midiToPitchClass, midiToNoteName } from '../../core/music-theory/notes'

function makeNote(stringIndex: number, fret: number): SelectedNote {
  const midi = fretToMidi(stringIndex, fret)
  return { stringIndex, fret, midi, pitchClass: midiToPitchClass(midi), noteName: midiToNoteName(midi) }
}

describe('detectChord', () => {
  it('returns null for empty notes', () => {
    expect(detectChord([])).toBeNull()
  })

  it('returns null for single note', () => {
    expect(detectChord([makeNote(0, 0)])).toBeNull()
  })

  it('detects Am: pitch classes A(9) C(0) E(4)', () => {
    // A minor = A(9) C(0) E(4)
    const amNotes: SelectedNote[] = [
      { stringIndex: 0, fret: 5,  midi: 45, pitchClass: 9, noteName: 'A' }, // low A (lowest = root)
      { stringIndex: 5, fret: 0,  midi: 64, pitchClass: 4, noteName: 'E' }, // high E
      { stringIndex: 4, fret: 1,  midi: 60, pitchClass: 0, noteName: 'C' }, // C
    ]
    const result = detectChord(amNotes)
    expect(result).not.toBeNull()
    expect(result!.root).toBe('A')
    expect(result!.symbol).toBe('m')
    expect(result!.bassNote).toBeNull() // lowest note A is the root
  })

  it('detects slash chord Am/E when lowest note is E', () => {
    const amNotes: SelectedNote[] = [
      { stringIndex: 0, fret: 0,  midi: 40, pitchClass: 4, noteName: 'E' }, // low E (lowest)
      { stringIndex: 1, fret: 0,  midi: 45, pitchClass: 9, noteName: 'A' },
      { stringIndex: 4, fret: 1,  midi: 60, pitchClass: 0, noteName: 'C' },
    ]
    const result = detectChord(amNotes)
    expect(result).not.toBeNull()
    expect(result!.root).toBe('A')
    expect(result!.bassNote).toBe('E')
  })

  it('detects C major: C(0) E(4) G(7)', () => {
    const cNotes: SelectedNote[] = [
      { stringIndex: 0, fret: 8, midi: 48, pitchClass: 0, noteName: 'C' },
      { stringIndex: 1, fret: 7, midi: 52, pitchClass: 4, noteName: 'E' },
      { stringIndex: 2, fret: 5, midi: 55, pitchClass: 7, noteName: 'G' },
    ]
    const result = detectChord(cNotes)
    expect(result).not.toBeNull()
    expect(result!.root).toBe('C')
    expect(result!.symbol).toBe('')
    expect(result!.bassNote).toBeNull()
  })

  it('result notes contain interval info', () => {
    const amNotes: SelectedNote[] = [
      { stringIndex: 0, fret: 5,  midi: 45, pitchClass: 9, noteName: 'A' },
      { stringIndex: 5, fret: 0,  midi: 64, pitchClass: 4, noteName: 'E' },
      { stringIndex: 4, fret: 1,  midi: 60, pitchClass: 0, noteName: 'C' },
    ]
    const result = detectChord(amNotes)!
    const noteNames = result.notes.map(n => n.noteName)
    expect(noteNames).toContain('A')
    expect(noteNames).toContain('C')
    expect(noteNames).toContain('E')
  })
})
