import { describe, expect, it } from "vitest";
import { islandRadius, worldIslands } from "./worldMap";

describe("world map", () => {
  it("offers the same islands all day and new ones the next", () => {
    expect(worldIslands(3, 100)).toEqual(worldIslands(3, 100));
    expect(worldIslands(3, 101).map((i) => i.seed)).not.toEqual(
      worldIslands(3, 100).map((i) => i.seed),
    );
  });

  it("gives nearby islands distinct names and a spread of difficulty round your own HQ", () => {
    const islands = worldIslands(5, 100);
    expect(new Set(islands.map((i) => i.name)).size).toBe(islands.length);
    expect(new Set(islands.map((i) => i.difficulty))).toEqual(
      new Set(["Easy", "Fair", "Hard", "Deadly"]),
    );
    expect(Math.min(...islands.map((i) => i.hq))).toBe(4);
    expect(Math.max(...islands.map((i) => i.hq))).toBe(10);
  });

  it("scatters islands differently each day, never touching each other or home", () => {
    for (let day = 0; day < 200; day++) {
      const islands = worldIslands(3, day);
      expect(islands).toHaveLength(10);
      for (const a of islands) {
        expect(Math.hypot(a.x, a.y)).toBeGreaterThan(14);
        for (const b of islands) {
          if (a.id >= b.id) continue;
          const gap = Math.hypot(a.x - b.x, a.y - b.y);
          expect(gap).toBeGreaterThan(islandRadius(a.size) + islandRadius(b.size));
        }
      }
    }
    expect(worldIslands(3, 1)[0]?.x).not.toBe(worldIslands(3, 2)[0]?.x);
  });

  it("keeps every island out of the clouds and the Return to island button's corner", () => {
    for (let day = 0; day < 200; day++) {
      for (const { x, y } of worldIslands(3, day)) {
        expect(Math.abs(x)).toBeLessThanOrEqual(49);
        expect(x < -24 && y > 13).toBe(false);
      }
    }
  });

  it("doesn't lay islands out as a ring round home", () => {
    const spread = (day: number) => {
      const distances = worldIslands(3, day).map((i) => Math.hypot(i.x, i.y));
      return Math.max(...distances) - Math.min(...distances);
    };
    for (let day = 0; day < 50; day++) expect(spread(day)).toBeGreaterThan(14);
  });

  it("pays more for harder bases", () => {
    const islands = worldIslands(8, 1).sort((a, b) => a.hq - b.hq);
    const easy = islands[0];
    const hard = islands[islands.length - 1];
    expect(hard?.reward.gold).toBeGreaterThan(easy?.reward.gold ?? 0);
  });
});
