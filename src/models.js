// All 3D asset builders: Jugnoo (firefly hero), the logo coin, imposters, sky, stars, environment map.
import * as THREE from 'three';
const clamp = THREE.MathUtils.clamp, TAU = Math.PI * 2;
const mat = (c, r = 0.6, o = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: r, metalness: 0, envMapIntensity: 0.4, ...o });
function sph(r, sx, sy, sz, m, x, y, z, p) {
  const s = new THREE.Mesh(new THREE.SphereGeometry(r, 20, 14), m);
  s.scale.set(sx, sy, sz); s.position.set(x, y, z); p.add(s); return s;
}

/* ---------------- Jugnoo ---------------- */
export function makeJug() {
  const jug = new THREE.Group(), body = mat(0x2fa8ff, 0.45), legM = mat(0x2a46d8, 0.5), dark = mat(0x0a1630, 0.12);
  const glowM = mat(0xff9af0, 0.4, { emissive: 0xff3dc8, emissiveIntensity: 1 });
  const head = new THREE.Group(); head.position.set(0, 0.95, 0.9); jug.add(head); sph(0.58, 1.1, 0.95, 1, body, 0, 0, 0, head);
  const eyes = new THREE.Group(); head.add(eyes);
  [-1, 1].forEach((s) => { const g = new THREE.Group(); g.position.set(s * 0.3, 0.08, 0); eyes.add(g);
    sph(0.27, 1, 1.05, 0.55, mat(0xffffff, 0.4), 0, 0, 0.42, g); sph(0.22, 1, 1.05, 1, dark, 0, 0, 0.46, g);
    sph(0.06, 1, 1, 1, mat(0xffffff, 0.2, { emissive: 0xffffff, emissiveIntensity: 0.8 }), 0.06, 0.09, 0.66, g); });
  const sm = new THREE.Mesh(new THREE.TorusGeometry(0.15, 0.02, 8, 20, Math.PI), dark); sm.rotation.z = Math.PI; sm.position.set(0, -0.08, 0.52); head.add(sm);
  sph(0.52, 1, 0.95, 1.1, body, 0, 0.82, 0.05, jug);
  for (let i = 0; i < 4; i++) sph(0.46 - 0.03 * i, 1, 0.9, 0.8, glowM, 0, 0.78 - 0.06 * i, -0.5 - 0.42 * i, jug);
  const ants = [];
  [-1, 1].forEach((s) => { const g = new THREE.Group(); g.position.set(s * 0.2, 0.5, 0.1); head.add(g);
    const c = new THREE.CatmullRomCurve3([new THREE.Vector3(0, 0, 0), new THREE.Vector3(s * 0.12, 0.5, 0.1), new THREE.Vector3(s * 0.3, 0.95, 0.3), new THREE.Vector3(s * 0.5, 1.25, 0.6)]);
    g.add(new THREE.Mesh(new THREE.TubeGeometry(c, 12, 0.025, 6), legM));
    for (let k = 0; k <= 8; k += 2) { const p = c.getPoint(k / 8); sph(0.07 + (k / 8) * 0.015, 1, 1, 1, legM, p.x, p.y, p.z, g); }
    ants.push([g, s]); });
  /* six legs with two-bone inverse kinematics */
  const legs = [], tv = new THREE.Vector3(), UY = new THREE.Vector3(0, 1, 0), L1 = 0.55, L2 = 0.62;
  const cyl = () => { const m = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.035, 1, 8), legM); jug.add(m); return m; };
  const seg = (m, a, b) => { tv.subVectors(b, a); const l = tv.length(); m.position.copy(a).addScaledVector(tv, 0.5); m.scale.set(1, l, 1); m.quaternion.setFromUnitVectors(UY, tv.normalize()); };
  [-1, 1].forEach((s) => [0.38, 0.05, -0.3].forEach((z, k) => { const r = new THREE.Vector3(s * 1.05, 0.04, z + 0.3);
    legs.push({ s, k, h: new THREE.Vector3(s * 0.3, 0.5, z), r, c: r.clone(), a: cyl(), b: cyl(), kn: sph(0.06, 1, 1, 1, legM, 0, 0, 0, jug), ft: sph(0.07, 1.3, 0.6, 1.7, legM, 0, 0, 0, jug) }); }));
  const ik = (L) => { const u = new THREE.Vector3().subVectors(L.c, L.h), d = Math.min(Math.max(u.length(), 0.1), L1 + L2 - 0.02); u.normalize();
    const a = (L1 * L1 - L2 * L2 + d * d) / (2 * d), hh = Math.sqrt(Math.max(0, L1 * L1 - a * a)), p = new THREE.Vector3(L.s, 1.3, -0.2);
    p.addScaledVector(u, -p.dot(u)).normalize();
    const K = L.h.clone().addScaledVector(u, a).addScaledVector(p, hh), F = L.h.clone().addScaledVector(u, d);
    seg(L.a, L.h, K); seg(L.b, K, F); L.kn.position.copy(K); L.ft.position.copy(F); };
  legs.forEach(ik);
  /* elytra + wings with branching veins */
  const ely = [], wings = [], wmat = mat(0xdfe8ff, 0.3, { transparent: true, opacity: 0.4, side: THREE.DoubleSide, depthWrite: false });
  const vm = new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.85 });
  const ws = new THREE.Shape(); ws.moveTo(0, 0); ws.bezierCurveTo(0.6, 0.4, 1.8, 0.55, 2.7, 0.05); ws.bezierCurveTo(2, -0.35, 0.9, -0.45, 0, 0);
  const ep = ws.getPoints(24), vp = [], O = new THREE.Vector2(0, 0), mx2 = ep.length - 1, V = (x, y) => new THREE.Vector3(x, 0.004, -y);
  const vl = (pts) => { for (let q = 0; q < pts.length - 1; q++) vp.push(V(pts[q].x, pts[q].y), V(pts[q + 1].x, pts[q + 1].y)); };
  const bow = (A, B, n, b) => { const o = [], dx = B.x - A.x, dy = B.y - A.y, l = Math.hypot(dx, dy) || 1;
    for (let q = 0; q <= n; q++) { const t = q / n, w = Math.sin(Math.PI * t) * b; o.push(new THREE.Vector2(A.x + dx * t - dy / l * w, A.y + dy * t + dx / l * w)); } return o; };
  const ends = [4, 9, 14, 19, 24, 30, 37, 44].map((n) => Math.min(n, mx2)), bs = [0.05, 0.07, 0.06, 0.04, 0, -0.04, -0.05, -0.04];
  ends.forEach((ix, j) => { const pts = bow(O, ep[ix], 10, bs[j]); vl(pts); const F = pts[6]; [-2, 2].forEach((o) => vl(bow(F, ep[clamp(ix + o, 0, mx2)], 5, o * 0.012))); });
  for (let j = 0; j < ends.length - 1; j++) [0.35, 0.65, 0.85].forEach((t) => vl([O.clone().lerp(ep[ends[j]], t), O.clone().lerp(ep[ends[j + 1]], t)]));
  const mk = (sc) => { const g = new THREE.Group(), gm = new THREE.ShapeGeometry(ws, 24); gm.rotateX(-Math.PI / 2);
    g.add(new THREE.Mesh(gm, wmat)); g.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(vp), vm));
    g.add(new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(ep.map((p) => V(p.x, p.y))), vm)); g.scale.set(sc, 1, sc); return g; };
  [-1, 1].forEach((s) => { const e = new THREE.Group(); e.position.set(s * 0.28, 1.25, -0.05); jug.add(e);
    sph(0.34, 0.55, 2.3, 1.2, mat(0xdfe8ff, 0.25, { transparent: true, opacity: 0.5, side: THREE.DoubleSide, depthWrite: false }), 0, 0.75, 0, e); ely.push([e, s]);
    [[1, 0.12, -0.15, 0, 0], [0.72, 0.42, -0.38, -0.1, 0.7]].forEach((c) => { const p = new THREE.Group(); p.position.set(s * 0.3, 1.12 + c[3] * 0.5, c[2]); jug.add(p);
      const sw = new THREE.Group(); sw.rotation.y = s * c[1]; p.add(sw); const mi = new THREE.Group(); mi.scale.x = s; sw.add(mi); mi.add(mk(c[0])); wings.push([p, s, c[4], c[3]]); }); });
  /* glow */
  const cv = document.createElement('canvas'); cv.width = cv.height = 128; const cx = cv.getContext('2d'), gr = cx.createRadialGradient(64, 64, 0, 64, 64, 64);
  gr.addColorStop(0, 'rgba(255,110,240,.95)'); gr.addColorStop(1, 'rgba(255,110,240,0)'); cx.fillStyle = gr; cx.fillRect(0, 0, 128, 128);
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(cv), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  sp.scale.set(4, 4, 1); sp.position.set(0, 0.6, -1.7); jug.add(sp);
  const pl = new THREE.PointLight(0xff4fe0, 3, 5, 2); pl.position.set(0, 0.5, -1.7); jug.add(pl);

  const glow = (t, boost = 0, k = 1, rate = 2.4) => {
    const gl = 0.5 + 0.5 * Math.pow(Math.max(0, Math.sin(t * rate)), 1.5);
    glowM.emissiveIntensity = 0.7 + gl * 1.9 + boost * 2; pl.intensity = (2 + gl * 5 + boost * 8) * k; sp.material.opacity = Math.min(1, 0.45 + gl * 0.55 + boost * 0.3);
  };
  return { jug, head, eyes, pl, sp, glowM,
    /** hovering/flying pose. moving -> faster wing beat. */
    fly(t, moving, boost = 0) {
      const fa = moving ? 26 : 17;
      wings.forEach((w) => { w[0].rotation.z = w[1] * (0.5 + 0.55 * Math.sin(t * fa + w[2])); });
      ants.forEach((n) => { n[0].rotation.z = n[1] * 0.06 * Math.sin(t * 1.7 + n[1]); });
      ely.forEach((e) => { e[0].rotation.z = -e[1] * 0.95; e[0].rotation.x = -0.25; });
      legs.forEach((L) => { const d = L.r.clone(); d.x *= 0.7; d.y += 0.55 + 0.06 * Math.sin(t * 14 + L.k + L.s); d.z -= 0.35; L.c.lerp(d, 0.2); ik(L); });
      glow(t, boost);
    },
    /** standing pose on the leaf (menu); `wave` lifts the front-right leg. */
    idle(t, wave) {
      wings.forEach((w) => { w[0].rotation.z = w[1] * (0.22 + w[3] + 0.05 * Math.sin(t * 2.2 + w[2])); });
      ants.forEach((n) => { n[0].rotation.z = n[1] * 0.06 * Math.sin(t * 1.7 + n[1]); });
      ely.forEach((e) => { e[0].rotation.z = -e[1] * 0.55; e[0].rotation.x = -0.25; });
      legs.forEach((L) => { const d = L.r.clone(); d.z += 0.02 * Math.sin(t * 1.3 + L.k * 2 + L.s);
        if (wave && L.s === 1 && L.k === 0) d.set(0.85 + 0.15 * Math.sin(t * 9), 1.35, 0.8 + 0.08 * Math.sin(t * 9)); L.c.lerp(d, 0.2); ik(L); });
      eyes.scale.y = t % 4.2 < 0.14 ? 0.12 : 1; glow(t, 0, 1.6, 1.6);
    } };
}

/* ---------------- Logo coin ---------------- */
export function buildCoin() {
  const chrome = new THREE.MeshStandardMaterial({ color: 0xffffff, metalness: 0.7, roughness: 0.14, envMapIntensity: 1.9, emissive: 0xb8c4e6, emissiveIntensity: 0.35 });
  const blueDeep = new THREE.MeshPhysicalMaterial({ color: 0x2a5be0, metalness: 0.95, roughness: 0.14, clearcoat: 1, clearcoatRoughness: 0.05, envMapIntensity: 1.2 });
  const bandMat = new THREE.MeshPhysicalMaterial({ vertexColors: true, metalness: 0.9, roughness: 0.16, clearcoat: 1, clearcoatRoughness: 0.05, envMapIntensity: 1.2 });
  const magenta = new THREE.MeshPhysicalMaterial({ color: 0xd000e6, emissive: 0xa000b8, emissiveIntensity: 0.9, metalness: 0.6, roughness: 0.12, clearcoat: 1, envMapIntensity: 1.2 });
  const bandTop = new THREE.Color(0x22d6ff), bandBot = new THREE.Color(0x2424c4);
  const sector = (ro, ri, a0, a1) => { const s = new THREE.Shape(); s.moveTo(Math.cos(a0) * ro, Math.sin(a0) * ro); s.absarc(0, 0, ro, a0, a1, false); s.lineTo(Math.cos(a1) * ri, Math.sin(a1) * ri); s.absarc(0, 0, ri, a1, a0, true); s.closePath(); return s; };
  const disc = (r, hole) => { const s = new THREE.Shape(); s.absarc(0, 0, r, 0, TAU, false); if (hole) { const h = new THREE.Path(); h.absarc(0, 0, hole, 0, TAU, true); s.holes.push(h); } return s; };
  const ext = (shape, depth, bevel, m, z, x = 0, y = 0) => { const me = new THREE.Mesh(new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 3, curveSegments: 40 }), m); me.position.set(x, y, z); return me; };
  const G0 = 0.7, T = 0.07, coin = new THREE.Group();
  const face = () => { const f = new THREE.Group(), band = ext(sector(0.92, 0.6, G0 + 0.07, TAU - G0 - 0.07), 0.03, 0.015, bandMat, T + 0.02);
    const p = band.geometry.attributes.position, c = new Float32Array(p.count * 3), col = new THREE.Color();
    for (let i = 0; i < p.count; i++) { const t = clamp((1 - 0.75 * p.getY(i) + 0.25 * p.getX(i)) / 2, 0, 1); col.copy(bandTop).lerp(bandBot, t); c[i * 3] = col.r; c[i * 3 + 1] = col.g; c[i * 3 + 2] = col.b; }
    band.geometry.setAttribute('color', new THREE.BufferAttribute(c, 3)); f.add(band, ext(disc(0.3), 0.03, 0.015, blueDeep, T + 0.02), ext(disc(0.125), 0.04, 0.02, magenta, T + 0.05));
    [[1.35, 1.8], [2.05, 2.75], [3.55, 4.0], [4.3, 4.65], [5.0, 5.3]].forEach(([a, b]) => f.add(ext(sector(0.77, 0.74, a, b), 0.01, 0.008, chrome, T + 0.05)));
    f.add(ext(disc(0.055, 0.03), 0.01, 0.008, chrome, T + 0.05, Math.cos(1) * 0.8, Math.sin(1) * 0.8));
    const ball = new THREE.Mesh(new THREE.SphereGeometry(0.06, 16, 10), chrome); ball.position.set(Math.cos(3.8) * 0.76, Math.sin(3.8) * 0.76, T + 0.07); f.add(ball); return f; };
  const front = face(), back = face(); back.rotation.x = Math.PI;
  coin.add(ext(sector(1, 0.3, G0, TAU - G0), 0.14, 0.02, chrome, -0.07), ext(disc(0.3), 0.14, 0.02, blueDeep, -0.07), front, back); coin.position.x = -0.08;
  const h = new THREE.Group(); h.add(coin); return h;
}
export function cloneCoin(tpl, s) { const g = new THREE.Group(); g.add(tpl.clone()); g.scale.setScalar(s); return g; }

/* ---------------- Imposter ---------------- */
export function makeImposter(col) {
  const g = new THREE.Group(), m = new THREE.MeshStandardMaterial({ color: col, emissive: col, emissiveIntensity: 0.28, roughness: 0.4, envMapIntensity: 0.5 });
  const add = (geo, y, mm = m) => { const x = new THREE.Mesh(geo, mm); x.position.y = y; g.add(x); return x; };
  add(new THREE.CylinderGeometry(0.32, 0.32, 0.45, 16), 0.42); add(new THREE.SphereGeometry(0.32, 16, 12), 0.65); add(new THREE.SphereGeometry(0.32, 16, 12), 0.2);
  const v = new THREE.Mesh(new THREE.SphereGeometry(0.2, 12, 8), new THREE.MeshStandardMaterial({ color: 0xb8f2ff, emissive: 0x3aa8d8, emissiveIntensity: 0.6 })); v.scale.set(1.2, 0.7, 0.6); v.position.set(0, 0.6, 0.27); g.add(v);
  const p = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.4, 0.18), m); p.position.set(0, 0.42, -0.34); g.add(p);
  const k = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, 0.5), new THREE.MeshStandardMaterial({ color: 0xeeeeee, emissive: 0x888888 })); k.position.set(0.38, 0.4, 0.3); g.add(k);
  g.userData.mat = m; return g;
}

/* ---------------- Sky, stars, environment ---------------- */
export function makeSky() {
  const g = new THREE.SphereGeometry(90, 28, 18), p = g.attributes.position, c = [];
  const top = new THREE.Color(0x120660), mid = new THREE.Color(0x8a22e0), hor = new THREE.Color(0xff5ad9), col = new THREE.Color();
  for (let i = 0; i < p.count; i++) { const y = p.getY(i) / 90;
    if (y <= 0) col.copy(hor); else if (y < 0.35) col.copy(hor).lerp(mid, y / 0.35); else col.copy(mid).lerp(top, Math.min(1, (y - 0.35) / 0.65)); c.push(col.r, col.g, col.b); }
  g.setAttribute('color', new THREE.Float32BufferAttribute(c, 3));
  const sky = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false, depthWrite: false })); sky.renderOrder = -2; return sky;
}
export function makeStars() {
  const a = []; for (let i = 0; i < 320; i++) { const u = Math.random() * TAU, v = Math.random() * 0.9 + 0.1, r = 80; a.push(Math.cos(u) * Math.sqrt(1 - v * v) * r, v * r, Math.sin(u) * Math.sqrt(1 - v * v) * r); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(a, 3));
  return new THREE.Points(g, new THREE.PointsMaterial({ color: 0xffffff, size: 1.6, sizeAttenuation: false, fog: false, depthWrite: false }));
}
export function makeEnv(renderer) {
  const cv = document.createElement('canvas'); cv.width = 8; cv.height = 256; const g = cv.getContext('2d'), gr = g.createLinearGradient(0, 0, 0, 256);
  gr.addColorStop(0, '#b6a2ff'); gr.addColorStop(0.45, '#8a7be0'); gr.addColorStop(0.5, '#ffffff'); gr.addColorStop(0.55, '#7a5fd0'); gr.addColorStop(1, '#3a2a88'); g.fillStyle = gr; g.fillRect(0, 0, 8, 256);
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; const env = new THREE.Scene();
  env.add(new THREE.Mesh(new THREE.SphereGeometry(20, 32, 16), new THREE.MeshBasicMaterial({ map: tex, side: THREE.BackSide })));
  const panel = (c, w, h, x, y, z) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: c, side: THREE.DoubleSide })); m.position.set(x, y, z); m.lookAt(0, 0, 0); env.add(m); };
  panel(0xffffff, 10, 3, -8, 6, 8); panel(0xffffff, 3, 10, 9, 0, 6); panel(0xaad8ff, 8, 2, 0, -8, 6); panel(0xff66ff, 3, 6, -10, -2, -4); panel(0x66e0ff, 3, 6, 10, 3, -6); panel(0xffffff, 12, 2, 0, 10, -2);
  const t = new THREE.PMREMGenerator(renderer).fromScene(env, 0.02).texture; return t;
}
