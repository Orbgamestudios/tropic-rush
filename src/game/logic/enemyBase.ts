// Enemy bases are built like a crew's island: buildings on the same 2 m tiles, as many of each as
// that headquarters level allows, and upgraded within the same level caps. A raid is a fight
// against another crew's base, not a separate kind of map.

import type { BuildingType } from "./buildings";
import {
  buildingCenter,
  type CrewLayout,
  cornerFor,
  fits,
  footprint,
  obstacles,
  type PlacedBuilding as TileBuilding,
} from "./crewIsland";
import { allowedCount, levelCap } from "./economy";
import {
  BASE_CENTER,
  BEACH_DIRECTION,
  dressIsland,
  type IslandLayout,
  type PlacedBuilding,
} from "./island";
import { between, createRng } from "./rng";
import { add, fromAngle, type Vec2, vec } from "./vec";

/** Defenses first so they take the front line, then everything behind them. */
const BUILD_ORDER: readonly BuildingType[] = [
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
  "goldVault",
  "timberShed",
  "stoneYard",
  "scrapBin",
];

/** Tiles kept free between buildings, so heroes can walk the base. */
const GAP_TILES = 2;

/** An enemy base as a crew-style layout: every building on tiles, with its level. */
export function enemyBase(seed: number, hq: number): TileBuilding[] {
  const rng = createRng(seed);
  const beach = Math.atan2(BEACH_DIRECTION.y, BEACH_DIRECTION.x);
  const front = [beach - 0.38 * Math.PI, beach + 0.38 * Math.PI] as const;
  const back = [beach + 0.3 * Math.PI, beach + 1.7 * Math.PI] as const;
  const middle = add(BASE_CENTER, fromAngle(beach + Math.PI, 13));
  const around =
    (center: Vec2, minAngle: number, maxAngle: number, minR: number, maxR: number) => () =>
      add(center, fromAngle(between(rng, minAngle, maxAngle), between(rng, minR, maxR)));
  const anywhere = around(BASE_CENTER, 0, Math.PI * 2, 8, 34);
  const behind = around(BASE_CENTER, back[0], back[1], 10, 36);
  const samplers: Partial<Record<BuildingType, () => Vec2>> = {
    headquarters: () => add(middle, vec(between(rng, -4, 4), between(rng, -4, 4))),
    gunTurret: around(BASE_CENTER, front[0], front[1], 12, 30),
    harpoon: around(BASE_CENTER, front[0], front[1], 10, 28),
    mortar: around(BASE_CENTER, 0, Math.PI * 2, 5, 20),
    flamethrower: around(BASE_CENTER, front[0], front[1], 6, 18),
    watchtower: around(BASE_CENTER, 0, Math.PI * 2, 14, 32),
  };
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
  for (const type of BUILD_ORDER) {
    const cap = type === "headquarters" ? hq : levelCap(type, hq);
    for (let i = 0; i < allowedCount(type, hq); i++) {
      const sample = samplers[type] ?? behind;
      // Upgraded close to the cap, the way a crew would, but not everything is maxed.
      const buildingLevel = Math.max(1, cap - (rng() < 0.4 ? 1 : 0));
      for (let attempt = 0; attempt < 800; attempt++) {
        const pos = attempt < 500 ? sample() : anywhere();
        const candidate: TileBuilding = {
          id: `e${buildings.length}`,
          type,
          ...cornerFor(type, false, pos),
          rotated: false,
          level: type === "headquarters" ? hq : buildingLevel,
        };
        if (!fits(layout, candidate)) continue;
        if (!roomy(candidate, attempt < 500 ? GAP_TILES : 1)) continue;
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

/** A full raid island: an enemy base of this HQ level with cover, mines and a landing round it. */
export function generateIsland(seed: number, hq: number): IslandLayout {
  return dressIsland(seed, 1 + Math.floor(hq / 5), enemyBase(seed, hq).map(toRaidBuilding));
}
