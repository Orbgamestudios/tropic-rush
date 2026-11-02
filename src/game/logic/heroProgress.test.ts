import { describe, expect, it } from "vitest";
import { MAX_HQ_LEVEL } from "./economy";
import { HERO_KINDS } from "./heroes";
import {
  HERO_NAMES,
  HERO_UNLOCK_HQ,
  heroesAt,
  heroesJoining,
  heroStats,
  isStarter,
  oldLevelRefund,
  raidReward,
  statBars,
} from "./heroProgress";
import { heroTree } from "./heroTrees";

const everything = (kind: (typeof HERO_KINDS)[number]) => heroTree(kind).map((u) => u.id);

describe("hero progress", () => {
  it("names every hero and starts with the Rifleman alone", () => {
    for (const kind of HERO_KINDS) {
      expect(HERO_NAMES[kind].length).toBeGreaterThan(0);
      expect(HERO_UNLOCK_HQ[kind] === 1).toBe(isStarter(kind));
    }
    expect(HERO_KINDS.filter(isStarter)).toEqual(["rifleman"]);
  });

  it("has only the heroes the headquarters has reached", () => {
    expect(heroesAt(1)).toEqual(["rifleman"]);
    expect(heroesAt(3)).toEqual(expect.arrayContaining(["rifleman", "heavy"]));
    expect(heroesAt(3)).toHaveLength(2);
    expect(heroesAt(MAX_HQ_LEVEL)).toHaveLength(HERO_KINDS.length);
  });

  it("brings in a hero every few headquarters levels", () => {
    expect(heroesJoining(["rifleman"], 2)).toEqual([]);
    expect(heroesJoining(["rifleman"], 3)).toEqual(["heavy"]);
    expect(heroesJoining(["rifleman", "heavy"], 3)).toEqual([]);
    expect(heroesJoining(["rifleman", "heavy"], 6)).toEqual(["medic"]);
    expect(heroesJoining(["rifleman"], 20)).toHaveLength(HERO_KINDS.length - 1);
    const levels = Object.values(HERO_UNLOCK_HQ).sort((a, b) => a - b);
    expect(new Set(levels).size).toBe(HERO_KINDS.length);
    expect(Math.max(...levels)).toBeLessThanOrEqual(MAX_HQ_LEVEL);
  });

  it("shows upgrades in a hero's stats", () => {
    const start = heroStats("rifleman", []);
    const trained = heroStats("rifleman", ["rifleman-basic-training"]);
    expect(trained.hp).toBeGreaterThan(start.hp);
    const full = heroStats("rifleman", everything("rifleman"));
    expect(full.hp).toBeGreaterThan(trained.hp);
    expect(full.dps).toBeGreaterThan(start.dps);
    expect(full.speed).toBeGreaterThan(start.speed);
    expect(full.range).toBeGreaterThan(start.range);
  });

  it("counts healing as a medic's attack", () => {
    const owned = ["medic-steady-hand"];
    expect(heroStats("medic", owned).dps).toBeGreaterThan(heroStats("medic", []).dps);
  });

  it("scales stat bars between 0 and 1", () => {
    for (const kind of HERO_KINDS) {
      for (const value of Object.values(statBars(kind, []))) {
        expect(value).toBeGreaterThan(0);
        expect(value).toBeLessThanOrEqual(1);
      }
    }
    expect(statBars("tank", everything("tank")).hp).toBe(1);
  });

  it("hands back what hero levels cost", () => {
    expect(oldLevelRefund({})).toBe(0);
    expect(oldLevelRefund({ rifleman: 1 })).toBe(0);
    expect(oldLevelRefund({ rifleman: 2 })).toBe(120);
    expect(oldLevelRefund({ rifleman: 3, heavy: 2 })).toBe(120 + 190 + 120);
    expect(oldLevelRefund({ rifleman: "x" })).toBe(0);
  });

  it("pays more for more destruction and a win", () => {
    const lost = raidReward(false, 40, 1);
    const won = raidReward(true, 100, 1);
    expect(lost).toEqual({ gold: 80, stars: 0 });
    expect(won.stars).toBe(3);
    expect(won.gold).toBeGreaterThan(lost.gold);
    expect(raidReward(true, 100, 3).gold).toBeGreaterThan(won.gold);
  });
});
