// Level layout. '#' wall, '.' orb, '2' power coin. One tile = one world unit (~1 metre).
export const MAP = [
  '###############', '#2.....#.....2#', '#.###.#.#.###.#', '#.............#', '#.###.#.#.###.#',
  '#.....#.#.....#', '###.#.....#.###', '#.....#.#.....#', '#.###.#.#.###.#', '#.............#',
  '#.###.#.#.###.#', '#2....#.#....2#', '###############',
];
export const W = 15, H = 13, OX = 7, OZ = 6;                 // tile -> world: x = col - OX, z = row - OZ
export const START = { x: 7, z: 9 };
export const SPAWNS = [[6, 6], [7, 6], [8, 6]];
export const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];
export const isWall = (c, r) => r < 0 || r >= H || c < 0 || c >= W || MAP[r][c] === '#';
export function listOrbs() {
  const out = [];
  for (let r = 0; r < H; r++) for (let c = 0; c < W; c++) {
    const ch = MAP[r][c];
    if (ch === '.' || ch === '2') out.push({ c, r, big: ch === '2' });
  }
  return out;
}
