# Chord Diagram Fretboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the 12-fret checkerboard grid in `Fretboard/index.vue` with an SVG-based chord diagram (6 vertical string lines × 5 horizontal fret lines, portrait cells, dots at intersections, manual fret-window navigation).

**Architecture:** Single-file rewrite of `Fretboard/index.vue`. The composable `useFretboard.ts` is unchanged. All layout is computed from constants (STRING_GAP, FRET_GAP, LEFT_PAD, TOP_PAD) into SVG coordinate helpers `sx(s)` and `fy(fi)`. A local `startFret` ref controls which 5 frets are visible; navigation arrows shift the window and auto-clear any pressed frets that fall outside the new window.

**Tech Stack:** Vue 3 Composition API, inline SVG, CSS custom properties for theming.

## Global Constraints

- Only `app/components/Fretboard/index.vue` is modified — no other file touched.
- All colors must use existing CSS custom properties (`--color-border`, `--color-text`, `--color-text-muted`, `--color-primary`, `--color-on-primary`).
- No new dependencies.
- Vitest environment is `node` with no Vue component test utilities — no component tests; verify visually by running the dev server.

---

### Task 1: Rewrite Fretboard/index.vue as SVG chord diagram

**Files:**
- Modify: `app/components/Fretboard/index.vue` (full rewrite)

**Interfaces:**
- Consumes: `useFretboard()` → `{ pressedFrets, mutedStrings, toggleFret, toggleMute, clearAll }`
- Consumes: `midiToNoteName`, `OPEN_STRINGS` from `~~/core/music-theory/notes`
- Produces: visual chord diagram component (no external interface changes)

---

- [ ] **Step 1: Replace the file with the new SVG implementation**

Replace the entire content of `app/components/Fretboard/index.vue` with:

```vue
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
      <template v-for="(fretNum, idx) in displayFretNums" :key="`posdot-${fretNum}`">
        <circle
          v-if="POSITION_DOTS.includes(fretNum)"
          :cx="(sx(0) + sx(5)) / 2"
          :cy="TOP_PAD + idx * FRET_GAP + FRET_GAP / 2"
          r="4"
          class="position-dot"
        />
      </template>

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
      <template v-for="s in STRINGS" :key="`pressed-${s}`">
        <template v-if="pressedFrets.has(s) && fretInDisplay(pressedFrets.get(s)!)">
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
        </template>
      </template>
    </svg>

    <!-- Navigation row -->
    <div class="nav-row">
      <button class="nav-btn" :disabled="startFret <= 1" @click="navigate(-1)">▲</button>
      <span class="nav-label">{{ startFret === 1 ? 'Open' : `${startFret}fr` }}</span>
      <button class="nav-btn" :disabled="startFret >= MAX_START_FRET" @click="navigate(1)">▼</button>
    </div>

    <button class="clear-btn" @click="handleClear">清除</button>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useFretboard } from '~/composables/useFretboard'
import { midiToNoteName, OPEN_STRINGS } from '~~/core/music-theory/notes'

const { pressedFrets, mutedStrings, toggleFret, toggleMute, clearAll } = useFretboard()

// ── Layout constants ──────────────────────────────────────────────
const STRINGS = [0, 1, 2, 3, 4, 5]
const DISPLAY_FRETS = 5
const MAX_START_FRET = 12 - DISPLAY_FRETS + 1  // 8
const POSITION_DOTS = [3, 5, 7, 9, 12]

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

const clickCells = computed(() => {
  const cells: { s: number; fi: number }[] = []
  for (const s of STRINGS) {
    for (let fi = 0; fi < DISPLAY_FRETS; fi++) {
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

// ── Navigation ────────────────────────────────────────────────────
function navigate(dir: 1 | -1): void {
  const next = Math.min(MAX_START_FRET, Math.max(1, startFret.value + dir))
  if (next === startFret.value) return
  startFret.value = next
  // Clear any pressed frets now outside the visible window
  for (const s of STRINGS) {
    const fret = pressedFrets.get(s)
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

/* SVG element styles */
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

/* Navigation row */
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
```

- [ ] **Step 2: Start the dev server and visually verify**

```bash
npm run dev
```

Open `http://localhost:3000` and check:

| 項目 | 預期結果 |
|---|---|
| 指型圖外觀 | 6條垂直弦線交叉5條橫向格線，格子縱向偏長 |
| 琴枕 | 最上方有一條粗橫條（startFret=1 時） |
| 開放弦標記 | 每條弦上方顯示空心圓（未按壓、未靜音） |
| 點擊弦格 | 圓點出現在弦線與格線交叉點中央，顯示音名 |
| 再次點擊同格 | 圓點消失（toggle off） |
| 點擊空心圓標記 | 切換成 × 靜音符號 |
| ▼ 按鈕 | startFret +1，格線下移，標籤更新（如「2fr」） |
| ▲ 按鈕 | startFret -1，格線上移 |
| 翻頁清除 | 翻頁後，原本在視窗外的按壓點消失 |
| 翻到 startFret=1 | 琴枕粗條重新出現，標籤顯示「Open」 |
| 第5格把位 | 翻到第5格時，位置標記小點出現於格子中央 |
| 清除按鈕 | 所有點清除，startFret 回到 1 |
| 深色模式切換 | 所有顏色正確跟隨 theme 切換 |

- [ ] **Step 3: Commit**

```bash
git add app/components/Fretboard/index.vue
git commit -m "feat: redesign Fretboard as SVG chord diagram with fret-window navigation"
```
