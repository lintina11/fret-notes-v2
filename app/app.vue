<template>
  <div>
    <header>
      <button @click="toggleTheme">{{ isDark ? '☀️' : '🌙' }}</button>
    </header>
    <main>
      <p>fret-notes-v2</p>
    </main>
  </div>
</template>

<script setup lang="ts">
const isDark = ref(false)

function toggleTheme() {
  isDark.value = !isDark.value
  document.documentElement.setAttribute('data-theme', isDark.value ? 'dark' : 'light')
}
</script>
