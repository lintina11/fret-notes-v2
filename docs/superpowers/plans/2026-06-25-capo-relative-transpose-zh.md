# Capo 相對移調 實作計劃

> **給 agentic worker：** 必要子技能：用 superpowers:subagent-driven-development（推薦）或 superpowers:executing-plans 逐 task 執行。步驟用 checkbox（`- [ ]`）追蹤。

**目標：** 把 capo 從固定屏障（清除其下方的音）改成相對移調：capo 與按壓指型一起移動，升降 capo 把整個指型平移相同格數、只改變 key。

**架構：** 在 `core/music-theory/fretboard.ts` 新增純函式 `transposePressedFrets`，把所有按壓格平移 delta（被推出指板的丟棄）。composable 的 `setCapo` 改成呼叫它、而非清除音。Fretboard 加一個對 `capoFret` 的 `watch`，依相同 delta 平移顯示視窗（`startFret`），讓指型留在畫面上。和弦識別、雙重命名、capo bar、變暗皆不變。

**技術棧：** Nuxt 4、Vue 3、TypeScript、Vitest。

## 全域約束

- Nuxt 4（srcDir `app/`；`~`→app、`~~`→repo root）；`core/` 與 `tests/` 在 repo 根目錄；app 透過 `~~/core/…` 引用 core；測試以相對路徑引用 core。
- TypeScript strict 含 `noUncheckedIndexedAccess` — 以 `npx nuxi typecheck`（0 錯誤）驗證。Vitest（node）不會複製此檢查；composable/元件 task 要跑 `nuxi typecheck`。
- 不使用外部樂理函式庫。
- Capo 範圍 0–7；指板最高格 `MAX_FRET = 12`；視窗 `DISPLAY_FRETS = 5`、`MAX_START_FRET = 8`。
- 所有顏色用 CSS 變數；不可硬編色碼（此變更無新樣式）。
- 既有測試 46 個，全程須維持通過。
- 行為變更是刻意的：`setCapo` 不可再清除 capo 格或以下的音；必須平移它們。

---

## 檔案地圖

```
core/music-theory/fretboard.ts        # 修改 — 新增 MAX_FRET + transposePressedFrets
tests/music-theory/fretboard.test.ts  # 修改 — 新增 transposePressedFrets 測試
app/composables/useFretboard.ts       # 修改 — 改寫 setCapo 為平移而非清除
app/components/Fretboard/index.vue     # 修改 — 加 capoFret watcher 平移 startFret
```

---

## Task 1：core — `transposePressedFrets`

**檔案：**
- 修改：`core/music-theory/fretboard.ts`
- 測試：`tests/music-theory/fretboard.test.ts`

**介面：**
- 產出：
  - `MAX_FRET = 12`（導出常數）
  - `transposePressedFrets(pressedFrets: Map<number, number>, delta: number, maxFret: number): Map<number, number>` — 回傳一個新 Map，每格平移 `delta`；平移後 `< 1` 或 `> maxFret` 的項丟棄；不改動輸入。

- [ ] **Step 1：寫失敗測試**

在 `tests/music-theory/fretboard.test.ts`，先把既有 import 行：

```ts
import { buildSelectedNotes } from '../../core/music-theory/fretboard'
```

擴充為：

```ts
import { buildSelectedNotes, transposePressedFrets, MAX_FRET } from '../../core/music-theory/fretboard'
```

接著在檔案最後附加這個新的 `describe`（保留所有既有測試）：

```ts
describe('transposePressedFrets', () => {
  it('shifts all frets up by delta', () => {
    const input = new Map<number, number>([[1, 3], [2, 5]])
    const result = transposePressedFrets(input, 2, 12)
    expect([...result.entries()].sort()).toEqual([[1, 5], [2, 7]])
  })

  it('shifts all frets down by delta', () => {
    const result = transposePressedFrets(new Map([[1, 5]]), -1, 12)
    expect(result.get(1)).toBe(4)
  })

  it('drops frets pushed above maxFret, keeps those at maxFret', () => {
    const input = new Map<number, number>([[0, 11], [1, 10]])
    const result = transposePressedFrets(input, 2, 12) // 11+2=13 丟棄、10+2=12 保留
    expect(result.has(0)).toBe(false)
    expect(result.get(1)).toBe(12)
  })

  it('returns an empty Map when every fret is pushed off the neck', () => {
    const result = transposePressedFrets(new Map([[1, 12], [2, 11]]), 2, 12)
    expect(result.size).toBe(0)
  })

  it('drops frets shifted below fret 1 (defensive)', () => {
    const result = transposePressedFrets(new Map([[1, 1]]), -1, 12) // 1-1=0 < 1
    expect(result.has(1)).toBe(false)
  })

  it('does not mutate the input Map and returns a new object', () => {
    const input = new Map<number, number>([[1, 3]])
    const result = transposePressedFrets(input, 2, 12)
    expect(input.get(1)).toBe(3)   // 不變
    expect(result).not.toBe(input) // 新物件
  })

  it('exports MAX_FRET = 12', () => {
    expect(MAX_FRET).toBe(12)
  })
})
```

- [ ] **Step 2：跑測試確認失敗**

執行：`npx vitest run tests/music-theory/fretboard.test.ts`
預期：FAIL — `transposePressedFrets`/`MAX_FRET` 尚未導出。

- [ ] **Step 3：在 `core/music-theory/fretboard.ts` 實作**

在檔案上方、`export type NoteMode = 'sounding' | 'shape'` 那行之後加入：

```ts
// 指板實體上限：DISPLAY_FRETS=5、MAX_START_FRET=8 時最低可見格為 12。
export const MAX_FRET = 12
```

在檔案最後（`buildSelectedNotes` 之後）加入：

```ts
// 把每個按壓格平移 delta。平移後超過 maxFret（被推出指板末端）或低於第 1 格
// 的音被丟棄 —— 有損、不記憶。回傳一個新 Map；不改動輸入。
export function transposePressedFrets(
  pressedFrets: Map<number, number>,
  delta: number,
  maxFret: number,
): Map<number, number> {
  const result = new Map<number, number>()
  for (const [stringIndex, fret] of pressedFrets) {
    const next = fret + delta
    if (next >= 1 && next <= maxFret) {
      result.set(stringIndex, next)
    }
  }
  return result
}
```

- [ ] **Step 4：跑測試確認通過**

執行：`npx vitest run tests/music-theory/fretboard.test.ts`
預期：PASS（既有 buildSelectedNotes 測試 + 7 個新 transposePressedFrets 測試）。

- [ ] **Step 5：全套件 + typecheck**

執行：`npm test` → 預期 53 通過（既有 46 + 新 7）。
執行：`npx nuxi typecheck` → 0 錯誤。

- [ ] **Step 6：Commit**

```bash
git add core/music-theory/fretboard.ts tests/music-theory/fretboard.test.ts
git commit -m "feat: transposePressedFrets core helper for relative capo shift"
```

---

## Task 2：composable — 改寫 `setCapo` 為平移

**檔案：**
- 修改：`app/composables/useFretboard.ts`

**介面：**
- 消費：`transposePressedFrets`、`MAX_FRET`（來自 `~~/core/music-theory/fretboard`，Task 1）。
- 產出：`setCapo(fret: number): void` — 簽章不變；行為改變（依 capo delta 平移按壓點，而非清除 ≤ capo 的音）。

**行為：** 舊的 `setCapo` 清除每個 `<= newCapo` 的按壓格。新的 `setCapo` clamp 到 0–7、計算 `delta = next - capoFret`、把所有按壓點平移 `delta`（被推過第 12 格的丟棄）。不會只因為靠近 capo 就清除音。

- [ ] **Step 1：更新 import 行**

在 `app/composables/useFretboard.ts`，目前 import 為：

```ts
import { buildSelectedNotes } from '~~/core/music-theory/fretboard'
```

改為：

```ts
import { buildSelectedNotes, transposePressedFrets, MAX_FRET } from '~~/core/music-theory/fretboard'
```

- [ ] **Step 2：替換 `setCapo` 函式**

把目前整個 `setCapo` 函式：

```ts
function setCapo(fret: number): void {
  const next = Math.min(MAX_CAPO, Math.max(0, fret))
  capoFret.value = next
  // Clear any pressed fret now at or below the capo (invalid positions)
  let changed = false
  for (const s of [...pressedFrets.value.keys()]) {
    const f = pressedFrets.value.get(s)!
    if (f <= next) {
      pressedFrets.value.delete(s)
      changed = true
    }
  }
  if (changed) pressedFrets.value = new Map(pressedFrets.value)
}
```

替換為：

```ts
function setCapo(fret: number): void {
  const next = Math.min(MAX_CAPO, Math.max(0, fret))
  const delta = next - capoFret.value
  if (delta === 0) return
  capoFret.value = next
  // capo 與指型一起移動：把每個按壓點平移相同 delta。
  // 被推過最後一格的音丟棄（有損）。
  pressedFrets.value = transposePressedFrets(pressedFrets.value, delta, MAX_FRET)
}
```

（`MAX_CAPO = 7` 已定義在此檔；`clearAll`、computeds、exports 皆不變。）

- [ ] **Step 3：typecheck**

執行：`npx nuxi typecheck`
預期：0 錯誤。

- [ ] **Step 4：全套件 + dev smoke**

執行：`npm test` → 預期 53 通過（不變 — composable 無單元測試；平移邏輯由 Task 1 涵蓋）。
啟動 `npm run dev`、待就緒、`curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/` → 200，然後停止 dev。

- [ ] **Step 5：Commit**

```bash
git add app/composables/useFretboard.ts
git commit -m "feat: setCapo transposes the shape relative to the capo instead of clearing notes"
```

---

## Task 3：Fretboard — 視窗跟隨 capo

**檔案：**
- 修改：`app/components/Fretboard/index.vue`

**介面：**
- 消費：`capoFret`（已從 `useFretboard()` 解構）、`startFret`（區域 ref）、`MAX_START_FRET`（區域常數 = 8）。

**行為：** `capoFret` 改變時，把 `startFret` 平移相同 delta（夾 1–8），使 capo bar 與指型維持在螢幕同位置。沒手動捲動時自然維持 `startFret = capoFret + 1`（capo 0 → 1–5 格、capo 1 → 2–6……）。Position ▲▼ 仍可獨立捲動；capo 變化時視窗隨指型移動，使高把位指法留在畫面上。

- [ ] **Step 1：在 Vue import 加入 `watch`**

在 `app/components/Fretboard/index.vue`，把：

```ts
import { ref, computed } from 'vue'
```

改為：

```ts
import { ref, computed, watch } from 'vue'
```

- [ ] **Step 2：加入 capo watcher**

在 `<script setup>` 裡、`displayFretNums` computed 定義之後：

```ts
const displayFretNums = computed<number[]>(() =>
  Array.from({ length: DISPLAY_FRETS }, (_, i) => startFret.value + i)
)
```

加入：

```ts
// 視窗跟隨 capo：把視窗平移與 capo 相同的 delta，使 capo bar 與指型維持在
// 螢幕同位置。沒手動 Position 捲動時，這會維持 startFret = capoFret + 1。
watch(capoFret, (newCapo, oldCapo) => {
  const delta = newCapo - oldCapo
  startFret.value = Math.min(MAX_START_FRET, Math.max(1, startFret.value + delta))
})
```

註：`handleClear` 已經是先呼叫 `clearAll()` 再設 `startFret.value = 1`。當 `clearAll` 把 `capoFret` reset 為 0 時 watcher 會觸發，但 `handleClear` 之後的 `startFret = 1` 會蓋過它——所以清除按鈕仍回到開放把位。不要改 `handleClear`。

- [ ] **Step 3：typecheck + dev 驗證**

執行：`npx nuxi typecheck` → 0 錯誤。
啟動 `npm run dev`、待就緒、`curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/` → 200，然後停止 dev。
執行：`npm test` → 53 通過（不變）。

- [ ] **Step 4：Commit**

```bash
git add app/components/Fretboard/index.vue
git commit -m "feat: fretboard window follows the capo so the shape stays on screen"
```

---

## Task 4：端對端驗證

**檔案：** 無（僅驗證）。

- [ ] **Step 1：全套件**

執行：`npm test`
預期：53 通過（既有 46 + 新 7 個平移測試）。

- [ ] **Step 2：typecheck**

執行：`npx nuxi typecheck`
預期：0 錯誤。

- [ ] **Step 3：production build**

執行：`npm run generate`
預期：無錯誤完成；輸出在 `.output/public`。

- [ ] **Step 4：預覽 smoke test**

serve 產出（`npx serve .output/public`），確認 HTTP 200 且頁面含 `capo-row` 與 `fret notes`，然後停止預覽 server。

- [ ] **Step 5：不需 commit**（僅驗證；`.output` 已 gitignore）。
