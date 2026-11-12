import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {rng} from './util.js';

/* The named techniques as effects. Every system is a pure function of act time (uniforms + per-instance seeds), so any frame
   renders the same on its own; the heavy ones (ten thousand swords, a thousand palms) run entirely in the vertex shader. */

const ease = 'float ez(float x){x=clamp(x,0.,1.);return x*x*(3.-2.*x);}';
const BASIS = `mat3 basisY(vec3 d){d=normalize(d);vec3 a=abs(d.y)<.97?vec3(0.,1.,0.):vec3(1.,0.,0.);vec3 x=normalize(cross(a,d));return mat3(x,d,cross(x,d));}`;

/* a light-sword: diamond blade + guard + grip, tip along +Y, ~1 unit long */
function lightSwordGeo() {
  const blade = new THREE.CylinderGeometry(0, .045, .78, 4, 1).rotateY(Math.PI / 4).scale(1, 1, .25).translate(0, .45, 0);
  const guard = new THREE.BoxGeometry(.2, .03, .05).translate(0, .06, 0), grip = new THREE.CylinderGeometry(.018, .018, .16, 5).translate(0, -.03, 0);
  const g = mergeGeometries([blade.toNonIndexed(), guard.toNonIndexed(), grip.toNonIndexed()]);
  const c = new Float32Array(g.attributes.position.count); for (let i = 0; i < c.length; i++) c[i] = Math.max(0, g.attributes.position.getY(i)) / .84;  // 0 at hilt, 1 at tip
  g.setAttribute('aTip', new THREE.BufferAttribute(c, 1));
  return g;
}
function instanced(base, n, seeds) {
  const g = new THREE.InstancedBufferGeometry(); g.index = base.index;
  for (const k in base.attributes) g.setAttribute(k, base.attributes[k]);
  for (const [k, size, fn] of seeds) { const a = new Float32Array(n * size); for (let i = 0; i < n; i++) fn(i, a.subarray(i * size, i * size + size)); g.setAttribute(k, new THREE.InstancedBufferAttribute(a, size)); }
  g.instanceCount = n; return g;
}
/* additive glowing blade, brighter toward the edge-on view and the tip */
const SWORD_FRAG = `uniform vec3 uCol,uHot;uniform float uGain;varying float vTip,vA;varying vec3 vN,vV;
  void main(){float fr=pow(1.-abs(dot(normalize(vN),normalize(vV))),1.5);vec3 c=mix(uCol,uHot,.35+.65*fr)*(1.+vTip*.8);gl_FragColor=vec4(c*vA*uGain,1.);}`;
function swordMaterial(posGLSL, uni, col = [.45, .75, 1.3], hot = [1.6, 1.9, 2.2]) {
  Object.assign(uni, {uT: uni.uT || {value: 0}, uCol: {value: new THREE.Vector3(...col)}, uHot: {value: new THREE.Vector3(...hot)}, uGain: {value: .4}});
  return new THREE.ShaderMaterial({uniforms: uni, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    vertexShader: `uniform float uT;attribute float aTip;attribute vec4 aA,aB;varying float vTip,vA;varying vec3 vN,vV;${ease}${BASIS}
      ${posGLSL}
      void main(){float a;vec3 d;vec3 p=state(uT,a,d);vA=a;vTip=aTip;if(a<.002){gl_Position=vec4(2.,2.,2.,1.);return;}
        mat3 B=basisY(d);float s=size();vec3 w=p+B*(position*s);vN=B*normal;vV=cameraPosition-w;gl_Position=projectionMatrix*viewMatrix*vec4(w,1.);}`,
    fragmentShader: SWORD_FRAG});
}

/* ---------- 萬劍歸宗: rise from the whole city, a funnel round the tower, one colossal sword, the thrust, the shatter ---------- */
export function makeSwordStorm(scene, {n = 12000, center, cityR = 260, giantLen = 110, seed = 7} = {}) {
  const R = rng(seed), C = center.clone();
  const geo = instanced(lightSwordGeo(), n, [
    ['aA', 4, (i, a) => { const r = Math.sqrt(R()) * cityR, th = R() * 6.283; a[0] = C.x + Math.cos(th) * r; a[1] = 6 + R() * 14; a[2] = C.z + Math.sin(th) * r; a[3] = R(); }],
    /* slot on the giant blade: s along the length, (u,v) across the diamond section */
    ['aB', 4, (i, a) => { const s = Math.pow(R(), .8), w = (1 - s * .85) * (s > .96 ? (1 - s) / .04 : 1); a[0] = s; a[1] = (R() * 2 - 1) * w; a[2] = (R() * 2 - 1) * w * .22 * (1 - Math.abs(a[1]) / Math.max(w, 1e-3)); a[3] = R(); }],
  ]);
  const uni = {uT: {value: 0}, uC: {value: C}, uK: {value: new THREE.Vector4(0, 4, 9, 13)}, uS: {value: new THREE.Vector2(15, 17)}, uLen: {value: giantLen},
    uG: {value: new THREE.Matrix4()}, uFade: {value: 1}};
  const mat = swordMaterial(`uniform vec3 uC;uniform vec4 uK;uniform vec2 uS;uniform float uLen,uFade;uniform mat4 uG;
    float size(){return 1.3+aB.w*.8;}
    vec3 rise(float t){return aA.xyz+vec3(0.,ez((t-uK.x-aA.w*2.5)/2.)*(40.+aA.w*90.),0.);}
    vec3 vort(float t){float h=40.+aA.w*150.,r=18.+h*.42,ang=atan(aA.z-uC.z,aA.x-uC.x)+(t-uK.y)*(1.1-aA.w*.4)+aA.w*9.;return uC+vec3(cos(ang)*r,h,sin(ang)*r);}
    vec3 slot(){return (uG*vec4(aB.y*uLen*.09,aB.x*uLen,aB.z*uLen*.09,1.)).xyz;}
    vec3 pos(float t){vec3 p=rise(t);p=mix(p,vort(t),ez((t-uK.y-aA.w*2.)/2.5));p=mix(p,slot(),ez((t-uK.z-aB.w*2.2)/1.8));
      float sh=t-uS.y;if(sh>0.){vec3 o=normalize(slot()-uC+vec3(0.,.01,0.));p+=o*sh*(30.+aA.w*80.)+vec3(0.,-4.9*sh*sh*.3,0.);}return p;}
    vec3 state(float t,out float a,out vec3 d){vec3 p=pos(t),q=pos(t-.03);float form=ez((t-uK.z-aB.w*2.2)/1.8);
      vec3 ax=normalize((uG*vec4(0.,1.,0.,0.)).xyz);d=normalize(mix(p-q+vec3(0.,1e-3,0.),ax,form*step(t,uS.y)));
      a=ez((t-uK.x-aA.w*2.5)*2.)*uFade*(1.-ez((t-uS.y-.4-aA.w)/1.5));return p;}`, uni);
  const mesh = new THREE.Mesh(geo, mat); mesh.frustumCulled = false; scene.add(mesh);
  /* the giant blade's own glow core, so the formed sword reads as one object */
  const core = new THREE.Mesh(new THREE.CylinderGeometry(0, 1, 1, 4, 1).rotateY(Math.PI / 4).scale(1, 1, .22).translate(0, .5, 0),
    new THREE.MeshBasicMaterial({color: new THREE.Color(.5, .8, 1.4), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false}));
  core.frustumCulled = false; scene.add(core);
  return {
    mesh, uni,
    /* times: rise, vortex, form, strike start; strike hits at hit, shatters at hit */
    set({rise, vortex, form, strike, hit}) { uni.uK.value.set(rise, vortex, form, strike); uni.uS.value.set(strike, hit); },
    update(t, giantMatrix) {
      uni.uT.value = t; uni.uG.value.copy(giantMatrix);
      const k = uni.uK.value, s = uni.uS.value, on = THREE.MathUtils.smoothstep(t, k.z + 1.5, k.z + 3.5) * (1 - THREE.MathUtils.smoothstep(t, s.y, s.y + .3));
      core.matrix.copy(giantMatrix).multiply(new THREE.Matrix4().makeScale(uni.uLen.value * .09, uni.uLen.value, uni.uLen.value * .09)); core.matrixAutoUpdate = false;
      core.material.opacity = on * .55; core.visible = on > .01;
    },
  };
}

/* ---------- 劍雨: hundreds of light swords fall on an area, stick, glow and fade ---------- */
export function makeSwordRain(scene, {n = 600, at, radius = 9, ground = 0, t0 = 0, dur = 2.2, seed = 11} = {}) {
  const R = rng(seed);
  const geo = instanced(lightSwordGeo(), n, [
    ['aA', 4, (i, a) => { const r = Math.sqrt(R()) * radius, th = R() * 6.283; a[0] = at.x + Math.cos(th) * r; a[1] = ground; a[2] = at.z + Math.sin(th) * r; a[3] = R(); }],
    ['aB', 4, (i, a) => { a[0] = (R() - .5) * .5; a[1] = (R() - .5) * .5; a[2] = R(); a[3] = R(); }],
  ]);
  const uni = {uT: {value: 0}, uR: {value: new THREE.Vector2(t0, dur)}};
  const mat = swordMaterial(`uniform vec2 uR;float size(){return 1.1+aB.z*.5;}
    vec3 state(float t,out float a,out vec3 d){float t0=uR.x+aA.w*uR.y,l=t-t0;vec3 dir=normalize(vec3(aB.x,-1.,aB.y));
      vec3 hitp=aA.xyz-dir*(.35+aB.w*.3);vec3 p=hitp-dir*max(0.,-l)*60.;d=dir;
      a=smoothstep(-.6,-.2,l)*(1.-smoothstep(1.,3.5,l))*(1.+2.5*exp(-max(l,0.)*12.)*step(0.,l));return p;}`, uni);
  const mesh = new THREE.Mesh(geo, mat); mesh.frustumCulled = false; scene.add(mesh);
  return {mesh, uni, update(t) { uni.uT.value = t; }};
}

/* ---------- 九霄劍陣: a peacock fan of swords appears behind the swordsman, then they fire one after another at the target ---------- */
export function makeSwordFan(scene, {n = 48, seed = 13} = {}) {
  const R = rng(seed);
  const geo = instanced(lightSwordGeo(), n, [
    ['aA', 4, (i, a) => { const k = i / (n - 1); a[0] = (k - .5) * 2.6; a[1] = i % 2 ? 1 : 1.6; a[2] = k; a[3] = R(); }],
    ['aB', 4, (i, a) => { a[0] = R(); a[1] = R(); a[2] = R(); a[3] = R(); }],
  ]);
  const uni = {uT: {value: 0}, uO: {value: new THREE.Vector3()}, uYaw: {value: 0}, uTgt: {value: new THREE.Vector3()}, uK: {value: new THREE.Vector3(0, 1.2, 2.5)}};
  const mat = swordMaterial(`uniform vec3 uO,uTgt,uK;uniform float uYaw;float size(){return 1.;}
    vec3 slot(){float ang=aA.x;float r=aA.y*1.4;vec3 l=vec3(sin(ang)*r,1.5+cos(ang)*r,-.6);float c=cos(uYaw),s=sin(uYaw);return uO+vec3(l.x*c+l.z*s,l.y,-l.x*s+l.z*c);}
    vec3 state(float t,out float a,out vec3 d){float tl=uK.y+aA.z*uK.z*.6;vec3 sp=slot();vec3 p=sp;
      float l=t-tl;vec3 to=uTgt+vec3(aB.x-.5,aB.y-.5,aB.z-.5)*1.2;vec3 dir=normalize(to-sp);
      if(l>0.){p=sp+dir*min(l*45.,length(to-sp));}d=l>0.?dir:normalize(sp-(uO+vec3(0.,1.5,0.)));
      a=ez((t-uK.x-aA.z*.5)/.3)*(l>0.?(1.-step(length(to-sp),l*45.)):1.);return p;}`, uni);
  const mesh = new THREE.Mesh(geo, mat); mesh.frustumCulled = false; scene.add(mesh);
  return {mesh, uni, set(appear, fire, span) { uni.uK.value.set(appear, fire, span); },
    update(t, origin, yaw, target) { uni.uT.value = t; uni.uO.value.copy(origin); uni.uYaw.value = yaw; uni.uTgt.value.copy(target); }};
}

/* ---------- textures for the Shaolin effects ---------- */
function canvas(w, h, draw) { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; }
/* an open palm (or a four-taloned claw) seen from the front, drawn as a glowing outline with a soft fill */
export function handTex(claw = false) {
  return canvas(256, 256, (g) => {
    g.translate(128, 150); g.lineCap = 'round'; g.lineJoin = 'round';
    const shape = () => {
      g.beginPath(); g.ellipse(0, 20, 52, 58, 0, 0, Math.PI * 2);
      const fingers = [[-38, -30, -.32, 70], [-14, -48, -.1, 86], [12, -50, .06, 90], [36, -40, .22, 78]];
      for (const [x, y, a, L] of fingers) { g.moveTo(x, y); g.lineTo(x + Math.sin(a) * L, y - Math.cos(a) * L); }
      g.moveTo(-46, 30); g.lineTo(-92, -10);
    };
    for (const [w, al] of [[34, .12], [22, .35], [10, .9]]) { g.strokeStyle = `rgba(255,220,140,${al})`; g.lineWidth = w; shape(); g.stroke(); }
    g.fillStyle = 'rgba(255,200,110,.25)'; g.beginPath(); g.ellipse(0, 20, 50, 56, 0, 0, Math.PI * 2); g.fill();
    if (claw) for (const [x, y, a, L] of [[-38, -30, -.32, 70], [-14, -48, -.1, 86], [12, -50, .06, 90], [36, -40, .22, 78], [-46, 30, -1.2, 50]]) {
      const tx = x + Math.sin(a) * L, ty = y - Math.cos(a) * L; g.strokeStyle = 'rgba(255,240,200,.95)'; g.lineWidth = 6;
      g.beginPath(); g.moveTo(tx, ty); g.quadraticCurveTo(tx + Math.sin(a + .9) * 18, ty - Math.cos(a + .9) * 18, tx + Math.sin(a + 1.8) * 26, ty - Math.cos(a + 1.8) * 22); g.stroke();
    }
  });
}
/* a ring of sutra-like glyph strokes for 般若掌 / 獅子吼 */
export function glyphRingTex(seed = 3) {
  const R = rng(seed);
  return canvas(512, 512, (g) => {
    g.translate(256, 256);
    for (const [r, w, al] of [[238, 10, .9], [200, 4, .6], [130, 3, .5]]) { g.strokeStyle = `rgba(255,215,130,${al})`; g.lineWidth = w; g.beginPath(); g.arc(0, 0, r, 0, Math.PI * 2); g.stroke(); }
    for (let k = 0; k < 36; k++) {
      g.save(); g.rotate(k / 36 * Math.PI * 2); g.translate(0, -219); g.strokeStyle = 'rgba(255,230,170,.95)'; g.lineWidth = 3;
      for (let s = 0; s < 4; s++) { g.beginPath(); const x = (R() - .5) * 18, y = (R() - .5) * 18; g.moveTo(x, y); g.lineTo(x + (R() - .5) * 20, y + (R() - .5) * 20); g.stroke(); }
      g.restore();
    }
    const gr = g.createRadialGradient(0, 0, 100, 0, 0, 250); gr.addColorStop(0, 'rgba(255,200,100,0)'); gr.addColorStop(.85, 'rgba(255,200,100,.18)'); gr.addColorStop(1, 'rgba(255,200,100,0)');
    g.fillStyle = gr; g.fillRect(-256, -256, 512, 512);
  });
}
/* a crescent of sword qi */
function crescentTex() {
  return canvas(512, 256, (g) => {
    const gr = g.createLinearGradient(0, 0, 512, 0); gr.addColorStop(0, 'rgba(120,190,255,0)'); gr.addColorStop(.5, 'rgba(210,240,255,1)'); gr.addColorStop(1, 'rgba(120,190,255,0)');
    g.fillStyle = gr; g.beginPath(); g.moveTo(0, 200); g.quadraticCurveTo(256, -60, 512, 200); g.quadraticCurveTo(256, 40, 0, 200); g.fill();
    g.globalCompositeOperation = 'lighter'; g.strokeStyle = 'rgba(255,255,255,.9)'; g.lineWidth = 4; g.beginPath(); g.moveTo(40, 190); g.quadraticCurveTo(256, -40, 472, 190); g.stroke();
  });
}

/* ---------- event-driven flat effects: palm prints, claws, crescents, glyph rings, finger beams ----------
   list items: {t, kind:'palm'|'claw'|'crescent'|'ring'|'beam', p:[x,y,z] start, dir:[x,y,z], up:[x,y,z], size, dur, dist, to:[x,y,z] (beam end)} */
export function makeStrikes(scene, list) {
  const tex = {palm: handTex(false), claw: handTex(true), crescent: crescentTex(), ring: glyphRingTex()};
  const V = (a) => (a && a.isVector3 ? a.clone() : new THREE.Vector3(...(a || [0, 0, 0])));
  const items = list.map((e) => {
    const o = {...e, p: V(e.p), dir: V(e.dir || [0, 0, 1]).normalize(), up: V(e.up || [0, 1, 0]).normalize(), size: e.size || 1.5, dur: e.dur || .6, dist: e.dist ?? 8};
    if (e.kind === 'beam') {
      o.to = V(e.to); const L = o.p.distanceTo(o.to);
      o.m = new THREE.Mesh(new THREE.CylinderGeometry(.03, .03, L, 8, 1, true).translate(0, L / 2, 0), new THREE.MeshBasicMaterial({color: new THREE.Color(2.2, 1.8, 1.0), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false}));
      o.glow = new THREE.Mesh(new THREE.CylinderGeometry(.16, .16, L, 12, 1, true).translate(0, L / 2, 0), new THREE.MeshBasicMaterial({color: new THREE.Color(1, .6, .2), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide}));
      o.m.add(o.glow); o.m.position.copy(o.p); o.m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), o.to.clone().sub(o.p).normalize());
    } else {
      o.m = new THREE.Mesh(new THREE.PlaneGeometry(1, e.kind === 'crescent' ? .5 : 1), new THREE.MeshBasicMaterial({map: tex[e.kind], color: new THREE.Color(...(e.color || (e.kind === 'crescent' ? [1.4, 1.6, 2] : [2, 1.6, .9]))),
        transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide}));
      /* face along dir (palms and rings), crescents lie in the plane spanned by dir and up */
      const z = e.kind === 'crescent' ? o.up.clone().cross(o.dir).normalize() : o.dir.clone(), y = e.kind === 'crescent' ? o.dir.clone().negate() : o.up.clone().sub(o.dir.clone().multiplyScalar(o.up.dot(o.dir))).normalize();
      o.m.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(y.clone().cross(z), y, z));
    }
    o.m.visible = false; o.m.frustumCulled = false; scene.add(o.m); return o;
  });
  return {
    items,
    update(t) {
      for (const o of items) {
        const a = (t - o.t) / o.dur; o.m.visible = a >= 0 && a <= 1; if (!o.m.visible) continue;
        if (o.kind === 'beam') { const k = Math.sin(Math.PI * Math.min(1, a * 1.3)); o.m.material.opacity = k; o.glow.material.opacity = k * .5; o.m.scale.set(1 + 2 * (1 - a), Math.min(1, a * 6), 1 + 2 * (1 - a)); continue; }
        const grow = o.kind === 'ring' ? .3 + a * 3.2 : .7 + a * .9, s = o.size * grow;
        o.m.scale.set(s, s, s); o.m.position.copy(o.p).addScaledVector(o.dir, o.dist * (1 - Math.pow(1 - a, 2)));
        o.m.material.opacity = Math.min(1, a * 8) * (1 - a) * (1 - a) * 1.6;
      }
    },
  };
}

/* ---------- 千手如來掌: a halo of a thousand golden hands blooms behind the monk, then they fly at the target in waves ---------- */
export function makeThousandHands(scene, {n = 1000, seed = 21} = {}) {
  const R = rng(seed), base = new THREE.PlaneGeometry(1, 1);
  const g = new THREE.InstancedBufferGeometry(); g.index = base.index; g.setAttribute('position', base.attributes.position); g.setAttribute('uv', base.attributes.uv);
  const A = new Float32Array(n * 4); for (let i = 0; i < n; i++) { const ring = Math.floor(Math.sqrt(R()) * 6), th = R() * Math.PI * 1.15 - Math.PI * .575; A.set([th, 2 + ring * 1.6 + R() * .8, R(), R()], i * 4); }
  g.setAttribute('aA', new THREE.InstancedBufferAttribute(A, 4)); g.instanceCount = n;
  const uni = {uT: {value: 0}, uO: {value: new THREE.Vector3()}, uYaw: {value: 0}, uTgt: {value: new THREE.Vector3()}, uK: {value: new THREE.Vector4(0, 1.5, 3, 1.4)}, uMap: {value: handTex(false)}};
  const mat = new THREE.ShaderMaterial({uniforms: uni, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    vertexShader: `uniform float uT,uYaw;uniform vec3 uO,uTgt;uniform vec4 uK;attribute vec4 aA;varying vec2 vUv;varying float vA;${ease}
      void main(){vUv=uv;float c=cos(uYaw),s=sin(uYaw);
        vec3 l=vec3(sin(aA.x)*aA.y,1.6+cos(aA.x)*aA.y*.85,-1.2-aA.y*.15);vec3 slot=uO+vec3(l.x*c+l.z*s,l.y,-l.x*s+l.z*c);
        float bloom=ez((uT-uK.x-aA.y*.12)/.6);float tf=uK.z+aA.z*uK.w;float f=max(0.,uT-tf);vec3 to=uTgt+vec3(aA.z-.5,aA.w-.5,aA.z-aA.w)*3.;
        vec3 p=mix(uO+vec3(0.,1.6,0.),slot,bloom);p=mix(p,to,ez(f/.5));
        vA=bloom*(1.-ez((f-.45)/.25))*(.6+.4*sin(uT*9.+aA.w*20.));float dc=length((viewMatrix*vec4(p,1.)).xyz);vA*=smoothstep(1.5,5.,dc);
        vec3 fwd=normalize(vec3(s,0.,c));vec3 rt=normalize(cross(vec3(0.,1.,0.),fwd));float sz=.7+aA.y*.06;
        vec3 w=p+rt*position.x*sz+vec3(0.,1.,0.)*position.y*sz;gl_Position=projectionMatrix*viewMatrix*vec4(w,1.);}`,
    fragmentShader: `uniform sampler2D uMap;varying vec2 vUv;varying float vA;void main(){vec4 m=texture2D(uMap,vUv);gl_FragColor=vec4(vec3(2.,1.5,.75)*m.a*vA*.3,1.);}`});
  const mesh = new THREE.Mesh(g, mat); mesh.frustumCulled = false; scene.add(mesh);
  return {mesh, uni, set(bloom, fire, spread) { uni.uK.value.set(bloom, 0, fire, spread); },
    update(t, origin, yaw, target) { uni.uT.value = t; uni.uO.value.copy(origin); uni.uYaw.value = yaw; uni.uTgt.value.copy(target); }};
}
