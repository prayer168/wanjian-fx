import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {buildSky, buildMountains} from '../sky.js';
import {Kit, cityWall} from '../arch.js';
import {terrain, addSway} from '../nature.js';
import {makeSparks, makeSmoke, makeGoldenBell} from '../fx.js';
import {pathShot} from '../cam.js';
import {canvasTex, grain, rng, fbm} from '../util.js';
import {stageFight} from '../director.js';

/* Act I — the wasteland after v1's duel: dusk turning to night, ten thousand spent arrows,
   the golden bell's ghost dissolving into dust, embers and smoke, the city wall far to the west. */
export default async function act1(ctx) {
  const {scene, hemi, moonL, bloom, renderer, mats, grade} = ctx;
  const HOR = [.085, .048, .065];
  const moonDir = new THREE.Vector3(.8, .16, .35).normalize(), sun = new THREE.Vector3(-.85, .02, .45).normalize();
  scene.fog = new THREE.FogExp2(0, .0030); scene.fog.color.setRGB(...HOR);
  const sky = buildSky(scene, moonDir, {hor: HOR, dusk: 1, sun});
  buildMountains(scene, {haze: HOR, tint: [1.6, 1.0, 1.0], scale: .8});
  hemi.color.set(0x8a6a8a); hemi.groundColor.set(0x1a1010); hemi.intensity = .55;
  const keyDir = sun.clone().setY(.12).normalize();
  moonL.color.set(0xffa070); moonL.intensity = 1.6;
  Object.assign(moonL.shadow.camera, {left: -40, right: 40, top: 40, bottom: -40}); moonL.shadow.camera.updateProjectionMatrix();
  renderer.toneMappingExposure = 1.1; bloom.strength = .8;
  grade.uniforms.uTint.value.set(1.02, .96, 1.0); grade.uniforms.uLift.value.set(.016, .008, .02);

  const hfn = (x, z) => { const r = Math.hypot(x, z); return 2.6 * (fbm(x / 60 + 2, z / 60 + 5, 4) - .5) + .9 * (fbm(x / 11, z / 11, 3) - .5) + 30 * Math.pow(fbm(x / 140, z / 140 + 4, 3), 2) * THREE.MathUtils.smoothstep(r, 120, 500); };

  /* cracked, scorched earth */
  const earth = canvasTex(1024, 1024, (g, w, h) => {
    g.fillStyle = '#6e5842'; g.fillRect(0, 0, w, h); const R = rng(9);
    for (let i = 0; i < 90; i++) { const x = R() * w, y = R() * h, r = 30 + R() * 160, gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, `rgba(${R() < .5 ? '40,28,20' : '140,118,92'},.35)`); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(x - r, y - r, 2 * r, 2 * r); }
    g.strokeStyle = 'rgba(30,20,14,.9)';
    for (let i = 0; i < 520; i++) { let x = R() * w, y = R() * h, a = R() * 6.28; g.lineWidth = .8 + R() * 2.4; g.beginPath(); g.moveTo(x, y); for (let k = 0, n = 4 + R() * 10; k < n; k++) { a += (R() - .5) * 1.4; x += Math.cos(a) * 12; y += Math.sin(a) * 12; g.lineTo(x, y); } g.stroke(); }
    for (let i = 0; i < 2500; i++) { g.fillStyle = `rgba(${R() < .5 ? '160,140,110' : '50,40,30'},.5)`; g.fillRect(R() * w, R() * h, 2 + R() * 3, 2 + R() * 3); }
    grain(g, w, h, .07, 7, 41);
  });
  scene.add(terrain(2400, 360, hfn, new THREE.MeshStandardMaterial({map: earth, roughness: .95, color: 0xb0a090}), .14));

  const R = rng(1111), uni = {uT: {value: 0}, uWind: {value: 1}};

  /* dry grass: crossed alpha cards, swaying; thinner near the scorched centre */
  const grassTex = canvasTex(256, 256, (g, w, h) => {
    const Rg = rng(6);
    for (let i = 0; i < 70; i++) { const x0 = w / 2 + (Rg() - .5) * 60, lean = (Rg() - .5) * 160, hh = h * (.45 + Rg() * .55); g.strokeStyle = `hsl(${30 + Rg() * 16},${30 + Rg() * 25}%,${30 + Rg() * 30}%)`; g.lineWidth = 1.5 + Rg() * 2; g.beginPath(); g.moveTo(x0, h); g.quadraticCurveTo(x0 + lean * .2, h - hh * .6, x0 + lean, h - hh); g.stroke(); }
  }, {repeat: false});
  const tuft = mergeGeometries([0, 1, 2].map((k) => new THREE.PlaneGeometry(1, 1).translate(0, .5, 0).rotateY(k * Math.PI / 3).toNonIndexed()));
  { const n = tuft.attributes.normal; for (let i = 0; i < n.count; i++) n.setXYZ(i, 0, 1, 0); }
  const gMat = new THREE.MeshStandardMaterial({map: grassTex, alphaTest: .4, alphaToCoverage: true, side: THREE.DoubleSide, roughness: .9, envMapIntensity: .2});
  const NG = 16000, grass = new THREE.InstancedMesh(tuft, gMat, NG), gRoot = new Float32Array(NG * 4);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), s = new THREE.Vector3(), p = new THREE.Vector3(), col = new THREE.Color();
  for (let i = 0, k = 0; i < NG; k++) {
    const r = 3 + Math.pow(R(), .8) * 180, a = R() * 6.28, x = Math.cos(a) * r, z = Math.sin(a) * r;
    if (r < 14 && R() < .8) continue;
    const H = (.35 + R() * .7) * (fbm(x / 9, z / 9, 2) + .4);
    p.set(x, hfn(x, z) - .03, z); e.set(0, R() * 6.28, 0); q.setFromEuler(e); s.set(H * 1.2, H, H * 1.2); m.compose(p, q, s);
    grass.setMatrixAt(i, m); col.setHSL(.08 + R() * .04, .3 + R() * .2, .45 + R() * .3); grass.setColorAt(i, col); gRoot.set([x, p.y, z, Math.max(H, .3)], i * 4); i++;
  }
  tuft.setAttribute('aRoot', new THREE.InstancedBufferAttribute(gRoot, 4));
  grass.customDepthMaterial = addSway(gMat, uni, {mode: 'inst', amp: .12, freq: 2.2, foliage: true});
  grass.receiveShadow = true; grass.castShadow = true; grass.frustumCulled = false; scene.add(grass);

  /* rocks */
  const rockGeo = new THREE.IcosahedronGeometry(1, 2); { const pp = rockGeo.attributes.position; for (let i = 0; i < pp.count; i++) { const v = new THREE.Vector3().fromBufferAttribute(pp, i); v.multiplyScalar(.75 + .5 * fbm(v.x * 2 + 5, v.y * 2 + v.z * 1.3, 3)); pp.setXYZ(i, v.x, v.y * .7, v.z); } rockGeo.computeVertexNormals(); }
  const rocks = new THREE.InstancedMesh(rockGeo, new THREE.MeshStandardMaterial({map: mats.tex.marble, color: 0x6a5e54, roughness: .9}), 420);
  const camKeep = [[28, 10], [21, 7], [10, -6], [7.4, -8.6], [34, 22], [32, 24]];
  for (let i = 0; i < 420; i++) { const r = 6 + R() * 160, a = R() * 6.28, x = Math.cos(a) * r, z = Math.sin(a) * r, near = camKeep.some(([cx, cz]) => Math.hypot(x - cx, z - cz) < 9), sc = near ? 0 : .15 + Math.pow(R(), 4) * 1.6; e.set(R(), R() * 6, R()); q.setFromEuler(e); m.compose(p.set(x, hfn(x, z), z), q, s.set(sc, sc, sc)); rocks.setMatrixAt(i, m); }
  rocks.castShadow = rocks.receiveShadow = true; scene.add(rocks);

  const G = (x, z) => hfn(x, z);
  const M0 = new THREE.Vector3(0, G(0, 0), 0), S0 = new THREE.Vector3(3.6, G(3.6, 1.5), 1.5);
  const west = new THREE.Vector3(-1, 0, -.12).normalize(), side = new THREE.Vector3(-west.z, 0, west.x);
  const at = (p, d, k = 0) => { const q = p.clone().addScaledVector(west, d).addScaledVector(side, k); q.y = G(q.x, q.z); return q; };
  const camStomp = M0.clone().addScaledVector(side, -4.2).addScaledVector(west, 2.6), camSword = S0.clone().add(M0.clone().sub(S0).setY(0).normalize().multiplyScalar(3.4)).addScaledVector(new THREE.Vector3(-(M0.z - S0.z), 0, M0.x - S0.x).normalize(), 3.0);
  const FC = new THREE.Vector3(1.8, 0, .75);
  const clear = [[camStomp, 3.2], [camSword, 2.2], [FC, 7.5], [FC.clone().add(new THREE.Vector3(-8, 0, -3)), 6]];
  /* spent arrows: shaft, iron head, three fletchings, vertex coloured; stuck, broken or lying */
  const part = (geo, c) => { geo = geo.toNonIndexed(); const n = geo.attributes.position.count, cc = new Float32Array(n * 3); for (let i = 0; i < n; i++) cc.set(c, i * 3); geo.setAttribute('color', new THREE.BufferAttribute(cc, 3)); return geo; };
  const vane = () => { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute([0, .58, 0, .018, .6, 0, .02, .7, 0, 0, .58, 0, .02, .7, 0, 0, .73, 0], 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(12), 2)); g.computeVertexNormals(); return g; };
  const fl = [0, 1, 2].map((k) => part(vane().rotateY(k * 2.094), k ? [.42, .38, .34] : [.62, .55, .46]));
  const arrowGeo = mergeGeometries([part(new THREE.CylinderGeometry(.0055, .0055, .76, 5).translate(0, .38, 0), [.40, .27, .15]), part(new THREE.ConeGeometry(.014, .07, 4).rotateX(Math.PI).translate(0, -.03, 0), [.11, .11, .12]), part(new THREE.CylinderGeometry(.007, .007, .02, 5).translate(0, .755, 0), [.2, .12, .08]), ...fl]);
  const aMat = new THREE.MeshStandardMaterial({vertexColors: true, roughness: .75, side: THREE.DoubleSide});
  const NA = 5200, arrows = new THREE.InstancedMesh(arrowGeo, aMat, NA), embers = [];
  for (let i = 0; i < NA; i++) {
    const lying = R() < .16, ring = R() < .55;
    const r = ring ? 3.6 + Math.abs(R() + R() + R() - 1.5) * 9 : 3.6 + Math.pow(R(), 1.6) * 70, a = R() * 6.28, x = Math.cos(a) * r, z = Math.sin(a) * r;
    const len = R() < .22 ? .35 + R() * .4 : 1, y = hfn(x, z);
    if (clear.some(([c, rr]) => Math.hypot(x - c.x, z - c.z) < rr)) { m.makeScale(0, 0, 0); arrows.setMatrixAt(i, m); continue; }
    if (lying) { e.set(Math.PI / 2 + (R() - .5) * .2, R() * 6.28, 0, 'YXZ'); q.setFromEuler(e); p.set(x, y + .012, z); }
    else { e.set(-.35 - R() * .45 + (R() - .5) * .2, Math.atan2(-x, -z) + (R() - .5) * .9, (R() - .5) * .3, 'YXZ'); q.setFromEuler(e); p.set(x, y - .12 * R(), z); }
    m.compose(p, q, s.set(1, len, 1)); arrows.setMatrixAt(i, m);
    if (!lying && R() < .035) embers.push({x, y: y + .3, z, r: .25});
  }
  arrows.castShadow = arrows.receiveShadow = true; scene.add(arrows);

  /* the golden bell's ghost, fading out */
  const {mesh: ghost, uni: ghostU} = makeGoldenBell(scene);
  ghost.position.set(0, hfn(0, 0) - .1, 0);
  const dust = makeSparks(scene, [{x: 0, y: .2, z: 0, r: 2.6}], {count: 1600, rise: 4.5, spread: 1.4, size: 9, life: .12, hot: [1, .8, .35], cool: [.8, .45, .1], wind: [.6, .2], twinkle: 1, seed: 7});
  const sparks = makeSparks(scene, embers, {count: 700, rise: 2.2, spread: .3, size: 7, life: .5, wind: [.8, .3]});
  const smoke = makeSmoke(scene, embers.filter((_, i) => i % 3 === 0).slice(0, 18).map((s) => ({...s, k: .6})), {per: 5, color: [.16, .13, .13], opacity: .22, rise: 5, period: 10});

  /* the city on the western horizon: wall, gate tower, lanterns */
  const kit = new Kit(mats); cityWall(kit, -380, -260, 260, 0, rng(3), []); kit.build(scene);
  for (const z of [-150, -60, 0, 60, 150]) { const L = new THREE.PointLight(0xff8a40, 300, 70, 2); L.position.set(-372, 9, z); scene.add(L); }

  /* the duel's aftermath: the monk stands in the dissolving bell, the swordsman sheathes, flips away and bounds for the city;
     the monk sinks into a horse stance, stamps the earth (金剛踏) and launches after him */
  /* 第一幕：荒原。和尚佔上風 — 劍雨被金鐘罩擋下，大力金剛掌把劍客震飛，劍客後空翻脫身，和尚金剛踏追出 */
  const yaw = Math.atan2(M0.x - S0.x, M0.z - S0.z);
  const beats = [
    {d: 2.6, S: {clip: 'S_swordplay_idle', off: 2}, M: 'M_praying', shot: 'closeS', gap: 3.6, vo: ['a1']},
    {d: 3.0, S: {clip: 'S_gs_pose_idle'}, M: 'M_fight_idle', shot: 'closeM', vo: ['a2']},
    {d: 1.4, S: 'S_spell_two_hand_sword', M: 'M_fight_idle', shot: 'low', vo: [['a3', .05]], sk: [{kind: 'rain', at: .5, n: 360, r: 6}]},
    {d: 2.4, S: {clip: 'S_swordplay_idle', off: 1}, M: 'M_high_block', shot: 'overhead', sk: [{kind: 'bell', at: .2, d: 2.2}]},
    {d: 2.6, S: 'S_two_hand_sword_combo', M: {clip: 'M_inward_block'}, shot: 'medium', gap: 1.4, move: .6, sk: [{kind: 'crescent', at: .7}, {kind: 'crescent', at: 1.35, up: [0, 1, 0]}]},
    {d: 2.0, S: 'S_gs_power_slash', M: 'M_low_block', shot: 'orbit', slow: .3, sk: [{kind: 'crescent', at: .8, size: 3.2}]},
    {d: 1.8, S: {clip: 'S_gs_hilt_melee'}, M: {clip: 'M_four_punch_combo', off: .3}, shot: 'overS', shake: .03},
    {d: 2.0, S: 'X_hit_reaction', M: {clip: 'M_two_palm_push', off: .9}, shot: 'overM', crash: .55, vo: [['a4', .1]], sk: [{kind: 'palm', at: .75, size: 1.7, dist: 2.2}]},
    {d: 2.4, S: {clip: 'X_hit_flip_back', off: .15}, M: {clip: 'M_two_palm_push', off: 2.2}, shot: 'wide', gap: 5, move: -.8, vo: [['a5', .9]]},
    {d: 1.6, S: {clip: 'X_landing', off: .3}, M: {clip: 'X_hard_landing', off: .3, big: true}, shot: 'low', gap: 4.6},
    {d: 2.2, S: {clip: 'X_twist_flip_run'}, M: {clip: 'M_long_yell', off: .6}, shot: 'track', gap: 9, move: -3, whip: 1},
  ];
  const F = await stageFight(ctx, {beats, center: FC.clone().setY(G(FC.x, FC.z)), yaw, gfn: G, t0: 11, film0: 11, wind: [-1.2, 0, .3]});
  const cast = F.cast, events = F.events;

  const shots = [
    pathShot('field', 6, [[28, hfn(28, 10) + 2.3, 10], [23, hfn(23, 8) + 2.1, 8]], [[0, 1.5, 0], [0, 1.6, 0]], {fov: [26, 22]}),
    pathShot('arrows', 5, [[10, hfn(10, -6) + .75, -6], [8.4, hfn(8.4, -7.6) + .8, -7.6]], [[1.8, .9, .75], [1.8, 1.1, .75]], {fov: [30, 28], curve: (u) => u}),
    ...F.shots,
    Object.assign(pathShot('city', 6, [[34, hfn(34, 22) + 3, 22], [32, hfn(32, 24) + 15, 25]], [[-380, 4, -6], [-380, 2, -4]], {fov: [30, 26]}), {t0: F.D.end}),
  ];
  const TOTAL = shots.reduce((a, b) => a + b.dur, 0);
  return {
    moonDir: keyDir, sky, shots, shadowAhead: 20, events,
    update(t, lt, sh, cam) {
      const u = Math.min(1, t / TOTAL);
      sky.uni.uDusk.value = 1 - .55 * u; moonL.intensity = 1.6 - .7 * u;
      uni.uT.value = t; ghostU.uT.value = t; ghostU.uFade.value = Math.max(0, .9 - t / 12);
      dust.update(t); dust.uni.uGain.value = .5 + ghostU.uFade.value; sparks.update(t); smoke.update(t);
      F.update(t, cam);
    },
  };
}
