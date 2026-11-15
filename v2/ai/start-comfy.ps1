# 啟動本片用的 ComfyUI（可攜版，連接埠 8189；8188 留給 D:\AI-Local 那一套）。
# 模型路徑寫在 D:\ComfyUI\ComfyUI_windows_portable\ComfyUI\extra_model_paths.yaml，指向 D:\ComfyUI-models。
$root = 'D:\ComfyUI\ComfyUI_windows_portable'
$out = 'D:\wanjian-fx\v2-out\ai'
New-Item -ItemType Directory -Force "$out\comfy", "$out\key", "$out\clips", "$out\logs" | Out-Null
Set-Location $root
& .\python_embeded\python.exe -s ComfyUI\main.py --windows-standalone-build --listen 127.0.0.1 --port 8189 --disable-auto-launch --output-directory "$out\comfy" *> "$out\logs\comfy-8189.log"
