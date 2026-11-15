// Sound effects and ambience for the AI cut, synthesized with audio/dsp.mjs and placed on the edit timeline from film.mjs
// (each cue is "shot id + seconds into the shot"). Output: <AI_OUT>/sfx.wav (48 kHz float stereo, before the final mix).
import {writeFileSync, mkdirSync} from 'node:fs';
import {join} from 'node:path';
import {SR, buf, add, bed, rng, pink, white, Biquad, smooth, wind, rain, murmur, crackle, bell, chime, boom, whoosh, thunder, knock, drone, wav} from '../audio/dsp.mjs';
import {SHOTS, HEAD, TAIL} from './film.mjs';

const OUT = process.env.AI_OUT || 'D:/wanjian-fx/v2-out/ai';
const T = {}; { let t = HEAD; for (const s of SHOTS) { T[s.id] = t; t += s.dur; } T.end = t; }
const at = (id, dt) => T[id] + dt;
const B = buf(T.end + TAIL), R = rng(77);
const put = (id, dt, len, fn, o = {}) => add(B, at(id, dt), at(id, dt) + len, fn, o);
const env = (pts) => (t) => { if (t <= pts[0][0]) return pts[0][1]; for (let i = 1; i < pts.length; i++) if (t <= pts[i][0]) { const [a, va] = pts[i - 1], [b, vb] = pts[i]; return va + (vb - va) * smooth(a, b, t); } return pts[pts.length - 1][1]; };
const g = (id, dt = 0) => at(id, dt);

/* extra voices: sword-on-steel clang, a low war horn, water roar */
const clang = (f0 = 1300, seed = 1) => { const b = bell(f0, {decay: .35, bright: 1.6, seed}); return (t) => b(t) * 1.4; };
const horn = (f) => { const lp = new Biquad('lp', 700), d = rng(5); let ph = 0;
  return (t) => { ph += 2 * Math.PI * f * (1 + .006 * Math.sin(2 * Math.PI * 5 * t)) / SR; const saw = ((ph / Math.PI) % 2) - 1; return lp.run(saw + .3 * (d() * 2 - 1) * .1) * Math.min(1, t * 1.5) * Math.min(1, Math.max(0, 3.8 - t)) * .7; }; };
const roar = (seed) => { const n = pink(seed), lp = new Biquad('lp', 900); return () => lp.run(n()) * 2.2; };

/* ── beds ── */
add(B, .2, 9, bell(98, {decay: 12, seed: 2}), {gain: .5});                                         // opening toll over black
bed(B, 0, g('s18'), () => wind(11, {lo: 150, hi: 700}), () => wind(12, {lo: 150, hi: 700}), env([[0, .2], [g('s01'), .55], [g('s07'), .4], [g('s18'), .3]]), .45);
bed(B, g('s01'), g('s07'), () => murmur(21), () => murmur(22), env([[g('s01'), 0], [g('s01', 2), .25], [g('s07'), .1]]), .25);   // the army camp, far off
/* rain: in at the bridge, held back while time is frozen (s19–s21), back for the fight, lighter through the siege, gone at s43 */
bed(B, g('s18'), g('s43', 2), () => rain(31), () => rain(32), env([[g('s18'), 0], [g('s18', .8), 1], [g('s19', 1), .9], [g('s19', 3), .05], [g('s21', 3.6), .05], [g('s22'), 1], [g('s28'), .7], [g('s29'), .45], [g('s43'), .2], [g('s43', 2), 0]]), .5);
bed(B, g('s44'), T.end + TAIL, () => wind(41, {lo: 200, hi: 500, gust: 9}), () => wind(42, {lo: 200, hi: 500, gust: 9}), env([[g('s44'), 0], [g('s44', 2), .3]]), .3);
add(B, g('s20'), g('s21', 4), drone(110, 3), {gain: .12});                                          // the frozen moment hums

/* ── prologue ── */
put('s02', .3, 6, drone(55, 4), {gain: .15});
for (let k = 0; k < 11; k++) put('s04', .1 + k * .3, .4, knock(700 + R() * 500, {decay: .05, seed: k}), {gain: .5, pan: R() * .4 - .2});
put('s05', 0, 1.5, whoosh(3, {from: 200, to: 900, len: 1.2}), {gain: .25});

/* ── act 1: rooftops ── */
put('s07', .1, 2.6, whoosh(5, {from: 250, to: 1600, len: 2.4}), {gain: .45});
put('s08', .3, 1.2, whoosh(6, {from: 150, to: 600, len: 1}), {gain: .4});
put('s08', .7, 4, boom({f1: 110, f2: 40, len: 2.5, seed: 8}), {gain: .5});
put('s09', .2, .6, whoosh(7, {from: 800, to: 5000, len: .5}), {gain: .6});
put('s09', .6, 3, crackle(9, {rate: 30}), {gain: .35});
for (const [dt, f] of [[.6, 1250], [1.5, 1500], [2.6, 1100]]) put('s10', dt, 1.2, clang(f, dt * 10), {gain: .55, pan: R() * .6 - .3});
put('s10', 2.1, .8, whoosh(10, {from: 600, to: 3000, len: .6}), {gain: .4});
put('s11', .15, 1.4, clang(980, 3), {gain: .6});
put('s11', .2, 3, crackle(11, {rate: 120}), {gain: .4});
bed(B, g('s12'), g('s13'), () => crackle(12, {rate: 18}), () => crackle(13, {rate: 18}), () => 1, .35);
put('s12', .4, 2.5, whoosh(12, {from: 150, to: 500, len: 2.3}), {gain: .3});
put('s13', .2, 1.4, whoosh(13, {from: 300, to: 1200, len: 1.2}), {gain: .4});
put('s13', .5, 4.5, drone(73, 5), {gain: .12});
for (let k = 0; k < 7; k++) put('s14', .4 + k * .42, .5, knock(400 + R() * 300, {decay: .09, seed: 30 + k}), {gain: .7, pan: R() * .8 - .4});
put('s15', .1, .5, whoosh(15, {from: 400, to: 2500, len: .4}), {gain: .4});
put('s15', .45, 5, boom({f1: 95, f2: 30, len: 3.5, seed: 15}), {gain: .85});
for (let k = 0; k < 14; k++) put('s16', .2 + R() * 3, .3, knock(900 + R() * 900, {decay: .04, seed: 50 + k}), {gain: .45, pan: R() * 1.2 - .6});
put('s16', 2.7, 1.8, clang(700, 16), {gain: .45});
put('s16', 2.7, 1.8, crackle(16, {rate: 90}), {gain: .3});

/* ── act 2: frozen rain ── */
put('s18', .1, 7, thunder(18, {len: 5}), {gain: .55});
put('s19', .3, 3.5, whoosh(19, {from: 3000, to: 800, len: 3}), {gain: .2});                        // the rain winding down
for (let k = 0; k < 9; k++) put('s20', .5 + k * .55, 1.5, chime(2400 + R() * 1600, k), {gain: .08, pan: R() * 1.4 - .7});
for (let k = 0; k < 5; k++) put('s22', .2 + k * .12, .7, whoosh(22 + k, {from: 1500, to: 6000, len: .6}), {gain: .3, pan: R() * .8 - .4});
put('s23', .5, 5, boom({f1: 80, f2: 35, len: 3, seed: 23}), {gain: .7});
put('s23', .55, 6, bell(196, {decay: 3, seed: 23}), {gain: .3});
for (const [dt, f] of [[.4, 1300], [.9, 1550], [1.5, 1200], [2.2, 1450], [2.9, 1350], [3.5, 1600]]) put('s24', dt, 1, clang(f, dt * 7), {gain: .5, pan: R() * .8 - .4});
for (let k = 0; k < 4; k++) put('s24', .3 + k * 1, .6, whoosh(240 + k, {from: 200, to: 900, len: .5}), {gain: .3});
put('s25', .3, .5, knock(3000, {decay: .02, seed: 25}), {gain: .5});
for (let k = 0; k < 16; k++) put('s25', .4 + R() * 2.6, .2, knock(2000 + R() * 1500, {decay: .03, seed: 60 + k}), {gain: .3, pan: R() * 1.4 - .7});
for (const dt of [.4, 1.0, 1.6, 2.3, 3.1]) put('s26', dt, .5, knock(900 + R() * 300, {decay: .03, seed: dt * 9}), {gain: .45});
put('s28', .3, 4, horn(73.4), {gain: .55}); put('s28', .9, 3.6, horn(110), {gain: .3, pan: .4});
put('s28', .0, 4.5, murmur(28), {gain: .2});

/* ── act 3: ten thousand arrows ── */
for (let k = 0; k < 10; k++) put('s29', R() * 3.5, 2, whoosh(290 + k, {from: 400, to: 2200, len: 1.8}), {gain: .22, pan: R() * 1.6 - .8});
put('s29', 0, 5, crackle(29, {rate: 25}), {gain: .3});
put('s30', .3, 1.2, knock(260, {decay: .2, seed: 30}), {gain: .5});
put('s31', .45, 16, bell(65, {decay: 15, bright: 1.2, seed: 31}), {gain: 1.0});
put('s31', .45, 6, boom({f1: 70, f2: 25, len: 4, seed: 31}), {gain: .8});
for (let k = 0; k < 24; k++) put('s32', R() * 5.2, 1.2, boom({f1: 160, f2: 60, len: .5, seed: 320 + k}), {gain: .15, pan: R() * 1.6 - .8});
put('s32', 0, 5.5, crackle(32, {rate: 60}), {gain: .3});
put('s33', 0, 4, murmur(33), {gain: .3});
for (let k = 0; k < 5; k++) put('s34', .2 + k * .85, 1, boom({f1: 60, f2: 40, len: .25, seed: 340 + k}), {gain: .4});          // heartbeat
put('s35', .4, 4, thunder(35, {len: 2}), {gain: .5});
put('s35', .4, 1.5, clang(450, 35), {gain: .4});
for (const dt of [.3, 1.4, 2.5, 3.6]) put('s36', dt, .9, whoosh(360 + dt, {from: 300, to: 1800, len: .8}), {gain: .35});
put('s37', .3, 2.4, whoosh(37, {from: 4000, to: 300, len: 2.2}), {gain: .4});
put('s37', 2.3, 4, boom({f1: 50, f2: 22, len: 3, seed: 37}), {gain: .5});
put('s38', 0, 5.2, whoosh(38, {from: 120, to: 900, len: 5}), {gain: .55});
put('s39', 0, 5.6, whoosh(39, {from: 200, to: 700, len: 5.5}), {gain: .5});
put('s39', 0, 5.6, wind(39, {lo: 80, hi: 400, gust: 2}), {gain: .35});
put('s40', 0, 5.2, drone(55, 40), {gain: .2});
put('s41', .5, 8, boom({f1: 60, f2: 20, len: 6, seed: 41}), {gain: 1.0});
put('s41', .6, 8, thunder(41, {len: 6}), {gain: .6});
put('s41', 1.0, 7, roar(41), {gain: .4});
put('s42', 0, 4, murmur(42), {gain: .25});
for (let k = 0; k < 14; k++) put('s43', R() * 4, 1.6, chime(1800 + R() * 2500, 70 + k), {gain: .06, pan: R() * 1.6 - .8});

/* ── epilogue ── */
for (let k = 0; k < 6; k++) put('s44', .5 + R() * 4, .4, chime(3200 + R() * 1200, 90 + k), {gain: .04, pan: R() * 1.6 - .8});   // morning birds, far
put('s47', 2.2, 12, bell(98, {decay: 9, bright: .7, seed: 47}), {gain: .35});                    // the cracked bell, softly

/* soft-clip and write */
for (const ch of B) for (let i = 0; i < ch.length; i++) ch[i] = Math.tanh(ch[i] * .9);
mkdirSync(OUT, {recursive: true});
writeFileSync(join(OUT, 'sfx.wav'), wav(B));
console.log('wrote', join(OUT, 'sfx.wav'), (T.end + TAIL).toFixed(1) + 's');
