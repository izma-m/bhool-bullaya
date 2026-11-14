// Procedural music + sound effects (Web Audio, zero audio files).
const nf = (n) => 220 * Math.pow(2, n / 12);
let ac, master, timer;
let on = true, mode = 'menu', level = 'adv', step = 0, nextT = 0, combo = 0, lastEat = -9, powered = false;

function tone(f, t, d, type, v) {
  const o = ac.createOscillator(), g = ac.createGain();
  o.type = type; o.frequency.value = f;
  g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(v, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
  o.connect(g); g.connect(master); o.start(t); o.stop(t + d + 0.05);
}
function sweep(f0, f1, t, d, type, v) {
  const o = ac.createOscillator(), g = ac.createGain();
  o.type = type; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f1, t + d);
  g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
  o.connect(g); g.connect(master); o.start(t); o.stop(t + d + 0.05);
}
function sched() {
  if (!ac || !on) return;
  if (ac.state === 'suspended') ac.resume();
  const bpm = mode === 'menu' ? 90 : level === 'adv' ? 150 : 118, sd = 60 / bpm / 2;
  if (nextT < ac.currentTime - 1) nextT = ac.currentTime;
  while (nextT < ac.currentTime + 0.25) {
    const t = nextT;
    if (mode === 'menu') {
      const ch = [[0, 3, 7], [-4, 0, 3], [3, 7, 10], [-2, 2, 5]][(step >> 3) & 3];
      tone(nf(ch[step % 3] + 12), t, sd * 2, 'sine', 0.13);
      if (step % 8 === 0) tone(nf(ch[0] - 12), t, sd * 7, 'triangle', 0.2);
    } else {
      const bass = [0, 0, 7, 0, 5, 5, 3, 5][step % 8];
      const mel = [12, 15, 19, 15, 17, 15, 12, 10, 12, 15, 19, 22, 19, 17, 15, 12][step % 16];
      tone(nf(bass - 12), t, sd * 0.9, 'triangle', 0.2);
      if (step % 2 === 0 || level === 'adv') tone(nf(mel + (powered ? 12 : 0)), t, sd * 0.8, 'square', 0.04);
      if (step % 4 === 2) tone(nf(bass + 12), t, sd * 0.4, 'sine', 0.05);
    }
    step++; nextT += sd;
  }
}
export const sound = {
  get on() { return on; },
  init() {
    if (ac) { if (ac.state === 'suspended') ac.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
    ac = new AC(); master = ac.createGain(); master.gain.value = on ? 0.5 : 0; master.connect(ac.destination);
    nextT = ac.currentTime; timer = setInterval(sched, 60);
  },
  toggle() { on = !on; if (master) master.gain.value = on ? 0.5 : 0; return on; },
  setMode(m, l) { mode = m; level = l || level; step = 0; },
  setPower(p) { powered = p; },
  sfx(k) {
    if (!ac || !on) return; const t = ac.currentTime;
    if (k === 'eat') { const n = performance.now() / 1000; combo = n - lastEat < 0.7 ? combo + 1 : 0; lastEat = n;
      tone(nf(24 + (combo % 8) * 2), t, 0.13, 'triangle', 0.13); tone(nf(36 + (combo % 8) * 2), t, 0.08, 'square', 0.03); }
    if (k === 'power') { sweep(300, 1800, t, 0.35, 'sawtooth', 0.06); tone(nf(31), t, 0.08, 'square', 0.1); tone(nf(43), t + 0.07, 0.5, 'triangle', 0.2);
      [0, 4, 7, 12, 16].forEach((n, i) => tone(nf(n + 19), t + 0.12 + i * 0.06, 0.2, 'triangle', 0.16)); }
    if (k === 'cap') [24, 31, 36].forEach((n, i) => tone(nf(n), t + i * 0.07, 0.25, 'sine', 0.2));
    if (k === 'hit') [12, 6, 0, -6].forEach((n, i) => tone(nf(n), t + i * 0.1, 0.2, 'sawtooth', 0.1));
    if (k === 'win') [0, 4, 7, 12, 16, 19, 24].forEach((n, i) => tone(nf(n + 12), t + i * 0.09, 0.3, 'triangle', 0.18));
    if (k === 'lvl') [12, 19, 24].forEach((n, i) => tone(nf(n + 7), t + i * 0.08, 0.2, 'square', 0.07));
    if (k === 'bump') tone(nf(-12), t, 0.08, 'sine', 0.12);
    if (k === 'warn') tone(nf(-5), t, 0.1, 'sawtooth', 0.05);
  },
};
