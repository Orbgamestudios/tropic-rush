// Bakes the tile the world map's clouds are drawn from, so a phone only has to look it up. Domes
// piled on domes make the cauliflower tops of a deck of cumulus seen from above, on a slow swell of
// noise. Then the sun comes in low from the north-west, so each puff has a lit side and a shaded one
// and throws a shadow on the next. It tiles in both directions. Red is how thick the cloud is, and
// green how brightly it's lit.
//
//   node scripts/make-clouds.mjs

import sharp from "sharp";

const SIZE = 1024;
const OUT = "public/textures/map-clouds.webp";

/** The same noise every run. */
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const wrap = (i, n) => ((i % n) + n) % n;
const fade = (t) => t * t * t * (t * (t * 6 - 15) + 10);
const smooth = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/** Smooth noise over a grid that wraps round every `cells` cells. */
function valueLayer(cells, seed) {
  const random = rng(seed);
  const grid = Float32Array.from({ length: cells * cells }, () => random());
  return (x, y) => {
    const fx = x * cells;
    const fy = y * cells;
    const ix = Math.floor(fx);
    const iy = Math.floor(fy);
    const u = fade(fx - ix);
    const v = fade(fy - iy);
    const at = (i, j) => grid[wrap(j, cells) * cells + wrap(i, cells)];
    const top = at(ix, iy) + (at(ix + 1, iy) - at(ix, iy)) * u;
    const bottom = at(ix, iy + 1) + (at(ix + 1, iy + 1) - at(ix, iy + 1)) * u;
    return top + (bottom - top) * v;
  };
}

/** Round billows: the height of a dome over each scattered point, wrapping the same way. */
function puffLayer(cells, seed) {
  const random = rng(seed);
  const points = Float32Array.from({ length: cells * cells * 2 }, () => random());
  return (x, y) => {
    const fx = x * cells;
    const fy = y * cells;
    const ix = Math.floor(fx);
    const iy = Math.floor(fy);
    let nearest = 9;
    for (let j = -1; j <= 1; j++) {
      for (let i = -1; i <= 1; i++) {
        const k = (wrap(iy + j, cells) * cells + wrap(ix + i, cells)) * 2;
        const dx = ix + i + points[k] - fx;
        const dy = iy + j + points[k + 1] - fy;
        nearest = Math.min(nearest, dx * dx + dy * dy);
      }
    }
    return Math.sqrt(Math.max(0, 1 - nearest * 1.6));
  };
}

const swells = [4, 8, 16, 32, 64].map((cells, i) => ({
  layer: valueLayer(cells, 11 + i),
  weight: 0.5 ** i,
}));
const billows = [6, 13, 27, 55].map((cells, i) => ({
  layer: puffLayer(cells, 41 + i),
  weight: [1, 0.62, 0.34, 0.16][i],
}));

const sum = (list, x, y) => {
  let total = 0;
  let weight = 0;
  for (const { layer, weight: w } of list) {
    total += layer(x, y) * w;
    weight += w;
  }
  return total / weight;
};

const height = new Float32Array(SIZE * SIZE);
for (let py = 0; py < SIZE; py++) {
  for (let px = 0; px < SIZE; px++) {
    const x = px / SIZE;
    const y = py / SIZE;
    // Bent by itself, so nothing lines up with the grid underneath.
    const warpX = x + (swells[0].layer(x, y) - 0.5) * 0.035;
    const warpY = y + (swells[0].layer(y + 0.37, x + 0.61) - 0.5) * 0.035;
    const swell = smooth(0.3, 0.72, sum(swells, warpX, warpY));
    height[py * SIZE + px] = swell * 0.5 + sum(billows, warpX, warpY) * 0.5;
  }
}

/** The same picture, blurred: what's lower than this sits in a hollow. */
function blurred(source, radius) {
  const across = new Float32Array(SIZE * SIZE);
  const out = new Float32Array(SIZE * SIZE);
  const span = radius * 2 + 1;
  for (let y = 0; y < SIZE; y++) {
    let total = 0;
    for (let i = -radius; i <= radius; i++) total += source[y * SIZE + wrap(i, SIZE)];
    for (let x = 0; x < SIZE; x++) {
      across[y * SIZE + x] = total / span;
      total += source[y * SIZE + wrap(x + radius + 1, SIZE)];
      total -= source[y * SIZE + wrap(x - radius, SIZE)];
    }
  }
  for (let x = 0; x < SIZE; x++) {
    let total = 0;
    for (let i = -radius; i <= radius; i++) total += across[wrap(i, SIZE) * SIZE + x];
    for (let y = 0; y < SIZE; y++) {
      out[y * SIZE + x] = total / span;
      total += across[wrap(y + radius + 1, SIZE) * SIZE + x];
      total -= across[wrap(y - radius, SIZE) * SIZE + x];
    }
  }
  return out;
}

let lowest = 1;
let highest = 0;
for (const h of height) {
  lowest = Math.min(lowest, h);
  highest = Math.max(highest, h);
}
for (let k = 0; k < height.length; k++) height[k] = (height[k] - lowest) / (highest - lowest);

// Where one dome meets the next is a crease: a cloud's surface has no hard edges.
const soft = blurred(blurred(height, 3), 2);
height.set(soft);
const hollows = blurred(height, 12);
const STEPS = 22;
const STEP = 2;
/** How much a sun ray rises for each pixel it travels, against a height of 1 for the tallest cloud. */
const RISE = 0.0065;
/** How steep the surface reads for lighting. */
const RELIEF = 16;
const sun = [-Math.SQRT1_2, -Math.SQRT1_2];
const SUN_HIGH = 0.62;
const pixels = Buffer.alloc(SIZE * SIZE * 3);
for (let y = 0; y < SIZE; y++) {
  for (let x = 0; x < SIZE; x++) {
    const k = y * SIZE + x;
    const here = height[k];
    let blocked = 0;
    for (let s = 1; s <= STEPS; s++) {
      const along = s * STEP;
      const qx = wrap(Math.round(x + sun[0] * along), SIZE);
      const qy = wrap(Math.round(y + sun[1] * along), SIZE);
      const over = height[qy * SIZE + qx] - (here + along * RISE);
      if (over > 0) blocked += over;
    }
    const lit = Math.exp(-blocked * 0.55);
    const east = height[y * SIZE + wrap(x + 1, SIZE)] - height[y * SIZE + wrap(x - 1, SIZE)];
    const south = height[wrap(y + 1, SIZE) * SIZE + x] - height[wrap(y - 1, SIZE) * SIZE + x];
    const nx = -east * RELIEF;
    const ny = -south * RELIEF;
    const across = Math.hypot(nx, ny, 1);
    const facing = Math.max(0, (nx * sun[0] + ny * sun[1] + SUN_HIGH) / across / 1.2);
    const open = Math.min(1, Math.max(0, 1 - (hollows[k] - here) * 3));
    const light = (0.56 + 0.62 * facing * lit) * (0.76 + 0.24 * open);
    pixels[k * 3] = Math.round(here * 255);
    pixels[k * 3 + 1] = Math.round(Math.min(1, light) * 255);
    pixels[k * 3 + 2] = 0;
  }
}

await sharp(pixels, { raw: { width: SIZE, height: SIZE, channels: 3 } })
  .webp({ quality: 84 })
  .toFile(OUT);
console.log(`${OUT} written`);
