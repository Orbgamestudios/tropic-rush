// The sky dome's clouds, in the layers real ones keep to. Highest are cirrus, thin streaks drawn out
// by the wind, slowest across the sky, and the last to lose the sun at dusk: from ten kilometers up
// it's still above their horizon after it's set on ours. Below them, altocumulus: patches of small
// cloudlets in rows. Lowest are cumulus: scattered heaps overhead, dark underneath, and banks of
// them round the horizon with flat bases and sunlit tops, the furthest towering. Every layer is a
// sheet over a curved Earth looked up at, so it drifts at its own speed and bunches towards the
// horizon by its own height, and is drawn from one small baked texture: four patterns in its four
// channels, so one lookup gives every pattern a layer wants at that spot. That keeps the whole
// dome to seven lookups a pixel, the same as when it had one plain layer.

import * as THREE from "three";
import { createRng, type Rng } from "../logic/rng";
import { clamp } from "../logic/vec";

const SIZE = 256;

/** Smooth random values on a lattice that repeats every `wide` by `high` cells. */
function lattice(rng: Rng, wide: number, high: number) {
  const cells = Float32Array.from({ length: wide * high }, () => rng());
  return (x: number, y: number): number => {
    const fx = Math.floor(x);
    const fy = Math.floor(y);
    const ux = (x - fx) ** 2 * (3 - 2 * (x - fx));
    const uy = (y - fy) ** 2 * (3 - 2 * (y - fy));
    const x0 = ((fx % wide) + wide) % wide;
    const y0 = ((fy % high) + high) % high;
    const x1 = (x0 + 1) % wide;
    const y1 = (y0 + 1) % high;
    const a = cells[y0 * wide + x0] ?? 0;
    const b = cells[y0 * wide + x1] ?? 0;
    const c = cells[y1 * wide + x0] ?? 0;
    const d = cells[y1 * wide + x1] ?? 0;
    const top = a + (b - a) * ux;
    return top + (c + (d - c) * ux - top) * uy;
  };
}

/** Octaves of lattice noise, each `[cells across, cells down, weight]`; u and v run 0 to 1. */
function layered(
  rng: Rng,
  octaves: readonly (readonly [number, number, number])[],
  billow = false,
) {
  const noise = octaves.map(([wide, high, weight]) => ({
    wide,
    high,
    weight,
    at: lattice(rng, wide, high),
  }));
  return (u: number, v: number): number => {
    let sum = 0;
    for (const { wide, high, weight, at } of noise) {
      const n = at(u * wide, v * high);
      sum += (billow ? Math.abs(n * 2 - 1) : n) * weight;
    }
    return sum;
  };
}

/** Stretches every value to fill 0 to 1. */
function spread(values: Float32Array): void {
  let low = Number.POSITIVE_INFINITY;
  let high = Number.NEGATIVE_INFINITY;
  for (const v of values) {
    low = Math.min(low, v);
    high = Math.max(high, v);
  }
  for (let i = 0; i < values.length; i++) values[i] = ((values[i] ?? 0) - low) / (high - low);
}

/**
 * Round puffs scattered on a grid, `cells` across, each a dome highest at its middle: the
 * altocumulus' cloudlets.
 */
function cloudlets(rng: Rng, cells: number): (u: number, v: number) => number {
  const points = Array.from({ length: cells * cells }, () => ({
    x: 0.15 + rng() * 0.7,
    y: 0.15 + rng() * 0.7,
    size: 0.38 + rng() * 0.3,
  }));
  return (u, v) => {
    const x = u * cells;
    const y = v * cells;
    const cx = Math.floor(x);
    const cy = Math.floor(y);
    let most = 0;
    for (let j = -1; j <= 1; j++) {
      for (let i = -1; i <= 1; i++) {
        const px = cx + i;
        const py = cy + j;
        const p =
          points[(((py % cells) + cells) % cells) * cells + (((px % cells) + cells) % cells)];
        if (!p) continue;
        const gap = Math.hypot(px + p.x - x, py + p.y - y) / p.size;
        if (gap < 1) most = Math.max(most, Math.sqrt(1 - gap * gap));
      }
    }
    return most;
  };
}

let texture: THREE.DataTexture | null = null;

/**
 * The four patterns, repeating every texture's width. Red: big soft heaps, for cumulus and for
 * where patches of the higher layers are. Green: fine streaks along the width, bent by the wind,
 * for cirrus; along the width alone it's a slow rise and fall, the far banks' outline. Blue:
 * cloudlets. Alpha: small billows, which eat into every edge so none is smooth.
 */
export function cloudTexture(): THREE.DataTexture {
  if (texture) return texture;
  const rng = createRng(0xc10d);
  const heaps = layered(rng, [
    [4, 4, 1],
    [8, 8, 0.5],
    [16, 16, 0.25],
    [32, 32, 0.12],
  ]);
  const bend = layered(rng, [
    [2, 2, 1],
    [4, 4, 0.5],
  ]);
  const streaks = layered(rng, [
    [2, 12, 1],
    [4, 24, 0.6],
    [8, 48, 0.3],
  ]);
  const threads = lattice(rng, 6, 64);
  const puffs = cloudlets(rng, 16);
  const billows = layered(
    rng,
    [
      [16, 16, 1],
      [32, 32, 0.5],
      [64, 64, 0.25],
    ],
    true,
  );
  const count = SIZE * SIZE;
  const channels = [0, 1, 2, 3].map(() => new Float32Array(count));
  const [red, green, blue, alpha] = channels as [
    Float32Array,
    Float32Array,
    Float32Array,
    Float32Array,
  ];
  for (let j = 0; j < SIZE; j++) {
    for (let i = 0; i < SIZE; i++) {
      const u = i / SIZE;
      const v = j / SIZE;
      const k = j * SIZE + i;
      red[k] = heaps(u, v);
      const bent = v + (bend(u, v) - 0.75) * 0.18;
      // Thin bright threads where the fine noise crosses its middle, inside the broader streaks.
      const thread = 1 - Math.abs(threads(u * 6, bent * 64) * 2 - 1);
      green[k] = streaks(u, bent) * 0.75 + thread * thread * 0.25;
      blue[k] = puffs(u, v);
      alpha[k] = billows(u, v);
    }
  }
  for (const c of channels) spread(c);
  const data = new Uint8Array(count * 4);
  for (let k = 0; k < count; k++) {
    for (let c = 0; c < 4; c++) data[k * 4 + c] = Math.round((channels[c]?.[k] ?? 0) * 255);
  }
  texture = new THREE.DataTexture(data, SIZE, SIZE, THREE.RGBAFormat);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.magFilter = THREE.LinearFilter;
  // Towards the horizon a pixel spans many repeats: mipmaps average them into haze, not glitter.
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.generateMipmaps = true;
  texture.needsUpdate = true;
  return texture;
}

/** How far the banks go round the sky before their outline repeats. */
const BANK_REPEATS = 5;

/**
 * Draws the layers over `color`, back to front. Expects `d` (the unit direction looked along),
 * `bearing` (which way round it points, flattened), `color`, and the uniforms below.
 */
export const CLOUD_LAYERS = /* glsl */ `
  uniform sampler2D uClouds;
  /** How much of each layer there is, 0 to 1: low heaps, middle, high, and the banks. */
  uniform vec4 uCover;
  /** Towards whatever lights the clouds: the sun, or the moon once it's dark. */
  uniform vec3 uLight;
  /** How strongly thin cloud shines with the light behind it. */
  uniform float uScatter;
  uniform vec3 uHighLit;
  uniform vec3 uHighShade;
  uniform vec3 uMidLit;
  uniform vec3 uMidShade;
  uniform vec3 uLowLit;
  uniform vec3 uLowShade;

  /** Where a layer this high is met looking along d: a curved Earth keeps its horizon finite. */
  vec2 onLayer(vec3 d, float height) {
    return d.xz / (max(d.y, 0.0) + height);
  }

  vec3 cloudLayers(vec3 d, vec2 bearing, vec3 color, float time) {
    float up = max(d.y, 0.0);
    float toLight = max(dot(d, uLight), 0.0);
    // 1 with the light straight behind a cloud, 0 with it behind us, lighting the cloud's face.
    float against = dot(bearing, normalize(uLight.xz + 1e-5));
    float facing = 0.5 - 0.5 * against;
    // Thin cloud with the light behind it shines: a wide sheen, and a silver edge close to it.
    float shine = uScatter * (pow(toLight, 5.0) * 0.7 + pow(toLight, 36.0) * 2.4);

    // Cirrus: fine streaks along the wind, in patches, very thin. The wind up there blows from the
    // south-south-east, so the streaks' vanishing points are off to the sides of the game's view.
    vec2 hi = mat2(0.34, -0.94, 0.94, 0.34) * onLayer(d, 0.2);
    vec4 high = texture2D(uClouds, hi * vec2(0.15, 0.42) + time * vec2(0.0007, 0.0002));
    float wisps = smoothstep(0.5, 0.95, high.g) * (0.45 + 0.55 * high.a);
    wisps *= smoothstep(1.0 - uCover.z, 1.0 - uCover.z + 0.35, high.r);
    wisps *= smoothstep(0.02, 0.3, up) * 0.5;
    vec3 cirrus = mix(uHighShade, uHighLit, 0.6 + 0.4 * high.a) + uHighLit * shine * 0.9;
    color = mix(color, cirrus, wisps);

    // Altocumulus: a dapple of small soft cloudlets, a little drawn out along rows across the wind,
    // in the patches the cirrus leaves clear. Seen from below each is grey in its thick middle and
    // bright round its thin edge.
    vec2 mid = onLayer(d, 0.11) * 0.42 + time * vec2(0.0018, 0.0007);
    mid = mat2(0.9, -0.44, 0.44, 0.9) * mid;
    vec4 middle = texture2D(uClouds, mid * vec2(2.0, 3.0));
    float rows = sin(mid.y * 38.0 + middle.r * 5.0) * 0.12;
    // The billows' cells, packed edge to edge with thin gaps between, make the cloudlets; the round
    // puffs only clump them.
    float dapple = middle.a * 0.8 + middle.b * 0.22 + rows;
    float lets = smoothstep(0.5, 0.86, dapple);
    float patches = smoothstep(1.0 - uCover.y, 1.0 - uCover.y + 0.3, 1.0 - high.r);
    lets *= patches * smoothstep(0.05, 0.32, up) * 0.72;
    float core = smoothstep(0.62, 1.0, dapple) * patches;
    vec3 alto = mix(uMidLit, uMidShade, core * 0.7 * (0.3 + 0.7 * facing));
    alto += uMidLit * shine * (1.0 - core);
    color = mix(color, alto, lets);

    // Cumulus overhead, seen from underneath: thin edges bright, thick middles grey. A second look
    // a little further along the view tells which side of a heap this is: thickening further off
    // is its upper edge on screen, its sunlit side and top; thinning, its lower edge, the base.
    if (up > 0.1) {
      vec2 low = onLayer(d, 0.05) * 0.26 + time * vec2(0.0055, 0.002);
      vec4 here = texture2D(uClouds, low);
      vec4 further = texture2D(uClouds, low + bearing * 0.03);
      float edge = mix(0.8, 0.45, uCover.x);
      float body = smoothstep(edge, edge + 0.045, here.r + (here.a - 0.5) * 0.34);
      body *= smoothstep(0.1, 0.24, up);
      float depth = smoothstep(edge, edge + 0.32, here.r);
      float topside = smoothstep(-0.05, 0.05, further.r - here.r) * (1.0 - up);
      float lit = mix(1.0 - depth * 0.8, 1.0, topside * 0.75) * (0.25 + 0.75 * facing);
      vec3 heap = mix(uLowShade, uLowLit, lit) + uLowLit * shine * (1.0 - depth) * 1.3;
      heap = mix(heap, color, (1.0 - smoothstep(0.1, 0.45, up)) * 0.25);
      color = mix(color, heap, body);
    }

    // The banks round the horizon, drawn in the sky's own angles: a far row with the odd tower, and
    // a nearer row in front of it, each with a flat base and heaped tops worn into billows. Only
    // the bottom of the sky has them, so the rest skips the work. The texture's level of detail is
    // worked out from how the view direction changes across a pixel, which carries on smoothly
    // where the angle round the sky jumps back to the start.
    vec3 dx = dFdx(d);
    vec3 dy = dFdy(d);
    if (d.y > 0.2) return color;
    float turning = ${(BANK_REPEATS / (2 * Math.PI)).toFixed(5)} / max(dot(d.xz, d.xz), 1e-4);
    float ax = (d.x * dx.z - d.z * dx.x) * turning;
    float ay = (d.x * dy.z - d.z * dy.x) * turning;
    float around = atan(d.z, d.x) / 6.2832 * ${BANK_REPEATS.toFixed(1)} + time * 0.00035;
    vec4 outline = textureGrad(uClouds, vec2(around, 0.21), vec2(ax, 0.0), vec2(ay, 0.0));
    vec2 puffAt = vec2(around * 2.0, d.y * 1.6);
    vec4 puff = textureGrad(uClouds, puffAt, vec2(ax, dx.y * 0.8) * 2.0, vec2(ay, dy.y * 0.8) * 2.0);
    float bank = 1.0 - uCover.w;
    // The far row, hazy: heaps that rise steeply to rounded, billowing heads, the biggest of them
    // towering over the nearer row.
    float farHeap = max(outline.g - bank, 0.0) / max(uCover.w, 0.05);
    float farRise = sqrt(farHeap);
    float farTop = 0.005 + farRise * (0.04 + 0.05 * farHeap) + (puff.a - 0.5) * 0.05 * farRise;
    float far = smoothstep(0.0, 0.004, farTop - d.y) * smoothstep(0.003, 0.012, d.y);
    far *= smoothstep(0.0, 0.05, farHeap);
    float farUp = clamp((d.y - 0.005) / max(farTop - 0.005, 0.01), 0.0, 1.0);
    vec3 farCloud = mix(uLowShade, uLowLit, (0.3 + 0.7 * farUp) * (0.4 + 0.6 * facing));
    farCloud += uLowLit * shine * (1.0 - smoothstep(0.0, 0.02, farTop - d.y)) * 0.5;
    farCloud = mix(farCloud, color, 0.45 - 0.2 * farUp);
    color = mix(color, farCloud, far);
    // The near row.
    float nearHeap = max(outline.r - bank, 0.0) / max(uCover.w, 0.05);
    float nearTop = 0.024 + sqrt(nearHeap) * 0.13 + (puff.a - 0.5) * 0.07 * (0.1 + nearHeap);
    float inside = nearTop - d.y;
    float near = smoothstep(0.0, 0.005, inside) * smoothstep(0.022, 0.034, d.y);
    near *= smoothstep(0.0, 0.05, nearHeap);
    float nearUp = clamp((d.y - 0.024) / max(nearTop - 0.024, 0.01), 0.0, 1.0);
    // Lumpy light over the heaps, each lobe of the billows catching it on top.
    float rounded = 0.78 + 0.42 * puff.a;
    float nearLit = (0.18 + 0.82 * sqrt(nearUp)) * (0.25 + 0.75 * facing) * rounded;
    vec3 nearCloud = mix(uLowShade, uLowLit, clamp(nearLit, 0.0, 1.0));
    // With the light behind, the thin cloud round the top of each heap glows.
    float rim = 1.0 - smoothstep(0.0, 0.03, inside);
    nearCloud += uLowLit * shine * rim * rim * 1.6;
    // Their flat bases are the furthest part, hazy with the air in between.
    nearCloud = mix(nearCloud, color, 0.5 * (1.0 - nearUp) * (1.0 - nearUp));
    color = mix(color, nearCloud, near);
    return color;
  }
`;

const paint = new THREE.Color();
const warm = new THREE.Color();
const ambient = new THREE.Color();

/**
 * Sunlight on a cloud by how high the sun is over that cloud's own horizon, in degrees: white by
 * day, gold, then orange, then red and crimson as the light comes through more and more air.
 */
const SUN_ON_CLOUD: readonly (readonly [number, number])[] = [
  [-2.5, 0x4a2448],
  [-0.8, 0xc85a72],
  [1.2, 0xff7864],
  [3.5, 0xff9058],
  [8, 0xffbe7c],
  [16, 0xffe6c4],
  [30, 0xfffaf2],
];

function sunOnCloud(out: THREE.Color, elevation: number): THREE.Color {
  const first = SUN_ON_CLOUD[0] as readonly [number, number];
  if (elevation <= first[0]) return out.setHex(first[1]);
  for (let i = 1; i < SUN_ON_CLOUD.length; i++) {
    const [at, hex] = SUN_ON_CLOUD[i] as readonly [number, number];
    const [was, wasHex] = SUN_ON_CLOUD[i - 1] as readonly [number, number];
    if (elevation <= at)
      return out.setHex(wasHex).lerp(paint.setHex(hex), (elevation - was) / (at - was));
  }
  return out.setHex((SUN_ON_CLOUD[SUN_ON_CLOUD.length - 1] as readonly [number, number])[1]);
}

/** How many degrees more of the sun each layer sees, being higher up: low, middle, high. */
const LAYER_LIFT = [0.6, 2.5, 6] as const;
/** How much brighter than the sky a sunlit cloud is. */
const SUNLIT = 1.22;
/** The moon's silver on the clouds' lit sides, at full moon. */
const MOONLIT = new THREE.Color(0.2, 0.24, 0.34);

export interface CloudLight {
  /** The sun's height in degrees. */
  sun: number;
  horizon: THREE.Color;
  zenith: THREE.Color;
  /** The moonlight there is, 0 to 1. */
  moonlight: number;
}

/**
 * Each layer's sunlit and shaded colors. A layer is lit while the sun's over its horizon. When the
 * sun's low enough to be below a cloud, it lights the cloud from underneath, so at sunset the
 * bases glow too, rather than going grey.
 */
export function lightClouds(
  lit: readonly [THREE.Color, THREE.Color, THREE.Color],
  shade: readonly [THREE.Color, THREE.Color, THREE.Color],
  { sun, horizon, zenith, moonlight }: CloudLight,
): void {
  // Shade is lit by the sky overhead more than by the horizon, so it's cool against warm sunlight.
  ambient.copy(horizon).lerp(zenith, 0.65);
  const under = clamp((5 - sun) / 6, 0, 1);
  for (let layer = 0; layer < 3; layer++) {
    const out = lit[layer] as THREE.Color;
    const dark = shade[layer] as THREE.Color;
    const seen = sun + (LAYER_LIFT[layer] ?? 0);
    const reach = clamp((seen + 3) / 3, 0, 1) ** 1.5;
    sunOnCloud(warm, seen).multiplyScalar(SUNLIT);
    out.copy(ambient).multiplyScalar(1.05).lerp(warm, reach);
    paint.copy(MOONLIT).multiplyScalar(moonlight * (1 - reach));
    out.add(paint);
    dark.copy(ambient).multiplyScalar(layer === 0 ? 0.74 : 0.86);
    dark.lerp(warm.multiplyScalar(0.78), under * reach * (layer === 0 ? 0.7 : 0.85));
    dark.add(paint.multiplyScalar(0.35));
  }
}
