import { describe, it, expect } from 'vitest'
import {
  buildSelectedNotes,
  transposePressedFrets,
  transposeBarre,
  barreCoveredStrings,
  isStringBarred,
  dropPressesAtOrBelow,
  MAX_FRET,
  STRING_COUNT,
} from '../../core/music-theory/fretboard'
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

describe('transposePressedFrets', () => {
  it('shifts all frets up by delta', () => {
    const input = new Map<number, number>([[1, 3], [2, 5]])
    const result = transposePressedFrets(input, 2, 12)
    expect([...result.entries()].sort()).toEqual([[1, 5], [2, 7]])
  })

  it('shifts all frets down by delta', () => {
    const result = transposePressedFrets(new Map([[1, 5]]), -1, 12)
    expect(result.get(1)).toBe(4)
  })

  it('drops frets pushed above maxFret, keeps those at maxFret', () => {
    const input = new Map<number, number>([[0, 11], [1, 10]])
    const result = transposePressedFrets(input, 2, 12) // 11+2=13 dropped, 10+2=12 kept
    expect(result.has(0)).toBe(false)
    expect(result.get(1)).toBe(12)
  })

  it('returns an empty Map when every fret is pushed off the neck', () => {
    const result = transposePressedFrets(new Map([[1, 12], [2, 11]]), 2, 12)
    expect(result.size).toBe(0)
  })

  it('drops frets shifted below fret 1 (defensive)', () => {
    const result = transposePressedFrets(new Map([[1, 1]]), -1, 12) // 1-1=0 < 1
    expect(result.has(1)).toBe(false)
  })

  it('does not mutate the input Map and returns a new object', () => {
    const input = new Map<number, number>([[1, 3]])
    const result = transposePressedFrets(input, 2, 12)
    expect(input.get(1)).toBe(3)   // unchanged
    expect(result).not.toBe(input) // new object
  })

  it('exports MAX_FRET = 12', () => {
    expect(MAX_FRET).toBe(12)
  })
})

describe('barreCoveredStrings', () => {
  it('length 6 covers all strings 0-5', () => {
    expect(barreCoveredStrings(6)).toEqual([0, 1, 2, 3, 4, 5])
  })
  it('length 5 covers strings 1-5 (drops low E)', () => {
    expect(barreCoveredStrings(5)).toEqual([1, 2, 3, 4, 5])
  })
  it('length 2 covers strings 4-5 (two thinnest)', () => {
    expect(barreCoveredStrings(2)).toEqual([4, 5])
  })
})

describe('isStringBarred', () => {
  it('null barre → never barred', () => {
    expect(isStringBarred(0, null)).toBe(false)
  })
  it('length 5 barre: string 0 not barred, string 1 barred', () => {
    const barre = { fret: 2, length: 5 }
    expect(isStringBarred(0, barre)).toBe(false)
    expect(isStringBarred(1, barre)).toBe(true)
    expect(isStringBarred(5, barre)).toBe(true)
  })
})

describe('dropPressesAtOrBelow', () => {
  it('removes covered-string presses at or below the fret, keeps the rest', () => {
    const pressed = new Map<number, number>([[1, 1], [2, 5], [0, 1]])
    // covered = strings 1..5 (length 5); fret = 1
    const result = dropPressesAtOrBelow(pressed, [1, 2, 3, 4, 5], 1)
    expect(result.has(1)).toBe(false) // 1 <= 1 on covered string → dropped
    expect(result.get(2)).toBe(5)     // 5 > 1 → kept
    expect(result.get(0)).toBe(1)     // string 0 not covered → kept
  })
  it('returns a new Map; input is not mutated', () => {
    const pressed = new Map<number, number>([[5, 1]])
    const result = dropPressesAtOrBelow(pressed, [5], 1)
    expect(result.has(5)).toBe(false)
    expect(pressed.get(5)).toBe(1)
  })
})

describe('transposeBarre', () => {
  it('shifts up within range', () => {
    expect(transposeBarre(1, 2, 12)).toBe(3)
  })
  it('returns null when pushed past maxFret', () => {
    expect(transposeBarre(11, 2, 12)).toBeNull()
  })
  it('returns null when pushed below fret 1', () => {
    expect(transposeBarre(1, -1, 12)).toBeNull()
  })
})

describe('buildSelectedNotes with a barre', () => {
  it('full F barre (fret 1, length 6) + E-shape fingers → F major sounding', () => {
    // E-shape F: low-E barre, A=3, D=3, G=2, B barre, high-E barre
    const pressed = new Map<number, number>([[1, 3], [2, 3], [3, 2]])
    const barre = { fret: 1, length: 6 }
    const sounding = buildSelectedNotes(pressed, new Set(), 0, 'sounding', barre)
    // string 0 sounds at the barre fret 1 → 40+1 = 41 (F)
    expect(noteFor(sounding, 0)!.midi).toBe(41)
    // string 1 has a higher press (3) → 45+3 = 48 (C), not the barre
    expect(noteFor(sounding, 1)!.midi).toBe(48)
    const chord = detectChord(sounding)
    expect(chord).not.toBeNull()
    expect(chord!.root).toBe('F')
    expect(chord!.symbol).toBe('')
  })

  it('partial barre (fret 2, length 5): strings 1-5 barred, string 0 stays open', () => {
    const barre = { fret: 2, length: 5 }
    const sounding = buildSelectedNotes(new Map(), new Set(), 0, 'sounding', barre)
    expect(noteFor(sounding, 0)!.midi).toBe(40)      // open low E
    expect(noteFor(sounding, 1)!.midi).toBe(47)      // 45 + 2
    expect(sounding).toHaveLength(6)
  })

  it('barre + capo in shape mode: covered string sounds at barre.fret - capoFret', () => {
    const barre = { fret: 3, length: 6 }
    const shape = buildSelectedNotes(new Map(), new Set(), 2, 'shape', barre)
    // string 0 shape = 40 + (3 - 2) = 41
    expect(noteFor(shape, 0)!.midi).toBe(41)
  })

  it('muted covered string is excluded even under a barre', () => {
    const barre = { fret: 1, length: 6 }
    const sounding = buildSelectedNotes(new Map(), new Set([5]), 0, 'sounding', barre)
    expect(noteFor(sounding, 5)).toBeUndefined()
  })

  it('covered string with a higher press sounds at the press, not the barre', () => {
    const pressed = new Map<number, number>([[3, 5]])
    const barre = { fret: 1, length: 6 }
    const sounding = buildSelectedNotes(pressed, new Set(), 0, 'sounding', barre)
    expect(noteFor(sounding, 3)!.midi).toBe(60) // 55 + 5, not 55 + 1
  })

  it('covered string with a press exactly AT the barre fret sounds at the barre (not above)', () => {
    // Pins the strict `> barre.fret` boundary: an equal press must NOT win.
    const pressed = new Map<number, number>([[3, 2]])
    const barre = { fret: 2, length: 6 }
    const sounding = buildSelectedNotes(pressed, new Set(), 0, 'sounding', barre)
    expect(noteFor(sounding, 3)!.midi).toBe(57) // 55 + 2 (barre fret), same as the press here
  })

  it('no barre argument behaves exactly as before (open strings)', () => {
    const sounding = buildSelectedNotes(new Map(), new Set(), 0, 'sounding')
    expect(sounding).toHaveLength(6)
    expect(noteFor(sounding, 0)!.midi).toBe(40)
  })
})
