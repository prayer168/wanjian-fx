import * as THREE from 'three';
import {buildSky, buildMountains, HOR} from '../sky.js';
import {makeCast} from '../cast.js';
import {loadPeople} from '../people.js';
import {makeSwordStorm, makeSwordRain, makeSwordFan, makeStrikes, makeThousandHands} from '../skills.js';

/* Test stage for the technique effects: the two face off on a stone court while each effect fires in turn. */
export default async function skilltest({scene, mats, grade}) {
  const moonDir = new THREE.Vector3(.5, .3, -.8).normalize();
  scene.fog = new THREE.FogExp2(0, .004); scene.fog.color.setRGB(...HOR);
  const sky = buildSky(scene, moonDir); buildMountains(scene);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(2000, 2000).rotateX(-Math.PI / 2), mats.ground); floor.receiveShadow = true; scene.add(floor);
  const cast = makeCast(scene, {people: await loadPeople()});
  const S0 = new THREE.Vector3(-3, 0, 0), M0 = new THREE.Vector3(3, 0, 0);
  cast.S.track([{t: 0, pose: 'standoff', at: S0, face: 1}, {t: 6, pose: 'slash1', face: 1}, {t: 7, pose: 'slash3', face: 1}, {t: 8.2, pose: 'standoff', face: 1}]);
  cast.M.track([{t: 0, pose: 'horse', at: M0, face: 1}, {t: 10, pose: 'palm', face: 1}, {t: 11.5, pose: 'punch', face: 1}, {t: 12.5, pose: 'horse', face: 1}]);
  cast.bake();

  /* 0-5 劍雨 on the monk; 6-9 crescents; 10-13 palm, claw, beam, glyph ring; 14-19 千手 + 九霄劍陣; 20-36 萬劍歸宗 */
  const rain = makeSwordRain(scene, {n: 500, at: M0, radius: 7, t0: 1, dur: 2.5});
  const fan = makeSwordFan(scene); fan.set(14, 16, 2.5);
  const hands = makeThousandHands(scene); hands.set(14, 16.2, 1.6);
  const fwdS = M0.clone().sub(S0).normalize(), fwdM = fwdS.clone().negate();
  const strikes = makeStrikes(scene, [
    {t: 6.35, kind: 'crescent', p: S0.clone().setY(1.2).addScaledVector(fwdS, .8), dir: fwdS, up: [0, .3, 1], size: 3, dur: .5, dist: 6},
    {t: 7.45, kind: 'crescent', p: S0.clone().setY(1.5).addScaledVector(fwdS, .8), dir: fwdS, up: [0, 1, .2], size: 3.5, dur: .5, dist: 6},
    {t: 10.5, kind: 'palm', p: M0.clone().setY(1.4).addScaledVector(fwdM, .6), dir: fwdM, size: 2.2, dur: .7, dist: 5},
    {t: 11.8, kind: 'claw', p: M0.clone().setY(1.6).addScaledVector(fwdM, .6), dir: fwdM, size: 1.8, dur: .6, dist: 3},
    {t: 12.6, kind: 'beam', p: M0.clone().setY(1.5).addScaledVector(fwdM, .5), to: S0.clone().setY(1.5), dur: .5},
    {t: 13.0, kind: 'ring', p: M0.clone().setY(1.5), dir: fwdM, size: 1.5, dur: 1.2, dist: 2},
  ]);
  const C = M0.clone().setY(0);
  const storm = makeSwordStorm(scene, {n: 12000, center: C, cityR: 180, giantLen: 60}); storm.set({rise: 20, vortex: 23, form: 27, strike: 31, hit: 33});
  const G = new THREE.Matrix4(), q = new THREE.Quaternion(), p = new THREE.Vector3();

  const shot = (name, dur, fn) => ({name, dur, cam: fn});
  const shots = [
    shot('rain', 6, (t, c) => { c.position.set(-1, 2.2, 9); c.lookAt(2, 1.5, 0); c.fov = 42; }),
    shot('cuts', 8, (t, c) => { c.position.set(0, 1.6, 6.5); c.lookAt(0, 1.3, 0); c.fov = 40; }),
    shot('fan', 6, (t, c) => { c.position.set(-2, 3.5, 14); c.lookAt(1, 2.5, 0); c.fov = 44; }),
    shot('storm', 16, (t, c) => { const u = t / 16; c.position.set(-60 + u * 20, 25 + u * 30, 120 - u * 40); c.lookAt(C.x, 40 + u * 20, C.z); c.fov = 50; }),
  ];
  return {
    moonDir, sky, shots,
    update(t, lt, sh, cam) {
      cast.update(t, cam); rain.update(t); strikes.update(t);
      cast.S.ch.J.hips.getWorldPosition(p); fan.update(t, cast.S.root, cast.S.yaw, M0.clone().setY(1.3));
      hands.update(t, cast.M.root, cast.M.yaw, S0.clone().setY(1.3));
      /* the giant sword: hangs point-down high over the court, then drives down onto the monk */
      const k = THREE.MathUtils.smoothstep(t, 31, 33), y = 150 - k * 150;
      q.setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI); G.compose(new THREE.Vector3(C.x, y + 60, C.z), q, new THREE.Vector3(1, 1, 1));
      storm.update(t, G);
    },
  };
}
