/** Efectos de sonido sintetizados (sin archivos) y vibración. Se pueden silenciar. */
let ctx = null;
let muted = (() => { try { return localStorage.getItem('bn.muted') === '1'; } catch { return false; } })();

function tone(freq, start, dur, type = 'sine', gain = 0.06) {
  const t0 = ctx.currentTime + start;
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  g.gain.setValueAtTime(gain, t0);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(g).connect(ctx.destination);
  osc.start(t0);
  osc.stop(t0 + dur + 0.02);
}

const SOUNDS = {
  miss: () => { tone(220, 0, 0.18, 'sine', 0.05); },
  hit: () => { tone(160, 0, 0.12, 'sawtooth', 0.07); tone(90, 0.05, 0.2, 'square', 0.05); },
  sunk: () => { tone(140, 0, 0.15, 'sawtooth', 0.08); tone(100, 0.12, 0.2, 'sawtooth', 0.08); tone(60, 0.28, 0.4, 'square', 0.07); },
  turn: () => { tone(660, 0, 0.08, 'triangle', 0.05); tone(880, 0.09, 0.1, 'triangle', 0.05); },
  win: () => { [523, 659, 784, 1047].forEach((f, i) => tone(f, i * 0.12, 0.2, 'triangle', 0.06)); },
  lose: () => { [392, 330, 262].forEach((f, i) => tone(f, i * 0.16, 0.25, 'sine', 0.06)); },
};
const VIBRATE = { hit: 40, sunk: [60, 40, 90], turn: 25 };

export const sound = {
  get muted() { return muted; },
  toggle() {
    muted = !muted;
    try { localStorage.setItem('bn.muted', muted ? '1' : '0'); } catch { /* sin almacenamiento */ }
    return muted;
  },
  play(name) {
    if (muted) return;
    try {
      ctx ??= new (window.AudioContext || window.webkitAudioContext)();
      if (ctx.state === 'suspended') ctx.resume();
      SOUNDS[name]?.();
      if (VIBRATE[name]) navigator.vibrate?.(VIBRATE[name]);
    } catch { /* el navegador no permite audio todavía */ }
  },
};
