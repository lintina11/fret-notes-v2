# Chord Diagram Fretboard Redesign

**Date:** 2026-06-22  
**Scope:** `app/components/Fretboard/index.vue` only  
**No changes to:** `useFretboard.ts`, `ChordResult`, `PianoKeyboard`, `app.vue`

---

## Goal

Replace the current full-grid (12-fret checkerboard) layout with an SVG-based chord diagram matching the style of standard guitar chord charts — 6 vertical string lines crossing 5 horizontal fret lines, portrait-oriented cells, dots placed at intersections.

---

## SVG Layout Constants

| Constant | Value | Notes |
|---|---|---|
| DISPLAY_FRETS | 5 | Visible fret slots at a time |
| STRING_GAP | 28px | Horizontal distance between strings |
| FRET_GAP | 38px | Vertical distance between frets (taller than wide → portrait cells) |
| LEFT_PAD | 28px | Space for "Nfr" label when not at open position |
| RIGHT_PAD | 16px | Right padding |
| TOP_PAD | 50px | Space above nut for open/mute markers |
| BOTTOM_PAD | 22px | Space below last fret line |
| NUT_THICKNESS | 5px | Thick bar drawn at top when startFret === 1 |
| DOT_RADIUS | 13px | Pressed note dot radius |
| OPEN_RADIUS | 7px | Open string circle radius |
| SVG_W | 184px | LEFT_PAD + 5×STRING_GAP + RIGHT_PAD |
| SVG_H | 262px | TOP_PAD + 5×FRET_GAP + BOTTOM_PAD |

String x positions: `sx(s) = LEFT_PAD + s × STRING_GAP` → 28, 56, 84, 112, 140, 168  
Fret y positions (top edge of each slot): `fy(fi) = TOP_PAD + fi × FRET_GAP`  
Pressed dot center y: `fy(fi) + FRET_GAP / 2`

---

## SVG Layers (rendered bottom to top)

### 1. Click targets
- 30 transparent `<rect>` elements (6 strings × 5 fret slots)
- Position: `x = sx(s) - STRING_GAP/2`, `y = fy(fi)`, `width = STRING_GAP`, `height = FRET_GAP`
- On click: calls `toggleFret(s, displayFretNums[fi])`
- Cursor: pointer

### 2. Grid lines
- 6 vertical string lines: from `fy(0)` to `fy(DISPLAY_FRETS)`, stroke 1.5px, `color-border`
- 6 horizontal fret lines: at `fy(0)` through `fy(DISPLAY_FRETS)`, spanning `sx(0)` to `sx(5)`, stroke 1px, `color-border`

### 3. Nut / fret label
- **When `startFret === 1`:** draw a filled rect 5px tall immediately above `fy(0)`, spanning `sx(0)` to `sx(5)`, fill `color-text` (represents the nut)
- **When `startFret > 1`:** render `"Nfr"` text at `x = sx(0) - 6`, `y = fy(0) + FRET_GAP/2`, right-aligned, 10px, `color-text-muted`

### 4. Position marker dots
- Small dots (r=4) centered horizontally at `(sx(0) + sx(5)) / 2`
- Appear at fret positions 3, 5, 7, 9, 12 if within the visible window
- y center: `fy(fi) + FRET_GAP / 2`
- Fill: `color-border`

### 5. Pressed note dots
- For each string where `pressedFrets.get(s)` is within visible range:
  - Circle: `cx = sx(s)`, `cy = fy(fi) + FRET_GAP/2`, `r = DOT_RADIUS`, fill `color-primary`
  - Text: note name, centered on dot, 10px bold, fill `color-on-primary`

### 6. Open / muted markers
- Positioned above the nut at y = `TOP_PAD - 14`, centered on each string x
- **Muted string:** `×` text, 14px, fill `color-text-muted`
- **Open string (not pressed, not muted):** circle outline, `r = OPEN_RADIUS`, stroke `color-primary`, no fill
- **Pressed string:** no marker shown (dot is on the grid instead)
- Clicking any marker toggles mute via `toggleMute(s)`

---

## Navigation

- A row of controls below the SVG: `[▲]  Nfr  [▼]`
- `startFret` is a local `ref<number>` initialized to `1`
- `▲` increments `startFret` (max: 12 − DISPLAY_FRETS + 1 = 8)
- `▼` decrements `startFret` (min: 1)
- **On startFret change:** iterate all pressed strings; for any fret outside `[startFret, startFret + DISPLAY_FRETS − 1]`, call the existing `toggleFret(s, fret)` to clear it (toggleFret removes if already set to same value)
- The label shows the current startFret value (e.g., "5fr") for non-1 positions, or "Open" at position 1

---

## State Interactions

- `pressedFrets` and `mutedStrings` come from `useFretboard()` — unchanged
- `startFret` is local component state (not persisted)
- Pressing a fret on the grid: calls `toggleFret(s, absoluteFretNum)`; if the string was muted, `toggleFret` already clears the mute
- Pressing a muted/open marker: calls `toggleMute(s)`
- Clear button: calls `clearAll()` from composable, resets `startFret` to 1

---

## Theming

All colors via CSS custom properties:
- `--color-border`, `--color-text`, `--color-text-muted`
- `--color-primary`, `--color-on-primary`
- `--color-surface` (SVG background, optional)

---

## Files Changed

| File | Change |
|---|---|
| `app/components/Fretboard/index.vue` | Full rewrite of template + script + style |

No other files touched.
