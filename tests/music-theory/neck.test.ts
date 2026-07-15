import { describe, it, expect } from 'vitest'
import { midiToOctave } from '../../core/music-theory/notes'
import {
  NECK_FRETS,
  findExactPositions,
  findPitchClassPositions,
} from '../../core/music-theory/neck'

describe('midiToOctave', () => {
  it('maps C4=60 to octave 4', () => expect(midiToOctave(60)).toBe(4))
  it('maps E2=40 to octave 2', () => expect(midiToOctave(40)).toBe(2))
  it('maps C6=84 to octave 6', () => expect(midiToOctave(84)).toBe(6))
})

describe('findExactPositions', () => {
  it('E2 (40) is only the low-E open string', () => {
    expect(findExactPositions(40)).toEqual([{ stringIndex: 0, fret: 0 }])
  })

  it('C6 (84) is only the high-E string at fret 20', () => {
    expect(findExactPositions(84)).toEqual([{ stringIndex: 5, fret: 20 }])
  })

  it('C4 (60) appears on strings 0-4', () => {
    expect(findExactPositions(60)).toEqual([
      { stringIndex: 0, fret: 20 },
      { stringIndex: 1, fret: 15 },
      { stringIndex: 2, fret: 10 },
      { stringIndex: 3, fret: 5 },
      { stringIndex: 4, fret: 1 },
    ])
  })

  it('never returns a fret above NECK_FRETS', () => {
    for (const p of findPitchClassPositions(0)) {
      expect(p.fret).toBeLessThanOrEqual(NECK_FRETS)
      expect(p.fret).toBeGreaterThanOrEqual(0)
    }
  })
})

describe('findPitchClassPositions', () => {
  it('every returned C position really is a C', () => {
    const cPositions = findPitchClassPositions(0)
    expect(cPositions.length).toBeGreaterThan(0)
    for (const p of cPositions) {
      expect(([40, 45, 50, 55, 59, 64][p.stringIndex]! + p.fret) % 12).toBe(0)
    }
  })

  it('includes the low-E string C at fret 8 (C3)', () => {
    expect(findPitchClassPositions(0)).toContainEqual({ stringIndex: 0, fret: 8 })
  })
})
