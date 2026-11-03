import { describe, expect, it } from "vitest";
import { BUILDINGS, type BuildingType } from "./buildings";
import { buildingCenter } from "./crewIsland";
import { enemyBase } from "./enemyBase";
import { islandShape } from "./islandShapes";
import {
  baseWorth,
  PUZZLES,
  type Puzzle,
  puzzleDefenses,
  puzzleFor,
  puzzlePlan,
  worthOf,
} from "./puzzles";
import { add, distance, normalize, scale, sub, vec } from "./vec";

const ALL = Object.keys(PUZZLES) as Puzzle[];

/** The first seed whose island at this level is this puzzle. */
function seedFor(puzzle: Puzzle, hq: number, after = 0): number {
  for (let seed = after; seed < after + 400000; seed++)
    if (puzzleFor(seed, hq) === puzzle) return seed;
  throw new Error(`${puzzle} never turns up at HQ ${hq}`);
}

/** How much of a puzzle's plan stood where it was meant to, and the base it made. */
function built(puzzle: Puzzle, hq: number, seed: number) {
  const shape = islandShape(seed, hq);
  const base = enemyBase(seed, hq, { puzzle }, shape);
  const hqBuilding = base.find((b) => b.type === "headquarters");
  if (!hqBuilding) throw new Error("no headquarters");
  const center = buildingCenter(hqBuilding);
  const forward = normalize(sub(shape.spawn, center));
  const across = vec(-forward.y, forward.x);
  const plan = puzzlePlan(puzzle, hq).filter((s) => s.type !== "storage");
  const held = plan.filter((spot) => {
    const want = add(center, add(scale(forward, spot.forward), scale(across, spot.across)));
    return base.some((b) => b.type === spot.type && distance(buildingCenter(b), want) < 4.5);
  }).length;
  return { base, held: held / plan.length };
}

describe("puzzle islands", () => {
  it("makes about one island in five a puzzle, and none of the first", () => {
    let puzzles = 0;
    for (let seed = 0; seed < 3000; seed++) if (puzzleFor(seed, 8)) puzzles++;
    expect(puzzles / 3000).toBeGreaterThan(0.17);
    expect(puzzles / 3000).toBeLessThan(0.23);
    for (let seed = 0; seed < 500; seed++) {
      expect(puzzleFor(seed, 1)).toBeNull();
      expect(puzzleFor(seed, 2)).toBeNull();
    }
  });

  it("deals out every puzzle once its level comes round", () => {
    const seen = new Set<Puzzle>();
    for (let seed = 0; seed < 4000; seed++) {
      const p = puzzleFor(seed, 12);
      if (p) seen.add(p);
    }
    expect([...seen].sort()).toEqual([...ALL].sort());
  });

  it("gives a puzzle about the firepower of an ordinary base", () => {
    for (const puzzle of ALL) {
      for (let hq = PUZZLES[puzzle].from; hq <= 20; hq++) {
        const types = puzzlePlan(puzzle, hq)
          .map((s) => s.type)
          .filter((t): t is BuildingType => t !== "storage" && BUILDINGS[t].attack !== undefined);
        const ratio = worthOf(types, hq) / baseWorth(hq);
        expect(ratio, `${puzzle} at HQ ${hq}`).toBeGreaterThan(0.85);
        expect(ratio, `${puzzle} at HQ ${hq}`).toBeLessThan(1.4);
      }
    }
  });

  it("builds every puzzle in full, and mostly where it was drawn", { timeout: 60_000 }, () => {
    for (const puzzle of ALL) {
      for (const hq of [PUZZLES[puzzle].from, 8, 14, 20]) {
        const shares: number[] = [];
        for (let k = 0; k < 6; k++) {
          const seed = seedFor(puzzle, hq, k * 1000);
          const { base, held } = built(puzzle, hq, seed);
          const defenses = base.filter((b) => BUILDINGS[b.type].attack).length;
          expect(defenses, `${puzzle} at HQ ${hq}`).toBe(puzzleDefenses(puzzle, hq));
          expect(base.filter((b) => b.type === "headquarters")).toHaveLength(1);
          shares.push(held);
        }
        const mean = shares.reduce((a, b) => a + b, 0) / shares.length;
        expect(mean, `${puzzle} at HQ ${hq}: ${shares.map((s) => s.toFixed(2))}`).toBeGreaterThan(
          0.6,
        );
      }
    }
  });
});
