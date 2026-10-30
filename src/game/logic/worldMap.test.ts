import { describe, expect, it } from "vitest";
import { worldIslands } from "./worldMap";

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

  it("pays more for harder bases", () => {
    const islands = worldIslands(8, 1).sort((a, b) => a.hq - b.hq);
    const easy = islands[0];
    const hard = islands[islands.length - 1];
    expect(hard?.reward.gold).toBeGreaterThan(easy?.reward.gold ?? 0);
  });
});
