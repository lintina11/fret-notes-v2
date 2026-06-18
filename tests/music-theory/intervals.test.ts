import { describe, it, expect } from 'vitest'
import { INTERVAL_NAMES, intervalBetween } from '../../core/music-theory/intervals'

describe('intervalBetween', () => {
  it('same note = 0', () => expect(intervalBetween(0, 0)).toBe(0))
  it('C to E = 4 (大三度)', () => expect(intervalBetween(0, 4)).toBe(4))
  it('C to G = 7 (完全五度)', () => expect(intervalBetween(0, 7)).toBe(7))
  it('E to C = 8 (小六度, wraps around)', () => expect(intervalBetween(4, 0)).toBe(8))
  it('A to C = 3 (小三度)', () => expect(intervalBetween(9, 0)).toBe(3))
})

describe('INTERVAL_NAMES', () => {
  it('0 = 根音', () => expect(INTERVAL_NAMES[0]).toBe('根音'))
  it('3 = 小三度', () => expect(INTERVAL_NAMES[3]).toBe('小三度'))
  it('7 = 完全五度', () => expect(INTERVAL_NAMES[7]).toBe('完全五度'))
  it('10 = 小七度', () => expect(INTERVAL_NAMES[10]).toBe('小七度'))
  it('11 = 大七度', () => expect(INTERVAL_NAMES[11]).toBe('大七度'))
})
