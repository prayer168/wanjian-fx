// Scores the environment cut: one 48 kHz stereo bed for the whole film, every cue placed against the picture.
// Section lengths and in-section event times mirror film/js/scenes/*.js. Output: out/audio/score.wav (pre-loudness-normalisation).
import {writeFileSync, mkdirSync} from 'node:fs';
import {dirname, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {SR, buf, add, bed, smooth, rng, wind, rustle, rain, crickets, murmur, crackle, bell, chime, boom, whoosh, thunder, knock, drone, wav} from './dsp.mjs';

const SECTIONS = [['prologue', 23], ['act1', 24], ['act2', 29], ['act3', 27], ['act4', 24], ['act5', 28], ['act6', 22], ['epilogue', 16]];
const TOTAL = SECTIONS.reduce((a, s) => a + s[1], 0);
const B = buf(TOTAL);
let T0 = 0;
/* section-local helpers */
const at = (t0, t1, fn, o) => add(B, T0 + t0, T0 + t1, fn, o);
const bedL = (t0, t1, mk, env, gain, seed) => bed(B, T0 + t0, T0 + t1, () => mk(seed), () => mk(seed + 101), (t) => env(t - T0), gain);
const ramp = (pts) => (t) => { if (t <= pts[0][0]) return pts[0][1]; for (let i = 1; i < pts.length; i++) if (t <= pts[i][0]) { const [a, va] = pts[i - 1], [b, vb] = pts[i]; return va + (vb - va) * smooth(a, b, t); } return pts[pts.length - 1][1]; };
const R = rng(2026);

const score = {
  prologue() {
    bedL(0, 23, (s) => wind(s, {lo: 150, hi: 700, gust: 7}), ramp([[0, .55], [6, .7], [12, .45], [16, .25], [23, .2]]), .5, 11);
    at(0, 23, drone(55, 2), {gain: .12});
    at(.8, 23, bell(110, {decay: 10, seed: 3}), {pan: .3, gain: .35});                // the distant bell, one toll
    at(6, 9, whoosh(5, {from: 250, to: 1800, len: 2.6}), {gain: .35});               // over the ridge
    bedL(8, 23, murmur, ramp([[8, 0], [14, .7], [17, .45], [23, .35]]), .35, 21);    // the city rising up
    bedL(15, 23, crickets, ramp([[15, 0], [17, 1]]), .18, 31);
    for (let k = 0; k < 6; k++) at(16 + R() * 6.5, 23, chime(1700 + R() * 900, k), {pan: R() * 1.2 - .6, gain: .08});
  },
  act1() {
    bedL(0, 24, (s) => wind(s, {lo: 120, hi: 600, gust: 5}), ramp([[0, .6], [9, .5], [16, .7], [24, .6]]), .55, 41);
    bedL(0, 24, rustle, ramp([[0, .4], [9, .7], [16, .35]]), .35, 51);               // dry grass
    bedL(0, 24, crackle, ramp([[0, .45], [9, 1], [16, .3]]), .6, 61);                // embers, loudest in the close arrow shot
    at(0, 24, drone(41, 5), {gain: .14});
    for (let k = 0; k < 40; k++) { const t = R() * 22; at(t, t + 2, knock(2200 + R() * 2500, {decay: .03, seed: k}), {pan: R() * 1.6 - .8, gain: .05}); }  // cooling arrowheads
    for (let k = 0; k < 70; k++) { const t = Math.pow(R(), 1.4) * 17; at(t, t + 2, chime(2600 + R() * 2400, k), {pan: R() * 1.4 - .7, gain: .05 * (1 - t / 18)}); }  // gold dust shimmer, thinning out
    bedL(15, 24, crickets, ramp([[15, 0], [20, .8]]), .12, 71);
    at(18.5, 24, bell(98, {decay: 8, seed: 9}), {pan: -.5, gain: .18});               // the city's bell far to the west
  },
  act2() {
    bedL(0, 29, (s) => wind(s, {lo: 200, hi: 900, gust: 6}), ramp([[0, .8], [14, .35], [22, .5], [29, .6]]), .5, 81);
    bedL(0, 29, murmur, ramp([[0, .15], [12, .9], [14, .9], [15, .4], [22, .45], [29, .3]]), .45, 91);
    bedL(14, 22, rustle, () => .5, .2, 95);                                          // lantern paper fluttering at the gate
    for (const t of [15.2, 19.1]) at(t, t + 3, knock(95, {decay: .5, seed: t}), {gain: .5});  // the barred gate shudders
    for (let k = 0; k < 14; k++) at(22 + R() * 6.5, 29, chime(1500 + R() * 1200, k + 20), {pan: .5 + R() * .4, gain: .06});  // the tower's chimes far off
  },
  act3() {
    bedL(0, 27, (s) => rustle(s, {gust: 5, bright: 5000}), ramp([[0, 1], [11, .8], [20, 1.1], [27, 1]]), .36, 111);
    bedL(0, 27, (s) => wind(s, {lo: 250, hi: 1100, gust: 5}), ramp([[0, .9], [11, .5], [27, .55]]), .45, 121);
    for (let k = 0; k < 26; k++) { const t = 9 + R() * 17.5; at(t, t + 1, knock(240 + R() * 260, {decay: .12, seed: k}), {pan: R() * 1.6 - .8, gain: .12}); }  // culms knocking
    bedL(11, 27, crickets, () => .5, .08, 131);
  },
  act4() {
    bedL(0, 24, (s) => rain(s, {density: 1400}), ramp([[0, 1], [9, .55], [17, .9], [24, 1]]), .26, 141);
    for (let k = 0; k < 30; k++) { const t = 9 + R() * 8; at(t, t + 1, knock(900 + R() * 900, {decay: .05, seed: k}), {pan: R() * 1.2 - .6, gain: .08}); }  // drips under the arch
    for (const [f, d] of [[3.2, .6], [15.6, .9], [22.4, .4]]) at(f + d, 24, thunder(Math.round(f * 10), {len: 5}), {gain: .6});
    at(0, 24, drone(49, 7), {gain: .08});
  },
  act5() {
    bedL(0, 28, (s) => wind(s, {lo: 220, hi: 1200, gust: 4}), ramp([[0, .5], [8, .6], [21, 1.1], [28, .8]]), .55, 151);
    for (let k = 0; k < 60; k++) { const t = R() * 27.5; const near = t > 21 ? 2 : t > 8 ? 1.4 : .8; at(t, 28, chime(1300 + R() * 1400, k + 40), {pan: Math.sin(t * .5 + k) * .8, gain: .05 * near}); }
    at(21, 28, bell(65, {decay: 14, bright: .4, seed: 4}), {gain: .12});            // the great bell humming as it sways
    at(0, 28, drone(65, 9), {gain: .08});
  },
  act6() {
    bedL(0, 4, (s) => wind(s, {lo: 200, hi: 600, gust: 3}), ramp([[0, .4], [3.4, 0]]), .4, 161);  // the frozen instant: wind dies to nothing, ~0.5 s of silence
    const I = 4.0;
    at(I, 22, boom({f1: 110, f2: 26, len: 5}), {gain: 1.2});
    at(I, 22, bell(65, {decay: 16, seed: 21}), {pan: -.15, gain: .9});              // bronze bell
    at(I + .01, 22, bell(97.5, {decay: 13, bright: 1.6, seed: 22}), {pan: .15, gain: .7});  // golden bell, a fifth above: 雙鐘共鳴
    at(I, I + 3, whoosh(9, {from: 120, to: 3000, len: 2.6}), {gain: .6});
    for (let k = 0; k < 420; k++) { const t = I + .6 + Math.pow(R(), .8) * 7.5; at(t, t + .4, knock(1500 + R() * 3000, {decay: .025, seed: k}), {pan: R() * 1.8 - .9, gain: .05 * (1.3 - (t - I) / 9)}); }  // ten thousand tiles
    bedL(I, 16, (s) => wind(s, {lo: 80, hi: 300, gust: 2}), ramp([[I, 1], [9, .6], [16, .2]]), .5, 171);
    for (let k = 0; k < 30; k++) { const t = 10 + R() * 11; at(t, 22, chime(2000 + R() * 2000, k + 90), {pan: R() * 1.4 - .7, gain: .045}); }  // lanterns relighting, then the stars
    bedL(16, 22, (s) => wind(s, {lo: 400, hi: 1400, gust: 5}), ramp([[16, 0], [18, .5]]), .35, 181);
  },
  epilogue() {
    bedL(0, 16, (s) => wind(s, {lo: 180, hi: 700, gust: 6}), ramp([[0, .5], [7, .55], [16, .3]]), .5, 191);
    for (let k = 0; k < 8; k++) at(R() * 8, 16, chime(1600 + R() * 900, k + 140), {pan: R() * .8 - .4, gain: .05});
    at(1.6, 16, bell(110, {decay: 11, seed: 30}), {pan: .1, gain: .4});              // one distant bell to close
  },
};

for (const [name, len] of SECTIONS) { score[name](); T0 += len; }

/* edge fades matching the picture (0.3 s at each cut, 1.5 s in, 2 s out) and a soft clip */
let s0 = 0;
for (const [name, len] of SECTIONS) {
  const fin = name === 'prologue' ? 1.5 : .3, fout = name === 'epilogue' ? 2.1 : .3;
  for (let i = Math.floor(s0 * SR), e = Math.floor((s0 + len) * SR); i < e; i++) {
    const t = i / SR - s0, g = Math.min(1, t / fin, (len - t) / fout);
    B[0][i] *= g; B[1][i] *= g;
  }
  s0 += len;
}
for (const ch of B) for (let i = 0; i < ch.length; i++) ch[i] = Math.tanh(ch[i] * .8) / .8;

const out = resolve(dirname(fileURLToPath(import.meta.url)), '../out/audio/score.wav');
mkdirSync(dirname(out), {recursive: true});
writeFileSync(out, wav(B));
console.log('wrote', out, TOTAL, 's');
