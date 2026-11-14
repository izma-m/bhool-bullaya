// Minimal observable store shared by the 3D game (writes) and the React UI (reads).
const listeners = new Set();
let state = {
  screen: 'menu',            // menu | howto | play | paused | over
  level: 'adv', score: 0, lives: 3, orbsLeft: 0, total: 1, captured: 0,
  power: 0, powerMax: 8, danger: 0, guide: 0, guideOn: false,
  toast: null, hint: null, won: false, newBest: false,
  best: { beg: 0, adv: 0 }, music: true, quality: 'auto', view: 0, touch: false,
};
export const store = {
  get: () => state,
  set(patch) { state = { ...state, ...patch }; listeners.forEach((f) => f()); },
  subscribe(f) { listeners.add(f); return () => listeners.delete(f); },
};
