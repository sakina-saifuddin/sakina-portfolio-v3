// Games and the screensaver for the portfolio computer. They draw on the 40 x 24 cell screen through `R`
// (R.rect in cells, R.text / R.glyph at a cell position) and never touch the DOM.
// A game object: {title, anyKeyQuits, update(ms), draw(R), key(k), keyUp?(k), status(), pause?()}.

const HI_KEY = "sakina-pc-hi";
const hiGet = (n) => { try { return +(JSON.parse(localStorage.getItem(HI_KEY) || "{}")[n] || 0); } catch { return 0; } };
const hiSet = (n, v) => { try { const d = JSON.parse(localStorage.getItem(HI_KEY) || "{}"); d[n] = v; localStorage.setItem(HI_KEY, JSON.stringify(d)); } catch { /* no storage */ } };
const norm = (k) => (k.length === 1 ? k.toLowerCase() : k);
const center = (R, s, row, color) => R.text(s, Math.floor((40 - s.length) / 2), row, color || R.c.text);
const DIRS = {arrowup: [0, -1], arrowdown: [0, 1], arrowleft: [-1, 0], arrowright: [1, 0], w: [0, -1], s: [0, 1], a: [-1, 0], d: [1, 0]};
const dirOf = (k) => DIRS[norm(k).toLowerCase()];

// ---------------------------------------------------------------- SNAKE
export function makeSnake({beep}) {
  const NAME = "SNAKE";
  let st = "title", snake = [], dir = [1, 0], nextDir = [1, 0], food = {x: 10, y: 10}, score = 0, hi = hiGet(NAME), acc = 0, step = 115, eaten = 0, clock = 0;
  const place = () => {
    do { food = {x: 1 + Math.floor(Math.random() * 38), y: 1 + Math.floor(Math.random() * 22)}; }
    while (snake.some((s) => s.x === food.x && s.y === food.y));
  };
  const start = () => {
    snake = [{x: 20, y: 12}, {x: 19, y: 12}, {x: 18, y: 12}];
    dir = nextDir = [1, 0]; score = 0; eaten = 0; step = 115; acc = 0; place(); st = "play";
  };
  const tick = () => {
    dir = nextDir;
    const h = {x: snake[0].x + dir[0], y: snake[0].y + dir[1]};
    if (h.x < 1 || h.x > 38 || h.y < 1 || h.y > 22 || snake.some((s) => s.x === h.x && s.y === h.y)) {
      st = "over";
      if (score > hi) { hi = score; hiSet(NAME, hi); }
      beep("over");
      return;
    }
    snake.unshift(h);
    if (h.x === food.x && h.y === food.y) {
      score += 10; eaten++;
      if (eaten % 4 === 0) step = Math.max(55, step - 8);
      beep("eat"); place();
    } else snake.pop();
  };
  return {
    title: NAME,
    update(ms) { clock += ms; if (st !== "play") return; acc += ms; while (acc >= step && st === "play") { acc -= step; tick(); } },
    key(k) {
      const v = dirOf(k), n = norm(k);
      if (st === "title" || st === "over") { if (k === " " || k === "Enter" || n === "r") start(); return true; }
      if (n === "p") { st = st === "play" ? "paused" : "play"; return true; }
      if (st === "paused") { st = "play"; return true; }
      if (v && !(v[0] === -dir[0] && v[1] === -dir[1])) nextDir = v;
      return true;
    },
    pause() { if (st === "play") st = "paused"; },
    status() { return `SNAKE  SCORE ${score}  HI ${hi}  P PAUSE  Q QUIT`; },
    draw(R) {
      for (let x = 0; x < 40; x++) { R.rect(x, 0, 1, 1, R.c.dim, 1); R.rect(x, 23, 1, 1, R.c.dim, 1); }
      for (let y = 1; y < 23; y++) { R.rect(0, y, 1, 1, R.c.dim, 1); R.rect(39, y, 1, 1, R.c.dim, 1); }
      if (st === "title") {
        center(R, "S N A K E", 7, R.c.hi);
        center(R, "ARROWS OR WASD TO STEER", 10);
        center(R, "EAT THE FOOD, DO NOT HIT THE WALLS", 12);
        center(R, "OR YOURSELF", 13);
        center(R, "PRESS SPACE TO START", 16, R.c.hi);
        center(R, "HIGH SCORE " + hi, 19);
        return;
      }
      snake.forEach((s, i) => R.rect(s.x, s.y, 1, 1, i === 0 ? R.c.hi : R.c.text, 1));
      if (Math.floor(clock / 220) % 2 === 0 || st !== "play") R.rect(food.x, food.y, 1, 1, R.c.hi, 3);
      else R.rect(food.x, food.y, 1, 1, R.c.text, 4);
      if (st === "over") { R.rect(9, 9, 22, 6, "#031208"); center(R, "GAME OVER", 10, R.c.hi); center(R, "SCORE " + score, 12); center(R, "SPACE TO PLAY AGAIN", 13); }
      if (st === "paused") { R.rect(12, 10, 16, 3, "#031208"); center(R, "PAUSED", 11, R.c.hi); }
    }
  };
}

// ---------------------------------------------------------------- BLOCKS (falling blocks)
const SHAPES = {
  I: [[-1, 0], [0, 0], [1, 0], [2, 0]], J: [[-1, -1], [-1, 0], [0, 0], [1, 0]], L: [[1, -1], [-1, 0], [0, 0], [1, 0]],
  O: [[0, 0], [1, 0], [0, 1], [1, 1]], S: [[0, 0], [1, 0], [-1, 1], [0, 1]], T: [[0, -1], [-1, 0], [0, 0], [1, 0]], Z: [[-1, 0], [0, 0], [0, 1], [1, 1]]
};
const KINDS = Object.keys(SHAPES);

export function makeBlocks({beep}) {
  const NAME = "BLOCKS", WX = 15, WY = 2;
  let st = "title", board = [], piece = null, next = "T", score = 0, lines = 0, level = 1, acc = 0, hi = hiGet(NAME);
  const fresh = () => Array.from({length: 20}, () => Array(10).fill(0));
  const bag = [];
  const draw7 = () => { if (!bag.length) bag.push(...KINDS.slice().sort(() => Math.random() - 0.5)); return bag.pop(); };
  const ok = (cells, x, y) => cells.every(([cx, cy]) => { const px = x + cx, py = y + cy; return px >= 0 && px < 10 && py < 20 && (py < 0 || !board[py][px]); });
  const spawn = () => {
    const t = next; next = draw7();
    piece = {t, cells: SHAPES[t].map((c) => c.slice()), x: 4, y: 1};
    if (!ok(piece.cells, piece.x, piece.y)) { st = "over"; if (score > hi) { hi = score; hiSet(NAME, hi); } beep("over"); }
  };
  const start = () => { board = fresh(); score = 0; lines = 0; level = 1; acc = 0; next = draw7(); st = "play"; spawn(); };
  const lock = () => {
    const col = KINDS.indexOf(piece.t) + 1;
    piece.cells.forEach(([cx, cy]) => { const py = piece.y + cy; if (py >= 0) board[py][piece.x + cx] = col; });
    let n = 0;
    for (let y = 19; y >= 0; y--) if (board[y].every(Boolean)) { board.splice(y, 1); board.unshift(Array(10).fill(0)); n++; y++; }
    if (n) { score += [0, 100, 300, 500, 800][n] * level; lines += n; level = 1 + Math.floor(lines / 10); beep("line"); }
    if (score > hi) { hi = score; hiSet(NAME, hi); }
    spawn();
  };
  const move = (dx, dy) => { if (ok(piece.cells, piece.x + dx, piece.y + dy)) { piece.x += dx; piece.y += dy; return true; } return false; };
  const turn = () => {
    if (piece.t === "O") return;
    const r = piece.cells.map(([x, y]) => [-y, x]);
    for (const [kx, ky] of [[0, 0], [-1, 0], [1, 0], [-2, 0], [2, 0], [0, -1]]) {
      if (ok(r, piece.x + kx, piece.y + ky)) { piece.cells = r; piece.x += kx; piece.y += ky; return; }
    }
  };
  const interval = () => Math.max(70, 650 - (level - 1) * 55);
  const PAL = ["#eaffe3", "#9ef58a", "#6fd65f", "#bff5b0", "#59c94f", "#d6ffc8", "#86e07a"];
  const cell = (R, col, row, ci) => R.rect(col, row, 1, 1, PAL[ci], 1);
  return {
    title: NAME,
    update(ms) { if (st !== "play") return; acc += ms; while (acc >= interval() && st === "play") { acc -= interval(); if (!move(0, 1)) lock(); } },
    key(k) {
      const n = norm(k);
      if (st === "title" || st === "over") { if (k === " " || k === "Enter" || n === "r") start(); return true; }
      if (n === "p") { st = st === "play" ? "paused" : "play"; return true; }
      if (st === "paused") { st = "play"; return true; }
      if (k === "ArrowLeft" || n === "a") move(-1, 0);
      else if (k === "ArrowRight" || n === "d") move(1, 0);
      else if (k === "ArrowDown" || n === "s") { if (move(0, 1)) score += 1; acc = 0; }
      else if (k === "ArrowUp" || n === "w") turn();
      else if (k === " ") { let d = 0; while (move(0, 1)) d++; score += 2 * d; beep("drop"); lock(); acc = 0; }
      return true;
    },
    pause() { if (st === "play") st = "paused"; },
    status() { return `BLOCKS  SCORE ${score}  HI ${hi}  P PAUSE  Q QUIT`; },
    draw(R) {
      for (let y = 0; y < 21; y++) { R.rect(WX - 1, WY + y, 1, 1, R.c.dim, 1); R.rect(WX + 10, WY + y, 1, 1, R.c.dim, 1); }
      for (let x = 0; x < 10; x++) R.rect(WX + x, WY + 20, 1, 1, R.c.dim, 1);
      R.text("SCORE", 2, 4, R.c.hi); R.text(String(score), 2, 5);
      R.text("LINES", 2, 7, R.c.hi); R.text(String(lines), 2, 8);
      R.text("LEVEL", 2, 10, R.c.hi); R.text(String(level), 2, 11);
      R.text("HIGH", 2, 13, R.c.hi); R.text(String(hi), 2, 14);
      R.text("NEXT", 28, 4, R.c.hi);
      SHAPES[next].forEach(([cx, cy]) => cell(R, 29 + cx, 7 + cy, KINDS.indexOf(next)));
      ["< >  MOVE", "UP   TURN", "DOWN SOFT", "SPACE DROP", "P    PAUSE"].forEach((t, i) => R.text(t, 27, 13 + i, R.c.dim));
      if (st === "title") {
        R.rect(WX, WY + 5, 10, 8, "#031208");
        R.text("B L O C K S", WX - 0.2, WY + 6, R.c.hi);
        R.text("SPACE", WX + 2.5, WY + 9);
        R.text("TO START", WX + 1.5, WY + 10);
        return;
      }
      board.forEach((r, y) => r.forEach((v, x) => { if (v) cell(R, WX + x, WY + y, v - 1); }));
      if (piece && st !== "over") piece.cells.forEach(([cx, cy]) => { if (piece.y + cy >= 0) cell(R, WX + piece.x + cx, WY + piece.y + cy, KINDS.indexOf(piece.t)); });
      if (st === "over") { R.rect(WX, WY + 6, 10, 6, "#031208"); R.text("GAME OVER", WX + 0.5, WY + 7, R.c.hi); R.text("SPACE: AGAIN", WX - 0.2, WY + 9); }
      if (st === "paused") { R.rect(WX, WY + 8, 10, 3, "#031208"); R.text("PAUSED", WX + 2, WY + 9, R.c.hi); }
    }
  };
}

// ---------------------------------------------------------------- ZOMBIE (top-down survival)
export function makeZombie({beep}) {
  const NAME = "ZOMBIE", CW = 17.5, CHh = 21, PW = 40 * CW, PH = 24 * CHh;
  let st = "title", p, face, zs, bs, score, elapsed, spawnT, shootT, hi = hiGet(NAME);
  const held = new Set();
  const start = () => {
    p = {x: PW / 2, y: PH / 2}; face = [1, 0]; zs = []; bs = []; score = 0; elapsed = 0; spawnT = 0.6; shootT = 0; st = "play";
  };
  const spawnZ = () => {
    const side = Math.floor(Math.random() * 4);
    const z = side === 0 ? {x: Math.random() * PW, y: -10} : side === 1 ? {x: Math.random() * PW, y: PH + 10} : side === 2 ? {x: -10, y: Math.random() * PH} : {x: PW + 10, y: Math.random() * PH};
    zs.push(z);
  };
  const dirKeys = () => {
    let dx = 0, dy = 0;
    for (const k of held) { const v = dirOf(k); if (v) { dx += v[0]; dy += v[1]; } }
    return [Math.sign(dx), Math.sign(dy)];
  };
  return {
    title: NAME,
    update(ms) {
      if (st !== "play") return;
      const s = Math.min(0.05, ms / 1000);
      elapsed += s;
      const [dx, dy] = dirKeys();
      if (dx || dy) {
        const n = Math.hypot(dx, dy);
        p.x = Math.min(PW - 8, Math.max(8, p.x + dx / n * 170 * s));
        p.y = Math.min(PH - 8, Math.max(8, p.y + dy / n * 170 * s));
        face = [dx / n, dy / n];
      }
      shootT -= s;
      if (held.has(" ") && shootT <= 0) { shootT = 0.17; bs.push({x: p.x, y: p.y, vx: face[0] * 430, vy: face[1] * 430}); beep("shoot"); }
      spawnT -= s;
      if (spawnT <= 0 && zs.length < 60) { spawnZ(); spawnT = Math.max(0.3, 1.5 - elapsed * 0.02); }
      const zsp = Math.min(100, 36 + elapsed * 0.9);
      for (const z of zs) {
        const ax = p.x - z.x, ay = p.y - z.y, d = Math.hypot(ax, ay) || 1;
        z.x += ax / d * zsp * s; z.y += ay / d * zsp * s;
      }
      for (const b of bs) { b.x += b.vx * s; b.y += b.vy * s; }
      bs = bs.filter((b) => b.x > -10 && b.x < PW + 10 && b.y > -10 && b.y < PH + 10);
      for (const b of bs) {
        const i = zs.findIndex((z) => Math.hypot(z.x - b.x, z.y - b.y) < 11);
        if (i >= 0) { zs.splice(i, 1); b.dead = true; score += 10; beep("hit"); }
      }
      bs = bs.filter((b) => !b.dead);
      if (zs.some((z) => Math.hypot(z.x - p.x, z.y - p.y) < 13)) {
        st = "over"; held.clear();
        if (score > hi) { hi = score; hiSet(NAME, hi); }
        beep("over");
      }
    },
    key(k) {
      const n = norm(k);
      if (st === "title" || st === "over") { if (k === " " || k === "Enter" || n === "r") { held.clear(); start(); } return true; }
      if (n === "p") { st = st === "play" ? "paused" : "play"; held.clear(); return true; }
      if (st === "paused") { st = "play"; return true; }
      held.add(dirOf(k) ? n : k === " " ? " " : n);
      return true;
    },
    keyUp(k) { held.delete(norm(k) === " " ? " " : norm(k)); },
    releaseKeys() { held.clear(); },
    pause() { if (st === "play") { st = "paused"; held.clear(); } },
    status() { return `ZOMBIE  SCORE ${score}  HI ${hi}  P PAUSE  Q QUIT`; },
    draw(R) {
      if (st === "title") {
        center(R, "Z O M B I E", 6, R.c.hi);
        center(R, "ARROWS OR WASD TO MOVE", 9);
        center(R, "HOLD SPACE TO SHOOT", 11);
        center(R, "THEY KEEP COMING. LAST AS LONG", 13);
        center(R, "AS YOU CAN.", 14);
        center(R, "PRESS SPACE TO START", 17, R.c.hi);
        center(R, "HIGH SCORE " + hi, 20);
        return;
      }
      bs.forEach((b) => R.rect(b.x / CW - 0.12, b.y / CHh - 0.1, 0.25, 0.2, R.c.hi));
      zs.forEach((z) => R.glyph("Z", z.x / CW - 0.5, z.y / CHh - 0.5, R.c.dim));
      R.glyph("@", p.x / CW - 0.5, p.y / CHh - 0.5, R.c.hi);
      if (st === "over") { R.rect(9, 9, 22, 6, "#031208"); center(R, "THEY GOT YOU", 10, R.c.hi); center(R, "SCORE " + score, 12); center(R, "SPACE TO TRY AGAIN", 13); }
      if (st === "paused") { R.rect(12, 10, 16, 3, "#031208"); center(R, "PAUSED", 11, R.c.hi); }
    }
  };
}

// ---------------------------------------------------------------- DEMO (the screensaver)
export function makeDemo() {
  const label = "SAKINA SAIFUDDIN";
  const row = () => { let s = ""; for (let i = 0; i < 40; i++) s += Math.random() < 0.5 ? "/" : "\\"; return s; };
  let rows = Array.from({length: 24}, row), acc = 0, bx = 60, by = 80, vx = 120, vy = 78, flash = 0;
  const LW = (label.length + 2) * 17.5, LH = 21;
  return {
    title: "DEMO",
    anyKeyQuits: true,
    update(ms) {
      acc += ms;
      while (acc >= 90) { acc -= 90; rows.shift(); rows.push(row()); }
      const s = Math.min(0.05, ms / 1000);
      bx += vx * s; by += vy * s;
      if (bx < 0) { bx = 0; vx = Math.abs(vx); flash = 1; }
      if (bx > 700 - LW) { bx = 700 - LW; vx = -Math.abs(vx); flash = 1; }
      if (by < 0) { by = 0; vy = Math.abs(vy); flash = 1; }
      if (by > 504 - LH) { by = 504 - LH; vy = -Math.abs(vy); flash = 1; }
      flash = Math.max(0, flash - s * 2.5);
    },
    key() { return true; },
    status() { return "DEMO  PRESS ANY KEY TO STOP"; },
    draw(R) {
      rows.forEach((r, i) => R.text(r, 0, i, R.c.faint));
      R.rect(bx / 17.5, by / 21, label.length + 2, 1, flash > 0.1 ? R.c.hi : R.c.bar);
      R.text(label, bx / 17.5 + 1, by / 21, R.c.dark);
    }
  };
}

export const GAMES = {SNAKE: makeSnake, BLOCKS: makeBlocks, ZOMBIE: makeZombie, DEMO: makeDemo};
