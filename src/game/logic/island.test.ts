import { describe, expect, it } from "vitest";
import { BUILDINGS, type BuildingType } from "./buildings";
import { type CrewLayout, fits, hqLevel, obstacles } from "./crewIsland";
import { allowedCount, levelCap } from "./economy";
import { enemyBase, generateIsland, scoutReport } from "./enemyBase";
import { isOnGrass, isOnLand, shoreDistance } from "./island";
import { createRaid } from "./raid";
import { distance, vec } from "./vec";

const SEEDS = [1, 2, 3, 42, 1234, 98765];
const HQ_LEVELS = [1, 6, 12];

function countByType(types: string[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const t of types) counts[t] = (counts[t] ?? 0) + 1;
  return counts;
}

describe("enemy base layout", () => {
  const hqOf = (layout: { buildings: ReturnType<typeof generateIsland>["buildings"] }) =>
    layout.buildings.find((b) => b.type === "headquarters");

  it("rings the headquarters with its defenses, on every side", () => {
    for (const seed of SEEDS) {
      for (const level of [6, 12, 20]) {
        const island = generateIsland(seed, level);
        const hq = hqOf(island);
        if (!hq) throw new Error("no headquarters");
        const defenses = island.buildings.filter((b) => BUILDINGS[b.type].attack);
        const near = defenses.filter((b) => distance(b.pos, hq.pos) < 26);
        expect(near.length / defenses.length).toBeGreaterThan(0.8);
        // No side of the headquarters is left open.
        const sides = new Set(
          near.map((b) => Math.floor(Math.atan2(b.pos.y - hq.pos.y, b.pos.x - hq.pos.x) / 1.6)),
        );
        expect(sides.size).toBeGreaterThanOrEqual(3);
      }
    }
  });

  it("leaves the mills outside the defenses", () => {
    for (const seed of SEEDS) {
      const island = generateIsland(seed, 12);
      const hq = hqOf(island);
      if (!hq) throw new Error("no headquarters");
      const out = (types: string[]) => {
        const found = island.buildings.filter((b) => types.includes(b.type));
        const total = found.reduce((sum, b) => sum + distance(b.pos, hq.pos), 0);
        return total / found.length;
      };
      expect(out(["goldMine", "lumberCamp", "quarry", "scrapYard"])).toBeGreaterThan(
        out(["gunTurret", "mortar", "harpoon", "flamethrower"]) + 6,
      );
    }
  });

  it("builds a retaken base with everything allowed, at full level", () => {
    for (const seed of SEEDS) {
      for (const hq of [4, 9, 15, 20]) {
        const base = enemyBase(seed, hq, { maxed: true });
        for (const type of Object.keys(BUILDINGS) as BuildingType[]) {
          const found = base.filter((b) => b.type === type);
          expect(found).toHaveLength(allowedCount(type, hq));
          if (type === "headquarters") continue;
          for (const b of found) expect(b.level).toBe(levelCap(type, hq));
        }
      }
    }
  });

  it("keeps growing stronger past the highest headquarters level", () => {
    const top = enemyBase(1, 20, { maxed: true });
    const past = enemyBase(1, 26, { maxed: true });
    expect(past).toHaveLength(top.length);
    const turret = (base: typeof top) => base.find((b) => b.type === "gunTurret")?.level ?? 0;
    expect(turret(past)).toBe(turret(top) + 6);
  });
});

describe("generateIsland", () => {
  it("is deterministic for a seed", () => {
    expect(generateIsland(7, 2)).toEqual(generateIsland(7, 2));
  });

  it("gives every island at an HQ level exactly the same buildings", () => {
    for (const hq of HQ_LEVELS) {
      const expected = Object.fromEntries(
        (Object.keys(BUILDINGS) as BuildingType[])
          .filter((type) => type !== "landmine")
          .map((type) => [type, allowedCount(type, hq)] as const)
          .filter(([, count]) => count > 0),
      );
      for (const seed of SEEDS) {
        const island = generateIsland(seed, hq);
        expect(countByType(island.buildings.map((b) => b.type))).toEqual(expected);
        // Land mines go in hidden, on top of the ones along the beach.
        expect(island.mines.length).toBeGreaterThanOrEqual(allowedCount("landmine", hq));
      }
    }
  });

  it("builds enemy bases by the crew island's own tile, count and level rules", () => {
    const cleared = obstacles().map((o) => o.id);
    for (const hq of HQ_LEVELS) {
      for (const seed of SEEDS) {
        const buildings = enemyBase(seed, hq);
        const layout: Pick<CrewLayout, "buildings" | "cleared"> = { buildings, cleared };
        expect(hqLevel(layout)).toBe(hq);
        const types = Object.keys(BUILDINGS) as BuildingType[];
        expect(buildings).toHaveLength(types.reduce((n, t) => n + allowedCount(t, hq), 0));
        for (const b of buildings) {
          expect(fits(layout, b)).toBe(true);
          if (b.type !== "headquarters") expect(b.level).toBeLessThanOrEqual(levelCap(b.type, hq));
          expect(b.level).toBeGreaterThanOrEqual(1);
        }
      }
    }
  });

  it("reports every defense on a base to a scout", () => {
    const { buildings } = generateIsland(3, 8);
    const report = scoutReport(buildings);
    const defenses = buildings.filter((b) => BUILDINGS[b.type].attack);
    expect(report.reduce((n, row) => n + row.count, 0)).toBe(defenses.length);
    for (const row of report) {
      const levels = defenses.filter((b) => b.type === row.type).map((b) => b.level ?? 1);
      expect(row.level).toBe(Math.max(...levels));
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
      const { buildings } = generateIsland(seed, 12);
      buildings.forEach((b, i) => {
        const r = BUILDINGS[b.type].radius;
        expect(isOnGrass(b.pos.x, b.pos.y, r)).toBe(true);
        for (const other of buildings.slice(i + 1)) {
          expect(distance(b.pos, other.pos)).toBeGreaterThan(r + BUILDINGS[other.type].radius);
        }
      });
    }
  });

  it("lands the crew on the south-west beach with the gunboat moored off it", () => {
    for (const seed of SEEDS) {
      const island = generateIsland(seed, 1);
      expect(isOnLand(island.spawn.x, island.spawn.y)).toBe(true);
      expect(island.spawn.x).toBeLessThan(0);
      expect(island.spawn.y).toBeGreaterThan(0);
      expect(shoreDistance(island.boat.x, island.boat.y)).toBeLessThan(0);
    }
  });
});
