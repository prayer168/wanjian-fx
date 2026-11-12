// Final mix with ffmpeg: effects/ambience (-3 dB), the continuous score, and the voice lines placed at their cue times.
// Voices get a short room tail; the score ducks under every line (side-chain compression). Output: out/audio/mix.wav
import {spawnSync} from 'node:child_process';
import {existsSync, readFileSync} from 'node:fs';
import {dirname, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {SECTIONS} from './sections.mjs';
import {LINES} from './lines.mjs';

const A = resolve(dirname(fileURLToPath(import.meta.url)), '../out/audio');
const START = {}; { let t = 0; for (const [n, l] of SECTIONS) { START[n] = t; t += l; } }
/* cue times: from the scenes' event lists when the renderer wrote them (they follow the choreography), else lines.mjs */
const cue = {};
for (const [n] of SECTIONS) { const f = `${A}/../scene-${n}.events.json`; if (existsSync(f)) for (const e of JSON.parse(readFileSync(f, 'utf8'))) if (e.type === 'vo') cue[e.id] = {sec: n, t: e.t}; }
const lines = LINES.map((L) => ({...L, ...(cue[L.id] || {})})).filter((L) => existsSync(`${A}/vo/${L.id}.wav`) && START[L.sec] !== undefined);
const args = ['-y', '-loglevel', 'error', '-i', `${A}/score.wav`, '-i', `${A}/music.wav`];
for (const L of lines) args.push('-i', `${A}/vo/${L.id}.wav`);
let f = '[0:a]volume=0.71[fx];';
lines.forEach((L, i) => {
  const ms = Math.round((START[L.sec] + L.t) * 1000), g = L.gain ?? 1.6;
  f += `[${i + 2}:a]aresample=48000,aformat=channel_layouts=stereo,highpass=f=90,aecho=0.8:0.4:45|80:0.18|0.10,volume=${g},adelay=${ms}|${ms}[v${i}];`;
});
f += lines.map((_, i) => `[v${i}]`).join('') + `amix=inputs=${lines.length}:normalize=0,asplit=2[vo][vosc];`;
f += '[1:a][vosc]sidechaincompress=threshold=0.04:ratio=5:attack=15:release=450:makeup=1[mus];';
f += '[fx][mus][vo]amix=inputs=3:normalize=0[out]';
const r = spawnSync('ffmpeg', [...args, '-filter_complex', f, '-map', '[out]', '-c:a', 'pcm_f32le', '-ar', '48000', `${A}/mix.wav`], {stdio: 'inherit'});
if (r.status) process.exit(r.status);
console.log('wrote', `${A}/mix.wav`, lines.length, 'voice lines');
