import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {rng, canvasTex, grain, fbm} from './util.js';

/* Wind sway injected into a standard material (and its shadow depth material).
   'inst': instanced plants with attribute aRoot = (base x, base y, base z, height) — bend grows with height².
   'uv'  : hanging strands, uv.y = 1 at the hook.   'wave': whole surface rolls (far canopy).
   foliage: keep the authored normals on both faces of double-sided cards (no dark back faces). */
export function addSway(mat, uni, {mode = 'inst', amp = .02, freq = 1.1, foliage = false} = {}) {
  const body = {
    inst: `float k=clamp((wp.y-aRoot.y)/aRoot.w,0.,1.3);k*=k;vec2 ph=aRoot.xz;float A=${amp.toFixed(4)}*aRoot.w;`,
    uv: `float k=pow(1.-uv.y,1.5);vec2 ph=wp.xz;float A=${amp.toFixed(4)};`,
    wave: `float k=1.;vec2 ph=wp.xz;float A=${amp.toFixed(4)};wp.y+=sin(uT*.7+wp.x*.045+wp.z*.03)*A*uWind*1.4;`,
  }[mode];
  const patch = (sh) => {
    sh.uniforms.uT = uni.uT; sh.uniforms.uWind = uni.uWind;
    sh.vertexShader = (mode === 'inst' ? 'attribute vec4 aRoot;\n' : '') + 'uniform float uT,uWind;\n' + sh.vertexShader.replace('#include <project_vertex>', `
      vec4 mvPosition=vec4(transformed,1.);
      #ifdef USE_INSTANCING
        mvPosition=instanceMatrix*mvPosition;
      #endif
      vec4 wp=modelMatrix*mvPosition;
      ${body}
      float g=sin(uT*.55+ph.x*.035+ph.y*.02);
      float s=sin(uT*${freq.toFixed(3)}+ph.x*.31+ph.y*.17)*.55+sin(uT*${(freq * 2.3).toFixed(3)}+ph.x*.7)*.2+g*.9+.4;
      wp.x+=s*k*A*uWind;wp.z+=(sin(uT*${(freq * .8).toFixed(3)}+ph.y*.4)*.5+g*.3)*k*A*uWind;
      mvPosition=viewMatrix*wp;
      gl_Position=projectionMatrix*mvPosition;`);
    if (foliage && sh.fragmentShader.includes('#include <normal_fragment_begin>')) sh.fragmentShader = sh.fragmentShader.replace('#include <normal_fragment_begin>', '#include <normal_fragment_begin>\nnormal=normalize(vNormal);');
  };
  const key = `sway-${mode}-${amp}-${freq}-${foliage}`;
  mat.onBeforeCompile = patch; mat.customProgramCacheKey = () => key;
  const dm = new THREE.MeshDepthMaterial({depthPacking: THREE.RGBADepthPacking, map: mat.map, alphaTest: mat.alphaTest || 0, side: mat.side});
  dm.onBeforeCompile = patch; dm.customProgramCacheKey = () => key;
  return dm;
}

/* heightfield ground with world-scaled uvs */
export function terrain(size, seg, hfn, mat, uvs = .25, cx = 0, cz = 0) {
  const g = new THREE.PlaneGeometry(size, size, seg, seg); g.rotateX(-Math.PI / 2); g.translate(cx, 0, cz);
  const p = g.attributes.position, uv = g.attributes.uv;
  for (let i = 0; i < p.count; i++) { const x = p.getX(i), z = p.getZ(i); p.setY(i, hfn(x, z)); uv.setXY(i, x * uvs, z * uvs); }
  g.computeVertexNormals();
  const m = new THREE.Mesh(g, mat); m.receiveShadow = true; return m;
}

/* ---------- bamboo ---------- */
function culmTex() {
  return canvasTex(64, 256, (g, w, h) => {
    const gr = g.createLinearGradient(0, 0, w, 0); gr.addColorStop(0, '#4e6a2c'); gr.addColorStop(.45, '#94ad58'); gr.addColorStop(.6, '#a7bb68'); gr.addColorStop(1, '#4a6329');
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 30; i++) { g.fillStyle = `rgba(${i % 2 ? '20,30,10' : '190,200,130'},.12)`; g.fillRect((i * 13) % w, 0, 1, h); }
    const n = h - 10; g.fillStyle = 'rgba(25,30,12,.85)'; g.fillRect(0, n, w, 3);       // node line
    g.fillStyle = 'rgba(225,230,205,.45)'; g.fillRect(0, n + 3, w, 7);                   // waxy white ring under the node
    g.fillStyle = 'rgba(30,40,15,.4)'; g.fillRect(0, n - 6, w, 6);
    grain(g, w, h, .05, 6, 21);
  });
}

/* a painted bamboo spray (twig, sub-branches, ~60 slender drooping leaves) with alpha, used on crossed cards */
function sprayTex(seed) {
  return canvasTex(512, 256, (g, w, h) => {
    const R = rng(seed), tw = (t) => [6 + t * w * .9, 40 + 70 * t * t];
    g.strokeStyle = '#4b5226'; g.lineWidth = 3.5; g.beginPath(); g.moveTo(...tw(0)); for (let t = .05; t <= 1.001; t += .05) g.lineTo(...tw(t)); g.stroke();
    const leaf = (x, y, a, L, W) => {
      g.save(); g.translate(x, y); g.rotate(a);
      const l = 26 + R() * 22, hue = 88 + R() * 26, gr = g.createLinearGradient(0, 0, L, 0);
      gr.addColorStop(0, `hsl(${hue},40%,${l * .7}%)`); gr.addColorStop(.4, `hsl(${hue},45%,${l}%)`); gr.addColorStop(1, `hsl(${hue + 6},38%,${l * .85}%)`);
      g.fillStyle = gr; g.beginPath(); g.moveTo(0, 0); g.quadraticCurveTo(L * .28, -W, L, R() * 3 - 1.5); g.quadraticCurveTo(L * .3, W, 0, 0); g.fill();
      g.strokeStyle = `hsla(${hue},30%,${l + 18}%,.6)`; g.lineWidth = 1; g.beginPath(); g.moveTo(2, 0); g.lineTo(L * .9, 0); g.stroke();
      g.restore();
    };
    for (let b = 0; b < 10; b++) {
      const t = .12 + b / 9 * .86, [x, y] = tw(t), dy = (b % 2 ? 1 : -.4) * (18 + R() * 26), ex = x + 24 + R() * 34, ey = y + dy;
      g.strokeStyle = '#52592b'; g.lineWidth = 1.8; g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + 12, y + dy * .3, ex, ey); g.stroke();
      const n = 5 + Math.floor(R() * 3);
      for (let j = 0; j < n; j++) {
        const a = .35 + (j / (n - 1) - .3) * 1.5 + (R() - .5) * .3;  // fan, mostly hanging down-forward
        leaf(ex + (R() - .5) * 6, ey + (R() - .5) * 6, a, 62 + R() * 46, 7 + R() * 4);
      }
    }
    for (let k = 0; k < 4; k++) { const [x, y] = tw(.98); leaf(x, y, .1 + k * .35, 60 + R() * 30, 7 + R() * 3); }
  }, {repeat: false});
}

/* one culm: tapered 9-sided tube 0..1 tall, node rings, uv.y counts internodes so the node texture repeats */
function culmGeo(nodes = 14) {
  const c = new THREE.CylinderGeometry(.62, 1, 1, 9, nodes * 2, false).translate(0, .5, 0);
  const uv = c.attributes.uv, p = c.attributes.position;
  for (let i = 0; i < uv.count; i++) uv.setY(i, p.getY(i) * nodes);
  const rings = [];
  for (let k = 1; k < nodes; k++) { const y = k / nodes, r = 1 - .38 * y; const t = new THREE.CylinderGeometry(r * 1.1, r * 1.1, .006, 9, 1, true).translate(0, y, 0); const u = t.attributes.uv; for (let i = 0; i < u.count; i++) u.setY(i, k - .03); rings.push(t); }
  return mergeGeometries([c.toNonIndexed(), ...rings.map((r) => r.toNonIndexed())]);
}

/* crossed drooping card 2.2 m long: origin = twig base (texture pixel (6,40)); normals point out-and-up so it shades like a soft mass */
function cardGeo() {
  const L = 2.2, Hh = 1.1, v0 = 1 - 40 / 256, parts = [];
  for (const rot of [0, Math.PI / 2]) {
    const g = new THREE.PlaneGeometry(L, Hh, 6, 2).translate(L / 2 - L * 6 / 512, Hh * (.5 - v0), 0);
    const p = g.attributes.position, n = g.attributes.normal;
    for (let i = 0; i < p.count; i++) { const x = p.getX(i) / L; p.setY(i, p.getY(i) - .25 * x * x); const nn = new THREE.Vector3(x * .7, 1, 0).normalize(); n.setXYZ(i, nn.x, nn.y, nn.z); }
    g.rotateX(rot); parts.push(g.toNonIndexed());
  }
  const g = mergeGeometries(parts); const n = g.attributes.normal;
  for (let i = 0; i < n.count; i++) { const v = new THREE.Vector3(n.getX(i), Math.abs(n.getY(i)) + Math.abs(n.getZ(i)), 0).normalize(); n.setXYZ(i, v.x, v.y, v.z); }
  return g;
}

/* Bamboo forest instanced over a disc. hfn: ground height. keep(x,z): false to leave a clearing/path.
   Culms + spray cards share aRoot so the whole plant bends together. */
export function bambooForest(scene, {hfn, radius = 115, spacing = 2.1, keep = () => true, seed = 31, uni, cards = 11}) {
  const R = rng(seed), pts = [];
  for (let x = -radius; x < radius; x += spacing) for (let z = -radius; z < radius; z += spacing) {
    const px = x + (R() - .5) * spacing * .9, pz = z + (R() - .5) * spacing * .9;
    if (Math.hypot(px, pz) > radius || !keep(px, pz)) continue;
    if (R() > .3 + .6 * fbm(px / 14 + 7, pz / 14 + 3, 3)) continue;
    pts.push([px, pz]);
    if (R() < .35) pts.push([px + (R() - .5) * .7, pz + (R() - .5) * .7]);  // clumps of two
  }
  const N = pts.length, SPR = cards;
  const cMat = new THREE.MeshStandardMaterial({map: culmTex(), roughness: .5, metalness: 0, envMapIntensity: .4});
  const sprays = [sprayTex(101), sprayTex(202)];
  const lMats = sprays.map((t) => new THREE.MeshStandardMaterial({map: t, alphaTest: .45, alphaToCoverage: true, side: THREE.DoubleSide, roughness: .85, envMapIntensity: .15}));
  const cg = culmGeo(), cards2 = [cardGeo(), cardGeo()];
  const culms = new THREE.InstancedMesh(cg, cMat, N), half = Math.ceil(N * SPR / 2);
  const leafM = lMats.map((m, i) => new THREE.InstancedMesh(cards2[i], m, half));
  const rootC = new Float32Array(N * 4), rootL = [new Float32Array(half * 4), new Float32Array(half * 4)], cnt = [0, 0];
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), s = new THREE.Vector3(), p = new THREE.Vector3(), col = new THREE.Color();
  const tops = [];
  for (let i = 0; i < N; i++) {
    const [x, z] = pts[i], y = hfn(x, z) - .2, H = 10 + R() * 8 + 3 * fbm(x / 30, z / 30, 2), r = .05 + R() * .045;
    e.set((R() - .5) * .07, R() * 6.28, (R() - .5) * .07); q.setFromEuler(e); s.set(r, H, r); p.set(x, y, z);
    m.compose(p, q, s); culms.setMatrixAt(i, m);
    col.setHSL(.2 + R() * .05, .2 + R() * .2, .55 + R() * .25); culms.setColorAt(i, col);
    rootC.set([x, y, z, H], i * 4);
    tops.push(new THREE.Vector3(0, 1, 0).applyMatrix4(m));
    const cm = m.clone();
    for (let k = 0; k < SPR; k++) {
      const top = k === SPR - 1, f = top ? .97 : .42 + (k / (SPR - 1)) * .54 + (R() - .5) * .04;
      const a = new THREE.Vector3(0, f, 0).applyMatrix4(cm);
      const sc = (top ? 1 : .7 + R() * .6) * (1.15 - f * .35);
      e.set((R() - .5) * .25, R() * 6.28, (R() - .3) * .35 + (top ? .9 : 0)); q.setFromEuler(e);
      m.compose(a, q, s.set(sc, sc, sc));
      const b = (i + k) & 1, j = cnt[b]++;
      if (j >= half) continue;
      leafM[b].setMatrixAt(j, m);
      col.setHSL(.25 + R() * .05, .45 + R() * .2, .45 + R() * .2); leafM[b].setColorAt(j, col);
      rootL[b].set([x, y, z, H], j * 4);
    }
  }
  cg.setAttribute('aRoot', new THREE.InstancedBufferAttribute(rootC, 4));
  culms.customDepthMaterial = addSway(cMat, uni, {mode: 'inst', amp: .022, freq: 1.0});
  leafM.forEach((lm, b) => { lm.count = Math.min(cnt[b], half); cards2[b].setAttribute('aRoot', new THREE.InstancedBufferAttribute(rootL[b], 4)); lm.customDepthMaterial = addSway(lMats[b], uni, {mode: 'inst', amp: .022, freq: 1.0, foliage: true}); });
  for (const mesh of [culms, ...leafM]) { mesh.castShadow = true; mesh.receiveShadow = true; mesh.frustumCulled = false; scene.add(mesh); }
  return {culms, leaves: leafM, count: N, tops};
}
