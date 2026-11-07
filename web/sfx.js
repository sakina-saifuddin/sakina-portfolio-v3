// Small one-shot sounds for the desk: the VCR, the TV and PC power, and the clock's tick (a recording, sfx/clock.mp3).
// Everything is silent unless enabled() is true, so it follows the SOUND button.
const TICKS = [0, 0.45, 0.9, 1.35, 1.8, 2.25];

export function createSfx({ enabled }) {
  let ctx = null, out = null, soft = null, dest = null, clockBuf = null, sipBufs = [], sipLoading = null, sipLast = -1, loading = null, noise = null, tickN = 0, typedAt = 0;

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
    if (!sipLoading) {
      sipLoading = Promise.all([1, 2, 3].map(n => fetch("sfx/sip" + n + ".mp3?v=1").then(r => r.arrayBuffer()).then(b => ctx.decodeAudioData(b)).then(b => { sipBufs.push(b); }).catch(() => {})));
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
    // Returns how many seconds the sound lasts (the caller lowers the CRT video for that long).
    // A real recorded slurp (freesound_community, "slurping") when loaded, the synthesized one as a fallback.
    sip(level = 1) {
      if (!ready()) return 0; const t = ctx.currentTime + 0.02;
      if (level > 0 && sipBufs.length) {
        let k; do { k = Math.floor(Math.random() * sipBufs.length); } while (sipBufs.length > 1 && k === sipLast); sipLast = k;
        const s = ctx.createBufferSource(); s.buffer = sipBufs[k]; s.playbackRate.value = 0.96 + Math.random() * 0.08;
        const g = ctx.createGain(); g.gain.value = 1.0; s.connect(g).connect(out); s.start(t);   // balanced against the CRT video (which is only lowered to half while it plays)
        return sipBufs[k].duration / s.playbackRate.value;
      }
      if (level <= 0) { hiss(t, 0.35, 0.3, "bandpass", 1900, 900, 3); tone(t + 0.2, 0.1, "sine", 500, 320, 0.15); return 0.4; }
      // loud, so it is heard over the CRT video: a long wet slurp that rises in pitch, bubbles, a big gulp and an "ahh"
      hiss(t, 0.7, 0.6, "bandpass", 500, 3200, 4.5);
      hiss(t + 0.05, 0.6, 0.25, "highpass", 4000, 2500);
      hiss(t + 0.2, 0.4, 0.3, "bandpass", 1500, 2600, 6);
      for (let i = 0; i < 6; i++) tone(t + 0.12 + i * 0.1 + Math.random() * 0.03, 0.09, "sine", 500 + Math.random() * 500, 240, 0.2);
      tone(t + 0.85, 0.2, "sine", 200, 80, 0.9); tone(t + 1.05, 0.14, "sine", 170, 75, 0.5);
      hiss(t + 1.2, 0.5, 0.2, "lowpass", 1000, 350);
      return 1.8;
    },
    // pencils turning in their holder: a quick wooden rattle that thins out
    pencils() {
      if (!ready()) return; const t = ctx.currentTime + 0.02;
      for (let i = 0; i < 9; i++) {
        const at = t + i * 0.07 + Math.random() * 0.05 + i * i * 0.006, p = 0.2 * Math.pow(0.8, i);
        hiss(at, 0.03, p, "bandpass", 2600 + Math.random() * 900, 1500, 5);
        tone(at, 0.05, "triangle", 900 + Math.random() * 700, 520, p * 0.35, 3000);
      }
    },
    // a cassette recorder key: a heavy mechanical clunk going down, a lighter click coming back up
    recKey(down = true) {
      if (!ready()) return; const t = ctx.currentTime + 0.01;
      if (down) { click(t, 0.55); thump(t, 0.35); tone(t, 0.05, "square", 520, 260, 0.08, 1800); hiss(t + 0.03, 0.06, 0.16, "bandpass", 700, 400, 1); }
      else { click(t, 0.35); tone(t, 0.04, "square", 700, 380, 0.06, 2000); }
    },
    // tuning between stations: a sweep of radio static with a few whistles, then it settles
    tune(dur = 0.7) {
      if (!ready()) return; const t = ctx.currentTime + 0.02;
      hiss(t, dur, 0.42, "bandpass", 600, 3600, 1.3); hiss(t + 0.05, dur * 0.9, 0.2, "highpass", 3000, 2000);
      tone(t, dur * 0.8, "sine", 500, 1700, 0.06, 3000); tone(t + dur * 0.35, dur * 0.5, "sine", 2100, 700, 0.04, 3000);
    },
    // trophy: a small bright bell, three notes of a major chord ringing out
    chime() {
      if (!ready()) return; const t = ctx.currentTime + 0.02;
      [1568, 1976, 2349].forEach((f, i) => {
        const at = t + i * 0.09;
        tone(at, 1.4, "sine", f, f * 0.998, 0.11, 6000); tone(at, 0.6, "sine", f * 2.01, f * 2, 0.035, 8000);
      });
      hiss(t, 0.05, 0.12, "highpass", 4000, 3000);
    },
    // a lamp switch: a firm mechanical click, a little lower and softer for off than for on
    lamp(on = true) {
      if (!ready()) return; const t = ctx.currentTime + 0.02;
      click(t, on ? 0.7 : 0.55); tone(t, 0.04, "square", on ? 900 : 700, on ? 420 : 300, 0.12, 2400);
      click(t + 0.05, 0.35); tone(t + 0.03, 0.12, "sine", on ? 240 : 170, 90, 0.14);
    },
    // a calculator key: a short plastic click, a touch lower and heavier for = and the clear keys
    calcKey(big = false) {
      if (!ready()) return; const t = ctx.currentTime + 0.01;
      click(t, big ? 0.5 : 0.38); tone(t, 0.035, "square", big ? 700 : 950, big ? 380 : 520, big ? 0.12 : 0.09, 2600); hiss(t + 0.045, 0.03, 0.12, "bandpass", 900, 500, 1);
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
