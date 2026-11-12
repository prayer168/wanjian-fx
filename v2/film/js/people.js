import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {rng, fbm} from './util.js';

/* The two leads as realistic skinned humans (built by chars/build_char.py from MakeHuman CC0 assets).
   The toon rig in cast.js stays as an invisible puppeteer: every frame its joint rotations are carried over onto the
   MakeHuman game-engine skeleton (world-space deltas from each rig's rest pose, arms re-aimed from A-pose to hanging). */

/* ---------- surface detail: tileable normal maps drawn once ---------- */
function normalTex(size, height, strength = 2) {
  const h = new Float32Array(size * size);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) h[y * size + x] = height(x, y);
  const d = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const H = (i, j) => h[((j + size) % size) * size + (i + size) % size];
    const dx = (H(x + 1, y) - H(x - 1, y)) * strength, dy = (H(x, y + 1) - H(x, y - 1)) * strength, l = Math.hypot(dx, dy, 1), i = (y * size + x) * 4;
    d[i] = (-dx / l * .5 + .5) * 255; d[i + 1] = (-dy / l * .5 + .5) * 255; d[i + 2] = (1 / l * .5 + .5) * 255; d[i + 3] = 255;
  }
  const t = new THREE.DataTexture(d, size, size); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.generateMipmaps = true; t.minFilter = THREE.LinearMipmapLinearFilter; t.needsUpdate = true;
  return t;
}
const R = rng(5150);
/* plain weave: over-under threads with slub noise */
const WEAVE = normalTex(256, (x, y) => {
  const u = x / 256 * 64, v = y / 256 * 64, wx = Math.sin(u * Math.PI * 2), wy = Math.sin(v * Math.PI * 2);
  const over = (Math.floor(u) + Math.floor(v)) % 2 ? 1 : -1;
  return .5 * (Math.abs(wx) * (over > 0 ? 1 : .6) + Math.abs(wy) * (over > 0 ? .6 : 1)) + .25 * fbm(x / 9, y / 31, 2);
}, 3);
/* skin: pores and fine creases */
const PORES = normalTex(512, (x, y) => { let s = 0; for (let k = 0; k < 2; k++) s += fbm(x / (2 + k * 3) + k * 7, y / (2 + k * 3), 2) * (k ? .5 : 1); return s; }, 1.2);

function fabric(color, {rough = .85, sheen = .6, sheenColor = color, rep = 6, nScale = .14} = {}) {
  return new THREE.MeshPhysicalMaterial({color, roughness: rough, metalness: 0, sheen, sheenRoughness: .6, sheenColor: new THREE.Color(sheenColor),
    normalMap: WEAVE, normalScale: new THREE.Vector2(nScale, nScale), side: THREE.DoubleSide});
}
function withRepeat(m, r) { m.normalMap = m.normalMap.clone(); m.normalMap.repeat.set(r, r); m.normalMap.needsUpdate = true; return m; }

const LOOK = {
  S: {
    robe: () => withRepeat(fabric(0xe9e6dc, {sheen: .8, sheenColor: 0xffffff, rough: .7}), 9),
    sleeve: () => withRepeat(fabric(0xe9e6dc, {sheen: .8, sheenColor: 0xffffff, rough: .7}), 9),
    skirt: () => withRepeat(fabric(0xe4e1d6, {sheen: .8, sheenColor: 0xffffff, rough: .72}), 9),
    pants: () => withRepeat(fabric(0x23283a, {sheen: .4, rough: .9}), 7),
    boots: () => new THREE.MeshPhysicalMaterial({color: 0x15151a, roughness: .45, clearcoat: .3, clearcoatRoughness: .5}),
    belt: () => withRepeat(fabric(0x2b4f8f, {sheen: .9, sheenColor: 0x88aaff, rough: .55}), 3),
    bracer: () => new THREE.MeshPhysicalMaterial({color: 0x241c18, roughness: .55, clearcoat: .2, clearcoatRoughness: .6, normalMap: PORES, normalScale: new THREE.Vector2(.3, .3)}),
    hair: 0x0d0b0a,
  },
  M: {
    kasaya: () => withRepeat(fabric(0xb5521c, {sheen: .5, sheenColor: 0xffa060, rough: .9}), 5),
    kasaya_in: () => withRepeat(fabric(0x8f3a16, {sheen: .4, sheenColor: 0xff9050, rough: .9}), 5),
    skirt: () => withRepeat(fabric(0xc9862e, {sheen: .5, sheenColor: 0xffd080, rough: .9}), 5),
    pants: () => withRepeat(fabric(0x4a3a2c, {sheen: .3, rough: .95}), 7),
    wraps: () => withRepeat(fabric(0xcfc4ad, {sheen: .3, rough: .95, nScale: .9}), 10),
    belt: () => withRepeat(fabric(0xd9a441, {sheen: .7, sheenColor: 0xffe0a0, rough: .6}), 3),
    beads: () => new THREE.MeshPhysicalMaterial({color: 0x3a1e10, roughness: .35, clearcoat: .8, clearcoatRoughness: .25}),
    hair: 0x0d0b0a,
  },
};

function dress(root, key) {
  const look = LOOK[key];
  root.traverse((o) => {
    if (!o.isMesh) return;
    o.castShadow = true; o.receiveShadow = true; o.frustumCulled = false;
    const m = o.material, n = m.name.replace(/^(swordsman|monk)\./, '');
    if (n === 'body') {
      o.material = new THREE.MeshPhysicalMaterial({map: m.map, roughness: .52, metalness: 0, normalMap: PORES, normalScale: new THREE.Vector2(.18, .18),
        sheen: .25, sheenRoughness: .5, sheenColor: new THREE.Color(0xff9a7a), specularIntensity: .55, clearcoat: .08, clearcoatRoughness: .45});
      o.material.normalMap = PORES.clone(); o.material.normalMap.repeat.set(14, 14); o.material.normalMap.needsUpdate = true;
    } else if (n.startsWith('high-poly')) {          // eyes: wet cornea
      o.material = new THREE.MeshPhysicalMaterial({map: m.map, color: 0xffffff, roughness: .1, clearcoat: 1, clearcoatRoughness: .03, envMapIntensity: .5});
      /* the cornea shell samples the blue swatch in the texture corner: drop it, keep the wet eyeball under it; pull the red-brown iris toward dark brown */
      o.material.onBeforeCompile = (sh) => { sh.fragmentShader = sh.fragmentShader.replace('#include <map_fragment>', `#include <map_fragment>
        if (diffuseColor.b > diffuseColor.r + .12 * diffuseColor.r + .05) discard;
        float irisK = smoothstep(.1, .25, diffuseColor.r - diffuseColor.g);
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(diffuseColor.r * .42, diffuseColor.r * .3, diffuseColor.r * .22), irisK);`); };
    } else if (n.startsWith('teeth')) {
      o.material = new THREE.MeshStandardMaterial({map: m.map, roughness: .3});
    } else if (n.startsWith('eyelash') || n.startsWith('mind_eye') || n.startsWith('mindfront_eye')) {
      o.material = new THREE.MeshStandardMaterial({map: m.map || null, color: 0x14100e, roughness: .8, alphaTest: .35, transparent: false, alphaToCoverage: true, side: THREE.DoubleSide});
      o.castShadow = false;
    } else if (n.startsWith('ponytail') || n.includes('hair')) {
      o.material = new THREE.MeshPhysicalMaterial({map: m.map, color: look.hair, roughness: .62, sheen: .5, sheenRoughness: .5, sheenColor: new THREE.Color(0x3a3028), specularIntensity: .4,
        alphaTest: .4, alphaToCoverage: true, transparent: false, side: THREE.DoubleSide});
    } else if (look[n]) {
      o.material = look[n](); o.material.name = n;
    }
  });
}

/* ---------- the sword: real steel ---------- */
function makeSword() {
  const g = new THREE.Group(), steel = new THREE.MeshPhysicalMaterial({color: 0xdfe6ee, metalness: 1, roughness: .18, clearcoat: .4, clearcoatRoughness: .1, envMapIntensity: 1.6});
  const bronze = new THREE.MeshPhysicalMaterial({color: 0xa8833f, metalness: 1, roughness: .35});
  const wrap = new THREE.MeshPhysicalMaterial({color: 0x1d1a22, roughness: .8, sheen: .5, sheenColor: new THREE.Color(0x4a4a66), normalMap: WEAVE, normalScale: new THREE.Vector2(1.2, 1.2)});
  /* blade: diamond section with a ridge, tapering to a point (劍 is double-edged and straight) */
  const sh = new THREE.Shape(); sh.moveTo(-.017, 0); sh.lineTo(0, .0045); sh.lineTo(.017, 0); sh.lineTo(0, -.0045); sh.closePath();
  const bl = new THREE.ExtrudeGeometry(sh, {depth: .8, bevelEnabled: false, steps: 24});
  const p = bl.attributes.position; for (let i = 0; i < p.count; i++) { const z = p.getZ(i) / .8, k = z > .92 ? (1 - z) / .08 : 1 - z * .18; p.setX(i, p.getX(i) * k); p.setY(i, p.getY(i) * Math.max(.4, k)); }
  bl.computeVertexNormals(); const blade = new THREE.Mesh(bl, steel); blade.position.z = .1; g.add(blade);
  const guard = new THREE.Mesh(new THREE.BoxGeometry(.11, .022, .028), bronze); guard.position.z = .095; g.add(guard);
  const grip = new THREE.Mesh(new THREE.CylinderGeometry(.015, .016, .18, 12).rotateX(Math.PI / 2), wrap); grip.position.z = 0; g.add(grip);
  const pommel = new THREE.Mesh(new THREE.SphereGeometry(.022, 12, 8), bronze); pommel.position.z = -.1; g.add(pommel);
  const tassel = new THREE.Mesh(new THREE.CylinderGeometry(.004, .012, .16, 6), new THREE.MeshStandardMaterial({color: 0x2b4f8f, roughness: .9})); tassel.position.set(0, -.08, -.12); g.add(tassel);
  g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  return g;
}

/* ---------- retargeting ---------- */
const MAP = [  // MakeHuman bone, rig joint, aim (re-aim the bone onto the rig segment: arms come out of A-pose)
  ['pelvis', 'hips'], ['spine_01', 'spine'], ['spine_02', 'spine', 'chest'], ['spine_03', 'chest'], ['neck_01', 'neck'], ['head', 'head'],
  ['upperarm_l', 'shL', null, 'elL'], ['lowerarm_l', 'elL', null, 'wrL'], ['hand_l', 'wrL', null, 'down'],
  ['upperarm_r', 'shR', null, 'elR'], ['lowerarm_r', 'elR', null, 'wrR'], ['hand_r', 'wrR', null, 'down'],
  ['thigh_l', 'hipL'], ['calf_l', 'knL'], ['foot_l', 'anL'], ['thigh_r', 'hipR'], ['calf_r', 'knR'], ['foot_r', 'anR'],
];
const FINGERS = ['index', 'middle', 'ring', 'pinky'];

export async function loadPeople() {
  const L = new GLTFLoader();
  const out = {};
  for (const [key, file] of [['S', 'swordsman'], ['M', 'monk']]) {
    const gl = await L.loadAsync(`../assets/characters/${file}.glb`);
    const root = gl.scene; root.updateMatrixWorld(true);
    const bones = {}; root.traverse((o) => { if (o.isBone) bones[o.name] = o; });
    const W = (n) => bones[n].getWorldPosition(new THREE.Vector3());
    dress(root, key);
    /* rig dimensions measured off this skeleton so the puppeteer's feet land where these feet are */
    const hipC = W('thigh_l').add(W('thigh_r')).multiplyScalar(.5);
    const dim = {hipY: hipC.y, thigh: W('thigh_l').distanceTo(W('calf_l')), shin: W('calf_l').distanceTo(W('foot_l')), hipX: Math.abs(W('thigh_l').x - hipC.x),
      spine: W('spine_03').y - W('spine_01').y, chest: W('neck_01').y - W('spine_03').y, neck: W('head').y - W('neck_01').y,
      shX: Math.abs(W('upperarm_l').x - hipC.x), ua: W('upperarm_l').distanceTo(W('lowerarm_l')), fa: W('lowerarm_l').distanceTo(W('hand_l')), foot: W('foot_l').y,
      shY: W('upperarm_l').y - W('spine_03').y};
    out[key] = {root, bones, dim, hipC, sword: key === 'S' ? makeSword() : null};
  }
  return out;
}

const qa = new THREE.Quaternion(), qb = new THREE.Quaternion(), va = new THREE.Vector3(), vb = new THREE.Vector3();
/* call once with the rig in its rest pose (all angles zero, at the origin, facing +Z) */
export function calibrate(P, ch, scene) {
  scene.add(P.root); if (P.sword) scene.add(P.sword);
  P.root.updateMatrixWorld(true); ch.g.updateMatrixWorld(true);
  P.map = MAP.map(([bn, jn, jn2, aim]) => {
    const b = P.bones[bn], J = ch.J[jn], J2 = jn2 && ch.J[jn2];
    const qm0 = b.getWorldQuaternion(new THREE.Quaternion()), qd0 = J.getWorldQuaternion(new THREE.Quaternion());
    let align = new THREE.Quaternion();
    if (aim) {
      const child = b.children.find((c) => c.isBone && (bn.startsWith('hand') ? c.name.startsWith('middle_01') : true));
      const dM = child.getWorldPosition(va).sub(b.getWorldPosition(vb)).normalize();
      const dD = aim === 'down' ? new THREE.Vector3(0, -1, 0) : ch.J[aim].getWorldPosition(new THREE.Vector3()).sub(J.getWorldPosition(new THREE.Vector3())).normalize();
      align.setFromUnitVectors(dM, dD);
    }
    return {b, J, J2, rest: align.multiply(qm0), inv0: qd0.invert(), inv02: J2 ? J2.getWorldQuaternion(new THREE.Quaternion()).invert() : null};
  });
  P.pelvis0 = P.bones.pelvis.getWorldPosition(new THREE.Vector3()).sub(P.hipC);
  P.fingers = [];
  for (const s of ['l', 'r']) for (const f of FINGERS.concat(['thumb'])) for (const k of [1, 2, 3]) { const b = P.bones[`${f}_0${k}_${s}`]; if (b) P.fingers.push({b, s, thumb: f === 'thumb', k, q0: b.quaternion.clone()}); }
}

/* copy the rig's current pose onto the skinned human */
export function retarget(P, ch, fist) {
  const qp = new THREE.Quaternion();
  for (const m of P.map) {
    const q = m.J.getWorldQuaternion(qa).multiply(m.inv0);
    if (m.J2) q.slerp(m.J2.getWorldQuaternion(qb).multiply(m.inv02), .5);
    q.multiply(m.rest);
    if (m.b.name === 'pelvis') {
      const h = ch.J.hips.getWorldPosition(va), off = vb.copy(P.pelvis0).applyQuaternion(ch.J.hips.getWorldQuaternion(qb).multiply(P.map[0].inv0));
      m.b.parent.updateWorldMatrix(true, false);
      m.b.position.copy(m.b.parent.worldToLocal(h.add(off)));
    }
    m.b.parent.getWorldQuaternion(qp);
    m.b.quaternion.copy(qp.invert().multiply(q));
    m.b.updateMatrixWorld(true);
  }
  /* fingers curl into a grip/fist: rotate each phalanx about its own bend axis */
  for (const f of P.fingers) {
    const amt = fist[f.s === 'l' ? 0 : 1];
    f.b.quaternion.copy(f.q0);
    if (amt > .01) f.b.quaternion.multiply(qa.setFromAxisAngle(f.thumb ? new THREE.Vector3(0, 0, 1) : new THREE.Vector3(1, 0, 0), (f.thumb ? .35 : [1.0, 1.4, .9][f.k - 1]) * amt * (f.s === 'l' ? 1 : 1)));
  }
  P.root.updateMatrixWorld(true);
  if (P.sword) {
    /* the blade keeps the rig sword's orientation, seated in this hand's palm */
    const hand = P.bones.hand_r, mid = P.bones.middle_01_r;
    ch.sword.getWorldQuaternion(P.sword.quaternion);
    hand.getWorldPosition(va).lerp(mid.getWorldPosition(vb), .75);
    P.sword.position.copy(va).addScaledVector(vb.set(0, 0, 1).applyQuaternion(P.sword.quaternion), .0);
  }
}
