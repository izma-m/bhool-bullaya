import test from 'node:test';
import assert from 'node:assert/strict';
import { stepBody, collideGrid, collideBodies, spring, stepParticle } from '../src/physics.js';
import { isWall, START } from '../src/maze.js';

const body = (o = {}) => ({ x: START.x, z: START.z, vx: 0, vz: 0, r: 0.33, m: 1, ...o });

test('a body can never tunnel through a wall, even at absurd speed', () => {
  for (const [wx, wz] of [[0, -90], [0, 90], [90, 0], [-90, 0], [70, -70], [-70, 70]]) {
    const b = body();
    for (let i = 0; i < 1200; i++) {
      stepBody(b, wx, wz, 1 / 120, { isWall, tau: 0.03, maxAccel: 900 });
      assert.ok(!isWall(Math.round(b.x), Math.round(b.z)), `inside a wall at step ${i} for wish ${wx},${wz}`);
    }
  }
});

test('walking north stops flush against the wall (centre 0.33 from the wall face)', () => {
  const b = body();
  for (let i = 0; i < 1200; i++) stepBody(b, 0, -5, 1 / 120, { isWall, tau: 0.09, maxAccel: 70 });
  assert.ok(Math.abs(b.z - (1.5 + 0.33)) < 0.02, `z=${b.z}`);
});

test('restitution: a wall hit reverses and scales the normal velocity', () => {
  const b = body({ x: 7, z: 1.8, vz: -5 });
  collideGrid(b, isWall, 0.5);
  assert.ok(Math.abs(b.vz - 2.5) < 1e-6, `vz=${b.vz}`);
});

test('inertia: velocity ramps up instead of jumping, and bleeds off when released', () => {
  const b = body();
  stepBody(b, 5, 0, 1 / 120, { isWall, tau: 0.09, maxAccel: 70 });
  assert.ok(b.vx > 0 && b.vx < 1.5);
  for (let i = 0; i < 90; i++) stepBody(b, 5, 0, 1 / 120, { isWall, tau: 0.09, maxAccel: 70 });
  assert.ok(b.vx > 4.5);
  for (let i = 0; i < 240; i++) stepBody(b, 0, 0, 1 / 120, { isWall, tau: 0.09, maxAccel: 70 });
  assert.ok(Math.abs(b.vx) < 0.05);
});

test('equal-mass head-on collision conserves momentum and (e=1) swaps velocities', () => {
  const a = { x: 0, z: 0, vx: 3, vz: 0, r: 0.3, m: 1 }, b = { x: 0.5, z: 0, vx: -1, vz: 0, r: 0.3, m: 1 };
  collideBodies(a, b, 1);
  assert.ok(Math.abs(a.vx - -1) < 1e-9 && Math.abs(b.vx - 3) < 1e-9);
});

test('spring settles on its target', () => {
  const s = { x: 0, v: 0 };
  for (let i = 0; i < 4000; i++) spring(s, 1, 60, 12, 1 / 120);
  assert.ok(Math.abs(s.x - 1) < 1e-3);
});

test('particles bounce with energy loss and come to rest near the floor', () => {
  const p = { x: 0, y: 1, z: 0, vx: 0, vy: 0, vz: 0 };
  let maxAfterFirst = 0, bounced = false;
  for (let i = 0; i < 1200; i++) {
    stepParticle(p, 1 / 120);
    if (p.y <= 0.021) bounced = true; else if (bounced) maxAfterFirst = Math.max(maxAfterFirst, p.y);
  }
  assert.ok(bounced && maxAfterFirst < 0.5);
  assert.ok(p.y < 0.05);
});
