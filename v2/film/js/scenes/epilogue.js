import * as THREE from 'three';
import {buildSky, buildMountains, HOR} from '../sky.js';
import {buildAct2} from '../act2.js';
import {pathShot} from '../cam.js';
import {makeFlutter} from '../fx.js';
import {stageFight} from '../director.js';

/* Epilogue — 明日再戰. G1 long-lens silhouette of the tower top against a giant moon (the two figures will stand there),
   G2 the camera climbs out of the city until the tower is a speck under the moon and the stars. */
export default async function epilogue(ctx) {
  const {scene, mats, moonL, bloom, grade} = ctx;
  const moonDir = new THREE.Vector3(.62, .12, -.78).normalize();
  scene.fog = new THREE.FogExp2(0, .0028); scene.fog.color.setRGB(...HOR);
  const sky = buildSky(scene, moonDir);
  buildMountains(scene);
  const set = buildAct2(scene, mats);
  const T = set.tower, top = T.tiers[6], P = new THREE.Vector3(T.base.x, top.y + 2.2, T.base.z);
  /* both on the top floor, backs to the camera, facing the moon: sword lowered, palms folded */
  const F6 = top.y + .3;
  /* 尾聲：兩人收招、互相致意，然後並肩背對鏡頭望向滿月 */
  const Fx = await stageFight(ctx, {center: new THREE.Vector3(T.base.x, F6, T.base.z + 1.6), yaw: Math.PI / 2, gfn: () => F6, gap: 1.8, beats: [
    {d: 3.0, S: 'S_sheath_sword', M: 'M_praying', vo: [['g1', .9]]},
    {d: 3.5, S: {clip: 'S_gs_pose_idle', face: 0, yaw: Math.PI}, M: {clip: 'M_praying', off: 1.5, face: 0, yaw: Math.PI}, vo: [['g2', .2]]},
    {d: 12, S: {clip: 'S_gs_pose_idle', off: 1, speed: .4, face: 0, yaw: Math.PI}, M: {clip: 'M_fight_idle', speed: .4, face: 0, yaw: Math.PI}},
  ]});
  const events = Fx.events;
  const flakes = makeFlutter(scene, {count: 400, box: [60, 30, 60], color: [.3, .24, .14], size: [.12, .08], fall: .3, drift: [1.6, .4]});

  /* camera on the line from the moon through the tower top, far back, long lens: the moon fills the frame behind the pavilion */
  const D = 230, cam0 = P.clone().addScaledVector(moonDir, -D), cam1 = P.clone().addScaledVector(moonDir, -D * .93);
  const shots = [
    Object.assign(pathShot('silhouette', 7, [cam0.toArray(), cam1.toArray()], [P.toArray(), P.clone().add(new THREE.Vector3(0, .6, 0)).toArray()], {fov: [7.5, 6.6], curve: (u) => u}), {focus: P}),
    /* G2 continues G1's line: pull straight back from the moon and open the lens, so the tower shrinks to a speck in front of it
       while the city spreads out below */
    Object.assign(pathShot('ascend', 9, [0, 1, 2, 3].map((k) => { const d = D * .93 + k / 3 * 380; return P.clone().addScaledVector(moonDir, -d).add(new THREE.Vector3(0, k / 3 * 50, 0)).toArray(); }), [P.toArray(), P.clone().add(new THREE.Vector3(0, -8, 0)).toArray()], {fov: [6.6, 34], curve: (u) => u * u * (3 - 2 * u)}), {focus: P}),
  ];
  let cur = null;
  return {
    moonDir, sky, shots, shadowAhead: 30, events,
    update(t, lt, sh, cam) {
      if (cur !== sh) { cur = sh; set.seat(sh.focus); }
      for (const L of set.lights) L.intensity = 22 * (1 + .08 * Math.sin(t * 9 + L.position.x));
      set.bells.update(t, .8, .2 * Math.exp(-t * .2));
      flakes.update(t, cam);
      Fx.update(t, cam);
      grade.uniforms.uFade.value = 1 - THREE.MathUtils.smoothstep(t, 13.8, 15.9);  // slow fade to black
    },
  };
}
