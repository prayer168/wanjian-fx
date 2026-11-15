// One image-to-video shot with Wan 2.2 I2V 14B (fp8) + lightx2v 4-step LoRA, through a local ComfyUI's HTTP API.
// The keyframe is cropped to the target size, uploaded, sampled (2 high-noise + 2 low-noise steps), the frames come back as PNG
// and are encoded to MP4 here, so grading / interpolation / upscaling later start from clean frames.
//   node wan.mjs <name> --image key.jpg --prompt "..." | --prompt-file p.txt  [--w 832 --h 480 --frames 81 --seed 1 --shift 5 --fps 16]
// COMFY (default http://127.0.0.1:8189) is our ComfyUI. OTHER_COMFY (default http://127.0.0.1:8188) is another install on this
// machine that shares the GPU: we wait until its queue is empty and never queue while it is busy.
import {readFileSync, writeFileSync, mkdirSync, readdirSync, rmSync, existsSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {resolve, join} from 'node:path';

const COMFY = process.env.COMFY || 'http://127.0.0.1:8189', OTHER = process.env.OTHER_COMFY ?? 'http://127.0.0.1:8188';
const OUT = process.env.AI_OUT || 'D:/wanjian-fx/v2-out/ai';
const NEG = '色调艳丽，过曝，静态，细节模糊不清，字幕，风格，作品，画作，画面，静止，整体发灰，最差质量，低质量，JPEG压缩残留，丑陋的，残缺的，多余的手指，画得不好的手部，画得不好的脸部，畸形的，毁容的，形态畸形的肢体，手指融合，静止不动的画面，杂乱的背景，三条腿，背景人很多，倒着走';

const a = process.argv.slice(2), name = a[0];
const o = {w: 832, h: 480, frames: 81, seed: 1, shift: 5, fps: 16, image: '', prompt: ''};
for (let i = 1; i < a.length; i++) {
  const k = a[i].replace(/^--/, '');
  if (k === 'prompt-file') o.prompt = readFileSync(a[++i], 'utf8').trim();
  else if (k === 'image' || k === 'prompt') o[k] = a[++i];
  else o[k] = Number(a[++i]);
}
if (!name || !o.image || !o.prompt) { console.error('usage: node wan.mjs <name> --image key.jpg --prompt "..."'); process.exit(1); }

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const get = async (u) => (await fetch(u)).json();

/* the GPU is shared: let the other ComfyUI finish first */
for (;;) {
  let q = null;
  try { q = OTHER && await get(`${OTHER}/queue`); } catch { /* not running */ }
  if (!q || (!q.queue_running.length && !q.queue_pending.length)) break;
  console.log('other ComfyUI is busy, waiting…'); await sleep(30000);
}

/* crop the keyframe to the exact size and upload it */
const dir = join(OUT, 'comfy', name), start = join(OUT, 'key', `${name}.start.png`);
mkdirSync(join(OUT, 'clips'), {recursive: true});
execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', o.image, '-vf', `scale=${o.w}:${o.h}:force_original_aspect_ratio=increase:flags=lanczos,crop=${o.w}:${o.h}`, '-frames:v', '1', start]);
const form = new FormData();
form.append('image', new Blob([readFileSync(start)], {type: 'image/png'}), `wanjian-${name}.png`);
form.append('overwrite', 'true');
const up = await (await fetch(`${COMFY}/upload/image`, {method: 'POST', body: form})).json();

const half = 2;
const sampler = (model, first) => ({class_type: 'KSamplerAdvanced', inputs: {model: [model, 0], add_noise: first ? 'enable' : 'disable', noise_seed: first ? o.seed : 0,
  steps: 4, cfg: 1, sampler_name: 'euler', scheduler: 'simple', positive: ['i2v', 0], negative: ['i2v', 1], latent_image: first ? ['i2v', 2] : ['s_hi', 0],
  start_at_step: first ? 0 : half, end_at_step: first ? half : 4, return_with_leftover_noise: first ? 'enable' : 'disable'}});
const model = (id, noise) => ({
  [`u_${id}`]: {class_type: 'UNETLoader', inputs: {unet_name: `wan2.2_i2v_${noise}_noise_14B_fp8_scaled.safetensors`, weight_dtype: 'default'}},
  [`l_${id}`]: {class_type: 'LoraLoaderModelOnly', inputs: {model: [`u_${id}`, 0], lora_name: `wan2.2_i2v_lightx2v_4steps_lora_v1_${noise}_noise.safetensors`, strength_model: 1}},
  [`m_${id}`]: {class_type: 'ModelSamplingSD3', inputs: {model: [`l_${id}`, 0], shift: o.shift}},
});
const graph = {
  ...model('hi', 'high'), ...model('lo', 'low'),
  clip: {class_type: 'CLIPLoader', inputs: {clip_name: 'umt5_xxl_fp8_e4m3fn_scaled.safetensors', type: 'wan', device: 'default'}},
  vae: {class_type: 'VAELoader', inputs: {vae_name: 'wan_2.1_vae.safetensors'}},
  pos: {class_type: 'CLIPTextEncode', inputs: {clip: ['clip', 0], text: o.prompt}},
  neg: {class_type: 'CLIPTextEncode', inputs: {clip: ['clip', 0], text: NEG}},
  img: {class_type: 'LoadImage', inputs: {image: up.name}},
  i2v: {class_type: 'WanImageToVideo', inputs: {positive: ['pos', 0], negative: ['neg', 0], vae: ['vae', 0], width: o.w, height: o.h, length: o.frames, batch_size: 1, start_image: ['img', 0]}},
  s_hi: sampler('m_hi', true), s_lo: sampler('m_lo', false),
  dec: {class_type: 'VAEDecode', inputs: {samples: ['s_lo', 0], vae: ['vae', 0]}},
  save: {class_type: 'SaveImage', inputs: {images: ['dec', 0], filename_prefix: `${name}/f`}},
};

if (existsSync(dir)) rmSync(dir, {recursive: true});
const t0 = Date.now();
const res = await (await fetch(`${COMFY}/prompt`, {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({prompt: graph, client_id: 'wanjian'})})).json();
if (!res.prompt_id) { console.error('rejected', JSON.stringify(res).slice(0, 1500)); process.exit(1); }
console.log('queued', res.prompt_id, `${o.w}x${o.h} ${o.frames}f seed ${o.seed}`);
for (;;) {
  await sleep(5000);
  const h = (await get(`${COMFY}/history/${res.prompt_id}`))[res.prompt_id];
  if (!h) continue;
  if (h.status?.status_str === 'error') { console.error('error', JSON.stringify(h.status.messages).slice(0, 2000)); process.exit(1); }
  if (h.status?.completed) break;
}
const secs = Math.round((Date.now() - t0) / 1000), n = readdirSync(dir).filter((f) => f.endsWith('.png')).length;
const mp4 = join(OUT, 'clips', `${name}.mp4`);
execFileSync('ffmpeg', ['-v', 'error', '-y', '-framerate', String(o.fps), '-i', join(dir, 'f_%05d_.png'), '-c:v', 'libx264', '-crf', '14', '-preset', 'slow', '-pix_fmt', 'yuv420p', mp4]);
writeFileSync(join(OUT, 'clips', `${name}.json`), JSON.stringify({...o, name, seconds: secs, frames_out: n}, null, 1));
console.log('done', resolve(mp4), `${n} frames in ${secs}s`);
