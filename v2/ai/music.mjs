// The score: one Lyria cue per act in the modern blockbuster-trailer style (braams, string ostinatos, sub hits, metallic risers,
// big percussion, a Chinese dizi motif on top), each written to the act's length on the edit timeline, with its hit points named
// in seconds from the cue start so the big accents land on the picture. Joined with short crossfades at the act cuts.
//   node music.mjs [cue...] [--redo]     -> <AI_OUT>/music/<cue>.mp3 and <AI_OUT>/music/score.wav
import {existsSync} from 'node:fs';
import {execFile, execFileSync} from 'node:child_process';
import {join, dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {TAIL, FLASH, timeline} from './film.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const OUT = process.env.AI_OUT || 'D:/wanjian-fx/v2-out/ai', M = join(OUT, 'music');
const a = process.argv.slice(2), redo = a.includes('--redo'), only = a.filter((x) => !x.startsWith('--'));
const {T, end} = timeline(); T.end = end + TAIL; T.zero = 0;
const at = (id, dt = 0) => T[id] + dt, hitAt = (id) => at(id, FLASH[id] ?? 0);

const BASE = 'Instrumental only, no vocals, no singing, no lyrics. Original film score for an epic Chinese wuxia fantasy film in modern blockbuster trailer style: deep low brass braams, pulsing ostinato strings, sub-bass hits, metallic risers, huge cinematic percussion, with a haunting Chinese dizi bamboo flute motif on top. Hard-hitting and tense. D minor.';
/* hits: [time on the edit timeline, what happens] — written into the prompt as seconds from the cue start */
const CUES = [
  {id: 'm1', from: 'zero', to: 's07', text: 'Night over an ancient cliff city under siege. Opens almost silent: one deep sub boom and a low sustained string drone, a lone breathy dizi motif. A quiet pulsing low string ostinato creeps in, then slow distant war drums and a long metallic riser into the next scene. 70 bpm, building slowly.',
    hits: [[at('s04'), 'the pulse starts'], [at('s07') - 2, 'riser peaks']]},
  {id: 'm2', from: 's07', to: 'n09', text: 'A fierce, fast duel on the rooftops of a bell tower between a swordsman and a warrior monk. Relentless 140 bpm: pounding toms and taiko, staccato string ostinato, sharp brass stabs, sub hits, metallic swells. Drops briefly to a tense pulse for spoken words, then slams back.',
    hits: [[at('n02'), 'drop to a tense low pulse under dialogue'], [at('s08'), 'the music slams back in, full force'], [hitAt('s08'), 'massive braam hit'], [hitAt('s15'), 'huge impact hit and a short silence'], [at('s16', 1), 'low tense pulse under dialogue']]},
  {id: 'm3', from: 'n09', to: 's28', text: 'A leap down into the rain, then time freezes and the raindrops hang in the air: the music suspends — weightless high shimmering strings, glassy textures, a slow heartbeat sub pulse, the dizi motif fragile and alone. Then a violent burst of drums and stabbing strings for a fast clash on a bridge, ending on an ominous low brass swell and distant war horns, dread rising.',
    hits: [[at('s19', 1), 'everything stops, weightless suspension'], [at('s22'), 'violent burst of drums'], [hitAt('s23'), 'big braam'], [at('s26'), 'sudden silence, one low tone'], [at('s27', 2), 'low brass swell of dread']]},
  {id: 'm4', from: 's28', to: 's44', text: 'The epic climax: ten thousand flaming arrows fill the sky, a monk strikes a giant bronze bell and a golden dome of light shields the city, a swordsman stops the arrows and turns them into a dragon of cold light that plunges into the river. Massive: huge trailer percussion, colossal braams, driving string ostinatos, choir-like synth pads (no words), the dizi motif soaring over the full sound as a heroic theme, building to an overwhelming peak, then a powerful release and a golden fading afterglow.',
    hits: [[at('s29'), 'drums and ostinato drive'], [hitAt('s31'), 'colossal bell-like braam and sub drop'], [hitAt('s35'), 'tension crack, everything drops to a held high string note'], [at('s37', 2.3), 'sudden silence'], [at('n14', 2.4), 'shimmering rise'], [at('s39'), 'heroic theme at full power'], [hitAt('s41'), 'the biggest hit of the score'], [at('s43'), 'release into a warm fading afterglow']]},
  {id: 'm5', from: 's44', to: 'end', text: 'Dawn after the battle, exhaustion, friendship and respect. A solo dizi plays a tender, nostalgic version of the heroic motif over warm low strings and soft pads, resolving into D major, a distant soft temple bell, peaceful ending with a long fade. 60 bpm.', hits: []},
].map((c) => ({...c, start: T[c.from], len: T[c.to] - T[c.from] + (c.id === 'm5' ? 0 : 2)}));

const todo = CUES.filter((c) => (!only.length || only.includes(c.id)) && (redo || !existsSync(join(M, `${c.id}.mp3`))));
await Promise.all(todo.map((c) => new Promise((ok) => {
  const marks = c.hits.map(([t, w]) => `at ${Math.round(t - c.start)} seconds: ${w}`).join('; ');
  const prompt = `${BASE} Duration: ${Math.round(c.len)} seconds. ${c.text}${marks ? ' Timing: ' + marks + '.' : ''}`;
  execFile('node', [join(here, 'lyria.mjs'), join(M, c.id), '--prompt', prompt], (e, so, se) => { console.log(c.id, Math.round(c.len) + 's', (so + se).trim().split('\n')[0]); ok(); });
})));

/* join: each cue placed at its act start, 1.2 s crossfade into the next; trimmed or faded to fit */
if (CUES.every((c) => existsSync(join(M, `${c.id}.mp3`)))) {
  const XF = 1.2, args = [], f = [];
  CUES.forEach((c, i) => {
    const last = i === CUES.length - 1, st = i ? c.start - XF / 2 : 0, len = (last ? T.end : T[c.to] + XF / 2) - st;
    args.push('-i', join(M, `${c.id}.mp3`));
    f.push(`[${i}:a]aresample=48000,atrim=0:${len.toFixed(3)},afade=t=in:d=${i ? XF : 0.01},afade=t=out:st=${(len - (last ? 4 : XF)).toFixed(3)}:d=${last ? 4 : XF},adelay=${Math.round(st * 1000)}:all=1[c${i}]`);
  });
  f.push(`${CUES.map((_, i) => `[c${i}]`).join('')}amix=inputs=${CUES.length}:normalize=0[out]`);
  execFileSync('ffmpeg', ['-v', 'error', '-y', ...args, '-filter_complex', f.join(';'), '-map', '[out]', '-c:a', 'pcm_s16le', join(M, 'score.wav')], {stdio: 'inherit'});
  console.log('score', join(M, 'score.wav'));
}
