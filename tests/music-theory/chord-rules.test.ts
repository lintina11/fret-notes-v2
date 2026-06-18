import { describe, it, expect } from 'vitest'
import { CHORD_RULES } from '../../core/music-theory/chord-rules'

describe('CHORD_RULES', () => {
  it('contains at least 14 rules', () => expect(CHORD_RULES.length).toBeGreaterThanOrEqual(14))

  it('every rule has a string symbol, a name, and intervals', () => {
    for (const rule of CHORD_RULES) {
      // symbol may be '' (major triad displays as just the root, e.g. "C")
      expect(typeof rule.symbol).toBe('string')
      expect(rule.name).toBeTruthy()
      expect(rule.intervals.length).toBeGreaterThanOrEqual(2)
    }
  })

  it('all interval arrays are sorted ascending', () => {
    for (const rule of CHORD_RULES) {
      const sorted = [...rule.intervals].sort((a, b) => a - b)
      expect(rule.intervals).toEqual(sorted)
    }
  })

  it('all interval arrays start with 0 (root)', () => {
    for (const rule of CHORD_RULES) {
      expect(rule.intervals[0]).toBe(0)
    }
  })

  it('has a minor triad rule [0,3,7]', () => {
    const minor = CHORD_RULES.find(r => r.symbol === 'm')
    expect(minor?.intervals).toEqual([0, 3, 7])
  })

  it('has a dominant 7 rule [0,4,7,10]', () => {
    const dom7 = CHORD_RULES.find(r => r.symbol === '7')
    expect(dom7?.intervals).toEqual([0, 4, 7, 10])
  })
})
