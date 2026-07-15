<template>
  <div class="note-map-page">
    <GuitarNeck :positions="samplePositions" />
  </div>
</template>

<script setup lang="ts">
import type { LitPosition } from '~~/core/music-theory/note-map'
import { computeLitPositions } from '~~/core/music-theory/note-map'

// TEMPORARY: sample C4 (color 0) + E4 (color 1) to verify rendering.
const samplePositions: LitPosition[] = computeLitPositions(new Map([[60, 0], [64, 1]]), true)
</script>

<style scoped>
.note-map-page {
  flex: 1;
  padding: 16px;
}
</style>
