// Bakes the tile the world map's clouds are drawn from, so a phone only has to look it up. It's real
// shapes rather than noise: big balls of cloud on a slow swell, smaller ones sat on their surface,
// and smaller still on those, which is how the cauliflower top of a cumulus goes. Then the sun comes
// in low from the north-west, so each puff has a lit side and a shaded one and throws a shadow on
// the next. It tiles in both directions. Red is how thick the cloud is, and green how brightly it's
// lit.
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

const swellA = valueLayer(3, 11);
const swellB = valueLayer(7, 12);
/** Everything below is in pixels, height included, so a ball is lit as the ball it is. */
const height = new Float32Array(SIZE * SIZE);
for (let y = 0; y < SIZE; y++) {
  for (let x = 0; x < SIZE; x++) {
    height[y * SIZE + x] =
      (swellA(x / SIZE, y / SIZE) * 0.7 + swellB(x / SIZE, y / SIZE) * 0.3) * 150;
  }
}

/** Sets a ball of cloud on whatever's there, sunk in by a share of its size. */
function ball(cx, cy, radius, sunk) {
  const base =
    height[wrap(Math.round(cy), SIZE) * SIZE + wrap(Math.round(cx), SIZE)] - radius * sunk;
  const reach = Math.ceil(radius);
  for (let y = -reach; y <= reach; y++) {
    for (let x = -reach; x <= reach; x++) {
      const across = radius * radius - x * x - y * y;
      if (across <= 0) continue;
      const k = wrap(Math.round(cy) + y, SIZE) * SIZE + wrap(Math.round(cx) + x, SIZE);
      height[k] = Math.max(height[k], base + Math.sqrt(across));
    }
  }
}

const scatter = rng(77);
for (const { count, least, most, sunk } of [
  { count: 40, least: 90, most: 150, sunk: 0.62 },
  { count: 130, least: 46, most: 84, sunk: 0.56 },
  { count: 340, least: 22, most: 38, sunk: 0.5 },
]) {
  for (let i = 0; i < count; i++) {
    ball(scatter() * SIZE, scatter() * SIZE, least + (most - least) * scatter(), sunk);
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

height.set(blurred(blurred(height, 5), 4));

const hollows = blurred(height, 30);
const SUN = { x: -0.5, y: -0.5, z: 0.71 };
const REACH = 140;
const pixels = Buffer.alloc(SIZE * SIZE * 3);
const sorted = Float32Array.from(height).sort();
const lowest = sorted[Math.floor(sorted.length * 0.01)];
const highest = sorted[Math.floor(sorted.length * 0.995)];
for (let y = 0; y < SIZE; y++) {
  for (let x = 0; x < SIZE; x++) {
    const k = y * SIZE + x;
    const here = height[k];
    let shaded = 0;
    for (let along = 3; along < REACH; along += 3) {
      const qx = wrap(Math.round(x + SUN.x * along), SIZE);
      const qy = wrap(Math.round(y + SUN.y * along), SIZE);
      const ray = here + along * SUN.z;
      shaded = Math.max(shaded, Math.min(1, (height[qy * SIZE + qx] - ray) / 30));
    }
    const nx = -(height[y * SIZE + wrap(x + 1, SIZE)] - height[y * SIZE + wrap(x - 1, SIZE)]) / 2;
    const ny = -(height[wrap(y + 1, SIZE) * SIZE + x] - height[wrap(y - 1, SIZE) * SIZE + x]) / 2;
    const across = Math.hypot(nx, ny, 1);
    const facing = Math.max(0, ((nx * SUN.x + ny * SUN.y + SUN.z) / across + 0.35) / 1.35);
    const open = Math.min(1, Math.max(0, 1 - (hollows[k] - here) / 34));
    const light = (0.3 + 0.8 * facing * (1 - shaded * 0.7)) * (0.66 + 0.34 * open);
    pixels[k * 3] = Math.round(
      Math.min(1, Math.max(0, (here - lowest) / (highest - lowest))) * 255,
    );
    pixels[k * 3 + 1] = Math.round(Math.min(1, light) * 255);
    pixels[k * 3 + 2] = 0;
  }
}

await sharp(pixels, { raw: { width: SIZE, height: SIZE, channels: 3 } })
  .webp({ quality: 84 })
  .toFile(OUT);
console.log(`${OUT} written`);
