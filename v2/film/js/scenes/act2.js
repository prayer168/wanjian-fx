import * as THREE from 'three';
import {buildSky, buildMountains, HOR} from '../sky.js';
import {buildAct2} from '../act2.js';
import {pathShot} from '../cam.js';
import {stageFight} from '../director.js';

/* Act II — gate, lantern market, rooftops. 劍客扳回一城.
   The monk comes through the gate after him; in the lantern street 龍爪手 and 羅漢拳 drive the swordsman back; he breaks away
   with 驚鴻一閃, takes it up onto the roofs, and on the ridges his 劍氣 and 九霄劍陣 push the monk to his knees. */
export default async function act2(ctx) {
  const {scene, mats} = ctx;
  const moonDir = new THREE.Vector3(.86, .25, -.42).normalize();
  scene.fog = new THREE.FogExp2(0, .0042); scene.fog.color.setRGB(...HOR);
  const sky = buildSky(scene, moonDir);
  buildMountains(scene);
  const set = buildAct2(scene, mats);

  /* roof profile along the north row: raycast down onto the tiles every 25 cm (only triangles in a strip along the line) */
  const ZR = -9.6, X0 = -150, X1 = 10, prof = [];
  {
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
    for (let i = 1; i < prof.length - 1; i++) if (prof[i] < 1) prof[i] = Math.max(prof[i - 1], 1);
    for (let pass = 0; pass < 6; pass++) for (let i = 1; i < prof.length - 1; i++) prof[i] = Math.max(prof[i], (prof[i - 1] + prof[i + 1]) / 2 - .02);
  }
  const roofY = (x) => { const f = (x - X0) / .25, i = Math.max(0, Math.min(prof.length - 2, Math.floor(f))), u = f - i; return prof[i] * (1 - u) + prof[i + 1] * u; };
  const street = () => 0, roof = (x) => roofY(x);

  const beats = [
    /* the gate: the monk arrives, the swordsman waits in the street */
    {d: 2.2, S: 'S_draw_sword', M: {clip: 'X_hard_landing', off: .2, big: true}, shot: 'low', gap: 5, vo: [['b1', .5]]},
    {d: 1.6, S: {clip: 'S_swordplay_idle', off: 3}, M: 'M_fight_idle', shot: 'wide', gap: 3.2},
    {d: 2.4, S: 'S_one_hand_sword_combo', M: 'M_high_block', shot: 'medium', gap: 1.4, move: 1, sk: [{kind: 'crescent', at: 1.0}, {kind: 'crescent', at: 2.1, up: [0, 1, 0]}]},
    {d: 2.0, S: {clip: 'S_gs_to_block'}, M: {clip: 'M_open_palm_combo', off: .9}, shot: 'overS', vo: [['b3', .1]], sk: [{kind: 'claw', at: .5, size: 1.4}]},
    {d: 2.2, S: 'X_hit_reaction', M: {clip: 'M_eight_punch_combo', off: .7}, shot: 'closeM', shake: .02, move: 1.2, sk: [{kind: 'palm', at: .3, size: .9, dist: 1.2}, {kind: 'palm', at: .7, size: .9, dist: 1.2}, {kind: 'palm', at: 1.2, size: 1, dist: 1.4}]},
    {d: 1.8, S: {clip: 'X_jump_back_dodge', off: .4}, M: {clip: 'M_roundhouse'}, shot: 'orbit', slow: .3, gap: 2.4, move: 1, vo: [['b4', .2]]},
    {d: .9, S: {clip: 'S_gs_slide_attack', off: 1.1}, M: 'X_hit_reaction', shot: 'medium', gap: 3, move: -1, sk: [{kind: 'flash', at: .25}, {kind: 'crescent', at: .3, size: 4, dist: 3}]},
    {d: 1.6, S: {clip: 'S_swordplay_idle', off: 3.6}, M: {clip: 'X_rocked_uppercut', off: .3}, shot: 'closeS'},
    {d: 2.0, S: {clip: 'X_run_up_wall'}, M: {clip: 'X_jump_from_sprint'}, shot: 'crane', gap: 4, move: 3, vo: [['b2', .1]], whip: 1},
    /* up on the ridges of the north row */
    {d: 1.6, place: new THREE.Vector3(-118, 0, ZR), gfn: roof, side: -1, S: {clip: 'X_landing', off: .2}, M: {clip: 'X_landing', off: .2}, shot: 'wide', gap: 3, whipIn: 1},
    {d: 2.2, S: 'S_gs_spin_attack_run', M: {clip: 'M_inward_block'}, shot: 'track', side: -1, gap: 1.6, move: 2, sk: [{kind: 'crescent', at: .5}, {kind: 'crescent', at: 1.1, up: [0, 1, 0]}]},
    {d: 2.4, S: {clip: 'S_spell_two_hand_sword'}, M: 'M_high_block', shot: 'low', side: -1, gap: 3, sk: [{kind: 'fan', at: .2, fire: 1.0, span: 1.2}]},
    {d: 2.0, S: {clip: 'S_gs_pose_idle'}, M: {clip: 'X_knocked_down', off: .2}, shot: 'overhead', side: -1, gap: 3.4},
    {d: 2.2, S: {clip: 'X_big_front_flip'}, M: {clip: 'X_get_up', off: .4}, shot: 'track', side: -1, gap: 7, move: 4},
  ];
  const F = await stageFight(ctx, {beats, center: new THREE.Vector3(-168, 0, 1.2), yaw: Math.PI / 2, gfn: street, t0: 6, film0: 6, wind: [-1.4, 0, .5]});

  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  const camM = new THREE.Vector3(8, 11.4, 6);
  const shots = [
    Object.assign(pathShot('flyover', 6, [[-75, 26, 16], [-45, 16, 5], [-15, 12, 1.2]], [[40, 12, -30], [80, 13, -26], [120, 13, -22]], {fov: [38, 34]}), {focus: V(0, 6, 0)}),
    ...F.shots.map((s) => Object.assign(s, {focus: s.t0 < 6 + 16 ? V(-168, 5, 0) : V(-110, 8, ZR)})),
    Object.assign(pathShot('moonroofs', 5, [camM.toArray(), [12, 11.6, 5.5]], [camM.clone().addScaledVector(moonDir, 100).toArray(), V(12, 11.6, 5.5).addScaledVector(moonDir, 100).toArray()], {fov: [30, 28], curve: (u) => u}), {focus: V(8, 8, 6), t0: F.D.end}),
  ];
  let cur = null;
  return {
    moonDir, sky, shots, events: F.events,
    update(t, lt, sh, cam) {
      if (cur !== sh) { cur = sh; set.seat(sh.focus || V(-150, 5, 0)); }
      for (const L of set.lights) L.intensity = 22 * (1 + .08 * Math.sin(t * 9 + L.position.x));
      set.bells.update(t, .6);
      F.update(t, cam);
    },
  };
}
