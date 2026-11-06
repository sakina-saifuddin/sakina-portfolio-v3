import * as THREE from "three";

// Desk phone (Phone_* objects in the Blender scene, x 0.83..1.10, z -2.31..-2.06). The handset is cut out of the merged
// Room_Tapes mesh by triangle position so it can move: it rattles while the phone rings, lifts off, drops on the desk and
// goes back onto the cradle. The base stays in the baked mesh and gets an invisible click box.
const HANDSET = new THREE.Box3(new THREE.Vector3(0.835, 0.7875, -2.32), new THREE.Vector3(1.105, 0.84, -2.24));
const DESK_TOP = 0.7258;
const SCRIPT = "\u201CHi. I\u2019m Sakina. I\u2019m a graduate student at the University of Houston, studying engineering data science and AI, and this is my portfolio. I have more than three years across software, data, automation and machine learning. In here you\u2019ll find six experiences, and five projects. Pick up any tape from the desk, and press play. Thanks for stopping by.\u201D";
const LAMP = new THREE.Vector3(0.869, 0.791, -2.27);
const GRILLE = new THREE.Vector3(1.057, 0.786, -2.246);
const smooth = x => x * x * (3 - 2 * x);
const clamp01 = x => Math.min(1, Math.max(0, x));

function glowTexture(rgb) {
  const cv = document.createElement("canvas"); cv.width = cv.height = 64;
  const g = cv.getContext("2d"), r = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  r.addColorStop(0, `rgba(${rgb},1)`); r.addColorStop(0.25, `rgba(${rgb},.55)`); r.addColorStop(1, `rgba(${rgb},0)`);
  g.fillStyle = r; g.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; return t;
}
function glow(rgb, size, pos, scene) {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(rgb), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
  s.scale.setScalar(size); s.position.copy(pos); s.renderOrder = 4; s.material.opacity = 0; scene.add(s); return s;
}

export function createPhone({ source, scene, reduced, soundOn, onState }) {
  source.updateWorldMatrix(true, false);
  const e = source.matrixWorld.elements;
  const g = source.geometry, pos = g.attributes.position, index = g.index.array;
  const keep = [], mine = [], p = new THREE.Vector3(), bb = new THREE.Box3();
  for (let t = 0; t < index.length; t += 3) {
    let cx = 0, cy = 0, cz = 0;
    for (let k = 0; k < 3; k++) { const i = index[t + k]; cx += pos.getX(i); cy += pos.getY(i); cz += pos.getZ(i); }
    cx /= 3; cy /= 3; cz /= 3;
    p.set(e[0] * cx + e[4] * cy + e[8] * cz + e[12], e[1] * cx + e[5] * cy + e[9] * cz + e[13], e[2] * cx + e[6] * cy + e[10] * cz + e[14]);
    if (HANDSET.containsPoint(p)) { mine.push(index[t], index[t + 1], index[t + 2]); bb.expandByPoint(p); }
    else keep.push(index[t], index[t + 1], index[t + 2]);
  }
  if (mine.length < 30) return null;
  g.setIndex(new THREE.BufferAttribute(new Uint32Array(keep), 1));

  const c = bb.getCenter(new THREE.Vector3()), minY = bb.min.y;
  const gi = new THREE.BufferGeometry();
  for (const n of Object.keys(g.attributes)) gi.setAttribute(n, g.attributes[n]);
  gi.setIndex(new THREE.BufferAttribute(new Uint32Array(mine), 1));
  const mesh = new THREE.Mesh(gi, source.material);
  mesh.matrixAutoUpdate = false;
  mesh.matrix.copy(source.matrixWorld).premultiply(new THREE.Matrix4().makeTranslation(-c.x, -c.y, -c.z));
  mesh.frustumCulled = false; mesh.castShadow = true; mesh.name = "PhoneHandset"; mesh.userData.phone = "handset";
  const holder = new THREE.Group(); holder.position.copy(c); holder.add(mesh);
  let root = source; while (root.parent) root = root.parent; root.add(holder);

  const hitBox = new THREE.Mesh(new THREE.BoxGeometry(0.29, 0.075, 0.26), new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }));
  hitBox.position.set(0.96, 0.76, -2.18); hitBox.name = "PhoneBase"; hitBox.userData.phone = "base"; root.add(hitBox);

  const lamp = glow("255,40,24", 0.05, LAMP, scene), grille = glow("255,190,90", 0.07, GRILLE, scene);

  // The speaker key: the bottom left key of the phone's left block, drawn red with a speaker symbol over the baked key.
  const KEY = new THREE.Vector3(0.8923, 0.7653, -2.1366), KEY_N = new THREE.Vector3(-0.0158, 0.9885, 0.1505).normalize();
  const keyTex = (() => {
    const cv = document.createElement("canvas"); cv.width = 196; cv.height = 172;
    const g = cv.getContext("2d");
    const rr = (x, y, w, h, r) => { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); };
    const fillG = g.createLinearGradient(0, 0, 0, 172); fillG.addColorStop(0, "#c8372b"); fillG.addColorStop(1, "#8e1d16");
    g.fillStyle = "#4a0f0b"; rr(2, 2, 192, 168, 22); g.fill();
    g.fillStyle = fillG; rr(8, 6, 180, 152, 18); g.fill();
    g.fillStyle = "rgba(255,255,255,.18)"; rr(14, 10, 168, 30, 12); g.fill();
    g.fillStyle = "#f7e9dc"; g.strokeStyle = "#f7e9dc"; g.lineCap = "round"; g.lineWidth = 9;
    g.beginPath(); g.moveTo(52, 70); g.lineTo(78, 70); g.lineTo(106, 46); g.lineTo(106, 126); g.lineTo(78, 102); g.lineTo(52, 102); g.closePath(); g.fill();
    for (const r of [22, 42]) { g.beginPath(); g.arc(106, 86, r, -0.9, 0.9); g.stroke(); }
    const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t;
  })();
  const keyMesh = new THREE.Mesh(new THREE.PlaneGeometry(0.0245, 0.0215), new THREE.MeshBasicMaterial({ map: keyTex, color: 0xd8d0c8, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }));
  keyMesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), KEY_N).multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -Math.PI / 2));
  keyMesh.position.copy(KEY).addScaledVector(KEY_N, 0.0007);
  keyMesh.name = "PhoneSpeakerKey"; keyMesh.userData.phone = "speaker"; keyMesh.renderOrder = 3; root.add(keyMesh);
  const keyGlow = glow("255,60,40", 0.05, KEY.clone().addScaledVector(KEY_N, 0.004), scene);
  const LAND = { dy: DESK_TOP + 0.0015 - minY, dz: 0.27, dx: 0.03, yaw: -0.42 }, LIFT = 0.1;

  // state: ringing -> lifting -> down (handset on the desk) -> speaker; hang-up returns to idle
  const HEARD = "sakina-phone-heard";
  const heard = () => { try { return sessionStorage.getItem(HEARD) === "1"; } catch { return false; } };
  const st = { mode: heard() ? "idle" : "ringing", s: 0, dir: 0, t0: 0, settle: 0, release: false };
  const audioEl = new Audio("sakina-phone.mp3?v=2"); audioEl.preload = "auto"; audioEl.volume = 1;
  let actx = null, level = 0;
  const caption = document.getElementById("phone-cap");

  function setMode(m) { st.mode = m; onState?.(m); }
  function pose(s) {
    const a = smooth(clamp01(s / 0.45)), b = clamp01((s - 0.45) / 0.55), v = smooth(b);
    const dy = b <= 0 ? LIFT * a : LIFT + (LAND.dy - LIFT) * (b * b);
    holder.position.set(c.x + LAND.dx * v, c.y + dy, c.z + 0.07 * a + (LAND.dz - 0.07) * v);
    holder.rotation.set(0, LAND.yaw * v, 0.25 * a * (1 - v) + 0.0);
  }
  function ringTone(now) {
    if (!soundOn?.() || reduced) return;
    const ph = (now / 1000) % 3.6;
    // Soft ring, repeated until the phone is answered.
    if (ph > 0.9 || ring.last === Math.floor(now / 3600) || ring.n >= RING_MAX) return;
    ring.last = Math.floor(now / 3600); ring.n++;
    try {
      actx ||= new AudioContext();
      if (actx.state === "suspended") actx.resume();
      const t = actx.currentTime, gn = actx.createGain();
      gn.gain.value = 0; gn.connect(actx.destination);
      for (let k = 0; k < 18; k++) {
        const o = actx.createOscillator(); o.type = "sine"; o.frequency.value = k % 2 ? 1180 : 1480;
        const gg = actx.createGain(); gg.gain.setValueAtTime(0, t + k * 0.05); gg.gain.linearRampToValueAtTime(RING_GAIN, t + k * 0.05 + 0.012); gg.gain.linearRampToValueAtTime(0, t + k * 0.05 + 0.048);
        o.connect(gg); gg.connect(gn); o.start(t + k * 0.05); o.stop(t + k * 0.05 + 0.05);
      }
      gn.gain.value = 1;
    } catch { /* audio unavailable */ }
  }
  const ring = { last: -1, n: 0 };
  const RING_MAX = Infinity, RING_GAIN = 0.05;   // soft but clearly audible sine ring until answered (square wave at 0.018 was harsh; 0.0065 sine was inaudible)

  function answer() {
    if (st.mode !== "ringing" && st.mode !== "idle") return false;
    try { sessionStorage.setItem(HEARD, "1"); } catch { /* storage unavailable */ }
    st.dir = 1; st.t0 = 0; setMode("lifting"); return true;
  }
  function speaker() {
    if (st.mode !== "down") return false;
    audioEl.muted = false; audioEl.volume = 1; audioEl.currentTime = 0;
    setMode("speaker");
    if (caption) { caption.textContent = SCRIPT; caption.hidden = false; }
    audioEl.play().catch(() => {
      if (caption) caption.textContent = "The browser blocked the sound. Click the phone once more to play it.";
      setMode("down");
    });
    return true;
  }
  function stopVoice() { audioEl.pause(); if (caption) caption.hidden = true; level = 0; }
  function hangup() {
    if (st.mode !== "down" && st.mode !== "speaker") return false;
    stopVoice(); st.dir = -1; st.t0 = 0; setMode("returning"); return true;
  }
  audioEl.addEventListener("ended", () => { if (st.mode === "speaker") hangup(); });
  function release() {
    if (st.mode === "down" || st.mode === "speaker") return hangup();
    if (st.mode === "lifting") st.release = true;
    return false;
  }

  let last = performance.now();
  function step(now) {
    const dt = Math.min(0.1, (now - last) / 1000); last = now;
    if (st.dir) {
      st.s = clamp01(st.s + st.dir * dt / (reduced ? 0.01 : 1.5));
      if (st.dir > 0 && st.s >= 1) { st.dir = 0; st.settle = now; setMode("down"); if (st.release) { st.release = false; hangup(); } }
      if (st.dir < 0 && st.s <= 0) { st.dir = 0; holder.position.copy(c); holder.rotation.set(0, 0, 0); setMode("idle"); }
    }
    if (st.s > 0) {
      pose(st.s);
      if (st.dir === 0 && !reduced) { const k = (now - st.settle) / 1000; holder.position.y += 0.007 * Math.exp(-k * 9) * Math.abs(Math.sin(k * 22)); }
    } else if (st.mode === "ringing" && !reduced) {
      const k = (now / 1000) % 3.6, on = k < 1.0;
      const w = on ? 1 : 0, f = now * 0.062;
      holder.position.set(c.x + w * 0.0045 * Math.sin(f * 1.9), c.y + w * (0.0035 * Math.abs(Math.sin(f)) + 0.0015 * Math.abs(Math.sin(f * 2.7))), c.z + w * 0.0025 * Math.sin(f * 1.3));
      holder.rotation.set(w * 0.035 * Math.sin(f * 1.6), w * 0.06 * Math.sin(f * 1.1), w * 0.075 * Math.sin(f * 1.9));
      ringTone(now);
    }
    keyGlow.material.opacity = st.mode === "down" && !reduced ? 0.25 + 0.2 * Math.sin(now * 0.005) : st.mode === "down" ? 0.35 : 0;
    const blink = st.mode === "ringing" ? (Math.floor(now / 300) % 2 ? 1 : 0.15) : 0;
    lamp.material.opacity = reduced && st.mode === "ringing" ? 1 : blink;
    const talking = st.mode === "speaker" && !audioEl.paused;
    level += ((talking ? 0.5 + 0.5 * Math.abs(Math.sin(now * 0.013) * Math.sin(now * 0.0047)) : 0) - level) * 0.25;
    grille.material.opacity = Math.min(1, level);
  }

  return {
    step, answer, speaker, hangup, release,
    get mode() { return st.mode; },
    get busy() { return st.dir !== 0; },
    pickMeshes: () => [mesh, hitBox, keyMesh],
    speakerHit: ray => ray.intersectObject(keyMesh, false).length > 0,
    frame: new THREE.Box3(new THREE.Vector3(0.83, 0.72, -2.31), new THREE.Vector3(1.1, 0.84, -1.95))
  };
}
