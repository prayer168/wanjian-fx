# CLAUDE.md — 萬箭金鐘罩（wanjian-fx）

> 給 Claude Code（Opus 5.5）的專案規則。開始任何工作前，先讀 `docs/v2/PRODUCTION_PLAN.md`。

## 專案是什麼

黑熊老師（Prayer）的動漫風武俠特效動畫系列，用來展示 Claude 的動畫製作能力，也放在「黑熊老師自然科學數位教材中心」的「休閒（動動腦）」頁籤。

| 版本 | 內容 | 位置 | 網址 |
|---|---|---|---|
| v1 | 萬箭金鐘罩：劍引萬箭射向金鐘罩，25 秒 | `index.html`（根目錄，已上線） | https://prayer168.github.io/wanjian-fx/ |
| v2 | 瓦上追風：兩人沿古代街道屋頂追逐打鬥，約 70 秒 | `v2/`（待製作） | https://prayer168.github.io/wanjian-fx/v2/ |

## 不能違反的規則

1. **不要改壞 v1。** 根目錄的 `index.html` 是已上線的 v1，除非使用者要求，否則不動。v2 一律放在 `v2/`。
2. **人物造型不變。** 劍客與武僧的外型、配色、比例沿用 v1（規格見 PLAN 第 3 節）。v1 的 `drawSwordsman` / `drawMonk` 是造型的唯一依據。
3. **確定性時間軸。** 所有動畫以固定步長 `STEP = 1/60` 模擬，`seek(t)` 必須能重現任一格畫面（v1 已示範做法）。不准用 `Math.random()`，一律用帶種子的 `mulberry32`。逐格輸出 MP4 靠的就是這一點。
4. **畫面先確認，再量產。** 使用者偏好「視覺先確認」：每個里程碑先交樣片或截圖給使用者看，得到同意才往下做。
5. **繁體中文介面**。程式註解可以用英文或中文。
6. **單一自給自足 HTML 為主**（`v2/index.html`），外部函式庫只從 cdnjs / jsDelivr 載入，並鎖定確切版本。字型用 Google Fonts。
7. **授權**：聲音模型預設只用 Apache-2.0 / MIT 授權（可商用）。非商業授權（MMAudio 權重、Fish Audio、Breeze TTS 2 等）要先問使用者頻道是否營利，才能使用。
8. **影片交付**：最終影片一定要給使用者可以直接點開的連結（GitHub Pages 網址或 Release 下載連結）。

## 部署

- GitHub Pages。repo 有兩個分支：`master`（預設分支）與 `main`，兩者都有 v1 的 `index.html`。工作在 `main` 上進行；開始前先確認 Pages 實際從哪個分支部署（Settings → Pages），推送到那個分支。
- 大型影片檔（> 50MB）不要直接 commit，改用 GitHub Release 附件或 Git LFS，先問使用者。

## Commit

- 訊息用繁體中文，說明做了什麼。
- 小步提交：每完成一個里程碑就 commit 並推送。
