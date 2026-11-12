import * as THREE from 'three';
import {FBXLoader} from 'three/addons/loaders/FBXLoader.js';
import {Trail, makeBursts, useScene} from './cast.js';

/* Motion-captured fighting (Mixamo clips, 60 fps, root motion kept) retargeted onto the MakeHuman leads.
   A clip is sampled as local bone rotations; world rotations are carried over as deltas from the Mixamo T-pose onto the
   MakeHuman A-pose, each bone first re-aimed so its rest direction matches. Root travel comes from the Hips track.
   Hits (speed peaks of the blade tip, fists, feet) and landings are found in the clips automatically. Everything is a pure
   function of time; only the qi trails are stepped. */

const MAP = [  // Mixamo bone, MakeHuman bone, child used for aiming (Mixamo, MakeHuman)
  ['Hips', 'pelvis', 'Spine', 'spine_01'], ['Spine', 'spine_01', 'Spine1', 'spine_02'], ['Spine1', 'spine_02', 'Spine2', 'spine_03'], ['Spine2', 'spine_03', 'Neck', 'neck_01'],
  ['Neck', 'neck_01', 'Head', 'head'], ['Head', 'head', 'HeadTop_End', null],
  ...['Left', 'Right'].flatMap((S) => { const s = S === 'Left' ? 'l' : 'r'; return [
    [S + 'Shoulder', 'clavicle_' + s, S + 'Arm', 'upperarm_' + s], [S + 'Arm', 'upperarm_' + s, S + 'ForeArm', 'lowerarm_' + s], [S + 'ForeArm', 'lowerarm_' + s, S + 'Hand', 'hand_' + s],
    [S + 'Hand', 'hand_' + s, S + 'HandMiddle1', 'middle_01_' + s],
    ...[['Thumb', 'thumb'], ['Index', 'index'], ['Middle', 'middle'], ['Ring', 'ring'], ['Pinky', 'pinky']].flatMap(([F, f]) => [1, 2, 3].map((k) => [`${S}Hand${F}${k}`, `${f}_0${k}_${s}`, `${S}Hand${F}${k + 1}`, k < 3 ? `${f}_0${k + 1}_${s}` : null])),
    [S + 'UpLeg', 'thigh_' + s, S + 'Leg', 'calf_' + s], [S + 'Leg', 'calf_' + s, S + 'Foot', 'foot_' + s], [S + 'Foot', 'foot_' + s, S + 'ToeBase', 'ball_' + s], [S + 'ToeBase', 'ball_' + s, S + 'Toe_End', null],
  ]; }),
];
const qa = new THREE.Quaternion(), qb = new THREE.Quaternion(), va = new THREE.Vector3(), vb = new THREE.Vector3();

/* ---------- loading ---------- */
export async function loadMocap(names) {
  const L = new FBXLoader(), clips = {};
  let rest = null;
  await Promise.all(names.map(async (n) => {
    const o = await L.loadAsync(`../assets/mocap/${n}.fbx`);
    if (!rest) rest = restOf(o);
    clips[n] = prepClip(o.animations[0], n);
  }));
  for (const n in clips) analyse(clips[n], rest);
  return {rest, clips};
}
function restOf(root) {
  const bones = []; root.traverse((b) => { if (b.isBone) bones.push(b); });
  const order = [], idx = {};
  for (const b of bones) { const name = b.name.replace('mixamorig', ''); if (idx[name] !== undefined) continue; idx[name] = order.length; order.push({name, parent: null, p: b.position.clone(), q: b.quaternion.clone(), pb: b.parent?.isBone ? b.parent.name.replace('mixamorig', '') : null}); }
  for (const o of order) o.parent = o.pb ? idx[o.pb] : -1;
  const R = {order, idx};
  const w = worldOf(R, order.map((o) => o.q), order[idx.Hips].p);
  R.wq = w.q; R.wp = w.p;
  const P = (n) => R.wp[idx[n]];
  R.leg = P('LeftUpLeg').distanceTo(P('LeftLeg')) + P('LeftLeg').distanceTo(P('LeftFoot'));
  R.ankle = P('LeftFoot').y;
  return R;
}
function prepClip(clip, name) {
  const tr = {};
  for (const t of clip.tracks) { const [b, prop] = t.name.split('.'); const bn = b.replace('mixamorig', ''); (tr[bn] = tr[bn] || {})[prop] = t.createInterpolant(); }
  return {name, dur: clip.duration, tr};
}
/* local rotations + hips position at time t (clamped) */
function sampleLocal(R, C, t, outQ) {
  t = Math.min(Math.max(t, 0), C.dur - 1e-4);
  R.order.forEach((o, i) => { const tr = C.tr[o.name]; if (tr?.quaternion) { const v = tr.quaternion.evaluate(t); outQ[i].set(v[0], v[1], v[2], v[3]); } else outQ[i].copy(o.q); });
  const hp = C.tr.Hips?.position?.evaluate(t);
  return hp ? new THREE.Vector3(hp[0], hp[1], hp[2]) : R.order[R.idx.Hips].p.clone();
}
function worldOf(R, locQ, hips) {
  const q = [], p = [];
  R.order.forEach((o, i) => {
    if (o.parent < 0) { q[i] = locQ[i].clone(); p[i] = (o.name === 'Hips' ? hips : o.p).clone(); return; }
    q[i] = q[o.parent].clone().multiply(locQ[i]); p[i] = o.p.clone().applyQuaternion(q[o.parent]).add(p[o.parent]);
  });
  return {q, p};
}
export function samplePose(R, C, t) {
  const loc = R.order.map(() => new THREE.Quaternion());
  const hips = sampleLocal(R, C, t, loc);
  return worldOf(R, loc, hips);
}

/* ---------- automatic hit and landing detection (rig space, cm) ---------- */
function analyse(C, R) {
  const dt = 1 / 60, n = Math.floor(C.dur / dt), sp = {R: [], L: [], FR: [], FL: [], tip: []}, foot = [];
  const I = (k) => R.idx[k];
  let prev = null;
  for (let i = 0; i <= n; i++) {
    const w = samplePose(R, C, i * dt), P = (k) => w.p[I(k)];
    const tip = P('RightHand').clone().add(P('RightHandIndex1').clone().sub(P('RightHandPinky1')).normalize().multiplyScalar(95));
    const cur = {R: P('RightHand').clone(), L: P('LeftHand').clone(), FR: P('RightToeBase').clone(), FL: P('LeftToeBase').clone(), tip, hips: P('Hips').clone()};
    if (prev) for (const k of ['R', 'L', 'FR', 'FL', 'tip']) sp[k].push(cur[k].clone().sub(cur.hips).distanceTo(prev[k].clone().sub(prev.hips)) / dt);
    foot.push(Math.min(P('LeftToeBase').y, P('RightToeBase').y, P('LeftFoot').y - R.ankle, P('RightFoot').y - R.ankle));
    prev = cur;
  }
  /* hits: peaks of limb speed relative to the hips, at least .28 s apart */
  const peaks = (a, thr) => { const out = []; for (let i = 2; i < a.length - 2; i++) if (a[i] > thr && a[i] >= a[i - 1] && a[i] >= a[i + 1] && a[i] >= a[i - 2] && a[i] >= a[i + 2]) { const t = (i + 1) * dt; if (!out.length || t - out[out.length - 1].t > .28) out.push({t, v: a[i]}); else if (a[i] > out[out.length - 1].v) out[out.length - 1] = {t, v: a[i]}; } return out; };
  C.hits = {tip: peaks(sp.tip, 900), R: peaks(sp.R, 420), L: peaks(sp.L, 420), FR: peaks(sp.FR, 520), FL: peaks(sp.FL, 520)};
  /* landings: a foot comes back to the ground after being more than 35 cm up */
  C.lands = []; let air = false;
  for (let i = 0; i < foot.length; i++) { if (foot[i] > 35) air = true; else if (air && foot[i] < 6) { C.lands.push(i * dt); air = false; } }
  const h0 = samplePose(R, C, 0).p[I('Hips')], h1 = samplePose(R, C, C.dur).p[I('Hips')];
  C.travel = new THREE.Vector3(h1.x - h0.x, 0, h1.z - h0.z);
}

/* ---------- the cast ---------- */
/* segment: {t, clip, at, to, move, arc, ease, yaw, yawTo, face, speed, off, blend, hold, fx, hits:false, inPlace} */
const E = {lin: (t) => t, io: (t) => t < .5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2, out: (t) => 1 - Math.pow(1 - t, 3)};
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const angLerp = (a, b, u) => { const d = ((b - a) % (2 * Math.PI) + 3 * Math.PI) % (2 * Math.PI) - Math.PI; return a + d * u; };
const V3 = (a) => a && (a.isVector3 ? a.clone() : new THREE.Vector3(...a));

class MoActor {
  constructor(key, P, mo, scene) {
    Object.assign(this, {key, P, mo, segs: [], root: new THREE.Vector3(), yaw: 0, shown: true});
    this.k = P.dimLeg / mo.rest.leg;                              // Mixamo cm -> this body's metres, by leg length
    this.calib();
    this.trails = {R: new Trail(new THREE.Color(key === 'S' ? '#6ab8ff' : '#ffcc44'), new THREE.Color(key === 'S' ? '#d2f0ff' : '#ffe08a')), L: new Trail(new THREE.Color('#ffcc44'), new THREE.Color('#ffe08a'))};
    scene.add(P.root); if (P.sword) scene.add(P.sword);
  }
  calib() {
    const R = this.mo.rest, B = this.P.bones;
    this.P.root.updateMatrixWorld(true);
    this.map = MAP.filter(([mx, mh]) => R.idx[mx] !== undefined && B[mh]).map(([mx, mh, mxc, mhc]) => {
      const b = B[mh], qm0 = b.getWorldQuaternion(new THREE.Quaternion());
      let align = new THREE.Quaternion();
      if (mhc && B[mhc] && R.idx[mxc] !== undefined) {
        const dM = B[mhc].getWorldPosition(new THREE.Vector3()).sub(b.getWorldPosition(new THREE.Vector3())).normalize();
        const dX = R.wp[R.idx[mxc]].clone().sub(R.wp[R.idx[mx]]).normalize();
        align.setFromUnitVectors(dM, dX);
      }
      return {i: R.idx[mx], b, rest: align.multiply(qm0), inv0: R.wq[R.idx[mx]].clone().invert()};
    });
    this.pelvis0 = B.pelvis.getWorldPosition(new THREE.Vector3());
  }
  track(list) {
    let at = new THREE.Vector3(), yaw = 0;
    const C = this.mo.clips;
    this.segs = list.map((s, i) => {
      const o = Object.assign({speed: 1, off: 0, blend: .15, ease: 'lin'}, s);
      if (!C[o.clip]) throw new Error('no clip ' + o.clip);
      o.C = C[o.clip]; o.A = V3(s.at) || at.clone(); o.P = V3(s.to) || o.A.clone();
      const end = list[i + 1] ? list[i + 1].t : o.t + (o.C.dur - o.off) / o.speed; o.end = end; o.move = s.move || (end - o.t);
      const dx = o.P.x - o.A.x, dz = o.P.z - o.A.z;
      o.Y0 = s.yaw != null ? s.yaw : Math.hypot(dx, dz) > .05 ? Math.atan2(dx, dz) : yaw; o.Y1 = s.yawTo != null ? s.yawTo : o.Y0;
      o.h0 = samplePose(this.mo.rest, o.C, o.off).p[this.mo.rest.idx.Hips].clone();
      /* where the clip's own travel leaves the actor when the next segment starts */
      const lt = clamp((end - o.t) * o.speed + o.off, 0, o.C.dur), h = samplePose(this.mo.rest, o.C, lt).p[this.mo.rest.idx.Hips];
      o.D = o.inPlace ? new THREE.Vector3() : new THREE.Vector3((h.x - o.h0.x) * this.k, 0, (h.z - o.h0.z) * this.k).applyAxisAngle(new THREE.Vector3(0, 1, 0), o.Y1);
      at = o.P.clone().add(o.D); yaw = o.Y1;
      return o;
    });
    return this;
  }
  segAt(t) { let i = 0; while (i < this.segs.length - 1 && t >= this.segs[i + 1].t) i++; return i; }
  yawAt(s, t) {
    if (s.face) { const o = this.other.basePos(t), m = this.basePos(t); return Math.atan2(o.x - m.x, o.z - m.z) + (s.yaw || 0); }
    return angLerp(s.Y0, s.Y1, E.io(clamp((t - s.t) / s.move)));
  }
  /* path position (without the clip's own travel) */
  basePos(t, out = new THREE.Vector3()) { const s = this.segs[this.segAt(t)], u = clamp((t - s.t) / s.move); out.lerpVectors(s.A, s.P, E[s.ease](u)); if (s.gfn) out.y = s.gfn(out.x, out.z); if (s.arc) out.y += 4 * s.arc * u * (1 - u); return out; }
  lt(s, t) { const x = (t - s.t) * s.speed + s.off; return s.loop ? ((x % s.C.dur) + s.C.dur) % s.C.dur : clamp(x, 0, s.C.dur); }
  /* world pose of the Mixamo rig at t (quaternions in world, positions in world metres) */
  pose(t, s = this.segs[this.segAt(t)]) {
    const R = this.mo.rest, lt = this.lt(s, t), w = samplePose(R, s.C, lt), yaw = this.yawAt(s, t), qy = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw);
    const base = this.basePos(t), h0 = s.h0, k = this.k, ip = !!s.inPlace;
    const wp = w.p.map((p) => new THREE.Vector3(ip ? (p.x - w.p[R.idx.Hips].x) * k : (p.x - h0.x) * k, p.y * k, ip ? (p.z - w.p[R.idx.Hips].z) * k : (p.z - h0.z) * k).applyQuaternion(qy).add(base));
    const wq = w.q.map((q) => qy.clone().multiply(q));
    return {wq, wp, yaw, base, lt};
  }
  eval(t) {
    const i = this.segAt(t), s = this.segs[i];
    let p = this.pose(t, s);
    if (i > 0 && t - s.t < s.blend) {           // cross-fade from the end of the previous clip
      const q = this.pose(t, this.segs[i - 1]), u = E.io((t - s.t) / s.blend);
      p.wq = p.wq.map((x, j) => q.wq[j].clone().slerp(x, u)); p.wp = p.wp.map((x, j) => q.wp[j].clone().lerp(x, u));
    }
    this.cur = p; this.seg = s; this.root.copy(p.base); this.yaw = p.yaw;
    return p;
  }
  apply() {
    const p = this.cur, R = this.mo.rest, qp = new THREE.Quaternion();
    for (const m of this.map) {
      const q = p.wq[m.i].clone().multiply(m.inv0).multiply(m.rest);
      if (m.b.name === 'pelvis') { m.b.parent.updateWorldMatrix(true, false); m.b.position.copy(m.b.parent.worldToLocal(p.wp[R.idx.Hips].clone())); }
      m.b.parent.getWorldQuaternion(qp); m.b.quaternion.copy(qp.invert().multiply(q)); m.b.updateMatrixWorld(true);
    }
    /* feet never sink: lift the whole body if a sole goes under the ground the segment stands on */
    const B = this.P.bones, gy = this.root.y, lo = Math.min(B.ball_l.getWorldPosition(va).y, B.ball_r.getWorldPosition(vb).y, B.foot_l.getWorldPosition(va).y - this.P.dim.foot, B.foot_r.getWorldPosition(vb).y - this.P.dim.foot) - gy;
    if (lo < 0 && !this.seg.arc) { B.pelvis.position.y -= lo / (B.pelvis.parent.getWorldScale(va).y || 1); B.pelvis.updateMatrixWorld(true); }
    this.P.root.updateMatrixWorld(true);
    if (this.P.sword) {   // the blade sits across the fist: along index->pinky knuckles, pointing out of the thumb side
      const h = B.hand_r, i1 = B.index_01_r.getWorldPosition(new THREE.Vector3()), p1 = B.pinky_01_r.getWorldPosition(new THREE.Vector3()), m1 = B.middle_01_r.getWorldPosition(new THREE.Vector3());
      const hp = h.getWorldPosition(new THREE.Vector3()), blade = i1.clone().sub(p1).normalize(), fing = m1.clone().sub(hp).normalize();
      const up = fing.clone().sub(blade.clone().multiplyScalar(fing.dot(blade))).normalize();
      this.P.sword.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(up.clone().cross(blade), up, blade));
      this.P.sword.position.copy(hp.lerp(m1, .7)).addScaledVector(fing, .03);
      this.P.sword.updateMatrixWorld(true);
    }
  }
  /* positions for effects, from the Mixamo pose (no retarget needed) */
  point(at, p = this.cur) {
    const R = this.mo.rest, P = (k) => p.wp[R.idx[k]];
    if (at === 'tip') return P('RightHand').clone().add(P('RightHandIndex1').clone().sub(P('RightHandPinky1')).normalize().multiplyScalar(1.0));
    if (at === 'mid') return P('RightHand').clone().add(P('RightHandIndex1').clone().sub(P('RightHandPinky1')).normalize().multiplyScalar(.5));
    return P({R: 'RightHand', L: 'LeftHand', FR: 'RightToeBase', FL: 'LeftToeBase', chest: 'Spine2', head: 'Head', hips: 'Hips'}[at] || 'RightHand').clone();
  }
  show(v) { this.shown = v; this.P.root.visible = v; if (this.P.sword) this.P.sword.visible = v; this.trails.R.mesh.visible = this.trails.L.mesh.visible = v; }
}

export function makeMoCast(scene, {people, mocap, wind = [-1, 0, .3]} = {}) {
  useScene(scene);
  for (const k of ['S', 'M']) { const d = people[k].dim; people[k].dimLeg = d.thigh + d.shin; }
  const S = new MoActor('S', people.S, mocap, scene), M = new MoActor('M', people.M, mocap, scene); S.other = M; M.other = S;
  const ringGeo = new THREE.RingGeometry(.88, 1, 64), rings = []; let bursts = null;
  const fill = new THREE.SpotLight(0xdfe6ff, 0, 4, .75, .8, 2); scene.add(fill, fill.target);
  const cast = {S, M, all: [S, M], events: [], simT: -1e9, fillK: .9, fill,
    /* collect hits / landings from every segment (auto-detected in the clip unless the segment lists its own fx) */
    bake() {
      const ev = [];
      for (const A of cast.all) for (const s of A.segs) {
        const C = s.C, toT = (lt) => s.t + (lt - s.off) / s.speed, inSeg = (t) => t >= s.t && t < s.end - .02;
        const list = [];
        if (s.fx) list.push(...s.fx.map((e) => ({...e, t: s.t + e.t})));
        else if (s.hits !== false) {
          const H = C.hits, src = A.key === 'S' && /^S_/.test(C.name) ? [['tip', H.tip]] : [['R', H.R], ['L', H.L], ['FR', H.FR], ['FL', H.FL]];
          for (const [at, hs] of src) for (const h of hs) list.push({t: toT(h.t), type: 'hit', at, heavy: A.key === 'M' || h.v > 1600});
        }
        if (s.lands !== false) for (const l of C.lands) list.push({t: toT(l), type: 'land', big: s.big});
        for (const e of list) { if (!inSeg(e.t)) continue; const p = A.eval(e.t); ev.push({...e, who: A.key, p: A.point(e.at || 'R', p), ground: A.root.y, root: A.root.clone(), heavy: e.heavy ?? A.key === 'M'}); }
      }
      ev.sort((a, b) => a.t - b.t); cast.events = ev;
      const L = [], Ld = [], gold = new THREE.Color('#ffcc44');
      for (const e of ev) {
        const c1 = new THREE.Color(e.who === 'S' ? '#d2f0ff' : '#ffe08a'), c0 = new THREE.Color(e.who === 'S' ? '#6ab8ff' : '#ffcc44');
        if (e.type === 'hit') { L.push({t: e.t, p: e.p, c: c1, n: e.heavy ? 34 : 24, sp: e.heavy ? 5 : 6, life: .45, size: .045}); rings.push({t: e.t, p: e.p, c: c0, s: e.heavy ? .55 : .4, d: .28, bill: 1, o: .4}); }
        else if (e.type === 'land') { Ld.push({t: e.t, p: e.root.clone().setY(e.ground + .05), c: new THREE.Color(.2, .18, .19), n: e.big ? 22 : 8, sp: e.big ? 2.6 : 1.1, life: e.big ? 1.2 : .7, size: e.big ? .55 : .28, flat: 1, grav: -.4}); if (e.big) rings.push({t: e.t, p: e.root.clone().setY(e.ground + .04), c: gold, s: 4, d: .5, bill: 0}); }
      }
      for (const r of rings) { r.m = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({color: r.c, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false})); r.m.position.copy(r.p); if (!r.bill) r.m.rotation.x = -Math.PI / 2; r.m.visible = false; scene.add(r.m); }
      bursts = [makeBursts(L), makeBursts(Ld, false)]; cast.simT = -1e9; return ev;
    },
    kick(t) { let sh = 0, fl = 0; for (const e of cast.events) { const a = t - e.t; if (a < 0 || a > .6 || (e.type !== 'hit' && !(e.type === 'land' && e.big))) continue; sh = Math.max(sh, (e.heavy ? .06 : .04) * Math.exp(-a * 14)); if (e.type === 'hit') fl = Math.max(fl, (e.heavy ? .45 : .3) * Math.exp(-a * 16)); } return {shake: sh, flash: fl}; },
    update(t, cam) {
      /* qi trails: blade tip for the swordsman, both fists for the monk, stepped at 120 Hz from a short pre-roll */
      let fdt = t - cast.simT;
      if (!(fdt >= -1e-6 && fdt < .5)) { cast.simT = t - .4; for (const A of cast.all) A.trails.R.s.length = A.trails.L.s.length = 0; }
      while (cast.simT + 1 / 120 <= t + 1e-9) {
        cast.simT += 1 / 120;
        for (const A of cast.all) {
          const p = A.eval(cast.simT), fast = A.key === 'S' ? (A.seg.C.name.startsWith('S_') && !/idle|draw|sheath|run/.test(A.seg.C.name)) : /punch|palm|kick|uppercut/.test(A.seg.C.name);
          if (fast) {
            if (A.key === 'S') A.trails.R.add(A.point('mid', p), A.point('tip', p));
            else { for (const [k, at] of [['R', 'R'], ['L', 'L']]) { const h = A.point(at, p), e = p.wp[A.mo.rest.idx[at === 'R' ? 'RightForeArm' : 'LeftForeArm']]; A.trails[k].add(h, h.clone().lerp(e, .35)); } }
          }
          A.trails.R.decay(1 / 120); A.trails.L.decay(1 / 120);
        }
      }
      for (const A of cast.all) { A.eval(t); if (!A.shown) continue; A.apply(); A.trails.R.build(); A.trails.L.build(); }
      if (bursts) for (const b of bursts) b.uT.value = t;
      for (const r of rings) { const a = t - r.t; r.m.visible = a >= 0 && a < r.d; if (!r.m.visible) continue; const u = a / r.d, s = r.s * E.out(u); r.m.scale.set(s, s, s); r.m.material.opacity = (1 - u) * (r.o ?? .9); if (r.bill) r.m.quaternion.copy(cam.quaternion); }
      /* soft face fill on the lead nearest the camera */
      let best = null, bd = 1e9; for (const A of cast.all) { if (!A.shown) continue; const d = A.root.distanceTo(cam.position); if (d < bd) { bd = d; best = A; } }
      if (best && bd < 40) { const h = best.root.clone().setY(best.root.y + 1.45), dir = cam.position.clone().sub(h).setY(0).normalize(); fill.position.copy(h).addScaledVector(dir, 1.5).add(new THREE.Vector3(0, .5, 0)); fill.target.position.copy(h).setY(best.root.y + 1); fill.intensity = cast.fillK * 2.6; } else fill.intensity = 0;
    },
  };
  return cast;
}
