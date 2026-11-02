// Enemy islands come in eight kinds, each built from a few rounded shapes and each asking for a
// different plan: a sandbar everything funnels across, a ring with two ways round, a wall of cliffs
// with two gaps, a volcano that cuts the island in two. Every one lands on the south-west, where
// the cameras look from, and grows with its headquarters: low-level camps sit just behind a small
// beach, and the strongest lie deep inland on big islands. No engine imports.

import {
  BEACH_DIRECTION,
  type IslandShape,
  type LandingBeach,
  landingOn,
  lavaAt,
  shapeHeight,
} from "./island";
import { createRng, type Rng } from "./rng";
import { clamp, distance, smoothstep, type Vec2, vec } from "./vec";

export type Archetype = "cove" | "hook" | "twin" | "key" | "atoll" | "ridge" | "chain" | "volcano";

interface ArchetypeInfo {
  label: string;
  /** How to think about taking it, for the island's card. */
  tip: string;
  /** The range of headquarters levels it turns up at. */
  hq: readonly [number, number];
}

export const ARCHETYPES: Record<Archetype, ArchetypeInfo> = {
  cove: {
    label: "Sandy cove",
    tip: "An open beach with the camp right behind it. Get in fast.",
    hq: [1, 6],
  },
  hook: {
    label: "Hook bay",
    tip: "A long arm round a lagoon: mortars reach you across the water.",
    hq: [2, 99],
  },
  key: {
    label: "Long key",
    tip: "One way in, and every gun lined up along it.",
    hq: [3, 99],
  },
  twin: {
    label: "Twin isles",
    tip: "One sandbar between two isles. Watch for mines on it.",
    hq: [4, 99],
  },
  volcano: {
    label: "Fire mountain",
    tip: "Lava cuts the island in two, and the mountain throws fire. Keep moving.",
    hq: [5, 99],
  },
  atoll: {
    label: "Ring atoll",
    tip: "Two ways round the lagoon: split up, or hit one side hard.",
    hq: [6, 99],
  },
  ridge: {
    label: "Cliff fort",
    tip: "A wall of rock with two gaps. Bullets stop at the rock, grenades go over.",
    hq: [7, 99],
  },
  chain: {
    label: "Stepping stones",
    tip: "Isle to isle along narrow bars, with nowhere to spread out.",
    hq: [8, 99],
  },
};

const ARCHETYPE_ORDER = Object.keys(ARCHETYPES) as Archetype[];

/** Which kind of island a seed gives at a headquarters level. */
export function archetypeFor(seed: number, hq: number): Archetype {
  const rng = createRng(seed ^ 0x7e11a);
  const fits = ARCHETYPE_ORDER.filter(
    (a) => hq >= ARCHETYPES[a].hq[0] && hq <= ARCHETYPES[a].hq[1],
  );
  return fits[Math.floor(rng() * fits.length)] ?? "cove";
}

/** One rounded stroke of land: a line with a width. */
interface Stroke {
  a: Vec2;
  b: Vec2;
  r: number;
}

/** Strokes this thin are sandbars: the coast's wander would pinch them shut. */
const BAR_WIDTH = 6;

interface Plan {
  strokes: Stroke[];
  /** The way in, from the landing beach to the far end of the island. */
  route: Vec2[];
  /** How far along the route the base sits, at the lowest and highest headquarters. */
  base: readonly [number, number];
  cliffs: Vec2[][];
  volcano: { pos: Vec2; radius: number; height: number; lava: Vec2[][] } | null;
}

/** Island plans are drawn with u running inland to the north-east and v across to the south-east. */
const at = (u: number, v: number): Vec2 => ({
  x: (u + v) * Math.SQRT1_2,
  y: (v - u) * Math.SQRT1_2,
});

const blob = (p: Vec2, r: number): Stroke => ({ a: p, b: p, r });

function along(points: readonly Vec2[], r: number): Stroke[] {
  const out: Stroke[] = [];
  for (let i = 0; i + 1 < points.length; i++) {
    const a = points[i];
    const b = points[i + 1];
    if (a && b) out.push({ a, b, r });
  }
  return out;
}

function arc(radius: number, from: number, to: number, steps: number, flip: number): Vec2[] {
  const points: Vec2[] = [];
  for (let i = 0; i <= steps; i++) {
    const t = from + ((to - from) * i) / steps;
    points.push(at(Math.cos(t) * radius, Math.sin(t) * radius * flip));
  }
  return points;
}

function planCove(s: number, flip: number): Plan {
  return {
    strokes: [
      blob(at(0, 0), 46 * s),
      blob(at(20 * s, -24 * s * flip), 26 * s),
      blob(at(16 * s, 26 * s * flip), 24 * s),
    ],
    route: [at(-44 * s, 0), at(40 * s, 0)],
    // Close to the beach, but with the guns just short of reaching the landing.
    base: [0.66, 0.74],
    cliffs: [],
    volcano: null,
  };
}

function planHook(s: number, flip: number): Plan {
  const bend = arc(56 * s, Math.PI, Math.PI * 2 + 0.5, 9, flip);
  const end = at(56 * s, 0);
  return {
    strokes: [...along(bend, 18 * s), blob(end, 30 * s), blob(at(-56 * s, 0), 24 * s)],
    route: arc(56 * s, Math.PI, Math.PI * 2, 8, flip),
    base: [0.3, 0.96],
    cliffs: [],
    volcano: null,
  };
}

function planKey(s: number, flip: number): Plan {
  const spine = [
    at(-74 * s, 0),
    at(-26 * s, 9 * s * flip),
    at(26 * s, -7 * s * flip),
    at(78 * s, 7 * s * flip),
  ];
  return {
    strokes: [...along(spine, 21 * s), blob(at(62 * s, 7 * s * flip), 28 * s)],
    route: spine,
    base: [0.34, 0.84],
    cliffs: [],
    volcano: null,
  };
}

function planTwin(s: number, flip: number): Plan {
  const near = at(-38 * s, 0);
  const far = at(44 * s, 16 * s * flip);
  return {
    strokes: [blob(near, 31 * s), blob(far, 36 * s), { a: near, b: far, r: 5 }],
    route: [at(-66 * s, 0), near, far, at(74 * s, 20 * s * flip)],
    base: [0.62, 0.74],
    cliffs: [],
    volcano: null,
  };
}

function planChain(s: number, flip: number): Plan {
  const first = at(-56 * s, 0);
  const second = at(-2 * s, -30 * s * flip);
  const third = at(58 * s, 8 * s * flip);
  return {
    strokes: [
      blob(first, 25 * s),
      blob(second, 25 * s),
      blob(third, 36 * s),
      { a: first, b: second, r: 4.5 },
      { a: second, b: third, r: 4.5 },
    ],
    route: [at(-80 * s, 0), first, second, third, at(90 * s, 10 * s * flip)],
    base: [0.72, 0.8],
    cliffs: [],
    volcano: null,
  };
}

function planAtoll(s: number, flip: number): Plan {
  const ring = arc(60 * s, Math.PI, Math.PI * 3, 16, flip);
  const far = at(60 * s, 0);
  return {
    strokes: [...along(ring, 16 * s), blob(far, 33 * s), blob(at(-60 * s, 0), 22 * s)],
    route: arc(60 * s, Math.PI, Math.PI * 2, 8, flip),
    base: [0.92, 0.98],
    cliffs: [],
    volcano: null,
  };
}

function planRidge(s: number, flip: number): Plan {
  // A bank of cliffs right across, broken by a gap either side of the middle.
  const wall = (from: number, to: number): Vec2[] => {
    const points: Vec2[] = [];
    for (let v = from; v <= to; v += 4.6) {
      points.push(at(6 * s + Math.sin(v * 0.06) * 6, v * flip));
    }
    return points;
  };
  return {
    strokes: [
      blob(at(0, 0), 66 * s),
      blob(at(44 * s, 30 * s * flip), 36 * s),
      blob(at(40 * s, -34 * s * flip), 34 * s),
      blob(at(-30 * s, -30 * s * flip), 34 * s),
    ],
    // The trail goes through one gap in the wall; the other is the way round.
    route: [
      at(-64 * s, 0),
      at(-14 * s, 18 * s * flip),
      at(8 * s, 24 * s * flip),
      at(78 * s, 4 * s * flip),
    ],
    base: [0.8, 0.9],
    cliffs: [wall(-74 * s, -26 * s), wall(-8 * s, 12 * s), wall(36 * s, 78 * s)],
    volcano: null,
  };
}

function planVolcano(s: number, flip: number): Plan {
  const vent = at(36 * s, -32 * s * flip);
  const radius = 36 * s;
  // The main river breaks once, at a ford: the one dry way across it.
  const river = [vent, at(12 * s, -8 * s * flip), at(-6 * s, 20 * s * flip)];
  const lower = [at(-8 * s, 42 * s * flip), at(-6 * s, 62 * s * flip), at(-14 * s, 92 * s * flip)];
  const second = [vent, at(-14 * s, -36 * s * flip), at(-52 * s, -44 * s * flip)];
  return {
    strokes: [
      blob(at(4 * s, 0), 74 * s),
      blob(vent, 44 * s),
      blob(at(36 * s, 40 * s * flip), 38 * s),
      blob(at(-40 * s, 26 * s * flip), 30 * s),
    ],
    route: [
      at(-72 * s, 0),
      at(-22 * s, 8 * s * flip),
      at(20 * s, 34 * s * flip),
      at(48 * s, 46 * s * flip),
    ],
    base: [0.68, 0.86],
    cliffs: [],
    volcano: { pos: vent, radius, height: 26 + 8 * s, lava: [river, lower, second] },
  };
}

function plan(archetype: Archetype, s: number, flip: number): Plan {
  switch (archetype) {
    case "cove":
      return planCove(s, flip);
    case "hook":
      return planHook(s, flip);
    case "key":
      return planKey(s, flip);
    case "twin":
      return planTwin(s, flip);
    case "chain":
      return planChain(s, flip);
    case "atoll":
      return planAtoll(s, flip);
    case "ridge":
      return planRidge(s, flip);
    case "volcano":
      return planVolcano(s, flip);
  }
}

function segmentGap(p: Vec2, a: Vec2, b: Vec2): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const k = ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy || 1);
  const t = clamp(k, 0, 1);
  return Math.hypot(p.x - (a.x + dx * t), p.y - (a.y + dy * t));
}

/** Rounded union, so strokes melt into each other instead of meeting in a crease. */
function smoothMax(a: number, b: number, k: number): number {
  const h = clamp(0.5 + (0.5 * (a - b)) / k, 0, 1);
  return b + (a - b) * h + k * h * (1 - h);
}

const GRID = 3;
const GRID_HALF = 156;
const GRID_SIZE = Math.ceil((GRID_HALF * 2) / GRID) + 1;

/** Works out the whole coast on a coarse grid once, so asking where the land is costs nothing. */
function bakeCoast(strokes: readonly Stroke[], rng: Rng): Float32Array {
  const phase = [rng() * 6.28, rng() * 6.28, rng() * 6.28, rng() * 6.28];
  const [p0 = 0, p1 = 0, p2 = 0, p3 = 0] = phase;
  const grid = new Float32Array(GRID_SIZE * GRID_SIZE);
  const bars = strokes.filter((s) => s.r <= BAR_WIDTH);
  const land = strokes.filter((s) => s.r > BAR_WIDTH);
  for (let j = 0; j < GRID_SIZE; j++) {
    for (let i = 0; i < GRID_SIZE; i++) {
      const p = vec(i * GRID - GRID_HALF, j * GRID - GRID_HALF);
      let d = -1000;
      for (const s of land) d = smoothMax(d, s.r - segmentGap(p, s.a, s.b), 9);
      const wobble =
        Math.sin(p.x * 0.083 + p0) * Math.cos(p.y * 0.071 + p1) * 2.2 +
        Math.sin(p.x * 0.19 + p2) * Math.sin(p.y * 0.17 + p3) * 1.1;
      // Only the bigger coasts wander; the bars laid over them keep their full width.
      d += wobble * smoothstep(40, 12, -d);
      for (const s of bars) d = smoothMax(d, s.r - segmentGap(p, s.a, s.b), 5);
      grid[j * GRID_SIZE + i] = d;
    }
  }
  return grid;
}

function sampler(grid: Float32Array): (x: number, y: number) => number {
  return (x, y) => {
    const fx = (x + GRID_HALF) / GRID;
    const fy = (y + GRID_HALF) / GRID;
    if (fx < 0 || fy < 0 || fx >= GRID_SIZE - 1 || fy >= GRID_SIZE - 1) return -64;
    const i = Math.floor(fx);
    const j = Math.floor(fy);
    const tx = fx - i;
    const ty = fy - j;
    const k = j * GRID_SIZE + i;
    const a = grid[k] ?? 0;
    const b = grid[k + 1] ?? 0;
    const c = grid[k + GRID_SIZE] ?? 0;
    const d = grid[k + GRID_SIZE + 1] ?? 0;
    return a + (b - a) * tx + (c - a) * ty + (a - b - c + d) * tx * ty;
  };
}

function routeLength(route: readonly Vec2[]): number {
  let total = 0;
  for (let i = 0; i + 1 < route.length; i++) {
    const a = route[i];
    const b = route[i + 1];
    if (a && b) total += distance(a, b);
  }
  return total;
}

/** A point that far along a line, and the line up to it. */
function walk(route: readonly Vec2[], meters: number): { at: Vec2; path: Vec2[] } {
  const path: Vec2[] = [];
  let left = meters;
  for (let i = 0; i + 1 < route.length; i++) {
    const a = route[i];
    const b = route[i + 1];
    if (!a || !b) continue;
    path.push(a);
    const gap = distance(a, b);
    if (left <= gap) {
      const t = left / (gap || 1);
      const end = vec(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t);
      path.push(end);
      return { at: end, path };
    }
    left -= gap;
  }
  const last = route[route.length - 1] ?? vec(0, 0);
  path.push(last);
  return { at: last, path };
}

/** How big an island is at a headquarters level: small low-level camps, huge strongholds. */
function sizeFor(hq: number, roll: number): number {
  return 0.78 + 0.024 * Math.min(hq, 16) + roll * 0.08;
}

const cache = new Map<string, IslandShape>();
const CACHED = 24;

/** The island a seed and headquarters level give, the same on every phone. */
export function islandShape(seed: number, hq: number): IslandShape {
  const key = `${seed}:${hq}`;
  const made = cache.get(key);
  if (made) return made;
  const shape = makeShape(seed, hq);
  if (cache.size >= CACHED) {
    const [oldest] = cache.keys();
    if (oldest) cache.delete(oldest);
  }
  cache.set(key, shape);
  return shape;
}

function makeShape(seed: number, hq: number): IslandShape {
  const rng = createRng(seed ^ 0x51a9e);
  const archetype = archetypeFor(seed, hq);
  const s = sizeFor(hq, rng());
  const flip = rng() < 0.5 ? 1 : -1;
  const p = plan(archetype, s, flip);
  const shoreDistance = sampler(bakeCoast(p.strokes, rng));
  const anchor = p.route[0] ?? vec(0, 0);
  const inland = p.route[1] ?? vec(0, 0);
  // Back along the first stretch of the route until the sea, which is where the beach is.
  const start = vec(anchor.x * 0.5 + inland.x * 0.5, anchor.y * 0.5 + inland.y * 0.5);
  const beach: LandingBeach = landingOn(shoreDistance, start, BEACH_DIRECTION);
  const wide = 8 + 8 * clamp(s, 0, 1);
  const reach = 26 + 26 * clamp(s, 0, 1);
  const beachSide = (x: number, y: number) =>
    smoothstep(reach, reach * 0.42, Math.hypot(x - beach.spawn.x, y - beach.spawn.y));
  const beachWidth = (x: number, y: number) => 3.2 + wide * beachSide(x, y);

  const whole = [beach.spawn, ...p.route.slice(1)];
  const length = routeLength(whole);
  const [low, high] = p.base;
  const share = low + (high - low) * clamp((hq - 1) / 15, 0, 1);
  const { at: base, path: trail } = walk(whole, length * share);
  const baseReach = 16 + 1.6 * Math.min(hq, 20);

  const lava = p.volcano?.lava ?? [];
  const shape: IslandShape = {
    archetype,
    shoreDistance,
    beachSide,
    beachWidth,
    base,
    spawn: beach.spawn,
    boat: beach.boat,
    trail,
    reach: 150,
    cliffLines: p.cliffs,
    volcano: p.volcano
      ? { pos: p.volcano.pos, radius: p.volcano.radius, height: p.volcano.height }
      : null,
    rivers: lava,
    blackSand: archetype === "volcano",
    lava: (x, y) => lavaAt(lava, x, y),
    height: (x, y) => shapeHeight(shape, x, y, baseReach, seed),
    route: whole,
  };
  return shape;
}
