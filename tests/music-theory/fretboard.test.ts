import { describe, it, expect } from 'vitest'
import { buildSelectedNotes } from '../../core/music-theory/fretboard'
import { detectChord } from '../../core/music-theory/chord-detector'

// Helper: find the built note for a given string
function noteFor(notes: ReturnType<typeof buildSelectedNotes>, stringIndex: number) {
  return notes.find(n => n.stringIndex === stringIndex)
}

describe('buildSelectedNotes', () => {
  it('capo 0: open string sounds at fret 0 in both modes', () => {
    const sounding = buildSelectedNotes(new Map(), new Set(), 0, 'sounding')
    const shape = buildSelectedNotes(new Map(), new Set(), 0, 'shape')
    // String 0 open = E2 = MIDI 40 in both modes
    expect(noteFor(sounding, 0)!.midi).toBe(40)
    expect(noteFor(shape, 0)!.midi).toBe(40)
    // All 6 open strings present when nothing pressed/muted
    expect(sounding).toHaveLength(6)
  })

  it('capo 2, fingered string at absolute fret 4: sounding=open+4, shape=open+2', () => {
    const pressed = new Map<number, number>([[2, 4]]) // string 2 (D3=50) fingered at fret 4
    const sounding = buildSelectedNotes(pressed, new Set(), 2, 'sounding')
    const shape = buildSelectedNotes(pressed, new Set(), 2, 'shape')
    expect(noteFor(sounding, 2)!.midi).toBe(54) // 50 + 4
    expect(noteFor(shape, 2)!.midi).toBe(52)    // 50 + (4 - 2)
  })

  it('capo 2, open string: sounding=open+2, shape=open+0', () => {
    const sounding = buildSelectedNotes(new Map(), new Set(), 2, 'sounding')
    const shape = buildSelectedNotes(new Map(), new Set(), 2, 'shape')
    expect(noteFor(sounding, 3)!.midi).toBe(57) // G3=55 + 2
    expect(noteFor(shape, 3)!.midi).toBe(55)    // G3=55 + 0
  })

  it('muted strings are excluded in both modes', () => {
    const sounding = buildSelectedNotes(new Map(), new Set([0]), 2, 'sounding')
    const shape = buildSelectedNotes(new Map(), new Set([0]), 2, 'shape')
    expect(noteFor(sounding, 0)).toBeUndefined()
    expect(noteFor(shape, 0)).toBeUndefined()
  })

  it('shape pitch classes equal sounding transposed down by capoFret', () => {
    const pressed = new Map<number, number>([[1, 5], [2, 4], [4, 3]])
    const muted = new Set<number>([0])
    const sounding = buildSelectedNotes(pressed, muted, 2, 'sounding')
    const shape = buildSelectedNotes(pressed, muted, 2, 'shape')
    for (const sNote of sounding) {
      const shNote = shape.find(n => n.stringIndex === sNote.stringIndex)!
      expect(((shNote.pitchClass + 2) % 12)).toBe(sNote.pitchClass)
    }
  })

  it('real example: C shape with capo 2 → shape=C major, sounding=D major', () => {
    // C-shape fingered at capo 2 (absolute frets): A=5, D=4, B=3; G & high-E open; low-E muted
    const pressed = new Map<number, number>([[1, 5], [2, 4], [4, 3]])
    const muted = new Set<number>([0])
    const shape = detectChord(buildSelectedNotes(pressed, muted, 2, 'shape'))
    const sounding = detectChord(buildSelectedNotes(pressed, muted, 2, 'sounding'))
    expect(shape).not.toBeNull()
    expect(shape!.root).toBe('C')
    expect(shape!.symbol).toBe('')
    expect(sounding).not.toBeNull()
    expect(sounding!.root).toBe('D')
    expect(sounding!.symbol).toBe('')
  })
})
