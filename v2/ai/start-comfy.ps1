# 啟動本片用的 ComfyUI（可攜版，連接埠 8189；8188 留給 D:\AI-Local 那一套）。
# 模型路徑寫在 D:\ComfyUI\ComfyUI_windows_portable\ComfyUI\extra_model_paths.yaml，指向 D:\ComfyUI-models。
# 用 Start-Process 另開獨立行程，關掉呼叫它的終端機或工作階段也不會跟著結束。
$root = 'D:\ComfyUI\ComfyUI_windows_portable'
$out = 'D:\wanjian-fx\v2-out\ai'
New-Item -ItemType Directory -Force "$out\comfy", "$out\key", "$out\clips", "$out\logs" | Out-Null
$p = Start-Process -PassThru -WindowStyle Hidden -WorkingDirectory $root -FilePath "$root\python_embeded\python.exe" `
  -ArgumentList '-s', 'ComfyUI\main.py', '--windows-standalone-build', '--listen', '127.0.0.1', '--port', '8189', '--disable-auto-launch', '--output-directory', "$out\comfy" `
  -RedirectStandardOutput "$out\logs\comfy-8189.log" -RedirectStandardError "$out\logs\comfy-8189.err.log"
"ComfyUI pid $($p.Id) on http://127.0.0.1:8189"
