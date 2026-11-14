// Bhool Bulayya game core: scene, fixed-step physics, AI, pickups, effects, input.
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { MAP, W, H, OX, OZ, START, SPAWNS, DIRS, isWall, listOrbs } from './maze.js';
import { FixedStep, stepBody, collideBodies, spring, stepParticle } from './physics.js';
import { makeJug, buildCoin, cloneCoin, makeImposter, makeSky, makeStars, makeEnv } from './models.js';
import { createMenu } from './menu.js';
import { sound } from './audio.js';
import { store } from './store.js';

const clamp = THREE.MathUtils.clamp, TAU = Math.PI * 2;
const $ = (id) => document.getElementById(id);
export const LEVELS = {
  beg: { name: 'Beginner', vmax: 3.3, gSpeed: 2.5, gFright: 1.5, ghosts: 2, power: 10, chase: 0.45, grace: 3.5 },
  adv: { name: 'Advance', vmax: 5.2, gSpeed: 4.1, gFright: 2.6, ghosts: 3, power: 8, chase: 0.7, grace: 2.5 },
};
const GHOSTS = [['Sparkvote', 0xff2e63], ['Flambus', 0xffb000], ['Aquasus', 0x00f0c8]];
const MAXP = 240;

export class Game {
  constructor(canvas) {
    this.canvas = canvas;
    const r = this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    r.toneMapping = THREE.ACESFilmicToneMapping; r.toneMappingExposure = 1.1;
    this.keys = {}; this.tj = { f: 0, s: 0 }; this.fixed = new FixedStep(1 / 120);
    this.reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.touch = matchMedia('(pointer: coarse)').matches;
    this.level = 'adv'; this.L = LEVELS.adv; this.view = 0; this.T = 0; this.fps = 60; this.lowT = 0; this.uiT = 0; this.mdown = false;
    this.hintsShown = new Set(); this.tid = 0; this.kick = 0; this.boost = 0; this.useBloom = true; this.quality = 'auto';
    try { const b = JSON.parse(localStorage.getItem('bb-best') || '{}'); this.best = { beg: b.beg || 0, adv: b.adv || 0 }; } catch { this.best = { beg: 0, adv: 0 }; }
    store.set({ best: this.best, touch: this.touch });
    this.buildGame(); this.menu = createMenu(); this.bindInput();
    this.resize(); addEventListener('resize', () => this.resize());
    this.reset(true); this.setView(0);
    this.last = performance.now(); this.frame = this.frame.bind(this); requestAnimationFrame(this.frame);
  }

  /* ---------------------------------------------------------------- scene */
  buildGame() {
    const r = this.renderer, scene = this.scene = new THREE.Scene();
    scene.fog = new THREE.Fog(0x5a1aa0, 9, 36);
    this.cam = new THREE.PerspectiveCamera(78, 1, 0.1, 200); this.cam.rotation.order = 'YXZ'; scene.add(this.cam);
    this.env = makeEnv(r); scene.environment = this.env;
    scene.add(makeSky(), makeStars(), new THREE.HemisphereLight(0xffe6ff, 0x5a2cc0, 1.6), new THREE.AmbientLight(0xb9a6ff, 0.8));
    const dl = new THREE.DirectionalLight(0xffffff, 2.2); dl.position.set(3, 8, 5); scene.add(dl);
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(W + 6, W + 6), new THREE.MeshStandardMaterial({ color: 0x2f1fa0, roughness: 0.55, metalness: 0.1, emissive: 0x160a60, emissiveIntensity: 0.9 }));
    floor.rotation.x = -Math.PI / 2; scene.add(floor);
    const grid = new THREE.GridHelper(W + 6, W + 6, 0xff5ad9, 0x3aa0ff); grid.position.y = 0.012; grid.material.transparent = true; grid.material.opacity = 0.5; scene.add(grid);

    /* walls: ONE instanced mesh + ONE merged line geometry = two draw calls for the whole maze */
    const wl = []; for (let r2 = 0; r2 < H; r2++) for (let c = 0; c < W; c++) if (MAP[r2][c] === '#') wl.push([c, r2]);
    const bg = new THREE.BoxGeometry(1, 1.3, 1), d = this.dummy = new THREE.Object3D(), col = new THREE.Color(), ea = [], eb = new THREE.EdgesGeometry(bg).attributes.position.array;
    const wm = new THREE.InstancedMesh(bg, new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.4, metalness: 0.15, emissive: 0x3a10aa, emissiveIntensity: 0.55, envMapIntensity: 0.6 }), wl.length);
    wl.forEach(([c, r2], i) => { d.position.set(c - OX, 0.65, r2 - OZ); d.updateMatrix(); wm.setMatrixAt(i, d.matrix); col.setHSL(0.72 + 0.22 * ((c / W + r2 / H) / 2), 0.9, 0.55); wm.setColorAt(i, col);
      for (let k = 0; k < eb.length; k += 3) ea.push(eb[k] + c - OX, eb[k + 1] + 0.65, eb[k + 2] + r2 - OZ); });
    scene.add(wm);
    const eg = new THREE.BufferGeometry(); eg.setAttribute('position', new THREE.Float32BufferAttribute(ea, 3)); scene.add(new THREE.LineSegments(eg, new THREE.LineBasicMaterial({ color: 0x6ef7ff })));

    /* orbs: one instanced mesh; power coins are real 3D logo coins */
    this.orbData = listOrbs(); let si = 0; this.orbData.forEach((o) => { if (!o.big) o.idx = si++; });
    this.orbMesh = new THREE.InstancedMesh(new THREE.SphereGeometry(0.1, 12, 8), new THREE.MeshStandardMaterial({ color: 0xffe14d, emissive: 0xffa800, emissiveIntensity: 2.2, roughness: 0.3 }), si);
    scene.add(this.orbMesh);
    this.coinT = buildCoin();
    this.orbData.forEach((o) => { if (o.big) { o.obj = cloneCoin(this.coinT, 0.26); scene.add(o.obj); } });

    /* particle pool (one draw call) */
    this.parts = Array.from({ length: MAXP }, () => ({ alive: false, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, l: 0, L: 1 }));
    this.pMesh = new THREE.InstancedMesh(new THREE.SphereGeometry(0.035, 6, 5), new THREE.MeshBasicMaterial({ color: 0xffffff }), MAXP);
    this.pMesh.frustumCulled = false; for (let i = 0; i < MAXP; i++) this.pMesh.setColorAt(i, col.set(0xffffff)); scene.add(this.pMesh);
    this.rings = []; this.ringGeo = new THREE.RingGeometry(0.2, 0.26, 32);

    /* imposters */
    this.ghosts = GHOSTS.map(([name, c], i) => {
      const mesh = makeImposter(c), coin = cloneCoin(this.coinT, 0.26); coin.visible = false; scene.add(mesh, coin);
      return { name, col: c, mesh, coin, b: { x: 0, z: 0, vx: 0, vz: 0, r: 0.3, m: 1.2 }, tile: SPAWNS[i].slice(), dir: [0, 0], wait: 0, active: true, caught: 0, face: 0, cp: { y: 0.3, vy: 0, rx: 0, wx: 0, ry: 0, wy: 0 } };
    });

    /* Jugnoo: first-person "viewmodel" is drawn in its own pass on top, so he can never clip into walls */
    this.PJ = makeJug(); this.PJ.jug.scale.setScalar(0.3); this.player = new THREE.Group(); this.player.add(this.PJ.jug);
    this.vmScene = new THREE.Scene(); this.vmRoot = new THREE.Group(); this.vmRoot.matrixAutoUpdate = false; this.vmScene.add(this.vmRoot);
    this.vmScene.environment = this.env; this.vmScene.add(new THREE.AmbientLight(0xb9a6ff, 1.2), new THREE.HemisphereLight(0xffe6ff, 0x5a2cc0, 1.4));
    const vdl = new THREE.DirectionalLight(0xffffff, 2); vdl.position.set(2, 4, 3); this.vmScene.add(vdl);
    this.glowL = new THREE.PointLight(0xff4fe0, 4, 6, 2); scene.add(this.glowL);

    /* post-processing: MSAA render target -> scene pass -> viewmodel pass -> bloom -> tone-map/output */
    const rt = new THREE.WebGLRenderTarget(2, 2, { type: THREE.HalfFloatType, samples: 4 });
    this.composer = new EffectComposer(r, rt);
    const p1 = new RenderPass(scene, this.cam), p2 = new RenderPass(this.vmScene, this.cam); p2.clear = false; p2.clearDepth = true;
    this.bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.7, 0.6, 0.85);
    this.composer.addPass(p1); this.composer.addPass(p2); this.composer.addPass(this.bloom); this.composer.addPass(new OutputPass());

    /* physics state */
    this.p = { x: START.x, z: START.z, vx: 0, vz: 0, r: 0.33, m: 1 };
    this.yaw = 0; this.pitch = 0; this.bank = { x: 0, v: 0 }; this.tilt = { x: 0, v: 0 }; this.hover = { x: 0, v: 0 };
    this.power = 0; this.inv = 0; this.moving = false; this.lastBump = 0; this.pt = [START.x, START.z];
  }

  setView(v) {
    this.view = v; if (this.player.parent) this.player.parent.remove(this.player);
    if (v === 0) { this.vmRoot.add(this.player); this.player.scale.setScalar(0.34); } else { this.scene.add(this.player); this.player.scale.setScalar(1); }
    store.set({ view: v });
  }
  setQuality(q) { this.quality = q; this.useBloom = q !== 'low'; this.resize(); store.set({ quality: q }); }
  resize() {
    const w = innerWidth, h = innerHeight, pr = this.quality === 'low' ? 1 : Math.min(devicePixelRatio || 1, 2);
    this.renderer.setPixelRatio(pr); this.renderer.setSize(w, h, false); this.composer.setPixelRatio(pr); this.composer.setSize(w, h);
    this.cam.aspect = w / h; this.cam.updateProjectionMatrix(); this.menu && this.menu.resize(w / h);
  }

  /* ---------------------------------------------------------------- flow */
  start(level) {
    sound.init(); this.level = level; this.L = LEVELS[level]; sound.setMode('game', level); this.hintsShown.clear();
    this.reset(true); store.set({ screen: 'howto', level, powerMax: this.L.power, guideOn: level === 'beg' });
  }
  begin() { sound.init(); store.set({ screen: 'play' }); this.lock(); this.hintAt = this.T + 0.5; this.hint('move', 'Move with W A S D · look with the mouse', 5000); }
  pause() { if (store.get().screen === 'play') { this.keys = {}; store.set({ screen: 'paused' }); } }
  resume() { store.set({ screen: 'play' }); this.lock(); }
  toMenu() { sound.setMode('menu'); sound.setPower(false); this.power = 0; store.set({ screen: 'menu', power: 0, danger: 0 }); try { document.exitPointerLock(); } catch {} }
  retry() { this.start(this.level); this.begin(); }
  toggleGuide() { store.set({ guideOn: !store.get().guideOn }); }
  toggleMini() { document.body.classList.toggle('nomini'); }
  lock() {
    if (this.touch) return;
    try { const p = this.canvas.requestPointerLock && this.canvas.requestPointerLock(); if (p && p.catch) p.catch(() => { this.noLock = true; }); } catch { this.noLock = true; }
  }
  reset(full) {
    const L = this.L;
    if (full) {
      this.orbData.forEach((o) => { o.alive = true; o.x = o.c; o.z = o.r; o.y = o.big ? 0.3 : 0.28; o.vx = o.vz = 0; o.mag = false; });
      this.score = 0; this.lives = 3; this.power = 0; this.captured = 0; this.left = this.orbData.length; this.total = this.left; this.ghosts.forEach((g) => { g.caught = 0; });
      sound.setPower(false);
    }
    const p = this.p; p.x = START.x; p.z = START.z; p.vx = p.vz = 0; this.yaw = 0; this.pitch = 0; this.inv = L.grace;
    this.ghosts.forEach((g, i) => {
      g.active = i < L.ghosts; g.b.x = SPAWNS[i][0]; g.b.z = SPAWNS[i][1]; g.b.vx = g.b.vz = 0; g.tile = SPAWNS[i].slice(); g.dir = [0, 0];
      g.wait = full ? 1 + i * 1.5 : 1.5 + i * 0.5; g.mesh.visible = false; g.coin.visible = g.active; g.cp = { y: 0.6, vy: 0, rx: 0, wx: 0, ry: 0, wy: 0 };
    });
    this.sync(true);
  }
  sync(force) {
    const s = store.get();
    store.set({ score: this.score, lives: this.lives, orbsLeft: this.left, total: this.total, captured: this.captured, ...(force ? { power: 0, danger: 0, won: false, newBest: false } : {}) });
  }
  addScore(n) { const o = Math.floor(this.score / 500); this.score += n; if (Math.floor(this.score / 500) > o) { this.toast('LEVEL UP!', 'up'); sound.sfx('lvl'); } this.sync(); this.bump(); }
  toast(text, kind = '') { store.set({ toast: { id: ++this.tid, text, kind } }); }
  hint(id, text, ms = 3500) {
    if (this.hintsShown.has(id)) return; this.hintsShown.add(id);
    const myId = ++this.tid; store.set({ hint: { id: myId, text } }); setTimeout(() => { if (store.get().hint && store.get().hint.id === myId) store.set({ hint: null }); }, ms);
  }
  finish(won) {
    sound.sfx(won ? 'win' : 'hit'); sound.setPower(false);
    const k = this.level, nb = this.score > this.best[k]; if (nb) { this.best[k] = this.score; try { localStorage.setItem('bb-best', JSON.stringify(this.best)); } catch {} }
    store.set({ screen: 'over', won, newBest: nb, best: { ...this.best }, power: 0, danger: 0 }); try { document.exitPointerLock(); } catch {}
  }

  /* ---------------------------------------------------------------- input */
  bindInput() {
    const mv = ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'KeyQ', 'KeyE'];
    const onKey = (e) => {
      const s = store.get().screen, down = e.type === 'keydown';
      if (mv.includes(e.code)) { this.keys[e.code] = down; if (s === 'play') e.preventDefault(); }
      if (!down) return;
      if (e.code === 'KeyV' && s !== 'menu') this.setView(1 - this.view);
      if (e.code === 'KeyM') this.toggleMini();
      if (e.code === 'KeyG' && s === 'play') this.toggleGuide();
      if (e.code === 'KeyP') { if (s === 'play') this.pause(); else if (s === 'paused') this.resume(); }
      if (e.code === 'Enter' && s === 'howto') this.begin();
    };
    addEventListener('keydown', onKey, true); addEventListener('keyup', onKey, true);
    addEventListener('blur', () => { this.keys = {}; });
    document.addEventListener('visibilitychange', () => { if (document.hidden) this.pause(); });
    document.addEventListener('pointerlockchange', () => {
      if (document.pointerLockElement === this.canvas) this.locked = true;
      else if (this.locked) { this.locked = false; this.pause(); }
    });
    const c = this.canvas;
    c.addEventListener('mousedown', () => { this.mdown = true; if (store.get().screen === 'play' && !this.locked) this.lock(); });
    addEventListener('mouseup', () => { this.mdown = false; });
    addEventListener('mousemove', (e) => {
      if (store.get().screen !== 'play') return;
      if (this.locked || this.mdown) { this.yaw -= e.movementX * 0.0024; this.pitch = clamp(this.pitch - e.movementY * 0.0024, -1.1, 1.1); }
    });
    let tm = null, tl = null;
    c.addEventListener('touchstart', (e) => { for (const t of e.changedTouches) { if (t.clientX < innerWidth / 2 && !tm) tm = { id: t.identifier, x: t.clientX, y: t.clientY }; else if (!tl) tl = { id: t.identifier, x: t.clientX, y: t.clientY }; } }, { passive: true });
    c.addEventListener('touchmove', (e) => {
      for (const t of e.changedTouches) {
        if (tm && t.identifier === tm.id) { this.tj.s = clamp((t.clientX - tm.x) / 40, -1, 1); this.tj.f = clamp(-(t.clientY - tm.y) / 40, -1, 1); }
        else if (tl && t.identifier === tl.id) { this.yaw -= (t.clientX - tl.x) * 0.007; this.pitch = clamp(this.pitch - (t.clientY - tl.y) * 0.005, -1.1, 1.1); tl.x = t.clientX; tl.y = t.clientY; }
      }
    }, { passive: true });
    const end = (e) => { for (const t of e.changedTouches) { if (tm && t.identifier === tm.id) { tm = null; this.tj.f = this.tj.s = 0; } if (tl && t.identifier === tl.id) tl = null; } };
    c.addEventListener('touchend', end); c.addEventListener('touchcancel', end);
    addEventListener('pointerdown', () => { sound.init(); if (store.get().screen === 'menu') this.menu.wave(this.T); });
  }

  /* ---------------------------------------------------------------- physics step (120 Hz) */
  step(h) {
    if (store.get().screen !== 'play') return;
    const L = this.L, P = this.p, k = this.keys;
    this.inv = Math.max(0, this.inv - h);
    if (this.power > 0) { this.power = Math.max(0, this.power - h); if (this.power === 0) sound.setPower(false); }
    const turn = (k.ArrowLeft ? 1 : 0) - (k.ArrowRight ? 1 : 0) + (k.KeyQ ? 1 : 0) - (k.KeyE ? 1 : 0); this.yaw += turn * 2.4 * h;
    let f = (k.KeyW || k.ArrowUp ? 1 : 0) - (k.KeyS || k.ArrowDown ? 1 : 0) + this.tj.f, s = (k.KeyD ? 1 : 0) - (k.KeyA ? 1 : 0) + this.tj.s;
    const l = Math.hypot(f, s); if (l > 1) { f /= l; s /= l; } this.moving = l > 0.05;
    const sy = Math.sin(this.yaw), cy = Math.cos(this.yaw);
    stepBody(P, (-sy * f + cy * s) * L.vmax, (-cy * f - sy * s) * L.vmax, h, { tau: 0.09, maxAccel: 70, drag: 0.25, isWall, e: 0.25 });
    if (P.impact) { if (P.impact > 2.2 && this.T - this.lastBump > 0.2) { sound.sfx('bump'); this.lastBump = this.T; } this.hover.v -= Math.min(P.impact, 6) * 0.12; P.impact = 0; }
    /* feel springs: bank into turns/strafes, pitch with acceleration, hover settles after bumps */
    const ar = P.ax * cy - P.az * sy, af = -P.ax * sy - P.az * cy;
    spring(this.bank, clamp(-ar / 110, -0.4, 0.4), 70, 9, h); spring(this.tilt, clamp(af / 260, -0.2, 0.2), 70, 9, h); spring(this.hover, 0, 90, 10, h);
    this.pt = [Math.round(P.x), Math.round(P.z)];

    /* pickups: orbs are magnetised toward Jugnoo's mouth, then caught */
    const cx = P.x - sy * 0.4, cz = P.z - cy * 0.4;
    for (const o of this.orbData) {
      if (!o.alive) continue;
      const d = Math.hypot(o.x - P.x, o.z - P.z);
      if (d < 1.15) {
        o.mag = true; const a = (1.15 - d) / 1.15, dx = cx - o.x, dz = cz - o.z, dd = Math.hypot(dx, dz) || 1, ease = Math.min(1, 10 * h);
        o.vx += ((dx / dd) * (1.5 + 6 * a) - o.vx) * ease; o.vz += ((dz / dd) * (1.5 + 6 * a) - o.vz) * ease;
        o.x += o.vx * h; o.z += o.vz * h; o.y += (0.32 - o.y) * Math.min(1, 8 * h);
      }
      if (Math.hypot(o.x - cx, o.z - cz) < 0.3 || d < 0.28) { this.collect(o); if (!this.left) return; }
    }

    /* imposters */
    for (const g of this.ghosts) if (g.active) this.stepGhost(g, h);
    const act = this.ghosts.filter((g) => g.active && g.wait <= 0);
    for (let i = 0; i < act.length; i++) for (let j = i + 1; j < act.length; j++) collideBodies(act[i].b, act[j].b, 0.3);
    for (const g of act) {
      if (Math.hypot(g.b.x - P.x, g.b.z - P.z) < P.r + g.b.r + 0.02) {
        if (this.power > 0) this.capture(g); else if (this.inv <= 0) { this.hurt(); break; } else collideBodies(P, g.b, 0.7);
      }
    }
  }
  collect(o) {
    o.alive = false; this.left--;
    const p = new THREE.Vector3(o.x - OX, o.y, o.z - OZ);
    if (o.big) { this.power = this.L.power; sound.setPower(true); this.addScore(50); this.toast('POWER COIN!', 'power'); sound.sfx('power'); this.fxCoin(p); }
    else { this.addScore(10); sound.sfx('eat'); this.fxOrb(p); if (!this.hintsShown.has('orb')) this.hint('orb', 'Nice! Eat every glowing orb', 2500); }
    this.sync(); if (!this.left) this.finish(true);
  }
  capture(g) {
    g.caught++; this.captured++; g.wait = 3; g.mesh.visible = false; g.coin.visible = true;
    g.cp = { y: 0.5, vy: 3.4, rx: 0, wx: 14, ry: 0, wy: 6 }; g.b.x = 7; g.b.z = 6; g.b.vx = g.b.vz = 0; g.tile = [7, 6]; g.dir = [0, 0];
    const q = new THREE.Vector3(g.mesh.position.x, 0.5, g.mesh.position.z);
    this.burst(q, 26, [0x22d6ff, 0xd000e6, 0xffffff], 2.6, 1.2); this.ring(q, 0x22d6ff, 4); this.popText(q, '+200', '#7fdcff'); this.flash('rgba(208,0,230,.5)', 0.7);
    this.toast('COINED!', 'power'); sound.sfx('cap'); this.addScore(200);
  }
  hurt() {
    this.lives--; sound.sfx('hit'); this.flash('rgba(255,40,70,.8)', 0.9); this.sync();
    if (this.lives <= 0) { this.finish(false); return; }
    this.toast('Ouch! Try again', 'hit'); const p = this.p; p.x = START.x; p.z = START.z; p.vx = p.vz = 0; this.inv = this.L.grace;
    this.ghosts.forEach((g, i) => { g.b.x = SPAWNS[i][0]; g.b.z = SPAWNS[i][1]; g.b.vx = g.b.vz = 0; g.tile = SPAWNS[i].slice(); g.dir = [0, 0]; g.wait = 1.5 + i * 0.5; g.mesh.visible = false; g.coin.visible = g.active; g.cp = { y: 0.6, vy: 0, rx: 0, wx: 0, ry: 0, wy: 0 }; });
  }

  /* imposter AI: choose a direction at each tile centre, then steer a physical body there */
  pick(g) {
    const [c, r] = g.tile, p = this.pt; let o = DIRS.filter((d) => !isWall(c + d[0], r + d[1]));
    const nr = o.filter((d) => !(d[0] === -g.dir[0] && d[1] === -g.dir[1])); if (nr.length) o = nr; if (!o.length) return g.dir;
    if (Math.random() > (this.power > 0 ? 0.5 : this.L.chase)) return o[(Math.random() * o.length) | 0];
    const sc = (d) => Math.hypot(c + d[0] - p[0], r + d[1] - p[1]); o.sort((a, b) => sc(a) - sc(b)); return this.power > 0 ? o[o.length - 1] : o[0];
  }
  stepGhost(g, h) {
    const b = g.b;
    if (g.wait > 0) {
      g.wait -= h; const c = g.cp; c.vy -= 9.81 * h; c.y += c.vy * h; if (c.y < 0.27) { c.y = 0.27; if (c.vy < 0) c.vy = -c.vy * 0.55; if (Math.abs(c.vy) < 0.5) { c.vy = 0; c.wx *= Math.exp(-3 * h); c.wy *= Math.exp(-3 * h); } }
      c.rx += c.wx * h; c.ry += c.wy * h;
      if (g.wait <= 0) { g.coin.visible = false; g.mesh.visible = true; this.burst(new THREE.Vector3(b.x - OX, 0.4, b.z - OZ), 10, [0xffffff, g.col], 1.4, 0.8); }
      return;
    }
    let dx = g.tile[0] - b.x, dz = g.tile[1] - b.z, d = Math.hypot(dx, dz);
    if (d < 0.14) { const dir = this.pick(g); g.dir = dir; g.tile = [g.tile[0] + dir[0], g.tile[1] + dir[1]]; dx = g.tile[0] - b.x; dz = g.tile[1] - b.z; d = Math.hypot(dx, dz) || 1; }
    const sp = this.power > 0 ? this.L.gFright : this.L.gSpeed;
    stepBody(b, (dx / d) * sp, (dz / d) * sp, h, { tau: 0.18, maxAccel: 30, drag: 0.1, isWall, e: 0.1 });
  }

  /* ---------------------------------------------------------------- effects */
  burst(p, n, cols, sp, up) {
    if (this.reduce) n = Math.ceil(n / 3); const col = new THREE.Color();
    for (let i = 0, k = 0; i < MAXP && k < n; i++) { const q = this.parts[i]; if (q.alive) continue;
      const a = Math.random() * TAU, e = (Math.random() - 0.3) * 1.2, v = sp * (0.5 + Math.random());
      Object.assign(q, { alive: true, x: p.x, y: p.y, z: p.z, vx: Math.cos(a) * Math.cos(e) * v, vy: Math.sin(e) * v + up, vz: Math.sin(a) * Math.cos(e) * v, l: 0.8, L: 0.8 });
      this.pMesh.setColorAt(i, col.set(cols[k % cols.length])); k++; }
    if (this.pMesh.instanceColor) this.pMesh.instanceColor.needsUpdate = true;
  }
  ring(p, color, s) {
    const m = new THREE.Mesh(this.ringGeo, new THREE.MeshBasicMaterial({ color, transparent: true, side: THREE.DoubleSide, depthWrite: false })); m.position.copy(p); m.rotation.x = -Math.PI / 2;
    this.scene.add(m); this.rings.push({ m, l: 0.6, s });
  }
  popText(p, txt, color) {
    const v = p.clone().project(this.cam); if (v.z > 1 || store.get().screen !== 'play') return;
    const d = document.createElement('div'); d.className = 'pop'; d.textContent = txt; if (color) d.style.color = color;
    d.style.left = (v.x * 0.5 + 0.5) * innerWidth + 'px'; d.style.top = (-v.y * 0.5 + 0.5) * innerHeight + 'px'; $('fx').appendChild(d); setTimeout(() => d.remove(), 950);
  }
  flash(color, a) {
    if (this.reduce) a *= 0.35; const f = $('flash'); if (!f) return;
    f.style.transition = 'none'; f.style.background = `radial-gradient(circle,transparent 40%,${color} 140%)`; f.style.opacity = a;
    requestAnimationFrame(() => requestAnimationFrame(() => { f.style.transition = 'opacity .45s'; f.style.opacity = 0; }));
  }
  bump() { const e = document.querySelector('.score .num'); if (e) { e.classList.remove('bump'); void e.offsetWidth; e.classList.add('bump'); } }
  fxOrb(p) { this.burst(p, 8, [0xffe14d, 0xfff2a8, 0xffffff], 1.4, 0.8); this.popText(p, '+10'); this.flash('rgba(255,225,77,.3)', 0.5); this.boost = Math.max(this.boost, 0.6); }
  fxCoin(p) { this.burst(p, 34, [0x22d6ff, 0xd000e6, 0xffffff, 0xffe14d], 2.8, 1.2); this.ring(p, 0x22d6ff, 5); this.ring(p, 0xff6df0, 3.4); this.popText(p, '+50 POWER!', '#7fdcff'); this.flash('rgba(34,214,255,.65)', 0.9); if (!this.reduce) this.kick = 14; this.boost = 1.4; }

  /* ---------------------------------------------------------------- frame */
  frame(now) {
    requestAnimationFrame(this.frame);
    const dt = Math.min((now - this.last) / 1000, 0.1); this.last = now; this.T += dt;
    const screen = store.get().screen;
    if (screen === 'menu') { this.menu.update(this.T); this.renderer.setRenderTarget(null); this.renderer.render(this.menu.scene, this.menu.camera); return; }
    if (screen === 'play') {
      this.fixed.run(dt, (h) => this.step(h));
      this.fps += (1 / Math.max(dt, 1e-3) - this.fps) * 0.05;
      if (this.quality === 'auto' && this.useBloom && this.fps < 38) { this.lowT += dt; if (this.lowT > 3) { this.useBloom = false; this.renderer.setPixelRatio(1); this.resize(); } } else this.lowT = 0;
    }
    this.update(dt, screen); this.render();
  }
  update(dt, screen) {
    const T = this.T, P = this.p, d = this.dummy, cam = this.cam, ex = P.x - OX, ez = P.z - OZ;
    /* orbs + coins */
    for (const o of this.orbData) {
      const bob = o.mag ? 0 : Math.sin(T * 3 + o.c) * 0.03;
      if (o.big) { if (o.obj) { o.obj.visible = o.alive; o.obj.position.set(o.x - OX, o.y + bob, o.z - OZ); o.obj.rotation.y = T * 2.5; } }
      else { d.position.set(o.x - OX, o.y + bob, o.z - OZ); d.rotation.set(0, 0, 0); d.scale.setScalar(o.alive ? 1 : 0); d.updateMatrix(); this.orbMesh.setMatrixAt(o.idx, d.matrix); }
    }
    this.orbMesh.instanceMatrix.needsUpdate = true;
    /* particles + rings (ballistic physics) */
    for (let i = 0; i < MAXP; i++) {
      const q = this.parts[i];
      if (q.alive) { q.l -= dt; if (q.l <= 0) q.alive = false; else stepParticle(q, dt); }
      d.position.set(q.x, q.y, q.z); d.rotation.set(0, 0, 0); d.scale.setScalar(q.alive ? q.l / q.L : 0); d.updateMatrix(); this.pMesh.setMatrixAt(i, d.matrix);
    }
    this.pMesh.instanceMatrix.needsUpdate = true;
    for (let i = this.rings.length - 1; i >= 0; i--) { const r = this.rings[i]; r.l -= dt;
      if (r.l <= 0) { this.scene.remove(r.m); r.m.material.dispose(); this.rings.splice(i, 1); continue; }
      const k = 1 - r.l / 0.6; r.m.scale.setScalar(1 + k * r.s); r.m.material.opacity = 1 - k; }
    this.kick *= Math.pow(0.001, dt); this.boost *= Math.pow(0.02, dt);
    const fov = 78 + this.kick; if (Math.abs(cam.fov - fov) > 0.01) { cam.fov = fov; cam.updateProjectionMatrix(); }
    /* imposters */
    let danger = 0;
    for (const g of this.ghosts) {
      if (!g.active) { g.mesh.visible = false; g.coin.visible = false; continue; }
      const b = g.b;
      if (g.wait > 0) { g.coin.position.set(b.x - OX, g.cp.y, b.z - OZ); g.coin.rotation.set(g.cp.rx, g.cp.ry, 0); continue; }
      g.mesh.position.set(b.x - OX, Math.abs(Math.sin(T * 8 + g.col)) * 0.04, b.z - OZ);
      if (Math.hypot(b.vx, b.vz) > 0.3) { let da = Math.atan2(b.vx, b.vz) - g.face; da = Math.atan2(Math.sin(da), Math.cos(da)); g.face += da * Math.min(1, dt * 10); } g.mesh.rotation.y = g.face;
      const m = g.mesh.userData.mat, fright = this.power > 0, c = fright ? (this.power < 2 && Math.sin(T * 20) > 0 ? 0xffffff : 0x3a7bff) : g.col; m.color.setHex(c); m.emissive.setHex(c);
      if (!fright && screen === 'play') { const dd = Math.hypot(b.x - P.x, b.z - P.z); danger = Math.max(danger, clamp(1 - (dd - 1.5) / 3.5, 0, 1)); if (dd < 3.5) this.hint('imp', 'Imposter close! Keep moving', 2500); }
    }
    /* camera: FIXED eye height, never bobs */
    if (this.view === 0) { cam.position.set(ex, 0.55, ez); cam.rotation.set(this.pitch, this.yaw, 0);
      this.player.position.set(0, -0.3 + this.hover.x, -0.6); this.player.rotation.set(0.12 + this.tilt.x, Math.PI, this.bank.x); }
    else { let dd = 1.9; while (dd > 0.45 && this.collidesPoint(P.x + Math.sin(this.yaw) * dd, P.z + Math.cos(this.yaw) * dd)) dd -= 0.1;
      cam.position.set(ex + Math.sin(this.yaw) * dd, 1.25, ez + Math.cos(this.yaw) * dd); cam.lookAt(ex, 0.5, ez);
      this.player.position.set(ex, 0.42, ez); this.player.rotation.set(this.tilt.x, this.yaw + Math.PI, this.bank.x); }
    cam.updateMatrixWorld(); this.vmRoot.matrix.copy(cam.matrixWorld); this.vmRoot.matrixWorldNeedsUpdate = true;
    this.player.visible = this.inv <= 0 || Math.sin(T * 30) > 0;
    this.PJ.fly(T, this.moving, this.boost); this.glowL.position.set(ex, 0.5, ez); this.glowL.intensity = 2 + this.boost * 6 + (this.PJ.pl.intensity - 2) * 0.4;
    if (screen !== 'play') return;
    /* HUD feed (throttled) + minimap */
    this.uiT += dt;
    if (this.uiT > 0.1) {
      this.uiT = 0; let best = 1e9, ang = 0;
      for (const o of this.orbData) { if (!o.alive) continue; const dx = o.x - P.x, dz = o.z - P.z, dd = dx * dx + dz * dz; if (dd < best) { best = dd; const fx = -Math.sin(this.yaw), fz = -Math.cos(this.yaw); ang = Math.atan2(dx * Math.cos(this.yaw) - dz * Math.sin(this.yaw), dx * fx + dz * fz); } }
      const s = store.get(), pw = Math.round(this.power * 10) / 10, dg = Math.round(danger * 20) / 20, gd = Math.round(ang * 20) / 20;
      if (s.power !== pw || s.danger !== dg || s.guide !== gd) store.set({ power: pw, danger: dg, guide: gd });
      if (danger > 0.55 && T - (this.lastWarn || 0) > 0.55) { sound.sfx('warn'); this.lastWarn = T; }
      if (!this.hintsShown.has('power') && this.orbData.some((o) => o.big && o.alive && Math.hypot(o.x - P.x, o.z - P.z) < 4)) this.hint('power', 'Grab a Power Coin, then touch the blue imposters!', 4000);
    }
    this.minimap();
  }
  collidesPoint(x, z) { const c = Math.round(x), r = Math.round(z); return isWall(c, r); }
  minimap() {
    const cv = $('mm'); if (!cv) return; const m = cv.getContext('2d'), P = this.p; m.clearRect(0, 0, 150, 130);
    for (let r = 0; r < H; r++) for (let c = 0; c < W; c++) if (MAP[r][c] === '#') { m.fillStyle = '#5b2cff'; m.fillRect(c * 10, r * 10, 10, 10); }
    for (const o of this.orbData) if (o.alive) { m.fillStyle = o.big ? '#7fdcff' : '#ffe14d'; const s = o.big ? 6 : 2, off = o.big ? 2 : 4; m.fillRect(o.c * 10 + off, o.r * 10 + off, s, s); }
    for (const g of this.ghosts) { if (!g.active || g.wait > 0) continue; m.fillStyle = this.power > 0 ? '#5a8bff' : '#' + g.col.toString(16).padStart(6, '0'); m.beginPath(); m.arc(g.b.x * 10 + 5, g.b.z * 10 + 5, 4, 0, TAU); m.fill(); }
    const px = P.x * 10 + 5, pz = P.z * 10 + 5, fx = -Math.sin(this.yaw), fz = -Math.cos(this.yaw); m.fillStyle = '#ff6df0'; m.beginPath();
    m.moveTo(px + fx * 7, pz + fz * 7); m.lineTo(px - fx * 4 - fz * 4, pz - fz * 4 + fx * 4); m.lineTo(px - fx * 4 + fz * 4, pz - fz * 4 - fx * 4); m.fill();
  }
  render() {
    const r = this.renderer;
    if (this.useBloom) { this.composer.render(); return; }
    r.setRenderTarget(null); r.autoClear = true; r.render(this.scene, this.cam);
    if (this.view === 0) { r.autoClear = false; r.clearDepth(); r.render(this.vmScene, this.cam); r.autoClear = true; }
  }
}
