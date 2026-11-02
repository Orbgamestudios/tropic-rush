import { describe, expect, it } from "vitest";
import { CRYSTAL_KINDS, type CrystalKind, noCrystals } from "./crystals";
import { HERO_KINDS, type HeroKind } from "./heroes";
import {
  canBuy,
  capstones,
  heroMods,
  heroTree,
  lockedBy,
  majorUpgrades,
  NO_MODS,
  readOwned,
  type TreeUpgrade,
  treePaths,
  UPGRADES_PER_HERO,
} from "./heroTrees";

function crystalsIn(kind: HeroKind): Record<CrystalKind, number> {
  const sum = noCrystals();
  for (const u of heroTree(kind)) {
    for (const k of CRYSTAL_KINDS) sum[k] += u.crystals[k] ?? 0;
  }
  return sum;
}

const rich = { nature: 99, fire: 99, ice: 99, dark: 99 };

/** An upgrade by name, with everything it needs, one line back to the start each time. */
function withPath(kind: HeroKind, name: string): string[] {
  const tree = heroTree(kind);
  const owned: string[] = [];
  let u: TreeUpgrade | undefined = tree.find((x) => x.name === name);
  while (u) {
    owned.unshift(u.id);
    const before: string | undefined = u.needs[0];
    u = tree.find((x) => x.id === before);
  }
  return owned;
}

describe("hero trees", () => {
  it("gives every hero the same 13-upgrade shape, with 42 checkpoints between", () => {
    for (const kind of HERO_KINDS) {
      const tree = heroTree(kind);
      expect(tree).toHaveLength(UPGRADES_PER_HERO);
      expect(majorUpgrades(kind).map((u) => u.tier)).toEqual(
        // First, then the two paths: tier 2, tier 3 and 4 twice over, capstone.
        [1, 2, 3, 4, 3, 4, 5, 2, 3, 4, 3, 4, 5],
      );
      expect(tree.filter((u) => u.line)).toHaveLength(42);
      expect(new Set(tree.map((u) => u.id)).size).toBe(UPGRADES_PER_HERO);
      expect(treePaths(kind)).toHaveLength(2);
    }
  });

  it("costs 20,550 gold and 53 crystals a tree, and 8,520 gold more for the checkpoints", () => {
    for (const kind of HERO_KINDS) {
      const gold = majorUpgrades(kind).reduce((sum, u) => sum + u.gold, 0);
      expect(gold).toBe(20_550);
      const steps = heroTree(kind).filter((u) => u.line);
      expect(steps.reduce((sum, u) => sum + u.gold, 0)).toBe(8_520);
      for (const u of steps) expect(u.crystals).toEqual({});
      const total = Object.values(crystalsIn(kind)).reduce((a, b) => a + b, 0);
      expect(total, kind).toBe(53);
    }
  });

  it("makes each line's checkpoints come in order, and an upgrade need its line", () => {
    const tree = heroTree("rifleman");
    const hot = tree.find((u) => u.name === "Hot Rounds");
    if (!hot) throw new Error("missing upgrade");
    const path = withPath("rifleman", "Hot Rounds");
    expect(path).toHaveLength(5);
    const steps = tree.filter((u) => path.includes(u.id) && u.line);
    expect(steps.map((u) => u.gold)).toEqual([40, 40, 40]);
    for (let have = 0; have < path.length; have++) {
      const next = tree.find((u) => u.id === path[have]);
      if (!next) throw new Error("missing upgrade");
      expect(canBuy("rifleman", next, path.slice(0, have), 9999, rich)).toBe(true);
      const after = tree.find((u) => u.id === path[have + 1]);
      if (after) expect(canBuy("rifleman", after, path.slice(0, have), 9999, rich)).toBe(false);
    }
    expect(heroMods("rifleman", path).hp).toBeGreaterThanOrEqual(1.1);
  });

  it("gives little buffs that add up to less than the upgrades they lead to", () => {
    for (const kind of HERO_KINDS) {
      const mods = heroMods(
        kind,
        heroTree(kind)
          .filter((u) => u.line)
          .map((u) => u.id),
      );
      expect(mods.hp, kind).toBeGreaterThan(1.05);
      expect(mods.hp, kind).toBeLessThan(1.3);
      expect(mods.damage, kind).toBeLessThan(1.3);
      expect(mods.heal, kind).toBeLessThan(1.3);
      expect(mods.reload, kind).toBeGreaterThan(0.8);
      expect(mods.speed, kind).toBeLessThan(1.2);
    }
    expect(
      heroMods(
        "rifleman",
        heroTree("rifleman").map((u) => u.id),
      ).unload,
    ).toBeLessThan(1);
    expect(
      heroMods(
        "heavy",
        heroTree("heavy").map((u) => u.id),
      ).spinUp,
    ).toBeLessThan(0.8);
  });

  it("matches each hero's crystal totals in the plan", () => {
    const plan: Record<HeroKind, [number, number, number, number]> = {
      rifleman: [15, 18, 8, 12],
      medic: [18, 14, 9, 12],
      heavy: [14, 21, 8, 10],
      tank: [15, 20, 8, 10],
      bazooka: [2, 26, 13, 12],
      grenadier: [7, 22, 12, 12],
      engineer: [14, 21, 6, 12],
    };
    for (const kind of HERO_KINDS) {
      const { nature, fire, ice, dark } = crystalsIn(kind);
      expect([nature, fire, ice, dark], kind).toEqual(plan[kind]);
    }
  });

  it("needs each upgrade in turn, and either line for a capstone", () => {
    const tree = heroTree("rifleman");
    const [first] = tree;
    const hot = tree.find((u) => u.name === "Hot Rounds");
    const cap = tree.find((u) => u.name === "Ricochet");
    if (!first || !hot || !cap) throw new Error("missing upgrades");
    expect(lockedBy("rifleman", first, [])).toBeNull();
    expect(lockedBy("rifleman", hot, [])).not.toBeNull();
    expect(lockedBy("rifleman", hot, withPath("rifleman", "Hot Rounds"))).toBeNull();
    const [upper, lower] = cap.needs;
    if (!upper || !lower) throw new Error("missing lines");
    expect(tree.find((u) => u.id === upper)?.line?.from).toBe("rifleman-deadeye");
    expect(tree.find((u) => u.id === lower)?.line?.from).toBe("rifleman-fast-unload");
    expect(lockedBy("rifleman", cap, [])).toHaveLength(2);
    expect(lockedBy("rifleman", cap, [upper])).toBeNull();
    expect(lockedBy("rifleman", cap, [lower])).toBeNull();
  });

  it("won't sell what's locked, owned or too dear", () => {
    const [first, second] = heroTree("medic");
    if (!first || !second) throw new Error("missing upgrades");
    expect(canBuy("medic", first, [], 150, rich)).toBe(true);
    expect(canBuy("medic", first, [], 149, rich)).toBe(false);
    expect(canBuy("medic", first, [], 150, noCrystals())).toBe(false);
    expect(canBuy("medic", first, [first.id], 150, rich)).toBe(false);
    expect(canBuy("medic", second, [], 9999, rich)).toBe(false);
  });

  it("adds upgrades up the right way", () => {
    expect(heroMods("rifleman", [])).toEqual(NO_MODS);
    const all = majorUpgrades("rifleman").map((u) => u.id);
    const mods = heroMods("rifleman", all);
    expect(mods.hp).toBeCloseTo(1.1 * 1.2);
    expect(mods.range).toBe(3);
    expect(mods.shots).toBe(1);
    expect(mods.fireSpeed).toBe(0.4);
    expect(mods.lastStand).toBe(true);
    expect(mods.signature).toBe(1);
    // Two healing upgrades on one path multiply.
    expect(heroMods("medic", ["medic-steady-hand", "medic-stronger-mix"]).heal).toBeCloseTo(
      1.15 * 1.25,
    );
  });

  it("carries every hero's signature move on a dark-crystal capstone", () => {
    for (const kind of HERO_KINDS) {
      const tops = capstones(kind);
      expect(tops).toHaveLength(2);
      for (const u of tops) expect(u.crystals.dark).toBe(4);
      const owned = heroTree(kind).map((u) => u.id);
      const mods = heroMods(kind, owned);
      const tricks = Object.values(mods).filter((v) => v === true).length;
      expect(mods.signature + tricks, kind).toBeGreaterThan(0);
    }
  });

  it("every upgrade does something", () => {
    for (const kind of HERO_KINDS) {
      for (const u of heroTree(kind)) {
        expect(heroMods(kind, [u.id]), u.name).not.toEqual(NO_MODS);
      }
    }
  });

  it("sets out the board without two upgrades on one spot", () => {
    for (const kind of HERO_KINDS) {
      const spots = heroTree(kind).map((u) => `${u.column},${u.row}`);
      expect(new Set(spots).size).toBe(UPGRADES_PER_HERO);
      const steps = heroTree(kind).filter((u) => u.line);
      for (const a of steps) {
        for (const b of steps) {
          if (a === b) continue;
          // In board shares, on the phone: far enough apart to tap either one.
          const gap = Math.hypot((a.column - b.column) * 187, (a.row - b.row) * 56);
          expect(gap, `${a.id} ${b.id}`).toBeGreaterThan(30);
        }
      }
    }
  });

  it("drops unknown upgrades and anything cut off from the tree", () => {
    expect(readOwned("rifleman", "nonsense")).toEqual([]);
    expect(readOwned("rifleman", ["rifleman-basic-training", "made-up"])).toEqual([
      "rifleman-basic-training",
    ]);
    expect(readOwned("rifleman", ["rifleman-hot-rounds"])).toEqual([]);
    const path = withPath("rifleman", "Hot Rounds");
    expect(readOwned("rifleman", [...path].reverse())).toEqual(path);
  });
});
