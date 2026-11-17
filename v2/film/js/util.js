import * as THREE from 'three';

export function rng(a) {
  return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
export const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
export const lerp = (a, b, t) => a + (b - a) * t;
export const smooth = (t) => t * t * (3 - 2 * t);

/* value noise for canvas textures */
const NR = rng(9137), NP = new Float32Array(512 * 512).map(() => NR());
export function vnoise(x, y) {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi, h = (i, j) => NP[((j & 511) * 512 + (i & 511))];
  const u = smooth(xf), v = smooth(yf);
  return lerp(lerp(h(xi, yi), h(xi + 1, yi), u), lerp(h(xi, yi + 1), h(xi + 1, yi + 1), u), v);
}
export function fbm(x, y, o = 4) { let s = 0, a = .5, f = 1; for (let i = 0; i < o; i++) { s += a * vnoise(x * f, y * f); f *= 2; a *= .5; } return s; }

export function canvasTex(w, h, draw, {repeat = true, srgb = true} = {}) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 8;
  return t;
}
/* per-pixel noise overlay so flat colours read as real material */
export function grain(g, w, h, amt, scale = 6, seed = 0) {
  const im = g.getImageData(0, 0, w, h), d = im.data;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const n = (fbm(x / scale + seed, y / scale + seed * 1.7, 4) - .5) * 2 * amt + (Math.random() - .5) * amt * .5, i = (y * w + x) * 4;
    d[i] += n * 255; d[i + 1] += n * 255; d[i + 2] += n * 255;
  }
  g.putImageData(im, 0, 0);
}

/* world-space UVs: lets every merged box share a tiling texture without stretching */
export function worldUV(geo, s = .5) {
  const p = geo.attributes.position, n = geo.attributes.normal, uv = geo.attributes.uv;
  for (let i = 0; i < p.count; i++) {
    const nx = Math.abs(n.getX(i)), ny = Math.abs(n.getY(i)), nz = Math.abs(n.getZ(i));
    if (ny >= nx && ny >= nz) uv.setXY(i, p.getX(i) * s, p.getZ(i) * s);
    else if (nx >= nz) uv.setXY(i, p.getZ(i) * s, p.getY(i) * s);
    else uv.setXY(i, p.getX(i) * s, p.getY(i) * s);
  }
  uv.needsUpdate = true;
  return geo;
}

export const M = (x = 0, y = 0, z = 0, ry = 0, sx = 1, sy = 1, sz = 1, rx = 0, rz = 0) =>
  new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz, 'YXZ')), new THREE.Vector3(sx, sy, sz));

/* ================= material library ================= */
export function makeMaterials() {
  const T = {};
  T.tile = canvasTex(512, 512, (g, w, h) => {
    g.fillStyle = '#2a2f3c'; g.fillRect(0, 0, w, h);
    const cols = 16, cw = w / cols;
    for (let c = 0; c < cols; c++) {
      const x = c * cw, convex = c % 2 === 0;
      const gr = g.createLinearGradient(x, 0, x + cw, 0);
      if (convex) { gr.addColorStop(0, '#1a1e28'); gr.addColorStop(.35, '#4a5162'); gr.addColorStop(.55, '#59606f'); gr.addColorStop(1, '#1a1e28'); }
      else { gr.addColorStop(0, '#20242f'); gr.addColorStop(.5, '#2f3442'); gr.addColorStop(1, '#20242f'); }
      g.fillStyle = gr; g.fillRect(x, 0, cw, h);
      for (let r = 0; r < h; r += 32) { g.fillStyle = 'rgba(0,0,0,.35)'; g.fillRect(x, r + (convex ? 0 : 16), cw, 3); g.fillStyle = 'rgba(255,255,255,.05)'; g.fillRect(x, r + (convex ? 3 : 19), cw, 2); }
    }
    grain(g, w, h, .06, 20, 1);
  });
  T.plaster = canvasTex(256, 256, (g, w, h) => { g.fillStyle = '#d9d0bd'; g.fillRect(0, 0, w, h); grain(g, w, h, .07, 30, 2); });
  T.lacquer = canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = '#7a2418'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 80; i++) { g.strokeStyle = `rgba(${i % 2 ? '40,8,4' : '150,60,40'},.18)`; g.lineWidth = 1 + (i % 3); const x = (i * 37) % w; g.beginPath(); g.moveTo(x, 0); g.lineTo(x + 4, h); g.stroke(); }
    grain(g, w, h, .05, 8, 3);
  });
  T.wood = canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = '#4b3221'; g.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y++) { const n = fbm(1, y / 6, 3); g.fillStyle = `rgba(${n > .5 ? '120,84,52' : '30,18,10'},${Math.abs(n - .5) * .5})`; g.fillRect(0, y, w, 1); }
    grain(g, w, h, .05, 40, 4);
  });
  T.stone = canvasTex(512, 512, (g, w, h) => {
    g.fillStyle = '#5d5f66'; g.fillRect(0, 0, w, h);
    const r = rng(5);
    for (let y = 0; y < h; y += 64) for (let x = -((y / 64) % 2) * 48; x < w; x += 96) {
      const l = 30 + r() * 14; g.fillStyle = `hsl(230,6%,${l}%)`; g.fillRect(x + 2, y + 2, 92, 60);
    }
    grain(g, w, h, .08, 10, 5);
  });
  T.paving = canvasTex(512, 512, (g, w, h) => {
    g.fillStyle = '#2b2a2e'; g.fillRect(0, 0, w, h);
    const r = rng(11);
    for (let y = 0; y < h; y += 42) for (let x = -(r() * 40); x < w; x += 50 + r() * 40) {
      const l = 24 + r() * 12; g.fillStyle = `hsl(240,5%,${l}%)`; g.fillRect(x + 2, y + 2, 46 + r() * 30, 38);
    }
    grain(g, w, h, .09, 6, 6);
  });
  T.paint = canvasTex(256, 64, (g, w, h) => {
    g.fillStyle = '#1f5a5c'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#c99a3c'; g.fillRect(0, 0, w, 4); g.fillRect(0, h - 4, w, 4);
    for (let x = 0; x < w; x += 64) { g.fillStyle = '#2d7f7a'; g.beginPath(); g.ellipse(x + 32, h / 2, 26, 16, 0, 0, Math.PI * 2); g.fill(); g.strokeStyle = '#d8b25a'; g.lineWidth = 2; g.stroke(); g.fillStyle = '#7a2a22'; g.beginPath(); g.arc(x + 32, h / 2, 7, 0, Math.PI * 2); g.fill(); }
  });
  const lattice = (lit) => canvasTex(128, 128, (g, w, h) => {
    if (lit) { const gr = g.createRadialGradient(64, 64, 10, 64, 64, 90); gr.addColorStop(0, '#ffd28a'); gr.addColorStop(1, '#e0702c'); g.fillStyle = gr; } else g.fillStyle = '#14121a';
    g.fillRect(0, 0, w, h);
    g.strokeStyle = lit ? '#3a1c0c' : '#3b2a20'; g.lineWidth = 5; g.strokeRect(2, 2, w - 4, h - 4);
    g.lineWidth = 3; for (let i = 16; i < w; i += 16) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i, h); g.moveTo(0, i); g.lineTo(w, i); g.stroke(); }
    g.lineWidth = 4; g.beginPath(); g.moveTo(w / 2, 0); g.lineTo(w / 2, h); g.moveTo(0, h / 2); g.lineTo(w, h / 2); g.stroke();
  }, {repeat: false});
  T.winLit = lattice(true); T.winDark = lattice(false);
  T.cloth = canvasTex(128, 128, (g, w, h) => { g.fillStyle = '#ffffff'; g.fillRect(0, 0, w, h); for (let x = 0; x < w; x += 16) { g.fillStyle = 'rgba(0,0,0,.12)'; g.fillRect(x, 0, 8, h); } grain(g, w, h, .05, 4, 7); });
  T.brick = canvasTex(512, 512, (g, w, h) => {  // city-wall grey brick, running bond, mortar and weathering streaks
    g.fillStyle = '#3c3d42'; g.fillRect(0, 0, w, h);
    const r = rng(17);
    for (let y = 0, row = 0; y < h; y += 21, row++) for (let x = -(row % 2) * 24; x < w; x += 48) { const l = 30 + r() * 12; g.fillStyle = `hsl(225,5%,${l}%)`; g.fillRect(x + 1.5, y + 1.5, 45, 18); }
    for (let i = 0; i < 40; i++) { const x = r() * w; const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, 'rgba(0,0,0,.25)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(x, 0, 3 + r() * 10, h * (.3 + r() * .7)); }
    grain(g, w, h, .08, 8, 8);
  });
  T.patina = canvasTex(256, 256, (g, w, h) => {  // bronze with verdigris in the recesses
    const im = g.createImageData(w, h), d = im.data;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const n = fbm(x / 22, y / 22, 5), v = Math.max(0, n - .52) * 3, i = (y * w + x) * 4;
      d[i] = 150 * (1 - v) + 70 * v; d[i + 1] = 105 * (1 - v) + 130 * v; d[i + 2] = 60 * (1 - v) + 105 * v; d[i + 3] = 255;
    }
    g.putImageData(im, 0, 0);
  });
  T.matting = canvasTex(128, 128, (g, w, h) => { g.fillStyle = '#2a2016'; g.fillRect(0, 0, w, h); for (let y = 0; y < h; y += 8) for (let x = 0; x < w; x += 8) { g.fillStyle = (x + y) % 16 ? 'rgba(90,70,40,.5)' : 'rgba(10,6,2,.5)'; g.fillRect(x, y, 8, 4); } grain(g, w, h, .06, 3, 9); });
  T.marble = canvasTex(256, 256, (g, w, h) => { g.fillStyle = '#b9b6ad'; g.fillRect(0, 0, w, h); grain(g, w, h, .06, 24, 10); });

  const S = (o) => new THREE.MeshStandardMaterial(Object.assign({roughness: .85, metalness: 0}, o));
  return {
    tex: T,
    tile: S({map: T.tile, roughness: .72, metalness: 0, color: 0x7d8496}),
    under: S({map: T.wood, color: 0x6a4a36, roughness: .9}),
    fascia: S({map: T.lacquer, roughness: .6}),
    ridge: S({color: 0x2a2e38, roughness: .5, metalness: .2}),
    plaster: S({map: T.plaster, roughness: .95}),
    lacquer: S({map: T.lacquer, roughness: .45}),
    wood: S({map: T.wood, roughness: .8}),
    stone: S({map: T.stone, roughness: .9}),
    paving: S({map: T.paving, roughness: .6, metalness: .05}),
    paint: S({map: T.paint, roughness: .6}),
    gold: S({color: 0xc99a3c, roughness: .35, metalness: .8}),
    winLit: S({map: T.winLit, emissive: 0xffffff, emissiveMap: T.winLit, emissiveIntensity: 1.6, roughness: .9}),
    winDark: S({map: T.winDark, roughness: .9}),
    lantern: S({color: 0xd2301c, emissive: 0xff5a22, emissiveIntensity: 3.2, roughness: .7}),
    lanternW: S({color: 0xf0e2c0, emissive: 0xffc070, emissiveIntensity: 2.6, roughness: .7}),
    cord: S({color: 0x111111, roughness: 1}),
    bark: S({color: 0x3a2a20, roughness: 1}),
    leaf: S({color: 0x24402e, roughness: .9, flatShading: true}),
    leaf2: S({color: 0x31503a, roughness: .9, flatShading: true}),
    clothR: S({map: T.cloth, color: 0x9a2a22, side: THREE.DoubleSide}),
    clothB: S({map: T.cloth, color: 0x2a4a7a, side: THREE.DoubleSide}),
    clothY: S({map: T.cloth, color: 0xb8925a, side: THREE.DoubleSide}),
    ground: S({map: T.paving, color: 0x9a9aa4, roughness: .7}),
    brick: S({map: T.brick, roughness: .92}),
    bronze: S({map: T.patina, color: 0xb08860, metalness: .8, roughness: .42}),
    matting: S({map: T.matting, roughness: 1, side: THREE.DoubleSide}),
    marble: S({map: T.marble, roughness: .7}),
    hull: S({map: T.wood, color: 0x8a6a50, roughness: .75, side: THREE.DoubleSide}),
  };
}
