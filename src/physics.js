// Small 2D rigid-body toolkit used by the game and unit-tested in Node (see /tests).
// Bodies are circles on the XZ plane: { x, z, vx, vz, r, m }.
export const G = 9.81;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

/** Fixed-timestep accumulator: physics always advances in equal slices, independent of frame rate. */
export class FixedStep {
  constructor(h = 1 / 120) { this.h = h; this.acc = 0; }
  run(dt, fn) { this.acc += Math.min(dt, 0.1); while (this.acc >= this.h) { fn(this.h); this.acc -= this.h; } }
}

/** Push a circle out of solid grid cells (cells are unit squares centred on integers).
 *  Normal impulse with restitution `e`, plus a touch of wall friction. Returns true on contact. */
export function collideGrid(b, isWall, e = 0.2) {
  let hit = false;
  for (let pass = 0; pass < 3; pass++) {
    let any = false;
    const c0 = Math.floor(b.x - b.r + 0.5), c1 = Math.floor(b.x + b.r + 0.5);
    const r0 = Math.floor(b.z - b.r + 0.5), r1 = Math.floor(b.z + b.r + 0.5);
    for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) {
      if (!isWall(c, r)) continue;
      const nx = clamp(b.x, c - 0.5, c + 0.5), nz = clamp(b.z, r - 0.5, r + 0.5);
      const dx = b.x - nx, dz = b.z - nz, d2 = dx * dx + dz * dz;
      if (d2 >= b.r * b.r) continue;
      let ux, uz, pen;
      const d = Math.sqrt(d2);
      if (d > 1e-6) { ux = dx / d; uz = dz / d; pen = b.r - d; }
      else {                                              // centre is inside the cell: leave by the nearest face
        const l = b.x - (c - 0.5), rt = c + 0.5 - b.x, t = b.z - (r - 0.5), bt = r + 0.5 - b.z, m = Math.min(l, rt, t, bt);
        if (m === l) { ux = -1; uz = 0; pen = l + b.r; } else if (m === rt) { ux = 1; uz = 0; pen = rt + b.r; }
        else if (m === t) { ux = 0; uz = -1; pen = t + b.r; } else { ux = 0; uz = 1; pen = bt + b.r; }
      }
      b.x += ux * pen; b.z += uz * pen;
      const vn = b.vx * ux + b.vz * uz;
      if (vn < 0) {
        b.vx -= (1 + e) * vn * ux; b.vz -= (1 + e) * vn * uz;
        const tx = -uz, tz = ux, vt = b.vx * tx + b.vz * tz, f = Math.min(Math.abs(vt), Math.abs(vn) * 0.08) * Math.sign(vt);
        b.vx -= f * tx; b.vz -= f * tz;
        b.impact = Math.max(b.impact || 0, -vn);
      }
      any = hit = true;
    }
    if (!any) break;
  }
  return hit;
}

/** Move a body toward a wished velocity with limited acceleration (inertia), drag, and swept sub-steps. */
export function stepBody(b, wishX, wishZ, dt, o) {
  const { tau = 0.1, maxAccel = 40, drag = 0.3, isWall, e = 0.2 } = o;
  let ax = (wishX - b.vx) / tau, az = (wishZ - b.vz) / tau;
  const am = Math.hypot(ax, az);
  if (am > maxAccel) { ax *= maxAccel / am; az *= maxAccel / am; }
  b.ax = ax; b.az = az;
  b.vx += ax * dt; b.vz += az * dt;
  const k = Math.exp(-drag * dt); b.vx *= k; b.vz *= k;
  const n = Math.max(1, Math.ceil(Math.hypot(b.vx, b.vz) * dt / (b.r * 0.5))); // never move > r/2 per sub-step: no tunnelling
  const h = dt / n;
  for (let i = 0; i < n; i++) { b.x += b.vx * h; b.z += b.vz * h; collideGrid(b, isWall, e); }
}

/** Circle-vs-circle collision: positional correction by mass ratio + impulse with restitution. */
export function collideBodies(a, b, e = 0.6) {
  const dx = b.x - a.x, dz = b.z - a.z, d = Math.hypot(dx, dz), min = a.r + b.r;
  if (d >= min || d < 1e-6) return null;
  const nx = dx / d, nz = dz / d, pen = min - d, ma = a.m || 1, mb = b.m || 1, t = ma + mb;
  a.x -= nx * pen * mb / t; a.z -= nz * pen * mb / t; b.x += nx * pen * ma / t; b.z += nz * pen * ma / t;
  const rv = (b.vx - a.vx) * nx + (b.vz - a.vz) * nz;
  if (rv < 0) {
    const j = -(1 + e) * rv / (1 / ma + 1 / mb);
    a.vx -= j * nx / ma; a.vz -= j * nz / ma; b.vx += j * nx / mb; b.vz += j * nz / mb;
  }
  return { nx, nz, speed: -rv };
}

/** Damped spring (semi-implicit Euler). s = { x, v }. Used for hover, banking and camera-feel. */
export function spring(s, target, k, c, dt) {
  s.v += (-k * (s.x - target) - c * s.v) * dt;
  s.x += s.v * dt;
  return s.x;
}

/** Ballistic particle: gravity, air drag, bouncy floor. p = { x, y, z, vx, vy, vz }. */
export function stepParticle(p, dt, { g = G, drag = 0.8, floor = 0.02, e = 0.45 } = {}) {
  p.vy -= g * dt;
  const k = Math.exp(-drag * dt); p.vx *= k; p.vy *= k; p.vz *= k;
  p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
  if (p.y < floor) { p.y = floor; if (p.vy < 0) p.vy = -p.vy * e; p.vx *= 0.8; p.vz *= 0.8; }
}
