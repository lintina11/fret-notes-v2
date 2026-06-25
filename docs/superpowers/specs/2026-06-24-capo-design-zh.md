# Capo（移調夾）功能 — 設計文件
日期：2026-06-24

## 專案概述

為 fret-notes 吉他和弦工具加入 capo（移調夾）支援。當 capo 夾在第 N 格時，capo 成為新的 nut（上弦枕）：使用者以 capo 為基準按和弦形狀，工具同時顯示**形狀名**（你按的和弦形狀，把 capo 當成 nut 來看）與**發聲名**（實際聽到的和弦 = 形狀整體升 N 半音）。

這是現有「吉他 → 和弦識別」的延伸。**不會**更動 core 的 `detectChord` 演算法；capo 完全透過「如何建構選取的音」來表達。

**範疇：** 這份 spec 只涵蓋 capo 的顯示功能（「B」使用情境）。反向查詢（和弦 → 建議 capo 位置 + 指型清單，「C」）是未來另一份獨立 spec，不在此範圍內。

---

## 背景：現有架構

- `core/music-theory/` — 純和弦識別引擎（`detectChord(notes: SelectedNote[]): ChordResult | null`），以 pitch class 運作。
- `app/composables/useFretboard.ts` — singleton 響應式狀態：`pressedFrets: Map<number, number>`（弦 index → 絕對格數）、`mutedStrings: Set<number>`。建構 `SelectedNote[]` 並導出 `detectedChord`。
- `app/components/Fretboard/index.vue` — SVG 指型圖，5 格顯示視窗 + ▲▼ 導航（`startFret` 1–8）。
- `app/components/ChordResult/index.vue` — 渲染 `detectedChord`（名稱、轉位、alternates、組成音 pill + 音程；無法識別音集時顯示「音集」；無音時顯示空狀態）。
- `app/components/PianoKeyboard/index.vue` — 唯讀 2 八度鋼琴，以 **pitch class** 高亮（視窗內所有符合的鍵都亮，不分八度）。

---

## Capo 語意

Capo 夾在第 `C` 格（1–7）時，所有弦在第 `C` 格被夾住。每根弦：

| 弦的狀態 | 發聲 MIDI | 形狀 MIDI |
|----------|-----------|-----------|
| 靜音 | （排除） | （排除） |
| 按在絕對格 `f`（`f > C`） | `OPEN_STRINGS[s] + f` | `OPEN_STRINGS[s] + (f - C)` |
| 空弦（未按、未靜音） | `OPEN_STRINGS[s] + C` | `OPEN_STRINGS[s] + 0` |

所以 **形狀 = 發聲整體減 `C` 半音**。當 `C = 0`（無 capo）時，形狀與發聲完全相同，行為與現有 app 一致。

顯示的**發聲**和弦 = `detectChord(soundingNotes)`；**形狀**和弦 = `detectChord(shapeNotes)`。對兩組音各自獨立跑識別，能得到完整格式化的結果（含轉位與 alternates），不需脆弱的字串轉調。

**Capo 範圍：** 0–7（0 = 無 capo）。

---

## 元件

### `core/music-theory/fretboard.ts`（新增）

```ts
import type { SelectedNote } from './chord-detector'

export type NoteMode = 'sounding' | 'shape'

// pressedFrets: 弦 index → 絕對格數（有效按弦須 f > capoFret）
// capoFret: 0–7
export function buildSelectedNotes(
  pressedFrets: Map<number, number>,
  mutedStrings: Set<number>,
  capoFret: number,
  mode: NoteMode,
): SelectedNote[]
```

每根弦（0–5）：
- 靜音 → 跳過
- 按在絕對格 `f` → 發聲 `OPEN_STRINGS[s] + f`；形狀 `OPEN_STRINGS[s] + (f - capoFret)`
- 空弦（未按、未靜音）→ 發聲 `OPEN_STRINGS[s] + capoFret`；形狀 `OPEN_STRINGS[s] + 0`

每個音帶 `{ stringIndex, fret, midi, pitchClass, noteName }`（`fret` = 按弦的絕對格、空弦為 0，與現有慣例相同）。純函式、可單元測試。

這會**取代**目前 `useFretboard.ts` 裡內聯的 `getSelectedNotes`。當 `capoFret = 0` 時，兩種 mode 都會重現現有行為。

### `app/composables/useFretboard.ts`（修改）

新增狀態與導出：

```ts
const capoFret = ref(0)   // 0–7，singleton

const detectedChord = computed(() =>          // 發聲 — 餵鋼琴 + 大字主名
  detectChord(buildSelectedNotes(pressedFrets.value, mutedStrings.value, capoFret.value, 'sounding'))
)
const shapeChord = computed(() =>             // 形狀 — 餵副標
  detectChord(buildSelectedNotes(pressedFrets.value, mutedStrings.value, capoFret.value, 'shape'))
)

function setCapo(fret: number): void          // clamp 到 0–7
```

- `setCapo`：clamp 到 0–7。設定後清除所有 `絕對格 <= capoFret` 的按弦（落在 capo 下方/上方界線，不合法），比照現有 `navigate()` 的清理模式。
- `clearAll`：一併把 `capoFret` 歸 0。
- 導出：`{ pressedFrets, mutedStrings, capoFret, detectedChord, shapeChord, toggleFret, toggleMute, setCapo, clearAll }`。

### `app/components/Fretboard/index.vue`（修改）

**Capo 步進器**置於 nav 列，沿用現有 ▲▼ 樣式但水平排列：
```
Capo: ▼ 0 ▲      （0–7；0 可顯示為「0」/「Off」）
```
呼叫 `setCapo`。

**視覺（當 capo 第 N 格落在可見視窗內時）：**
- 在第 N 格畫一條 capo bar，用 `--color-accent`（珊瑚橘），與 nut 及一般 fret 線區隔。
- 第 1…N 格（含 capo 格）變暗（灰色遮罩/填色）。
- 變暗格子的點擊目標停用：一個 cell 可點的條件是「在顯示視窗內」**且** 其格數 `> capoFret`。
- 空弦標記（圈/×）語意不變；空弦圈現在代表 capo 格的音。

**滾動邊界情況：**
- 若 capo 在可見視窗上方（例如 capo 2、視窗顯示 6–10 格），則不變暗（所有可見格都在 capo 之上、可按）；在 nav label 附近顯示「Capo N」小提示，讓使用者知道 capo 仍生效。
- capo 不可能在可見視窗下方：`capoFret ≤ 7` 而最低 `startFret` 為 8，所以滾到最底時 capo 必定在視窗上方。

**互動限制：**
- `toggleFret` 只在格數 `> capoFret` 時被呼叫（UI 擋掉變暗格）。
- 調整 capo 時清除其位置及以下的按弦（由 `setCapo` 處理）。

### `app/components/ChordResult/index.vue`（修改）

**Capo = 0：** 維持現狀——單一和弦名，與今日完全相同。

**Capo > 0：**
```
┌──────────────────────────────┐
│  D                           │  ← 大字：發聲名（detectedChord）
│  也可能是 …                  │  ← 發聲的 alternates
│  形狀：C · Capo 2            │  ← 小字副標：shapeChord 名 + capo 格數
├──────────────────────────────┤
│  組成音  D  F#  A            │  ← 發聲的組成音 pill + 音程
└──────────────────────────────┘
```
- 大字、組成音、音程、alternates 全部用 **`detectedChord`**（發聲）。
- 副標用 **`shapeChord`**：`形狀：{shapeChord.root}{shapeChord.symbol} · Capo {capoFret}`。
- 無法識別音集 + capo：大字走發聲的「音集」顯示（如同今日）；副標顯示 `形狀：(音集) · Capo {capoFret}`（若形狀也無法識別，則簡化為僅 `Capo {capoFret}`）。
- 空狀態（無音）不變。

### `app/components/PianoKeyboard/index.vue` — 不變

已經吃 `detectedChord.notes`（現在是發聲和弦）。發聲的 pitch class 會正確高亮。（只依 pitch class 高亮是現有的已知限制——見「不在範圍內」。）

---

## 資料流

```
使用者點格子 / 設定 capo
  → useFretboard 更新 pressedFrets / capoFret
  → buildSelectedNotes(..., 'sounding') → detectChord → detectedChord → ChordResult（大字）+ PianoKeyboard
  → buildSelectedNotes(..., 'shape')    → detectChord → shapeChord    → ChordResult（副標）
```

---

## 測試

**單元（`tests/music-theory/fretboard.test.ts`，新增）：**
- capo = 0：發聲與形狀都等於加 capo 前的音集（空弦在第 0 格、按弦在絕對格）。
- capo = 2、某弦按在絕對格 4：發聲 MIDI = open+4、形狀 MIDI = open+2。
- capo = 2、某空弦（未按）：發聲 MIDI = open+2、形狀 MIDI = open+0。
- 靜音弦在兩種 mode 都被排除。
- 形狀 == 發聲整體減 capoFret（對範例和弦做 pitch class 檢查）。
- 真實範例：以 capo 2 按開放 C 形狀 → 形狀識別為 C 大三和弦、發聲識別為 D 大三和弦。

**既有測試：** `detectChord` 與現有 40 個測試不變、必須仍全過（capo 邏輯在 `detectChord` 之外）。

**Build gate：** `npx nuxi typecheck` 0 錯誤；`npm run generate` 成功；dev server 正常渲染。

---

## 不在範圍內（未來 spec）

- **反向查詢（C）：** 和弦 → 建議 capo 位置 + 可能指型清單。
- **八度精準的鋼琴 voicing：** 鋼琴目前只依 pitch class 高亮；要顯示真實發聲八度，需在 `NoteInfo` 與 `detectChord` 帶上 MIDI/八度並重設計鍵盤音域。與 capo 正交、延後處理。
- 其他調弦、降弦調音。

---

## 約束

- Nuxt 4（srcDir `app/`；`~`→app、`~~`→repo root）；`core/` 與 `tests/` 在 repo 根目錄；app 透過 `~~/core/…` 引用 core。
- TypeScript strict 含 `noUncheckedIndexedAccess` — 可證明在界內的索引存取用 `!`；以 `npx nuxi typecheck` 驗證。
- 不使用外部樂理函式庫。
- 所有顏色用 CSS 變數（含既有 `--color-accent`）；不可硬編色碼。
- 觸控目標 ≥ 44px。
- `capoFret = 0` 必須完全重現現有行為（向後相容）。
