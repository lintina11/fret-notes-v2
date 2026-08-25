# 指型圖指板重新設計

**日期：** 2026-06-22  
**範圍：** 僅 `app/components/Fretboard/index.vue`  
**不異動：** `useFretboard.ts`、`ChordResult`、`PianoKeyboard`、`app.vue`

---

## 目標

將現有的全格棋盤式佈局（12格大棋盤）改為 SVG 繪製的標準吉他指型圖風格：6 條垂直弦線與 5 條水平格線交叉，格子呈縱向長方形，按壓點放置於線的交叉點上。

---

## SVG 版面常數

| 常數 | 值 | 說明 |
|---|---|---|
| DISPLAY_FRETS | 5 | 可視格數 |
| STRING_GAP | 28px | 弦線間的橫向距離 |
| FRET_GAP | 38px | 格線間的縱向距離（高於橫向，確保格子為縱向長方形） |
| LEFT_PAD | 28px | 左側空間，用於顯示「Nfr」格位標籤 |
| RIGHT_PAD | 16px | 右側留白 |
| TOP_PAD | 50px | 上方空間，顯示開放弦/靜音標記 |
| BOTTOM_PAD | 22px | 最後一條格線下方留白 |
| NUT_THICKNESS | 5px | 第 1 格時繪製的粗琴枕橫條厚度 |
| DOT_RADIUS | 13px | 按壓點圓半徑 |
| OPEN_RADIUS | 7px | 開放弦圓圈半徑 |
| SVG_W | 184px | LEFT_PAD + 5×STRING_GAP + RIGHT_PAD |
| SVG_H | 262px | TOP_PAD + 5×FRET_GAP + BOTTOM_PAD |

弦線 x 座標：`sx(s) = LEFT_PAD + s × STRING_GAP` → 28、56、84、112、140、168  
格位頂端 y 座標：`fy(fi) = TOP_PAD + fi × FRET_GAP`  
按壓點圓心 y：`fy(fi) + FRET_GAP / 2`

---

## SVG 繪製層次（由底部往上疊加）

### 第 1 層：點擊目標
- 30 個透明 `<rect>`（6 條弦 × 5 個格位）
- 位置：`x = sx(s) - STRING_GAP/2`、`y = fy(fi)`、`width = STRING_GAP`、`height = FRET_GAP`
- 點擊時呼叫 `toggleFret(s, displayFretNums[fi])`
- 滑鼠樣式：pointer

### 第 2 層：格線
- 6 條垂直弦線：從 `fy(0)` 到 `fy(DISPLAY_FRETS)`，線寬 1.5px，顏色 `color-border`
- 6 條水平格線：位於 `fy(0)` 至 `fy(DISPLAY_FRETS)`，橫跨 `sx(0)` 到 `sx(5)`，線寬 1px，顏色 `color-border`

### 第 3 層：琴枕 / 格位標籤
- **`startFret === 1` 時：** 在 `fy(0)` 正上方繪製高度 5px 的填色矩形，橫跨 `sx(0)` 至 `sx(5)`，填色 `color-text`（代表琴枕）
- **`startFret > 1` 時：** 在 `x = sx(0) - 6`、`y = fy(0) + FRET_GAP/2` 靠右顯示「Nfr」文字，10px，顏色 `color-text-muted`

### 第 4 層：把位標記點
- 小圓點（r=4），水平置中於 `(sx(0) + sx(5)) / 2`
- 出現在第 3、5、7、9、12 格（若在可視視窗內）
- 圓心 y：`fy(fi) + FRET_GAP / 2`
- 填色：`color-border`

### 第 5 層：按壓音符點
- 針對每條 `pressedFrets.get(s)` 落在可視範圍內的弦：
  - 圓形：`cx = sx(s)`、`cy = fy(fi) + FRET_GAP/2`、`r = DOT_RADIUS`、填色 `color-primary`
  - 文字：音名，置中於圓點，10px 粗體，填色 `color-on-primary`

### 第 6 層：開放弦 / 靜音標記
- 位置：在琴枕上方 `TOP_PAD - 14`，各弦 x 軸中心
- **靜音弦：** `×` 文字，14px，顏色 `color-text-muted`
- **開放弦（未按壓且未靜音）：** 空心圓，`r = OPEN_RADIUS`，描邊 `color-primary`，無填色
- **已按壓弦：** 不顯示標記（點在格線上）
- 點擊任一標記：呼叫 `toggleMute(s)` 切換靜音

---

## 翻頁導航

- SVG 下方顯示控制列：`[▲]  Nfr  [▼]`
- `startFret` 為元件本地的 `ref<number>`，初始值為 `1`
- `▲` 遞增 `startFret`（上限：12 − DISPLAY_FRETS + 1 = 8）
- `▼` 遞減 `startFret`（下限：1）
- **切換格位視窗時：** 遍歷所有已按壓弦，對任何格位落在 `[startFret, startFret + DISPLAY_FRETS − 1]` 以外的弦呼叫 `toggleFret(s, fret)` 清除（等同放開手指）
- 標籤文字：非第 1 格時顯示「Nfr」（例如「5fr」），第 1 格時顯示「Open」

---

## 狀態互動

- `pressedFrets` 與 `mutedStrings` 來自 `useFretboard()`，不異動
- `startFret` 為元件本地狀態，不持久化
- 按壓格子：呼叫 `toggleFret(s, 絕對格號)`；若該弦已靜音，`toggleFret` 會自動取消靜音
- 點擊靜音/開放標記：呼叫 `toggleMute(s)`
- 清除按鈕：呼叫 composable 的 `clearAll()`，並將 `startFret` 重設為 1

---

## 主題配色

所有顏色透過 CSS 自訂屬性套用：
- `--color-border`、`--color-text`、`--color-text-muted`
- `--color-primary`、`--color-on-primary`
- `--color-surface`（SVG 背景，選用）

---

## 異動檔案

| 檔案 | 異動內容 |
|---|---|
| `app/components/Fretboard/index.vue` | 完整改寫 template、script、style |

不異動其他任何檔案。
