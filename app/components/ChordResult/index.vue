<template>
  <div class="chord-result">
    <template v-if="detectedChord && !detectedChord.unrecognized">
      <Transition name="chord-fade" mode="out-in">
        <div :key="chordKey" class="result-inner">
          <div class="chord-name-wrap">
            <h1 class="chord-name">
              {{ detectedChord.root }}{{ detectedChord.symbol }}
              <span v-if="detectedChord.bassNote" class="bass">/{{ detectedChord.bassNote }}</span>
            </h1>
            <p class="chord-type-name">{{ detectedChord.name }}</p>
            <p v-if="detectedChord.alternates.length" class="alternates">
              也可能是 {{ detectedChord.alternates.join('、') }}
            </p>
            <p v-if="capoFret > 0" class="capo-shape">
              形狀：{{ shapeLabel }} · Capo {{ capoFret }}
            </p>
          </div>

          <div class="divider"></div>

          <div class="notes-row">
            <div
              v-for="noteInfo in detectedChord.notes"
              :key="noteInfo.noteName"
              class="note-item"
            >
              <span class="note-pill">{{ noteInfo.noteName }}</span>
              <span class="interval-label">{{ noteInfo.intervalName }}</span>
            </div>
          </div>
        </div>
      </Transition>
    </template>

    <template v-else-if="detectedChord && detectedChord.unrecognized">
      <Transition name="chord-fade" mode="out-in">
        <div :key="chordKey" class="result-inner">
          <p class="unrecognized-label">音集</p>
          <p v-if="capoFret > 0" class="capo-shape">
            形狀：{{ shapeLabel }} · Capo {{ capoFret }}
          </p>
          <div class="divider"></div>
          <div class="notes-row">
            <div
              v-for="noteInfo in detectedChord.notes"
              :key="noteInfo.noteName"
              class="note-item"
            >
              <span class="note-pill">{{ noteInfo.noteName }}</span>
            </div>
          </div>
        </div>
      </Transition>
    </template>

    <div v-else class="empty-state">
      <p>點選指板上的格子來識別和弦</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useFretboard } from '~/composables/useFretboard'

const { detectedChord, shapeChord, capoFret } = useFretboard()

const shapeLabel = computed(() => {
  const s = shapeChord.value
  if (!s) return ''
  if (s.unrecognized) return '(音集)'
  return `${s.root}${s.symbol}${s.bassNote ? '/' + s.bassNote : ''}`
})

const chordKey = computed(() => {
  const capo = capoFret.value
  if (!detectedChord.value) return 'empty'
  if (detectedChord.value.unrecognized) {
    return `unknown:${detectedChord.value.notes.map(n => n.noteName).join(',')}:capo${capo}`
  }
  return `${detectedChord.value.root}${detectedChord.value.symbol}${detectedChord.value.bassNote ?? ''}:capo${capo}`
})
</script>

<style scoped lang="scss">
@import "/assets/styles/chordResult.scss";
</style>
