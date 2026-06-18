import { midiToPitchClass, midiToNoteName, NOTE_NAMES } from './notes'
import { intervalBetween, INTERVAL_NAMES } from './intervals'
import { CHORD_RULES } from './chord-rules'

export interface SelectedNote {
  stringIndex: number
  fret: number
  midi: number
  pitchClass: number
  noteName: string
}

export interface NoteInfo {
  noteName: string
  intervalSemitones: number
  intervalName: string
}

export interface ChordResult {
  root: string
  symbol: string
  name: string
  bassNote: string | null  // set when lowest note ≠ root
  notes: NoteInfo[]        // unique pitch classes, root first
  alternates: string[]     // other possible chord names for same note set
}

export function detectChord(notes: SelectedNote[]): ChordResult | null {
  if (notes.length < 2) return null

  // Unique pitch classes present
  const pitchClasses = [...new Set(notes.map(n => n.pitchClass))]
  if (pitchClasses.length < 2) return null

  // Lowest note by MIDI value
  const lowestMidi = Math.min(...notes.map(n => n.midi))
  const bassPC = midiToPitchClass(lowestMidi)

  const matches: ChordResult[] = []

  for (const rootPC of pitchClasses) {
    const intervals = pitchClasses
      .map(pc => intervalBetween(rootPC, pc))
      .sort((a, b) => a - b)

    for (const rule of CHORD_RULES) {
      if (arraysEqual(intervals, rule.intervals)) {
        const root = NOTE_NAMES[rootPC]!
        const bassNote = bassPC !== rootPC ? NOTE_NAMES[bassPC]! : null

        const noteInfos: NoteInfo[] = pitchClasses.map(pc => ({
          noteName: NOTE_NAMES[pc]!,
          intervalSemitones: intervalBetween(rootPC, pc),
          intervalName: INTERVAL_NAMES[intervalBetween(rootPC, pc)] ?? '',
        }))
        // Sort: root first, then by interval
        noteInfos.sort((a, b) => a.intervalSemitones - b.intervalSemitones)

        matches.push({ root, symbol: rule.symbol, name: rule.name, bassNote, notes: noteInfos, alternates: [] })
        break // one rule per root candidate
      }
    }
  }

  // Primary = first match; alternates = remaining chord display names
  const primary = matches[0]
  if (!primary) return null
  primary.alternates = matches.slice(1).map(m => {
    const slash = m.bassNote ? `/${m.bassNote}` : ''
    return `${m.root}${m.symbol}${slash}`
  })

  return primary
}

function arraysEqual(a: number[], b: number[]): boolean {
  return a.length === b.length && a.every((v, i) => v === b[i])
}
