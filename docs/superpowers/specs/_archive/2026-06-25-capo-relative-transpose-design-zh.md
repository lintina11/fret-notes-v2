# Capo 相對移調邏輯 — 設計文件
日期：2026-06-25

## 專案概述

改變 capo 與按壓指型的互動方式。現行邏輯中 capo 是固定的「屏障」：升 capo 時會**清除**落在新 capo 格或以下的按壓點，破壞掉部分指型。這份 spec 把 capo 改成**相對移調**：capo 與指型一起移動，所以升降 capo 會把整個指型平移相同的格數。從演奏者角度看，指型（與其在螢幕上的位置）維持不動，改變的只有 key。

**範例：** 在 capo 0 按一個 C 指型，接著設 capo 1。每個按壓點隨 capo 一起上移一格；指型仍是「C 指型」、但現在發聲為 C#。指型不會被清除。

這是對既有 capo 功能（已上線於 `main`）的行為調整。它**不會**改動 sounding/shape 的和弦識別模型、雙重命名顯示、capo bar、或變暗邏輯——只要按壓點與 capo 一起平移，那些自然就跟著對。

---

## 現有架構（不變的部分）

- `core/music-theory/fretboard.ts` — `buildSelectedNotes(pressedFrets, mutedStrings, capoFret, mode)` 建構 `'sounding'` 或 `'shape'` 的音集。**不變。**
- `app/composables/useFretboard.ts` — singleton 狀態 `pressedFrets: Map<number, number>`（弦 index → 絕對格數）、`mutedStrings`、`capoFret`（0–7）；計算 `detectedChord`（sounding）與 `shapeChord`（shape）。只有 `setCapo` 改變。
- `app/components/Fretboard/index.vue` — SVG 指型圖，5 格視窗（`startFret` 1–8、`DISPLAY_FRETS = 5`、`MAX_START_FRET = 8`）、capo 步進器、capo bar、變暗 capo 以下格子、Position ▲▼ 捲動。新增一個 capo watcher。
- `app/components/ChordResult/index.vue` — sounding 名 + shape 副標。**不變。**

因為 `detectedChord`（sounding）與 `shapeChord`（shape）都是 `pressedFrets` + `capoFret` 的純函式，把兩者同步平移相同 delta，就會讓 sounding 和弦移調該 delta、而 shape 名維持不變——自動成立，不需改動識別邏輯。

---

## 變更內容

### 1. `core/music-theory/fretboard.ts` — 新增純函式

```ts
// 把每個按壓格平移 delta。平移後超過 maxFret（被推出指板末端）的音被丟棄
// —— 有損、不記憶。平移後低於第 1 格的音也丟棄（防禦性；正常 capo 操作不應發生）。
// 回傳一個新的 Map；不改動傳入的 Map。
export function transposePressedFrets(
  pressedFrets: Map<number, number>,
  delta: number,
  maxFret: number,
): Map<number, number>
```

邏輯：對每個 `[stringIndex, fret]`，計算 `next = fret + delta`；只有當 `1 <= next <= maxFret` 時保留；把存活的音收進一個新的 `Map`。

`maxFret` 是指板的實體上限 **12**（`DISPLAY_FRETS = 5`、`MAX_START_FRET = 8`，視窗最低底端為第 12 格）。在此模組導出一個 `MAX_FRET = 12` 常數供重用。

### 2. `app/composables/useFretboard.ts` — 改寫 `setCapo`

把現行的「clamp，然後清除 `<= newCapo` 的按壓點」改成相對移調：

```ts
function setCapo(fret: number): void {
  const next = Math.min(MAX_CAPO, Math.max(0, fret))   // clamp 0–7
  const delta = next - capoFret.value
  if (delta === 0) return
  capoFret.value = next
  pressedFrets.value = transposePressedFrets(pressedFrets.value, delta, MAX_FRET)
}
```

- 升 capo → 所有按壓點 +delta（指型上移、發聲 key 升高）
- 降 capo → 所有按壓點 −delta（指型下移、發聲 key 降低）
- 被推過第 12 格的音由 `transposePressedFrets` 丟棄
- `detectedChord`、`shapeChord`、`clearAll`（reset capo 為 0）、`toggleFret`、`toggleMute` 全部不變

### 3. `app/components/Fretboard/index.vue` — 視窗跟隨 capo

新增一個 watcher，讓顯示視窗隨 capo 平移，使 capo bar 與指型維持在螢幕同一位置：

```ts
watch(capoFret, (newCapo, oldCapo) => {
  const delta = newCapo - oldCapo
  startFret.value = Math.min(MAX_START_FRET, Math.max(1, startFret.value + delta))
})
```

- 在沒有手動捲動的情況下，視窗自然維持在 `startFret = capoFret + 1`（capo 0 → 1–5 格、capo 1 → 2–6 格、capo 2 → 3–7 格……）——這就是想要的預設視窗。
- Position ▲▼ 仍可獨立捲動，所以演奏者可以按高把位指型（例如 capo 夾第 2 格、同時按 fret 8–10）；capo 改變時視窗隨指型平移，使其留在畫面上。
- 元件其餘部分（capo 步進器、capo bar、變暗/停用 capo 以下格子、按壓須在 capo 之上的限制、`navigate()`）皆不變。

---

## 行為與邊界

1. **有損移調：** 被推過第 12 格的音被丟棄，**不會**在之後降 capo 時被記憶或復原。
2. **視窗夾限：** `startFret` 夾在 1–8。若視窗已捲到底（`startFret = 8`）而 capo 再升，跟隨會有一格的不完美（指型在螢幕上位移一列）。少見邊角、可接受。
3. **清除按鈕：** `clearAll` 把 capo 設為 0；`handleClear` 接著（在 `clearAll` 之後）顯式設 `startFret = 1`，所以最終視窗一定回到開放把位，不受 watcher 的瞬間位移影響。
4. **Position 捲動：** 手動 Position ▲▼ 仍會清除捲出可見視窗的按壓點（既有行為、不變）。
5. **下界：** 按壓點永遠在 capo 之上；降 capo 時它們同步下移、但仍 ≥ 1，所以 `transposePressedFrets` 的下界丟棄只是防禦性的。

---

## 測試

**單元（`tests/music-theory/fretboard.test.ts`，擴充）：** `transposePressedFrets`
- 上移：`{1:3, 2:5}` delta +2 → `{1:5, 2:7}`
- 下移：`{1:5}` delta −1 → `{1:4}`
- 超過 maxFret 丟棄：`{0:11, 1:10}` delta +2、maxFret 12 → `{1:12}`（11+2=13 丟棄、10+2=12 保留）
- 全部被推出：所有音 > maxFret → 空 Map
- 防禦性下界丟棄：某音 `fret + delta < 1` → 丟棄
- 不改動傳入的 Map（回傳的是新物件）

**不變：** 既有 6 個 `buildSelectedNotes` 測試與所有 `detectChord` 測試維持通過（邏輯未動）。

**Build gate：** `npx nuxi typecheck` 0 錯誤；`npm test` 全過；`npm run generate` 成功；預覽 HTTP 200。

---

## 不在範圍內

- sounding/shape 識別模型、雙重命名顯示、capo bar 視覺、變暗、capo 範圍（0–7）皆不變。
- 八度精準的鋼琴 voicing 與反向查詢仍延後（未來獨立 spec）。

---

## 約束

- Nuxt 4（srcDir `app/`；`~`→app、`~~`→repo root）；`core/` 與 `tests/` 在 repo 根目錄；app 透過 `~~/core/…` 引用 core；測試以相對路徑引用 core。
- TypeScript strict 含 `noUncheckedIndexedAccess`；以 `npx nuxi typecheck` 驗證。
- 不使用外部樂理函式庫。
- 所有顏色用 CSS 變數；不可硬編色碼（此變更預期無新樣式）。
- Capo 範圍 0–7；指板最高第 12 格。
