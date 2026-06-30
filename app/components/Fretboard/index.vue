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
          v-else-if="!pressedFrets.has(s) && !isBarred(s)"
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

      <!-- Layer 4b-2: Barre dim overlay (full-width rows between capo and barre) -->
      <rect
        v-for="fi in barreDimRows"
        :key="`barredim-${fi}`"
        :x="sx(0) - STRING_GAP / 2"
        :y="TOP_PAD + fi * FRET_GAP"
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

      <!-- Layer 4d: Barre bar -->
      <rect
        v-if="barreRowIndex !== null"
        :x="barreBarX"
        :y="TOP_PAD + barreRowIndex * FRET_GAP + FRET_GAP / 2 - DOT_RADIUS"
        :width="barreBarW"
        :height="2 * DOT_RADIUS"
        :rx="DOT_RADIUS"
        class="barre-bar"
      />

      <!-- Layer 4e: Barre per-string note names -->
      <text
        v-for="label in barreNoteLabels"
        :key="`barrelabel-${label.s}`"
        :x="sx(label.s)"
        :y="TOP_PAD + (barreRowIndex ?? 0) * FRET_GAP + FRET_GAP / 2"
        text-anchor="middle"
        dominant-baseline="middle"
        class="barre-label-text"
      >{{ label.name }}</text>

      <!-- Layer 7: Barre toggle column (per visible fret row) -->
      <g
        v-for="(fretNum, idx) in displayFretNums"
        :key="`barretoggle-${fretNum}`"
        v-show="!barreToggleDisabled(fretNum)"
        class="barre-toggle"
        @click="toggleBarre(fretNum)"
      >
        <rect
          :x="BARRE_LABEL_X - 4"
          :y="TOP_PAD + idx * FRET_GAP"
          :width="BARRE_COL_W - 10"
          :height="FRET_GAP"
          fill="transparent"
        />
        <text
          :x="BARRE_LABEL_X"
          :y="TOP_PAD + idx * FRET_GAP + FRET_GAP / 2"
          dominant-baseline="middle"
          class="barre-toggle-text"
        >封閉</text>
      </g>

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

const {
  pressedFrets, mutedStrings, capoFret, barreFret, barreLength,
  toggleFret, toggleMute, setCapo, toggleBarre, clearAll,
} = useFretboard()

// ── Layout constants ──────────────────────────────────────────────
const STRINGS = [0, 1, 2, 3, 4, 5]
const DISPLAY_FRETS = 5
const MAX_START_FRET = 12 - DISPLAY_FRETS + 1  // 8
const POSITION_DOTS = [3, 5, 7, 9, 12]
const MAX_CAPO = 7

const STRING_GAP = 28
const FRET_GAP = 38
const LEFT_PAD = 28
const TOP_PAD = 50
const BOTTOM_PAD = 22
const NUT_THICKNESS = 5
const DOT_RADIUS = 13
const OPEN_RADIUS = 7

// Right-hand column holds the per-row 「封閉」 barre toggles.
const BARRE_COL_W = 60
const BARRE_LABEL_X = LEFT_PAD + 5 * STRING_GAP + 20  // text x
const BARRE_DOT_X = LEFT_PAD + 5 * STRING_GAP + 46     // status dot cx
const BARRE_DOT_R = 2
// The bar extends past its covered strings on both ends, at any barre length
const BARRE_OVERHANG = 13

const SVG_W = LEFT_PAD + 5 * STRING_GAP + BARRE_COL_W   // 228
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
      const fretNum = displayFretNums.value[fi]!
      if (isDimmed(fretNum)) continue                              // capo-blocked
      if (barreFret.value !== null) {
        if (fretNum < barreFret.value) continue                   // below the barre: all 6 strings blocked
        if (isBarred(s) && fretNum === barreFret.value) continue  // covered string at the bar itself
      }
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

// First covered (thickest) string index for the current barre length
const barreStartString = computed<number>(() => 6 - barreLength.value)

// Bar geometry: overhang past the covered strings on BOTH ends, at any length,
// so the bar always reads as a finger pressing across (never ends flush on a string).
const barreBarX = computed<number>(() => sx(barreStartString.value) - BARRE_OVERHANG)
const barreBarW = computed<number>(() => sx(5) - sx(barreStartString.value) + 2 * BARRE_OVERHANG)

// Row index of the barre within the window, or null when off-window
const barreRowIndex = computed<number | null>(() => {
  const b = barreFret.value
  if (b === null || b < startFret.value || b > startFret.value + DISPLAY_FRETS - 1) return null
  return b - startFret.value
})

// Note name for each covered string that actually sounds via the barre
// (covered, not muted, no higher press). Strings with a higher press show
// their name on their own press dot instead.
const barreNoteLabels = computed<{ s: number; name: string }[]>(() => {
  const b = barreFret.value
  if (b === null || barreRowIndex.value === null) return []
  const out: { s: number; name: string }[] = []
  for (let s = barreStartString.value; s <= 5; s++) {
    if (mutedStrings.value.has(s)) continue
    const press = pressedFrets.value.get(s)
    if (press !== undefined && press > b) continue
    out.push({ s, name: noteNameAt(s, b) })
  }
  return out
})

// Is this string covered by the current barre?
function isBarred(stringIndex: number): boolean {
  return barreFret.value !== null && stringIndex >= barreStartString.value
}

// Full-width dim rows the barre blocks: frets between the capo and the barre.
// The capo overlay already dims rows <= capo, so we only fill the gap
// capoFret < fretNum < barreFret (no redundant overlap; full 6-string width,
// independent of barre length).
const barreDimRows = computed<number[]>(() => {
  const b = barreFret.value
  if (b === null) return []
  const rows: number[] = []
  for (let fi = 0; fi < DISPLAY_FRETS; fi++) {
    const fretNum = displayFretNums.value[fi]!
    if (fretNum > capoFret.value && fretNum < b) rows.push(fi)
  }
  return rows
})

// A barre toggle is disabled on rows at or below the capo
function barreToggleDisabled(fretNum: number): boolean {
  return fretNum <= capoFret.value
}

// ── Navigation ────────────────────────────────────────────────────
// Scroll the visible 5-fret window only. Pressed notes live on the full
// 12-fret board and are never dropped by scrolling — they just aren't drawn
// while off-window. Only setCapo's transpose drops notes pushed past fret 12.
function navigate(dir: 1 | -1): void {
  startFret.value = Math.min(MAX_START_FRET, Math.max(1, startFret.value + dir))
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

<style lang="scss" scoped>
@import "/assets/styles/fretboard.scss";
</style>
