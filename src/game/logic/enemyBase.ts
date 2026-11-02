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
import { between, createRng } from "./rng";
import { add, distance, fromAngle, type Vec2, vec } from "./vec";

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

export interface BaseOptions {
  /** Every building at the top of what its headquarters allows, for bases retaken in the night. */
  maxed?: boolean;
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
  const anchor =
    shape === HOME_SHAPE ? add(BASE_CENTER, fromAngle(beach + Math.PI, 6)) : shape.base;
  const center = add(anchor, vec(between(rng, -3, 3), between(rng, -3, 3)));
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
  // Defenses go round the circle in turn, each a share of the way on from the last.
  const defenses = defensesOf(rated);
  const step = Math.PI * 2 * 0.382;
  const tight = Math.min(1, 0.68 + rated * 0.022);
  let turn = rng() * Math.PI * 2;
  for (const type of BUILD_ORDER) {
    const cap = type === "headquarters" ? rated : levelCap(type, rated);
    const [nearRing, farRing] = RINGS[type] ?? OUTER_RING;
    const near = nearRing * tight;
    const far = farRing * tight;
    for (let i = 0; i < allowedCount(type, rated); i++) {
      // Upgraded close to the cap, the way a crew would, unless it's a full rebuild.
      const below = !options.maxed && rng() < 0.4 ? 1 : 0;
      const level = (type === "headquarters" ? rated : Math.max(1, cap - below)) + extra;
      const spread = (Math.PI * 2) / Math.max(4, defenses);
      turn += step;
      const make = (pos: Vec2): TileBuilding => ({
        id: `e${buildings.length}`,
        type,
        ...cornerFor(type, false, pos),
        rotated: false,
        level,
      });
      let placed: TileBuilding | null = null;
      for (let attempt = 0; attempt < 800 && !placed; attempt++) {
        const loose = attempt >= 500;
        const pos =
          type === "headquarters"
            ? center
            : BUILDINGS[type].attack && !loose
              ? add(
                  center,
                  fromAngle(turn + between(rng, -spread, spread), between(rng, near, far)),
                )
              : add(
                  center,
                  fromAngle(rng() * Math.PI * 2, between(rng, near, far + (loose ? 14 : 0))),
                );
        const candidate = make(pos);
        if (clearance(candidate, loose ? 1 : GAP_TILES)) placed = candidate;
      }
      // Every base at a level has the same buildings: anywhere free will do, nearest first.
      placed ??= nearestFree(center, tiles, make, (c) => clearance(c, 1));
      if (placed) buildings.push(placed);
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
  const base = enemyBase(seed, hq, options, shape);
  const standing = base.filter((b) => b.type !== "landmine").map(toRaidBuilding);
  const island = dressIsland(seed, 1 + Math.floor(hq / 5), standing, shape, forestCover(hq));
  // The first islands are a short walk from the beach: a hidden mine there is just a trap.
  const buried = hq < FIRST_MINES_HQ ? [] : island.mines;
  return { ...island, mines: [...buried, ...minesOf(base)] };
}

/** A rival crew's own base, on the island every crew's home is built on. */
export function rivalIsland(seed: number, buildings: readonly TileBuilding[]): IslandLayout {
  const standing = buildings
    .filter((b) => b.level > 0 && b.type !== "landmine")
    .map(toRaidBuilding);
  const hq = buildings.find((b) => b.type === "headquarters")?.level ?? 1;
  const island = dressIsland(seed, 1 + Math.floor(hq / 5), standing, HOME_SHAPE, forestCover(hq));
  return { ...island, mines: [...island.mines, ...minesOf(buildings)] };
}

/** Where a base's bought land mines are: they're hidden mines in a raid, not buildings. */
export function minesOf(base: readonly TileBuilding[]): Vec2[] {
  return base.filter((b) => b.type === "landmine" && b.level > 0).map(buildingCenter);
}
