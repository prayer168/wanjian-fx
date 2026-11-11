import * as THREE from 'three';
import {buildSky, buildMountains, HOR} from '../sky.js';
import {buildAct2} from '../act2.js';
import {pathShot} from '../cam.js';
import {makeFlutter} from '../fx.js';

/* Epilogue — 明日再戰. G1 long-lens silhouette of the tower top against a giant moon (the two figures will stand there),
   G2 the camera climbs out of the city until the tower is a speck under the moon and the stars. */
export default function epilogue({scene, mats, moonL, bloom, grade}) {
  const moonDir = new THREE.Vector3(.62, .12, -.78).normalize();
  scene.fog = new THREE.FogExp2(0, .0028); scene.fog.color.setRGB(...HOR);
  const sky = buildSky(scene, moonDir);
  buildMountains(scene);
  const set = buildAct2(scene, mats);
  const T = set.tower, top = T.tiers[6], P = new THREE.Vector3(T.base.x, top.y + 2.2, T.base.z);
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
    moonDir, sky, shots, shadowAhead: 30,
    update(t, lt, sh, cam) {
      if (cur !== sh) { cur = sh; set.seat(sh.focus); }
      for (const L of set.lights) L.intensity = 22 * (1 + .08 * Math.sin(t * 9 + L.position.x));
      set.bells.update(t, .8, .2 * Math.exp(-t * .2));
      flakes.update(t, cam);
      grade.uniforms.uFade.value = 1 - THREE.MathUtils.smoothstep(t, 13.8, 15.9);  // slow fade to black
    },
  };
}
