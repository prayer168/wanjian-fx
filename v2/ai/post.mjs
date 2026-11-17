// Finish one generated shot: Wan's 16 fps PNG frames -> motion-interpolated, upscaled to 1080p, graded, with a little grain.
//   node post.mjs <name> [--speed 1] [--fps 30] [--from 0 --to 81] [--out file.mp4]
// --speed > 1 plays the action faster (the 4-step LoRA tends to move in slight slow motion); --from/--to trim in source frames.
import {execFileSync} from 'node:child_process';
import {join} from 'node:path';

const OUT = process.env.AI_OUT || 'D:/wanjian-fx/v2-out/ai';
const a = process.argv.slice(2), name = a[0], o = {speed: 1, fps: 30, from: 0, to: 0, src: 16, out: ''};
for (let i = 1; i < a.length; i++) { const k = a[i].replace(/^--/, ''); o[k] = k === 'out' ? a[++i] : Number(a[++i]); }
if (!name) { console.error('usage: node post.mjs <name> [--speed 1] [--fps 30]'); process.exit(1); }

const vf = [
  o.to ? `trim=start_frame=${o.from}:end_frame=${o.to},setpts=PTS-STARTPTS` : null,
  o.speed !== 1 ? `setpts=PTS/${o.speed}` : null,
  `minterpolate=fps=${o.fps}:mi_mode=mci:mc_mode=aobmc:me_mode=bidir:vsbmc=1`,
  'scale=1920:1080:flags=lanczos',
  'unsharp=5:5:0.6:5:5:0.0',
  /* filmic contrast with cool shadows and slightly warm highlights */
  "curves=r='0/0 0.25/0.22 0.75/0.78 1/1':g='0/0 0.25/0.235 0.75/0.77 1/0.99':b='0/0.015 0.25/0.26 0.75/0.75 1/0.97'",
  'eq=saturation=0.92',
  'vignette=PI/5.5',
  'noise=alls=5:allf=t+u',
  'format=yuv420p',
].filter(Boolean).join(',');
const mp4 = o.out || join(OUT, 'clips', `${name}.post.mp4`);
execFileSync('ffmpeg', ['-v', 'error', '-y', '-framerate', String(o.src), '-i', join(OUT, 'comfy', name, 'f_%05d_.png'), '-vf', vf, '-c:v', 'libx264', '-crf', '15', '-preset', 'slow', mp4], {stdio: 'inherit'});
console.log('done', mp4);
