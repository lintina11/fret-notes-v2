import { describe, it, expect } from 'vitest'
import {
  MAX_NOTES,
  nextFreeColor,
  computeLitPositions,
} from '../../core/music-theory/note-map'

describe('nextFreeColor', () => {
  it('returns 0 when nothing is used', () => expect(nextFreeColor([])).toBe(0))
  it('returns the lowest free index', () => expect(nextFreeColor([0, 2])).toBe(1))
  it('returns null when all six colors are used', () =>
    expect(nextFreeColor([0, 1, 2, 3, 4, 5])).toBeNull())
})

describe('computeLitPositions', () => {
  it('with showOffOctave=false returns only exact positions', () => {
    const lit = computeLitPositions(new Map([[60, 0]]), false)
    // C4 exact = 5 positions (strings 0-4)
    expect(lit.length).toBe(5)
    expect(lit.every(p => p.dim === false)).toBe(true)
    expect(lit.every(p => p.colorIndex === 0)).toBe(true)
    expect(lit.every(p => p.noteName === 'C')).toBe(true)
    expect(lit.every(p => p.octave === 4)).toBe(true)
  })

  it('with showOffOctave=true adds dim same-name positions without duplicating exacts', () => {
    const lit = computeLitPositions(new Map([[60, 0]]), true)
    const exact = lit.filter(p => !p.dim)
    const dim = lit.filter(p => p.dim)
    expect(exact.length).toBe(5)
    expect(dim.length).toBeGreaterThan(0)
    // No (string,fret) is both exact and dim
    const key = (p: { stringIndex: number; fret: number }) => `${p.stringIndex}:${p.fret}`
    const exactKeys = new Set(exact.map(key))
    expect(dim.some(p => exactKeys.has(key(p)))).toBe(false)
    // A dim dot carries its own octave (e.g. a C3 exists at string 0 fret 8)
    expect(dim).toContainEqual(
      expect.objectContaining({ stringIndex: 0, fret: 8, noteName: 'C', octave: 3, dim: true }),
    )
  })

  it('keeps each note on its own color', () => {
    const lit = computeLitPositions(new Map([[60, 0], [64, 1]]), false)
    expect(lit.filter(p => p.noteName === 'C').every(p => p.colorIndex === 0)).toBe(true)
    expect(lit.filter(p => p.noteName === 'E').every(p => p.colorIndex === 1)).toBe(true)
  })

  it('exposes MAX_NOTES = 6', () => expect(MAX_NOTES).toBe(6))
})
