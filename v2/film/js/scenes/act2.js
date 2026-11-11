import * as THREE from 'three';
import {buildSky, buildMountains, HOR} from '../sky.js';
import {buildAct2} from '../act2.js';
import {pathShot} from '../cam.js';

/* Act II — gate, lantern market, rooftops */
export default function act2({scene, mats}) {
  const moonDir = new THREE.Vector3(.86, .25, -.42).normalize();
  scene.fog = new THREE.FogExp2(0, .0042); scene.fog.color.setRGB(...HOR);
  const sky = buildSky(scene, moonDir);
  buildMountains(scene);
  const set = buildAct2(scene, mats);

  const shots = [
    Object.assign(pathShot('flyover', 14, [[-150, 70, 70], [-110, 44, 38], [-75, 26, 16], [-45, 16, 5], [-15, 12, 1.2], [20, 10.5, 0]], [[-40, 10, -30], [0, 12, -36], [40, 12, -30], [80, 13, -26], [120, 13, -22], [170, 15, -24]], {fov: [38, 32]}), {focus: new THREE.Vector3(0, 6, 0)}),
    Object.assign(pathShot('gate', 8, [[-160, 1.0, 2.2], [-166, 1.4, 1.2], [-171, 2.0, .4]], [[-186, 7.5, 0], [-186, 8.5, 0], [-186, 9.5, 0]], {fov: [34, 30], shake: .03}), {focus: new THREE.Vector3(-180, 5, 0)}),
    Object.assign(pathShot('moonroofs', 7, [[4, 11.2, 6.5], [12, 11.6, 5.5]], [[4 + 86, 11.2 + 14, 6.5 - 42], [12 + 86, 11.6 + 15, 5.5 - 42]], {fov: [30, 28], curve: (u) => u}), {focus: new THREE.Vector3(8, 8, 6)}),
  ];
  let cur = null;
  return {
    moonDir, sky, shots,
    update(t, lt, sh) {
      if (cur !== sh) { cur = sh; set.seat(sh.focus); }
      for (const L of set.lights) L.intensity = 22 * (1 + .08 * Math.sin(t * 9 + L.position.x));
      set.bells.update(t, .6);
    },
  };
}
