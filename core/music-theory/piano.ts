// Octave number for a MIDI value, using the convention C4 = MIDI 60.
// C4 → floor(60/12) - 1 = 4.
function octaveOf(midi: number): number {
  return Math.floor(midi / 12) - 1
}

// MIDI value of C at the start of octave `n` (C4 = 60 → n=4 → 60).
function cOfOctave(n: number): number {
  return (n + 1) * 12
}

export interface PianoRange {
  startMidi: number // lowest C shown (inclusive)
  endMidi: number   // highest C shown (inclusive)
}

// Pick the keyboard window for a set of active MIDI notes.
//
// The window is anchored to the HIGHEST note: its whole octave sits at the top,
// so the top boundary is the C immediately above the highest note's octave.
// The bottom boundary is the C at the start of the lowest note's octave, then
// extended down if needed to guarantee at least a 2-octave (24-semitone) window.
//
// With no notes selected we fall back to a neutral C4–C6 window.
const MIN_SPAN = 24 // two octaves

export function computePianoRange(activeMidis: number[]): PianoRange {
  if (activeMidis.length === 0) {
    return { startMidi: 60, endMidi: 84 } // C4–C6
  }

  const highest = Math.max(...activeMidis)
  const lowest = Math.min(...activeMidis)

  // Highest note keeps its full octave at the top.
  const endMidi = cOfOctave(octaveOf(highest) + 1)
  // Bottom starts at the lowest note's octave C...
  let startMidi = cOfOctave(octaveOf(lowest))
  // ...but never less than a 2-octave window.
  if (endMidi - startMidi < MIN_SPAN) {
    startMidi = endMidi - MIN_SPAN
  }

  return { startMidi, endMidi }
}
