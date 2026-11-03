import { describe, expect, it } from "vitest";
import { BUILDINGS, type BuildingType } from "./buildings";
import { footprint, GRID_ORIGIN, TILE } from "./crewIsland";
import { allowedCount } from "./economy";
import { forestCover, generateIsland } from "./enemyBase";
import { HEROES } from "./heroes";
import type { IslandLayout } from "./island";
import { ARCHETYPES, type Archetype, archetypeFor, islandShape } from "./islandShapes";
import { distance, vec } from "./vec";

const KINDS = Object.keys(ARCHETYPES) as Archetype[];

/** The first seed that gives this kind of island at this headquarters level. */
function seedFor(kind: Archetype, hq: number): number | null {
  for (let seed = 1; seed < 600; seed++) if (archetypeFor(seed, hq) === kind) return seed;
  return null;
}

function everyIsland(run: (island: IslandLayout, kind: Archetype, hq: number) => void): void {
  for (const kind of KINDS) {
    for (const hq of [1, 2, 4, 6, 9, 13, 20, 26]) {
      const seed = seedFor(kind, hq);
      if (seed !== null) run(generateIsland(seed, hq), kind, hq);
    }
  }
}

/** Walks a coarse grid outward from the landing, the way a hero of this size could. */
function reachable(island: IslandLayout, radius: number): Set<string> {
  const shape = island.shape;
  if (!shape) throw new Error("no shape");
  const step = 1.5;
  // Buildings can be shot out of the way: it's the land and the rock that have to leave a path.
  const solid = island.obstacles.filter((o) => o.kind !== "palm");
  const free = (x: number, y: number) =>
    shape.shoreDistance(x, y) > radius &&
    solid.every((s) => distance(s.pos, vec(x, y)) > s.radius + radius * 0.6);
  const key = (i: number, j: number) => `${i},${j}`;
  const seen = new Set<string>();
  const start = [Math.round(island.spawn.x / step), Math.round(island.spawn.y / step)] as const;
  const queue: (readonly [number, number])[] = [start];
  seen.add(key(...start));
  while (queue.length > 0) {
    const [i, j] = queue.pop() as readonly [number, number];
    for (const [di, dj] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ] as const) {
      const ni = i + di;
      const nj = j + dj;
      if (seen.has(key(ni, nj)) || !free(ni * step, nj * step)) continue;
      seen.add(key(ni, nj));
      queue.push([ni, nj]);
    }
  }
  return seen;
}

describe("island shapes", () => {
  it("gives the same island to the same seed, on every phone", () => {
    const a = generateIsland(77, 9);
    const b = generateIsland(77, 9);
    expect(a.buildings).toEqual(b.buildings);
    expect(a.obstacles).toEqual(b.obstacles);
    expect(a.mines).toEqual(b.mines);
  });

  it("deals out every kind of island, each only at its levels", () => {
    const seen = new Set<Archetype>();
    for (let seed = 1; seed < 400; seed++) {
      for (const hq of [1, 5, 9, 14, 20]) {
        const kind = archetypeFor(seed, hq);
        seen.add(kind);
        const [low, high] = ARCHETYPES[kind].hq;
        expect(hq).toBeGreaterThanOrEqual(low);
        expect(hq).toBeLessThanOrEqual(high);
      }
    }
    expect([...seen].sort()).toEqual([...KINDS].sort());
  });

  it("makes the different kinds of island really different shapes", () => {
    const land = (kind: Archetype) => {
      const seed = seedFor(kind, 12);
      if (seed === null) return "";
      const shape = islandShape(seed, 12);
      let bits = "";
      for (let y = -120; y <= 120; y += 24) {
        for (let x = -120; x <= 120; x += 24) bits += shape.shoreDistance(x, y) > 0 ? "#" : ".";
      }
      return bits;
    };
    const shapes = KINDS.filter((k) => k !== "cove").map(land);
    expect(new Set(shapes).size).toBe(shapes.length);
  });

  it("grows islands with the headquarters", () => {
    const size = (hq: number) => {
      const shape = islandShape(seedFor("key", hq) ?? 1, hq);
      let cells = 0;
      for (let x = -150; x < 150; x += 6) {
        for (let y = -150; y < 150; y += 6) if (shape.shoreDistance(x, y) > 0) cells++;
      }
      return cells;
    };
    expect(size(16)).toBeGreaterThan(size(3));
  });

  it("puts low-level camps near the beach and strongholds far inland", () => {
    const walk = (seed: number, hq: number) => {
      const island = generateIsland(seed, hq);
      const camp = island.buildings.find((b) => b.type === "headquarters");
      return camp ? distance(camp.pos, island.spawn) : 0;
    };
    const near = walk(seedFor("cove", 1) ?? 1, 1);
    // Out of a gun turret's reach of the landing, but only just.
    expect(near).toBeGreaterThan(36);
    expect(near).toBeLessThan(62);
    expect(walk(seedFor("key", 16) ?? 1, 16)).toBeGreaterThan(100);
  });

  it("grows the forest thicker the stronger the island", () => {
    expect(forestCover(1)).toBeLessThan(0.25);
    expect(forestCover(5)).toBeLessThan(forestCover(10));
    expect(forestCover(16)).toBe(1);
  });

  it("lands the crew on the south-west shore of every island, with the gunboat off it", () => {
    everyIsland((island, kind) => {
      const shape = island.shape;
      if (!shape) throw new Error("no shape");
      expect(shape.shoreDistance(island.spawn.x, island.spawn.y), kind).toBeGreaterThan(2);
      expect(shape.shoreDistance(island.boat.x, island.boat.y), kind).toBeLessThan(0);
      expect(island.spawn.x, kind).toBeLessThan(0);
      expect(island.spawn.y, kind).toBeGreaterThan(0);
    });
  });

  it("fits every required building on every island, on its own tiles", () => {
    everyIsland((island, kind, hq) => {
      const shape = island.shape;
      if (!shape) throw new Error("no shape");
      const rated = Math.min(hq, 20);
      const types = Object.keys(BUILDINGS) as BuildingType[];
      for (const type of types) {
        if (type === "landmine" || type === "laboratory") continue;
        const have = island.buildings.filter((b) => b.type === type).length;
        expect(have, `${kind} hq ${hq}: ${type}`).toBe(allowedCount(type, rated));
      }
      for (const b of island.buildings) {
        const { w, h } = footprint(b.type, false);
        // On the tile grid: the corner lands exactly on a tile line.
        const cornerX = (b.pos.x - GRID_ORIGIN.x) / TILE - w / 2;
        const cornerY = (b.pos.y - GRID_ORIGIN.y) / TILE - h / 2;
        expect(Number.isInteger(cornerX)).toBe(true);
        expect(Number.isInteger(cornerY)).toBe(true);
        expect(shape.shoreDistance(b.pos.x, b.pos.y), `${kind} ${b.type}`).toBeGreaterThan(0);
        expect(shape.lava(b.pos.x, b.pos.y)).toBe(0);
      }
    });
  });

  it("never walls a hero out: every building can be reached from the beach", () => {
    everyIsland((island, kind, hq) => {
      for (const radius of [HEROES.rifleman.radius, HEROES.tank.radius]) {
        const seen = reachable(island, radius);
        for (const b of island.buildings) {
          const r = BUILDINGS[b.type].radius + radius + 2;
          let touched = false;
          for (let a = 0; a < 6.28 && !touched; a += 0.4) {
            const i = Math.round((b.pos.x + Math.cos(a) * r) / 1.5);
            const j = Math.round((b.pos.y + Math.sin(a) * r) / 1.5);
            touched = seen.has(`${i},${j}`);
          }
          expect(touched, `${kind} hq ${hq}: ${b.type} for radius ${radius}`).toBe(true);
        }
      }
    });
  }, 40_000);

  it("gives a volcano island its mountain, its lava and a dry way across", () => {
    const seed = seedFor("volcano", 12);
    if (seed === null) throw new Error("no volcano");
    const island = generateIsland(seed, 12);
    const shape = island.shape;
    const volcano = shape?.volcano;
    if (!shape || !volcano) throw new Error("no volcano");
    expect(shape.height(volcano.pos.x + volcano.radius * 0.3, volcano.pos.y)).toBeGreaterThan(8);
    expect(island.obstacles.some((o) => o.kind === "volcano")).toBe(true);
    let lava = 0;
    for (let x = -150; x < 150; x += 3) {
      for (let y = -150; y < 150; y += 3) if (shape.lava(x, y) > 0.5) lava++;
    }
    expect(lava).toBeGreaterThan(20);
    expect(shape.blackSand).toBe(true);
    // Only a volcano island has any of that.
    const other = islandShape(seedFor("key", 12) ?? 1, 12);
    expect(other.volcano).toBeNull();
    expect(other.lava(0, 0)).toBe(0);
  });

  it("raises walls of cliff on a cliff fort, with gaps to get through", () => {
    const seed = seedFor("ridge", 12);
    if (seed === null) throw new Error("no ridge");
    const island = generateIsland(seed, 12);
    expect(island.obstacles.filter((o) => o.kind === "cliff").length).toBeGreaterThan(10);
    for (const o of island.obstacles.filter((c) => c.kind === "cliff")) {
      expect(o.blocksShots).toBe(true);
    }
  });

  it("puts boulder cliffs in the forests of the stronger islands", () => {
    let withCliffs = 0;
    for (let seed = 1; seed < 40; seed++) {
      const { obstacles } = generateIsland(seed, 14);
      if (obstacles.some((o) => o.kind === "cliff")) withCliffs++;
    }
    expect(withCliffs).toBeGreaterThan(10);
    // Nothing that big on a little camp.
    const cove = generateIsland(seedFor("cove", 1) ?? 1, 1);
    expect(cove.obstacles.some((o) => o.kind === "cliff")).toBe(false);
  });
});
