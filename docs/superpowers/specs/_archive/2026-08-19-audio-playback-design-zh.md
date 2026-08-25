# 聲音播放 — 設計文件
日期：2026-08-19

## 概述

為工具加上聲音。使用者每選一個音就立即發聲，另有播放鈕可掃／彈整個識別出的和弦。兩個樂器音色不同：吉他頁像撥弦、鋼琴頁像敲弦。純 Web Audio 合成 — 零音檔資產，靜態部署維持無資產。

- **主要使用者：** 同基礎工具 — 吉他手、基礎到中階樂理
- **已定案決策：** Web Audio 合成 · 點音即響 + 播放和弦鈕 · 雙音色 · 吉他掃弦 / 鋼琴齊奏

---

## 架構

兩層，對應既有的 `core/` 與 `app/composables/` 分層。

### `core/audio/` — 純函式、可於 Node 測試（無 DOM、無 Web Audio）

- **`synth.ts`**
  - `midiToFrequency(midi)` → 十二平均律 Hz（A4 = 440）。
  - `chordSchedule(midis, instrument)` → 音由低到高排序，各帶一個起始 `delay`（秒）。吉他以 `GUITAR_STRUM_STEP` 錯開（下掃）；鋼琴 delay 為 0（齊奏）。會去除重複 MIDI。
- **`instruments.ts`**
  - `VOICES: Record<Instrument, Voice>` — 音色以純資料描述（振盪器層、ADSR、低通掃頻、時長、選用的 `attackNoise`）。節點圖讀這些數值；設定集中於此，方便檢視與調整。
  - 吉他：三角波為主體 + 少量鋸齒波增添咬勁，精準調音（不失諧以保持音準乾淨）、柔和低通、較長餘響。捨棄純鋸齒以消除 buzzy/刺耳的底色。
  - 鋼琴：正弦基音 + 三角波主體 + 高八度正弦增添明亮（宏亮）、明亮低通、長餘響，另加 `attackNoise` 敲擊 — 起音時一段極短的帶通噪音爆點，模擬琴槌的咚/扣。

### `app/composables/useAudio.ts` — Web Audio 副作用（singleton）

- 懶初始化 `AudioContext`，於首次播放時建立/resume（一定發生在點擊/觸控手勢內，符合瀏覽器自動播放政策）。SSR 安全：每條路徑都守 `typeof window`。
- `playNote(midi, instrument)` — 於 `ctx.currentTime` 播一個 voice。
- `playChord(midis, instrument)` — 透過 `chordSchedule` 排程各 voice。
- `enabled` ref（預設開）+ `toggleEnabled()`，存入 `localStorage['fret-notes:sound-enabled']`。儲存值於**掛載後**由 `hydrateAudioPreference()` 套用（在 `app.vue` `onMounted` 呼叫），避免預渲染的 header 圖示發生 hydration 不一致。
- 訊號鏈末端為共用 master gain → `DynamicsCompressor`（軟限幅）→ destination。壓縮器壓平掃弦時的疊加峰值，避免破音（吉他「爆料」的解法）。

每個 voice ＝ 振盪器層 → 各層混音 gain → 低通濾波 → ADSR amp → master。包絡用指數 ramp，並以極小 epsilon 為下限（指數無法到達真正的 0）。帶 `attackNoise` 的 voice 會另外觸發一段極短的帶通白噪音爆點（取自重複使用的 200ms buffer）直送 master，繞過音色低通，讓敲擊聲清楚可聞。

---

## 接線 — 聲音在哪裡觸發

每個互動一個單一入口，讓元件保持單純：

| 觸發 | 來源 | 呼叫 |
|---|---|---|
| 按指板格子 | `useFretboard.toggleFret`（僅新增時） | `playNote(OPEN_STRINGS[s] + fret, 'guitar')` |
| 按鋼琴鍵 | `usePianoNoteMap.toggleNote`（僅新增時） | `playNote(midi, 'piano')` |
| ▶ 播放和弦 | `ChordResult` 按鈕 | `playChord(midis, instrument)` |
| 聲音開關 | header 🔊/🔇 | `toggleEnabled()` |

`ChordResult` 新增選用 props `playMidis` 與 `instrument`。吉他頁：兩者省略 → 回退到 `fb.selectedNotes` + `'guitar'`。鋼琴頁：傳入已選 MIDI + `'piano'`。移除/靜音音符不發聲 — 只有新增會出聲。

---

## 非目標（本階段）

- 取樣／真實樂器音色（介面預留空間，但不實作）。
- 力度／動態、延音踏板、殘響。
- 靜音弦的細節處理 — 點音即響發出的是所按格子的本音，此即預期回饋。

## 測試

`tests/audio/synth.test.ts` 涵蓋 `midiToFrequency`（A4 錨點、八度加倍、中央 C）與 `chordSchedule`（排序、鋼琴齊奏、吉他錯開、去重、空集）。`useAudio` 的 Web Audio 副作用不做單元測試（Node 測試環境無 DOM），改於執行中的 dev server 手動驗證。
