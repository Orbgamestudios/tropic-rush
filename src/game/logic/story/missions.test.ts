import { describe, expect, it } from "vitest";
import { hqLevel, sanitizeLayout, starterLayout, tryOp } from "../crewIsland";
import { levelCap, PROGRESSION } from "../economy";
import { enemyBase } from "../enemyBase";
import { isBossIsland, rescueMission, storyMission } from "../worldMap";
import { rescues } from "./progress";
import { STORY_ISLANDS } from "./script";

const NOW = 1_000_000_000;

describe("the story on a crew's island", () => {
  it("moves on for the whole crew, and never back", () => {
    const start = starterLayout(NOW);
    expect(start.story.played).toEqual([]);
    const told = tryOp(start, { kind: "story", change: { scenes: ["prologue", "nope"] } }, NOW);
    if ("error" in told) throw new Error(told.error);
    expect(told.layout.story.played).toEqual(["prologue"]);
    const again = tryOp(
      told.layout,
      { kind: "story", change: { scenes: ["prologue"], rescued: "medic", won: "terror1" } },
      NOW,
    );
    if ("error" in again) throw new Error(again.error);
    expect(again.layout.story).toEqual({
      played: ["prologue"],
      ending: null,
      won: ["terror1"],
      rescued: ["medic"],
    });
    expect(sanitizeLayout(again.layout, NOW).story).toEqual(again.layout.story);
  });

  it("leaves an island from before the story the heroes its headquarters had brought", () => {
    const old = starterLayout(NOW) as unknown as Record<string, unknown>;
    delete old.story;
    expect(sanitizeLayout(old, NOW).story.rescued).toEqual([]);
    const grown = starterLayout(NOW);
    const hq = grown.buildings.find((b) => b.type === "headquarters");
    if (hq) hq.level = 7;
    const before = { ...grown } as unknown as Record<string, unknown>;
    delete before.story;
    const read = sanitizeLayout(before, NOW);
    expect(hqLevel(read)).toBe(7);
    expect(read.story.rescued).toEqual(["medic", "heavy"]);
    expect(read.story.played).toEqual([]);
  });

  it("lets the radar reach the level each signal needs by the time it comes", () => {
    expect(PROGRESSION.radar.unlockHq).toBe(3);
    for (const { hq, radar } of rescues(5)) {
      expect(levelCap("radar", hq), `headquarters ${hq}`).toBeGreaterThanOrEqual(radar);
    }
  });
});

describe("the story's raids", () => {
  it("makes each of the Professor's islands a base well above the level it turns up at", () => {
    const ids = new Set<string>();
    for (const { id, hq } of STORY_ISLANDS) {
      const island = storyMission(id, 4242);
      ids.add(island.id);
      expect(island.story).toBe(id);
      expect(island.hq).toBe(Math.min(50, hq + (isBossIsland(id) ? 4 : 2)));
      expect(island.difficulty).toBe(isBossIsland(id) ? "Extreme" : "Hard");
      expect(island.rival).toBeNull();
      expect(storyMission(id, 4242)).toEqual(island);
      // It has to be a base the raid can be fought on.
      expect(enemyBase(island.seed, island.hq).length).toBeGreaterThan(3);
    }
    expect(ids.size).toBe(STORY_ISLANDS.length);
    expect(storyMission("terror1", 1).seed).not.toBe(storyMission("terror1", 2).seed);
  });

  it("puts each signal on an island of its own, at the level it's heard at", () => {
    const seeds = new Set<number>();
    for (const { hero, hq } of rescues(77)) {
      const island = rescueMission(hero, hq, 77);
      seeds.add(island.seed);
      expect(island.rescue).toBe(hero);
      expect(island.hq).toBe(hq);
      expect(island.name).toBe("Unknown signal");
    }
    expect(seeds.size).toBe(6);
  });
});
