import * as THREE from 'three';
import {canvasTex, fbm, rng} from './util.js';

const GLSL_NOISE = `
float h31(vec3 p){p=fract(p*.3183099+.1);p*=17.;return fract(p.x*p.y*p.z*(p.x+p.y+p.z));}
float n3(vec3 x){vec3 i=floor(x),f=fract(x);f=f*f*(3.-2.*f);
 return mix(mix(mix(h31(i),h31(i+vec3(1,0,0)),f.x),mix(h31(i+vec3(0,1,0)),h31(i+vec3(1,1,0)),f.x),f.y),
            mix(mix(h31(i+vec3(0,0,1)),h31(i+vec3(1,0,1)),f.x),mix(h31(i+vec3(0,1,1)),h31(i+vec3(1,1,1)),f.x),f.y),f.z);}
float fb(vec3 p){float s=0.,a=.5;for(int i=0;i<5;i++){s+=a*n3(p);p*=2.03;a*=.5;}return s;}`;

export const HOR = [.042, .030, .080];

/* Night sky dome: gradient, hashed stars with twinkle, Milky Way band with dust lanes, moon glow.
   uDusk adds a warm afterglow toward uSun, uOver closes the sky with rain cloud, uFlash is lightning. */
export function buildSky(scene, moonDir, {hor = HOR, dusk = 0, overcast = 0, sun = new THREE.Vector3(-.8, .05, .5)} = {}) {
  const uni = {uMoon: {value: moonDir.clone()}, uT: {value: 0}, uHor: {value: new THREE.Vector3(...hor)}, uSun: {value: sun.clone().normalize()}, uDusk: {value: dusk}, uOver: {value: overcast}, uFlash: {value: 0}, uStar: {value: 1}};
  const dome = new THREE.Mesh(new THREE.SphereGeometry(1500, 64, 32), new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false, uniforms: uni,
    vertexShader: `varying vec3 vD;void main(){vD=normalize(position);vec4 p=projectionMatrix*modelViewMatrix*vec4(position,1.);gl_Position=p.xyww;}`,
    fragmentShader: `uniform vec3 uMoon,uHor,uSun;uniform float uT,uDusk,uOver,uFlash,uStar;varying vec3 vD;${GLSL_NOISE}
    void main(){vec3 d=normalize(vD);float e=d.y;
      vec3 top=vec3(.004,.005,.02),mid=vec3(.018,.016,.05);
      vec3 c=mix(uHor,mid,smoothstep(-.02,.18,e));c=mix(c,top,smoothstep(.18,.7,e));
      float vis=(1.-uDusk*.85)*(1.-uOver)*uStar;
      vec3 n=normalize(vec3(.35,.8,.48));float bd=dot(d,n);float band=exp(-bd*bd*14.);
      float m=fb(d*7.);float lanes=smoothstep(.5,.72,fb(d*16.+4.));
      c+=vec3(.16,.15,.24)*band*m*(1.-lanes*.75)*smoothstep(-.05,.2,e)*vis;
      c+=vec3(.30,.26,.34)*pow(band,6.)*m*.8*smoothstep(0.,.25,e)*vis;
      vec3 p=d*520.;vec3 ci=floor(p);float hs=h31(ci);
      if(hs>.985){vec3 o=vec3(h31(ci+1.),h31(ci+2.),h31(ci+3.))-.5;float dd=length(fract(p)-.5-o*.6);
        float s=smoothstep(.16,0.,dd)*(hs-.985)/.015;float tw=.75+.25*sin(uT*(2.+hs*9.)+hs*80.);
        vec3 sc=mix(vec3(.75,.85,1.),vec3(1.,.85,.7),h31(ci+7.));c+=sc*s*tw*2.2*smoothstep(.02,.2,e)*(1.+band*1.5)*vis;}
      float md=max(dot(d,uMoon),0.);c+=(vec3(.55,.5,.45)*pow(md,300.)*.3+vec3(.25,.22,.3)*pow(md,60.)*.12+vec3(.12,.11,.16)*pow(md,8.)*.06)*(1.-uOver);
      vec2 sx=normalize(d.xz+1e-4);float sa=.5+.5*dot(sx,normalize(uSun.xz));float lo=exp(-max(e,0.)*6.);
      vec3 glow=mix(vec3(.09,.03,.07),vec3(.62,.22,.07),pow(sa,3.))*lo*(.35+.65*sa)+vec3(.035,.02,.06)*exp(-max(e,0.)*2.);
      c+=glow*uDusk;
      float cl=fb(d*vec3(3.,6.,3.)+vec3(uT*.02,0.,0.));
      vec3 oc=uHor*(.55+.35*smoothstep(.4,0.,e))+vec3(.012,.013,.02)*cl;
      c=mix(c,oc,uOver);
      c+=vec3(.5,.55,.75)*uFlash*(.25+cl*1.2)*(.4+.6*smoothstep(.6,0.,e));
      gl_FragColor=vec4(c,1.);}`,
  }));
  dome.renderOrder = -10; dome.frustumCulled = false; scene.add(dome);

  /* bright stars as real points (the dome's hashed stars are one or two pixels wide): varied size, colour, twinkle */
  const SR = rng(515), NS = 5000, sp = new Float32Array(NS * 3), sa = new Float32Array(NS * 2), sc = new Float32Array(NS * 3);
  for (let i = 0; i < NS; i++) {
    const u = SR() * 2 - 1, a = SR() * Math.PI * 2, r = Math.sqrt(1 - u * u);
    sp.set([r * Math.cos(a), Math.abs(u) * .98 + .02, r * Math.sin(a)], i * 3);
    sa.set([Math.pow(SR(), 6), SR()], i * 2);
    const w = SR(); sc.set(w < .2 ? [1, .8, .6] : w < .5 ? [.75, .85, 1] : [1, 1, 1], i * 3);
  }
  const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.BufferAttribute(sp, 3)); sg.setAttribute('aS', new THREE.BufferAttribute(sa, 2)); sg.setAttribute('color', new THREE.BufferAttribute(sc, 3));
  const stars = new THREE.Points(sg, new THREE.ShaderMaterial({
    uniforms: uni, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, vertexColors: true,
    vertexShader: `uniform float uT,uStar,uDusk,uOver;attribute vec2 aS;varying vec3 vC;varying float vA;
      void main(){vec3 d=normalize(position);vec4 mv=modelViewMatrix*vec4(d*1400.,1.);gl_Position=projectionMatrix*mv;
        float tw=.7+.3*sin(uT*(1.5+aS.y*6.)+aS.y*90.);vA=(.25+aS.x*1.6)*tw*uStar*(1.-uDusk*.85)*(1.-uOver)*smoothstep(.03,.2,d.y);
        vC=color;gl_PointSize=(1.4+aS.x*3.2)*(.8+.25*uStar);}`,
    fragmentShader: `varying vec3 vC;varying float vA;void main(){float r=length(gl_PointCoord-.5);float a=smoothstep(.5,.0,r);gl_FragColor=vec4(vC*a*a*vA,1.);}`,
  }));
  stars.renderOrder = -9.5; stars.frustumCulled = false; scene.add(stars);

  /* moon disc: craters + maria painted on canvas, HDR colour so bloom picks it up */
  const moonTex = canvasTex(1024, 1024, (g, w) => {
    const r = w / 2, R = rng(42); g.fillStyle = '#000'; g.fillRect(0, 0, w, w);
    const im = g.createImageData(w, w), d = im.data;
    for (let y = 0; y < w; y++) for (let x = 0; x < w; x++) {
      const dx = (x - r) / r, dy = (y - r) / r, q = dx * dx + dy * dy; if (q > 1) continue;
      const mare = fbm(x / 140 + 3, y / 140 + 9, 5), fine = fbm(x / 18, y / 18, 3), limb = Math.pow(1 - q, .22);
      let l = .96 - Math.max(0, mare - .44) * 1.5 + (fine - .5) * .1; l *= .72 + .28 * limb;
      const i = (y * w + x) * 4; d[i] = l * 255; d[i + 1] = l * 247; d[i + 2] = l * 232; d[i + 3] = 255;
    }
    g.putImageData(im, 0, 0);
    for (let k = 0; k < 140; k++) {
      const a = R() * Math.PI * 2, rr = Math.sqrt(R()) * r * .9, cx = r + Math.cos(a) * rr, cy = r + Math.sin(a) * rr, s = 3 + Math.pow(R(), 3) * 38;
      const gr = g.createRadialGradient(cx - s * .2, cy - s * .2, s * .1, cx, cy, s);
      gr.addColorStop(0, 'rgba(60,55,50,.35)'); gr.addColorStop(.75, 'rgba(40,36,30,.12)'); gr.addColorStop(.9, 'rgba(255,250,235,.22)'); gr.addColorStop(1, 'rgba(255,250,235,0)');
      g.fillStyle = gr; g.beginPath(); g.arc(cx, cy, s, 0, Math.PI * 2); g.fill();
    }
    g.globalCompositeOperation = 'destination-in'; g.fillStyle = '#fff'; g.beginPath(); g.arc(r, r, r - 1, 0, Math.PI * 2); g.fill();
  }, {repeat: false});
  const moon = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({map: moonTex, transparent: true, fog: false, depthWrite: false, color: new THREE.Color(1.0, .97, .9)}));
  moon.renderOrder = -6; scene.add(moon);
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({map: canvasTex(256, 256, (g) => { const gr = g.createRadialGradient(128, 128, 30, 128, 128, 128); gr.addColorStop(0, 'rgba(255,240,215,.22)'); gr.addColorStop(.3, 'rgba(200,190,230,.08)'); gr.addColorStop(1, 'rgba(120,110,180,0)'); g.fillStyle = gr; g.fillRect(0, 0, 256, 256); }, {repeat: false}), blending: THREE.AdditiveBlending, depthWrite: false, fog: false}));
  halo.renderOrder = -5.5; scene.add(halo);
  moon.visible = halo.visible = overcast < .5;

  /* thin cloud bands drifting across the moon */
  const cloudTex = canvasTex(512, 256, (g, w, h) => {
    const im = g.createImageData(w, h), d = im.data;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const ex = Math.min(x, w - x) / (w * .5), ey = Math.min(y, h - y) / (h * .5);
      const a = Math.max(0, fbm(x / 60, y / 30, 5) - .42) * 2.2 * Math.min(1, ex * 2) * Math.min(1, ey * 2.5);
      const i = (y * w + x) * 4; d[i] = d[i + 1] = d[i + 2] = 255; d[i + 3] = Math.min(255, a * 255);
    }
    g.putImageData(im, 0, 0);
  }, {repeat: false});
  const clouds = [], R = rng(77);
  for (let i = 0; i < 14; i++) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({map: cloudTex, color: new THREE.Color(.42, .4, .62), transparent: true, opacity: .55, depthWrite: false, fog: false}));
    const az = Math.atan2(moonDir.x, -moonDir.z) + (R() - .5) * 2.2, el = .12 + R() * .45;
    s.userData = {az, el, w: 380 + R() * 420, v: (R() * .5 + .5) * .004};
    s.renderOrder = -7; s.visible = overcast < .5; scene.add(s); clouds.push(s);
  }

  const DIST = 1450, warm = new THREE.Color();
  const DBG = new URLSearchParams(location.search).get('dbg') || '';
  if (DBG.includes('clouds')) clouds.forEach((c) => c.visible = false);
  if (DBG.includes('halo')) halo.visible = false;
  if (DBG.includes('nomoon')) moon.visible = false;
  if (DBG.includes('red')) { moon.material = new THREE.MeshBasicMaterial({color: 0xff0000, depthTest: false, side: THREE.DoubleSide}); moon.renderOrder = 100; }
  if (DBG.includes('notex')) { moon.material.map = null; moon.material.needsUpdate = true; }
  return {
    dome, moon, uni,
    update(camera, t) {
      uni.uT.value = t;
      dome.position.copy(camera.position); stars.position.copy(camera.position);
      const mp = camera.position.clone().addScaledVector(moonDir, DIST);
      moon.position.copy(mp); moon.lookAt(camera.position); moon.scale.setScalar(DIST * .13);
      halo.position.copy(mp); halo.scale.setScalar(DIST * .42);
      const dk = uni.uDusk.value;
      for (const s of clouds) {
        const u = s.userData, az = u.az + t * u.v, r = DIST * .97;
        s.position.set(camera.position.x + Math.sin(az) * Math.cos(u.el) * r, camera.position.y + Math.sin(u.el) * r, camera.position.z - Math.cos(az) * Math.cos(u.el) * r);
        s.scale.set(u.w, u.w * .32, 1);
        const near = Math.pow(Math.max(0, s.position.clone().sub(camera.position).normalize().dot(moonDir)), 30);
        warm.setRGB(.32 + near * .6 + dk * .5, .3 + near * .55 + dk * .16, .5 + near * .45 + dk * .1);
        s.material.color.copy(warm);
      }
    },
  };
}

/* far mountain rings: layered silhouettes that fade into the haze (haze must equal the fog / horizon colour) */
export function buildMountains(scene, {haze = HOR, tint = [1, 1, 1], scale = 1} = {}) {
  const layers = [{r: 560, h: 46, c: [.010, .009, .026], s: 3}, {r: 800, h: 80, c: [.017, .014, .040], s: 7}, {r: 1060, h: 130, c: [.026, .020, .056], s: 11}];
  for (const L of layers) {
    const n = 1440, pos = [], col = [], c = L.c.map((v, i) => v * tint[i]);
    for (let i = 0; i <= n; i++) {
      const a = i / n * Math.PI * 2, x = Math.sin(a) * L.r, z = -Math.cos(a) * L.r;
      const ridge = Math.pow(fbm(Math.cos(a) * 4 + L.s, Math.sin(a) * 4 + L.s, 7), 1.8) * 2.4;
      const h = (L.h * (.12 + ridge) + 4) * scale;
      pos.push(x, -20, z, x, h, z);
      col.push(...haze, ...c);
    }
    const idx = []; for (let i = 0; i < n; i++) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); g.setIndex(idx);
    const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({vertexColors: true, fog: false, side: THREE.DoubleSide}));
    m.renderOrder = -5; scene.add(m);
  }
}
