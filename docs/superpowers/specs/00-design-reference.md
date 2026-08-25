# Fret Notes — Consolidated Design Reference

**Status:** Authoritative design reference. Consolidates the per-feature specs
dated **2026-06-18 → 2026-08-19** into a single document, resolving every
decision that was re-discussed or changed in favour of the **newer** decision,
and dropping abandoned approaches.

**How to read this:** this file is the single source of truth for the settled
design. The original dated specs it replaces are archived under
`docs/superpowers/specs/_archive/` (Claude-ignored) for history only. One spec
stays live outside this file — see [Audio](#8-audio-playback).

**Supersession map (what won):**

| Topic | Superseded by | Winning decision |
|---|---|---|
| Fretboard layout (`06-18`) | `06-22` | SVG chord-diagram, not a 12-fret checkerboard |
| Capo raise/lower (`06-24`) | `06-25` | Relative transpose (shape moves with capo), not clear-presses |
| Note-map layout + `showOffOctave` (`07-14`) | `07-15` | Piano on top + chord hint; off-octave hidden by default |
| Audio engine (`08-19` synthesis) | `08-20` (standalone, pending) | Sampled instruments via Tone.Sampler |

---

## 1. Overview

A cross-instrument chord reference web tool, guitar-first, with a second
piano→guitar note-map page. Two directions, two pages, independent state:

- **從吉他 (guitar → piano)** — interact with a virtual fretboard to identify a
  chord in real time; result shown as chord name, intervals, component notes,
  and a piano visualization.
- **從鋼琴 (piano → guitar)** — click single notes on a piano; a full 20-fret
  neck lights up every position that can sound them, plus a chord hint.

**Primary audience:** guitar players with basic-to-intermediate music theory.
**Primary device:** iPad (touch-optimized), responsive to phone and desktop.

---

## 2. Tech stack & constraints

- **Framework:** Nuxt 4 (Vue 3 + TypeScript), static deploy (`nuxt generate`).
  `srcDir` = `app/`; `~` → `app`, `~~` → repo root. `core/` + `tests/` at repo
  root; app imports core via `~~/core/…`, tests via relative path.
- **Styling:** CSS custom properties for light/dark theming; SCSS module per
  component (`variables.css` token system). **No hardcoded hex** — all colours
  via tokens.
- **TypeScript:** strict, incl. `noUncheckedIndexedAccess` (provably-in-bounds
  index access uses `!`; verify with `npx nuxi typecheck`).
- **No external music-theory libraries.** All theory is pure TS in `core/`.
- **Touch targets:** ≥ 44px for every interactive element.
- **Future (not scoped here):** Supabase for accounts / saved shapes.

---

## 3. Architecture

Pure logic in `core/` (Node-testable, no DOM); reactive glue and side effects in
`app/composables/`; presentation in `app/components/` + `app/pages/`.

```
core/
├── music-theory/
│   ├── notes.ts          # 12-tone pitch classes, names, enharmonics, midiToPitchClass
│   ├── intervals.ts      # interval math between pitch classes
│   ├── chord-rules.ts    # interval-set → chord-name definitions
│   ├── chord-detector.ts # detectChord(notes) → ChordResult | null
│   ├── fretboard.ts       # buildSelectedNotes, transposePressedFrets, barre helpers
│   └── neck.ts            # findExactPositions / findPitchClassPositions (20-fret)
└── audio/                 # see §8 (currently synth.ts + instruments.ts)

app/
├── app.vue               # layout shell: header (title, nav tabs, theme + sound toggle) + <NuxtPage/>
├── pages/
│   ├── index.vue             # redirect → /guitar-to-piano
│   ├── guitar-to-piano.vue    # the fretboard tool
│   └── piano-to-guitar.vue    # the note-map tool
├── components/
│   ├── Fretboard/index.vue     # SVG chord diagram (guitar page input)
│   ├── ChordResult/index.vue   # shared result card (both pages)
│   ├── PianoKeyboard/index.vue # shared piano (read-only or interactive)
│   └── GuitarNeck/index.vue    # horizontal 6×20 neck (note-map output)
└── composables/
    ├── useFretboard.ts     # guitar-page state (singleton)
    ├── usePianoNoteMap.ts  # note-map state (singleton)
    └── useAudio.ts         # playback side effects (singleton)
```

**String indexing (shared convention):** index `0` = low E (thickest, drawn
leftmost/bottom depending on view) … index `5` = high E (thinnest). Guitar "1st
string" = high E = index 5. `OPEN_STRINGS = [40,45,50,55,59,64]` (E2 A2 D3 G3 B3 E4).

---

## 4. Music-theory layer

### Chord types (Phase 1 set)

| Category | Types |
|----------|-------|
| Triads | Major, Minor, Diminished, Augmented |
| Seventh | maj7, m7, 7 (dominant), m7b5 |
| Suspended | sus2, sus4 |
| Added | add9, 6, m6 |

### Detection — interval-set matching (not a name table)

1. Collect unique pitch classes from selected notes (0–11, octave-agnostic).
2. For each candidate root, compute the interval set relative to it.
3. Match against interval-rule definitions (e.g. `[0,3,7]` = minor triad).
4. Rank; surface top 1 as primary, up to 2 alternates.

- **Slash chords:** if the lowest-pitched note isn't the root → `Am/E`. The bass
  is chosen by lowest MIDI, not array order.
- **Unrecognized sets:** show component notes ("音集" view), no forced name.
- **< 2 distinct pitch classes:** `null` → empty state.

### `detectChord` signature (narrowed — `07-15`)

`detectChord` reads only `.midi` and `.pitchClass`, so its parameter is narrowed
to exactly those fields (was `SelectedNote[]`):

```ts
export function detectChord(notes: { midi: number; pitchClass: number }[]): ChordResult | null
```

Backward compatible: the guitar page's richer `SelectedNote[]` still satisfies it
structurally; the note-map page passes bare `{ midi, pitchClass }` without
fabricating `stringIndex`/`fret`/`noteName`.

---

## 5. Guitar page (從吉他)

### 5.1 Fretboard — SVG chord diagram (`06-22`, supersedes `06-18` grid)

Standard chord-chart style: 6 vertical string lines crossing 5 horizontal fret
lines, portrait cells, dots at intersections.

**Layout constants**

| Constant | Value | Notes |
|---|---|---|
| DISPLAY_FRETS | 5 | Visible fret slots |
| STRING_GAP | 28px | Horizontal spacing between strings |
| FRET_GAP | 38px | Vertical spacing (taller than wide → portrait) |
| LEFT_PAD | 28px | Space for "Nfr" label off open position |
| RIGHT_PAD | 16px | — |
| TOP_PAD | 50px | Space above nut for open/mute markers |
| BOTTOM_PAD | 22px | Below last fret line |
| NUT_THICKNESS | 5px | Thick bar when `startFret === 1` |
| DOT_RADIUS | 13px | Pressed-note dot |
| OPEN_RADIUS | 7px | Open-string circle |
| SVG_W / SVG_H | 184 / 262px | Derived from the above |

`sx(s) = LEFT_PAD + s×STRING_GAP` → 28,56,84,112,140,168. `fy(fi) = TOP_PAD +
fi×FRET_GAP`; pressed-dot centre y = `fy(fi) + FRET_GAP/2`.

**SVG layers (bottom→top):** (1) 30 transparent click-target rects (6×5) →
`toggleFret(s, absFret)`; (2) grid lines; (3) nut bar when `startFret===1` else a
right-aligned `"Nfr"` label; (4) position-marker dots at frets 3,5,7,9,12 within
the window; (5) pressed-note dots (fill `--color-primary`, note name in
`--color-on-primary`); (6) open/mute markers above the nut (`×` muted; outline
circle open; hidden when pressed) — clicking a marker calls `toggleMute(s)`.

**Navigation:** `[▲] Nfr [▼]` row; `startFret` local ref 1–8 (`MAX_START_FRET`),
window shows `[startFret, startFret+4]`. Manual scroll drops presses that fall
outside the visible window (existing behavior).

### 5.2 Capo — dual-name model + relative transpose

**Model (`06-24`):** a capo at fret `C` becomes the new nut. Detection runs
**twice**, once per note set — no fragile string transposition:

| String state | Sounding MIDI | Shape MIDI |
|---|---|---|
| muted | excluded | excluded |
| fingered at absolute `f` (`f > C`) | `OPEN[s] + f` | `OPEN[s] + (f − C)` |
| open (unfingered, unmuted) | `OPEN[s] + C` | `OPEN[s] + 0` |

So **shape = sounding transposed down by `C`**. `detectedChord =
detectChord(sounding)` drives the piano + big name; `shapeChord =
detectChord(shape)` drives the subtitle. `capoFret` range **0–7** (0 = no capo,
reproduces pre-capo behavior exactly).

Core helper `buildSelectedNotes(pressedFrets, mutedStrings, capoFret, mode,
barre?)` (`mode: 'sounding' | 'shape'`) produces the note set. Each note:
`{ stringIndex, fret, midi, pitchClass, noteName }`.

**Behavior — relative transpose (`06-25`, supersedes `06-24`'s clear-on-raise):**
raising/lowering the capo shifts the **whole fingered shape** by the same number
of frets, so the shape stays put on screen and only the key changes. Nothing in
the shape is cleared.

```ts
function setCapo(fret: number): void {
  const next = clamp(0, MAX_CAPO, fret)          // 0–7
  const delta = next - capoFret.value
  if (delta === 0) return
  capoFret.value = next
  pressedFrets.value = transposePressedFrets(pressedFrets.value, delta, MAX_FRET) // MAX_FRET = 12
}
```

- `transposePressedFrets(map, delta, maxFret)` — pure; shifts each press by
  `delta`, **drops** any press pushed outside `[1, maxFret]` (lossy, not
  remembered); returns a new Map, input unmutated.
- The Fretboard viewport follows the capo via a watcher (`startFret += delta`,
  clamped 1–8), so the capo bar and shape keep their screen position. Default
  view stays `startFret = capoFret + 1`.
- `clearAll` resets `capoFret = 0`; `handleClear` then sets `startFret = 1`.

**Visual:** capo bar drawn at fret `C` in `--color-accent` (coral), distinct from
the nut; frets ≤ `C` dimmed and non-clickable; `toggleFret` only fires for frets
`> capoFret`. If the capo is above the visible window, show a small "Capo N"
indicator instead of dimming.

### 5.3 Barre (封閉指型) (`06-26`)

A movable, possibly-partial finger held across strings, sounding at its own fret
(distinct from the capo, which acts as the nut).

**State (`useFretboard`):**
```ts
const barreFret   = ref<number | null>(null)  // null = no barre
const barreLength = ref(6)                     // 2–6, default 6, anchored to thinnest strings
```
Covered strings = `[STRING_COUNT − barreLength .. STRING_COUNT − 1]` (length 6 →
0–5, 5 → 1–5, 4 → 2–5, 3 → 3–5, 2 → 4–5). Thinnest string (index 5) always
covered.

**Sounding-priority rule (per string, first match wins):** 1) muted → excluded;
2) higher explicit press (above barre) → sounds there; 3) barre covers the string
(no higher press) → sounds at the barre fret; 4) capo (not barred/pressed) →
sounds at capo fret; 5) open → fret 0.

Corollaries: cells at/below the barre on covered strings are dimmed &
non-clickable; placing/extending a barre drops covered-string presses at/below
it; a barred string with no higher press hides its open-circle marker.

**Actions:** `toggleBarre(fret)`, `setBarreLength(len)`, `setCapo` also shifts the
barre by the capo delta (dropped if pushed outside `[1, MAX_FRET]`), `clearAll`
resets `barreFret = null`, `barreLength = 6`. Core helpers:
`barreCoveredStrings(length)`, `dropPressesAtOrBelow(pressed, covered, fret)`, and
the extended `buildSelectedNotes(..., barre?)` (single ordered per-string pass).

**UI:** a "封閉" toggle column right of string 5 (SVG widened ~50px) with a
per-row status dot (lit `--color-primary` when active; disabled at/below capo);
barre bar as a rounded rect from `sx(startString)` to `sx(5)` in
`--color-primary` (capo stays `--color-accent` — two features, two colours);
covered strings that sound via the barre show smaller note-name labels on the
bar; a `<select>` (6/5/4/3/2) labelled 「Barre」 binds `barreLength`.

**Out of scope:** multiple simultaneous barres, bass-side anchoring, auto-detect,
finger-number annotations.

### 5.4 ChordResult (shared card)

```
┌──────────────────────────────┐
│  Am/E                        │  ← primary sounding name (large)
│  也可能是 C6/E、Am7/E        │  ← alternates (small)
│  形狀：C · Capo 2            │  ← subtitle, capo-only (v-if capoFret > 0)
├──────────────────────────────┤
│  組成音  E  A  C            │  ← note pills
│  音程    根音 小三度 完全五度│  ← interval labels
└──────────────────────────────┘
```

- Large name, pills, intervals, alternates use `detectedChord` (sounding).
- The `形狀 · Capo` subtitle (from `shapeChord`) renders only when `capoFret > 0`.
- Unrecognized set → "音集" view; empty state → `emptyHint`.
- **Optional props (`07-15`, backward compatible)** — falls back to
  `useFretboard()` when absent, so the guitar page passes nothing and is
  unchanged:
  ```ts
  chord?: ChordResult | null   // undefined ⇒ fb.detectedChord; explicit null = "no chord"
  capoFret?: number            // undefined ⇒ fb.capoFret
  emptyHint?: string           // undefined ⇒ '點選指板上的格子來識別和弦'
  ```
- Entry animation: fade + slide-up on each new result.

### 5.5 PianoKeyboard (read-only here)

2-octave read-only keyboard, highlights by **pitch class** (octave-agnostic; a
known limitation — true sounding-octave voicing is deferred). Auto-ranges to the
active notes; octave shift triggers only when the detection result changes.

---

## 6. Piano page (從鋼琴 → guitar note map) (`07-14` + `07-15`)

Read-only reference mirror: click up to 6 single notes on the piano; a full
20-fret neck lights every position that sounds them, plus a chord hint. No
fingering suggestions, no interaction on the guitar side.

### 6.1 Routing (multi-page)

- `app.vue` → layout shell: header (title, theme toggle, sound toggle, **nav
  tabs** 從吉他 / 從鋼琴) wrapping `<NuxtPage/>`.
- `pages/index.vue` → `definePageMeta({ redirect: '/guitar-to-piano' })`.
- `pages/guitar-to-piano.vue` → the fretboard tool.
- `pages/piano-to-guitar.vue` → this note-map tool.

Each page instantiates its own composable, so the two directions keep independent
state naturally. Nav tabs = `<NuxtLink>` with active-class styling.

### 6.2 Layout (`07-15`, supersedes `07-14`)

Top-to-bottom: **piano (input) → chord hint → guitar neck (output) → controls** —
matching the mental model (play → name → where those notes live → controls).

```
┌───────────────────────────────────────────┐
│  header: fret notes   [從吉他][從鋼琴]  🌙🔊│
├───────────────────────────────────────────┤
│  PianoKeyboard (E2–C6, clickable, scales)  │
├───────────────────────────────────────────┤
│  ChordResult (chord from selected notes)   │
├───────────────────────────────────────────┤
│  GuitarNeck (horizontal, 6×20, scrolls →)  │
├───────────────────────────────────────────┤
│  controls: [顯示非同八度亮點]  n/6  [清除] │
└───────────────────────────────────────────┘
```

### 6.3 GuitarNeck (new, display-only)

- 6 strings × 20 frets (`NECK_FRETS = 20`), nut on the **left**, fret 20 right;
  high E (index 5) on the **top** line, low E (index 0) bottom (tab convention).
- Tuning reused from `OPEN_STRINGS`.
- Inlay markers: single dots at 3,5,7,9,15,17,19; double at 12.
- Props: lit positions `{ stringIndex, fret, noteName, octave, colorIndex, dim }`;
  `dim: true` renders reduced opacity. Each dot shows **note name + octave**
  (e.g. `C4`).
- Horizontal scroll on narrow screens. No click handlers.

### 6.4 PianoKeyboard — interactive refactor (backward compatible)

New optional props, defaults preserve current read-only behavior:
- `interactive?: boolean` (default `false`) — keys clickable, emits
  `toggle(midi)`.
- `fixedRange?: { startMidi; endMidi } | null` (default `null`) — overrides
  auto-range.
- `activeColorMap?: Map<number, number> | null` (default `null`) — "active" means
  the key's MIDI is in the map, coloured by its `colorIndex`.

Note-map page passes `fixedRange = { startMidi: 40, endMidi: 84 }` (**E2–C6**) —
exactly what a 20-fret standard guitar can sound. All 45 keys render at once and
the existing auto-scale shrinks them to fit (horizontal scroll on mobile). No
pan/slide — keeping every selected note visible is the point.

### 6.5 `usePianoNoteMap()` (new singleton)

```ts
selectedMidis: Ref<Map<number, number>>   // midi → colorIndex (0..5), max 6
showOffOctave: Ref<boolean>               // default FALSE (07-15, was true in 07-14)
detectedChord: ComputedRef<ChordResult | null>   // 07-15, from selected notes
litPositions:  ComputedRef<LitPosition[]>        // → <GuitarNeck/>

toggleNote(midi)   // present → remove & free colour; absent & <6 → lowest free colour; ==6 → no-op
clear()
```

- `MAX_NOTES = 6`; a 7th distinct note is ignored (deselect always allowed).
- Fixed 6-colour palette (`--note-color-0…5`, light/dark), assigned by lowest
  free index so a removed middle note frees its slot for reuse.

**Lit-position computation** — for each `(midi, colorIndex)`:
`findExactPositions(midi)` → `dim: false`; if `showOffOctave`,
`findPitchClassPositions(pc)` minus the exact ones → `dim: true`, same colour.
Each `LitPosition` carries `noteName`/`octave` from the sounding MIDI at that
position (a dim dot shows its own octave, e.g. a C3 dot when C4 was pressed).

**Chord hint (`07-15`):**
```ts
const detectedChord = computed(() =>
  detectChord([...selectedMidis.value.keys()].map(midi => ({ midi, pitchClass: midiToPitchClass(midi) }))))
```
Wired on the page as:
```vue
<ChordResult :chord="detectedChord" :capo-fret="0" empty-hint="點鋼琴鍵來識別和弦" />
```
`capoFret = 0` ⇒ the `形狀 · Capo` subtitle never renders and `shapeChord` is
never read on this page.

**Off-octave default (`07-15`):** `showOffOctave` defaults `false`; the control is
an opt-in **顯示非同八度亮點** toggle (checked ⇒ dim dots appear).

### 6.6 Core — `neck.ts` (new)

```ts
export const NECK_FRETS = 20
export interface Position { stringIndex: number; fret: number }
export function findExactPositions(midi: number, maxFret = NECK_FRETS): Position[]      // incl. open (fret 0)
export function findPitchClassPositions(pc: number, maxFret = NECK_FRETS): Position[]
```
Both derive pitches from `OPEN_STRINGS` + fret; no new tuning data. Every E2–C6
pitch has ≥ 1 exact position within 20 frets, so exact highlights never come up
empty.

**Note-map palette:** 6 theme-aware CSS vars (`--note-color-0…5`); dim reuses the
same colour at ~35% opacity.

**Capo on this page:** explicitly out of scope (a future extension; the position
lookups can later take an optional capo offset without changing today's shape).

---

## 7. Layout & visual design (base)

- **Guitar page — iPad landscape:** Fretboard | ChordResult side by side, piano
  full-width below. **Portrait / phone:** ChordResult → Fretboard → Piano
  stacked. Breakpoint `@media (orientation: landscape) and (min-width: 768px)`.
- **Palette tokens (light / dark):** Background `#F8F9FF` / `#0F1117`; Surface
  `#FFFFFF` / `#1C1F2E`; Primary `#4F6EF7` / `#6B87FF`; Accent `#FF6B6B` /
  `#FF8080`; Text `#1A1A2E` / `#E8EAFF`; Muted `#8B8FA8` / `#6B6F88`.
- **Type:** `DM Sans` (headings) + `Inter` (body) — Google Fonts.
- **Theme toggle:** top-right animated sun/moon, CSS-transitioned.
- **Micro-animations:** finger dot scale+fade 80ms; ChordResult fade+slide-up
  150ms; theme switch 200ms.

---

## 8. Audio playback

Every added note plays immediately; a ▶ button plays the whole detected chord.
Guitar page = plucked timbre / strummed chord; piano page = struck timbre / block
chord. Single choke point per interaction so components stay dumb:

| Trigger | Source (on add only) | Call |
|---|---|---|
| Press a fret | `useFretboard.toggleFret` | `playNote(OPEN[s]+fret, 'guitar')` |
| Press a piano key | `usePianoNoteMap.toggleNote` | `playNote(midi, 'piano')` |
| ▶ play chord | `ChordResult` button | `playChord(midis, instrument)` |
| Sound on/off | header 🔊/🔇 | `toggleEnabled()` (localStorage-persisted; hydrated after mount) |

`ChordResult` gains optional `playMidis` + `instrument` props (guitar page omits
both → falls back to `fb.selectedNotes` + `'guitar'`; piano page passes selected
MIDIs + `'piano'`). Removing/muting a note is silent. `core/audio/synth.ts`
carries `midiToFrequency` and `chordSchedule` (guitar strum stagger / piano
block, de-duped).

> **⚠ Engine decision — sampler migration supersedes synthesis.**
> The **initial engine** (`08-19`) was pure Web-Audio oscillator synthesis
> (`instruments.ts` VOICES/ADSR, `DynamicsCompressor`, attack-noise). It was
> superseded by the **sampled-instrument** design (`Tone.Sampler`, self-hosted
> mp3 sample packs), which is the authoritative audio direction.
>
> That migration lives in its own **still-live** spec —
> [`2026-08-20-audio-sampler-migration-design.md`](2026-08-20-audio-sampler-migration-design.md)
> (kept out of this consolidation because it is **pending implementation**).
> As of this writing the shipped code still runs the synthesis engine; the
> sampler migration is agreed but not yet built. Treat the 08-20 spec as the
> source of truth for the audio engine going forward.

---

## 9. State management summary

- `useFretboard` (singleton): `pressedFrets: Map<stringIndex, absoluteFret>`,
  `mutedStrings: Set<number>`, `capoFret` (0–7), `barreFret`, `barreLength`;
  computes `detectedChord` (sounding) + `shapeChord` (shape); exposes
  `toggleFret`, `toggleMute`, `setCapo`, `toggleBarre`, `setBarreLength`,
  `clearAll`.
- `usePianoNoteMap` (singleton): `selectedMidis`, `showOffOctave`,
  `detectedChord`, `litPositions`; `toggleNote`, `clear`.
- `useAudio` (singleton): `enabled` + playback methods (see §8).
- No Pinia — module-level composable singletons suffice.

---

## 10. Testing strategy

- **Core, pure unit tests (Node):**
  - `chord-detector`: interval-set detection, slash from lowest MIDI, unrecognized
    sets, and the narrowed `{ midi, pitchClass }[]` call site (07-15 additions).
  - `fretboard`: `buildSelectedNotes` (capo sounding/shape, muted excluded, shape
    = sounding − capo), `transposePressedFrets` (shift up/down, drop past maxFret,
    input not mutated), barre (`barreCoveredStrings`, `dropPressesAtOrBelow`,
    barre+capo shape mode, mute precedence, higher-press precedence).
  - `neck`: `findExactPositions` boundaries (E2 → `[{0,0}]`, C6 → `[{5,20}]`, C4 →
    5 positions), `findPitchClassPositions` includes/excludes correctly.
  - `audio/synth`: `midiToFrequency` (A4 anchor, octave doubling), `chordSchedule`
    (sort, piano block, guitar stagger, de-dupe, empty).
- **Build gate:** `npx nuxi typecheck` 0 errors · `npm test` green · `npm run
  generate` succeeds · dev preview HTTP 200.
- **Browser-verified:** interactive PianoKeyboard, GuitarNeck rendering, layout
  order, capo/barre visuals, Web-Audio playback (no DOM in the Node env).

---

## 11. Archived source specs (history only)

Consolidated into this file and moved to `docs/superpowers/specs/_archive/`
(Claude-ignored). Each `-zh.md` twin is archived alongside its English original.

| Archived spec | Folded into | Notes |
|---|---|---|
| `2026-06-18-guitar-chord-reference-tool-design` | §1–4, 5.4, 5.5, 7, 9 | Base tool; its Fretboard grid superseded by 06-22 |
| `2026-06-22-chord-diagram-fretboard-design` | §5.1 | SVG chord diagram |
| `2026-06-24-capo-design` | §5.2 | Capo model; clear-on-raise superseded by 06-25 |
| `2026-06-25-capo-relative-transpose-design` | §5.2 | Relative-transpose behavior (winning) |
| `2026-06-26-barre-chord-design` | §5.3 | Barre |
| `2026-07-14-piano-to-guitar-note-map-design` | §6 | Note map; layout + off-octave superseded by 07-15 |
| `2026-07-15-note-map-chord-and-layout-design` | §6 | Layout swap, chord hint, off-octave default (winning) |
| `2026-08-19-audio-playback-design` | §8 | Synthesis engine; superseded by the live 08-20 sampler spec |

**Still live (not archived):**
`2026-08-20-audio-sampler-migration-design.md` — the authoritative, pending audio
engine (see §8).

---

## 12. Out of scope / future

- Reverse lookup (chord → suggested capo + shapes).
- Octave-accurate piano voicing (piano highlights by pitch class only).
- Capo on the note-map page; alternate/drop tunings; extended chord types
  (9, m9, 13, maj9…).
- User accounts + saved custom shapes (Supabase).
- Audio: instrument-switching UI, velocity/dynamics, sustain, reverb, offline
  sample caching.
