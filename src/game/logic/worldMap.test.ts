import { describe, expect, it } from "vitest";
import { CRYSTAL_KINDS } from "./crystals";
import { ARCHETYPES, type Archetype } from "./islandShapes";
import {
  beatRival,
  clearSky,
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

/** Takes whatever's nearest until `clouds` splotches of cloud have lifted. */
function liftClouds(clouds: number): WorldProgress {
  let world = NEW_WORLD;
  while (world.opened.length < clouds) {
    const [next] = worldIslands(world, 1)
      .filter((island) => !island.taken)
      .sort((a, b) => Math.hypot(a.x, a.y) - Math.hypot(b.x, b.y));
    if (!next) throw new Error("ran out of islands");
    world = takeIsland(world, next.id);
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
    expect(islands.length).toBeGreaterThanOrEqual(3);
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

  it("starts with a splotch of clear sky round home, and cloud past it", () => {
    expect(NEW_WORLD.opened).toEqual([]);
    expect(islandsToNextCloud(NEW_WORLD)).toBe(3);
    expect(worldIslands(NEW_WORLD, 1).every((i) => Math.hypot(i.x, i.y) < 110)).toBe(true);
    // Not a neat box: its edge wanders.
    const radii = clearSky(NEW_WORLD).map((h) => h.radius);
    expect(new Set(radii).size).toBeGreaterThan(3);
  });

  it("counts to the next splotch of cloud every third island", () => {
    let world = NEW_WORLD;
    for (const left of [2, 1, 3]) {
      const next = worldIslands(world, 1).find((i) => !i.taken);
      if (!next) throw new Error("too few islands");
      world = takeIsland(world, next.id);
      expect(islandsToNextCloud(world)).toBe(left);
    }
    expect(world.opened.length).toBeGreaterThanOrEqual(1);
  });

  it("opens up more slowly than a crew conquers, and never leaves them stuck", () => {
    let world = NEW_WORLD;
    const start = worldIslands(world, 1).length;
    for (let wins = 1; wins <= 60; wins++) {
      const open = worldIslands(world, 1).filter((i) => !i.taken);
      const [next] = open;
      if (!next) throw new Error(`nothing to raid after ${wins} wins`);
      world = takeIsland(world, next.id);
      const shown = worldIslands(world, 1);
      expect(shown.length, `after ${wins} wins`).toBeLessThanOrEqual(start + wins + 2);
      const waiting = shown.filter((i) => !i.taken).length;
      expect(waiting, `waiting after ${wins} wins`).toBeLessThanOrEqual(8);
    }
  });

  it("leaves a good share of the sea empty", () => {
    const shown = worldIslands(NEW_WORLD, 1);
    expect(shown.length).toBeLessThanOrEqual(7);
  });

  it("clears the sky evenly round home, however one-sided the fighting", () => {
    // Always the furthest island to the east: the sky should open up all the same.
    let world = NEW_WORLD;
    for (let wins = 0; wins < 45; wins++) {
      const [next] = worldIslands(world, 1)
        .filter((i) => !i.taken)
        .sort((a, b) => b.x - a.x);
      if (next) world = takeIsland(world, next.id);
    }
    const sky = clearSky(world);
    const reach = (pick: (x: number, y: number) => number) =>
      Math.max(...sky.map((h) => pick(h.x, h.y)));
    const east = reach((x) => x);
    const west = reach((x) => -x);
    const south = reach((_, y) => y);
    const north = reach((_, y) => -y);
    expect(Math.min(east, west) / Math.max(east, west)).toBeGreaterThan(0.55);
    expect(Math.min(north, south) / Math.max(north, south)).toBeGreaterThan(0.55);
  });

  it("never runs short of islands to raid", () => {
    let world = NEW_WORLD;
    for (let wins = 0; wins < 60; wins++) {
      const open = worldIslands(world, 1).filter((i) => !i.taken);
      expect(open.length, `after ${wins} wins`).toBeGreaterThanOrEqual(2);
      const [next] = open;
      if (next) world = takeIsland(world, next.id);
    }
  });

  it("shrinks a map an old save opened by the region, and keeps what the crew holds", () => {
    // What a crew had before: eight whole regions open, and islands held out in them.
    const regions = ["1,0", "-1,0", "0,1", "0,-1", "1,1", "-1,-1", "2,0", "1,-1"];
    const wide = { ...NEW_WORLD, opened: regions };
    const far = "2,0:0";
    const shrunk = sanitizeWorld({ ...wide, taken: [far] });
    expect(shrunk.opened).toHaveLength(8);
    expect(shrunk.opened.every((key) => key.includes(":"))).toBe(true);
    const islands = worldIslands(shrunk, 1);
    expect(islands.length).toBeLessThan(20);
    expect(islands.find((i) => i.id === far)?.taken).toBe(true);
    // And it's settled: reading it again changes nothing.
    expect(sanitizeWorld(shrunk)).toEqual(shrunk);
  });

  it("gives nothing for an island the crew already holds", () => {
    const [island] = worldIslands(NEW_WORLD, 1);
    if (!island) throw new Error("no islands");
    const once = takeIsland(NEW_WORLD, island.id);
    expect(takeIsland(once, island.id)).toBe(once);
  });

  it("gets harder and harder the further out it goes, with no end", () => {
    const world = pushOut(90);
    const islands = worldIslands(world, 1);
    const near = islands.filter((i) => i.region === "0,0");
    expect(Math.max(...islands.map((i) => i.hq))).toBeGreaterThan(5);
    expect(Math.max(...near.map((i) => i.hq))).toBeLessThanOrEqual(4);
  });

  it("keeps the sky clear after the islands that opened it are lost", () => {
    const world = liftClouds(1);
    expect(world.opened.length).toBeGreaterThanOrEqual(1);
    const stays = clearSky({ ...world, taken: [] });
    expect(clearSky(world)).toEqual(expect.arrayContaining(stays));
  });

  it("names and rates islands, and pays more for harder ones", () => {
    const islands = worldIslands(liftClouds(16), 1).sort((a, b) => a.hq - b.hq);
    expect(islands.every((i) => i.name.length > 3)).toBe(true);
    const easy = islands[0];
    const hard = islands[islands.length - 1];
    expect(hard?.hq).toBeGreaterThan(easy?.hq ?? 0);
    expect(hard?.reward.gold).toBeGreaterThan(easy?.reward.gold ?? 0);
    expect(easy?.difficulty).toBe("Easy");
    const raiders = worldIslands(NEW_WORLD, 20).filter((i) => !i.rival);
    expect(raiders.every((i) => i.difficulty === "Easy")).toBe(true);
  });
});

describe("raiders retaking islands", () => {
  const held = () => {
    let world = NEW_WORLD;
    for (const island of worldIslands(NEW_WORLD, 1)) world = takeIsland(world, island.id);
    return world;
  };

  it("takes back 10 to 15% of what's held each day, over time", () => {
    const world = held();
    let lost = 0;
    const nights = 2000;
    for (let night = 100; night < 100 + nights; night++) {
      lost += retakeIslands(world, night, 3).lost.length;
    }
    const share = lost / nights / world.taken.length;
    expect(share).toBeGreaterThan(0.1);
    expect(share).toBeLessThan(0.15);
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
      opened: ["1,0:2"],
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
    const same = worldIslands(world, 3).filter((i) => islands.some((o) => o.id === i.id));
    const again = settleRivals(world, same, [crew("BBBBBB"), crew("DDDDDD")]);
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
