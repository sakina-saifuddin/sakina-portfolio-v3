import * as THREE from "three";
import { NOTEBOOK_PAGES } from "./notebook-content.js";

// The lined notebook on the left of the desk (part of the baked Room_Desk mesh). Its pencil is cut out of that mesh so it can
// lift off, write on the page with a drawn ink layer, turn the page, and go back. Coordinates are from the Blender scene.
const ORIGIN = new THREE.Vector3(-0.4513, 0.7389, -1.7339);   // near left corner of the top sheet
const U = new THREE.Vector3(0.9945, 0, -0.1045).normalize();   // along a ruled line, left to right
const V = new THREE.Vector3(-0.1045, 0, -0.9945).normalize();  // up the page (away from the viewer)
const PW = 0.155, PH = 0.215;
const CW = 1024, CH = Math.round(CW * PH / PW);
const PX = CW / PW;                                            // canvas pixels per metre
const LINE0 = 0.0225 * PX, LS = 0.0185 * PX;                   // first ruled line from the top and the line spacing
const MARGIN = 0.0125 * PX;
const INK = "rgba(38,38,46,0.93)";
const FONT = "Caveat, 'Segoe Print', cursive";
const smooth = x => x * x * (3 - 2 * x);
const clamp01 = x => Math.min(1, Math.max(0, x));

export function createNotebook({ source, scene, reduced, sfx, paperColor = "#e9e1cf", paperColorRight = "#ecdcc6" }) {
  // 1. cut the pencil (the islands lying across the page, not the ruled lines or the sheet) out of the desk mesh
  source.updateWorldMatrix(true, false);
  const g = source.geometry, pos = g.attributes.position, index = g.index.array, e = source.matrixWorld.elements;
  const w = i => new THREE.Vector3(
    e[0] * pos.getX(i) + e[4] * pos.getY(i) + e[8] * pos.getZ(i) + e[12],
    e[1] * pos.getX(i) + e[5] * pos.getY(i) + e[9] * pos.getZ(i) + e[13],
    e[2] * pos.getX(i) + e[6] * pos.getY(i) + e[10] * pos.getZ(i) + e[14]);
  const region = new THREE.Box3(new THREE.Vector3(-0.52, 0.70, -1.99), new THREE.Vector3(-0.28, 0.9, -1.70));
  const weld = new Map(), parent = [];
  const find = a => { while (parent[a] !== a) { parent[a] = parent[parent[a]]; a = parent[a]; } return a; };
  const wid = i => {
    const k = Math.round(pos.getX(i) * 1e5) + "," + Math.round(pos.getY(i) * 1e5) + "," + Math.round(pos.getZ(i) * 1e5);
    let v = weld.get(k); if (v === undefined) { v = parent.length; parent.push(v); weld.set(k, v); } return v;
  };
  const cand = [];
  for (let t = 0; t < index.length; t += 3) {
    const c = w(index[t]).add(w(index[t + 1])).add(w(index[t + 2])).multiplyScalar(1 / 3);
    if (!region.containsPoint(c)) continue;
    cand.push(t); parent[find(wid(index[t]))] = find(wid(index[t + 1])); parent[find(wid(index[t + 1]))] = find(wid(index[t + 2]));
  }
  const isl = new Map();
  for (const t of cand) {
    const r = find(wid(index[t]));
    let o = isl.get(r); if (!o) { o = { tris: [], box: new THREE.Box3() }; isl.set(r, o); }
    o.tris.push(t);
    for (let k = 0; k < 3; k++) o.box.expandByPoint(w(index[t + k]));
  }
  const pencilBox = new THREE.Box3(new THREE.Vector3(-0.46, 0.738, -1.92), new THREE.Vector3(-0.34, 0.75, -1.755));
  const mine = [], sel = new Set();
  for (const o of isl.values()) {
    const c = o.box.getCenter(new THREE.Vector3()), s = o.box.getSize(new THREE.Vector3());
    if (o.tris.length < 100 || s.y > 0.012 || !pencilBox.containsPoint(c)) continue;
    for (const t of o.tris) { mine.push(index[t], index[t + 1], index[t + 2]); sel.add(t); }
  }
  if (mine.length < 300) return null;
  const keep = [];
  for (let t = 0; t < index.length; t += 3) if (!sel.has(t)) keep.push(index[t], index[t + 1], index[t + 2]);
  g.setIndex(new THREE.BufferAttribute(new Uint32Array(keep), 1));

  let lo = null, hi = null;
  const axis0 = new THREE.Vector3(0.549, 0, 0.836);
  for (let k = 0; k < mine.length; k++) {
    const v = w(mine[k]), d = v.dot(axis0);
    if (!lo || d < lo.d) lo = { d, v: v.clone() };
    if (!hi || d > hi.d) hi = { d, v: v.clone() };
  }
  const tip0 = new THREE.Vector3(lo.v.x, 0.7426, lo.v.z);
  const a0 = new THREE.Vector3(hi.v.x - lo.v.x, 0, hi.v.z - lo.v.z).normalize();
  const gi = new THREE.BufferGeometry();
  for (const n of Object.keys(g.attributes)) gi.setAttribute(n, g.attributes[n]);
  gi.setIndex(new THREE.BufferAttribute(new Uint32Array(mine), 1));
  const pencil = new THREE.Mesh(gi, source.material);
  pencil.matrixAutoUpdate = false;
  pencil.matrix.copy(source.matrixWorld).premultiply(new THREE.Matrix4().makeTranslation(-tip0.x, -tip0.y, -tip0.z));
  pencil.frustumCulled = false; pencil.castShadow = true; pencil.name = "NotebookPencil"; pencil.userData.notebook = true;
  const holder = new THREE.Group(); holder.position.copy(tip0); holder.add(pencil);
  let root = source; while (root.parent) root = root.parent; root.add(holder);

  const aWrite = new THREE.Vector3(0.29, 0.77, -0.57).normalize();
  const qWrite = new THREE.Quaternion().setFromUnitVectors(a0, aWrite);
  const qRest = new THREE.Quaternion();

  // 2. the ink layer on the top sheet, and the sheet that turns
  const basis = new THREE.Matrix4().makeBasis(U, V, new THREE.Vector3(0, 1, 0));
  const mkCanvas = () => { const c = document.createElement("canvas"); c.width = CW; c.height = CH; return c; };
  const inkC = mkCanvas(), baseC = mkCanvas(), sheetC = mkCanvas(), blankC = mkCanvas(), paperC = mkCanvas();
  const ink = inkC.getContext("2d"), base = baseC.getContext("2d");
  const tex = c => { const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t; };
  const inkTex = tex(inkC), sheetTex = tex(sheetC), blankTex = tex(blankC);
  const inkMesh = new THREE.Mesh(new THREE.PlaneGeometry(PW, PH), new THREE.MeshBasicMaterial({ map: inkTex, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }));
  inkMesh.quaternion.setFromRotationMatrix(basis);
  inkMesh.position.copy(ORIGIN).addScaledVector(U, PW / 2).addScaledVector(V, PH / 2); inkMesh.position.y = 0.7394;
  inkMesh.renderOrder = 3; inkMesh.frustumCulled = false; inkMesh.name = "NotebookInk"; inkMesh.userData.notebook = true; inkMesh.visible = false; scene.add(inkMesh);

  const hingeBase = new THREE.Group();
  hingeBase.quaternion.setFromRotationMatrix(basis);
  hingeBase.position.copy(ORIGIN).addScaledVector(V, PH / 2); hingeBase.position.y = 0.7399;
  const hinge = new THREE.Group(); hingeBase.add(hinge);
  const sheetGeo = new THREE.PlaneGeometry(PW, PH); sheetGeo.translate(PW / 2, 0, 0);
  const front = new THREE.Mesh(sheetGeo, new THREE.MeshBasicMaterial({ map: sheetTex, side: THREE.FrontSide, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 }));
  const back = new THREE.Mesh(sheetGeo, new THREE.MeshBasicMaterial({ map: blankTex, side: THREE.BackSide, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 }));
  for (const m of [front, back]) { m.renderOrder = 3.2; m.frustumCulled = false; hinge.add(m); }
  hingeBase.visible = false; scene.add(hingeBase);

  const paintPaper = (ctx, withInk) => {
    const gr = ctx.createLinearGradient(0, 0, CW, CH * 0.6);
    gr.addColorStop(0, paperColor); gr.addColorStop(1, paperColorRight);
    ctx.fillStyle = gr; ctx.fillRect(0, 0, CW, CH);
    ctx.strokeStyle = "rgba(120,138,168,0.55)"; ctx.lineWidth = 3;
    for (let k = 0; k < 10; k++) { const y = LINE0 + k * LS; ctx.beginPath(); ctx.moveTo(MARGIN, y); ctx.lineTo(CW - MARGIN, y); ctx.stroke(); }
    if (withInk) ctx.drawImage(baseC, 0, 0);
  };
  paintPaper(blankC.getContext("2d"), false); blankTex.needsUpdate = true;
  paintPaper(paperC.getContext("2d"), false);

  // 3. the writing script for one page: a list of strokes with a duration each
  const measure = mkCanvas().getContext("2d");
  const fontAt = px => `600 ${px}px ${FONT}`;
  const lineY = k => LINE0 + k * LS - 8;
  function buildOps(page) {
    const ops = [];
    const hs = page.circle ? 112 : 96;
    measure.font = fontAt(hs);
    const hw = measure.measureText(page.heading).width, hx = MARGIN + 34, hy = lineY(1);
    ops.push({ t: "text", text: page.heading, x: hx, y: hy, px: hs, dur: 320 + page.heading.length * 85 });
    if (page.circle) ops.push({ t: "ring", cx: hx + hw / 2, cy: hy - hs * 0.34, rx: hw / 2 + 56, ry: hs * 0.62 + 8, dur: 1000 });
    else ops.push({ t: "under", x0: hx - 6, x1: hx + hw + 10, y: hy + 22, dur: 600 });
    const head = ops.length;
    let slot = 2;
    const tx = MARGIN + 62, avail = CW - MARGIN - tx - 6;
    for (const item of page.items) {
      let px = 68; measure.font = fontAt(px);
      const words = item.split(" "), lines = []; let cur = "";
      for (const word of words) {
        const next = cur ? cur + " " + word : word;
        if (measure.measureText(next).width > avail && cur) { lines.push(cur); cur = word; } else cur = next;
      }
      lines.push(cur);
      if (slot + lines.length > 10) { console.warn("notebook page is full, dropped:", item); break; }
      lines.forEach((text, i) => {
        if (i === 0) ops.push({ t: "dot", x: MARGIN + 22, y: lineY(slot) - 20, r: 8, dur: 160 });
        ops.push({ t: "text", text, x: tx, y: lineY(slot), px, dur: 260 + text.length * 70 });
        slot++;
      });
    }
    let at = 0;
    for (const op of ops) { op.gap = 260; op.s = at; op.a = at + op.gap; op.e = op.a + op.dur; at = op.e; if (op.t === "text") { measure.font = fontAt(op.px); op.w = measure.measureText(op.text).width; } }
    return { ops, total: at, head };
  }
  const ringPt = (op, a) => {
    const grow = 1 + 0.05 * (a + 2.2) / (Math.PI * 2);
    return [op.cx + op.rx * grow * Math.cos(a), op.cy + op.ry * grow * Math.sin(a)];
  };
  const RING_A0 = -2.2, RING_SPAN = Math.PI * 2 * 1.07;
  const startPt = op => op.t === "text" ? [op.x, op.y] : op.t === "dot" ? [op.x, op.y] : op.t === "ring" ? ringPt(op, RING_A0) : [op.x0, op.y];
  const endPt = op => op.t === "text" ? [op.x + op.w, op.y] : op.t === "dot" ? [op.x, op.y] : op.t === "ring" ? ringPt(op, RING_A0 + RING_SPAN) : [op.x1, op.y];

  function drawOp(ctx, op, p) {
    ctx.save();
    ctx.fillStyle = INK; ctx.strokeStyle = INK; ctx.lineCap = "round"; ctx.lineJoin = "round";
    if (op.t === "text") {
      ctx.font = fontAt(op.px); ctx.textBaseline = "alphabetic";
      ctx.beginPath(); ctx.rect(op.x - 10, op.y - op.px * 1.1, (op.w + 24) * p, op.px * 1.6); ctx.clip();
      ctx.fillText(op.text, op.x, op.y);
    } else if (op.t === "dot") {
      ctx.beginPath(); ctx.arc(op.x, op.y, op.r * Math.min(1, p * 1.4), 0, Math.PI * 2); ctx.fill();
    } else if (op.t === "ring") {
      ctx.lineWidth = 7; ctx.beginPath();
      const n = Math.max(2, Math.ceil(90 * p));
      for (let i = 0; i <= n; i++) { const [x, y] = ringPt(op, RING_A0 + RING_SPAN * p * i / n); if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y); }
      ctx.stroke();
    } else {
      ctx.lineWidth = 6; ctx.beginPath();
      const n = Math.max(2, Math.ceil(60 * p));
      for (let i = 0; i <= n; i++) { const x = op.x0 + (op.x1 - op.x0) * p * i / n; const y = op.y + 5 * Math.sin(x * 0.035); if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y); }
      ctx.stroke();
    }
    ctx.restore();
  }
  const tipOf = op => {
    return (p) => {
      if (op.t === "text") return [op.x + op.w * p, op.y - 14 - 15 * Math.abs(Math.sin(p * op.text.length * 1.8))];
      if (op.t === "dot") return [op.x, op.y];
      if (op.t === "ring") return ringPt(op, RING_A0 + RING_SPAN * p);
      return [op.x0 + (op.x1 - op.x0) * p, op.y + 5 * Math.sin((op.x0 + (op.x1 - op.x0) * p) * 0.035)];
    };
  };
  const worldAt = ([cx, cy], lift, out = new THREE.Vector3()) =>
    out.copy(ORIGIN).addScaledVector(U, cx / PX).addScaledVector(V, PH * (1 - cy / CH)).setY(0.7399 + lift);

  // 4. the player
  let phase = "rest", touched = false, resumeT = null, t0 = 0, page = 0, script = null, drawn = 0, glide = null, lastScratch = 0, flipT0 = 0, fromPose = null;
  const cur = new THREE.Vector3(), tmp = new THREE.Vector3(), tip = tip0.clone(), q = new THREE.Quaternion();
  const poseNow = () => ({ p: holder.position.clone(), q: holder.quaternion.clone() });
  const setPose = (p, qq) => { holder.position.copy(p); holder.quaternion.copy(qq); };
  const startGlide = (to, toQ, dur, hop, now) => { glide = { t0: now, dur: reduced ? 1 : dur, from: poseNow(), to: to.clone(), toQ: toQ.clone(), hop }; };
  function stepGlide(now) {
    if (!glide) return false;
    const k = clamp01((now - glide.t0) / glide.dur), s = smooth(k);
    tmp.lerpVectors(glide.from.p, glide.to, s); tmp.y += glide.hop * Math.sin(Math.PI * k);
    q.copy(glide.from.q).slerp(glide.toQ, s);
    setPose(tmp, q);
    if (k >= 1) { glide = null; return false; }
    return true;
  }
  function loadPage(i) {
    page = i; script = buildOps(NOTEBOOK_PAGES[i]); script.first = i === 0 ? script.head : 0; drawn = 0;
    base.clearRect(0, 0, CW, CH); ink.drawImage(paperC, 0, 0); inkTex.needsUpdate = true;
  }
  function paintStatic(i, all = false) {
    loadPage(i);
    const n = all ? script.ops.length : script.first;
    for (const op of script.ops.slice(0, n)) drawOp(base, op, 1);
    drawn = n;
    ink.drawImage(paperC, 0, 0); ink.drawImage(baseC, 0, 0); inkTex.needsUpdate = true;
  }
  function drawProgress(t) {
    const { ops } = script;
    while (drawn < ops.length && t >= ops[drawn].e) { drawOp(base, ops[drawn], 1); drawn++; }
    ink.drawImage(paperC, 0, 0); ink.drawImage(baseC, 0, 0);
    const op = ops[drawn];
    if (op && t > op.a) drawOp(ink, op, clamp01((t - op.a) / op.dur));
    inkTex.needsUpdate = true;
  }
  function tipAt(t) {
    const { ops, total } = script;
    let i = ops.findIndex(o => t < o.e); if (i < 0) i = ops.length;
    if (i >= ops.length) { const last = ops[ops.length - 1]; return { xy: endPt(last), lift: 0.016 * smooth(clamp01((t - total) / 400)) }; }
    const op = ops[i];
    if (t < op.a) {
      const from = i ? endPt(ops[i - 1]) : startPt(op), to = startPt(op), u = smooth(clamp01((t - op.s) / op.gap));
      return { xy: [from[0] + (to[0] - from[0]) * u, from[1] + (to[1] - from[1]) * u], lift: 0.011 * Math.sin(Math.PI * u) * (i ? 1 : 0) };
    }
    return { xy: tipOf(op)(clamp01((t - op.a) / op.dur)), lift: 0.0006 };
  }
  const hoverAbove = (lift = 0.045) => worldAt(startPt(script.ops[script.first]), lift);

  // Where the pencil lies while it is not writing: on the desk just behind the notebook (the desk ends right at its front edge), clear of the text.
  const restTip = new THREE.Vector3().copy(ORIGIN).addScaledVector(U, -0.03).addScaledVector(V, PH + 0.016).setY(0.7230);
  const qDown = new THREE.Quaternion().setFromUnitVectors(a0, U.clone());
  const written = [false, false];
  let flipDir = 1;
  const fullInk = i => { const c = mkCanvas(), x = c.getContext("2d"); for (const op of buildOps(NOTEBOOK_PAGES[i]).ops) drawOp(x, op, 1); return c; };
  const paintSheet0 = () => { const sc = sheetC.getContext("2d"); paintPaper(sc, false); sc.drawImage(fullInk(0), 0, 0); sheetTex.needsUpdate = true; };
  let nav = null;   // handwritten "page N" and arrow at the foot of the page, drawn in the ink layer once a page is finished
  const showInk = () => {
    ink.drawImage(paperC, 0, 0); ink.drawImage(baseC, 0, 0);
    if (nav) {
      ink.save(); ink.fillStyle = INK; ink.strokeStyle = INK; ink.lineCap = "round"; ink.lineJoin = "round";
      ink.font = fontAt(64); ink.textBaseline = "alphabetic";
      const label = "page " + (nav.page + 1), lw = ink.measureText(label).width, y = CH - 74, cx = CW / 2;
      ink.fillText(label, cx - lw / 2 + (nav.next ? -50 : 50), y);
      const ax = nav.next ? cx + lw / 2 - 10 : cx - lw / 2 - 10 + 20, s = nav.next ? 1 : -1;
      const x0 = nav.next ? ax + 20 : ax - 20, x1 = x0 + s * 96, ym = y - 20;
      ink.lineWidth = 7; ink.beginPath(); ink.moveTo(x0, ym + 3); ink.quadraticCurveTo((x0 + x1) / 2, ym - 7, x1, ym); ink.stroke();
      ink.beginPath(); ink.moveTo(x1 - s * 30, ym - 26); ink.lineTo(x1, ym); ink.lineTo(x1 - s * 28, ym + 22); ink.stroke();
      ink.restore();
      nav.hit = { x: (x0 + x1) / 2, y: ym, rx: 120, ry: 90 };
    }
    inkTex.needsUpdate = true;
  };

  function settle(now) {
    phase = "idle"; startGlide(restTip, qDown, 900, 0.04, now);
    nav = { page, next: page === 0, prev: page === 1 }; showInk();
  }
  function finishPage(now) {
    glide = null;
    for (const op of script.ops.slice(drawn)) drawOp(base, op, 1);
    drawn = script.ops.length; showInk(); written[page] = true;
    settle(now);
  }
  function begin(now) {
    inkMesh.visible = true; pencil.visible = true;
    if (!touched) {   // first visit: start on page 1
      touched = true; resumeT = null;
      written[0] = written[1] = false;
      hingeBase.visible = false; hinge.rotation.y = 0;
      paintStatic(0);
      nav = null;
      phase = "lift"; startGlide(hoverAbove(), qWrite, 900, 0.02, now); t0 = now;
      return;
    }
    // Later visits: what was written stays on the page (until the site is reloaded). A finished page is shown as it is left;
    // an unfinished one carries on from where the pencil stopped.
    if (written[page]) { phase = "idle"; startGlide(restTip, qDown, 900, 0.04, now); return; }
    const at = resumeT != null ? worldAt(tipAt(resumeT).xy, 0.045) : hoverAbove();
    phase = "lift"; startGlide(at, qWrite, 900, 0.02, now); t0 = now;
  }
  function endFlip(now) {   // jump a page turn to its end state
    if (flipDir > 0) {
      hinge.rotation.y = -Math.PI;
      if (written[1]) { paintStatic(1, true); settle(now); }
      else { loadPage(1); resumeT = null; phase = "lift"; startGlide(hoverAbove(), qWrite, 800, 0.02, now); }
    } else { hingeBase.visible = false; hinge.rotation.y = 0; paintStatic(0, true); settle(now); }
  }
  function flipTo(target, now = performance.now()) {
    if (phase !== "idle" || target === page || target < 0 || target > 1) return false;
    nav = null; showInk();
    flipDir = target > page ? 1 : -1;
    paintSheet0(); hingeBase.visible = true; hinge.rotation.y = flipDir > 0 ? 0 : -Math.PI;
    if (flipDir > 0) { ink.drawImage(paperC, 0, 0); if (written[1]) ink.drawImage(fullInk(1), 0, 0); inkTex.needsUpdate = true; }
    phase = "flip"; flipT0 = now;
    sfx?.type("flip");
    return true;
  }
  const api = {
    mesh: pencil,
    pickMeshes: () => [pencil, inkMesh],
    navAt(hit) {
      if (!nav || !nav.hit || hit.object !== inkMesh || !hit.uv) return null;
      const x = hit.uv.x * CW, y = (1 - hit.uv.y) * CH, h = nav.hit;
      if (Math.abs(x - h.x) > h.rx || Math.abs(y - h.y) > h.ry) return null;
      return nav.next ? 1 : 0;
    },
    get playing() { return phase === "lift" || phase === "write"; },
    get shown() { return phase !== "rest"; },
    get page() { return page; },
    start(now = performance.now()) { if (phase === "rest" || phase === "return") begin(now); },
    skip(now = performance.now()) { if (phase === "lift" || phase === "write") finishPage(now); },
    flip: flipTo,
    stop(now = performance.now()) {
      if (phase === "rest" || phase === "return") return;
      if (phase === "flip") endFlip(now);
      if (phase === "write") resumeT = reduced ? script.total + 1 : Math.min(now - t0, script.total + 1);
      glide = null;
      phase = "return"; startGlide(tip0, qRest, 1000, 0.05, now);
    },
    step(now) {
      if (phase === "rest") return;
      if (phase === "return") { if (!stepGlide(now)) phase = "rest"; return; }
      if (phase === "lift") {
        if (!stepGlide(now)) { phase = "write"; t0 = now - (resumeT != null ? resumeT : script.ops[script.first].s); resumeT = null; }
        return;
      }
      if (phase === "write") {
        const t = reduced ? 1e9 : now - t0;
        drawProgress(Math.min(t, script.total + 1));
        const { xy, lift } = tipAt(Math.min(t, script.total + 1));
        worldAt(xy, lift, tip); setPose(tip, qWrite);
        if (t < script.total && now - lastScratch > 85 && lift < 0.002) { lastScratch = now; sfx?.type("pencil"); }
        if (t > script.total + 500) finishPage(now);
        return;
      }
      if (phase === "flip") {
        stepGlide(now);
        const k = clamp01((now - flipT0) / (reduced ? 1 : 1400)), s = smooth(k);
        hinge.rotation.y = -Math.PI * (flipDir > 0 ? s : 1 - s); hingeBase.position.y = 0.7399 + 0.0008 * Math.sin(Math.PI * k);
        if (k >= 1) {
          endFlip(now);
        }
        return;
      }
      if (phase === "idle") stepGlide(now);
    }
  };
  inkMesh.visible = true;
  paintStatic(0);
  document.fonts?.load(fontAt(68)).then(() => { if (phase === "rest" && page === 0 && drawn === script.first) paintStatic(0); });
  return api;
}
