// The score: one Lyria cue per act, each written to the act's length in the edit, then joined with short crossfades at the act cuts.
//   node music.mjs [cue...] [--redo]     -> <AI_OUT>/music/<cue>.mp3 and <AI_OUT>/music/score.wav
import {existsSync} from 'node:fs';
import {execFile, execFileSync} from 'node:child_process';
import {join, dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {SHOTS} from './film.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const OUT = process.env.AI_OUT || 'D:/wanjian-fx/v2-out/ai', M = join(OUT, 'music');
const a = process.argv.slice(2), redo = a.includes('--redo'), only = a.filter((x) => !x.startsWith('--'));
const start = {}; { let t = 0; for (const s of SHOTS) { start[s.id] = t; t += s.dur; } start.end = t; }
const HEAD = 1.5;  /* black before the first shot */

const BASE = 'Instrumental only, no vocals, no singing, no lyrics. Original cinematic film score for an epic Chinese historical fantasy feature film: large symphony orchestra blended with traditional Chinese instruments. D minor.';
const CUES = [
  {id: 'm1', from: 's01', to: 's07', text: 'Night over an ancient cliff city under siege. Opens with a single deep bronze temple bell toll and a low sustained string drone, then a lone guqin melody and a breathy low bamboo dizi, sparse and mysterious. Soft distant taiko heartbeat enters in the last third, building tension. 64 bpm.'},
  {id: 'm2', from: 's07', to: 's18', text: 'A fierce rooftop duel between a swordsman and a warrior monk. Driving taiko and frame drums, urgent staccato strings, a soaring erhu melody, pipa tremolo, sharp brass stabs, relentless momentum, rising in intensity to a heavy impact hit near the end, then a short tense held note. 120 bpm.'},
  {id: 'm3', from: 's18', to: 's29', text: 'Rain frozen in mid-air, time standing still. Begins weightless and hushed: high shimmering strings, glass-like celesta and guzheng harmonics, slow suspended pulse. In the middle a sudden violent burst of drums and strings for a fast clash, then silence and a single falling pluck. Ends with ominous low brass and distant war horns swelling, dread rising. 90 bpm.'},
  {id: 'm4', from: 's29', to: 's44', text: 'The epic climax: ten thousand flaming arrows fill the sky, a giant golden bell of light shields the city, then the arrows become a dragon. Massive full orchestra, thundering taiko ensemble, heroic French horns and trombones, huge string ostinatos, gong crashes, a soaring heroic main theme on erhu and strings over the full orchestra, building to an overwhelming triumphant peak about two thirds through, then a powerful release and fading golden afterglow. 100 bpm.'},
  {id: 'm5', from: 's44', to: 'end', text: 'Dawn after the battle, exhaustion, friendship and respect. Gentle solo guqin and warm low strings play a tender, nostalgic version of the heroic theme, resolving into D major, a distant soft temple bell, peaceful ending with a long fade. 60 bpm.'},
].map((c) => ({...c, len: start[c.to] - start[c.from] + (c.id === 'm1' ? HEAD : 0) + (c.id === 'm5' ? 6 : 2)}));

const todo = CUES.filter((c) => (!only.length || only.includes(c.id)) && (redo || !existsSync(join(M, `${c.id}.mp3`))));
await Promise.all(todo.map((c) => new Promise((ok) => {
  const prompt = `${BASE} Duration: ${Math.round(c.len)} seconds. ${c.text}`;
  execFile('node', [join(here, 'lyria.mjs'), join(M, c.id), '--prompt', prompt], (e, so, se) => { console.log(c.id, Math.round(c.len) + 's', (so + se).trim().split('\n')[0]); ok(); });
})));

/* join: each cue placed at its act start, 1.2 s crossfade into the next; trimmed or faded to fit */
if (CUES.every((c) => existsSync(join(M, `${c.id}.mp3`)))) {
  const XF = 1.2, args = [], f = [];
  CUES.forEach((c, i) => {
    const at = i === 0 ? 0 : start[c.from] + HEAD - XF / 2, len = (i === CUES.length - 1 ? start.end + HEAD + 4 : start[c.to] + HEAD + XF / 2) - at;
    args.push('-i', join(M, `${c.id}.mp3`));
    f.push(`[${i}:a]aresample=48000,atrim=0:${len.toFixed(3)},afade=t=in:d=${i ? XF : 0.01},afade=t=out:st=${(len - (i === CUES.length - 1 ? 4 : XF)).toFixed(3)}:d=${i === CUES.length - 1 ? 4 : XF},adelay=${Math.round(at * 1000)}:all=1[c${i}]`);
  });
  f.push(`${CUES.map((_, i) => `[c${i}]`).join('')}amix=inputs=${CUES.length}:normalize=0[out]`);
  execFileSync('ffmpeg', ['-v', 'error', '-y', ...args, '-filter_complex', f.join(';'), '-map', '[out]', '-c:a', 'pcm_s16le', join(M, 'score.wav')], {stdio: 'inherit'});
  console.log('score', join(M, 'score.wav'));
}
