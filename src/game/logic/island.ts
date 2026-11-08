// Island shape and layout. The coastline and terrain are plain math, shared by the rules
// (where can a hero walk?) and the renderer (what does the ground look like?).

import { BUILDINGS, type BuildingType, levelContents } from "./buildings";
import { between, createRng, type Rng } from "./rng";
import { add, distance, fromAngle, normalize, scale, smoothstep, type Vec2, vec } from "./vec";

// Every island shares one design (the crew's home island has it too): a wide, rounded diamond
// with one long landing beach on the south-west, the base on the flat ground beyond it, and
// hills rising towards the other shores.
const RADIUS_X = 96;
const RADIUS_Y = 77;
const ROUNDNESS = 2.4;

/** The landing beach faces this way (south-west; x east, y south). */
export const BEACH_DIRECTION: Vec2 = { x: -Math.SQRT1_2, y: Math.SQRT1_2 };

/** The enemy base sits on the flat ground north-east of the middle, facing the beach. */
export const BASE_CENTER: Vec2 = { x: 6, y: -10 };

export function shoreRadius(angle: number): number {
  const sx = Math.cos(angle) / RADIUS_X;
  const sy = Math.sin(angle) / RADIUS_Y;
  // A rounded square turned 45 degrees makes the diamond.
  const u = Math.abs(sx + sy) * Math.SQRT1_2;
  const v = Math.abs(sx - sy) * Math.SQRT1_2;
  const diamond = 1 / ((u ** ROUNDNESS + v ** ROUNDNESS) ** (1 / ROUNDNESS) * 1.25);
  const wobble =
    0.04 * Math.sin(3 * angle + 1.3) +
    0.03 * Math.sin(5 * angle + 0.4) +
    0.015 * Math.sin(9 * angle + 2);
  return diamond * (1 + wobble);
}

/** 1 along the landing beach's stretch of coast, 0 elsewhere, blending over a wide arc. */
export function beachSide(x: number, y: number): number {
  const length = Math.hypot(x, y) || 1;
  return smoothstep(0.45, 0.9, (x * BEACH_DIRECTION.x + y * BEACH_DIRECTION.y) / length);
}

/** Roughly how far inland a point is: positive on land, negative in the sea. */
export function shoreDistance(x: number, y: number): number {
  return shoreRadius(Math.atan2(y, x)) - Math.hypot(x, y);
}

/** Beach width in meters: a long, wide landing beach on the south-west, thin sand elsewhere. */
export function beachWidth(x: number, y: number): number {
  return 4 + 17 * beachSide(x, y);
}

export function isOnLand(x: number, y: number, margin = 0.8): boolean {
  return shoreDistance(x, y) > margin;
}

export function isOnGrass(x: number, y: number, margin = 0): boolean {
  return shoreDistance(x, y) > beachWidth(x, y) + margin;
}

/** Ground height with the rolling hills scaled by `flat` (0 is level, 1 is full hills). */
function heightWith(x: number, y: number, flat: number): number {
  const sd = shoreDistance(x, y);
  const side = beachSide(x, y);
  // A long shallow shelf off the beach; deeper water below the other shores.
  if (sd <= 0) return Math.max(-2.4, sd * (0.12 - 0.07 * side)) - 0.08;
  const bw = beachWidth(x, y);
  const beach = (Math.min(sd, bw) / bw) * 0.7;
  const inland = smoothstep(bw, bw + 12 + 8 * side, sd);
  const hills =
    (Math.sin(x * 0.09 + 0.7) * Math.cos(y * 0.11 - 0.4) +
      0.5 * Math.sin(x * 0.17 + y * 0.13 + 1.9)) *
      0.5 +
    0.5;
  const height = 1.6 + 5.5 * (1 - side);
  return beach + inland * (0.4 + height * Math.max(0, hills) * flat);
}

/** Ground height of the crew's island in meters (render only; the rules treat the island as
 * flat): gently rolling across the grass the crew builds on, with the hills only rising near the
 * far shores. */
export function homeHeight(x: number, y: number): number {
  const inland = shoreDistance(x, y) - beachWidth(x, y);
  return heightWith(x, y, 0.14 + 0.5 * smoothstep(26, 6, inland));
}

/**
 * The land of one island, whatever its shape: where the sea is, how the ground rises, and where the
 * crew lands. The crew's own island is HOME_SHAPE; enemy islands come from islandShapes.ts.
 */
export interface IslandShape {
  archetype: string;
  /** Roughly how far inland a point is: positive on land, negative in the sea. */
  shoreDistance(x: number, y: number): number;
  /** 1 along the landing beach's stretch of coast, 0 elsewhere. */
  beachSide(x: number, y: number): number;
  beachWidth(x: number, y: number): number;
  /** Ground height in meters. Render only: the rules treat the island as flat. */
  height(x: number, y: number): number;
  /** 1 on running lava, 0 off it. */
  lava(x: number, y: number): number;
  /** Where the headquarters stands. */
  base: Vec2;
  spawn: Vec2;
  boat: Vec2;
  /** The dirt trail's bends, from the landing up to the base. */
  trail: readonly Vec2[];
  /** The way across the whole island, from the landing to the far end. */
  route: readonly Vec2[];
  /** How far from the middle anything on the island can lie, in meters. */
  reach: number;
  /** Lines of cliffs that shape the island, each a chain of points. */
  cliffLines: readonly (readonly Vec2[])[];
  volcano: { pos: Vec2; radius: number; height: number } | null;
  /** Where lava runs, each river from its top down. */
  rivers: readonly (readonly Vec2[])[];
  blackSand: boolean;
}

export interface LandingBeach {
  spawn: Vec2;
  boat: Vec2;
}

/** Where a landing goes: out from `from` along `direction` to the shore, and just off it. */
export function landingOn(
  shore: (x: number, y: number) => number,
  from: Vec2,
  direction: Vec2,
): LandingBeach {
  const dir = normalize(direction);
  const side = vec(-dir.y, dir.x);
  const reach = (target: number, sideways: number): Vec2 => {
    for (let r = 0; r < 260; r += 0.5) {
      const p = add(add(from, scale(dir, r)), scale(side, sideways));
      if (shore(p.x, p.y) <= target) return p;
    }
    return add(from, scale(dir, 260));
  };
  return { spawn: reach(5, 0), boat: reach(-3, 7) };
}

/**
 * How wide a lava river runs either side of its middle, in meters. `along` is 0 at its top and 1 at
 * its end: it's widest near the top and thins going downhill, with a wander along its banks.
 */
export function lavaWidth(along: number, x: number, y: number): number {
  return (3.6 - 1.5 * along) * (1 + 0.22 * Math.sin(x * 0.21 + y * 0.17));
}

/** 1 on running lava, fading out to 0 over a meter at its banks. */
export function lavaAt(rivers: readonly (readonly Vec2[])[], x: number, y: number): number {
  let best = 0;
  for (const river of rivers) {
    for (let i = 0; i + 1 < river.length; i++) {
      const a = river[i];
      const b = river[i + 1];
      if (!a || !b) continue;
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const k = ((x - a.x) * dx + (y - a.y) * dy) / (dx * dx + dy * dy || 1);
      const t = Math.max(0, Math.min(1, k));
      const px = a.x + dx * t;
      const py = a.y + dy * t;
      const width = lavaWidth((i + t) / (river.length - 1), px, py);
      best = Math.max(best, smoothstep(width + 0.6, width - 0.6, Math.hypot(x - px, y - py)));
    }
  }
  return best;
}

/** The ground of an enemy island: flat under its base, hills beyond, and any volcano on top. */
export function shapeHeight(
  shape: IslandShape,
  x: number,
  y: number,
  baseReach: number,
  seed: number,
): number {
  const sd = shape.shoreDistance(x, y);
  const side = shape.beachSide(x, y);
  if (sd <= 0) return Math.max(-2.4, sd * (0.12 - 0.07 * side)) - 0.08;
  const bw = shape.beachWidth(x, y);
  const beach = (Math.min(sd, bw) / bw) * 0.7;
  const inland = smoothstep(bw, bw + 9 + 7 * side, sd);
  const px = (seed % 97) * 0.13;
  const hills =
    (Math.sin(x * 0.09 + 0.7 + px) * Math.cos(y * 0.11 - 0.4 + px) +
      0.5 * Math.sin(x * 0.17 + y * 0.13 + 1.9)) *
      0.5 +
    0.5;
  const flat = smoothstep(baseReach, baseReach + 16, distance(vec(x, y), shape.base));
  let height = beach + inland * (0.4 + (1.2 + 5 * (1 - side)) * Math.max(0, hills) * flat);
  const { volcano } = shape;
  if (volcano) {
    const d = distance(vec(x, y), volcano.pos);
    const k = Math.max(0, 1 - d / volcano.radius);
    const crater = smoothstep(volcano.radius * 0.2, volcano.radius * 0.08, d) * 0.4;
    height += volcano.height * k * k * (3 - 2 * k) * (1 - crater);
  }
  return height;
}

/** The crew's own island, and any raid fought on it. */
export const HOME_SHAPE: IslandShape = {
  archetype: "home",
  shoreDistance,
  beachSide,
  beachWidth,
  height: homeHeight,
  lava: () => 0,
  base: BASE_CENTER,
  ...landingPoints(),
  trail: [],
  route: [],
  reach: 112,
  cliffLines: [],
  volcano: null,
  rivers: [],
  blackSand: false,
};

export interface PlacedBuilding {
  type: BuildingType;
  pos: Vec2;
  /** Upgrade level (1 if missing): scales health and damage in a raid. */
  level?: number;
  /** Turned a quarter, on its tiles. */
  rotated?: boolean;
}

export type ObstacleKind = "rock" | "palm" | "cliff" | "volcano";

export interface ObstacleSpawn {
  kind: ObstacleKind;
  pos: Vec2;
  radius: number;
  /** Rocks stop bullets; palm trunks don't. */
  blocksShots: boolean;
  /** Random variety for the renderer. */
  scale: number;
  rotation: number;
}

export interface DecorSpawn {
  kind: "bush";
  pos: Vec2;
  scale: number;
  rotation: number;
}

export interface IslandLayout {
  seed: number;
  level: number;
  buildings: PlacedBuilding[];
  obstacles: ObstacleSpawn[];
  decor: DecorSpawn[];
  mines: Vec2[];
  /** Where the crew lands. */
  spawn: Vec2;
  /** The gunboat, pulled up in the shallows next to the landing beach. */
  boat: Vec2;
  /** The land itself; the crew's own island if missing. */
  shape?: IslandShape;
  /** How thick the forest is, 0 to 1: it thickens with the island's level. */
  cover?: number;
  /** What the defenders' restored statues add: multipliers on their health and damage. */
  buffs?: { health: number; damage: number };
  /** How snowy the island is, 0 to 1, from how far north it lies (see snowAt). Looks only. */
  snow?: number;
}

/** Walks along a ray from the island's center until the shore distance drops to `target`. */
function pointAtShoreDistance(direction: Vec2, target: number, sideways = 0): Vec2 {
  const dir = normalize(direction);
  const side = vec(-dir.y, dir.x);
  for (let r = 0; r < 200; r += 0.25) {
    const p = add(scale(dir, r), scale(side, sideways));
    if (shoreDistance(p.x, p.y) <= target) return p;
  }
  return scale(dir, 200);
}

interface Placed {
  pos: Vec2;
  radius: number;
}

function overlaps(pos: Vec2, radius: number, others: readonly Placed[], gap: number): boolean {
  return others.some((o) => distance(pos, o.pos) < radius + o.radius + gap);
}

/** Where every island's beach landing is: the heroes, and the gunboat in the shallows. */
export function landingPoints(): { spawn: Vec2; boat: Vec2 } {
  return {
    spawn: pointAtShoreDistance(BEACH_DIRECTION, 5),
    boat: pointAtShoreDistance(BEACH_DIRECTION, -3, 7),
  };
}

/** Where the supply ship ties up on the crew's island: along the beach from the gunboat. */
export function supplyDock(): Vec2 {
  return pointAtShoreDistance(BEACH_DIRECTION, -3, -9);
}

/** The dirt trail's bends, from the landing up to the headquarters. */
export function trailPoints(spawn: Vec2, hq: Vec2): Vec2[] {
  const mid = vec(
    (spawn.x + hq.x) / 2 + (hq.y - spawn.y) * 0.12,
    (spawn.y + hq.y) / 2 - (hq.x - spawn.x) * 0.12,
  );
  return [spawn, mid, hq];
}

/** How far a spot is from a line of bends, in meters. */
export function gapToPath(path: readonly Vec2[], x: number, y: number): number {
  let best = Infinity;
  for (let i = 0; i + 1 < path.length; i++) {
    const a = path[i];
    const b = path[i + 1];
    if (!a || !b) continue;
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const k = ((x - a.x) * dx + (y - a.y) * dy) / (dx * dx + dy * dy || 1);
    const t = Math.max(0, Math.min(1, k));
    best = Math.min(best, Math.hypot(x - (a.x + dx * t), y - (a.y + dy * t)));
  }
  return best;
}

/**
 * Everything on an island around its buildings: cover, palms, bushes, mines and the landing.
 * The buildings themselves come from enemyBase.ts or from a crew's own island.
 */
export function dressIsland(
  seed: number,
  level: number,
  buildings: readonly PlacedBuilding[],
  shape: IslandShape = HOME_SHAPE,
  cover = 0.75,
): IslandLayout {
  const rng = createRng(seed);
  const contents = levelContents(level);
  const { spawn, boat } = shape;
  const hq = buildings.find((b) => b.type === "headquarters")?.pos ?? shape.base;
  const trail = shape.trail.length > 1 ? shape.trail : trailPoints(spawn, hq);
  const land = (x: number, y: number, margin: number) => shape.shoreDistance(x, y) > margin;
  const placed: Placed[] = buildings.map((b) => ({
    pos: b.pos,
    radius: BUILDINGS[b.type].radius,
  }));
  const keepClear: Placed[] = [{ pos: spawn, radius: 6 }];

  const around =
    (center: Vec2, minAngle: number, maxAngle: number, minR: number, maxR: number) => () =>
      add(center, fromAngle(between(rng, minAngle, maxAngle), between(rng, minR, maxR)));

  // Angles point from the base: towards the beach is the front.
  const beachAngle = Math.atan2(BEACH_DIRECTION.y, BEACH_DIRECTION.x);
  const front = [beachAngle - 0.38 * Math.PI, beachAngle + 0.38 * Math.PI] as const;

  const obstacles: ObstacleSpawn[] = [];
  const blockers = (): Placed[] => [...placed, ...keepClear, ...obstacles];

  const { volcano } = shape;
  if (volcano) {
    obstacles.push({
      kind: "volcano",
      pos: { ...volcano.pos },
      radius: volcano.radius * 0.52,
      blocksShots: true,
      scale: 1,
      rotation: 0,
    });
  }

  const cliff = (pos: Vec2, radius: number): ObstacleSpawn => ({
    kind: "cliff",
    pos,
    radius,
    blocksShots: true,
    scale: radius,
    rotation: rng() * 6.28,
  });

  // The island's own lines of cliffs, leaving room for anything built there.
  for (const line of shape.cliffLines) {
    for (const pos of line) {
      const radius = between(rng, 3, 4.4);
      if (!land(pos.x, pos.y, 1.5) || overlaps(pos, radius, placed, 1.5)) continue;
      obstacles.push(cliff(pos, radius));
    }
  }

  // Great boulder cliffs in the forest on the bigger islands, curving through the trees.
  if (shape !== HOME_SHAPE && level >= 2 && shape.archetype !== "cove") {
    const bands = 1 + Math.floor(rng() * 3);
    for (let band = 0; band < bands; band++) {
      for (let attempt = 0; attempt < 40; attempt++) {
        const start = vec(
          between(rng, -shape.reach, shape.reach),
          between(rng, -shape.reach, shape.reach),
        );
        if (!land(start.x, start.y, 11)) continue;
        if (gapToPath(trail, start.x, start.y) < 14 || distance(start, hq) < 46) continue;
        let heading = rng() * Math.PI * 2;
        let pos = start;
        const pieces = 4 + Math.floor(rng() * 6);
        for (let i = 0; i < pieces; i++) {
          const radius = between(rng, 2.6, 5);
          if (land(pos.x, pos.y, radius + 3) && gapToPath(trail, pos.x, pos.y) > radius + 6) {
            if (distance(pos, hq) > 40 && !overlaps(pos, radius, placed, 3)) {
              obstacles.push(cliff(pos, radius));
            }
          }
          heading += between(rng, -0.5, 0.5);
          pos = add(pos, fromAngle(heading, radius * 1.45));
        }
        break;
      }
    }
  }

  const scatter = (
    count: number,
    sample: () => Vec2,
    make: (pos: Vec2) => ObstacleSpawn | null,
  ) => {
    let made = 0;
    for (let attempt = 0; attempt < count * 40 && made < count; attempt++) {
      const pos = sample();
      const spawned = make(pos);
      if (spawned) {
        obstacles.push(spawned);
        made++;
      }
    }
  };
  const anywhereOnLand = () => {
    if (shape === HOME_SHAPE) {
      const angle = between(rng, 0, Math.PI * 2);
      return fromAngle(angle, shoreRadius(angle) * Math.sqrt(rng()) * 0.95);
    }
    for (let i = 0; i < 40; i++) {
      const pos = vec(
        between(rng, -shape.reach, shape.reach),
        between(rng, -shape.reach, shape.reach),
      );
      if (land(pos.x, pos.y, 1)) return pos;
    }
    return { ...shape.base };
  };

  // Boulders: some around the base as cover, the rest anywhere.
  const rock = (pos: Vec2): ObstacleSpawn | null => {
    const radius = between(rng, 0.9, 1.8);
    if (!land(pos.x, pos.y, radius + 1) || shape.lava(pos.x, pos.y) > 0) return null;
    if (overlaps(pos, radius, blockers(), 2)) return null;
    // Cover beside the way in, never across it: a sandbar is only so wide.
    if (shape !== HOME_SHAPE && gapToPath(trail, pos.x, pos.y) < radius + 3.5) return null;
    return { kind: "rock", pos, radius, blocksShots: true, scale: radius, rotation: rng() * 6.28 };
  };
  scatter(12, around(hq, front[0], front[1], 20, 36), rock);
  scatter(14, anywhereOnLand, rock);

  // Palms grow in small clusters, often near the shore.
  for (let cluster = 0; cluster < 12; cluster++) {
    const center = anywhereOnLand();
    const size = 2 + Math.floor(rng() * 4);
    scatter(size, around(center, 0, Math.PI * 2, 0.5, 4.5), (pos) => {
      if (!land(pos.x, pos.y, 1.5) || shape.lava(pos.x, pos.y) > 0) return null;
      if (overlaps(pos, 0.35, blockers(), 1.2)) return null;
      return {
        kind: "palm",
        pos,
        radius: 0.35,
        blocksShots: false,
        scale: between(rng, 0.85, 1.25),
        rotation: rng() * 6.28,
      };
    });
  }

  const decor: DecorSpawn[] = [];
  for (let attempt = 0; attempt < 400 && decor.length < 34; attempt++) {
    const pos = anywhereOnLand();
    if (!land(pos.x, pos.y, 2) || overlaps(pos, 0.8, blockers(), 0.8)) continue;
    decor.push({ kind: "bush", pos, scale: between(rng, 0.7, 1.3), rotation: rng() * 6.28 });
  }

  // Hidden mines between the landing and the base, along the way in.
  const mines: Vec2[] = [];
  const legs = Math.max(1, trail.length - 1);
  for (let attempt = 0; attempt < 400 && mines.length < contents.mines; attempt++) {
    const leg = Math.floor(rng() * legs);
    const a = trail[leg] ?? spawn;
    const b = trail[leg + 1] ?? hq;
    const t = rng();
    const across = normalize(vec(-(b.y - a.y), b.x - a.x));
    const pos = add(
      vec(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t),
      scale(across, between(rng, -14, 14)),
    );
    if (distance(pos, spawn) < 9) continue;
    if (!land(pos.x, pos.y, 2) || overlaps(pos, 0.5, blockers(), 1.5)) continue;
    if (mines.some((m) => distance(m, pos) < 5)) continue;
    mines.push(pos);
  }

  return {
    seed,
    level,
    buildings: [...buildings],
    obstacles,
    decor,
    mines,
    spawn,
    boat,
    shape,
    cover,
  };
}

export function randomSeed(rng: Rng = Math.random): number {
  return Math.floor(rng() * 2 ** 31);
}
