import * as THREE from "three";
import { pieces, makeCarve } from "./props.js?v=4";

// More small things in the room that answer a click (all cut out of the baked Room_Desk by connected piece, as in props.js):
//   player  - the purple disc player on the desk: click and it plays retro music (made live in the browser, no audio files), the disc spins;
//   chair   - the wooden chair in front of the desk glides in to the desk, and out again on the next click;
//   drawer  - the desk drawer slides open and the camera looks in at the certificates lying in it; click one to read it full size.
// Positions are the ones in the baked room.

const PLAYER = { x: -1.0, y: 0.72, z: -1.88 };
const CHAIR = { x: -0.94, y: 0, z: -1.36, yaw: 21.9 * Math.PI / 180, pull: 0.34, turn: 0.3 };
const DRAWER = { x: 0.2, y: 0.605, z: -1.805, out: 0.42 };
const smooth = x => x * x * (3 - 2 * x);
const clamp01 = x => Math.min(1, Math.max(0, x));

// ------------------------------------------------------------------ the music: two little tunes played by a synth
const mtof = n => 440 * Math.pow(2, (n - 69) / 12);
const TUNES = [
  { name: "RETRO SYNTH", bpm: 98, chords: [[57, 60, 64], [53, 57, 60], [48, 52, 55], [55, 59, 62]], bass: [45, 41, 36, 43], lead: "square", swing: 0 },
  { name: "SLOW TAPE GROOVE", bpm: 76, chords: [[50, 53, 57, 60], [55, 59, 62, 65], [48, 52, 55, 59], [53, 57, 60, 64]], bass: [38, 43, 36, 41], lead: "triangle", swing: 0.18 }
];
function createMusic({ soundOk, loud }) {
  let ctx = null, master = null, bus = null, noise = null, timer = 0, step = 0, nextT = 0, tune = 0, on = false;
  function init() {
    if (ctx) { if (ctx.state === "suspended") ctx.resume().catch(() => {}); return true; }
    try { ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch { return false; }
    master = ctx.createGain(); master.gain.value = 0; master.connect(ctx.destination);
    const lp = ctx.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 2600; lp.connect(master);
    bus = ctx.createGain(); bus.connect(lp);
    const dl = ctx.createDelay(1); dl.delayTime.value = 0.3; const fb = ctx.createGain(); fb.gain.value = 0.28; const dg = ctx.createGain(); dg.gain.value = 0.3;
    bus.connect(dl); dl.connect(fb); fb.connect(dl); dl.connect(dg); dg.connect(lp);
    noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const d = noise.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    return true;
  }
  function note(t, f, dur, type, peak, lpf) {
    const o = ctx.createOscillator(); o.type = type; o.frequency.value = f;
    const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    let n = o; if (lpf) { const f2 = ctx.createBiquadFilter(); f2.type = "lowpass"; f2.frequency.value = lpf; o.connect(f2); n = f2; }
    n.connect(g).connect(bus); o.start(t); o.stop(t + dur + 0.05);
  }
  function hit(t, dur, peak, type, f) {
    const s = ctx.createBufferSource(); s.buffer = noise; const fl = ctx.createBiquadFilter(); fl.type = type; fl.frequency.value = f;
    const g = ctx.createGain(); g.gain.setValueAtTime(peak, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(fl).connect(g).connect(bus); s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.02);
  }
  function play16(i, t) {
    const T = TUNES[tune], bar = Math.floor(i / 16) % 4, k = i % 16, ch = T.chords[bar];
    if (k % 4 === 0) {   // bass on the beat, kick underneath
      note(t, mtof(T.bass[bar]), 60 / T.bpm * 0.9, T.lead === "square" ? "sawtooth" : "sine", 0.22, 500);
      const o = ctx.createOscillator(); o.frequency.setValueAtTime(130, t); o.frequency.exponentialRampToValueAtTime(42, t + 0.12);
      const g = ctx.createGain(); g.gain.setValueAtTime(0.5, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.16); o.connect(g).connect(bus); o.start(t); o.stop(t + 0.2);
    }
    if (k === 4 || k === 12) hit(t, 0.14, 0.22, "highpass", 1800);                     // snare on 2 and 4
    if (k % 2 === 0) hit(t, 0.03, 0.06, "highpass", 6500);                             // hat
    if (T.lead === "square") note(t, mtof(ch[[0, 1, 2, 1][k % 4]] + 12), 0.16, "square", 0.05, 2200);   // arpeggio
    else if (k % 4 === 0 || k === 10) ch.forEach((n, j) => note(t + j * 0.012, mtof(n + 12), 60 / T.bpm * 1.6, "triangle", 0.06, 1800));   // soft chords
    if (k === 6 || k === 14) note(t, mtof(ch[2] + 24), 0.22, T.lead === "square" ? "square" : "sine", 0.045, 2600);   // a little answer
  }
  function pump() {
    const T = TUNES[tune], q = 60 / T.bpm / 4;
    while (nextT < ctx.currentTime + 0.2) { play16(step, nextT + (step % 2 ? T.swing * q : 0)); nextT += q; step++; }
  }
  return {
    get on() { return on; }, get name() { return TUNES[tune].name; }, get tune() { return tune; },
    start(i = tune) {
      if (!init()) return false;
      tune = ((i % TUNES.length) + TUNES.length) % TUNES.length; step = 0; nextT = ctx.currentTime + 0.08;
      clearInterval(timer); timer = setInterval(pump, 40); on = true; return true;
    },
    stop() { on = false; clearInterval(timer); },
    // volume follows the SOUND button and the TV video
    update() { if (!ctx) return; const g = on && soundOk() ? (loud() ? 0.5 : 0.22) : 0; master.gain.setTargetAtTime(g, ctx.currentTime, 0.12); }
  };
}

// ------------------------------------------------------------------ certificates: the list is certificates/certs.json
function placeholder(c) {
  const W = 840, H = 594, cv = document.createElement("canvas"); cv.width = W; cv.height = H;
  const g = cv.getContext("2d");
  g.fillStyle = "#f3ead4"; g.fillRect(0, 0, W, H);
  g.strokeStyle = "#b08a3c"; g.lineWidth = 8; g.strokeRect(24, 24, W - 48, H - 48); g.lineWidth = 2; g.strokeRect(40, 40, W - 80, H - 80);
  g.fillStyle = "#4a3a1a"; g.textAlign = "center";
  g.font = "600 30px Georgia, serif"; g.fillText(c.kind === "award" ? "AWARD" : "CERTIFICATE", W / 2, 120);
  g.font = "700 46px Georgia, serif";
  const words = (c.title || "").split(" "), lines = []; let cur = "";
  for (const w of words) { if (g.measureText(cur + " " + w).width > W - 160 && cur) { lines.push(cur); cur = w; } else cur = (cur + " " + w).trim(); }
  if (cur) lines.push(cur);
  lines.slice(0, 3).forEach((l, i) => g.fillText(l, W / 2, 230 + i * 58));
  g.font = "italic 30px Georgia, serif"; g.fillText(c.issuer || "", W / 2, 440);
  g.font = "20px Georgia, serif"; g.fillStyle = "#8a7a58"; g.fillText("certificate image coming soon", W / 2, 520);
  return cv;
}

// Walnut-like grain drawn on a canvas: long streaks that wander, a few pores, plank seams, and darker edges where boards meet (ambient occlusion).
function woodTexture(W, H, o) {
  const cv = document.createElement("canvas"); cv.width = W; cv.height = H; const g = cv.getContext("2d");
  let sd = o.seed * 9301 + 49297; const rnd = () => ((sd = (sd * 9301 + 49297) % 233280) / 233280);
  g.fillStyle = o.base; g.fillRect(0, 0, W, H);
  const ph = H / o.planks;
  for (let pl = 0; pl < o.planks; pl++) {
    const y0 = pl * ph, tone = (rnd() - 0.5) * 0.14;
    g.fillStyle = tone > 0 ? "rgba(255,200,140," + tone + ")" : "rgba(30,12,2," + (-tone) + ")"; g.fillRect(0, y0, W, ph);
    for (let i = 0; i < ph * 0.9; i++) {
      const y = y0 + rnd() * ph, a = 0.05 + rnd() * 0.22, amp = 1 + rnd() * 5, f = 0.004 + rnd() * 0.01, ph0 = rnd() * 6.28;
      g.strokeStyle = (rnd() > 0.35 ? "rgba(40,18,4," : "rgba(210,150,90,") + a + ")"; g.lineWidth = 0.6 + rnd() * 1.6;
      g.beginPath(); for (let x = 0; x <= W; x += 16) { const yy = y + Math.sin(x * f + ph0) * amp + Math.sin(x * f * 3.1 + ph0) * amp * 0.3; x ? g.lineTo(x, yy) : g.moveTo(x, yy); } g.stroke();
    }
    for (let i = 0; i < 40; i++) { g.fillStyle = "rgba(30,12,2," + (0.15 + rnd() * 0.3) + ")"; g.fillRect(rnd() * W, y0 + rnd() * ph, 4 + rnd() * 14, 1); }
    if (pl) { g.fillStyle = "rgba(15,6,0,.7)"; g.fillRect(0, y0 - 1, W, 2.5); }
  }
  const edge = (x0, y0, x1, y1, a, w) => { const gr = g.createLinearGradient(x0, y0, x1, y1); gr.addColorStop(0, "rgba(15,6,0," + a + ")"); gr.addColorStop(1, "rgba(15,6,0,0)"); g.fillStyle = gr; return gr; };
  if (o.ao) { const e = o.ao;
    let gr = edge(0, 0, W * e, 0, 0.7); g.fillStyle = gr; g.fillRect(0, 0, W * e, H);
    gr = edge(W, 0, W * (1 - e), 0, 0.7); g.fillStyle = gr; g.fillRect(W * (1 - e), 0, W * e, H);
    gr = edge(0, 0, 0, H * e, 0.75); g.fillStyle = gr; g.fillRect(0, 0, W, H * e);
    gr = edge(0, H, 0, H * (1 - e), 0.55); g.fillStyle = gr; g.fillRect(0, H * (1 - e), W, H * e); }
  if (o.bottomAo) { const gr = g.createLinearGradient(0, H, 0, H * 0.55); gr.addColorStop(0, "rgba(15,6,0," + o.bottomAo + ")"); gr.addColorStop(1, "rgba(15,6,0,0)"); g.fillStyle = gr; g.fillRect(0, H * 0.55, W, H * 0.45); }
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t;
}
// a soft dark patch for under a sheet of paper
function shadowTexture() {
  const cv = document.createElement("canvas"); cv.width = cv.height = 64; const g = cv.getContext("2d");
  const r = g.createRadialGradient(32, 32, 6, 32, 32, 32); r.addColorStop(0, "rgba(0,0,0,.75)"); r.addColorStop(1, "rgba(0,0,0,0)");
  g.fillStyle = r; g.fillRect(0, 0, 64, 64); return new THREE.CanvasTexture(cv);
}

export function createDeskProps({ scene, meshes, reduced, sfx, soundOk, loud, say, lampDim, onMusic }) {
  const carve = makeCarve(scene), out = { player: null, chair: null, drawer: null, certs: [] };
  const hitMat = () => new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false, colorWrite: false });
  const music = createMusic({ soundOk, loud });
  let card = null;
  function drawCard() {
    if (!card) { card = document.createElement("div"); card.id = "music-card"; card.setAttribute("role", "status"); card.hidden = true; card.innerHTML = "<b></b><i></i>"; document.body.appendChild(card); }
    card.hidden = !music.on;
    if (music.on) { card.children[0].textContent = "♪ " + music.name; card.children[1].textContent = (soundOk() ? "NOW PLAYING" : "SOUND IS OFF · TURN IT ON TO HEAR IT") + " · CLICK THE PLAYER TO STOP"; }
  }

  // one pass over Room_Desk: the player's disc, the chair, and the drawer front
  function setup() {
    const src = meshes.Room_Desk; if (!src || !src.geometry.index) return;
    const pc = pieces(src), V = new THREE.Vector3(), cls = new Map();
    for (const [r, b] of pc.boxes) {
      b.getSize(V);
      if (b.min.x > -1.085 && b.max.x < -0.915 && b.min.y > 0.7195 && b.max.y < 0.76 && b.min.z > -1.965 && b.max.z < -1.795 && V.x < 0.16 && V.y < 0.0025 && V.x > 0.08) cls.set(r, "disc");
      else if (b.min.x > -1.3 && b.max.x < -0.62 && b.min.z > -1.72 && b.max.z < -0.95 && b.min.y > -0.02 && b.max.y < 1.0 && V.x < 0.7) cls.set(r, "chair");
      else if (b.min.x > -0.14 && b.max.x < 0.54 && b.min.y > 0.545 && b.max.y < 0.665 && b.min.z > -1.83 && b.max.z < -1.79 && V.x < 0.7) cls.set(r, "drawer");
    }
    const T = { disc: [], chair: [], drawer: [] }, keep = [];
    for (let t = 0; t < pc.ia.length; t += 3) { const c = cls.get(pc.root(pc.ia[t])); (c ? T[c] : keep).push(pc.ia[t], pc.ia[t + 1], pc.ia[t + 2]); }
    console.log("deskprops: disc", T.disc.length / 3, "chair", T.chair.length / 3, "drawer", T.drawer.length / 3);
    src.geometry.setIndex(new THREE.BufferAttribute(new Uint32Array(keep.concat(T.disc.length < 30 ? T.disc : [], T.chair.length < 300 ? T.chair : [], T.drawer.length < 100 ? T.drawer : [])), 1));
    if (T.disc.length >= 30) setupPlayer(src, T.disc);
    if (T.chair.length >= 300) setupChair(src, T.chair);
    if (T.drawer.length >= 100) setupDrawer(src, T.drawer);
  }

  // ---------------------------------------------------------------- player
  function setupPlayer(src, tris) {
    const c = carve(src, tris, new THREE.Vector3(PLAYER.x, 0.7565, PLAYER.z), "PlayerDisc");
    const cv = document.createElement("canvas"); cv.width = cv.height = 256;
    const g = cv.getContext("2d");
    if (g.createConicGradient) {
      const cg = g.createConicGradient(0, 128, 128);
      ["#ff9fd2", "#ffe39a", "#a6ffcf", "#9fd8ff", "#c9a6ff", "#ff9fd2"].forEach((col, i) => cg.addColorStop(i / 5, col));
      g.fillStyle = cg;
    } else g.fillStyle = "#cfd8ff";
    g.beginPath(); g.arc(128, 128, 126, 0, 7); g.arc(128, 128, 22, 0, 7, true); g.fill();
    g.globalCompositeOperation = "destination-out"; g.fillStyle = "rgba(0,0,0,.55)";
    for (let i = 0; i < 2; i++) { g.save(); g.translate(128, 128); g.rotate(i * Math.PI); g.beginPath(); g.moveTo(0, 0); g.arc(0, 0, 126, 0.3, 1.2); g.closePath(); g.fill(); g.restore(); }
    const sheen = new THREE.Mesh(new THREE.CircleGeometry(0.0445, 40), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(cv), transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }));
    sheen.rotation.x = -Math.PI / 2; sheen.position.y = 0.0006; sheen.renderOrder = 3; c.holder.add(sheen);
    const hit = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.05, 20), hitMat());
    hit.position.set(PLAYER.x, 0.745, PLAYER.z); hit.name = "PlayerHit"; hit.userData.prop = "player"; scene.add(hit);
    out.player = { holder: c.holder, sheen, hit, ang: 0, v: 0, last: 0 };
  }
  function togglePlayer(want) {
    if (!out.player) return;
    const was = music.on, target = want === undefined ? !was : want;
    if (target === was) return;
    if (target) { if (!music.start(music.tune)) return; sfx.recKey(true); } else { music.stop(); sfx.recKey(false); }
    drawCard(); onMusic?.(music.on);
  }

  // ---------------------------------------------------------------- chair
  function setupChair(src, tris) {
    const piv = new THREE.Vector3(CHAIR.x, CHAIR.y, CHAIR.z), c = carve(src, tris, piv, "WoodChair");
    c.mesh.userData.prop = "chair";
    out.chair = { holder: c.holder, mesh: c.mesh, piv, k: 0, goal: 0, last: 0, tucked: false, dir: new THREE.Vector3(-Math.sin(CHAIR.yaw), 0, Math.cos(CHAIR.yaw)) };   // away from the desk
  }
  function toggleChair() {
    const C = out.chair; if (!C) return;
    C.goal = C.goal ? 0 : 1; sfx.drag();
    if (reduced) { C.k = C.goal; }
  }

  // ---------------------------------------------------------------- drawer + certificates
  function setupDrawer(src, tris) {
    const piv = new THREE.Vector3(DRAWER.x, DRAWER.y, DRAWER.z), c = carve(src, tris, piv, "DeskDrawer");
    c.mesh.userData.prop = "drawer";
    const H = c.holder, tray = new THREE.Group(); H.add(tray); tray.visible = false;
    const floorTex = woodTexture(1024, 1024, { base: "#9a6a3a", dark: "#5a3516", seed: 3, ao: 0.16, planks: 3 });
    const wallTex = woodTexture(1024, 256, { base: "#835028", dark: "#4a2a10", seed: 7, ao: 0.0, planks: 1, bottomAo: 0.5 });
    const wood = new THREE.MeshBasicMaterial({ map: wallTex }), floor = new THREE.MeshBasicMaterial({ map: floorTex });
    lampDim(wood, "Drawer"); lampDim(floor, "Drawer");
    const box = (w, h, d, x, y, z, m) => { const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); b.position.set(x, y, z); tray.add(b); return b; };
    // bottom board (grain across), two sides, back board, and the inside face of the front, as a real drawer is built
    const fl = new THREE.Mesh(new THREE.PlaneGeometry(0.592, 0.492), floor); fl.rotation.x = -Math.PI / 2; fl.position.set(0, -0.0388, -0.27); tray.add(fl);
    box(0.62, 0.008, 0.52, 0, -0.043, -0.27, wood);
    box(0.012, 0.085, 0.5, -0.296, -0.0025, -0.27, wood); box(0.012, 0.085, 0.5, 0.296, -0.0025, -0.27, wood);
    box(0.6, 0.085, 0.012, 0, -0.0025, -0.516, wood);
    const fb = new THREE.Mesh(new THREE.PlaneGeometry(0.58, 0.083), wood); fb.rotation.y = Math.PI; fb.position.set(0, -0.0025, -0.0205); tray.add(fb);
    out.drawer = { holder: H, tray, k: 0, goal: 0, last: 0, mesh: c.mesh };
    fetch("certificates/certs.json?v=3").then(r => r.json()).then(list => buildCerts(list, tray)).catch(e => console.warn("certificates list failed", e));
  }
  function buildCerts(list, tray) {
    const MAXW = 0.16, MAXH = 0.112, cols = 3, dx = 0.19, rows = [-0.125, -0.26], shadow = shadowTexture();
    list.slice(0, 6).forEach((c, i) => {
      const col = i % cols, row = Math.floor(i / cols), asp = c.aspect || 1.414;
      const sw = Math.min(MAXW, MAXH * asp), sh = sw / asp;
      const cvs = placeholder(c), tex = new THREE.CanvasTexture(cvs); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
      const mat = new THREE.MeshBasicMaterial({ map: tex, color: 0xe8e0d0 }); lampDim(mat, "Drawer");
      const grp = new THREE.Group(); grp.position.set((col - 1) * dx + (row ? 0.025 : -0.012), -0.0384 + 0.0004 * i, rows[row]); grp.rotation.y = (((i * 37) % 11) - 5) * 0.014;
      const sd = new THREE.Mesh(new THREE.PlaneGeometry(sw * 1.18, sh * 1.22), new THREE.MeshBasicMaterial({ map: shadow, transparent: true, opacity: 0.55, depthWrite: false }));
      sd.rotation.x = -Math.PI / 2; sd.position.y = -0.0003; sd.renderOrder = 1; grp.add(sd);
      const pl = new THREE.Mesh(new THREE.PlaneGeometry(sw, sh), mat); pl.rotation.x = -Math.PI / 2; pl.userData.prop = "cert"; pl.userData.idx = i; pl.renderOrder = 2; grp.add(pl); tray.add(grp);
      const e = { c, mesh: pl, mat, src: null, canvas: cvs };
      out.certs.push(e);
      if (c.file) new THREE.TextureLoader().load("certificates/" + c.file + "?v=3", t => { t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; mat.map = t; mat.color.set(0xf2ede2); mat.needsUpdate = true; e.src = "certificates/" + c.file + "?v=3"; }, undefined, () => {});
    });
  }
  function setDrawer(open) {
    const D = out.drawer; if (!D) return;
    if ((D.goal === 1) === open) return;
    D.goal = open ? 1 : 0; sfx.creak(open);
    if (reduced) D.k = D.goal;
  }

  // ---------------------------------------------------------------- certificate viewer
  let box = null, cur = 0;
  function showCert(i) {
    const n = out.certs.length; if (!n) return;
    cur = ((i % n) + n) % n;
    if (!box) {
      box = document.createElement("div"); box.id = "cert-box"; box.hidden = true;
      box.innerHTML = '<button type="button" class="cb-x" aria-label="Close">✕</button><button type="button" class="cb-p" aria-label="Previous">‹</button><figure><img alt=""><figcaption></figcaption></figure><button type="button" class="cb-n" aria-label="Next">›</button>';
      document.body.appendChild(box);
      box.addEventListener("click", ev => { if (ev.target === box || ev.target.classList.contains("cb-x")) hideCert(); });
      box.querySelector(".cb-p").addEventListener("click", () => showCert(cur - 1));
      box.querySelector(".cb-n").addEventListener("click", () => showCert(cur + 1));
      addEventListener("keydown", ev => {
        if (box.hidden) return;
        if (ev.key === "ArrowLeft") { showCert(cur - 1); ev.stopImmediatePropagation(); } else if (ev.key === "ArrowRight") { showCert(cur + 1); ev.stopImmediatePropagation(); }
      }, true);
    }
    const e = out.certs[cur];
    box.querySelector("img").src = e.src || e.canvas.toDataURL();
    box.querySelector("figcaption").textContent = (e.c.title || "") + (e.c.issuer ? " · " + e.c.issuer : "") + (e.c.date ? " · " + e.c.date : "") + "   (" + (cur + 1) + "/" + n + ")";
    box.hidden = false;
  }
  function hideCert() { if (box) box.hidden = true; }

  // ---------------------------------------------------------------- per frame
  function step(now) {
    const P = out.player;
    if (P) {
      const dt = Math.min(0.1, (now - (P.last || now)) / 1000); P.last = now;
      P.v += ((music.on ? 6 : 0) - P.v) * Math.min(1, dt * (music.on ? 2 : 1.2));
      if (!reduced) { P.ang += P.v * dt; P.holder.rotation.y = P.ang; }
      P.sheen.material.opacity += ((music.on ? 0.55 : 0) - P.sheen.material.opacity) * Math.min(1, dt * 4);
      if (music.on && reduced) P.sheen.material.opacity = 0.55;
    }
    const C = out.chair;
    if (C) {
      const dt = Math.min(0.1, (now - (C.last || now)) / 1000); C.last = now;
      const d = C.goal - C.k;
      if (d !== 0) { C.k = Math.abs(d) < 1e-3 ? C.goal : C.k + Math.sign(d) * Math.min(Math.abs(d), dt / 1.0); }
      const e = smooth(C.k), jit = reduced ? 0 : Math.sin(C.k * 60) * 0.004 * Math.sin(Math.PI * C.k);   // the legs skip over the floorboards
      C.holder.position.copy(C.piv).addScaledVector(C.dir, CHAIR.pull * e);
      C.holder.position.y += reduced ? 0 : Math.abs(jit);
      C.holder.rotation.y = CHAIR.turn * e + jit * 2;
    }
    const D = out.drawer;
    if (D) {
      const dt = Math.min(0.1, (now - (D.last || now)) / 1000); D.last = now;
      const d = D.goal - D.k;
      if (d !== 0) D.k = Math.abs(d) < 1e-3 ? D.goal : D.k + Math.sign(d) * Math.min(Math.abs(d), dt / 0.85);
      D.holder.position.z = DRAWER.z + DRAWER.out * smooth(D.k);
      D.tray.visible = D.k > 0.01;
    }
    music.update();
    if (music.on) drawCard();
  }

  setup();

  return {
    get player() { return out.player; }, get chair() { return out.chair; }, get drawer() { return out.drawer; },
    pickMeshes() {
      const m = [out.player?.hit, out.chair?.mesh, out.drawer?.mesh].filter(Boolean);
      if (out.drawer && out.drawer.k > 0.9) m.push(...out.certs.map(e => e.mesh));
      return m;
    },
    info(obj) {
      const p = obj.userData.prop;
      if (p === "player") return { kind: "player" };
      if (p === "chair") return { kind: "chair" };
      if (p === "drawer") return { kind: "drawer" };
      if (p === "cert") return { kind: "cert", idx: obj.userData.idx };
      return null;
    },
    get musicOn() { return music.on; }, get drawerOpen() { return !!out.drawer && out.drawer.goal === 1; },
    get certName() { return i => out.certs[i]?.c.title || "CERTIFICATE"; },
    get certOpen() { return !!box && !box.hidden; },
    togglePlayer, toggleChair, setDrawer, showCert, hideCert, stopMusic() { if (music.on) { music.stop(); drawCard(); onMusic?.(false); } },
    step
  };
}
