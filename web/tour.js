// Autoplay "ghost user" tour: ?tour=1. A visible cursor glides to each object, clicks it, and a caption names the interaction.
// Normal visitors never load this file. Sound follows the site's own SOUND switch (the gate's CLICK TO ENTER).
export function startTour(A) {
  const $ = (t, c, h) => { const e = document.createElement(t); if (c) e.className = c; if (h) e.innerHTML = h; document.body.appendChild(e); return e; };
  const css = document.createElement("style");
  css.textContent = `
  html.tour nav.menu,html.tour nav.bar{display:none!important}
  #tour-cur{position:fixed;left:0;top:0;width:34px;height:34px;z-index:99998;pointer-events:none;transform:translate(-100px,-100px);transition:transform 1.0s cubic-bezier(.45,.05,.2,1);filter:drop-shadow(0 3px 5px rgba(0,0,0,.55))}
  #tour-cur svg{width:100%;height:100%}
  #tour-cur .rip{position:absolute;left:-14px;top:-14px;width:28px;height:28px;border-radius:50%;border:3px solid rgba(255,214,150,.95);opacity:0;transform:scale(.3)}
  #tour-cur.click .rip{animation:tourRip .55s ease-out}
  @keyframes tourRip{0%{opacity:1;transform:scale(.3)}100%{opacity:0;transform:scale(2.4)}}
  #tour-cap{position:fixed;left:50%;bottom:7%;transform:translate(-50%,12px);z-index:99997;pointer-events:none;opacity:0;transition:opacity .35s,transform .35s;
    font:600 clamp(18px,3.1vw,34px)/1.2 "Caveat","Courier New",monospace;letter-spacing:.04em;color:#fff3dc;background:rgba(20,12,6,.62);padding:.35em .9em;border-radius:999px;border:1px solid rgba(255,214,150,.35);text-align:center;max-width:90vw;backdrop-filter:blur(3px)}
  #tour-cap.on{opacity:1;transform:translate(-50%,0)}
  #tour-card{position:fixed;inset:0;z-index:99999;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:.5em;text-align:center;color:#fff3dc;background:rgba(10,6,3,.82);opacity:0;pointer-events:none;transition:opacity .7s;font-family:"Courier New",monospace}
  #tour-card.on{opacity:1}
  #tour-card h1{margin:0;font:700 clamp(26px,6vw,64px)/1.1 "Courier New",monospace;letter-spacing:.06em}
  #tour-card p{margin:0;font-size:clamp(14px,2.2vw,24px);opacity:.85;letter-spacing:.08em}`;
  document.head.appendChild(css); document.documentElement.classList.add("tour");
  const cur = $("div"); cur.id = "tour-cur";
  cur.innerHTML = '<span class="rip"></span><svg viewBox="0 0 24 24"><path d="M3 2l17 9.5-7.4 1.9L9.2 21z" fill="#fff" stroke="#241608" stroke-width="1.6" stroke-linejoin="round"/></svg>';
  const cap = $("div"); cap.id = "tour-cap";
  const card = $("div"); card.id = "tour-card";
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const say = t => { if (!t) { cap.classList.remove("on"); return; } cap.textContent = t; cap.classList.add("on"); };
  const title = (h, p, on) => { card.innerHTML = "<h1>" + h + "</h1><p>" + p + "</p>"; card.classList.toggle("on", on); };
  const THREE_V = A.THREE.Vector3;
  const toScreen = v => { const p = v.clone().project(A.camera), r = A.canvas.getBoundingClientRect(); return [r.left + (p.x * 0.5 + 0.5) * r.width, r.top + (-p.y * 0.5 + 0.5) * r.height]; };
  let cx = innerWidth * 0.5, cy = innerHeight * 0.6;
  const moveTo = async (x, y, ms = 1000) => { cx = x; cy = y; cur.style.transitionDuration = ms + "ms"; cur.style.transform = `translate(${x}px,${y}px)`; await sleep(ms + 60); };
  const clickFx = async () => { cur.classList.remove("click"); void cur.offsetWidth; cur.classList.add("click"); await sleep(260); };
  const at = async (world, dx = 0, dy = 0, ms = 1000) => { const [x, y] = world ? toScreen(world) : [innerWidth * 0.5, innerHeight * 0.5]; await moveTo(x + dx, y + dy, ms); };
  const W = (x, y, z) => new THREE_V(x, y, z);

  async function run() {
    // wait for the gate to be passed
    while (document.documentElement.classList.contains("crt-gating") || document.getElementById("crt-gate")) await sleep(300);
    title("SAKINA SAIFUDDIN", "an interactive study room · every object is clickable", true);
    await sleep(3200); title("", "", false); await sleep(900);
    
    const clampXY = ([x, y]) => [Math.max(46, Math.min(innerWidth - 46, x)), Math.max(70, Math.min(innerHeight - 90, y))];
    const aim = async (world, ms = 900) => { const [x, y] = clampXY(world ? toScreen(world) : [innerWidth / 2, innerHeight / 2]); await moveTo(x, y, ms); };
    // an object: cursor heads for it, click, the camera flies in, the cursor settles on it, and a second click does the trick
    const prop = async (caption, world, name, then, hold) => {
      await aim(world); say(caption); await clickFx(); A.go(name); await sleep(2100);
      await aim(world, 700); if (then) { await clickFx(); then(); } await sleep(hold);
    };
    // lamps
    await aim(A.lampPos("desk"), 1100); say("Click a lamp"); await sleep(350); await clickFx(); A.toggleLamp("desk"); await sleep(800); A.toggleLamp("desk"); await sleep(800);
    await aim(A.lampPos("floor"), 1000); await clickFx(); A.toggleLamp("floor"); await sleep(800); A.toggleLamp("floor"); await sleep(700);
    // phone
    await aim(W(...A.phonePt())); say("Pick up the phone"); await clickFx(); A.go("phone"); await sleep(5000);
    A.go("home"); await sleep(1300);
    // trophy, recorder, music player
    await prop("Click the trophy", W(1.16, 0.84, -1.88), "trophy", () => A.go("trophy"), 2300);
    A.go("home"); await sleep(1200);
    await prop("Tape recorder: live radio", W(0.89, 0.77, -1.87), "recorder", null, 3300); A.go("recorder"); await sleep(400);
    A.go("home"); await sleep(1200);
    await prop("MP3 player: retro music", W(-1.0, 0.75, -1.88), "player", null, 3300); A.go("player"); await sleep(400);
    A.go("home"); await sleep(1200);
    // chair and plant, from a view that shows both
    A.VIEWS.tourChair = { target: W(-0.95, 0.55, -1.4), pos: W(-0.25, 1.45, 0.35) };
    A.flyTo("tourChair"); await sleep(2100);
    await aim(W(-0.94, 0.5, -1.36)); say("Pull out the chair"); await clickFx(); A.go("deskchair"); await sleep(2100);
    A.go("deskchair"); await sleep(1700); A.go("home"); await sleep(1300);
    const pc = A.plantPt(); A.VIEWS.tourPlant = { target: pc.clone(), pos: pc.clone().add(W(0.15, 0.3, 1.3)) };
    A.flyTo("tourPlant"); await sleep(2100);
    await aim(pc); say("Shake the plant"); await clickFx(); A.go("plant"); await sleep(2100);
    A.go("home"); await sleep(1300);
    // drawer
    await prop("Open the drawer", W(0.2, 0.6, -1.8), "drawer", null, 2200);
    say("Click a certificate to read it"); await moveTo(innerWidth * 0.5, innerHeight * 0.3, 900); await clickFx(); A.openCert(1); await sleep(2500); A.closeCert(); await sleep(400);
    A.go("home"); await sleep(1400);
    // mug, calculator, pencils
    await aim(A.mugPt()); say("Take a sip"); await clickFx(); A.sipMug(); await sleep(2200);
    await aim(A.calcPt()); say("Use the calculator"); await clickFx(); A.openCalc(); await sleep(2400); A.dropCalc(); await sleep(600);
    say("Spin the pencils"); A.spinPencils(); await sleep(1800);
    // notebook
    say("The notebook writes itself"); A.go("notepad"); await sleep(4800);
    A.go("home"); await sleep(1400); say("");
    title("SAKINA SAIFUDDIN", "www.sakinasaifuddin.me", true);
    await sleep(3500);
  }
  run().catch(e => console.warn("tour stopped", e));
}
