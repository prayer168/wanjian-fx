import * as THREE from 'three';
import {buildSky, buildMountains} from '../sky.js';
import {terrain, bambooForest, addSway} from '../nature.js';
import {makeFlutter, makeMist} from '../fx.js';
import {pathShot, orbitShot} from '../cam.js';
import {canvasTex, grain, rng, fbm} from '../util.js';
import {stageFight} from '../director.js';

/* Act III — moonlit bamboo sea on rolling hills */
export default async function act3(ctx) {
  const {scene, hemi, moonL, bloom, renderer, grade} = ctx;
  const HOR = [.030, .042, .060];
  const moonDir = new THREE.Vector3(.62, .27, -.70).normalize();
  scene.fog = new THREE.FogExp2(0, .0040); scene.fog.color.setRGB(...HOR);
  const sky = buildSky(scene, moonDir, {hor: HOR});
  buildMountains(scene, {haze: HOR, tint: [.8, 1.15, .9]});
  hemi.color.set(0x48688c); hemi.groundColor.set(0x0c140c); hemi.intensity = .65;
  moonL.color.set(0xc4d6ff); moonL.intensity = 1.9;
  Object.assign(moonL.shadow.camera, {left: -55, right: 55, top: 55, bottom: -55}); moonL.shadow.camera.updateProjectionMatrix();
  renderer.toneMappingExposure = 1.05;

  const hfn = (x, z) => 20 * (fbm(x / 170 + 5, z / 170 + 2, 4) - .45) + 4 * (fbm(x / 38 + 1, z / 38 + 9, 3) - .5) + 60 * Math.pow(fbm(x / 110 + 3, z / 110 + 6, 4), 2) * THREE.MathUtils.smoothstep(Math.hypot(x, z), 140, 420);
  /* forest floor: dark soil under a litter of fallen bamboo leaves */
  const litter = canvasTex(512, 512, (g, w, h) => {
    g.fillStyle = '#211a12'; g.fillRect(0, 0, w, h);
    const R = rng(5);
    for (let i = 0; i < 2600; i++) {
      const x = R() * w, y = R() * h, a = R() * Math.PI, L = 14 + R() * 18, l = 18 + R() * 30;
      g.save(); g.translate(x, y); g.rotate(a); g.fillStyle = `hsl(${35 + R() * 20},${30 + R() * 25}%,${l}%)`;
      g.beginPath(); g.ellipse(0, 0, L, 2.2 + R() * 1.5, 0, 0, Math.PI * 2); g.fill(); g.restore();
    }
    grain(g, w, h, .06, 5, 31);
  });
  const ground = terrain(1400, 220, hfn, new THREE.MeshStandardMaterial({map: litter, color: 0x8a8a80, roughness: .95}), .3);
  scene.add(ground);

  const uni = {uT: {value: 0}, uWind: {value: 1}};
  const F = new THREE.Vector3(-4, 0, .25 * Math.sin(-4 * .08)); F.y = hfn(F.x, F.z);   // the glade where they fight
  const path = (x, z) => !(Math.abs(z - .25 * Math.sin(x * .08)) < 1.6 && x > -60 && x < 40) && Math.hypot(x - 8, z - 2) > 5 && Math.hypot(x - F.x, z - F.z) > 11;
  const forest = bambooForest(scene, {hfn, radius: 118, spacing: 2.0, keep: path, uni});

  /* the far bamboo sea: a rolling canopy shell that rises out of the ground beyond the instanced forest */
  const canopyTex = canvasTex(512, 512, (g, w, h) => {
    g.fillStyle = '#22331a'; g.fillRect(0, 0, w, h); const R = rng(8);
    for (let i = 0; i < 1800; i++) { const x = R() * w, y = R() * h, r = 4 + R() * 16; const gr = g.createRadialGradient(x, y - r * .3, 0, x, y, r); gr.addColorStop(0, `hsla(${80 + R() * 25},${30 + R() * 20}%,${26 + R() * 16}%,.9)`); gr.addColorStop(1, 'rgba(10,18,8,0)'); g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill(); }
  });
  const cMat = new THREE.MeshStandardMaterial({map: canopyTex, roughness: .9, color: 0xc8d4b8});
  addSway(cMat, uni, {mode: 'wave', amp: .9, freq: .6});
  const shell = terrain(1500, 520, (x, z) => { const d = Math.hypot(x, z); return hfn(x, z) - 6 + (12 + 7 * fbm(x / 7, z / 7, 4)) * THREE.MathUtils.smoothstep(d, 96, 122); }, cMat, .06);
  shell.receiveShadow = false; scene.add(shell);

  const leaves = makeFlutter(scene, {count: 1600, box: [44, 24, 44], color: [.07, .10, .045], fall: .7, drift: [.9, .25]});
  const R = rng(14), mistItems = [];
  for (let i = 0; i < 46; i++) { const x = -90 + R() * 160, z = -50 + R() * 100; mistItems.push({p: new THREE.Vector3(x, hfn(x, z) + 1.5 + R() * 4, z), s: 18 + R() * 30}); }
  const mist = makeMist(scene, mistItems, {color: [.42, .5, .6], opacity: .14});
  bloom.strength = .6;

  /* camera: C1 high glide over the sea toward the moon; C2 ground dolly along the path; low look up into the canopy */
  const gy = (x, z, o) => hfn(x, z) + o;
  /* 第三幕：竹海。和尚勝 — 迴風三疊對旋風腿，萬葉化刃被一指禪逐一點碎，獅子吼把劍客震落 */
  const gf = (x, z) => hfn(x, z);
  const beats = [
    {d: 2.0, S: {clip: 'S_swordplay_idle', off: 2}, M: 'M_fight_idle', shot: 'wide', gap: 4},
    {d: 2.6, S: 'S_two_hand_sword_combo', M: 'M_inward_block', shot: 'track', gap: 1.4, move: 1.2, sk: [{kind: 'crescent', at: .72}, {kind: 'crescent', at: 1.33, up: [0, 1, 0]}, {kind: 'crescent', at: 1.63, size: 3.4}]},
    {d: 1.9, S: {clip: 'X_jump_back_dodge', off: .3}, M: {clip: 'M_hurricane_kick', off: .1}, shot: 'low', gap: 2.6, move: -1.6},
    {d: 2.0, S: 'S_gs_spin_kick', M: {clip: 'M_spinning_back_kick'}, shot: 'orbit', slow: .35, gap: 1.6, a0: .4},
    {d: 2.4, S: {clip: 'S_spell_two_hand_sword'}, M: {clip: 'M_fight_idle'}, shot: 'closeS', gap: 3.2, vo: [['c1', .1]], sk: [{kind: 'fan', at: .3, n: 48, fire: 1.2, span: 1.4}]},
    {d: 2.4, S: {clip: 'S_gs_pose_idle'}, M: {clip: 'M_cast_two_hands', off: .3}, shot: 'overM', vo: [['c2', .05]], sk: [.35, .6, .85, 1.1, 1.35, 1.6, 1.85].map((at) => ({kind: 'beam', at}))},
    {d: 2.2, S: 'S_gs_power_slash', M: {clip: 'M_high_block'}, shot: 'medium', gap: 1.5, move: .6, sk: [{kind: 'crescent', at: .8, size: 3}]},
    {d: 1.8, S: 'X_hit_reaction', M: {clip: 'M_elbow_uppercut', off: .5}, shot: 'dutch', shake: .02},
    {d: 3.4, S: {clip: 'S_gs_to_block'}, M: {clip: 'M_roar', off: .6}, shot: 'low', gap: 2.4, roar: true, vo: [['c3', .1]], sk: [{kind: 'ring', at: .9, size: 2.5, dur: 1.2, dist: 3}, {kind: 'ring', at: 1.3, size: 3, dur: 1.2, dist: 4}, {kind: 'ring', at: 1.7, size: 3.5, dur: 1.2, dist: 5}]},
    {d: 2.4, S: {clip: 'X_hit_flip_back', off: .1}, M: {clip: 'M_roar', off: 3.4}, shot: 'wide', gap: 5.5, move: -1, vo: [['c4', 1.6]]},
    {d: 2.0, S: {clip: 'X_kip_up', off: .3}, M: 'M_fight_idle', shot: 'closeS', gap: 5},
  ];
  const Fx = await stageFight(ctx, {beats, center: new THREE.Vector3(F.x, gf(F.x, F.z), F.z), yaw: Math.PI / 2, gfn: gf, t0: 13, film0: 13, wind: [-1, 0, .4]});
  const roarAt = Fx.D.beats.find((B) => B.b.roar).t + 1.0;
  const shots = [
    pathShot('aerial', 7, [[-96, gy(-96, 44, 40), 44], [-75, gy(-75, 33, 35), 33]], [[-96 + 620, 88, 44 - 700], [-75 + 620, 85, 33 - 700]], {fov: [40, 38]}),
    pathShot('grove', 6, [[-36, gy(-36, 0, 1.7), .3], [-24, gy(-24, 0, 1.9), -.2]], [[F.x, gy(F.x, 0, 1.2), F.z], [F.x, gy(F.x, 0, 1.3), F.z]], {fov: [32, 28], shake: .02}),
    ...Fx.shots,
    Object.assign(pathShot('canopy', 5, [[6, gy(6, 2, 1.4), 1.5], [9, gy(9, 2, 1.4), 2.8]], [[6 + 14, gy(6, 2, 1.4) + 17, 1.5 - 16], [9 + 15, gy(9, 2, 1.4) + 17, 2.8 - 15]], {fov: [58, 54], curve: (u) => u}), {t0: Fx.D.end}),
  ];
  const events = Fx.events;
  return {
    moonDir, sky, shots, shadowAhead: 30, events,
    update(t, lt, sh, cam) {
      uni.uT.value = t; uni.uWind.value = 1 + .35 * Math.sin(t * .3);
      leaves.update(t, cam); leaves.mesh.visible = sh.name !== 'aerial'; mist.update(t);
      Fx.update(t, cam);
      /* the roar: wind slams outward, the bamboo bows away from the monk */
      const roar = t > roarAt ? Math.exp(-(t - roarAt) * 1.2) : 0; uni.uWind.value = 1 + .35 * Math.sin(t * .3) + roar * 6;
    },
  };
}
