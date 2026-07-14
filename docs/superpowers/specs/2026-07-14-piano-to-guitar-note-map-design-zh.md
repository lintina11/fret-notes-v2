# 鋼琴單音 → 吉他指位對照圖 — 設計規格

日期：2026-07-14

## 總覽

第二個唯讀對照頁面：使用者在鋼琴鍵盤上點選單音（最多 6 個），上方一整片 20 格吉他琴頸就把**所有**能發出這些音的把位亮起來。純顯示——不做和弦偵測、不推薦指法、吉他側完全不可互動。

這是現有工具（吉他 → 鋼琴）的鏡射方向。兩個方向是**各自獨立的頁面**，**不共用**彈奏狀態。部分 UI 元件在原始碼層級共用（見下），但每一頁擁有自己的狀態。

**命名（暫定）：**
- Header 分頁：**從吉他**（吉他 → 鋼琴，現有工具）／**從鋼琴**（本新工具）
- 路由：`/guitar-to-piano` 與 `/piano-to-guitar`

---

## 範圍

### 包含
- 新的 `/piano-to-guitar` 頁面
- 可點擊的鋼琴鍵盤（固定音域 E2–C6），最多同時 6 個音
- 全琴頸橫向吉他圖：6 弦 × 20 格，標準調弦
- 每個音一種顏色（按下的每個音各配一色）
- 完全同音高亮點（實心）＋ 同音名／不同八度亮點（淡色）
- 一個開關可隱藏非同八度（淡色）亮點
- 清除按鈕
- Header 在兩個方向之間切換的導覽

### 不包含
- 從這些音反推可彈奏的和弦指型／指法
- 本頁的泛音、其他調弦、移調夾
- 吉他琴頸的任何互動（純顯示）
- 重新整理後保留選取狀態

---

## 路由

專案目前沒有 `pages/` 目錄——Nuxt 直接渲染 `app.vue`。本功能引入 Nuxt 標準的檔案式路由。

- `app.vue` → 改為外層 layout：header（標題＋主題切換＋**導覽分頁**）包住 `<NuxtPage />`。
- `app/pages/guitar-to-piano.vue` → 現有功能。目前 `app.vue` 主體（Fretboard ＋ ChordResult ＋ PianoKeyboard 的排版）原封搬到這裡。
- `app/pages/piano-to-guitar.vue` → 新功能。
- `app/pages/index.vue` → 轉址到 `/guitar-to-piano`（用 `definePageMeta({ redirect: '/guitar-to-piano' })`），所以預設進入點仍是原本的工具。

導覽分頁用 `<NuxtLink>` 搭配 active-class 樣式。切換分頁就是換路由；因為每一頁各自建立自己的 composable，兩個方向天然保持獨立狀態。

---

## 元件

### `<GuitarNeck />` — 全新，純顯示

橫向全琴頸圖。

- **排版：** 6 弦 × 20 格。琴枕在**左**、第 20 格在**右**。高音 E 弦（字串索引 5）在**最上**線、低音 E 弦（索引 0）在**最下**線（標準 tab 慣例）。
- **調弦：** 標準調弦，沿用 `OPEN_STRINGS`（E2 A2 D3 G3 B3 E4）。
- **琴格記號（inlay）：** 第 3、5、7、9、15、17、19 格單點，第 12 格雙點（增加真實感）。
- **Props：** 亮點清單。每筆：`{ stringIndex, fret, noteName, octave, colorIndex, dim }`。
- **繪製：** 每個亮點畫一個填色圓點，用該音的調色盤顏色；`dim: true` 以較低不透明度繪製。點內顯示**音名＋八度**（如 `C4`），字小。
- **響應式：** 窄螢幕橫向捲動（20 格琴頸很寬）。
- 無點擊事件——純展示。

### `<PianoKeyboard />` — 改造現有，向後相容

現有元件是唯讀、依活躍音自動縮放音域。新增的選用 props 擴充它，但不改變現有行為。

- **新增 props（皆選用）：**
  - `interactive?: boolean`（預設 `false`）——為 true 時鍵可點擊。
  - `fixedRange?: { startMidi: number; endMidi: number } | null`（預設 `null`）——設定時用此範圍取代 `computePianoRange(...)`。
  - `activeColorMap?: Map<number, number> | null`（預設 `null`）——設定時，「active」代表該鍵 MIDI 在此 map 內，鍵／標籤依其 `colorIndex`（調色盤）上色。為 null 時退回目前的 `useFretboard().selectedNotes` 來源。
- **新增 emit：** `toggle(midi: number)`——`interactive` 時點擊觸發。
- **向後相容：** 現有頁面渲染 `<PianoKeyboard />` 不帶任何 prop → 行為與現在完全相同（自動縮放、唯讀、依 `selectedNotes` 上色）。現有的「自動縮放塞進容器寬度」邏輯原封不動，正是它讓新頁面能把完整 E2–C6 範圍縮放進容器。

### 新頁面的鋼琴音域

新頁面傳入 `fixedRange = { startMidi: 40, endMidi: 84 }`（**E2–C6**）。這剛好涵蓋 20 格標準調弦吉他能發出的範圍：最低＝低音 E 空弦（MIDI 40），最高＝高音 E 弦第 20 格（MIDI 84）。全部 45 鍵一次渲染，由現有的自動縮放縮進容器（手機上橫向捲動）。不做左右滑動控制——讓每個選取音隨時都看得到，正是多音選取工具的重點。

### 頁面控制列（內嵌於 `piano-to-guitar.vue`）

一個小控制列：
- **隱藏非同八度亮點** 開關 → 驅動 `showOffOctave`。
- **清除** 按鈕 → 清空所有選取音。
- 計數指示（如 `3 / 6`）。

---

## 狀態 — `usePianoNoteMap()` composable

全新 composable，模組層級單例，與 `useFretboard` 完全分開。

```ts
selectedMidis: Ref<Map<number, number>>   // midi → colorIndex（0..5），最多 6 筆
showOffOctave: Ref<boolean>               // 預設 true

toggleNote(midi)   // 已存在 → 移除並釋放其顏色；
                   // 不存在且數量 < 6 → 配給最小的空 colorIndex；
                   // 不存在且數量 === 6 → 忽略（no-op）
clear()

litPositions: ComputedRef<LitPosition[]>  // 餵給 <GuitarNeck />
```

- `MAX_NOTES = 6`。第 7 個不同的音被忽略；取消已選取的音永遠允許。
- **顏色：** 固定 6 色調色盤，索引 0–5。依最小空索引配色，所以移除中間某音會釋放其色位供重用。

### 亮點計算

對 `selectedMidis` 中的每個 `(midi, colorIndex)`：
- **完全同音高**（`findExactPositions(midi)`）→ `dim: false`，調色盤色 `colorIndex`。
- 若 `showOffOctave`：**同音名**（`findPitchClassPositions(pc)`）扣掉完全同音高的部分 → `dim: true`，同 `colorIndex`。

每筆 `LitPosition` 帶有依該把位實際發聲 MIDI 推得的 `noteName` 與 `octave`，所以吉他點的標籤反映該處真實音高（淡色點顯示自己的八度，例如按下 C4 時某個把位是 C3 就顯示 C3）。

---

## 核心樂理 — `core/music-theory/neck.ts`（新）

純函式、無 UI 依賴、可單元測試——與 `chord-detector.ts` 同層。

```ts
export const NECK_FRETS = 20

export interface Position { stringIndex: number; fret: number }

// NECK_FRETS 琴格（標準調弦）上，所有能發出剛好 `midi` 的 (弦, 格)。含空弦（第 0 格）。
export function findExactPositions(midi: number, maxFret = NECK_FRETS): Position[]

// 所有音別等於 `pc` 的 (弦, 格)。
export function findPitchClassPositions(pc: number, maxFret = NECK_FRETS): Position[]
```

兩者都由 `OPEN_STRINGS` ＋ 琴格推得音高。不引入任何新的調弦資料。

---

## 亮燈規則（總結）

每個按下的鋼琴音各有自己的調色盤顏色。對每個按下的音：
- **完全同音高**的把位 → 實心色。
- **同音名、不同八度**的把位 → 淡色（降低不透明度）同一顏色。
- `showOffOctave` 關閉 → 只留實心（同音高）的點。
- 每個亮點顯示**音名＋八度**（如 `C4`）。
- 由設計本質，每個 E2–C6 的音在 20 格內至少有一處同音高把位，所以實心亮點不會出現「找不到」的狀態。

---

## 版面

```
┌───────────────────────────────────────────┐
│  header：fret notes   [從吉他][從鋼琴]  🌙 │
├───────────────────────────────────────────┤
│  GuitarNeck（橫向，6×20，向右捲動）        │
├───────────────────────────────────────────┤
│  控制列：[隱藏非同八度亮點]  3/6  [清除]   │
├───────────────────────────────────────────┤
│  PianoKeyboard（E2–C6，可點擊，自動縮放）  │
└───────────────────────────────────────────┘
```

吉他琴頸在上（輸出），鋼琴在下（輸入）。窄螢幕兩者都橫向捲動。

---

## 視覺設計

- **音色調色盤：** 6 種視覺上可區分、支援亮／暗主題的顏色，定義為 CSS 變數（`--note-color-0` … `--note-color-5`）並各有亮／暗值。淡色亮點沿用同色、降低不透明度（約 35%）。
- 遵循現有的 token 系統（`variables.css`）與 Fretboard／PianoKeyboard／ChordResult 已採用的「每元件一個 SCSS 模組」模式。
- 導覽分頁沿用現有 header 樣式；用 `NuxtLink` active class 標示目前分頁。

---

## 測試

核心（`neck.ts`）純單元測試：
- `findExactPositions(40)`（E2）→ 只有 `[{0,0}]`（低音 E 空弦）——低邊界。
- `findExactPositions(84)`（C6）→ 只有 `[{5,20}]`（高音 E 弦第 20 格）——高邊界。
- `findExactPositions(60)`（C4）→ 跨字串 0–4 的五個預期把位。
- `findPitchClassPositions(0)`（C）→ 含 20 格內每個 C、排除非 C。

Composable（`usePianoNoteMap`）：
- 選 6 個音配到顏色 0–5；第 7 個不同音是 no-op。
- 移除中間某音會釋放其顏色；下一個加入的音重用最小的空索引。
- `showOffOctave` 切換 `litPositions` 中淡色把位的有無。

元件層級行為（可互動的 PianoKeyboard、GuitarNeck 渲染）於實作後在瀏覽器預覽驗證。

---

## 動到的檔案

| 檔案 | 變更 |
|------|------|
| `app/app.vue` | 改為 layout 外殼（header ＋ 導覽分頁 ＋ `<NuxtPage />`） |
| `app/pages/index.vue` | 新增——轉址到 `/guitar-to-piano` |
| `app/pages/guitar-to-piano.vue` | 新增——現有功能搬到這裡 |
| `app/pages/piano-to-guitar.vue` | 新增——本功能 |
| `app/components/GuitarNeck/index.vue` | 新增——橫向 6×20 琴頸 |
| `app/components/PianoKeyboard/index.vue` | 改造——選用 `interactive` / `fixedRange` / `activeColorMap` props ＋ `toggle` emit |
| `app/composables/usePianoNoteMap.ts` | 新增——選取音、顏色、亮點 |
| `core/music-theory/neck.ts` | 新增——`findExactPositions`、`findPitchClassPositions` |
| `app/assets/styles/variables.css` | 新增 6 個音色調色盤 token（亮／暗） |
| `app/assets/styles/guitarNeck.scss` | 新增——琴頸樣式 |
| `tests/music-theory/neck.test.ts` | 新增——核心把位測試 |
