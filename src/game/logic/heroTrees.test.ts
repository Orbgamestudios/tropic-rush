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
  it("grows a trunk to headquarters 5, splits in two, then each in two again", () => {
    for (const kind of HERO_KINDS) {
      const tree = heroTree(kind);
      expect(tree).toHaveLength(UPGRADES_PER_HERO);
      expect(UPGRADES_PER_HERO).toBe(93);
      const last = [8, 9, 10];
      const split = [5, 6, 7, ...last, ...last];
      // The trunk's second upgrade has two side paths, each ending at an upgrade of its own.
      expect(majorUpgrades(kind).map((u) => u.tier)).toEqual([
        1,
        2,
        3,
        3,
        3,
        4,
        ...split,
        ...split,
      ]);
      // Three minis on each of the 23 lines.
      expect(tree.filter((u) => u.line)).toHaveLength(69);
      expect(new Set(tree.map((u) => u.id)).size).toBe(UPGRADES_PER_HERO);
      // Up to headquarters 5 there's the trunk and its side paths, which lead nowhere else.
      const early = tree.filter((u) => u.hq <= 5);
      const sides = ["Sapper", "Scrapper"];
      for (const u of early) expect(["Basics", ...sides]).toContain(u.path ?? "Basics");
      const second = majorUpgrades(kind)[1];
      for (const side of sides) {
        const on = tree.filter((u) => u.path === side);
        expect(
          on.map((u) => u.tier),
          side,
        ).toEqual([0, 0, 0, 3]);
        expect(on[0]?.needs).toEqual([second?.id]);
        const end = on.at(-1)?.id ?? "";
        expect(tree.filter((u) => u.needs.includes(end))).toEqual([]);
      }
      expect(tree.filter((u) => u.tier > 0 && u.tier <= 7 && u.hq > 5).map((u) => u.path)).toEqual([
        "Assault",
        "Assault",
        "Assault",
        "Survival",
        "Survival",
        "Survival",
      ]);
      const paths = treePaths(kind);
      expect(paths.map((p) => p.crystal)).toEqual([
        null,
        null,
        null,
        null,
        "fire",
        "ice",
        null,
        "nature",
        "dark",
      ]);
      for (const p of paths.filter((p) => p.crystal)) {
        const on = majorUpgrades(kind).filter((u) => u.path === p.name);
        expect(
          on.map((u) => u.tier),
          p.name,
        ).toEqual(last);
        // The last branches are paid for in their own crystal; the rest in whatever fits.
        const paid = crystalsIn(on);
        for (const k of CRYSTAL_KINDS) expect(paid[k]).toBe(k === p.crystal ? 15 : 0);
      }
      const used = crystalsIn(majorUpgrades(kind).filter((u) => u.tier > 1 && u.tier <= 7));
      expect(used.nature, kind).toBeGreaterThan(0);
      expect(used.fire, kind).toBeGreaterThan(0);
      expect(used.ice, kind).toBeGreaterThan(0);
    }
  });

  it("costs 124,350 gold a tree, and 80,100 more for the minis", () => {
    for (const kind of HERO_KINDS) {
      const gold = majorUpgrades(kind).reduce((sum, u) => sum + u.gold, 0);
      expect(gold).toBe(124_350);
      const steps = heroTree(kind).filter((u) => u.line);
      expect(steps.reduce((sum, u) => sum + u.gold, 0)).toBe(80_100);
      for (const u of steps) expect(u.crystals).toEqual({});
    }
  });

  it("makes no hero faster on their feet: moving fast made dodging too easy", () => {
    for (const kind of HERO_KINDS) {
      for (const u of heroTree(kind)) {
        expect(u.text, u.name).not.toMatch(/move|speed while/i);
      }
    }
    // What was bought before is given back, at what it cost.
    const retired = trimUpgrades("rifleman", ["rifleman/swift", "rifleman/run-and-gun"]);
    expect(retired.refund).toEqual({ gold: 4400 + 6000, crystals: { ice: 8 } });
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
    // First, then tiers 2 to 8 up the trunk, Assault and Marksman, three minis before each.
    expect(path).toHaveLength(1 + 7 * 4);
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
    // The first checkpoint leads to tier 2, which opens at headquarters 2.
    expect(canBuy("medic", second, [first.id], 9999, rich, 1)).toBe(false);
    expect(canBuy("medic", second, [first.id], 9999, rich, 2)).toBe(true);
  });

  it("opens each last branch with a special and ends it with a capstone", () => {
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
    }
    const rifle = heroMods(
      "rifleman",
      heroTree("rifleman").map((u) => u.id),
    );
    expect(rifle.shots).toBe(1);
    expect(rifle.lastStand).toBe(true);
    expect(rifle.unload).toBeLessThan(1);
    // The Heavy's gun gets 15% less from what makes guns stronger.
    const heavy = heroTree("heavy").find((u) => u.name === "Sharp");
    expect(heavy?.mods.damage).toBeCloseTo(1.128);
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
          // In pixels on a 2,200-wide board on the phone: far enough apart to tap either one.
          const gap = Math.hypot((a.column - b.column) * 229, (a.row - b.row) * 75);
          expect(gap, `${a.id} ${b.id}`).toBeGreaterThan(36);
        }
      }
    }
  });

  it("drops unknown upgrades, anything cut off from the tree, and anything past the cap", () => {
    expect(readOwned("rifleman", "nonsense")).toEqual([]);
    expect(readOwned("rifleman", ["rifleman/basic-training", "made-up"])).toEqual([
      "rifleman/basic-training",
    ]);
    expect(readOwned("rifleman", ["rifleman/deadeye"])).toEqual([]);
    const path = withPath("rifleman", "Deadeye");
    expect(readOwned("rifleman", [...path].reverse())).toEqual(path);
    // Deadeye is tier 8, which opens at headquarters 13.
    expect(readOwned("rifleman", path, 12)).not.toContain("rifleman/deadeye");
  });

  it("gives back what's dropped: older trees at their old prices, the rest at today's", () => {
    const old = trimUpgrades("rifleman", ["rifleman-basic-training", "rifleman-step-0-0"]);
    expect(old.owned).toEqual([]);
    expect(old.refund).toEqual({ gold: 650, crystals: { nature: 1 } });
    // Each crystal comes back as the kind it was: Deadeye took five fire.
    expect(trimUpgrades("rifleman", ["rifleman-deadeye"]).refund.crystals).toEqual({ fire: 5 });
    // And from the four-branch trees, as they were then.
    const branched = trimUpgrades("rifleman", [
      "rifleman:basic-training",
      "rifleman:nature-0",
      "rifleman:nature-1",
      "rifleman:hardy",
      "rifleman:fire-17",
      "rifleman:deadeye",
      "rifleman:fast-unload",
    ]);
    expect(branched.owned).toEqual([]);
    expect(branched.refund).toEqual({
      gold: 150 + 300 + 300 + 400 + 3400 + 2300 + 8000,
      crystals: { nature: 2, fire: 2, ice: 5 },
    });
    // And the first trunk trees' checkpoints, one on each line, as they were then.
    const trunk = trimUpgrades("rifleman", [
      "rifleman/basic-training",
      "rifleman/basics-0",
      "rifleman/hardy",
      "rifleman/assault-2",
      "rifleman/marksman-1",
      "rifleman/made-up-1",
    ]);
    expect(trunk.owned).toEqual(["rifleman/basic-training"]);
    expect(trunk.refund).toEqual({ gold: 300 + 500 + 2000 + 3400, crystals: { nature: 1 } });
    const path = withPath("rifleman", "Deadeye");
    const capped = trimUpgrades("rifleman", path, 12);
    const dropped = heroTree("rifleman").filter(
      (u) => path.includes(u.id) && !capped.owned.includes(u.id),
    );
    expect(dropped.map((u) => u.name)).toContain("Deadeye");
    expect(capped.refund.gold).toBe(dropped.reduce((sum, u) => sum + u.gold, 0));
    expect(capped.refund.crystals).toEqual({ fire: 4 });
    expect(trimUpgrades("rifleman", path, TOP_HQ).refund).toEqual({ gold: 0, crystals: {} });
  });
});
