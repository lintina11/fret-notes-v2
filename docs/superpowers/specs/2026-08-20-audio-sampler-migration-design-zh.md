# 聲音 — 取樣遷移設計
日期：2026-08-20

**取代** `2026-08-19-audio-playback-design.md` 的合成方案。原本的 Web Audio 振盪器合成（VOICES、ADSR、壓縮器、敲擊噪音）改為透過 Tone.js `Tone.Sampler` 的真實取樣樂器。接線（單一觸發點、▶ 按鈕、靜音鈕）不變；只換聲音引擎與其載入／資產處理。

## 動機

振盪器合成有擬真天花板 — 底色永遠偏「電子感」。使用者要擬真的吉他與鋼琴，取樣是正解。

## 已定案決策（grilling，2026-08-20）

1. **範圍：** 兩個樂器**都換**成取樣；移除所有合成程式碼。
2. **來源：** `tonejs-instruments` 取樣包，**CC-BY 3.0** → 可商用，**須標註**。
3. **托管：** 選用的音檔**自托管**於 `public/`（維持靜態部署自足、不依賴外部 CDN）。
4. **樂器：** 吉他＝**acoustic**（University of Iowa）；鋼琴＝**VSCO2**（Versilian）。
5. **取樣密度：** **抽稀子集**（約小三度網格）；`Tone.Sampler` 自動變調補齊。體積更小，小三度內失真可忽略。
6. **格式：** **僅 mp3**（相容性最好含 Safari；捨棄 ogg/wav）。
7. **預載：** 進入頁面時預載**該頁的**樂器，**一律預載**（不受靜音鈕影響）— 較省事。
8. **無 fallback：** 離線／音檔載入失敗時，產品就**沒有聲音**。不留合成 fallback、不做重試引擎。
9. **餘音：** 單音**依取樣自然衰減響完**（取代先前的 1.5× 合成權宜值）。
10. **載入 UI：** 當前頁樂器就緒前，header 🔊 鈕呈**半透明且不可點**；就緒後點亮。
11. **標註：** 網站底部一行極簡 **footer** 標註取樣來源（符合 CC-BY）。

---

## 架構

### 相依

- 於 `package.json` 加入 `tone`。Tone 會碰 `window`/`AudioContext`，故**只在瀏覽器端載入** — 於 `useAudio` 內動態 `await import('tone')`，絕不在模組頂層（SSR/預渲染會 `ReferenceError`）。

### 資產

- `public/samples/guitar-acoustic/*.mp3` 與 `public/samples/piano/*.mp3`。
- 跨應用所需音域的抽稀小三度網格（吉他約 E2 起、鋼琴 note map 到 C6/MIDI 84）。吉他代表性錨點：`D2 F2 Gs2 B2 D3 F3 Gs3 B3 D4 F4 Gs4 B4 D5`（取樣包涵蓋 D2–D5；Tone 變調延伸到 E2…C6）。鋼琴：約 C2–C6 的類似網格。**最終音名清單於實作時對照取樣包實際檔案確認。**

### `core/audio/` — 純函式、可測（不變 + 一個新資料檔）

- `synth.ts` **保留**：`midiToFrequency`（餵給 `triggerAttack`）與 `chordSchedule`（仍負責吉他掃弦錯開／鋼琴齊奏）。
- **刪除 `instruments.ts`**（VOICES/AttackNoise 不再需要）。
- **新增 `sample-map.ts`** — 純資料：每個樂器的 `baseUrl` 與交給 `Tone.Sampler` 的 `{ 音名: 檔名 }` 對應表。可測（驗證非空、音名格式正確）。

### `app/composables/useAudio.ts` — 以 Tone.Sampler 重寫

狀態（singleton）：
- `enabled` ref + `toggleEnabled()` + `hydrateAudioPreference()` — **不變**，仍存 localStorage。
- `ready: Record<Instrument, boolean>` — 反應式，各 sampler `onload` 時翻真。
- `activeInstrument` ref — 由當前頁設定；header 讀 `ready[activeInstrument]` 驅動載入狀態。

行為：
- `preload(instrument)` — 冪等：client-only `import('tone')`，依 `sample-map` 建 `Tone.Sampler`，載入完設 `ready`。由各頁 `onMounted` 針對自身樂器呼叫。
- `playNote(midi, instrument)` — 除非 `enabled` 且 sampler 就緒否則 no-op；否則 `Tone.start()`（首次手勢）後 `sampler.triggerAttack(midiToFrequency(midi))`。
- `playChord(midis, instrument)` — 由 `chordSchedule` 於 `now + delay` 逐音 `triggerAttack`（吉他掃弦／鋼琴齊奏）。音自然響完。
- 移除：`playVoice`、振盪器圖、`DynamicsCompressor`、noise buffer、`MASTER_GAIN`（輸出交給 Tone；音量平衡用各 sampler 的 `volume`）。

### 接線 — 觸發點不變

`useFretboard.toggleFret` → `playNote(..,'guitar')`；`usePianoNoteMap.toggleNote` → `playNote(..,'piano')`；`ChordResult` ▶ → `playChord`。各頁於掛載時設定 `activeInstrument` 並對自身樂器呼叫 `preload`。

### `app.vue`

- Header 🔊 鈕：加 `disabled` + `is-loading` class（半透明、`pointer-events:none`），綁定 `!ready[activeInstrument]`。
- 加極簡 **footer**：例如「音色取樣：Acoustic Guitar — University of Iowa Electronic Music Studios · Piano — Versilian Studios (VSCO2) · CC-BY 3.0」（最終文字與連結於實作定）。

---

## 影響檔案

- `package.json` — 加 `tone`。
- `public/samples/**` — 新 mp3 資產。
- `core/audio/sample-map.ts` — 新增；`core/audio/instruments.ts` — 刪除。
- `core/audio/synth.ts` — 不變。
- `app/composables/useAudio.ts` — 重寫。
- `app/app.vue` — 🔊 載入狀態 + footer 標註。
- 各頁於掛載時設定 `activeInstrument` / 呼叫 `preload`。
- `tests/audio/synth.test.ts` 保留；新增 `sample-map` 健檢測試。

## 非目標

- 樂器切換 UI（acoustic/electric/nylon 選擇器）。
- 力度／動態、延音踏板、殘響。
- 離線快取／service worker。
- 音檔載入失敗的重試（無聲可接受）。

## 測試策略

純 `core/audio`（`synth`、`sample-map`）於 Node 單元測試。Tone.Sampler 的載入／播放屬瀏覽器與 Web Audio 範疇 — 於執行中的 dev server（Node 22）手動驗證，不做單元測試。
