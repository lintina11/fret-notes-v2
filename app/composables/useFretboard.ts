import { ref, computed } from 'vue'
import { detectChord, type SelectedNote, type ChordResult } from '~~/core/music-theory/chord-detector'
import { fretToMidi, midiToPitchClass, midiToNoteName } from '~~/core/music-theory/notes'

// Singleton state — shared across all components
const pressedFrets = ref(new Map<number, number>())  // stringIndex → fret
const mutedStrings = ref(new Set<number>())

function getSelectedNotes(): SelectedNote[] {
  const notes: SelectedNote[] = []
  for (const [stringIndex, fret] of pressedFrets.value) {
    if (mutedStrings.value.has(stringIndex)) continue
    const midi = fretToMidi(stringIndex, fret)
    notes.push({
      stringIndex,
      fret,
      midi,
      pitchClass: midiToPitchClass(midi),
      noteName: midiToNoteName(midi),
    })
  }
  // Also include open strings (not pressed, not muted)
  for (let s = 0; s < 6; s++) {
    if (!pressedFrets.value.has(s) && !mutedStrings.value.has(s)) {
      const midi = fretToMidi(s, 0)
      notes.push({
        stringIndex: s,
        fret: 0,
        midi,
        pitchClass: midiToPitchClass(midi),
        noteName: midiToNoteName(midi),
      })
    }
  }
  return notes
}

const detectedChord = computed<ChordResult | null>(() => {
  const notes = getSelectedNotes()
  return detectChord(notes)
})

function toggleFret(stringIndex: number, fret: number): void {
  const current = pressedFrets.value.get(stringIndex)
  if (current === fret) {
    pressedFrets.value.delete(stringIndex)
  } else {
    pressedFrets.value.set(stringIndex, fret)
    mutedStrings.value.delete(stringIndex)
  }
  pressedFrets.value = new Map(pressedFrets.value)  // trigger reactivity
}

function toggleMute(stringIndex: number): void {
  if (mutedStrings.value.has(stringIndex)) {
    mutedStrings.value.delete(stringIndex)
  } else {
    mutedStrings.value.add(stringIndex)
    pressedFrets.value.delete(stringIndex)
    pressedFrets.value = new Map(pressedFrets.value)
  }
  mutedStrings.value = new Set(mutedStrings.value)
}

function clearAll(): void {
  pressedFrets.value = new Map()
  mutedStrings.value = new Set()
}

export function useFretboard() {
  return { pressedFrets, mutedStrings, detectedChord, toggleFret, toggleMute, clearAll, getSelectedNotes }
}
