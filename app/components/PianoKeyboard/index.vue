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

// Choose best octave start (C) so max active notes fall within 2 octaves
const startOctave = computed<number>(() => {
  const active = activePitchClasses.value
  if (active.size === 0) return 4  // default C4–C6

  // Try C3 through C5 as start octave; pick the one that covers most notes
  // Since we show 2 octaves (25 keys), all 12 pitch classes are covered —
  // so we just default to a sensible range based on guitar register.
  // Guitar sounds C2–C6 roughly; middle range is C3–C5.
  return 3
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

<style scoped>
.piano-wrap {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 16px;
  background: var(--color-surface);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-card);
}

.piano {
  position: relative;
  display: flex;
  align-items: flex-start;
  height: 100px;
}

.key {
  position: relative;
  border-radius: 0 0 4px 4px;
  cursor: default;
  transition: background 0.1s;
}

.key--white {
  width: 36px;
  height: 100px;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  margin-right: 2px;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  padding-bottom: 6px;
  z-index: 1;
}

.key--black {
  width: 24px;
  height: 62px;
  background: var(--color-text);
  margin-left: -13px;
  margin-right: -13px;
  z-index: 2;
  border-radius: 0 0 3px 3px;
}

.key--white.key--active {
  background: color-mix(in srgb, var(--color-primary) 25%, var(--color-surface));
  border-color: var(--color-primary);
}

.key--black.key--active {
  background: var(--color-primary);
}

.key-label {
  font-size: 10px;
  font-weight: 600;
  color: var(--color-primary);
  font-family: 'Inter', sans-serif;
}

.piano-range {
  font-size: 11px;
  color: var(--color-text-muted);
}
</style>
