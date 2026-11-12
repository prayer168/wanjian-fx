import * as THREE from 'three';

export const ease = (t) => t < .5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
export const easeOut = (t) => 1 - Math.pow(1 - t, 3);
const V = (a) => new THREE.Vector3(...a);

/* a camera move: position spline + look-at spline, eased, fov ramp, optional handheld drift */
export function pathShot(name, dur, pts, looks, {fov = [38, 38], curve = ease, shake = 0, roll = 0} = {}) {
  const P = pts.length > 1 ? new THREE.CatmullRomCurve3(pts.map(V)) : null, L = looks.length > 1 ? new THREE.CatmullRomCurve3(looks.map(V)) : null;
  const p0 = V(pts[0]), l0 = V(looks[0]), tmp = new THREE.Vector3();
  return {
    name, dur,
    cam(t, c) {
      const u = curve(Math.min(1, t / dur));
      if (P) P.getPoint(u, c.position); else c.position.copy(p0);
      if (L) L.getPoint(u, tmp); else tmp.copy(l0);
      if (shake) { c.position.x += Math.sin(t * 1.3) * shake + Math.sin(t * 3.1) * shake * .3; c.position.y += Math.sin(t * 1.7 + 1) * shake * .7; }
      c.up.set(0, 1, 0); c.lookAt(tmp);
      if (roll) c.rotateZ(roll * Math.sin(t * .4));
      c.fov = fov[0] + (fov[1] - fov[0]) * u;
    },
  };
}

/* orbit/spiral around a point: angle a0->a1 (rad), radius r0->r1, height y0->y1, look height l0->l1 */
export function orbitShot(name, dur, c0, {a = [0, 1], r = [20, 20], y = [5, 5], look = [5, 5], fov = [38, 38], curve = ease} = {}) {
  return {
    name, dur,
    cam(t, c) {
      const u = curve(Math.min(1, t / dur)), L = (p) => p[0] + (p[1] - p[0]) * u, ang = L(a), rr = L(r);
      c.position.set(c0[0] + Math.sin(ang) * rr, L(y), c0[2] + Math.cos(ang) * rr);
      c.up.set(0, 1, 0); c.lookAt(c0[0], L(look), c0[2]);
      c.fov = L(fov);
    },
  };
}

/* ---------- time: speed ramps and freezes ----------
   ramp([[0, 1], [1.2, .15], [2.4, 1]]) -> a time map: speed 1 until 1.2 s, eased down to .15 (slow motion), back to 1 at 2.4 s.
   Returns action seconds elapsed for lt film seconds (integrated speed). */
export function ramp(keys) {
  const sp = (t) => { if (t <= keys[0][0]) return keys[0][1]; for (let i = 1; i < keys.length; i++) if (t <= keys[i][0]) { const [a, va] = keys[i - 1], [b, vb] = keys[i], u = (t - a) / (b - a); return va + (vb - va) * u * u * (3 - 2 * u); } return keys[keys.length - 1][1]; };
  const dt = 1 / 240, table = [0];
  return (lt) => { const n = Math.ceil(lt / dt); for (let i = table.length; i <= n; i++) table.push(table[i - 1] + sp((i - .5) * dt) * dt); const f = lt / dt, i = Math.floor(f); return table[i] + (table[Math.min(n, i + 1)] - table[i]) * (f - i); };
}

/* ---------- lens tricks ---------- */
/* crash zoom: hold fov a, then snap to b over d seconds starting at t0 */
export const crash = (a, b, t0, d = .18) => (lt) => a + (b - a) * easeOut(Math.min(1, Math.max(0, (lt - t0) / d)));
/* dolly zoom (Vertigo): camera slides along dir from the subject from distance d0 to d1 while the fov keeps a frame `width` metres wide on it */
export function dollyZoom(name, dur, subject, dir, {d0 = 6, d1 = 16, width = 2.2, lift = 0} = {}) {
  const S = new THREE.Vector3(...subject), D = new THREE.Vector3(...dir).normalize();
  return {name, dur, cam(t, c) { const u = ease(Math.min(1, t / dur)), d = d0 + (d1 - d0) * u; c.position.copy(S).addScaledVector(D, d); c.position.y += lift; c.up.set(0, 1, 0); c.lookAt(S); c.fov = 2 * Math.atan(width / 2 / d) * 180 / Math.PI; }};
}
/* overhead: straight down from h0 to h1, screen-up along `heading`, slowly turning by `spin` radians */
export function overheadShot(name, dur, center, {h0 = 30, h1 = 18, heading = 0, spin = .4, fov = [40, 40]} = {}) {
  const C = new THREE.Vector3(...center);
  return {name, dur, cam(t, c) { const u = ease(Math.min(1, t / dur)), a = heading + spin * u; c.position.set(C.x, C.y + h0 + (h1 - h0) * u, C.z); c.up.set(Math.sin(a), 0, -Math.cos(a)); c.lookAt(C); c.fov = fov[0] + (fov[1] - fov[0]) * u; }};
}
/* whip-pan smear for the last/first `d` seconds of a shot: attach as shot.whip */
export const whipOut = (dur, d = .22, dir = 1) => (lt, v) => { const k = Math.max(0, (lt - (dur - d)) / d); v.set(dir * .14 * k * k, 0); };
export const whipIn = (d = .22, dir = 1) => (lt, v) => { const k = Math.max(0, 1 - lt / d); v.set(dir * .14 * k * k, 0); };
/* yaw the camera with the smear so the picture actually swings */
export function withWhip(shot, {out = true, inn = false, d = .22, dir = 1, swing = .9} = {}) {
  const base = shot.cam, dur = shot.dur;
  shot.cam = (lt, c, st) => { base(lt, c, st); const ko = out ? Math.max(0, (lt - (dur - d)) / d) : 0, ki = inn ? Math.max(0, 1 - lt / d) : 0; c.rotateY(-dir * swing * (ko * ko - ki * ki)); };
  shot.whip = (lt, v) => { const ko = out ? Math.max(0, (lt - (dur - d)) / d) : 0, ki = inn ? Math.max(0, 1 - lt / d) : 0; v.set(dir * .14 * Math.max(ko * ko, ki * ki), 0); };
  return shot;
}
