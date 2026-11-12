import * as THREE from 'three';
import {buildSky, buildMountains} from '../sky.js';
import {terrain, bambooForest, addSway} from '../nature.js';
import {makeFlutter, makeMist} from '../fx.js';
import {pathShot, orbitShot} from '../cam.js';
import {canvasTex, grain, rng, fbm} from '../util.js';
import {makeCast} from '../cast.js';
import {loadPeople} from '../people.js';
import {seq} from '../fight.js';

/* Act III — moonlit bamboo sea on rolling hills */
export default async function act3({scene, hemi, moonL, bloom, renderer, grade}) {
  const HOR = [.030, .042, .060];
  const moonDir = new THREE.Vector3(.62, .27, -.70).normalize();
  scene.fog = new THREE.FogExp2(0, .0040); scene.fog.color.setRGB(...HOR);
  const sky = buildSky(scene, moonDir, {hor: HOR});
  buildMountains(scene, {haze: HOR, tint: [.8, 1.15, .9]});
  hemi.color.set(0x48688c); hemi.groundColor.set(0x0c140c); hemi.intensity = .65;
  moonL.color.set(0xc4d6ff); moonL.intensity = 1.9;
  Object.assign(moonL.shadow.camera, {left: -55, right: 55, top: 55, bottom: -55}); moonL.shadow.camera.updateProjectionMatrix();
  renderer.toneMappingExposure = 1.05;

  const hfn = (x, z) => 20 * (fbm(x / 170 + 5, z / 170 + 2, 4) - .45) + 4 * (fbm(x / 38 + 1, z / 38 + 9, 3) - .5) + 60 * Math.pow(fbm(x / 110 + 3, z / 110 + 6, 4), 2) * THREE.MathUtils.smoothstep(Math.hypot(x, z), 140, 420);
  /* forest floor: dark soil under a litter of fallen bamboo leaves */
  const litter = canvasTex(512, 512, (g, w, h) => {
    g.fillStyle = '#211a12'; g.fillRect(0, 0, w, h);
    const R = rng(5);
    for (let i = 0; i < 2600; i++) {
      const x = R() * w, y = R() * h, a = R() * Math.PI, L = 14 + R() * 18, l = 18 + R() * 30;
      g.save(); g.translate(x, y); g.rotate(a); g.fillStyle = `hsl(${35 + R() * 20},${30 + R() * 25}%,${l}%)`;
      g.beginPath(); g.ellipse(0, 0, L, 2.2 + R() * 1.5, 0, 0, Math.PI * 2); g.fill(); g.restore();
    }
    grain(g, w, h, .06, 5, 31);
  });
  const ground = terrain(1400, 220, hfn, new THREE.MeshStandardMaterial({map: litter, color: 0x8a8a80, roughness: .95}), .3);
  scene.add(ground);

  const uni = {uT: {value: 0}, uWind: {value: 1}};
  const F = new THREE.Vector3(-4, 0, .25 * Math.sin(-4 * .08)); F.y = hfn(F.x, F.z);   // the glade where they fight
  const path = (x, z) => !(Math.abs(z - .25 * Math.sin(x * .08)) < 1.6 && x > -60 && x < 40) && Math.hypot(x - 8, z - 2) > 5 && Math.hypot(x - F.x, z - F.z) > 6.5;
  const forest = bambooForest(scene, {hfn, radius: 118, spacing: 2.0, keep: path, uni});

  /* the far bamboo sea: a rolling canopy shell that rises out of the ground beyond the instanced forest */
  const canopyTex = canvasTex(512, 512, (g, w, h) => {
    g.fillStyle = '#22331a'; g.fillRect(0, 0, w, h); const R = rng(8);
    for (let i = 0; i < 1800; i++) { const x = R() * w, y = R() * h, r = 4 + R() * 16; const gr = g.createRadialGradient(x, y - r * .3, 0, x, y, r); gr.addColorStop(0, `hsla(${80 + R() * 25},${30 + R() * 20}%,${26 + R() * 16}%,.9)`); gr.addColorStop(1, 'rgba(10,18,8,0)'); g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill(); }
  });
  const cMat = new THREE.MeshStandardMaterial({map: canopyTex, roughness: .9, color: 0xc8d4b8});
  addSway(cMat, uni, {mode: 'wave', amp: .9, freq: .6});
  const shell = terrain(1500, 520, (x, z) => { const d = Math.hypot(x, z); return hfn(x, z) - 6 + (12 + 7 * fbm(x / 7, z / 7, 4)) * THREE.MathUtils.smoothstep(d, 96, 122); }, cMat, .06);
  shell.receiveShadow = false; scene.add(shell);

  const leaves = makeFlutter(scene, {count: 1600, box: [44, 24, 44], color: [.07, .10, .045], fall: .7, drift: [.9, .25]});
  const R = rng(14), mistItems = [];
  for (let i = 0; i < 46; i++) { const x = -90 + R() * 160, z = -50 + R() * 100; mistItems.push({p: new THREE.Vector3(x, hfn(x, z) + 1.5 + R() * 4, z), s: 18 + R() * 30}); }
  const mist = makeMist(scene, mistItems, {color: [.42, .5, .6], opacity: .14});
  bloom.strength = .6;

  /* camera: C1 high glide over the sea toward the moon; C2 ground dolly along the path; low look up into the canopy */
  const gy = (x, z, o) => hfn(x, z) + o;
  /* C2-C5: in the glade, sword against palm, then the lion's roar flattens the bamboo around them */
  const cast = makeCast(scene, {wind: [-1, 0, .4], people: await loadPeople()});
  const gf = (x, z) => hfn(x, z), P = (dx) => new THREE.Vector3(F.x + dx, 0, F.z + dx * .02).setY(gf(F.x + dx, F.z));
  const S0 = P(-1.25), M0 = P(1.25);
  cast.S.track([{t: 0, pose: 'standoff', at: S0, face: 1, gfn: gf},
    ...seq(20.2, S0, [['slash1', 1.0], ['slash2', 1.05, {to: P(-.9)}], ['thrust', 1.1], ['slash3', 1.15], ['block', 1.3], ['slash1', 1.0], ['standoff', 2.2]], {face: 1, gfn: gf}),
    {t: 28.0, pose: 'block', face: 1, gfn: gf}, {t: 28.55, pose: 'hit', to: P(-3.4), move: .7, face: 1, gfn: gf, ease: 'out'}, {t: 29.6, pose: 'standoff', face: 1, gfn: gf}]);
  cast.M.track([{t: 0, pose: 'standoff', at: M0, face: 1, gfn: gf},
    ...seq(20.15, M0, [['block', 1.05], ['block', 1.05], ['punch', 1.0, {to: P(.9)}], ['block', 1.15], ['palm', 1.4], ['block', 1.0], ['horse', 2.2]], {face: 1, gfn: gf}),
    {t: 28.0, pose: 'horse', face: 1, gfn: gf, fx: [{t: .45, type: 'bell'}, {t: .45, type: 'land', big: true}]}]);
  const events = cast.bake();

  const shots = [
    pathShot('aerial', 11, [[-96, gy(-96, 44, 40), 44], [-70, gy(-70, 30, 34), 30], [-44, gy(-44, 16, 29), 16]], [[-96 + 620, 88, 44 - 700], [-70 + 620, 84, 30 - 700], [-44 + 620, 80, 16 - 700]], {fov: [40, 37]}),
    pathShot('grove', 9, [[-46, gy(-46, 0, 1.7), .3], [-32, gy(-32, 0, 1.9), -.2], [-18, gy(-18, 0, 2.2), .1]], [[0, gy(0, 0, 6), -2], [14, gy(14, 0, 7), -1], [28, gy(28, 0, 8), 0]], {fov: [36, 33], shake: .02}),
    /* C2-C4 a slow arc round the glade at chest height */
    orbitShot('duel', 8, [F.x, 0, F.z], {a: [-.55, .75], r: [4.4, 3.6], y: [F.y + 1.25, F.y + 1.45], look: [F.y + 1.05, F.y + 1.15], fov: [34, 30]}),
    /* C5 low on the monk as he roars */
    pathShot('roar', 4, [M0.clone().add(new THREE.Vector3(-2.4, .35, 1.4)).toArray(), M0.clone().add(new THREE.Vector3(-2.0, .3, 1.15)).toArray()], [M0.clone().add(new THREE.Vector3(0, 1.55, 0)).toArray(), M0.clone().add(new THREE.Vector3(0, 1.65, 0)).toArray()], {fov: [36, 40], shake: .02}),
    pathShot('canopy', 7, [[6, gy(6, 2, 1.4), 1.5], [9, gy(9, 2, 1.4), 2.8]], [[6 + 14, gy(6, 2, 1.4) + 17, 1.5 - 16], [9 + 15, gy(9, 2, 1.4) + 17, 2.8 - 15]], {fov: [58, 54], curve: (u) => u}),
  ];
  return {
    moonDir, sky, shots, shadowAhead: 30, events,
    update(t, lt, sh, cam) {
      uni.uT.value = t; uni.uWind.value = 1 + .35 * Math.sin(t * .3);
      leaves.update(t, cam); leaves.mesh.visible = sh.name !== 'aerial'; mist.update(t);
      for (const A of cast.all) if (A.shown !== (sh.name !== 'aerial' && sh.name !== 'canopy')) A.show(sh.name !== 'aerial' && sh.name !== 'canopy');
      cast.update(t, cam);
      const kk = cast.kick(t); cam.position.x += Math.sin(t * 91) * kk.shake; cam.position.y += Math.sin(t * 73) * kk.shake; grade.uniforms.uFlash.value = kk.flash * .3;
      /* the roar: wind slams outward, the bamboo bows away from the monk */
      const roar = t > 28.45 ? Math.exp(-(t - 28.45) * 1.2) : 0; uni.uWind.value = 1 + .35 * Math.sin(t * .3) + roar * 6;
    },
  };
}
