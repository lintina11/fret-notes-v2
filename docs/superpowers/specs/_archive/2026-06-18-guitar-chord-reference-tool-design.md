# Guitar Chord Reference Tool — Design Spec
Date: 2026-06-18

## Overview

A cross-instrument chord reference web tool, guitar-first. Users interact with a virtual fretboard to identify chords in real time, with results displayed as chord name, intervals, component notes, and a piano keyboard visualization.

**Primary audience:** Guitar players with basic-to-intermediate music theory knowledge.
**Primary device:** iPad (touch-optimized), responsive to phone and desktop.

---

## Tech Stack

- **Framework:** Nuxt 3 (Vue 3 + TypeScript), static deployment (`nuxt generate`)
- **Deployment:** Vercel or Netlify
- **Styling:** CSS (with CSS variables for light/dark theming)
- **Future:** Supabase for user accounts and saved chord shapes (not in scope for Phase 1)

---

## Scope — Phase 1

### In scope
- Interactive fretboard (tap/click to add/remove finger positions)
- Real-time chord detection from selected notes
- Chord result display: name, slash chord, candidate alternates, component notes, intervals
- Piano keyboard visualization (read-only, auto-range)
- Light / Dark mode toggle
- Responsive layout (iPad landscape/portrait, phone)

### Out of scope (Phase 2+)
- Piano → guitar direction (piano keys clickable to suggest guitar chord shapes)
- User accounts and saved custom chord shapes (Supabase)
- Additional tunings (Drop D, open tunings)
- Extended chord types beyond Phase 1 set

---

## Music Theory Layer

### Chord types supported (Phase 1)

| Category | Types |
|----------|-------|
| Triads | Major, Minor, Diminished, Augmented |
| Seventh | maj7, m7, 7 (dominant), m7b5 |
| Suspended | sus2, sus4 |
| Added | add9, 6, m6 |

### Detection approach

Chord detection uses **interval set matching**, not a hardcoded chord-name table.

1. Collect all unique pitch classes from selected frets (0–11, ignoring octave)
2. For each possible root, compute interval set relative to that root
3. Match against interval rule definitions (e.g. `[0, 3, 7]` = minor triad)
4. Rank results; surface top 1 as primary, up to 2 alternates

**Slash chord detection:** If the lowest-pitched selected note is not the root, display as `Am/E`.

**Unrecognized sets:** Display component notes without forcing a chord name.

### Architecture

```
core/music-theory/
├── notes.ts          # 12-tone pitch classes, note names, enharmonic equivalents
├── intervals.ts      # Interval calculation between pitch classes
├── chord-rules.ts    # Interval set → chord name definitions
└── chord-detector.ts # Main detection function: notes[] → ChordResult
```

All music logic is pure TypeScript with no UI dependencies. Independently testable.

---

## Components

### `<Fretboard />`

**Specs:**
- 6 strings × 12 frets, default view shows frets 1–5 (scrollable to fret 12)
- Standard tuning: E2 A2 D3 G3 B3 E4
- Left column: fret number labels
- Top row: open string indicators

**Open string behavior:**
- No finger press on string → show open circle (string is played open)
- Finger press exists on string → open circle hidden automatically
- User can tap open circle area to toggle string as muted (×)

**Interaction:**
- Tap fret cell → toggle finger press (add/remove)
- Tap open circle → cycle: open → muted → open
- Clear button → reset all strings
- Every state change immediately triggers chord detection

**Touch targets:** Minimum 44×44pt for all interactive elements.

---

### `<ChordResult />`

Displays the result of chord detection.

```
┌──────────────────────────────┐
│  Am/E                        │  ← Primary chord name (large)
│  也可能是 C6/E、Am7/E        │  ← Alternate candidates (small)
├──────────────────────────────┤
│  組成音   E  A  C            │  ← Pill-style note badges
│  音程     根音 小三度 完全五度│  ← Interval labels below each note
└──────────────────────────────┘
```

Entry animation: fade + subtle slide-up on each new result.

---

### `<PianoKeyboard />`

Read-only. Displays which notes are present in the detected chord.

**Display:**
- Fixed width: 2 octaves, always starting and ending on C (e.g. C3–C5)
- Auto-range: select the octave range that contains the most component notes
- Octave shift only triggers when chord detection result changes (not on every tap)
- Highlighted keys use primary accent color

**Phase 1:** Non-interactive (display only).
**Phase 2:** Clickable keys → set component notes → suggest guitar chord shapes.

---

## Layout

### iPad Landscape
```
┌──────────────┬──────────────┐
│              │              │
│   Fretboard  │  ChordResult │
│              │              │
├──────────────┴──────────────┤
│        PianoKeyboard        │
└─────────────────────────────┘
```

### iPad Portrait / Phone
```
┌─────────────────────────────┐
│         ChordResult         │
├─────────────────────────────┤
│          Fretboard          │
├─────────────────────────────┤
│        PianoKeyboard        │
└─────────────────────────────┘
```

Breakpoint: `@media (orientation: landscape) and (min-width: 768px)` triggers the split layout.

---

## Visual Design

**Color palette:**

| Token | Light | Dark |
|-------|-------|------|
| Background | `#F8F9FF` | `#0F1117` |
| Surface (cards) | `#FFFFFF` | `#1C1F2E` |
| Primary | `#4F6EF7` (indigo) | `#6B87FF` |
| Accent | `#FF6B6B` (coral) | `#FF8080` |
| Text primary | `#1A1A2E` | `#E8EAFF` |
| Text muted | `#8B8FA8` | `#6B6F88` |

**Typography:** `DM Sans` (headings) + `Inter` (body/labels) — both available on Google Fonts.

**Fretboard details:**
- Fret intersections: subtle dot markers (realistic fret feel)
- Finger press dots: primary color fill, white note name inside
- Open string circles: primary color outline, no fill

**Light/Dark toggle:** Top-right corner, animated sun/moon icon with smooth CSS transition.

**Interaction animations:**
- Finger dot appear/disappear: scale + fade (80ms)
- ChordResult update: fade + slide-up (150ms)
- Light/Dark switch: background color transition (200ms)

---

## State Management

Single composable `useFretboard.ts` shared across all three components:

```ts
// Exposed state & actions
const selectedFrets   // Map<stringIndex, fretNumber | 'open' | 'muted'>
const detectedChord   // ChordResult | null
const clearAll()      // Reset fretboard
```

No Pinia needed for Phase 1; composable state is sufficient.

---

## Future Phases

| Phase | Feature |
|-------|---------|
| 2 | Clickable piano keys → suggest guitar chord shapes |
| 2 | User accounts (Supabase) + saved custom chord shapes |
| 3 | Additional tunings (Drop D, DADGAD, etc.) |
| 3 | Capo support with transposed note display |
| 3 | Extended chord types (9, m9, 13, maj9...) |
