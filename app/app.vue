<template>
  <div class="app">
    <header class="app-header">
      <div class="app-header-left">
        <h2 class="app-title">fret notes</h2>
        <nav class="app-nav">
          <NuxtLink to="/guitar-to-piano" class="nav-tab">從吉他</NuxtLink>
          <NuxtLink to="/piano-to-guitar" class="nav-tab">從鋼琴</NuxtLink>
        </nav>
      </div>
      <button class="theme-toggle" @click="toggleTheme" :aria-label="isDark ? '切換亮色模式' : '切換暗色模式'">
        {{ isDark ? '☀️' : '🌙' }}
      </button>
    </header>

    <NuxtPage />
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

.app-header-left {
  display: flex;
  align-items: center;
  gap: 20px;
}

.app-title {
  font-family: 'DM Sans', sans-serif;
  font-size: 20px;
  font-weight: 700;
  color: var(--color-primary);
  letter-spacing: -0.5px;
}

.app-nav {
  display: flex;
  gap: 4px;
}

.nav-tab {
  padding: 6px 12px;
  border-radius: var(--radius-sm);
  font-family: 'Inter', sans-serif;
  font-size: 14px;
  font-weight: 600;
  color: var(--color-text-muted);
  text-decoration: none;
  min-height: 36px;
  display: inline-flex;
  align-items: center;
}

.nav-tab.router-link-active {
  color: var(--color-on-primary);
  background: var(--color-primary);
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
</style>
