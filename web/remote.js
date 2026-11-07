import * as THREE from "three";

// The VCR remote (Remote_* objects in the Blender scene, x 0.033..0.226, z -1.892..-1.828, lying on the desk in front of the
// recorder). Like the phone handset it is cut out of the merged Room_Tapes mesh by triangle position, so it can move: it lifts off
// the desk, flies to the right-hand side of the view at its real size (19 cm) and is held there with every key clickable, then
// flies back to exactly where it lay. The base stays in the baked mesh; the dark patch baked into the desk under it is lifted by
// main-pad.js while the remote is away (see deskGone / DG there).

const BOX = new THREE.Box3(new THREE.Vector3(0.030, 0.715, -1.897), new THREE.Vector3(0.232, 0.745, -1.823));
// Where the remote lies, measured from the baked triangles: centre of the body, and the direction of its long axis
// (local +X = the battery end; the IR window / power key end is local -X). Local +Y (its width) points to -z at rest.
const CX = 0.1300, CZ = -1.8596, AX = 0.99871, AZ = 0.05069, BASE_Y = 0.72;
const L = 0.190, H = 0.0175;
const topZ = x => H * (0.86 + 0.14 * (x / L + 0.5));
const YAW = -Math.atan2(AZ, AX);                 // rotation about Y that takes local X to the remote's world direction
const Q_REST = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), YAW);
const smooth = x => x * x * (3 - 2 * x);
const clamp01 = x => Math.min(1, Math.max(0, x));

// Key layout in the remote's own frame (metres): x along its length, y across it (see components/room_refresh/parts/remote.py).
const KEYS = [
  ["power", -0.074, -0.013, 0.010, 0.010], ["eject", -0.074, 0.013, 0.010, 0.010],
  ["play", 0.022, 0, 0.012, 0.016], ["rew", 0.022, -0.0175, 0.011, 0.012], ["ff", 0.022, 0.0175, 0.011, 0.012],
  ["rec", 0.041, -0.0175, 0.010, 0.012], ["stop", 0.041, 0, 0.010, 0.016], ["pause", 0.041, 0.0175, 0.010, 0.012],
  ["chnext", 0.0615, -0.012, 0.011, 0.010], ["chprev", 0.0725, -0.012, 0.011, 0.010],
  ["menu", 0.064, 0.014, 0.009, 0.009], ["timer", 0.077, 0.014, 0.009, 0.009]
];
const PAD = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "tv", "0", "plus10"];
for (let r = 0; r < 4; r++) for (let c = 0; c < 3; c++) KEYS.push([PAD[r * 3 + c], -0.050 + r * 0.0135, (c - 1) * 0.0145, 0.0105, 0.0085]);

export function createRemote({ source, material, camera, reduced, onChange, decorate }) {
  source.updateWorldMatrix(true, false);
  const e = source.matrixWorld.elements;
  const g = source.geometry, pos = g.attributes.position, index = g.index.array;
  const keep = [], mine = [], p = new THREE.Vector3(), bb = new THREE.Box3();
  for (let t = 0; t < index.length; t += 3) {
    let cx = 0, cy = 0, cz = 0;
    for (let k = 0; k < 3; k++) { const i = index[t + k]; cx += pos.getX(i); cy += pos.getY(i); cz += pos.getZ(i); }
    cx /= 3; cy /= 3; cz /= 3;
    p.set(e[0] * cx + e[4] * cy + e[8] * cz + e[12], e[1] * cx + e[5] * cy + e[9] * cz + e[13], e[2] * cx + e[6] * cy + e[10] * cz + e[14]);
    if (BOX.containsPoint(p)) { mine.push(index[t], index[t + 1], index[t + 2]); for (let k = 0; k < 3; k++) { const i = index[t + k]; bb.expandByPoint(p.set(pos.getX(i), pos.getY(i), pos.getZ(i)).applyMatrix4(source.matrixWorld)); } }
    else keep.push(index[t], index[t + 1], index[t + 2]);
  }
  if (mine.length < 300) return null;
  g.setIndex(new THREE.BufferAttribute(new Uint32Array(keep), 1));

  const c0 = bb.getCenter(new THREE.Vector3());
  const gi = new THREE.BufferGeometry();
  for (const n of Object.keys(g.attributes)) gi.setAttribute(n, g.attributes[n]);
  gi.setIndex(new THREE.BufferAttribute(new Uint32Array(mine), 1));
  const mesh = new THREE.Mesh(gi, material);
  mesh.matrixAutoUpdate = false;
  mesh.matrix.copy(source.matrixWorld).premultiply(new THREE.Matrix4().makeTranslation(-c0.x, -c0.y, -c0.z));
  mesh.frustumCulled = false; mesh.castShadow = true; mesh.name = "Remote"; mesh.userData.remote = "body";
  const holder = new THREE.Group(); holder.position.copy(c0); holder.add(mesh);
  let root = source; while (root.parent) root = root.parent; root.add(holder);

  const hm = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false, colorWrite: false });
  // A generous click box over the whole remote while it lies on the desk (the baked body is only 1.7 cm thick).
  const restHit = new THREE.Mesh(new THREE.BoxGeometry(0.215, 0.03, 0.075), hm);
  restHit.position.set(CX - c0.x, BASE_Y + 0.012 - c0.y, CZ - c0.z); restHit.rotation.y = YAW; restHit.userData.remote = "body"; restHit.name = "RemoteRestHit";
  holder.add(restHit);
  // One invisible box per key, in the same frame as the baked mesh, so the keys follow the remote wherever it is.
  const keyHits = KEYS.map(([id, x, y, w, d]) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w + 0.003, 0.016, d + 0.003), hm);
    const wx = CX + x * AX + y * AZ, wz = CZ + x * AZ - y * AX;
    m.position.set(wx - c0.x, BASE_Y + topZ(x) - c0.y, wz - c0.z); m.rotation.y = YAW;
    m.userData.remote = "key"; m.userData.rkey = id; m.name = "RemoteKey_" + id; holder.add(m);
    return m;
  });

  // The baked texture is far too coarse to read the key legends at this size, so while the remote is held a crisp copy of the top face
  // is laid over it: the body top, then the keys with their printed legends (same positions, colours and wording as the Blender model).
  const PXM = 10667, CVW = 2048, CVH = 564;
  const px = x => CVW / 2 + x * PXM, py = y => CVH / 2 - y * PXM;
  const rr = (g, x, y, w, h, r) => { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); };
  const tex = cv => { const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 16; return t; };
  const skinCv = document.createElement("canvas"); skinCv.width = CVW; skinCv.height = CVH;
  {
    const g = skinCv.getContext("2d"), w = (L - 0.0075) * PXM, h = (0.052 - 0.0075) * PXM;
    const gr = g.createLinearGradient(px(-L / 2), 0, px(L / 2), 0); gr.addColorStop(0, "#8f7152"); gr.addColorStop(0.55, "#9b7d5c"); gr.addColorStop(1, "#b19a80");
    g.fillStyle = gr; rr(g, CVW / 2 - w / 2, CVH / 2 - h / 2, w, h, 0.0105 * PXM); g.fill();
  }
  const keyCv = document.createElement("canvas"); keyCv.width = CVW; keyCv.height = CVH;
  {
    const g = keyCv.getContext("2d");
    const GREY = "#d6c3a2", DARK = "#4b3727", RED = "#d2492f", INK = "#24180f", CREAM = "#f3e6cc";
    const col = { power: RED, rec: RED, eject: DARK, rew: DARK, ff: DARK, stop: DARK, pause: DARK, menu: DARK, timer: DARK, play: "#6a8f5e" };
    const lit = { power: "#fff", rec: "#fff", eject: CREAM, rew: CREAM, ff: CREAM, stop: CREAM, pause: CREAM, menu: CREAM, timer: CREAM, play: "#fff" };
    // a raised, moulded key: soft drop shadow, dark gap around it, bevelled rim, glossy dome, bright edge on the lit side
    const keyTop = (x, y, w, d, c) => {
      const b = 0.06 * Math.min(w, d), kw = (w - 2 * b) * PXM, kd = (d - 2 * b) * PXM, X = px(x) - kw / 2, Y = py(y) - kd / 2, r = Math.min(kw, kd) * 0.34;
      g.save(); g.shadowColor = "rgba(20,10,0,.7)"; g.shadowBlur = 14; g.shadowOffsetX = -7; g.shadowOffsetY = 5;
      g.fillStyle = "rgba(25,14,4,.9)"; rr(g, X - 5, Y - 5, kw + 10, kd + 10, r + 4); g.fill(); g.restore();
      g.fillStyle = c; rr(g, X, Y, kw, kd, r); g.fill();
      const dome = g.createRadialGradient(X + kw * 0.38, Y + kd * 0.3, 1, X + kw * 0.5, Y + kd * 0.5, Math.max(kw, kd) * 0.62);
      dome.addColorStop(0, "rgba(255,255,255,.34)"); dome.addColorStop(0.55, "rgba(255,255,255,.04)"); dome.addColorStop(1, "rgba(0,0,0,.30)");
      g.fillStyle = dome; rr(g, X, Y, kw, kd, r); g.fill();
      g.lineWidth = 3; g.strokeStyle = "rgba(255,255,255,.42)"; rr(g, X + 2, Y + 2, kw - 4, kd - 4, r - 1); g.stroke();
      g.lineWidth = 2; g.strokeStyle = "rgba(0,0,0,.45)"; rr(g, X, Y, kw, kd, r); g.stroke();
    };
    const text = (s, x, y, size, ink = INK) => {
      g.save(); g.translate(px(x), py(y)); g.rotate(-Math.PI / 2);
      g.font = "800 " + Math.round(size * PXM) + "px 'Helvetica Neue', Arial, sans-serif"; g.textAlign = "center"; g.textBaseline = "middle";
      try { g.letterSpacing = Math.round(size * PXM * 0.06) + "px"; } catch (e) {}
      g.fillStyle = ink; g.fillText(s, 0, 0); g.restore();
    };
    // printed symbols on the transport keys, drawn bigger than words so they read at a glance
    const glyph = (id, x, y, ink) => {
      g.save(); g.translate(px(x), py(y)); g.rotate(-Math.PI / 2); g.fillStyle = ink; const s = 0.0032 * PXM;
      const tri = (cx, dir) => { g.beginPath(); g.moveTo(cx + dir * s, 0); g.lineTo(cx - dir * s * 0.8, -s * 0.95); g.lineTo(cx - dir * s * 0.8, s * 0.95); g.closePath(); g.fill(); };
      if (id === "play") tri(0, 1);
      else if (id === "rew") { tri(-s * 0.7, -1); tri(s * 0.7, -1); }
      else if (id === "ff") { tri(-s * 0.7, 1); tri(s * 0.7, 1); }
      else if (id === "stop") g.fillRect(-s * 0.8, -s * 0.8, s * 1.6, s * 1.6);
      else if (id === "pause") { g.fillRect(-s * 0.8, -s * 0.85, s * 0.6, s * 1.7); g.fillRect(s * 0.2, -s * 0.85, s * 0.6, s * 1.7); }
      else if (id === "rec") { g.beginPath(); g.arc(0, 0, s * 0.85, 0, 7); g.fill(); }
      g.restore();
    };
    const WORD = { power: "POWER", eject: "EJECT", menu: "MENU", timer: "TIMER" };
    for (const [id, x, y, w, d] of KEYS) {
      if (id === "chnext" || id === "chprev") continue;
      keyTop(x, y, w, d, col[id] || GREY);
      const ink = lit[id] || INK;
      if (["play", "stop", "rew", "ff", "pause", "rec"].includes(id)) glyph(id, x, y, ink);
      else if (WORD[id]) text(WORD[id], x, y, 0.0030, ink);
      else { const lbl = id === "tv" ? "TV" : id === "plus10" ? "+10" : id; text(lbl, x, y, lbl.length > 1 ? 0.0033 : 0.0048, ink); }
    }
  }
  // channel rocker: one long key that stands a little taller than the others, so it gets its own plane. An arrow at each end (the IR end is
  // the "up" end), CH printed under it.
  const rockCv = document.createElement("canvas"); rockCv.width = CVW; rockCv.height = CVH;
  {
    const g = rockCv.getContext("2d");
    const w = 0.022, d = 0.010, b = 0.06 * d, kw = (w - 2 * b) * PXM, kd = (d - 2 * b) * PXM, X = px(0.067) - kw / 2, Y = py(-0.012) - kd / 2, r = kd * 0.34;
    g.save(); g.shadowColor = "rgba(20,10,0,.7)"; g.shadowBlur = 14; g.shadowOffsetX = -7; g.shadowOffsetY = 5;
    g.fillStyle = "rgba(25,14,4,.9)"; rr(g, X - 5, Y - 5, kw + 10, kd + 10, r + 4); g.fill(); g.restore();
    g.fillStyle = "#d6c3a2"; rr(g, X, Y, kw, kd, r); g.fill();
    const dome = g.createRadialGradient(X + kw * 0.4, Y + kd * 0.3, 1, X + kw * 0.5, Y + kd * 0.5, kw * 0.6);
    dome.addColorStop(0, "rgba(255,255,255,.34)"); dome.addColorStop(0.55, "rgba(255,255,255,.04)"); dome.addColorStop(1, "rgba(0,0,0,.30)");
    g.fillStyle = dome; rr(g, X, Y, kw, kd, r); g.fill();
    g.lineWidth = 3; g.strokeStyle = "rgba(255,255,255,.42)"; rr(g, X + 2, Y + 2, kw - 4, kd - 4, r - 1); g.stroke();
    g.lineWidth = 2; g.strokeStyle = "rgba(0,0,0,.45)"; rr(g, X, Y, kw, kd, r); g.stroke();
    g.fillStyle = "#24180f";
    for (const [ax, dir] of [[0.0615, -1], [0.0725, 1]]) { const cx = px(ax), cy = py(-0.012), s = 0.0030 * PXM; g.beginPath(); g.moveTo(cx + dir * s, cy); g.lineTo(cx - dir * s * 0.6, cy - s * 0.9); g.lineTo(cx - dir * s * 0.6, cy + s * 0.9); g.closePath(); g.fill(); }
    g.save(); g.translate(px(0.067), py(-0.012)); g.rotate(-Math.PI / 2);
    g.font = "800 " + Math.round(0.0027 * PXM) + "px 'Helvetica Neue', Arial, sans-serif"; g.textAlign = "center"; g.textBaseline = "middle";
    g.fillText("CH", 0, 0); g.restore();
  }
  const mkPlane = (cv, lift, order) => {
    const mat = new THREE.MeshBasicMaterial({ map: tex(cv), transparent: true, depthWrite: false, opacity: 0, color: 0xffffff, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
    const geo = new THREE.PlaneGeometry(CVW / PXM, CVH / PXM); geo.rotateX(-Math.PI / 2);
    const pl = new THREE.Mesh(geo, mat); pl.position.y = lift; pl.renderOrder = order; pl.frustumCulled = false; pl.userData.noPick = true; return pl;
  };
  const legend = new THREE.Group();
  legend.position.set(CX - c0.x, BASE_Y + topZ(0) - c0.y, CZ - c0.z); legend.rotation.y = YAW;
  const tilt = new THREE.Group(); tilt.rotation.z = Math.atan(H * 0.14 / L); legend.add(tilt);
  const skin = mkPlane(skinCv, 0.0003, 5), keysPl = mkPlane(keyCv, 0.0013, 6), rockPl = mkPlane(rockCv, 0.0021, 7);
  if (decorate) { decorate(skin.material); decorate(keysPl.material); decorate(rockPl.material); }
  tilt.add(skin, keysPl, rockPl); legend.visible = false; holder.add(legend);
  const setLegend = o => { legend.visible = o > 0.01; skin.material.opacity = o; keysPl.material.opacity = o; rockPl.material.opacity = o; };

  let state = "rest", t0 = 0, T = 0;
  const DUR = reduced ? 1 : 950;
  const restPos = c0.clone(), restQ = new THREE.Quaternion();
  const heldPos = new THREE.Vector3(), heldQ = new THREE.Quaternion();
  const tmpQ = new THREE.Quaternion(), tmpM = new THREE.Matrix4(), v1 = new THREE.Vector3(), v2 = new THREE.Vector3(), v3 = new THREE.Vector3();

  // Where the remote is held: on the right of the picture, upright, tilted back like a hand holding it up to the TV, keys to the viewer.
  function computeHeld(now) {
    const f = THREE.MathUtils.degToRad(camera.fov), th = Math.tan(f / 2);
    const asp = camera.aspect || 1.78;
    let d = L / (0.54 * 2 * th); d = Math.min(0.75, Math.max(0.3, d));
    const vh = 2 * d * th, hw = (vh / 2) * asp;
    const narrow = asp < 1;
    const cxo = narrow ? hw * 0.55 : Math.min(hw * 0.62, 0.30), cyo = narrow ? -vh * 0.10 : vh * 0.035;
    const swx = reduced ? 0 : Math.sin(now / 1900) * 0.0025, swy = reduced ? 0 : Math.sin(now / 1400 + 1) * 0.0018;
    v1.set(cxo + swx, cyo + swy, -d).applyQuaternion(camera.quaternion).add(camera.position);
    heldPos.copy(v1);
    // basis in camera space: X (battery end) down and a little right/forward, Y (key side) toward the viewer, Z = X x Y
    const X = v1.set(0.10, -0.93, 0.34).normalize().clone();
    const Z0 = v2.set(0, 0, 1);
    const Y = Z0.clone().sub(X.clone().multiplyScalar(Z0.dot(X))).normalize();
    const Z = v3.crossVectors(X, Y).normalize().clone();
    tmpM.makeBasis(X, Y, Z);
    heldQ.setFromRotationMatrix(tmpM).premultiply(camera.quaternion);
    if (!reduced) { tmpQ.setFromEuler(new THREE.Euler(Math.sin(now / 1700) * 0.012, Math.sin(now / 2300) * 0.015, 0)); heldQ.multiply(tmpQ); }
    heldQ.multiply(Q_REST.clone().invert());       // the baked mesh keeps its rest yaw, so take it out
  }

  function pose(s, now) {
    computeHeld(now);
    const k = smooth(clamp01(s));
    holder.position.lerpVectors(restPos, heldPos, k);
    holder.position.y += Math.sin(Math.PI * clamp01(s)) * 0.10;                 // a lift on the way
    holder.quaternion.slerpQuaternions(restQ, heldQ, k);
    setLegend(clamp01((s - 0.55) / 0.35));
  }

  const api = {
    holder, mesh,
    get state() { return state; },
    get out() { return state === "up" || state === "held"; },
    get busy() { return state === "up" || state === "down"; },
    // the dark patch on the desk stays lifted until the remote has nearly landed again
    get shadowGone() { return state === "up" || state === "held" || (state === "down" && T < 0.55); },
    pickMeshes() { return state === "rest" ? [restHit, mesh] : state === "held" ? [...keyHits, mesh] : []; },
    keyId(obj) { return obj?.userData?.rkey || null; },
    pickUp() {
      const now = performance.now();
      if (state === "rest") { state = "up"; T = 0; t0 = now; }
      else if (state === "down") { state = "up"; t0 = now - T * DUR; }
      else return false;
      onChange?.("up"); return true;
    },
    putBack() {
      const now = performance.now();
      if (state === "held") { state = "down"; T = 1; t0 = now; }
      else if (state === "up") { state = "down"; t0 = now - (1 - T) * DUR; }
      else return false;
      onChange?.("down"); return true;
    },
    toggle() { return this.out ? this.putBack() : this.pickUp(); },
    step(now) {
      if (state === "rest") { setLegend(0); return; }
      if (state === "up") {
        T = clamp01((now - t0) / DUR); pose(T, now);
        if (T >= 1) { state = "held"; onChange?.("held"); }
      } else if (state === "held") { T = 1; pose(1, now); }
      else if (state === "down") {
        T = clamp01(1 - (now - t0) / DUR); pose(T, now);
        if (T <= 0) { state = "rest"; holder.position.copy(restPos); holder.quaternion.copy(restQ); onChange?.("rest"); }
      }
    }
  };
  return api;
}
