import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {buildSky, buildMountains, HOR} from '../sky.js';
import {buildAct2} from '../act2.js';
import {terrain} from '../nature.js';
import {makeMist} from '../fx.js';
import {pathShot} from '../cam.js';
import {canvasTex, grain, rng, fbm} from '../util.js';

/* Prologue — P1 the moon and the Milky Way over a pine ridge, P2 dive over the ridge to the city's sea of lights,
   P3 a slow push along the rooftops toward the moon over the ridge. */
export default function prologue({scene, mats}) {
  const moonDir = new THREE.Vector3(.86, .25, -.42).normalize();
  scene.fog = new THREE.FogExp2(0, .0032); scene.fog.color.setRGB(...HOR);
  const sky = buildSky(scene, moonDir);
  buildMountains(scene);
  const set = buildAct2(scene, mats);

  /* pine ridge east of the city */
  const ridge = (x, z) => THREE.MathUtils.smoothstep(x, 285, 400) * (1 - THREE.MathUtils.smoothstep(x, 470, 545)) * THREE.MathUtils.smoothstep(500 - Math.abs(z), 0, 200) * (40 + 75 * Math.pow(fbm(x / 120 + 3, z / 120 + 8, 5), 1.4) + 8 * fbm(x / 20, z / 20, 3));
  const soil = canvasTex(256, 256, (g, w, h) => { g.fillStyle = '#2a2a22'; g.fillRect(0, 0, w, h); const R = rng(2); for (let i = 0; i < 900; i++) { g.fillStyle = `hsla(${70 + R() * 50},${15 + R() * 20}%,${12 + R() * 14}%,.8)`; g.fillRect(R() * w, R() * h, 2 + R() * 6, 2 + R() * 6); } grain(g, w, h, .06, 6, 3); });
  const hill = terrain(1800, 420, ridge, new THREE.MeshStandardMaterial({map: soil, roughness: .95}), .12, 1100, 0);
  hill.castShadow = true; scene.add(hill);

  /* pine: trunk + six jagged cone tiers, vertex coloured, flat shaded */
  const R = rng(808), tint = (geo, c, jit) => {
    geo = geo.toNonIndexed(); const p = geo.attributes.position, cc = new Float32Array(p.count * 3);
    for (let i = 0; i < p.count; i++) { const k = 1 + (R() - .5) * jit; cc.set([c[0] * k, c[1] * k, c[2] * k], i * 3); if (jit && p.getY(i) < 0) { p.setX(i, p.getX(i) * (1 + (R() - .5) * .5)); p.setZ(i, p.getZ(i) * (1 + (R() - .5) * .5)); } }
    geo.setAttribute('color', new THREE.BufferAttribute(cc, 3)); return geo;
  };
  const tiers = [tint(new THREE.CylinderGeometry(.018, .03, .55, 6).translate(0, .27, 0), [.22, .14, .09], 0)];
  for (let k = 0; k < 11; k++) { const y = .16 + k * .075, r = .27 - k * .022; tiers.push(tint(new THREE.ConeGeometry(r, .18, 11, 2).translate(0, y + .09, 0).rotateY(k * 1.3), [.06 + k * .004, .12 + k * .006, .08], .7)); }
  const pineGeo = mergeGeometries(tiers);
  const NP = 9000, pines = new THREE.InstancedMesh(pineGeo, new THREE.MeshStandardMaterial({vertexColors: true, flatShading: true, roughness: .9}), NP);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), s = new THREE.Vector3(), p = new THREE.Vector3();
  for (let i = 0, n = 0; i < NP && n < NP * 6; n++) {
    const x = 300 + R() * 250, z = -480 + R() * 960, h = ridge(x, z);
    if (h < 6 || R() > .25 + .7 * fbm(x / 30, z / 30, 3)) continue;
    const H = 10 + R() * 12; e.set((R() - .5) * .1, R() * 6.3, (R() - .5) * .1); q.setFromEuler(e);
    m.compose(p.set(x, h - .5, z), q, s.set(H * (.8 + R() * .4), H, H * (.8 + R() * .4))); pines.setMatrixAt(i++, m); pines.count = i;
  }
  pines.castShadow = pines.receiveShadow = true; scene.add(pines);
  const mist = makeMist(scene, Array.from({length: 30}, (_, i) => { const x = 300 + R() * 200, z = -200 + R() * 300; return {p: new THREE.Vector3(x, ridge(x, z) * .55 + 8, z), s: 70 + R() * 60, flat: .25}; }), {color: [.36, .36, .5], opacity: .05});


  const rh = (x, z, o) => ridge(x, z) + o;
  const shots = [
    Object.assign(pathShot('moon', 6, [[440, rh(440, 70, 30), 70], [428, rh(428, 64, 31), 64]], [[440 + 86, rh(440, 70, 30) + 38, 70 - 42], [428 + 86, rh(428, 64, 31) + 34, 64 - 42]], {fov: [42, 38]}), {focus: new THREE.Vector3(0, 6, 0)}),
    Object.assign(pathShot('dive', 9, [[520, rh(520, 30, 90), 30], [440, rh(440, 18, 55), 18], [330, 70, 8], [190, 44, 2]], [[300, 30, -10], [150, 15, -20], [40, 8, -30], [-40, 6, -30]], {fov: [40, 33]}), {focus: new THREE.Vector3(60, 6, 0)}),
    Object.assign(pathShot('roofmoon', 8, [[-24, 16, 7], [-20, 16.5, 6]], [[80, 26, -42], [80, 27, -42]], {fov: [34, 32], curve: (u) => u}), {focus: new THREE.Vector3(-10, 6, 3)}),
  ];
  let cur = null;
  return {
    moonDir, sky, shots, shadowAhead: 60,
    update(t, lt, sh) {
      if (cur !== sh) { cur = sh; set.seat(sh.focus); }
      for (const L of set.lights) L.intensity = 22 * (1 + .08 * Math.sin(t * 9 + L.position.x));
      set.bells.update(t, .6); mist.update(t);
    },
  };
}
