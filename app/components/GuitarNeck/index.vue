<template>
  <div class="neck-wrap">
    <svg class="neck-svg" :viewBox="`0 0 ${SVG_W} ${SVG_H}`" :width="SVG_W" :height="SVG_H" xmlns="http://www.w3.org/2000/svg">
      <!-- Open-string tuning letters (far left) -->
      <text
        v-for="s in STRINGS"
        :key="`open-${s}`"
        :x="OPEN_X"
        :y="fy(s)"
        text-anchor="middle"
        dominant-baseline="middle"
        class="neck-open-note"
      >{{ openNote(s) }}</text>

      <!-- Nut -->
      <rect :x="NUT_X - NUT_W" :y="fy(5)" :width="NUT_W" :height="fy(0) - fy(5)" class="neck-nut" />

      <!-- Fret lines -->
      <line
        v-for="i in FRET_INDICES"
        :key="`fret-${i}`"
        :x1="NUT_X + i * FRET_W" :y1="fy(5)"
        :x2="NUT_X + i * FRET_W" :y2="fy(0)"
        class="neck-fret-line"
      />

      <!-- String lines -->
      <line
        v-for="s in STRINGS"
        :key="`str-${s}`"
        :x1="NUT_X" :y1="fy(s)"
        :x2="NUT_X + NECK_FRETS * FRET_W" :y2="fy(s)"
        class="neck-string-line"
      />

      <!-- Inlay markers -->
      <template v-for="f in SINGLE_INLAYS" :key="`inlay-${f}`">
        <circle :cx="fx(f)" :cy="NECK_MID_Y" r="5" class="neck-inlay" />
      </template>
      <template v-for="f in DOUBLE_INLAYS" :key="`inlay2-${f}`">
        <circle :cx="fx(f)" :cy="NECK_MID_Y - STRING_GAP" r="5" class="neck-inlay" />
        <circle :cx="fx(f)" :cy="NECK_MID_Y + STRING_GAP" r="5" class="neck-inlay" />
      </template>

      <!-- Fret numbers -->
      <text
        v-for="f in NUMBERED_FRETS"
        :key="`num-${f}`"
        :x="fx(f)" :y="SVG_H - 6"
        text-anchor="middle"
        class="neck-fret-num"
      >{{ f }}</text>

      <!-- Lit positions -->
      <g
        v-for="(p, idx) in positions"
        :key="`lit-${p.stringIndex}-${p.fret}-${idx}`"
        :opacity="p.dim ? 0.4 : 1"
      >
        <circle :cx="fx(p.fret)" :cy="fy(p.stringIndex)" :r="DOT_R" :fill="`var(--note-color-${p.colorIndex})`" />
        <text
          :x="fx(p.fret)" :y="fy(p.stringIndex)"
          text-anchor="middle"
          dominant-baseline="central"
          class="neck-dot-text"
        >{{ p.noteName }}{{ p.octave }}</text>
      </g>
    </svg>
  </div>
</template>

<script setup lang="ts">
import { OPEN_STRINGS, midiToNoteName } from '~~/core/music-theory/notes'
import { NECK_FRETS } from '~~/core/music-theory/neck'
import type { LitPosition } from '~~/core/music-theory/note-map'

defineProps<{ positions: LitPosition[] }>()

// ── Layout constants ──────────────────────────────────────────────
const STRINGS = [0, 1, 2, 3, 4, 5]
const FRET_W = 34
const STRING_GAP = 30
const TOP_PAD = 24
const BOTTOM_PAD = 30      // room for fret numbers
const OPEN_X = 16          // x of the open-string tuning letters
const NUT_X = 44           // left edge of fret 1
const NUT_W = 4
const DOT_R = 12

const SINGLE_INLAYS = [3, 5, 7, 9, 15, 17, 19]
const DOUBLE_INLAYS = [12]
const NUMBERED_FRETS = [3, 5, 7, 9, 12, 15, 17, 19]

// Fret boundary line indices 1..NECK_FRETS (0 is the nut, drawn separately).
const FRET_INDICES = Array.from({ length: NECK_FRETS }, (_, i) => i + 1)

const SVG_W = NUT_X + NECK_FRETS * FRET_W + 12
const SVG_H = TOP_PAD + 5 * STRING_GAP + BOTTOM_PAD
const NECK_MID_Y = TOP_PAD + 2.5 * STRING_GAP

// High-E (string 5) on top, low-E (string 0) on the bottom.
function fy(stringIndex: number): number {
  return TOP_PAD + (5 - stringIndex) * STRING_GAP
}

// Open notes (fret 0) sit left of the nut; fretted notes at the cell centre.
function fx(fret: number): number {
  return fret === 0 ? OPEN_X : NUT_X + (fret - 0.5) * FRET_W
}

function openNote(stringIndex: number): string {
  return midiToNoteName(OPEN_STRINGS[stringIndex]!)
}
</script>

<style lang="scss" scoped>
@use "/assets/styles/guitarNeck.scss" as *;
</style>
