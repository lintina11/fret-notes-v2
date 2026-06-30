import { ref, computed } from 'vue'
import { detectChord, type ChordResult } from '~~/core/music-theory/chord-detector'
import {
  buildSelectedNotes,
  transposePressedFrets,
  transposeBarre,
  barreCoveredStrings,
  dropPressesAtOrBelow,
  MAX_FRET,
  type Barre,
} from '~~/core/music-theory/fretboard'

// Singleton state — shared across all components
const pressedFrets = ref(new Map<number, number>())  // stringIndex → absolute fret
const mutedStrings = ref(new Set<number>())
const capoFret = ref(0)                                // 0–7 (0 = no capo)
const barreFret = ref<number | null>(null)             // barre fret; null = no barre
const barreLength = ref(6)                             // 2–6, anchored to the thinnest strings

const MAX_CAPO = 7

const barre = computed<Barre | null>(() =>
  barreFret.value === null ? null : { fret: barreFret.value, length: barreLength.value },
)

const detectedChord = computed<ChordResult | null>(() =>
  detectChord(buildSelectedNotes(pressedFrets.value, mutedStrings.value, capoFret.value, 'sounding', barre.value)),
)

const shapeChord = computed<ChordResult | null>(() =>
  detectChord(buildSelectedNotes(pressedFrets.value, mutedStrings.value, capoFret.value, 'shape', barre.value)),
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
  // The barre moves with the capo too; if pushed off the neck it is dropped.
  if (barreFret.value !== null) {
    barreFret.value = transposeBarre(barreFret.value, delta, MAX_FRET)
  }
}

// Toggle the barre at `fret`.
// - Different fret (or no barre): activate at `fret` with length 6.
// - Same fret, length > 2: shrink by 1 (6 → 5 → 4 → 3 → 2).
// - Same fret, length === 2: remove the barre.
function toggleBarre(fret: number): void {
  if (barreFret.value !== fret) {
    barreFret.value = fret
    barreLength.value = 6
    pressedFrets.value = dropPressesAtOrBelow(
      pressedFrets.value,
      barreCoveredStrings(6),
      fret,
    )
  } else if (barreLength.value > 2) {
    setBarreLength(barreLength.value - 1)
  } else {
    barreFret.value = null
  }
}

function setBarreLength(len: number): void {
  const next = Math.min(6, Math.max(2, len))
  barreLength.value = next
  if (barreFret.value !== null) {
    pressedFrets.value = dropPressesAtOrBelow(
      pressedFrets.value,
      barreCoveredStrings(next),
      barreFret.value,
    )
  }
}

function clearAll(): void {
  pressedFrets.value = new Map()
  mutedStrings.value = new Set()
  capoFret.value = 0
  barreFret.value = null
  barreLength.value = 6
}

export function useFretboard() {
  return {
    pressedFrets,
    mutedStrings,
    capoFret,
    barreFret,
    barreLength,
    detectedChord,
    shapeChord,
    toggleFret,
    toggleMute,
    setCapo,
    toggleBarre,
    setBarreLength,
    clearAll,
  }
}
