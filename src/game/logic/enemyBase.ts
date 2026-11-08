// Enemy bases are built like a crew's island: buildings on the same 2 m tiles, as many of each as
// that headquarters level allows, and upgraded within the same level caps. A raid is a fight
// against another crew's base, not a separate kind of map. The tiles come from the island's own
// grass, so a base fits whatever shape of island it's on.

import { BUILDINGS, type BuildingType } from "./buildings";
import {
  buildingCenter,
  cornerFor,
  footprint,
  GRID_ORIGIN,
  gridTiles,
  HOME_START,
  onHomeCliff,
  TILE,
  type PlacedBuilding as TileBuilding,
} from "./crewIsland";
import { allowedCount, levelCap, MAX_HQ_LEVEL } from "./economy";
import {
  BASE_CENTER,
  BEACH_DIRECTION,
  dressIsland,
  HOME_SHAPE,
  type IslandLayout,
  type IslandShape,
  type PlacedBuilding,
} from "./island";
import { islandShape } from "./islandShapes";
import { type Puzzle, puzzleFor, puzzlePlan } from "./puzzles";
import { between, createRng } from "./rng";
import { add, distance, fromAngle, lerp, normalize, scale, sub, type Vec2, vec } from "./vec";

/** Defenses first so they get the ground round the headquarters, then everything else. */
const BUILD_ORDER: readonly BuildingType[] = [
  "headquarters",
  "flamethrower",
  "mortar",
  "gunTurret",
  "harpoon",
  "watchtower",
  "goldVault",
  "timberShed",
  "stoneYard",
  "scrapBin",
  "refinery",
  "goldMine",
  "lumberCamp",
  "quarry",
  "scrapYard",
  "landmine",
];

/** Tiles kept free between buildings, so heroes can walk the base. */
const GAP_TILES = 2;
/** The headquarters level raiders start burying mines along the way in. */
const FIRST_MINES_HQ = 3;

/** How far from the middle of the headquarters each kind of building goes, in meters. */
const RINGS: Partial<Record<BuildingType, readonly [number, number]>> = {
  flamethrower: [11, 15],
  mortar: [11, 16],
  gunTurret: [15, 23],
  harpoon: [15, 23],
  watchtower: [18, 25],
  goldVault: [23, 31],
  timberShed: [23, 31],
  stoneYard: [23, 31],
  scrapBin: [23, 31],
  refinery: [24, 32],
  landmine: [13, 34],
};
/** The mills lie furthest out, where they're first to fall. */
const OUTER_RING = [30, 40] as const;
/**
 * How far back from the middle of a raider base its headquarters stands, away from the landing, in
 * meters: whoever comes ashore has to fight through the front of the base to reach it.
 */
const HQ_SET_BACK = 10;

export interface BaseOptions {
  /** Every building at the top of what its headquarters allows, for bases retaken in the night. */
  maxed?: boolean;
  /** Defenses laid out as a puzzle, in place of the rings. */
  puzzle?: Puzzle | null;
}

/** The storages, in the order a puzzle's storage spots take them. */
const STORAGES: readonly BuildingType[] = ["goldVault", "timberShed", "stoneYard", "scrapBin"];
/** Puzzle layouts stand tighter than the rings: a tile between buildings still lets heroes by. */
const PUZZLE_GAP = 1;

/** The headquarters level a base on the crew's island has grown all the way inland by. */
const FULLY_INLAND_HQ = 16;

/**
 * A base on the crew's island grows the way a crew's does: it starts in the same first clearing
 * near the beach, and works further in as the forest comes down.
 */
function homeBaseAnchor(hq: number, beach: number): Vec2 {
  const grown = Math.min(1, (hq - 1) / (FULLY_INLAND_HQ - 1));
  const inland = add(BASE_CENTER, fromAngle(beach + Math.PI, 6));
  return vec(lerp(HOME_START.x, inland.x, grown), lerp(HOME_START.y, inland.y, grown));
}

/** Every defense in the base, so they can share out the ground round the headquarters evenly. */
function defensesOf(hq: number): number {
  return BUILD_ORDER.filter((t) => BUILDINGS[t].attack).reduce(
    (sum, t) => sum + allowedCount(t, hq),
    0,
  );
}

const tileSets = new WeakMap<IslandShape, Set<string>>();

/** The tiles a base can stand on: an island's grass, off any lava. */
function shapeTiles(shape: IslandShape): Set<string> {
  let tiles = tileSets.get(shape);
  if (!tiles) {
    tiles = gridTiles(
      (x, y) =>
        shape.shoreDistance(x, y) > shape.beachWidth(x, y) &&
        shape.lava(x, y) <= 0 &&
        (shape !== HOME_SHAPE || !onHomeCliff(x, y)) &&
        (!shape.volcano || distance(vec(x, y), shape.volcano.pos) > shape.volcano.radius * 0.72),
      shape.reach,
    );
    tileSets.set(shape, tiles);
  }
  return tiles;
}

/**
 * An enemy base as a crew-style layout: every building on tiles, with its level. The headquarters
 * stands in the middle with its defenses in rings all round it, so there's no way in that isn't
 * under fire, and the mills and storages lie exposed outside. Past the headquarters' top level the
 * base can't grow any more, so its buildings just keep getting stronger. A small camp packs in
 * tighter, and on a narrow island the rings bend round the water.
 */
export function enemyBase(
  seed: number,
  hq: number,
  options: BaseOptions = {},
  shape: IslandShape = HOME_SHAPE,
): TileBuilding[] {
  const rng = createRng(seed);
  const beach = Math.atan2(BEACH_DIRECTION.y, BEACH_DIRECTION.x);
  const rated = Math.min(hq, MAX_HQ_LEVEL);
  const extra = hq - rated;
  const tiles = shapeTiles(shape);
  const home = shape === HOME_SHAPE;
  const anchor = home ? homeBaseAnchor(rated, beach) : shape.base;
  const center = add(anchor, vec(between(rng, -3, 3), between(rng, -3, 3)));
  const back = home ? vec(0, 0) : normalize(sub(center, shape.spawn));
  const buildings: TileBuilding[] = [];
  const clearance = (c: TileBuilding, gap: number) => {
    const a = footprint(c.type, c.rotated);
    for (let ty = c.y; ty < c.y + a.h; ty++) {
      for (let tx = c.x; tx < c.x + a.w; tx++) if (!tiles.has(`${tx},${ty}`)) return false;
    }
    return buildings.every((b) => {
      const o = footprint(b.type, b.rotated);
      return (
        c.x + a.w + gap <= b.x ||
        b.x + o.w + gap <= c.x ||
        c.y + a.h + gap <= b.y ||
        b.y + o.h + gap <= c.y
      );
    });
  };
  const level = (type: BuildingType) => {
    const cap = type === "headquarters" ? rated : levelCap(type, rated);
    // Upgraded close to the cap, the way a crew would, unless it's a full rebuild.
    const below = !options.maxed && rng() < 0.4 ? 1 : 0;
    return (type === "headquarters" ? rated : Math.max(1, cap - below)) + extra;
  };
  const make = (type: BuildingType, pos: Vec2, level: number): TileBuilding => ({
    id: `e${buildings.length}`,
    type,
    ...cornerFor(type, false, pos),
    rotated: false,
    level,
  });
  /** Puts a building where a puzzle wants it, or as near as the island allows. */
  const placeNear = (type: BuildingType, pos: Vec2, built: number) => {
    for (let reach = 0; reach <= 8; reach += 2) {
      for (let k = 0; k < (reach === 0 ? 1 : 8); k++) {
        const candidate = make(type, add(pos, fromAngle((k * Math.PI) / 4, reach)), built);
        if (clearance(candidate, PUZZLE_GAP)) return candidate;
      }
    }
    return nearestFree(
      pos,
      tiles,
      (p) => make(type, p, built),
      (c) => clearance(c, 1),
    );
  };
  // A puzzle lays its own defenses, and the first of the storages where it wants them.
  const puzzle = options.puzzle && !home ? puzzlePlan(options.puzzle, rated) : null;
  const laid = new Map<BuildingType, number>();
  const layPuzzle = (hq: Vec2) => {
    if (!puzzle) return;
    const forward = normalize(sub(shape.spawn, hq));
    const across = vec(-forward.y, forward.x);
    const storages = STORAGES.flatMap((t) => Array<BuildingType>(allowedCount(t, rated)).fill(t));
    for (const spot of puzzle) {
      const type = spot.type === "storage" ? storages.shift() : spot.type;
      if (!type) continue;
      const pos = add(hq, add(scale(forward, spot.forward), scale(across, spot.across)));
      const placed = placeNear(type, pos, level(type));
      if (!placed) continue;
      buildings.push(placed);
      laid.set(type, (laid.get(type) ?? 0) + 1);
    }
  };
  // Defenses go round the circle in turn, each a share of the way on from the last.
  const defenses = defensesOf(rated);
  const step = Math.PI * 2 * 0.382;
  const tight = Math.min(1, home ? 0.5 + rated * 0.03 : 0.68 + rated * 0.022);
  const setBack = HQ_SET_BACK * tight;
  let turn = rng() * Math.PI * 2;
  for (const type of BUILD_ORDER) {
    // A puzzle's defenses are all its own.
    if (puzzle && BUILDINGS[type].attack) continue;
    const [nearRing, farRing] = RINGS[type] ?? OUTER_RING;
    const near = nearRing * tight;
    const far = farRing * tight;
    for (let i = laid.get(type) ?? 0; i < allowedCount(type, rated); i++) {
      const built = level(type);
      const spread = (Math.PI * 2) / Math.max(4, defenses);
      turn += step;
      let placed: TileBuilding | null = null;
      for (let attempt = 0; attempt < 800 && !placed; attempt++) {
        const loose = attempt >= 500;
        const pos =
          type === "headquarters"
            ? // Set back from the middle, or as near that as the island allows.
              add(center, scale(back, setBack * Math.max(0, 1 - attempt / 40)))
            : BUILDINGS[type].attack && !loose
              ? add(
                  center,
                  fromAngle(turn + between(rng, -spread, spread), between(rng, near, far)),
                )
              : add(
                  center,
                  fromAngle(rng() * Math.PI * 2, between(rng, near, far + (loose ? 14 : 0))),
                );
        const candidate = make(type, pos, built);
        if (clearance(candidate, loose ? 1 : GAP_TILES)) placed = candidate;
      }
      // Every base at a level has the same buildings: anywhere free will do, nearest first.
      placed ??= nearestFree(
        center,
        tiles,
        (p) => make(type, p, built),
        (c) => clearance(c, 1),
      );
      if (placed) buildings.push(placed);
      if (placed && type === "headquarters") layPuzzle(buildingCenter(placed));
    }
  }
  return buildings;
}

function nearestFree(
  center: Vec2,
  tiles: ReadonlySet<string>,
  make: (pos: Vec2) => TileBuilding,
  free: (c: TileBuilding) => boolean,
): TileBuilding | null {
  const spots = [...tiles]
    .map((key) => {
      const [x = 0, y = 0] = key.split(",").map(Number);
      return vec(GRID_ORIGIN.x + (x + 0.5) * TILE, GRID_ORIGIN.y + (y + 0.5) * TILE);
    })
    .sort((a, b) => distance(a, center) - distance(b, center));
  for (const pos of spots) {
    const candidate = make(pos);
    if (free(candidate)) return candidate;
  }
  return null;
}

/** A tile building as the raid rules see it: a middle, and a level. */
export function toRaidBuilding(b: TileBuilding): PlacedBuilding {
  return { type: b.type, pos: buildingCenter(b), level: b.level, rotated: b.rotated };
}

/** One kind of defense on a scouted base. */
export interface ScoutRow {
  type: BuildingType;
  count: number;
  /** The highest level among them. */
  level: number;
}

/** What a scout reports back: every defense on a base, in build order. */
export function scoutReport(buildings: readonly PlacedBuilding[]): ScoutRow[] {
  const rows: ScoutRow[] = [];
  for (const type of BUILD_ORDER) {
    if (!BUILDINGS[type].attack) continue;
    const found = buildings.filter((b) => b.type === type);
    if (found.length === 0) continue;
    const level = Math.max(...found.map((b) => b.level ?? 1));
    rows.push({ type, count: found.length, level });
  }
  return rows;
}

/** How thick an island's forest grows: a few palms round a low camp, deep jungle round a fortress. */
export function forestCover(hq: number): number {
  return Math.min(1, 0.1 + 0.07 * hq);
}

/** A full raid island: an enemy base of this HQ level with cover, mines and a landing round it. */
export function generateIsland(seed: number, hq: number, options?: BaseOptions): IslandLayout {
  const shape = islandShape(seed, hq);
  const base = enemyBase(seed, hq, { puzzle: puzzleFor(seed, hq), ...options }, shape);
  const standing = base.filter((b) => b.type !== "landmine").map(toRaidBuilding);
  const island = dressIsland(seed, 1 + Math.floor(hq / 5), standing, shape, forestCover(hq));
  // The first islands are a short walk from the beach: a hidden mine there is just a trap.
  const buried = hq < FIRST_MINES_HQ ? [] : island.mines;
  return { ...island, mines: [...buried, ...minesOf(base)] };
}

/**
 * A rival crew's own base, on the island every crew's home is built on. Like at home the forest
 * stands everywhere until it's been cleared, so all that's open is the ground round the base.
 */
export function rivalIsland(seed: number, buildings: readonly TileBuilding[]): IslandLayout {
  const standing = buildings
    .filter((b) => b.level > 0 && b.type !== "landmine")
    .map(toRaidBuilding);
  const hq = buildings.find((b) => b.type === "headquarters")?.level ?? 1;
  const island = dressIsland(seed, 1 + Math.floor(hq / 5), standing, HOME_SHAPE, 1);
  return { ...island, mines: [...island.mines, ...minesOf(buildings)] };
}

/** Where a base's bought land mines are: they're hidden mines in a raid, not buildings. */
export function minesOf(base: readonly TileBuilding[]): Vec2[] {
  return base.filter((b) => b.type === "landmine" && b.level > 0).map(buildingCenter);
}
