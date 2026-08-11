<template>
  <div class="note-map-page">
    <div class="note-map-piano">
      <PianoKeyboard
        interactive
        :fixed-range="{ startMidi: 40, endMidi: 84 }"
        :active-color-map="selectedMidis"
        @toggle="toggleNote"
      />
    </div>

    <div class="note-map-mid">
      <ChordResult
        class="note-map-chord"
        :chord="detectedChord"
        :capo-fret="0"
        empty-hint="點鋼琴鍵來識別和弦"
      />

      <div class="note-map-controls">
        <label class="control-toggle">
          <input type="checkbox" :checked="showOffOctave" @change="showOffOctave = !showOffOctave" />
          顯示非同八度亮點
        </label>
        <span class="control-count">已選擇{{ selectedMidis.size }} / {{ MAX_NOTES }}個音</span>
        <button class="control-clear" @click="clear">清除</button>
      </div>
    </div>

    <GuitarNeck :positions="litPositions" />
  </div>
</template>

<script setup lang="ts">
import { usePianoNoteMap } from '~/composables/usePianoNoteMap'
import { MAX_NOTES } from '~~/core/music-theory/note-map'

const { selectedMidis, showOffOctave, litPositions, detectedChord, toggleNote, clear } = usePianoNoteMap()
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

/* Chord result (left) + controls (right), stacking on narrow screens */
.note-map-mid {
  display: flex;
  gap: 16px;
  align-items: stretch;
  flex-wrap: wrap;
}

.note-map-chord {
  flex: 1 1 320px;
  min-width: 0;
}

.note-map-controls {
  flex: 1 0 auto;
  align-self: stretch;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  justify-content: center;
  gap: 16px;
  padding: 16px 20px;
  background: var(--color-surface);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-card);
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
