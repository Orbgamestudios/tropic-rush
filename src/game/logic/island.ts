// Island shape and layout. The coastline and terrain are plain math, shared by the rules
// (where can a hero walk?) and the renderer (what does the ground look like?).

import { BUILDINGS, type BuildingType, levelContents } from "./buildings";
import { between, createRng, type Rng } from "./rng";
import { add, distance, fromAngle, normalize, scale, smoothstep, sub, type Vec2, vec } from "./vec";

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

/** Ground height in meters (render only; the rules treat the island as flat). Flat ground under
 * the base; rolling hills around it, tallest away from the beach. */
export function terrainHeight(x: number, y: number): number {
  return heightWith(x, y, smoothstep(30, 50, distance(vec(x, y), BASE_CENTER)));
}

/** The same island as home ground: gently rolling across the grass the crew builds on, with
 * the hills only rising near the far shores. */
export function homeHeight(x: number, y: number): number {
  const inland = shoreDistance(x, y) - beachWidth(x, y);
  return heightWith(x, y, 0.14 + 0.5 * smoothstep(26, 6, inland));
}

export interface PlacedBuilding {
  type: BuildingType;
  pos: Vec2;
  /** Upgrade level (1 if missing): scales health and damage in a raid. */
  level?: number;
}

export type ObstacleKind = "rock" | "palm";

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

/** The dirt trail's bends, from the landing up to the headquarters. */
export function trailPoints(spawn: Vec2, hq: Vec2): Vec2[] {
  const mid = vec(
    (spawn.x + hq.x) / 2 + (hq.y - spawn.y) * 0.12,
    (spawn.y + hq.y) / 2 - (hq.x - spawn.x) * 0.12,
  );
  return [spawn, mid, hq];
}

/**
 * Everything on an island around its buildings: cover, palms, bushes, mines and the landing.
 * The buildings themselves come from enemyBase.ts or from a crew's own island.
 */
export function dressIsland(
  seed: number,
  level: number,
  buildings: readonly PlacedBuilding[],
): IslandLayout {
  const rng = createRng(seed);
  const contents = levelContents(level);
  const { spawn, boat } = landingPoints();
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
    const angle = between(rng, 0, Math.PI * 2);
    return fromAngle(angle, shoreRadius(angle) * Math.sqrt(rng()) * 0.95);
  };

  // Boulders: some around the base as cover, the rest anywhere.
  const rock = (pos: Vec2): ObstacleSpawn | null => {
    const radius = between(rng, 0.9, 1.8);
    if (!isOnLand(pos.x, pos.y, radius + 1)) return null;
    if (overlaps(pos, radius, blockers(), 2)) return null;
    return { kind: "rock", pos, radius, blocksShots: true, scale: radius, rotation: rng() * 6.28 };
  };
  scatter(12, around(BASE_CENTER, front[0], front[1], 20, 36), rock);
  scatter(14, anywhereOnLand, rock);

  // Palms grow in small clusters, often near the shore.
  for (let cluster = 0; cluster < 12; cluster++) {
    const center = anywhereOnLand();
    const size = 2 + Math.floor(rng() * 4);
    scatter(size, around(center, 0, Math.PI * 2, 0.5, 4.5), (pos) => {
      if (!isOnLand(pos.x, pos.y, 1.5)) return null;
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
    if (!isOnLand(pos.x, pos.y, 2) || overlaps(pos, 0.8, blockers(), 0.8)) continue;
    decor.push({ kind: "bush", pos, scale: between(rng, 0.7, 1.3), rotation: rng() * 6.28 });
  }

  // Hidden beach mines between the landing and the base.
  const mines: Vec2[] = [];
  const inland = normalize(sub(BASE_CENTER, spawn));
  const across = vec(-inland.y, inland.x);
  for (let attempt = 0; attempt < 400 && mines.length < contents.mines; attempt++) {
    const pos = add(
      add(spawn, scale(inland, between(rng, 9, 22))),
      scale(across, between(rng, -20, 20)),
    );
    if (!isOnLand(pos.x, pos.y, 2) || overlaps(pos, 0.5, blockers(), 1.5)) continue;
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
  };
}

export function randomSeed(rng: Rng = Math.random): number {
  return Math.floor(rng() * 2 ** 31);
}
