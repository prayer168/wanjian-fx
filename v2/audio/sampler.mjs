// Recorded sounds on the dsp.mjs timeline: a slice of a sound file is decoded once (ffmpeg -> 48 kHz float stereo) and can be
// dropped anywhere in a buffer with gain, pan, a playback rate (pitch/speed together) and an optional fade in/out.
import {execFileSync} from 'node:child_process';
import {existsSync} from 'node:fs';
import {join} from 'node:path';
import {SR, Biquad} from './dsp.mjs';

const cache = new Map();
/* [L, R] Float32Arrays of file from `start` for `len` seconds (whole file when len is 0) */
export function load(file, start = 0, len = 0) {
  const k = `${file}|${start}|${len}`;
  if (cache.has(k)) return cache.get(k);
  if (!existsSync(file)) throw new Error('missing sound ' + file);
  const raw = execFileSync('ffmpeg', ['-v', 'error', '-ss', String(start), ...(len ? ['-t', String(len)] : []), '-i', file,
    '-ac', '2', '-ar', String(SR), '-f', 'f32le', '-'], {maxBuffer: 1 << 30});
  const f = new Float32Array(new Uint8Array(raw).buffer), n = f.length / 2, L = new Float32Array(n), R = new Float32Array(n);
  for (let i = 0; i < n; i++) { L[i] = f[2 * i]; R[i] = f[2 * i + 1]; }
  /* short fade at both ends so slices never click */
  const fade = Math.min(n >> 2, Math.round(.006 * SR));
  for (let i = 0; i < fade; i++) { const g = i / fade; L[i] *= g; R[i] *= g; L[n - 1 - i] *= g; R[n - 1 - i] *= g; }
  const s = [L, R]; cache.set(k, s); return s;
}

/* a bank: {name: [relative file, start, len]}, files under dir; every slice is peak-normalised to 0.9 so gains compare */
export function bank(dir, def) {
  const b = {};
  for (const [k, [f, start = 0, len = 0]] of Object.entries(def)) {
    let s = null;
    Object.defineProperty(b, k, {get() {
      if (s) return s;
      const [L, R] = load(join(dir, f), start, len); let p = 1e-6;
      for (let i = 0; i < L.length; i++) p = Math.max(p, Math.abs(L[i]), Math.abs(R[i]));
      s = [L.map((v) => v * .9 / p), R.map((v) => v * .9 / p)]; return s;
    }});
  }
  return b;
}

/* mix sample s into B at time t. rate < 1 plays it lower and longer. lp: low-pass cutoff (distance). fadeOut: seconds at the end
   of `max` (cut the sample short with a fade). */
export function play(B, t, s, {gain = 1, pan = 0, rate = 1, lp = 0, max = 0, fadeIn = 0} = {}) {
  const [L, R] = s, n = L.length, gl = gain * Math.sqrt((1 - pan) / 2) * Math.SQRT2, gr = gain * Math.sqrt((1 + pan) / 2) * Math.SQRT2;
  const len = Math.floor((max ? Math.min(max * SR * rate, n) : n) / rate), i0 = Math.floor(t * SR), fo = max ? Math.min(len, .08 * SR) : 0;
  const fl = lp ? new Biquad('lp', lp) : null, fr = lp ? new Biquad('lp', lp) : null;
  for (let j = 0; j < len; j++) {
    const i = i0 + j; if (i < 0) continue; if (i >= B[0].length) break;
    const p = j * rate, a = Math.floor(p), fr0 = p - a; if (a + 1 >= n) break;
    let l = L[a] + (L[a + 1] - L[a]) * fr0, r = R[a] + (R[a + 1] - R[a]) * fr0;
    if (fl) { l = fl.run(l); r = fr.run(r); }
    let g = 1;
    if (fadeIn && j < fadeIn * SR) g *= j / (fadeIn * SR);
    if (fo && j > len - fo) g *= (len - j) / fo;
    B[0][i] += l * gl * g; B[1][i] += r * gr * g;
  }
}

/* a long recording as a bed from t0 to t1 with an envelope env(t) (absolute time), starting `offset` seconds into the file;
   loops when the file is shorter than the span */
export function loop(B, t0, t1, s, env = () => 1, {offset = 0, gain = 1} = {}) {
  const [L, R] = s, n = L.length, i0 = Math.max(0, Math.floor(t0 * SR)), i1 = Math.min(B[0].length, Math.floor(t1 * SR)), off = Math.floor(offset * SR);
  for (let i = i0; i < i1; i++) { const k = (off + i - i0) % n, g = env(i / SR) * gain; B[0][i] += L[k] * g; B[1][i] += R[k] * g; }
}
