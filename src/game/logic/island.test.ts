import { describe, expect, it } from "vitest";
import { BUILDINGS, type BuildingType, HQ_LEVELS, MAX_HQ_LEVEL } from "./buildings";
import { type CrewLayout, fits, hqLevel, obstacles } from "./crewIsland";
import { allowedCount, levelCap } from "./economy";
import { enemyBase, enemyHqLevel, generateIsland } from "./enemyBase";
import { BOARD_DISTANCE } from "./gunboat";
import { isOnGrass, isOnLand, shoreDistance } from "./island";
import { createRaid } from "./raid";
import { add, distance, normalize, scale, vec } from "./vec";

const SEEDS = [1, 2, 3, 42, 1234, 98765];

function countByType(types: string[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const t of types) counts[t] = (counts[t] ?? 0) + 1;
  return counts;
}

describe("generateIsland", () => {
  it("is deterministic for a seed", () => {
    expect(generateIsland(7, 2)).toEqual(generateIsland(7, 2));
  });

  it("gives every island at an HQ level exactly the same buildings", () => {
    for (let level = 1; level <= MAX_HQ_LEVEL; level++) {
      const hq = enemyHqLevel(level);
      const expected = Object.fromEntries(
        (Object.keys(BUILDINGS) as BuildingType[])
          .map((type) => [type, allowedCount(type, hq)] as const)
          .filter(([, count]) => count > 0),
      );
      for (const seed of SEEDS) {
        const island = generateIsland(seed, level);
        expect(countByType(island.buildings.map((b) => b.type))).toEqual(expected);
        expect(island.mines).toHaveLength(HQ_LEVELS[level]?.mines ?? -1);
      }
    }
  });

  it("builds enemy bases by the crew island's own tile, count and level rules", () => {
    const cleared = obstacles().map((o) => o.id);
    for (let level = 1; level <= MAX_HQ_LEVEL; level++) {
      for (const seed of SEEDS) {
        const buildings = enemyBase(seed, level);
        const layout: Pick<CrewLayout, "buildings" | "cleared"> = { buildings, cleared };
        const hq = enemyHqLevel(level);
        expect(hqLevel(layout)).toBe(hq);
        for (const b of buildings) {
          expect(fits(layout, b)).toBe(true);
          if (b.type !== "headquarters") expect(b.level).toBeLessThanOrEqual(levelCap(b.type, hq));
          expect(b.level).toBeGreaterThanOrEqual(1);
        }
      }
    }
  });

  it("makes buildings tougher and harder-hitting at higher levels", () => {
    const hps = (level: number) =>
      createRaid(
        { ...generateIsland(1, 1), buildings: [{ type: "gunTurret", pos: vec(0, 0), level }] },
        [],
      ).buildings[0]?.maxHp ?? 0;
    expect(hps(5)).toBeGreaterThan(hps(1));
  });

  it("varies the layout between seeds", () => {
    const a = generateIsland(1, 3).buildings.map((b) => b.pos);
    const b = generateIsland(2, 3).buildings.map((b) => b.pos);
    expect(a).not.toEqual(b);
  });

  it("puts buildings on grass without overlapping", () => {
    for (const seed of SEEDS) {
      const { buildings } = generateIsland(seed, MAX_HQ_LEVEL);
      buildings.forEach((b, i) => {
        const r = BUILDINGS[b.type].radius;
        expect(isOnGrass(b.pos.x, b.pos.y, r)).toBe(true);
        for (const other of buildings.slice(i + 1)) {
          expect(distance(b.pos, other.pos)).toBeGreaterThan(r + BUILDINGS[other.type].radius);
        }
      });
    }
  });

  it("lands the crew on the south-west beach with the gunboat in reach", () => {
    for (const seed of SEEDS) {
      const island = generateIsland(seed, 1);
      expect(isOnLand(island.spawn.x, island.spawn.y)).toBe(true);
      expect(island.spawn.x).toBeLessThan(0);
      expect(island.spawn.y).toBeGreaterThan(0);
      expect(isOnLand(island.boatExit.x, island.boatExit.y)).toBe(true);
      expect(shoreDistance(island.boat.x, island.boat.y)).toBeLessThan(0);
      // A hero walking down to the waterline next to the boat can board it.
      const inland = normalize(vec(-island.boat.x, -island.boat.y));
      let edge = vec(island.boat.x, island.boat.y);
      while (!isOnLand(edge.x, edge.y, 0.8)) edge = add(edge, scale(inland, 0.1));
      expect(distance(edge, island.boat)).toBeLessThanOrEqual(BOARD_DISTANCE);
    }
  });
});
