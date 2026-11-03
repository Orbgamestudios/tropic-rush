import { describe, expect, it } from "vitest";
import { CRYSTAL_KINDS, type CrystalKind, noCrystals } from "./crystals";
import { HERO_KINDS, type HeroKind } from "./heroes";
import {
  BRANCHES,
  canBuy,
  capstones,
  heroMods,
  heroTree,
  lockedBy,
  majorUpgrades,
  NO_MODS,
  readOwned,
  TIERS,
  type TreeUpgrade,
  tierHq,
  treePaths,
  trimUpgrades,
  UPGRADES_PER_HERO,
} from "./heroTrees";

function crystalsIn(upgrades: readonly TreeUpgrade[]): Record<CrystalKind, number> {
  const sum = noCrystals();
  for (const u of upgrades) {
    for (const k of CRYSTAL_KINDS) sum[k] += u.crystals[k] ?? 0;
  }
  return sum;
}

const rich = { nature: 99, fire: 99, ice: 99, dark: 99 };
const TOP_HQ = 20;

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
  it("gives every hero a first upgrade, then four branches of nine, one for each crystal", () => {
    for (const kind of HERO_KINDS) {
      const tree = heroTree(kind);
      expect(tree).toHaveLength(UPGRADES_PER_HERO);
      const tiers = [2, 3, 4, 5, 6, 7, 8, 9, 10];
      expect(majorUpgrades(kind).map((u) => u.tier)).toEqual([
        1,
        ...tiers,
        ...tiers,
        ...tiers,
        ...tiers,
      ]);
      // Two checkpoints on each of the 36 lines.
      expect(tree.filter((u) => u.line)).toHaveLength(72);
      expect(new Set(tree.map((u) => u.id)).size).toBe(UPGRADES_PER_HERO);
      expect(treePaths(kind)).toHaveLength(4);
      for (const branch of BRANCHES) {
        const on = majorUpgrades(kind).filter((u) => u.branch === branch);
        expect(on, `${kind} ${branch}`).toHaveLength(9);
        // Each branch is paid for in its own crystal, and only that one.
        const paid = crystalsIn(on);
        for (const k of CRYSTAL_KINDS) {
          if (k === branch) expect(paid[k]).toBe(23);
          else expect(paid[k]).toBe(0);
        }
      }
    }
  });

  it("costs 110,950 gold a tree, and 106,400 more for the checkpoints", () => {
    for (const kind of HERO_KINDS) {
      const gold = majorUpgrades(kind).reduce((sum, u) => sum + u.gold, 0);
      expect(gold).toBe(110_950);
      const steps = heroTree(kind).filter((u) => u.line);
      expect(steps.reduce((sum, u) => sum + u.gold, 0)).toBe(106_400);
      for (const u of steps) expect(u.crystals).toEqual({});
    }
  });

  it("gives nothing that reaches further: no upgrade adds range", () => {
    for (const kind of HERO_KINDS) {
      for (const u of heroTree(kind)) {
        expect(u.text, u.name).not.toMatch(/range/i);
        expect(Object.keys(u.mods), u.name).not.toContain("range");
      }
    }
  });

  it("opens each tier at a headquarters level, and only the last near the top", () => {
    expect([1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(tierHq)).toEqual([1, 2, 3, 5, 7, 9, 11, 13, 16, 19]);
    const tree = heroTree("rifleman");
    for (const u of tree) {
      const tier = u.line ? (tree.find((x) => x.id === u.line?.to)?.tier ?? 0) : u.tier;
      expect(u.hq, u.id).toBe(tierHq(tier));
    }
    const path = withPath("rifleman", "Last Stand");
    const last = tree.find((u) => u.id === path.at(-1));
    if (!last) throw new Error("missing");
    const before = path.slice(0, -1);
    expect(canBuy("rifleman", last, before, 99_999, rich, 18)).toBe(false);
    expect(canBuy("rifleman", last, before, 99_999, rich, 19)).toBe(true);
  });

  it("makes each line's checkpoints come in order, and an upgrade need its line", () => {
    const tree = heroTree("rifleman");
    const path = withPath("rifleman", "Deadeye");
    // First, then tiers 2 to 6 on the fire branch, with two checkpoints before each.
    expect(path).toHaveLength(1 + 5 * 3);
    for (let have = 0; have < path.length; have++) {
      const next = tree.find((u) => u.id === path[have]);
      if (!next) throw new Error("missing upgrade");
      expect(canBuy("rifleman", next, path.slice(0, have), 99_999, rich, TOP_HQ)).toBe(true);
      const after = tree.find((u) => u.id === path[have + 1]);
      if (after) {
        expect(canBuy("rifleman", after, path.slice(0, have), 99_999, rich, TOP_HQ)).toBe(false);
      }
    }
    const deadeye = tree.find((u) => u.name === "Deadeye");
    if (!deadeye) throw new Error("missing");
    expect(lockedBy("rifleman", deadeye, [])).not.toBeNull();
    expect(lockedBy("rifleman", deadeye, path.slice(0, -1))).toBeNull();
  });

  it("won't sell what's locked, owned, too dear, or beyond the headquarters", () => {
    const [first, second] = heroTree("medic");
    if (!first || !second) throw new Error("missing upgrades");
    expect(canBuy("medic", first, [], 150, rich, 1)).toBe(true);
    expect(canBuy("medic", first, [], 149, rich, 1)).toBe(false);
    expect(canBuy("medic", first, [], 150, noCrystals(), 1)).toBe(false);
    expect(canBuy("medic", first, [first.id], 150, rich, 1)).toBe(false);
    expect(canBuy("medic", second, [], 9999, rich, TOP_HQ)).toBe(false);
    // The first checkpoint on a branch leads to tier 2, which opens at headquarters 2.
    expect(canBuy("medic", second, [first.id], 9999, rich, 1)).toBe(false);
    expect(canBuy("medic", second, [first.id], 9999, rich, 2)).toBe(true);
  });

  it("puts the specials at tier 6 and the end of each branch, the end the strongest", () => {
    for (const kind of HERO_KINDS) {
      const tops = capstones(kind);
      expect(tops).toHaveLength(4);
      for (const u of tops) expect(u.tier).toBe(TIERS);
      const all = heroTree(kind).map((u) => u.id);
      const mods = heroMods(kind, all);
      expect(mods.signature, kind).toBeGreaterThan(0);
    }
  });

  it("adds up to a strong hero, but not an unbeatable one", () => {
    expect(heroMods("rifleman", [])).toEqual(NO_MODS);
    for (const kind of HERO_KINDS) {
      const mods = heroMods(
        kind,
        heroTree(kind).map((u) => u.id),
      );
      expect(mods.hp, kind).toBeGreaterThan(1.8);
      expect(mods.hp, kind).toBeLessThan(3);
      expect(mods.damage, kind).toBeGreaterThan(1.4);
      expect(mods.damage, kind).toBeLessThan(2.6);
      expect(mods.reload, kind).toBeGreaterThan(0.25);
      expect(mods.reload, kind).toBeLessThan(0.8);
      expect(mods.speed, kind).toBeLessThan(1.7);
    }
    const rifle = heroMods(
      "rifleman",
      heroTree("rifleman").map((u) => u.id),
    );
    expect(rifle.shots).toBe(1);
    expect(rifle.fireSpeed).toBe(0.4);
    expect(rifle.lastStand).toBe(true);
    expect(rifle.unload).toBeLessThan(1);
    // The Heavy's gun gets 15% less from what makes guns stronger.
    const heavy = heroTree("heavy").find((u) => u.name === "Sharp");
    expect(heavy?.mods.damage).toBeCloseTo(1.043);
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
      const spots = heroTree(kind).map((u) => `${u.column.toFixed(2)},${u.row.toFixed(2)}`);
      expect(new Set(spots).size).toBe(UPGRADES_PER_HERO);
      const tree = heroTree(kind);
      for (const a of tree) {
        for (const b of tree) {
          if (a === b) continue;
          // In pixels on a 2,000-wide board on the phone: far enough apart to tap either one.
          const gap = Math.hypot((a.column - b.column) * 208, (a.row - b.row) * 75);
          expect(gap, `${a.id} ${b.id}`).toBeGreaterThan(36);
        }
      }
    }
  });

  it("drops unknown upgrades, anything cut off from the tree, and anything past the cap", () => {
    expect(readOwned("rifleman", "nonsense")).toEqual([]);
    expect(readOwned("rifleman", ["rifleman:basic-training", "made-up"])).toEqual([
      "rifleman:basic-training",
    ]);
    expect(readOwned("rifleman", ["rifleman:deadeye"])).toEqual([]);
    const path = withPath("rifleman", "Deadeye");
    expect(readOwned("rifleman", [...path].reverse())).toEqual(path);
    // Deadeye is tier 6, which opens at headquarters 9.
    expect(readOwned("rifleman", path, 8)).not.toContain("rifleman:deadeye");
  });

  it("gives back what's dropped: old trees at their old prices, the rest at today's", () => {
    const old = trimUpgrades("rifleman", ["rifleman-basic-training", "rifleman-step-0-0"]);
    expect(old.owned).toEqual([]);
    expect(old.refund).toEqual({ gold: 650, crystals: { nature: 1 } });
    // Each crystal comes back as the kind it was: Deadeye took five fire.
    expect(trimUpgrades("rifleman", ["rifleman-deadeye"]).refund.crystals).toEqual({ fire: 5 });
    const path = withPath("rifleman", "Deadeye");
    const capped = trimUpgrades("rifleman", path, 8);
    const dropped = heroTree("rifleman").filter(
      (u) => path.includes(u.id) && !capped.owned.includes(u.id),
    );
    expect(dropped.map((u) => u.name)).toContain("Deadeye");
    expect(capped.refund.gold).toBe(dropped.reduce((sum, u) => sum + u.gold, 0));
    expect(capped.refund.crystals).toEqual({ fire: 2 });
    expect(trimUpgrades("rifleman", path, TOP_HQ).refund).toEqual({ gold: 0, crystals: {} });
  });
});
