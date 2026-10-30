// Island shape and layout. The coastline and terrain are plain math, shared by the rules
// (where can a hero walk?) and the renderer (what does the ground look like?).

import { BUILDINGS, type BuildingType, levelContents } from "./buildings";
import { between, createRng, type Rng } from "./rng";
import { add, distance, fromAngle, normalize, scale, smoothstep, sub, type Vec2, vec } from "./vec";

const RADIUS_X = 80;
const RADIUS_Y = 64;

/** The enemy base sits in the north half; the landing beach faces south (+y). */
export const BASE_CENTER: Vec2 = { x: 0, y: -8 };

export function shoreRadius(angle: number): number {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  const ellipse = (RADIUS_X * RADIUS_Y) / Math.hypot(RADIUS_Y * c, RADIUS_X * s);
  const wobble =
    0.06 * Math.sin(3 * angle + 1.3) +
    0.035 * Math.sin(5 * angle + 0.4) +
    0.02 * Math.sin(9 * angle + 2);
  return ellipse * (1 + wobble);
}

/** Roughly how far inland a point is: positive on land, negative in the sea. */
export function shoreDistance(x: number, y: number): number {
  return shoreRadius(Math.atan2(y, x)) - Math.hypot(x, y);
}

/** Beach width in meters; widest at the southern landing cove. */
export function beachWidth(x: number, y: number): number {
  const south = Math.max(0, Math.sin(Math.atan2(y, x)));
  return 6 + 10 * south * south;
}

export function isOnLand(x: number, y: number, margin = 0.8): boolean {
  return shoreDistance(x, y) > margin;
}

export function isOnGrass(x: number, y: number, margin = 0): boolean {
  return shoreDistance(x, y) > beachWidth(x, y) + margin;
}

/** Ground height in meters (render only; the rules treat the island as flat). */
export function terrainHeight(x: number, y: number): number {
  const sd = shoreDistance(x, y);
  if (sd <= 0) return Math.max(-2.4, sd * 0.12) - 0.08;
  const bw = beachWidth(x, y);
  const beach = (Math.min(sd, bw) / bw) * 0.7;
  const inland = smoothstep(bw, bw + 12, sd);
  // Gentle hills, flattened under the base so buildings sit level.
  const flat = 0.25 + 0.75 * smoothstep(26, 44, distance(vec(x, y), BASE_CENTER));
  const hills =
    (Math.sin(x * 0.09 + 0.7) * Math.cos(y * 0.11 - 0.4) +
      0.5 * Math.sin(x * 0.17 + y * 0.13 + 1.9)) *
      0.5 +
    0.5;
  return beach + inland * (0.4 + 2.4 * Math.max(0, hills) * flat);
}

export interface PlacedBuilding {
  type: BuildingType;
  pos: Vec2;
}

export type ObstacleKind = "rock" | "palm" | "sandbag";

export interface ObstacleSpawn {
  kind: ObstacleKind;
  pos: Vec2;
  radius: number;
  /** Rocks and sandbags stop bullets; palm trunks don't. */
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
  /** Where a hero steps off the boat. */
  boatExit: Vec2;
}

const BUILDING_GAP = 3;

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

export function generateIsland(seed: number, level: number): IslandLayout {
  const rng = createRng(seed);
  const contents = levelContents(level);
  const south = vec(0, 1);
  const spawn = pointAtShoreDistance(south, 5);
  const boat = pointAtShoreDistance(south, -3, 7);
  const boatExit = pointAtShoreDistance(south, 2.5, 7);

  const buildings: PlacedBuilding[] = [];
  const placed: Placed[] = [];
  const keepClear: Placed[] = [
    { pos: spawn, radius: 6 },
    { pos: boatExit, radius: 4 },
  ];

  const tryPlace = (type: BuildingType, sample: () => Vec2): void => {
    const radius = BUILDINGS[type].radius;
    for (let attempt = 0; attempt < 600; attempt++) {
      // Loosen the rules a little if a spot is hard to find.
      const gap = attempt < 400 ? BUILDING_GAP : 1.5;
      const pos = sample();
      if (!isOnGrass(pos.x, pos.y, radius + 1.5)) continue;
      if (overlaps(pos, radius, placed, gap) || overlaps(pos, radius, keepClear, 1)) continue;
      buildings.push({ type, pos });
      placed.push({ pos, radius });
      return;
    }
    throw new Error(`Could not place ${type} on island ${seed}`);
  };

  const around =
    (center: Vec2, minAngle: number, maxAngle: number, minR: number, maxR: number) => () =>
      add(center, fromAngle(between(rng, minAngle, maxAngle), between(rng, minR, maxR)));

  const hq = vec(between(rng, -6, 6), BASE_CENTER.y - 15 + between(rng, -3, 3));
  const front = [0.12 * Math.PI, 0.88 * Math.PI] as const; // the beach side of the base
  const samplers: Record<BuildingType, () => Vec2> = {
    headquarters: () => hq,
    gunTurret: around(BASE_CENTER, front[0], front[1], 12, 25),
    harpoon: around(BASE_CENTER, front[0], front[1], 10, 22),
    mortar: around(BASE_CENTER, 0, Math.PI * 2, 5, 15),
    flamethrower: around(hq, 0.1 * Math.PI, 0.9 * Math.PI, 9, 14),
    watchtower: around(BASE_CENTER, 0, Math.PI * 2, 14, 28),
    goldMine: around(BASE_CENTER, 0.8 * Math.PI, 2.2 * Math.PI, 10, 30),
    lumberCamp: around(BASE_CENTER, 0.8 * Math.PI, 2.2 * Math.PI, 10, 30),
    quarry: around(BASE_CENTER, 0.8 * Math.PI, 2.2 * Math.PI, 10, 30),
    scrapYard: around(BASE_CENTER, 0.8 * Math.PI, 2.2 * Math.PI, 10, 30),
    storehouse: around(BASE_CENTER, 0, Math.PI * 2, 8, 26),
    goldVault: around(BASE_CENTER, 0, Math.PI * 2, 8, 26),
    timberShed: around(BASE_CENTER, 0, Math.PI * 2, 8, 26),
    stoneYard: around(BASE_CENTER, 0, Math.PI * 2, 8, 26),
    scrapBin: around(BASE_CENTER, 0, Math.PI * 2, 8, 26),
    refinery: around(BASE_CENTER, 0.8 * Math.PI, 2.2 * Math.PI, 10, 30),
  };
  // Defenses first so they get the front line, then everything else.
  const order: BuildingType[] = [
    "headquarters",
    "gunTurret",
    "harpoon",
    "flamethrower",
    "mortar",
    "watchtower",
    "refinery",
    "goldMine",
    "lumberCamp",
    "quarry",
    "scrapYard",
    "storehouse",
  ];
  for (const type of order) {
    const count = contents.buildings[type] ?? 0;
    for (let i = 0; i < count; i++) tryPlace(type, samplers[type]);
  }

  const obstacles: ObstacleSpawn[] = [];
  const blockers = (): Placed[] => [...placed, ...keepClear, ...obstacles];

  // Short sandbag walls in front of the direct-fire defenses, facing the beach.
  for (const b of buildings) {
    if (b.type !== "gunTurret" && b.type !== "harpoon") continue;
    const toBeach = normalize(sub(spawn, b.pos));
    const center = add(b.pos, scale(toBeach, BUILDINGS[b.type].radius + 2.4));
    const along = vec(-toBeach.y, toBeach.x);
    for (const offset of [-1.4, 0, 1.4]) {
      const pos = add(center, scale(along, offset));
      if (!isOnLand(pos.x, pos.y, 1) || overlaps(pos, 0.75, placed, 0.3)) continue;
      obstacles.push({
        kind: "sandbag",
        pos,
        radius: 0.75,
        blocksShots: true,
        scale: 1,
        rotation: Math.atan2(along.y, along.x),
      });
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
  for (let attempt = 0; attempt < 400 && mines.length < contents.mines; attempt++) {
    const pos = vec(between(rng, -20, 20), spawn.y - between(rng, 9, 22));
    if (!isOnLand(pos.x, pos.y, 2) || overlaps(pos, 0.5, blockers(), 1.5)) continue;
    if (mines.some((m) => distance(m, pos) < 5)) continue;
    mines.push(pos);
  }

  return { seed, level, buildings, obstacles, decor, mines, spawn, boat, boatExit };
}

export function randomSeed(rng: Rng = Math.random): number {
  return Math.floor(rng() * 2 ** 31);
}
