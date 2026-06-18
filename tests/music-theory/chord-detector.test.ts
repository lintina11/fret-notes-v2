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

  // --- New tests ---

  it('returns unrecognized result for C+D (interval [0,2] matches no chord rule)', () => {
    // C(0) + D(2): interval set [0,2] is not in CHORD_RULES (only [0,7] power chord is a dyad)
    const notes: SelectedNote[] = [
      { stringIndex: 0, fret: 8, midi: 48, pitchClass: 0, noteName: 'C' },
      { stringIndex: 0, fret: 10, midi: 50, pitchClass: 2, noteName: 'D' },
    ]
    const result = detectChord(notes)
    expect(result).not.toBeNull()
    expect(result!.unrecognized).toBe(true)
    expect(result!.name).toBe('')
    const noteNames = result!.notes.map(n => n.noteName)
    expect(noteNames).toContain('C')
    expect(noteNames).toContain('D')
  })

  it('alternates are capped at 2 for augmented triad (3 valid root interpretations)', () => {
    // C(0) E(4) G#(8) — augmented triad: every note can be the root (Caug, Eaug, G#aug)
    // Without cap: 2 alternates. With cap at slice(1,3): still 2. Ensures cap is enforced.
    const notes: SelectedNote[] = [
      { stringIndex: 0, fret: 8,  midi: 48, pitchClass: 0, noteName: 'C' },
      { stringIndex: 0, fret: 12, midi: 52, pitchClass: 4, noteName: 'E' },
      { stringIndex: 0, fret: 16, midi: 56, pitchClass: 8, noteName: 'G#' },
    ]
    const result = detectChord(notes)
    expect(result).not.toBeNull()
    // Exactly 2: the augmented triad has 3 root interpretations (primary + 2),
    // so this both confirms the cap holds AND that alternates aren't dropped to 0.
    expect(result!.alternates.length).toBe(2)
  })

  it('alternates are formatted as root+symbol[/bass] for augmented triad with C as lowest note', () => {
    // C(0) lowest midi=48, E(4) midi=52, G#(8) midi=56
    // Primary = Caug (bass=null), alternates = Eaug/C and G#aug/C
    const notes: SelectedNote[] = [
      { stringIndex: 0, fret: 8,  midi: 48, pitchClass: 0, noteName: 'C' },
      { stringIndex: 0, fret: 12, midi: 52, pitchClass: 4, noteName: 'E' },
      { stringIndex: 0, fret: 16, midi: 56, pitchClass: 8, noteName: 'G#' },
    ]
    const result = detectChord(notes)
    expect(result).not.toBeNull()
    expect(result!.root).toBe('C')
    expect(result!.symbol).toBe('aug')
    // Alternates should be Eaug/C and G#aug/C (other roots with C as bass)
    expect(result!.alternates).toContain('Eaug/C')
    expect(result!.alternates).toContain('G#aug/C')
  })
})
