import * as THREE from 'three';
import {buildSky, buildMountains, HOR} from '../sky.js';
import {loadPeople} from '../people.js';
import {loadMocap, makeMoCast} from '../mocap.js';
import {direct} from '../director.js';

/* Test stage for the motion-captured duel and the director's cameras. */
export default async function mocaptest({scene, mats, grade}) {
  const moonDir = new THREE.Vector3(.5, .45, .6).normalize();
  scene.fog = new THREE.FogExp2(0, .008); scene.fog.color.setRGB(...HOR);
  const sky = buildSky(scene, moonDir); buildMountains(scene);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(400, 400).rotateX(-Math.PI / 2), mats.ground); floor.receiveShadow = true; scene.add(floor);
  const beats = [
    {d: 2.2, S: {clip: 'S_swordplay_idle', off: 1}, M: 'M_fight_idle', shot: 'wide', gap: 4},
    {d: 2.6, S: 'S_two_hand_sword_combo', M: 'M_high_block', shot: 'medium', gap: 1.4, move: .6},
    {d: 1.6, S: 'S_gs_to_block', M: 'M_four_punch_combo', shot: 'overM', gap: 1.2},
    {d: 1.8, S: {clip: 'X_jump_back_dodge', off: .3}, M: {clip: 'M_hurricane_kick', off: .2}, shot: 'low', gap: 3.2, move: -1.2},
    {d: 2.0, S: 'S_gs_power_slash', M: {clip: 'M_inward_block'}, shot: 'orbit', slow: .25, gap: 1.4, move: .8},
    {d: 1.5, S: 'X_hit_reaction', M: {clip: 'M_two_palm_push', off: 1.0}, shot: 'closeM', crash: .2},
    {d: 2.2, S: {clip: 'X_hit_flip_back', off: .2}, M: 'M_fight_idle', shot: 'overhead', gap: 4.2},
    {d: 2.0, S: 'S_gs_spin_attack_run', M: 'X_jump_back_dodge', shot: 'track', gap: 2.4, move: 1.5, whip: 1},
    {d: 2.0, S: 'S_gs_pose_idle', M: 'M_fight_idle', shot: 'closeS'},
  ];
  const mocap = await loadMocap([...new Set(beats.flatMap((b) => [b.S, b.M].map((x) => (typeof x === 'string' ? x : x.clip))))]);
  const cast = makeMoCast(scene, {people: await loadPeople(), mocap});
  const D = direct(cast, {center: new THREE.Vector3(0, 0, 0), yaw: Math.PI / 2, beats});
  cast.bake();
  return {moonDir, sky, shots: D.shots, shadowAhead: 3, update(t, lt, sh, cam) {
    cast.update(t, cam); const k = cast.kick(t); grade.uniforms.uFlash.value = k.flash * .3; cam.position.y += Math.sin(t * 73) * k.shake;
  }};
}
