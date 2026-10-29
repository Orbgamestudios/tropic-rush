import { describe, expect, it } from "vitest";
import { BUILDINGS, HQ_LEVELS, MAX_HQ_LEVEL } from "./buildings";
import { BOARD_DISTANCE } from "./gunboat";
import { generateIsland, isOnGrass, isOnLand, shoreDistance } from "./island";
import { distance, vec } from "./vec";

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
      const expected = HQ_LEVELS[level]?.buildings;
      for (const seed of SEEDS) {
        const island = generateIsland(seed, level);
        expect(countByType(island.buildings.map((b) => b.type))).toEqual(expected);
        expect(island.mines).toHaveLength(HQ_LEVELS[level]?.mines ?? -1);
      }
    }
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

  it("lands the crew on the beach with the gunboat in reach", () => {
    for (const seed of SEEDS) {
      const island = generateIsland(seed, 1);
      expect(isOnLand(island.spawn.x, island.spawn.y)).toBe(true);
      expect(isOnLand(island.boatExit.x, island.boatExit.y)).toBe(true);
      expect(shoreDistance(island.boat.x, island.boat.y)).toBeLessThan(0);
      // A hero walking down to the waterline next to the boat can board it.
      let edge = vec(island.boat.x, island.boat.y);
      while (!isOnLand(edge.x, edge.y, 0.8)) edge = vec(edge.x, edge.y - 0.1);
      expect(distance(edge, island.boat)).toBeLessThanOrEqual(BOARD_DISTANCE);
    }
  });
});
