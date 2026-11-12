import * as THREE from 'three';
import {calibrate, retarget} from './people.js';

/* The two leads as procedural toon stand-ins (ported from rig-test.html): bone hierarchy, hanfu/kasaya skirts, Verlet ribbons, qi trails
   and the pose library. Bone names follow the rig test; when the VRoid models arrive, applyPose() is the one place to retarget. */
let scene;
const D=Math.PI/180,STEP=1/120,BH=430,BW=240;
const clamp=(x,a=0,b=1)=>Math.min(b,Math.max(a,x));
const lerp=(a,b,t)=>a+(b-a)*t;
const E={lin:t=>t,io:t=>t<.5?2*t*t:1-Math.pow(-2*t+2,2)/2,out:t=>1-Math.pow(1-t,3),in:t=>t*t*t,expo:t=>t>=1?1:1-Math.pow(2,-10*t)};
function mulberry32(a){return function(){a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}
const R=mulberry32(20261111),rnd=(a=0,b=1)=>a+(b-a)*R();
const v1=new THREE.Vector3(),v2=new THREE.Vector3(),v3=new THREE.Vector3(),q1=new THREE.Quaternion(),q2=new THREE.Quaternion();
const qa=new THREE.Quaternion(),qb=new THREE.Quaternion(),qc=new THREE.Quaternion(),AX=new THREE.Vector3();
const XA=new THREE.Vector3(1,0,0),YA=new THREE.Vector3(0,1,0);

const gm=new THREE.DataTexture(new Uint8Array([70,70,70,255,160,160,160,255,255,255,255,255]),3,1);
gm.minFilter=gm.magFilter=THREE.NearestFilter;gm.needsUpdate=true;
const MAT={},OUT={};
function toon(c,o){const k=c+(o?JSON.stringify(o):'');return MAT[k]||(MAT[k]=new THREE.MeshToonMaterial(Object.assign({color:c,gradientMap:gm},o||{})));}
/* inverted-hull outline pushed out in clip space, so it stays ~th px wide at any distance and any lens */
function outline(c,th=1){const k=c+th;return OUT[k]||(OUT[k]=new THREE.ShaderMaterial({side:THREE.BackSide,fog:false,uniforms:{c:{value:new THREE.Color(c)},th:{value:1.3*th}},
  vertexShader:`uniform float th;void main(){vec4 p=projectionMatrix*modelViewMatrix*vec4(position,1.);vec4 q=projectionMatrix*modelViewMatrix*vec4(position+normal*.01,1.);
    vec2 d=q.xy/q.w-p.xy/p.w;float l=length(d);if(l>1e-6)p.xy+=d/l*th*2./vec2(1920.,1080.)*p.w;p.z+=.0004*p.w;gl_Position=p;}`,
  fragmentShader:`uniform vec3 c;void main(){gl_FragColor=vec4(c,1.);}`}));}
/* ================= rig ================= */
const DIM={S:{hipY:.98,thigh:.44,shin:.44,hipX:.085,spine:.2,chest:.27,neck:.07,headR:.11,shX:.18,ua:.28,fa:.25,foot:.07},
           M:{hipY:.95,thigh:.43,shin:.42,hipX:.115,spine:.21,chest:.3,neck:.06,headR:.13,shX:.25,ua:.3,fa:.27,foot:.075}};
const cap=(r,l)=>new THREE.CapsuleGeometry(r,l,6,16);
const sph=(r,w=20,h=14)=>new THREE.SphereGeometry(r,w,h);
const cyl=(a,b,h,s=18)=>new THREE.CylinderGeometry(a,b,h,s);
const box=(x,y,z)=>new THREE.BoxGeometry(x,y,z);

function buildRig(key,OL){
  const d=DIM[key],J={},g=new THREE.Group();scene.add(g);
  const P=(parent,geo,col,pos,rot,scl,th=1,mat)=>{const m=new THREE.Mesh(geo,mat||toon(col));m.castShadow=true;if(pos)m.position.set(...pos);if(rot)m.rotation.set(...rot);if(scl)m.scale.set(...scl);if(th){m.add(new THREE.Mesh(geo,outline(OL,th)));}parent.add(m);return m;};
  const jt=(parent,name,pos)=>{const j=new THREE.Group();j.position.set(...pos);parent.add(j);J[name]=j;return j;};
  jt(g,'hips',[0,d.hipY,0]);jt(J.hips,'spine',[0,.03,0]);jt(J.spine,'chest',[0,d.spine,0]);jt(J.chest,'neck',[0,d.chest,0]);jt(J.neck,'head',[0,d.neck,0]);
  for(const [s,sd] of [['L',1],['R',-1]]){
    jt(J.chest,'sh'+s,[sd*d.shX,d.chest-.05,0]);jt(J['sh'+s],'el'+s,[0,-d.ua,0]);jt(J['el'+s],'wr'+s,[0,-d.fa,0]);
    jt(J.hips,'hip'+s,[sd*d.hipX,-.02,0]);jt(J['hip'+s],'kn'+s,[0,-d.thigh,0]);jt(J['kn'+s],'an'+s,[0,-d.shin,0]);
  }
  return {key,g,J,d,P,OL};
}
const faceZ=(r,x,y,sx=.9,sz=.95)=>sz*Math.sqrt(Math.max(0,r*r-(x/sx)**2-y*y));

function makeSwordsman(){
  const OL='#141726',C={robe:'#eef1f8',robeSh:'#c4cde6',belt:'#3d7bff',rib:'#5b93ff',skin:'#f6dcc7',hair:'#1d2133',blade:'#e9f3ff',guard:'#c9a24a',grip:'#3a2a1e',pants:'#2c3150',shoe:'#1d2133'};
  const ch=buildRig('S',OL),{J,d,P}=ch;
  P(J.spine,cap(.115,.1),C.robe,[0,.09,0],0,[1.05,1,.82]);
  P(J.chest,cap(.135,.12),C.robe,[0,.13,0],0,[1.12,1,.8]);
  P(J.chest,box(.035,.27,.014),C.robeSh,[-.012,.17,.104],[-.12,0,.62],0,.6);
  P(J.chest,new THREE.TorusGeometry(.058,.016,8,20),C.robeSh,[0,.27,.0],[Math.PI/2,0,0],0,.6);
  P(J.spine,cyl(.128,.128,.065,24),C.belt,[0,.05,0],0,[1,1,.82]);
  P(J.neck,cyl(.038,.044,.1,12),C.skin,[0,.03,0]);
  /* head */
  const r=d.headR,H=J.head,hc=r*.95;
  P(H,sph(r,28,20),C.skin,[0,hc,0],0,[.9,1,.95]);
  P(H,new THREE.SphereGeometry(r*1.07,28,16,0,Math.PI*2,0,Math.PI*.5),C.hair,[0,hc+.004,-r*.06],[-.5,0,0],[.93,1,.99]);
  P(H,sph(r,20,14),C.hair,[0,hc-.012,-r*.28],0,[.92,.96,.8]);
  for(let i=-1.5;i<=1.5;i++)P(H,new THREE.ConeGeometry(.022,.085,6),C.hair,[i*.03,hc+r*.66,r*.7],[Math.PI-.42,0,i*.16],0,.6);
  for(const s of [1,-1])P(H,new THREE.ConeGeometry(.015,.14,6),C.hair,[s*r*.86,hc-.01,r*.02],[Math.PI-.08,0,-s*.05],0,.6);
  P(H,sph(.043),C.hair,[0,hc+r*.92,-r*.5]);
  P(H,new THREE.TorusGeometry(.03,.009,8,16),C.belt,[0,hc+r*.86,-r*.66],[.9,0,0],0,.5);
  for(const s of [1,-1]){
    const ex=s*.04,ey=-.006;
    P(H,box(.038,.013,.012),OL,[ex,hc+ey,faceZ(r,ex,ey)-.004],[0,s*.42,s*.2],0,0);
    P(H,box(.009,.006,.006),'#ffffff',[ex-s*.006,hc+ey+.002,faceZ(r,ex,ey)+.002],[0,s*.42,0],0,0,new THREE.MeshBasicMaterial({color:0xffffff}));
    P(H,box(.044,.009,.01),C.hair,[s*.042,hc+.04,faceZ(r,.042,.04)-.003],[0,s*.42,s*.3],0,0);
    P(H,sph(.022,10,8),C.skin,[s*r*.88,hc,0],0,[.45,1,.8],.6);
  }
  P(H,box(.024,.005,.006),'#9a4c46',[.006,hc-.056,faceZ(r,.006,-.056)-.002],[0,0,.15],0,0);
  /* arms: wide hanfu sleeves */
  for(const s of ['L','R']){
    P(J['sh'+s],sph(.062),C.robe);
    P(J['sh'+s],cap(.05,d.ua-.08),C.robe,[0,-d.ua/2,0]);
    const sl=P(J['el'+s],cyl(.055,.1,d.fa+.02,18),C.robe,[0,-d.fa/2-.01,.012]);
    P(sl,cyl(.088,.088,.006,18),'#3b4466',[0,-(d.fa+.02)/2-.002,0],0,0,0);
    ch['sleeve'+s]=sl;
  }
  const torn=new THREE.Group();J.elR.add(torn);torn.visible=false;ch.tornR=torn;
  {const g=cyl(.055,.07,.1,9);const p=g.attributes.position;for(let i=0;i<p.count;i++){if(p.getY(i)<0)p.setY(i,p.getY(i)-((i*37)%5)*.012);}g.computeVertexNormals();P(torn,g,C.robe,[0,-.05,0]);
   P(torn,cap(.034,d.fa-.07),C.skin,[0,-d.fa/2,0]);}
  ch.hand={};for(const s of ['L','R'])ch.hand[s]=P(J['wr'+s],sph(.042,14,10),C.skin,[0,-.04,0],0,[.85,1.15,.65]);
  /* sword: blade along hand +Z */
  const sw=new THREE.Group();sw.position.set(0,-.045,0);J.wrR.add(sw);
  P(sw,cyl(.016,.018,.17,10),C.grip,[0,0,0],[Math.PI/2,0,0]);
  P(sw,sph(.022,10,8),C.guard,[0,0,-.095]);
  P(sw,box(.13,.026,.032),C.guard,[0,0,.095]);
  ch.bladeMat=new THREE.MeshToonMaterial({color:C.blade,gradientMap:gm,emissive:0x3a5a88});
  P(sw,box(.034,.009,.86),C.blade,[0,0,.54],0,0,.7,ch.bladeMat);
  P(sw,new THREE.ConeGeometry(.024,.07,4),C.blade,[0,0,1.005],[Math.PI/2,Math.PI/4,0],[1,1,.37],.7,ch.bladeMat);
  ch.sword=sw;
  /* legs */
  for(const s of ['L','R']){
    P(J['hip'+s],cap(.062,d.thigh-.09),C.pants,[0,-d.thigh/2,0]);
    P(J['kn'+s],cap(.05,d.shin-.07),C.pants,[0,-d.shin/2,0]);
    P(J['an'+s],box(.08,.055,.2),C.shoe,[0,-.04,.05]);
  }
  ch.skirt=new Skirt(ch,{y0:.1,y1:-.72,r0:.13,r1:.3,col:C.robe,legR:.065,rows:10,cols:28,maxOff:.24});
  ch.ropes=[
    new Rope(ch,{node:J.spine,local:new THREE.Vector3(.05,.05,-.12),n:11,len:.72,w:.042,th:.006,taper:.35,col:C.rib,flat:1,drag:3.2,twist:.18}),
    new Rope(ch,{node:J.spine,local:new THREE.Vector3(.1,.04,-.09),n:11,len:.62,w:.036,th:.006,taper:.35,col:C.rib,flat:1,drag:3.4,twist:-.22}),
    new Rope(ch,{node:J.head,local:new THREE.Vector3(0,hc+r*.9,-r*.72),n:9,len:.5,w:.036,th:.036,taper:.8,col:C.hair,drag:1.8,grav:.9}),
  ];
  ch.spheres=[[J.hips,new THREE.Vector3(0,0,0),.17],[J.chest,new THREE.Vector3(0,.12,0),.16],[J.head,new THREE.Vector3(0,hc,0),.125],[J.spine,new THREE.Vector3(0,.06,0),.15]];
  ch.fxColor=new THREE.Color('#6ab8ff');ch.fxColor2=new THREE.Color('#d2f0ff');
  return ch;
}

function makeMonk(){
  const OL='#1a1220',C={robe:'#d8542c',robeIn:'#c9472a',skin:'#e8b38a',skin2:'#e3a47a',belt:'#f2b53a',bead:'#5a3420',pants:'#3a2a3a',wrap:'#d6cbb8',shoe:'#2a1e28'};
  const ch=buildRig('M',OL),{J,d,P}=ch;
  P(J.spine,cap(.16,.1),C.robe,[0,.09,0],0,[1.1,1,.86]);
  P(J.chest,cap(.18,.13),C.robe,[0,.14,0],0,[1.15,1,.82]);
  P(J.chest,sph(.125),C.skin2,[-.13,.2,.025],0,[1,.9,.9]);
  {const tg=new THREE.Group();tg.position.set(0,.13,0);tg.rotation.z=.58;J.chest.add(tg);P(tg,new THREE.TorusGeometry(.205,.03,8,40),C.robeIn,0,[Math.PI/2,0,0],[1.07,.8,1],.7);}
  {const bg=new THREE.Group();bg.position.set(0,.29,-.01);bg.rotation.x=.95;J.chest.add(bg);
   for(let i=0;i<18;i++){const a=i/18*Math.PI*2,big=i===4;P(bg,sph(big?.026:.018,10,8),C.bead,[Math.sin(a)*.15,0,Math.cos(a)*.17],0,0,.5);}}
  P(J.spine,cyl(.185,.185,.07,24),C.belt,[0,.05,0],0,[1,1,.86]);
  P(J.neck,cyl(.066,.076,.1,14),C.skin,[0,.03,0]);
  const r=d.headR,H=J.head,hc=r*.92;
  P(H,sph(r,28,20),C.skin,[0,hc,0],0,[.95,1,.98]);
  for(const s of [1,-1]){
    const ex=s*.046,ey=-.004;
    P(H,box(.04,.01,.012),OL,[ex,hc+ey,faceZ(r,ex,ey,.95,.98)-.004],[0,s*.4,0],0,0);
    P(H,box(.062,.017,.014),'#2a1a18',[s*.05,hc+.042,faceZ(r,.05,.042,.95,.98)-.004],[0,s*.4,s*.3],0,0);
    P(H,sph(.032,10,8),C.skin,[s*r*.93,hc-.005,0],0,[.42,1,.78],.6);
  }
  P(H,sph(.022,10,8),C.skin2,[0,hc-.03,faceZ(r,0,-.03,.95,.98)],0,[.8,1,.8],.5);
  P(H,box(.036,.006,.008),'#6a3326',[0,hc-.07,faceZ(r,0,-.07,.95,.98)-.003],0,0,0);
  for(let i=0;i<6;i++){const x=(i%3-1)*.03,z=(i<3?.035:-.005);P(H,sph(.007,6,6),'#a8664a',[x,hc+Math.sqrt(r*r-x*x-z*z)*.99,z],0,0,0);}
  /* arms: left sleeve covered, right bare */
  P(J.shL,sph(.088),C.robeIn);P(J.shL,cap(.07,d.ua-.1),C.robeIn,[0,-d.ua/2,0]);
  P(J.shR,sph(.08),C.skin2);P(J.shR,cap(.068,d.ua-.1),C.skin2,[0,-d.ua/2,0]);
  for(const s of ['L','R'])P(J['el'+s],cap(.058,d.fa-.09),C.skin2,[0,-d.fa/2,0]);
  ch.hand={};for(const s of ['L','R'])ch.hand[s]=P(J['wr'+s],sph(.054,14,10),C.skin2,[0,-.045,0],0,[.9,1.1,.7]);
  for(const s of ['L','R']){
    P(J['hip'+s],cap(.08,d.thigh-.1),C.pants,[0,-d.thigh/2,0]);
    P(J['kn'+s],cap(.066,d.shin-.08),C.pants,[0,-d.shin/2,0]);
    P(J['kn'+s],cyl(.072,.064,.2,14),C.wrap,[0,-d.shin+.13,0],0,0,.8);
    P(J['an'+s],box(.095,.06,.22),C.shoe,[0,-.045,.05]);
  }
  ch.skirt=new Skirt(ch,{y0:.1,y1:-.56,r0:.17,r1:.34,col:C.robe,legR:.085,rows:9,cols:28,maxOff:.16});
  ch.ropes=[new Rope(ch,{node:J.chest,local:new THREE.Vector3(.1,.25,-.13),n:9,len:.62,w:.075,th:.008,taper:.25,col:C.robeIn,flat:1,drag:1.6,twist:.05})];
  ch.spheres=[[J.hips,new THREE.Vector3(0,0,0),.22],[J.chest,new THREE.Vector3(0,.13,0),.21],[J.spine,new THREE.Vector3(0,.06,0),.2]];
  /* golden bell (v1 hw profile) */
  const pts=[];const Hb=2.6,Wb=Hb*BW/BH;for(let i=0;i<=40;i++){const u=i/40;pts.push(new THREE.Vector2(Math.max(.001,Wb*Math.sqrt(Math.max(0,1-Math.pow(u,4)))*(1-.1*Math.sin(u*Math.PI))),u*Hb));}
  ch.bellMat=new THREE.ShaderMaterial({transparent:true,depthWrite:false,side:THREE.DoubleSide,blending:THREE.AdditiveBlending,uniforms:{uI:{value:0},uT:{value:0}},
    vertexShader:`varying vec3 vN,vV;varying vec2 vUv;void main(){vUv=uv;vec4 mv=modelViewMatrix*vec4(position,1.);vN=normalize(normalMatrix*normal);vV=normalize(-mv.xyz);gl_Position=projectionMatrix*mv;}`,
    fragmentShader:`uniform float uI,uT;varying vec3 vN,vV;varying vec2 vUv;
      float hx(vec2 p){p=abs(p);return max(dot(p,vec2(.866,.5)),p.y);}
      void main(){float fr=pow(1.-abs(dot(vN,vV)),2.);vec2 p=vec2(vUv.x*42.,vUv.y*15.);vec2 r=vec2(1.,1.732),h=r*.5;vec2 a=mod(p,r)-h,b=mod(p-h,r)-h;vec2 g=dot(a,a)<dot(b,b)?a:b;
      float e=smoothstep(.41,.49,hx(g));float sc=exp(-pow((fract(vUv.y-uT*.45)-.5)*12.,2.));
      vec3 c=mix(vec3(1.,.8,.27),vec3(1.,.9,.6),fr);float al=uI*(.05+fr*.7+e*(.22+sc*.5)+sc*.06);gl_FragColor=vec4(c,clamp(al,0.,1.));}`});
  ch.bell=new THREE.Mesh(new THREE.LatheGeometry(pts,72),ch.bellMat);ch.bell.visible=false;ch.bell.renderOrder=5;ch.g.add(ch.bell);
  ch.fxColor=new THREE.Color('#ffcc44');ch.fxColor2=new THREE.Color('#ffe08a');
  return ch;
}

/* ================= cloth: skirt (leg-pushed lathe + spring hem) ================= */
class Skirt{
  constructor(C,o){
    Object.assign(this,o);this.C=C;const Rw=o.rows,Cc=o.cols,n=(Rw+1)*(Cc+1);
    this.pos=new Float32Array(n*3);const idx=[],uv=[];
    for(let r=0;r<=Rw;r++)for(let c=0;c<=Cc;c++){uv.push(c/Cc,r/Rw);if(r<Rw&&c<Cc){const a=r*(Cc+1)+c,b=a+Cc+1;idx.push(a,b,a+1,b,b+1,a+1);}}
    const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.BufferAttribute(this.pos,3));geo.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));geo.setIndex(idx);this.geo=geo;
    const m=new THREE.Mesh(geo,toon(o.col,{side:THREE.DoubleSide}));m.castShadow=true;m.frustumCulled=false;
    const ol=new THREE.Mesh(geo,outline(C.OL,1));ol.frustumCulled=false;m.add(ol);C.J.hips.add(m);
    this.off={x:0,z:0,vx:0,vz:0};this.legs=[0,1].map(()=>[new THREE.Vector3(),new THREE.Vector3(),new THREE.Vector3()]);
    const d=C.d;this.l1=d.thigh;this.l2=d.shin;this.frac=Math.min(1,(o.y0-o.y1)/(d.thigh+d.shin));this.t=0;
  }
  legPt(L,s,out){const dist=s*(this.l1+this.l2);if(dist<this.l1)return out.lerpVectors(L[0],L[1],dist/this.l1);return out.lerpVectors(L[1],L[2],clamp((dist-this.l1)/this.l2));}
  update(dt,relAir){
    const J=this.C.J;this.t+=dt;
    ['L','R'].forEach((s,i)=>{const L=this.legs[i];J.hips.worldToLocal(J['hip'+s].getWorldPosition(L[0]));J.hips.worldToLocal(J['kn'+s].getWorldPosition(L[1]));J.hips.worldToLocal(J['an'+s].getWorldPosition(L[2]));});
    J.hips.getWorldQuaternion(q1).invert();v3.copy(relAir).applyQuaternion(q1);
    const o=this.off,tx=clamp(v3.x*.045,-this.maxOff,this.maxOff),tz=clamp(v3.z*.045,-this.maxOff,this.maxOff);
    if(dt>0){const k=90,dm=10,sub=Math.ceil(dt/STEP),h=dt/sub;for(let i=0;i<sub;i++){o.vx+=((tx-o.x)*k-o.vx*dm)*h;o.vz+=((tz-o.z)*k-o.vz*dm)*h;o.x+=o.vx*h;o.z+=o.vz*h;}}
    const wind=Math.hypot(v3.x,v3.z),Rw=this.rows,Cc=this.cols,P=this.pos;let k=0;
    const gd=v1.set(0,-1,0).applyQuaternion(q1),gx=gd.x*.75,gy=(gd.y+1)*.75,gz=gd.z*.75; // hem falls toward world-down when the body tilts or flips
    for(let r=0;r<=Rw;r++){
      const f=r/Rw,y0=lerp(this.y0,this.y1,f),rad0=lerp(this.r0,this.r1,Math.pow(f,.8)),s=f*this.frac,fo=Math.pow(f,1.6);
      for(let c=0;c<=Cc;c++){
        const ph=c/Cc*Math.PI*2,dx=Math.sin(ph),dz=Math.cos(ph);
        let need=rad0+Math.sin(ph*5+this.t*4.2+f*2)*.006*f*Math.min(1,wind*.3),y=y0;
        for(const L of this.legs){
          this.legPt(L,s,v2);const proj=v2.x*dx+v2.z*dz,lat=Math.abs(v2.x*dz-v2.z*dx),lim=this.legR+.08;
          if(lat<lim&&proj>0){const w=1-lat/lim,nd=proj+this.legR*w+.015;if(nd>need)need=lerp(need,nd,Math.min(1,w*1.7));if(v2.y-.03>y)y=lerp(y,v2.y-.03,w*.8);}
        }
        const dep=(this.y0-y0)*f,ox=o.x*fo+gx*dep,oz=o.z*fo+gz*dep;
        P[k++]=dx*need+ox;P[k++]=y+f*Math.hypot(o.x*fo,o.z*fo)*.45+gy*dep;P[k++]=dz*need+oz;
      }
    }
    this.geo.attributes.position.needsUpdate=true;this.geo.computeVertexNormals();
  }
}

/* ================= cloth: Verlet rope rendered as ribbon / tube ================= */
class Rope{
  constructor(C,o){
    Object.assign(this,{grav:1,drag:2,twist:0},o);this.C=C;const n=o.n;this.seg=o.len/(n-1);this.p=[];this.q=[];
    C.g.updateMatrixWorld(true);const a=this.anchor(new THREE.Vector3());
    for(let i=0;i<n;i++){const v=a.clone();v.y-=i*this.seg;this.p.push(v);this.q.push(v.clone());}
    const M=this.M=o.flat?6:8;this.pos=new Float32Array(n*M*3);const idx=[];
    for(let i=0;i<n-1;i++)for(let k=0;k<M;k++){const A=i*M+k,B=i*M+(k+1)%M,Cc=(i+1)*M+k,Dd=(i+1)*M+(k+1)%M;idx.push(A,B,Cc,B,Dd,Cc);}
    const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.BufferAttribute(this.pos,3));geo.setIndex(idx);this.geo=geo;
    const m=new THREE.Mesh(geo,toon(o.col));m.castShadow=true;m.frustumCulled=false;const ol=new THREE.Mesh(geo,outline(C.OL,.8));ol.frustumCulled=false;m.add(ol);scene.add(m);this.mesh=m;
  }
  anchor(v){return v.copy(this.local).applyMatrix4(this.node.matrixWorld);}
  step(dt,air,time){
    const n=this.p.length,a=this.anchor(v1);this.p[0].copy(a);this.q[0].copy(a);
    for(let i=1;i<n;i++){
      const p=this.p[i],q=this.q[i],fl=1+.5*Math.sin(time*5.1+i*.8)*Math.min(1,air.length()*.25);
      const vx=(p.x-q.x)/dt,vy=(p.y-q.y)/dt,vz=(p.z-q.z)/dt;q.copy(p);
      const ax=this.drag*(air.x*fl-vx),ay=this.drag*(air.y-vy)-9.8*this.grav,az=this.drag*(air.z*fl-vz);
      p.x+=(vx+ax*dt)*dt;p.y+=(vy+ay*dt)*dt;p.z+=(vz+az*dt)*dt;
    }
    for(let it=0;it<6;it++){
      for(let i=1;i<n;i++){const A=this.p[i-1],B=this.p[i];v2.subVectors(B,A);const L=v2.length()||1e-6,df=(L-this.seg)/L;
        if(i===1)B.addScaledVector(v2,-df);else{A.addScaledVector(v2,df*.5);B.addScaledVector(v2,-df*.5);}}
      for(const [nd,lo,rr] of this.C.spheres){v3.copy(lo).applyMatrix4(nd.matrixWorld);for(let i=1;i<n;i++){const p=this.p[i];v2.subVectors(p,v3);const L=v2.length();if(L<rr&&L>1e-6)p.addScaledVector(v2,(rr-L)/L);}}
      const fl=this.C.g.position.y+.01;for(let i=1;i<n;i++)if(this.p[i].y<fl)this.p[i].y=fl;
    }
  }
  build(){
    const n=this.p.length,M=this.M,P=this.pos,T=new THREE.Vector3(),Wd=new THREE.Vector3(),B=new THREE.Vector3(),Nn=new THREE.Vector3();
    Nn.setFromMatrixColumn(this.C.J.hips.matrixWorld,0).normalize();const fw=new THREE.Vector3().setFromMatrixColumn(this.C.J.hips.matrixWorld,2).normalize();
    let k=0;
    for(let i=0;i<n;i++){
      T.subVectors(this.p[Math.min(n-1,i+1)],this.p[Math.max(0,i-1)]).normalize();
      const nn=v1.copy(Nn).applyAxisAngle(T,this.twist*i);if(Math.abs(nn.dot(T))>.92)nn.copy(fw);
      Wd.crossVectors(nn,T).normalize();B.crossVectors(T,Wd);
      const tp=1-this.taper*i/(n-1),w=this.w*tp,th=this.th*tp;
      for(let m=0;m<M;m++){const an=m/M*Math.PI*2,c=Math.cos(an),s=Math.sin(an);const p=this.p[i];
        P[k++]=p.x+Wd.x*c*w+B.x*s*th;P[k++]=p.y+Wd.y*c*w+B.y*s*th;P[k++]=p.z+Wd.z*c*w+B.z*s*th;}
    }
    this.geo.attributes.position.needsUpdate=true;this.geo.computeVertexNormals();
  }
}

/* ================= FX: qi trails, sparks, dust, rings ================= */
class Trail{
  constructor(c1,c2,max=64){
    this.s=[];this.max=max;this.pos=new Float32Array(max*2*3);this.al=new Float32Array(max*2);const side=new Float32Array(max*2),idx=[];
    for(let i=0;i<max;i++){side[i*2]=0;side[i*2+1]=1;if(i<max-1)idx.push(i*2,i*2+1,i*2+2,i*2+1,i*2+3,i*2+2);}
    const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(this.pos,3));g.setAttribute('al',new THREE.BufferAttribute(this.al,1));g.setAttribute('sd',new THREE.BufferAttribute(side,1));g.setIndex(idx);this.geo=g;
    this.mesh=new THREE.Mesh(g,new THREE.ShaderMaterial({transparent:true,depthWrite:false,side:THREE.DoubleSide,blending:THREE.AdditiveBlending,uniforms:{c1:{value:c1},c2:{value:c2}},
      vertexShader:`attribute float al,sd;varying float va,vs;void main(){va=al;vs=sd;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
      fragmentShader:`uniform vec3 c1,c2;varying float va,vs;void main(){vec3 c=mix(c1,c2,vs)+vec3(1.)*pow(vs,8.)*va;float a=clamp(va*(.12+.88*pow(vs,1.4)),0.,1.);gl_FragColor=vec4(clamp(c,0.,2.),a);}`}));
    this.mesh.frustumCulled=false;scene.add(this.mesh);
  }
  add(b,t){this.s.push({b:b.clone(),t:t.clone(),life:1});if(this.s.length>this.max)this.s.shift();}
  decay(dt){for(const x of this.s)x.life-=dt*4.5;while(this.s.length&&this.s[0].life<=0)this.s.shift();}
  build(){const n=this.s.length;for(let i=0;i<n;i++){const x=this.s[i],a=Math.max(0,x.life)*Math.pow((i+1)/n,.6);x.b.toArray(this.pos,i*6);x.t.toArray(this.pos,i*6+3);this.al[i*2]=a;this.al[i*2+1]=a;}
    this.geo.attributes.position.needsUpdate=true;this.geo.attributes.al.needsUpdate=true;this.geo.setDrawRange(0,Math.max(0,n-1)*6);}
}
/* ================= pose state ================= */
const Z=()=>({R:[0,0,0,0,0,0],spine:[0,0,0],chest:[0,0,0],neck:[0,0,0],head:[0,0,0],sL:[0,0,0],sR:[0,0,0],eL:[0],eR:[0],wL:[0,0],wR:[0,0],hL:[0,0,0],hR:[0,0,0],kL:[0],kR:[0],aL:[0,0],aR:[0,0],f:[0,0],G:[1],FF:[1],A:[0],W:[1],V:[0]});
const RI={x:0,y:1,z:2,p:3,yw:4,r:5};
const clone=s=>{const o={};for(const k in s)o[k]=s[k].slice();return o;};
function merge(a,k){const s=clone(a);for(const key in k){if(key==='$b')continue;if(key==='R'){for(const f in k.R)s.R[RI[f]]=k.R[f];}else s[key]=k[key].slice();}return s;}
function lerpState(a,b,u,out){for(const k in a){const A=a[k],B=b[k],O=out[k];for(let i=0;i<A.length;i++)O[i]=A[i]+(B[i]-A[i])*u;}return out;}
function blendState(a,b,u,out){lerpState(a,b,u,out);for(let i=3;i<6;i++){const d=((b.R[i]-a.R[i])%360+540)%360-180;out.R[i]=a.R[i]+d*u;}return out;}
function copyState(a,out){for(const k in a){const A=a[k],O=out[k];for(let i=0;i<A.length;i++)O[i]=A[i];}return out;}
function prep(pose,base){let prev=base;pose.full=pose.keys.map(([t,k])=>{const s=merge(k.$b?base:prev,k);prev=s;return s;});pose.times=pose.keys.map(k=>k[0]);pose.eases=pose.keys.map(k=>E[k[2]||'io']);}
function sample(pose,t,out){const T=pose.times,n=T.length;
  if(n===1||t<=T[0])copyState(pose.full[0],out);else if(t>=T[n-1])copyState(pose.full[n-1],out);
  else{let i=0;while(i<n-2&&t>=T[i+1])i++;lerpState(pose.full[i],pose.full[i+1],pose.eases[i+1]((t-T[i])/(T[i+1]-T[i])),out);}
  if(pose.proc)pose.proc(t,out);return out;}

const BASE_S={spine:[4,0,0],chest:[2,0,0],head:[0,0,0],sL:[10,12,0],eL:[25],sR:[18,10,0],eR:[30],wR:[60,0],hL:[6,6,0],kL:[8],hR:[-4,6,0],kR:[6],f:[.3,0]};
const BASE_M={spine:[6,0,0],chest:[2,0,0],head:[6,0,0],sL:[18,24,0],eL:[70],sR:[18,24,0],eR:[70],hL:[6,14,12],kL:[14],hR:[6,14,12],kR:[14],f:[0,0]};
const ORDER=['idle','run','jump','tuck','flip','land','slash1','slash2','slash3','thrust','block','punch','palm','horse','hit','climb','standoff'];
const CHIP={idle:'待機',run:'奔跑',jump:'起跳',tuck:'空中抱膝',flip:'空翻',land:'落地緩衝',slash1:'斬一',slash2:'斬二',slash3:'斬三',thrust:'突刺',block:'格擋',punch:'出拳',palm:'推掌',horse:'馬步',hit:'受擊',climb:'攀牆',standoff:'對峙'};

function makeLib(key){
  const S=key==='S',base=merge(Z(),S?BASE_S:BASE_M),L={},sc=S?1:1.15;
  const def=(name,label,o)=>{o.name=name;o.label=label;if(!o.noScale){o.dur*=sc;o.keys.forEach(k=>k[0]*=sc);(o.fx||[]).forEach(e=>e.t*=sc);(o.trail||[]).forEach(w=>{w.t=w.t.map(x=>x*sc);});}
    if(!S&&o.monkHands)o.keys.forEach(k=>{const v=k[1];if(!v.$b&&v.sR){v.wR=[-12,0];v.f=[o.monkHands>1?1:0,1];if(o.monkHands>1)v.wL=[-12,0];}});
    prep(o,base);L[name]=o;};
  const breath=(amp,dur)=>(t,P)=>{const b=Math.sin(t*2*Math.PI/dur);P.chest[0]+=amp*b;P.head[0]-=amp*.6*b;P.sL[1]+=amp*.3*b;P.sR[1]+=amp*.3*b;P.head[1]+=2.5*Math.sin(t*2*Math.PI/dur+1);};

  def('idle','待機',{dur:3.2,loop:1,noScale:1,keys:[[0,S?{sL:[-30,18,-30],eL:[80],f:[.8,0],sR:[6,10,0],eR:[10],wR:[70,0]}:{sR:[42,-14,30],eR:[105],wR:[-75,0],f:[0,1],sL:[12,28,0],eL:[75]}]],proc:breath(S?1.6:2.4,3.2)});

  const T=S?.6:.76;
  def('run','奔跑循環',{dur:T,loop:1,noScale:1,keys:[[0,{FF:[.25],V:[S?6.5:5.5]}]],fx:S?[]:[{t:T*.25,type:'step'},{t:T*.75,type:'step'}],proc:(t,P)=>{
    const p=t/T*2*Math.PI,sp=Math.sin(p),sq=-sp,A=S?48:38,Kn=S?82:66;
    const knee=ph=>15+Kn*Math.pow(Math.max(0,Math.cos(ph+.2)),1.3);
    P.hL=[8+A*sp,S?4:10,0];P.kL=[knee(p)];P.hR=[8+A*sq,S?4:10,0];P.kR=[knee(p+Math.PI)];
    P.aL=[-22*Math.cos(p),0];P.aR=[22*Math.cos(p),0];
    P.spine=[S?16:11,0,S?0:4*sp];P.chest=[4,10*sp,0];P.head=[S?-14:-9,-7*sp,0];P.R[4]=-6*sp;
    if(S){P.sL=[5-42*sp,14,0];P.eL=[75];P.f=[.15,0];P.sR=[-40+6*sp,18,10];P.eR=[12];P.wR=[100,0];}
    else{P.sL=[12-42*sp,20,0];P.eL=[95];P.sR=[12+42*sp,20,0];P.eR=[95];P.f=[0,0];}
  }});

  def('jump','起跳',{dur:1.0,keys:[[0,{}],
    [.36,{spine:[S?32:24,0,0],head:[-25,0,0],hL:[75,10,0],kL:[115],hR:[70,10,0],kR:[110],sL:[-55,15,0],eL:[15],sR:[-50,15,0],eR:[15]},'io'],
    [.5,{spine:[-5,0,0],head:[-10,0,0],hL:[5,8,0],kL:[5],hR:[-5,8,0],kR:[10],sL:[160,15,0],eL:[10],sR:[S?150:160,20,0],eR:[10],FF:[0],aL:[40,0],aR:[40,0]},'expo'],
    [.6,{G:[0],R:{y:S?.45:.3}},'out'],
    [1.0,{R:{y:S?.85:.55},hL:[30,8,0],kL:[60],hR:[20,8,0],kR:[70],sL:[110,40,0],sR:[100,45,0]},'out']],
    fx:S?[]:[{t:.5,type:'land'}]});

  def('tuck','空中抱膝',{dur:2,loop:1,noScale:1,keys:[[0,{G:[0],FF:[0],R:{y:S?.9:.6},spine:[S?38:28,0,0],head:[-20,0,0],hL:[S?118:100,14,0],kL:[S?145:125],hR:[S?112:96,14,0],kR:[S?145:125],aL:[45,0],aR:[45,0],
      sL:S?[70,40,-20]:[60,45,0],eL:[S?70:90],sR:S?[85,85,0]:[60,45,0],eR:[S?8:90],wR:[S?90:0,0],f:[S?.6:0,0]}]],
    proc:(t,P)=>{const s=Math.sin(t*Math.PI);P.R[1]+=.05*s;P.R[5]+=4*s;P.R[3]+=6*Math.sin(t*Math.PI+1);}});

  const fd=S?-1:1,fy=S?1.0:.72;
  def('flip',S?'後空翻':'前空翻',{dur:1.45,keys:[[0,{}],
    [.2,{spine:[28,0,0],hL:[65,8,0],kL:[100],hR:[60,8,0],kR:[95],sL:[-45,15,0],eL:[15],sR:[-40,15,0],eR:[15]},'io'],
    [.34,{G:[0],FF:[0],R:{y:.35*fy,p:fd*30},spine:[-10,0,0],head:[-15,0,0],hL:[0,8,0],kL:[5],hR:[-5,8,0],kR:[8],sL:[165,10,0],eL:[10],sR:[160,15,0],eR:[10],aL:[40,0],aR:[40,0]},'out'],
    [.62,{R:{y:fy,p:fd*180},spine:[38,0,0],head:[0,0,0],hL:[120,12,0],kL:[145],hR:[115,12,0],kR:[145],sL:[70,30,0],eL:[80],sR:[80,70,0],eR:[20]},'io'],
    [.9,{R:{y:.55*fy,p:fd*320},spine:[10,0,0],hL:[35,8,0],kL:[40],hR:[30,8,0],kR:[45],sL:[60,60,0],eL:[20],sR:[70,80,0],eR:[10]},'io'],
    [1.0,{G:[1],FF:[1],R:{y:0,p:fd*360},spine:[25,0,0],hL:[60,10,0],kL:[95],hR:[55,10,0],kR:[90],sL:[50,50,0],sR:[50,60,0]},'in'],
    [1.45,{$b:1,R:{p:fd*360}},'io']],fx:[{t:1.0,type:'land'}]});

  def('land','落地緩衝',{dur:1.0,keys:[
    [0,{G:[0],FF:[0],R:{y:S?.55:.4},spine:[0,0,0],hL:[35,8,0],kL:[30],hR:[25,8,0],kR:[40],sL:[120,60,0],eL:[15],sR:[110,70,0],eR:[10],aL:[35,0],aR:[35,0]}],
    [.16,{G:[1],FF:[1],R:{y:0},hL:[30,8,0],kL:[35],hR:[25,8,0],kR:[40]},'in'],
    [.27,{spine:[S?35:30,0,0],head:[-28,0,0],hL:[S?80:85,14,S?0:15],kL:[S?125:130],hR:[S?75:85,14,S?0:15],kR:[S?120:130],sL:[S?70:40,S?75:40,0],eL:[S?10:60],sR:[S?60:40,S?80:40,0],eR:[S?5:60]},'out'],
    [.62,{spine:[18,0,0],head:[-10,0,0],hL:[40,10,0],kL:[60],hR:[35,10,0],kR:[55],sL:[40,40,0],sR:[40,40,0],eL:[30],eR:[25]},'io'],
    [1.0,{$b:1},'io']],fx:[{t:.16,type:'land'}]});

  def('slash1',S?'斬・橫掃':'手刀・橫劈',{dur:1.0,monkHands:1,keys:[[0,{$b:1}],
    [.3,{spine:[8,25,0],chest:[4,30,0],head:[-5,-35,0],sR:[85,-65,-40],eR:[75],wR:[70,0],sL:[45,40,0],eL:[60],hL:[30,10,0],kL:[35],hR:[-20,8,0],kR:[20]},'io'],
    [.42,{spine:[10,-20,0],chest:[4,-35,0],head:[-5,25,0],sR:[92,95,0],eR:[0],wR:[85,0],sL:[30,70,0],eL:[20]},'expo'],
    [.62,{spine:[10,-28,0],chest:[4,-45,0],sR:[85,120,10],eR:[5]},'out'],
    [1.0,{$b:1},'io']],fx:[{t:.4,type:'hit',at:S?'tip':'wrR'}],trail:[{t:[.3,.64],at:S?'tip':'wrR'}]});

  def('slash2',S?'斬・上撩':'手刀・上撩',{dur:1.05,monkHands:1,keys:[[0,{$b:1}],
    [.32,{spine:[25,25,0],chest:[8,20,0],head:[-20,-20,0],sR:[25,-45,-30],eR:[35],wR:[100,0],sL:[30,40,0],eL:[50],hL:[45,10,0],kL:[70],hR:[-10,8,0],kR:[45]},'io'],
    [.46,{spine:[-12,-15,0],chest:[-5,-25,0],head:[-15,15,0],sR:[165,55,20],eR:[5],wR:[60,0],sL:[60,80,0],eL:[10],hL:[10,8,0],kL:[5],hR:[-20,8,0],kR:[5],FF:[.5]},'expo'],
    [.66,{sR:[175,70,20],chest:[-8,-30,0]},'out'],
    [1.05,{$b:1},'io']],fx:[{t:.44,type:'hit',at:S?'tip':'wrR'}],trail:[{t:[.32,.68],at:S?'tip':'wrR'}]});

  def('slash3',S?'斬・下劈':'雙掌・下劈',{dur:1.15,monkHands:2,keys:[[0,{$b:1}],
    [.34,{spine:[-14,0,0],chest:[-8,0,0],head:[-12,0,0],sR:[175,5,0],eR:[45],wR:[-40,0],sL:[165,-5,0],eL:[50],hL:[55,6,0],kL:[80],hR:[-6,6,0],kR:[10]},'io'],
    [.48,{spine:[34,0,0],chest:[10,0,0],head:[-30,0,0],sR:[55,-5,0],eR:[0],wR:[75,0],sL:[48,-18,0],eL:[25],hL:[70,8,0],kL:[85],hR:[-35,8,0],kR:[10],R:{z:.3}},'expo'],
    [.8,{},'out'],
    [1.15,{$b:1},'io']],fx:[{t:.47,type:'hit',at:S?'tip':'both'}],trail:S?[{t:[.34,.62],at:'tip'}]:[{t:[.34,.62],at:'wrR'},{t:[.34,.62],at:'wrL'}]});

  def('thrust',S?'突刺':'貫手・突刺',{dur:1.1,monkHands:1,keys:[[0,{$b:1}],
    [.3,{spine:[0,-30,0],chest:[0,-15,0],head:[-5,40,0],sR:[45,30,-20],eR:[115],wR:[80,0],sL:[88,-5,0],eL:[8],wL:[-80,0],f:[1,0],hL:[30,8,0],kL:[15],hR:[5,10,0],kR:[50]},'io'],
    [.42,{spine:[18,25,0],chest:[4,10,0],head:[-15,-20,0],sR:[92,5,0],eR:[0],wR:[90,0],sL:[-35,35,0],eL:[10],wL:[-40,0],hL:[72,8,0],kL:[88],hR:[-35,8,0],kR:[4],R:{z:.38}},'expo'],
    [.75,{},'out'],
    [1.1,{$b:1},'io']],fx:[{t:.41,type:'hit',at:S?'tip':'wrR'}],trail:[{t:[.3,.6],at:S?'tip':'wrR'}]});

  def('block','格擋',{dur:1.3,keys:S?[[0,{$b:1}],
    [.25,{spine:[-4,10,0],chest:[0,15,0],head:[-8,-10,0],sR:[70,-25,-60],eR:[95],wR:[20,0],sL:[75,-35,0],eL:[105],wL:[-60,0],f:[1,0],hL:[25,10,0],kL:[30],hR:[-15,10,0],kR:[35]},'out'],
    [.42,{R:{z:-.08},spine:[-10,10,0],head:[-14,-10,0]},'expo'],[.8,{R:{z:0},spine:[-4,10,0]},'io'],[1.3,{},'lin']]
   :[[0,{$b:1}],
    [.25,{sL:[100,-38,10],eL:[100],sR:[100,-38,10],eR:[100],f:[0,0],hL:[30,22,15],kL:[45],hR:[-5,22,15],kR:[40],spine:[4,0,0],head:[-2,0,0],A:[.25]},'out'],
    [.42,{R:{z:-.05},spine:[-2,0,0],A:[1]},'expo'],[.8,{R:{z:0},spine:[4,0,0],A:[.35]},'io'],[1.3,{A:[0]},'io']],
    fx:S?[{t:.4,type:'hit',at:'mid'}]:[{t:.4,type:'hit',at:'both'},{t:.4,type:'bell'}]});

  def('punch','出拳',{dur:.95,keys:S?[[0,{$b:1}],
    [.25,{spine:[5,15,0],chest:[0,20,0],sL:[-25,15,0],eL:[110],f:[0,0],sR:[-30,20,0],eR:[10],wR:[100,0],hL:[25,8,0],kL:[30],hR:[-15,8,0],kR:[25]},'io'],
    [.36,{spine:[10,-15,0],chest:[2,-25,0],sL:[90,-5,0],eL:[0],R:{z:.12},hL:[45,8,0],kL:[50]},'expo'],[.6,{},'out'],[.95,{$b:1},'io']]
   :[[0,{$b:1}],
    [.28,{spine:[4,-15,0],chest:[0,-20,0],sR:[-25,18,0],eR:[120],sL:[85,0,0],eL:[5],f:[0,0],hL:[45,30,25],kL:[70],hR:[45,30,25],kR:[70]},'io'],
    [.4,{spine:[6,20,0],chest:[2,25,0],sR:[88,-2,0],eR:[0],sL:[-25,18,0],eL:[120],R:{z:.1}},'expo'],[.65,{},'out'],[.95,{$b:1},'io']],
    fx:[{t:S?.35:.39,type:'hit',at:S?'wrL':'wrR'}],trail:[{t:S?[.25,.5]:[.28,.55],at:S?'wrL':'wrR'}]});

  def('palm','推掌',{dur:1.3,keys:S?[[0,{$b:1}],
    [.3,{spine:[2,15,0],chest:[-4,20,0],sL:[20,30,0],eL:[120],wL:[-60,0],f:[1,0],sR:[-30,20,0],eR:[10],wR:[100,0],hL:[30,10,0],kL:[35],hR:[-15,10,0],kR:[30]},'io'],
    [.42,{spine:[12,-15,0],chest:[2,-25,0],sL:[88,-4,0],eL:[2],wL:[-82,0],R:{z:.15},hL:[50,8,0],kL:[55]},'expo'],[.8,{},'out'],[1.3,{$b:1},'io']]
   :[[0,{$b:1}],
    [.36,{hL:[60,40,30],kL:[90],hR:[60,40,30],kR:[90],spine:[0,0,0],chest:[-6,0,0],sL:[-15,20,0],eL:[115],wL:[-30,0],sR:[-15,20,0],eR:[115],wR:[-30,0],f:[1,1],A:[.35]},'io'],
    [.5,{spine:[10,0,0],chest:[4,0,0],sL:[85,6,0],eL:[4],wL:[-80,0],sR:[85,6,0],eR:[4],wR:[-80,0],R:{z:.12},A:[1]},'expo'],[.9,{A:[.6]},'out'],[1.3,{$b:1},'io']],
    fx:S?[{t:.41,type:'hit',at:'wrL'}]:[{t:.49,type:'hit',at:'both'},{t:.49,type:'bell'}],trail:S?[{t:[.3,.55],at:'wrL'}]:[{t:[.38,.62],at:'wrR'},{t:[.38,.62],at:'wrL'}]});

  def('horse','馬步',{dur:2.4,keys:[[0,{$b:1}],
    [.6,S?{hL:[55,40,35],kL:[85],hR:[55,40,35],kR:[85],spine:[2,0,0],sL:[-15,20,0],eL:[110],f:[0,0],sR:[30,50,0],eR:[20],wR:[90,0]}
          :{hL:[68,44,38],kL:[95],hR:[68,44,38],kR:[95],spine:[0,0,0],sL:[-18,22,0],eL:[115],sR:[-18,22,0],eR:[115],f:[0,0],A:[.45]},'io']],
    proc:(t,P)=>{const b=Math.sin(t*2.6);P.chest[0]+=1.5*b;if(!S)P.A[0]*=.8+.2*b;}});

  def('hit','受擊',{dur:1.0,keys:[[0,{$b:1}],
    [.07,{R:{z:S?-.12:-.07},spine:[S?-22:-12,0,0],chest:[S?-15:-8,0,0],head:[-30,0,10],sL:[45,55,0],eL:[25],sR:[40,55,0],eR:[20],hL:[15,8,0],kL:[20],hR:[-10,8,0],kR:[15]},'expo'],
    [.3,{R:{z:S?-.3:-.16},spine:[S?28:18,0,0],chest:[10,0,0],head:[5,0,-5],sL:[30,30,0],eL:[50],sR:[25,35,0],eR:[40],hL:[35,10,0],kL:[60],hR:[10,10,0],kR:[55]},'out'],
    [1.0,{$b:1},'io']],fx:[{t:.03,type:'hit',at:'chest'}]});

  const TC=S?1.0:1.25;
  def('climb','攀牆',{dur:TC,loop:1,noScale:1,wall:1,keys:[[0,{G:[0],FF:[0],R:{y:S?.25:.2},spine:[8,0,0],head:[-25,0,0],f:[S?1:1,S?0:1]}]],proc:(t,P)=>{
    const p=t/TC*2*Math.PI,s=Math.sin(p);
    P.sL=[150+20*s,20,0];P.eL=[45-35*s];P.sR=[150-20*s,20,0];P.eR=[45+35*s];P.wL=[-40,0];P.wR=[S?60:-40,0];
    P.hL=[60-35*s,15,20];P.kL=[95-20*s];P.hR=[60+35*s,15,20];P.kR=[95+20*s];P.aL=[30,0];P.aR=[30,0];
    P.R[1]+=.05*Math.sin(2*p);P.R[5]=3*s;
  }});

  def('standoff','對峙',{dur:3.2,loop:1,noScale:1,keys:[[0,S?{sR:[-20,25,-40],eR:[40],wR:[120,0],sL:[55,10,0],eL:[15],wL:[-20,0],f:[1,0],spine:[0,-15,0],chest:[-2,-10,0],head:[-6,22,0],hL:[12,10,10],kL:[8],hR:[-8,10,10],kR:[5],W:[1.9]}
      :{sR:[42,-14,30],eR:[105],wR:[-75,0],f:[0,1],sL:[-30,20,-30],eL:[80],hL:[8,16,14],kL:[10],hR:[4,16,14],kR:[10],head:[6,0,0],W:[1.9]}]],proc:breath(S?1.2:1.8,3.2)});
  return L;
}

/* ================= apply pose ================= */
function limb(g,a,side){const l=a[0]*D;AX.set(0,Math.sin(l),Math.cos(l));qa.setFromAxisAngle(AX,side*a[1]*D);qb.setFromAxisAngle(XA,-l);qc.setFromAxisAngle(YA,side*a[2]*D);g.quaternion.copy(qa).multiply(qb).multiply(qc);}
function applyPose(C,P){
  const J=C.J,d=C.d,Rr=P.R;
  J.hips.position.set(Rr[0],d.hipY+Rr[1],Rr[2]);J.hips.rotation.set(Rr[3]*D,Rr[4]*D,Rr[5]*D,'YXZ');
  for(const n of ['spine','chest','neck','head'])J[n].rotation.set(P[n][0]*D,P[n][1]*D,P[n][2]*D,'YXZ');
  limb(J.shL,P.sL,1);limb(J.shR,P.sR,-1);limb(J.hipL,P.hL,1);limb(J.hipR,P.hR,-1);
  J.elL.rotation.set(-P.eL[0]*D,0,0);J.elR.rotation.set(-P.eR[0]*D,0,0);
  J.knL.rotation.set(P.kL[0]*D,0,0);J.knR.rotation.set(P.kR[0]*D,0,0);
  J.wrL.rotation.set(P.wL[0]*D,0,P.wL[1]*D);J.wrR.rotation.set(P.wR[0]*D,0,-P.wR[1]*D);
  J.anL.rotation.set(P.aL[0]*D,0,P.aL[1]*D);J.anR.rotation.set(P.aR[0]*D,0,-P.aR[1]*D);
  for(const [s,i] of [['L',0],['R',1]]){const o=P.f[i],h=C.hand[s];h.scale.set(lerp(.85,.78,o),lerp(1.15,1.6,o),lerp(.65,.42,o));h.position.y=lerp(-.04,-.06,o)*(C.key==='M'?1.15:1);}
  C.g.updateMatrixWorld(true);
  const ff=P.FF[0];
  if(ff>0)for(const [s,sd,h] of [['L',1,P.hL],['R',-1,P.hR]]){J['kn'+s].getWorldQuaternion(q1);q2.copy(C.g.quaternion).multiply(qc.setFromAxisAngle(YA,sd*(h[2]+h[1]*.3)*D));q1.invert().multiply(q2);J['an'+s].quaternion.slerp(q1,ff);}
  const sole=Math.min(J.anL.getWorldPosition(v1).y,J.anR.getWorldPosition(v2).y)-d.foot-C.g.position.y;
  let dy=-sole*P.G[0];if(sole+dy<0)dy=-sole;J.hips.position.y+=dy;
  C.g.updateMatrixWorld(true);
}
function pointOf(C,at,out){
  const J=C.J;
  if(at==='tip'&&C.sword)return out.set(0,0,1.0).applyMatrix4(C.sword.matrixWorld);
  if(at==='mid'&&C.sword)return out.set(0,0,.5).applyMatrix4(C.sword.matrixWorld);
  if(at==='wrL')return out.set(0,-.07,0).applyMatrix4(J.wrL.matrixWorld);
  if(at==='chest')return out.set(0,.15,.14).applyMatrix4(J.chest.matrixWorld);
  if(at==='both'){out.set(0,-.07,0).applyMatrix4(J.wrL.matrixWorld);v3.set(0,-.07,0).applyMatrix4(J.wrR.matrixWorld);return out.add(v3).multiplyScalar(.5);}
  return out.set(0,-.07,0).applyMatrix4(J.wrR.matrixWorld);
}


/* ================= film: actors on a timeline ================= */
/* A track is a list of segments {t, pose, at, to, move, arc, ease, yaw, yawTo, face, speed, off, blend, fx, trail}:
   from act time t the actor plays `pose` (looped or held), its root slides at→to over `move` s (default: until the next segment),
   lifted by a parabola of height `arc`; yaw is explicit, follows the motion, or faces the other actor. Everything but cloth is a pure
   function of time; cloth, ribbons and trails are stepped at 120 Hz from a short pre-roll whenever time jumps. */
const angLerp=(a,b,u)=>{const d=((b-a)%(2*Math.PI)+3*Math.PI)%(2*Math.PI)-Math.PI;return a+d*u;};
const V3=(a)=>a&&(a.isVector3?a.clone():new THREE.Vector3(...a));
class Actor{
  constructor(ch,lib){Object.assign(this,{ch,lib,segs:[],cur:Z(),prv:Z(),root:new THREE.Vector3(),yaw:0,shown:true,lt:0,
    trails:{R:new Trail(ch.fxColor,ch.fxColor2),L:new Trail(ch.fxColor,ch.fxColor2)},prevHip:new THREE.Vector3(),hipVel:new THREE.Vector3()});}
  track(list){
    let at=new THREE.Vector3(),yaw=0;
    this.segs=list.map((s,i)=>{const o=Object.assign({speed:1,off:0,blend:.22,ease:'lin'},s);
      o.A=V3(s.at)||at.clone();o.B=V3(s.to)||o.A.clone();
      const end=list[i+1]?list[i+1].t:o.t+(s.move||1e6);o.end=end;o.move=s.move||(end-o.t);
      const dx=o.B.x-o.A.x,dz=o.B.z-o.A.z;o.Y0=s.yaw!=null?s.yaw:Math.hypot(dx,dz)>.05?Math.atan2(dx,dz):yaw;o.Y1=s.yawTo!=null?s.yawTo:o.Y0;
      at=o.B.clone();yaw=o.Y1;return o;});
    return this;
  }
  segAt(t){const S=this.segs;let i=0;while(i<S.length-1&&t>=S[i+1].t)i++;return i;}
  rootAt(t,out=new THREE.Vector3()){const s=this.segs[this.segAt(t)],u=clamp((t-s.t)/s.move);out.lerpVectors(s.A,s.B,E[s.ease](u));if(s.gfn)out.y=s.gfn(out.x,out.z);if(s.arc)out.y+=4*s.arc*u*(1-u);return out;}
  yawAt(s,t){if(s.face){const o=this.other.rootAt(t,new THREE.Vector3()),m=this.rootAt(t,new THREE.Vector3());return Math.atan2(o.x-m.x,o.z-m.z)+(s.yaw||0);}return angLerp(s.Y0,s.Y1,E.io(clamp((t-s.t)/s.move)));}
  poseAt(s,t,out){const p=this.lib[s.pose],lt=(t-s.t)*s.speed+s.off;sample(p,p.loop?((lt%p.dur)+p.dur)%p.dur:clamp(lt,0,p.dur),out);return lt;}
  eval(t){
    const i=this.segAt(t),s=this.segs[i];
    this.lt=this.poseAt(s,t,this.cur);let yaw=this.yawAt(s,t);
    if(i>0&&t-s.t<s.blend){const p=this.segs[i-1],u=E.io((t-s.t)/s.blend);this.poseAt(p,t,this.prv);blendState(this.prv,this.cur,u,this.cur);yaw=angLerp(this.yawAt(p,t),yaw,u);}
    this.seg=s;this.yaw=yaw;this.rootAt(t,this.root);
    const g=this.ch.g;g.position.copy(this.root);g.rotation.set(0,yaw,0);applyPose(this.ch,this.cur);
  }
  trailOn(){const p=this.lib[this.seg.pose],lt=p.loop?this.lt%p.dur:this.lt;return(p.trail||[]).concat(this.seg.trail||[]).filter(w=>lt>=w.t[0]&&lt<=w.t[1]);}
  show(v){this.shown=v;const c=this.ch;c.g.visible=v;if(this.P){this.P.root.visible=v;if(this.P.sword)this.P.sword.visible=v;}else for(const r of c.ropes)r.mesh.visible=v;this.trails.R.mesh.visible=this.trails.L.mesh.visible=v;if(c.bell&&!v)c.bell.visible=false;}
}

/* bursts: every spark and dust puff of a scene is known in advance, so they are one pure-time particle system */
function softDot(){const c=document.createElement('canvas');c.width=c.height=64;const g=c.getContext('2d'),r=g.createRadialGradient(32,32,0,32,32,32);r.addColorStop(0,'#fff');r.addColorStop(.35,'rgba(255,255,255,.8)');r.addColorStop(1,'rgba(255,255,255,0)');g.fillStyle=r;g.fillRect(0,0,64,64);return new THREE.CanvasTexture(c);}
function makeBursts(list,add=true){
  const n=Math.max(1,list.reduce((a,b)=>a+b.n,0)),O=new Float32Array(n*3),Vv=new Float32Array(n*3),T=new Float32Array(n*4).fill(-99),Cc=new Float32Array(n*3),Rr=mulberry32(77);let k=0;
  for(const b of list)for(let j=0;j<b.n;j++,k++){const th=Rr()*6.283,ph=Math.acos(Rr()*2-1),s=b.sp*(.3+.7*Rr());
    b.p.toArray(O,k*3);
    if(b.flat){Vv[k*3]=Math.cos(th)*s;Vv[k*3+1]=Rr()*.3;Vv[k*3+2]=Math.sin(th)*s;}else{Vv[k*3]=Math.sin(ph)*Math.cos(th)*s;Vv[k*3+1]=Math.cos(ph)*s+(b.up||0);Vv[k*3+2]=Math.sin(ph)*Math.sin(th)*s;}
    T.set([b.t,b.life*(.5+.5*Rr()),b.size,b.grav??5],k*4);b.c.toArray(Cc,k*3);}
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(O,3));g.setAttribute('aV',new THREE.BufferAttribute(Vv,3));g.setAttribute('aT',new THREE.BufferAttribute(T,4));g.setAttribute('aC',new THREE.BufferAttribute(Cc,3));
  const uni={uT:{value:0},uMap:{value:softDot()}};
  const pts=new THREE.Points(g,new THREE.ShaderMaterial({uniforms:uni,transparent:true,depthWrite:false,blending:add?THREE.AdditiveBlending:THREE.NormalBlending,
    vertexShader:`uniform float uT;attribute vec3 aV,aC;attribute vec4 aT;varying vec3 vC;varying float vA;
      void main(){float a=uT-aT.x;if(a<0.||a>aT.y){gl_Position=vec4(2.,2.,2.,1.);return;}float l=a/aT.y;
        vec3 w=position+aV*(1.-exp(-3.*a))/3.-vec3(0.,aT.w*a*a*.5,0.);vC=aC;vA=(1.-l)*(1.-l);
        vec4 mv=viewMatrix*vec4(w,1.);if(-mv.z<.8){gl_Position=vec4(2.,2.,2.,1.);return;}gl_Position=projectionMatrix*mv;gl_PointSize=min(aT.z*(1.-l*.5)*projectionMatrix[1][1]*540./-mv.z,160.);}`,
    fragmentShader:`uniform sampler2D uMap;varying vec3 vC;varying float vA;void main(){float a=texture2D(uMap,gl_PointCoord).a;gl_FragColor=${add?'vec4(vC*vA*a*2.,1.)':'vec4(vC,vA*a*.55)'};}`}));
  pts.frustumCulled=false;scene.add(pts);return uni;
}

export function makeCast(sc,{wind=[-1.6,0,.35],people=null}={}){
  scene=sc;
  /* with the realistic leads loaded, size the puppeteer rigs to their skeletons */
  if(people)for(const k of ['S','M']){const d=people[k].dim;Object.assign(DIM[k],{hipY:d.hipY+.02,thigh:d.thigh,shin:d.shin,hipX:d.hipX,spine:d.spine-.03,chest:d.shY+.05,neck:d.neck,shX:d.shX,ua:d.ua,fa:d.fa,foot:d.foot});}
  const S=new Actor(makeSwordsman(),makeLib('S')),M=new Actor(makeMonk(),makeLib('M'));S.other=M;M.other=S;
  if(people)for(const [A,k] of [[S,'S'],[M,'M']]){const ch=A.ch,P=people[k];A.P=P;
    ch.g.traverse(o=>{if(o.isMesh&&o!==ch.bell)o.visible=false;});for(const r of ch.ropes)r.mesh.visible=false;ch.skirt.geo.setDrawRange(0,0);
    ch.g.position.set(0,0,0);ch.g.rotation.set(0,0,0);applyPose(ch,Z());calibrate(P,ch,scene);}
  const W=new THREE.Vector3(...wind),air=new THREE.Vector3(),rel=new THREE.Vector3();
  const ringGeo=new THREE.RingGeometry(.88,1,64),rings=[];let bursts=null;
  /* a soft fill that rides with the camera, as a film crew would light faces: constant illuminance on the nearest lead */
  const fill=new THREE.SpotLight(0xdfe6ff,0,4,.75,.8,2);scene.add(fill,fill.target);
  const cast={S,M,all:[S,M],events:[],simT:-1e9,wind:W,fillK:.9,fill,bellK:1,
    /* call once after the tracks are set: collects every hit/land/step/bell event with its world position */
    bake(){
      const ev=[];
      for(const A of cast.all)A.segs.forEach((s)=>{const p=A.lib[s.pose],rep=p.loop&&s.speed>0?p.dur/s.speed:0;
        const fx=(s.speed>0?(p.fx||[]).map(e=>({...e,t:(e.t-s.off)/s.speed,rep})):[]).concat((s.fx||[]).map(e=>({...e,rep:0})));   /* a frozen (speed 0) segment fires nothing */
        for(const e of fx)for(let te=s.t+e.t;te<s.end;te+=e.rep||1e9){if(te<s.t)continue;A.eval(te);
          ev.push({t:te,type:e.type,who:A===S?'S':'M',heavy:e.heavy??A===M,big:e.big??s.big,p:pointOf(A.ch,e.at||'wrR',new THREE.Vector3()).clone(),
            foot:[A.ch.J.anL.getWorldPosition(new THREE.Vector3()),A.ch.J.anR.getWorldPosition(new THREE.Vector3())],ground:A.root.y,root:A.root.clone()});if(!e.rep)break;}});
      ev.sort((a,b)=>a.t-b.t);cast.events=ev;
      const L=[],Ld=[],gold=new THREE.Color('#ffcc44');
      for(const e of ev){const C=e.who==='S'?S.ch:M.ch;
        if(e.type==='hit'){L.push({t:e.t,p:e.p,c:C.fxColor2,n:e.heavy?40:30,sp:e.heavy?5:6,life:.5,size:.05});rings.push({t:e.t,p:e.p,c:C.fxColor,s:e.heavy?.6:.45,d:.3,bill:1,o:.45},{t:e.t,p:e.p,c:new THREE.Color(1,1,1),s:e.heavy?.32:.25,d:.18,bill:1,o:.6});}
        else if(e.type==='land'||e.type==='step'){const big=e.type==='land'&&(e.who==='M'||e.big);
          for(const f of e.foot){if(f.y-e.ground>.3)continue;Ld.push({t:e.t,p:new THREE.Vector3(f.x,e.ground+.05,f.z),c:new THREE.Color(.2,.18,.19),n:big?16:6,sp:big?2.2:1,life:big?1.1:.7,size:big?.5:.25,flat:1,grav:-.4});}
          if(big)rings.push({t:e.t,p:new THREE.Vector3(e.root.x,e.ground+.04,e.root.z),c:gold,s:e.big?4:1.6,d:.5,bill:0});}
        else if(e.type==='bell'){const p=e.root.clone();p.y+=.04;rings.push({t:e.t,p,c:M.ch.fxColor,s:3.2,d:.7,bill:0});L.push({t:e.t,p:p.clone().setY(p.y+1.2),c:M.ch.fxColor2,n:60,sp:3,up:1.5,life:.6,size:.05});}}
      for(const r of rings){r.m=new THREE.Mesh(ringGeo,new THREE.MeshBasicMaterial({color:r.c,transparent:true,opacity:0,depthWrite:false,blending:THREE.AdditiveBlending,side:THREE.DoubleSide,fog:false}));r.m.position.copy(r.p);if(!r.bill)r.m.rotation.x=-Math.PI/2;r.m.visible=false;scene.add(r.m);}
      bursts=[makeBursts(L),makeBursts(Ld,false)];cast.simT=-1e9;return ev;
    },
    /* camera punch: decaying shake and a soft white flash after each hit */
    kick(t){let sh=0,fl=0;for(const e of cast.events){const a=t-e.t;if(a<0||a>.6||e.type!=='hit'&&!(e.type==='land'&&e.who==='M'))continue;
      const k=Math.exp(-a*14);sh=Math.max(sh,(e.type==='hit'?(e.heavy?.07:.05):.06)*k);if(e.type==='hit')fl=Math.max(fl,(e.heavy?.55:.45)*Math.exp(-a*16));}return{shake:sh,flash:fl};},
    step(dt,t){
      for(const A of cast.all){A.eval(t);const C=A.ch;
        C.J.hips.getWorldPosition(v1);A.hipVel.subVectors(v1,A.prevHip).divideScalar(dt);A.prevHip.copy(v1);
        air.copy(W).multiplyScalar(A.cur.W[0]*(1+.45*Math.sin(t*.7)+.25*Math.sin(t*2.3)));
        if(!A.P)for(const r of C.ropes)r.step(dt,air,t);
        for(const w of A.trailOn()){const tr=w.at==='wrL'?A.trails.L:A.trails.R;
          if(w.at==='tip')tr.add(v1.set(0,0,.15).applyMatrix4(C.sword.matrixWorld),v3.set(0,0,1.02).applyMatrix4(C.sword.matrixWorld));
          else{const wj=w.at==='wrL'?C.J.wrL:C.J.wrR;tr.add(v1.set(0,.02,0).applyMatrix4(wj.matrixWorld),v3.set(0,-.16,0).applyMatrix4(wj.matrixWorld));}}
        A.trails.R.decay(dt);A.trails.L.decay(dt);}
    },
    update(t,cam){
      let fdt=t-cast.simT;
      if(!(fdt>=-1e-6&&fdt<.5)){/* cold start or a jump in time: pre-roll .8 s so the cloth has settled */
        cast.simT=t-.8;for(const A of cast.all){A.eval(cast.simT);A.ch.J.hips.getWorldPosition(A.prevHip);A.trails.R.s.length=A.trails.L.s.length=0;
          for(const r of A.ch.ropes){const a=r.anchor(v1);r.p.forEach((p,i)=>{p.copy(a);p.y-=i*r.seg;r.q[i].copy(p);});}
          Object.assign(A.ch.skirt.off,{x:0,z:0,vx:0,vz:0});}
        fdt=.8;}
      while(cast.simT+STEP<=t+1e-9){cast.simT+=STEP;cast.step(STEP,cast.simT);}
      for(const A of cast.all){A.eval(t);const C=A.ch;if(!A.shown)continue;
        if(A.P)retarget(A.P,C,A===S?[A.cur.f[0],1]:A.cur.f);
        else{rel.copy(W).multiplyScalar(A.cur.W[0]).sub(A.hipVel);C.skirt.update(Math.min(fdt,.25),rel);for(const r of C.ropes)r.build();}A.trails.R.build();A.trails.L.build();
        if(C.bell){let pulse=0;for(const e of cast.events)if(e.type==='bell'&&e.who==='M'&&t>=e.t)pulse=Math.max(pulse,(1-(t-e.t)*2.2)*(e.big||!A.P?1:.25));
          const a=A.P?A.cur.A[0]*.12+pulse*.55:Math.min(1.4,A.cur.A[0]+pulse*.9);C.bell.visible=a>.01;C.bellMat.uniforms.uI.value=a*cast.bellK;C.bellMat.uniforms.uT.value=t;}
        if(C.bladeMat)C.bladeMat.emissive.setHex(A.trailOn().length?0x6ab8ff:0x3a5a88);}
      if(people){let best=null,bd=1e9;for(const A of cast.all){if(!A.shown)continue;const d=A.root.distanceTo(cam.position);if(d<bd){bd=d;best=A;}}
        if(best&&bd<40){v2.copy(best.root).setY(best.root.y+1.45);v1.copy(cam.position).sub(v2).setY(0).normalize();fill.position.copy(v2).addScaledVector(v1,1.5).add(v3.set(0,.5,0));fill.target.position.copy(v2).setY(best.root.y+1.0);fill.angle=.75;fill.intensity=cast.fillK*2.6;fill.distance=4;}else fill.intensity=0;}
      if(bursts)for(const b of bursts)b.uT.value=t;
      for(const r of rings){const a=t-r.t;r.m.visible=a>=0&&a<r.d;if(!r.m.visible)continue;const u=a/r.d,s=r.s*E.out(u);r.m.scale.set(s,s,s);r.m.material.opacity=(1-u)*(r.o??.9);if(r.bill)r.m.quaternion.copy(cam.quaternion);}
    },
  };
  return cast;
}

/* shared with the mocap cast */
export {Trail, makeBursts};
export function useScene(s){scene=s;}
