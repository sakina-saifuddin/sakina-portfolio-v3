// Small one-shot sounds for the desk: the VCR, the TV and PC power, and the clock's tick (a recording, sfx/clock.mp3).
// Everything is silent unless enabled() is true, so it follows the SOUND button.
const TICKS = [0, 0.45, 0.9, 1.35, 1.8, 2.25];

export function createSfx({ enabled }) {
  let ctx = null, out = null, soft = null, dest = null, clockBuf = null, loading = null, noise = null, tickN = 0, typedAt = 0;

  function ready() {
    if (!enabled()) return false;
    if (!ctx) {
      try { ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch { return false; }
      out = ctx.createGain(); out.gain.value = 0.9; out.connect(ctx.destination);
      soft = ctx.createGain(); soft.gain.value = 0.5; soft.connect(out);
      noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
      const d = noise.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    if (ctx.state === "suspended") ctx.resume().catch(() => {});
    if (!clockBuf && !loading) {
      loading = fetch("sfx/clock.mp3").then(r => r.arrayBuffer()).then(b => ctx.decodeAudioData(b)).then(b => { clockBuf = b; }).catch(() => {});
    }
    return ctx.state !== "closed";
  }
  const env = (g, t, a, peak, dur) => {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  };
  function hiss(t, dur, peak, type, f0, f1, q = 1) {
    const s = ctx.createBufferSource(); s.buffer = noise; s.loop = true;
    const f = ctx.createBiquadFilter(); f.type = type; f.Q.value = q;
    f.frequency.setValueAtTime(f0, t); f.frequency.exponentialRampToValueAtTime(f1, t + dur);
    const g = ctx.createGain(); env(g, t, Math.min(0.03, dur / 3), peak, dur);
    s.connect(f).connect(g).connect(dest || out); s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.05);
  }
  function tone(t, dur, type, f0, f1, peak, lp) {
    const o = ctx.createOscillator(); o.type = type;
    o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + dur);
    const g = ctx.createGain(); env(g, t, 0.01, peak, dur);
    let n = o;
    if (lp) { const f = ctx.createBiquadFilter(); f.type = "lowpass"; f.frequency.value = lp; o.connect(f); n = f; }
    n.connect(g).connect(dest || out); o.start(t); o.stop(t + dur + 0.05);
  }
  const click = (t, peak = 0.25) => hiss(t, 0.025, peak, "highpass", 2500, 3500);
  const thump = (t, peak = 0.5) => tone(t, 0.22, "sine", 95, 42, peak);

  return {
    // the recorder's motor and latch, kept quiet: the tape coming out, and the tape going back in
    eject() {
      if (!ready()) return; const t = ctx.currentTime + 0.02;
      click(t, 0.9); tone(t, 0.07, "square", 420, 200, 0.18, 2200);
      hiss(t + 0.06, 0.85, 0.3, "bandpass", 900, 1900, 1); tone(t + 0.06, 0.85, "sawtooth", 190, 310, 0.14, 1500);
      click(t + 0.95, 0.9); tone(t + 0.95, 0.1, "square", 340, 150, 0.3, 1800); hiss(t + 0.95, 0.08, 0.5, "bandpass", 1400, 600, 1);
    },
    insert() {
      if (!ready()) return; const t = ctx.currentTime + 0.02;
      click(t, 0.8); tone(t, 0.06, "square", 380, 220, 0.16, 2200);
      hiss(t + 0.1, 1.3, 0.3, "bandpass", 1700, 800, 1); tone(t + 0.1, 1.3, "sawtooth", 300, 180, 0.14, 1500);
      click(t + 1.5, 0.9); tone(t + 1.5, 0.1, "square", 340, 150, 0.32, 1800); hiss(t + 1.5, 0.09, 0.55, "bandpass", 1400, 600, 1);
      click(t + 1.62, 0.7);
    },
    tvOff() {
      if (!ready()) return; const t = ctx.currentTime + 0.01;
      tone(t, 0.3, "sine", 1500, 40, 0.22); hiss(t, 0.18, 0.08, "highpass", 6000, 3000); thump(t + 0.24, 0.45);
    },
    tvOn() {
      if (!ready()) return; const t = ctx.currentTime + 0.01;
      thump(t, 0.4); hiss(t + 0.02, 0.22, 0.1, "highpass", 3000, 6000); tone(t + 0.05, 0.7, "sine", 1800, 4200, 0.025);
    },
    pcOff() {
      if (!ready()) return; const t = ctx.currentTime + 0.01;
      click(t, 0.4); tone(t + 0.02, 0.7, "sawtooth", 120, 28, 0.1, 380); hiss(t + 0.05, 0.6, 0.07, "lowpass", 900, 150);
    },
    pcOn() {
      if (!ready()) return; const t = ctx.currentTime + 0.01;
      click(t, 0.4); tone(t + 0.04, 0.6, "sawtooth", 28, 120, 0.09, 380); tone(t + 0.5, 0.12, "square", 1000, 1000, 0.04, 3000);
    },
    // typewriter: "key" for a keystroke, "enter" for the carriage bell, "out" for printed characters (throttled)
    type(kind = "key") {
      if (!ready()) return;
      const t = ctx.currentTime + 0.005;
      if (kind === "pencil") {
        if (t - typedAt < 0.05) return; typedAt = t;
        hiss(t, 0.07, 0.05 + Math.random() * 0.02, "bandpass", 2600 + Math.random() * 900, 1800, 1.5); return;
      }
      if (kind === "flip") { hiss(t, 0.5, 0.12, "bandpass", 900, 3200, 0.8); hiss(t + 0.35, 0.18, 0.08, "highpass", 2000, 1000); return; }
      if (kind === "out") {
        if (t - typedAt < 0.07) return; typedAt = t;
        click(t, 0.1); tone(t, 0.04, "square", 190 + Math.random() * 40, 120, 0.03, 900); return;
      }
      if (kind === "enter") {
        click(t, 0.3); thump(t, 0.25); tone(t + 0.12, 0.5, "sine", 2350, 2330, 0.07); hiss(t + 0.03, 0.25, 0.1, "bandpass", 1200, 500, 2); return;
      }
      click(t, 0.3 + Math.random() * 0.1); tone(t, 0.05, "square", 160 + Math.random() * 50, 90, 0.06, 1100);
    },
    // a sip of coffee: a soft slurp, a few bubbles, a gulp and a small "ahh". sip(0) is the dry sound of an empty mug.
    sip(level = 1) {
      if (!ready()) return; const t = ctx.currentTime + 0.02;
      if (level <= 0) { hiss(t, 0.3, 0.07, "bandpass", 1900, 900, 3); tone(t + 0.18, 0.08, "sine", 500, 320, 0.03); return; }
      hiss(t, 0.5, 0.11, "bandpass", 700, 2300, 3.5);
      hiss(t + 0.05, 0.4, 0.035, "highpass", 4500, 3000);
      for (let i = 0; i < 4; i++) tone(t + 0.1 + i * 0.09 + Math.random() * 0.03, 0.07, "sine", 520 + Math.random() * 380, 260, 0.03);
      tone(t + 0.62, 0.15, "sine", 190, 90, 0.2); tone(t + 0.8, 0.1, "sine", 160, 85, 0.1);
      hiss(t + 0.95, 0.4, 0.04, "lowpass", 900, 350);
    },
    // one tick per call, quieter the farther the camera is from the clock
    tick(dist = 1.5) {
      if (!ready() || !clockBuf) return;
      const s = ctx.createBufferSource(); s.buffer = clockBuf;
      const g = ctx.createGain(); g.gain.value = Math.min(0.55, Math.max(0.08, 0.5 / (1 + dist * 0.9)));
      s.connect(g).connect(out); s.start(0, TICKS[tickN++ % TICKS.length], 0.2);
    }
  };
}
