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
  if (s.rev) {   /* rev: the first rev seconds played backwards then forwards — a wind-up the clip itself does not have */
    const r = join(SEG, `${s.id}.rev.mp4`);
    if (!newer(r, c)) ff(['-i', c, '-filter_complex', `[0:v]trim=0:${s.rev},setpts=PTS-STARTPTS,split[a][b];[a]reverse,trim=end_frame=${Math.round(s.rev * 16) - 1},setpts=PTS-STARTPTS[ra];[ra][b]concat=n=2:v=1[v]`, '-map', '[v]', '-c:v', 'libx264', '-crf', '12', '-preset', 'fast', r]);
    return r;
  }
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
  const stamp = tempo + 'exact';
  if (!(newer(o, i) && existsSync(o + '.key') && readFileSync(o + '.key', 'utf8') === stamp)) {
    /* silence trimmed at both ends, then measured and set to exactly -16 LUFS with one fixed gain (loudnorm's dynamic mode
       misses by up to 3 dB on clips this short), a limiter catching the peaks of the shouted lines */
    const tmp = o.replace(/\.wav$/, '.trim.wav'), trim = 'silenceremove=start_periods=1:start_threshold=-50dB';
    ff(['-i', i, '-af', `${trim},areverse,${trim},areverse,${tempo}highpass=f=80`, '-ar', '48000', '-c:a', 'pcm_f32le', tmp]);
    const lufs = (f) => { const r = spawnSync('ffmpeg', ['-hide_banner', '-i', f, '-af', 'ebur128', '-f', 'null', '-'], {encoding: 'utf8'}).stderr; return +r.slice(r.lastIndexOf('Integrated loudness')).match(/I:\s+(-?[\d.]+) LUFS/)[1]; };
    /* the limiter takes back a little on peaky lines, so the gain is corrected until the result is within 0.2 LU */
    let gain = -16 - lufs(tmp);
    for (let k = 0; k < 4; k++) {
      ff(['-i', tmp, '-af', `volume=${gain.toFixed(2)}dB,alimiter=limit=0.79:level=false:attack=2:release=50`, '-ar', '48000', o]);
      const miss = -16 - lufs(o); if (Math.abs(miss) < 0.2) break; gain += miss;
    }
    writeFileSync(o + '.key', stamp);
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
/* levelling: the raw mix swings ~10 dB between the fights and the quiet talk, so a slow gain rides it toward one loudness —
   the 3 s short-term loudness (read 1.5 s ahead, so the gain moves with the sound instead of after it), 85 % of the way to the
   target, at most ±8 dB, never lifting near-silence; smoothed both ways so it never pumps. A bus compressor then catches the
   single hits that are still sharp. */
const lev = join(OUT, 'mix.lev.wav');
{
  const r = spawnSync('ffmpeg', ['-hide_banner', '-nostats', '-i', raw, '-af', 'ebur128=metadata=1,ametadata=print:key=lavfi.r128.S:file=-', '-f', 'null', '-'], {encoding: 'utf8', maxBuffer: 1 << 28}).stdout;
  const S = []; let t = 0;
  for (const ln of r.split('\n')) { const p = ln.match(/pts_time:([\d.]+)/); if (p) t = +p[1]; const s = ln.match(/lavfi\.r128\.S=(-?[\d.]+)/); if (s) S.push([t, +s[1]]); }
  const at = (x) => { let k = S.findIndex(([u]) => u >= x); return k < 0 ? S.at(-1)[1] : S[k][1]; };
  const TGT = -14.5, R = 10, n = Math.ceil(S.at(-1)[0] * R) + 1, gdb = new Float64Array(n);
  for (let i = 0; i < n; i++) { const s = at(i / R + 1.5); gdb[i] = s < -40 ? 0 : Math.max(-8, Math.min(8, (TGT - s) * .85)); }
  for (const dir of [1, -1]) { let y = gdb[dir > 0 ? 0 : n - 1]; for (let k = 0; k < n; k++) { const i = dir > 0 ? k : n - 1 - k; y += (gdb[i] - y) * (1 / (R * .6)); gdb[i] = y; } }   // ~0.6 s one-pole, forward then backward
  const buf = readFileSync(raw), d = buf.indexOf('data'), len = buf.readUInt32LE(d + 4), x = new Float32Array(buf.buffer.slice(buf.byteOffset + d + 8, buf.byteOffset + d + 8 + len));
  for (let j = 0; j < x.length; j += 2) {
    const u = j / 2 / 48000 * R, i = Math.min(n - 2, Math.floor(u)), g = Math.pow(10, (gdb[i] + (gdb[i + 1] - gdb[i]) * (u - i)) / 20);
    x[j] *= g; x[j + 1] *= g;
  }
  const out = Buffer.from(buf); Buffer.from(x.buffer).copy(out, d + 8); writeFileSync(lev, out);
}
/* two-pass loudness normalisation, now with a tight loudness range */
const LN = 'I=-14:TP=-1.5:LRA=7', BUS = 'acompressor=threshold=0.2:ratio=3:attack=8:release=250:makeup=1';
const meas = spawnSync('ffmpeg', ['-hide_banner', '-i', lev, '-af', `${BUS},loudnorm=${LN}:print_format=json`, '-f', 'null', '-'], {encoding: 'utf8'}).stderr;
const m = JSON.parse(meas.slice(meas.lastIndexOf('{'), meas.lastIndexOf('}') + 1));
ff(['-i', lev, '-af', `${BUS},loudnorm=${LN}:measured_I=${m.input_i}:measured_TP=${m.input_tp}:measured_LRA=${m.input_lra}:measured_thresh=${m.input_thresh}:offset=${m.target_offset}:linear=true,aresample=48000`, '-c:a', 'pcm_s16le', wav]);

const mp4 = join(OUT, `${name}.mp4`);
/* subtitles burned into the lower letterbox bar (the picture is never covered): each line from its first word to 0.4 s after
   its last, Noto Serif TC (SIL Open Font License). <name>-clean.mp4 is the same film without them. */
const ts = (t) => { const cs = Math.round(t * 100); return `${Math.floor(cs / 360000)}:${String(Math.floor(cs / 6000) % 60).padStart(2, '0')}:${String(Math.floor(cs / 100) % 60).padStart(2, '0')}.${String(cs % 100).padStart(2, '0')}`; };
/* one short line at a time: each line is cut at its punctuation into phrases, neighbours joined while they stay within SUBMAX
   characters; each piece comes up when it is spoken — the cut is put in the pause in the voice nearest to where the piece
   should start by its share of the characters */
const SUBMAX = 8;
const subs = lines.flatMap((L, i) => {
  const a = T[L.shot] + L.at, len = spans[i][1] - spans[i][0] - .3, end = Math.min(a + len + .4, ...lines.slice(i + 1).map((M) => T[M.shot] + M.at - .1));
  const phrases = L.text.split(/(?<=[，。！？、])/).map((p) => p.replace(/[，。、]$/, '').trim()).filter(Boolean), pcs = [];
  for (const p of phrases) { const last = pcs.at(-1); if (last && (last + p).length <= SUBMAX && !/[！？]$/.test(last)) pcs[pcs.length - 1] = last + '　' + p; else pcs.push(p); }
  const sil = spawnSync('ffmpeg', ['-hide_banner', '-i', join(VOL, `${L.id}.wav`), '-af', 'silencedetect=noise=-32dB:d=0.12', '-f', 'null', '-'], {encoding: 'utf8'}).stderr;
  const gaps = [...sil.matchAll(/silence_start: ([\d.]+)[\s\S]*?silence_end: ([\d.]+)/g)].map((g) => (+g[1] + +g[2]) / 2).filter((g) => g > .2 && g < len - .2);
  const chars = (p) => p.replace(/　/g, '').length, total = chars(pcs.join('')); let acc = 0, prev = 0;
  const starts = pcs.map((p, k) => { if (!k) return 0; acc += chars(pcs[k - 1]); const want = len * acc / total, near = gaps.filter((g) => g > prev + .5).sort((x, y) => Math.abs(x - want) - Math.abs(y - want))[0]; return (prev = near !== undefined && Math.abs(near - want) < .8 ? near : want); });
  return pcs.map((p, k) => [a + starts[k], k + 1 < pcs.length ? a + starts[k + 1] : end, p]);
});
writeFileSync(join(OUT, `${name}.ass`), '﻿' + [
  '[Script Info]', 'ScriptType: v4.00+', 'PlayResX: 1920', 'PlayResY: 1080', 'WrapStyle: 2', '',
  '[V4+ Styles]', 'Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding',
  'Style: Line,Noto Serif TC,54,&H00EDF3F5,&H00EDF3F5,&H00000000,&H64000000,0,0,0,0,100,100,3,0,1,2.2,1,2,40,40,26,1', '',
  '[Events]', 'Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text',
  ...subs.map(([a, b, t]) => `Dialogue: 0,${ts(a)},${ts(b)},Line,,0,0,0,,{\\fad(80,100)}${t}`),
].join('\n'));
const subbed = join(SEG, '_picture.subs.mp4'), font = join(OUT, 'fonts', 'NotoSerifTC-VF.ttf');
if (!existsSync(font)) { mkdirSync(join(OUT, 'fonts'), {recursive: true}); writeFileSync(font, readFileSync('C:/Windows/Fonts/NotoSerifTC-VF.ttf')); }   // libass reads fonts from a folder next to the .ass (a drive letter in a filter argument needs double escaping)
execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', pic, '-vf', `subtitles=${name}.ass:fontsdir=fonts`, '-c:v', 'libx264', '-crf', '16', '-preset', 'slow', '-pix_fmt', 'yuv420p', subbed], {stdio: 'inherit', cwd: OUT});
ff(['-i', subbed, '-i', wav, '-map', '0:v', '-map', '1:a', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '320k', '-shortest', '-movflags', '+faststart', mp4]);
ff(['-i', pic, '-i', wav, '-map', '0:v', '-map', '1:a', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '320k', '-shortest', '-movflags', '+faststart', join(OUT, `${name}-clean.mp4`)]);
console.log('done', mp4, `${(total + TAIL).toFixed(1)}s`);
