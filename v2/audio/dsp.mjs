// Small offline DSP kit: seeded noise, RBJ biquads, envelopes, bells, impacts. Everything renders into Float32 stereo buffers at 48 kHz.
export const SR = 48000;

export function rng(a) {
  return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
export const buf = (sec) => [new Float32Array(Math.ceil(sec * SR)), new Float32Array(Math.ceil(sec * SR))];
export const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
export const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

/* RBJ cookbook biquad; set() can be called while running for swept filters */
export class Biquad {
  constructor(type, f, q = .707) { this.type = type; this.x1 = this.x2 = this.y1 = this.y2 = 0; this.set(f, q); }
  set(f, q = this.q) {
    this.q = q; const w = 2 * Math.PI * clamp(f, 10, SR * .45) / SR, c = Math.cos(w), s = Math.sin(w), al = s / (2 * q);
    let b0, b1, b2; const a0 = 1 + al;
    if (this.type === 'lp') { b0 = (1 - c) / 2; b1 = 1 - c; b2 = b0; }
    else if (this.type === 'hp') { b0 = (1 + c) / 2; b1 = -(1 + c); b2 = b0; }
    else { b0 = al; b1 = 0; b2 = -al; }  // band-pass, 0 dB peak
    this.b0 = b0 / a0; this.b1 = b1 / a0; this.b2 = b2 / a0; this.a1 = -2 * c / a0; this.a2 = (1 - al) / a0;
  }
  run(x) { const y = this.b0 * x + this.b1 * this.x1 + this.b2 * this.x2 - this.a1 * this.y1 - this.a2 * this.y2; this.x2 = this.x1; this.x1 = x; this.y2 = this.y1; this.y1 = y; return y; }
}

/* coloured noise sources */
export function white(seed) { const R = rng(seed); return () => R() * 2 - 1; }
export function pink(seed) {  // Paul Kellet's filter
  const w = white(seed); let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
  return () => { const x = w(); b0 = .99886 * b0 + x * .0555179; b1 = .99332 * b1 + x * .0750759; b2 = .969 * b2 + x * .153852; b3 = .8665 * b3 + x * .3104856; b4 = .55 * b4 + x * .5329522; b5 = -.7616 * b5 - x * .016898; const y = b0 + b1 + b2 + b3 + b4 + b5 + b6 + x * .5362; b6 = x * .115926; return y * .11; };
}
export function brown(seed) { const w = white(seed); let y = 0; return () => { y = (y + .02 * w()) / 1.02; return y * 3.5; }; }

/* slow random control signal in [0,1] (smoothed value noise), period ~ sec */
export function drift(seed, sec) {
  const R = rng(seed), pts = Array.from({length: 4096}, R);
  return (t) => { const u = t / sec, i = Math.floor(u), f = u - i, s = f * f * (3 - 2 * f); return pts[i & 4095] * (1 - s) + pts[(i + 1) & 4095] * s; };
}

/* add a mono signal fn(t) into a stereo buffer from t0 to t1 with pan (-1..1) and gain */
export function add(B, t0, t1, fn, {pan = 0, gain = 1} = {}) {
  const gl = gain * Math.sqrt((1 - pan) / 2), gr = gain * Math.sqrt((1 + pan) / 2);
  const i0 = Math.max(0, Math.floor(t0 * SR)), i1 = Math.min(B[0].length, Math.floor(t1 * SR));
  for (let i = i0; i < i1; i++) { const v = fn(i / SR - t0, i / SR); B[0][i] += v * gl; B[1][i] += v * gr; }
}
/* stereo bed from two decorrelated generators */
export function bed(B, t0, t1, makeL, makeR, env, gain = 1) {
  const L = makeL(), Rr = makeR(), i0 = Math.floor(t0 * SR), i1 = Math.min(B[0].length, Math.floor(t1 * SR));
  for (let i = i0; i < i1; i++) { const t = i / SR, g = env(t) * gain; B[0][i] += L(t) * g; B[1][i] += Rr(t) * g; }
}

/* ---------- instruments ---------- */

/* wind: band-passed pink noise whose centre and level wander with gusts */
export function wind(seed, {lo = 180, hi = 900, gust = 6, q = .8} = {}) {
  const n = pink(seed), bp = new Biquad('bp', 400, q), lp = new Biquad('lp', 2200), d = drift(seed + 1, gust), d2 = drift(seed + 2, gust * .37);
  let k = 0;
  return (t) => { if ((k++ & 63) === 0) bp.set(lo + (hi - lo) * d(t)); return lp.run(bp.run(n())) * (.35 + .9 * d2(t) ** 1.5) * 3; };
}
/* leaves / bamboo rustle: high-passed white noise in gusts with fine flutter */
export function rustle(seed, {gust = 4, bright = 3500} = {}) {
  const n = white(seed), hp = new Biquad('hp', 1800), lp = new Biquad('lp', bright), d = drift(seed + 3, gust), f = drift(seed + 4, .06);
  return (t) => lp.run(hp.run(n())) * (.15 + d(t) ** 2 * 1.2) * (.6 + .4 * f(t));
}
/* rain: a dense hiss plus individual drop ticks */
export function rain(seed, {density = 900, body = 1} = {}) {
  const n = pink(seed), hp = new Biquad('hp', 500), lp = new Biquad('lp', 9000), R = rng(seed + 9), tick = new Biquad('bp', 3000, 4);
  let drop = 0;
  let k = 0;
  return () => { if (R() < density / SR) { drop = .6 + R() * .8; tick.set(2000 + R() * 3000); } drop *= .993; k++; return lp.run(hp.run(n())) * 1.6 * body + tick.run((R() * 2 - 1) * drop) * .5; };
}
/* night insects: chirp trains of a ~4.4 kHz tone */
export function crickets(seed) {
  const R = rng(seed), f = 4200 + R() * 500, rate = 14 + R() * 6, per = 1.2 + R() * 1.4;
  return (t) => { const ph = (t % per) / per; const on = ph < .45 ? Math.max(0, Math.sin(Math.PI * 2 * rate * t)) ** 6 : 0; return Math.sin(2 * Math.PI * f * t) * on * .25; };
}
/* distant crowd murmur: several formant bands of pink noise, each with its own swelling */
export function murmur(seed) {
  const bands = [[320, 1.5], [620, 2], [1100, 2.5], [2300, 3]].map(([f, q], k) => ({n: pink(seed + k), bp: new Biquad('bp', f, q), d: drift(seed + 10 + k, .35 + k * .1), f}));
  const d = drift(seed + 30, 3);
  return (t) => { let s = 0; for (const b of bands) s += b.bp.run(b.n()) * (.3 + b.d(t) ** 2); return s * (.6 + .4 * d(t)) * 1.4; };
}
/* ember crackle: sparse sharp ticks through a low-pass */
export function crackle(seed, {rate = 9} = {}) {
  const R = rng(seed), lp = new Biquad('lp', 4500), hp = new Biquad('hp', 600); let e = 0;
  return () => { if (R() < rate / SR) e = .5 + R(); e *= .985; return hp.run(lp.run((R() * 2 - 1) * e)); };
}

/* bronze bell: strike transient + inharmonic partials (hum, prime, tierce, quint, nominal...) with long, unequal decays and beating */
export function bell(f0, {decay = 9, bright = 1, seed = 1} = {}) {
  const P = [[.5, 1, 1.0], [1, .8, .8], [1.19, .55, .55], [1.5, .4, .45], [2, .5, .35], [2.51, .3 * bright, .22], [2.66, .22 * bright, .2], [3.01, .18 * bright, .15], [4.16, .14 * bright, .1], [5.43, .1 * bright, .07]];
  const n = white(seed), bp = new Biquad('bp', f0 * 3, 1.2);
  return (t) => {
    let s = 0;
    for (const [r, a, d] of P) { const f = f0 * r; s += a * Math.exp(-t / (decay * d)) * Math.sin(2 * Math.PI * f * t) * (1 + .25 * Math.sin(2 * Math.PI * (.6 + r * .3) * t)); }
    return s * .22 + bp.run(n()) * Math.exp(-t * 60) * .8;
  };
}
/* small eave chime / wind bell: bright and short */
export function chime(f0, seed = 1) {
  const P = [[1, 1, .9], [2.76, .5, .45], [5.4, .3, .22], [8.93, .15, .12]];
  return (t) => { let s = 0; for (const [r, a, d] of P) s += a * Math.exp(-t / d) * Math.sin(2 * Math.PI * f0 * r * t + seed); return s * .3 * Math.min(1, t * 800); };
}
/* deep impact: a falling sine thump + noise crack + long sub tail */
export function boom({f1 = 90, f2 = 28, len = 4, seed = 7} = {}) {
  const n = brown(seed), w = white(seed + 1), lp = new Biquad('lp', 300), hp = new Biquad('hp', 900); let ph = 0;
  return (t) => {
    const f = f2 + (f1 - f2) * Math.exp(-t * 3); ph += 2 * Math.PI * f / SR;
    return Math.sin(ph) * Math.exp(-t / (len * .35)) * 1.1 + lp.run(n()) * Math.exp(-t / len) * 1.4 + hp.run(w()) * Math.exp(-t * 25) * .9;
  };
}
/* whoosh: band-pass noise sweeping in centre frequency */
export function whoosh(seed, {from = 300, to = 2500, len = 1.2} = {}) {
  const n = pink(seed), bp = new Biquad('bp', from, 1.4); let k = 0;
  return (t) => { const u = clamp(t / len, 0, 1); if ((k++ & 31) === 0) bp.set(from * Math.pow(to / from, u)); return bp.run(n()) * Math.sin(Math.PI * u) ** 1.5 * 4; };
}
/* thunder: crack then rolling low rumble */
export function thunder(seed, {len = 6} = {}) {
  const b = brown(seed), w = white(seed + 1), lp = new Biquad('lp', 160), lp2 = new Biquad('lp', 2500), d = drift(seed + 2, .25);
  return (t) => lp.run(b()) * 3 * Math.exp(-t / len) * (.4 + d(t) * 1.2) * Math.min(1, t * 6) + lp2.run(w()) * Math.exp(-t * 9) * .7;
}
/* wooden knock (bamboo creak / tile clack): a damped resonant ping */
export function knock(f, {decay = .08, seed = 1} = {}) {
  const w = white(seed), bp = new Biquad('bp', f, 8);
  return (t) => bp.run(t < .004 ? w() : 0) * 6 * Math.exp(-t / decay) + Math.sin(2 * Math.PI * f * t) * Math.exp(-t / (decay * .6)) * .3;
}
/* dark sustained drone (tension pad) */
export function drone(f0, seed = 1) {
  const d = drift(seed, 5);
  return (t) => (Math.sin(2 * Math.PI * f0 * t) + .5 * Math.sin(2 * Math.PI * f0 * 1.5 * t + 1) + .35 * Math.sin(2 * Math.PI * f0 * 2.01 * t)) * (.6 + .4 * d(t)) * .3;
}

/* write 32-bit float stereo WAV */
export function wav(B) {
  const n = B[0].length, out = Buffer.alloc(44 + n * 8);
  out.write('RIFF', 0); out.writeUInt32LE(36 + n * 8, 4); out.write('WAVE', 8); out.write('fmt ', 12); out.writeUInt32LE(16, 16);
  out.writeUInt16LE(3, 20); out.writeUInt16LE(2, 22); out.writeUInt32LE(SR, 24); out.writeUInt32LE(SR * 8, 28); out.writeUInt16LE(8, 32); out.writeUInt16LE(32, 34);
  out.write('data', 36); out.writeUInt32LE(n * 8, 40);
  for (let i = 0; i < n; i++) { out.writeFloatLE(B[0][i], 44 + i * 8); out.writeFloatLE(B[1][i], 48 + i * 8); }
  return out;
}
