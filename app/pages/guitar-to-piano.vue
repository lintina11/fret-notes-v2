<template>
  <div class="layout">
    <div class="layout-top">
      <div class="panel panel-fretboard">
        <Fretboard />
      </div>
      <div class="panel panel-chord">
        <ChordResult />
      </div>
    </div>
    <div class="layout-piano">
      <PianoKeyboard />
    </div>
  </div>
</template>

<script setup lang="ts"></script>

<style scoped>
.layout {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 16px;
}

.layout-top {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.layout-piano {
  width: 100%;
  overflow-x: auto;
}

/* iPad portrait / phone: ChordResult → Fretboard → Piano */
.panel-chord { order: 1; }
.panel-fretboard { order: 2; }
.layout-piano { order: 3; }

/* iPad landscape: left Fretboard | right ChordResult / bottom Piano */
@media (orientation: landscape) and (min-width: 768px) {
  .layout-top {
    flex-direction: row;
    flex: 1;
  }
  .panel-fretboard { flex: 1; order: 1; }
  .panel-chord { flex: 1; order: 2; }
}
</style>
