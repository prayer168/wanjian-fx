// The edit: every shot finished (speed or speed ramp, trim to its length, 16 -> 24 fps motion interpolation, 1080p, grade, grain,
// 2:1 letterbox, impact flashes), joined with straight cuts or dissolves, a black head and tail, then the mix — effects, crowd,
// the score ducked under the voices, the voices levelled to one loudness — normalised to -14 LUFS / -1.5 dBTP.
// A shot without a Wan clip yet stands in as its keyframe with a slow push in, so a rough cut can be watched at any time.
// A shot with an extension clip (<id>_x) plays the two passes back to back.
//   node edit.mjs [--out name] [--only s01,s02]      -> <AI_OUT>/<name>.mp4 (default epic-cut)
import {existsSync, mkdirSync, writeFileSync, readFileSync, statSync} from 'node:fs';
import {execFileSync, spawnSync} from 'node:child_process';
import {join} from 'node:path';
import {SHOTS, LINES, HEAD, TAIL, FLASH, pieces, timeline, frames} from './film.mjs';

const OUT = process.env.AI_OUT || 'D:/wanjian-fx/v2-out/ai', SEG = join(OUT, 'seg');
const a = process.argv.slice(2), name = a.includes('--out') ? a[a.indexOf('--out') + 1] : 'epic-cut';
const only = a.includes('--only') ? a[a.indexOf('--only') + 1].split(',') : null;
mkdirSync(SEG, {recursive: true});
const ff = (args) => execFileSync('ffmpeg', ['-v', 'error', '-y', ...args], {stdio: 'inherit'});
const newer = (f, ...deps) => existsSync(f) && deps.every((d) => !existsSync(d) || statSync(f).mtimeMs > statSync(d).mtimeMs);

const FPS = 24;
const GRADE = [
  'scale=1920:1080:flags=lanczos', 'unsharp=5:5:0.5:5:5:0.0',
  "curves=r='0/0 0.25/0.22 0.75/0.78 1/1':g='0/0 0.25/0.235 0.75/0.77 1/0.99':b='0/0.015 0.25/0.26 0.75/0.75 1/0.97'",
  'eq=saturation=0.9:contrast=1.04', 'vignette=PI/5.5', 'noise=alls=5:allf=t+u',
  'crop=1920:960:0:60,pad=1920:1080:0:60:black', 'format=yuv420p',
].join(',');

/* the source clip of a shot: one Wan pass, or the pass and its continuation joined (the continuation's first frame repeats the
   last frame of the first pass, so it is dropped) */
function source(s) {
  const c = join(OUT, 'clips', `${s.id}.mp4`), x = join(OUT, 'clips', `${s.id}_x.mp4`);
  if (!existsSync(x)) return c;
  const j = join(SEG, `${s.id}.long.mp4`);
  if (!newer(j, c, x)) ff(['-i', c, '-i', x, '-filter_complex', '[1:v]trim=start_frame=1,setpts=PTS-STARTPTS[b];[0:v][b]concat=n=2:v=1[v]', '-map', '[v]', '-c:v', 'libx264', '-crf', '12', '-preset', 'fast', j]);
  return j;
}

/* speed or speed ramp as a filter chain on [0:v]: each piece is cut out and retimed, then the pieces are joined */
function retime(s) {
  const P = pieces(s);
  if (P.length === 1) return `[0:v]setpts=PTS/${P[0][2]}[r]`;
  return P.map(([f, t, sp], i) => `[0:v]trim=${f}:${t},setpts=(PTS-STARTPTS)/${sp}[p${i}]`).join(';') + ';' + P.map((_, i) => `[p${i}]`).join('') + `concat=n=${P.length}:v=1[r]`;
}

const ships = SHOTS.filter((s) => !only || only.includes(s.id)), segs = [];
for (const s of ships) {
  const clip = join(OUT, 'clips', `${s.id}.mp4`), seg = join(SEG, `${s.id}.mp4`);
  const flash = FLASH[s.id] !== undefined ? `,eq=brightness=0.45:contrast=0.7:enable='between(t,${FLASH[s.id]},${FLASH[s.id] + 0.09})'` : '';
  if (!s.still && existsSync(clip)) {
    /* real footage: retime, interpolate, hold the last frame if the clip runs short, cut to length */
    const src = source(s), stamp = JSON.stringify([s.dur, pieces(s), flash, 'f', s.flip || 0]);
    if (!(newer(seg, src) && existsSync(seg + '.key') && readFileSync(seg + '.key', 'utf8') === stamp)) {
      ff(['-i', src, '-filter_complex', `${retime(s)};[r]${s.flip ? 'hflip,' : ''}minterpolate=fps=${FPS}:mi_mode=mci:mc_mode=aobmc:me_mode=bidir:vsbmc=1,tpad=stop_mode=clone:stop_duration=3,setpts=PTS-STARTPTS,${GRADE}${flash}[v]`,
        '-map', '[v]', '-r', String(FPS), '-frames:v', String(Math.round(s.dur * FPS)), '-an', '-c:v', 'libx264', '-crf', '14', '-preset', 'medium', seg]);
      writeFileSync(seg + '.key', stamp);
    }
    segs.push({s, f: seg});
  } else {
    /* stand-in (or a shot meant to be still): the keyframe with a slow push in. The JPEG is full range: converted to TV range,
       square pixels and untagged like the footage, or a run that mixes it with footage makes ffmpeg rebuild the graph mid-run
       and restart the timestamps */
    const n = Math.round(s.dur * FPS), f = join(SEG, `${s.id}.still.mp4`), key = join(OUT, 'key', `${s.id}.jpg`), stamp = JSON.stringify([n, flash, 'tv']);
    if (!(newer(f, key) && existsSync(f + '.key') && readFileSync(f + '.key', 'utf8') === stamp)) {
      ff(['-loop', '1', '-i', key, '-vf', `scale=3840:2160:out_range=tv,zoompan=z='1+0.06*on/${n}':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=${n}:s=1920x1080:fps=${FPS},${GRADE}${flash},setsar=1,setparams=range=unknown:colorspace=unknown:color_primaries=unknown:color_trc=unknown`,
        '-frames:v', String(n), '-an', '-c:v', 'libx264', '-crf', '16', '-preset', 'fast', f]);
      writeFileSync(f + '.key', stamp);
    }
    segs.push({s, f});
  }
}
console.log(`${segs.filter((x) => !x.f.includes('.still.')).length} shots from footage, ${segs.filter((x) => x.f.includes('.still.')).length} stand-ins`);

/* picture: runs of straight cuts are joined losslessly; runs are joined to each other with the dissolve of the shot that opens
   the next run; black head and tail; fade out at the end */
const {T, end} = timeline();
/* rebuilt only when a shot segment or the way they are joined has changed, so a sound-only pass skips it */
const pic = join(SEG, '_picture.mp4'), picKey = JSON.stringify([segs.map((x) => [x.f, statSync(x.f).mtimeMs]), SHOTS.map((s) => [s.id, s.dur, s.tr]), only]);
const same = existsSync(pic + '.key') && readFileSync(pic + '.key', 'utf8') === picKey;
const runs = [];
for (const x of segs) { if (!runs.length || (x.s.tr && !only)) runs.push({tr: x.s.tr, list: []}); runs.at(-1).list.push(x); }
runs.forEach((r, i) => {
  r.f = join(SEG, `_run${i}.mp4`);
  writeFileSync(r.f + '.txt', r.list.map((x) => `file '${x.f.replace(/\\/g, '/')}'`).join('\n'));
  if (!same) ff(['-f', 'concat', '-safe', '0', '-i', r.f + '.txt', '-c', 'copy', '-bsf:v', 'h264_metadata=video_full_range_flag=0', r.f]);   // one range tag for every shot in the run
  r.len = r.list.reduce((t, x) => t + frames(x.s.dur), 0);
});
const head = join(SEG, '_head.mp4'), tail = join(SEG, '_tail.mp4');
ff(['-f', 'lavfi', '-i', `color=black:s=1920x1080:r=${FPS}:d=${HEAD}`, '-c:v', 'libx264', '-crf', '14', '-pix_fmt', 'yuv420p', head]);
ff(['-f', 'lavfi', '-i', `color=black:s=1920x1080:r=${FPS}:d=${TAIL}`, '-c:v', 'libx264', '-crf', '14', '-pix_fmt', 'yuv420p', tail]);
const ins = [head, ...runs.map((r) => r.f), tail].flatMap((f) => ['-i', f]);
/* every input on the same timebase first: xfade refuses to join a concat output (1/1000000) with a raw input */
let g = [head, ...runs, tail].map((_, k) => `[${k}:v]settb=AVTB,setpts=N/${FPS}/TB[i${k}];`).join('') + '[i0][i1]concat=n=2:v=1[c0];', acc = HEAD + runs[0].len;
for (let i = 1; i < runs.length; i++) {
  const d = frames(runs[i].tr?.d || 0);
  g += d ? `[c${i - 1}][i${i + 1}]xfade=transition=fade:duration=${d}:offset=${(acc - d).toFixed(3)}[c${i}];` : `[c${i - 1}][i${i + 1}]concat=n=2:v=1[c${i}];`;
  acc += runs[i].len - d;
}
const total = only ? acc : end;
g += `[c${runs.length - 1}]fade=t=out:st=${(total - 2.5).toFixed(2)}:d=2.5[cf];[cf][i${runs.length + 1}]concat=n=2:v=1,format=yuv420p[v]`;
if (!same) { ff([...ins, '-filter_complex', g, '-map', '[v]', '-r', String(FPS), '-c:v', 'libx264', '-crf', '16', '-preset', 'slow', pic]); writeFileSync(pic + '.key', picKey); }

/* sound: effects + crowd + score ducked under the voices + voices, all on the same timeline. Every voice line is first levelled
   to the same loudness so no line is buried. */
const lines = only ? [] : LINES.filter((L) => existsSync(join(OUT, 'vo', `${L.id}.wav`)));
const VOL = join(OUT, 'vo', 'lev'); mkdirSync(VOL, {recursive: true});
for (const L of lines) {
  const i = join(OUT, 'vo', `${L.id}.wav`), o = join(VOL, `${L.id}.wav`), tempo = L.tempo ? `atempo=${L.tempo},` : '';   // tempo: a line spoken a little faster to fit its shot
  if (!(newer(o, i) && existsSync(o + '.key') && readFileSync(o + '.key', 'utf8') === tempo)) {
    ff(['-i', i, '-af', `silenceremove=start_periods=1:start_threshold=-50dB,${tempo}highpass=f=80,loudnorm=I=-16:TP=-2:LRA=7`, '-ar', '48000', o]);
    writeFileSync(o + '.key', tempo);
  }
}
const crowd = join(OUT, 'crowd.wav');
const args = ['-i', join(OUT, 'sfx.wav'), '-i', join(OUT, 'music', 'score.wav'), ...(existsSync(crowd) ? ['-i', crowd] : ['-f', 'lavfi', '-t', '1', '-i', 'anullsrc=r=48000:cl=stereo']),
  ...lines.flatMap((L) => ['-i', join(VOL, `${L.id}.wav`)])];
/* a fixed dip under every line on top of the sidechain (which lets go in the pauses inside a line): music −8 dB, effects −4 dB,
   0.25 s ramps either side */
const spans = lines.map((L) => { const a = T[L.shot] + L.at, len = +execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', join(VOL, `${L.id}.wav`)]).toString(); return [a - .1, a + len + .2]; });
const dip = (depth) => spans.length ? `,volume='1-${depth}*${spans.reduce((e, [a, b]) => `max(${e},clip((t-${(a - .25).toFixed(2)})/0.25,0,1)*clip((${(b + .25).toFixed(2)}-t)/0.25,0,1))`, '0')}':eval=frame` : '';
let f = `[0:a]aresample=48000,volume=0.9${dip(.37)}[fx];[1:a]aresample=48000,volume=0.7${dip(.6)}[mu0];[2:a]aresample=48000,aformat=channel_layouts=stereo,volume=0.9[cr];`;
lines.forEach((L, i) => {
  const ms = Math.round((T[L.shot] + L.at) * 1000);
  f += `[${i + 3}:a]aformat=channel_layouts=stereo,aecho=0.8:0.3:35|70:0.12|0.06,volume=2.8,adelay=${ms}|${ms}[v${i}];`;
});
if (lines.length) {
  f += lines.map((_, i) => `[v${i}]`).join('') + `amix=inputs=${lines.length}:normalize=0,apad=whole_dur=${(total + TAIL).toFixed(2)},asplit=5[vo][vsc][vsc2][vsc3][vstem];`;   // padded: a sidechain compressor stops when its key input ends
  f += '[mu0][vsc]sidechaincompress=threshold=0.02:ratio=10:attack=15:release=600:makeup=1[mu];[fx][vsc2]sidechaincompress=threshold=0.02:ratio=6:attack=10:release=400[fxd];[cr][vsc3]sidechaincompress=threshold=0.03:ratio=5:attack=15:release=500[crd];';
  f += '[fxd][crd][mu][vo]amix=inputs=4:normalize=0[mix];[vstem]atrim=0:' + (total + TAIL).toFixed(2) + '[vout];';
} else f += '[fx][cr][mu0]amix=inputs=3:normalize=0[mix];';
f += `[mix]atrim=0:${(total + TAIL).toFixed(2)}[out]`;
const raw = join(OUT, 'mix.raw.wav'), wav = join(OUT, 'mix.wav');
ff([...args, '-filter_complex', f, '-map', '[out]', '-ar', '48000', '-c:a', 'pcm_f32le', raw, ...(lines.length ? ['-map', '[vout]', '-ar', '48000', '-c:a', 'pcm_f32le', join(OUT, 'vo.stem.wav')] : [])]);   // the voices alone, for checking they sit on top of the mix
/* two-pass loudness normalisation (one pass lands ~1 LU off on a mix this dynamic) */
const LN = 'I=-14:TP=-1.5:LRA=16';
const meas = spawnSync('ffmpeg', ['-hide_banner', '-i', raw, '-af', `loudnorm=${LN}:print_format=json`, '-f', 'null', '-'], {encoding: 'utf8'}).stderr;
const m = JSON.parse(meas.slice(meas.lastIndexOf('{'), meas.lastIndexOf('}') + 1));
ff(['-i', raw, '-af', `loudnorm=${LN}:measured_I=${m.input_i}:measured_TP=${m.input_tp}:measured_LRA=${m.input_lra}:measured_thresh=${m.input_thresh}:offset=${m.target_offset}:linear=true,aresample=48000`, '-c:a', 'pcm_s16le', wav]);

const mp4 = join(OUT, `${name}.mp4`);
ff(['-i', pic, '-i', wav, '-map', '0:v', '-map', '1:a', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '320k', '-shortest', '-movflags', '+faststart', mp4]);
console.log('done', mp4, `${(total + TAIL).toFixed(1)}s`);
