import { describe, it, expect } from 'vitest'
import { computePianoRange } from '../../core/music-theory/piano'

describe('computePianoRange', () => {
  it('no notes → neutral C4–C6 window (MIDI 60–84)', () => {
    expect(computePianoRange([])).toEqual({ startMidi: 60, endMidi: 84 })
  })

  it('open standard chord E2–E4 → C2–C5 (highest note octave on top)', () => {
    // E2 = 40, E4 = 64
    expect(computePianoRange([40, 64])).toEqual({ startMidi: 36, endMidi: 72 })
  })

  it('a single note still gets at least a 2-octave window, top-anchored', () => {
    // C4 = 60, octave 4 → top C5 = 72, min 2 octaves → start C3 = 48
    expect(computePianoRange([60])).toEqual({ startMidi: 48, endMidi: 72 })
  })

  it('high-position notes shift the window up', () => {
    // E5 = 76 (octave 5) → top C6 = 84; lowest A4 = 69 (octave 4) → bottom C4 = 60
    expect(computePianoRange([69, 76])).toEqual({ startMidi: 60, endMidi: 84 })
  })

  it('highest note exactly on a C still gets its own octave on top', () => {
    // C5 = 72 (octave 5) → top C6 = 84; min 2 octaves → start C4 = 60
    expect(computePianoRange([72])).toEqual({ startMidi: 60, endMidi: 84 })
  })
})
