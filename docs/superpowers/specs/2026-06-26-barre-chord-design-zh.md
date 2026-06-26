# 封閉指型（Barre Chord）— 設計文件
日期：2026-06-26

## 概述

在現有的吉他指板工具上，把**封閉指型（barre）**做成第一級的輸入機制。封閉指型是一根手指橫按多條弦在同一格；被橫按蓋住、又沒有更高按壓的弦，就發聲在橫按那一格。這讓使用者能像按 F 大三和弦那樣（第 1 格全橫按 + 上方幾根手指）快速輸入，不用逐弦點。

這建立在已上線的 capo 功能上——capo 已經會畫一條橫跨全弦、當作 nut 的 bar。封閉指型沿用同一套架構，但它是「可移動、可部分、會在自己那一格發聲」的手指，而非當作 nut。

**選定方案：** composable 新增獨立的 `barre` 狀態 + core 的純函式 `buildSelectedNotes` 擴充。封閉指型保持為可分離、可測試、與「個別按壓」及「capo」都不同的獨立概念。

---

## 目前架構（背景）

- 狀態（`app/composables/useFretboard.ts`）：`pressedFrets: Map<弦, 絕對格>`（每弦一格）、`mutedStrings: Set`、`capoFret: 0–7`。
- Core（`core/music-theory/fretboard.ts`）：`buildSelectedNotes(pressedFrets, mutedStrings, capoFret, mode)` 產生 `'sounding'`（capo 視為移調）或 `'shape'`（capo 視為 nut）的音；`transposePressedFrets` 在 capo 移動時平移按壓。
- 指板（`app/components/Fretboard/index.vue`）：SVG 和弦圖，5 格視窗在 12 格指板上捲動（`MAX_FRET = 12`）、capo bar（accent 色、全幅）+ capo 以下 dimmed、逐弦按壓點、nut 上方的空弦/靜音標記。
- 弦索引：0 = 最粗的低音 E（螢幕最左）… 5 = 最細的高音 E（最右）。`OPEN_STRINGS = [40,45,50,55,59,64]`。吉他「第 1 弦」= 高音 E = 索引 5。

---

## 發聲優先序（閉合規則）

每條弦的發聲音，由第一個成立的規則決定：

1. **靜音** → 該弦完全排除。
2. **較高的明確按壓**（嚴格高於橫按格的按壓）→ 發聲在該按壓格。
3. **被橫按蓋住**（且無更高按壓）→ 發聲在橫按格。
4. **capo**（未被橫按蓋住、未按壓）→ 發聲在 capo 格。
5. **空弦** → 發聲在 0 格。

衍生規則（是上面規則的必然結果，不是新功能）：

- 被橫按蓋住的弦，橫按格**以下**不可能發聲（手指已壓住）。那些格 dimmed 且不可點（比照 capo）。
- 放下或延長橫按時，**清除**被蓋住弦上「低於等於橫按格」的既有按壓（橫按後方物理上不可能）。
- 被橫按蓋住、又無更高按壓的弦，視覺上讀作「被橫按」而非「空弦」：隱藏 nut 上方的空弦圈。

---

## Section 1 — 狀態與 core 邏輯

### Composable 狀態（`app/composables/useFretboard.ts`）

```ts
const barreFret  = ref<number | null>(null)  // 橫按所在格；null = 沒有橫按
const barreLength = ref(6)                    // 2–6，預設 6；錨定最細弦
```

被蓋住的弦 = 索引 `[STRING_COUNT - barreLength .. STRING_COUNT - 1]`，其中 `STRING_COUNT = 6`。所以長度 6 → 弦 0–5（全部）；5 → 1–5；4 → 2–5；3 → 3–5；2 → 4–5。最細的弦（索引 5、第 1 弦）一定包含。

### Actions

- `toggleBarre(fret)`：若 `barreFret === fret` 則收回（`barreFret = null`）；否則設 `barreFret = fret` 並清除被蓋住弦上低於等於 `fret` 的按壓。`fret` 一定 `> capoFret`（toggle 在 capo 與以下禁用）。
- `setBarreLength(len)`：設 `barreLength = len`；若橫按存在，清除新被蓋住弦上低於等於 `barreFret` 的按壓。
- `setCapo(fret)`（擴充既有）：capo 移動 `delta` 時，`barreFret` 也平移 `delta`。若平移後落在 `[1, MAX_FRET]` 之外則丟棄（`barreFret = null`）——lossy，比照按壓行為。
- `clearAll`（擴充）：另外重置 `barreFret = null`、`barreLength = 6`。

### Core 純函式（`core/music-theory/fretboard.ts`）

- `barreCoveredStrings(length: number): number[]` — 回傳被蓋住的弦索引。
- `buildSelectedNotes(pressedFrets, mutedStrings, capoFret, mode, barre?)` — 加一個可選參數 `barre: { fret: number; length: number } | null`，並把函式主體改寫成**逐弦掃描**（弦 0→5），套用上面的發聲優先序。對被橫按蓋住、未按壓的弦：sounding 音 = `OPEN_STRINGS[s] + barre.fret`；shape 音 = `OPEN_STRINGS[s] + (barre.fret - capoFret)`。
- `dropPressesAtOrBelow(pressedFrets, coveredStrings, fret): Map<number, number>` — 回傳清除被蓋住弦上 `<= fret` 按壓後的新 Map。用於放橫按 / 改長度。

> 註：目前 `buildSelectedNotes` 先掃按壓弦、再掃空弦。和弦識別用最低 MIDI 找 bass、不看陣列順序，所以改成逐弦一次掃描不影響識別結果。

---

## Section 2 — 指板 UI（`app/components/Fretboard/index.vue`）

### 封閉 toggle 欄（每列一個）

- 指板右側（索引 5 弦的右邊）新增一欄，SVG 加寬約 50px 容納。
- 每個顯示中的格列，顯示文字 **「封閉」**（無底色純文字）+ 旁邊一個狀態圓點：
  - 圓點**關閉**：淡灰（`--color-text-muted` / `--color-border`）。
  - 圓點**開啟**（`barreFret === 該列的格`）：點亮 `--color-primary`。
  - **禁用**：`fretNum <= capoFret`（不能在 capo 與以下橫按）→ 隱藏 / 變灰且不可點。
- 點該列 toggle → `toggleBarre(絕對格)`。

### 橫按 bar 本體

- 當 `barreFret` 在目前 5 格視窗內時，畫一條圓角矩形：從 `sx(startString)` 到 `sx(5)`，`startString = STRING_COUNT - barreLength`，在橫按列中央，填 `--color-primary`。
- 顏色語言：**barre = `--color-primary`**、**capo = `--color-accent`**（capo bar 不變）。兩個功能、兩種色。
- 捲動到視窗外不畫（同按壓點）。
- **bar 上的音名：** 每條真正「透過橫按發聲」的被蓋住弦（被蓋住、未靜音、無更高按壓），在 bar 上該弦位置顯示其音名（`OPEN_STRINGS[s] + barreFret`）。字級比按壓點標示**小一點**（這些字小沒關係）。被蓋住但有更高按壓的弦，音名顯示在它自己的按壓點上、bar 在該處不放字；被靜音的被蓋住弦不放字。

### 被蓋住弦的視覺

- 被橫按蓋住、未按壓的弦：隱藏 nut 上方的空弦圈。
- 被蓋住弦上，`fretNum < barreFret`（且在 capo 之上）的格 dimmed 且不可點。橫按格以上的格仍可點（加更高的手指）。未被蓋住的弦不受影響（除既有 capo 行為外）。
- 被蓋住、又有更高按壓的弦，照常顯示其按壓點。

### 橫按長度 select

- 在 nav / capo 控制區加一個 `<select>`：選項 6 / 5 / 4 / 3 / 2，label「Barre」，綁 `barreLength`（呼叫 `setBarreLength`）。沒有橫按時仍可見可改（值套用到下次建立的橫按）。

---

## Section 3 — 測試

### Core 單元測試（`tests/music-theory/`）

- `buildSelectedNotes` 加 barre：
  - 全橫按 F 指型（第 1 格橫按 + 上方按壓）→ sounding 音正確。
  - 部分橫按（長度 5、4，錨定最細弦）→ 被蓋住弦正確。
  - barre + capo 的 `'shape'` 模式（被蓋住弦音 = `barre.fret - capoFret`）。
  - 被蓋住弦被靜音 → 排除（靜音優先）。
  - 被蓋住弦有更高按壓 → 發聲在按壓格，而非橫按。
- `barreCoveredStrings(length)` → 索引正確（6→0–5、5→1–5、4→2–5、3→3–5、2→4–5）。
- `dropPressesAtOrBelow` → 清除被蓋住弦上 `<= fret` 的按壓、保留其他。
- capo 平移 barre：橫按被推出 `MAX_FRET`（或低於第 1 格）→ 丟棄。

### 元件層

- `npx nuxi typecheck` 0 錯誤 + `npm run dev` build 回 HTTP 200（smoke check），沿用前面 task 的做法。互動細節靠手動 / 截圖驗證。

---

## 範疇

### 包含
- 同時只有一條橫按（全板一條，點別格 toggle 即取代）。
- 長度 2–6，錨定最細弦。
- 與 capo、按壓、靜音、捲動、和弦識別（sounding + shape）完整整合。

### 不包含（YAGNI）
- 多條同時橫按 / 次要部分橫按。
- 錨定低音側（蓋住最粗弦而非最細弦）的橫按。
- 從手動輸入的指型自動偵測 / 建議橫按。
- 橫按上的指法編號標示。
