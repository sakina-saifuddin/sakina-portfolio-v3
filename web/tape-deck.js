import * as THREE from "three";

// The VCR slot on the front of the recorder (VCR_DoorFrame in the Blender scene), world coordinates.
const SLOT = { x: -0.095, y: 0.781, z: -2.047 };
const SCALE_IN = 0.72;       // the tapes are wider than the slot, so a tape shrinks a little on its way in
const PITCH = 0.0305;        // distance between two stacked tapes
const KS = [0, 0.2, 0.55, 0.72, 1];
const smooth = x => x * x * (3 - 2 * x);
const clamp01 = x => Math.min(1, Math.max(0, x));

// Splits the tapes out of the merged Room_Tapes mesh into one mesh each (sharing its vertex buffers and lightmap), so each can
// move on its own: out of a stack, along the desk and into the recorder, and back. Tapes above a gap settle down onto the stack.
export function createTapeDeck({ source, tapes, material, reduced, slow = 1, onInsert, onInserted, onEject, onEjected }) {
  source.updateWorldMatrix(true, false);
  const e = source.matrixWorld.elements;
  const g = source.geometry, pos = g.attributes.position, index = g.index.array;
  const boxes = tapes.map(t => t.box.clone().expandByScalar(0.003));
  const all = new THREE.Box3();
  boxes.forEach(b => all.union(b));
  const lists = tapes.map(() => []), keep = [];
  const st = tapes.map(() => ({ n: 0, sx: 0, sz: 0, sxx: 0, szz: 0, sxz: 0 }));
  const p = new THREE.Vector3();
  const world = i => { const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i); return p.set(e[0] * x + e[4] * y + e[8] * z + e[12], e[1] * x + e[5] * y + e[9] * z + e[13], e[2] * x + e[6] * y + e[10] * z + e[14]); };
  const near = all.clone().expandByScalar(0.03);
  // Pieces of one tape (box, label, edges) are separate vertices, so group triangles into connected islands first and
  // move each island whole; assigning triangle by triangle left slivers of a tape behind in the stack.
  const weld = new Map(), parent = [];
  const find = a => { while (parent[a] !== a) { parent[a] = parent[parent[a]]; a = parent[a]; } return a; };
  const wid = i => {
    const key = Math.round(pos.getX(i) * 1e5) + "," + Math.round(pos.getY(i) * 1e5) + "," + Math.round(pos.getZ(i) * 1e5);
    let w = weld.get(key); if (w === undefined) { w = parent.length; parent.push(w); weld.set(key, w); } return w;
  };
  const cand = [];
  for (let t = 0; t < index.length; t += 3) {
    let cx = 0, cy = 0, cz = 0;
    for (let k = 0; k < 3; k++) { const i = index[t + k]; cx += pos.getX(i); cy += pos.getY(i); cz += pos.getZ(i); }
    p.set(cx / 3, cy / 3, cz / 3).applyMatrix4(source.matrixWorld);
    if (near.containsPoint(p)) { cand.push(t); const a = wid(index[t]), b = wid(index[t + 1]), c = wid(index[t + 2]); parent[find(a)] = find(b); parent[find(b)] = find(c); }
  }
  const isl = new Map();
  for (const t of cand) {
    const r = find(wid(index[t]));
    let o = isl.get(r); if (!o) { o = { tris: [], box: new THREE.Box3() }; isl.set(r, o); }
    o.tris.push(t);
    for (let k = 0; k < 3; k++) o.box.expandByPoint(world(index[t + k]));
  }
  const owner = new Map(), ctr = new THREE.Vector3(), sz = new THREE.Vector3();
  for (const o of isl.values()) {
    o.box.getCenter(ctr); o.box.getSize(sz);
    let best = -1, bestM = -Infinity;
    for (let k = 0; k < tapes.length; k++) {
      const b = tapes[k].box, bs = b.getSize(new THREE.Vector3());
      if (sz.x > bs.x + 0.02 || sz.y > bs.y + 0.02 || sz.z > bs.z + 0.02) continue;
      if (!b.clone().expandByScalar(0.006).containsPoint(ctr)) continue;
      const m = Math.min(ctr.y - b.min.y, b.max.y - ctr.y);
      if (m > bestM) { bestM = m; best = k; }
    }
    if (best >= 0) for (const t of o.tris) owner.set(t, best);
  }
  const candSet = new Set(cand);
  for (let t = 0; t < index.length; t += 3) {
    let best = owner.has(t) ? owner.get(t) : -1;
    if (best < 0 && candSet.has(t)) {
      let cx = 0, cy = 0, cz = 0;
      for (let k = 0; k < 3; k++) { const i = index[t + k]; cx += pos.getX(i); cy += pos.getY(i); cz += pos.getZ(i); }
      p.set(cx / 3, cy / 3, cz / 3).applyMatrix4(source.matrixWorld);
      let bestM = -Infinity;
      if (all.containsPoint(p)) {
        for (let k = 0; k < boxes.length; k++) {
          if (!boxes[k].containsPoint(p)) continue;
          const m = Math.min(p.y - tapes[k].box.min.y, tapes[k].box.max.y - p.y);
          if (m > bestM) { bestM = m; best = k; }
        }
      }
    }
    if (best < 0) { keep.push(index[t], index[t + 1], index[t + 2]); continue; }
    lists[best].push(index[t], index[t + 1], index[t + 2]);
    let cx = 0, cz = 0;
    for (let k = 0; k < 3; k++) { world(index[t + k]); cx += p.x; cz += p.z; }
    cx /= 3; cz /= 3;
    const s = st[best]; s.n++; s.sx += cx; s.sz += cz; s.sxx += cx * cx; s.szz += cz * cz; s.sxz += cx * cz;
  }
  g.setIndex(new THREE.BufferAttribute(new Uint32Array(keep), 1));

  const M = source.matrixWorld;
  let root = source; while (root.parent) root = root.parent;
  const parts = tapes.map((t, k) => {
    const c = t.box.getCenter(new THREE.Vector3());
    const s = st[k], mx = s.sx / Math.max(1, s.n), mz = s.sz / Math.max(1, s.n);
    const cxx = s.sxx / Math.max(1, s.n) - mx * mx, czz = s.szz / Math.max(1, s.n) - mz * mz, cxz = s.sxz / Math.max(1, s.n) - mx * mz;
    const theta = 0.5 * Math.atan2(2 * cxz, cxx - czz);
    const gi = new THREE.BufferGeometry();
    for (const name of Object.keys(g.attributes)) gi.setAttribute(name, g.attributes[name]);
    gi.setIndex(new THREE.BufferAttribute(new Uint32Array(lists[k]), 1));
    const mesh = new THREE.Mesh(gi, typeof material === "function" ? material(t.idx) : material);
    mesh.matrixAutoUpdate = false;
    mesh.matrix.copy(M).premultiply(new THREE.Matrix4().makeTranslation(-c.x, -c.y, -c.z));
    mesh.frustumCulled = false; mesh.castShadow = true; mesh.receiveShadow = false;
    mesh.userData.tape = t.idx; mesh.name = "Tape_" + t.object;
    const holder = new THREE.Group();
    holder.position.copy(c); holder.add(mesh);
    root.add(holder);
    return { idx: t.idx, object: t.object, c, theta: Math.abs(theta) < 0.5 ? theta : 0, holder, mesh, present: true, dy: 0, stack: c.x < 0.5 ? 0 : 1, rank: 0 };
  });
  for (const sIdx of [0, 1]) {
    parts.filter(q => q.stack === sIdx).sort((a, b) => b.c.y - a.c.y).forEach((q, r) => { q.rank = r; });
  }

  let job = null, inVcr = -1, target = -1, last = performance.now();

  const pathFor = q => new THREE.CatmullRomCurve3([
    q.c.clone(),
    q.c.clone().add(new THREE.Vector3(0, 0.0, 0.17)),
    new THREE.Vector3(SLOT.x, SLOT.y + 0.07, -1.955),
    new THREE.Vector3(SLOT.x, SLOT.y, -1.985),
    new THREE.Vector3(SLOT.x, SLOT.y, SLOT.z - 0.057)
  ], false, "centripetal");
  const toU = s => {
    for (let k = 0; k < KS.length - 1; k++) if (s <= KS[k + 1]) return (k + (s - KS[k]) / (KS[k + 1] - KS[k])) / (KS.length - 1);
    return 1;
  };
  const place = (q, curve, s) => {
    const u = toU(s);
    q.holder.position.copy(curve.getPoint(u));
    q.holder.rotation.set(0, q.theta * smooth(clamp01((s - 0.15) / 0.4)), 0);
    q.holder.scale.setScalar(1 - (1 - SCALE_IN) * smooth(clamp01((s - 0.3) / 0.42)));
  };

  function advance() {
    if (job || target === inVcr) return;
    if (inVcr >= 0) {
      const q = parts[inVcr];
      q.holder.visible = true; q.present = true;
      onEject?.();
      job = { type: "eject", q, curve: pathFor(q), t0: 0, dur: reduced ? 1 : 1500 * slow };
    } else if (target >= 0) {
      const q = parts[target];
      onInsert?.(q.idx);
      job = { type: "insert", q, curve: pathFor(q), t0: 0, dur: reduced ? 1 : 2000 * slow };
    }
  }

  function step(now) {
    const dt = Math.min(0.1, (now - last) / 1000); last = now;
    advance();
    if (job) {
      if (!job.t0) job.t0 = now;
      const p = clamp01((now - job.t0) / job.dur), q = job.q;
      const sp = smooth(p);
      if (job.type === "insert") {
        place(q, job.curve, sp);
        q.present = sp < 0.2;
        if (p >= 1) { q.holder.visible = false; inVcr = q.idx; job = null; onInserted?.(q.idx); }
      } else {
        place(q, job.curve, 1 - sp);
        q.present = true;
        if (p >= 1) {
          q.holder.position.copy(q.c); q.holder.rotation.set(0, 0, 0); q.holder.scale.setScalar(1);
          const i = q.idx; inVcr = -1; job = null; onEjected?.(i);
        }
      }
    }
    const k = 1 - Math.exp(-dt * 8);
    for (const q of parts) {
      if (job && job.q === q) continue;
      if (q.idx === inVcr) continue;
      let gone = 0;
      for (const o of parts) if (o.stack === q.stack && o.rank > q.rank && !o.present) gone++;
      const want = -PITCH * gone;
      q.dy += (want - q.dy) * (reduced ? 1 : k);
      q.holder.position.set(q.c.x, q.c.y + q.dy, q.c.z);
    }
    for (const q of parts) if (q.idx === inVcr && !job) q.present = false;
  }

  // A tape that is not in the baked mesh: shares the geometry of tape `src` and sits on top of its stack.
  function addClone(src, offset, mat, objectName) {
    const s = parts[src];
    const gi = s.mesh.geometry;
    const mesh = new THREE.Mesh(gi, mat);
    mesh.matrixAutoUpdate = false; mesh.matrix.copy(s.mesh.matrix);
    mesh.frustumCulled = false; mesh.castShadow = true; mesh.receiveShadow = false;
    const idx = parts.length; mesh.userData.tape = idx; mesh.name = "Tape_" + objectName;
    const c = s.c.clone().add(offset);
    const holder = new THREE.Group(); holder.position.copy(c); holder.add(mesh); root.add(holder);
    const q = { idx, object: objectName, c, theta: s.theta, holder, mesh, present: true, dy: 0, stack: s.stack, rank: 0 };
    parts.push(q);
    for (const sIdx of [0, 1]) parts.filter(o => o.stack === sIdx).sort((a, b) => b.c.y - a.c.y).forEach((o, r) => { o.rank = r; });
    return q;
  }
  // inVcr is set while a tape is inside; its stack closes up through present=false
  function select(i) { target = i; }
  function adoptLogo(mesh, name) {
    const q = parts.find(o => name.startsWith(o.object + "_"));
    if (!q) return false;
    mesh.position.copy(q.c).negate();
    q.holder.add(mesh);
    return true;
  }
  return {
    select, step, adoptLogo, addClone,
    get inVcr() { return inVcr; },
    get target() { return target; },
    get busy() { return !!job || target !== inVcr; },
    pickMeshes: () => parts.filter(q => q.holder.visible).map(q => q.mesh),
    parts
  };
}
