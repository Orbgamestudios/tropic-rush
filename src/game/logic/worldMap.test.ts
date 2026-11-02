import { describe, expect, it } from "vitest";
import {
  chartedRegions,
  islandRadius,
  islandsLeftFor,
  islandsToOpen,
  NEW_WORLD,
  regionAt,
  retakeIslands,
  sanitizeWorld,
  takeIsland,
  type WorldProgress,
  worldIslands,
} from "./worldMap";

/** Takes islands of a region until the cloud next door lifts. */
function clearRegion(world: WorldProgress, region: string): WorldProgress {
  let next = world;
  for (const island of worldIslands(next, 1)) {
    if (island.region !== region) continue;
    if (next.opened.length > world.opened.length) break;
    next = takeIsland(next, island.id);
  }
  return next;
}

describe("the world", () => {
  it("lays the same islands out every time", () => {
    expect(worldIslands(NEW_WORLD, 3)).toEqual(worldIslands(NEW_WORLD, 3));
  });

  it("keeps islands apart, and clear of home", () => {
    const islands = worldIslands(NEW_WORLD, 1);
    expect(islands.length).toBeGreaterThanOrEqual(6);
    for (const a of islands) {
      expect(Math.hypot(a.x, a.y)).toBeGreaterThan(14);
      for (const b of islands) {
        if (a.id >= b.id) continue;
        const gap = Math.hypot(a.x - b.x, a.y - b.y);
        expect(gap).toBeGreaterThan(islandRadius(a.size) + islandRadius(b.size));
      }
    }
  });

  it("puts every island in the region it says it's in", () => {
    let world = NEW_WORLD;
    world = clearRegion(world, "0,0");
    for (const island of worldIslands(world, 1)) {
      const { column, row } = regionAt(island.x, island.y);
      expect(island.region).toBe(`${column},${row}`);
    }
  });

  it("starts with only home's waters open and clouds on every side", () => {
    const { open, cloud } = chartedRegions(NEW_WORLD);
    expect(open).toEqual(["0,0"]);
    expect(cloud.sort()).toEqual(["-1,0", "0,-1", "0,1", "1,0"]);
    expect(islandsLeftFor(NEW_WORLD, "1,0")).toBe(islandsToOpen("0,0"));
  });

  it("gets harder and harder the further out it goes, with no end", () => {
    let world = NEW_WORLD;
    let region = "0,0";
    for (let step = 0; step < 12; step++) {
      world = clearRegion(world, region);
      region = `${step + 1},0`;
    }
    const near = worldIslands(world, 1).filter((i) => i.region === "0,0");
    const far = worldIslands(world, 1).filter((i) => i.region === "12,0");
    expect(far.length).toBeGreaterThan(0);
    expect(Math.min(...far.map((i) => i.hq))).toBeGreaterThan(20);
    expect(Math.max(...near.map((i) => i.hq))).toBeLessThanOrEqual(4);
  });

  it("keeps a region open after the islands that opened it are lost", () => {
    const world = clearRegion(NEW_WORLD, "0,0");
    expect(world.opened.length).toBe(4);
    const empty = { ...world, taken: [] };
    expect(chartedRegions(empty).open).toContain("1,0");
  });

  it("names and rates islands, and pays more for harder ones", () => {
    const world = clearRegion(NEW_WORLD, "0,0");
    const islands = worldIslands(world, 1).sort((a, b) => a.hq - b.hq);
    expect(islands.every((i) => i.name.length > 3)).toBe(true);
    const easy = islands[0];
    const hard = islands[islands.length - 1];
    expect(hard?.hq).toBeGreaterThan(easy?.hq ?? 0);
    expect(hard?.reward.gold).toBeGreaterThan(easy?.reward.gold ?? 0);
    expect(easy?.difficulty).toBe("Easy");
    expect(worldIslands(NEW_WORLD, 20).every((i) => i.difficulty === "Easy")).toBe(true);
  });
});

describe("raiders retaking islands", () => {
  const held = () => {
    let world = NEW_WORLD;
    for (const island of worldIslands(NEW_WORLD, 1)) world = takeIsland(world, island.id);
    return world;
  };

  it("takes back between none and two islands a night, and some nights each", () => {
    const counts = new Set<number>();
    for (let night = 100; night < 160; night++) {
      const { lost } = retakeIslands(held(), night, 3);
      expect(lost.length).toBeLessThanOrEqual(2);
      counts.add(lost.length);
    }
    expect(counts).toEqual(new Set([0, 1, 2]));
  });

  it("gives nothing back on a night it has nothing to take", () => {
    expect(retakeIslands(NEW_WORLD, 101, 3).lost).toEqual([]);
  });

  it("brings an island back higher than it was, and at least as high as the crew", () => {
    const world = held();
    for (let night = 100; night < 130; night++) {
      const result = retakeIslands(world, night, 6);
      for (const [id, hq] of Object.entries(result.world.retaken)) {
        const before = worldIslands(world, 6).find((i) => i.id === id);
        expect(hq).toBeGreaterThan(before?.hq ?? 0);
        expect(hq).toBeGreaterThanOrEqual(6);
        expect(result.world.taken).not.toContain(id);
        const after = worldIslands(result.world, 6).find((i) => i.id === id);
        expect(after?.retaken).toBe(true);
        expect(after?.taken).toBe(false);
        expect(after?.hq).toBe(hq);
        expect(after?.seed).not.toBe(before?.seed);
      }
    }
  });

  it("clears the mark when the crew takes it back", () => {
    const night = 104;
    const result = retakeIslands(held(), night, 3);
    for (const id of Object.keys(result.world.retaken)) {
      const back = takeIsland(result.world, id);
      expect(back.retaken[id]).toBeUndefined();
      expect(back.taken).toContain(id);
    }
  });
});

describe("saved progress", () => {
  it("survives a round trip and drops rubbish", () => {
    const world: WorldProgress = { taken: ["0,0:1"], retaken: { "0,0:2": 7 }, opened: ["1,0"] };
    expect(sanitizeWorld(JSON.parse(JSON.stringify(world)))).toEqual(world);
    expect(sanitizeWorld(null)).toEqual(NEW_WORLD);
    expect(sanitizeWorld({ taken: [1, "a"], retaken: { x: "y" }, opened: "no" })).toEqual({
      taken: ["a"],
      retaken: {},
      opened: [],
    });
  });
});
