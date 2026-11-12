import * as THREE from 'three';
import {buildSky, buildMountains, HOR} from '../sky.js';
import {buildAct2} from '../act2.js';
import {pathShot} from '../cam.js';
import {makeCast} from '../cast.js';
import {loadPeople} from '../people.js';

/* Act II — gate, lantern market, rooftops.
   B1 the swordsman vaults the gate tower, the monk follows and lands like a falling bell; B3 side-on chase along the north roofs;
   B4/B5 the swordsman turns on a ridge, two cuts of sword qi, the monk takes them on his bell and answers with a double palm;
   B6 both leap across the face of the moon. */
export default async function act2({scene, mats, grade}) {
  const moonDir = new THREE.Vector3(.86, .25, -.42).normalize();
  scene.fog = new THREE.FogExp2(0, .0042); scene.fog.color.setRGB(...HOR);
  const sky = buildSky(scene, moonDir);
  buildMountains(scene);
  const set = buildAct2(scene, mats);

  /* roof profile along the north row: raycast down onto the tiles every 25 cm, then smooth it into a running surface */
  const ZR = -9.6, X0 = -150, X1 = 10, prof = [];
  {
    /* keep only the triangles in a strip along the run line, so the raycasts stay cheap */
    const tri = [];
    for (const o of scene.children) if (o.isMesh && (o.material === mats.tile || o.material === mats.ridge)) {
      const p = o.geometry.attributes.position, ix = o.geometry.index, n = ix ? ix.count : p.count;
      for (let k = 0; k < n; k += 3) { const a = ix ? ix.getX(k) : k, b = ix ? ix.getX(k + 1) : k + 1, c = ix ? ix.getX(k + 2) : k + 2;
        const zs = [p.getZ(a), p.getZ(b), p.getZ(c)], xs = [p.getX(a), p.getX(b), p.getX(c)];
        if (Math.max(...zs) < ZR - 1 || Math.min(...zs) > ZR + 1 || Math.max(...xs) < X0 - 2 || Math.min(...xs) > X1 + 2) continue;
        for (const v of [a, b, c]) tri.push(p.getX(v), p.getY(v), p.getZ(v)); }
    }
    const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.Float32BufferAttribute(tri, 3));
    const hit = [new THREE.Mesh(sg, new THREE.MeshBasicMaterial({side: THREE.DoubleSide}))];
    const rc = new THREE.Raycaster(), o = new THREE.Vector3(), dn = new THREE.Vector3(0, -1, 0);
    for (let x = X0; x <= X1; x += .25) { rc.set(o.set(x, 60, ZR), dn); const h = rc.intersectObjects(hit, false)[0]; prof.push(h ? h.point.y : 0); }
    for (let i = 1; i < prof.length - 1; i++) if (prof[i] < 1) prof[i] = Math.max(prof[i - 1], 1);           // bridge alley gaps at eave height
    for (let pass = 0; pass < 6; pass++) for (let i = 1; i < prof.length - 1; i++) prof[i] = Math.max(prof[i], (prof[i - 1] + prof[i + 1]) / 2 - .02);  // round the steps into bounds
  }
  const roofY = (x) => { const f = (x - X0) / .25, i = Math.max(0, Math.min(prof.length - 2, Math.floor(f))), u = f - i; return prof[i] * (1 - u) + prof[i + 1] * u; };
  const gRoof = (x) => roofY(x);

  const cast = makeCast(scene, {wind: [-1.4, 0, .5], people: await loadPeople()});
  const EAST = Math.PI / 2;
  /* B6 leap path across the moon, seen from the moonroofs camera */
  const camM = new THREE.Vector3(8, 11.4, 6), apex = camM.clone().addScaledVector(moonDir, 42), lat = new THREE.Vector3(moonDir.z, 0, -moonDir.x).normalize();
  const leapA = apex.clone().addScaledVector(lat, -16).setY(roofY(-10) - 2), leapB = apex.clone().addScaledVector(lat, 16).setY(10);
  const arcH = apex.y - (leapA.y + leapB.y) / 2;

  const xS = (t) => -132 + (t - 21) * 9;   // swordsman's position along the roofs, 9 m/s
  cast.S.track([
    {t: 0, pose: 'tuck', at: [-215, 0, 0]},
    {t: 15.0, pose: 'tuck', at: [-215, 0, 0], to: [-172, 0, -3.2], arc: 27, move: 2.6},
    {t: 17.6, pose: 'land', at: [-172, 0, -3.2], yaw: EAST, blend: .08},
    {t: 18.5, pose: 'run', to: [-150, 0, -3.6], yaw: EAST, move: 2.4},
    {t: 21, pose: 'run', at: [xS(21), 0, ZR], to: [xS(32.2), 0, ZR], yaw: EAST, gfn: gRoof, blend: 0},
    {t: 32.2, pose: 'idle', at: [xS(32.2), 0, ZR], to: [xS(32.2) + 1.2, 0, ZR], move: .35, gfn: gRoof, ease: 'out', yaw: EAST, yawTo: -EAST},
    {t: 32.7, pose: 'slash1', at: [xS(32.2) + 1.2, 0, ZR], gfn: gRoof, face: 1},
    {t: 33.55, pose: 'slash3', gfn: gRoof, face: 1},
    {t: 34.7, pose: 'block', gfn: gRoof, face: 1},
    {t: 35.25, pose: 'hit', to: [xS(32.2) + 3.4, 0, ZR], move: .5, gfn: gRoof, face: 1, ease: 'out'},
    {t: 36.0, pose: 'run', to: [xS(32.2) + 16, 0, ZR], yaw: EAST, gfn: gRoof},
    {t: 38.3, pose: 'tuck', at: leapA, to: leapB, arc: arcH, move: 2.4, blend: 0},
  ]);
  const xM = (t) => -140 + (t - 21) * 9;
  const mStop = xS(32.2) + 1.2 - 2.0;
  cast.M.track([
    {t: 0, pose: 'tuck', at: [-215, 0, 0]},
    {t: 17.3, pose: 'tuck', at: [-215, 0, 0], to: [-173, 0, 1.2], arc: 27, move: 2.6},
    {t: 19.9, pose: 'land', at: [-173, 0, 1.2], yaw: EAST, big: true, blend: .06},
    {t: 21, pose: 'run', at: [xM(21), 0, ZR], to: [mStop, 0, ZR], move: (mStop - xM(21)) / 9, yaw: EAST, gfn: gRoof},
    {t: 21 + (mStop - xM(21)) / 9, pose: 'horse', at: [mStop, 0, ZR], gfn: gRoof, face: 1},
    {t: 33.55 + .47 - .46, pose: 'block', gfn: gRoof, face: 1},
    {t: 34.6, pose: 'palm', gfn: gRoof, face: 1},
    {t: 36.3, pose: 'run', to: [mStop + 14, 0, ZR], yaw: EAST, gfn: gRoof},
    {t: 39.9, pose: 'tuck', at: leapA, to: leapB, arc: arcH, move: 2.4, blend: 0},
  ]);
  const events = cast.bake();

  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  const shots = [
    Object.assign(pathShot('flyover', 14, [[-150, 70, 70], [-110, 44, 38], [-75, 26, 16], [-45, 16, 5], [-15, 12, 1.2], [20, 10.5, 0]], [[-40, 10, -30], [0, 12, -36], [40, 12, -30], [80, 13, -26], [120, 13, -22], [170, 15, -24]], {fov: [38, 32]}), {focus: V(0, 6, 0)}),
    /* B1 inside the gate: look up at the gate tower, the two come over it one after the other */
    Object.assign((() => { const base = pathShot('g', 8, [[-160, 1.0, 2.2], [-163, 1.3, 1.6], [-165, 1.6, 1.0]], [[-186, 7.5, 0], [-186, 8.5, 0], [-186, 9.5, 0]], {fov: [36, 34], shake: .03}), tmp = V(0, 0, 0);
      return {name: 'gate', dur: 8, cam(lt, c) { base.cam(lt, c); const t = 14 + lt, a = t < 18.6 ? cast.S : cast.M, r = a.rootAt(t, tmp), w = THREE.MathUtils.smoothstep(lt, .8, 2.2) * (1 - THREE.MathUtils.smoothstep(lt, 7, 8) * .5);
        const look = c.position.clone().add(new THREE.Vector3(0, 0, -1).applyQuaternion(c.quaternion).multiplyScalar(20)); look.lerp(r.clone().setY(r.y + 1.2), w * .7); c.lookAt(look); }}; })(), {focus: V(-176, 5, 0)}),
    /* B3 side-on chase: camera floats over the street at roof height, keeping pace between the two */
    {name: 'roofrun', dur: 10.2, focus: V(-80, 8, -9), cam(lt, c) { const t = 22 + lt, x = (xS(t) + xM(t)) / 2 + 1.5;
      c.position.set(x - 2, roofY(x) + 2.6, ZR + 13.5); c.up.set(0, 1, 0); c.lookAt(x + 1.5, roofY(x) + .9, ZR); c.fov = 30; }},
    /* B4/B5 the turn: low over the ridge, three-quarter on both */
    {name: 'turn', dur: 4.8, focus: V(xS(32.2), 8, -9), cam(lt, c) { const t = 32.2 + lt, xm = xS(32.2) + .2, k = lt / 4.8;
      c.position.set(xm - 3.4 + k * .8, roofY(xm) + 1.05 + k * .3, ZR + 5.6 - k * .6); c.up.set(0, 1, 0); c.lookAt(xm, roofY(xm) + 1.15, ZR - .2); c.fov = 32 - k * 3; void t; }},
    Object.assign(pathShot('moonroofs', 7, [camM.toArray(), [12, 11.6, 5.5]], [camM.clone().addScaledVector(moonDir, 100).toArray(), V(12, 11.6, 5.5).addScaledVector(moonDir, 100).toArray()], {fov: [30, 28], curve: (u) => u}), {focus: V(8, 8, 6)}),
  ];
  const T0 = {flyover: 0, gate: 14, roofrun: 22, turn: 32.2, moonroofs: 37};
  let cur = null;
  return {
    moonDir, sky, shots, events,
    update(t, lt, sh, cam) {
      if (cur !== sh) { cur = sh; set.seat(sh.focus); }
      for (const L of set.lights) L.intensity = 22 * (1 + .08 * Math.sin(t * 9 + L.position.x));
      set.bells.update(t, .6);
      const on = sh.name !== 'flyover';
      for (const A of cast.all) if (A.shown !== on) A.show(on);
      cast.update(t, cam);
      const kk = cast.kick(t); cam.position.x += Math.sin(t * 91) * kk.shake; cam.position.y += Math.sin(t * 73) * kk.shake;
      grade.uniforms.uFlash.value = kk.flash * .3;
      void T0;
    },
  };
}
