import * as THREE from 'three';
import {buildSky, buildMountains, HOR} from '../sky.js';
import {buildAct2} from '../act2.js';
import {pathShot} from '../cam.js';
import {makeGoldenBell, makeSparks} from '../fx.js';
import {rng, fbm} from '../util.js';

/* Act VI — 雙鐘共鳴. F1 the frozen instant on the tower top, F2 impact frame then the golden bell and the bronze bell ring together,
   F3 the shockwave rolls a wave through every roof of the city, lanterns die and relight, F4 the cloud deck is blown open into a ring of stars.
   Timeline (seconds, act time): impact at T0 = 4.0. */
const T0 = 4.0, SPEED = 55;

/* patch a set material: roofs lift as the ring passes (瓦浪); emissives die inside the ring and come back with a slower second ring */
function patchCity(mat, uni, {lift = false, glow = false}) {
  const prev = mat.onBeforeCompile;
  mat.onBeforeCompile = (sh, r) => {
    prev?.call(mat, sh, r);
    Object.assign(sh.uniforms, uni);
    sh.vertexShader = 'uniform vec3 uC;uniform float uR,uR2;varying vec3 vWP;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
      vec3 wp0=(modelMatrix*vec4(transformed,1.)).xyz;float dC=length(wp0.xz-uC.xz);
      ${lift ? 'float wv=exp(-pow((dC-uR)/5.,2.))*step(14.,dC)*(1.-smoothstep(260.,340.,uR));transformed.y+=wv*(1.4+.8*sin(wp0.x*.7+wp0.z*.5));transformed.xz+=normalize(wp0.xz-uC.xz+1e-3)*wv*.6;' : ''}
      vWP=(modelMatrix*vec4(transformed,1.)).xyz;`);
    if (glow) sh.fragmentShader = 'uniform vec3 uC;uniform float uR,uR2;varying vec3 vWP;\n' + sh.fragmentShader.replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
      {float d=length(vWP.xz-uC.xz);float off=smoothstep(uR-6.,uR-1.,d);float on=smoothstep(uR2,uR2-12.,d);totalEmissiveRadiance*=max(max(off,on),.03)*(1.+on*(1.-off)*smoothstep(uR2-30.,uR2,d)*1.5);}`);
    else sh.fragmentShader = 'varying vec3 vWP;\n' + sh.fragmentShader;
  };
  mat.customProgramCacheKey = () => `city-${lift}-${glow}`;
  mat.needsUpdate = true;
}

export default function act6({scene, mats, moonL, hemi, bloom, grade, renderer}) {
  const moonDir = new THREE.Vector3(.62, .12, -.78).normalize();
  scene.fog = new THREE.FogExp2(0, .0030); scene.fog.color.setRGB(...HOR);
  const sky = buildSky(scene, moonDir);
  buildMountains(scene);
  const uni = {uC: {value: new THREE.Vector3()}, uR: {value: -100}, uR2: {value: -100}};
  for (const k of ['tile', 'ridge', 'fascia', 'under']) patchCity(mats[k], uni, {lift: true});
  for (const k of ['lantern', 'lanternW', 'winLit']) patchCity(mats[k], uni, {glow: true});
  const set = buildAct2(scene, mats);
  const T = set.tower, top = T.tiers[6], C = new THREE.Vector3(T.base.x, top.y + 1.2, T.base.z);
  uni.uC.value.copy(C);
  Object.assign(moonL.shadow.camera, {left: -50, right: 50, top: 50, bottom: -50}); moonL.shadow.camera.updateProjectionMatrix();

  /* the monk's golden bell around the pavilion, a gold light at the heart of it */
  const gb = makeGoldenBell(scene, {radius: 7.5, height: 11});
  gb.mesh.position.set(C.x, top.y, C.z);
  const core = new THREE.PointLight(0xffc060, 0, 220, 1.6); core.position.copy(C).y += 3; scene.add(core);

  /* shock front: a flat gold ring + an expanding fresnel shell */
  const ringU = {uR: uni.uR, uA: {value: 0}};
  const ring = new THREE.Mesh(new THREE.RingGeometry(.86, 1, 256, 1).rotateX(-Math.PI / 2), new THREE.ShaderMaterial({
    uniforms: ringU, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    vertexShader: `varying vec2 vU;void main(){vU=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
    fragmentShader: `uniform float uA;varying vec2 vU;void main(){float r=length(vU-.5)*2.;float e=smoothstep(.86,1.,r)*smoothstep(1.,.97,r);gl_FragColor=vec4(vec3(1.,.7,.3)*e*uA*2.,1.);}`,
  }));
  ring.position.set(C.x, 9, C.z); scene.add(ring);
  const shell = new THREE.Mesh(new THREE.SphereGeometry(1, 64, 32, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.ShaderMaterial({
    uniforms: {uA: ringU.uA}, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    vertexShader: `varying vec3 vN,vV;void main(){vec4 w=modelMatrix*vec4(position,1.);vN=normalize(mat3(modelMatrix)*normal);vV=normalize(cameraPosition-w.xyz);gl_Position=projectionMatrix*viewMatrix*w;}`,
    fragmentShader: `uniform float uA;varying vec3 vN,vV;void main(){float f=pow(1.-abs(dot(vN,vV)),4.);gl_FragColor=vec4(vec3(1.,.75,.4)*f*uA*.6,1.);}`,
  }));
  shell.position.set(C.x, 0, C.z); scene.add(shell);

  /* thousands of tiles thrown up by the front */
  const R = rng(66), NT = 3200, tiles = new THREE.InstancedMesh(new THREE.BoxGeometry(.32, .035, .26), new THREE.MeshStandardMaterial({map: mats.tex.tile, color: 0x7d8496, roughness: .72}), NT), td = [];
  for (let i = 0; i < NT; i++) { const a = R() * Math.PI * 2, r = 18 + Math.pow(R(), .7) * 240; td.push({a, r, y: 6 + R() * 5, v: 4 + R() * 9, o: 3 + R() * 6, s: [R() * 9, R() * 9, R() * 9]}); }
  tiles.castShadow = true; tiles.frustumCulled = false; scene.add(tiles);
  const sparks = makeSparks(scene, [{x: C.x, y: C.y - 1, z: C.z, r: 4}], {count: 1400, rise: 26, spread: 9, size: 30, life: .35, hot: [1, .8, .4], cool: [.9, .4, .1], wind: [2, 0], twinkle: .6, seed: 9});

  /* cloud deck over the city, blown open into a widening ring */
  const deckU = {uT: {value: 0}, uC: uni.uC, uHole: {value: 0}, uMoon: {value: moonDir}};
  const deck = new THREE.Mesh(new THREE.PlaneGeometry(4000, 4000, 1, 1).rotateX(Math.PI / 2), new THREE.ShaderMaterial({
    uniforms: deckU, transparent: true, depthWrite: false, side: THREE.DoubleSide,
    vertexShader: `varying vec3 vW;void main(){vec4 w=modelMatrix*vec4(position,1.);vW=w.xyz;gl_Position=projectionMatrix*viewMatrix*w;}`,
    fragmentShader: `uniform float uT,uHole;uniform vec3 uC;varying vec3 vW;
      float h(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
      float n(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(h(i),h(i+vec2(1,0)),f.x),mix(h(i+vec2(0,1)),h(i+1.),f.x),f.y);}
      float fb(vec2 p){float s=0.,a=.5;for(int i=0;i<6;i++){s+=a*n(p);p*=2.03;a*=.5;}return s;}
      void main(){vec2 q=vW.xz-uC.xz;float d=length(q);vec2 push=normalize(q+1e-3)*smoothstep(uHole+200.,uHole,d)*uHole*.35;
        float c=fb((vW.xz-push)*.006+vec2(uT*.01,0.));float a=smoothstep(.42,.7,c);
        float rim=smoothstep(uHole-60.,uHole+40.,d);a*=rim;a*=smoothstep(1900.,1200.,d);
        vec3 col=mix(vec3(.05,.05,.09),vec3(.26,.25,.34),smoothstep(.5,.85,c))+vec3(.5,.35,.15)*smoothstep(uHole+80.,uHole,d)*rim*.6;
        gl_FragColor=vec4(col,a*.92);}`,
  }));
  deck.position.y = 300; deck.renderOrder = 5; scene.add(deck);

  const V = (x, y, z) => [C.x + x, C.y + y, C.z + z];
  const shots = [
    Object.assign(pathShot('still', 4, [V(-moonDir.x * 26, 2.5, -moonDir.z * 26), V(-moonDir.x * 21, 2.2, -moonDir.z * 21)], [V(0, 1.2, 0), V(0, 1.4, 0)], {fov: [28, 25], curve: (u) => u * (2 - u)}), {focus: C}),
    Object.assign(pathShot('impact', 4, [V(-38, 6, 34), V(-42, 7, 37)], [V(0, 1, 0), V(0, 2, 0)], {fov: [34, 36], shake: .25}), {focus: C}),
    Object.assign(pathShot('pullout', 8, [V(30, 14, 34), V(110, 70, 140), V(240, 200, 330)], [V(0, 0, 0), V(-10, -10, -10), V(-30, -20, -30)], {fov: [40, 46], curve: (u) => 1 - Math.pow(1 - u, 2.4)}), {focus: C}),
    Object.assign(pathShot('sky', 6, [V(14, 4, 14), V(14, 6, 14)], [V(40, 120, -20), V(30, 140, -30)], {fov: [62, 66]}), {focus: C}),
  ];
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), p = new THREE.Vector3(), s = new THREE.Vector3(1, 1, 1), z = new THREE.Vector3();
  let cur = null;
  return {
    moonDir, sky, shots, shadowAhead: 30,
    update(t, lt, sh) {
      if (cur !== sh) { cur = sh; set.seat(sh.focus); }
      const dt = t - T0, R1 = dt > 0 ? dt * SPEED : -100, R2 = dt > 2.5 ? (dt - 2.5) * SPEED * .75 : -100;
      uni.uR.value = R1; uni.uR2.value = R2;
      /* the frozen instant: no wind, no flicker; after impact the chimes and the great bell swing hard */
      set.bells.update(t, dt < 0 ? 0 : 2.5 * Math.exp(-dt * .25), dt < 0 ? 0 : 3 * Math.exp(-dt * .3));
      for (const L of set.lights) { const d = Math.hypot(L.position.x - C.x, L.position.z - C.z); const off = d < R1 && d > R2; L.intensity = off ? 0 : 22; }
      grade.uniforms.uInv.value = dt >= 0 && dt < 2 / 60 ? 1 : 0;          // two inverted impact frames
      grade.uniforms.uFlash.value = dt >= 2 / 60 ? Math.max(0, .55 * Math.exp(-(dt - 2 / 60) * 7)) : 0;
      const g = dt < 0 ? 0 : Math.min(1, dt * 6) * (1 - THREE.MathUtils.smoothstep(dt, 3, 7));
      gb.uni.uT.value = t; gb.uni.uFade.value = dt < 0 ? 0 : 1 - THREE.MathUtils.smoothstep(dt, 3, 7); gb.uni.uGlow.value = 1 + 3 * Math.exp(-Math.max(0, dt) * 3);
      gb.mesh.scale.setScalar(dt < 0 ? .01 : Math.min(1, .3 + dt * 3));
      core.intensity = g * 900 * (1 + Math.exp(-Math.max(0, dt) * 4) * 4);
      ring.scale.setScalar(Math.max(.01, R1)); shell.scale.set(Math.max(.01, R1), Math.max(.01, R1) * .35, Math.max(.01, R1));
      ringU.uA.value = dt < 0 ? 0 : Math.exp(-dt * .35) * (1 - THREE.MathUtils.smoothstep(R1, 280, 360));
      sparks.update(Math.max(0, dt)); sparks.uni.uGain.value = dt < 0 ? 0 : Math.exp(-dt * .5);
      for (let i = 0; i < NT; i++) {
        const d = td[i], tl = dt - d.r / SPEED;
        if (tl < 0 || tl > 4) { m.compose(z.set(0, -50, 0), q.identity(), s.set(0, 0, 0)); tiles.setMatrixAt(i, m); continue; }
        const ca = Math.cos(d.a), sa = Math.sin(d.a), rr = d.r + d.o * tl;
        p.set(C.x + ca * rr, d.y + d.v * tl - 4.9 * tl * tl, C.z + sa * rr);
        if (p.y < -2) { m.compose(z.set(0, -50, 0), q.identity(), s.set(0, 0, 0)); tiles.setMatrixAt(i, m); continue; }
        e.set(d.s[0] * tl, d.s[1] * tl, d.s[2] * tl); q.setFromEuler(e); m.compose(p, q, s.set(1, 1, 1)); tiles.setMatrixAt(i, m);
      }
      tiles.instanceMatrix.needsUpdate = true;
      deckU.uT.value = t; deckU.uHole.value = dt < 3 ? 0 : (dt - 3) * 32;
      deck.visible = sh.name === 'pullout' || sh.name === 'sky';
      hemi.intensity = .55 + g * .6;
    },
  };
}
