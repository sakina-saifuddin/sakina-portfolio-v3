import * as THREE from "three";

// Two small props on the right of the desk: the trophy (Trophy_* in the Blender scene) and the cassette recorder in front of the phone (Rec_*).
// Both are cut out of the merged, baked meshes at load by connected piece, so each keeps its own baked colours and shading:
//   trophy  - the cup, lid ring, handles and star come out of Room_Keepsakes and turn about the trophy's vertical axis;
//   recorder - the five keys come out of Room_Tapes and sink when pressed (the red one starts the radio).
// Positions are the ones in the baked room (they differ a little from the .blend: the recorder was nudged left by the room edits).

const TROPHY = { x: 1.160, y: 0.773, z: -1.880 };
const TROPHY_BOX = { x0: 1.075, x1: 1.245, y0: 0.7715, y1: 0.94, z0: -1.945, z1: -1.82 };
const KEY_IDS = ["rec", "play", "rew", "ff", "stop"];   // left to right on the recorder
const KEY_DEPTH = 0.0042;

// Live news. Each is a plain audio stream, played in an <audio> element (that needs no CORS headers). If one will not play the radio moves on to the next.
export const STATIONS = [
  { name: "BBC WORLD SERVICE", tag: "WORLD NEWS", url: "https://stream.live.vc.bbcmedia.co.uk/bbc_world_service" },
  { name: "BBC 5 LIVE", tag: "BREAKING NEWS", url: "https://stream.live.vc.bbcmedia.co.uk/bbc_radio_five_live_online_nonuk" },
  { name: "NPR NEWS", tag: "U.S. NEWS", url: "https://npr-ice.streamguys1.com/live.mp3" }
];

// Connected pieces of a merged mesh. Vertices are duplicated along UV seams, so pieces are found by position (0.5 mm grid), not by index.
export function pieces(src) {
  src.updateWorldMatrix(true, false);
  const M = src.matrixWorld, g = src.geometry, P = g.attributes.position, ia = g.index.array, n = P.count;
  const key = new Map(), vid = new Int32Array(n), v = new THREE.Vector3();
  let k = 0;
  for (let i = 0; i < n; i++) {
    v.fromBufferAttribute(P, i).applyMatrix4(M);
    const s = Math.round(v.x * 2000) + "," + Math.round(v.y * 2000) + "," + Math.round(v.z * 2000);
    let q = key.get(s); if (q === undefined) { q = k++; key.set(s, q); }
    vid[i] = q;
  }
  const par = new Int32Array(k); for (let i = 0; i < k; i++) par[i] = i;
  const find = a => { while (par[a] !== a) { par[a] = par[par[a]]; a = par[a]; } return a; };
  for (let t = 0; t < ia.length; t += 3) { const a = find(vid[ia[t]]); par[find(vid[ia[t + 1]])] = a; par[find(vid[ia[t + 2]])] = a; }
  const boxes = new Map();
  for (let i = 0; i < n; i++) {
    v.fromBufferAttribute(P, i).applyMatrix4(M);
    const r = find(vid[i]); let b = boxes.get(r); if (!b) { b = new THREE.Box3(); boxes.set(r, b); } b.expandByPoint(v);
  }
  return { ia, root: i => find(vid[i]), boxes };
}

  // A set of triangles of `src`, as its own mesh in a holder placed at `pivot` (so the holder can turn or slide). Looks identical until it moves.
export function makeCarve(scene) {
  return function carve(src, tris, pivot, name) {
    const g = src.geometry, gi = new THREE.BufferGeometry();
    for (const n of Object.keys(g.attributes)) gi.setAttribute(n, g.attributes[n]);
    gi.setIndex(new THREE.BufferAttribute(new Uint32Array(tris), 1));
    const mesh = new THREE.Mesh(gi, src.material);
    mesh.matrixAutoUpdate = false;
    mesh.matrix.copy(src.matrixWorld).premultiply(new THREE.Matrix4().makeTranslation(-pivot.x, -pivot.y, -pivot.z));
    mesh.frustumCulled = false; mesh.name = name;
    const holder = new THREE.Group(); holder.position.copy(pivot); holder.add(mesh); scene.add(holder);
    return { mesh, holder };
  }
}

export function createProps({ scene, meshes, reduced, sfx, soundOk, onRadio, say }) {
  const out = { trophy: null, rec: null };
  const hitMat = () => new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false, colorWrite: false });
  const clamp01 = x => Math.min(1, Math.max(0, x));

  const carve = makeCarve(scene);

  // ---------------------------------------------------------------- trophy
  function setupTrophy() {
    const src = meshes.Room_Keepsakes; if (!src || !src.geometry.index) return;
    const pc = pieces(src), B = TROPHY_BOX, keep = [], take = [];
    const mine = new Map();
    for (const [r, b] of pc.boxes) mine.set(r, b.min.y > B.y0 && b.max.y < B.y1 && b.min.x > B.x0 && b.max.x < B.x1 && b.min.z > B.z0 && b.max.z < B.z1);
    for (let t = 0; t < pc.ia.length; t += 3) (mine.get(pc.root(pc.ia[t])) ? take : keep).push(pc.ia[t], pc.ia[t + 1], pc.ia[t + 2]);
    if (take.length < 300) { console.warn("trophy: cup not found", take.length / 3); return; }
    src.geometry.setIndex(new THREE.BufferAttribute(new Uint32Array(keep), 1));
    const c = carve(src, take, new THREE.Vector3(TROPHY.x, TROPHY.y, TROPHY.z), "TrophyCup");
    const hit = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.215, 20), hitMat());
    hit.position.set(TROPHY.x, 0.825, TROPHY.z); hit.name = "TrophyHit"; hit.userData.prop = "trophy"; scene.add(hit);
    // a few glints that twinkle around the cup while it turns
    const cv = document.createElement("canvas"); cv.width = cv.height = 64;
    const g = cv.getContext("2d"), rg = g.createRadialGradient(32, 32, 0, 32, 32, 30);
    rg.addColorStop(0, "rgba(255,248,220,1)"); rg.addColorStop(0.18, "rgba(255,226,150,.7)"); rg.addColorStop(1, "rgba(255,200,90,0)");
    g.fillStyle = rg; g.fillRect(0, 0, 64, 64);
    g.fillStyle = "rgba(255,246,214,.95)"; g.beginPath(); g.moveTo(32, 2); g.lineTo(36, 28); g.lineTo(62, 32); g.lineTo(36, 36); g.lineTo(32, 62); g.lineTo(28, 36); g.lineTo(2, 32); g.lineTo(28, 28); g.closePath(); g.fill();
    const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
    const sparks = [0, 1, 2, 3].map(i => {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }));
      s.scale.setScalar(0.036); s.renderOrder = 5; scene.add(s); return s;
    });
    out.trophy = { holder: c.holder, hit, sparks, ang: 0, goal: 0, last: 0, shine: -1e9, pending: false };
    console.log("trophy: cup", take.length / 3, "triangles");
  }
  function spinTrophy() {
    const T = out.trophy; if (!T) return;
    T.goal += Math.PI * 4; T.shine = performance.now(); T.pending = false;
    sfx.chime();
    if (reduced) T.ang = T.goal;
  }
  function stepTrophy(now) {
    const T = out.trophy; if (!T) return;
    const dt = Math.min(0.1, (now - (T.last || now)) / 1000); T.last = now;
    const d = T.goal - T.ang;
    if (d !== 0) { T.ang = Math.abs(d) < 0.004 ? T.goal : T.ang + d * (1 - Math.exp(-dt * 2.3)); T.holder.rotation.y = T.ang; }
    const k = (now - T.shine) / 1000, fade = clamp01(1 - k / 2.2);
    T.sparks.forEach((s, i) => {
      if (fade <= 0 || reduced) { s.material.opacity = 0; return; }
      const a = T.ang * 0.5 + i * 1.571, r = 0.05 + 0.02 * (i % 2), y = 0.075 + 0.045 * ((i * 3) % 4) / 3;
      s.position.set(TROPHY.x + Math.cos(a) * r, TROPHY.y + y, TROPHY.z + Math.sin(a) * r);
      s.material.opacity = Math.max(0, Math.sin(Math.PI * (((k * 1.3 + i * 0.27) % 1)))) * fade;
    });
  }

  // ---------------------------------------------------------------- recorder
  const rad = { on: false, idx: 0, state: "off", latch: null, hold: false, tries: 0, timer: 0, text: "" };
  const audio = new Audio(); audio.preload = "none"; audio.volume = 0.9;
  let card = null;
  function drawCard() {
    if (typeof document === "undefined") return;
    if (!card) {
      card = document.createElement("div"); card.id = "radio-card"; card.setAttribute("role", "status"); card.hidden = true;
      card.innerHTML = '<span class="dot"></span><b></b><i></i>'; document.body.appendChild(card);
    }
    if (!rad.on) { card.hidden = true; rad.text = ""; return; }
    const s = STATIONS[rad.idx];
    let line;
    if (rad.state === "tuning") line = "TUNING IN…";
    else if (rad.state === "nosignal") line = "NO SIGNAL · PRESS ▶▶ TO TRY ANOTHER STATION";
    else if (rad.state === "blocked") line = "THE BROWSER BLOCKED THE SOUND · PRESS THE RED BUTTON AGAIN";
    else if (!soundOk()) line = "ON AIR · SOUND IS OFF · TURN IT ON TO HEAR THE NEWS";
    else line = "ON AIR · LIVE · " + s.tag;
    const key = rad.idx + "|" + line;
    if (key === rad.text) return; rad.text = key;
    card.hidden = false; card.dataset.state = rad.state;
    card.children[1].textContent = rad.state === "nosignal" ? "RADIO" : s.name;
    card.children[2].textContent = line + (rad.state === "nosignal" ? "" : "  ·  " + (rad.idx + 1) + "/" + STATIONS.length);
  }
  function tune(idx, quiet) {
    rad.idx = ((idx % STATIONS.length) + STATIONS.length) % STATIONS.length;
    rad.state = "tuning"; rad.text = "";
    clearTimeout(rad.timer);
    audio.src = STATIONS[rad.idx].url;
    const p = audio.play();
    if (p && p.catch) p.catch(e => {
      if (!rad.on || !e) return;
      if (e.name === "AbortError") return;                       // a newer tune() replaced this one
      if (e.name === "NotAllowedError") { rad.state = "blocked"; drawCard(); return; }
      fail();
    });
    rad.timer = setTimeout(() => { if (rad.on && rad.state === "tuning") fail(); }, 10000);
    if (!quiet) sfx.tune(0.6);
    drawCard();
  }
  function fail() {
    if (!rad.on) return;
    if (++rad.tries >= STATIONS.length) {
      rad.state = "nosignal"; clearTimeout(rad.timer); audio.pause(); audio.removeAttribute("src"); drawCard(); return;
    }
    tune(rad.idx + 1, true);
  }
  audio.addEventListener("playing", () => { if (rad.on) { rad.state = "live"; clearTimeout(rad.timer); drawCard(); } });
  audio.addEventListener("error", () => { if (rad.on && rad.state !== "nosignal") fail(); });
  audio.addEventListener("stalled", () => { if (rad.on && rad.state === "tuning") fail(); });

  // keys held down by a latch (REC or PLAY while the radio runs) or pressed for a moment (REW, FF)
  const keys = {};
  function press(id, ms) { const K = keys[id]; if (!K) return; K.goal = 1; if (ms) { clearTimeout(K.t); K.t = setTimeout(() => { if (rad.latch !== id) { K.goal = 0; sfx.recKey(false); } }, ms); } }
  function releaseAll() { for (const id of KEY_IDS) { const K = keys[id]; if (K) { clearTimeout(K.t); K.goal = 0; } } }

  function startRadio(id, hold) {
    rad.hold = !!hold;
    if (rad.on) return;
    rad.on = true; rad.latch = id; rad.tries = 0;
    sfx.recKey(true); press(id);
    tune(rad.idx, !!hold);
    onRadio?.(true);
  }
  function stopRadio(quiet) {
    if (!rad.on) return;
    rad.on = false; rad.state = "off"; rad.latch = null; rad.hold = false; clearTimeout(rad.timer);
    audio.pause(); audio.removeAttribute("src"); audio.load();
    releaseAll(); if (!quiet) sfx.recKey(false);
    drawCard(); onRadio?.(false);
  }
  // one of the five keys (from a click)
  function key(id) {
    if (id === "rec" || id === "play") {
      if (rad.on) { if (rad.state === "nosignal" || rad.state === "blocked") { rad.tries = 0; tune(rad.idx); } return; }
      startRadio(id);
    } else if (id === "stop") {
      if (rad.on) stopRadio(); else { press("stop", 160); sfx.recKey(true); say?.("THE RADIO IS OFF · PRESS THE RED BUTTON TO TUNE IN"); }
    } else {   // ff = next station, rew = previous
      sfx.recKey(true); press(id, 180);
      if (!rad.on) { say?.("PRESS THE RED BUTTON FIRST TO TURN THE RADIO ON"); return; }
      rad.tries = 0; rad.hold = false; tune(rad.idx + (id === "ff" ? 1 : -1));
    }
  }
  function setupRecorder() {
    const src = meshes.Room_Tapes; if (!src || !src.geometry.index) return;
    const pc = pieces(src), cand = [];
    for (const [r, b] of pc.boxes) {
      const s = b.getSize(new THREE.Vector3()), c = b.getCenter(new THREE.Vector3());
      if (s.y > 0.017 && s.y < 0.023 && s.x > 0.02 && s.x < 0.03 && b.min.y > 0.7235 && b.min.y < 0.7275 && c.x > 0.79 && c.x < 0.96 && c.z > -1.85 && c.z < -1.78) cand.push({ r, b, c });
    }
    if (cand.length !== 5) { console.warn("recorder: keys not found", cand.length); return; }
    cand.sort((a, b) => a.c.x - b.c.x);
    const yaw = Math.atan2(cand[4].c.z - cand[0].c.z, cand[4].c.x - cand[0].c.x);
    const nrm = new THREE.Vector3(-Math.sin(yaw), 0, Math.cos(yaw));            // out of the front of the recorder
    // the small symbol on each key moves with it
    const syms = cand.map(() => []);
    for (const [r, b] of pc.boxes) {
      const s = b.getSize(new THREE.Vector3()), c = b.getCenter(new THREE.Vector3());
      if (!(s.x < 0.012 && b.min.y > 0.728 && b.max.y < 0.742)) continue;
      cand.forEach((k, i) => { if (!cand.some(q => q.r === r) && c.x > k.b.min.x - 0.001 && c.x < k.b.max.x + 0.001 && c.z > k.b.max.z - 0.005 && c.z < k.b.max.z + 0.004) syms[i].push(r); });
    }
    const mineKeys = new Map();   // root -> key index
    cand.forEach((k, i) => { mineKeys.set(k.r, i); syms[i].forEach(r => mineKeys.set(r, i)); });
    const tris = cand.map(() => []), keep = [];
    for (let t = 0; t < pc.ia.length; t += 3) {
      const i = mineKeys.get(pc.root(pc.ia[t]));
      (i === undefined ? keep : tris[i]).push(pc.ia[t], pc.ia[t + 1], pc.ia[t + 2]);
    }
    src.geometry.setIndex(new THREE.BufferAttribute(new Uint32Array(keep), 1));
    const meshesOut = [];
    cand.forEach((k, i) => {
      const id = KEY_IDS[i], pivot = k.b.getCenter(new THREE.Vector3());
      const c = carve(src, tris[i], pivot, "RecKey_" + id);
      c.mesh.userData.prop = "rec"; c.mesh.userData.part = id;
      keys[id] = { holder: c.holder, base: pivot.clone(), level: 0, goal: 0, t: 0 };
      meshesOut.push(c.mesh);
    });
    // an invisible box over the whole recorder, a few millimetres bigger than the body but not as far forward as the keys, so the keys are hit first and the body takes the rest
    const bx = new THREE.Mesh(new THREE.BoxGeometry(0.19, 0.095, 0.106), hitMat());
    bx.position.set(0.890, 0.7625, -1.870).addScaledVector(nrm, -0.001); bx.rotation.y = -yaw; bx.name = "RecHit"; bx.userData.prop = "rec"; bx.userData.part = "body"; scene.add(bx);
    // the two reels of the cassette in the window: small dark spokes laid over each hub, turned while the radio plays (the baked hubs are plain rings)
    const rc = document.createElement("canvas"); rc.width = rc.height = 128;
    { const g = rc.getContext("2d"); g.translate(64, 64); g.fillStyle = "rgba(24,18,14,.92)";
      for (let i = 0; i < 3; i++) { g.rotate(Math.PI * 2 / 3); g.fillRect(-7, -58, 14, 36); }
      g.beginPath(); g.arc(0, 0, 14, 0, 7); g.fill(); }
    const rtex = new THREE.CanvasTexture(rc);
    const ox = cand[0].c.x - 0.8935, reels = [];
    [0.9195, 0.9515].forEach(bx0 => {
      const x = bx0 + ox, grp = new THREE.Group();
      grp.position.set(x, 0.7715, cand[0].c.z + (x - cand[0].c.x) * Math.tan(yaw) - 0.0004); grp.rotation.y = -yaw;
      const m = new THREE.Mesh(new THREE.PlaneGeometry(0.0092, 0.0092), new THREE.MeshBasicMaterial({ map: rtex, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }));
      m.renderOrder = 3; grp.add(m); scene.add(grp); reels.push(m);
    });
    out.reels = reels;
    out.rec = { hit: bx, keys: meshesOut };
    console.log("recorder: keys", cand.length, "yaw", (yaw * 57.3).toFixed(1));
    out.nrm = nrm;
  }
  function stepRecorder(now) {
    if (!out.rec) return;
    for (const id of KEY_IDS) {
      const K = keys[id]; if (!K) continue;
      const d = (rad.latch === id ? 1 : K.goal) - K.level;
      if (d !== 0) {
        K.level = Math.abs(d) < 0.02 || reduced ? (rad.latch === id ? 1 : K.goal) : K.level + d * 0.4;
        K.holder.position.copy(K.base).addScaledVector(out.nrm, -KEY_DEPTH * K.level);
      }
    }
    if (out.reels) {
      const dt = Math.min(0.1, (now - (out.reelT || now)) / 1000); out.reelT = now;
      const sp = rad.on && rad.state === "live" ? 1 : rad.on && rad.state === "tuning" ? 0.35 : 0;
      out.reelV = (out.reelV || 0) + (sp * 7 - (out.reelV || 0)) * Math.min(1, dt * 3);
      if (!reduced) out.reels.forEach((m, i) => { m.rotation.z -= out.reelV * dt * (i ? 0.85 : 1.15); });
    }
    // the radio is silent while the sound button is off, while a call is on speaker, at the computer, and while the camera is still flying in
    const on = soundOk() && !rad.hold;
    if (audio.muted === on) audio.muted = !on;
    if (rad.on && rad.state === "live") drawCard();
  }

  setupTrophy();
  try { setupRecorder(); } catch (e) { console.warn("recorder failed", e); }

  return {
    get trophy() { return out.trophy; }, get rec() { return out.rec; },
    pickMeshes() { return [out.trophy?.hit, out.rec?.hit, ...(out.rec?.keys || [])].filter(Boolean); },
    info(obj) { return obj.userData.prop === "trophy" ? { kind: "trophy" } : obj.userData.prop === "rec" ? { kind: "rec", part: obj.userData.part } : null; },
    spinTrophy, armTrophy() { if (out.trophy) out.trophy.pending = true; },
    key, startRadio, stopRadio,
    get radioOn() { return rad.on; },
    // the camera has finished flying to a view
    arrived(name) {
      if (name === "trophy" && out.trophy?.pending) spinTrophy();
      if (name === "recorder") { rad.hold = false; if (rad.on) { sfx.tune(0.5); drawCard(); } }
    },
    step(now) { stepTrophy(now); stepRecorder(now); }
  };
}
