import { describe, expect, it } from "vitest";
import { BLUEPRINT_TYPES, needsBlueprint, rollSpoils, type SpoilsRoll } from "./spoils";

const roll = (changes: Partial<SpoilsRoll> = {}): SpoilsRoll => ({
  seed: 1,
  difficulty: "Fair",
  crystal: "fire",
  defenses: ["gunTurret", "mortar", "harpoon"],
  known: [],
  drought: 0,
  firstWin: false,
  luck: 1,
  tier: 1,
  ...changes,
});

const crystalsOver = (changes: Partial<SpoilsRoll>, seeds = 2000) => {
  let total = 0;
  for (let seed = 1; seed <= seeds; seed++) {
    total += rollSpoils(roll({ ...changes, seed })).crystals.fire ?? 0;
  }
  return total / seeds;
};

describe("spoils", () => {
  it("leaves the gun turret free of blueprints, and locks the rest", () => {
    expect(needsBlueprint("gunTurret")).toBe(false);
    expect(needsBlueprint("mortar")).toBe(true);
    expect(needsBlueprint("flamethrower")).toBe(true);
    expect(needsBlueprint("goldMine")).toBe(false);
  });

  it("gives the island's own crystal, in the amounts the plan sets", () => {
    expect(rollSpoils(roll({ crystal: "ice" })).crystals).toEqual({ ice: 1 });
    expect(crystalsOver({ difficulty: "Easy" })).toBeCloseTo(0.5, 0);
    expect(crystalsOver({ difficulty: "Fair" })).toBe(1);
    expect(crystalsOver({ difficulty: "Hard" })).toBeCloseTo(1.5, 0);
    expect(crystalsOver({ difficulty: "Deadly" })).toBeCloseTo(1.95, 0);
  });

  it("always gives something on a first win", () => {
    for (let seed = 1; seed < 200; seed++) {
      const first = rollSpoils(roll({ seed, firstWin: true, difficulty: "Easy" }));
      expect(first.crystals.fire).toBeGreaterThanOrEqual(1);
      expect(first.blueprint).not.toBeNull();
    }
  });

  it("only finds blueprints for defenses on that base, that the crew doesn't know", () => {
    for (let seed = 1; seed < 300; seed++) {
      const { blueprint } = rollSpoils(roll({ seed, known: ["mortar"], drought: 3 }));
      expect(blueprint).toBe("harpoon");
    }
    const none = rollSpoils(roll({ known: ["mortar", "harpoon"], drought: 3 }));
    expect(none.blueprint).toBeNull();
    // A rival crew's base has no plans to find.
    expect(rollSpoils(roll({ defenses: [], drought: 3 })).blueprint).toBeNull();
  });

  it("can't run dry for long", () => {
    for (let seed = 1; seed < 300; seed++) {
      expect(rollSpoils(roll({ seed, drought: 3 })).blueprint).not.toBeNull();
    }
    let dry = 0;
    let found = 0;
    for (let seed = 1; seed < 2000; seed++) {
      if (rollSpoils(roll({ seed })).blueprint) dry++;
      if (rollSpoils(roll({ seed, drought: 2 })).blueprint) found++;
    }
    expect(found).toBeGreaterThan(dry);
  });

  it("makes everything likelier with the Statue of the Deep", () => {
    const chests = (luck: number) => {
      let n = 0;
      for (let seed = 1; seed < 8000; seed++) if (rollSpoils(roll({ seed, luck })).chest > 0) n++;
      return n;
    };
    expect(chests(1.4)).toBeGreaterThan(chests(1));
    expect(crystalsOver({ difficulty: "Deadly", luck: 1.4 })).toBeGreaterThan(
      crystalsOver({ difficulty: "Deadly", luck: 1 }),
    );
  });

  it("covers every locked defense with a base that has it", () => {
    expect(BLUEPRINT_TYPES).toContain("landmine");
    expect(BLUEPRINT_TYPES).toContain("watchtower");
  });
});
