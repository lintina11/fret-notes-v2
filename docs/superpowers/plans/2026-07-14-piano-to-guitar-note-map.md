# Piano-to-Fretboard Note Map Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a second read-only page where clicking up to 6 notes on a piano keyboard lights every matching position on a full 20-fret guitar neck.

**Architecture:** Pure, tested music-theory functions (`neck.ts`, `note-map.ts`) compute which fret positions light up; a thin reactive composable (`usePianoNoteMap`) wraps them; new `<GuitarNeck>` renders the neck; the existing `<PianoKeyboard>` is extended (backward-compatibly) to be clickable with a fixed range and per-note colors. Nuxt file-based routing splits the two directions into separate pages sharing components but not state.

**Tech Stack:** Nuxt 4 (Vue 3 + TypeScript), Vitest, SCSS modules, CSS-variable theming.

## Global Constraints

- Framework: Nuxt `^4.4.8`, Vue `^3.5.35`, static generate. No new dependencies.
- Standard tuning only, sourced from `OPEN_STRINGS` (`[40,45,50,55,59,64]` = E2 A2 D3 G3 B3 E4). Introduce no new tuning data.
- Guitar neck length: **20 frets** (`NECK_FRETS = 20`). Piano range on the new page: **E2–C6** = MIDI `40`–`84`.
- Max **6** simultaneously selected notes; 6-color palette indexed 0–5.
- Pure logic lives under `core/music-theory/` (relative-import unit tests, node env); Vue/composable code is verified in the browser preview. Do not import the `~~`/`~` aliases into files under `tests/`.
- Traditional Chinese for user-facing copy. Tabs: **從吉他** / **從鋼琴**. Routes: `/guitar-to-piano`, `/piano-to-guitar`.
- SCSS module per component; colors via CSS variables in `variables.css` (light + `[data-theme="dark"]`).
- Commit after each task.

---

### Task 1: Core neck positions + `midiToOctave`

**Files:**
- Modify: `core/music-theory/notes.ts`
- Create: `core/music-theory/neck.ts`
- Test: `tests/music-theory/neck.test.ts`

**Interfaces:**
- Consumes: `OPEN_STRINGS`, `midiToPitchClass` from `./notes`.
- Produces:
  - `midiToOctave(midi: number): number` (C4=60 → 4) exported from `notes.ts`.
  - `NECK_FRETS = 20`, `interface Position { stringIndex: number; fret: number }`, `findExactPositions(midi: number, maxFret?: number): Position[]`, `findPitchClassPositions(pc: number, maxFret?: number): Position[]` exported from `neck.ts`.

- [ ] **Step 1: Write the failing test**

Create `tests/music-theory/neck.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { midiToOctave } from '../../core/music-theory/notes'
import {
  NECK_FRETS,
  findExactPositions,
  findPitchClassPositions,
} from '../../core/music-theory/neck'

describe('midiToOctave', () => {
  it('maps C4=60 to octave 4', () => expect(midiToOctave(60)).toBe(4))
  it('maps E2=40 to octave 2', () => expect(midiToOctave(40)).toBe(2))
  it('maps C6=84 to octave 6', () => expect(midiToOctave(84)).toBe(6))
})

describe('findExactPositions', () => {
  it('E2 (40) is only the low-E open string', () => {
    expect(findExactPositions(40)).toEqual([{ stringIndex: 0, fret: 0 }])
  })

  it('C6 (84) is only the high-E string at fret 20', () => {
    expect(findExactPositions(84)).toEqual([{ stringIndex: 5, fret: 20 }])
  })

  it('C4 (60) appears on strings 0-4', () => {
    expect(findExactPositions(60)).toEqual([
      { stringIndex: 0, fret: 20 },
      { stringIndex: 1, fret: 15 },
      { stringIndex: 2, fret: 10 },
      { stringIndex: 3, fret: 5 },
      { stringIndex: 4, fret: 1 },
    ])
  })

  it('never returns a fret above NECK_FRETS', () => {
    for (const p of findPitchClassPositions(0)) {
      expect(p.fret).toBeLessThanOrEqual(NECK_FRETS)
      expect(p.fret).toBeGreaterThanOrEqual(0)
    }
  })
})

describe('findPitchClassPositions', () => {
  it('every returned C position really is a C', () => {
    const cPositions = findPitchClassPositions(0)
    expect(cPositions.length).toBeGreaterThan(0)
    for (const p of cPositions) {
      expect(([40, 45, 50, 55, 59, 64][p.stringIndex]! + p.fret) % 12).toBe(0)
    }
  })

  it('includes the low-E string C at fret 8 (C3)', () => {
    expect(findPitchClassPositions(0)).toContainEqual({ stringIndex: 0, fret: 8 })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/music-theory/neck.test.ts`
Expected: FAIL — cannot import `midiToOctave` / `neck` (module not found / not exported).

- [ ] **Step 3: Add `midiToOctave` to `notes.ts`**

Append to `core/music-theory/notes.ts`:

```typescript
// Octave number for a MIDI value, C4 = MIDI 60 → octave 4.
export function midiToOctave(midi: number): number {
  return Math.floor(midi / 12) - 1
}
```

- [ ] **Step 4: Create `neck.ts`**

Create `core/music-theory/neck.ts`:

```typescript
import { OPEN_STRINGS, midiToPitchClass } from './notes'

// Full-neck length for the note-map reference diagram.
export const NECK_FRETS = 20

export interface Position {
  stringIndex: number
  fret: number
}

// Every (string, fret) on a NECK_FRETS board (standard tuning) that sounds
// exactly `midi`. Includes open strings (fret 0). Ordered by string index.
export function findExactPositions(midi: number, maxFret = NECK_FRETS): Position[] {
  const out: Position[] = []
  for (let s = 0; s < OPEN_STRINGS.length; s++) {
    const fret = midi - OPEN_STRINGS[s]!
    if (fret >= 0 && fret <= maxFret) out.push({ stringIndex: s, fret })
  }
  return out
}

// Every (string, fret) whose pitch class equals `pc`. Ordered by string, then fret.
export function findPitchClassPositions(pc: number, maxFret = NECK_FRETS): Position[] {
  const out: Position[] = []
  for (let s = 0; s < OPEN_STRINGS.length; s++) {
    for (let fret = 0; fret <= maxFret; fret++) {
      if (midiToPitchClass(OPEN_STRINGS[s]! + fret) === pc) out.push({ stringIndex: s, fret })
    }
  }
  return out
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run tests/music-theory/neck.test.ts`
Expected: PASS (all tests green).

- [ ] **Step 6: Commit**

```bash
git add core/music-theory/notes.ts core/music-theory/neck.ts tests/music-theory/neck.test.ts
git commit -m "feat: neck position lookup + midiToOctave (core)"
```

---

### Task 2: Core note-map computation (colors + lit positions)

**Files:**
- Create: `core/music-theory/note-map.ts`
- Test: `tests/music-theory/note-map.test.ts`

**Interfaces:**
- Consumes: `OPEN_STRINGS`, `midiToPitchClass`, `midiToNoteName`, `midiToOctave` from `./notes`; `findExactPositions`, `findPitchClassPositions`, `Position` from `./neck`.
- Produces:
  - `MAX_NOTES = 6`, `NOTE_PALETTE_SIZE = 6`
  - `interface LitPosition { stringIndex: number; fret: number; noteName: string; octave: number; colorIndex: number; dim: boolean }`
  - `nextFreeColor(usedColors: Iterable<number>): number | null`
  - `computeLitPositions(selected: Map<number, number>, showOffOctave: boolean): LitPosition[]`

- [ ] **Step 1: Write the failing test**

Create `tests/music-theory/note-map.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import {
  MAX_NOTES,
  nextFreeColor,
  computeLitPositions,
} from '../../core/music-theory/note-map'

describe('nextFreeColor', () => {
  it('returns 0 when nothing is used', () => expect(nextFreeColor([])).toBe(0))
  it('returns the lowest free index', () => expect(nextFreeColor([0, 2])).toBe(1))
  it('returns null when all six colors are used', () =>
    expect(nextFreeColor([0, 1, 2, 3, 4, 5])).toBeNull())
})

describe('computeLitPositions', () => {
  it('with showOffOctave=false returns only exact positions', () => {
    const lit = computeLitPositions(new Map([[60, 0]]), false)
    // C4 exact = 5 positions (strings 0-4)
    expect(lit.length).toBe(5)
    expect(lit.every(p => p.dim === false)).toBe(true)
    expect(lit.every(p => p.colorIndex === 0)).toBe(true)
    expect(lit.every(p => p.noteName === 'C')).toBe(true)
    expect(lit.every(p => p.octave === 4)).toBe(true)
  })

  it('with showOffOctave=true adds dim same-name positions without duplicating exacts', () => {
    const lit = computeLitPositions(new Map([[60, 0]]), true)
    const exact = lit.filter(p => !p.dim)
    const dim = lit.filter(p => p.dim)
    expect(exact.length).toBe(5)
    expect(dim.length).toBeGreaterThan(0)
    // No (string,fret) is both exact and dim
    const key = (p: { stringIndex: number; fret: number }) => `${p.stringIndex}:${p.fret}`
    const exactKeys = new Set(exact.map(key))
    expect(dim.some(p => exactKeys.has(key(p)))).toBe(false)
    // A dim dot carries its own octave (e.g. a C3 exists at string 0 fret 8)
    expect(dim).toContainEqual(
      expect.objectContaining({ stringIndex: 0, fret: 8, noteName: 'C', octave: 3, dim: true }),
    )
  })

  it('keeps each note on its own color', () => {
    const lit = computeLitPositions(new Map([[60, 0], [64, 1]]), false)
    expect(lit.filter(p => p.noteName === 'C').every(p => p.colorIndex === 0)).toBe(true)
    expect(lit.filter(p => p.noteName === 'E').every(p => p.colorIndex === 1)).toBe(true)
  })

  it('exposes MAX_NOTES = 6', () => expect(MAX_NOTES).toBe(6))
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/music-theory/note-map.test.ts`
Expected: FAIL — module `note-map` not found.

- [ ] **Step 3: Create `note-map.ts`**

Create `core/music-theory/note-map.ts`:

```typescript
import { OPEN_STRINGS, midiToPitchClass, midiToNoteName, midiToOctave } from './notes'
import { findExactPositions, findPitchClassPositions, type Position } from './neck'

export const MAX_NOTES = 6
export const NOTE_PALETTE_SIZE = 6

export interface LitPosition {
  stringIndex: number
  fret: number
  noteName: string
  octave: number
  colorIndex: number
  dim: boolean
}

// Lowest palette index (0..NOTE_PALETTE_SIZE-1) not already in use, or null if full.
export function nextFreeColor(usedColors: Iterable<number>): number | null {
  const used = new Set(usedColors)
  for (let i = 0; i < NOTE_PALETTE_SIZE; i++) {
    if (!used.has(i)) return i
  }
  return null
}

function posKey(p: Position): string {
  return `${p.stringIndex}:${p.fret}`
}

function toLit(p: Position, colorIndex: number, dim: boolean): LitPosition {
  const midi = OPEN_STRINGS[p.stringIndex]! + p.fret
  return {
    stringIndex: p.stringIndex,
    fret: p.fret,
    noteName: midiToNoteName(midi),
    octave: midiToOctave(midi),
    colorIndex,
    dim,
  }
}

// Every fret position to light for the currently selected notes.
// `selected` maps a MIDI note to its palette color index.
// Exact-pitch positions are solid (dim=false); when `showOffOctave` is on,
// same-pitch-class positions in other octaves are added dim (dim=true),
// excluding any that are already exact.
export function computeLitPositions(
  selected: Map<number, number>,
  showOffOctave: boolean,
): LitPosition[] {
  const out: LitPosition[] = []
  for (const [midi, colorIndex] of selected) {
    const exact = findExactPositions(midi)
    const exactKeys = new Set(exact.map(posKey))
    for (const p of exact) out.push(toLit(p, colorIndex, false))

    if (showOffOctave) {
      const pc = midiToPitchClass(midi)
      for (const p of findPitchClassPositions(pc)) {
        if (exactKeys.has(posKey(p))) continue
        out.push(toLit(p, colorIndex, true))
      }
    }
  }
  return out
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/music-theory/note-map.test.ts`
Expected: PASS.

- [ ] **Step 5: Run the whole suite**

Run: `npm test`
Expected: PASS (all existing + new tests).

- [ ] **Step 6: Commit**

```bash
git add core/music-theory/note-map.ts tests/music-theory/note-map.test.ts
git commit -m "feat: note-map lit-position + color computation (core)"
```

---

### Task 3: Routing shell + split existing feature into a page

**Files:**
- Modify: `app/app.vue`
- Create: `app/pages/guitar-to-piano.vue`
- Create: `app/pages/piano-to-guitar.vue` (stub)
- Create: `app/pages/index.vue`

**Interfaces:**
- Consumes: existing `<Fretboard />`, `<ChordResult />`, `<PianoKeyboard />` (auto-imported).
- Produces: routes `/guitar-to-piano`, `/piano-to-guitar`, `/` (redirect). `app.vue` becomes the layout shell with header nav + `<NuxtPage />`.

Nuxt 4 auto-enables file-based routing once `app/pages/` exists; `app.vue` wrapping `<NuxtPage />` becomes the persistent shell.

- [ ] **Step 1: Move the existing layout into `guitar-to-piano.vue`**

Create `app/pages/guitar-to-piano.vue` with the layout currently inside `app.vue` (the `.layout` block and its styles), verbatim:

```vue
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
```

- [ ] **Step 2: Create the stub second page**

Create `app/pages/piano-to-guitar.vue`:

```vue
<template>
  <div class="note-map-page">
    <p class="stub-hint">敬請期待</p>
  </div>
</template>

<script setup lang="ts"></script>

<style scoped>
.note-map-page {
  flex: 1;
  padding: 16px;
}
.stub-hint {
  color: var(--color-text-muted);
}
</style>
```

- [ ] **Step 3: Create the index redirect**

Create `app/pages/index.vue`:

```vue
<script setup lang="ts">
definePageMeta({ redirect: '/guitar-to-piano' })
</script>

<template><div /></template>
```

- [ ] **Step 4: Rewrite `app.vue` as the shell with nav tabs**

Replace the entire contents of `app/app.vue`:

```vue
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
```

- [ ] **Step 5: Verify routing in the browser**

Start the dev server (preview_start with the project's dev config; create `.claude/launch.json` running `npm run dev` on its port if absent). Then:
- Navigate to `/` → expect redirect to `/guitar-to-piano`, existing tool renders (fretboard + chord result + piano) and still works (tap a fret, chord updates).
- Click the **從鋼琴** tab → URL `/piano-to-guitar`, shows 「敬請期待」.
- Click **從吉他** → back to the working tool.
- Check `read_console_messages` for errors (expect none).

- [ ] **Step 6: Commit**

```bash
git add app/app.vue app/pages/
git commit -m "feat: file-based routing shell + guitar-to-piano page + nav tabs"
```

---

### Task 4: Make `PianoKeyboard` interactive + palette tokens (backward compatible)

**Files:**
- Modify: `app/assets/styles/variables.css`
- Modify: `app/components/PianoKeyboard/index.vue`
- Modify: `app/assets/styles/pianoKeyboard.scss`

**Interfaces:**
- Consumes: `computePianoRange` (existing), `useFretboard().selectedNotes` (existing), CSS vars `--note-color-0..5`.
- Produces: `<PianoKeyboard>` gains optional props `interactive?: boolean` (default false), `fixedRange?: { startMidi: number; endMidi: number } | null` (default null), `activeColorMap?: Map<number, number> | null` (default null), and emit `toggle(midi: number)`. With no props passed, behavior is identical to today.

- [ ] **Step 1: Add the 6-color note palette tokens**

In `app/assets/styles/variables.css`, add inside the `:root { ... }` block (before its closing brace):

```css
  --note-color-0: #4F6EF7;
  --note-color-1: #FF6B6B;
  --note-color-2: #10B981;
  --note-color-3: #F59E0B;
  --note-color-4: #A855F7;
  --note-color-5: #06B6D4;
```

And inside the `[data-theme="dark"] { ... }` block (before its closing brace):

```css
  --note-color-0: #6B87FF;
  --note-color-1: #FF8080;
  --note-color-2: #34D399;
  --note-color-3: #FBBF24;
  --note-color-4: #C084FC;
  --note-color-5: #22D3EE;
```

- [ ] **Step 2: Add props, emit, and color/range logic to the script**

In `app/components/PianoKeyboard/index.vue`, replace the current `<script setup>` block up to and including the `range` computed with this version (keeps every later computed — `visibleKeys` is updated in Step 3; the auto-scale block below `range` is unchanged):

```vue
<script setup lang="ts">
import { computed, ref, watch, onMounted, onBeforeUnmount, nextTick } from 'vue'
import { useFretboard } from '~/composables/useFretboard'
import { NOTE_NAMES } from '~~/core/music-theory/notes'
import { computePianoRange } from '~~/core/music-theory/piano'

const props = withDefaults(defineProps<{
  interactive?: boolean
  fixedRange?: { startMidi: number; endMidi: number } | null
  activeColorMap?: Map<number, number> | null
}>(), {
  interactive: false,
  fixedRange: null,
  activeColorMap: null,
})

const emit = defineEmits<{ toggle: [midi: number] }>()

const { selectedNotes } = useFretboard()

// Black key pattern within an octave (pitch classes)
const BLACK_PCS = new Set([1, 3, 6, 8, 10])

interface PianoKey {
  midi: number
  pitchClass: number
  noteName: string
  isBlack: boolean
  active: boolean
  colorIndex: number | null
}

// Active source: an externally supplied color map (new interactive page) or,
// by default, the shared fretboard's sounding notes (original read-only page).
const activeMidis = computed<number[]>(() =>
  props.activeColorMap
    ? [...props.activeColorMap.keys()]
    : selectedNotes.value.map(n => n.midi),
)

const activeMidiSet = computed<Set<number>>(() => new Set(activeMidis.value))

// Fixed range when provided (new page), else auto-range to the active notes.
const range = computed(() =>
  props.fixedRange ?? computePianoRange(activeMidis.value),
)
</script>
```

- [ ] **Step 3: Update `visibleKeys` to carry `colorIndex`**

Still in `app/components/PianoKeyboard/index.vue`, replace the `visibleKeys` computed with:

```typescript
const visibleKeys = computed<PianoKey[]>(() => {
  const keys: PianoKey[] = []
  for (let midi = range.value.startMidi; midi <= range.value.endMidi; midi++) {
    const pc = midi % 12
    const colorIndex = props.activeColorMap?.get(midi) ?? null
    const active = props.activeColorMap ? colorIndex !== null : activeMidiSet.value.has(midi)
    keys.push({
      midi,
      pitchClass: pc,
      noteName: NOTE_NAMES[pc]!,
      isBlack: BLACK_PCS.has(pc),
      active,
      colorIndex,
    })
  }
  return keys
})
```

- [ ] **Step 4: Wire click + per-key color in the template**

In `app/components/PianoKeyboard/index.vue`, replace the key `<div v-for=...>` element with:

```vue
        <div
          v-for="key in visibleKeys"
          :key="key.midi"
          class="key"
          :class="{
            'key--black': key.isBlack,
            'key--white': !key.isBlack,
            'key--active': key.active,
            'key--interactive': interactive,
          }"
          :style="key.colorIndex !== null ? { '--key-active-color': `var(--note-color-${key.colorIndex})` } : undefined"
          @click="interactive && emit('toggle', key.midi)"
        >
          <span v-if="key.active" class="key-label">{{ key.noteName }}</span>
        </div>
```

- [ ] **Step 5: Make active-key styling use the per-key color variable**

In `app/assets/styles/pianoKeyboard.scss`, update the two `.key--active` rules and add an interactive cursor. Replace the white-key active block:

```scss
    &.key--active {
      color: var(--key-active-color, var(--color-primary));
      background: color-mix(in srgb, var(--key-active-color, var(--color-primary)) 25%, var(--color-surface));
      border-color: var(--key-active-color, var(--color-primary));
    }
```

Replace the black-key active block:

```scss
    &.key--active {
      color: var(--color-on-primary);
      background: var(--key-active-color, var(--color-primary));
    }
```

Add, after the `.key` block:

```scss
.key--interactive {
  cursor: pointer;
}
```

- [ ] **Step 6: Verify the original page is unchanged**

Reload `/guitar-to-piano` in the browser. Tap frets → the piano still lights the sounding notes in the primary indigo color, still auto-ranges. Confirm no console errors. (No props are passed there, so behavior must match pre-refactor.)

- [ ] **Step 7: Commit**

```bash
git add app/assets/styles/variables.css app/components/PianoKeyboard/index.vue app/assets/styles/pianoKeyboard.scss
git commit -m "feat: PianoKeyboard interactive/fixedRange/color props (backward compatible)"
```

---

### Task 5: `GuitarNeck` component (horizontal 6×20), verified with sample data

**Files:**
- Create: `app/components/GuitarNeck/index.vue`
- Create: `app/assets/styles/guitarNeck.scss`
- Modify: `app/pages/piano-to-guitar.vue` (temporary sample wiring)

**Interfaces:**
- Consumes: `OPEN_STRINGS` from `~~/core/music-theory/notes`; `LitPosition` type from `~~/core/music-theory/note-map`.
- Produces: `<GuitarNeck :positions="LitPosition[]" />` — a read-only horizontal neck. Nut left, fret 20 right; high-E (string 5) top row, low-E (string 0) bottom row. Lit positions render as colored dots (dim ones faded) labelled note+octave.

- [ ] **Step 1: Create the neck styles**

Create `app/assets/styles/guitarNeck.scss`:

```scss
.neck-wrap {
  width: 100%;
  overflow-x: auto;
  padding: 16px;
  background: var(--color-surface);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-card);
}

.neck-svg {
  display: block;
}

.neck-nut { fill: var(--color-text); }
.neck-fret-line { stroke: var(--color-border); stroke-width: 1.5; }
.neck-string-line { stroke: var(--color-text-muted); stroke-width: 1; }
.neck-inlay { fill: var(--color-text-muted); opacity: 0.4; }
.neck-fret-num {
  fill: var(--color-text-muted);
  font-family: 'Inter', sans-serif;
  font-size: 11px;
}
.neck-open-note {
  fill: var(--color-text-muted);
  font-family: 'Inter', sans-serif;
  font-size: 11px;
  font-weight: 600;
}

.neck-dot-text {
  fill: #fff;
  font-family: 'Inter', sans-serif;
  font-size: 9px;
  font-weight: 700;
}
```

- [ ] **Step 2: Create the component**

Create `app/components/GuitarNeck/index.vue`:

```vue
<template>
  <div class="neck-wrap">
    <svg class="neck-svg" :viewBox="`0 0 ${SVG_W} ${SVG_H}`" xmlns="http://www.w3.org/2000/svg">
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
```

- [ ] **Step 3: Temporarily render it with sample data**

Replace `app/pages/piano-to-guitar.vue` with a temporary harness to view the neck:

```vue
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
```

- [ ] **Step 4: Verify the neck renders**

Open `/piano-to-guitar` in the browser. Expect: a horizontal 6-string × 20-fret neck; nut on the left with tuning letters E A D G B E (top-to-bottom E B G D A E); inlays at 3/5/7/9/12(double)/15/17/19; solid colored dots for exact C4/E4 positions labelled like `C4`, `E4`; faded dots for other-octave C/E labelled with their own octave. Resize to mobile width → the neck scrolls horizontally. Check console for no errors. Screenshot for the user.

- [ ] **Step 5: Commit**

```bash
git add app/components/GuitarNeck/index.vue app/assets/styles/guitarNeck.scss app/pages/piano-to-guitar.vue
git commit -m "feat: GuitarNeck horizontal 6x20 neck component"
```

---

### Task 6: `usePianoNoteMap` composable + wire the full page

**Files:**
- Create: `app/composables/usePianoNoteMap.ts`
- Modify: `app/pages/piano-to-guitar.vue`

**Interfaces:**
- Consumes: `MAX_NOTES`, `nextFreeColor`, `computeLitPositions`, `LitPosition` from `~~/core/music-theory/note-map`; `<GuitarNeck>`; `<PianoKeyboard>` (`interactive`, `fixedRange`, `activeColorMap` props + `toggle` emit from Task 4).
- Produces: `usePianoNoteMap()` returning `{ selectedMidis, showOffOctave, litPositions, toggleNote, clear }`, and the finished `/piano-to-guitar` page (neck on top, piano in the middle, controls at the bottom).

- [ ] **Step 1: Create the composable**

Create `app/composables/usePianoNoteMap.ts`:

```typescript
import { ref, computed } from 'vue'
import {
  MAX_NOTES,
  nextFreeColor,
  computeLitPositions,
  type LitPosition,
} from '~~/core/music-theory/note-map'

// Singleton state for the piano→guitar page. Independent of useFretboard.
const selectedMidis = ref(new Map<number, number>())  // midi → colorIndex
const showOffOctave = ref(true)

// Toggle a note: remove (freeing its color) if present; otherwise assign the
// lowest free color, ignoring the click once MAX_NOTES are already selected.
function toggleNote(midi: number): void {
  if (selectedMidis.value.has(midi)) {
    selectedMidis.value.delete(midi)
    selectedMidis.value = new Map(selectedMidis.value)
    return
  }
  if (selectedMidis.value.size >= MAX_NOTES) return
  const color = nextFreeColor(selectedMidis.value.values())
  if (color === null) return
  selectedMidis.value.set(midi, color)
  selectedMidis.value = new Map(selectedMidis.value)
}

function clear(): void {
  selectedMidis.value = new Map()
}

const litPositions = computed<LitPosition[]>(() =>
  computeLitPositions(selectedMidis.value, showOffOctave.value),
)

export function usePianoNoteMap() {
  return { selectedMidis, showOffOctave, litPositions, toggleNote, clear }
}
```

- [ ] **Step 2: Wire the full page**

Replace `app/pages/piano-to-guitar.vue`:

```vue
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
      <span class="control-count">{{ selectedMidis.size }} / 6</span>
      <button class="control-clear" @click="clear">清除</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { usePianoNoteMap } from '~/composables/usePianoNoteMap'

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
```

- [ ] **Step 3: Verify the full feature end-to-end**

Open `/piano-to-guitar`. Verify:
- Clicking a white/black piano key lights it in a palette color and lights all matching neck positions in the same color (solid = exact octave, faded = other octaves), each labelled note+octave.
- Selecting a second key uses a different color; the neck shows both color families.
- The count shows `n / 6`; selecting a 7th distinct note does nothing; clicking an already-selected key removes it and frees its color (add another note → it reuses a low color index).
- Ticking **隱藏非同八度亮點** removes the faded dots, leaving only solid exact-octave dots; unticking restores them.
- **清除** empties the selection and the neck.
- Switch to **從吉他** and back → this page's state is independent from the guitar tool (guitar tool unaffected).
- Resize to mobile → neck and keyboard scroll horizontally; all selected notes stay visible on the keyboard (scaled).
- No console errors. Screenshot for the user.

- [ ] **Step 4: Run the full test suite**

Run: `npm test`
Expected: PASS (all core tests).

- [ ] **Step 5: Commit**

```bash
git add app/composables/usePianoNoteMap.ts app/pages/piano-to-guitar.vue
git commit -m "feat: piano-to-guitar note-map page (interactive piano + neck)"
```

---

## Self-Review

**Spec coverage:**
- New `/piano-to-guitar` page — Task 3 (route + stub), Task 6 (full page). ✓
- Clickable piano, fixed E2–C6, up to 6 notes — Task 4 (props), Task 6 (wiring + MAX_NOTES guard). ✓
- Full-neck horizontal 6×20 guitar diagram — Task 5. ✓
- Per-note colors — Task 2 (`nextFreeColor`), Task 4 (key colors), Task 5 (dot colors). ✓
- Exact (solid) + same-name (dim) highlights, note+octave labels — Task 2 (`computeLitPositions`), Task 5 (rendering). ✓
- Off-octave toggle — Task 6 controls. ✓
- Clear button + count — Task 6. ✓
- Header nav between directions; independent state — Task 3 (nav + routing), Task 6 (separate composable). ✓
- Backward-compatible PianoKeyboard, existing page intact — Task 4 (defaults) + Step 6 verify. ✓
- Palette tokens light/dark — Task 4 Step 1. ✓
- Layout neck→piano→controls — Task 6 Step 2. ✓
- Core pure + tested, composable browser-verified — Tasks 1–2 tested, 3–6 browser. ✓

**Placeholder scan:** No TBD/TODO. The only "temporary" code (Task 5 sample data) is explicitly replaced in Task 6 Step 2. All code steps show full code.

**Type consistency:** `LitPosition` defined in Task 2, imported unchanged in Tasks 5 & 6. `computeLitPositions(selected, showOffOctave)`, `nextFreeColor(iterable)`, `findExactPositions`/`findPitchClassPositions`, `midiToOctave` — signatures match across producer and consumer tasks. `PianoKeyboard` props (`interactive`, `fixedRange`, `activeColorMap`) and emit (`toggle`) defined in Task 4, consumed identically in Task 6. `usePianoNoteMap` return shape matches its use in the page.
