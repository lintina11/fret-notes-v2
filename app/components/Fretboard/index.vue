<template>
  <div class="fretboard-wrap">
    <div class="fretboard">
      <!-- Open string row -->
      <div class="fret-row open-row">
        <div class="fret-label"></div>
        <div
          v-for="s in STRINGS"
          :key="s"
          class="open-cell"
          @click="handleOpenClick(s)"
        >
          <span v-if="mutedStrings.has(s)" class="mute-mark">×</span>
          <span v-else-if="!pressedFrets.has(s)" class="open-circle"></span>
        </div>
      </div>

      <!-- Fret rows 1–12 -->
      <div
        v-for="fret in FRETS"
        :key="fret"
        class="fret-row"
      >
        <div class="fret-label">{{ fret }}</div>
        <div
          v-for="s in STRINGS"
          :key="s"
          class="fret-cell"
          :class="{ 'has-dot': POSITION_DOTS.includes(fret) && s === 2 }"
          @click="toggleFret(s, fret)"
        >
          <span
            v-if="pressedFrets.get(s) === fret"
            class="press-dot"
          >
            {{ noteNameAt(s, fret) }}
          </span>
        </div>
      </div>
    </div>

    <button class="clear-btn" @click="clearAll">清除</button>
  </div>
</template>

<script setup lang="ts">
import { useFretboard } from '~/composables/useFretboard'
import { midiToNoteName, OPEN_STRINGS } from '~~/core/music-theory/notes'

const { pressedFrets, mutedStrings, toggleFret, toggleMute, clearAll } = useFretboard()

const STRINGS = [0, 1, 2, 3, 4, 5]
const FRETS = Array.from({ length: 12 }, (_, i) => i + 1)
const POSITION_DOTS = [3, 5, 7, 9, 12]

function noteNameAt(stringIndex: number, fret: number): string {
  return midiToNoteName(OPEN_STRINGS[stringIndex]! + fret)
}

function handleOpenClick(stringIndex: number) {
  toggleMute(stringIndex)
}
</script>

<style scoped>
.fretboard-wrap {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  padding: 16px;
}

.fretboard {
  display: grid;
  grid-template-rows: auto repeat(12, 1fr);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-surface);
  box-shadow: var(--shadow-card);
  overflow: hidden;
  width: 100%;
  max-width: 420px;
}

.fret-row {
  display: grid;
  grid-template-columns: 28px repeat(6, 1fr);
  border-bottom: 1px solid var(--color-border);
}

.fret-row:last-child {
  border-bottom: none;
}

.fret-label {
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 11px;
  color: var(--color-text-muted);
  font-family: 'Inter', sans-serif;
  border-right: 1px solid var(--color-border);
}

.fret-cell,
.open-cell {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 44px;
  cursor: pointer;
  border-right: 1px solid var(--color-border);
  transition: background 0.1s;
}

.fret-cell:last-child,
.open-cell:last-child {
  border-right: none;
}

.fret-cell:active {
  background: color-mix(in srgb, var(--color-primary) 10%, transparent);
}

/* Dot marker on fret positions */
.fret-cell.has-dot::after {
  content: '';
  position: absolute;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--color-border);
  bottom: 4px;
  left: 50%;
  transform: translateX(-50%);
}

.press-dot {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: var(--color-primary);
  color: var(--color-on-primary);
  font-size: 11px;
  font-weight: 500;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--color-primary) 30%, transparent);
  transition: transform 0.08s, opacity 0.08s;
  animation: dot-in 0.08s ease;
}

@keyframes dot-in {
  from { transform: scale(0.5); opacity: 0; }
  to   { transform: scale(1);   opacity: 1; }
}

.open-circle {
  width: 22px;
  height: 22px;
  border-radius: 50%;
  border: 2px solid var(--color-primary);
  display: block;
}

.mute-mark {
  font-size: 18px;
  color: var(--color-text-muted);
  font-weight: 700;
  line-height: 1;
}

.clear-btn {
  padding: 8px 24px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--color-border);
  background: var(--color-surface);
  color: var(--color-text-muted);
  font-size: 14px;
  cursor: pointer;
  transition: border-color 0.15s, color 0.15s;
}

.clear-btn:hover {
  border-color: var(--color-primary);
  color: var(--color-primary);
}
</style>
