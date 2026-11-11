import * as THREE from 'three';
import {Kit, building, lantern, lanternString, bellTower, towerBells, tree, stall, cityWall, paifang} from './arch.js';
import {rng} from './util.js';

/* The city (Acts II, V, VI): lantern-market main street along x, dense rooftops, back blocks inside the west wall,
   gate tower, memorial archway, and the seven-tier bell tower. */
export function buildAct2(scene, mats) {
  const R = rng(20261111), kit = new Kit(mats), lamps = [], roofs = [];
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(5000, 5000), mats.ground);
  mats.ground.map = mats.tex.paving.clone(); mats.ground.map.repeat.set(800, 800); mats.ground.map.needsUpdate = true;
  ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; scene.add(ground);

  /* main street: two facing rows of shop-houses */
  for (const side of [-1, 1]) {
    let x = -170;
    while (x < 170) {
      const w = 6 + R() * 6, d = 7 + R() * 3, floors = R() < .25 ? 3 : R() < .7 ? 2 : 1;
      const top = building(kit, {x: x + w / 2, z: side * (5 + d / 2), ry: side > 0 ? Math.PI : 0, w, d, floors, lit: .55, sign: R() < .5, lift: .8 + R() * .5}, R, lamps);
      roofs.push({x: x + w / 2, z: side * (5 + d / 2), w, d, top});
      if (R() < .35) stall(kit, x + w / 2, side * 3.2, side > 0 ? Math.PI : 0, R);
      x += w + .3 + (R() < .12 ? 3.5 : 0);
    }
  }
  for (let x = -160; x < 160; x += 9 + R() * 4) {
    const a = new THREE.Vector3(x, 6.2 + R(), -4.6), b = new THREE.Vector3(x + (R() - .5) * 4, 6.2 + R(), 4.6);
    lanternString(kit, a, b, 6, .9, R() < .3, lamps);
  }
  /* back blocks: a grid of courtyard houses inside the wall */
  for (let gx = -170; gx < 260; gx += 22) for (let gz = -260; gz < 260; gz += 22) {
    if (Math.abs(gz) < 30) continue;
    if (Math.hypot(gx - 70, gz + 150) < 34) continue;
    const n = 1 + Math.floor(R() * 3);
    for (let i = 0; i < n; i++) {
      const w = 7 + R() * 7, d = 6 + R() * 4, x = gx + (R() - .5) * 8, z = gz + (R() - .5) * 8;
      building(kit, {x, z, ry: Math.floor(R() * 4) * Math.PI / 2, w, d, floors: R() < .2 ? 2 : 1, lit: .35, lift: .7 + R() * .5}, R, null);
    }
    if (R() < .55) tree(kit, gx + 9, gz + 9, 6 + R() * 6, R);
  }
  for (let i = 0; i < 60; i++) { const x = -170 + R() * 340; tree(kit, x, (R() < .5 ? -1 : 1) * (19 + R() * 4), 5 + R() * 5, R); }
  const gateTop = cityWall(kit, -188, -260, 260, 0, R, lamps);
  paifang(kit, -177, 0, Math.PI / 2);
  for (const z of [-3.55, 0, 3.55]) { const p = new THREE.Vector3(-177, 4.7, z); lantern(kit, p, 1.2); lamps.push(p); }
  const tower = bellTower(kit, 70, -150, R);

  kit.build(scene);
  const bells = towerBells(scene, tower, mats);

  /* a fixed pool of real point lights, re-seated on the lanterns nearest each shot's focus */
  const pl = [];
  for (let i = 0; i < 18; i++) { const L = new THREE.PointLight(0xff8a3a, 22, 16, 2); scene.add(L); pl.push(L); }
  const seat = (p) => { lamps.sort((a, b) => a.distanceToSquared(p) - b.distanceToSquared(p)); pl.forEach((L, i) => L.position.copy(lamps[i])); };
  seat(new THREE.Vector3(0, 6, 0));
  return {roofs, tower, bells, lights: pl, seat, gateTop};
}
