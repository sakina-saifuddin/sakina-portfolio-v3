import * as THREE from "three";
import {BOOT, BAR, BBS, PROGRAMS, commands} from "./ibm-content.js";
import {Basic} from "./basic.js";
import {GAMES} from "./ibm-games.js?v=1";

// A 40 x 25 text screen like the reference computer: 24 text rows plus a function-key row.
// The visitor types. Nothing runs by itself after the boot message.
const W = 800, H = 600;            // layout units
const S = 1.6;                      // canvas pixels per layout unit (1280 x 960): sharp text
const PXW = W * S, PXH = H * S;
const COLS = 40, ROWS = 25, TROWS = ROWS - 1;
const GX = 50, GY = 37.5, GW = 700, GH = 525;
const CH = GH / ROWS;
const SIZE = 23;
const FONT = `${SIZE}px VT323, "DejaVu Sans Mono", monospace`;
const TEXT = "#9ef58a", HI = "#eaffe3", DARK = "#04140a", BARC = "#bff5b0", DIM = "#52b04c", FAINT = "#2c6a2e", SHADOW = "rgba(158,245,138,.5)";
const SCREEN_KEY = "sakina-pc-screen";
const IDLE_MS = 120000;
const CPS = 260;
const MAXIN = 74;
const DISK = "sakina-pc-disk";

const style = document.createElement("style");
style.textContent = "html.ibm-view #grain{opacity:0!important}";
document.head.append(style);

const vis = (s) => s.replace(/[\u0001\u0002]/g, "");

// 5 x 7 block letters for the big banner on the ONLINE screen
const GLYPH = {
  S: ["01111", "10000", "10000", "01110", "00001", "00001", "11110"],
  A: ["01110", "10001", "10001", "11111", "10001", "10001", "10001"],
  K: ["10001", "10010", "10100", "11000", "10100", "10010", "10001"],
  I: ["11111", "00100", "00100", "00100", "00100", "00100", "11111"],
  N: ["10001", "11001", "10101", "10011", "10001", "10001", "10001"],
  O: ["01110", "10001", "10001", "10001", "10001", "10001", "01110"],
  P: ["11110", "10001", "10001", "11110", "10000", "10000", "10000"],
  T: ["11111", "00100", "00100", "00100", "00100", "00100", "00100"]
};

const readDisk = () => { try { return JSON.parse(localStorage.getItem(DISK) || "{}"); } catch { return {}; } };
const writeDisk = (d) => { try { localStorage.setItem(DISK, JSON.stringify(d)); return true; } catch { return false; } };

export function makeIbmTerminal({scene, position, size, rotationY = Math.PI / 2, onOpenLink, onType, onExit, onDebug, onOption}) {
  const cv = document.createElement("canvas");
  cv.width = PXW; cv.height = PXH;
  const g = cv.getContext("2d");
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 16;
  try { document.fonts?.load(FONT); } catch { /* the fallback font is used until VT323 arrives */ }

  let retro = 0;
  try { retro = localStorage.getItem(SCREEN_KEY) === "retro" ? 1 : 0; } catch { /* default: sharp */ }
  const u = {uMap: {value: tex}, uTime: {value: 0}, uOff: {value: 0}, uRetro: {value: retro}, uSize: {value: new THREE.Vector2(size[0], size[1])}};
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(size[0], size[1]),
    new THREE.ShaderMaterial({
      uniforms: u,
      vertexShader: "varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}",
      fragmentShader: `uniform sampler2D uMap;uniform float uTime;uniform float uOff;uniform float uRetro;uniform vec2 uSize;varying vec2 vUv;
        float ease(float x){return x<.5?2.*x*x:1.-pow(-2.*x+2.,2.)/2.;}
        void main(){
          vec2 q=vUv-0.5;
          float e1=ease(clamp(uOff/.55,0.,1.)),e2=ease(clamp((uOff-.55)/.25,0.,1.)),fade=clamp((uOff-.8)/.2,0.,1.);
          float hh=mix(.5,.004,e1),hw=mix(.5,.014,e2);
          float inside=smoothstep(hw+.012,hw-.004,abs(q.x))*smoothstep(hh+.006,hh-.002,abs(q.y));
          vec2 uv=vec2(q.x,q.y*(.5/max(hh,.02)))+.5;
          vec3 col=texture2D(uMap,uv).rgb;
          vec3 blur=texture2D(uMap,uv+vec2(0.0016,0.0)).rgb*0.5+texture2D(uMap,uv-vec2(0.0016,0.0)).rgb*0.5;
          col=mix(col,blur,0.3*uRetro);
          float lines=mix(1.0,0.86+0.14*sin(vUv.y*${H}.0*3.14159),uRetro);
          float vig=1.0-mix(0.10,0.4,uRetro)*smoothstep(0.3,1.1,dot(q,q)*1.9);
          float flick=mix(1.0,0.985+0.015*sin(uTime*47.0),uRetro);
          vec3 pic=col*lines*vig*flick*1.22;
          float glow=e1*e1*e1;
          pic=pic*(1.0+3.0*glow)+vec3(0.55,0.85,0.65)*glow*(1.0-e2*0.15);
          pic*=1.0-fade;
          vec3 glass=vec3(0.004,0.010,0.006);
          float sheen=smoothstep(0.0,0.75,dot(q,vec2(-0.62,0.78))+0.18)*0.05;
          vec3 outc=mix(glass,pic,inside)+vec3(0.55,0.72,0.62)*sheen*(0.4+0.6*(1.0-inside));
          vec2 p=q*uSize;vec2 hb=uSize*0.5-vec2(0.014);
          vec2 dd=abs(p)-hb;float d=length(max(dd,0.0))+min(max(dd.x,dd.y),0.0)-0.014;
          gl_FragColor=vec4(outc,smoothstep(0.0014,-0.0014,d));
        }`,
      transparent: true, depthWrite: false
    })
  );
  mesh.rotation.y = rotationY;
  mesh.position.set(...position);
  mesh.renderOrder = 2;
  mesh.name = "IbmScreen";
  scene.add(mesh);

  const PAGE = TROWS - 3;

  const st = {
    active: false, booted: false, mode: "basic",
    out: [], partial: "", pending: [], cur: "", curFull: null, input: "",
    powerDir: 0, off: 0, pauseUntil: 0, last: 0, scrollBack: 0, skip: false, waiting: false, count: 0, paged: false,
    macro: null, prog: new Map(), running: false, asking: false, flash: null, bar: [], hot: [], game: null, menu: null, lastInput: 0, idleAt: 0
  };

  // ---- text output ----
  const write = (s) => {
    for (const ch of s) {
      if (ch === "\n") { st.out.push(st.partial); st.partial = ""; }
      else { st.partial += ch; if (st.partial.length >= COLS) { st.out.push(st.partial); st.partial = ""; } }
    }
    if (st.out.length > 600) st.out.splice(0, st.out.length - 600);
  };
  const basic = new Basic({
    write,
    cls: () => { st.out = []; st.partial = ""; st.scrollBack = 0; },
    beep: () => onType?.("enter")
  });

  const wrap = (text) => {
    if (vis(text).length <= COLS) return [text];
    const lead = text.match(/^ */)[0];
    const words = text.trim().split(/\s+/);
    const out = [];
    let line = lead;
    for (const w of words) {
      const test = line.trim() ? line + " " + w : line + w;
      if (test.length > COLS && line.trim()) { out.push(line); line = lead + w; } else line = test;
    }
    out.push(line);
    return out;
  };

  const flushPending = () => {
    if (st.curFull !== null) { st.out.push(st.curFull); st.cur = ""; st.curFull = null; }
    while (st.pending.length) st.out.push(st.pending.shift());
    st.waiting = false; st.skip = false;
  };

  const reset = (now) => {
    basic.stop();
    st.out = []; st.partial = ""; st.cur = ""; st.curFull = null; st.input = ""; st.scrollBack = 0; st.skip = false;
    st.pending = []; st.macro = null; st.sendWhenReady = false; st.running = false; st.asking = false; st.mode = "basic"; st.flash = null; st.game = null; st.menu = null;
    st.prog = new Map(); basic.trace = false;
    BOOT.forEach((l) => wrap(l).forEach((x) => st.pending.push(x)));
    st.pending.push("");
    st.pending.push("READY");
    st.waiting = false; st.count = 0; st.paged = false;
    st.last = now; st.pauseUntil = now + 250;
  };

  // typed out slowly, a page at a time
  const queueLines = (lines, tail = true) => {
    st.paged = true; st.count = 0;
    lines.forEach((l) => wrap(l).forEach((x) => st.pending.push(x)));
    if (tail) { st.pending.push(""); st.pending.push("READY"); } else st.pending.push("READY");
  };

  // ---- the program in memory ----
  const sortedProg = () => [...st.prog.entries()].sort((a, b) => a[0] - b[0]);
  const loadProgram = (lines) => {
    st.prog = new Map();
    for (const l of lines) { const m = /^(\d+)\s?(.*)$/.exec(l); if (m) st.prog.set(+m[1], m[2]); }
  };
  const startProgram = () => {
    basic.setProgram(sortedProg());
    basic.run();
    st.running = basic.state === "running";
    if (!st.running) write("READY\n");
  };
  const endProgram = () => {
    if (st.partial) write("\n");
    write("READY\n");
    st.running = false; st.asking = false; basic.state = "idle";
  };
  const breakProgram = () => {
    if (!st.running) return;
    const n = basic.stop();
    if (st.partial) write("\n");
    write("Break" + (n ? " in " + n : "") + "\n");
    st.input = "";
    endProgram();
  };

  const parseRange = (s) => {
    const m = /^\s*(\d+)?\s*(-)?\s*(\d+)?\s*$/.exec(s || "");
    if (!m) return null;
    const a = m[1] ? +m[1] : 0, b = m[2] ? (m[3] ? +m[3] : Infinity) : (m[1] ? +m[1] : Infinity);
    return [a, b];
  };

  // ---- commands ----
  const execute = (text) => {
    const t = text.trim();
    if (!t) return;
    const num = /^(\d+)\s?(.*)$/.exec(t);
    if (num) {
      if (num[2].trim() === "") st.prog.delete(+num[1]); else st.prog.set(+num[1], num[2]);
      return;
    }
    const word = (t.match(/^[A-Za-z]+/) || [""])[0].toUpperCase();
    const rest = t.slice(word.length).trim();

    if (word === "CLS" || word === "CLEAR") { st.out = []; st.partial = ""; st.scrollBack = 0; return; }
    if (word === "SYSTEM") { write("Bye.\n"); onExit?.(); write("READY\n"); return; }
    if (word === "NEW") { st.prog = new Map(); write("READY\n"); return; }
    if (word === "TRON") { basic.trace = true; write("READY\n"); return; }
    if (word === "TROFF") { basic.trace = false; write("READY\n"); return; }
    if (word === "FILES") {
      const names = Object.keys(PROGRAMS);
      const mine = Object.keys(readDisk()).filter((n) => !names.includes(n));
      const all = names.concat(mine);
      queueLines(all.map((n) => n.padEnd(8) + ".BAS"), false);
      st.pending.splice(st.pending.length - 1, 0, "", all.length + " File(s)   61440 bytes free");
      return;
    }
    if (word === "LIST") {
      const r = parseRange(rest);
      const rows = sortedProg().filter(([n]) => !r || (n >= r[0] && n <= r[1])).map(([n, x]) => n + " " + x);
      if (!rows.length) { write("READY\n"); return; }
      queueLines(rows, false);
      return;
    }
    if (word === "EDIT") {
      const n = parseInt(rest, 10);
      if (!st.prog.has(n)) { write("Undefined line " + (rest || "?") + "\nREADY\n"); return; }
      st.input = n + " " + st.prog.get(n);
      return;
    }
    if (word === "DELETE") {
      const r = parseRange(rest);
      if (!r || !rest) { write("Syntax error\nREADY\n"); return; }
      for (const [n] of sortedProg()) if (n >= r[0] && n <= r[1]) st.prog.delete(n);
      write("READY\n");
      return;
    }
    if (word === "SAVE") {
      const name = (rest.replace(/"/g, "").trim() || "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8);
      if (!name) { write('Syntax error. Try SAVE "NAME".\nREADY\n'); return; }
      if (!st.prog.size) { write("Nothing to save.\nREADY\n"); return; }
      const d = readDisk();
      d[name] = sortedProg().map(([n, x]) => n + " " + x);
      write((writeDisk(d) ? "Saved " + name + ".BAS" : "Disk error") + "\nREADY\n");
      return;
    }
    if (word === "RUN") {
      const name = rest.replace(/"/g, "").trim().toUpperCase();
      if (name) {
        const lines = readDisk()[name] || PROGRAMS[name];
        if (!lines) { write("File not found\nREADY\n"); return; }
        loadProgram(lines);
      }
      if (!st.prog.size) { write('Nothing to run. Try RUN "HELLO".\nREADY\n'); return; }
      startProgram();
      return;
    }
    if (word === "ONLINE" || word === "CONTACT") { openMenu("online"); return; }
    if (word === "OPTIONS") { openMenu("options"); return; }
    if (GAMES[word]) { startGame(word); return; }
    if (word === "DEBUG") { write("Flying. Press Esc to land.\n"); onDebug?.(); write("READY\n"); return; }

    const c = rest === "" || /^(ME|MORE)$/i.test(rest) ? commands[word] : null;
    if (c && !c.online) {
      queueLines(c.lines);
      if (c.href) onOpenLink(c.href);
      return;
    }

    // anything else is a BASIC statement typed straight in, like  PRINT 2+2
    const msg = basic.direct(t);
    if (st.partial) write("\n");
    if (msg) write(msg === "Syntax error" ? "Syntax error. Type HELP.\n" : msg + "\n");
    write("READY\n");
  };

  const submit = () => {
    const t = st.input;
    st.input = "";
    st.scrollBack = 0;
    write(t + "\n");
    if (st.asking) {
      basic.provide(t);
      st.asking = basic.state === "input";
      return;
    }
    execute(t);
  };

  // a click or an F-key types the command for the visitor, then presses Enter
  const typeCmd = (text, submitIt = true) => {
    if (st.mode !== "basic") return;
    if (st.running) breakProgram();
    flushPending();
    st.input = "";
    st.scrollBack = 0;
    st.macro = {text, i: 0, next: performance.now() + 120, submit: submitIt, done: false};
  };
  const choose = (cmd) => {
    if (cmd === "RUN" && !st.prog.size) typeCmd('RUN "', false);
    else typeCmd(cmd);
  };

  const flash = (text, now) => { st.flash = {text, until: now + 1800}; };
  const screenState = () => (retro ? "RETRO  scanlines and glow (press to switch)" : "SHARP  clean and crisp (press to switch)");
  const MENUS = {
    online: {
      title: "SAKINA BBS", sub: "Links", banner: BBS.banner, tagline: BBS.tagline, intro: BBS.intro, prompt: BBS.prompt, bottom: BBS.bottom,
      exit: "NO CARRIER\n\nREADY\n",
      items: BBS.links.map((l) => ({label: l.label, text: () => l.shown, act: (now) => { flash("Opening " + l.label + "...", now); onOpenLink(l.href); }}))
    },
    options: {
      title: "SAKINA PC", sub: "Options", banner: "OPTIONS", tagline: "other versions of things", intro: "Choose one:",
      prompt: "Press 1-4 or click a line to change it. Q goes back.", bottom: "1-4 choose  Q back", exit: "READY\n",
      items: [
        {label: "Lo-fi", text: () => "the plain website I built before this one", act: () => { onOption?.("lofi", true); }},
        {label: "Ask me", text: () => "chat about my resume (new tab)", act: (now) => { flash("Opening Ask Sakina...", now); onOpenLink("https://askksakina.netlify.app"); }},
        {label: "Screen", text: screenState, act: (now) => {
          retro = retro ? 0 : 1; u.uRetro.value = retro;
          try { localStorage.setItem(SCREEN_KEY, retro ? "retro" : "sharp"); } catch { /* not saved */ }
          flash("Screen: " + (retro ? "retro" : "sharp"), now);
        }},
        {label: "Sound", text: () => (onOption?.("sound", false) || "off") + "  (press to switch)", act: (now) => { flash("Sound: " + (onOption?.("sound", true) || ""), now); }}
      ]
    }
  };
  const openMenu = (key) => { st.mode = "menu"; st.menu = key; st.flash = null; };
  const closeMenu = () => { const m = MENUS[st.menu]; st.mode = "basic"; st.menu = null; st.flash = null; write(m ? m.exit : "READY\n"); };

  const startGame = (name) => {
    st.game = GAMES[name]({beep: (k) => onType?.(k === "eat" || k === "line" || k === "hit" || k === "over" ? "enter" : "key")});
    st.mode = "game";
  };
  const quitGame = () => {
    const g0 = st.game;
    st.game = null; st.mode = "basic";
    if (st.partial) write("\n");
    write("READY\n");
    st.idleAt = performance.now();
    return g0;
  };

  // ---- per-frame logic ----
  const step = (now) => {
    const dt = Math.min(100, now - st.last);
    st.last = now;
    if (st.flash && now > st.flash.until) st.flash = null;
    if (st.mode === "game") { st.game.update(dt, now); return; }
    if (st.mode === "basic" && st.active && !st.macro && !st.running && !st.pending.length && st.curFull === null && !st.input
        && now - Math.max(st.lastInput, st.idleAt) > IDLE_MS) { startGame("DEMO"); return; }

    if (st.macro) {
      const m = st.macro;
      if (now >= m.next) {
        if (m.i < m.text.length) { st.input += m.text[m.i++]; onType?.("key"); m.next = now + 60 + ((now * 7) % 40); }
        else if (!m.done) { m.done = true; m.next = now + 260; if (!m.submit) st.macro = null; }
        else { st.macro = null; onType?.("enter"); submit(); }
      }
      return;
    }

    if (st.running) {
      if (basic.state === "running") basic.step(300);
      if (basic.state === "input") st.asking = true;
      else if (basic.state !== "running") endProgram();
      return;
    }

    if (now < st.pauseUntil || st.waiting) return;
    if (st.curFull === null && st.pending.length) { st.curFull = st.pending.shift(); st.cur = ""; }
    if (st.curFull !== null) {
      const n = st.skip ? st.curFull.length : Math.max(1, Math.round(dt * CPS / 1000));
      const before = st.cur.length;
      st.cur = st.curFull.slice(0, st.cur.length + n);
      if (st.cur.length > before) onType?.("out");
      if (st.cur.length >= st.curFull.length) {
        st.out.push(st.curFull); st.cur = ""; st.curFull = null;
        if (st.out.length > 600) st.out.splice(0, st.out.length - 600);
        if (st.paged && ++st.count >= PAGE && st.pending.length > 2) { st.waiting = true; st.skip = false; }
        if (!st.skip) st.pauseUntil = now + (st.out[st.out.length - 1] === "" ? 160 : 45);
      }
    } else {
      st.skip = false;
      if (st.sendWhenReady) { st.sendWhenReady = false; onType?.("enter"); submit(); }
    }
  };

  // ---- drawing ----
  const chunk = (s) => {
    const a = [];
    for (let i = 0; i < s.length; i += COLS) a.push(s.slice(i, i + COLS));
    if (!a.length || s.length % COLS === 0) a.push("");
    return a;
  };

  let cw = GW / COLS, sx = 1;
  const put = (t, col, row, color, bold = true) => {
    g.save();
    g.translate(GX + col * cw, GY + row * CH + CH * 0.8);
    g.scale(sx, 1);
    g.fillStyle = color;
    g.fillText(t, 0, 0);
    if (bold) g.fillText(t, 0, 0.8);
    g.restore();
  };
  const putMarked = (s, row) => {
    let col = 0, hi = false, buf = "";
    const flush = () => { if (buf) { put(buf, col, row, hi ? HI : TEXT); col += buf.length; buf = ""; } };
    for (const ch of s) {
      if (ch === "\u0001") { flush(); hi = true; }
      else if (ch === "\u0002") { flush(); hi = false; }
      else buf += ch;
    }
    flush();
  };
  const setGrid = (cols) => {
    cw = GW / cols;
    g.font = FONT;
    sx = cw / (g.measureText("M").width || 9);
  };
  const block = (col, row, cols, color) => { g.fillStyle = color; g.fillRect(GX + col * cw, GY + row * CH + 1, cols * cw, CH - 1); };

  const drawBasic = (now) => {
    setGrid(COLS);
    const busy = st.pending.length > 0 || st.curFull !== null;
    const lines = [...st.out];
    let tail = [];
    let cursorCol = 0;
    if (st.curFull !== null) lines.push(st.cur);
    else if (!busy) {
      if (st.running && !st.asking) tail = st.partial ? [st.partial] : [];
      else tail = chunk(st.partial + st.input);
    }
    const all = lines.concat(tail);
    const showHint = (st.waiting && st.scrollBack === 0) ? "-- PRESS ENTER FOR MORE --" : st.scrollBack > 0 ? "-- UP / DOWN TO SCROLL --" : "";
    const VR = showHint ? TROWS - 1 : TROWS;
    const maxBack = Math.max(0, all.length - VR);
    if (st.scrollBack > maxBack) st.scrollBack = maxBack;
    const end = all.length - st.scrollBack;
    const slice = all.slice(Math.max(0, end - VR), end);

    g.shadowColor = SHADOW;
    g.shadowBlur = 4 * S;
    slice.forEach((t, i) => putMarked(t, i));
    g.shadowBlur = 0;

    if (st.scrollBack === 0 && slice.length) {
      cursorCol = vis(slice[slice.length - 1]).length;
      const row = slice.length - 1;
      const show = busy || st.running && !st.asking ? true : Math.floor(now / 450) % 2 === 0;
      if (show && !st.waiting) {
        g.fillStyle = TEXT;
        g.shadowColor = SHADOW; g.shadowBlur = 4 * S;
        g.fillRect(GX + Math.min(cursorCol, COLS - 1) * cw, GY + row * CH + CH - 4, cw * 0.95, 3);
        g.shadowBlur = 0;
      }
    }
    if (showHint) {
      const hc = Math.floor((COLS - showHint.length) / 2);
      block(hc - 1, TROWS - 1, showHint.length + 2, BARC);
      put(showHint, hc, TROWS - 1, DARK, false);
    }

    // function-key row
    st.bar = [];
    BAR.forEach((b, i) => {
      const c0 = i * 8;
      put(b.key, c0, ROWS - 1, TEXT);
      block(c0 + 1, ROWS - 1, 6, BARC);
      put(b.label, c0 + 1, ROWS - 1, DARK, false);
      st.bar.push({x0: GX + c0 * cw, x1: GX + (c0 + 8) * cw, y0: GY + (ROWS - 1) * CH, y1: GY + ROWS * CH, cmd: b.cmd});
    });
    st.hot = [];
  };

  const drawMenu = () => {
    const cfg = MENUS[st.menu];
    const cols = 80;
    setGrid(cols);
    const colsToX = (c) => GX + c * cw;
    block(0, 0, cols, BARC);
    put(cfg.title + " \u00b7 " + cfg.sub, 1, 0, DARK, false);
    const right = "all 1-" + cfg.items.length + "/" + cfg.items.length;
    put(right, cols - right.length - 1, 0, "rgba(4,20,10,.55)", false);

    // big banner: bright face over a dark green drop shadow
    const px = 16, py = 14.4, word = cfg.banner;
    const bw = word.length * 5 + (word.length - 1);
    const x0 = (W - bw * px) / 2, y0 = GY + CH * 1.9;
    const cells = [];
    [...word].forEach((ch, li) => {
      const gl = GLYPH[ch] || [];
      gl.forEach((r, y) => [...r].forEach((v, x) => { if (v === "1") cells.push([x0 + (li * 6 + x) * px, y0 + y * py]); }));
    });
    g.fillStyle = "#2f8f49";
    cells.forEach(([x, y]) => { for (let k = 1; k <= 3; k++) g.fillRect(x + k * 2, y + k * 3.4, px - 1, py - 1); });
    g.fillStyle = "#d6ffe0";
    cells.forEach(([x, y]) => g.fillRect(x, y, px - 1, py - 1));

    g.shadowColor = SHADOW; g.shadowBlur = 3 * S;
    const tag = cfg.tagline;
    const tc = Math.floor((cols - tag.length) / 2);
    const ty = GY + 8 * CH + CH * 0.5;
    g.fillStyle = TEXT;
    g.fillRect(colsToX(4), ty, (tc - 6) * cw, 2);
    g.fillRect(colsToX(tc + tag.length + 2), ty, (cols - 4 - (tc + tag.length + 2)) * cw, 2);
    put(tag, tc, 8, HI);

    put(cfg.intro, 4, 11, HI);
    st.hot = [];
    cfg.items.forEach((it, i) => {
      const row = 13 + i;
      put("[" + (i + 1) + "]", 8, row, HI);
      put(it.label.padEnd(10), 12, row, HI);
      put(it.text(), 22, row, TEXT);
      st.hot.push({x0: colsToX(6), x1: colsToX(cols - 6), y0: GY + row * CH, y1: GY + (row + 1) * CH, i});
    });
    const msg = st.flash ? st.flash.text : cfg.prompt;
    put(msg, 7, 20, st.flash ? HI : TEXT);
    g.shadowBlur = 0;

    block(0, ROWS - 1, cols, BARC);
    put(cfg.bottom, 1, ROWS - 1, "rgba(4,20,10,.5)", false);
    st.bar = [];
  };

  // the games draw through this small kit (cells, not pixels)
  const R = {
    c: {text: TEXT, hi: HI, dim: DIM, dark: DARK, bar: BARC, faint: FAINT},
    rect(col, row, w, h, color, inset = 0) {
      g.fillStyle = color;
      g.fillRect(GX + col * cw + inset, GY + row * CH + inset, w * cw - inset * 2, h * CH - inset * 2);
    },
    text(s, col, row, color = TEXT) { g.shadowColor = SHADOW; g.shadowBlur = 3 * S; put(s, col, row, color); g.shadowBlur = 0; },
    glyph(s, col, row, color = TEXT) { g.shadowColor = SHADOW; g.shadowBlur = 3 * S; put(s, col, row, color); g.shadowBlur = 0; }
  };
  const drawGame = () => {
    setGrid(COLS);
    st.game.draw(R);
    block(0, ROWS - 1, COLS, BARC);
    put(st.game.status(), 1, ROWS - 1, DARK, false);
    st.bar = []; st.hot = [];
  };

  const draw = (now) => {
    g.setTransform(S, 0, 0, S, 0, 0);
    g.fillStyle = "#010a03";
    g.fillRect(0, 0, W, H);
    g.font = FONT;
    g.textBaseline = "alphabetic";
    if (st.mode === "menu") drawMenu(); else if (st.mode === "game") drawGame(); else drawBasic(now);
    tex.needsUpdate = true;
  };

  // ---- keyboard ----
  const onKey = (e) => {
    if (!st.active) return false;
    const k = e.key;
    if (k === "Escape") return false;
    const now = performance.now();
    st.lastInput = now;

    if (e.ctrlKey && (k === "c" || k === "C")) {
      if (st.running) breakProgram();
      else if (st.macro) st.macro = null;
      else if (st.mode === "basic" && !st.curFull && !st.pending.length) { write(st.input + "^C\n"); st.input = ""; }
      return true;
    }
    if (e.ctrlKey || e.metaKey || e.altKey) return false;

    if (st.mode === "game") {
      const g0 = st.game;
      if (g0.anyKeyQuits) { onType?.("key"); quitGame(); return true; }
      if (k === "q" || k === "Q") { onType?.("enter"); quitGame(); return true; }
      g0.key(k);
      return k.length === 1 || k === " " || k.startsWith("Arrow") || k === "Enter";
    }

    if (st.mode === "menu") {
      const cfg = MENUS[st.menu];
      if (/^[1-9]$/.test(k)) { onType?.("key"); cfg.items[parseInt(k, 10) - 1]?.act(now); return true; }
      if (k === "q" || k === "Q") { onType?.("enter"); closeMenu(); return true; }
      if (k === "l" || k === "L") { onType?.("key"); st.flash = null; return true; }
      return k.length === 1 || k === "Enter" || k === " " || /^F\d+$/.test(k) || k === "Backspace";
    }

    if (st.macro) return k.length === 1 || k === "Enter" || k === "Backspace" || /^F\d+$/.test(k);

    if (/^F[1-5]$/.test(k)) { onType?.("key"); choose(BAR[parseInt(k.slice(1), 10) - 1].cmd); return true; }

    const busy = st.pending.length > 0 || st.curFull !== null;
    const total = () => st.out.length + 1;
    if (k === "ArrowUp") { st.scrollBack = Math.min(Math.max(0, total() - TROWS + 1), st.scrollBack + 1); return true; }
    if (k === "PageUp") { st.scrollBack = Math.min(Math.max(0, total() - TROWS + 1), st.scrollBack + TROWS - 3); return true; }
    if (k === "ArrowDown" || k === "PageDown") {
      if (st.scrollBack > 0) st.scrollBack = Math.max(0, st.scrollBack - (k === "PageDown" ? TROWS - 3 : 1));
      else if (st.waiting) { st.waiting = false; st.count = 0; st.pauseUntil = now + 150; }
      return true;
    }
    if (st.waiting && st.scrollBack === 0) {
      if (k.length === 1 || k === "Enter") { st.waiting = false; st.count = 0; st.pauseUntil = now + 150; return true; }
      return false;
    }
    if (busy) {
      if (k === "Enter" || k === " ") { st.skip = true; if (k === "Enter" && st.input) st.sendWhenReady = true; return true; }
      // type ahead: letters typed while the screen is still printing wait on the input line
      if (k === "Backspace") { st.input = st.input.slice(0, -1); return true; }
      if (k.length === 1) { onType?.("key"); if (st.input.length < MAXIN) st.input += k; return true; }
      return false;
    }
    if (st.running && !st.asking) return k.length === 1 || k === "Enter" || k === "Backspace";

    if (k === "Enter") { onType?.("enter"); submit(); return true; }
    if (k === "Backspace") { onType?.("key"); st.input = st.input.slice(0, -1); st.scrollBack = 0; return true; }
    if (k.length === 1) { onType?.("key"); if (st.input.length < MAXIN) st.input += k; st.scrollBack = 0; return true; }
    return false;
  };

  const clickAt = (uv) => {
    const x = uv.x * W, y = (1 - uv.y) * H;
    st.lastInput = performance.now();
    if (st.mode === "game") { if (st.game.anyKeyQuits) quitGame(); return; }
    if (st.mode === "menu") {
      const h = st.hot.find((q) => x >= q.x0 && x <= q.x1 && y >= q.y0 && y <= q.y1);
      if (h) { onType?.("key"); MENUS[st.menu].items[h.i].act(performance.now()); }
      return;
    }
    const b = st.bar.find((q) => x >= q.x0 && x <= q.x1 && y >= q.y0 && y <= q.y1);
    if (b) { onType?.("key"); choose(b.cmd); }
  };

  reset(performance.now());

  return {
    mesh,
    get active() { return st.active; },
    setActive(v) {
      if (v === st.active) return;
      st.active = v;
      document.documentElement.classList.toggle("ibm-view", v);
      st.lastInput = performance.now();
      if (v && !st.booted) { st.booted = true; reset(performance.now()); }
      if (!v) { st.game?.pause?.(); st.game?.releaseKeys?.(); }
    },
    onKey,
    onKeyUp(e) { if (st.active && st.mode === "game") st.game.keyUp?.(e.key); },
    releaseKeys() { st.game?.releaseKeys?.(); },
    clickAt,
    refresh() { /* menu labels are read live */ },
    command(cmd) { if (st.active) typeCmd(cmd === "CONTACT" ? "ONLINE" : cmd); },
    setPower(on) {
      st.powerDir = on ? -1 : 1;
      if (!on) { basic.stop(); st.running = false; st.asking = false; st.booted = false; }
    },
    step(now, reduced) {
      u.uTime.value = reduced ? 0 : now / 1000;
      if (st.powerDir) {
        const dtp = Math.min(0.1, (now - (st.pt || now)) / 1000);
        st.off = Math.min(1, Math.max(0, st.off + st.powerDir * dtp / (reduced ? 0.01 : st.powerDir > 0 ? 0.85 : 1.1)));
        u.uOff.value = st.off;
        if (st.off <= 0 || st.off >= 1) st.powerDir = 0;
      }
      st.pt = now;
      step(now);
      draw(now);
    }
  };
}
