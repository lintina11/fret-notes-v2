<template>
  <div class="chord-result">
    <template v-if="detectedChord">
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

    <div v-else class="empty-state">
      <p>點選指板上的格子來識別和弦</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useFretboard } from '~/composables/useFretboard'

const { detectedChord } = useFretboard()

const chordKey = computed(() =>
  detectedChord.value
    ? `${detectedChord.value.root}${detectedChord.value.symbol}${detectedChord.value.bassNote ?? ''}`
    : 'empty'
)
</script>

<style scoped>
.chord-result {
  background: var(--color-surface);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-card);
  padding: 24px;
  min-height: 180px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.result-inner {
  width: 100%;
}

.chord-name-wrap {
  margin-bottom: 16px;
}

.chord-name {
  font-family: 'DM Sans', sans-serif;
  font-size: 48px;
  font-weight: 700;
  color: var(--color-text);
  line-height: 1;
  letter-spacing: -1px;
}

.bass {
  color: var(--color-primary);
}

.chord-type-name {
  font-size: 14px;
  color: var(--color-text-muted);
  margin-top: 4px;
}

.alternates {
  font-size: 13px;
  color: var(--color-text-muted);
  margin-top: 6px;
}

.divider {
  height: 1px;
  background: var(--color-border);
  margin: 16px 0;
}

.notes-row {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
}

.note-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
}

.note-pill {
  background: var(--color-primary);
  color: var(--color-on-primary);
  font-size: 14px;
  font-weight: 600;
  padding: 4px 12px;
  border-radius: 20px;
  font-family: 'DM Sans', sans-serif;
}

.interval-label {
  font-size: 11px;
  color: var(--color-text-muted);
  text-align: center;
}

.empty-state {
  color: var(--color-text-muted);
  font-size: 15px;
  text-align: center;
}

/* Transition */
.chord-fade-enter-active,
.chord-fade-leave-active {
  transition: opacity 0.15s, transform 0.15s;
}
.chord-fade-enter-from {
  opacity: 0;
  transform: translateY(6px);
}
.chord-fade-leave-to {
  opacity: 0;
  transform: translateY(-6px);
}
</style>
