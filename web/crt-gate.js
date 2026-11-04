const root=document.documentElement;
const loader=document.getElementById("loader");
const soundBtn=document.getElementById("btn-sound");
if(loader){
  root.classList.add("crt-gating");
  const gate=document.createElement("div");
  gate.id="crt-gate";
  gate.setAttribute("role","status");
  gate.innerHTML=`<button type="button" class="enter" aria-label="Enter the room" disabled></button>
<div class="scr"><div class="pic"><span class="lb">▶▶ LOADING</span><span class="ch">CH 00</span>
<div class="mid"><p class="cta">CLICK TO ENTER</p><div class="meter"><span class="cg-bar"><i></i></span><span class="pc">0%</span></div>
<button type="button" class="snd on" role="switch" aria-checked="true"><span>SOUND</span><b><i class="s-on">ON</i><i class="s-off">OFF</i></b></button></div></div>
<div class="noise"></div><div class="glass"></div></div>`;
  document.body.prepend(gate);
  // Nothing of the gate shows until its photo is in, so the blue TV screen never appears alone on a black page.
  const stillSrc=matchMedia("(min-aspect-ratio: 16/9)").matches?"crt-still-wide.jpg?v=4":"crt-still.jpg?v=4";
  const reveal=()=>gate.classList.add("shown");
  const img=new Image();img.onload=reveal;img.onerror=reveal;img.src=stillSrc;
  setTimeout(reveal,4000);

  const $=s=>gate.querySelector(s);
  const bar=$(".cg-bar i"),pc=$(".pc"),lb=$(".lb"),snd=$(".snd"),enter=$(".enter"),scr=$(".scr");
  const reduced=matchMedia("(prefers-reduced-motion: reduce)").matches;

  const c=document.createElement("canvas");c.width=c.height=128;
  const g=c.getContext("2d"),im=g.createImageData(128,128);
  for(let i=0;i<im.data.length;i+=4){im.data[i]=im.data[i+1]=im.data[i+2]=Math.random()*256|0;im.data[i+3]=255}
  g.putImageData(im,0,0);
  gate.style.setProperty("--noise",`url("${c.toDataURL()}")`);

  // The glass corners in crt-still.jpg (1600x900): top left, top right, bottom right, bottom left.
  // The screen box is drawn onto them in perspective (Heckbert's unit-square projection).
  let Q=[[637.1,389.4],[888.6,387.5],[887.6,572.8],[639.1,578.6]],BOX=[637,388,251,188];
  // The still is a 1600x900 capture of the home view. The 3D camera keeps a fixed vertical field of view (wider only on narrow windows),
  // so the still is scaled by height, with the same lens rule as lensFov() in main-pad.js, and stays the exact view the room loads into.
  const scaleK=()=>{
    const a=innerWidth/innerHeight,t=Math.tan(16*Math.PI/180),h=Math.max(t,Math.min(.62,.29/a));
    return innerHeight/900*t/h;
  };
  const setK=()=>gate.style.setProperty("--k",scaleK()+"px");
  setK();
  const warp=()=>{
    const k=scaleK(),W=BOX[2]*k,H=BOX[3]*k,
      [[x0,y0],[x1,y1],[x2,y2],[x3,y3]]=Q.map(([x,y])=>[(x-BOX[0])*k-W/2,(y-BOX[1])*k-H/2]),
      sx=x0-x1+x2-x3,sy=y0-y1+y2-y3,dx1=x1-x2,dx2=x3-x2,dy1=y1-y2,dy2=y3-y2,den=dx1*dy2-dx2*dy1,
      gg=(sx*dy2-dx2*sy)/den,hh=(dx1*sy-sx*dy1)/den,a=x1-x0+gg*x1,b=x3-x0+hh*x3,d=y1-y0+gg*y1,e=y3-y0+hh*y3;
    scr.style.setProperty("--warp",`matrix3d(${[a/W,d/W,0,gg/W,b/H,e/H,0,hh/H,0,0,1,0,(a+b)/2+x0,(d+e)/2+y0,0,(gg+hh)/2+1].map(v=>+v.toFixed(9)).join(",")})`);
  };
  const onResize=()=>{setK();warp()};
  warp();addEventListener("resize",onResize);
  // Once the room is showing, follow the TV glass as the 3D camera actually projects it (it no longer matches the still).
  addEventListener("crtquad",e=>{
    if(!gate.classList.contains("ready")||entered)return;
    const k=scaleK();
    Q=e.detail.map(([x,y])=>[(x-innerWidth/2)/k+800,(y-innerHeight/2)/k+450]);
    warp();
  });

  let shown=0,target=0,ready=false,entered=false,withSound=true,last=performance.now();
  const readPct=()=>{const m=/(\d+)%/.exec(document.getElementById("loader-text")?.textContent||"");return m?+m[1]/100:null};
  const draw=v=>{pc.textContent=Math.floor(v*100)+"%";bar.style.width=Math.floor(v*20+1e-6)*5+"%"};
  const tick=now=>{
    const dt=Math.min(.5,(now-last)/1000);last=now;
    shown=Math.min(target,shown+Math.max(.5,(target-shown)*8)*dt);
    draw(shown);
    if(ready&&shown>=1){gate.classList.add("ready");enter.disabled=false;enter.focus({preventScroll:true});return}
    requestAnimationFrame(tick);
  };

  const sync=()=>{
    const t=document.getElementById("loader-text")?.textContent||"";
    if(/FAILED/i.test(t)){lb.textContent="LOAD FAILED";return}
    const p=readPct();if(p!==null)target=Math.max(target,Math.min(.99,p));
    if(loader.classList.contains("done")){ready=true;target=1}
  };
  new MutationObserver(sync).observe(loader,{subtree:true,childList:true,characterData:true,attributes:true});
  sync();
  requestAnimationFrame(tick);

  const setSnd=on=>{withSound=on;snd.classList.toggle("on",on);snd.setAttribute("aria-checked",String(on))};
  snd.addEventListener("click",e=>{e.stopPropagation();setSnd(!withSound)});
  const go=()=>{
    if(entered||!gate.classList.contains("ready"))return;
    entered=true;
    if(withSound&&soundBtn&&soundBtn.getAttribute("aria-pressed")!=="true")soundBtn.click();
    gate.classList.add("out");
    dispatchEvent(new Event("crt-enter"));
    root.classList.remove("crt-gating");
    removeEventListener("resize",onResize);
    setTimeout(()=>gate.remove(),reduced?0:1000);
  };
  enter.addEventListener("click",go);
  addEventListener("keydown",e=>{
    if(!gate.isConnected||entered)return;
    if(e.target===snd&&(e.key==="Enter"||e.key===" "))return;
    if(gate.classList.contains("ready")){
      if(e.key==="Enter"||e.key===" "){e.preventDefault();e.stopImmediatePropagation();go();return}
      if(e.key.toLowerCase()==="s"){e.preventDefault();setSnd(!withSound)}
    }
    if(!e.ctrlKey&&!e.metaKey&&!e.altKey&&!/^F\d+$/.test(e.key)&&e.key!=="Tab")e.stopImmediatePropagation();
  },true);
}
