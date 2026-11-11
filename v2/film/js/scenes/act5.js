import * as THREE from 'three';
import {buildSky, buildMountains, HOR} from '../sky.js';
import {buildAct2} from '../act2.js';
import {pathShot, orbitShot} from '../cam.js';
import {makeFlutter} from '../fx.js';

/* Act V — the seven-tier bell tower in the city: low hero angle, spiral climb, the great bell at the top */
export default function act5({scene, mats, moonL, bloom}) {
  const moonDir = new THREE.Vector3(.55, .42, -.72).normalize();
  scene.fog = new THREE.FogExp2(0, .0036); scene.fog.color.setRGB(...HOR);
  const sky = buildSky(scene, moonDir);
  buildMountains(scene);
  const set = buildAct2(scene, mats);
  const T = set.tower, c = T.base, top = T.top;
  Object.assign(moonL.shadow.camera, {left: -45, right: 45, top: 45, bottom: -45}); moonL.shadow.camera.updateProjectionMatrix();
  /* drifting petals of ash/paper caught in the high wind around the tower */
  const flakes = makeFlutter(scene, {count: 500, box: [50, 40, 50], color: [.30, .26, .22], size: [.1, .07], fall: .4, drift: [2.2, .6]});

  const shots = [
    Object.assign(pathShot('rise', 8, [[c.x - 26, 1.6, c.z + 40], [c.x - 20, 1.2, c.z + 33]], [[c.x, top * .55, c.z], [c.x, top * .62, c.z]], {fov: [40, 36]}), {focus: new THREE.Vector3(c.x, 4, c.z + 14)}),
    Object.assign(orbitShot('spiral', 13, [c.x, 0, c.z], {a: [.4, .4 + Math.PI * 1.6], r: [27, 18], y: [6, top - 2], look: [4, top - 6], fov: [42, 38]}), {focus: new THREE.Vector3(c.x, 20, c.z)}),
    Object.assign(pathShot('bell', 7, [[c.x + 7.5, T.bell.y - .4, c.z + 6.5], [c.x + 5.6, T.bell.y - .9, c.z + 5.4]], [[c.x, T.bell.y - 1.4, c.z], [c.x, T.bell.y - 1.3, c.z]], {fov: [36, 32]}), {focus: new THREE.Vector3(c.x, T.bell.y, c.z)}),
  ];
  let cur = null;
  return {
    moonDir, sky, shots, shadowAhead: 25,
    update(t, lt, sh, cam) {
      if (cur !== sh) { cur = sh; set.seat(sh.focus); }
      for (const L of set.lights) L.intensity = 22 * (1 + .08 * Math.sin(t * 9 + L.position.x));
      set.bells.update(t, 1.4, sh.name === 'bell' ? .4 : 0);
      flakes.update(t, cam); flakes.mesh.visible = sh.name !== 'rise';
    },
  };
}
