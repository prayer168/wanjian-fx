// Batch image-to-video for film.mjs: every shot's keyframe -> Wan 2.2 (through wan.mjs) at 1280x720, frame count sized to the
// shot's edit length. Shots that already have a clip are skipped unless listed after --redo. Writes a 4-frame review strip per clip.
//   node shoot.mjs [ids...] [--redo] [--seed 1] [--w 1280 --h 720]
// The GPU is shared with another ComfyUI on 8188: wan.mjs waits for its queue, and here we ask it to unload its models while idle.
import {existsSync, readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {join, dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {SHOTS} from './film.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const OUT = process.env.AI_OUT || 'D:/wanjian-fx/v2-out/ai', COMFY = process.env.COMFY || 'http://127.0.0.1:8189', OTHER = process.env.OTHER_COMFY ?? 'http://127.0.0.1:8188';
const a = process.argv.slice(2), redo = a.includes('--redo');
const opt = (k, d) => a.includes(`--${k}`) ? Number(a[a.indexOf(`--${k}`) + 1]) : d;
const only = a.filter((x, i) => !x.startsWith('--') && !a[i - 1]?.startsWith('--'));
const W = opt('w', 1280), H = opt('h', 720), SEED = opt('seed', 1);
const STYLE = 'Photorealistic live-action feature film footage, real actors, natural physical motion, faces and costumes stay consistent, cinematic lighting, atmospheric haze, film grain.';

const list = SHOTS.filter((s) => (!only.length || only.includes(s.id)) && (redo || !existsSync(join(OUT, 'clips', `${s.id}.mp4`))));
console.log(`${list.length} shots to generate`);
for (const s of list) {
  const key = join(OUT, 'key', `${s.id}.jpg`);
  if (!existsSync(key)) { console.log('no keyframe, skip', s.id); continue; }
  const frames = Math.min(81, Math.ceil(((s.dur * (s.speed || 1)) + 0.5) * 16 / 4) * 4 + 1);
  /* our ComfyUI must be up: give it a few minutes (it may be restarting), then stop rather than fail every shot in turn */
  let up = false;
  for (let k = 0; k < 18 && !up; k++) { try { up = (await fetch(`${COMFY}/queue`)).ok; } catch { await new Promise((r) => setTimeout(r, 10000)); } }
  if (!up) { console.error(`ComfyUI at ${COMFY} is not running, stopping`); process.exit(1); }
  try {
    const q = await (await fetch(`${OTHER}/queue`)).json();
    if (!q.queue_running.length && !q.queue_pending.length) await fetch(`${OTHER}/free`, {method: 'POST', headers: {'Content-Type': 'application/json'}, body: '{"unload_models":true,"free_memory":true}'});
  } catch { /* not running */ }
  const t0 = Date.now();
  try {
    execFileSync('node', [join(here, 'wan.mjs'), s.id, '--image', key, '--prompt', `${s.move} ${STYLE}`, '--w', String(W), '--h', String(H), '--frames', String(frames), '--seed', String(s.seed ?? SEED)], {stdio: 'inherit'});
  } catch { console.error('FAILED', s.id); continue; }
  const clip = join(OUT, 'clips', `${s.id}.mp4`);
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', clip, '-vf', `select='not(mod(n\\,${Math.floor(frames / 4)}))',scale=480:-2,tile=4x1`, '-frames:v', '1', '-q:v', '3', join(OUT, 'clips', `${s.id}.sheet.jpg`)]);
  console.log(`[${new Date().toLocaleTimeString()}] ${s.id} ${frames}f in ${Math.round((Date.now() - t0) / 1000)}s`);
}
