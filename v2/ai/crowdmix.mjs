// The crowd track for the AI cut: the designed crowd voices of audio/crowd.mjs (army on the plain, townspeople in the streets)
// placed on the edit timeline — single shouts up front, and mobs built from many copies of the same shouts at slightly different
// pitch, pan, timing and distance. Far voices are low-passed and pushed back with a short echo. Missing clips are skipped.
// Output: <AI_OUT>/crowd.wav (the army roar bed itself lives in sfx.mjs).
//   node crowdmix.mjs
import {writeFileSync, existsSync} from 'node:fs';
import {join} from 'node:path';
import {buf, rng, wav} from '../audio/dsp.mjs';
import {load, play} from '../audio/sampler.mjs';
import {TAIL, timeline} from './film.mjs';

const OUT = process.env.AI_OUT || 'D:/wanjian-fx/v2-out/ai', DIR = join(OUT, 'vo', 'crowd');
const {T, end} = timeline(), g = (id, dt = 0) => T[id] + dt;
const B = buf(end + TAIL), R = rng(91), rp = (a) => R() * 2 * a - a;
const have = (id) => existsSync(join(DIR, `${id}.wav`));
let placed = 0;
/* one voice. far: 0 (close) .. 1 (across the river) */
function say(id, t, {gain = .5, pan = 0, far = 0, rate = 1} = {}) {
  if (!have(id)) return;
  const s = load(join(DIR, `${id}.wav`)), lp = far ? 6000 - far * 4800 : 0;
  play(B, t, s, {gain: gain * (1 - far * .5), pan, rate, lp});
  if (far) for (const [d, a] of [[.06, .35], [.13, .2], [.23, .1]]) play(B, t + d * (1 + far), s, {gain: gain * a * far, pan: -pan, rate, lp: lp * .7});
  placed++;
}
/* a mob: n voices drawn from ids, spread over `spread` seconds */
function mob(ids, t, n, spread, {gain = .25, far = .5, panW = .8} = {}) {
  const ok = ids.filter(have); if (!ok.length) return;
  for (let k = 0; k < n; k++) say(ok[k % ok.length], t + R() * spread, {gain: gain * (.7 + R() * .5), pan: rp(panW), far: Math.min(1, far + rp(.15)), rate: .88 + R() * .24});
}

/* s28: the general's orders and the army answering */
say('g_draw', g('s28', .3), {gain: .7, far: .25, pan: -.2});
mob(['a_he', 'b_he'], g('s28', 1.1), 14, .25, {gain: .3, far: .45});
say('g_loose', g('s28', 2.3), {gain: .75, far: .25, pan: -.2});   // the order, then the volley leaves the bows (n15)
mob(['a_sha', 'b_sha', 'g_sha'], g('n15', .9), 18, .6, {gain: .3, far: .5});
/* s29: the town sees the fire coming, heard from far off */
say('w_fire', g('s29', 2.0), {gain: .35, far: .6, pan: .3}); say('t_hide', g('s29', 2.8), {gain: .35, far: .6, pan: -.4});
say('f_run', g('s29', 3.4), {gain: .3, far: .6, pan: .5});
mob(['w_scream', 'f_scream', 'b_scream'], g('s29', 1.8), 10, 4, {gain: .18, far: .8});
/* s32–s33: under the golden bell */
say('w_bell', g('s32', 4.8), {gain: .25, far: .5, pan: -.3}); mob(['f_wow', 't_wow'], g('s32', 6), 6, 1.5, {gain: .12, far: .7});
say('f_wow', g('s33', .2), {gain: .45, pan: .2}); say('t_held', g('s33', 1.0), {gain: .5, pan: .45});
say('w_amituofo', g('s33', 2.2), {gain: .4, pan: -.4}); say('c_look', g('s33', 1.4), {gain: .4, pan: -.1});
/* s35: the dome cracks (after the swordsman's line) */
say('f_crack', g('s35', 2.4), {gain: .35, far: .4, pan: .4}); say('w_duck', g('s35', 2.9), {gain: .35, far: .45, pan: -.3});
say('t_above', g('s35', 3.3), {gain: .3, far: .5}); mob(['w_scream', 'f_scream', 'b_scream'], g('s35', 2.6), 8, 1.4, {gain: .16, far: .7});
/* s38–s39: the arrows turn back on the army */
say('b_back', g('s38', 1.5), {gain: .3, far: .7, pan: -.5}); say('a_what', g('s38', 3.2), {gain: .3, far: .7, pan: .5});
say('b_dragon', g('s39', 2.0), {gain: .32, far: .7, pan: .3}); say('g_hold', g('s39', 4.6), {gain: .35, far: .65, pan: -.3});
mob(['a_what', 'b_back', 'b_dragon'], g('s39', 1.5), 8, 5, {gain: .1, far: .9});
/* s41–s42: the wall of water */
mob(['a_scream', 'b_scream', 'a_run', 'b_retreat'], g('s41', 1.0), 18, 3.5, {gain: .2, far: .75});
say('a_run', g('s41', 1.6), {gain: .35, far: .55, pan: -.4}); say('b_retreat', g('s41', 2.6), {gain: .35, far: .55, pan: .4});
say('b_how', g('s42', 1.0), {gain: .45, far: .2, pan: .3}); say('a_sorcery', g('s42', 2.5), {gain: .4, far: .25, pan: -.3});
/* s43: saved */
say('t_saved', g('s43', .5), {gain: .35, far: .55, pan: -.3}); say('f_cheer', g('s43', 1.7), {gain: .3, far: .6, pan: .4});
mob(['t_cheer', 'b_cheer', 'f_cheer'], g('s43', 2.0), 14, 1.6, {gain: .14, far: .85});
say('w_bless', g('s43', 3.0), {gain: .25, far: .6, pan: .2}); say('c_laugh', g('s43', 3.4), {gain: .25, far: .6, pan: -.5});

for (const ch of B) for (let i = 0; i < ch.length; i++) ch[i] = Math.tanh(ch[i]);
writeFileSync(join(OUT, 'crowd.wav'), wav(B));
console.log('wrote', join(OUT, 'crowd.wav'), placed, 'voices placed');
