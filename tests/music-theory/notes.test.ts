import { describe, it, expect } from 'vitest'
import {
  OPEN_STRINGS,
  NOTE_NAMES,
  midiToPitchClass,
  midiToNoteName,
  fretToMidi,
  fretToPitchClass,
} from '../../core/music-theory/notes'

describe('OPEN_STRINGS', () => {
  it('has 6 strings', () => expect(OPEN_STRINGS).toHaveLength(6))
  it('string 0 is E2 (MIDI 40)', () => expect(OPEN_STRINGS[0]).toBe(40))
  it('string 5 is E4 (MIDI 64)', () => expect(OPEN_STRINGS[5]).toBe(64))
})

describe('midiToPitchClass', () => {
  it('MIDI 60 (C4) = pitch class 0', () => expect(midiToPitchClass(60)).toBe(0))
  it('MIDI 64 (E4) = pitch class 4', () => expect(midiToPitchClass(64)).toBe(4))
  it('MIDI 40 (E2) = pitch class 4', () => expect(midiToPitchClass(40)).toBe(4))
})

describe('midiToNoteName', () => {
  it('pitch class 0 = C', () => expect(midiToNoteName(60)).toBe('C'))
  it('pitch class 4 = E', () => expect(midiToNoteName(64)).toBe('E'))
  it('pitch class 9 = A', () => expect(midiToNoteName(45)).toBe('A'))
})

describe('fretToMidi', () => {
  it('string 0 fret 0 = 40 (E2 open)', () => expect(fretToMidi(0, 0)).toBe(40))
  it('string 0 fret 2 = 42 (F#2)', () => expect(fretToMidi(0, 2)).toBe(42))
  it('string 1 fret 0 = 45 (A2 open)', () => expect(fretToMidi(1, 0)).toBe(45))
})

describe('fretToPitchClass', () => {
  it('string 0 fret 0 = 4 (E)', () => expect(fretToPitchClass(0, 0)).toBe(4))
  it('string 0 fret 1 = 5 (F)', () => expect(fretToPitchClass(0, 1)).toBe(5))
  it('string 1 fret 2 = 11 (B)', () => expect(fretToPitchClass(1, 2)).toBe(11))
})
