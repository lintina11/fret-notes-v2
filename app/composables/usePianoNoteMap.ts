import { ref, computed } from 'vue'
import {
  MAX_NOTES,
  nextFreeColor,
  computeLitPositions,
  type LitPosition,
} from '~~/core/music-theory/note-map'
import { detectChord, type ChordResult } from '~~/core/music-theory/chord-detector'
import { midiToPitchClass } from '~~/core/music-theory/notes'

// Singleton state for the piano→guitar page. Independent of useFretboard.
const selectedMidis = ref(new Map<number, number>())  // midi → colorIndex
const showOffOctave = ref(false)                        // off-octave dots hidden by default

// Toggle a note: remove (freeing its color) if present; otherwise assign the
// lowest free color, ignoring the click once MAX_NOTES are already selected.
function toggleNote(midi: number): void {
  if (selectedMidis.value.has(midi)) {
    selectedMidis.value.delete(midi)
    selectedMidis.value = new Map(selectedMidis.value)
    return
  }
  if (selectedMidis.value.size >= MAX_NOTES) return
  const color = nextFreeColor(selectedMidis.value.values())
  if (color === null) return
  selectedMidis.value.set(midi, color)
  selectedMidis.value = new Map(selectedMidis.value)
}

function clear(): void {
  selectedMidis.value = new Map()
}

const litPositions = computed<LitPosition[]>(() =>
  computeLitPositions(selectedMidis.value, showOffOctave.value),
)

// Chord detected from the selected notes. detectChord only needs midi + pitch
// class; the selected notes carry real octaves, so slash chords resolve too.
const detectedChord = computed<ChordResult | null>(() =>
  detectChord(
    [...selectedMidis.value.keys()].map(midi => ({
      midi,
      pitchClass: midiToPitchClass(midi),
    })),
  ),
)

export function usePianoNoteMap() {
  return { selectedMidis, showOffOctave, litPositions, detectedChord, toggleNote, clear }
}
