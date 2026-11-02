import { describe, expect, it } from "vitest";
import { CRYSTAL_KINDS } from "./crystals";
import { ARCHETYPES, type Archetype } from "./islandShapes";
import {
  beatRival,
  chartedRegions,
  dailyTribute,
  islandRadius,
  islandsToNextCloud,
  NEW_WORLD,
  openSpots,
  type Rival,
  regionAt,
  retakeIslands,
  sanitizeWorld,
  settleRivals,
  takeIsland,
  tributeFor,
  type WorldProgress,
  worldIslands,
} from "./worldMap";

/** Takes the home waters' islands until `clouds` banks of cloud have lifted. */
function liftClouds(clouds: number): WorldProgress {
  let world = NEW_WORLD;
  for (const island of worldIslands(NEW_WORLD, 1)) {
    if (world.opened.length >= clouds) break;
    world = takeIsland(world, island.id);
  }
  return world;
}

/** Pushes outward, always taking the furthest island in reach, for `wins` wins. */
function pushOut(wins: number): WorldProgress {
  let world = NEW_WORLD;
  for (let i = 0; i < wins; i++) {
    const [next] = worldIslands(world, 1)
      .filter((island) => !island.taken)
      .sort((a, b) => Math.hypot(b.x, b.y) - Math.hypot(a.x, a.y));
    if (next) world = takeIsland(world, next.id);
  }
  return world;
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
    for (const island of worldIslands(pushOut(12), 1)) {
      const { column, row } = regionAt(island.x, island.y);
      expect(island.region).toBe(`${column},${row}`);
    }
  });

  it("starts with only home's waters open and clouds on every side", () => {
    const { open, cloud } = chartedRegions(NEW_WORLD);
    expect(open).toEqual(["0,0"]);
    expect(cloud.sort()).toEqual(["-1,0", "0,-1", "0,1", "1,0"]);
    expect(islandsToNextCloud(NEW_WORLD)).toBe(3);
  });

  it("lifts one bank of cloud at a time, every third island, next to the fighting", () => {
    const [first, second, third, fourth] = worldIslands(NEW_WORLD, 1)
      .sort((a, b) => b.x - a.x)
      .map((island) => island.id);
    if (!first || !second || !third || !fourth) throw new Error("too few islands");
    let world = takeIsland(NEW_WORLD, first);
    expect(world.opened).toEqual([]);
    expect(islandsToNextCloud(world)).toBe(2);
    world = takeIsland(world, second);
    expect(world.opened).toEqual([]);
    world = takeIsland(world, third);
    // The islands furthest east were last taken, so the cloud lifts on that side.
    expect(world.opened).toHaveLength(1);
    expect(islandsToNextCloud(world)).toBe(3);
    world = takeIsland(world, fourth);
    expect(world.opened).toHaveLength(1);
  });

  it("gives nothing for an island the crew already holds", () => {
    const [island] = worldIslands(NEW_WORLD, 1);
    if (!island) throw new Error("no islands");
    const once = takeIsland(NEW_WORLD, island.id);
    expect(takeIsland(once, island.id)).toBe(once);
  });

  it("gets harder and harder the further out it goes, with no end", () => {
    const world = pushOut(70);
    const islands = worldIslands(world, 1);
    const near = islands.filter((i) => i.region === "0,0");
    expect(Math.max(...islands.map((i) => i.hq))).toBeGreaterThan(20);
    expect(Math.max(...near.map((i) => i.hq))).toBeLessThanOrEqual(4);
  });

  it("keeps a region open after the islands that opened it are lost", () => {
    const world = liftClouds(1);
    expect(world.opened).toHaveLength(1);
    const empty = { ...world, taken: [] };
    expect(chartedRegions(empty).open).toContain(world.opened[0]);
  });

  it("names and rates islands, and pays more for harder ones", () => {
    const islands = worldIslands(liftClouds(2), 1).sort((a, b) => a.hq - b.hq);
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
    const world: WorldProgress = {
      ...NEW_WORLD,
      taken: ["0,0:1"],
      retaken: { "0,0:2": 7 },
      opened: ["1,0"],
      progress: 2,
      rivals: { "0,0:3": { code: "ABCDEF", name: "Ann's crew", hq: 4, buildings: [] } },
      beaten: ["GHJKLM"],
    };
    expect(sanitizeWorld(JSON.parse(JSON.stringify(world)))).toEqual(world);
    expect(sanitizeWorld(null)).toEqual(NEW_WORLD);
    expect(sanitizeWorld({ taken: [1, "a"], retaken: { x: "y" }, opened: "no" })).toEqual({
      ...NEW_WORLD,
      taken: ["a"],
    });
  });
});

describe("player islands", () => {
  const crew = (code: string, hq = 3): Rival => ({
    code,
    name: `${code}'s crew`,
    hq,
    buildings: [],
  });
  const home = () => worldIslands(NEW_WORLD, 3).filter((i) => i.region === "0,0");

  it("keeps a couple of islands in every region for other crews", () => {
    const players = home().filter((i) => i.rival);
    expect(players).toHaveLength(2);
    for (const i of players) {
      expect(i.archetype).toBe("player");
      expect(i.tribute).toBeGreaterThan(0);
    }
  });

  it("fills them with stand-ins near the player's strength until real crews come", () => {
    for (const i of home().filter((x) => x.rival)) {
      expect(i.rival?.code).toBe("");
      expect(i.rival?.name.length).toBeGreaterThan(0);
      expect(Math.abs(i.hq - 3)).toBeLessThanOrEqual(2);
    }
  });

  it("gives raider islands a kind, a crystal and no tribute", () => {
    for (const i of home().filter((x) => !x.rival)) {
      expect(ARCHETYPES[i.archetype as Archetype]).toBeDefined();
      expect(CRYSTAL_KINDS).toContain(i.crystal);
      expect(i.tribute).toBe(0);
    }
  });

  it("moves real crews in, but nobody just beaten", () => {
    const islands = home();
    const spots = openSpots(islands);
    const world = settleRivals({ ...NEW_WORLD, beaten: ["AAAAAA"] }, islands, [
      crew("AAAAAA"),
      crew("BBBBBB"),
      crew("CCCCCC"),
    ]);
    expect(Object.values(world.rivals).map((r) => r.code)).toEqual(["BBBBBB", "CCCCCC"]);
    expect(Object.keys(world.rivals)).toEqual(spots.map((s) => s.id));
    // Nobody's put in two places, or moved once they're there.
    const again = settleRivals(world, worldIslands(world, 3), [crew("BBBBBB"), crew("DDDDDD")]);
    expect(again.rivals).toEqual(world.rivals);
  });

  it("pays a little gold a day for each player island held, and nothing for raider islands", () => {
    const [player] = home().filter((i) => i.rival);
    const [raider] = home().filter((i) => !i.rival);
    if (!player || !raider) throw new Error("no islands");
    const rivals = { [player.id]: crew("AAAAAA", 5) };
    const world = { ...NEW_WORLD, rivals, taken: [player.id, raider.id] };
    expect(dailyTribute(world)).toBe(tributeFor(5));
    expect(tributeFor(5)).toBeLessThan(300);
    expect(dailyTribute({ ...NEW_WORLD, taken: [raider.id] })).toBe(0);
  });

  it("hands a lost player island to another crew, not back to the raiders", () => {
    const [player] = home().filter((i) => i.rival);
    if (!player) throw new Error("no player island");
    const held = takeIsland({ ...NEW_WORLD, rivals: { [player.id]: crew("AAAAAA") } }, player.id);
    let night = 1;
    let result = retakeIslands(held, night, 3);
    while (result.lost.length === 0) result = retakeIslands(held, ++night, 3);
    expect(result.world.taken).not.toContain(player.id);
    expect(result.world.retaken[player.id]).toBeUndefined();
    expect(result.world.rivals[player.id]).toBeUndefined();
  });

  it("remembers who it's beaten, for a while", () => {
    const world = beatRival(NEW_WORLD, crew("AAAAAA"));
    expect(world.beaten).toEqual(["AAAAAA"]);
    expect(beatRival(NEW_WORLD, { ...crew(""), code: "" })).toEqual(NEW_WORLD);
    let many = world;
    for (let i = 0; i < 30; i++) many = beatRival(many, crew(`C${i}`));
    expect(many.beaten.length).toBeLessThanOrEqual(12);
  });
});
