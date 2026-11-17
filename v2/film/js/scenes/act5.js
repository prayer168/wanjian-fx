import * as THREE from 'three';
import {buildSky, buildMountains, HOR} from '../sky.js';
import {buildAct2} from '../act2.js';
import {pathShot, orbitShot, ease} from '../cam.js';
import {stageFight} from '../director.js';
import {makeFlutter} from '../fx.js';

/* Act V — the seven-tier bell tower in the city: low hero angle, spiral climb, the great bell at the top */
export default async function act5(ctx) {
  const {scene, mats, moonL, bloom, grade} = ctx;
  const moonDir = new THREE.Vector3(.55, .42, -.72).normalize();
  scene.fog = new THREE.FogExp2(0, .0036); scene.fog.color.setRGB(...HOR);
  const sky = buildSky(scene, moonDir);
  buildMountains(scene);
  const set = buildAct2(scene, mats);
  const T = set.tower, c = T.base, top = T.top;
  Object.assign(moonL.shadow.camera, {left: -45, right: 45, top: 45, bottom: -45}); moonL.shadow.camera.updateProjectionMatrix();
  /* drifting petals of ash/paper caught in the high wind around the tower */
  const flakes = makeFlutter(scene, {count: 500, box: [50, 40, 50], color: [.30, .26, .22], size: [.1, .07], fall: .4, drift: [2.2, .6]});

  /* 第五幕：鐘樓。平手 — 平台上旋風腿對劍陣，鐵布衫硬接；兩人一躍上塔頂，在大鐘前對峙 */
  const F6 = T.tiers[6].y + .3, ter = () => 3.5, topG = () => F6;
  const beats = [
    {d: 2.0, S: {clip: 'S_swordplay_idle', off: 1}, M: 'M_fight_idle', shot: 'wide', gap: 4},
    {d: 2.0, S: {clip: 'S_gs_to_block'}, M: {clip: 'M_flying_sidekick'}, shot: 'low', gap: 1.6, move: -1},
    {d: 2.2, S: 'S_gs_combo_slash', M: 'M_inward_block', shot: 'track', gap: 1.4, move: 1.4},
    {d: 2.4, S: {clip: 'S_spell_two_hand_sword'}, M: {clip: 'M_cast_wide', off: .4}, shot: 'overS', gap: 3, vo: [['e2', .05], ['e1', 1.0]], sk: [{kind: 'fan', at: .2, n: 48, fire: .9, span: 1.4}, {kind: 'bell', at: 1.0, d: 1.4}]},
    {d: 1.8, S: 'S_gs_jump_attack', M: 'M_high_block', shot: 'orbit', slow: .3, gap: 1.6, a0: -.5},
    {d: 1.8, S: {clip: 'X_hit_reaction'}, M: {clip: 'M_aerial_360_kick', off: .2}, shot: 'medium'},
    /* one bound each from the terrace to the top floor */
    {d: 2.6, S: {clip: 'X_jump_from_sprint', air: true, arc: 14, speed: .4}, M: {clip: 'X_jump_from_sprint', air: true, arc: 15, speed: .4}, shot: 'crane', dest: new THREE.Vector3(c.x, F6, c.z + 1.8), gfnTo: topG, gap: 1.6},
    {d: 1.6, S: {clip: 'X_landing', off: .2}, M: {clip: 'X_hard_landing', off: .3, big: true}, shot: 'low'},
    {d: 2.6, S: {clip: 'S_gs_pose_idle'}, M: 'M_fight_idle', shot: 'closeS', vo: [['e3', .2]]},
    {d: 2.2, S: {clip: 'S_gs_pose_idle', off: 1.5}, M: {clip: 'M_fight_idle', off: 1}, shot: 'closeM', vo: [['e4', .1]]},
  ];
  const Fx = await stageFight(ctx, {beats, center: new THREE.Vector3(c.x, 3.5, c.z + 9), yaw: Math.PI / 2, gfn: ter, t0: 6, film0: 6, wind: [-2, 0, .6], side: -1});
  const events = Fx.events;
  const shots = [
    Object.assign(pathShot('rise', 6, [[c.x - 26, 1.6, c.z + 40], [c.x - 21, 1.3, c.z + 34]], [[c.x, 6, c.z + 9], [c.x, 9, c.z + 6]], {fov: [40, 36]}), {focus: new THREE.Vector3(c.x, 4, c.z + 14)}),
    ...Fx.shots.map((s, i) => Object.assign(s, {focus: i < 6 ? new THREE.Vector3(c.x, 4, c.z + 12) : new THREE.Vector3(c.x, F6, c.z)})),
    Object.assign(pathShot('bell', 5, [[c.x + 7.5, T.bell.y - .4, c.z + 6.5], [c.x + 5.6, T.bell.y - .9, c.z + 5.4]], [[c.x, T.bell.y - 1.4, c.z], [c.x, T.bell.y - 1.3, c.z]], {fov: [36, 32]}), {focus: new THREE.Vector3(c.x, T.bell.y, c.z), t0: Fx.D.end}),
  ];
  let cur = null;
  return {
    moonDir, sky, shots, shadowAhead: 25, events,
    update(t, lt, sh, cam) {
      if (cur !== sh) { cur = sh; set.seat(sh.focus); }
      for (const L of set.lights) L.intensity = 22 * (1 + .08 * Math.sin(t * 9 + L.position.x));
      set.bells.update(t, 1.4, sh.name === 'bell' ? .4 : 0);
      flakes.update(t, cam); flakes.mesh.visible = sh.name !== 'rise';
      Fx.update(t, cam);
    },
  };
}
