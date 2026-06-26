import { ref, computed } from 'vue'
import { detectChord, type ChordResult } from '~~/core/music-theory/chord-detector'
import { buildSelectedNotes, transposePressedFrets, MAX_FRET } from '~~/core/music-theory/fretboard'

// Singleton state — shared across all components
const pressedFrets = ref(new Map<number, number>())  // stringIndex → absolute fret
const mutedStrings = ref(new Set<number>())
const capoFret = ref(0)                                // 0–7 (0 = no capo)

const MAX_CAPO = 7

const detectedChord = computed<ChordResult | null>(() =>
  detectChord(buildSelectedNotes(pressedFrets.value, mutedStrings.value, capoFret.value, 'sounding')),
)

const shapeChord = computed<ChordResult | null>(() =>
  detectChord(buildSelectedNotes(pressedFrets.value, mutedStrings.value, capoFret.value, 'shape')),
)

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

function setCapo(fret: number): void {
  const next = Math.min(MAX_CAPO, Math.max(0, fret))
  const delta = next - capoFret.value
  if (delta === 0) return
  capoFret.value = next
  // Capo and shape move together: shift every press by the same delta.
  // Notes pushed past the last fret are dropped (lossy).
  pressedFrets.value = transposePressedFrets(pressedFrets.value, delta, MAX_FRET)
}

function clearAll(): void {
  pressedFrets.value = new Map()
  mutedStrings.value = new Set()
  capoFret.value = 0
}

export function useFretboard() {
  return {
    pressedFrets,
    mutedStrings,
    capoFret,
    detectedChord,
    shapeChord,
    toggleFret,
    toggleMute,
    setCapo,
    clearAll,
  }
}
