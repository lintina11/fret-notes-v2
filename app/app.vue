<template>
  <div class="app">
    <header class="app-header">
      <h2 class="app-title">fret notes</h2>
      <button class="theme-toggle" @click="toggleTheme" :aria-label="isDark ? '切換亮色模式' : '切換暗色模式'">
        {{ isDark ? '☀️' : '🌙' }}
      </button>
    </header>

    <!-- iPad landscape: top-left Fretboard, top-right ChordResult, bottom PianoKeyboard -->
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
  </div>
</template>

<script setup lang="ts">
const isDark = ref(false)

function toggleTheme() {
  isDark.value = !isDark.value
  document.documentElement.setAttribute('data-theme', isDark.value ? 'dark' : 'light')
}
</script>

<style>
.app {
  min-height: 100dvh;
  display: flex;
  flex-direction: column;
}

.app-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 20px;
  border-bottom: 1px solid var(--color-border);
}

.app-title {
  font-family: 'DM Sans', sans-serif;
  font-size: 20px;
  font-weight: 700;
  color: var(--color-primary);
  letter-spacing: -0.5px;
}

.theme-toggle {
  background: none;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  padding: 6px 10px;
  font-size: 18px;
  cursor: pointer;
  line-height: 1;
  min-width: 44px;
  min-height: 44px;
}

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

  .panel-fretboard {
    flex: 1;
    order: 1;
  }

  .panel-chord {
    flex: 1;
    order: 2;
  }
}
</style>
