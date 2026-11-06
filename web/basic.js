// A tiny GW-BASIC-style interpreter for the portfolio computer. No DOM: the terminal passes in write/cls/beep.
// Supported: PRINT INPUT LET IF/THEN/ELSE GOTO GOSUB RETURN FOR/NEXT WHILE/WEND DATA READ RESTORE DIM REM END STOP CLS BEEP.

export class BasicError extends Error {}

const err = (m) => { throw new BasicError(m); };

function tokenize(src) {
  const t = [];
  let i = 0;
  while (i < src.length) {
    const c = src[i];
    if (c === " " || c === "\t") { i++; continue; }
    if (c === "'") break;
    if (c === "?") { t.push({k: "id", v: "PRINT"}); i++; continue; }
    if (c === '"') {
      let j = i + 1, s = "";
      while (j < src.length && src[j] !== '"') s += src[j++];
      t.push({k: "str", v: s});
      i = j + 1;
      continue;
    }
    if (/[0-9.]/.test(c)) {
      const m = /^(\d+\.?\d*|\.\d+)(E[+-]?\d+)?/i.exec(src.slice(i));
      if (!m) err("Syntax error");
      t.push({k: "num", v: parseFloat(m[0])});
      i += m[0].length;
      continue;
    }
    if (/[A-Za-z]/.test(c)) {
      const m = /^[A-Za-z][A-Za-z0-9]*\$?/.exec(src.slice(i));
      const v = m[0].toUpperCase();
      i += m[0].length;
      if (v === "REM") break;
      t.push({k: "id", v});
      continue;
    }
    const two = src.slice(i, i + 2);
    if (two === "<=" || two === ">=" || two === "<>") { t.push({k: "op", v: two}); i += 2; continue; }
    if ("+-*/^(),;:=<>".includes(c)) { t.push({k: "op", v: c}); i++; continue; }
    err("Syntax error");
  }
  return t;
}

const fmtNum = (n) => {
  if (!isFinite(n)) return "Overflow";
  let s = Number.isInteger(n) ? String(n) : String(+n.toPrecision(7));
  if (/e/i.test(s)) s = s.replace("e+", "E+").replace("e-", "E-");
  return s;
};
const isStr = (n) => n.endsWith("$");

export class Basic {
  constructor({write, cls, beep}) {
    this.write = write; this.cls = cls || (() => {}); this.beep = beep || (() => {});
    this.lines = []; this.trace = false; this.state = "idle";
    this.vars = new Map(); this.arrs = new Map();
    this.col = 0;
    this._reset();
  }

  _reset() {
    this.pc = 0; this.p = 0; this.jumped = false;
    this.fors = []; this.whiles = []; this.subs = [];
    this.data = []; this.dp = 0;
    this.ask = null; this.lineNo = 0;
  }

  out(s) {
    for (const ch of s) this.col = ch === "\n" ? 0 : this.col + 1;
    this.write(s);
  }

  setProgram(entries) {
    this.lines = entries.map(([n, text]) => {
      let toks = null;
      try { toks = tokenize(text); } catch { toks = null; }
      return {n, text, toks};
    });
  }

  // run the stored program from the top with clean variables
  run() {
    this.vars = new Map(); this.arrs = new Map();
    this._reset();
    this.data = [];
    for (const l of this.lines) {
      if (/^\s*DATA\b/i.test(l.text)) {
        const raw = l.text.replace(/^\s*DATA\b/i, "");
        for (let item of raw.split(",")) {
          item = item.trim();
          if (item.startsWith('"') && item.endsWith('"') && item.length > 1) this.data.push(item.slice(1, -1));
          else if (item !== "" && !isNaN(Number(item))) this.data.push(Number(item));
          else this.data.push(item);
        }
      }
    }
    this.state = this.lines.length ? "running" : "idle";
  }

  stop() { if (this.state === "running" || this.state === "input") { this.state = "stopped"; return this.lineNo; } return null; }

  // one immediate-mode line, e.g.  PRINT 2+2   or   A=5   or   FOR I=1 TO 3:PRINT I:NEXT
  direct(text) {
    const saved = {lines: this.lines, pc: this.pc, p: this.p, fors: this.fors, whiles: this.whiles, subs: this.subs, state: this.state, data: this.data, dp: this.dp, ask: this.ask, no: this.lineNo};
    let toks;
    try { toks = tokenize(text); } catch (e) { return e.message; }
    this.lines = [{n: 0, text, toks}];
    this.pc = 0; this.p = 0; this.fors = []; this.whiles = []; this.subs = []; this.state = "running"; this.direct_ = true;
    let msg = null;
    try {
      this.step(200000);
      if (this.state === "running") msg = "Program too long";
      if (this.state === "input") { msg = "Illegal direct"; }
    } catch (e) { msg = e.message; }
    this.direct_ = false;
    if (this.lastError) { msg = this.lastError; this.lastError = null; }
    Object.assign(this, {lines: saved.lines, pc: saved.pc, p: saved.p, fors: saved.fors, whiles: saved.whiles, subs: saved.subs, state: saved.state, data: saved.data, dp: saved.dp, ask: saved.ask, lineNo: saved.no});
    return msg;
  }

  step(budget = 400) {
    while (budget-- > 0 && this.state === "running") {
      try { this._one(); }
      catch (e) {
        if (!(e instanceof BasicError)) throw e;
        const where = this.direct_ ? "" : " in " + this.lines[this.pc]?.n;
        if (this.direct_) this.lastError = e.message;
        else { if (this.col) this.out("\n"); this.out(e.message + where + "\n"); }
        this.state = "error";
      }
    }
  }

  // text typed for an INPUT statement
  provide(text) {
    const a = this.ask;
    if (!a) return;
    const parts = a.targets.length === 1 ? [text] : text.split(",");
    let ok = parts.length === a.targets.length;
    const vals = [];
    if (ok) a.targets.forEach((tg, i) => {
      const s = parts[i].trim();
      if (isStr(tg.name)) vals.push(parts[i].replace(/^\s+/, ""));
      else if (s !== "" && !isNaN(Number(s))) vals.push(Number(s));
      else if (s === "") vals.push(0);
      else ok = false;
    });
    if (!ok) { this.out("?Redo from start\n"); this.out(a.prompt); return; }
    a.targets.forEach((tg, i) => this._assign(tg.name, tg.idx, vals[i]));
    this.ask = null;
    this.state = "running";
  }

  get prompt() { return this.ask ? this.ask.prompt : ""; }

  // ---- execution ----
  _one() {
    for (;;) {
      if (this.pc >= this.lines.length) { this.state = "done"; return; }
      const t = this.lines[this.pc].toks;
      if (t === null) { this.lineNo = this.lines[this.pc].n; err("Syntax error"); }
      if (this.p >= t.length) { this.pc++; this.p = 0; continue; }
      if (t[this.p].k === "op" && t[this.p].v === ":") { this.p++; continue; }
      break;
    }
    const line = this.lines[this.pc];
    this.t = line.toks;
    this.lineNo = line.n;
    if (this.p === 0 && this.trace && !this.direct_) this.out("[" + line.n + "]");
    this.jumped = false;
    this._stmt();
    if (this.jumped || this.state !== "running") return;
    const n = this.t[this.p];
    if (n) {
      if (n.k === "id" && n.v === "ELSE") this.p = this.t.length;
      else if (!(n.k === "op" && n.v === ":")) err("Syntax error");
    }
  }

  _jump(no) {
    const i = this.lines.findIndex((l) => l.n === no);
    if (i < 0) err("Undefined line " + no);
    this.pc = i; this.p = 0; this.jumped = true;
  }

  _peekOp(v) { const x = this.t[this.p]; return x && x.k === "op" && x.v === v; }
  _peekId(v) { const x = this.t[this.p]; return x && x.k === "id" && x.v === v; }
  _eatOp(v) { if (this._peekOp(v)) { this.p++; return true; } return false; }
  _need(v) { if (!this._eatOp(v)) err("Syntax error"); }
  _atEnd() { const x = this.t[this.p]; return !x || (x.k === "op" && x.v === ":") || (x.k === "id" && x.v === "ELSE"); }

  _stmt() {
    const x = this.t[this.p];
    if (x.k !== "id") err("Syntax error");
    const kw = x.v;
    const known = ["PRINT", "INPUT", "LET", "IF", "GOTO", "GOSUB", "RETURN", "FOR", "NEXT", "WHILE", "WEND", "DATA", "READ", "RESTORE", "DIM", "END", "STOP", "CLS", "BEEP", "RANDOMIZE"];
    if (!known.includes(kw)) { this._let(); return; }
    this.p++;
    switch (kw) {
      case "LET": this._let(); break;
      case "PRINT": this._print(); break;
      case "INPUT": this._input(); break;
      case "IF": this._if(); break;
      case "GOTO": { const v = this._exprNum(); this._jump(v); break; }
      case "GOSUB": { const v = this._exprNum(); this.subs.push({pc: this.pc, p: this.p}); this._jump(v); break; }
      case "RETURN": { const s = this.subs.pop(); if (!s) err("RETURN without GOSUB"); this.pc = s.pc; this.p = s.p; this.jumped = true; break; }
      case "FOR": this._for(); break;
      case "NEXT": this._next(); break;
      case "WHILE": this._while(x); break;
      case "WEND": this._wend(); break;
      case "DATA": this.p = this.t.length; break;
      case "READ": this._read(); break;
      case "RESTORE": this.dp = 0; break;
      case "DIM": this._dim(); break;
      case "END": case "STOP": this.state = "done"; break;
      case "CLS": this.cls(); this.col = 0; break;
      case "BEEP": this.beep(); break;
      case "RANDOMIZE": if (!this._atEnd()) this._expr(); break;
      default: err("Syntax error");
    }
  }

  _target() {
    const id = this.t[this.p];
    if (!id || id.k !== "id") err("Syntax error");
    this.p++;
    let idx = null;
    if (this._eatOp("(")) {
      idx = [this._exprNum()];
      while (this._eatOp(",")) idx.push(this._exprNum());
      this._need(")");
    }
    return {name: id.v, idx};
  }

  _assign(name, idx, val) {
    if (isStr(name) !== (typeof val === "string")) err("Type mismatch");
    if (idx) {
      const a = this.arrs.get(name) || this._autoDim(name);
      const key = idx.join(",");
      if (idx.some((i) => i < 0 || i > a.max)) err("Subscript out of range");
      a.map.set(key, val);
    } else this.vars.set(name, val);
  }

  _autoDim(name) { const a = {max: 10, map: new Map()}; this.arrs.set(name, a); return a; }

  _let() {
    const {name, idx} = this._target();
    this._need("=");
    this._assign(name, idx, this._expr());
  }

  _dim() {
    do {
      const id = this.t[this.p++];
      if (!id || id.k !== "id") err("Syntax error");
      this._need("(");
      const n = this._exprNum();
      this._need(")");
      this.arrs.set(id.v, {max: n, map: new Map()});
    } while (this._eatOp(","));
  }

  _print() {
    let nl = true;
    while (!this._atEnd()) {
      nl = true;
      if (this._eatOp(";")) { nl = false; continue; }
      if (this._eatOp(",")) { const pad = 14 - (this.col % 14); this.out(" ".repeat(pad)); nl = false; continue; }
      const x = this.t[this.p];
      if (x.k === "id" && (x.v === "TAB" || x.v === "SPC") && this.t[this.p + 1]?.v === "(") {
        this.p += 2;
        const n = Math.floor(this._exprNum());
        this._need(")");
        this.out(" ".repeat(Math.max(0, x.v === "TAB" ? n - 1 - this.col : n)));
        nl = false;
        continue;
      }
      const v = this._expr();
      this.out(typeof v === "number" ? (v < 0 ? "" : " ") + fmtNum(v) + " " : v);
      nl = true;
      if (this._peekOp(";") || this._peekOp(",")) nl = false;
    }
    if (nl) this.out("\n");
  }

  _input() {
    let prompt = "";
    let q = true;
    if (this.t[this.p]?.k === "str") {
      prompt = this.t[this.p].v;
      this.p++;
      if (this._eatOp(";")) q = true; else if (this._eatOp(",")) q = false;
    }
    const targets = [this._target()];
    while (this._eatOp(",")) targets.push(this._target());
    this.ask = {targets, prompt: prompt + (q ? "? " : "")};
    this.out(this.ask.prompt);
    this.state = "input";
  }

  _if() {
    const c = this._expr();
    if (typeof c !== "number") err("Type mismatch");
    if (this._peekId("THEN") || this._peekId("GOTO")) this.p++; else err("Syntax error");
    if (c !== 0) {
      if (this.t[this.p]?.k === "num") { const n = this.t[this.p].v; this.p++; this._jump(n); }
      else this.jumped = true;   // the statements after THEN run next
      return;
    }
    while (this.p < this.t.length && !this._peekId("ELSE")) this.p++;
    if (this._peekId("ELSE")) {
      this.p++;
      if (this.t[this.p]?.k === "num") { const n = this.t[this.p].v; this.p++; this._jump(n); }
      else this.jumped = true;
    } else this.p = this.t.length;
  }

  _for() {
    const {name} = this._target();
    if (isStr(name)) err("Type mismatch");
    this._need("=");
    const a = this._exprNum();
    if (!this._peekId("TO")) err("Syntax error");
    this.p++;
    const end = this._exprNum();
    let step = 1;
    if (this._peekId("STEP")) { this.p++; step = this._exprNum(); }
    this.vars.set(name, a);
    this.fors = this.fors.filter((f) => f.name !== name);
    this.fors.push({name, end, step, pc: this.pc, p: this.p});
    if (step > 0 ? a > end : a < end) {
      // empty loop: skip to the matching NEXT
      this.fors.pop();
      this._skipTo("NEXT", "FOR");
    }
  }

  _skipTo(close, open) {
    let depth = 0;
    for (let li = this.pc, pos = this.p; li < this.lines.length; li++, pos = 0) {
      const t = this.lines[li].toks || [];
      for (let k = pos; k < t.length; k++) {
        if (t[k].k !== "id") continue;
        if (t[k].v === open) depth++;
        else if (t[k].v === close) {
          if (depth === 0) {
            this.pc = li; this.p = k + 1;
            const nx = this.lines[li].toks[this.p];
            if (close === "NEXT" && nx && nx.k === "id" && nx.v !== "ELSE") this.p++;
            this.jumped = true;
            return;
          }
          depth--;
        }
      }
    }
    err(close === "NEXT" ? "FOR without NEXT" : "WHILE without WEND");
  }

  _next() {
    let name = null;
    if (this.t[this.p]?.k === "id" && !this._peekId("ELSE")) { name = this.t[this.p].v; this.p++; }
    let fi = this.fors.length - 1;
    if (name) fi = this.fors.map((f) => f.name).lastIndexOf(name);
    if (fi < 0) err("NEXT without FOR");
    const f = this.fors[fi];
    this.fors.length = fi + 1;
    const v = (this.vars.get(f.name) || 0) + f.step;
    this.vars.set(f.name, v);
    if (f.step > 0 ? v <= f.end : v >= f.end) { this.pc = f.pc; this.p = f.p; this.jumped = true; }
    else this.fors.pop();
  }

  _while(x) {
    const startP = this.p - 1;
    const top = this.whiles[this.whiles.length - 1];
    const same = top && top.pc === this.pc && top.p === startP;
    const c = this._expr();
    if (typeof c !== "number") err("Type mismatch");
    if (c !== 0) { if (!same) this.whiles.push({pc: this.pc, p: startP}); }
    else { if (same) this.whiles.pop(); this._skipTo("WEND", "WHILE"); }
  }

  _wend() {
    const w = this.whiles[this.whiles.length - 1];
    if (!w) err("WEND without WHILE");
    this.pc = w.pc; this.p = w.p; this.jumped = true;
  }

  _read() {
    do {
      const {name, idx} = this._target();
      if (this.dp >= this.data.length) err("Out of DATA");
      let v = this.data[this.dp++];
      if (isStr(name)) v = String(v);
      else if (typeof v !== "number") err("Syntax error");
      this._assign(name, idx, v);
    } while (this._eatOp(","));
  }

  // ---- expressions ----
  _exprNum() { const v = this._expr(); if (typeof v !== "number") err("Type mismatch"); return v; }
  _expr() { return this._or(); }

  _or() {
    let a = this._and();
    while (this._peekId("OR")) { this.p++; const b = this._and(); a = this._n(a) | this._n(b); }
    return a;
  }
  _and() {
    let a = this._not();
    while (this._peekId("AND")) { this.p++; const b = this._not(); a = this._n(a) & this._n(b); }
    return a;
  }
  _not() {
    if (this._peekId("NOT")) { this.p++; return ~this._n(this._not()); }
    return this._cmp();
  }
  _n(v) { if (typeof v !== "number") err("Type mismatch"); return Math.trunc(v); }
  _cmp() {
    let a = this._add();
    for (;;) {
      const x = this.t[this.p];
      if (!x || x.k !== "op" || !["=", "<", ">", "<=", ">=", "<>"].includes(x.v)) return a;
      this.p++;
      const b = this._add();
      if (typeof a !== typeof b) err("Type mismatch");
      const r = {"=": a === b, "<": a < b, ">": a > b, "<=": a <= b, ">=": a >= b, "<>": a !== b}[x.v];
      a = r ? -1 : 0;
    }
  }
  _add() {
    let a = this._mul();
    for (;;) {
      if (this._peekOp("+")) {
        this.p++; const b = this._mul();
        if (typeof a !== typeof b) err("Type mismatch");
        a = a + b;
      } else if (this._peekOp("-")) {
        this.p++; const b = this._mul();
        a = this._n2(a) - this._n2(b);
      } else return a;
    }
  }
  _n2(v) { if (typeof v !== "number") err("Type mismatch"); return v; }
  _mul() {
    let a = this._unary();
    for (;;) {
      if (this._peekOp("*")) { this.p++; a = this._n2(a) * this._n2(this._unary()); }
      else if (this._peekOp("/")) { this.p++; const b = this._n2(this._unary()); if (b === 0) err("Division by zero"); a = this._n2(a) / b; }
      else if (this._peekId("MOD")) { this.p++; const b = Math.trunc(this._n2(this._unary())); if (b === 0) err("Division by zero"); a = Math.trunc(this._n2(a)) % b; }
      else return a;
    }
  }
  _unary() {
    if (this._eatOp("-")) return -this._n2(this._unary());
    if (this._eatOp("+")) return this._unary();
    return this._pow();
  }
  _pow() {
    let a = this._primary();
    while (this._eatOp("^")) { const b = this._n2(this._unary()); a = Math.pow(this._n2(a), b); }
    return a;
  }

  _primary() {
    const x = this.t[this.p];
    if (!x) err("Syntax error");
    if (x.k === "num") { this.p++; return x.v; }
    if (x.k === "str") { this.p++; return x.v; }
    if (x.k === "op" && x.v === "(") { this.p++; const v = this._expr(); this._need(")"); return v; }
    if (x.k !== "id") err("Syntax error");
    this.p++;
    const f = FUNCS[x.v];
    if (f) {
      if (f.noargs && !this._peekOp("(")) return f.fn(this);
      this._need("(");
      const args = [this._expr()];
      while (this._eatOp(",")) args.push(this._expr());
      this._need(")");
      return f.fn(this, ...args);
    }
    if (this._peekOp("(")) {
      this.p++;
      const idx = [this._exprNum()];
      while (this._eatOp(",")) idx.push(this._exprNum());
      this._need(")");
      const a = this.arrs.get(x.v) || this._autoDim(x.v);
      if (idx.some((i) => i < 0 || i > a.max)) err("Subscript out of range");
      const v = a.map.get(idx.join(","));
      return v === undefined ? (isStr(x.v) ? "" : 0) : v;
    }
    const v = this.vars.get(x.v);
    return v === undefined ? (isStr(x.v) ? "" : 0) : v;
  }
}

const N = (v) => { if (typeof v !== "number") err("Type mismatch"); return v; };
const S = (v) => { if (typeof v !== "string") err("Type mismatch"); return v; };
const FUNCS = {
  INT: {fn: (_, a) => Math.floor(N(a))},
  FIX: {fn: (_, a) => Math.trunc(N(a))},
  ABS: {fn: (_, a) => Math.abs(N(a))},
  SGN: {fn: (_, a) => Math.sign(N(a))},
  SQR: {fn: (_, a) => { if (N(a) < 0) err("Illegal function call"); return Math.sqrt(a); }},
  SIN: {fn: (_, a) => Math.sin(N(a))},
  COS: {fn: (_, a) => Math.cos(N(a))},
  TAN: {fn: (_, a) => Math.tan(N(a))},
  ATN: {fn: (_, a) => Math.atan(N(a))},
  EXP: {fn: (_, a) => Math.exp(N(a))},
  LOG: {fn: (_, a) => { if (N(a) <= 0) err("Illegal function call"); return Math.log(a); }},
  RND: {noargs: true, fn: () => Math.random()},
  TIMER: {noargs: true, fn: () => (Date.now() / 1000) % 86400},
  LEN: {fn: (_, a) => S(a).length},
  ASC: {fn: (_, a) => { if (!S(a)) err("Illegal function call"); return a.charCodeAt(0); }},
  VAL: {fn: (_, a) => { const m = /^\s*[-+]?(\d+\.?\d*|\.\d+)(E[-+]?\d+)?/i.exec(S(a)); return m ? parseFloat(m[0]) : 0; }},
  "STR$": {fn: (_, a) => (N(a) < 0 ? "" : " ") + fmtNum(a)},
  "CHR$": {fn: (_, a) => String.fromCharCode(N(a))},
  "UCASE$": {fn: (_, a) => S(a).toUpperCase()},
  "LCASE$": {fn: (_, a) => S(a).toLowerCase()},
  "SPACE$": {fn: (_, a) => " ".repeat(Math.max(0, N(a)))},
  "LEFT$": {fn: (_, a, n) => S(a).slice(0, Math.max(0, N(n)))},
  "RIGHT$": {fn: (_, a, n) => { n = Math.max(0, N(n)); return n ? S(a).slice(-n) : ""; }},
  "MID$": {fn: (_, a, i, n) => { const s = S(a), st = Math.max(0, N(i) - 1); return n === undefined ? s.slice(st) : s.slice(st, st + Math.max(0, N(n))); }},
  INSTR: {fn: (_, a, b) => S(a).indexOf(S(b)) + 1}
};

export {tokenize, fmtNum};
