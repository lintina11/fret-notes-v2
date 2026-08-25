# Fret Notes — 統整設計主參照

**狀態：** 權威設計參照。將 **2026-06-18 → 2026-08-19** 之間的各功能規格書統整為單一文件，凡有重複討論或決策異動者一律採用**較新**決策，並屏除已廢棄的做法。

**閱讀方式：** 本檔為已定案設計的唯一真實來源。被它取代的原始 dated 規格已封存於 `docs/superpowers/specs/_archive/`（Claude 忽略）僅供歷史查閱。有一份規格獨立於本檔之外仍為現行 —— 見 [音訊播放](#8-音訊播放)。

**決策取代對照（誰勝出）：**

| 主題 | 被取代於 | 勝出決策 |
|---|---|---|
| 指板佈局（`06-18`） | `06-22` | SVG 和弦圖，而非 12 格棋盤 |
| Capo 升降（`06-24`） | `06-25` | 相對移調（指型隨 capo 移動），而非清除按壓 |
| Note-map 佈局 + `showOffOctave`（`07-14`） | `07-15` | 鋼琴在上 + 和弦提示；非同八度預設隱藏 |
| 音訊引擎（`08-19` 合成） | `08-20`（獨立、待實作） | Tone.Sampler 取樣音色 |

---

## 1. 總覽

跨樂器和弦參照網頁工具，吉他優先，並附第二頁鋼琴→吉他 note map。兩個方向、兩個頁面、狀態互相獨立：

- **從吉他（guitar → piano）** — 操作虛擬指板即時辨識和弦；結果以和弦名、音程、組成音與鋼琴視覺化呈現。
- **從鋼琴（piano → guitar）** — 在鋼琴上點單音（最多 6 個），整個 20 格指板亮出所有能發出這些音的位置，並附和弦提示。

**主要對象：** 具備初～中級樂理的吉他手。
**主要裝置：** iPad（觸控優化），並響應式支援手機與桌面。

---

## 2. 技術棧與限制

- **框架：** Nuxt 4（Vue 3 + TypeScript），靜態部署（`nuxt generate`）。`srcDir` = `app/`；`~` → `app`，`~~` → repo root。`core/` 與 `tests/` 位於 repo root；app 以 `~~/core/…` 匯入 core，測試以相對路徑匯入。
- **樣式：** 以 CSS 自訂屬性做 light/dark 主題；每個元件一個 SCSS module（`variables.css` token 系統）。**不寫死 hex** —— 全部走 token。
- **TypeScript：** strict，含 `noUncheckedIndexedAccess`（可證明在界內的索引存取用 `!`；以 `npx nuxi typecheck` 驗證）。
- **不使用任何外部樂理函式庫。** 所有樂理皆為 `core/` 內的純 TS。
- **觸控目標：** 每個互動元素 ≥ 44px。
- **未來（不在此範圍）：** Supabase 帳號 / 自訂指型儲存。

---

## 3. 架構

純邏輯放 `core/`（Node 可測、無 DOM）；反應式接線與副作用放 `app/composables/`；呈現放 `app/components/` 與 `app/pages/`。

```
core/
├── music-theory/
│   ├── notes.ts          # 12 音 pitch class、音名、等音、midiToPitchClass
│   ├── intervals.ts      # pitch class 間的音程運算
│   ├── chord-rules.ts    # 音程集合 → 和弦名定義
│   ├── chord-detector.ts # detectChord(notes) → ChordResult | null
│   ├── fretboard.ts       # buildSelectedNotes、transposePressedFrets、barre 輔助
│   └── neck.ts            # findExactPositions / findPitchClassPositions（20 格）
└── audio/                 # 見 §8（目前 synth.ts + instruments.ts）

app/
├── app.vue               # 佈局外殼：header（標題、分頁、主題 + 聲音開關）+ <NuxtPage/>
├── pages/
│   ├── index.vue             # 轉址 → /guitar-to-piano
│   ├── guitar-to-piano.vue    # 指板工具
│   └── piano-to-guitar.vue    # note-map 工具
├── components/
│   ├── Fretboard/index.vue     # SVG 和弦圖（吉他頁輸入）
│   ├── ChordResult/index.vue   # 共用結果卡（兩頁共用）
│   ├── PianoKeyboard/index.vue # 共用鋼琴（唯讀或互動）
│   └── GuitarNeck/index.vue    # 橫向 6×20 指板（note-map 輸出）
└── composables/
    ├── useFretboard.ts     # 吉他頁狀態（singleton）
    ├── usePianoNoteMap.ts  # note-map 狀態（singleton）
    └── useAudio.ts         # 播放副作用（singleton）
```

**弦索引（共用慣例）：** index `0` = 低音 E（最粗，依視圖畫在最左／最下）… index `5` = 高音 E（最細）。吉他「第 1 弦」= 高音 E = index 5。`OPEN_STRINGS = [40,45,50,55,59,64]`（E2 A2 D3 G3 B3 E4）。

---

## 4. 樂理層

### 支援和弦類型（Phase 1 集）

| 類別 | 類型 |
|----------|-------|
| 三和弦 | 大、小、減、增 |
| 七和弦 | maj7、m7、7（屬）、m7b5 |
| 掛留 | sus2、sus4 |
| 加音 | add9、6、m6 |

### 辨識 —— 音程集合比對（非查名表）

1. 從選取音收集不重複 pitch class（0–11，忽略八度）。
2. 對每個候選根音，計算相對其的音程集合。
3. 與音程規則定義比對（如 `[0,3,7]` = 小三和弦）。
4. 排序；最佳 1 個為主，最多 2 個候補。

- **分數和弦：** 若最低音非根音 → `Am/E`。低音以最低 MIDI 決定，非陣列順序。
- **無法辨識集合：** 顯示組成音（「音集」檢視），不硬套名稱。
- **不重複 pitch class < 2：** 回 `null` → 空狀態。

### `detectChord` 簽名（收窄 —— `07-15`）

`detectChord` 只讀 `.midi` 與 `.pitchClass`，故其參數收窄為恰好這兩個欄位（原為 `SelectedNote[]`）：

```ts
export function detectChord(notes: { midi: number; pitchClass: number }[]): ChordResult | null
```

向後相容：吉他頁較豐富的 `SelectedNote[]` 結構上仍滿足；note-map 頁可傳裸 `{ midi, pitchClass }`，不需捏造 `stringIndex`/`fret`/`noteName`。

---

## 5. 吉他頁（從吉他）

### 5.1 指板 —— SVG 和弦圖（`06-22`，取代 `06-18` 棋盤）

標準和弦圖風格：6 條直向弦線橫跨 5 條橫向品線，直式格子，交點畫點。

**佈局常數**

| 常數 | 值 | 說明 |
|---|---|---|
| DISPLAY_FRETS | 5 | 一次可見品格數 |
| STRING_GAP | 28px | 弦間水平距 |
| FRET_GAP | 38px | 品間垂直距（高>寬 → 直式） |
| LEFT_PAD | 28px | 非開放把位時「Nfr」標籤空間 |
| RIGHT_PAD | 16px | — |
| TOP_PAD | 50px | 上弦枕上方 open/mute 標記空間 |
| BOTTOM_PAD | 22px | 最後品線下方 |
| NUT_THICKNESS | 5px | `startFret === 1` 時的粗弦枕 |
| DOT_RADIUS | 13px | 按壓音點 |
| OPEN_RADIUS | 7px | 開放弦圈 |
| SVG_W / SVG_H | 184 / 262px | 由上述推得 |

`sx(s) = LEFT_PAD + s×STRING_GAP` → 28,56,84,112,140,168。`fy(fi) = TOP_PAD + fi×FRET_GAP`；按壓點中心 y = `fy(fi) + FRET_GAP/2`。

**SVG 圖層（下→上）：**（1）30 個透明點擊區 rect（6×5）→ `toggleFret(s, absFret)`；（2）格線；（3）`startFret===1` 時畫弦枕粗條，否則右對齊「Nfr」標籤；（4）視窗內品位 3,5,7,9,12 的把位點；（5）按壓音點（填 `--color-primary`，音名用 `--color-on-primary`）；（6）弦枕上方 open/mute 標記（`×` 靜音；空心圈開放；已按壓則隱藏）—— 點標記呼叫 `toggleMute(s)`。

**導覽：** `[▲] Nfr [▼]` 列；`startFret` 為本地 ref 1–8（`MAX_START_FRET`），視窗顯示 `[startFret, startFret+4]`。手動捲動會清除落在可見視窗外的按壓（既有行為）。

### 5.2 Capo（移調夾）—— 雙名模型 + 相對移調

**模型（`06-24`）：** capo 位於品 `C` 成為新的弦枕。辨識**執行兩次**，每種音集各一次 —— 不做脆弱的弦轉調：

| 弦狀態 | 實際發聲 MIDI | 指型 MIDI |
|---|---|---|
| 靜音 | 排除 | 排除 |
| 按壓於絕對品 `f`（`f > C`） | `OPEN[s] + f` | `OPEN[s] + (f − C)` |
| 開放（未按、未靜音） | `OPEN[s] + C` | `OPEN[s] + 0` |

故 **指型 = 實際發聲往下移 `C` 半音**。`detectedChord = detectChord(sounding)` 驅動鋼琴與大名；`shapeChord = detectChord(shape)` 驅動副標。`capoFret` 範圍 **0–7**（0 = 無 capo，完全重現無 capo 行為）。

Core 輔助 `buildSelectedNotes(pressedFrets, mutedStrings, capoFret, mode, barre?)`（`mode: 'sounding' | 'shape'`）產生音集。每個音：`{ stringIndex, fret, midi, pitchClass, noteName }`。

**行為 —— 相對移調（`06-25`，取代 `06-24` 升 capo 即清除）：** 升／降 capo 會把**整個按壓指型**平移相同品數，故指型在畫面上位置不變、只有調性改變。指型不會被清除。

```ts
function setCapo(fret: number): void {
  const next = clamp(0, MAX_CAPO, fret)          // 0–7
  const delta = next - capoFret.value
  if (delta === 0) return
  capoFret.value = next
  pressedFrets.value = transposePressedFrets(pressedFrets.value, delta, MAX_FRET) // MAX_FRET = 12
}
```

- `transposePressedFrets(map, delta, maxFret)` —— 純函式；每個按壓平移 `delta`，被推出 `[1, maxFret]` 的按壓會**捨棄**（有損，不記憶）；回新 Map，輸入不變動。
- 指板視窗透過 watcher 跟隨 capo（`startFret += delta`，夾在 1–8），使 capo bar 與指型維持畫面位置。預設視窗維持 `startFret = capoFret + 1`。
- `clearAll` 重置 `capoFret = 0`；`handleClear` 接著設 `startFret = 1`。

**視覺：** capo bar 於品 `C` 以 `--color-accent`（珊瑚色）畫出，與弦枕區別；≤ `C` 的品淡化且不可點；`toggleFret` 只對 `> capoFret` 的品觸發。若 capo 在可見視窗上方，改顯示小「Capo N」指示而不淡化。

### 5.3 Barre（封閉指型）（`06-26`）

可移動、可為部分的橫按手指，於自身品發聲（與作為弦枕的 capo 不同）。

**狀態（`useFretboard`）：**
```ts
const barreFret   = ref<number | null>(null)  // null = 無 barre
const barreLength = ref(6)                     // 2–6，預設 6，錨定最細的幾條弦
```
覆蓋弦 = `[STRING_COUNT − barreLength .. STRING_COUNT − 1]`（長度 6 → 0–5，5 → 1–5，4 → 2–5，3 → 3–5，2 → 4–5）。最細弦（index 5）永遠被覆蓋。

**發聲優先規則（每弦，先符合者勝）：** 1) 靜音 → 排除；2) 更高的明確按壓（在 barre 之上）→ 於該處發聲；3) barre 覆蓋此弦（無更高按壓）→ 於 barre 品發聲；4) capo（未被 barre／未按壓）→ 於 capo 品發聲；5) 開放 → 品 0。

推論：覆蓋弦上 ≤ barre 品的格子淡化且不可點；放置／延長 barre 會丟棄覆蓋弦上 ≤ barre 品的按壓；被覆蓋且無更高按壓的弦隱藏其開放圈標記。

**動作：** `toggleBarre(fret)`、`setBarreLength(len)`、`setCapo` 亦將 barre 依 capo delta 平移（被推出 `[1, MAX_FRET]` 則丟棄）、`clearAll` 重置 `barreFret = null`、`barreLength = 6`。Core 輔助：`barreCoveredStrings(length)`、`dropPressesAtOrBelow(pressed, covered, fret)`，以及擴充後的 `buildSelectedNotes(..., barre?)`（單一有序逐弦掃描）。

**UI：** 第 5 弦右側新增「封閉」切換欄（SVG 加寬約 50px），每列一個狀態點（啟用時亮 `--color-primary`；於 ≤ capo 時停用）；barre bar 為圓角矩形，從 `sx(startString)` 到 `sx(5)`、填 `--color-primary`（capo 維持 `--color-accent` —— 兩功能兩色）；經 barre 發聲的覆蓋弦在 bar 上顯示較小的音名；一個 `<select>`（6/5/4/3/2）標「Barre」綁定 `barreLength`。

**不在範圍：** 同時多個 barre、貝斯側錨定、自動偵測、指法編號標註。

### 5.4 ChordResult（共用卡）

```
┌──────────────────────────────┐
│  Am/E                        │  ← 主發聲名（大）
│  也可能是 C6/E、Am7/E        │  ← 候補（小）
│  形狀：C · Capo 2            │  ← 副標，僅 capo 時（v-if capoFret > 0）
├──────────────────────────────┤
│  組成音  E  A  C            │  ← 音名 pill
│  音程    根音 小三度 完全五度│  ← 音程標籤
└──────────────────────────────┘
```

- 大名、pill、音程、候補皆用 `detectedChord`（發聲）。
- `形狀 · Capo` 副標（來自 `shapeChord`）僅在 `capoFret > 0` 時顯示。
- 無法辨識集合 → 「音集」檢視；空狀態 → `emptyHint`。
- **選用 props（`07-15`，向後相容）** —— 缺省時回落到 `useFretboard()`，故吉他頁不傳任何 prop 且行為不變：
  ```ts
  chord?: ChordResult | null   // undefined ⇒ fb.detectedChord；明確 null = 「無和弦」
  capoFret?: number            // undefined ⇒ fb.capoFret
  emptyHint?: string           // undefined ⇒ '點選指板上的格子來識別和弦'
  ```
- 進場動畫：每次新結果 fade + slide-up。

### 5.5 PianoKeyboard（此處唯讀）

2 個八度唯讀鍵盤，以 **pitch class** 高亮（忽略八度；為已知限制 —— 真實發聲八度的 voicing 延後）。自動對齊到當前音；八度位移僅在辨識結果改變時觸發。

---

## 6. 鋼琴頁（從鋼琴 → 吉他 note map）（`07-14` + `07-15`）

唯讀參照鏡像：在鋼琴上點最多 6 個單音；整個 20 格指板亮出所有能發出這些音的位置，並附和弦提示。不建議指法、吉他側不可互動。

### 6.1 路由（多頁）

- `app.vue` → 佈局外殼：header（標題、主題開關、聲音開關、**分頁** 從吉他 / 從鋼琴）包住 `<NuxtPage/>`。
- `pages/index.vue` → `definePageMeta({ redirect: '/guitar-to-piano' })`。
- `pages/guitar-to-piano.vue` → 指板工具。
- `pages/piano-to-guitar.vue` → 此 note-map 工具。

各頁各自實例化自己的 composable，故兩方向自然保持獨立狀態。分頁 = 帶 active-class 的 `<NuxtLink>`。

### 6.2 佈局（`07-15`，取代 `07-14`）

由上而下：**鋼琴（輸入）→ 和弦提示 → 吉他指板（輸出）→ 控制列** —— 符合心智模型（彈 → 名稱 → 這些音在吉他何處 → 控制）。

```
┌───────────────────────────────────────────┐
│  header: fret notes   [從吉他][從鋼琴]  🌙🔊│
├───────────────────────────────────────────┤
│  PianoKeyboard（E2–C6，可點，縮放）        │
├───────────────────────────────────────────┤
│  ChordResult（由選取音辨識的和弦）         │
├───────────────────────────────────────────┤
│  GuitarNeck（橫向 6×20，可橫捲 →）         │
├───────────────────────────────────────────┤
│  控制：[顯示非同八度亮點]  n/6  [清除]     │
└───────────────────────────────────────────┘
```

### 6.3 GuitarNeck（新，僅顯示）

- 6 弦 × 20 品（`NECK_FRETS = 20`），弦枕在**左**、第 20 品在右；高音 E（index 5）在**上**線、低音 E（index 0）在下（tab 慣例）。
- 調弦沿用 `OPEN_STRINGS`。
- 品位記號：3,5,7,9,15,17,19 單點；12 雙點。
- Props：亮點位置 `{ stringIndex, fret, noteName, octave, colorIndex, dim }`；`dim: true` 以降低透明度呈現。每個點顯示**音名 + 八度**（如 `C4`）。
- 窄螢幕橫向捲動。無點擊處理。

### 6.4 PianoKeyboard —— 互動重構（向後相容）

新增選用 props，預設保留現有唯讀行為：
- `interactive?: boolean`（預設 `false`）—— 鍵可點，emit `toggle(midi)`。
- `fixedRange?: { startMidi; endMidi } | null`（預設 `null`）—— 覆寫自動對齊。
- `activeColorMap?: Map<number, number> | null`（預設 `null`）—— 「active」定義為該鍵 MIDI 在 map 中，並依其 `colorIndex` 上色。

note-map 頁傳 `fixedRange = { startMidi: 40, endMidi: 84 }`（**E2–C6**）—— 正好是 20 格標準吉他能發出的範圍。45 鍵一次全渲染，既有 auto-scale 縮到容器內（手機橫捲）。無平移／滑動 —— 讓每個選取音隨時可見正是重點。

### 6.5 `usePianoNoteMap()`（新 singleton）

```ts
selectedMidis: Ref<Map<number, number>>   // midi → colorIndex（0..5），最多 6
showOffOctave: Ref<boolean>               // 預設 FALSE（07-15，07-14 原為 true）
detectedChord: ComputedRef<ChordResult | null>   // 07-15，由選取音得出
litPositions:  ComputedRef<LitPosition[]>        // → <GuitarNeck/>

toggleNote(midi)   // 已存在 → 移除並釋出顏色；不存在且 <6 → 取最低空閒顏色；==6 → no-op
clear()
```

- `MAX_NOTES = 6`；第 7 個不同音被忽略（取消選取永遠允許）。
- 固定 6 色調色盤（`--note-color-0…5`，light/dark），依最低空閒 index 指派，故移除中間音會釋出其欄位供重用。

**亮點位置計算** —— 對每個 `(midi, colorIndex)`：`findExactPositions(midi)` → `dim: false`；若 `showOffOctave`，`findPitchClassPositions(pc)` 扣除精確者 → `dim: true`、同色。每個 `LitPosition` 由該位置的發聲 MIDI 帶入 `noteName`/`octave`（dim 點顯示自身八度，如按 C4 時出現 C3 點）。

**和弦提示（`07-15`）：**
```ts
const detectedChord = computed(() =>
  detectChord([...selectedMidis.value.keys()].map(midi => ({ midi, pitchClass: midiToPitchClass(midi) }))))
```
於頁面接線：
```vue
<ChordResult :chord="detectedChord" :capo-fret="0" empty-hint="點鋼琴鍵來識別和弦" />
```
`capoFret = 0` ⇒ `形狀 · Capo` 副標永不渲染，此頁也永不讀取 `shapeChord`。

**非同八度預設（`07-15`）：** `showOffOctave` 預設 `false`；控制項為 opt-in 的 **顯示非同八度亮點** 切換（勾選 ⇒ 出現 dim 點）。

### 6.6 Core —— `neck.ts`（新）

```ts
export const NECK_FRETS = 20
export interface Position { stringIndex: number; fret: number }
export function findExactPositions(midi: number, maxFret = NECK_FRETS): Position[]      // 含開放（品 0）
export function findPitchClassPositions(pc: number, maxFret = NECK_FRETS): Position[]
```
兩者皆由 `OPEN_STRINGS` + 品推導音高；不引入新調弦資料。E2–C6 每個音在 20 品內都至少有 1 個精確位置，故精確高亮不會落空。

**note-map 調色盤：** 6 個主題感知 CSS 變數（`--note-color-0…5`）；dim 以同色 ~35% 透明度重用。

**此頁的 Capo：** 明確不在範圍（未來擴充；位置查詢日後可加選用 capo offset，不需改動現行指型）。

---

## 7. 佈局與視覺設計（基礎）

- **吉他頁 —— iPad 橫向：** Fretboard | ChordResult 並排，鋼琴於下方全寬。**直向／手機：** ChordResult → Fretboard → 鋼琴 直堆。斷點 `@media (orientation: landscape) and (min-width: 768px)`。
- **調色 token（light / dark）：** 背景 `#F8F9FF` / `#0F1117`；表面 `#FFFFFF` / `#1C1F2E`；主色 `#4F6EF7` / `#6B87FF`；強調 `#FF6B6B` / `#FF8080`；文字 `#1A1A2E` / `#E8EAFF`；淡字 `#8B8FA8` / `#6B6F88`。
- **字型：** `DM Sans`（標題）+ `Inter`（內文）—— Google Fonts。
- **主題切換：** 右上角動畫日／月，CSS 過場。
- **微動畫：** 手指點 scale+fade 80ms；ChordResult fade+slide-up 150ms；主題切換 200ms。

---

## 8. 音訊播放

每次新增音立即發聲；▶ 按鈕播放整個辨識到的和弦。吉他頁 = 撥弦音色 / 掃弦；鋼琴頁 = 敲擊音色 / 齊奏。每個互動單一觸發點，讓元件保持單純：

| 觸發 | 來源（僅新增時） | 呼叫 |
|---|---|---|
| 按品 | `useFretboard.toggleFret` | `playNote(OPEN[s]+fret, 'guitar')` |
| 按鋼琴鍵 | `usePianoNoteMap.toggleNote` | `playNote(midi, 'piano')` |
| ▶ 播放和弦 | `ChordResult` 按鈕 | `playChord(midis, instrument)` |
| 聲音開/關 | header 🔊/🔇 | `toggleEnabled()`（localStorage 持久化；mount 後 hydrate） |

`ChordResult` 新增選用 `playMidis` + `instrument` props（吉他頁兩者省略 → 回落 `fb.selectedNotes` + `'guitar'`；鋼琴頁傳選取 MIDIs + `'piano'`）。移除／靜音音符無聲。`core/audio/synth.ts` 保有 `midiToFrequency` 與 `chordSchedule`（吉他掃弦錯開 / 鋼琴齊奏，去重）。

> **⚠ 引擎決策 —— 取樣遷移取代合成。**
> **初版引擎**（`08-19`）為純 Web-Audio 振盪器合成（`instruments.ts` 的 VOICES/ADSR、`DynamicsCompressor`、attack-noise）。它已被**取樣音色**設計（`Tone.Sampler`、自架 mp3 sample pack）取代，後者為權威音訊方向。
>
> 該遷移有自己**仍現行**的規格 ——
> [`2026-08-20-audio-sampler-migration-design.md`](2026-08-20-audio-sampler-migration-design.md)
> （**因尚未實作**而不納入本次統整）。
> 截至撰寫時，已 ship 的 code 仍跑合成引擎；取樣遷移已拍板但尚未建置。往後請以 08-20 規格為音訊引擎的真實來源。

---

## 9. 狀態管理彙整

- `useFretboard`（singleton）：`pressedFrets: Map<stringIndex, absoluteFret>`、`mutedStrings: Set<number>`、`capoFret`（0–7）、`barreFret`、`barreLength`；計算 `detectedChord`（發聲）+ `shapeChord`（指型）；提供 `toggleFret`、`toggleMute`、`setCapo`、`toggleBarre`、`setBarreLength`、`clearAll`。
- `usePianoNoteMap`（singleton）：`selectedMidis`、`showOffOctave`、`detectedChord`、`litPositions`；`toggleNote`、`clear`。
- `useAudio`（singleton）：`enabled` + 播放方法（見 §8）。
- 不用 Pinia —— module 層 composable singleton 已足夠。

---

## 10. 測試策略

- **Core 純單元測試（Node）：**
  - `chord-detector`：音程集合辨識、以最低 MIDI 判分數和弦、無法辨識集合，以及收窄後 `{ midi, pitchClass }[]` 呼叫點（07-15 新增）。
  - `fretboard`：`buildSelectedNotes`（capo 發聲/指型、靜音排除、指型 = 發聲 − capo）、`transposePressedFrets`（上/下移、超過 maxFret 丟棄、輸入不變動）、barre（`barreCoveredStrings`、`dropPressesAtOrBelow`、barre+capo 指型模式、靜音優先、更高按壓優先）。
  - `neck`：`findExactPositions` 邊界（E2 → `[{0,0}]`、C6 → `[{5,20}]`、C4 → 5 個位置）、`findPitchClassPositions` 正確含/排除。
  - `audio/synth`：`midiToFrequency`（A4 錨、八度倍頻）、`chordSchedule`（排序、鋼琴齊奏、吉他錯開、去重、空集）。
- **建置閘門：** `npx nuxi typecheck` 0 錯 · `npm test` 全綠 · `npm run generate` 成功 · dev 預覽 HTTP 200。
- **瀏覽器驗證：** 互動 PianoKeyboard、GuitarNeck 渲染、佈局順序、capo/barre 視覺、Web-Audio 播放（Node 環境無 DOM）。

---

## 11. 已封存來源規格（僅供歷史）

已統整進本檔並移至 `docs/superpowers/specs/_archive/`（Claude 忽略）。每份 `-zh.md` 對應檔與其英文原檔一併封存。

| 已封存規格 | 併入章節 | 備註 |
|---|---|---|
| `2026-06-18-guitar-chord-reference-tool-design` | §1–4、5.4、5.5、7、9 | 基礎工具；其指板棋盤被 06-22 取代 |
| `2026-06-22-chord-diagram-fretboard-design` | §5.1 | SVG 和弦圖 |
| `2026-06-24-capo-design` | §5.2 | Capo 模型；升 capo 即清除被 06-25 取代 |
| `2026-06-25-capo-relative-transpose-design` | §5.2 | 相對移調行為（勝出） |
| `2026-06-26-barre-chord-design` | §5.3 | Barre |
| `2026-07-14-piano-to-guitar-note-map-design` | §6 | Note map；佈局 + 非同八度被 07-15 取代 |
| `2026-07-15-note-map-chord-and-layout-design` | §6 | 佈局互換、和弦提示、非同八度預設（勝出） |
| `2026-08-19-audio-playback-design` | §8 | 合成引擎；被現行 08-20 取樣規格取代 |

**仍現行（未封存）：**
`2026-08-20-audio-sampler-migration-design.md` —— 權威、待實作的音訊引擎（見 §8）。

---

## 12. 不在範圍 / 未來

- 反查（和弦 → 建議 capo + 指型）。
- 八度精確的鋼琴 voicing（鋼琴僅以 pitch class 高亮）。
- note-map 頁的 capo；替代／降弦調弦；擴充和弦類型（9、m9、13、maj9…）。
- 使用者帳號 + 自訂指型儲存（Supabase）。
- 音訊：樂器切換 UI、力度/動態、延音、殘響、離線取樣快取。
