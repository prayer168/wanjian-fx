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
