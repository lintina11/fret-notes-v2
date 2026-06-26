<template>
  <div class="chord-diagram-wrap">
    <svg
      class="chord-svg"
      :viewBox="`0 0 ${SVG_W} ${SVG_H}`"
      xmlns="http://www.w3.org/2000/svg"
    >
      <!-- Layer 6: Open / muted string markers above nut -->
      <g
        v-for="s in STRINGS"
        :key="`marker-${s}`"
        class="string-marker"
        @click="toggleMute(s)"
      >
        <!-- Transparent hit area for touch — expands target beyond small glyph -->
        <rect
          :x="sx(s) - STRING_GAP / 2"
          :y="TOP_PAD - 32"
          :width="STRING_GAP"
          height="32"
          fill="transparent"
        />
        <text
          v-if="mutedStrings.has(s)"
          :x="sx(s)"
          :y="TOP_PAD - 14"
          text-anchor="middle"
          dominant-baseline="middle"
          class="mute-text"
        >×</text>
        <circle
          v-else-if="!pressedFrets.has(s)"
          :cx="sx(s)"
          :cy="TOP_PAD - 14"
          :r="OPEN_RADIUS"
          class="open-circle-svg"
        />
      </g>

      <!-- Layer 3: Nut bar (at open position) or fret label -->
      <rect
        v-if="startFret === 1"
        :x="sx(0)"
        :y="TOP_PAD - NUT_THICKNESS"
        :width="sx(5) - sx(0)"
        :height="NUT_THICKNESS"
        class="nut"
      />
      <text
        v-else
        :x="sx(0) - 6"
        :y="TOP_PAD + FRET_GAP / 2"
        text-anchor="end"
        dominant-baseline="middle"
        class="fret-label-text"
      >{{ startFret }}fr</text>

      <!-- Layer 2: String lines (vertical) -->
      <line
        v-for="s in STRINGS"
        :key="`string-${s}`"
        :x1="sx(s)" :y1="TOP_PAD"
        :x2="sx(s)" :y2="TOP_PAD + DISPLAY_FRETS * FRET_GAP"
        class="string-line"
      />

      <!-- Layer 2: Fret lines (horizontal) -->
      <line
        v-for="fi in FRET_LINE_INDICES"
        :key="`fretline-${fi}`"
        :x1="sx(0)" :y1="TOP_PAD + fi * FRET_GAP"
        :x2="sx(5)" :y2="TOP_PAD + fi * FRET_GAP"
        class="fret-line"
      />

      <!-- Layer 4: Position marker dots -->
      <g v-for="(fretNum, idx) in displayFretNums" :key="`posdot-${fretNum}`">
        <circle
          v-if="POSITION_DOTS.includes(fretNum)"
          :cx="(sx(0) + sx(5)) / 2"
          :cy="TOP_PAD + idx * FRET_GAP + FRET_GAP / 2"
          r="4"
          class="position-dot"
        />
      </g>

      <!-- Layer 4b: Capo dim overlay (frets at/below the capo) -->
      <rect
        v-for="(fretNum, idx) in displayFretNums"
        v-show="isDimmed(fretNum)"
        :key="`dim-${fretNum}`"
        :x="sx(0) - STRING_GAP / 2"
        :y="TOP_PAD + idx * FRET_GAP"
        :width="sx(5) - sx(0) + STRING_GAP"
        :height="FRET_GAP"
        class="capo-dim"
      />

      <!-- Layer 4c: Capo bar -->
      <rect
        v-if="capoRowIndex !== null"
        :x="sx(0)"
        :y="TOP_PAD + capoRowIndex * FRET_GAP + FRET_GAP / 2 - 4"
        :width="sx(5) - sx(0)"
        height="8"
        rx="4"
        class="capo-bar"
      />

      <!-- Layer 1: Transparent click targets -->
      <rect
        v-for="cell in clickCells"
        :key="`cell-${cell.s}-${cell.fi}`"
        :x="sx(cell.s) - STRING_GAP / 2"
        :y="TOP_PAD + cell.fi * FRET_GAP"
        :width="STRING_GAP"
        :height="FRET_GAP"
        fill="transparent"
        class="cell-target"
        @click="toggleFret(cell.s, displayFretNums[cell.fi]!)"
      />

      <!-- Layer 5: Pressed note dots -->
      <g v-for="s in STRINGS" :key="`pressed-${s}`">
        <g v-if="pressedFrets.has(s) && fretInDisplay(pressedFrets.get(s)!)">
          <circle
            :cx="sx(s)"
            :cy="TOP_PAD + fretDisplayIndex(pressedFrets.get(s)!) * FRET_GAP + FRET_GAP / 2"
            :r="DOT_RADIUS"
            class="press-dot-circle"
          />
          <text
            :x="sx(s)"
            :y="TOP_PAD + fretDisplayIndex(pressedFrets.get(s)!) * FRET_GAP + FRET_GAP / 2"
            text-anchor="middle"
            dominant-baseline="middle"
            class="press-dot-text"
          >{{ noteNameAt(s, pressedFrets.get(s)!) }}</text>
        </g>
      </g>
    </svg>

    <!-- Navigation row -->
    <div class="nav-row">
      <span class="nav-label">Position</span>
      <button class="nav-btn" :disabled="startFret <= 1" @click="navigate(-1)">▲</button>
      <span class="nav-label">{{ startFret === 1 ? 'Open' : `${startFret}fr` }}</span>
      <button class="nav-btn" :disabled="startFret >= MAX_START_FRET" @click="navigate(1)">▼</button>
    </div>

    <!-- Capo stepper -->
    <div class="capo-row">
      <span class="capo-label">Capo</span>
      <button class="nav-btn" :disabled="capoFret <= 0" @click="setCapo(capoFret - 1)">▲</button>
      <span class="nav-label">{{ capoFret === 0 ? 'Off' : capoFret }}</span>
      <button class="nav-btn" :disabled="capoFret >= MAX_CAPO" @click="setCapo(capoFret + 1)">▼</button>
    </div>

    <button class="clear-btn" @click="handleClear">清除</button>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useFretboard } from '~/composables/useFretboard'
import { midiToNoteName, OPEN_STRINGS } from '~~/core/music-theory/notes'

const { pressedFrets, mutedStrings, capoFret, toggleFret, toggleMute, setCapo, clearAll } = useFretboard()

// ── Layout constants ──────────────────────────────────────────────
const STRINGS = [0, 1, 2, 3, 4, 5]
const DISPLAY_FRETS = 5
const MAX_START_FRET = 12 - DISPLAY_FRETS + 1  // 8
const POSITION_DOTS = [3, 5, 7, 9, 12]
const MAX_CAPO = 7

const STRING_GAP = 28
const FRET_GAP = 38
const LEFT_PAD = 28
const RIGHT_PAD = 16
const TOP_PAD = 50
const BOTTOM_PAD = 22
const NUT_THICKNESS = 5
const DOT_RADIUS = 13
const OPEN_RADIUS = 7

const SVG_W = LEFT_PAD + 5 * STRING_GAP + RIGHT_PAD   // 184
const SVG_H = TOP_PAD + DISPLAY_FRETS * FRET_GAP + BOTTOM_PAD  // 262

// Pre-computed fret line indices: 0, 1, 2, 3, 4, 5
const FRET_LINE_INDICES = Array.from({ length: DISPLAY_FRETS + 1 }, (_, i) => i)

// ── Coordinate helpers ────────────────────────────────────────────
function sx(s: number): number { return LEFT_PAD + s * STRING_GAP }

// ── Window state ──────────────────────────────────────────────────
const startFret = ref(1)

const displayFretNums = computed<number[]>(() =>
  Array.from({ length: DISPLAY_FRETS }, (_, i) => startFret.value + i)
)

// Viewport follows the capo: shift the window by the same delta as the capo
// so the capo bar and the shape stay at the same on-screen position. With no
// manual Position scrolling this keeps startFret = capoFret + 1.
watch(capoFret, (newCapo, oldCapo) => {
  const delta = newCapo - oldCapo
  startFret.value = Math.min(MAX_START_FRET, Math.max(1, startFret.value + delta))
})

const clickCells = computed(() => {
  const cells: { s: number; fi: number }[] = []
  for (const s of STRINGS) {
    for (let fi = 0; fi < DISPLAY_FRETS; fi++) {
      if (isDimmed(displayFretNums.value[fi]!)) continue  // capo-blocked
      cells.push({ s, fi })
    }
  }
  return cells
})

function fretInDisplay(fret: number): boolean {
  return fret >= startFret.value && fret < startFret.value + DISPLAY_FRETS
}

function fretDisplayIndex(fret: number): number {
  return fret - startFret.value
}

// True when a display row's fret number is at or below the capo (dimmed, non-clickable)
function isDimmed(fretNum: number): boolean {
  return fretNum <= capoFret.value
}

// The capo bar is shown only when the capo fret sits inside the current window
const capoRowIndex = computed<number | null>(() => {
  const c = capoFret.value
  if (c < startFret.value || c > startFret.value + DISPLAY_FRETS - 1) return null
  return c - startFret.value
})

// ── Navigation ────────────────────────────────────────────────────
function navigate(dir: 1 | -1): void {
  const next = Math.min(MAX_START_FRET, Math.max(1, startFret.value + dir))
  if (next === startFret.value) return
  startFret.value = next
  // Clear any pressed frets now outside the visible window
  for (const s of STRINGS) {
    const fret = pressedFrets.value.get(s)
    if (fret !== undefined && !fretInDisplay(fret)) {
      toggleFret(s, fret)
    }
  }
}

// ── Helpers ───────────────────────────────────────────────────────
function noteNameAt(stringIndex: number, fret: number): string {
  return midiToNoteName(OPEN_STRINGS[stringIndex]! + fret)
}

function handleClear(): void {
  clearAll()
  startFret.value = 1
}
</script>

<style scoped>
.chord-diagram-wrap {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  padding: 16px;
}

.chord-svg {
  width: 100%;
  max-width: 240px;
  height: auto;
  overflow: visible;
}

.string-marker {
  cursor: pointer;
}

.mute-text {
  font-size: 14px;
  font-weight: 700;
  fill: var(--color-text-muted);
  font-family: 'Inter', sans-serif;
}

.open-circle-svg {
  fill: none;
  stroke: var(--color-primary);
  stroke-width: 2;
}

.nut {
  fill: var(--color-text);
}

.fret-label-text {
  font-size: 10px;
  fill: var(--color-text-muted);
  font-family: 'Inter', sans-serif;
}

.string-line {
  stroke: var(--color-border);
  stroke-width: 1.5;
}

.fret-line {
  stroke: var(--color-border);
  stroke-width: 1;
}

.position-dot {
  fill: var(--color-border);
}

.cell-target {
  cursor: pointer;
}

.press-dot-circle {
  fill: var(--color-primary);
  animation: dot-in 0.08s ease;
  transform-box: fill-box;
  transform-origin: center;
  pointer-events: none;
}

@keyframes dot-in {
  from { transform: scale(0.3); opacity: 0; }
  to   { transform: scale(1);   opacity: 1; }
}

.press-dot-text {
  font-size: 10px;
  font-weight: 600;
  fill: var(--color-on-primary);
  font-family: 'Inter', sans-serif;
  pointer-events: none;
}

.nav-row {
  display: flex;
  align-items: center;
  gap: 12px;
}

.nav-btn {
  width: 32px;
  height: 32px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--color-border);
  background: var(--color-surface);
  color: var(--color-text-muted);
  font-size: 12px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: border-color 0.15s, color 0.15s;
}

.nav-btn:hover:not(:disabled) {
  border-color: var(--color-primary);
  color: var(--color-primary);
}

.nav-btn:disabled {
  opacity: 0.3;
  cursor: default;
}

.nav-label {
  font-size: 12px;
  color: var(--color-text-muted);
  font-family: 'Inter', sans-serif;
  min-width: 40px;
  text-align: center;
}

.capo-row {
  display: flex;
  align-items: center;
  gap: 12px;
}

.capo-label {
  font-size: 12px;
  color: var(--color-text-muted);
  font-family: 'Inter', sans-serif;
}

.capo-dim {
  fill: var(--color-border);
  opacity: 0.55;
  pointer-events: none;
}

.capo-bar {
  fill: var(--color-accent);
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
