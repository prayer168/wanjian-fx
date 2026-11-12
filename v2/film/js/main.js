import * as THREE from 'three';
import {EffectComposer} from 'three/addons/postprocessing/EffectComposer.js';
import {RenderPass} from 'three/addons/postprocessing/RenderPass.js';
import {UnrealBloomPass} from 'three/addons/postprocessing/UnrealBloomPass.js';
import {ShaderPass} from 'three/addons/postprocessing/ShaderPass.js';
import {OutputPass} from 'three/addons/postprocessing/OutputPass.js';
import {makeMaterials} from './util.js';

/* film.html?shot=act3[&cam=aerial] — loads one scene module, plays its camera shots back to back (hard cuts) */
const Q = new URLSearchParams(location.search), RENDER = Q.has('render');
const SHOT = Q.get('shot') || 'act2', CAM = Q.get('cam');
const W = 1920, H = 1080;
const view = document.getElementById('view');
const renderer = new THREE.WebGLRenderer({antialias: false, powerPreference: 'high-performance'});
renderer.setPixelRatio(1); renderer.setSize(W, H);
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
view.appendChild(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(38, W / H, .1, 4000);

/* shared lighting rig: cold moon key with shadows that follows the camera, sky/ground fill; scenes retune it */
const hemi = new THREE.HemisphereLight(0x5a6aa8, 0x1a1020, .55);
const moonL = new THREE.DirectionalLight(0xbfd0ff, 1.5);
moonL.castShadow = true; moonL.shadow.mapSize.set(4096, 4096); moonL.shadow.bias = -.0004; moonL.shadow.normalBias = .04;
Object.assign(moonL.shadow.camera, {left: -70, right: 70, top: 70, bottom: -70, near: 1, far: 400});
scene.add(hemi, moonL, moonL.target);

/* post: HDR multisampled target -> bloom -> tone map -> grade (vignette, lift, grain) */
const rt = new THREE.WebGLRenderTarget(W, H, {type: THREE.HalfFloatType, samples: 4});
const composer = new EffectComposer(renderer, rt);
composer.addPass(new RenderPass(scene, camera));
/* a single bad pixel (NaN/Inf from a degenerate normal) would be smeared into black blocks by the bloom mips: zero it first */
composer.addPass(new ShaderPass({uniforms: {tDiffuse: {value: null}}, vertexShader: `varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
  fragmentShader: `uniform sampler2D tDiffuse;varying vec2 vUv;void main(){vec4 c=texture2D(tDiffuse,vUv);if(any(isnan(c))||any(isinf(c)))c=vec4(0.,0.,0.,1.);gl_FragColor=vec4(min(c.rgb,vec3(6e4)),c.a);}`}));
const bloom = new UnrealBloomPass(new THREE.Vector2(W, H), .75, .55, .82);
composer.addPass(bloom);
composer.addPass(new OutputPass());
const grade = new ShaderPass({
  uniforms: {tDiffuse: {value: null}, uT: {value: 0}, uVig: {value: .9}, uTint: {value: new THREE.Vector3(.92, .96, 1.08)}, uLift: {value: new THREE.Vector3(.012, .008, .03)}, uInv: {value: 0}, uFlash: {value: 0}, uFade: {value: 1}, uWhip: {value: new THREE.Vector2()}},
  vertexShader: `varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
  fragmentShader: `uniform sampler2D tDiffuse;uniform float uT,uVig,uInv,uFlash,uFade;uniform vec3 uTint,uLift;uniform vec2 uWhip;varying vec2 vUv;
    float h(vec2 p){return fract(sin(dot(p,vec2(12.9898,78.233)))*43758.5453);}
    void main(){vec3 c=texture2D(tDiffuse,vUv).rgb;
      if(dot(uWhip,uWhip)>1e-8){c=vec3(0.);for(int i=0;i<15;i++)c+=texture2D(tDiffuse,vUv+uWhip*(float(i)/14.-.5)).rgb;c/=15.;}  /* whip-pan smear */
      c=mix(c,c*uTint,.5);c+=uLift;
      float l=dot(c,vec3(.299,.587,.114));c=mix(c,vec3(smoothstep(.55,.0,l)),uInv);  /* impact frame: stark inverted black/white */
      c=mix(c,vec3(1.,.95,.85),uFlash);c*=uFade;
      float v=smoothstep(1.15,.35,length((vUv-.5)*vec2(1.25,1.)));c*=mix(1.,v,uVig);
      c+=(h(vUv*1000.+uT)-.5)*.035;gl_FragColor=vec4(c,1.);}`,
});
composer.addPass(grade);

/* dim night environment (sky gradient, warm lantern band low on the horizon, moon spot) so metal, lacquer and wet stone have something to reflect */
function nightEnv(warm = 1) {
  const es = new THREE.Scene();
  es.add(new THREE.Mesh(new THREE.SphereGeometry(10, 48, 24), new THREE.ShaderMaterial({
    side: THREE.BackSide, uniforms: {uW: {value: warm}},
    vertexShader: `varying vec3 vD;void main(){vD=normalize(position);gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
    fragmentShader: `uniform float uW;varying vec3 vD;void main(){vec3 d=normalize(vD);float e=d.y;
      vec3 c=mix(vec3(.05,.04,.10),vec3(.008,.01,.03),smoothstep(0.,.6,e));c=mix(vec3(.02,.016,.022),c,smoothstep(-.25,0.,e));
      float lan=exp(-abs(e-.04)*14.)*(.6+.4*sin(atan(d.z,d.x)*9.));c+=vec3(.5,.18,.05)*lan*.35*uW;
      c+=vec3(1.,.95,.85)*pow(max(dot(d,normalize(vec3(.86,.25,-.42))),0.),300.)*6.;
      gl_FragColor=vec4(c,1.);}`,
  })));
  const pm = new THREE.PMREMGenerator(renderer), tex = pm.fromScene(es, 0, .1, 100).texture; pm.dispose();
  return tex;
}
const mats = makeMaterials();
scene.environment = nightEnv();
for (const k in mats) if (mats[k].isMaterial) mats[k].envMapIntensity = .7;
const ctx = {THREE, scene, camera, renderer, hemi, moonL, bloom, grade, mats};
const mod = await import(`./scenes/${SHOT}.js`);
const S = await mod.default(ctx);
const shots = CAM ? S.shots.filter((s) => s.name === CAM) : S.shots;
const starts = []; let total = 0;
for (const s of shots) { starts.push(total); total += s.dur; }

const fwd = new THREE.Vector3();
function draw(t) {
  let k = 0; while (k < shots.length - 1 && t >= starts[k + 1]) k++;
  const sh = shots[k], lt = t - starts[k];
  /* a shot may run the action at its own speed (slow motion, speed ramps, a frozen instant): st = action time */
  const st = (sh.t0 ?? starts[k]) + (sh.time ? sh.time(lt) : lt);
  camera.up.set(0, 1, 0); sh.cam(lt, camera, st); camera.updateProjectionMatrix();
  grade.uniforms.uWhip.value.set(0, 0); sh.whip?.(lt, grade.uniforms.uWhip.value);
  S.update?.(st, lt, sh, camera);
  camera.getWorldDirection(fwd);
  const aim = camera.position.clone().addScaledVector(fwd, S.shadowAhead ?? 40);
  moonL.target.position.copy(aim); moonL.position.copy(aim).addScaledVector(S.moonDir, 200);
  S.sky?.update(camera, st); grade.uniforms.uT.value = t;
  composer.render();
}

window.__reelFrames = Math.round(total * 60);
/* the fight's sound cues for the audio score: every hit, block, landing and bell, in section time */
window.__events = (S.events || []).map((e) => ({t: +e.t.toFixed(3), type: e.type, who: e.who, heavy: !!e.heavy, big: !!e.big}));
window.__renderFrame = (i) => { draw(i / 60); return i; };
if (!RENDER) { const t0 = performance.now(); const loop = () => { draw(((performance.now() - t0) / 1000) % total); requestAnimationFrame(loop); }; loop(); }
