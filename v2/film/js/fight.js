import * as THREE from 'three';

/* Choreography helpers shared by the acts. */

/* a string of moves played back to back: [[pose, dur, {to, arc, face, ...}], ...] from act time t0 */
export function seq(t0, at, moves, base = {}) {
  const out = []; let t = t0;
  for (const [pose, dur, o = {}] of moves) { out.push({...base, t, pose, at: out.length ? undefined : at, ...o}); t += dur; }
  return out;
}

/* follow a moving point: fn(t) -> [x,y,z]; cut into short segments of one looping pose with an unbroken stride phase */
export function along(t0, t1, fn, pose, {step = .2, yaw, face, speed = 1} = {}) {
  const out = [];
  for (let t = t0; t < t1 - 1e-6; t += step) {
    const te = Math.min(t1, t + step);
    out.push({t, pose, at: fn(t), to: fn(te), move: te - t, off: (t - t0) * speed, speed, blend: out.length ? 0 : .2, yaw: yaw ? yaw(t) : undefined, yawTo: yaw ? yaw(te) : undefined, face});
  }
  return out;
}

/* height of walkable surfaces along a line (roofs, a bridge deck, a floor): raycasts straight down onto the meshes that pass `keep`,
   using only the triangles inside a strip around the line so it stays fast on merged city geometry */
export function probe(scene, keep, a, b, {step = .25, width = 1, top = 200} = {}) {
  const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b), d = B.clone().sub(A), L = d.length(); d.normalize();
  const n = new THREE.Vector3(-d.z, 0, d.x), tri = [];
  const near = (x, z) => { const px = x - A.x, pz = z - A.z, u = px * d.x + pz * d.z, w = Math.abs(px * n.x + pz * n.z); return w < width + 1 && u > -2 && u < L + 2; };
  scene.traverse((o) => {
    if (!o.isMesh || o.isInstancedMesh || o.isSkinnedMesh || !keep(o)) return;
    const p = o.geometry.attributes.position, ix = o.geometry.index, cnt = ix ? ix.count : p.count; o.updateMatrixWorld();
    const v = new THREE.Vector3();
    for (let k = 0; k < cnt; k += 3) {
      const id = [0, 1, 2].map((j) => ix ? ix.getX(k + j) : k + j), vs = id.map((i) => v.fromBufferAttribute(p, i).applyMatrix4(o.matrixWorld).clone());
      if (vs.some((q) => near(q.x, q.z)) && Math.max(...vs.map((q) => q.y)) < top) for (const q of vs) tri.push(q.x, q.y, q.z);
    }
  });
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(tri, 3));
  const mesh = new THREE.Mesh(g, new THREE.MeshBasicMaterial({side: THREE.DoubleSide})), rc = new THREE.Raycaster(), dn = new THREE.Vector3(0, -1, 0), h = [];
  for (let s = 0; s <= L + 1e-6; s += step) { const p = A.clone().addScaledVector(d, s); rc.set(p.setY(top), dn); const hit = rc.intersectObject(mesh, false)[0]; h.push(hit ? hit.point.y : 0); }
  g.dispose();
  /* height at any point near the line: interpolate along its projection */
  return (x, z) => { const u = Math.max(0, Math.min(L, (x - A.x) * d.x + (z - A.z) * d.z)) / step, i = Math.min(h.length - 2, Math.floor(u)), f = u - i; return h[i] * (1 - f) + h[i + 1] * f; };
}
