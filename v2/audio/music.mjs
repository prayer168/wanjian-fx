// The score, composed in code (no samples, no models), as ONE continuous piece: a single tempo grid (96 bpm) and a single
// four-chord cycle in D minor run from the first frame to the last; sections only change the intensity and the instruments,
// so nothing restarts at a cut. Guqin-like plucks (Karplus-Strong), an erhu-like bowed line, taiko and a low string pad.
// Act VI keeps its half second of total silence before the impact. Output: out/audio/music.wav (pre-normalisation).
import {writeFileSync, mkdirSync} from 'node:fs';
import {dirname, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {SR, buf, add, rng, Biquad, white, smooth, wav} from './dsp.mjs';
import {SECTIONS} from './sections.mjs';

const TOTAL = SECTIONS.reduce((a, s) => a + s[1], 0), B = buf(TOTAL), R = rng(88);
const START = {}; { let t = 0; for (const [n, l] of SECTIONS) { START[n] = t; t += l; } }
const S = (sec, t) => START[sec] + t;                        // section time -> film time
const mf = (m) => 440 * 2 ** ((m - 69) / 12);
const BPM = 96, BEAT = 60 / BPM, BAR = BEAT * 4;
const IMPACT = S('act6', 4.0), HUSH = [S('act6', 3.4), IMPACT];

/* intensity 0..3 over the film: calm, light, driving, full. Linear between keys. */
const INT = [[0, 0], [S('act1', 0), .6], [S('act1', 24), 1.6], [S('act1', 32), 2.2], [S('act2', 0), 1.8], [S('act2', 14), 2.4], [S('act2', 37), 1.2],
  [S('act3', 0), 1], [S('act3', 20), 2.4], [S('act3', 29), 2.6], [S('act3', 33), 1.2], [S('act4', 0), 1.2], [S('act4', 17), 3], [S('act4', 29), 2.2],
  [S('act5', 0), 1.6], [S('act5', 8), 2.4], [S('act5', 21), 2.8], [S('act6', 0), 2.8], [S('act6', 3.4), 0], [IMPACT, 3], [S('act6', 14), 1.4], [S('epilogue', 0), .6], [TOTAL, 0]];
const lvl = (t) => { for (let i = 1; i < INT.length; i++) if (t <= INT[i][0]) { const [a, va] = INT[i - 1], [b, vb] = INT[i]; return va + (vb - va) * (t - a) / Math.max(1e-6, b - a); } return 0; };

/* ---------- instruments ---------- */
function qin(f, {decay = .9965, len = 4, seed = 1} = {}) {
  const N = Math.max(2, Math.round(SR / f)), d = new Float32Array(N), Rr = rng(seed), body = new Biquad('bp', 220, 1.2);
  for (let i = 0; i < N; i++) d[i] = Rr() * 2 - 1;
  for (let p = 0; p < 2; p++) for (let i = 0; i < N; i++) d[i] = (d[i] + d[(i + 1) % N]) * .5;
  let k = 0;
  return (t) => { if (t > len) return 0; const i = k % N, j = (k + 1) % N, y = d[i]; d[i] = decay * .5 * (d[i] + d[j]); k++; return (y + body.run(y) * .6) * Math.min(1, t * 400); };
}
function erhu(notes, {gain = 1, seed = 3} = {}) {
  const f1 = new Biquad('bp', 900, 2.2), f2 = new Biquad('bp', 1700, 3), f3 = new Biquad('bp', 3200, 4), lp = new Biquad('lp', 5200), n = white(seed);
  let ph = 0, f = mf(notes[0][1]), idx = 0;
  return (t) => {
    while (idx < notes.length - 1 && t >= notes[idx + 1][0]) idx++;
    const [t0, m, dur] = notes[idx], lt = t - t0;
    f += (mf(m) - f) * .0016;
    const vib = 1 + .006 * smooth(.25, .9, lt) * Math.sin(2 * Math.PI * 5.6 * t);
    ph = (ph + f * vib / SR) % 1;
    const env = smooth(0, .12, lt) * (1 - smooth(dur - .25, dur + .05, lt)) * (lt < dur + .05 ? 1 : 0), x = 2 * ph - 1 + n() * .08;
    return lp.run(f1.run(x) * 1.2 + f2.run(x) * .9 + f3.run(x) * .5) * env * gain * 1.6;
  };
}
function taiko({big = 1, seed = 5} = {}) {
  const n = white(seed), bp = new Biquad('bp', 180, 1.5); let ph = 0;
  return (t) => { const f = 48 + 70 * Math.exp(-t * 18) * big; ph += f / SR; return (Math.sin(2 * Math.PI * ph) * Math.exp(-t * (3.2 / big)) * 1.4 + bp.run(n()) * Math.exp(-t * 40) * .6) * big; };
}
function pluck(m, len = .6) { const f = mf(m); return (lt) => (Math.sin(2 * Math.PI * f * lt) + .5 * Math.sin(4 * Math.PI * f * lt) + .25 * Math.sin(6 * Math.PI * f * lt)) * Math.exp(-lt * 7) * Math.min(1, lt * 300) * (lt < len ? 1 : 0); }

/* ---------- harmony: one cycle for the whole film, one chord per two bars: Dm - Bb - C - Am ---------- */
const CHORDS = [[38, 45, 50, 53, 57], [34, 46, 50, 53, 58], [36, 43, 48, 52, 55], [33, 45, 48, 52, 57]];
const chordAt = (t) => CHORDS[Math.floor(t / (BAR * 2)) % 4];
/* the pad is a single voice-led drone for the whole film: each note glides to the nearest note of the next chord */
{
  const lpA = new Biquad('lp', 600, .8), lpB = new Biquad('lp', 600, .8), ph = new Float64Array(10).map(() => R()), cur = [...CHORDS[0]];
  let k = 0;
  add(B, 0, TOTAL, (t) => {
    if ((k++ & 255) === 0) { const c = chordAt(t), cut = 500 + 900 * lvl(t) / 3; lpA.set(cut); lpB.set(cut * 1.3); for (let i = 0; i < 5; i++) cur[i] = cur[i] + (c[i] - cur[i]) * .25; }
    let s = 0; for (let i = 0; i < 5; i++) for (let j = 0; j < 2; j++) { const q = i * 2 + j; ph[q] = (ph[q] + mf(cur[i] + (j ? .07 : -.06)) / SR) % 1; s += 2 * ph[q] - 1; }
    const g = (.22 + .1 * lvl(t)) * Math.min(1, t / 4);
    return lpB.run(lpA.run(s / 10)) * g * 1.8;
  });
}

/* ---------- the theme, stated over the whole film in different voices ---------- */
const THEME = [[69, 2], [72, 2], [74, 4], [72, 2], [69, 2], [67, 4], [69, 2], [65, 2], [67, 2], [69, 2], [62, 8]];     // in eighth notes
function melody(t0, notes, inst, {gain = .4, shift = 0, pan = 0} = {}) {
  let t = Math.round(t0 / (BEAT / 2)) * BEAT / 2; const out = [];        // snap to the grid
  for (const [m, e] of notes) { out.push([t, m + shift, e * BEAT / 2]); t += e * BEAT / 2; }
  if (inst === 'qin') for (const [tt, m, d] of out) add(B, tt, tt + d + 3, qin(mf(m), {len: d + 2.5, seed: Math.floor(tt * 10)}), {pan, gain});
  else add(B, out[0][0], t + .3, erhu(out.map(([tt, m, d]) => [tt - out[0][0], m, d]), {seed: Math.floor(t0)}), {pan, gain});
}
melody(S('prologue', 4), THEME, 'qin', {gain: .5, pan: -.2});
melody(S('act1', 16), THEME, 'erhu', {gain: .2, pan: .2});
melody(S('act2', 22), THEME, 'erhu', {gain: .2, shift: 12, pan: .1});
melody(S('act2', 37), THEME.slice(0, 6), 'qin', {gain: .35, shift: 12});
melody(S('act3', 2), THEME, 'qin', {gain: .35});
melody(S('act3', 20), THEME.slice(0, 8), 'erhu', {gain: .2});
melody(S('act4', 3), THEME.slice(4), 'erhu', {gain: .22, shift: -12});
melody(S('act5', 27), THEME.slice(0, 7), 'erhu', {gain: .22, shift: 12});
melody(S('act6', 12), THEME, 'qin', {gain: .45});
melody(S('epilogue', 1), THEME, 'erhu', {gain: .18});

/* ---------- rhythm on the one global grid; density follows intensity ---------- */
const PAT = [[1, 0, 0, 0, 0, 0, 0, 0], [1, 0, 0, 0, .7, 0, 0, 0], [1, 0, .4, .3, .8, 0, .5, .3], [1, .5, .7, .5, 1, .4, .8, .6]];
for (let t = 0, k = 0; t < TOTAL; t += BEAT / 2, k++) {
  if (t > HUSH[0] - .05 && t < IMPACT + 1.2) continue;
  const L = lvl(t), p = PAT[Math.min(3, Math.floor(L))][k % 8] * Math.min(1, L);
  if (p > .05 && L >= .5) add(B, t, t + 2, taiko({big: .6 + p * .4, seed: k}), {pan: (R() - .5) * .3, gain: .38 * p});
  if (L >= 1.5) { const c = chordAt(t), m = [c[0], c[0], c[1], c[2], c[0] + 12, c[2], c[1], c[0]][k % 8]; add(B, t, t + .7, pluck(m), {gain: .12 * Math.min(1, L - 1.4), pan: k % 2 ? .25 : -.25}); }
}
/* qin ripples in the bamboo, woodblock clock in the duel */
for (let t = S('act3', 2), k = 0; t < S('act3', 19); t += BEAT / 2, k++) { const c = chordAt(t); add(B, t, t + 3, qin(mf(c[2 + k % 3] + 24), {len: 2.5, seed: k + 300}), {pan: Math.sin(k) * .5, gain: .16}); }
/* tremolo strings for the standoffs */
for (const [a, b] of [[S('act2', 32.2), S('act2', 37)], [S('act5', 21), S('act6', 3.4)]]) {
  const lp = new Biquad('lp', 1500, .7), ph = [0, 0, 0, 0, 0];
  add(B, a, b, (lt, t) => { const c = chordAt(t); let s = 0; for (let i = 0; i < 5; i++) { ph[i] = (ph[i] + mf(c[i] + 12) / SR) % 1; s += 2 * ph[i] - 1; } return lp.run(s / 5) * (.55 + .45 * Math.sin(2 * Math.PI * 11 * lt)) * smooth(0, 1, lt) * (1 - smooth(b - a - .3, b - a, lt)); }, {gain: .3});
}
/* the big drum hits on the story beats */
for (const [t, big, g] of [[S('act1', 32.55), 1.6, 1], [S('act3', 28.45), 1.8, 1.1], [S('act5', 21.6), 1.4, .9], [IMPACT, 2.2, 1.3]]) add(B, t, t + 5, taiko({big, seed: Math.floor(t)}), {gain: g});
/* after the impact: the chord turns to D major, the only time it does */
{ const lp = new Biquad('lp', 2500, .7), ph = new Float64Array(6); const DM = [38, 45, 50, 54, 57, 62];
  add(B, IMPACT, S('act6', 22), (lt) => { let s = 0; for (let i = 0; i < 6; i++) { ph[i] = (ph[i] + mf(DM[i]) / SR) % 1; s += 2 * ph[i] - 1; } return lp.run(s / 6) * smooth(0, .08, lt) * (1 - smooth(10, 18, lt)) * 1.6; }, {gain: .4}); }

/* the hush before the impact is total silence; a slow fade-in at the start and out at the end; gentle compressor + soft clip */
for (let i = 0; i < B[0].length; i++) {
  const t = i / SR; let g = Math.min(1, t / 1.5, (TOTAL - t) / 2.5);
  if (t > HUSH[0] && t < IMPACT) g *= 1 - smooth(HUSH[0], HUSH[0] + .25, t);
  B[0][i] *= g; B[1][i] *= g;
}
{ let env = 0; for (let i = 0; i < B[0].length; i++) { const a = Math.max(Math.abs(B[0][i]), Math.abs(B[1][i])); env = Math.max(a, env * .9999); const g = env > .6 ? .6 / env : 1; B[0][i] = Math.tanh(B[0][i] * g); B[1][i] = Math.tanh(B[1][i] * g); } }

const out = resolve(dirname(fileURLToPath(import.meta.url)), '../out/audio/music.wav');
mkdirSync(dirname(out), {recursive: true});
writeFileSync(out, wav(B));
console.log('wrote', out, TOTAL, 's');
