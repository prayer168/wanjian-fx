// The score, composed in code (no samples, no models): guqin-like plucks (Karplus-Strong), an erhu-like bowed line,
// taiko, and a low string pad, all in D minor pentatonic. It follows the picture section by section; Act VI drops to
// silence before the impact like the effects track. Output: out/audio/music.wav (pre-normalisation).
import {writeFileSync, mkdirSync} from 'node:fs';
import {dirname, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {SR, buf, add, rng, Biquad, white, smooth, wav} from './dsp.mjs';
import {SECTIONS} from './sections.mjs';

const TOTAL = SECTIONS.reduce((a, s) => a + s[1], 0), B = buf(TOTAL), R = rng(88);
const START = {}; { let t = 0; for (const [n, l] of SECTIONS) { START[n] = t; t += l; } }
const mf = (m) => 440 * 2 ** ((m - 69) / 12);

/* ---------- instruments ---------- */
/* plucked silk string: Karplus-Strong with a soft pluck and a slow damping, plus a touch of body resonance */
function qin(f, {decay = .9965, bright = .5, len = 4, seed = 1} = {}) {
  const N = Math.max(2, Math.round(SR / f)), d = new Float32Array(N), Rr = rng(seed), body = new Biquad('bp', 220, 1.2);
  for (let i = 0; i < N; i++) d[i] = Rr() * 2 - 1;
  for (let p = 0; p < 2; p++) for (let i = 0; i < N; i++) d[i] = (d[i] + d[(i + 1) % N]) * (.5 + bright * .25);   // soften the pluck
  let k = 0;
  return (t) => { if (t > len) return 0; const i = k % N, j = (k + 1) % N, y = d[i]; d[i] = decay * .5 * (d[i] + d[j]); k++; return (y + body.run(y) * .6) * Math.min(1, t * 400); };
}
/* bowed two-string fiddle: band-limited-ish saw with portamento and growing vibrato through a few formants, plus bow hiss */
function erhu(notes, {gain = 1, seed = 3} = {}) {
  const f1 = new Biquad('bp', 900, 2.2), f2 = new Biquad('bp', 1700, 3), f3 = new Biquad('bp', 3200, 4), lp = new Biquad('lp', 5200), n = white(seed);
  let ph = 0, f = mf(notes[0][1]), idx = 0;
  return (t) => {
    while (idx < notes.length - 1 && t >= notes[idx + 1][0]) idx++;
    const [t0, m, dur] = notes[idx], tgt = mf(m), lt = t - t0;
    f += (tgt - f) * .0016;                                         // slide into each note
    const vib = 1 + .006 * smooth(.25, .9, lt) * Math.sin(2 * Math.PI * 5.6 * t);
    ph = (ph + f * vib / SR) % 1;
    const saw = 2 * ph - 1, env = smooth(0, .12, lt) * (1 - smooth(dur - .25, dur + .05, lt)) * (lt < dur + .05 ? 1 : 0);
    const x = saw + n() * .08;
    return lp.run(f1.run(x) * 1.2 + f2.run(x) * .9 + f3.run(x) * .5) * env * gain * 1.6;
  };
}
/* taiko: pitch-dropping membrane plus a skin slap */
function taiko({big = 1, seed = 5} = {}) {
  const n = white(seed), bp = new Biquad('bp', 180, 1.5);
  let ph = 0;
  return (t) => { const f = 48 + 70 * Math.exp(-t * 18) * big; ph += f / SR; const body = Math.sin(2 * Math.PI * ph) * Math.exp(-t * (3.2 / big)); const slap = bp.run(n()) * Math.exp(-t * 40); return (body * 1.4 + slap * .6) * big; };
}
/* small high drum / woodblock for the bamboo duel */
function block(f = 900, seed = 7) { const n = white(seed), bp = new Biquad('bp', f, 8); return (t) => (bp.run(n()) * 3 + Math.sin(2 * Math.PI * f * t) * .4) * Math.exp(-t * 45); }
/* string pad: detuned saws, low-passed, slow swell; chord in MIDI notes */
function pad(chord, dur, {cut = 900, att = 2, rel = 2.5, seed = 9} = {}) {
  const osc = chord.flatMap((m, k) => [-.07, .06].map((dt, j) => ({f: mf(m) * 2 ** (dt / 12), ph: rng(seed + k * 2 + j)()})));
  const lp = new Biquad('lp', cut, .8), lp2 = new Biquad('lp', cut * 1.4, .7);
  return (t) => { let s = 0; for (const o of osc) { o.ph = (o.ph + o.f / SR) % 1; s += 2 * o.ph - 1; } const env = smooth(0, att, t) * (1 - smooth(dur - rel, dur, t)); return lp2.run(lp.run(s / osc.length)) * env * 1.8; };
}
/* tremolo strings for suspense: the pad with a fast amplitude flutter */
function tremolo(chord, dur, opt) { const p = pad(chord, dur, opt); return (t) => p(t) * (.55 + .45 * Math.sin(2 * Math.PI * 11 * t)); }

/* ---------- helpers ---------- */
const at = (sec, t0, t1, fn, o) => add(B, START[sec] + t0, START[sec] + t1, fn, o);
const D = 50, Dm = [38, 45, 50, 53, 57], Bb = [34, 46, 50, 53, 58], C = [36, 43, 48, 52, 55], Am = [33, 45, 48, 52, 57], DM = [38, 45, 50, 54, 57, 62];
const scale = [62, 65, 67, 69, 72, 74, 77, 79, 81];            // D minor pentatonic, D4 up
const THEME = [[69, 1], [72, 1], [74, 2], [72, 1], [69, 1], [67, 2], [69, 1], [65, 1], [67, 1], [69, 1], [62, 4]];
function melody(sec, t0, beat, notes, inst = 'qin', o = {}) {
  let t = t0; const out = [];
  for (const [m, b] of notes) { out.push([t, m + (o.shift || 0), b * beat]); t += b * beat; }
  if (inst === 'qin') for (const [tt, m, d] of out) at(sec, tt, tt + Math.max(d, 2.5) + 1.5, qin(mf(m), {len: d + 2.5, seed: Math.floor(tt * 10)}), {pan: o.pan ?? -.2, gain: o.gain ?? .5});
  else at(sec, t0, t + .3, erhu(out.map(([tt, m, d]) => [tt - t0, m, d]), {seed: Math.floor(t0)}), {pan: o.pan ?? .2, gain: o.gain ?? .22});
  return t;
}
function drums(sec, t0, t1, bpm, pattern, {gain = .5, accent = []} = {}) {
  const beat = 60 / bpm;
  for (let t = t0, k = 0; t < t1; t += beat / 2, k++) {
    const p = pattern[k % pattern.length]; if (!p) continue;
    const g = gain * p * (accent.some((a) => Math.abs(a - t) < beat / 4) ? 1.8 : 1);
    at(sec, t, t + 2, taiko({big: .6 + p * .4, seed: k}), {pan: (R() - .5) * .3, gain: g});
  }
}
function ostinato(sec, t0, t1, bpm, notes, {gain = .14, shiftAt = null} = {}) {
  const beat = 60 / bpm;
  for (let t = t0, k = 0; t < t1; t += beat / 2, k++) {
    const m = notes[k % notes.length] + (shiftAt ? shiftAt(t) : 0);
    at(sec, t, t + .6, (lt) => { const f = mf(m); return (Math.sin(2 * Math.PI * f * lt) + .5 * Math.sin(4 * Math.PI * f * lt) + .25 * Math.sin(6 * Math.PI * f * lt)) * Math.exp(-lt * 7) * Math.min(1, lt * 300); }, {gain, pan: k % 2 ? .25 : -.25});
  }
}

/* ---------- the cue sheet ---------- */
/* Prologue: night, the city below. A string pad breathes, the qin states the theme once. */
at('prologue', 0, 23, pad(Dm, 23, {cut: 700, att: 5, rel: 4}), {gain: .35});
melody('prologue', 5, .72, THEME, 'qin', {gain: .55});

/* Act I: the aftermath. Pad turns to Bb, the erhu answers the theme while the swordsman sheathes; heartbeat taiko builds to the stamp. */
at('act1', 0, 18, pad(Dm, 18, {cut: 600, att: 4}), {gain: .3});
at('act1', 16, 43, pad(Bb, 27, {cut: 800, att: 3}), {gain: .3});
melody('act1', 16.5, .78, THEME.slice(0, 7), 'erhu', {gain: .2});
drums('act1', 24, 32, 90, [1, 0, 0, 0, .6, 0, 0, 0], {gain: .35});
drums('act1', 30.2, 32.6, 120, [.7, .5, .7, .5], {gain: .4});
at('act1', 32.55, 36, taiko({big: 1.6, seed: 77}), {gain: 1.0});                           // 金剛踏
drums('act1', 33, 43, 112, [1, 0, .5, 0, .8, .4, .5, 0], {gain: .4});
ostinato('act1', 33, 43, 112, [38, 38, 45, 48, 38, 38, 45, 43]);

/* Act II: the chase. Driving taiko and low-string ostinato at 112; erhu theme over the rooftops; accents on the cuts; the moon leap floats. */
at('act2', 0, 14, pad(Dm, 14, {cut: 900, att: 3}), {gain: .28});
melody('act2', 1.5, .7, THEME, 'qin', {gain: .4, shift: 12, pan: .3});
drums('act2', 14, 37, 112, [1, 0, .4, .3, .8, 0, .5, .3], {gain: .45, accent: [32.9, 33.95, 35.1]});
ostinato('act2', 14, 37, 112, [38, 38, 45, 48, 50, 48, 45, 43], {gain: .15});
melody('act2', 22, .54, [...THEME, ...THEME.slice(0, 6)], 'erhu', {gain: .22});
at('act2', 32.2, 37.2, tremolo(C, 5, {cut: 1400, att: .3}), {gain: .22});
at('act2', 37, 44, pad([50, 57, 62, 69, 74], 7, {cut: 2200, att: 1, rel: 2}), {gain: .25});
melody('act2', 37.5, .6, [[81, 1], [79, 1], [74, 2], [72, 1], [74, 3]], 'qin', {gain: .35, pan: 0});

/* Act III: bamboo. Qin arpeggios ripple, woodblocks tick through the duel, the roar lands on a huge drum and a held cluster. */
at('act3', 0, 20, pad(Am, 20, {cut: 650, att: 4}), {gain: .28});
for (let t = 2, k = 0; t < 19; t += .36, k++) at('act3', t, t + 3, qin(mf(scale[(k * 3 + (k >> 2)) % 7]), {len: 2.5, seed: k + 300, bright: .3}), {pan: Math.sin(k) * .5, gain: .22});
for (let t = 20.2, k = 0; t < 28; t += 60 / 120 / 2, k++) if ([1, 0, 1, 1, 0, 1, 0, 1][k % 8]) at('act3', t, t + .3, block(k % 3 ? 900 : 1300, k), {gain: .18, pan: (k % 2 ? .3 : -.3)});
drums('act3', 20.2, 28, 120, [1, 0, 0, .5, .8, 0, .4, 0], {gain: .35});
melody('act3', 20.2, .5, THEME.slice(0, 8), 'erhu', {gain: .2});
at('act3', 28.45, 33, taiko({big: 1.8, seed: 99}), {gain: 1.1});
at('act3', 28.45, 39, pad([38, 45, 50, 51, 57], 10.5, {cut: 1200, att: .05, rel: 6}), {gain: .3});

/* Act IV: rain. A dark low pad, the erhu bends, then taiko rolls drive the exchange; a rising swell as they spring up. */
at('act4', 0, 17, pad([34, 41, 46, 50, 53], 17, {cut: 500, att: 4}), {gain: .32});
melody('act4', 3, .9, [[69, 2], [70, 1], [69, 1], [65, 2], [62, 4]], 'erhu', {gain: .2});
drums('act4', 17.2, 27.5, 128, [1, .5, .7, .5, 1, .4, .8, .6], {gain: .42});
ostinato('act4', 17.2, 27.5, 128, [38, 41, 38, 43, 38, 41, 45, 43], {gain: .14});
at('act4', 17, 29, tremolo(Dm, 12, {cut: 1100, att: 1}), {gain: .2});
at('act4', 28.5, 32, pad([50, 57, 62, 65, 69, 74], 3.5, {cut: 3000, att: 2.8, rel: .4}), {gain: .3});

/* Act V: the tower. The ostinato climbs a step with every tier; drums gather; at the summit the strings hold a tremolo over the drone. */
at('act5', 0, 8, pad(Dm, 8, {cut: 700, att: 3}), {gain: .3});
ostinato('act5', 8, 21, 120, [38, 45, 50, 45], {gain: .16, shiftAt: (t) => [0, 2, 3, 5, 7, 9][Math.min(5, Math.floor((t - 8) / 2.4))]});
drums('act5', 8, 21, 120, [1, 0, .5, 0, .8, 0, .5, .5], {gain: .32});
drums('act5', 17, 21.6, 160, [.6, .6, .8, .8], {gain: .35});
at('act5', 21.6, 25, taiko({big: 1.4, seed: 55}), {gain: .9});
at('act5', 21, 34, tremolo([38, 45, 50, 53, 57, 62], 13, {cut: 1500, att: 2}), {gain: .24});
melody('act5', 27.5, .8, THEME.slice(0, 7), 'erhu', {gain: .2, shift: 12});

/* Act VI: the frozen instant thins to one high harmonic and dies at 3.4 s; at 4.0 the world rings: taiko, and the theme's chord in D major. */
at('act6', 0, 3.4, pad([74, 81, 86], 3.4, {cut: 4000, att: .5, rel: 1.2}), {gain: .18});
at('act6', 4.0, 9, taiko({big: 2.2, seed: 101}), {gain: 1.3});
at('act6', 4.0, 22, pad(DM, 18, {cut: 2500, att: .08, rel: 8}), {gain: .42});
drums('act6', 5.5, 12, 84, [1, 0, 0, 0, .7, 0, 0, 0], {gain: .35});
melody('act6', 12, .8, THEME, 'qin', {gain: .45, pan: 0});

/* Epilogue: the theme once more, softly, and out. */
at('epilogue', 0, 16, pad(Dm, 16, {cut: 700, att: 2, rel: 6}), {gain: .3});
melody('epilogue', 1.5, .85, THEME, 'erhu', {gain: .18});

/* edge fades in the same places as the picture, then a gentle bus compressor and soft clip */
let s0 = 0;
for (const [name, len] of SECTIONS) {
  const fin = name === 'prologue' ? 1.5 : 0, fout = name === 'epilogue' ? 2.1 : 0;
  for (let i = Math.floor(s0 * SR), e = Math.floor((s0 + len) * SR); i < e; i++) { const t = i / SR - s0; const g = Math.min(1, fin ? t / fin : 1, fout ? (len - t) / fout : 1); B[0][i] *= g; B[1][i] *= g; }
  s0 += len;
}
{ let env = 0; for (let i = 0; i < B[0].length; i++) { const a = Math.max(Math.abs(B[0][i]), Math.abs(B[1][i])); env = Math.max(a, env * .9999); const g = env > .6 ? .6 / env : 1; B[0][i] = Math.tanh(B[0][i] * g); B[1][i] = Math.tanh(B[1][i] * g); } }

const out = resolve(dirname(fileURLToPath(import.meta.url)), '../out/audio/music.wav');
mkdirSync(dirname(out), {recursive: true});
writeFileSync(out, wav(B));
console.log('wrote', out, TOTAL, 's');
