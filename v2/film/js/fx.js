import * as THREE from 'three';
import {rng, canvasTex, fbm} from './util.js';

/* All particle systems are pure functions of time (uT) so offline frames are deterministic.
   Camera-following systems wrap their seeds inside a box around uCam, so density is constant anywhere. */
const WRAP = `vec3 wrapBox(vec3 s,vec3 d){vec3 b=uCam-uBox*.5;return b+mod(s+d-b,uBox);}`;
const fogU = (scene) => ({fogColor: {value: scene.fog ? scene.fog.color : new THREE.Color()}, fogDensity: {value: scene.fog ? scene.fog.density : 0}});
const FOG = `uniform vec3 fogColor;uniform float fogDensity;vec3 fogMix(vec3 c,float z){float f=1.-exp(-fogDensity*fogDensity*z*z);return mix(c,fogColor,f);}`;

export function makeRain(scene, {count = 42000, box = [56, 30, 56], speed = 24, len = 1.1, wind = [3, 1], color = [.62, .68, .82], opacity = .28} = {}) {
  const R = rng(4), pos = new Float32Array(count * 6), end = new Float32Array(count * 2);
  for (let i = 0; i < count; i++) { const x = R() * box[0], y = R() * box[1], z = R() * box[2]; pos.set([x, y, z, x, y, z], i * 6); end[i * 2 + 1] = 1; }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('aEnd', new THREE.BufferAttribute(end, 1));
  const uni = {uT: {value: 0}, uCam: {value: new THREE.Vector3()}, uBox: {value: new THREE.Vector3(...box)}, uVel: {value: new THREE.Vector3(wind[0], -speed, wind[1])}, uLen: {value: len}, uColor: {value: new THREE.Vector3(...color)}, uOp: {value: opacity}};
  const m = new THREE.ShaderMaterial({
    uniforms: uni, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: `uniform float uT,uLen;uniform vec3 uCam,uBox,uVel;attribute float aEnd;varying float vA;${WRAP}
      void main(){vec3 w=wrapBox(position,uVel*uT);w-=normalize(uVel)*uLen*aEnd;
        vec3 r=(w-uCam)/(uBox*.5);vA=(1.-aEnd*.85)*smoothstep(1.,.55,length(r));
        gl_Position=projectionMatrix*viewMatrix*vec4(w,1.);}`,
    fragmentShader: `uniform vec3 uColor;uniform float uOp;varying float vA;void main(){gl_FragColor=vec4(uColor*uOp*vA,1.);}`,
  });
  const mesh = new THREE.LineSegments(g, m); mesh.frustumCulled = false; scene.add(mesh);
  return {mesh, update(t, cam) { uni.uT.value = t; uni.uCam.value.copy(cam.position); }};
}

/* tiny crown splashes popping on a horizontal surface at height y around the camera; mask(x,z) is done in-shader by a band */
export function makeSplashes(scene, {count = 5000, area = 36, y = .02, canal = 0, color = [.7, .75, .9]} = {}) {
  const R = rng(8), pos = new Float32Array(count * 3), ph = new Float32Array(count);
  for (let i = 0; i < count; i++) { pos[i * 3] = R() * area; pos[i * 3 + 1] = y; pos[i * 3 + 2] = R() * area; ph[i] = R(); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('aPh', new THREE.BufferAttribute(ph, 1));
  const uni = {uT: {value: 0}, uCam: {value: new THREE.Vector3()}, uBox: {value: new THREE.Vector3(area, 1, area)}, uCanal: {value: canal}, uColor: {value: new THREE.Vector3(...color)}};
  const m = new THREE.ShaderMaterial({
    uniforms: uni, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: `uniform float uT,uCanal;uniform vec3 uCam,uBox;attribute float aPh;varying float vA;${WRAP}
      void main(){vec3 w=wrapBox(position,vec3(0.));w.y=position.y;float l=fract(uT*2.3+aPh*17.);
        vA=(1.-l)*(1.-l)*step(uCanal,abs(w.z))*smoothstep(uBox.x*.5,uBox.x*.3,length(w.xz-uCam.xz));
        vec4 mv=viewMatrix*vec4(w+vec3(0.,l*.06,0.),1.);gl_Position=projectionMatrix*mv;gl_PointSize=(2.+l*9.)*300./max(-mv.z,1.);}`,
    fragmentShader: `uniform vec3 uColor;varying float vA;void main(){vec2 q=gl_PointCoord-.5;float r=length(q);float ring=smoothstep(.5,.4,r)*smoothstep(.2,.38,r);gl_FragColor=vec4(uColor*ring*vA*.5,1.);}`,
  });
  const pts = new THREE.Points(g, m); pts.frustumCulled = false; scene.add(pts);
  return {update(t, cam) { uni.uT.value = t; uni.uCam.value.copy(cam.position); }};
}

/* rising sparks from a list of sources (embers) or a slow glittering haze (gold dust) */
export function makeSparks(scene, sources, {count = 900, rise = 5, spread = .6, size = 26, life = .6, hot = [1, .45, .12], cool = [.6, .12, .02], wind = [1.2, .3], seed = 3, twinkle = 0} = {}) {
  const R = rng(seed), pos = new Float32Array(count * 3), ph = new Float32Array(count * 2);
  for (let i = 0; i < count; i++) { const s = sources[Math.floor(R() * sources.length)]; pos.set([s.x + (R() - .5) * s.r * 2, s.y, s.z + (R() - .5) * s.r * 2], i * 3); ph[i * 2] = R(); ph[i * 2 + 1] = .5 + R(); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('aPh', new THREE.BufferAttribute(ph, 2));
  const uni = {uT: {value: 0}, uRise: {value: rise}, uSpread: {value: spread}, uSize: {value: size}, uLife: {value: life}, uHot: {value: new THREE.Vector3(...hot)}, uCool: {value: new THREE.Vector3(...cool)}, uWind: {value: new THREE.Vector2(...wind)}, uTw: {value: twinkle}, uGain: {value: 1}};
  const m = new THREE.ShaderMaterial({
    uniforms: uni, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: `uniform float uT,uRise,uSpread,uSize,uLife,uTw;uniform vec2 uWind;attribute vec2 aPh;varying float vL,vTw;
      void main(){float l=fract(uT*uLife*aPh.y+aPh.x*31.);float p=aPh.x*40.;vL=l;
        vec3 w=position+vec3(sin(l*5.+p)*uSpread*l+uWind.x*l*l*2.,l*uRise*aPh.y,cos(l*4.+p)*uSpread*l+uWind.y*l*l*2.);
        vTw=mix(1.,.5+.5*sin(uT*7.+p*3.),uTw);
        vec4 mv=viewMatrix*vec4(w,1.);gl_Position=projectionMatrix*mv;gl_PointSize=uSize*(1.-l*.6)*(.6+aPh.y*.5)/max(-mv.z,.5);}`,
    fragmentShader: `uniform vec3 uHot,uCool;uniform float uGain;varying float vL,vTw;void main(){float r=length(gl_PointCoord-.5);float a=smoothstep(.5,0.,r);a*=a;
      vec3 c=mix(uHot,uCool,vL)*(1.-vL)*(vL<.06?vL/.06:1.)*vTw*uGain;gl_FragColor=vec4(c*a*3.,1.);}`,
  });
  const pts = new THREE.Points(g, m); pts.frustumCulled = false; scene.add(pts);
  return {uni, update(t) { uni.uT.value = t; }};
}

/* fluttering flat flakes (falling leaves, petals, ash) around the camera, spinning so they glint */
export function makeFlutter(scene, {count = 1400, box = [40, 22, 40], color = [.22, .28, .10], size = [.16, .045], fall = .8, drift = [.7, .2], light = 1} = {}) {
  const R = rng(12), base = new THREE.PlaneGeometry(1, 1), g = new THREE.InstancedBufferGeometry();
  g.index = base.index; g.setAttribute('position', base.attributes.position); g.setAttribute('uv', base.attributes.uv);
  const seed = new Float32Array(count * 4); for (let i = 0; i < seed.length; i++) seed[i] = R();
  g.setAttribute('aSeed', new THREE.InstancedBufferAttribute(seed, 4)); g.instanceCount = count;
  const uni = {uT: {value: 0}, uCam: {value: new THREE.Vector3()}, uBox: {value: new THREE.Vector3(...box)}, uColor: {value: new THREE.Vector3(...color)}, uSize: {value: new THREE.Vector2(...size)}, uFall: {value: fall}, uDrift: {value: new THREE.Vector2(...drift)}, uLight: {value: light}, ...fogU(scene)};
  const m = new THREE.ShaderMaterial({
    uniforms: uni, side: THREE.DoubleSide,
    vertexShader: `uniform float uT,uFall;uniform vec3 uCam,uBox;uniform vec2 uSize,uDrift;attribute vec4 aSeed;varying vec2 vUv;varying float vSh,vZ;${WRAP}
      void main(){float ph=aSeed.w*6.283;vec3 s=aSeed.xyz*uBox;
        vec3 d=vec3(uDrift.x*uT+sin(uT*.7+ph)*1.3,-uFall*(.7+aSeed.w*.6)*uT,uDrift.y*uT+cos(uT*.55+ph)*1.1);
        vec3 w=wrapBox(s,d);float a1=uT*(1.6+aSeed.w*2.5)+ph,a2=uT*(.9+aSeed.x)+ph*2.;
        vec3 p=vec3(position.x*uSize.x,position.y*uSize.y,0.);
        p=vec3(p.x,p.y*cos(a1)-p.z*sin(a1),p.y*sin(a1)+p.z*cos(a1));p=vec3(p.x*cos(a2)+p.z*sin(a2),p.y,-p.x*sin(a2)+p.z*cos(a2));
        vSh=.3+.7*pow(abs(cos(a1)),3.);vUv=uv;vec4 mv=viewMatrix*vec4(w+p,1.);vZ=-mv.z;gl_Position=projectionMatrix*mv;}`,
    fragmentShader: `uniform vec3 uColor;uniform float uLight;varying vec2 vUv;varying float vSh,vZ;${FOG}
      void main(){vec2 q=vUv-.5;if(abs(q.y)*2.>1.-pow(abs(q.x*2.),2.))discard;gl_FragColor=vec4(fogMix(uColor*vSh*uLight,vZ),1.);}`,
  });
  const mesh = new THREE.Mesh(g, m); mesh.frustumCulled = false; scene.add(mesh);
  return {mesh, uni, update(t, cam) { uni.uT.value = t; uni.uCam.value.copy(cam.position); }};
}

/* the monk's golden bell (v1 silhouette: hw(u) = W·sqrt(1-u⁴)·(1-.1·sin(uπ))): fresnel gold + hex lattice.
   uFade 1 = whole, toward 0 it dissolves cell by cell with glowing edges; uGlow brightens it at the moment of impact. */
export function makeGoldenBell(scene, {radius = 2.1, height = 3.8} = {}) {
  const prof = []; for (let i = 0; i <= 40; i++) { const u = i / 40; prof.push(new THREE.Vector2(Math.max(.001, radius * Math.sqrt(Math.max(0, 1 - u ** 4)) * (1 - .1 * Math.sin(u * Math.PI))), u * height)); }
  const uni = {uT: {value: 0}, uFade: {value: 1}, uGlow: {value: 1}, uH: {value: height}};
  const mesh = new THREE.Mesh(new THREE.LatheGeometry(prof, 64), new THREE.ShaderMaterial({
    uniforms: uni, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    vertexShader: `varying vec3 vN,vV,vP;void main(){vec4 w=modelMatrix*vec4(position,1.);vP=position;vN=normalize(mat3(modelMatrix)*normal);vV=normalize(cameraPosition-w.xyz);gl_Position=projectionMatrix*viewMatrix*w;}`,
    fragmentShader: `uniform float uT,uFade,uGlow,uH;varying vec3 vN,vV,vP;
      float hex(vec2 p){p.x*=1.1547;p.y+=mod(floor(p.x),2.)*.5;vec2 f=abs(fract(p)-.5);return smoothstep(.02,.0,abs(max(f.x*1.5+f.y,f.y*2.)-1.));}
      void main(){float fr=pow(1.-abs(dot(normalize(vN),vV)),2.2);float a=atan(vP.z,vP.x);float y=vP.y/uH*3.8;
        float hx=hex(vec2(a*4.,y*2.2));float band=smoothstep(.0,.4,sin(y*3.-uT*2.)*.5+.5);
        float nz=fract(sin(dot(floor(vec2(a*44.,y*30.)),vec2(12.9,78.2)))*43758.5);float dis=step(nz,uFade)+smoothstep(.06,0.,abs(nz-uFade))*3.;
        vec3 c=vec3(1.,.72,.25)*(fr*1.4+hx*.5*band)*min(uFade,1.)*dis*uGlow;gl_FragColor=vec4(c,1.);}`,
  }));
  scene.add(mesh);
  return {mesh, uni};
}

/* soft billowing sprites: ground mist (static drift) or smoke columns (rise, grow, fade on a cycle) */
let PUFF = null;
const puffTex = () => PUFF || (PUFF = canvasTex(256, 256, (g, w, h) => {
  const im = g.createImageData(w, h), d = im.data;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const dx = (x - w / 2) / (w / 2), dy = (y - h / 2) / (h / 2), r = Math.sqrt(dx * dx + dy * dy);
    const a = Math.max(0, 1 - r) ** 1.6 * (.45 + .75 * fbm(x / 26 + 4, y / 26 + 1, 5)), i = (y * w + x) * 4;
    d[i] = d[i + 1] = d[i + 2] = 255; d[i + 3] = Math.min(255, a * 255);
  }
  g.putImageData(im, 0, 0);
}, {repeat: false}));

export function makeMist(scene, items, {color = [.5, .55, .65], opacity = .18} = {}) {
  const out = items.map((it, i) => {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({map: puffTex(), color: new THREE.Color(...color), transparent: true, opacity, depthWrite: false, fog: true}));
    s.position.copy(it.p); s.scale.set(it.s, it.s * (it.flat ?? .35), 1); s.material.rotation = i * 1.7; s.userData = {p: it.p.clone(), i};
    scene.add(s); return s;
  });
  return {update(t) { for (const s of out) { s.position.x = s.userData.p.x + Math.sin(t * .05 + s.userData.i) * 3 + t * .25; s.material.rotation = s.userData.i * 1.7 + t * .01; } }};
}

export function makeSmoke(scene, sources, {per = 6, color = [.18, .16, .17], opacity = .3, rise = 7, period = 9, wind = [1.5, .4]} = {}) {
  const sp = [];
  sources.forEach((src, si) => { for (let k = 0; k < per; k++) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({map: puffTex(), color: new THREE.Color(...color), transparent: true, opacity: 0, depthWrite: false, fog: true}));
    s.userData = {src, ph: k / per + si * .137, rot: si + k}; scene.add(s); sp.push(s);
  } });
  return {update(t) { for (const s of sp) {
    const u = s.userData, l = (t / period + u.ph) % 1, k = u.src.k ?? 1;
    s.position.set(u.src.x + wind[0] * l * l * 4, u.src.y + l * rise * k, u.src.z + wind[1] * l * l * 4);
    const sc = (.8 + l * 4.5) * k; s.scale.set(sc, sc, 1); s.material.opacity = Math.sin(Math.PI * l) ** 1.5 * opacity; s.material.rotation = u.rot + l * .8;
  } }};
}
