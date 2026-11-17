import * as THREE from 'three';
import {ramp, ease} from './cam.js';

/* The fight director: a list of beats -> both leads' motion tracks and a matching shot list.
   beat = {d, S, M, shot, gap, move, slow, vo, whip, fov, ...}
     d     action seconds of the beat
     S, M  clip name or {clip, speed, off, inPlace:false, step} (step: metres this actor moves along the fight axis during the beat)
     shot  camera: wide medium low overS overM closeS closeM overhead orbit crane pov dutch track
     gap   distance between the two at the end of the beat (default: previous)
     move  how far the pair's midpoint travels along the axis during the beat
     slow  slow-motion factor for the middle of the beat (e.g. .25), ramped in and out
     vo    voice line ids spoken at the start of the beat (or [[id, offset]])
   Cameras are computed live from where the two actually are, so they stay framed whatever the clips do.
   Action time and film time differ in slow-motion beats; toFilm() maps one to the other for sound. */
export function direct(cast, {t0 = 0, film0 = 0, center, yaw = 0, gfn = () => 0, gap = 1.5, beats, side, lift = 0}) {
  const ax = new THREE.Vector3(Math.sin(yaw), 0, Math.cos(yaw)), nx = new THREE.Vector3(ax.z, 0, -ax.x);
  let G = gfn;
  const at = (c, d) => { const p = c.clone().addScaledVector(ax, d); p.y = G(p.x, p.z); return p; };
  let C = center.clone(), g = gap, t = t0, f = film0;
  const segS = [], segM = [], shots = [], map = [], out = [];
  beats.forEach((b, i) => {
    if (b.gfn) G = b.gfn;
    if (b.place) { C = b.place.clone(); C.y = G(C.x, C.z); }   // jump to a new spot (a cut to another part of the set)
    const C1 = b.dest ? b.dest.clone() : C.clone().addScaledVector(ax, b.move || 0), g1 = b.gap ?? g;
    const spec = (x) => (typeof x === 'string' ? {clip: x} : x);
    for (const [who, segs, sgn] of [['S', segS, -1], ['M', segM, 1]]) {
      const s = spec(b[who]); if (!s) continue;
      const from = at(C, sgn * g / 2), G0 = G; if (b.gfnTo) G = b.gfnTo; const to = at(C1, sgn * g1 / 2 + (s.step || 0) * -sgn); G = G0;
      segs.push({t, clip: s.clip, at: segs.length && !b.place ? undefined : from, to, move: b.d, face: s.face ?? 1, yaw: s.yaw, speed: s.speed || 1, off: s.off || 0, inPlace: s.inPlace ?? true, gfn: s.air ? undefined : G, arc: s.arc, blend: s.blend ?? .18, fx: s.fx, hits: s.hits, big: s.big, loop: s.loop, lands: s.lands, ease: s.ease || 'io'});
    }
    /* film time: slow-motion beats stretch */
    let fd = b.d, tm = null;
    if (b.slow) {
      const sp = b.slow, mk = (D) => ramp([[0, 1], [D * .18, sp], [D * .82, sp], [D, 1]]);
      let D = b.d / sp; for (let k = 0; k < 30; k++) { const got = mk(D)(D); D *= b.d / got; }
      fd = D; tm = mk(D);
    }
    const B = {i, t, d: b.d, f, fd, C: C.clone(), C1: C1.clone(), b};
    map.push(B); out.push(B);
    shots.push(makeShot(cast, b, B, ax, nx, tm, side, lift));
    if (b.gfnTo) G = b.gfnTo;
    C = C1; g = g1; t += b.d; f += fd;
  });
  cast.S.track(segS); cast.M.track(segM);
  const toFilm = (ta) => { for (const B of map) if (ta < B.t + B.d + 1e-9) { if (!B.b.slow) return B.f + (ta - B.t); const tm = shots[B.i].time; let lo = 0, hi = B.fd; for (let k = 0; k < 30; k++) { const m = (lo + hi) / 2; if (tm(m) < ta - B.t) lo = m; else hi = m; } return B.f + lo; } const L = map[map.length - 1]; return L.f + L.fd + (ta - L.t - L.d); };
  const vo = []; for (const B of out) for (const v of B.b.vo || []) { const [id, o] = Array.isArray(v) ? v : [v, .1]; vo.push({type: 'vo', id, t: B.f + o}); }
  return {shots, beats: out, toFilm, vo, end: t, filmEnd: f, ax, nx};
}

/* ---------- live cameras ---------- */
function makeShot(cast, b, B, ax, nx, tm, side0, lift) {
  const kind = b.shot || 'medium', side = b.side ?? side0 ?? (B.i % 2 ? -1 : 1), dur = B.fd;
  const S = cast.S, M = cast.M, v = new THREE.Vector3(), mid = (st) => S.basePos(st).add(M.basePos(st)).multiplyScalar(.5);
  const head = (A, st) => A.basePos(st).add(new THREE.Vector3(0, 1.6, 0));
  const N = nx.clone().multiplyScalar(side), up = new THREE.Vector3(0, 1, 0);
  const cam = b.cam ? (lt, c, st) => b.cam(lt, c, st, dur) : (lt, c, st) => {
    const u = Math.min(1, lt / dur), m = mid(st), sep = Math.max(1.5, S.basePos(st).distanceTo(M.basePos(st)));
    let pos, look = m.clone().setY(m.y + 1.05), fov = b.fov || 36;
    switch (kind) {
      case 'wide': pos = m.clone().addScaledVector(N, sep * 1.6 + 7).addScaledVector(ax, (u - .5) * 3).setY(m.y + 2.6); fov = b.fov || 34; break;
      case 'medium': pos = m.clone().addScaledVector(N, sep * .9 + 2.8 - u * .5).addScaledVector(ax, side * .6).setY(m.y + 1.45); break;
      case 'low': pos = m.clone().addScaledVector(N, sep * .7 + 2.6).setY(m.y + .32); look.y = m.y + 1.5; fov = b.fov || 44; break;
      case 'overS': { const a = S.basePos(st), o = head(M, st); pos = a.clone().addScaledVector(ax, -1.3).addScaledVector(N, .55).setY(a.y + 1.75); look = o.setY(o.y - .2); fov = b.fov || 40; break; }
      case 'overM': { const a = M.basePos(st), o = head(S, st); pos = a.clone().addScaledVector(ax, 1.3).addScaledVector(N, .55).setY(a.y + 1.75); look = o.setY(o.y - .2); fov = b.fov || 40; break; }
      case 'closeS': case 'closeM': { const A = kind === 'closeS' ? S : M, o = kind === 'closeS' ? M : S, h = head(A, st), dir = o.basePos(st).sub(A.basePos(st)).setY(0).normalize();
        pos = h.clone().addScaledVector(dir, .95).addScaledVector(N, 1.35).add(v.set(0, .08, 0)); look = h.clone().add(v.set(0, -.12, 0)); fov = b.fov || 28 - u * 3; break; }
      case 'overhead': pos = m.clone().setY(m.y + 9 - u * 2.5); c.up.set(ax.x, 0, ax.z).applyAxisAngle(up, u * .5); look = m; fov = b.fov || 48; break;
      case 'orbit': { const a0 = b.a0 ?? 0, a = a0 + (b.sweep ?? 1.4) * ease(u), r = sep * .6 + 3; pos = m.clone().addScaledVector(N, Math.cos(a) * r).addScaledVector(ax, Math.sin(a) * r).setY(m.y + 1.3); break; }
      case 'crane': pos = m.clone().addScaledVector(N, sep + 4 + u * 4).setY(m.y + .6 + ease(u) * 7); look.y = m.y + 1 + u * .5; fov = b.fov || 40; break;
      case 'pov': { const A = b.from === 'M' ? M : S, o = A === S ? M : S, h = head(A, st); pos = h.clone().addScaledVector(o.basePos(st).sub(A.basePos(st)).setY(0).normalize(), .25); look = head(o, st).setY(head(o, st).y - .3); fov = b.fov || 50; break; }
      case 'dutch': pos = m.clone().addScaledVector(N, sep * .8 + 2.4).addScaledVector(ax, -side * 1.2).setY(m.y + 1.1); fov = b.fov || 34; break;
      case 'track': pos = m.clone().addScaledVector(N, sep * .8 + 4).setY(m.y + 1.6); fov = b.fov || 38; break;
      default: pos = m.clone().addScaledVector(N, 4).setY(m.y + 1.5);
    }
    if (lift && !/close|pov|overhead|over/.test(kind)) pos.y += lift;
    if (b.shake) { pos.x += Math.sin(lt * 23) * b.shake; pos.y += Math.sin(lt * 31 + 1) * b.shake * .7; }
    c.position.copy(pos); c.lookAt(look);
    if (kind === 'dutch') c.rotateZ(side * .18);
    if (b.crash) { const k = Math.min(1, Math.max(0, (lt - b.crash) / .18)); fov = fov + (fov * .45 - fov) * (1 - Math.pow(1 - k, 3)); }
    c.fov = fov;
  };
  const shot = {name: `${kind}${B.i}`, dur, t0: B.t, cam};
  if (tm) shot.time = tm;
  if (b.whip) { const d = .22, dir = b.whip; const base = shot.cam;
    shot.cam = (lt, c, st) => { base(lt, c, st); const ko = Math.max(0, (lt - (dur - d)) / d); c.rotateY(-dir * .9 * ko * ko); };
    shot.whip = (lt, vv) => { const ko = Math.max(0, (lt - (dur - d)) / d); vv.set(dir * .14 * ko * ko, 0); }; }
  if (b.whipIn) { const d = .22, dir = b.whipIn, base = shot.cam, bw = shot.whip;
    shot.cam = (lt, c, st) => { base(lt, c, st); const ki = Math.max(0, 1 - lt / d); c.rotateY(dir * .9 * ki * ki); };
    shot.whip = (lt, vv) => { bw?.(lt, vv); const ki = Math.max(0, 1 - lt / d); if (ki > 0) vv.set(dir * .14 * ki * ki, 0); }; }
  return shot;
}

/* ---------- a whole fight on one set: load the leads and their clips, direct the beats, wire the techniques ----------
   beat.sk = [{kind, at (action s into the beat), ...}] with kind:
     rain (劍雨 on the monk)  bell (金鐘罩 on the monk)  palm / claw / ring (from the monk at the swordsman)
     beam (一指禪)  crescent (劍氣 from the swordsman)  fan (九霄劍陣)  hands (千手如來掌)  flash (驚鴻一閃: white frame) */
export async function stageFight({scene, grade}, {beats, center, yaw = 0, gfn = () => 0, t0 = 0, film0 = 0, wind, extraClips = [], gap, side, lift}) {
  const {loadPeople} = await import('./people.js');
  const {loadMocap, makeMoCast} = await import('./mocap.js');
  const {makeSwordRain, makeSwordFan, makeStrikes, makeThousandHands} = await import('./skills.js');
  const {makeGoldenBell} = await import('./fx.js');
  const names = [...new Set(beats.flatMap((b) => [b.S, b.M].filter(Boolean).map((x) => (typeof x === 'string' ? x : x.clip))).concat(extraClips))];
  const mocap = await loadMocap(names);
  const cast = makeMoCast(scene, {people: await loadPeople(), mocap, wind});
  const D = direct(cast, {t0, film0, center, yaw, gfn, beats, gap, side, lift});
  cast.bake();

  /* techniques */
  const strikes = [], rains = [], bells = [], fans = [], hands = [], flashes = [], skillEv = [];
  const head = (A, t) => A.basePos(t).add(new THREE.Vector3(0, 1.45, 0));
  for (const B of D.beats) for (const k of B.b.sk || []) {
    const t = B.t + (k.at || 0), sp = head(cast.S, t), mp = head(cast.M, t), toM = mp.clone().sub(sp).normalize(), toS = toM.clone().negate();
    skillEv.push({type: 'skill', kind: k.kind, t: D.toFilm(t)});
    switch (k.kind) {
      case 'rain': rains.push(makeSwordRain(scene, {n: k.n || 420, at: cast.M.basePos(t + .8), radius: k.r || 5, ground: cast.M.basePos(t).y, t0: t, dur: k.dur || 1.6, seed: rains.length + 11})); break;
      case 'bell': { const g = makeGoldenBell(scene, {radius: 1.35, height: 2.6}); g.mesh.position.copy(cast.M.basePos(t)); bells.push({g, t, d: k.d || 1.6, follow: true}); break; }
      case 'palm': case 'claw': case 'ring': strikes.push({t, kind: k.kind, p: mp.clone().addScaledVector(toS, .5), dir: toS, size: k.size || (k.kind === 'ring' ? 1.2 : 1.6), dur: k.dur || .55, dist: k.dist ?? 2.5}); break;
      case 'beam': strikes.push({t, kind: 'beam', p: mp.clone().addScaledVector(toS, .4).add(new THREE.Vector3(0, -.05, 0)), to: sp.clone().add(new THREE.Vector3((Math.random() - .5) * .6, (Math.random() - .5) * .5, 0)), dur: k.dur || .35}); break;
      case 'crescent': strikes.push({t, kind: 'crescent', p: sp.clone().addScaledVector(toM, .7).add(new THREE.Vector3(0, k.dy || 0, 0)), dir: toM, up: k.up || [toM.z, .4, -toM.x], size: k.size || 2.6, dur: k.dur || .45, dist: k.dist ?? 5}); break;
      case 'fan': { const f = makeSwordFan(scene, {n: k.n || 36}); f.set(t, t + (k.fire || 1.2), k.span || 1.6); fans.push(f); break; }
      case 'hands': { const h = makeThousandHands(scene, {n: k.n || 600}); h.set(t, t + (k.fire || 1.4), k.spread || 1.2); hands.push(h); break; }
      case 'flash': flashes.push(t); break;
    }
  }
  const st = makeStrikes(scene, strikes);
  const events = cast.events.map((e) => ({...e, t: D.toFilm(e.t)})).concat(D.vo, skillEv).sort((a, b) => a.t - b.t);
  return {cast, D, events, shots: D.shots,
    update(t, cam) {
      cast.update(t, cam); st.update(t);
      for (const r of rains) r.update(t);
      for (const f of fans) f.update(t, cast.S.root, cast.S.yaw, head(cast.M, t));
      for (const h of hands) h.update(t, cast.M.root, cast.M.yaw, head(cast.S, t));
      for (const b of bells) { const a = (t - b.t) / b.d, on = a > -.05 && a < 1; b.g.mesh.visible = on; if (!on) continue; if (b.follow) b.g.mesh.position.copy(cast.M.root);
        b.g.uni.uT.value = t; b.g.uni.uFade.value = Math.min(1, a * 6) * (1 - Math.max(0, (a - .7) / .3)); b.g.uni.uGlow.value = .5 + 1.5 * Math.exp(-Math.max(0, a) * 6); }
      const k = cast.kick(t); let fl = k.flash * .3; for (const f of flashes) { const a = t - f; if (a >= 0 && a < .5) fl = Math.max(fl, a < 1 / 30 ? 1 : .8 * Math.exp(-a * 9)); }
      grade.uniforms.uFlash.value = fl; cam.position.x += Math.sin(t * 91) * k.shake; cam.position.y += Math.sin(t * 73) * k.shake;
    }};
}
