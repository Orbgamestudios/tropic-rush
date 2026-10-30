import { describe, expect, it } from "vitest";
import { HERO_KINDS } from "./heroes";
import {
  HERO_NAMES,
  heroPower,
  heroStats,
  isStarter,
  levelUpCost,
  MAX_HERO_LEVEL,
  raidReward,
  statBars,
  UNLOCK_MEDALS,
} from "./heroProgress";

describe("hero progress", () => {
  it("names every hero and makes the starters free", () => {
    for (const kind of HERO_KINDS) {
      expect(HERO_NAMES[kind].length).toBeGreaterThan(0);
      expect(UNLOCK_MEDALS[kind] === 0).toBe(isStarter(kind));
    }
  });

  it("grows stronger and costlier each level", () => {
    expect(heroPower(1)).toBe(1);
    expect(heroPower(MAX_HERO_LEVEL)).toBeGreaterThan(1.5);
    expect(heroPower(99)).toBe(heroPower(MAX_HERO_LEVEL));
    for (let level = 1; level < MAX_HERO_LEVEL; level++) {
      expect(levelUpCost(level + 1)).toBeGreaterThan(levelUpCost(level));
      expect(heroStats("rifleman", level + 1).hp).toBeGreaterThan(heroStats("rifleman", level).hp);
    }
  });

  it("scales stat bars between 0 and 1", () => {
    for (const kind of HERO_KINDS) {
      for (const value of Object.values(statBars(kind, 1))) {
        expect(value).toBeGreaterThan(0);
        expect(value).toBeLessThanOrEqual(1);
      }
    }
    expect(statBars("tank", MAX_HERO_LEVEL).hp).toBe(1);
  });

  it("pays more for more destruction and a win", () => {
    const lost = raidReward(false, 40, 1);
    const won = raidReward(true, 100, 1);
    expect(lost).toEqual({ gold: 80, medals: 0, stars: 0 });
    expect(won.stars).toBe(3);
    expect(won.medals).toBe(1);
    expect(won.gold).toBeGreaterThan(lost.gold);
    expect(raidReward(true, 100, 3).gold).toBeGreaterThan(won.gold);
  });
});
