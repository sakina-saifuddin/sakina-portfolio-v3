import * as THREE from "three";
import {LookControls} from "./look-controls.js?v=20";
import {createSfx} from "./sfx.js?v=5";
import {createNotebook} from "./notebook.js?v=7";
import {createFrames} from "./frames.js?v=4";
import {GLTFLoader} from "three/addons/loaders/GLTFLoader.js";
import {DRACOLoader} from "three/addons/loaders/DRACOLoader.js";
import {projects,ibm,notepad,credits} from "./content.js";
import {Ambience} from "./audio.js";
import {pad} from "./pad-content.js";
import {makePadTexture,PAD,UNDER,PAD_ROWS,PAD_W,PAD_H} from "./pad-texture.js";
import {createTapeDeck} from "./tape-deck.js?v=4";
import {makeIbmTerminal} from "./ibm-terminal.js?v=6";
import {addIbmLights} from "./ibm-lights.js?v=2";
import {createCityLife} from "./city-life.js?v=3";
import {createPhone} from "./phone.js?v=6";
import {EffectComposer} from "three/addons/postprocessing/EffectComposer.js";
import {RenderPass} from "three/addons/postprocessing/RenderPass.js";
import {UnrealBloomPass} from "three/addons/postprocessing/UnrealBloomPass.js";
import {OutputPass} from "three/addons/postprocessing/OutputPass.js";
import {ShaderPass} from "three/addons/postprocessing/ShaderPass.js";

const $=id=>document.getElementById(id);
const canvas=$("scene");
const reduced=matchMedia("(prefers-reduced-motion: reduce)").matches;

let renderer;
try{
  renderer=new THREE.WebGLRenderer({canvas,antialias:true,powerPreference:"high-performance"});
}catch{
  $("nogl").hidden=false;$("loader").remove();
  throw new Error("WebGL unavailable");
}
const PR_FIXED=parseFloat(new URLSearchParams(location.search).get("pr")||"0");
const COARSE=matchMedia("(pointer:coarse)").matches;
const PR_CAP=PR_FIXED||Math.min(devicePixelRatio,COARSE?1.75:1.75),PR_FLOOR=1;
let prNow=PR_CAP;
renderer.setPixelRatio(prNow);
renderer.outputColorSpace=THREE.SRGBColorSpace;
renderer.toneMapping=THREE.NoToneMapping;
renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
renderer.setClearColor(0x07050a);

const scene=new THREE.Scene();
// Framing follows felixrieseberg.com: a 32 degree lens (wider only on narrow windows) and a home view that looks at the TV centre
// from 1.75 m, slightly left of and above its axis (his FRAMES.home: dir -0.13, 0.1, 1).
const FOV=32;
const lensFov=()=>{const a=innerWidth/innerHeight,tv=Math.tan(THREE.MathUtils.degToRad(FOV/2));return THREE.MathUtils.radToDeg(2*Math.atan(Math.max(tv,Math.min(.46,.29/a))))};
const camera=new THREE.PerspectiveCamera(lensFov(),1,0.05,7000);
const TV0=new THREE.Vector3(-0.02,1.01,-2.0935);
function homeFrame(){
  const a=innerWidth/innerHeight,tv=Math.tan(THREE.MathUtils.degToRad(lensFov()/2));
  const d=(COARSE?1.75:1.5)*Math.min(1.12,Math.max(1,Math.tan(THREE.MathUtils.degToRad(FOV/2))*1.3/(tv*a)));
  const t=TV0.clone().add(new THREE.Vector3(0.04,0.036,0));
  return {target:t,pos:t.clone().add(new THREE.Vector3(-0.13,0.1,1).normalize().multiplyScalar(d))};
}
const HOME=homeFrame();
camera.position.copy(HOME.pos);

// Limited orbit around the current view target (round 2): no cursor parallax, zoom and position kept inside the room.
const controls=new LookControls(camera,canvas);
controls.target.copy(HOME.target);
camera.lookAt(controls.target);
controls.setFromCamera(true);

const draco=new DRACOLoader();
draco.setDecoderPath("https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/libs/draco/gltf/");
const loader=new GLTFLoader();
loader.setDRACOLoader(draco);
const meshes={};
let progressRoom=0,progressOut=0;
function setProgress(){
  const p=Math.round((progressRoom*0.9+progressOut*0.1)*100);
  $("loader-fill").style.width=p+"%";$("loader-text").textContent="LOADING "+p+"%";
}
// Per-tape click boxes generated from the Blender scene (pipeline/tools/tape_layout.py).
let cityLife=null,gateEl,phone=null,phoneQuiet=false;const _gq=new THREE.Vector3();
const TAPE_PAL=[0xc9a227,0x1f8f73,0xa8281f,0x2a4a9a,0xd9631c,0x2f7d3a,0x1f2f63,0x3a8a4a,0x7a3b8c,0xd0541d,0xa02a3c,0x1c6f8a,0x8a7a2a];
let TAPES=[];
let deck=null,notebook=null;const logoMeshes=[];
const tapeBoxU={min:{value:Array.from({length:16},()=>new THREE.Vector3(1e9,1e9,1e9))},max:{value:Array.from({length:16},()=>new THREE.Vector3(-1e9,-1e9,-1e9))},n:{value:0}};
const tapesP=fetch("tapes.json").then(r=>r.json()).then(t=>{TAPES=t.map(d=>({idx:d.idx,object:d.object,box:new THREE.Box3(new THREE.Vector3(...d.min),new THREE.Vector3(...d.max))}));TAPES.slice(0,16).forEach((t,i)=>{tapeBoxU.min.value[i].copy(t.box.min);tapeBoxU.max.value[i].copy(t.box.max)});tapeBoxU.n.value=Math.min(16,TAPES.length)});
// Reflections: a 360 degree capture of the baked room (rendered in Blender at desk height) filters into the environment map.
// The baked materials are emission-only, so the environment only adds specular on top: [roughness, strength, metalness] per bake group.
const REFL=new URLSearchParams(location.search).get("refl")!==null?parseFloat(new URLSearchParams(location.search).get("refl")):1.5;
const SPEC={
  Room_Floor:[.42,.4],Room_Desk:[.4,.75],Room_Monitor:[.28,1.1],Room_Lamp:[.32,1.0],Room_Tapes:[.32,.9],Room_Station:[.45,.45],
  Room_Window:[.5,.4],Room_Plant:[.5,.25],Room_Keepsakes:[.28,1.0,.25],Room_Right_Nook:[.48,.6],Room_Wall_Decor:[.55,.35],Room_Shell:[.8,.12]
};
const envReady=new Promise(res=>{
  const t=new THREE.TextureLoader().load("room_env.jpg",tex=>{
    tex.mapping=THREE.EquirectangularReflectionMapping;tex.colorSpace=THREE.SRGBColorSpace;
    const pm=new THREE.PMREMGenerator(renderer);res(pm.fromEquirectangular(tex).texture);tex.dispose();pm.dispose();
  });
});
// Local lift around the IBM corner (the bake leaves it nearly black). Emissive is scaled and a small warm floor is added
// inside a soft ellipsoid centred on the dresser; nothing outside it changes.
const IBMQ=new URLSearchParams(location.search).get("ibm");const IBM_K=IBMQ!==null?parseFloat(IBMQ):2.8;
const IBM_LIFT_NAMES=["Room_Station","Room_Shell","Room_Floor","Room_Wall_Decor"];
function ibmLift(m){
  m.onBeforeCompile=sh=>{
    sh.uniforms.uIbmC={value:new THREE.Vector3(-2.72,0.95,-1.05)};sh.uniforms.uIbmK={value:IBM_K};
    sh.vertexShader=sh.vertexShader.replace("#include <common>","#include <common>\nvarying vec3 vWP2;")
      .replace("#include <begin_vertex>","#include <begin_vertex>\nvWP2=(modelMatrix*vec4(transformed,1.0)).xyz;");
    sh.fragmentShader=sh.fragmentShader.replace("#include <common>","#include <common>\nvarying vec3 vWP2;uniform vec3 uIbmC;uniform float uIbmK;")
      .replace("#include <emissivemap_fragment>",`#include <emissivemap_fragment>
        vec3 d=(vWP2-uIbmC)/vec3(1.7,1.5,1.9);float f=1.0-smoothstep(0.2,1.0,length(d));
        totalEmissiveRadiance=totalEmissiveRadiance*(1.0+uIbmK*f)+vec3(.010,.006,.003)*f*uIbmK;`)};
  m.needsUpdate=true;
}

// The computer (monitor and base unit) reads as white plastic instead of beige: inside its box, the baked light keeps its brightness
// but loses its colour.
function pcWhite(m,name){
  const prev=m.onBeforeCompile;
  m.onBeforeCompile=(sh,r)=>{
    prev.call(m,sh,r);
    sh.vertexShader=sh.vertexShader.replace("#include <common>","#include <common>\nvarying vec3 vWPw;")
      .replace("#include <begin_vertex>","#include <begin_vertex>\nvWPw=(modelMatrix*vec4(transformed,1.0)).xyz;");
    sh.fragmentShader=sh.fragmentShader.replace("#include <common>","#include <common>\nvarying vec3 vWPw;")
      .replace("#include <emissivemap_fragment>",`#include <emissivemap_fragment>
        vec3 pcd=vWPw-vec3(-2.70,0.86,-1.24);
        float pcw=smoothstep(-.25,-.20,pcd.x)*smoothstep(.36,.30,pcd.x)*smoothstep(.72,.66,abs(pcd.z-.165))*smoothstep(0.556,0.562,vWPw.y)*(1.0-smoothstep(1.03,1.07,vWPw.y));
        vec2 pxs=1.0/vec2(textureSize(emissiveMap,0));vec3 eb=vec3(0.0);
        for(int i=-1;i<=1;i++)for(int j=-1;j<=1;j++)eb+=texture2D(emissiveMap,vEmissiveMapUv+vec2(float(i),float(j))*pxs*1.7).rgb;
        vec3 emB=emissive*eb/9.0;
        float lum=0.7*dot(emB,vec3(.30,.59,.11))+0.3*dot(totalEmissiveRadiance,vec3(.30,.59,.11));
        totalEmissiveRadiance=mix(totalEmissiveRadiance,vec3(lum*3.3,lum*3.12,lum*2.82),pcw);`);
  };
  m.customProgramCacheKey=()=>"pcw_"+name;
  m.needsUpdate=true;
}
// The desk under each stack is baked dark where a tape sat. When the bottom tape of a stack is taken out, that patch is lifted
// back to the colour of the desk around it, so the empty spot does not read as a black shadow.
const DG={a:{value:new THREE.Vector4(9,9,9,9)},b:{value:new THREE.Vector4(9,9,9,9)},g:{value:new THREE.Vector2(0,0)}};
function deskGone(m){
  const prev=m.onBeforeCompile;
  m.onBeforeCompile=(sh,r)=>{
    prev.call(m,sh,r);
    Object.assign(sh.uniforms,{uDgA:DG.a,uDgB:DG.b,uDgG:DG.g});
    sh.fragmentShader=sh.fragmentShader.replace("#include <common>","#include <common>\nuniform vec4 uDgA;uniform vec4 uDgB;uniform vec2 uDgG;")
      .replace("#include <emissivemap_fragment>",`#include <emissivemap_fragment>
        float dgy=1.0-smoothstep(0.728,0.742,vWPw.y);
        float dga=smoothstep(uDgA.x-.012,uDgA.x+.004,vWPw.x)*(1.0-smoothstep(uDgA.y-.004,uDgA.y+.012,vWPw.x))*smoothstep(uDgA.z-.012,uDgA.z+.004,vWPw.z)*(1.0-smoothstep(uDgA.w-.004,uDgA.w+.012,vWPw.z));
        float dgb=smoothstep(uDgB.x-.012,uDgB.x+.004,vWPw.x)*(1.0-smoothstep(uDgB.y-.004,uDgB.y+.012,vWPw.x))*smoothstep(uDgB.z-.012,uDgB.z+.004,vWPw.z)*(1.0-smoothstep(uDgB.w-.004,uDgB.w+.012,vWPw.z));
        totalEmissiveRadiance*=1.0+dgy*(dga*uDgG.x+dgb*uDgG.y)*DG_K;`.replace("DG_K",DG_K.toFixed(2)));
  };
  m.customProgramCacheKey=()=>"pcw_Room_Desk_dg";
  m.needsUpdate=true;
}
// The degree used to hang on the back wall under the clocks; its shadow is baked into the wall, so that patch is lifted to the wall colour.
const WP_K=parseFloat(new URLSearchParams(location.search).get("wpk")||"0.025");
function wallPatch(m){
  const prev=m.onBeforeCompile;
  m.onBeforeCompile=(sh,r)=>{
    prev.call(m,sh,r);
    sh.fragmentShader=sh.fragmentShader.replace("#include <emissivemap_fragment>",`#include <emissivemap_fragment>
      float wpx=smoothstep(-2.30,-2.14,vWPw.x)*(1.0-smoothstep(-1.46,-1.30,vWPw.x));
      float wpy=smoothstep(1.06,1.26,vWPw.y)*(1.0-smoothstep(1.66,1.80,vWPw.y));
      float wpz=1.0-smoothstep(-2.44,-2.40,vWPw.z);
      totalEmissiveRadiance=mix(totalEmissiveRadiance,max(totalEmissiveRadiance,vec3(${WP_K.toFixed(3)},${(WP_K*0.52).toFixed(3)},${(WP_K*0.34).toFixed(3)})),wpx*wpy*wpz);`);
  };
  m.customProgramCacheKey=()=>"pcw_Room_Shell_wp";
  m.needsUpdate=true;
}
const DG_K=parseFloat(new URLSearchParams(location.search).get("dgk")||"1.5");
const HEALREF=parseFloat(new URLSearchParams(location.search).get("pref")||"0.17");
function heal(m){
  m.onBeforeCompile=sh=>{
    sh.uniforms.uHealRef={value:HEALREF};
    sh.vertexShader=sh.vertexShader.replace("#include <common>","#include <common>\nvarying vec3 vWP3;")
      .replace("#include <begin_vertex>","#include <begin_vertex>\nvWP3=(modelMatrix*vec4(transformed,1.0)).xyz;");
    sh.fragmentShader=sh.fragmentShader.replace("#include <common>","#include <common>\nvarying vec3 vWP3;uniform float uHealRef;")
      .replace("#include <emissivemap_fragment>",`#include <emissivemap_fragment>
        vec3 hd=(vWP3-vec3(-0.80,0.80,-1.95))/vec3(0.22,0.19,0.22);float hw=1.0-smoothstep(0.7,1.0,length(hd));
        if(hw>0.0){
          float hx=smoothstep(0.045,0.075,length(vWP3.xz-vec2(-0.70,-1.94)));hw*=hx;
          vec2 ts=1.0/vec2(textureSize(emissiveMap,0));vec3 qs[24];float ls[24];float mean=0.;
          for(int r=0;r<3;r++)for(int k=0;k<8;k++){float a=float(k)*0.7854+float(r)*0.3;vec2 o=vec2(cos(a),sin(a))*(18.0+float(r)*14.0)*ts;
            vec3 q=texture2D(emissiveMap,vEmissiveMapUv+o).rgb;float ql=dot(q,vec3(.2126,.7152,.0722));qs[r*8+k]=q;ls[r*8+k]=ql;mean+=ql;}
          mean/=24.;vec3 acc=vec3(0.);float cnt=0.;
          for(int i=0;i<24;i++){if(ls[i]>=mean*1.15){acc+=qs[i];cnt+=1.;}}
          vec3 best=cnt>0.?acc/cnt:totalEmissiveRadiance;
          totalEmissiveRadiance=mix(totalEmissiveRadiance,max(totalEmissiveRadiance,best),hw);
          float tl2=dot(totalEmissiveRadiance,vec3(.2126,.7152,.0722));
          float gain=clamp(uHealRef/(tl2+0.002),1.0,24.0);
          totalEmissiveRadiance*=mix(1.0,gain,hw);
        }`)};
  m.needsUpdate=true;
}

const roomP=new Promise((res,rej)=>loader.load(COARSE?"sakina-room-agx-both-m.glb":"sakina-room-agx-both.glb",g=>{
  const maxAniso=renderer.capabilities.getMaxAnisotropy();
  g.scene.traverse(o=>{
    if(!o.isMesh)return;
    meshes[o.name]=o;
    const m=o.material;
    if(m.emissiveMap){m.emissiveMap.anisotropy=Math.min(8,maxAniso)}
    if(m.map){m.map.anisotropy=Math.min(16,maxAniso)}
    if(o.name==="Room_Tapes"){
      // Muted, darker plastic only inside the 13 tape boxes (the same mesh also holds the phone, papers, floppy and recorder).
      const TS=new URLSearchParams(location.search).get("tape");const sat=TS!==null?parseFloat(TS):0.52;
      m.onBeforeCompile=sh=>{
        sh.uniforms.uBmin=tapeBoxU.min;sh.uniforms.uBmax=tapeBoxU.max;sh.uniforms.uBn=tapeBoxU.n;
        sh.vertexShader=sh.vertexShader.replace("#include <common>","#include <common>\nvarying vec3 vWP;")
          .replace("#include <begin_vertex>","#include <begin_vertex>\nvWP=(modelMatrix*vec4(transformed,1.0)).xyz;");
        sh.fragmentShader=sh.fragmentShader.replace("#include <common>","#include <common>\nvarying vec3 vWP;uniform vec3 uBmin[16];uniform vec3 uBmax[16];uniform int uBn;")
          .replace("#include <emissivemap_fragment>",`#include <emissivemap_fragment>
           float inTape=0.;for(int i=0;i<16;i++){if(i<uBn&&all(greaterThan(vWP,uBmin[i]-vec3(.004)))&&all(lessThan(vWP,uBmax[i]+vec3(.004))))inTape=1.;}
           float tl=dot(totalEmissiveRadiance,vec3(.2126,.7152,.0722));
           vec3 muted=mix(vec3(tl),totalEmissiveRadiance,${sat.toFixed(3)})*vec3(.80,.76,.70)*(1.0-.25*smoothstep(.35,.9,tl));
           totalEmissiveRadiance=mix(totalEmissiveRadiance,muted,inTape);`)};
      m.needsUpdate=true;
    }
    if(IBM_LIFT_NAMES.includes(o.name))ibmLift(m);
    if(o.name==="Room_Desk"||o.name==="Room_Plant")heal(m);
    if(o.name!=="Room_Plant"&&o.name!=="Room_Lamp")pcWhite(m,o.name);
    if(o.name==="Room_Desk")deskGone(m);
    if(o.name==="Room_Shell")wallPatch(m);
    const sp=SPEC[o.name];
    if(sp){m.roughness=sp[0];m.metalness=sp[2]||0;if("specularIntensity" in m){m.specularIntensity=1;m.specularColor.setRGB(1,1,1);m.ior=1.5}m.envMapIntensity=sp[1]*REFL;envReady.then(t=>{m.envMap=t;m.needsUpdate=true})}
    else m.envMapIntensity=0;
  });
  // Live shadows on the walls and floor: tiny-intensity point lights at the lamps (they only drive shadow maps; the baked
  // materials are emission-only), and ShadowMaterial copies of the shell and floor that darken only where a caster blocks the lamp.
  const SH=new URLSearchParams(location.search).get("shadow");const shOpacity=SH!==null?parseFloat(SH):0.32;
  for(const [n,m] of Object.entries(meshes)){m.castShadow=!["Room_Shell","Room_Floor","Room_Lamp"].includes(n)}
  const mkLight=(x,y,z,far)=>{const l=new THREE.PointLight(0xffffff,0.0001,far,1);l.position.set(x,y,z);l.castShadow=true;
    l.shadow.mapSize.set(1536,1536);l.shadow.radius=7;l.shadow.bias=-0.0006;l.shadow.normalBias=0.02;l.shadow.camera.near=0.05;scene.add(l);return l};
  mkLight(-0.4,1.06,-2.17,9);          // desk lamp (Blender L1 -0.4, 2.17, 1.06)
  mkLight(2.21,1.6,-0.96,9);           // floor lamp (Blender L3 2.21, 0.96, 1.6)
  const shadowMat=new THREE.ShadowMaterial({color:0x14080a,opacity:shOpacity,transparent:true,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-1,polygonOffsetUnits:-1});
  for(const n of ["Room_Shell","Room_Floor"]){
    const src=meshes[n];if(!src)continue;
    const r=new THREE.Mesh(src.geometry,shadowMat);r.position.copy(src.position);r.quaternion.copy(src.quaternion);r.scale.copy(src.scale);
    r.receiveShadow=true;r.renderOrder=1;r.name=n+"_shadow";src.parent.add(r);
  }

  {
    const N=1024,cv=document.createElement("canvas");cv.width=cv.height=N;const x=cv.getContext("2d");
    let seed=11;const rnd=()=>((seed=Math.imul(seed^seed>>>15,seed|1)+0x6D2B79F5|0,((seed^seed>>>7)>>>0)/4294967296));
    x.filter="blur(4px)";x.fillStyle="#000";
    const leaf=(cx,cy,len,wid,rot)=>{x.save();x.translate(cx,cy);x.rotate(rot);x.beginPath();x.moveTo(0,0);
      x.bezierCurveTo(wid*.9,-len*.25,wid,-len*.7,0,-len);x.bezierCurveTo(-wid,-len*.7,-wid*.9,-len*.25,0,0);x.fill();
      x.fillRect(-3,0,6,len*.28);x.restore()};
    for(let i=0;i<16;i++){const u=1-Math.pow(rnd(),1.7)*.8,v=.15+rnd()*.7;
      leaf(u*N,v*N+N*.12,N*(.16+rnd()*.14),N*(.05+rnd()*.04),(rnd()-.5)*3.6)}
    const t=new THREE.CanvasTexture(cv);t.colorSpace=THREE.SRGBColorSpace;
    const m=new THREE.MeshBasicMaterial({map:t,color:0x0a0405,transparent:true,opacity:0.62,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-4,polygonOffsetUnits:-4});
    const p=new THREE.Mesh(new THREE.PlaneGeometry(2.0,2.0),m);p.rotation.y=Math.PI/2;p.position.set(-2.99,1.7,-1.5);p.renderOrder=1;p.name="LeafShadows";scene.add(p);
  }
  {
    const t=new THREE.TextureLoader().load("sakina-photo.jpg");t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=8;
    const card=new THREE.Mesh(new THREE.PlaneGeometry(0.088,0.106),new THREE.MeshBasicMaterial({color:0xe2dfd8,transparent:true,depthWrite:false}));
    card.rotation.y=Math.PI/2;card.position.set(-2.6475,0.8735,-1.354);card.renderOrder=3;card.name="PolaroidCard";scene.add(card);
    const p=new THREE.Mesh(new THREE.PlaneGeometry(0.0716,0.0891),new THREE.MeshBasicMaterial({map:t,color:0xcfc2b0,transparent:true,depthWrite:false}));
    p.rotation.y=Math.PI/2;p.position.set(-2.6465,0.8795,-1.354);p.renderOrder=3.1;p.name="PolaroidPhoto";scene.add(p);
  }
  scene.add(g.scene);res();
},e=>{if(e.lengthComputable){progressRoom=e.loaded/e.total;setProgress()}},rej));
// Night sky behind the city: dark zenith fading to a warm light-pollution haze at the horizon (round 2).
{
  const g=new THREE.SphereGeometry(3000,48,24),pos=g.attributes.position,c=new THREE.Color(),col=[];
  const zen=new THREE.Color(0x05060c),mid=new THREE.Color(0x111528),hor=new THREE.Color(0x5a3620);
  for(let i=0;i<pos.count;i++){
    const y=pos.getY(i)/3000;
    if(y<0)c.copy(hor);else if(y<0.10)c.copy(hor).lerp(mid,y/0.10);else c.copy(mid).lerp(zen,Math.min(1,(y-0.10)/0.5));
    col.push(c.r,c.g,c.b);
  }
  g.setAttribute("color",new THREE.Float32BufferAttribute(col,3));
  const sky=new THREE.Mesh(g,new THREE.MeshBasicMaterial({vertexColors:true,side:THREE.BackSide,depthWrite:false}));
  sky.renderOrder=-1;scene.add(sky);
}
// City lowered 10 m so its lit skyline fills the window behind the monitor (round 2).
const outP=new Promise((res,rej)=>loader.load("sakina-outside-r4lo.glb",g=>{g.scene.position.y=-10;scene.add(g.scene);res()},
  e=>{if(e.lengthComputable){progressOut=e.loaded/e.total;setProgress()}},rej));

const VIEW_ZOOM=parseFloat(new URLSearchParams(location.search).get("vz")||"2.3");
// Berlin rail-yard night photo behind the window (round 4, approved): two unlit emissive pictures ~80 m away (photo patch + panorama).
const viewP=new Promise(res=>loader.load("sakina-view-r4lo.glb",g=>{
  g.scene.traverse(o=>{if(o.isMesh){o.material.side=THREE.DoubleSide;o.material.envMapIntensity=0;o.renderOrder=-1}});
  {const b=new THREE.Box3().setFromObject(g.scene),c=b.getCenter(new THREE.Vector3());g.scene.scale.setScalar(VIEW_ZOOM);g.scene.position.copy(c).multiplyScalar(1-VIEW_ZOOM)}
  scene.add(g.scene);
  const ph=g.scene.getObjectByName("WindowView_Photo");
  if(ph){g.scene.updateMatrixWorld(true);try{cityLife=createCityLife(ph,reduced)}catch(e){console.warn("city life failed",e)}}
  res();
},undefined,e=>{console.warn("window view failed",e);res()}));

// Live CRT glass over the baked picture (round 3): scanlines, curved-glass vignette, a soft warm lamp reflection
// that drifts with the viewing angle, and a slow roll bar. Darkens/adds only a little, so the screen never gets neon.
// Picture rect from the Blender scene (e05): x -0.16..0.12, height 0.905..1.115, picture surface 1.617 m deep.
const CRT={cx:-0.02,cy:1.01,w:0.28,h:0.21,z:-2.0935};   // round 5: +0.48 m deeper
const crtGlass=(()=>{
  const g=new THREE.PlaneGeometry(CRT.w,CRT.h,24,18),p=g.attributes.position;
  for(let i=0;i<p.count;i++){const u=p.getX(i)/(CRT.w/2),v=p.getY(i)/(CRT.h/2);p.setZ(i,0.0022*(1-u*u)*(1-v*v))}
  g.computeVertexNormals();
  const m=new THREE.ShaderMaterial({
    uniforms:{uTime:{value:0}},
    transparent:true,depthWrite:false,
    blending:THREE.CustomBlending,blendSrc:THREE.OneFactor,blendDst:THREE.OneMinusSrcAlphaFactor,
    vertexShader:`varying vec2 vUv;varying vec3 vN;varying vec3 vV;
      void main(){vUv=uv;vec4 wp=modelMatrix*vec4(position,1.0);vN=normalize(mat3(modelMatrix)*normal);
      vV=normalize(cameraPosition-wp.xyz);gl_Position=projectionMatrix*viewMatrix*wp;}`,
    fragmentShader:`uniform float uTime;varying vec2 vUv;varying vec3 vN;varying vec3 vV;
      void main(){
        float L=vUv.y*170.0;float fw=fwidth(L);
        float lines=(0.5-0.5*cos(L*6.2831853))*(1.0-smoothstep(0.35,0.9,fw));
        vec2 c=(vUv-0.5)*vec2(1.0,1.18);float r=dot(c,c);
        float vig=smoothstep(0.07,0.30,r)*0.55;
        float roll=fract(vUv.y*0.6-uTime*0.035);roll=smoothstep(0.0,0.06,roll)*(1.0-smoothstep(0.06,0.14,roll));
        vec2 hp=vec2(0.30,0.80)+vV.xy*vec2(-0.35,-0.25);
        vec2 d=(vUv-hp)*vec2(2.3,3.6);float hl=exp(-dot(d,d)*2.2)*0.06;
        float fres=pow(1.0-clamp(dot(normalize(vN),normalize(vV)),0.0,1.0),3.0)*0.10;
        vec3 add=vec3(1.0,0.84,0.64)*(hl+fres)+vec3(0.75,0.82,1.0)*roll*0.018;
        float a=clamp(vig,0.0,0.8)+0.006*sin(uTime*47.0);
        gl_FragColor=vec4(add,a);
      }`
  });
  const mesh=new THREE.Mesh(g,m);mesh.position.set(CRT.cx,CRT.cy,CRT.z);mesh.renderOrder=2;scene.add(mesh);
  return m;
})();

// Bright CRT phosphor (additive over the baked text so the text stays readable) plus light spill on the desk.
const DESK_TOP=0.72;
const PAPER_TINT=0xc2b296;
const padMesh=(()=>{
  const m=new THREE.MeshBasicMaterial({map:makePadTexture(pad),color:PAPER_TINT});
  const mesh=new THREE.Mesh(new THREE.PlaneGeometry(PAD.w,PAD.h),m);
  mesh.rotation.order="YXZ";mesh.rotation.set(-Math.PI/2,PAD.rotY,0);
  mesh.position.set(PAD.x,0.7258,PAD.z);
  mesh.name="Pad";mesh.renderOrder=1;scene.add(mesh);
  return mesh;
})();
const crtScreen=(()=>{
  const W=1024,H=768,K=W/960,cv=document.createElement("canvas");cv.width=W;cv.height=H;
  const g=cv.getContext("2d");
  const rng=seed=>()=>((seed=Math.imul(seed^seed>>>15,seed|1)+0x6D2B79F5|0,((seed^seed>>>7)>>>0)/4294967296));
  const still=document.createElement("canvas");still.width=W;still.height=H;
  const tex=new THREE.CanvasTexture(cv);tex.colorSpace=THREE.SRGBColorSpace;tex.anisotropy=4;
  const INK="#f4f5ff",BIG=["SAKINA","SAIFUDDIN"],SUB="PORTFOLIO  ·  CH 00";
  const paintBg=c=>{const r=c.createRadialGradient(960*.48,720*.42,0,960*.48,720*.42,960*.62);r.addColorStop(0,"#5471d0");r.addColorStop(.45,"#4c6ac9");r.addColorStop(1,"#4560bd");c.fillStyle=r;c.fillRect(0,0,960,720)};
  let mode="loading",lastAct=0,modeT=0;
  const setMode=(m,t)=>{mode=m;modeT=t};
  const poke=()=>{if(document.getElementById("crt-gate"))return;lastAct=performance.now();if(mode!=="name")setMode("name",lastAct)};
  const paintStill=()=>{
    const s=still.getContext("2d");s.setTransform(1,0,0,1,0,0);s.scale(K,K);const r=rng(7);
    paintBg(s);s.fillStyle=INK;
    for(let i=0;i<26000;i++){
      const x=r()*960,y=r()*720,dx=(x-560)/300,dy=(y-420)/300,d=Math.hypot(dx,dy),edge=Math.max(0,y/720-.55)*1.6;
      const p=d<1?(1-d)*.55*(.4+.6*Math.max(0,-(dx+dy)*.7+.3)):.05+edge*.5;
      if(r()<p){const z=r()<.08?1.8:1.1;s.fillRect(x,y,z,z)}
    }
    s.strokeStyle=INK;s.lineWidth=2;s.globalAlpha=.25;s.beginPath();s.arc(560,420,300,0,7);s.stroke();s.globalAlpha=1;
    s.fillStyle=INK;s.font="900 150px Archivo";try{s.fontStretch="condensed"}catch{}
    BIG.forEach((w,i)=>s.fillText(w,58,220+i*150*.9));
    s.font="32px VT323";s.globalAlpha=.85;s.fillText(SUB,62,262+(BIG.length-1)*150*.9);s.globalAlpha=1;
  };
  const osd=(text,x,y,align="left",size=text.length>14?34:44)=>{g.font=size+"px VT323";g.textAlign=align;g.fillStyle="#f2f2f2";g.shadowColor="rgba(0,0,0,.65)";g.shadowOffsetX=3;g.shadowOffsetY=3;g.fillText(text,x,y);g.shadowColor="transparent";g.textAlign="left"};
  const orbits=t=>{
    g.save();g.strokeStyle=INK;g.lineCap="round";
    [[560,420,430,120,-.32,5],[560,420,380,150,.42,3],[560,400,470,70,.08,2]].forEach(([x,y,a,b,rot,w],i)=>{
      g.lineWidth=w;g.setLineDash([.1,14+i*6]);g.lineDashOffset=-(t*.02*(i%2?1:-1));g.beginPath();g.ellipse(x,y,a,b,rot,0,7);g.stroke()});
    g.restore();
    g.save();g.translate(820+Math.sin(t*.0004)*20,110);g.rotate(t*.0003);g.fillStyle=INK;g.beginPath();
    for(let k=0;k<8;k++){const R=k%2?5:42+Math.sin(t*.003)*6,a=k*Math.PI/4;g.lineTo(Math.cos(a)*R,Math.sin(a)*R)}g.fill();g.restore();
  };
  const draw=t=>{
    g.setTransform(1,0,0,1,0,0);g.setTransform(K,0,0,K,0,0);
    if(mode==="loading"&&!document.getElementById("crt-gate")){lastAct=performance.now();setMode("name",lastAct)}
    if(mode==="name"&&performance.now()-lastAct>6000)setMode("tape",performance.now());
    if(mode==="loading"){
      paintBg(g);osd("▶▶ LOADING",60,82);osd("CH 00",900,82,"right");
      g.font="44px VT323";g.textAlign="left";g.fillStyle="#f4f5ff";
      const line="▮".repeat(20)+"  100%";g.textAlign="center";g.fillText(line,480,392);g.textAlign="left";
    }else if(mode==="tape"){
      paintBg(g);osd("■ STOP",60,82);osd("VIDEO",900,82,"right");
      if(Math.floor(t/700)%2===0)osd("INSERT TAPE",480,372,"center",84);
      osd("PICK A TAPE FROM THE DESK",480,450,"center",44);
    }else{
      g.setTransform(1,0,0,1,0,0);g.drawImage(still,0,0);g.setTransform(K,0,0,K,0,0);
      orbits(t);
      if(Math.floor(t/600)%2===0&&performance.now()-lastAct<1500)osd("▶ PLAY",60,82);
      osd("CH 00",900,82,"right");
    }
    tex.needsUpdate=true;
  };
  const u={uTime:{value:0},uMap:{value:tex}};
  const m=new THREE.ShaderMaterial({uniforms:u,transparent:true,depthWrite:false,
    vertexShader:`varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`,
    fragmentShader:`uniform float uTime;uniform sampler2D uMap;varying vec2 vUv;
      float h(vec2 p){return fract(sin(dot(p,vec2(12.9898,78.233)))*43758.5453);}
      void main(){
        vec2 c=vUv-0.5;float d=pow(abs(c.x)*2.0,9.0)+pow(abs(c.y)*2.0,9.0);
        float edge=(1.0-smoothstep(0.80,1.0,d))*(0.8+0.2*(1.0-dot(c,c)*3.0));
        vec2 uv=(vUv-0.5)*1.1+0.5;uv+=vec2(0.0015*sin(uTime*31.0+vUv.y*40.0),0.0);
        vec3 pic=texture2D(uMap,uv).rgb;
        float n=h(floor(vUv*vec2(240.0,180.0))+floor(uTime*24.0));
        float lines=0.86+0.14*sin(vUv.y*170.0*6.2831853);
        float flick=0.96+0.04*sin(uTime*53.0)+0.02*sin(uTime*7.0);
        float bar=smoothstep(0.0,0.05,fract(vUv.y*0.7-uTime*0.04))*(1.0-smoothstep(0.05,0.16,fract(vUv.y*0.7-uTime*0.04)));
        vec3 col=pic*(0.9+0.2*n)*lines*flick+vec3(0.5,0.65,1.0)*bar*0.04;
        gl_FragColor=vec4(col*CRT_GAIN,edge);
      }`.replace("CRT_GAIN",(+(new URLSearchParams(location.search).get("crtgain")||1.25)).toFixed(3))});
  const mesh=new THREE.Mesh(new THREE.PlaneGeometry(CRT.w*1.10,CRT.h*1.12),m);
  mesh.position.set(CRT.cx,CRT.cy,CRT.z+0.0012);mesh.renderOrder=1;scene.add(mesh);
  const start=()=>{paintStill();draw(0)};
  const fonts=["900 150px Archivo","32px VT323","44px VT323"];
  Promise.all(fonts.map(f=>document.fonts.load(f))).then(start,start);
  start();
  addEventListener("keydown",poke);
  canvas.addEventListener("pointerdown",poke);
  return {u,draw,mesh};
})();
const crtLive=crtScreen.u;
const spill=(()=>{
  const cv=document.createElement("canvas");cv.width=cv.height=256;const x=cv.getContext("2d");
  const g=x.createRadialGradient(128,128,0,128,128,128);g.addColorStop(0,"rgba(120,160,255,0.55)");g.addColorStop(0.45,"rgba(70,110,230,0.20)");g.addColorStop(1,"rgba(40,70,200,0)");
  x.fillStyle=g;x.fillRect(0,0,256,256);
  const t=new THREE.CanvasTexture(cv);t.colorSpace=THREE.SRGBColorSpace;
  const m=new THREE.MeshBasicMaterial({map:t,transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,polygonOffset:true,polygonOffsetFactor:-2,polygonOffsetUnits:-2});
  const mesh=new THREE.Mesh(new THREE.PlaneGeometry(0.85,0.34),m);
  mesh.rotation.x=-Math.PI/2;mesh.position.set(CRT.cx,DESK_TOP+0.006,CRT.z+0.17);mesh.renderOrder=1;scene.add(mesh);
  return mesh;
})();

// Rain on the window glass: static drops, running drops with trails, and faint falling streaks beyond the glass.
// The pane is not in the GLB (the exporter drops it), geometry from the Blender scene: x -0.7..0.8, y 0.95..2.25, z -2.64.
const rainU={uTime:{value:0}};
{
  const m=new THREE.ShaderMaterial({uniforms:rainU,transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,
    vertexShader:`varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`,
    fragmentShader:`uniform float uTime;varying vec2 vUv;
      float N(float t){return fract(sin(t*12345.564)*7658.76);}
      float N21(vec2 p){p=fract(p*vec2(123.34,345.45));p+=dot(p,p+34.345);return fract(p.x*p.y);}
      vec3 N13(float p){vec3 p3=fract(vec3(p)*vec3(.1031,.11369,.13787));p3+=dot(p3,p3.yzx+19.19);return fract(vec3((p3.x+p3.y)*p3.z,(p3.x+p3.z)*p3.y,(p3.y+p3.z)*p3.x));}
      float Saw(float b,float t){return smoothstep(0.,b,t)*smoothstep(1.,b,t);}
      vec2 DropLayer(vec2 uv,float t){
        vec2 UV=uv;uv.y+=t*.75;vec2 a=vec2(6.,1.);vec2 grid=a*2.;vec2 id=floor(uv*grid);
        float cs=N21(vec2(id.x,3.7));uv.y+=cs;id=floor(uv*grid);vec3 n=N13(id.x*35.2+id.y*2376.1);vec2 st=fract(uv*grid)-vec2(.5,0.);
        float x=n.x-.5;float y=UV.y*20.;float w=sin(y+sin(y));x+=w*(.5-abs(x))*(n.z-.5);x*=.7;
        float ti=fract(t+n.z);y=(Saw(.85,ti)-.5)*.9+.5;vec2 p=vec2(x,y);
        float d=length((st-p)*a.yx);float md=smoothstep(.4,.0,d);
        float r=sqrt(smoothstep(1.,y,st.y));float cd=abs(st.x-x);float tr=smoothstep(.23*r,.15*r*r,cd);float tf=smoothstep(-.02,.02,st.y-y);tr*=tf*r*r;
        y=UV.y;float t2=smoothstep(.2*r,.0,cd);float dr=max(0.,(sin(y*(1.-y)*120.-st.y))*t2*tf*n.z);y=fract(y*10.)+(st.y-.5);float dd=length(st-vec2(x,y));dr=smoothstep(.3,0.,dd);
        return vec2(md+dr*r*tf,tr);}
      float Static(vec2 uv,float t){uv*=38.;vec2 id=floor(uv);uv=fract(uv)-.5;vec3 n=N13(id.x*107.45+id.y*3543.654);vec2 p=(n.xy-.5)*.7;float d=length(uv-p);float f=Saw(.025,fract(t+n.z));return smoothstep(.3,0.,d)*fract(n.z*10.)*f;}
      void main(){
        float t=uTime*.2;vec2 uv=(vUv-.5)*vec2(1.5,1.3)*1.7;
        float st=Static(uv*1.5,t);vec2 dr=DropLayer(uv*1.2,t)*.8+DropLayer(uv*2.1+7.2,t)*.6;
        float m=clamp(st+dr.x,0.,1.);m=smoothstep(.5,.88,m)*.5;
        vec2 g=vec2(dFdx(m),dFdy(m));float hl=clamp(dot(normalize(g+1e-6),normalize(vec2(-.6,.8)))*length(g)*40.,0.,1.);
        float body=m*.045;
        float streak=0.;
        for(int k=0;k<3;k++){
          float fk=float(k);float cols=48.+fk*29.;float sp=1.15+fk*.5;
          vec2 q=vec2(uv.x+uv.y*.1+sin(uv.y*3.+fk*2.)*.01,uv.y);
          float col=floor(q.x*cols);float rr=N(col+1.+fk*17.);float xx=fract(q.x*cols+(N(col+7.)-.5)*.5)-.5;
          float len=.18+N(col+3.+fk)*.3;
          float yy=fract(q.y*(.3+fk*.08)+uTime*(sp+rr*.7)+rr*9.);
          streak+=smoothstep(.07-fk*.01,.0,abs(xx))*smoothstep(0.,.06,yy)*smoothstep(len,.02,yy)*step(.58,rr)*(.3-fk*.05);
        }
        vec3 c=vec3(.55,.66,.9)*(body+streak)+vec3(1.,.93,.82)*hl*.3*m;
        gl_FragColor=vec4(c,1.);
      }`});
  const mesh=new THREE.Mesh(new THREE.PlaneGeometry(1.5,1.3),m);
  mesh.position.set(0.05,1.6,-2.636);mesh.renderOrder=3;scene.add(mesh);
}

// Steam over the coffee. Mug_Coffee surface: three.js x -0.236, y 0.809, z -1.883. The Blender steam curves are not exported.
const steamU={uTime:{value:0},uPx:{value:700}};
{
  const N=36,pos=new Float32Array(N*3),seed=new Float32Array(N*4);
  for(let i=0;i<N;i++){seed[i*4]=Math.random();seed[i*4+1]=Math.random();seed[i*4+2]=Math.random();seed[i*4+3]=Math.random()}
  const g=new THREE.BufferGeometry();
  g.setAttribute("position",new THREE.BufferAttribute(pos,3));
  g.setAttribute("seed",new THREE.BufferAttribute(seed,4));
  const m=new THREE.ShaderMaterial({uniforms:steamU,transparent:true,depthWrite:false,
    vertexShader:`uniform float uTime,uPx;attribute vec4 seed;varying float vA;
      void main(){
        float life=3.4+seed.x*1.6;float ph=fract(uTime/life+seed.y);
        float h=ph*0.2;
        float sway=sin(ph*6.2831*1.3+seed.z*6.2831)*(0.006+ph*0.022);
        float sway2=cos(ph*6.2831*0.9+seed.w*6.2831)*(0.004+ph*0.018);
        vec3 p=vec3(-0.236+(seed.z-.5)*0.03+sway+ph*0.012,0.812+h,-1.883+(seed.w-.5)*0.03+sway2);
        vec4 mv=viewMatrix*vec4(p,1.0);
        gl_Position=projectionMatrix*mv;
        gl_PointSize=uPx*(0.02+ph*0.06+seed.x*0.012)/-mv.z;
        vA=smoothstep(0.,.14,ph)*(1.-smoothstep(.45,1.,ph))*(.5+seed.x*.5);
      }`,
    fragmentShader:`varying float vA;
      void main(){float d=length(gl_PointCoord-.5)*2.;float a=smoothstep(1.,0.,d);a*=a;gl_FragColor=vec4(vec3(.95,.92,.88),a*vA*.4);}`});
  const pts=new THREE.Points(g,m);pts.frustumCulled=false;pts.renderOrder=2;scene.add(pts);
}

// Tape logos: the baked lightmap cannot hold them (each logo quad got a ~140x10 px lightmap island), so they are drawn as
// textured quads over the baked label windows. Geometry and blend mode come from the Blender scene (pipeline/tools/export_logos.py).
const LOGO_LIGHT=0.46;
fetch("logos/logos.json").then(r=>r.json()).then(list=>{
  const tl=new THREE.TextureLoader();
  for(const L of list){
    const tex=tl.load("logos/"+L.image+".png");tex.colorSpace=THREE.SRGBColorSpace;tex.anisotropy=8;
    const g=new THREE.BufferGeometry();
    g.setAttribute("position",new THREE.Float32BufferAttribute(L.pos.flat(),3));
    g.setAttribute("uv",new THREE.Float32BufferAttribute(L.uv.flat(),2));
    const base=new THREE.Color().setRGB(L.base[0],L.base[1],L.base[2],THREE.LinearSRGBColorSpace);
    const mode={img:0,alpha:1,bw:2}[L.mode],mp=L.map||[0,1,0,1];
    const m=new THREE.ShaderMaterial({
      uniforms:{map:{value:tex},uMode:{value:mode},uBase:{value:new THREE.Vector3(base.r,base.g,base.b)},uMap:{value:new THREE.Vector4(...mp)},uLight:{value:LOGO_LIGHT}},
      transparent:true,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-4,polygonOffsetUnits:-4,side:THREE.DoubleSide,
      vertexShader:`varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`,
      fragmentShader:`uniform sampler2D map;uniform int uMode;uniform vec3 uBase;uniform vec4 uMap;uniform float uLight;varying vec2 vUv;
        void main(){
          vec4 t=texture2D(map,vUv);vec3 c;float a;
          if(uMode==0){c=t.rgb;a=t.a;}
          else if(uMode==1){c=uBase;a=t.a;}
          else{float l=dot(t.rgb,vec3(.2126,.7152,.0722));a=clamp((l-uMap.x)/(uMap.y-uMap.x),0.,1.)*(uMap.w-uMap.z)+uMap.z;c=uBase;}
          gl_FragColor=vec4(c*uLight,a);
        }`});
    const mesh=new THREE.Mesh(g,m);mesh.renderOrder=1;mesh.frustumCulled=false;mesh.name="Logo_"+L.name;scene.add(mesh);logoMeshes.push([mesh,L.name]);deck?.adoptLogo(mesh,L.name);
  }
}).catch(e=>console.warn("logos failed",e));

const box=name=>new THREE.Box3().setFromObject(meshes[name]);
function deskTapeBox(){
  const b=new THREE.Box3(),v=new THREE.Vector3(),m=meshes.Room_Tapes;
  m.updateWorldMatrix(true,false);
  const pos=m.geometry.attributes.position;
  for(let i=0;i<pos.count;i++){
    v.fromBufferAttribute(pos,i).applyMatrix4(m.matrixWorld);
    if(v.y>DESK_TOP)b.expandByPoint(v);
  }
  return b;
}
let tapeBox;
// Which tape contains this point: the tape whose box holds it with the most vertical margin (stacked tapes share faces).
function tapeAt(p){
  let best=null,bestM=-Infinity;
  for(const t of TAPES){
    const b=t.box.clone().expandByScalar(0.004);
    if(!b.containsPoint(p))continue;
    const m=Math.min(p.y-t.box.min.y,t.box.max.y-p.y);
    if(m>bestM){bestM=m;best=t.idx}
  }
  return best;
}
let VIEWS,snap=null;
function anchorFrame(b,dir,fit,usable){
  const tv=Math.tan(THREE.MathUtils.degToRad(lensFov()/2));
  const c=b.getCenter(new THREE.Vector3()),sz=b.getSize(new THREE.Vector3());
  const rw=Math.hypot(sz.x,sz.z)/2,rh=sz.y/2,th=tv*Math.max(.3,usable);
  const d=Math.max(.28,fit*Math.max(rh/tv,rw/th)+Math.hypot(sz.x,sz.z)*.12);
  return {target:c,pos:c.clone().add(new THREE.Vector3(...dir).normalize().multiplyScalar(d))};
}
function buildViews(){
  const ibmC=box("Room_Station").getCenter(new THREE.Vector3());
  ibmC.y+=0.36;                                   // round 3: dresser + computer, aim between keyboard and screen
  const note=new THREE.Vector3(-0.47,0.76,-1.84);
  // Felix's Work page: the TV, the VCR and the tapes together from above (dir -0.06, 0.42, 1), the card to the right of the picture.
  const B=box("Room_Monitor").clone();TAPES.forEach(t=>B.union(t.box));
  const a=innerWidth/innerHeight,sideT=Math.min(innerWidth*0.4,440),sideP=Math.min(innerWidth*0.45,540);
  const fT=anchorFrame(B,[-0.06,0.42,1],1.0,(innerWidth-sideT-60)/innerHeight);
  const fP=anchorFrame(B,[-0.06,0.42,1],1.0,(innerWidth-sideP-60)/innerHeight);
  // Felix's Z, the TV glass filling the view
  const tv=Math.tan(THREE.MathUtils.degToRad(lensFov()/2)),dz=Math.max(.46,CRT.h/2/(tv*.85),CRT.w/2/(tv*a*.8));
  VIEWS={
    home:{target:HOME.target.clone(),pos:HOME.pos.clone()},
    tapes:{...fT,shift:(sideT+40)/2},
    ibm:{target:new THREE.Vector3(-2.72,0.84,-1.2),pos:new THREE.Vector3(-1.78,0.97,-1.2)},
    clocks:{target:new THREE.Vector3(-1.8,2.1,-2.55),pos:new THREE.Vector3(-1.0,1.5,-0.5)},
    notepad:{target:new THREE.Vector3(-0.385,0.739,-1.84),pos:new THREE.Vector3(-0.385,1.14,-1.63)},
    work:{...fP,shift:(sideP+40)/2},
    chair:{target:new THREE.Vector3(3.0,0.95,-1.0),pos:new THREE.Vector3(1.35,1.3,0.55)},
    outside:{target:new THREE.Vector3(-0.18,1.52,-2.6),pos:new THREE.Vector3(-0.18,1.47,-2.2)},
    desk:{target:TV0.clone(),pos:TV0.clone().add(new THREE.Vector3(0,.013,1).multiplyScalar(dz))}
  };
  {const wt=TV0.clone().add(new THREE.Vector3(0.05,-0.055,0)),wd=0.88*Math.max(1,Math.tan(THREE.MathUtils.degToRad(FOV/2))*1.3/(tv*a));
   VIEWS.watch={target:wt,pos:wt.clone().add(new THREE.Vector3(-0.09,0.07,1).normalize().multiplyScalar(wd))}}
  if(phone){const pc=phone.frame.getCenter(new THREE.Vector3());VIEWS.phone={target:pc.clone().add(new THREE.Vector3(0,0,0.05)),pos:pc.clone().add(new THREE.Vector3(0,0,0.05)).add(new THREE.Vector3(0.02,0.85,0.55).normalize().multiplyScalar(0.8))}}
}
let shiftPx=0;
function setShift(px){shiftPx=px;if(Math.abs(px)<0.5)camera.clearViewOffset();else camera.setViewOffset(innerWidth,innerHeight,px,0,innerWidth,innerHeight)}

let tween=null;
function flyTo(name){
  const v=VIEWS[name];if(!v)return;
  if(name!=="phone"){phone?.release();phoneQuiet=false}
  crtVideo.away(name==="notepad");
  const from={p:camera.position.clone(),t:(controls.lookTarget.lengthSq()?controls.lookTarget:controls.target).clone(),s:shiftPx};
  const dur=reduced?1:1300;
  document.documentElement.dataset.view=name==="ibm"||name==="desk"||name==="outside"||name==="notepad"||name==="chair"?name:"";
  controls.enabled=false;
  tween={start:performance.now(),dur,from,to:v,name};
}
function stepTween(now){
  if(!tween)return;
  let k=Math.min(1,(now-tween.start)/tween.dur);
  const e=k<.5?4*k*k*k:1-Math.pow(-2*k+2,3)/2;
  camera.position.lerpVectors(tween.from.p,tween.to.pos,e);
  controls.target.lerpVectors(tween.from.t,tween.to.target,e);
  setShift(tween.from.s+((tween.to.shift||0)-tween.from.s)*e);
  camera.lookAt(controls.target);
  if(k>=1){
    const wasHome=tween.name==="home";snap={name:tween.name,pos:tween.to.pos.clone()};tween=null;controls.enabled=true;controls.setFromCamera(wasHome);
  }
}

const panel=$("panel"),pBody=$("panel-body");
let panelState=null;
function el(tag,text,cls){const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n}
function openPanel(kind,idx=0){
  panelState={kind,idx};
  pBody.replaceChildren();
  if(kind==="tapes"){
    const p=projects[idx];
    $("panel-eyebrow").textContent=`TAPE ${String(idx+1).padStart(2,"0")} / ${String(projects.length).padStart(2,"0")}`+(p.year?`  ·  ${p.year}`:"");
    $("panel-title").textContent=p.title;
    pBody.append(el("p",p.summary));
    if(p.stack.length){const tags=el("div",undefined,"tags");p.stack.forEach(s=>tags.append(el("span",s)));pBody.append(tags)}
    if(p.link){const a=el("a","View project");a.href=p.link;a.target="_blank";a.rel="noopener noreferrer";const w=el("p");w.append(a);pBody.append(w)}
    const pager=el("div",undefined,"pager");
    const prev=el("button","< PREV"),next=el("button","NEXT >");
    prev.onclick=()=>showTape((idx+projects.length-1)%projects.length,{fly:false});
    next.onclick=()=>showTape((idx+1)%projects.length,{fly:false});
    pager.append(prev,next);pBody.append(pager);
  }else{
    const c={ibm,notepad,credits}[kind];
    $("panel-eyebrow").textContent=c.eyebrow;
    $("panel-title").textContent=c.title;
    (c.paragraphs||[]).forEach(t=>pBody.append(el("p",t)));
    if(c.skills){const tags=el("div",undefined,"tags");c.skills.forEach(s=>tags.append(el("span",s)));pBody.append(tags)}
    const list=c.items||[];
    if(list.length){const ul=el("ul");list.forEach(t=>ul.append(el("li",t)));pBody.append(ul)}
    if(c.links){
      const ul=el("ul");
      c.links.forEach(l=>{const li=el("li"),a=el("a",l.label);a.href=l.href;if(l.href.startsWith("http")){a.target="_blank";a.rel="noopener noreferrer"}li.append(a);ul.append(li)});
      pBody.append(ul);
    }
  }
  panel.hidden=false;
}
function closePanel(){panel.hidden=true;panelState=null}
// The pad lifts off the desk and hangs in front of the camera on the right. Its texture and material never change.
const padScrim=document.createElement("div");padScrim.id="pad-scrim";padScrim.hidden=true;
const padSr=document.createElement("div");padSr.className="pad-sr";padSr.hidden=true;padSr.setAttribute("role","dialog");padSr.setAttribute("aria-label",pad.title);
const padClose=document.createElement("button");padClose.type="button";padClose.id="pad-close";padClose.textContent="PUT DOWN · ESC";padClose.hidden=true;
document.body.append(padScrim,padSr,padClose);
const padRest={pos:padMesh.position.clone(),quat:padMesh.quaternion.clone()};
const padLift={k:0,dir:0,t0:0,from:0};
const _f=new THREE.Vector3(),_r=new THREE.Vector3(),_u=new THREE.Vector3(),_tp=new THREE.Vector3(),_tq=new THREE.Quaternion(),_tilt=new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,0,1),-0.05);
function padOpen(){return padLift.dir===1}
function liftPad(){
  if(padOpen())return;
  padSr.replaceChildren(el("h2",pad.title));
  pad.sections.forEach(s=>{padSr.append(el("h3",s.head));const ul=el("ul");s.items.forEach(t=>ul.append(el("li",t)));padSr.append(ul)});
  padSr.hidden=false;padScrim.hidden=false;padClose.hidden=false;
  requestAnimationFrame(()=>{padScrim.classList.add("on");padClose.classList.add("on")});
  padMesh.renderOrder=999;
  Object.assign(padLift,{dir:1,t0:performance.now(),from:padLift.k});
  flyTo("work");
}
function dropPad(back=false){
  if(!padOpen())return;
  if(back)flyTo("home");
  padScrim.classList.remove("on");padClose.classList.remove("on");padSr.hidden=true;
  Object.assign(padLift,{dir:-1,t0:performance.now(),from:padLift.k});
}
function stepPad(now){
  if(!padLift.dir)return;
  const dur=reduced?1:1300;
  const p=Math.min(1,(now-padLift.t0)/dur);
  const target=padLift.dir>0?1:0;
  const s=padLift.from+(target-padLift.from)*p;
  padLift.k=s<.5?4*s*s*s:1-Math.pow(-2*s+2,3)/2;
  camera.updateMatrixWorld();
  camera.getWorldDirection(_f);_r.crossVectors(_f,camera.up).normalize();_u.crossVectors(_r,_f);
  const th=Math.tan(THREE.MathUtils.degToRad(camera.fov/2)),asp=innerWidth/innerHeight,D=Math.min(1.2,PAD.w/(0.40*2*th*asp));
  _tp.copy(camera.position).addScaledVector(_f,D).addScaledVector(_r,(0.56+2*shiftPx/innerWidth)*D*th*asp);
  _tq.copy(camera.quaternion).multiply(_tilt);
  padMesh.position.lerpVectors(padRest.pos,_tp,padLift.k);
  padMesh.position.y+=Math.sin(Math.PI*padLift.k)*0.06;
  padMesh.quaternion.slerpQuaternions(padRest.quat,_tq,padLift.k);
  padMesh.scale.setScalar(1+0.02*padLift.k);
  padMesh.material.color.set(PAPER_TINT).multiplyScalar(1+0.2*padLift.k);
  if(p>=1){
    if(padLift.dir<0){padMesh.position.copy(padRest.pos);padMesh.quaternion.copy(padRest.quat);padMesh.scale.setScalar(1);padMesh.renderOrder=1;padScrim.hidden=true;padClose.hidden=true}
    if(padLift.dir>0)padLift.t0=-Infinity;else padLift.dir=0;
  }
}
const _rrc=new THREE.Raycaster(),_rp=new THREE.Vector2();
function padRowAt(ev){
  if(!padOpen())return null;
  _rp.set((ev.clientX/innerWidth)*2-1,-(ev.clientY/innerHeight)*2+1);_rrc.setFromCamera(_rp,camera);
  const h=_rrc.intersectObject(padMesh,false)[0];if(!h||!h.uv)return null;
  const px=h.uv.x*PAD_W,py=(1-h.uv.y)*PAD_H;
  const r=PAD_ROWS.find(r=>px>=r.x0&&px<=r.x1&&py>=r.y0&&py<=r.y1);
  return r?r.i:null;
}
padScrim.addEventListener("click",ev=>{const r=padRowAt(ev);if(r!==null)showTape(r,{fly:false});else dropPad(true)});
padClose.addEventListener("click",()=>dropPad(true));
addEventListener("keydown",e=>{
  if(e.metaKey||e.ctrlKey||e.altKey||document.getElementById("crt-gate"))return;
  if(e.key==="Escape"&&padOpen()){e.stopImmediatePropagation();dropPad(true)}
},true);

function go(name){
  if(name!=="notepad")notebook?.stop();
  if(name!=="pad")dropPad();
  if(name!=="ibm"&&name!=="contact"&&name!=="pcpower")term.setActive(false);
  if(name==="tapes")showTape(panelState?.kind==="tapes"?panelState.idx:deck&&deck.inVcr>=0?deck.inVcr:0)
  else if(name==="ibm"){menuIbm="ibm";flyTo("ibm");closePanel();if(pc.on)term.setActive(true)}
  else if(name==="contact"){
    flyTo("ibm");closePanel();menuIbm="contact";
    if(!pc.on)togglePc();
    const was=term.active;term.setActive(true);
    setTimeout(()=>{if(term.active)term.command("CONTACT")},reduced?0:(was?900:1500));
  }
  else if(name==="notepad"){
    const again=snap?.name==="notepad"&&!tween;
    flyTo("notepad");closePanel();
    if(again&&notebook?.playing)notebook.skip();else notebook?.start(performance.now());
  }
  else if(name==="pad")liftPad();
  else if(name==="power")toggleTv();
  else if(name==="phone"){
    if(phone&&!tween&&snap?.name==="phone"&&(phone.mode==="down"||phone.mode==="speaker")){phone.hangup();return}
    flyTo("phone");closePanel();phone?.answer()
  }
  else if(name==="pcpower")togglePc();
  else if(name==="clocks"){flyTo("clocks");closePanel()}
  else if(name==="chair"){flyTo(snap?.name==="chair"&&!tween?"home":"chair");closePanel()}
  else if(name==="window"){flyTo(snap?.name==="outside"&&!tween?"home":"outside");closePanel()}
  else if(name==="desk"){flyTo(snap?.name==="desk"&&!tween?"home":"desk");closePanel()}
  else{flyTo("home");closePanel()}
}

document.querySelectorAll("[data-view]").forEach(b=>b.addEventListener("click",()=>{
  if(document.documentElement.classList.contains("crt-gating"))return;
  if(b.closest(".menu")&&b.dataset.view==="pad"&&padOpen()){dropPad(true);return}
  go(b.dataset.view);
}));
$("home-link").addEventListener("click",()=>{if(!document.documentElement.classList.contains("crt-gating"))go("home")});
let menuIbm="ibm";
const menuLinks=[...document.querySelectorAll(".menu [data-view]")];let menuCur="";
function syncMenu(){
  const cur=padOpen()?"pad":term.active?menuIbm:"";
  if(cur===menuCur)return;menuCur=cur;
  menuLinks.forEach(b=>b.dataset.view===cur?b.setAttribute("aria-current","page"):b.removeAttribute("aria-current"));
}
$("panel-close").addEventListener("click",()=>go("home"));
// Credits: an index card floats up from below the frame and is typed on; ESC, a click outside or CLOSE puts it back.
const CREDITS=[
  ["Clock tick","felixrieseberg.com","https://www.felixrieseberg.com"],
  ["Phone voice","Piper, Amy voice","https://github.com/rhasspy/piper"],
  ["Fonts","Google Fonts","https://fonts.google.com"]
];
const cred=(()=>{
  const root=el("div",undefined,"cred");root.id="cred";root.hidden=true;
  const card=el("div",undefined,"cred-card");card.setAttribute("role","dialog");card.setAttribute("aria-label","Credits");
  const x=el("button","CLOSE · ESC","cred-x");x.type="button";
  const h=el("h2","CREDITS");
  const ul=el("ul");
  CREDITS.forEach(([t,by,url],i)=>{
    const li=el("li");li.style.setProperty("--i",i);
    const b=url?el("a",t):el("b",t);if(url){b.href=url;b.target="_blank";b.rel="noopener noreferrer"}
    li.append(b,el("span"," · "+by));ul.append(li);
  });
  card.append(x,h,ul);root.append(card);document.body.append(root);
  let timer=0;
  const api={
    get open(){return !root.hidden&&root.classList.contains("in")},
    show(){clearTimeout(timer);root.hidden=false;void root.offsetWidth;root.classList.add("in");x.focus({preventScroll:true})},
    hide(){root.classList.remove("in");clearTimeout(timer);timer=setTimeout(()=>{root.hidden=true},reduced?0:900);$("btn-credits").focus({preventScroll:true})}
  };
  x.addEventListener("click",()=>api.hide());
  root.addEventListener("click",e=>{if(e.target===root)api.hide()});
  return api;
})();
function creditsOpen(){return cred.open}
function closeCredits(){cred.hide()}
$("btn-credits").addEventListener("click",()=>{cred.open?cred.hide():cred.show()});
$("back").addEventListener("click",()=>go("home"));
addEventListener("keydown",e=>{
  if(e.metaKey||e.ctrlKey||e.altKey)return;
  const k=e.key.toLowerCase();
  if(k==="t")go("tapes");
  else if(k==="c")go("ibm");
  else if(k==="n")go("pad");
  else if(k==="z")go("desk");
  else if(k==="b")go("notepad");
  else if(k==="r")go("chair");
  else if(k==="w")go("window");
  else if(vcrKey(e,k))e.preventDefault();
  else if(k==="p")go("power");
  else if(k==="h")go("phone");
  else if(k==="k")go("clocks");
  else if(k==="escape"){if(creditsOpen())closeCredits();else go("home")}
});

class QuietAmbience extends Ambience{
  init(){if(this.ctx)return;super.init();const t=this.ctx.createGain();t.gain.value=0.13;this.rainGain.disconnect();this.rainGain.connect(t);t.connect(this.master)}
}
const audio=new QuietAmbience();
const sfx=createSfx({enabled:()=>audio.rainOn});
const soundBtn=$("btn-sound"),lofiBtn=$("btn-lofi");
soundBtn.addEventListener("click",async()=>{
  const on=!audio.rainOn;
  await audio.setRain(on);
  soundBtn.textContent=on?"SOUND ON":"SOUND OFF";soundBtn.setAttribute("aria-pressed",String(on));
});
const lofiDlg=$("lofi-dialog");
lofiBtn.addEventListener("click",()=>{if(!lofiDlg.open)lofiDlg.showModal()});
$("lofi-stay").addEventListener("click",()=>lofiDlg.close());
$("lofi-go").addEventListener("click",()=>{location.assign("mobile.html")});
lofiDlg.addEventListener("keydown",e=>e.stopPropagation());
lofiDlg.addEventListener("click",e=>{if(e.target===lofiDlg)lofiDlg.close()});


function moveHint(h,ev){
  const flip=ev.clientX>innerWidth*0.55;
  h.style.setProperty("--tx",(flip?ev.clientX-12:ev.clientX+12)+"px");h.style.setProperty("--fx",flip?"-100%":"0%");
  h.style.setProperty("--ty",ev.clientY+14+"px");
}
// Every clickable thing says what a click does, in the hint that follows the cursor.
function tipFor3d(h){
  switch(h.kind){
    case"tapes":return "CLICK TO PLAY THIS TAPE: "+TAPE_INFO[h.idx].title;
    case"ibm":return "CLICK TO USE THE COMPUTER";
    case"pad":return "CLICK TO LIFT THE WORK NOTES";
    case"desk":return snap?.name==="desk"?"CLICK TO ZOOM BACK OUT":"CLICK TO ZOOM IN ON THE TV";
    case"vcr":return vcrTip(h.id);
    case"notepad":return snap?.name==="notepad"?(notebook?.playing?"CLICK TO FINISH THIS PAGE":"CLICK THE ARROW ON THE PAGE TO TURN IT"):"CLICK TO SEE WHAT I AM WORKING TOWARD NEXT";
    case"edge":return "CLICK OR DRAG RIGHT TO LOOK AT THE CHAIR WALL";
    case"window":return "CLICK TO LOOK AT THE VIEW OUTSIDE THE WINDOW";
    case"power":return tv.on?"CLICK TO TURN OFF THE TV":"CLICK TO TURN ON THE TV";
    case"pcpower":return pc.on?"CLICK TO TURN OFF THE COMPUTER":"CLICK TO TURN ON THE COMPUTER";
    case"phone":{
      const mo=phone.mode;
      if(h.part==="speaker"&&mo==="down")return "CLICK TO PUT ME ON SPEAKER";
      if(mo==="down"||mo==="speaker")return "CLICK TO PUT THE PHONE BACK";
      return mo==="ringing"?"THE PHONE IS RINGING · CLICK TO ANSWER":"CLICK TO PICK UP THE PHONE";
    }
    default:return "CLICK TO OPEN THE NOTEPAD";
  }
}
const VIEW_TIPS={chair:"CLICK TO LOOK AT THE CHAIR AND THE RIGHT WALL · KEY R",notepad:"CLICK TO SEE WHAT I AM WORKING TOWARD NEXT · KEY B",outside:"CLICK TO LOOK OUT OF THE WINDOW · KEY W",clocks:"CLICK TO LOOK AT THE CLOCKS · KEY K",phone:"CLICK TO ANSWER THE PHONE · KEY H",tapes:"CLICK TO LOOK AT THE TAPES · KEY T",ibm:"CLICK TO USE THE COMPUTER · KEY C",pad:"CLICK TO LIFT THE WORK NOTES · KEY N",desk:"CLICK TO ZOOM IN ON THE TV · KEY Z",
  power:()=>(tv.on?"CLICK TO TURN OFF THE TV":"CLICK TO TURN ON THE TV")+" · KEY P"};
function tipFor(el){
  if(el.id==="pad-scrim")return "CLICK ANYWHERE TO PUT THE PAPER BACK DOWN";
  const b=el.closest("button,a");if(!b)return null;
  if(b.dataset.tip)return b.dataset.tip;
  if(b.dataset.view){const t=VIEW_TIPS[b.dataset.view];return typeof t==="function"?t():t||null}
  switch(b.id){
    case"pad-close":return "CLICK TO PUT THE PAPER BACK DOWN · ESC";
    case"panel-close":return "CLICK TO CLOSE AND GO BACK TO THE DESK · ESC";
    case"btn-credits":return "CLICK TO SEE THE CREDITS";
    case"back":return "CLICK TO GO BACK TO THE DESK · ESC";
    case"btn-sound":return audio.rainOn?"CLICK TO TURN THE RAIN SOUND OFF":"CLICK TO TURN THE RAIN SOUND ON";
    case"btn-lofi":return "CLICK TO SWITCH TO THE LO-FI VERSION";
  }
  const t=b.textContent.trim();
  if(t.startsWith("<"))return "CLICK FOR THE PREVIOUS TAPE";
  if(t.startsWith("NEXT"))return "CLICK FOR THE NEXT TAPE";
  if(b.tagName==="A")return "CLICK TO OPEN THIS LINK IN A NEW TAB";
  return null;
}
document.addEventListener("pointermove",ev=>{
  if(ev.pointerType!=="mouse"||ev.target===canvas)return;
  const h=$("hint");let t=tipFor(ev.target);
  if(ev.target.id==="pad-scrim"){const r=padRowAt(ev);t=r!==null?"CLICK TO PLAY THIS TAPE: "+TAPE_INFO[r].title:"CLICK ANYWHERE ELSE TO PUT THE PAPER BACK DOWN"}
  moveHint(h,ev);
  if(t){h.textContent=t;h.classList.add("show")}else h.classList.remove("show");
});
document.addEventListener("pointerleave",()=>$("hint").classList.remove("show"));

const ray=new THREE.Raycaster();
const ptr=new THREE.Vector2();
let hover=null;
function pick(ev){
  const r=canvas.getBoundingClientRect();
  ptr.set(((ev.clientX-r.left)/r.width)*2-1,-((ev.clientY-r.top)/r.height)*2+1);
  ray.setFromCamera(ptr,camera);
  const targets=["Room_Tapes","Room_Station","Room_Desk"].map(n=>meshes[n]).filter(Boolean);
  targets.push(padMesh,tvButton.hit,pcButton.hit,crtHit,windowHit,...VCR);
  if(notebook)targets.push(...notebook.pickMeshes());
  if(phone)targets.push(...phone.pickMeshes());
  if(deck)targets.push(...deck.pickMeshes());
  const hit=ray.intersectObjects(targets,false)[0];
  if(!hit)return null;
  const n=hit.object.name;
  if(hit.object.userData.tape!==undefined)return {kind:"tapes",idx:hit.object.userData.tape};
  if(hit.object.userData.phone)return {kind:"phone",part:hit.object.userData.phone==="base"&&phone.speakerHit(ray)?"speaker":hit.object.userData.phone};
  if(n==="Pad")return {kind:"pad"};
  if(hit.object.userData.notebook)return {kind:"notepad",nav:notebook?.navAt(hit)};
  if(hit.object.userData.vcr)return {kind:"vcr",id:hit.object.userData.vcr};
  if(n==="WindowHit")return {kind:"window"};
  if(n==="TvPower")return {kind:"power"};
  if(n==="CrtHit")return {kind:"desk"};
  if(n==="PcPower")return {kind:"pcpower"};
  if(n==="Room_Tapes"){
    const idx=tapeAt(hit.point);
    return idx===null?null:{kind:"tapes",idx};
  }
  if(n==="Room_Station")return {kind:"ibm"};
  if(Math.hypot(hit.point.x+0.47,hit.point.z+1.84)<0.3&&hit.point.y<0.95)return {kind:"notepad"};
  return null;
}
const edgeZone=()=>false;
canvas.addEventListener("pointermove",ev=>{
  if(ev.pointerType!=="mouse"||tween||ev.buttons)return;
  hover=snap?.name==="outside"?{kind:"window"}:pick(ev);
  if(!hover&&edgeZone(ev))hover={kind:"edge"};
  canvas.classList.toggle("hot",!!hover);
  const h=$("hint");
  moveHint(h,ev);
  if(hover){h.textContent=snap?.name==="outside"?"CLICK TO GO BACK TO THE DESK":tipFor3d(hover);h.classList.add("show")}
  else h.classList.remove("show");
});
let down=null;
canvas.addEventListener("pointerdown",ev=>{down={x:ev.clientX,y:ev.clientY}});
canvas.addEventListener("pointerup",ev=>{
  if(!down||tween)return;
  const moved=Math.hypot(ev.clientX-down.x,ev.clientY-down.y);down=null;
  if(moved>6||controls.clickBlocked)return;     // a drag or pinch is never a click
  if(term.active&&pc.on){
    const r=canvas.getBoundingClientRect();
    ptr.set(((ev.clientX-r.left)/r.width)*2-1,-((ev.clientY-r.top)/r.height)*2+1);
    ray.setFromCamera(ptr,camera);
    const th=ray.intersectObject(term.mesh,false)[0];
    if(th){term.clickAt(th.uv);return}
  }
  if(snap?.name==="outside"){go("home");return}
  const hit=pick(ev);
  if(!hit){if(edgeZone(ev))go("chair");return}
  if(hit.kind==="vcr")vcrDo(hit.id);
  else if(hit.kind==="tapes")showTape(hit.idx);
  else if(hit.kind==="notepad"&&snap?.name==="notepad"&&hit.nav!=null)notebook.flip(hit.nav);
  else if(hit.kind==="phone")phoneClick(hit.part);
  else go(hit.kind);
});

const composer=new EffectComposer(renderer,new THREE.WebGLRenderTarget(1,1,{type:THREE.HalfFloatType,samples:COARSE?2:4}));
composer.addPass(new RenderPass(scene,camera));
const bloom=new UnrealBloomPass(new THREE.Vector2(1,1),0.42,0.5,0.93);
composer.addPass(bloom);
composer.addPass(new OutputPass());
// The colour grade, tint, vignette and film grain, done in one pass here. They used to be a CSS filter, two blend layers and a canvas
// refilled 12 times a second, which made the browser re-composite the whole page on every frame.
const gradeU={uTime:{value:0},uTint:{value:1},uGrain:{value:1}};
const gradePass=new ShaderPass(new THREE.ShaderMaterial({uniforms:{tDiffuse:{value:null},...gradeU},
  vertexShader:`varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`,
  fragmentShader:`uniform sampler2D tDiffuse;uniform float uTime,uTint,uGrain;varying vec2 vUv;
    float hash(vec2 p){vec3 q=fract(vec3(p.xyx)*0.1031);q+=dot(q,q.yzx+33.33);return fract((q.x+q.y)*q.z);}
    vec3 softLight(vec3 cb,vec3 cs){
      vec3 d=mix(sqrt(cb),((16.0*cb-12.0)*cb+4.0)*cb,step(cb,vec3(0.25)));
      return mix(cb-(1.0-2.0*cs)*cb*(1.0-cb),cb+(2.0*cs-1.0)*(d-cb),step(vec3(0.5),cs));
    }
    void main(){
      vec3 c=texture2D(tDiffuse,vUv).rgb;
      c=clamp(vec3(c.r+0.012,pow(max(c.g,0.0),1.03)+0.010,c.b+0.016),0.0,1.0);
      float l=dot(c,vec3(0.2126,0.7152,0.0722));c=clamp(mix(vec3(l),c,0.96),0.0,1.0);
      c=clamp((c-0.5)*0.97+0.5,0.0,1.0);c=clamp(c*1.02,0.0,1.0);
      float g=clamp((1.0-vUv.y)/0.7,0.0,1.0);
      vec3 tc=mix(vec3(40.0,50.0,120.0),vec3(255.0,150.0,60.0),g)/255.0;
      c=mix(c,softLight(c,tc),mix(0.30,0.12,g)*uTint);
      vec2 e=vec2((vUv.x-0.5)/0.75,(vUv.y-0.42)/0.70);float r=length(e);
      float va=r<0.55?0.0:r<0.88?0.22*(r-0.55)/0.33:r<1.0?0.22+0.18*(r-0.88)/0.12:0.4;
      c=mix(c,vec3(6.0,3.0,14.0)/255.0,va);
      float n=hash(floor(vUv*vec2(1280.0,720.0))+vec2(floor(uTime*12.0)*37.0,floor(uTime*12.0)*17.0));
      vec3 gn=vec3(128.0+(n-0.5)*40.0)/255.0*vec3(1.0,0.97,0.9);
      vec3 ov=mix(2.0*c*gn,1.0-2.0*(1.0-c)*(1.0-gn),step(vec3(0.5),c));
      c=mix(c,ov,0.08*uGrain);
      gl_FragColor=vec4(c,1.0);
    }`}));
composer.addPass(gradePass);
function setBuffers(){
  const w=innerWidth,h=innerHeight;
  renderer.setPixelRatio(prNow);composer.setPixelRatio(prNow);
  renderer.setSize(w,h,false);composer.setSize(w,h);steamU.uPx.value=h*prNow/(2*Math.tan(camera.fov*Math.PI/360));
}
// Drops the render resolution when frames run long and brings it back when there is room, so the scene keeps moving.
let emaDt=16.7,lastT=0,slowT=0,fastT=0;
function adaptRes(now){
  const dt=lastT?now-lastT:16.7;lastT=now;
  if(PR_FIXED||dt>250||document.hidden)return;
  if(crtVideo.active&&prNow<1){prNow=Math.min(PR_CAP,1);setBuffers();slowT=0;return}
  emaDt+=(dt-emaDt)*0.06;
  if(emaDt>24){slowT+=dt;fastT=0}else if(emaDt<15){fastT+=dt;slowT=0}else{slowT=0;fastT=0}
  if(slowT>1200&&prNow>(Math.max(PR_FLOOR,crtVideo.active?1:0))){prNow=Math.max(Math.max(PR_FLOOR,crtVideo.active?1:0),prNow-0.2);slowT=0;emaDt=16.7;setBuffers()}
  else if(fastT>8000&&prNow<PR_CAP){prNow=Math.min(PR_CAP,prNow+0.15);fastT=0;setBuffers()}
}
function resize(){
  const w=innerWidth,h=innerHeight;
  camera.fov=lensFov();setBuffers();steamU.uPx.value=h*renderer.getPixelRatio()/(2*Math.tan(camera.fov*Math.PI/360));
  camera.aspect=w/h;
  camera.fov=lensFov();
  camera.updateProjectionMatrix();
  setShift(shiftPx);
  if(VIEWS){
    const f=homeFrame();HOME.pos.copy(f.pos);HOME.target.copy(f.target);
    const was=snap&&!tween&&camera.position.distanceTo(snap.pos)<0.02?snap.name:null;
    buildViews();
    if(was){const v=VIEWS[was];camera.position.copy(v.pos);controls.target.copy(v.target);camera.lookAt(v.target);setShift(v.shift||0);controls.setFromCamera(was==="home");snap={name:was,pos:v.pos.clone()}}
  }
}
addEventListener("resize",resize);resize();

// The lamp shadow maps (2 point lights x 6 cube faces over the whole room) used to be redrawn on every frame. The shadows only change
// when a caster moves (tape, phone handset, pencil) or its geometry/visibility changes, so they are redrawn only then. Output is identical.
renderer.shadowMap.autoUpdate=false;
const shCasters=[];let shCastT=-1e9,shSig=NaN,shWarm=0;
function shadowSync(now){
  if(now-shCastT>500){shCastT=now;shCasters.length=0;scene.traverse(o=>{if(o.isMesh&&o.castShadow)shCasters.push(o)})}
  let sig=shCasters.length;
  for(let i=0;i<shCasters.length;i++){
    const o=shCasters[i];o.updateWorldMatrix(true,false);
    const e=o.matrixWorld.elements;let h=o.visible?1:0;
    for(let k=0;k<16;k++)h+=e[k]*(k+1.37);
    const g=o.geometry;if(g&&g.index)h+=g.index.count*1e-3;
    sig+=h*(i+1);
  }
  if(sig!==shSig||shWarm<90){shSig=sig;shWarm++;renderer.shadowMap.needsUpdate=true}
}

let tintK=1;
function frame(now){
  requestAnimationFrame(frame);
  adaptRes(now);
  stepTween(now);
  if(controls.enabled)controls.update();
  stepPad(now);deck?.step(now);cityLife?.step(now/1000);phone?.step(now);notebook?.step(now);stepDeskGone();stepPc(now);term.step(now,reduced);ibmLights.step(now);crtVideo.step(now);
  if(gateEl===undefined||gateEl?.isConnected){
    gateEl=document.getElementById("crt-gate");
    if(gateEl){camera.updateMatrixWorld();
      const q=[[-1,1],[1,1],[1,-1],[-1,-1]].map(([sx,sy])=>{_gq.set(CRT.cx+sx*CRT.w/2,CRT.cy+sy*CRT.h/2,CRT.z).project(camera);return [(_gq.x+1)/2*innerWidth,(1-_gq.y)/2*innerHeight]});
      dispatchEvent(new CustomEvent("crtquad",{detail:q}))}
  }
  crtGlass.uniforms.uTime.value=reduced?0:now/1000;
  crtLive.uTime.value=reduced?0:now/1000;if(crtScreen.mesh.visible&&now-(crtScreen.last||0)>50){crtScreen.last=now;crtScreen.draw(reduced?0:now)}rainU.uTime.value=reduced?0:now/1000;steamU.uTime.value=reduced?3:now/1000;windU.uTime.value=reduced?0:now/1000;stepTv(now);syncMenu();if(clock.tex)drawClock(reduced?0:Math.floor((now-clock.t0)/1000));
  vidPass.enabled=crtVideo.active&&tv.off<0.02;
  gradeU.uTime.value=reduced?0:now/1000;gradeU.uGrain.value+=((crtVideo.active?0:1)-gradeU.uGrain.value)*0.15;
  tintK+=((document.documentElement.dataset.view==="ibm"?0.12:1)-tintK)*0.06;gradeU.uTint.value=tintK;
  shadowSync(now);
  composer.render();
}

// The old sheet is part of the room's geometry. Taking its triangles out leaves the desk top that was under it.
function hideSheet(){
  const c=Math.cos(UNDER.rotY),s=Math.sin(UNDER.rotY),v=new THREE.Vector3(),removed={};
  const inside=p=>{const dx=p.x-UNDER.x,dz=p.z-UNDER.z,u=dx*c-dz*s,w=dx*s+dz*c;return Math.abs(u)<0.17&&Math.abs(w)<0.12};
  for(const [name,m] of Object.entries(meshes)){
    const g=m.geometry,pos=g.attributes.position,idx=g.index;
    if(!idx)continue;
    m.updateWorldMatrix(true,false);
    const keep=[],n=idx.count;
    for(let i=0;i<n;i+=3){
      let all=true,hi=false;
      for(let j=0;j<3;j++){
        v.fromBufferAttribute(pos,idx.getX(i+j)).applyMatrix4(m.matrixWorld);
        if(!inside(v))all=false;
        if(v.y>0.7215&&v.y<0.74)hi=true;
      }
      if(all&&hi)removed[name]=(removed[name]||0)+1;
      else keep.push(idx.getX(i),idx.getX(i+1),idx.getX(i+2));
    }
    if(removed[name])g.setIndex(keep);
  }
  console.log("pad-sheet removed triangles",JSON.stringify(removed));
}

// Curtains sway in the wind. The baked light stays fixed; only the vertices move. Curtain_L/R sit at x -1.21..-0.83 and 0.92..1.31, z -2.47..-2.33.
const windU={uTime:{value:0}};
function setupWind(){
  const mesh=meshes.Room_Window,mat=mesh&&mesh.material;if(!mat)return;
  const g=mesh.geometry,pos=g.attributes.position,a=new Float32Array(pos.count*2);let n=0;
  for(let i=0;i<pos.count;i++){
    const x=pos.getX(i),y=pos.getY(i),z=pos.getZ(i);
    if(z<-2.49||z>-2.32)continue;
    const left=x>-1.23&&x<-0.82,right=x>0.91&&x<1.32;if(!left&&!right)continue;
    const h=Math.min(1,Math.max(0,(2.45-y)/(2.45-0.76)));
    const free=left?(x+1.2)/0.37:(1.3-x)/0.37;
    a[i*2]=Math.pow(h,1.6)*(0.4+0.6*Math.min(1,Math.max(0,free)));a[i*2+1]=left?0:2.1;n++;
  }
  g.setAttribute("aWind",new THREE.BufferAttribute(a,2));
  mat.onBeforeCompile=sh=>{
    sh.uniforms.uTime=windU.uTime;
    sh.vertexShader="uniform float uTime;attribute vec2 aWind;\n"+sh.vertexShader.replace("#include <begin_vertex>",`#include <begin_vertex>
      float wt=uTime;float gust=0.55+0.45*sin(wt*0.43+aWind.y)*sin(wt*0.29+1.3);
      float sw=sin(wt*1.15-aWind.x*2.6+aWind.y+position.x*2.2)+0.5*sin(wt*2.1-aWind.x*4.1+position.x*3.3);
      transformed.z+=aWind.x*0.2*(0.45+0.45*sw*gust);
      transformed.x+=aWind.x*0.12*sin(wt*0.95-aWind.x*2.2+aWind.y)*(0.5+0.5*gust);`);
  };
  mat.needsUpdate=true;
  console.log("curtain wind vertices",n);
}

// Plant: leaves and stems sway in the same wind as the curtains. The pot, soil and stones (below y 0.936) stay still.
function setupPlant(){
  const mesh=meshes.Room_Plant,mat=mesh&&mesh.material;if(!mat)return;
  const g=mesh.geometry,pos=g.attributes.position,a=new Float32Array(pos.count),v=new THREE.Vector3();let n=0;
  mesh.updateWorldMatrix(true,false);
  for(let i=0;i<pos.count;i++){
    v.fromBufferAttribute(pos,i).applyMatrix4(mesh.matrixWorld);
    const up=Math.min(1,Math.max(0,(v.y-0.93)/0.3)),out=Math.min(1,Math.hypot(v.x+0.9,v.z+2.04)/0.5);
    const w=up*up*(3-2*up)*(0.25+0.75*out);
    a[i]=w;if(w>0)n++;
  }
  g.setAttribute("aSway",new THREE.BufferAttribute(a,1));
  const prev=mat.onBeforeCompile;
  mat.onBeforeCompile=sh=>{
    if(prev)prev.call(mat,sh);
    sh.uniforms.uTime=windU.uTime;
    sh.vertexShader="uniform float uTime;attribute float aSway;\n"+sh.vertexShader.replace("#include <begin_vertex>",`#include <begin_vertex>
      vec3 wp0=(modelMatrix*vec4(position,1.0)).xyz;float ph=wp0.x*4.1+wp0.z*3.3+wp0.y*1.7;
      float gu=0.55+0.45*sin(uTime*0.43)*sin(uTime*0.29+1.3);
      vec3 dw=vec3(sin(uTime*1.35+ph)*0.6+sin(uTime*2.7+ph*1.7)*0.25,sin(uTime*1.9+ph*1.3)*0.22,cos(uTime*1.15+ph*0.8)*0.5+0.18)*aSway*0.07*(0.5+0.8*gu);
      transformed+=transpose(mat3(modelMatrix))*dw;`);
  };
  mat.needsUpdate=true;
  console.log("plant sway vertices",n);
}

// What the tape in the recorder shows on the CRT: the same blue on-screen display Felix's TV uses.
const osd=(()=>{
  const W=800,H=600,cv=document.createElement("canvas");cv.width=W;cv.height=H;const x=cv.getContext("2d");
  const tex=new THREE.CanvasTexture(cv);tex.colorSpace=THREE.SRGBColorSpace;tex.anisotropy=8;
  const mat=new THREE.MeshBasicMaterial({map:tex,transparent:true});
  const mesh=new THREE.Mesh(new THREE.PlaneGeometry(CRT.w,CRT.h),mat);
  mesh.position.set(CRT.cx,CRT.cy,CRT.z+0.0028);mesh.renderOrder=1.2;mesh.visible=false;scene.add(mesh);
  const wrap=(t,max)=>{const out=[];let line="";for(const w of t.split(" ")){const n=line?line+" "+w:w;if(x.measureText(n).width>max&&line){out.push(line);line=w}else line=n}if(line)out.push(line);return out};
  let shown=-1;
  function draw(i){
    const p=TAPE_INFO[i];x.clearRect(0,0,W,H);x.save();x.beginPath();x.roundRect(0,0,W,H,30);x.clip();
    const g=x.createRadialGradient(W*.48,H*.42,0,W*.48,H*.42,W*.7);g.addColorStop(0,"#5d7ddb");g.addColorStop(.45,"#4c6ac9");g.addColorStop(1,"#3a55b3");
    x.fillStyle=g;x.fillRect(0,0,W,H);
    x.fillStyle="#f4f5ff";x.shadowColor="rgba(4,8,50,.5)";x.shadowOffsetX=3;x.shadowOffsetY=3;x.textBaseline="top";
    x.font="46px VT323, monospace";x.textAlign="left";x.fillText("\u25B6 LOADING",54,44);
    x.textAlign="right";x.fillText("CH "+String(i+1).padStart(2,"0"),W-54,44);
    x.textAlign="left";x.font="78px VT323, monospace";
    let y=190;for(const l of wrap(p.title,W-108)){x.fillText(l,54,y);y+=70}
    x.font="38px VT323, monospace";x.fillText("TAPE "+String(i+1).padStart(2,"0")+" / "+String(TAPE_INFO.length).padStart(2,"0"),54,H-84);
    x.shadowColor="transparent";x.fillStyle="rgba(8,14,60,.22)";for(let k=0;k<H;k+=4)x.fillRect(0,k,W,1.5);
    x.restore();tex.needsUpdate=true;
  }
  return {
    show(i){shown=i;const go=()=>{if(shown===i){draw(i);mat.opacity=1;mesh.visible=true}};document.fonts?.load("46px VT323").then(go,go)},
    hide(){shown=-1;mesh.visible=false},
    fade(k){if(mesh.visible){mat.opacity=1-k;if(k>=0.99)mesh.visible=false}}
  };
})();

// The picture is drawn after the scene's post-processing, straight to the canvas, so the film keeps its own colours.
const VW=1.075,VH=1.09;
const vidScene=new THREE.Scene();
const vidPass=new RenderPass(vidScene,camera);vidPass.clear=false;vidPass.clearDepth=false;vidPass.enabled=false;
composer.insertPass(vidPass,composer.passes.indexOf(gradePass));
const vidMat=new THREE.ShaderMaterial({uniforms:{uVid:{value:null},uK:{value:0},uNs:{value:0},uTime:{value:0}},transparent:true,depthTest:false,depthWrite:false,
  vertexShader:`varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`,
  fragmentShader:`uniform sampler2D uVid;uniform float uK,uNs,uTime;varying vec2 vUv;
    float h(vec2 p){return fract(sin(dot(p,vec2(12.9898,78.233)))*43758.5453);}
    // The films carry a baked 2-pixel scanline pattern. A [1 2 1] vertical filter cancels it exactly.
    vec3 T(vec2 o){vec2 py=vec2(0.,1./480.);return (texture2D(uVid,vUv+o+py).rgb+texture2D(uVid,vUv+o-py).rgb+2.*texture2D(uVid,vUv+o).rgb)*.25;}
    void main(){
      vec2 sz=vec2(${(CRT.w*VW).toFixed(4)},${(CRT.h*VH).toFixed(4)});vec2 q=(vUv-.5)*sz;float r=.02;
      float d=length(max(abs(q)-sz*.5+r,0.))-r;float mask=smoothstep(.0035,-.0035,d);
      vec2 px=vec2(1./640.,1./480.);
      vec3 vd=T(vec2(0.));
      vec3 bl=(T(vec2(px.x,0.))+T(vec2(-px.x,0.))+vd*2.)*.25;
      float ed=smoothstep(.05,.22,length(vd-bl));
      vd=mix((vd+bl)*.5,clamp(vd+(vd-bl)*.45,0.,1.),ed);
      vd=max(vd-.012,0.);
      vec3 nz=vec3(h(floor(vUv*vec2(160.,120.))+floor(uTime*30.)))*.85;
      gl_FragColor=vec4(mix(nz,mix(vd,nz,uNs),step(.5,uK)),mask*clamp(uK+uNs,0.,1.));
    }`});
{const mesh=new THREE.Mesh(new THREE.PlaneGeometry(CRT.w*VW,CRT.h*VH),vidMat);mesh.position.set(CRT.cx,CRT.cy,CRT.z+0.004);vidScene.add(mesh)}

// The tape in the recorder plays on the CRT: tracking static, then the picture. When a film ends the next tape in the row loads.
const VIDEOS=["tmac","dentalx","uh","blutech","softsync","walnut","powerguard","cio","forecast-kitchen","cost-center","gan","intro"].map(n=>"videos/"+n+".mp4?v=6");
const onComputer=()=>term.active||snap?.name==="ibm";
const PLAY_ORDER=[11,0,1,2,3,4,5,6,7,8,9,10];
const crtVideo=(()=>{
  const v=document.createElement("video");v.playsInline=true;v.preload="auto";v.setAttribute("playsinline","");v.muted=true;
  const tex=new THREE.VideoTexture(v);tex.colorSpace=THREE.NoColorSpace;tex.minFilter=THREE.LinearFilter;tex.generateMipmaps=false;
  vidMat.uniforms.uVid.value=tex;
  const blackTex=new THREE.DataTexture(new Uint8Array([0,0,0,255]),1,1);blackTex.needsUpdate=true;
  const buffered=()=>{if(!v.duration||!isFinite(v.duration))return 0;let e=0;for(let i=0;i<v.buffered.length;i++)if(v.buffered.start(i)<=0.6)e=Math.max(e,v.buffered.end(i));return Math.min(1,e/v.duration)};
  let started=false,armed=true,loadAt=0,shown=0,unlocked=false;
  let want=0,k=0,burst=0,held=false,cur=-1,last=performance.now(),away=false,userPaused=false;
  const api={onEnd:null,get paused(){return v.paused},get userMuted(){return userMute},get playing(){return cur>=0&&want>0},get active(){return vidMat.uniforms.uK.value>0.01||vidMat.uniforms.uNs.value>0.01}};
  v.addEventListener("ended",()=>{const done=cur;want=0;burst=1;api.onEnd?.(done)});
  let userMute=false;
  const muted=()=>soundBtn.getAttribute("aria-pressed")!=="true"||onComputer()||userMute||phoneQuiet;
  Object.assign(api,{
    play(i,go=true){
      cur=i;started=false;armed=go;shown=0;loadAt=performance.now();
      k=1;burst=0;vidMat.uniforms.uVid.value=blackTex;vidMat.uniforms.uK.value=1;vidMat.uniforms.uNs.value=0;crtScreen.mesh.visible=false;
      v.pause();v.src=VIDEOS[i];v.muted=muted();want=1;userPaused=false;
    },
    // Phones allow sound only on a media element a tap has already played, so the first tap plays and pauses it silently.
    unlock(){
      if(unlocked)return;unlocked=true;if(cur>=0)return;
      v.muted=false;v.src=VIDEOS[11]||VIDEOS[0];
      const pr=v.play();if(pr)pr.then(()=>{if(cur<0){v.pause();v.removeAttribute("src");v.load()}}).catch(()=>{});
    },
    arm(i){if(cur===i)armed=true},
    stop(){if(cur<0)return;want=0;burst=started?1:0;k=0},
    togglePause(){if(cur<0||!want||!started)return null;if(v.paused){userPaused=false;v.play().catch(()=>{})}else{userPaused=true;v.pause()}return !v.paused},
    away(on){away=on;if(on){if(started)v.pause()}else if(cur>=0&&want&&started&&v.paused&&!held&&!userPaused)v.play().catch(()=>{})},
    restart(){if(cur<0||!started)return false;v.currentTime=0;if(v.paused)v.play().catch(()=>{});return true},
    toggleMute(){userMute=!userMute;return userMute},
    cycleVolume(){v.volume=v.volume>0.8?0.6:v.volume>0.5?0.3:1;return v.volume},
    hold(on){held=on;if(on)v.pause();else if(cur>=0&&want&&started&&v.paused&&!away)v.play().catch(()=>{})},
    step(now){
      const dt=Math.min(.1,(now-last)/1000);last=now;
      const mu=muted();if(v.muted!==mu)v.muted=mu;
      if(want&&!started&&cur>=0){
        const target=v.readyState>=4?1:buffered();
        shown+=(target-shown)*Math.min(1,dt*5);
        if(!held&&!away&&armed&&(v.readyState>=4||(v.readyState>=3&&performance.now()-loadAt>2500))){
          started=true;v.currentTime=0;burst=0.5;
          {const id=cur,show=()=>{if(cur===id&&started){tex.needsUpdate=true;vidMat.uniforms.uVid.value=tex}};
           if(v.requestVideoFrameCallback)v.requestVideoFrameCallback(()=>show());setTimeout(show,1200)}
          v.muted=true;
          v.play().then(()=>{v.muted=muted()}).catch(e=>console.warn("video blocked",e));
        }
      }
      const ready=(started?v.readyState>=2:true)&&!held;
      const goal=want&&ready?1:0;
      k+=(goal-k)*Math.min(1,dt*(reduced?60:3.2));
      if(!want&&k<0.02&&cur>=0){v.pause();cur=-1}
      burst=Math.max(0,burst-dt/0.75);
      const ns=reduced?0:Math.sin(Math.min(1,burst)*Math.PI)*0.85*(want?1:Math.max(.4,k));
      vidMat.uniforms.uK.value=k;vidMat.uniforms.uNs.value=ns;vidMat.uniforms.uTime.value=now/1000;
      osd.fade(k);crtScreen.mesh.visible=k<0.97;
    }
  });
  return api;
})();
function playNext(done){
  const at=PLAY_ORDER.indexOf(done),next=PLAY_ORDER[at+1];
  if(at<0||next===undefined||!deck){deck?.select(-1);return}
  showTape(next,{fly:false});
}

// The tapes: each is its own object, so a tape lifts out of its stack, crosses the desk and goes into the recorder under the CRT.
function setupTapes(){
  const src=meshes.Room_Tapes;if(!src||!TAPES.length)return;
  const mats=[];
  const matFor=idx=>{
    const col=new THREE.Color(TAPE_PAL[idx%TAPE_PAL.length]),mt=src.material.clone();
    mt.onBeforeCompile=sh=>{
      sh.uniforms.uTcol={value:col};
      sh.vertexShader=sh.vertexShader.replace("#include <common>","#include <common>\nvarying vec3 vWP;")
        .replace("#include <begin_vertex>","#include <begin_vertex>\nvWP=(modelMatrix*vec4(transformed,1.0)).xyz;");
      sh.fragmentShader=sh.fragmentShader.replace("#include <common>","#include <common>\nvarying vec3 vWP;uniform vec3 uTcol;")
        .replace("#include <emissivemap_fragment>",`#include <emissivemap_fragment>
          float tl=dot(totalEmissiveRadiance,vec3(.2126,.7152,.0722));
          float darkW=1.0-smoothstep(.05,.30,tl);
          float dl=length(vWP-vec3(-0.4,1.06,-2.17));
          float lampL=0.20+0.95/(1.0+2.0*dl*dl);
          vec3 plastic=mix(vec3(dot(uTcol,vec3(.3,.59,.11))),uTcol,0.82)*lampL*(0.62+3.6*tl);
          totalEmissiveRadiance=mix(totalEmissiveRadiance,plastic,darkW);`);
    };
    mt.customProgramCacheKey=()=>"tape-plastic";
    mats.push(mt);envReady.then(t=>{mt.envMap=t;mt.needsUpdate=true});
    return mt;
  };
  deck=createTapeDeck({source:src,tapes:TAPES,material:matFor,reduced,slow:parseFloat(new URLSearchParams(location.search).get("slow")||"1")||1,
    onInsert:i=>{if(!onComputer())sfx.insert();if(i!==undefined)crtVideo.play(i,false)},onInserted:i=>{osd.show(i);if(deck.inVcr===i&&deck.target===i)crtVideo.arm(i)},
    onEject:()=>{if(!onComputer())sfx.eject()},onEjected:()=>{crtVideo.stop()}});
  crtVideo.onEnd=playNext;
for(const ev of ["touchend","click","keydown"])addEventListener(ev,()=>crtVideo.unlock(),{once:true,capture:true});
  logoMeshes.forEach(([mesh,name])=>deck.adoptLogo(mesh,name));
  addIntroTape(matFor);
  try{phone=createPhone({source:src,scene,reduced,soundOn:()=>soundBtn.getAttribute("aria-pressed")==="true",onState:m=>{if(m==="speaker")phoneQuiet=true}});if(phone)buildViews()}catch(e){console.warn("phone failed",e)}
  console.log("tape deck",deck.parts.map(q=>q.holder.children.length).join(","));
}
// Twelfth tape: the intro film. It sits on top of the right-hand stack and carries its own spine label.
const TAPE_INFO=[...projects,{eyebrow:"Intro",title:"At the edge of the dataset",summary:"A short film: from Karachi to Houston, and what data work looks like from here."}];
function addIntroTape(matFor){
  const src=TAPES.findIndex(t=>t.object==="PTape_1");if(src<0)return;
  const q=deck.addClone(src,new THREE.Vector3(0.004,0.0305,0.0),matFor(11),"Intro");
  const cv=document.createElement("canvas");cv.width=1024;cv.height=136;const x=cv.getContext("2d");
  const t=new THREE.CanvasTexture(cv);t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=8;
  const paint=()=>{
    const g=x.createLinearGradient(0,0,0,136);g.addColorStop(0,"#e4dcc4");g.addColorStop(1,"#d3c9ae");
    x.fillStyle=g;x.fillRect(0,0,1024,136);
    x.fillStyle="#1c6f8a";x.fillRect(0,0,22,136);x.fillRect(1002,0,22,136);
    x.fillStyle="rgba(60,50,35,.35)";x.fillRect(0,0,1024,3);x.fillRect(0,133,1024,3);
    x.fillStyle="#1d1a16";x.textBaseline="middle";x.font="700 50px 'Courier Prime', monospace";x.fillText("AT THE EDGE OF THE DATASET",54,56);
    x.font="32px 'Courier Prime', monospace";x.fillStyle="#6b5f4b";x.fillText("INTRO  ·  01:46",56,106);
    t.needsUpdate=true;
  };
  paint();document.fonts?.load("700 50px 'Courier Prime'").then(paint,paint);
  const lab=new THREE.Mesh(new THREE.PlaneGeometry(0.146,0.0194),new THREE.MeshBasicMaterial({map:t,color:0xc4bca8,polygonOffset:true,polygonOffsetFactor:-2,polygonOffsetUnits:-2}));
  // Stick the label on the spine where it really is: the spine is slightly turned, so find the surface with a ray.
  q.holder.updateMatrixWorld(true);
  const rc=new THREE.Raycaster(q.holder.position.clone().add(new THREE.Vector3(0,0,0.25)),new THREE.Vector3(0,0,-1),0,0.5);
  const hit=rc.intersectObject(q.mesh,false)[0];
  if(hit){
    const nW=hit.face.normal.clone().transformDirection(q.mesh.matrixWorld).normalize();
    const pL=q.holder.worldToLocal(hit.point.clone().addScaledVector(nW,0.0005));
    lab.position.copy(pL);
    lab.quaternion.setFromUnitVectors(new THREE.Vector3(0,0,1),nW);
  }else{
    const half=(TAPES[src].box.max.z-TAPES[src].box.min.z)/2;lab.position.set(0,0,half+0.0005);
  }
  q.holder.add(lab);
}
addEventListener("crt-enter",()=>setTimeout(()=>{
  if(!deck||deck.inVcr>=0||crtVideo.playing||padOpen())return;
  if(!tv.on)setTv(true);
  crtVideo.play(11);
},reduced?0:900));
function showTape(idx,{fly=true}={}){
  if(fly&&!padOpen())flyTo("home");
  if(!deck)return;
  if(deck.inVcr!==idx){osd.hide();crtVideo.stop();closePanel()}
  if(!tv.on)setTv(true);
  deck.select(idx);
}

// TV power: the VCR's red key (VCR_Btn_5, x .1397..1525, y .7430..7520, z -2.047) is redrawn a little larger and switches the CRT off and on.
// The screen collapses to a line, then a dot, then goes dark; switching it back on runs the same thing in reverse.
const tv={off:0,dir:0,on:true,last:0};
const tvU={uOff:{value:0}};
const tvScreen=(()=>{
  const W=CRT.w*1.04,H=CRT.h*1.05;
  const m=new THREE.ShaderMaterial({uniforms:tvU,transparent:true,depthWrite:false,
    vertexShader:`varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`,
    fragmentShader:`uniform float uOff;varying vec2 vUv;
      float ease(float x){return x<.5?2.*x*x:1.-pow(-2.*x+2.,2.)/2.;}
      void main(){
        vec2 q=vUv-.5;vec2 p=q*vec2(${W.toFixed(4)},${H.toFixed(4)});
        float r=.016;float d=length(max(abs(p)-vec2(${W.toFixed(4)},${H.toFixed(4)})*.5+r,0.))-r;float mask=smoothstep(.0015,-.0015,d);
        float e1=ease(clamp(uOff/.55,0.,1.)),e2=ease(clamp((uOff-.55)/.25,0.,1.)),fade=clamp((uOff-.8)/.2,0.,1.);
        float hh=mix(.5,.004,e1),hw=mix(.5,.012,e2);
        float inside=smoothstep(hw+.012,hw-.004,abs(q.x))*smoothstep(hh+.004,hh-.002,abs(q.y));
        float glow=e1*e1*e1*(1.-fade);
        vec3 inC=mix(vec3(1.5,1.65,2.0),vec3(.01,.012,.018),fade);
        float inA=mix(glow*.92,1.,fade);
        vec3 glass=vec3(.7,.8,1.)*(pow(clamp(1.-length(q-vec2(-.2,.3))*1.5,0.,1.),2.)*.06+pow(clamp(1.-abs(q.x*.8+q.y+.12)*7.,0.,1.),2.)*.02)*smoothstep(.55,.9,uOff);
        vec3 col=mix(vec3(.01,.012,.018)+glass,inC,inside);
        float a=mix(1.,inA,inside)*mask;
        gl_FragColor=vec4(col,a);
      }`});
  const mesh=new THREE.Mesh(new THREE.PlaneGeometry(W,H),m);
  mesh.position.set(CRT.cx,CRT.cy,CRT.z+0.0035);mesh.renderOrder=1.5;mesh.visible=false;mesh.name="TvScreen";scene.add(mesh);
  return mesh;
})();
const crtHit=(()=>{
  const h=new THREE.Mesh(new THREE.PlaneGeometry(CRT.w,CRT.h),new THREE.MeshBasicMaterial({transparent:true,opacity:0,depthWrite:false}));
  h.position.set(CRT.cx,CRT.cy,CRT.z+0.0045);h.name="CrtHit";scene.add(h);return h;
})();
const tvButton=(()=>{
  const cv=document.createElement("canvas");cv.width=256;cv.height=176;const x=cv.getContext("2d");
  const rr=(px,py,w,h,r)=>{x.beginPath();x.roundRect(px,py,w,h,r)};
  rr(2,2,252,172,34);x.fillStyle="#2a0a08";x.fill();
  const g=x.createLinearGradient(0,10,0,166);g.addColorStop(0,"#ff4a36");g.addColorStop(.55,"#e02a1c");g.addColorStop(1,"#a81610");
  rr(10,10,236,156,28);x.fillStyle=g;x.fill();
  x.fillStyle="rgba(255,255,255,.28)";rr(24,18,208,30,15);x.fill();
  const t=new THREE.CanvasTexture(cv);t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=8;
  const mesh=new THREE.Mesh(new THREE.PlaneGeometry(0.0188,0.0129),new THREE.MeshBasicMaterial({map:t}));
  mesh.position.set(0.1461,0.7475,-2.0461);mesh.renderOrder=2;mesh.name="TvPowerBtn";scene.add(mesh);
  const hit=new THREE.Mesh(new THREE.PlaneGeometry(0.034,0.024),new THREE.MeshBasicMaterial({transparent:true,opacity:0,depthWrite:false}));
  hit.position.set(0.1461,0.7475,-2.0455);hit.name="TvPower";scene.add(hit);
  return {mesh,hit};
})();
const VCR=(()=>{
  const defs=[];
  for(let n=1;n<=6;n++)defs.push({id:"ch"+n,x:-0.139+(n-1)*0.0276,y:0.882,z:-2.062,w:0.024,h:0.017});
  defs.push({id:"vol",x:0.049,y:0.88,z:-2.058,w:0.028,h:0.028},{id:"prev",x:0.082,y:0.879,z:-2.058,w:0.028,h:0.028},{id:"next",x:0.116,y:0.878,z:-2.058,w:0.028,h:0.028});
  ["eject","pause","rewind","skip","mute"].forEach((id,i)=>defs.push({id,x:0.055+i*0.0172,y:0.747,z:-2.04,w:0.0145,h:0.0125}));
  const mat=new THREE.MeshBasicMaterial({transparent:true,opacity:0,depthWrite:false});
  return defs.map(d=>{const m=new THREE.Mesh(new THREE.BoxGeometry(d.w,d.h,0.02),mat);m.position.set(d.x,d.y,d.z);m.name="Vcr_"+d.id;m.userData.vcr=d.id;scene.add(m);return m});
})();
const windowHit=(()=>{
  const m=new THREE.Mesh(new THREE.PlaneGeometry(1.81,1.7),new THREE.MeshBasicMaterial({transparent:true,opacity:0,depthWrite:false}));
  m.position.set(0.075,1.65,-2.6);m.name="WindowHit";scene.add(m);return m;
})();
function nudge(text){const h=$("hint");h.textContent=text;h.classList.add("show");clearTimeout(nudge.t);nudge.t=setTimeout(()=>h.classList.remove("show"),1600)}
function vcrTip(id){
  const chN=/^ch(\d)$/.exec(id);
  if(chN)return "CLICK TO PLAY TAPE "+chN[1]+": "+TAPE_INFO[chN[1]-1].title;
  const playing=crtVideo.playing;
  switch(id){
    case"vol":return "CLICK TO CHANGE THE TV VOLUME";
    case"prev":return "CLICK FOR THE PREVIOUS TAPE";
    case"next":return "CLICK FOR THE NEXT TAPE";
    case"eject":return deck&&deck.inVcr>=0?"CLICK TO EJECT THE TAPE":"EJECT: NO TAPE IN THE RECORDER";
    case"pause":return playing?(crtVideo.paused?"CLICK TO RESUME THE VIDEO":"CLICK TO PAUSE THE VIDEO"):"PAUSE: NOTHING IS PLAYING";
    case"rewind":return playing?"CLICK TO RESTART THIS VIDEO":"REWIND: NOTHING IS PLAYING";
    case"skip":return "CLICK TO SKIP TO THE NEXT TAPE";
    case"mute":return crtVideo.userMuted?"CLICK TO TURN THE VIDEO SOUND BACK ON":"CLICK TO MUTE THE VIDEO";
  }
  return "";
}
function vcrDo(id){
  if(!deck)return;
  if(!tv.on)setTv(true);
  const chN=/^ch(\d)$/.exec(id),cur=deck.inVcr;
  if(chN){showTape(chN[1]-1,{fly:false});return}
  if(id==="prev"||id==="next"){const n=TAPE_INFO.length;showTape(((cur<0?0:cur)+(id==="next"?1:n-1))%n,{fly:false});return}
  if(id==="skip"){const at=PLAY_ORDER.indexOf(cur);showTape(PLAY_ORDER[(at+1)%PLAY_ORDER.length],{fly:false});return}
  if(id==="eject"){deck.select(-1);nudge("EJECTING");return}
  if(id==="pause"){const r=crtVideo.togglePause();nudge(r===null?"NOTHING IS PLAYING":r?"PLAYING":"PAUSED");return}
  if(id==="rewind"){nudge(crtVideo.restart()?"BACK TO THE START":"NOTHING IS PLAYING");return}
  if(id==="mute"){nudge(crtVideo.toggleMute()?"VIDEO MUTED":"VIDEO SOUND ON");return}
  if(id==="vol"){nudge("VOLUME "+Math.round(crtVideo.cycleVolume()*100)+"%")}
}
document.querySelectorAll("[data-vcr]").forEach(b=>b.addEventListener("click",()=>vcrDo(b.dataset.vcr)));
function vcrKey(e,k){
  if(term.active||padOpen()||creditsOpen()||document.getElementById("crt-gate")||/^(button|a|input)$/i.test(document.activeElement?.tagName||""))return false;
  const m={" ":"pause",e:"eject",m:"mute","[":"prev","]":"next"};
  const id=/^[1-6]$/.test(k)?"ch"+k:m[k];
  if(!id)return false;vcrDo(id);return true;
}
function setTv(on){
  if(on!==tv.on)on?sfx.tvOn():sfx.tvOff();
  tv.on=on;tv.dir=on?-1:1;tvScreen.visible=true;crtVideo.hold(!on);
}
function toggleTv(){setTv(!tv.on)}
function stepDeskGone(){
  if(!deck||TAPES.length<11)return;
  const set=(u,k)=>{const b=TAPES[k].box;u.set(b.min.x,b.max.x,b.min.z,b.max.z)};
  set(DG.a.value,5);set(DG.b.value,10);
  const want=k=>deck.parts[k].present?0:1,now=performance.now(),k=1-Math.exp(-Math.min(.5,(now-(stepDeskGone.t||now))/1000)*7);stepDeskGone.t=now;
  DG.g.value.x+=(want(5)-DG.g.value.x)*k;DG.g.value.y+=(want(10)-DG.g.value.y)*k;
}
function stepTv(now){
  const dt=Math.min(.1,(now-tv.last)/1000);tv.last=now;
  if(!tv.dir)return;
  const dur=reduced?0.01:(tv.dir>0?1.0:0.8);
  tv.off=Math.min(1,Math.max(0,tv.off+tv.dir*dt/dur));
  tvU.uOff.value=tv.off;
  const f=1-Math.min(1,Math.max(0,(tv.off-.05)/.5));
  spill.material.opacity=f;spill.visible=f>0.01;
  tvButton.mesh.material.color.setScalar(1-0.55*Math.min(1,tv.off*3));
  if(tv.off<=0){tv.dir=0;tvScreen.visible=false}
  else if(tv.off>=1)tv.dir=0;
}

const ibmLights=addIbmLights(scene);
const term=makeIbmTerminal({scene,position:[-2.7573,0.873,-1.1926],size:[0.283,0.208],rotationY:1.2896,onType:k=>sfx.type(k),onOpenLink:href=>{if(href.startsWith("mailto:"))location.href=href;else window.open(href,"_blank","noopener")}});
addEventListener("keydown",e=>{if(e.metaKey||e.ctrlKey||e.altKey||document.getElementById("crt-gate"))return;if(term.onKey(e)){e.preventDefault();e.stopImmediatePropagation()}},true);

// COMPUTER power: its red monitor button (PC_MonPwrButton, x -2.689, y .738..755, z -1.334..-1.317) switches the green screen off and on
// with the same collapse as the TV. The baked glow on the keyboard and desk stays as it is.
const pc={off:0,dir:0,on:true,last:0};
const pcU={uOff:{value:0}};
const PCS={z:-1.195,y:0.873,w:0.285,h:0.215};
const pcScreen=(()=>{
  const m=new THREE.ShaderMaterial({uniforms:pcU,transparent:true,depthWrite:false,depthTest:false,
    vertexShader:tvScreen.material.vertexShader,
    fragmentShader:tvScreen.material.fragmentShader.split((CRT.w*1.04).toFixed(4)).join(PCS.w.toFixed(4)).split((CRT.h*1.05).toFixed(4)).join(PCS.h.toFixed(4))});
  const mesh=new THREE.Mesh(new THREE.PlaneGeometry(PCS.w,PCS.h),m);
  mesh.position.set(-2.7215,PCS.y,PCS.z);mesh.rotation.y=Math.PI/2;mesh.renderOrder=1.5;mesh.visible=false;mesh.name="PcScreen";scene.add(mesh);
  return mesh;
})();
const pcButton=(()=>{
  const hit=new THREE.Mesh(new THREE.PlaneGeometry(0.034,0.034),new THREE.MeshBasicMaterial({transparent:true,opacity:0,depthWrite:false}));
  hit.position.set(-2.6755,0.7465,-1.3255);hit.rotation.y=Math.PI/2;hit.name="PcPower";scene.add(hit);
  const led=new THREE.Mesh(new THREE.PlaneGeometry(0.0075,0.0075),new THREE.MeshBasicMaterial({color:0x0a100a}));
  led.position.set(-2.6905,0.7465,-1.3045);led.rotation.y=Math.PI/2;led.visible=false;scene.add(led);
  return {hit,led};
})();
function togglePc(){pc.on?sfx.pcOff():sfx.pcOn();pc.on=!pc.on;term.setPower(pc.on);ibmLights.setOn(pc.on);if(!pc.on){term.setActive(false)}else if(VIEWS&&camera.position.x<-1.5)term.setActive(true)}
function stepPc(now){
  const dt=Math.min(.1,(now-pc.last)/1000);pc.last=now;
  if(!pc.dir)return;
  pc.off=Math.min(1,Math.max(0,pc.off+pc.dir*dt/(reduced?0.01:(pc.dir>0?1.0:0.8))));
  pcU.uOff.value=pc.off;
  if(pc.off<=0){pc.dir=0;pcScreen.visible=false}else if(pc.off>=1)pc.dir=0;
}
function phoneClick(part){
  if(!phone||phone.busy)return;
  const mo=phone.mode;
  if(mo==="ringing"||mo==="idle"){flyTo("phone");closePanel();phone.answer()}
  else if(mo==="down"&&part==="speaker")phone.speaker();
  else if(mo==="down"||mo==="speaker")phone.hangup();
}

// VCR display: the baked "23:05" is part of the lightmap, so a live readout is drawn over the plate (VCR_LCD, x .085...146, y .7615...7915, z -2.0475).
const clock={tex:null,ctx:null,key:"",t0:performance.now()};
function setupClock(){
  const cv=document.createElement("canvas");cv.width=640;cv.height=300;
  clock.ctx=cv.getContext("2d");
  clock.tex=new THREE.CanvasTexture(cv);clock.tex.colorSpace=THREE.SRGBColorSpace;clock.tex.anisotropy=8;
  const mesh=new THREE.Mesh(new THREE.PlaneGeometry(0.040,0.0187),new THREE.MeshBasicMaterial({map:clock.tex}));
  mesh.position.set(0.11555,0.77745-0.0044,-2.0465);mesh.renderOrder=2;mesh.name="VcrClock";scene.add(mesh);
  drawClock(0);
}
function drawClock(sec){
  const total=23*3600+5*60+sec,s=total%60,mi=Math.floor(total/60)%60,h=Math.floor(total/3600)%24;
  const key=h+":"+mi+":"+s;if(key===clock.key)return;if(clock.key)sfx.tick(camera.position.distanceTo(CLOCK_AT));clock.key=key;
  const c=clock.ctx,p=n=>String(n).padStart(2,"0");
  c.fillStyle="#020802";c.fillRect(0,0,640,300);
  c.fillStyle=CLOCK_INK;c.textBaseline="alphabetic";c.textAlign="left";
  c.font="190px 'DejaVu Sans Mono',Menlo,Consolas,monospace";
  const cw=c.measureText("0").width,x0=(640-cw*5)/2,base=205;
  c.fillText(p(h),x0,base);c.fillText(p(mi),x0+cw*3,base);
  if(s%2===0)c.fillText(":",x0+cw*2,base);
  c.font="62px 'DejaVu Sans Mono',Menlo,Consolas,monospace";c.textAlign="right";
  c.fillText(p(s),x0+cw*5,285);
  clock.tex.needsUpdate=true;
}
const CLOCK_INK="#cdeeee";
const CLOCK_AT=new THREE.Vector3(0.1155,0.773,-2.0465);

// Uploads every texture and compiles every shader before the loading screen lifts, so the first move to a new view does not hitch.
function warm(){
  const seen=new Set();
  scene.traverse(o=>{
    for(const mt of [].concat(o.material||[]))for(const key in mt){const t=mt[key];if(t&&t.isTexture&&!t.isVideoTexture&&!seen.has(t)){seen.add(t);try{renderer.initTexture(t)}catch{}}}
  });
  try{renderer.compile(scene,camera);renderer.compile(vidScene,camera)}catch(e){console.warn("warm-up failed",e)}
}
Promise.all([roomP,outP,viewP,tapesP]).then(()=>{
  hideSheet();
  try{setupTapes()}catch(e){console.warn("tapes failed",e)}
  try{setupWind()}catch(e){console.warn("wind failed",e)}
  try{setupPlant()}catch(e){console.warn("plant failed",e)}
  try{notebook=createNotebook({source:meshes.Room_Desk,scene,reduced,sfx})}catch(e){console.warn("notebook failed",e)}
  try{createFrames({meshes,scene})}catch(e){console.warn("frames failed",e)}
  try{setupClock()}catch(e){console.warn("clock failed",e)}
  buildViews();
  warm();
  const l=$("loader");l.classList.add("done");
  setTimeout(()=>l.remove(),1000);
  requestAnimationFrame(frame);
}).catch(err=>{
  console.error(err);
  $("loader-text").textContent="FAILED TO LOAD SCENE";
});


