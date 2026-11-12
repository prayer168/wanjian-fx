import * as THREE from 'three';
import {buildSky, buildMountains, HOR} from '../sky.js';
import {buildAct2} from '../act2.js';
import {pathShot, orbitShot, ease} from '../cam.js';
import {makeCast} from '../cast.js';
import {loadPeople} from '../people.js';
import {along} from '../fight.js';
import {makeFlutter} from '../fx.js';

/* Act V — the seven-tier bell tower in the city: low hero angle, spiral climb, the great bell at the top */
export default async function act5({scene, mats, moonL, bloom, grade}) {
  const moonDir = new THREE.Vector3(.55, .42, -.72).normalize();
  scene.fog = new THREE.FogExp2(0, .0036); scene.fog.color.setRGB(...HOR);
  const sky = buildSky(scene, moonDir);
  buildMountains(scene);
  const set = buildAct2(scene, mats);
  const T = set.tower, c = T.base, top = T.top;
  Object.assign(moonL.shadow.camera, {left: -45, right: 45, top: 45, bottom: -45}); moonL.shadow.camera.updateProjectionMatrix();
  /* drifting petals of ash/paper caught in the high wind around the tower */
  const flakes = makeFlutter(scene, {count: 500, box: [50, 40, 50], color: [.30, .26, .22], size: [.1, .07], fall: .4, drift: [2.2, .6]});

  /* E2 the climb: they bound round the galleries, tier after tier, always on the side facing the orbiting camera;
     E3 the summit: on the open top floor, in front of the great bell, sword raised against horse stance */
  const cast = makeCast(scene, {wind: [-2, 0, .6], people: await loadPeople()});
  const A0 = .4, A1 = .4 + Math.PI * 1.6, camA = (t) => A0 + (A1 - A0) * ease(Math.min(1, Math.max(0, (t - 8) / 13)));
  const gal = (k) => ({y: T.tiers[k].y + .16, h: T.tiers[k].s / 2 + .75});
  const onGal = (k, th) => { const g = gal(k), R = g.h / Math.max(Math.abs(Math.sin(th)), Math.abs(Math.cos(th))); return [c.x + Math.sin(th) * R, g.y, c.z + Math.cos(th) * R]; };
  const F6 = T.tiers[6].y + .3, dv = new THREE.Vector3(0, 0, -1), pv = new THREE.Vector3(1, 0, 0);   // face the moon (-z), in the middle bay between the pavilion columns
  const apex = (k) => new THREE.Vector3(c.x, F6, c.z).addScaledVector(dv, -1.8).addScaledVector(pv, k);
  const climb = (lag, lead) => {
    const segs = [{t: 0, pose: 'idle', at: onGal(1, camA(8) + lead)}];
    for (let k = 1; k <= 5; k++) {
      const t0 = 8 + lag + (k - 1) * 2.4, t1 = t0 + 1.6, t2 = t1 + .8;
      segs.push(...along(t0, t1, (t) => onGal(k, camA(t) + lead), 'run', {step: .2, yaw: (t) => camA(t) + lead + Math.PI / 2}));
      segs.push({t: t1, pose: 'tuck', at: onGal(k, camA(t1) + lead), to: k < 5 ? onGal(k + 1, camA(t2) + lead) : apex(lead > .3 ? .75 : -.75).toArray(), arc: 1.6, move: .8, blend: .12});
    }
    return segs;
  };
  const S = climb(0, .42), M = climb(.45, .2);
  cast.S.track([...S, {t: 21.6, pose: 'land', at: apex(.75), face: 1, blend: .08}, {t: 22.6, pose: 'standoff', face: 1}]);
  cast.M.track([...M, {t: 22.05, pose: 'land', at: apex(-.75), face: 1, big: true, blend: .08}, {t: 23.05, pose: 'horse', face: 1}]);
  const events = cast.bake();

  const shots = [
    Object.assign(pathShot('rise', 8, [[c.x - 26, 1.6, c.z + 40], [c.x - 20, 1.2, c.z + 33]], [[c.x, top * .55, c.z], [c.x, top * .62, c.z]], {fov: [40, 36]}), {focus: new THREE.Vector3(c.x, 4, c.z + 14)}),
    Object.assign(orbitShot('spiral', 13, [c.x, 0, c.z], {a: [.4, .4 + Math.PI * 1.6], r: [27, 18], y: [6, top - 2], look: [4, top - 6], fov: [42, 38]}), {focus: new THREE.Vector3(c.x, 20, c.z)}),
    /* E3 summit standoff: hanging off the pavilion eave, both in profile before the bell */
    Object.assign(pathShot('summit', 6, [apex(0).add(new THREE.Vector3(.2, 1.45, 3.6)).toArray(), apex(0).add(new THREE.Vector3(.05, 1.4, 2.9)).toArray()], [apex(0).setY(F6 + 1.25).toArray(), apex(0).setY(F6 + 1.3).toArray()], {fov: [40, 36]}), {focus: new THREE.Vector3(c.x, F6, c.z)}),
    Object.assign(pathShot('bell', 7, [[c.x + 7.5, T.bell.y - .4, c.z + 6.5], [c.x + 5.6, T.bell.y - .9, c.z + 5.4]], [[c.x, T.bell.y - 1.4, c.z], [c.x, T.bell.y - 1.3, c.z]], {fov: [36, 32]}), {focus: new THREE.Vector3(c.x, T.bell.y, c.z)}),
  ];
  let cur = null;
  return {
    moonDir, sky, shots, shadowAhead: 25, events,
    update(t, lt, sh, cam) {
      if (cur !== sh) { cur = sh; set.seat(sh.focus); }
      for (const L of set.lights) L.intensity = 22 * (1 + .08 * Math.sin(t * 9 + L.position.x));
      set.bells.update(t, 1.4, sh.name === 'bell' ? .4 : 0);
      flakes.update(t, cam); flakes.mesh.visible = sh.name !== 'rise';
      for (const A of cast.all) if (A.shown !== (sh.name !== 'rise')) A.show(sh.name !== 'rise');
      cast.update(t, cam);
      const kk = cast.kick(t); cam.position.x += Math.sin(t * 91) * kk.shake; cam.position.y += Math.sin(t * 73) * kk.shake; grade.uniforms.uFlash.value = kk.flash * .3;
    },
  };
}
