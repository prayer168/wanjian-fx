import * as THREE from 'three';
import {Reflector} from 'three/addons/objects/Reflector.js';
import {buildSky, buildMountains} from '../sky.js';
import {Kit, building, archBridge, boat, willow, lanternString, lantern} from '../arch.js';
import {addSway} from '../nature.js';
import {makeRain, makeSplashes, makeMist} from '../fx.js';
import {pathShot} from '../cam.js';
import {canvasTex, rng, fbm, M} from '../util.js';

/* rain-ruffled canal: planar reflection distorted by swell + expanding raindrop rings, fresnel mix with deep water */
const WaterShader = {
  uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, {color: {value: null}, tDiffuse: {value: null}, textureMatrix: {value: null}, uT: {value: 0}, uRain: {value: 1}}]),
  vertexShader: `uniform mat4 textureMatrix;varying vec4 vUv;varying vec3 vW;
    #include <fog_pars_vertex>
    void main(){vUv=textureMatrix*vec4(position,1.);vec4 w=modelMatrix*vec4(position,1.);vW=w.xyz;vec4 mvPosition=viewMatrix*w;gl_Position=projectionMatrix*mvPosition;
    #include <fog_vertex>
    }`,
  fragmentShader: `uniform vec3 color;uniform sampler2D tDiffuse;uniform float uT,uRain;varying vec4 vUv;varying vec3 vW;
    #include <fog_pars_fragment>
    float h(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
    void main(){
      vec2 g=vec2(sin(vW.x*.55+uT*1.2)+sin(vW.x*.21-uT*.6+vW.z*.4),cos(vW.z*.8+uT*1.0)+sin(vW.z*.33+vW.x*.17+uT*.5))*.0035;
      float hi=0.;
      for(int L=0;L<2;L++){float sc=L==0?1.3:2.7;vec2 p=vW.xz*sc+float(L)*7.3;vec2 ci=floor(p);
        for(int j=-1;j<=1;j++)for(int i=-1;i<=1;i++){vec2 c=ci+vec2(i,j);float r=h(c);vec2 o=vec2(h(c+3.1),h(c+5.7));
          float tt=fract(uT*(.8+r*.7)+r*7.);vec2 dv=p-(c+o);float d=length(dv);float ring=d-tt*.9;
          float a=(1.-tt)*(1.-tt)*uRain;float w=sin(ring*30.)*smoothstep(.1,0.,abs(ring))*a;g+=dv/max(d,.001)*w*.01;hi+=max(w,0.)*.5;}}
      vec2 pc=vUv.xy/vUv.w+g*2.2;
      vec3 refl=texture2D(tDiffuse,pc).rgb;
      vec3 V=normalize(cameraPosition-vW);float fr=.08+.92*pow(1.-max(V.y,0.),4.);
      vec3 c=mix(color,refl,clamp(.45+.5*fr,0.,1.))+vec3(.05,.06,.08)*hi;
      gl_FragColor=vec4(c,1.);
      #include <fog_fragment>
    }`,
};

/* Act IV — rain at night on the canal, arch bridge, moored boats, willows, lit tea-houses on both banks */
export default function act4({scene, hemi, moonL, bloom, renderer, mats, grade}) {
  const HOR = [.020, .022, .034];
  const moonDir = new THREE.Vector3(.5, .6, -.62).normalize();
  scene.fog = new THREE.FogExp2(0, .011); scene.fog.color.setRGB(...HOR);
  const sky = buildSky(scene, moonDir, {hor: HOR, overcast: 1});
  buildMountains(scene, {haze: HOR, tint: [.6, .6, .6]});
  hemi.color.set(0x34405a); hemi.groundColor.set(0x0a0a10); hemi.intensity = .35;
  moonL.color.set(0x8ea0c8); moonL.intensity = .35; moonL.castShadow = false;
  renderer.toneMappingExposure = 1.15; bloom.strength = .9; bloom.radius = .7;
  grade.uniforms.uTint.value.set(.9, .97, 1.1);

  /* wet stone: darker albedo, low roughness with puddle patches so every lantern leaves a streak */
  const wetRough = canvasTex(512, 512, (g, w, h) => { const im = g.createImageData(w, h), d = im.data; for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const n = fbm(x / 40, y / 40, 5), v = n > .55 ? 18 : 70 + (n - .3) * 120, i = (y * w + x) * 4; d[i] = d[i + 1] = d[i + 2] = Math.max(10, Math.min(255, v)); d[i + 3] = 255; } g.putImageData(im, 0, 0); }, {srgb: false});
  for (const k of ['ground', 'paving', 'stone', 'marble', 'brick']) {
    const m = mats[k]; m.color.multiplyScalar(.62); m.roughness = .32; m.roughnessMap = wetRough; m.envMapIntensity = 1.4; m.needsUpdate = true;
  }
  mats.ground.map = mats.tex.paving.clone(); mats.ground.map.repeat.set(.5, .5); mats.ground.map.needsUpdate = true;
  mats.tile.roughness = .35; mats.tile.envMapIntensity = 1.3;
  mats.lantern.emissiveIntensity = 2.2; mats.lanternW.emissiveIntensity = 1.8; mats.marble.color.setRGB(.42, .41, .40);

  /* willow strands: alpha leaf strips, swaying from the hook */
  const willowTex = canvasTex(64, 256, (g, w, h) => {
    const R = rng(3); g.clearRect(0, 0, w, h); g.strokeStyle = '#3a3a1c'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(w / 2, 0); g.lineTo(w / 2, h); g.stroke();
    for (let y = 3; y < h; y += 3.2) for (const s of [-1, 1]) { g.save(); g.translate(w / 2 + (R() - .5) * 4, y); g.rotate(s * (.35 + R() * .5) + 1.2 * s); g.fillStyle = `hsl(${82 + R() * 22},${30 + R() * 15}%,${14 + R() * 12}%)`; g.beginPath(); g.ellipse(12, 0, 13, 2.6, 0, 0, Math.PI * 2); g.fill(); g.restore(); }
  }, {repeat: false});
  const uni = {uT: {value: 0}, uWind: {value: 1}};
  mats.willow = new THREE.MeshStandardMaterial({map: willowTex, alphaTest: .45, alphaToCoverage: true, side: THREE.DoubleSide, roughness: .5, envMapIntensity: .6, color: 0xb8c8a0, emissive: 0x0c1408});
  const willowDepth = addSway(mats.willow, uni, {mode: 'uv', amp: .5, freq: 1.3});

  const R = rng(4404), kit = new Kit(mats), lamps = [];
  const WY = -2.6, BANK = 8;
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(3000, 3000), mats.ground); ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; scene.add(ground);
  /* cut the canal out of the ground with two big slabs instead of a hole: ground at y=0 only beyond the banks */
  ground.position.y = -6;
  for (const s of [-1, 1]) kit.add('paving', new THREE.BoxGeometry(1, 1, 1), M(0, -3, s * (BANK + 750), 0, 3000, 6, 1500), .5);
  /* embankment walls, coping, mooring steps */
  for (const s of [-1, 1]) {
    kit.add('stone', new THREE.BoxGeometry(1, 1, 1), M(0, -3.5, s * (BANK + .5), 0, 600, 7, 1), .5);
    kit.add('marble', new THREE.BoxGeometry(1, 1, 1), M(0, .08, s * (BANK + .45), 0, 600, .22, 1.1), .5);
    for (const x0 of [-60, 34, 90]) for (let k = 0; k < 9; k++) kit.add('stone', new THREE.BoxGeometry(1, 1, 1), M(x0 + s * k * .4, -.2 - k * .28, s * (BANK - .5), 0, 3, .3, 1.0 + k * .0), .5);
    for (let x = -120; x < 120; x += 7) kit.add('stone', new THREE.CylinderGeometry(.14, .16, 1, 8), M(x + R() * 2, .55, s * (BANK - .1), 0, 1, 1, 1), .5);
  }
  /* buildings facing the water, set back by a 3 m towpath */
  for (const side of [-1, 1]) {
    let x = -130;
    while (x < 130) {
      const w = 6 + R() * 5, d = 7 + R() * 2;
      if (Math.abs(x + w / 2) < 9) { x += 4; continue; }   // keep the bridge approach clear
      building(kit, {x: x + w / 2, z: side * (BANK + 3.5 + d / 2), ry: side > 0 ? Math.PI : 0, w, d, floors: R() < .4 ? 2 : 1, lit: .7, sign: R() < .5, lift: .9 + R() * .4}, R, lamps);
      x += w + .4;
    }
    for (let x = -110; x < 110; x += 13 + R() * 6) if (Math.abs(x) > 14) willow(kit, x, side * (BANK + 1.4), 7 + R() * 3, R);
    for (let x = -100; x < 100; x += 8 + R() * 3) if (Math.abs(x) > 12) lanternString(kit, new THREE.Vector3(x, 3.4, side * (BANK + .3)), new THREE.Vector3(x + 7, 3.4, side * (BANK + .3)), 4, .35, R() < .4, lamps);
  }
  archBridge(kit, 0, {wy: WY, bank: BANK}, lamps);
  boat(kit, -22, WY + .05, -5, .08, lamps); boat(kit, 27, WY + .05, 5.2, Math.PI - .05, lamps); boat(kit, 46, WY + .05, -4.8, -.04, lamps);
  const built = kit.build(scene);
  if (built.willow) { built.willow.customDepthMaterial = willowDepth; built.willow.castShadow = false; }

  /* water */
  const water = new Reflector(new THREE.PlaneGeometry(600, 2 * BANK), {textureWidth: 1280, textureHeight: 720, color: new THREE.Color(.012, .016, .024), shader: WaterShader});
  water.rotation.x = -Math.PI / 2; water.position.y = WY; water.material.fog = true; scene.add(water);

  const pl = [];
  for (let i = 0; i < 20; i++) { const L = new THREE.PointLight(0xff9045, 18, 14, 2); scene.add(L); pl.push(L); }
  const seat = (p) => { lamps.sort((a, b) => a.distanceToSquared(p) - b.distanceToSquared(p)); pl.forEach((L, i) => L.position.copy(lamps[i])); };

  const rain = makeRain(scene, {count: 52000, opacity: .15, len: .8});
  const splash = makeSplashes(scene, {canal: BANK + .2});
  const mist = makeMist(scene, Array.from({length: 18}, (_, i) => ({p: new THREE.Vector3((i < 9 ? -95 : 18) + (i % 9) * 9, WY + .9, (R() - .5) * 8), s: 22, flat: .16})), {color: [.4, .42, .5], opacity: .07});

  /* flashes of lightning: a double flicker */
  const flash = (t) => { let f = 0; for (const t0 of [3.2, 15.6, 22.4]) { const d = t - t0; if (d > 0 && d < .5) f = Math.max(f, Math.exp(-d * 18) + .6 * Math.exp(-Math.max(0, d - .14) * 14) * (d > .14 ? 1 : 0)); } return f; };

  const shots = [
    Object.assign(pathShot('wide', 9, [[-46, 3.2, 3.5], [-38, 3.0, 2.2]], [[0, 2.5, 0], [0, 2.2, 0]], {fov: [34, 31]}), {focus: new THREE.Vector3(-8, 2, 0)}),
    Object.assign(pathShot('water', 8, [[-30, WY + .55, .8], [-12, WY + .5, .3], [6, WY + .6, -.2]], [[0, WY + 1.2, 0], [20, WY + 1.4, 0], [40, WY + 1.6, 0]], {fov: [38, 40]}), {focus: new THREE.Vector3(-4, 0, 0)}),
    Object.assign(pathShot('deck', 7, [[-1.2, 4.6, -9], [-.6, 6.1, -4.5]], [[.4, 5.6, 6], [.8, 5.2, 12]], {fov: [36, 34], shake: .02}), {focus: new THREE.Vector3(0, 4, 0)}),
  ];
  let cur = null;
  return {
    moonDir, sky, shots,
    update(t, lt, sh, cam) {
      if (cur !== sh) { cur = sh; seat(sh.focus); }
      uni.uT.value = t; water.material.uniforms.uT.value = t;
      for (const L of pl) L.intensity = 18 * (1 + .1 * Math.sin(t * 8 + L.position.x * 3));
      const f = flash(t); sky.uni.uFlash.value = f; hemi.intensity = .35 + f * 2.5;
      rain.update(t, cam); splash.update(t, cam); mist.update(t);
    },
  };
}
