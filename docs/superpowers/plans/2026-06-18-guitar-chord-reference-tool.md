# Guitar Chord Reference Tool Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Nuxt 3 web app with an interactive guitar fretboard that identifies chords in real time and displays the result with component notes, intervals, and a piano keyboard visualization.

**Architecture:** Three independent display components (`Fretboard`, `ChordResult`, `PianoKeyboard`) share state through a single composable (`useFretboard`). A pure-TypeScript music theory engine in `core/music-theory/` handles all chord detection logic with no UI dependencies.

**Tech Stack:** Nuxt 3, Vue 3, TypeScript, Vitest (unit tests), CSS variables (theming)

## Global Constraints

- Node.js 20+
- Nuxt 3.12+, Vue 3.4+
- TypeScript strict mode enabled
- No external music-theory libraries — all logic hand-rolled
- Touch targets minimum 44×44px on all interactive elements
- CSS variables for all colors (enables light/dark switching)
- Fonts: DM Sans (headings) + Inter (body) from Google Fonts
- Standard guitar tuning only: E2 A2 D3 G3 B3 E4 (MIDI 40 45 50 55 59 64)

---

## File Map

```
fret-notes-v2/
├── core/
│   └── music-theory/
│       ├── notes.ts            # Pitch class constants, note names, MIDI utils
│       ├── intervals.ts        # Interval label lookup
│       ├── chord-rules.ts      # Interval set → chord name/symbol definitions
│       └── chord-detector.ts   # Main detection: SelectedNote[] → ChordResult
├── composables/
│   └── useFretboard.ts         # Shared reactive state for all 3 components
├── components/
│   ├── Fretboard/
│   │   └── index.vue           # Interactive 6×12 fretboard grid
│   ├── ChordResult/
│   │   └── index.vue           # Chord name, alternates, notes, intervals
│   └── PianoKeyboard/
│       └── index.vue           # 2-octave piano, read-only, auto-range
├── app.vue                     # Root layout + light/dark toggle
├── nuxt.config.ts
├── assets/
│   └── styles/
│       ├── variables.css       # All CSS custom properties (colors, spacing)
│       └── global.css          # Reset, typography, font imports
└── tests/
    └── music-theory/
        ├── notes.test.ts
        ├── intervals.test.ts
        ├── chord-rules.test.ts
        └── chord-detector.test.ts
```

---

## Task 1: Project Scaffold

**Files:**
- Create: `nuxt.config.ts`
- Create: `assets/styles/variables.css`
- Create: `assets/styles/global.css`
- Create: `app.vue`
- Create: `vitest.config.ts`

**Interfaces:**
- Produces: Running dev server at `http://localhost:3000`; `npm test` runs Vitest

- [ ] **Step 1: Scaffold Nuxt 3 project**

```bash
npx nuxi@latest init fret-notes-v2
cd fret-notes-v2
npm install
```

When prompted, choose: No for git init (we'll do it manually), TypeScript: yes.

- [ ] **Step 2: Install Vitest for unit testing**

```bash
npm install -D vitest @vitest/ui
```

- [ ] **Step 3: Write `vitest.config.ts`**

```ts
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
})
```

- [ ] **Step 4: Add test script to `package.json`**

In `package.json`, add to `"scripts"`:
```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 5: Write `nuxt.config.ts`**

```ts
export default defineNuxtConfig({
  devtools: { enabled: true },
  css: [
    '~/assets/styles/variables.css',
    '~/assets/styles/global.css',
  ],
})
```

- [ ] **Step 6: Write `assets/styles/variables.css`**

```css
:root {
  --color-bg: #F8F9FF;
  --color-surface: #FFFFFF;
  --color-primary: #4F6EF7;
  --color-accent: #FF6B6B;
  --color-text: #1A1A2E;
  --color-text-muted: #8B8FA8;
  --color-border: #E2E5F0;

  --radius-sm: 6px;
  --radius-md: 12px;
  --radius-lg: 20px;

  --shadow-card: 0 2px 12px rgba(79, 110, 247, 0.08);
}

[data-theme="dark"] {
  --color-bg: #0F1117;
  --color-surface: #1C1F2E;
  --color-primary: #6B87FF;
  --color-accent: #FF8080;
  --color-text: #E8EAFF;
  --color-text-muted: #6B6F88;
  --color-border: #2A2D3E;

  --shadow-card: 0 2px 16px rgba(0, 0, 0, 0.4);
}
```

- [ ] **Step 7: Write `assets/styles/global.css`**

```css
@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;700&family=Inter:wght@400;500&display=swap');

*, *::before, *::after {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

body {
  font-family: 'Inter', sans-serif;
  background-color: var(--color-bg);
  color: var(--color-text);
  transition: background-color 0.2s, color 0.2s;
  min-height: 100dvh;
}

h1, h2, h3 {
  font-family: 'DM Sans', sans-serif;
}
```

- [ ] **Step 8: Write `app.vue` (stub)**

```vue
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
```

- [ ] **Step 9: Start dev server and verify it runs**

```bash
npm run dev
```

Expected: Server starts at `http://localhost:3000`, page loads without errors.

- [ ] **Step 10: Commit**

```bash
git init
git add .
git commit -m "feat: scaffold Nuxt 3 project with Vitest and CSS theme variables"
```

---

## Task 2: Music Theory — Notes

**Files:**
- Create: `core/music-theory/notes.ts`
- Create: `tests/music-theory/notes.test.ts`

**Interfaces:**
- Produces:
  - `OPEN_STRINGS: number[]` — MIDI values for strings 0–5 (low E to high E)
  - `NOTE_NAMES: string[]` — 12 names indexed by pitch class (0=C … 11=B)
  - `midiToPitchClass(midi: number): number` — returns 0–11
  - `midiToNoteName(midi: number): string` — returns e.g. "A", "C#"
  - `fretToMidi(stringIndex: number, fret: number): number`
  - `fretToPitchClass(stringIndex: number, fret: number): number`

- [ ] **Step 1: Write failing tests**

Create `tests/music-theory/notes.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import {
  OPEN_STRINGS,
  NOTE_NAMES,
  midiToPitchClass,
  midiToNoteName,
  fretToMidi,
  fretToPitchClass,
} from '../../core/music-theory/notes'

describe('OPEN_STRINGS', () => {
  it('has 6 strings', () => expect(OPEN_STRINGS).toHaveLength(6))
  it('string 0 is E2 (MIDI 40)', () => expect(OPEN_STRINGS[0]).toBe(40))
  it('string 5 is E4 (MIDI 64)', () => expect(OPEN_STRINGS[5]).toBe(64))
})

describe('midiToPitchClass', () => {
  it('MIDI 60 (C4) = pitch class 0', () => expect(midiToPitchClass(60)).toBe(0))
  it('MIDI 64 (E4) = pitch class 4', () => expect(midiToPitchClass(64)).toBe(4))
  it('MIDI 40 (E2) = pitch class 4', () => expect(midiToPitchClass(40)).toBe(4))
})

describe('midiToNoteName', () => {
  it('pitch class 0 = C', () => expect(midiToNoteName(60)).toBe('C'))
  it('pitch class 4 = E', () => expect(midiToNoteName(64)).toBe('E'))
  it('pitch class 9 = A', () => expect(midiToNoteName(45)).toBe('A'))
})

describe('fretToMidi', () => {
  it('string 0 fret 0 = 40 (E2 open)', () => expect(fretToMidi(0, 0)).toBe(40))
  it('string 0 fret 2 = 42 (F#2)', () => expect(fretToMidi(0, 2)).toBe(42))
  it('string 1 fret 0 = 45 (A2 open)', () => expect(fretToMidi(1, 0)).toBe(45))
})

describe('fretToPitchClass', () => {
  it('string 0 fret 0 = 4 (E)', () => expect(fretToPitchClass(0, 0)).toBe(4))
  it('string 0 fret 1 = 5 (F)', () => expect(fretToPitchClass(0, 1)).toBe(5))
  it('string 1 fret 2 = 11 (B)', () => expect(fretToPitchClass(1, 2)).toBe(11))
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm test
```

Expected: FAIL — "Cannot find module '../../core/music-theory/notes'"

- [ ] **Step 3: Implement `core/music-theory/notes.ts`**

```ts
// Standard tuning MIDI values: E2 A2 D3 G3 B3 E4
export const OPEN_STRINGS = [40, 45, 50, 55, 59, 64]

export const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']

export function midiToPitchClass(midi: number): number {
  return ((midi % 12) + 12) % 12
}

export function midiToNoteName(midi: number): string {
  return NOTE_NAMES[midiToPitchClass(midi)]
}

export function fretToMidi(stringIndex: number, fret: number): number {
  return OPEN_STRINGS[stringIndex] + fret
}

export function fretToPitchClass(stringIndex: number, fret: number): number {
  return midiToPitchClass(fretToMidi(stringIndex, fret))
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm test
```

Expected: All 10 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add core/music-theory/notes.ts tests/music-theory/notes.test.ts
git commit -m "feat: music theory notes module with pitch class and MIDI utils"
```

---

## Task 3: Music Theory — Intervals

**Files:**
- Create: `core/music-theory/intervals.ts`
- Create: `tests/music-theory/intervals.test.ts`

**Interfaces:**
- Produces:
  - `INTERVAL_NAMES: Record<number, string>` — semitone count → Chinese label
  - `intervalBetween(root: number, note: number): number` — semitones above root (0–11)

- [ ] **Step 1: Write failing tests**

Create `tests/music-theory/intervals.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { INTERVAL_NAMES, intervalBetween } from '../../core/music-theory/intervals'

describe('intervalBetween', () => {
  it('same note = 0', () => expect(intervalBetween(0, 0)).toBe(0))
  it('C to E = 4 (大三度)', () => expect(intervalBetween(0, 4)).toBe(4))
  it('C to G = 7 (完全五度)', () => expect(intervalBetween(0, 7)).toBe(7))
  it('E to C = 8 (小六度, wraps around)', () => expect(intervalBetween(4, 0)).toBe(8))
  it('A to C = 3 (小三度)', () => expect(intervalBetween(9, 0)).toBe(3))
})

describe('INTERVAL_NAMES', () => {
  it('0 = 根音', () => expect(INTERVAL_NAMES[0]).toBe('根音'))
  it('3 = 小三度', () => expect(INTERVAL_NAMES[3]).toBe('小三度'))
  it('7 = 完全五度', () => expect(INTERVAL_NAMES[7]).toBe('完全五度'))
  it('10 = 小七度', () => expect(INTERVAL_NAMES[10]).toBe('小七度'))
  it('11 = 大七度', () => expect(INTERVAL_NAMES[11]).toBe('大七度'))
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm test
```

Expected: FAIL — "Cannot find module '../../core/music-theory/intervals'"

- [ ] **Step 3: Implement `core/music-theory/intervals.ts`**

```ts
export const INTERVAL_NAMES: Record<number, string> = {
  0:  '根音',
  1:  '小二度',
  2:  '大二度',
  3:  '小三度',
  4:  '大三度',
  5:  '完全四度',
  6:  '減五度',
  7:  '完全五度',
  8:  '小六度',
  9:  '大六度',
  10: '小七度',
  11: '大七度',
}

export function intervalBetween(root: number, note: number): number {
  return ((note - root) + 12) % 12
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm test
```

Expected: All tests PASS.

- [ ] **Step 5: Commit**

```bash
git add core/music-theory/intervals.ts tests/music-theory/intervals.test.ts
git commit -m "feat: interval calculation and Chinese interval name labels"
```

---

## Task 4: Music Theory — Chord Rules

**Files:**
- Create: `core/music-theory/chord-rules.ts`
- Create: `tests/music-theory/chord-rules.test.ts`

**Interfaces:**
- Produces:
  - `ChordRule`: `{ symbol: string; name: string; intervals: number[] }`
  - `CHORD_RULES: ChordRule[]` — ordered list, more specific rules first

- [ ] **Step 1: Write failing tests**

Create `tests/music-theory/chord-rules.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { CHORD_RULES } from '../../core/music-theory/chord-rules'

describe('CHORD_RULES', () => {
  it('contains at least 14 rules', () => expect(CHORD_RULES.length).toBeGreaterThanOrEqual(14))

  it('every rule has symbol, name, and intervals', () => {
    for (const rule of CHORD_RULES) {
      expect(rule.symbol).toBeTruthy()
      expect(rule.name).toBeTruthy()
      expect(rule.intervals.length).toBeGreaterThanOrEqual(2)
    }
  })

  it('all interval arrays are sorted ascending', () => {
    for (const rule of CHORD_RULES) {
      const sorted = [...rule.intervals].sort((a, b) => a - b)
      expect(rule.intervals).toEqual(sorted)
    }
  })

  it('all interval arrays start with 0 (root)', () => {
    for (const rule of CHORD_RULES) {
      expect(rule.intervals[0]).toBe(0)
    }
  })

  it('has a minor triad rule [0,3,7]', () => {
    const minor = CHORD_RULES.find(r => r.symbol === 'm')
    expect(minor?.intervals).toEqual([0, 3, 7])
  })

  it('has a dominant 7 rule [0,4,7,10]', () => {
    const dom7 = CHORD_RULES.find(r => r.symbol === '7')
    expect(dom7?.intervals).toEqual([0, 4, 7, 10])
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm test
```

Expected: FAIL — "Cannot find module '../../core/music-theory/chord-rules'"

- [ ] **Step 3: Implement `core/music-theory/chord-rules.ts`**

```ts
export interface ChordRule {
  symbol: string   // e.g. "m7", "maj7", "sus2"
  name: string     // e.g. "小七和弦"
  intervals: number[]  // sorted, starts with 0
}

// More specific rules (more intervals) must come before less specific ones
export const CHORD_RULES: ChordRule[] = [
  // 四音和弦（Seven chords）
  { symbol: 'maj7',  name: '大七和弦',       intervals: [0, 4, 7, 11] },
  { symbol: 'm7',    name: '小七和弦',       intervals: [0, 3, 7, 10] },
  { symbol: '7',     name: '屬七和弦',       intervals: [0, 4, 7, 10] },
  { symbol: 'm7b5',  name: '半減七和弦',     intervals: [0, 3, 6, 10] },
  { symbol: '6',     name: '大六和弦',       intervals: [0, 4, 7,  9] },
  { symbol: 'm6',    name: '小六和弦',       intervals: [0, 3, 7,  9] },
  { symbol: 'add9',  name: '加九和弦',       intervals: [0, 2, 4,  7] },
  // 三音和弦（Triads）
  { symbol: '',      name: '大三和弦',       intervals: [0, 4, 7] },
  { symbol: 'm',     name: '小三和弦',       intervals: [0, 3, 7] },
  { symbol: 'dim',   name: '減三和弦',       intervals: [0, 3, 6] },
  { symbol: 'aug',   name: '增三和弦',       intervals: [0, 4, 8] },
  { symbol: 'sus2',  name: '掛留二和弦',     intervals: [0, 2, 7] },
  { symbol: 'sus4',  name: '掛留四和弦',     intervals: [0, 5, 7] },
  // Power chord
  { symbol: '5',     name: '強力和弦',       intervals: [0, 7] },
]
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm test
```

Expected: All tests PASS.

- [ ] **Step 5: Commit**

```bash
git add core/music-theory/chord-rules.ts tests/music-theory/chord-rules.test.ts
git commit -m "feat: chord rule definitions for Phase 1 chord types"
```

---

## Task 5: Music Theory — Chord Detector

**Files:**
- Create: `core/music-theory/chord-detector.ts`
- Create: `tests/music-theory/chord-detector.test.ts`

**Interfaces:**
- Consumes:
  - `midiToPitchClass(midi: number): number` from `notes.ts`
  - `intervalBetween(root: number, note: number): number` from `intervals.ts`
  - `CHORD_RULES, ChordRule` from `chord-rules.ts`
- Produces:
  - `SelectedNote`: `{ stringIndex: number; fret: number; midi: number; pitchClass: number; noteName: string }`
  - `ChordResult`: `{ root: string; symbol: string; name: string; bassNote: string | null; notes: NoteInfo[]; alternates: string[] }`
  - `NoteInfo`: `{ noteName: string; intervalSemitones: number; intervalName: string }`
  - `detectChord(notes: SelectedNote[]): ChordResult | null`

- [ ] **Step 1: Write failing tests**

Create `tests/music-theory/chord-detector.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { detectChord, type SelectedNote } from '../../core/music-theory/chord-detector'
import { fretToMidi, midiToPitchClass, midiToNoteName } from '../../core/music-theory/notes'

function makeNote(stringIndex: number, fret: number): SelectedNote {
  const midi = fretToMidi(stringIndex, fret)
  return { stringIndex, fret, midi, pitchClass: midiToPitchClass(midi), noteName: midiToNoteName(midi) }
}

describe('detectChord', () => {
  it('returns null for empty notes', () => {
    expect(detectChord([])).toBeNull()
  })

  it('returns null for single note', () => {
    expect(detectChord([makeNote(0, 0)])).toBeNull()
  })

  it('detects Am: pitch classes A(9) C(0) E(4)', () => {
    // A minor = A(9) C(0) E(4)
    const amNotes: SelectedNote[] = [
      { stringIndex: 0, fret: 5,  midi: 45, pitchClass: 9, noteName: 'A' }, // low A (lowest = root)
      { stringIndex: 5, fret: 0,  midi: 64, pitchClass: 4, noteName: 'E' }, // high E
      { stringIndex: 4, fret: 1,  midi: 60, pitchClass: 0, noteName: 'C' }, // C
    ]
    const result = detectChord(amNotes)
    expect(result).not.toBeNull()
    expect(result!.root).toBe('A')
    expect(result!.symbol).toBe('m')
    expect(result!.bassNote).toBeNull() // lowest note A is the root
  })

  it('detects slash chord Am/E when lowest note is E', () => {
    const amNotes: SelectedNote[] = [
      { stringIndex: 0, fret: 0,  midi: 40, pitchClass: 4, noteName: 'E' }, // low E (lowest)
      { stringIndex: 1, fret: 0,  midi: 45, pitchClass: 9, noteName: 'A' },
      { stringIndex: 4, fret: 1,  midi: 60, pitchClass: 0, noteName: 'C' },
    ]
    const result = detectChord(amNotes)
    expect(result).not.toBeNull()
    expect(result!.root).toBe('A')
    expect(result!.bassNote).toBe('E')
  })

  it('detects C major: C(0) E(4) G(7)', () => {
    const cNotes: SelectedNote[] = [
      { stringIndex: 0, fret: 8, midi: 48, pitchClass: 0, noteName: 'C' },
      { stringIndex: 1, fret: 7, midi: 52, pitchClass: 4, noteName: 'E' },
      { stringIndex: 2, fret: 5, midi: 55, pitchClass: 7, noteName: 'G' },
    ]
    const result = detectChord(cNotes)
    expect(result).not.toBeNull()
    expect(result!.root).toBe('C')
    expect(result!.symbol).toBe('')
    expect(result!.bassNote).toBeNull()
  })

  it('result notes contain interval info', () => {
    const amNotes: SelectedNote[] = [
      { stringIndex: 0, fret: 5,  midi: 45, pitchClass: 9, noteName: 'A' },
      { stringIndex: 5, fret: 0,  midi: 64, pitchClass: 4, noteName: 'E' },
      { stringIndex: 4, fret: 1,  midi: 60, pitchClass: 0, noteName: 'C' },
    ]
    const result = detectChord(amNotes)!
    const noteNames = result.notes.map(n => n.noteName)
    expect(noteNames).toContain('A')
    expect(noteNames).toContain('C')
    expect(noteNames).toContain('E')
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm test
```

Expected: FAIL — "Cannot find module '../../core/music-theory/chord-detector'"

- [ ] **Step 3: Implement `core/music-theory/chord-detector.ts`**

```ts
import { midiToPitchClass, midiToNoteName, NOTE_NAMES } from './notes'
import { intervalBetween, INTERVAL_NAMES } from './intervals'
import { CHORD_RULES } from './chord-rules'

export interface SelectedNote {
  stringIndex: number
  fret: number
  midi: number
  pitchClass: number
  noteName: string
}

export interface NoteInfo {
  noteName: string
  intervalSemitones: number
  intervalName: string
}

export interface ChordResult {
  root: string
  symbol: string
  name: string
  bassNote: string | null  // set when lowest note ≠ root
  notes: NoteInfo[]        // unique pitch classes, root first
  alternates: string[]     // other possible chord names for same note set
}

export function detectChord(notes: SelectedNote[]): ChordResult | null {
  if (notes.length < 2) return null

  // Unique pitch classes present
  const pitchClasses = [...new Set(notes.map(n => n.pitchClass))]
  if (pitchClasses.length < 2) return null

  // Lowest note by MIDI value
  const lowestMidi = Math.min(...notes.map(n => n.midi))
  const bassPC = midiToPitchClass(lowestMidi)

  const matches: ChordResult[] = []

  for (const rootPC of pitchClasses) {
    const intervals = pitchClasses
      .map(pc => intervalBetween(rootPC, pc))
      .sort((a, b) => a - b)

    for (const rule of CHORD_RULES) {
      if (arraysEqual(intervals, rule.intervals)) {
        const root = NOTE_NAMES[rootPC]
        const bassNote = bassPC !== rootPC ? NOTE_NAMES[bassPC] : null

        const noteInfos: NoteInfo[] = pitchClasses.map(pc => ({
          noteName: NOTE_NAMES[pc],
          intervalSemitones: intervalBetween(rootPC, pc),
          intervalName: INTERVAL_NAMES[intervalBetween(rootPC, pc)] ?? '',
        }))
        // Sort: root first, then by interval
        noteInfos.sort((a, b) => a.intervalSemitones - b.intervalSemitones)

        matches.push({ root, symbol: rule.symbol, name: rule.name, bassNote, notes: noteInfos, alternates: [] })
        break // one rule per root candidate
      }
    }
  }

  if (matches.length === 0) return null

  // Primary = first match; alternates = remaining chord display names
  const primary = matches[0]
  primary.alternates = matches.slice(1).map(m => {
    const slash = m.bassNote ? `/${m.bassNote}` : ''
    return `${m.root}${m.symbol}${slash}`
  })

  return primary
}

function arraysEqual(a: number[], b: number[]): boolean {
  return a.length === b.length && a.every((v, i) => v === b[i])
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm test
```

Expected: All tests PASS.

- [ ] **Step 5: Commit**

```bash
git add core/music-theory/chord-detector.ts tests/music-theory/chord-detector.test.ts
git commit -m "feat: chord detector with slash chord and alternate candidate support"
```

---

## Task 6: useFretboard Composable

**Files:**
- Create: `composables/useFretboard.ts`

**Interfaces:**
- Consumes: `SelectedNote`, `ChordResult`, `detectChord` from `chord-detector.ts`; `fretToMidi`, `midiToPitchClass`, `midiToNoteName` from `notes.ts`
- Produces (all reactive, exported from composable):
  - `pressedFrets: Ref<Map<string, number>>` — key = `"${stringIndex}"`, value = fret number
  - `mutedStrings: Ref<Set<number>>` — string indices marked as muted
  - `detectedChord: ComputedRef<ChordResult | null>`
  - `toggleFret(stringIndex: number, fret: number): void`
  - `toggleMute(stringIndex: number): void`
  - `clearAll(): void`
  - `getSelectedNotes(): SelectedNote[]`

- [ ] **Step 1: Create `composables/useFretboard.ts`**

```ts
import { ref, computed } from 'vue'
import { detectChord, type SelectedNote, type ChordResult } from '~/core/music-theory/chord-detector'
import { fretToMidi, midiToPitchClass, midiToNoteName } from '~/core/music-theory/notes'

// Singleton state — shared across all components
const pressedFrets = ref(new Map<number, number>())  // stringIndex → fret
const mutedStrings = ref(new Set<number>())

function getSelectedNotes(): SelectedNote[] {
  const notes: SelectedNote[] = []
  for (const [stringIndex, fret] of pressedFrets.value) {
    if (mutedStrings.value.has(stringIndex)) continue
    const midi = fretToMidi(stringIndex, fret)
    notes.push({
      stringIndex,
      fret,
      midi,
      pitchClass: midiToPitchClass(midi),
      noteName: midiToNoteName(midi),
    })
  }
  // Also include open strings (not pressed, not muted)
  for (let s = 0; s < 6; s++) {
    if (!pressedFrets.value.has(s) && !mutedStrings.value.has(s)) {
      const midi = fretToMidi(s, 0)
      notes.push({
        stringIndex: s,
        fret: 0,
        midi,
        pitchClass: midiToPitchClass(midi),
        noteName: midiToNoteName(midi),
      })
    }
  }
  return notes
}

const detectedChord = computed<ChordResult | null>(() => {
  const notes = getSelectedNotes()
  return detectChord(notes)
})

function toggleFret(stringIndex: number, fret: number): void {
  const current = pressedFrets.value.get(stringIndex)
  if (current === fret) {
    pressedFrets.value.delete(stringIndex)
  } else {
    pressedFrets.value.set(stringIndex, fret)
    mutedStrings.value.delete(stringIndex)
  }
  pressedFrets.value = new Map(pressedFrets.value)  // trigger reactivity
}

function toggleMute(stringIndex: number): void {
  if (mutedStrings.value.has(stringIndex)) {
    mutedStrings.value.delete(stringIndex)
  } else {
    mutedStrings.value.add(stringIndex)
    pressedFrets.value.delete(stringIndex)
    pressedFrets.value = new Map(pressedFrets.value)
  }
  mutedStrings.value = new Set(mutedStrings.value)
}

function clearAll(): void {
  pressedFrets.value = new Map()
  mutedStrings.value = new Set()
}

export function useFretboard() {
  return { pressedFrets, mutedStrings, detectedChord, toggleFret, toggleMute, clearAll, getSelectedNotes }
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx nuxi typecheck
```

Expected: No type errors.

- [ ] **Step 3: Commit**

```bash
git add composables/useFretboard.ts
git commit -m "feat: useFretboard composable with reactive fret state and chord detection"
```

---

## Task 7: Fretboard Component

**Files:**
- Create: `components/Fretboard/index.vue`

**Interfaces:**
- Consumes: `useFretboard()` from `composables/useFretboard.ts`; `fretToPitchClass`, `midiToNoteName`, `OPEN_STRINGS` from `notes.ts`
- Produces: Interactive fretboard UI; all state changes go through `toggleFret` / `toggleMute`

- [ ] **Step 1: Create `components/Fretboard/index.vue`**

```vue
<template>
  <div class="fretboard-wrap">
    <div class="fretboard">
      <!-- Open string row -->
      <div class="fret-row open-row">
        <div class="fret-label"></div>
        <div
          v-for="s in STRINGS"
          :key="s"
          class="open-cell"
          @click="handleOpenClick(s)"
        >
          <span v-if="mutedStrings.has(s)" class="mute-mark">×</span>
          <span v-else-if="!pressedFrets.has(s)" class="open-circle"></span>
        </div>
      </div>

      <!-- Fret rows 1–12 -->
      <div
        v-for="fret in FRETS"
        :key="fret"
        class="fret-row"
      >
        <div class="fret-label">{{ fret }}</div>
        <div
          v-for="s in STRINGS"
          :key="s"
          class="fret-cell"
          :class="{ 'has-dot': POSITION_DOTS.includes(fret) && s === 2 }"
          @click="toggleFret(s, fret)"
        >
          <span
            v-if="pressedFrets.get(s) === fret"
            class="press-dot"
          >
            {{ noteNameAt(s, fret) }}
          </span>
        </div>
      </div>
    </div>

    <button class="clear-btn" @click="clearAll">清除</button>
  </div>
</template>

<script setup lang="ts">
import { useFretboard } from '~/composables/useFretboard'
import { fretToPitchClass, midiToNoteName, OPEN_STRINGS } from '~/core/music-theory/notes'

const { pressedFrets, mutedStrings, toggleFret, toggleMute, clearAll } = useFretboard()

const STRINGS = [0, 1, 2, 3, 4, 5]
const FRETS = Array.from({ length: 12 }, (_, i) => i + 1)
const POSITION_DOTS = [3, 5, 7, 9, 12]

function noteNameAt(stringIndex: number, fret: number): string {
  return midiToNoteName(OPEN_STRINGS[stringIndex] + fret)
}

function handleOpenClick(stringIndex: number) {
  toggleMute(stringIndex)
}
</script>

<style scoped>
.fretboard-wrap {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  padding: 16px;
}

.fretboard {
  display: grid;
  grid-template-rows: auto repeat(12, 1fr);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-surface);
  box-shadow: var(--shadow-card);
  overflow: hidden;
  width: 100%;
  max-width: 420px;
}

.fret-row {
  display: grid;
  grid-template-columns: 28px repeat(6, 1fr);
  border-bottom: 1px solid var(--color-border);
}

.fret-row:last-child {
  border-bottom: none;
}

.fret-label {
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 11px;
  color: var(--color-text-muted);
  font-family: 'Inter', sans-serif;
  border-right: 1px solid var(--color-border);
}

.fret-cell,
.open-cell {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 44px;
  cursor: pointer;
  border-right: 1px solid var(--color-border);
  transition: background 0.1s;
}

.fret-cell:last-child,
.open-cell:last-child {
  border-right: none;
}

.fret-cell:active {
  background: color-mix(in srgb, var(--color-primary) 10%, transparent);
}

/* Dot marker on fret positions */
.fret-cell.has-dot::after {
  content: '';
  position: absolute;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--color-border);
  bottom: 4px;
  left: 50%;
  transform: translateX(-50%);
}

.press-dot {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: var(--color-primary);
  color: #fff;
  font-size: 11px;
  font-weight: 500;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--color-primary) 30%, transparent);
  transition: transform 0.08s, opacity 0.08s;
  animation: dot-in 0.08s ease;
}

@keyframes dot-in {
  from { transform: scale(0.5); opacity: 0; }
  to   { transform: scale(1);   opacity: 1; }
}

.open-circle {
  width: 22px;
  height: 22px;
  border-radius: 50%;
  border: 2px solid var(--color-primary);
  display: block;
}

.mute-mark {
  font-size: 18px;
  color: var(--color-text-muted);
  font-weight: 700;
  line-height: 1;
}

.clear-btn {
  padding: 8px 24px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--color-border);
  background: var(--color-surface);
  color: var(--color-text-muted);
  font-size: 14px;
  cursor: pointer;
  transition: border-color 0.15s, color 0.15s;
}

.clear-btn:hover {
  border-color: var(--color-primary);
  color: var(--color-primary);
}
</style>
```

- [ ] **Step 2: Add Fretboard to `app.vue` and verify in browser**

Update `app.vue` main section:
```vue
<main>
  <Fretboard />
</main>
```

```bash
npm run dev
```

Open `http://localhost:3000`. Tap fret cells — dots should appear with note names. Tap open string area — toggles ×.

- [ ] **Step 3: Commit**

```bash
git add components/Fretboard/index.vue app.vue
git commit -m "feat: interactive Fretboard component with press dots, open/mute toggle"
```

---

## Task 8: ChordResult Component

**Files:**
- Create: `components/ChordResult/index.vue`

**Interfaces:**
- Consumes: `useFretboard()` → `detectedChord`

- [ ] **Step 1: Create `components/ChordResult/index.vue`**

```vue
<template>
  <div class="chord-result">
    <template v-if="detectedChord">
      <Transition name="chord-fade" mode="out-in">
        <div :key="chordKey" class="result-inner">
          <div class="chord-name-wrap">
            <h1 class="chord-name">
              {{ detectedChord.root }}{{ detectedChord.symbol }}
              <span v-if="detectedChord.bassNote" class="bass">/{{ detectedChord.bassNote }}</span>
            </h1>
            <p class="chord-type-name">{{ detectedChord.name }}</p>
            <p v-if="detectedChord.alternates.length" class="alternates">
              也可能是 {{ detectedChord.alternates.join('、') }}
            </p>
          </div>

          <div class="divider"></div>

          <div class="notes-row">
            <div
              v-for="noteInfo in detectedChord.notes"
              :key="noteInfo.noteName"
              class="note-item"
            >
              <span class="note-pill">{{ noteInfo.noteName }}</span>
              <span class="interval-label">{{ noteInfo.intervalName }}</span>
            </div>
          </div>
        </div>
      </Transition>
    </template>

    <div v-else class="empty-state">
      <p>點選指板上的格子來識別和弦</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useFretboard } from '~/composables/useFretboard'

const { detectedChord } = useFretboard()

const chordKey = computed(() =>
  detectedChord.value
    ? `${detectedChord.value.root}${detectedChord.value.symbol}${detectedChord.value.bassNote ?? ''}`
    : 'empty'
)
</script>

<style scoped>
.chord-result {
  background: var(--color-surface);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-card);
  padding: 24px;
  min-height: 180px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.result-inner {
  width: 100%;
}

.chord-name-wrap {
  margin-bottom: 16px;
}

.chord-name {
  font-family: 'DM Sans', sans-serif;
  font-size: 48px;
  font-weight: 700;
  color: var(--color-text);
  line-height: 1;
  letter-spacing: -1px;
}

.bass {
  color: var(--color-primary);
}

.chord-type-name {
  font-size: 14px;
  color: var(--color-text-muted);
  margin-top: 4px;
}

.alternates {
  font-size: 13px;
  color: var(--color-text-muted);
  margin-top: 6px;
}

.divider {
  height: 1px;
  background: var(--color-border);
  margin: 16px 0;
}

.notes-row {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
}

.note-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
}

.note-pill {
  background: var(--color-primary);
  color: #fff;
  font-size: 14px;
  font-weight: 600;
  padding: 4px 12px;
  border-radius: 20px;
  font-family: 'DM Sans', sans-serif;
}

.interval-label {
  font-size: 11px;
  color: var(--color-text-muted);
  text-align: center;
}

.empty-state {
  color: var(--color-text-muted);
  font-size: 15px;
  text-align: center;
}

/* Transition */
.chord-fade-enter-active,
.chord-fade-leave-active {
  transition: opacity 0.15s, transform 0.15s;
}
.chord-fade-enter-from {
  opacity: 0;
  transform: translateY(6px);
}
.chord-fade-leave-to {
  opacity: 0;
  transform: translateY(-6px);
}
</style>
```

- [ ] **Step 2: Add to `app.vue` and verify in browser**

```vue
<main>
  <ChordResult />
  <Fretboard />
</main>
```

Open browser, tap frets — chord name, notes and intervals should appear with animation.

- [ ] **Step 3: Commit**

```bash
git add components/ChordResult/index.vue app.vue
git commit -m "feat: ChordResult component with chord name, alternates, notes and intervals"
```

---

## Task 9: PianoKeyboard Component

**Files:**
- Create: `components/PianoKeyboard/index.vue`

**Interfaces:**
- Consumes: `useFretboard()` → `detectedChord`
- Logic: Given detected chord's pitch classes, pick 2-octave window (C?–C?+2) that covers the most notes, render black/white keys, highlight matching ones.

- [ ] **Step 1: Create `components/PianoKeyboard/index.vue`**

```vue
<template>
  <div class="piano-wrap">
    <div class="piano">
      <div
        v-for="key in visibleKeys"
        :key="key.midi"
        class="key"
        :class="{
          'key--black': key.isBlack,
          'key--white': !key.isBlack,
          'key--active': key.active,
        }"
      >
        <span v-if="key.active && !key.isBlack" class="key-label">{{ key.noteName }}</span>
      </div>
    </div>
    <p class="piano-range">{{ rangeLabel }}</p>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useFretboard } from '~/composables/useFretboard'
import { NOTE_NAMES } from '~/core/music-theory/notes'

const { detectedChord } = useFretboard()

// Black key pattern within an octave (pitch classes)
const BLACK_PCS = new Set([1, 3, 6, 8, 10])

interface PianoKey {
  midi: number
  pitchClass: number
  noteName: string
  isBlack: boolean
  active: boolean
}

const activePitchClasses = computed<Set<number>>(() => {
  if (!detectedChord.value) return new Set()
  return new Set(detectedChord.value.notes.map(n => {
    return NOTE_NAMES.indexOf(n.noteName)
  }))
})

// Choose best octave start (C) so max active notes fall within 2 octaves
const startOctave = computed<number>(() => {
  const active = activePitchClasses.value
  if (active.size === 0) return 4  // default C4–C6

  // Try C3 through C5 as start octave; pick the one that covers most notes
  // Since we show 2 octaves (25 keys), all 12 pitch classes are covered —
  // so we just default to a sensible range based on guitar register.
  // Guitar sounds C2–C6 roughly; middle range is C3–C5.
  return 3
})

const visibleKeys = computed<PianoKey[]>(() => {
  const keys: PianoKey[] = []
  const startMidi = (startOctave.value + 1) * 12  // C4 = MIDI 60, so octave offset = 12*(n+1)
  // Two octaves = 25 keys (C to C)
  for (let i = 0; i <= 24; i++) {
    const midi = startMidi + i
    const pc = midi % 12
    keys.push({
      midi,
      pitchClass: pc,
      noteName: NOTE_NAMES[pc],
      isBlack: BLACK_PCS.has(pc),
      active: activePitchClasses.value.has(pc),
    })
  }
  return keys
})

const rangeLabel = computed(() => {
  const start = startOctave.value
  return `C${start} – C${start + 2}`
})
</script>

<style scoped>
.piano-wrap {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 16px;
  background: var(--color-surface);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-card);
}

.piano {
  position: relative;
  display: flex;
  align-items: flex-start;
  height: 100px;
}

.key {
  position: relative;
  border-radius: 0 0 4px 4px;
  cursor: default;
  transition: background 0.1s;
}

.key--white {
  width: 36px;
  height: 100px;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  margin-right: 2px;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  padding-bottom: 6px;
  z-index: 1;
}

.key--black {
  width: 24px;
  height: 62px;
  background: var(--color-text);
  margin-left: -13px;
  margin-right: -13px;
  z-index: 2;
  border-radius: 0 0 3px 3px;
}

.key--white.key--active {
  background: color-mix(in srgb, var(--color-primary) 25%, var(--color-surface));
  border-color: var(--color-primary);
}

.key--black.key--active {
  background: var(--color-primary);
}

.key-label {
  font-size: 10px;
  font-weight: 600;
  color: var(--color-primary);
  font-family: 'Inter', sans-serif;
}

.piano-range {
  font-size: 11px;
  color: var(--color-text-muted);
}
</style>
```

- [ ] **Step 2: Add to `app.vue` and verify in browser**

```vue
<main>
  <ChordResult />
  <Fretboard />
  <PianoKeyboard />
</main>
```

Tap some frets, verify piano keys highlight corresponding notes.

- [ ] **Step 3: Commit**

```bash
git add components/PianoKeyboard/index.vue app.vue
git commit -m "feat: PianoKeyboard component with 2-octave display and active note highlighting"
```

---

## Task 10: Layout — Responsive & Light/Dark

**Files:**
- Modify: `app.vue` (full layout implementation)

**Interfaces:**
- Consumes: All three components + CSS variables from `variables.css`
- Produces: iPad landscape split layout, portrait/phone stacked layout, working light/dark toggle

- [ ] **Step 1: Rewrite `app.vue` with full layout**

```vue
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
```

- [ ] **Step 2: Verify layout in browser**

```bash
npm run dev
```

- Open on desktop: should show stacked layout
- Use browser DevTools to simulate iPad landscape (1024×768): should show split layout
- Toggle dark mode button: page should switch theme smoothly

- [ ] **Step 3: Commit**

```bash
git add app.vue
git commit -m "feat: responsive layout with iPad landscape split view and light/dark theme toggle"
```

---

## Task 11: Build & Deploy

**Files:**
- No new files

- [ ] **Step 1: Run full test suite**

```bash
npm test
```

Expected: All tests PASS.

- [ ] **Step 2: TypeScript check**

```bash
npx nuxi typecheck
```

Expected: No errors.

- [ ] **Step 3: Production build**

```bash
npm run generate
```

Expected: `dist/` folder generated with no errors.

- [ ] **Step 4: Preview production build locally**

```bash
npx serve dist
```

Open `http://localhost:3000` (or whatever port `serve` shows). Test the full flow: tap frets → chord appears → piano highlights → dark mode toggles.

- [ ] **Step 5: Deploy to Vercel (first time)**

```bash
npx vercel
```

Follow prompts: link to project, framework = Nuxt 3, output dir = `dist`. After deploy, open the preview URL and test on actual iPad.

- [ ] **Step 6: Final commit**

```bash
git add .
git commit -m "chore: production build verified, deploy to Vercel"
```
