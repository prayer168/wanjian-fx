// The edit: every shot finished (speed, trim to its length, 16 -> 24 fps motion interpolation, 1080p, grade, grain, 2:1 letterbox,
// impact flashes), cut together with a black head, then the mix — effects, the Lyria score ducked under the voices, the voices
// with a short room tail — normalised to -14 LUFS / -1 dBTP.
// A shot without a Wan clip yet stands in as its keyframe with a slow push in, so a rough cut can be watched at any time.
//   node edit.mjs [--out name] [--only s01,s02]      -> <AI_OUT>/<name>.mp4 (default epic-cut)
import {existsSync, mkdirSync, writeFileSync, statSync} from 'node:fs';
import {execFileSync, spawnSync} from 'node:child_process';
import {join} from 'node:path';
import {SHOTS, LINES, HEAD, TAIL} from './film.mjs';

const OUT = process.env.AI_OUT || 'D:/wanjian-fx/v2-out/ai', SEG = join(OUT, 'seg');
const a = process.argv.slice(2), name = a.includes('--out') ? a[a.indexOf('--out') + 1] : 'epic-cut';
const only = a.includes('--only') ? a[a.indexOf('--only') + 1].split(',') : null;
mkdirSync(SEG, {recursive: true});
const ff = (args) => execFileSync('ffmpeg', ['-v', 'error', '-y', ...args], {stdio: 'inherit'});

/* white impact flashes, seconds into the finished shot */
const FLASH = {s08: .75, s09: .3, s11: .2, s15: .5, s23: .55, s31: .5, s35: .45, s41: .55};
const FPS = 24;
const GRADE = [
  'scale=1920:1080:flags=lanczos', 'unsharp=5:5:0.5:5:5:0.0',
  "curves=r='0/0 0.25/0.22 0.75/0.78 1/1':g='0/0 0.25/0.235 0.75/0.77 1/0.99':b='0/0.015 0.25/0.26 0.75/0.75 1/0.97'",
  'eq=saturation=0.9:contrast=1.04', 'vignette=PI/5.5', 'noise=alls=5:allf=t+u',
  'crop=1920:960:0:60,pad=1920:1080:0:60:black', 'format=yuv420p',
].join(',');

const ships = SHOTS.filter((s) => !only || only.includes(s.id)), list = [];
for (const s of ships) {
  const clip = join(OUT, 'clips', `${s.id}.mp4`), seg = join(SEG, `${s.id}.mp4`), sp = s.speed || 1;
  const flash = FLASH[s.id] !== undefined ? `,eq=brightness=0.45:contrast=0.7:enable='between(t,${FLASH[s.id]},${FLASH[s.id] + 0.09})'` : '';
  if (existsSync(clip) && !(existsSync(seg) && statSync(seg).mtimeMs > statSync(clip).mtimeMs)) {
    /* real footage: speed, interpolate, hold the last frame if the clip runs short, cut to length */
    ff(['-i', clip, '-vf', `setpts=PTS/${sp},minterpolate=fps=${FPS}:mi_mode=mci:mc_mode=aobmc:me_mode=bidir:vsbmc=1,tpad=stop_mode=clone:stop_duration=3,trim=0:${s.dur},setpts=PTS-STARTPTS,${GRADE}${flash}`,
      '-r', String(FPS), '-an', '-c:v', 'libx264', '-crf', '14', '-preset', 'medium', seg]);
  } else if (!existsSync(clip)) {
    /* stand-in: the keyframe with a slow push in */
    const n = Math.round(s.dur * FPS);
    ff(['-loop', '1', '-i', join(OUT, 'key', `${s.id}.jpg`), '-vf', `scale=3840:2160,zoompan=z='1+0.06*on/${n}':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=${n}:s=1920x1080:fps=${FPS},${GRADE}${flash}`,
      '-frames:v', String(n), '-an', '-c:v', 'libx264', '-crf', '16', '-preset', 'fast', join(SEG, `${s.id}.still.mp4`)]);
    list.push(join(SEG, `${s.id}.still.mp4`)); continue;
  }
  list.push(seg);
}
console.log(`${list.filter((f) => !f.includes('.still.')).length} shots from footage, ${list.filter((f) => f.includes('.still.')).length} stand-ins`);

/* picture: black head, the shots, fade out at the end, black tail */
ff(['-f', 'lavfi', '-i', `color=black:s=1920x1080:r=${FPS}:d=${HEAD}`, '-c:v', 'libx264', '-crf', '14', '-pix_fmt', 'yuv420p', join(SEG, '_head.mp4')]);
ff(['-f', 'lavfi', '-i', `color=black:s=1920x1080:r=${FPS}:d=${TAIL}`, '-c:v', 'libx264', '-crf', '14', '-pix_fmt', 'yuv420p', join(SEG, '_tail.mp4')]);
writeFileSync(join(SEG, '_list.txt'), [join(SEG, '_head.mp4'), ...list, join(SEG, '_tail.mp4')].map((f) => `file '${f.replace(/\\/g, '/')}'`).join('\n'));
const pic = join(SEG, '_picture.mp4');
const total = HEAD + ships.reduce((t, s) => t + s.dur, 0);
ff(['-f', 'concat', '-safe', '0', '-i', join(SEG, '_list.txt'), '-vf', `fade=t=out:st=${(total - 2.5).toFixed(2)}:d=2.5`, '-c:v', 'libx264', '-crf', '16', '-preset', 'slow', '-pix_fmt', 'yuv420p', pic]);

/* sound: effects + score ducked under the voices + voices, all on the same timeline */
const T = {}; { let t = HEAD; for (const s of SHOTS) { T[s.id] = t; t += s.dur; } }
const lines = only ? [] : LINES.filter((L) => existsSync(join(OUT, 'vo', `${L.id}.wav`)));
const args = ['-i', join(OUT, 'sfx.wav'), '-i', join(OUT, 'music', 'score.wav'), ...lines.flatMap((L) => ['-i', join(OUT, 'vo', `${L.id}.wav`)])];
let f = '[0:a]aresample=48000,volume=0.8[fx];[1:a]aresample=48000,volume=0.85[mu0];';
lines.forEach((L, i) => {
  const ms = Math.round((T[L.shot] + L.at) * 1000);
  f += `[${i + 2}:a]aresample=48000,aformat=channel_layouts=stereo,silenceremove=start_periods=1:start_threshold=-50dB,highpass=f=80,aecho=0.8:0.35:40|75:0.15|0.08,volume=1.8,adelay=${ms}|${ms}[v${i}];`;
});
if (lines.length) {
  f += lines.map((_, i) => `[v${i}]`).join('') + `amix=inputs=${lines.length}:normalize=0,asplit=2[vo][vsc];`;
  f += '[mu0][vsc]sidechaincompress=threshold=0.03:ratio=6:attack=20:release=500[mu];[fx][mu][vo]amix=inputs=3:normalize=0[mix];';
} else f += '[fx][mu0]amix=inputs=2:normalize=0[mix];';
f += `[mix]atrim=0:${(total + TAIL).toFixed(2)}[out]`;
const raw = join(OUT, 'mix.raw.wav'), wav = join(OUT, 'mix.wav');
ff([...args, '-filter_complex', f, '-map', '[out]', '-ar', '48000', '-c:a', 'pcm_f32le', raw]);
/* two-pass loudness normalisation (one pass lands ~1 LU off on a mix this dynamic) */
const LN = 'I=-14:TP=-1.5:LRA=16';
const meas = spawnSync('ffmpeg', ['-hide_banner', '-i', raw, '-af', `loudnorm=${LN}:print_format=json`, '-f', 'null', '-'], {encoding: 'utf8'}).stderr;
const m = JSON.parse(meas.slice(meas.lastIndexOf('{'), meas.lastIndexOf('}') + 1));
ff(['-i', raw, '-af', `loudnorm=${LN}:measured_I=${m.input_i}:measured_TP=${m.input_tp}:measured_LRA=${m.input_lra}:measured_thresh=${m.input_thresh}:offset=${m.target_offset}:linear=true,aresample=48000`, '-c:a', 'pcm_s16le', wav]);

const mp4 = join(OUT, `${name}.mp4`);
ff(['-i', pic, '-i', wav, '-map', '0:v', '-map', '1:a', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '320k', '-shortest', '-movflags', '+faststart', mp4]);
console.log('done', mp4, `${(total + TAIL).toFixed(1)}s`);
