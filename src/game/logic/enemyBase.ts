// Enemy bases are built like a crew's island: buildings on the same 2 m tiles, as many of each as
// that headquarters level allows, and upgraded within the same level caps. A raid is a fight
// against another crew's base, not a separate kind of map.

import { BUILDINGS, type BuildingType } from "./buildings";
import {
  buildingCenter,
  type CrewLayout,
  cornerFor,
  fits,
  footprint,
  obstacles,
  type PlacedBuilding as TileBuilding,
} from "./crewIsland";
import { allowedCount, levelCap, MAX_HQ_LEVEL } from "./economy";
import {
  BASE_CENTER,
  BEACH_DIRECTION,
  dressIsland,
  type IslandLayout,
  type PlacedBuilding,
} from "./island";
import { between, createRng } from "./rng";
import { add, fromAngle, type Vec2, vec } from "./vec";

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

/**
 * An enemy base as a crew-style layout: every building on tiles, with its level. The headquarters
 * stands in the middle with its defenses in rings all round it, so there's no way in that isn't
 * under fire, and the mills and storages lie exposed outside. Past the headquarters' top level the
 * base can't grow any more, so its buildings just keep getting stronger.
 */
export function enemyBase(seed: number, hq: number, options: BaseOptions = {}): TileBuilding[] {
  const rng = createRng(seed);
  const beach = Math.atan2(BEACH_DIRECTION.y, BEACH_DIRECTION.x);
  const rated = Math.min(hq, MAX_HQ_LEVEL);
  const extra = hq - rated;
  const center = add(
    add(BASE_CENTER, fromAngle(beach + Math.PI, 6)),
    vec(between(rng, -3, 3), between(rng, -3, 3)),
  );
  const buildings: TileBuilding[] = [];
  // All the ground is clear on an enemy base: nobody's overgrowth to work around.
  const layout: Pick<CrewLayout, "buildings" | "cleared"> = {
    buildings,
    cleared: obstacles().map((o) => o.id),
  };
  const roomy = (c: TileBuilding, gap: number) => {
    const a = footprint(c.type, c.rotated);
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
  let turn = rng() * Math.PI * 2;
  for (const type of BUILD_ORDER) {
    const cap = type === "headquarters" ? rated : levelCap(type, rated);
    const [near, far] = RINGS[type] ?? OUTER_RING;
    for (let i = 0; i < allowedCount(type, rated); i++) {
      // Upgraded close to the cap, the way a crew would, unless it's a full rebuild.
      const below = !options.maxed && rng() < 0.4 ? 1 : 0;
      const level = (type === "headquarters" ? rated : Math.max(1, cap - below)) + extra;
      const spread = (Math.PI * 2) / Math.max(4, defenses);
      turn += step;
      for (let attempt = 0; attempt < 800; attempt++) {
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
        const candidate: TileBuilding = {
          id: `e${buildings.length}`,
          type,
          ...cornerFor(type, false, pos),
          rotated: false,
          level,
        };
        if (!fits(layout, candidate)) continue;
        if (!roomy(candidate, loose ? 1 : GAP_TILES)) continue;
        buildings.push(candidate);
        break;
      }
    }
  }
  return buildings;
}

/** A tile building as the raid rules see it: a middle, and a level. */
export function toRaidBuilding(b: TileBuilding): PlacedBuilding {
  return { type: b.type, pos: buildingCenter(b), level: b.level };
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

/** A full raid island: an enemy base of this HQ level with cover, mines and a landing round it. */
export function generateIsland(seed: number, hq: number, options?: BaseOptions): IslandLayout {
  const base = enemyBase(seed, hq, options);
  const standing = base.filter((b) => b.type !== "landmine").map(toRaidBuilding);
  const island = dressIsland(seed, 1 + Math.floor(hq / 5), standing);
  return { ...island, mines: [...island.mines, ...minesOf(base)] };
}

/** Where a base's bought land mines are: they're hidden mines in a raid, not buildings. */
export function minesOf(base: readonly TileBuilding[]): Vec2[] {
  return base.filter((b) => b.type === "landmine" && b.level > 0).map(buildingCenter);
}
