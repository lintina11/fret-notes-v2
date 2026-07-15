<template>
  <div class="note-map-page">
    <GuitarNeck :positions="litPositions" />

    <div class="note-map-piano">
      <PianoKeyboard
        interactive
        :fixed-range="{ startMidi: 40, endMidi: 84 }"
        :active-color-map="selectedMidis"
        @toggle="toggleNote"
      />
    </div>

    <div class="note-map-controls">
      <label class="control-toggle">
        <input type="checkbox" :checked="!showOffOctave" @change="showOffOctave = !showOffOctave" />
        隱藏非同八度亮點
      </label>
      <span class="control-count">{{ selectedMidis.size }} / {{ MAX_NOTES }}</span>
      <button class="control-clear" @click="clear">清除</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { usePianoNoteMap } from '~/composables/usePianoNoteMap'
import { MAX_NOTES } from '~~/core/music-theory/note-map'

const { selectedMidis, showOffOctave, litPositions, toggleNote, clear } = usePianoNoteMap()
</script>

<style scoped>
.note-map-page {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 16px;
}

.note-map-piano {
  width: 100%;
  overflow-x: auto;
}

.note-map-controls {
  display: flex;
  align-items: center;
  gap: 16px;
  flex-wrap: wrap;
  font-family: 'Inter', sans-serif;
  font-size: 14px;
  color: var(--color-text);
}

.control-toggle {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  cursor: pointer;
}

.control-count {
  color: var(--color-text-muted);
}

.control-clear {
  background: none;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  padding: 6px 12px;
  min-height: 36px;
  cursor: pointer;
  color: var(--color-text);
}
</style>
