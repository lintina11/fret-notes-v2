<template>
  <div class="piano-wrap">
    <div class="piano">
      <div
        v-for="key in visibleKeys"
        :key="key.midi"
        class="key"
        :class="{
          'key--black': key.isBlack,
          'key--white': !key.isBlack,
          'key--active': key.active,
        }"
      >
        <span v-if="key.active && !key.isBlack" class="key-label">{{ key.noteName }}</span>
      </div>
    </div>
    <p class="piano-range">{{ rangeLabel }}</p>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useFretboard } from '~/composables/useFretboard'
import { NOTE_NAMES } from '~~/core/music-theory/notes'

const { detectedChord } = useFretboard()

// Black key pattern within an octave (pitch classes)
const BLACK_PCS = new Set([1, 3, 6, 8, 10])

interface PianoKey {
  midi: number
  pitchClass: number
  noteName: string
  isBlack: boolean
  active: boolean
}

const activePitchClasses = computed<Set<number>>(() => {
  if (!detectedChord.value) return new Set()
  return new Set(detectedChord.value.notes.map(n => {
    return NOTE_NAMES.indexOf(n.noteName)
  }))
})

const startOctave = computed<number>(() => {
  // Detection works on octave-agnostic pitch classes, so we cannot derive a
  // real octave from the chord. A fixed 2-octave window (25 keys) already
  // contains every one of the 12 pitch classes, so highlighting is always
  // complete. We pin the window to the guitar's middle register:
  //   - no notes selected: C4–C6 (a neutral resting view)
  //   - notes selected:    C3–C5 (centres the guitar's typical range)
  return activePitchClasses.value.size === 0 ? 4 : 3
})

const visibleKeys = computed<PianoKey[]>(() => {
  const keys: PianoKey[] = []
  const startMidi = (startOctave.value + 1) * 12  // C4 = MIDI 60, so octave offset = 12*(n+1)
  // Two octaves = 25 keys (C to C)
  for (let i = 0; i <= 24; i++) {
    const midi = startMidi + i
    const pc = midi % 12
    keys.push({
      midi,
      pitchClass: pc,
      noteName: NOTE_NAMES[pc]!,
      isBlack: BLACK_PCS.has(pc),
      active: activePitchClasses.value.has(pc),
    })
  }
  return keys
})

const rangeLabel = computed(() => {
  const start = startOctave.value
  return `C${start} – C${start + 2}`
})
</script>

<style scoped lang="scss">
@import "/assets/styles/pianoKeyboard.scss";
</style>
