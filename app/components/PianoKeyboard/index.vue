<template>
  <div class="piano-wrap">
    <div ref="viewportRef" class="piano-viewport" :style="viewportStyle">
      <div ref="pianoRef" class="piano" :style="pianoStyle">
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
    </div>
    <p class="piano-range">{{ rangeLabel }}</p>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch, onMounted, onBeforeUnmount, nextTick } from 'vue'
import { useFretboard } from '~/composables/useFretboard'
import { NOTE_NAMES } from '~~/core/music-theory/notes'
import { computePianoRange } from '~~/core/music-theory/piano'

const { selectedNotes } = useFretboard()

// Black key pattern within an octave (pitch classes)
const BLACK_PCS = new Set([1, 3, 6, 8, 10])

interface PianoKey {
  midi: number
  pitchClass: number
  noteName: string
  isBlack: boolean
  active: boolean
}

// Real sounding MIDI values — lets us light the exact key (octave-aware),
// not just every key of a pitch class.
const activeMidis = computed<number[]>(() =>
  selectedNotes.value.map(n => n.midi),
)

const activeMidiSet = computed<Set<number>>(() =>
  new Set(activeMidis.value),
)

// Dynamic window anchored to the highest note's octave (see computePianoRange).
const range = computed(() => computePianoRange(activeMidis.value))

const visibleKeys = computed<PianoKey[]>(() => {
  const keys: PianoKey[] = []
  for (let midi = range.value.startMidi; midi <= range.value.endMidi; midi++) {
    const pc = midi % 12
    keys.push({
      midi,
      pitchClass: pc,
      noteName: NOTE_NAMES[pc]!,
      isBlack: BLACK_PCS.has(pc),
      active: activeMidiSet.value.has(midi),
    })
  }
  return keys
})

const rangeLabel = computed(() => {
  const startOct = Math.floor(range.value.startMidi / 12) - 1
  const endOct = Math.floor(range.value.endMidi / 12) - 1
  return `C${startOct} – C${endOct}`
})

// ── Auto-scale to fit the container ───────────────────────────────
// Keys have a fixed pixel size, so a wide window (many octaves / high
// positions) can overflow. We measure the natural keyboard width against the
// available viewport width and shrink uniformly when it doesn't fit (never
// enlarge). A ResizeObserver keeps it correct across container resizes.
const viewportRef = ref<HTMLElement | null>(null)
const pianoRef = ref<HTMLElement | null>(null)
const scale = ref(1)
const naturalHeight = ref(0)

function recompute(): void {
  const viewport = viewportRef.value
  const piano = pianoRef.value
  if (!viewport || !piano) return
  const available = viewport.clientWidth
  const natural = piano.scrollWidth
  // Ignore pre-layout measurements (0 width); a stale scale is better than 0.
  if (available === 0 || natural === 0) return
  naturalHeight.value = piano.offsetHeight
  scale.value = natural > available ? available / natural : 1
}

const pianoStyle = computed(() => ({
  transform: `scale(${scale.value})`,
}))

// Reserve only the scaled height so the range label sits flush beneath.
const viewportStyle = computed(() => ({
  height: naturalHeight.value ? `${naturalHeight.value * scale.value}px` : undefined,
}))

let observer: ResizeObserver | null = null

onMounted(() => {
  recompute()
  observer = new ResizeObserver(() => recompute())
  if (viewportRef.value) observer.observe(viewportRef.value)
})

onBeforeUnmount(() => observer?.disconnect())

// Recompute when the visible key set (window width) changes.
watch(visibleKeys, () => nextTick(recompute))
</script>

<style scoped lang="scss">
@import "/assets/styles/pianoKeyboard.scss";
</style>
