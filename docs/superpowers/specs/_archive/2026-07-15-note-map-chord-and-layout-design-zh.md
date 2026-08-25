# 音位對照頁：版面對調 + 和弦提示 — 設計規格

日期：2026-07-15

## 總覽

對現有 `/piano-to-guitar` 音位對照頁做三項調整：

1. **鋼琴與吉他對調** — 鋼琴（輸入）放上面、吉他指板（輸出）放下面。
2. **預設隱藏非同八度亮點** — 預設只顯示完全同音高的實心點；使用者勾選才顯示同音名的淡色點。
3. **加上和弦提示** — 用選取的鋼琴音偵測並顯示和弦，重用現有的 `ChordResult` 元件。

Capo 明確**不在本規格範圍內**（未來擴充，見最後一節）。

這是對 `2026-07-14-piano-to-guitar-note-map-design.md` 所交付功能的迭代。只動到音位對照頁、`usePianoNoteMap` composable、共用的 `ChordResult` 元件（向後相容），以及一處 `detectChord` 參數型別的收窄。

---

## 範圍

### 包含
- 把 `/piano-to-guitar` 頁重排為：鋼琴 → 和弦提示 → 吉他指板 → 控制列。
- 把 `usePianoNoteMap` 的 `showOffOctave` 預設改為 `false`；控制列改為 opt-in 的「顯示」開關。
- 用選取的鋼琴音偵測和弦，透過 `ChordResult` 顯示。
- 用選用 props 泛化 `ChordResult`，讓兩頁都能用而不改動吉他頁。
- 把 `detectChord` 的參數型別收窄成它實際用到的欄位。

### 不包含
- 本頁的 capo（未來擴充）。
- 吉他（`/guitar-to-piano`）頁的任何行為或外觀變動。
- 對 `GuitarNeck`、`PianoKeyboard`、調色盤 token，或核心 neck/note-map 位置邏輯的變動。

---

## 1. 版面對調 + 和弦提示位置

`app/pages/piano-to-guitar.vue` 由上到下改為：

```
┌───────────────────────────────────────────┐
│  header：fret notes   [從吉他][從鋼琴]  🌙 │
├───────────────────────────────────────────┤
│  PianoKeyboard（E2–C6，可點擊，自動縮放）  │
├───────────────────────────────────────────┤
│  ChordResult（依選取音顯示的和弦）         │
├───────────────────────────────────────────┤
│  GuitarNeck（橫向，6×20，向右捲動）        │
├───────────────────────────────────────────┤
│  控制列：[顯示非同八度亮點]  n/6  [清除]   │
└───────────────────────────────────────────┘
```

閱讀順序符合心智模型：在鋼琴上彈（輸入）→ 看到和弦名 → 看到這些音在吉他上的位置（輸出）→ 控制列。鋼琴與指板在窄螢幕仍可橫向捲動；`ChordResult` 是夾在中間的精簡卡片。

---

## 2. 預設隱藏非同八度亮點

- `usePianoNoteMap`：`showOffOctave` ref 預設由 `true` 改為 **`false`**。預設不顯示其他八度，指板一開始只亮完全同音高的位置。
- 控制由「隱藏」改為「顯示」：
  - 標籤：**顯示非同八度亮點**
  - 綁定：`:checked="showOffOctave"`、`@change="showOffOctave = !showOffOctave"`（勾選 ⇒ `showOffOctave = true` ⇒ 淡色點出現）。

`computeLitPositions` 不動——它本來就依 `showOffOctave` 參數決定淡色點的有無。

---

## 3. 和弦提示（重用 `ChordResult`）

### 3a. composable 的和弦來源

`usePianoNoteMap` 新增一個由選取音推得的 `detectedChord` computed：

```ts
import { detectChord, type ChordResult } from '~~/core/music-theory/chord-detector'
import { midiToPitchClass } from '~~/core/music-theory/notes'

const detectedChord = computed<ChordResult | null>(() =>
  detectChord(
    [...selectedMidis.value.keys()].map(midi => ({
      midi,
      pitchClass: midiToPitchClass(midi),
    })),
  ),
)
```

從 `usePianoNoteMap()` 連同既有值一起回傳。`detectChord` 已處理：少於 2 個相異音別 → `null`（空狀態）；用最低 MIDI 判斷分數和弦（選取音帶有真實八度）；無法識別的音集 → 顯示組成音。

### 3b. 收窄 `detectChord` 的參數型別

`detectChord` 目前參數是 `SelectedNote[]`，但只讀 `.midi` 與 `.pitchClass`。把參數收窄成這兩個欄位：

```ts
export function detectChord(notes: { midi: number; pitchClass: number }[]): ChordResult | null
```

這是向後相容的：吉他頁的 `SelectedNote[]`（有 `midi`、`pitchClass` 再加其他欄位）在結構型別上仍滿足較窄的型別，既有的 `chord-detector` 測試仍過；並讓音位對照頁能直接傳 `{ midi, pitchClass }` 物件、不必捏造 `stringIndex`/`fret`/`noteName`。`SelectedNote` 本身不變。

### 3c. 用選用 props 泛化 `ChordResult`（向後相容）

比照 `PianoKeyboard` 的做法：`ChordResult` 加選用 props，缺省時 fallback 回 `useFretboard()`，所以不傳 props 的吉他頁完全不變。

```ts
const props = defineProps<{
  chord?: ChordResult | null       // undefined = fallback 回 useFretboard().detectedChord
  capoFret?: number                // undefined = fallback 回 useFretboard().capoFret
  emptyHint?: string               // undefined = 吉他頁預設提示
}>()

const fb = useFretboard()
const detectedChord = computed(() => props.chord !== undefined ? props.chord : fb.detectedChord.value)
const capoFret     = computed(() => props.capoFret ?? fb.capoFret.value)
const emptyHint    = computed(() => props.emptyHint ?? '點選指板上的格子來識別和弦')
```

- `undefined`（無此 prop）代表「用 fretboard fallback」；明確的 `null` 是合法的「沒有和弦」值。當有傳 props 時，fallback 分支不會讀 `fb.*`，因此不會對吉他頁狀態建立反應式依賴。
- 空狀態文字改為 `{{ emptyHint }}`，不再寫死。
- `shapeChord`/`shapeLabel` 與 `形狀 · Capo` 副標是**只有 capo 時**才顯示（包在 `v-if="capoFret > 0"` 內）。音位對照頁傳 `capoFret = 0`，該區塊永不渲染、`shapeChord` 永不被讀 —— 因此不需要加 `shapeChord` prop。`shapeLabel` 仍讀 `fb.shapeChord`，但只有 `capoFret > 0` 時才會被求值，而本頁永遠不會。

### 3d. 頁面接線

```vue
<ChordResult :chord="detectedChord" :capo-fret="0" empty-hint="點鋼琴鍵來識別和弦" />
```

---

## 動到的檔案

| 檔案 | 變更 |
|------|------|
| `app/pages/piano-to-guitar.vue` | 重排為 鋼琴 → ChordResult → 指板 → 控制列；加上接 `detectedChord` 的 `<ChordResult>`；開關改為「顯示非同八度亮點」 |
| `app/composables/usePianoNoteMap.ts` | `showOffOctave` 預設 `false`；新增並匯出 `detectedChord` computed |
| `app/components/ChordResult/index.vue` | 選用 props `chord` / `capoFret` / `emptyHint`，缺省時 fallback 回 `useFretboard()`；空狀態文字改用 `emptyHint` |
| `core/music-theory/chord-detector.ts` | 把 `detectChord` 參數型別收窄成 `{ midi: number; pitchClass: number }[]` |
| `tests/music-theory/chord-detector.test.ts` | 新增案例：用 `{ midi, pitchClass }` 物件（無 string/fret）偵測和弦 |

不動 `GuitarNeck`、`PianoKeyboard`、`variables.css`、`neck.ts`、`note-map.ts`。

---

## 測試

核心（`chord-detector.ts`）純單元測試：
- 收窄參數型別後既有測試仍過（吉他式 `SelectedNote[]` 仍被接受）。
- 新增：用純 `{ midi, pitchClass }[]`（例如 C 大三和弦 C4/E4/G4 → 根音 C、大三和弦）回傳正確和弦 —— 證明音位對照頁的呼叫可行、且不需要 string/fret 欄位。
- 新增：由 `{ midi, pitchClass }` 的最低音判斷分數和弦（例如 A/C/E、E 為最低 MIDI → `Am/E`）。

瀏覽器驗證（於 `/piano-to-guitar`）：
- 版面順序為 鋼琴 → 和弦提示 → 指板 → 控制列。
- 選音時 `ChordResult`（和弦名、候選、組成音 pill、音程）隨鋼琴選取即時更新；相異音少於 2 個顯示空狀態提示「點鋼琴鍵來識別和弦」。
- 預設只顯示實心同音高點（無淡色點）；勾「顯示非同八度亮點」出現淡色點、取消則隱藏。
- 吉他（`/guitar-to-piano`）頁的 `ChordResult` 與行為不變（向後相容檢查）。

---

## 未來：Capo（不在本規格內）

之後的迭代會在音位對照頁加上 capo 控制。預期形狀：`findExactPositions` / `findPitchClassPositions` 多接一個選用的 capo 位移；capo 格以下的位置排除，開放弦基準往上移 capo 的量，使音高↔把位對應反映 capo。其餘（鋼琴輸入、和弦偵測、版面）不變。把位置查詢設計成日後可接受該位移，現在不需要任何改動。
