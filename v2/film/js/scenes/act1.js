import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {buildSky, buildMountains} from '../sky.js';
import {Kit, cityWall} from '../arch.js';
import {terrain, addSway} from '../nature.js';
import {makeSparks, makeSmoke} from '../fx.js';
import {pathShot} from '../cam.js';
import {canvasTex, grain, rng, fbm} from '../util.js';

/* Act I — the wasteland after v1's duel: dusk turning to night, ten thousand spent arrows,
   the golden bell's ghost dissolving into dust, embers and smoke, the city wall far to the west. */
export default function act1({scene, hemi, moonL, bloom, renderer, mats, grade}) {
  const HOR = [.085, .048, .065];
  const moonDir = new THREE.Vector3(.8, .16, .35).normalize(), sun = new THREE.Vector3(-.85, .02, .45).normalize();
  scene.fog = new THREE.FogExp2(0, .0030); scene.fog.color.setRGB(...HOR);
  const sky = buildSky(scene, moonDir, {hor: HOR, dusk: 1, sun});
  buildMountains(scene, {haze: HOR, tint: [1.6, 1.0, 1.0], scale: .8});
  hemi.color.set(0x8a6a8a); hemi.groundColor.set(0x1a1010); hemi.intensity = .55;
  const keyDir = sun.clone().setY(.12).normalize();
  moonL.color.set(0xffa070); moonL.intensity = 1.6;
  Object.assign(moonL.shadow.camera, {left: -40, right: 40, top: 40, bottom: -40}); moonL.shadow.camera.updateProjectionMatrix();
  renderer.toneMappingExposure = 1.1; bloom.strength = .8;
  grade.uniforms.uTint.value.set(1.02, .96, 1.0); grade.uniforms.uLift.value.set(.016, .008, .02);

  const hfn = (x, z) => { const r = Math.hypot(x, z); return 2.6 * (fbm(x / 60 + 2, z / 60 + 5, 4) - .5) + .9 * (fbm(x / 11, z / 11, 3) - .5) + 30 * Math.pow(fbm(x / 140, z / 140 + 4, 3), 2) * THREE.MathUtils.smoothstep(r, 120, 500); };

  /* cracked, scorched earth */
  const earth = canvasTex(1024, 1024, (g, w, h) => {
    g.fillStyle = '#6e5842'; g.fillRect(0, 0, w, h); const R = rng(9);
    for (let i = 0; i < 90; i++) { const x = R() * w, y = R() * h, r = 30 + R() * 160, gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, `rgba(${R() < .5 ? '40,28,20' : '140,118,92'},.35)`); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(x - r, y - r, 2 * r, 2 * r); }
    g.strokeStyle = 'rgba(30,20,14,.9)';
    for (let i = 0; i < 520; i++) { let x = R() * w, y = R() * h, a = R() * 6.28; g.lineWidth = .8 + R() * 2.4; g.beginPath(); g.moveTo(x, y); for (let k = 0, n = 4 + R() * 10; k < n; k++) { a += (R() - .5) * 1.4; x += Math.cos(a) * 12; y += Math.sin(a) * 12; g.lineTo(x, y); } g.stroke(); }
    for (let i = 0; i < 2500; i++) { g.fillStyle = `rgba(${R() < .5 ? '160,140,110' : '50,40,30'},.5)`; g.fillRect(R() * w, R() * h, 2 + R() * 3, 2 + R() * 3); }
    grain(g, w, h, .07, 7, 41);
  });
  scene.add(terrain(2400, 360, hfn, new THREE.MeshStandardMaterial({map: earth, roughness: .95, color: 0xb0a090}), .14));

  const R = rng(1111), uni = {uT: {value: 0}, uWind: {value: 1}};

  /* dry grass: crossed alpha cards, swaying; thinner near the scorched centre */
  const grassTex = canvasTex(256, 256, (g, w, h) => {
    const Rg = rng(6);
    for (let i = 0; i < 70; i++) { const x0 = w / 2 + (Rg() - .5) * 60, lean = (Rg() - .5) * 160, hh = h * (.45 + Rg() * .55); g.strokeStyle = `hsl(${30 + Rg() * 16},${30 + Rg() * 25}%,${30 + Rg() * 30}%)`; g.lineWidth = 1.5 + Rg() * 2; g.beginPath(); g.moveTo(x0, h); g.quadraticCurveTo(x0 + lean * .2, h - hh * .6, x0 + lean, h - hh); g.stroke(); }
  }, {repeat: false});
  const tuft = mergeGeometries([0, 1, 2].map((k) => new THREE.PlaneGeometry(1, 1).translate(0, .5, 0).rotateY(k * Math.PI / 3).toNonIndexed()));
  { const n = tuft.attributes.normal; for (let i = 0; i < n.count; i++) n.setXYZ(i, 0, 1, 0); }
  const gMat = new THREE.MeshStandardMaterial({map: grassTex, alphaTest: .4, alphaToCoverage: true, side: THREE.DoubleSide, roughness: .9, envMapIntensity: .2});
  const NG = 16000, grass = new THREE.InstancedMesh(tuft, gMat, NG), gRoot = new Float32Array(NG * 4);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), s = new THREE.Vector3(), p = new THREE.Vector3(), col = new THREE.Color();
  for (let i = 0, k = 0; i < NG; k++) {
    const r = 3 + Math.pow(R(), .8) * 180, a = R() * 6.28, x = Math.cos(a) * r, z = Math.sin(a) * r;
    if (r < 14 && R() < .8) continue;
    const H = (.35 + R() * .7) * (fbm(x / 9, z / 9, 2) + .4);
    p.set(x, hfn(x, z) - .03, z); e.set(0, R() * 6.28, 0); q.setFromEuler(e); s.set(H * 1.2, H, H * 1.2); m.compose(p, q, s);
    grass.setMatrixAt(i, m); col.setHSL(.08 + R() * .04, .3 + R() * .2, .45 + R() * .3); grass.setColorAt(i, col); gRoot.set([x, p.y, z, Math.max(H, .3)], i * 4); i++;
  }
  tuft.setAttribute('aRoot', new THREE.InstancedBufferAttribute(gRoot, 4));
  grass.customDepthMaterial = addSway(gMat, uni, {mode: 'inst', amp: .12, freq: 2.2, foliage: true});
  grass.receiveShadow = true; grass.castShadow = true; grass.frustumCulled = false; scene.add(grass);

  /* rocks */
  const rockGeo = new THREE.IcosahedronGeometry(1, 2); { const pp = rockGeo.attributes.position; for (let i = 0; i < pp.count; i++) { const v = new THREE.Vector3().fromBufferAttribute(pp, i); v.multiplyScalar(.75 + .5 * fbm(v.x * 2 + 5, v.y * 2 + v.z * 1.3, 3)); pp.setXYZ(i, v.x, v.y * .7, v.z); } rockGeo.computeVertexNormals(); }
  const rocks = new THREE.InstancedMesh(rockGeo, new THREE.MeshStandardMaterial({map: mats.tex.marble, color: 0x6a5e54, roughness: .9}), 420);
  const camKeep = [[28, 10], [21, 7], [10, -6], [7.4, -8.6], [34, 22], [32, 24]];
  for (let i = 0; i < 420; i++) { const r = 6 + R() * 160, a = R() * 6.28, x = Math.cos(a) * r, z = Math.sin(a) * r, near = camKeep.some(([cx, cz]) => Math.hypot(x - cx, z - cz) < 9), sc = near ? 0 : .15 + Math.pow(R(), 4) * 1.6; e.set(R(), R() * 6, R()); q.setFromEuler(e); m.compose(p.set(x, hfn(x, z), z), q, s.set(sc, sc, sc)); rocks.setMatrixAt(i, m); }
  rocks.castShadow = rocks.receiveShadow = true; scene.add(rocks);

  /* spent arrows: shaft, iron head, three fletchings, vertex coloured; stuck, broken or lying */
  const part = (geo, c) => { geo = geo.toNonIndexed(); const n = geo.attributes.position.count, cc = new Float32Array(n * 3); for (let i = 0; i < n; i++) cc.set(c, i * 3); geo.setAttribute('color', new THREE.BufferAttribute(cc, 3)); return geo; };
  const vane = () => { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute([0, .58, 0, .018, .6, 0, .02, .7, 0, 0, .58, 0, .02, .7, 0, 0, .73, 0], 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(12), 2)); g.computeVertexNormals(); return g; };
  const fl = [0, 1, 2].map((k) => part(vane().rotateY(k * 2.094), k ? [.42, .38, .34] : [.62, .55, .46]));
  const arrowGeo = mergeGeometries([part(new THREE.CylinderGeometry(.0055, .0055, .76, 5).translate(0, .38, 0), [.40, .27, .15]), part(new THREE.ConeGeometry(.014, .07, 4).rotateX(Math.PI).translate(0, -.03, 0), [.11, .11, .12]), part(new THREE.CylinderGeometry(.007, .007, .02, 5).translate(0, .755, 0), [.2, .12, .08]), ...fl]);
  const aMat = new THREE.MeshStandardMaterial({vertexColors: true, roughness: .75, side: THREE.DoubleSide});
  const NA = 5200, arrows = new THREE.InstancedMesh(arrowGeo, aMat, NA), embers = [];
  for (let i = 0; i < NA; i++) {
    const lying = R() < .16, ring = R() < .55;
    const r = ring ? 3.6 + Math.abs(R() + R() + R() - 1.5) * 9 : 3.6 + Math.pow(R(), 1.6) * 70, a = R() * 6.28, x = Math.cos(a) * r, z = Math.sin(a) * r;
    const len = R() < .22 ? .35 + R() * .4 : 1, y = hfn(x, z);
    if (lying) { e.set(Math.PI / 2 + (R() - .5) * .2, R() * 6.28, 0, 'YXZ'); q.setFromEuler(e); p.set(x, y + .012, z); }
    else { e.set(-.35 - R() * .45 + (R() - .5) * .2, Math.atan2(-x, -z) + (R() - .5) * .9, (R() - .5) * .3, 'YXZ'); q.setFromEuler(e); p.set(x, y - .12 * R(), z); }
    m.compose(p, q, s.set(1, len, 1)); arrows.setMatrixAt(i, m);
    if (!lying && R() < .035) embers.push({x, y: y + .3, z, r: .25});
  }
  arrows.castShadow = arrows.receiveShadow = true; scene.add(arrows);

  /* the golden bell's ghost (v1 silhouette: hw(u) = W·sqrt(1-u⁴)·(1-.1·sin(uπ))), fresnel gold + hex lattice, fading out */
  const prof = []; for (let i = 0; i <= 40; i++) { const u = i / 40; prof.push(new THREE.Vector2(Math.max(.001, 2.1 * Math.sqrt(Math.max(0, 1 - u ** 4)) * (1 - .1 * Math.sin(u * Math.PI))), u * 3.8)); }
  const ghostU = {uT: {value: 0}, uFade: {value: 1}};
  const ghost = new THREE.Mesh(new THREE.LatheGeometry(prof, 64), new THREE.ShaderMaterial({
    uniforms: ghostU, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    vertexShader: `varying vec3 vN,vV,vP;void main(){vec4 w=modelMatrix*vec4(position,1.);vP=position;vN=normalize(mat3(modelMatrix)*normal);vV=normalize(cameraPosition-w.xyz);gl_Position=projectionMatrix*viewMatrix*w;}`,
    fragmentShader: `uniform float uT,uFade;varying vec3 vN,vV,vP;
      float hex(vec2 p){p.x*=1.1547;p.y+=mod(floor(p.x),2.)*.5;vec2 f=abs(fract(p)-.5);return smoothstep(.02,.0,abs(max(f.x*1.5+f.y,f.y*2.)-1.));}
      void main(){float fr=pow(1.-abs(dot(normalize(vN),vV)),2.2);float a=atan(vP.z,vP.x);
        float hx=hex(vec2(a*4.,vP.y*2.2));float band=smoothstep(.0,.4,sin(vP.y*3.-uT*2.)*.5+.5);
        float nz=fract(sin(dot(floor(vec2(a*44.,vP.y*30.)),vec2(12.9,78.2)))*43758.5);float dis=step(nz,uFade)+smoothstep(.06,0.,abs(nz-uFade))*3.;
        vec3 c=vec3(1.,.72,.25)*(fr*1.4+hx*.5*band)*uFade*dis;gl_FragColor=vec4(c,1.);}`,
  }));
  ghost.position.set(0, hfn(0, 0) - .1, 0); scene.add(ghost);
  const dust = makeSparks(scene, [{x: 0, y: .2, z: 0, r: 2.6}], {count: 1600, rise: 4.5, spread: 1.4, size: 9, life: .12, hot: [1, .8, .35], cool: [.8, .45, .1], wind: [.6, .2], twinkle: 1, seed: 7});
  const sparks = makeSparks(scene, embers, {count: 700, rise: 2.2, spread: .3, size: 7, life: .5, wind: [.8, .3]});
  const smoke = makeSmoke(scene, embers.filter((_, i) => i % 3 === 0).slice(0, 18).map((s) => ({...s, k: .6})), {per: 5, color: [.16, .13, .13], opacity: .22, rise: 5, period: 10});

  /* the city on the western horizon: wall, gate tower, lanterns */
  const kit = new Kit(mats); cityWall(kit, -380, -260, 260, 0, rng(3), []); kit.build(scene);
  for (const z of [-150, -60, 0, 60, 150]) { const L = new THREE.PointLight(0xff8a40, 300, 70, 2); L.position.set(-372, 9, z); scene.add(L); }

  const shots = [
    pathShot('field', 9, [[28, hfn(28, 10) + 2.3, 10], [21, hfn(21, 7) + 2.0, 7]], [[-60, 3, -12], [-60, 3.5, -10]], {fov: [36, 33]}),
    pathShot('arrows', 7, [[10, hfn(10, -6) + .75, -6], [7.4, hfn(7.4, -8.6) + .8, -8.6]], [[-2, .7, -2.5], [-4, .9, -4]], {fov: [30, 28], curve: (u) => u}),
    pathShot('city', 8, [[34, hfn(34, 22) + 3, 22], [32, hfn(32, 24) + 15, 25]], [[-380, 4, -6], [-380, 2, -4]], {fov: [30, 26]}),
  ];
  const TOTAL = shots.reduce((a, b) => a + b.dur, 0);
  return {
    moonDir: keyDir, sky, shots, shadowAhead: 20,
    update(t, lt, sh, cam) {
      const u = t / TOTAL;
      sky.uni.uDusk.value = 1 - .55 * u; moonL.intensity = 1.6 - .7 * u;
      uni.uT.value = t; ghostU.uT.value = t; ghostU.uFade.value = Math.max(0, .95 - u * 1.05);
      dust.update(t); dust.uni.uGain.value = .5 + ghostU.uFade.value; sparks.update(t); smoke.update(t);
    },
  };
}
