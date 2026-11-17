// Batch keyframes for film.mjs with Nano Banana Pro (through keyframe.mjs). Costume sheets and plates first, then one still per shot,
// each carrying the reference images it names. Finished stills are skipped unless listed after --redo.
//   node keys.mjs cast [names...]          costume sheets + location plates  -> <AI_OUT>/key/cast/<name>.jpg
//   node keys.mjs shots [ids...]           shot keyframes                    -> <AI_OUT>/key/<id>.jpg
//   node keys.mjs sheet                    contact sheet of all shot keyframes -> <AI_OUT>/key/_contact.jpg
//   --redo   regenerate even if the file exists     --jobs 3   parallel requests
import {existsSync} from 'node:fs';
import {execFile, execFileSync} from 'node:child_process';
import {join, dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {LOOK, WHO, CAST, SHOTS} from './film.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const OUT = process.env.AI_OUT || 'D:/wanjian-fx/v2-out/ai';
const a = process.argv.slice(2), mode = a[0], redo = a.includes('--redo');
const jobs = a.includes('--jobs') ? Number(a[a.indexOf('--jobs') + 1]) : 3;
const only = a.slice(1).filter((x, i, l) => !x.startsWith('--') && l[i - 1] !== '--jobs');

/* refs: cast names, 'test02', or another shot's keyframe (sNN, nNN) */
const castFile = (n) => n === 'test02' || /^[sn]\d\d[a-z]?$/.test(n) ? join(OUT, 'key', `${n}.jpg`) : join(OUT, 'key', 'cast', `${n}.jpg`);
const expand = (refs) => refs.flatMap((r) => r === 'S' ? ['S_sheet', 'S_face'] : r === 'M' ? ['M_sheet', 'M_face'] : [r]);
const fill = (t) => t.replace(/\$LOOK/g, LOOK.pre).replace(/\$POST/g, LOOK.post).replace(/\$FX/g, LOOK.fx).replace(/\$S\b/g, WHO.S).replace(/\$M\b/g, WHO.M);

function task(out, prompt, refs) {
  const args = [join(here, 'keyframe.mjs'), out, '--prompt', prompt, ...refs.flatMap((r) => ['--ref', castFile(r)])];
  return () => new Promise((ok) => execFile('node', args, {maxBuffer: 1 << 24}, (err, so, se) => { console.log((so + se).trim()); ok(!err); }));
}

async function run(list) {
  let i = 0, fails = 0;
  await Promise.all(Array.from({length: jobs}, async () => { while (i < list.length) if (!(await list[i++]())) fails++; }));
  if (fails) { console.error(`${fails} failed`); process.exitCode = 1; }
}

if (mode === 'cast') {
  /* sheets need only test02; plates may reference other plates, so do them in dependency order */
  const order = ['S_sheet', 'S_face', 'M_sheet', 'M_face', 'city', 'tower', 'bridge'].filter((n) => !only.length || only.includes(n));
  const todo = (names) => names.filter((n) => redo || !existsSync(castFile(n))).map((n) => task(castFile(n), fill(CAST[n].prompt), CAST[n].ref));
  await run(todo(order.filter((n) => !['tower', 'bridge'].includes(n))));
  await run(todo(order.filter((n) => ['tower', 'bridge'].includes(n))));
} else if (mode === 'shots') {
  const list = SHOTS.filter((s) => (!only.length || only.includes(s.id)) && (redo || !existsSync(join(OUT, 'key', `${s.id}.jpg`))));
  const guide = `Use the reference images only to keep the characters' faces, hair, bodies and costumes and the location's architecture exactly the same; compose an entirely new camera shot exactly as described below.`;
  await run(list.map((s) => task(join(OUT, 'key', `${s.id}.jpg`), `${LOOK.pre}\n\n${guide}\n\n${fill(s.key)}\n\n${LOOK.post}`, expand(s.refs))));
} else if (mode === 'sheet') {
  const ids = SHOTS.map((s) => s.id).filter((id) => existsSync(join(OUT, 'key', `${id}.jpg`))), files = ids.map((id) => join(OUT, 'key', `${id}.jpg`));
  const inputs = files.flatMap((f) => ['-i', f]);
  const cols = 6, rows = Math.ceil(files.length / cols);
  const lab = files.map((f, i) => `[${i}:v]scale=480:270,drawtext=fontfile='C\\:/Windows/Fonts/arial.ttf':text='${ids[i]}':x=8:y=8:fontsize=26:fontcolor=white:box=1:boxcolor=black@0.6[v${i}]`).join(';');
  const pad = Array.from({length: cols * rows - files.length}, (_, k) => `color=black:s=480x270:d=1[p${k}]`).join(';');
  const all = [...files.map((_, i) => `[v${i}]`), ...Array.from({length: cols * rows - files.length}, (_, k) => `[p${k}]`)].join('');
  const fc = [lab, pad, `${all}xstack=inputs=${cols * rows}:layout=${Array.from({length: cols * rows}, (_, k) => `${(k % cols) * 480}_${Math.floor(k / cols) * 270}`).join('|')}`].filter(Boolean).join(';');
  execFileSync('ffmpeg', ['-v', 'error', '-y', ...inputs, '-filter_complex', fc, '-frames:v', '1', '-q:v', '3', join(OUT, 'key', '_contact.jpg')], {stdio: 'inherit'});
  console.log('sheet', join(OUT, 'key', '_contact.jpg'));
} else console.error('usage: node keys.mjs cast|shots|sheet [ids...] [--redo] [--jobs 3]');
