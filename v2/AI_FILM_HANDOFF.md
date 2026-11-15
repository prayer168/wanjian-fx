# AI 影片路線交接（2026-11-15）

給接手這個專案的新對話。使用者用繁體中文溝通，回覆一律用繁體中文。

## 目標

試做一支 **3–5 分鐘**的武俠／仙俠短片，風格比照參考影片：
https://www.youtube.com/watch?v=V1axyqJQC6Q&t=3861s （風起東山《師姐姜顏千年修行路》）

使用者的要求（原話重點）：
- 3D 渲染暫時不用，除非能保證效果跟參考影片一樣。
- 市面上有的武打特效都要有，再加上更多創新、有創意的特效，拋開傳統武術框架，要令人驚艷。
- 可以自行下載、安裝任何需要的程式，一氣呵成做出來。
- 電影元素都要有：人物、服裝、配樂、配音、特效、運鏡。
- 頻道已營利，所有素材與模型必須可商用。
- 成品是 MP4；畫面不加說明文字、不放標題。
- 持續更新 `v2/history.md`，每輪結束 commit 並 push 到 GitHub（分支 `v2/rig-test`，PR #1）。

## 參考影片的風格分析

這是 **AI 生成影片**（文生圖 → 圖生影片），不是 3D 渲染，也不是手繪動畫。

- **畫面**：寫實真人電影感。淺景深、自然光與逆光、霧氣與體積光、低飽和的電影調色（青橙、暗部偏冷）。
- **人物**：真人質感的古裝角色。主角白髮、白紗或紅衣，造型在各鏡頭間保持一致（靠角色參考圖鎖定）。
- **服裝與場景**：漢、魏晉到唐的考究服飾；木構建築、庭院、竹林、江河、草原、石窟大佛。
- **鏡頭**：每個鏡頭約 3–8 秒，動作幅度小而穩（走、轉身、抬手、衣袂飄動），大量用緩推、橫移、空拍遠景、特寫切換。奇幻元素（巨大白熊、巨鷹掀船）用單一鏡頭完成。
- **敘事**：旁白加字幕推進，鏡頭本身很少長時間對打；打鬥多半是「對峙 → 一招 → 結果」的剪接。
- **聲音**：旁白、古風配樂、少量環境音。

對我們的啟示：用「關鍵畫面圖 → 圖生影片」逐鏡頭生成，再用剪接、音效與後製特效串成打鬥；每個鏡頭只要求一個清楚的動作。

## 使用者已決定的工具

**本機 Wan 2.2（免費）**：ComfyUI + Wan 2.2 圖生影片（Apache-2.0，可商用），跑在 RTX 5060 Ti 16 GB 上。
使用者已知：畫質與打鬥動作會比參考影片差一截、整片要跑一兩天。雲端付費模型是之後的備案。

其他可用資源：
- `GEMINI_API_KEY`（使用者環境變數，已設定；不要寫進程式或 GitHub）
  - 生圖：`gemini-3-pro-image`（Nano Banana Pro）等，用來做角色定裝圖與每個鏡頭的關鍵畫面。會產生少量費用。
  - 配音：`gemini-3.8-flash-tts`。兩個台灣腔國語聲線已設計好，id 在 `v2/audio/voices.json`；合成程式 `v2/audio/voice.mjs`、台詞 `v2/audio/lines.mjs`。
  - 配樂：`lyria-3.5` 可用（尚未試過）；程式作曲 `v2/audio/music.mjs` 也可沿用。
  - 影片生成（Veo）**沒有**開通。
- FFmpeg、Node 24、Blender 5.2、Playwright 都已安裝。Python 用 `py -3.12`（系統預設 3.15 太新）。

## 安裝進度（2026-11-16 更新：全部下載完成）

| 項目 | 位置 | 狀態 |
|---|---|---|
| ComfyUI 可攜版 v0.45.0（nvidia） | `D:\ComfyUI\ComfyUI_windows_portable\` | 已下載並解壓（`run_nvidia_gpu.bat`、`python_embeded`），尚未啟動過 |
| `wan_2.1_vae.safetensors` | `D:\ComfyUI-modelsae\` | 完成 |
| lightx2v 4 步 LoRA（high／low noise） | `D:\ComfyUI-models\loras\` | 完成 |
| `umt5_xxl_fp8_e4m3fn_scaled.safetensors` | `D:\ComfyUI-models\text_encoders\` | 完成（6,735,906,897 位元組） |
| `wan2.2_i2v_high_noise_14B_fp8_scaled.safetensors` | `D:\ComfyUI-models\diffusion_models\` | 完成（14,294,742,832 位元組） |
| `wan2.2_i2v_low_noise_14B_fp8_scaled.safetensors` | 同上 | 完成（14,294,742,832 位元組） |

檔案大小都與來源一致。`D:\ComfyUI\portable.7z`（2 GB）解壓後可以刪除。

下載來源：
- ComfyUI：`https://github.com/Comfy-Org/ComfyUI/releases/download/v0.45.0/ComfyUI_windows_portable_nvidia.7z`
- 模型：`https://huggingface.co/Comfy-Org/Wan_2.2_ComfyUI_Repackaged/resolve/main/split_files/...`
  （文字編碼器在 `Comfy-Org/Wan_2.1_ComfyUI_repackaged`）

接手時：
1. 下載與解壓都已完成，不需要再下載。
2. 在 ComfyUI 的 `extra_model_paths.yaml` 指向 `D:\ComfyUI-models`，啟動後用 HTTP API（`/prompt`）送工作流程，方便全自動批次生成。
3. 16 GB 顯示卡建議：Wan 2.2 I2V 14B fp8 + lightx2v 4 步 LoRA，先 832×480、81 格（16 fps，約 5 秒）測試，再試 1280×720。事後用 FFmpeg 補格到 30 或 60 fps、放大到 1080p。

## 建議的製作流程

1. **測試鏡頭**：一張關鍵畫面（Nano Banana Pro）加一段 5 秒打鬥影片（Wan 2.2），先給使用者看，確認方向。
2. **劇本與分鏡**：約 40–60 個鏡頭。可沿用 `v2/FIGHT_SCRIPT.md` 的招式與勝負設計，但要加入更有創意的特效，例如水墨化成實體、時間凍結的雨滴、劍氣切開月光、書法筆畫變成兵器、鏡面世界、身形化成花瓣或墨跡。
3. **角色定裝圖**：兩位主角各一組（正面、側面、全身），之後每張關鍵畫面都帶這些參考圖，維持人物一致。使用原創角色，不要用真實藝人的臉。
4. **逐鏡頭生成**：關鍵畫面 → 圖生影片 → 檢查 → 不合格就換提示詞或種子重做。
5. **後製**：FFmpeg 剪接、調色、補格放大；可疊加程式特效（`v2/film/js/skills.js` 的劍陣、掌印等可渲染成透明素材）。
6. **聲音**：配音、配樂、音效，混到 −14 LUFS、真峰值 ≤ −1 dBFS（`v2/audio/mix.mjs`、`v2/render/build-film.sh` 可參考）。
7. 上傳 YouTube 時要勾選「含合成內容」。

## 舊的 3D 路線（已暫停）

- 成品 `v2/out/wanjian2-full-v3-sound.mp4`（4:33）保留。使用者認為人物拼湊感重、有透明破洞、動作卡頓。
- 工作區有**未提交**的 3D 修正（`chars/build_char.py`、兩個 json、兩個 `.glb`、`film/js/director.js`、`mocap.js`、`scenes/act5.js`、`scenes/prologue.js`）。其中新建的 `swordsman.glb` 上衣是壞的。不要提交這些；要回到 3D 時再處理，或用 `git checkout -- <檔>` 還原。
- `v2/out` 是連到 `D:\wanjian-fx\v2-out` 的目錄連結，不進版控。`v2/assets/mocap/*.fbx`（Mixamo）依授權不可上傳。

## 待使用者手動處理

- 刪除空資料夾 `C:\out`（工具不允許代刪）。
