import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {M, worldUV, lerp} from './util.js';

/* ArchitectureKit: every part is pushed into a per-material bucket and merged at the end,
   so a whole city is ~20 draw calls. All geometry is non-indexed with position/normal/uv. */
export class Kit {
  constructor(mats) { this.mats = mats; this.b = {}; }
  add(mat, geo, m, uvScale = .5) {
    let g = geo.index ? geo.toNonIndexed() : geo.clone();
    if (m) g.applyMatrix4(m);
    if (uvScale) worldUV(g, uvScale);
    (this.b[mat] || (this.b[mat] = [])).push(g);
  }
  build(parent) {
    const out = {};
    for (const k in this.b) {
      const mesh = new THREE.Mesh(mergeGeometries(this.b[k]), this.mats[k]);
      mesh.castShadow = !k.startsWith('lantern') && !k.startsWith('win');
      mesh.receiveShadow = true;
      parent.add(mesh); out[k] = mesh;
    }
    this.b = {};
    return out;
  }
}

const BOX = new THREE.BoxGeometry(1, 1, 1), CYL = new THREE.CylinderGeometry(1, 1, 1, 12), CYL6 = new THREE.CylinderGeometry(1, 1, 1, 6);
const SPH = new THREE.SphereGeometry(1, 14, 10), PLANE = new THREE.PlaneGeometry(1, 1);
const CURL = new THREE.TorusGeometry(1, .22, 6, 12, Math.PI * 1.25).rotateZ(-Math.PI * .35);

/* a thin cylinder from p to q (rafters, ridges, cords) */
export function beam(kit, mat, p, q, r, T, seg6 = false) {
  const d = new THREE.Vector3().subVectors(q, p), L = d.length();
  const m = new THREE.Matrix4().compose(p.clone().add(q).multiplyScalar(.5), new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize()), new THREE.Vector3(r, L, r));
  kit.add(mat, seg6 ? CYL6 : CYL, T ? m.premultiply(T) : m);
}

/* Concave hip roof with upturned corners (飛簷翹角). A,B: eave half-sizes, r: ridge half-length, H: rise, lift: corner upturn. */
function roofSurf(A, B, r, H, lift, seg = 12) {
  const y = (u, v) => H * Math.pow(v, 1.65) + lift * Math.pow(Math.abs(2 * u - 1), 3) * Math.pow(1 - v, 2.2);
  const faces = [
    (u, v) => [lerp(lerp(-A, A, u), lerp(-r, r, u), v), y(u, v), lerp(B, 0, v)],
    (u, v) => [lerp(lerp(A, -A, u), lerp(r, -r, u), v), y(u, v), lerp(-B, 0, v)],
    (u, v) => [lerp(-A, -r, v), y(u, v), lerp(lerp(-B, B, u), 0, v)],
    (u, v) => [lerp(A, r, v), y(u, v), lerp(lerp(B, -B, u), 0, v)],
  ];
  const lens = [2 * A, 2 * A, 2 * B, 2 * B], slope = Math.hypot(B, H) * 1.1;
  const top = [], under = [], fascia = [];
  faces.forEach((F, fi) => {
    const pos = [], uv = [], idx = [];
    for (let j = 0; j <= seg; j++) for (let i = 0; i <= seg; i++) { const u = i / seg, v = j / seg; pos.push(...F(u, v)); uv.push((u - .5) * lens[fi] * lerp(1, .5, v) / 3, v * slope / 3); }
    for (let j = 0; j < seg; j++) for (let i = 0; i < seg; i++) { const a = j * (seg + 1) + i, b = a + seg + 1; idx.push(a, a + 1, b, a + 1, b + 1, b); }
    let g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals();
    if (g.attributes.normal.getY(Math.floor(seg / 2) * (seg + 1) + Math.floor(seg / 2)) < 0) { const ix = g.index.array; for (let k = 0; k < ix.length; k += 3) { const t = ix[k + 1]; ix[k + 1] = ix[k + 2]; ix[k + 2] = t; } g.computeVertexNormals(); }
    top.push(g.toNonIndexed());
    const u2 = g.clone(); u2.translate(0, -.16, 0); const ix = u2.index.array; for (let k = 0; k < ix.length; k += 3) { const t = ix[k + 1]; ix[k + 1] = ix[k + 2]; ix[k + 2] = t; } u2.computeVertexNormals(); under.push(u2.toNonIndexed());
    const fp = [], fu = [];
    for (let i = 0; i < seg; i++) {
      const a = F(i / seg, 0), b = F((i + 1) / seg, 0);
      fp.push(...a, ...b, a[0], a[1] - .2, a[2], b[0], b[1], b[2], b[0], b[1] - .2, b[2], a[0], a[1] - .2, a[2]);
      fu.push(0, 0, 1, 0, 0, 1, 1, 0, 1, 1, 0, 1);
    }
    const fg = new THREE.BufferGeometry(); fg.setAttribute('position', new THREE.Float32BufferAttribute(fp, 3)); fg.setAttribute('uv', new THREE.Float32BufferAttribute(fu, 2)); fg.computeVertexNormals(); fascia.push(fg);
  });
  return {top, under, fascia, F: faces, y};
}

export function hipRoof(kit, T, A, B, r, H, lift, ornate = true) {
  const s = roofSurf(A, B, r, H, lift);
  for (const g of s.top) kit.add('tile', g, T, 0);
  for (const g of s.under) kit.add('under', g, T, .5);
  for (const g of s.fascia) kit.add('fascia', g, T, .5);
  const V = (a) => new THREE.Vector3(...a);
  if (r > .2) {
    kit.add('ridge', BOX, M(0, H + .12, 0, 0, 2 * r + .5, .42, .36).premultiply(T));
    if (ornate) for (const sx of [-1, 1]) {  // 鴟吻 ridge-end ornaments: a tail curling back over the ridge
      kit.add('ridge', CURL, M(sx * (r + .05), H + .5, 0, sx > 0 ? 0 : Math.PI, .3, .3, .3).premultiply(T));
      kit.add('ridge', SPH, M(sx * (r + .2), H + .4, 0, 0, .14, .16, .12).premultiply(T));
    }
  }
  /* hip ridges follow the corner curve and flare at the tip */
  for (const [f, u] of [[0, 0], [0, 1], [1, 0], [1, 1]]) {
    let prev = V(s.F[f](u, 1)); prev.y += .1;
    for (let j = 7; j >= 0; j--) { const p = V(s.F[f](u, j / 8)); p.y += .1; beam(kit, 'ridge', prev, p, .13, T); prev = p; }
    if (ornate) { const tip = V(s.F[f](u, 0)); kit.add('ridge', SPH, M(tip.x, tip.y + .22, tip.z, 0, .14, .2, .14).premultiply(T)); }
  }
}

/* gold-capped red silk lantern; bucket 'lantern' (red) or 'lanternW' (white paper) */
export function lantern(kit, p, s = 1, white = false) {
  kit.add(white ? 'lanternW' : 'lantern', SPH, M(p.x, p.y, p.z, 0, .26 * s, .32 * s, .26 * s));
  kit.add('gold', CYL, M(p.x, p.y + .32 * s, p.z, 0, .13 * s, .07 * s, .13 * s));
  kit.add('gold', CYL, M(p.x, p.y - .32 * s, p.z, 0, .13 * s, .07 * s, .13 * s));
  kit.add('lantern', BOX, M(p.x, p.y - .5 * s, p.z, 0, .03 * s, .3 * s, .03 * s));
}
export function lanternString(kit, a, b, n, sag, white, lights) {
  let prev = a.clone();
  for (let i = 1; i <= 24; i++) { const t = i / 24, p = a.clone().lerp(b, t); p.y -= sag * 4 * t * (1 - t); beam(kit, 'cord', prev, p, .015, null, true); prev = p; }
  for (let i = 1; i < n; i++) {
    const t = i / n, p = a.clone().lerp(b, t); p.y -= sag * 4 * t * (1 - t) + .45;
    lantern(kit, p, .9, white && i % 2 === 0);
    if (lights) lights.push(p.clone());
  }
}

/* one shop-house / tea-house: stone plinth, lacquered columns, plaster + lattice windows, painted beams, brackets, waist eaves and hip roof */
export function building(kit, o, R, lights) {
  const T = M(o.x, o.y || 0, o.z, o.ry);
  const P = (mat, geo, m, s) => kit.add(mat, geo, m.premultiply(T), s);
  const w = o.w, d = o.d;
  P('stone', BOX, M(0, .3, 0, 0, w + .8, .6, d + .8));
  P('stone', BOX, M(0, .62, d / 2 + .55, 0, 2.2, .1, .5));
  let y = .6, ww = w, dd = d;
  for (let f = 0; f < o.floors; f++) {
    const fh = f === 0 ? 3.2 : 2.7, last = f === o.floors - 1;
    P('plaster', BOX, M(0, y + fh / 2, 0, 0, ww - .3, fh, dd - .3));
    const nc = Math.max(2, Math.round(ww / 2.3) + 1), step = (ww - .2) / (nc - 1);
    for (let i = 0; i < nc; i++) for (const zs of [-1, 1]) P('lacquer', CYL, M(-ww / 2 + .1 + i * step, y + fh / 2, zs * (dd / 2 - .1), 0, .17, fh, .17));
    for (const xs of [-1, 1]) for (let k = 1; k < Math.round(dd / 2.4); k++) P('lacquer', CYL, M(xs * (ww / 2 - .1), y + fh / 2, -dd / 2 + k * dd / Math.round(dd / 2.4), 0, .17, fh, .17));
    for (let i = 0; i < nc - 1; i++) for (const zs of [-1, 1]) {
      const cx = -ww / 2 + .1 + (i + .5) * step, door = f === 0 && zs === 1 && i === Math.floor((nc - 1) / 2);
      const lit = R() < o.lit, mat = lit ? 'winLit' : 'winDark';
      const wh = door ? fh - .7 : fh * .55, wy = door ? y + wh / 2 + .05 : y + fh * .5;
      P(mat, BOX, M(cx, wy, zs * (dd / 2 - .12), 0, step - .5, wh, .06), 0);
      if (lit && lights && zs === 1 && R() < .25) lights.push(new THREE.Vector3(cx, wy, zs * (dd / 2 + .5)).applyMatrix4(T));
    }
    P('paint', BOX, M(0, y + fh - .2, 0, 0, ww + .05, .4, dd + .05), 0);
    for (let i = 0; i < nc; i++) for (const zs of [-1, 1]) {  // 斗拱 bracket clusters on column heads
      const bx = -ww / 2 + .1 + i * step, bz = zs * (dd / 2 + .05);
      P('wood', BOX, M(bx, y + fh - .52, bz, 0, .5, .16, .5));
      P('paint', BOX, M(bx, y + fh - .36, bz + zs * .15, 0, .9, .16, .3), 0);
      P('wood', BOX, M(bx, y + fh - .2, bz + zs * .3, 0, .4, .14, .5));
    }
    if (f > 0) {  // balcony with railing
      P('wood', BOX, M(0, y + .05, dd / 2 + .55, 0, ww, .14, 1.1));
      P('lacquer', BOX, M(0, y + .95, dd / 2 + 1.05, 0, ww, .08, .08));
      for (let x = -ww / 2; x <= ww / 2 + .01; x += .35) P('wood', BOX, M(x, y + .5, dd / 2 + 1.05, 0, .05, .9, .05));
    }
    y += fh + .5;
    if (!last) {
      hipRoof(kit, M(0, y - .55, 0).premultiply(T), ww / 2 + 1.0, dd / 2 + 1.0, ww / 2 - .2, 1.0, .45, false);
      ww *= o.taper || .9; dd *= o.taper || .9; y += .5;
    }
  }
  const H = o.roofH || dd * .42;
  hipRoof(kit, M(0, y - .5, 0).premultiply(T), ww / 2 + 1.25, dd / 2 + 1.25, Math.max(.3, (ww - dd) / 2 + .6), H, o.lift ?? 1.0);
  if (o.sign) {  // vertical shop banner board
    P('lacquer', BOX, M(ww / 2 - .4, 2.6, d / 2 + .25, 0, .7, 2.0, .08));
    P('gold', BOX, M(ww / 2 - .4, 2.6, d / 2 + .3, 0, .55, 1.8, .02));
  }
  for (let i = 0; i < 2; i++) if (lights) lantern(kit, new THREE.Vector3(i ? w / 2 - .6 : -w / 2 + .6, 3.6, d / 2 + .9).applyMatrix4(T), .85);
  return y - .5 + H;
}

/* multi-tier pagoda / bell tower */
export function pagoda(kit, x, z, tiers, base, R) {
  let y = 0, s = base;
  kit.add('stone', BOX, M(x, 1, z, 0, s + 3, 2, s + 3));
  y = 2;
  for (let i = 0; i < tiers; i++) {
    const fh = i === 0 ? 5 : 3.4;
    kit.add('plaster', BOX, M(x, y + fh / 2, z, 0, s, fh, s));
    for (const a of [0, Math.PI / 2, Math.PI, Math.PI * 1.5]) {
      const T = M(x, 0, z, a);
      for (const k of [-1, 0, 1]) kit.add(R() < .6 ? 'winLit' : 'winDark', BOX, M(k * s * .3, y + fh * .5, s / 2 + .04, 0, s * .2, fh * .5, .05).premultiply(T), 0);
      for (const k of [-1, 1]) kit.add('lacquer', CYL, M(k * (s / 2 - .15), y + fh / 2, s / 2 - .15, 0, .2, fh, .2).premultiply(T));
    }
    kit.add('paint', BOX, M(x, y + fh - .25, z, 0, s + .1, .5, s + .1), 0);
    y += fh;
    hipRoof(kit, M(x, y, z), s / 2 + 1.6, s / 2 + 1.6, .25, 1.6, 1.1, false);
    y += 1.2; s *= .86;
  }
  kit.add('gold', CYL, M(x, y + 2.5, z, 0, .25, 5, .25));
  for (let k = 0; k < 6; k++) kit.add('gold', SPH, M(x, y + .8 + k * .7, z, 0, .55 - k * .06, .2, .55 - k * .06));
  return y + 5;
}

export function tree(kit, x, z, h, R) {
  const lean = (R() - .5) * .3, top = new THREE.Vector3(x + lean * h, h * .55, z + (R() - .5) * .3 * h);
  beam(kit, 'bark', new THREE.Vector3(x, 0, z), top, .12 + h * .025);
  const ico = new THREE.IcosahedronGeometry(1, 1);
  const n = 6 + Math.floor(R() * 5);
  for (let i = 0; i < n; i++) {
    const a = R() * Math.PI * 2, rr = R() * h * .28, s = h * (.18 + R() * .16);
    kit.add(R() < .5 ? 'leaf' : 'leaf2', ico, M(top.x + Math.cos(a) * rr, top.y + h * (.05 + R() * .35), top.z + Math.sin(a) * rr, R() * 6, s, s * (.7 + R() * .3), s, R(), R()));
  }
}

export function stall(kit, x, z, ry, R) {
  const T = M(x, 0, z, ry);
  kit.add('wood', BOX, M(0, .45, 0, 0, 2.4, .9, 1.1).premultiply(T));
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) kit.add('wood', CYL, M(sx * 1.15, 1.25, sz * .6, 0, .05, 2.5, .05).premultiply(T));
  const cloth = ['clothR', 'clothB', 'clothY'][Math.floor(R() * 3)];
  kit.add(cloth, PLANE, M(0, 2.5, 0, 0, 2.7, 1.6, 1, -Math.PI / 2 + .25).premultiply(T), 0);
  for (let i = 0; i < 5; i++) kit.add(R() < .5 ? 'clothY' : 'wood', BOX, M(-.9 + i * .45, 1.0, 0, 0, .3, .2 + R() * .2, .3).premultiply(T));
  lantern(kit, new THREE.Vector3(0, 2.0, .7).applyMatrix4(T), .6, true);
}

/* ================= Act II gate, Act IV bridge, Act V bell tower ================= */
function stairs(P, mat, z0, y0, n, rise, run, width, x = 0) {
  for (let i = 0; i < n; i++) { const top = y0 + (i + 1) * rise; P(mat, BOX, M(x, (y0 - .4 + top) / 2, z0 + (n - 1 - i) * run + run / 2, 0, width, top - y0 + .4, run)); }
}
/* stone balustrade from a to b, posts with round caps and recessed panels */
function balustrade(P, mat, a, b, h = 1, step = 1.6) {
  const d = new THREE.Vector3().subVectors(b, a), L = d.length(), n = Math.max(1, Math.round(L / step)), ry = Math.atan2(d.x, d.z);
  for (let i = 0; i <= n; i++) {
    const p = a.clone().lerp(b, i / n);
    P(mat, BOX, M(p.x, p.y + h / 2, p.z, ry, .24, h, .24));
    P(mat, SPH, M(p.x, p.y + h + .1, p.z, 0, .15, .17, .15));
    if (i < n) {
      const q = a.clone().lerp(b, (i + .5) / n);
      P(mat, BOX, M(q.x, q.y + h * .45, q.z, ry, .12, h * .62, L / n - .24));
      P(mat, BOX, M(q.x, q.y + h * .86, q.z, ry, .16, .1, L / n));
    }
  }
}

/* city wall along z at x, with an arched gate tunnel at gz, crenellated parapets, gate tower on top */
export function cityWall(kit, x, z0, z1, gz, R, lights) {
  const H = 11, Tk = 9, G = 3.2, P = (mat, geo, m, s) => kit.add(mat, geo, m, s);
  for (const [a, b] of [[z0, gz - G - .4], [gz + G + .4, z1]]) P('brick', BOX, M(x, H / 2, (a + b) / 2, 0, Tk, H, b - a));
  /* gate block with the arch tunnel cut out */
  const sh = new THREE.Shape(); sh.moveTo(-G - .4, 0); sh.lineTo(G + .4, 0); sh.lineTo(G + .4, H); sh.lineTo(-G - .4, H); sh.lineTo(-G - .4, 0);
  const hole = new THREE.Path(); hole.moveTo(-G + .2, 0); hole.lineTo(G - .2, 0); hole.lineTo(G - .2, 4.6); hole.absarc(0, 4.6, G - .2, 0, Math.PI, false); hole.lineTo(-G + .2, 0); sh.holes.push(hole);
  const eg = new THREE.ExtrudeGeometry(sh, {depth: Tk, bevelEnabled: false, curveSegments: 24}).translate(0, 0, -Tk / 2).rotateY(-Math.PI / 2);
  P('brick', eg, M(x, 0, gz));
  /* white stone arch ring on both faces */
  for (const sx of [-1, 1]) for (let k = 0; k <= 16; k++) { const a = k / 16 * Math.PI, rr = G + .15; P('marble', BOX, M(x + sx * (Tk / 2 + .08), 4.6 + Math.sin(a) * rr, gz + Math.cos(a) * rr, 0, .2, .7, .64, Math.PI / 2 - a)); }
  /* closed double doors with gold studs */
  for (const s of [-1, 1]) {
    P('wood', BOX, M(x + 1.5, 3.7, gz + s * (G - .2) / 2, 0, .35, 7.4, G - .25));
    for (let i = 0; i < 5; i++) for (let j = 0; j < 8; j++) P('gold', SPH, M(x + 1.3, .8 + j * .85, gz + s * ((G - .2) / 2 + (i - 2) * .55), 0, .07, .07, .07));
  }
  P('wood', BOX, M(x + 1.25, 3.4, gz, 0, .3, .45, 2 * G - .4));  // drop bar
  /* parapets: merlons outside, low wall inside */
  for (let z = z0; z < z1; z += 1.8) { P('brick', BOX, M(x - Tk / 2 + .3, H + .9, z + .55, 0, .6, 1.8, 1.1)); P('brick', BOX, M(x + Tk / 2 - .3, H + .5, z + .9, 0, .6, 1, 1.8)); }
  P('brick', BOX, M(x - Tk / 2 + .3, H + .25, (z0 + z1) / 2, 0, .62, .5, z1 - z0));
  P('stone', BOX, M(x, H + .05, (z0 + z1) / 2, 0, Tk - 1.2, .1, z1 - z0));
  /* flank watch towers along the wall */
  for (let z = z0 + 40; z < z1 - 20; z += 80) if (Math.abs(z - gz) > 30) building(kit, {x, y: H, z, ry: Math.PI / 2, w: 7, d: 6, floors: 1, lit: .5, lift: 1}, R, null);
  const top = building(kit, {x, y: H, z: gz, ry: Math.PI / 2, w: 24, d: 11, floors: 2, lit: .65, lift: 1.5, roofH: 4.6, taper: .88}, R, lights);
  for (const s of [-1, 1]) for (const zz of [-1, 1]) lantern(kit, new THREE.Vector3(x + s * (Tk / 2 + .7), 8.3, gz + zz * (G + 1.5)), 1.3);
  if (lights) for (const s of [-1, 1]) lights.push(new THREE.Vector3(x + s * (Tk / 2 + 1.2), 8, gz));
  return top;
}

/* 牌樓 memorial archway: four columns, three bays, stepped roofs, gilded plaque */
export function paifang(kit, x, z, ry) {
  const T = M(x, 0, z, ry), P = (mat, geo, m, s) => kit.add(mat, geo, m.premultiply(T), s);
  for (const c of [-5.2, -1.9, 1.9, 5.2]) {
    P('lacquer', CYL, M(c, 3.6, 0, 0, .3, 7.2, .3));
    P('stone', BOX, M(c, .5, 0, 0, .9, 1, 1.4));
    for (const s of [-1, 1]) P('stone', CYL, M(c, .9, s * .9, 0, .45, .26, .45, 0, Math.PI / 2));  // drum stones
  }
  P('paint', BOX, M(0, 5.6, 0, 0, 11.4, .55, .42), 0); P('paint', BOX, M(0, 6.7, 0, 0, 11.4, .4, .36), 0);
  P('lacquer', BOX, M(0, 6.15, 0, 0, 3.4, .9, .2)); P('gold', BOX, M(0, 6.15, .12, 0, 3.0, .7, .02));
  for (const s of [-1, 1]) P('paint', BOX, M(s * 3.55, 6.15, 0, 0, 2.9, .5, .24), 0);
  hipRoof(kit, M(0, 7.3, 0).premultiply(T), 2.4, 1.2, 1.6, .9, .55, true);
  for (const s of [-1, 1]) hipRoof(kit, M(s * 3.55, 6.9, 0).premultiply(T), 2.0, 1.0, 1.2, .75, .45, false);
  for (const s of [-1, 1]) hipRoof(kit, M(s * 6.3, 6.2, 0).premultiply(T), 1.2, .9, .4, .6, .35, false);
}

/* bronze bell profile (梵鐘): nearly straight waist, flared lip; scaled for the great bell or the eave chimes */
export function bellGeo(s = 1) {
  const pr = [[0, 1.0], [.32, .99], [.42, .93], [.44, .8], [.45, .3], [.5, .08], [.53, 0], [.49, -.01], [.44, .12], [.41, .85], [0, .9]].map(([r, y]) => new THREE.Vector2(r * s, y * s));
  return new THREE.LatheGeometry(pr, 28);
}

/* seven-tier bell tower: marble terraces + stairs, galleried tiers with railings, brackets, lattice windows,
   open top pavilion holding the great bell. Returns chime hook points and the bell anchor for animation. */
export function bellTower(kit, x, z, R) {
  const T0 = M(x, 0, z), P = (mat, geo, m, s) => kit.add(mat, geo, m.premultiply(T0), s), V = (...a) => new THREE.Vector3(...a);
  P('marble', BOX, M(0, 1, 0, 0, 30, 2, 30)); P('marble', BOX, M(0, 2.75, 0, 0, 23, 1.5, 23));
  stairs(P, 'marble', 15, 0, 8, .25, .45, 6); stairs(P, 'marble', 11.5, 2, 6, .25, .45, 5);
  for (const [a, b] of [[V(-15, 2, -15), V(15, 2, -15)], [V(15, 2, -15), V(15, 2, 15)], [V(-15, 2, 15), V(-15, 2, -15)], [V(-15, 2, 15), V(-3.4, 2, 15)], [V(3.4, 2, 15), V(15, 2, 15)]]) balustrade(P, 'marble', a, b, 1);
  for (const [a, b] of [[V(-11.5, 3.5, -11.5), V(11.5, 3.5, -11.5)], [V(11.5, 3.5, -11.5), V(11.5, 3.5, 11.5)], [V(-11.5, 3.5, 11.5), V(-11.5, 3.5, -11.5)], [V(-11.5, 3.5, 11.5), V(-2.9, 3.5, 11.5)], [V(2.9, 3.5, 11.5), V(11.5, 3.5, 11.5)]]) balustrade(P, 'marble', a, b, .9);
  const hooks = [], tiers = [];
  let y = 3.5, s = 13, bellAnchor = null;
  for (let i = 0; i < 7; i++) {
    const open = i === 6, fh = i === 0 ? 5.6 : open ? 4.6 : 3.6, hs = s / 2;
    tiers.push({y, s});
    if (!open) P('plaster', BOX, M(0, y + fh / 2, 0, 0, s - .4, fh, s - .4));
    else { P('marble', BOX, M(0, y + .15, 0, 0, s + .6, .3, s + .6)); P('plaster', BOX, M(0, y - .6, 0, 0, s - .6, 1.4, s - .6)); }
    for (let f = 0; f < 4; f++) {
      const T = M(0, 0, 0, f * Math.PI / 2), Q = (mat, geo, m, sc) => P(mat, geo, m.premultiply(T), sc);
      for (let k = 0; k < 4; k++) Q('lacquer', CYL, M(-hs + .15 + k * (s - .3) / 3, y + fh / 2, hs - .15, 0, .22, fh, .22));
      if (!open) for (const k of [-1, 0, 1]) {
        const door = i === 0 && f === 0 && k === 0;
        Q(door || R() < .55 ? 'winLit' : 'winDark', BOX, M(k * (s - .3) / 3, door ? y + 1.7 : y + fh * .52, hs - .16, 0, (s - .3) / 3 - .6, door ? 3.3 : fh * .5, .06), 0);
      }
      for (let k = 0; k <= 6; k++) {  // bracket sets along the eave line
        const bx = -hs + k * s / 6;
        Q('wood', BOX, M(bx, y + fh - .5, hs + .05, 0, .45, .16, .45)); Q('paint', BOX, M(bx, y + fh - .34, hs + .3, 0, .8, .16, .5), 0); Q('wood', BOX, M(bx, y + fh - .17, hs + .55, 0, .36, .14, .6));
      }
      if (i > 0 && !open) {  // gallery walkway + railing on every tier above the ground floor
        Q('wood', BOX, M(0, y + .05, hs + .75, 0, s + 3, .2, 1.5));
        for (let xx = -hs - 1.4; xx <= hs + 1.41; xx += .42) Q('wood', BOX, M(xx, y + .55, hs + 1.45, 0, .06, .9, .06));
        Q('lacquer', BOX, M(0, y + 1.0, hs + 1.45, 0, s + 2.9, .09, .1)); Q('lacquer', BOX, M(0, y + .2, hs + 1.45, 0, s + 2.9, .08, .08));
      }
      if (open) for (const k of [-1, 1]) Q('lacquer', BOX, M(k * s / 4, y + .9, hs - .15, 0, s / 2 - .6, .08, .08));
    }
    P('paint', BOX, M(0, y + fh - .25, 0, 0, s + .1, .5, s + .1), 0);
    y += fh;
    const A = hs + 2.3, lift = 1.35;
    if (!open) {
      hipRoof(kit, M(0, y, 0).premultiply(T0), A, A, .25, 1.7, lift, false);
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) hooks.push(V(x + sx * (A - .05), y + lift - .12, z + sz * (A - .05)));
      y += 1.3; s *= .88;
    } else {
      P('wood', BOX, M(0, y - .55, 0, 0, s - .5, .45, .45)); P('wood', BOX, M(0, y - .55, 0, 0, .45, .45, s - .5));
      hipRoof(kit, M(0, y, 0).premultiply(T0), A + .3, A + .3, .2, 3.2, 1.6, true);
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) hooks.push(V(x + sx * (A + .25), y + 1.6 - .12, z + sz * (A + .25)));
      bellAnchor = V(x, y - .8, z);
      y += 3.2;
    }
  }
  P('gold', CYL, M(0, y + 2.6, 0, 0, .22, 5.2, .22));
  for (let k = 0; k < 7; k++) P('gold', SPH, M(0, y + .6 + k * .65, 0, 0, .6 - k * .06, .2, .6 - k * .06));
  P('gold', SPH, M(0, y + 5.4, 0, 0, .35, .5, .35));
  return {top: y + 5.6, hooks, bell: bellAnchor, tiers, base: V(x, 0, z)};
}

/* swinging eave chimes + the great bell as live meshes */
export function towerBells(scene, info, mats) {
  const chime = bellGeo(.42), clap = new THREE.BoxGeometry(.04, .3, .16), cord = new THREE.CylinderGeometry(.012, .012, .5, 5).translate(0, -.25, 0);
  const piv = [];
  for (const h of info.hooks) {
    const g = new THREE.Group(); g.position.copy(h);
    g.add(new THREE.Mesh(cord, mats.cord));
    const b = new THREE.Mesh(chime, mats.bronze); b.position.y = -.92; b.castShadow = true; g.add(b);
    const p = new THREE.Mesh(clap, mats.bronze); p.position.y = -1.05; g.add(p);
    g.userData.ph = h.x * .3 + h.y * .7 + h.z * .2; scene.add(g); piv.push(g);
  }
  const big = new THREE.Group(); big.position.copy(info.bell); scene.add(big);
  const bm = new THREE.Mesh(bellGeo(2.4).translate(0, -2.4, 0), mats.bronze.clone()); bm.material.side = THREE.DoubleSide; bm.castShadow = true; big.add(bm);
  for (const yy of [-.5, -1.2, -1.9]) { const r = new THREE.Mesh(new THREE.TorusGeometry(yy < -1.5 ? 1.12 : 1.06, .05, 6, 40).rotateX(Math.PI / 2), mats.bronze); r.position.y = yy; big.add(r); }
  const loop = new THREE.Mesh(new THREE.TorusGeometry(.3, .09, 8, 16), mats.bronze); loop.position.y = .1; big.add(loop);
  return {
    big,
    update(t, wind = 1, ring = 0) {
      for (const g of piv) { const ph = g.userData.ph; g.rotation.z = wind * (.16 * Math.sin(t * 1.9 + ph) + .06 * Math.sin(t * 4.3 + ph * 2)); g.rotation.x = wind * .1 * Math.sin(t * 1.4 + ph * 1.3); }
      big.rotation.z = ring * Math.sin(t * 2.2) * .05;
    },
  };
}

/* stone arch bridge spanning a canal along z, centred at (x,0,0). Water at wy, street at 0. */
export function archBridge(kit, x, {R = 6.5, wy = -2.6, half = 15, width = 5, bank = 8, Hd = 5} = {}, lights) {
  const yd = (z) => Hd * Math.pow(Math.max(0, 1 - (z / half) ** 2), 1.3);
  const sh = new THREE.Shape(); sh.moveTo(-half, 0); sh.lineTo(-bank, 0); sh.lineTo(-bank, wy); sh.lineTo(-R, wy);
  sh.absarc(0, wy, R, Math.PI, 0, true); sh.lineTo(bank, wy); sh.lineTo(bank, 0); sh.lineTo(half, 0);
  for (let i = 40; i >= 0; i--) { const z = -half + i / 40 * 2 * half; sh.lineTo(z, yd(z) - .05); }
  const eg = new THREE.ExtrudeGeometry(sh, {depth: width, bevelEnabled: false, curveSegments: 40}).rotateY(-Math.PI / 2).translate(width / 2, 0, 0);
  kit.add('stone', eg, M(x, 0, 0));
  const N = 29;  // voussoir ring proud of both faces, keystone
  for (const sx of [-1, 1]) for (let k = 0; k < N; k++) {
    const a = (k + .5) / N * Math.PI, rr = R + .38;
    kit.add('marble', BOX, M(x + sx * (width / 2 + .06), wy + Math.sin(a) * rr, Math.cos(a) * rr, 0, .16, .76, Math.PI * rr / N * .93, Math.PI / 2 - a));
  }
  for (const sx of [-1, 1]) kit.add('marble', BOX, M(x + sx * (width / 2 + .1), wy + R + .45, 0, 0, .24, 1.0, .7));
  for (let z = -half; z < half - .01; z += .5) { const t = Math.max(yd(z), yd(z + .5)) + .1; kit.add('stone', BOX, M(x, t - .25, z + .25, 0, width - .7, .5, .5)); }  // stepped deck
  const P = (mat, geo, m, s) => kit.add(mat, geo, m, s);
  for (const sx of [-1, 1]) {
    const n = 18, post = (p) => { P('marble', BOX, M(p.x, p.y + .55, p.z, 0, .26, 1.1, .26)); P('marble', SPH, M(p.x, p.y + 1.22, p.z, 0, .17, .2, .17)); };
    for (let i = 0; i < n; i++) {
      const za = -half + 1 + i / n * (2 * half - 2), zb = -half + 1 + (i + 1) / n * (2 * half - 2);
      const a = new THREE.Vector3(x + sx * (width / 2 - .2), yd(za) + .05, za), b = new THREE.Vector3(x + sx * (width / 2 - .2), yd(zb) + .05, zb);
      post(a); if (i === n - 1) post(b);
      const L = a.distanceTo(b), rx = -Math.atan2(b.y - a.y, b.z - a.z), m = a.clone().lerp(b, .5);
      P('marble', BOX, M(m.x, m.y + .45, m.z, 0, .12, .6, L - .26, rx)); P('marble', BOX, M(m.x, m.y + .92, m.z, 0, .17, .1, L, rx));
    }
    for (const sz of [-1, 1]) {
      P('marble', CYL, M(x + sx * (width / 2 - .2), .55, sz * (half - .2), 0, .5, .3, .5, 0, Math.PI / 2));  // drum stones at the ends
      const px = x + sx * (width / 2 + .3), pz = sz * (half - 2.5);  // lantern posts at the four ends
      beam(kit, 'wood', new THREE.Vector3(px, yd(pz), pz), new THREE.Vector3(px, yd(pz) + 3.6, pz), .08);
      beam(kit, 'wood', new THREE.Vector3(px, yd(pz) + 3.4, pz), new THREE.Vector3(px - sx * .9, yd(pz) + 3.4, pz), .05);
      const lp = new THREE.Vector3(px - sx * .9, yd(pz) + 2.7, pz); lantern(kit, lp, 1.1); if (lights) lights.push(lp);
    }
  }
  return {yd, half};
}

/* 烏篷船 canal boat: lofted hull, black matting canopy, bow lantern */
export function boat(kit, x, y, z, ry, lights) {
  const T = M(x, y, z, ry), Lh = 3.6, nx = 16, na = 8, pos = [], idx = [];
  for (let i = 0; i <= nx; i++) {
    const u = -1 + 2 * i / nx, w = Math.sqrt(Math.max(.02, 1 - u * u)), top = .55 + .45 * u ** 4, yb = -.25 + .55 * u ** 4;
    for (let j = 0; j <= na; j++) { const a = -1 + 2 * j / na; pos.push(u * Lh, yb + (top - yb) * Math.pow(Math.abs(a), 1.6), w * a); }
  }
  for (let i = 0; i < nx; i++) for (let j = 0; j < na; j++) { const a = i * (na + 1) + j, b = a + na + 1; idx.push(a, b, a + 1, a + 1, b, b + 1); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(pos.length / 3 * 2), 2)); g.setIndex(idx); g.computeVertexNormals();
  kit.add('hull', g, T, .8);
  kit.add('wood', BOX, M(0, .45, 0, 0, Lh * 1.5, .06, 1.6).premultiply(T));
  for (const [cx, len] of [[-.4, 2.2], [1.25, .9]]) kit.add('matting', new THREE.CylinderGeometry(.85, .85, len, 14, 1, true, 0, Math.PI).rotateZ(Math.PI / 2), M(cx, .48, 0).premultiply(T), .8);
  const lp = new THREE.Vector3(Lh * .82, 1.4, 0).applyMatrix4(T); lantern(kit, lp, .7, true);
  beam(kit, 'wood', new THREE.Vector3(Lh * .82, .5, 0).applyMatrix4(T), new THREE.Vector3(Lh * .82, 1.95, 0).applyMatrix4(T), .03);
  if (lights) lights.push(lp);
}

/* weeping willow: leaning trunk, arching boughs, hundreds of hanging leaf strands (bucket 'willow', uv.y=1 at the hook) */
const STRAND = mergeGeometries([0, Math.PI / 2].map((a) => new THREE.PlaneGeometry(1.1, 1, 1, 6).translate(0, -.5, 0).rotateY(a).toNonIndexed()));
export function willow(kit, x, z, h, R) {
  const base = new THREE.Vector3(x, 0, z), lean = new THREE.Vector3((R() - .5) * 1.6, h * .55, (R() - .5) * 1.6).add(base);
  beam(kit, 'bark', base, lean, .3); beam(kit, 'bark', base, base.clone().setY(.6), .42);
  for (let b = 0; b < 7; b++) {
    const a = b / 7 * Math.PI * 2 + R(), out = 2 + R() * 2;
    const tip = lean.clone().add(new THREE.Vector3(Math.cos(a) * out, h * (.25 + R() * .2), Math.sin(a) * out));
    beam(kit, 'bark', lean, tip, .11);
    for (let s = 0; s < 34; s++) {
      const p = lean.clone().lerp(tip, .3 + R() * .7).add(new THREE.Vector3((R() - .5) * 1.8, R() * .4, (R() - .5) * 1.8));
      const L = Math.min(p.y - .6, 1.8 + R() * 2.6);
      kit.add('willow', STRAND, M(p.x, p.y, p.z, R() * Math.PI, 1, L, 1, (R() - .5) * .12), 0);
    }
  }
}
