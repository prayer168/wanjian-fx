import * as THREE from 'three';
import {buildSky, HOR} from '../sky.js';
import {makeCast} from '../cast.js';
import {loadPeople} from '../people.js';

/* Test stage for the realistic leads: stone floor under the moon, the two run through the pose library. */
export default async function people({scene, mats}) {
  const moonDir = new THREE.Vector3(.5, .45, .6).normalize();
  scene.fog = new THREE.FogExp2(0, .01); scene.fog.color.setRGB(...HOR);
  const sky = buildSky(scene, moonDir);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(60, 60).rotateX(-Math.PI / 2), mats.ground); floor.receiveShadow = true; scene.add(floor);
  const lamp = new THREE.PointLight(0xffe0c0, 8, 12, 2); lamp.position.set(-.3, 1.9, 1.4); scene.add(lamp);
  const cast = makeCast(scene, {people: await loadPeople()});
  const poses = ['idle', 'standoff', 'run', 'slash1', 'slash3', 'thrust', 'block', 'palm', 'horse', 'jump', 'flip'];
  cast.S.track(poses.map((p, i) => ({t: i * 2, pose: p, at: [-1.1, 0, 0], yaw: Math.PI / 2})));
  cast.M.track(poses.map((p, i) => ({t: i * 2, pose: p, at: [1.1, 0, 0], yaw: -Math.PI / 2})));
  cast.bake();
  const shot = (name, dur, fn) => ({name, dur, cam: fn});
  const shots = [
    shot('wide', poses.length * 2, (t, c) => { c.position.set(Math.sin(t * .2) * 1.5, 1.3, 5.2); c.lookAt(0, .95, 0); c.fov = 40; }),
    shot('faceS', 3, (t, c) => { c.position.set(-.35, 1.68, 1.1); c.lookAt(-1.1, 1.62, 0); c.fov = 22; }),
    shot('eyeS', 3, (t, c) => { c.position.set(-.45, 1.7, .25); c.lookAt(-1.1, 1.69, 0); c.fov = 18; }),
    shot('faceM', 3, (t, c) => { c.position.set(.45, 1.62, 1.2); c.lookAt(1.1, 1.58, 0); c.fov = 22; }),
    shot('handS', 3, (t, c) => { c.position.set(-.4, 1.2, 1.6); c.lookAt(-1.1, 1.1, 0); c.fov = 30; }),
  ];
  return {
    moonDir, sky, shots, shadowAhead: 2,
    update(t, lt, sh, cam) { cast.update(t, cam); },
    cast,
  };
}
