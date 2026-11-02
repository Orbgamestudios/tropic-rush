import { describe, expect, it } from "vitest";
import type { BuildingType } from "./buildings";
import {
  applyOp,
  buildableTiles,
  buildBlocker,
  builderCount,
  buildingAtTile,
  buildingCenter,
  buildJobOn,
  type CrewLayout,
  capacity,
  clearBlocker,
  clearTime,
  cornerFor,
  fits,
  footprint,
  GRID_ORIGIN,
  HOME_START,
  hqLevel,
  isBuildableTile,
  MAX_TOOL_LEVEL,
  OBSTACLE_KINDS,
  obstacleAtTile,
  obstacles,
  type PlacedBuilding,
  production,
  sanitizeLayout,
  settle,
  starterLayout,
  TILE,
  tileAt,
  toolBlocker,
  tryOp,
  upgradeBlocker,
} from "./crewIsland";
import { buildTime, costFor, nextLevelGain, START_RESOURCES } from "./economy";
import { isOnGrass } from "./island";
import { nightIsland } from "./nightRaid";

const NOW = 1_000_000_000;
const HOUR = 3_600_000;

const building = (
  id: string,
  type: BuildingType,
  p: { x: number; y: number },
  rotated = false,
): PlacedBuilding => ({ id, type, x: p.x, y: p.y, rotated, level: 1 });

const turret = (id: string, x: number, y: number, rotated = false) =>
  building(id, "gunTurret", { x, y }, rotated);

const allCleared = () => obstacles().map((o) => o.id);

/** A crew's island with its headquarters at a given level and plenty of every resource. By
 * default every obstacle is cleared, so placement tests can use the whole island. */
function island(hq = 20, cleared: string[] = allCleared()): CrewLayout {
  const start = starterLayout(NOW);
  return {
    ...start,
    cleared,
    buildings: start.buildings.map((b) => ({ ...b, level: hq })),
    resources: { gold: 1e9, timber: 1e9, stone: 1e9, scrap: 1e9 },
  };
}

/** A tile with an 8 x 6 block of grass near the start, clear of the headquarters. */
const O = (() => {
  const hq = starterLayout(NOW).buildings[0] as PlacedBuilding;
  const free = (x: number, y: number) =>
    isBuildableTile(x, y) && !buildingAtTile({ buildings: [hq] } as CrewLayout, { x, y });
  const near = [...buildableTiles()].sort(
    (a, b) => Math.hypot(a.x - hq.x, a.y - hq.y) - Math.hypot(b.x - hq.x, b.y - hq.y),
  );
  for (const t of near) {
    let ok = true;
    for (let dy = 0; dy < 6 && ok; dy++)
      for (let dx = 0; dx < 8 && ok; dx++) ok = free(t.x + dx, t.y + dy);
    if (ok) return t;
  }
  throw new Error("no open spot");
})();
const at = (dx: number, dy: number) => ({ x: O.x + dx, y: O.y + dy });

/** A spot well away from the start with room for a 2x2 building. */
const farSpot = (() => {
  const spot = buildableTiles().find(
    (t) =>
      Math.hypot(t.x - O.x, t.y - O.y) > 20 &&
      isBuildableTile(t.x + 1, t.y) &&
      isBuildableTile(t.x, t.y + 1) &&
      isBuildableTile(t.x + 1, t.y + 1),
  );
  if (!spot) throw new Error("no far spot");
  return spot;
})();

function place(layout: CrewLayout, b: PlacedBuilding): CrewLayout {
  const next = applyOp(layout, { kind: "place", building: b }, NOW);
  if (!next) throw new Error(`could not place ${b.id}`);
  return next;
}

/** Skips ahead until all the building work under way is done. */
function finishWork(layout: CrewLayout): CrewLayout {
  const last = Math.max(layout.stamp, ...layout.builds.map((j) => j.doneAt));
  return settle(layout, last + 1);
}

describe("crew island ground", () => {
  it("is the raid island's grass: everything from the top of the beach inland", () => {
    const tiles = buildableTiles();
    expect(tiles.length).toBeGreaterThan(2400);
    for (const t of tiles) {
      const x = GRID_ORIGIN.x + (t.x + 0.5) * TILE;
      const y = GRID_ORIGIN.y + (t.y + 0.5) * TILE;
      expect(isOnGrass(x, y)).toBe(true);
    }
    // Right down to the beach: within a tile or two of the sand on every side.
    const edge = tiles.filter((t) => {
      const x = GRID_ORIGIN.x + (t.x + 0.5) * TILE;
      const y = GRID_ORIGIN.y + (t.y + 0.5) * TILE;
      return !isOnGrass(x, y, 3);
    });
    expect(edge.length).toBeGreaterThan(120);
  });

  it("starts overgrown, with a clearing round the headquarters", () => {
    const layout = starterLayout(NOW);
    expect(layout.cleared).toEqual([]);
    expect(layout.buildings).toHaveLength(1);
    expect(fits(layout, layout.buildings[0] as PlacedBuilding)).toBe(true);
    const all = obstacles();
    expect(all.length).toBeGreaterThan(200);
    // The forest runs out to the shore: nearly all the grass starts under an obstacle.
    const covered = buildableTiles().filter((t) => obstacleAtTile(layout, t)).length;
    expect(covered / buildableTiles().length).toBeGreaterThan(0.9);
    const hq = layout.buildings[0] as PlacedBuilding;
    expect(buildingCenter(hq).x).toBeCloseTo(HOME_START.x, -1);
    // Every kind shows up, and ids are unique.
    expect(new Set(all.map((o) => o.kind)).size).toBe(Object.keys(OBSTACLE_KINDS).length);
    expect(new Set(all.map((o) => o.id)).size).toBe(all.length);
    // No obstacle overlaps another.
    const tiles = new Set<string>();
    for (const o of all)
      for (let y = o.y; y < o.y + o.h; y++)
        for (let x = o.x; x < o.x + o.w; x++) {
          expect(tiles.has(`${x},${y}`)).toBe(false);
          tiles.add(`${x},${y}`);
        }
  });

  it("only builds on cleared ground; clearing takes the right tool and pays out", () => {
    const thicket = obstacles().find((o) => o.kind === "thicket" && o.tier === 1);
    const boulder = obstacles().find((o) => o.kind === "boulder");
    if (!thicket || !boulder) throw new Error("missing obstacles");
    const overgrown = island(1, []);
    const onThicket = turret("t", thicket.x, thicket.y);
    expect(obstacleAtTile(overgrown, thicket)?.id).toBe(thicket.id);
    expect(applyOp(overgrown, { kind: "place", building: onThicket }, NOW)).toBeNull();
    // The axe comes with HQ 1; dynamite needs HQ 5.
    expect(clearBlocker(overgrown, thicket)).toBeNull();
    expect(clearBlocker(overgrown, boulder)).toMatch(/Dynamite/);
    expect(applyOp(overgrown, { kind: "clear", id: boulder.id }, NOW)).toBeNull();
    const poor = { ...overgrown, resources: { gold: 50, timber: 0, stone: 0, scrap: 0 } };
    const started = applyOp(poor, { kind: "clear", id: thicket.id }, NOW);
    expect(started?.jobs).toHaveLength(1);
    expect(started?.resources.gold).toBe(50 - (OBSTACLE_KINDS.thicket.cost.gold ?? 0));
    // Work takes real time: nothing's cleared until the job is done.
    expect(started?.cleared).toEqual([]);
    if (!started) throw new Error("not started");
    expect(settle(started, NOW + 1000).cleared).toEqual([]);
    const done = settle(started, NOW + clearTime(thicket));
    expect(done.cleared[0]).toBe(thicket.id);
    expect(done.jobs).toEqual([]);
    expect(done.resources.timber).toBeGreaterThanOrEqual(OBSTACLE_KINDS.thicket.gives.timber ?? 0);
    for (const id of done.cleared.slice(1))
      expect(obstacles().find((x) => x.id === id)?.kind).toBe("brush");
    expect(obstacleAtTile(done, thicket)).toBeUndefined();
  });

  it("only lets as many jobs run as there are workers, and raises tiers with tool levels", () => {
    const [a, b] = obstacles().filter((o) => o.kind === "thicket" && o.tier === 1);
    if (!a || !b) throw new Error("missing obstacles");
    const start = island(1, []);
    const one = applyOp(start, { kind: "clear", id: a.id }, NOW);
    if (!one) throw new Error("not started");
    expect(applyOp(one, { kind: "clear", id: b.id }, NOW)).toBeNull();
    const far = obstacles().find((o) => o.tier === 3 && OBSTACLE_KINDS[o.kind].tool === "axe");
    if (!far) throw new Error("missing obstacle");
    expect(clearBlocker(island(20, []), far)).toMatch(/level 3 Axe/);
    expect(toolBlocker(island(1, []), "axe")).toMatch(/HQ 4/);
    const better = applyOp(island(20, []), { kind: "toolUp", tool: "axe" }, NOW);
    if (!better) throw new Error("not started");
    expect(better.tools.axe).toBe(1);
    expect(toolBlocker(better, "axe")).toMatch(/Being improved/);
    expect(finishWork(better).tools.axe).toBe(2);
  });

  it("clears the patches round the base in minutes, slower the further out they lie", () => {
    const near = obstacles().filter((o) => o.tier === 1);
    const minutes = near.map((o) => clearTime(o) / 60_000);
    expect(Math.min(...minutes)).toBeGreaterThanOrEqual(1);
    expect(Math.max(...minutes)).toBeLessThanOrEqual(5);
    expect(new Set(minutes).size).toBeGreaterThanOrEqual(4);
    const outFrom = (o: (typeof near)[number]) =>
      Math.hypot(
        GRID_ORIGIN.x + (o.x + o.w / 2) * TILE - HOME_START.x,
        GRID_ORIGIN.y + (o.y + o.h / 2) * TILE - HOME_START.y,
      );
    const sorted = [...near].sort((a, b) => outFrom(a) - outFrom(b));
    const first = sorted[0];
    const last = sorted[sorted.length - 1];
    if (!first || !last) throw new Error("no patches");
    expect(clearTime(first)).toBeLessThan(clearTime(last));
  });

  it("takes months to clear the whole island, even with every worker busy", () => {
    const hours = obstacles().reduce((sum, o) => sum + clearTime(o, MAX_TOOL_LEVEL), 0) / 3.6e6;
    expect(hours / 4 / 24).toBeGreaterThan(90);
  });

  it("refuses buildings that poke off the grass", () => {
    const open = island(20);
    // The east-most tile of a row: a 2x2 building there pokes off the grass.
    const row = buildableTiles().filter((t) => t.y === O.y);
    const edge = row.reduce((a, b) => (b.x > a.x ? b : a), O);
    expect(applyOp(open, { kind: "place", building: turret("a", edge.x, edge.y) }, NOW)).toBeNull();
    const far = tileAt({ x: 90, y: -50 }); // out at sea
    expect(isBuildableTile(far.x, far.y)).toBe(false);
    expect(applyOp(open, { kind: "place", building: turret("a", far.x, far.y) }, NOW)).toBeNull();
  });
});

describe("crew island layout", () => {
  it("places buildings on free tiles and refuses overlaps", () => {
    let layout = place(island(), turret("a", at(0, 0).x, at(0, 0).y));
    expect(
      applyOp(layout, { kind: "place", building: turret("b", at(1, 1).x, at(1, 1).y) }, NOW),
    ).toBeNull();
    layout = place(layout, turret("b", at(3, 0).x, at(3, 0).y));
    expect(layout.buildings).toHaveLength(3);
  });

  it("refuses duplicate ids and a second headquarters", () => {
    const layout = island();
    expect(
      applyOp(layout, { kind: "place", building: turret("hq", at(0, 0).x, at(0, 0).y) }, NOW),
    ).toBeNull();
    expect(
      applyOp(layout, { kind: "place", building: building("hq2", "headquarters", at(0, 0)) }, NOW),
    ).toBeNull();
  });

  it("moves and rotates a building if the new spot is free", () => {
    let layout = place(island(), building("s", "goldVault", at(0, 0)));
    layout = place(layout, turret("t", at(4, 0).x, at(4, 0).y));
    // Rotating swaps the vault's 3x2 footprint to 2x3.
    const rotated = applyOp(layout, { kind: "move", id: "s", ...at(0, 0), rotated: true }, NOW);
    expect(rotated?.buildings.find((b) => b.id === "s")?.rotated).toBe(true);
    expect(applyOp(layout, { kind: "move", id: "s", ...at(3, 0), rotated: false }, NOW)).toBeNull();
    expect(
      applyOp(layout, { kind: "move", id: "s", ...at(0, 3), rotated: false }, NOW),
    ).not.toBeNull();
    expect(
      applyOp(layout, { kind: "move", id: "missing", ...at(0, 3), rotated: false }, NOW),
    ).toBeNull();
  });

  it("removes buildings but never the headquarters", () => {
    let layout = place(island(), turret("t", at(0, 0).x, at(0, 0).y));
    layout = applyOp(layout, { kind: "remove", id: "t" }, NOW) ?? layout;
    expect(layout.buildings.map((b) => b.id)).toEqual(["hq"]);
    expect(applyOp(layout, { kind: "remove", id: "hq" }, NOW)).toBeNull();
  });

  it("converts between tiles and world positions", () => {
    const b = turret("t", at(5, 3).x, at(5, 3).y);
    const center = buildingCenter(b);
    expect(tileAt(center)).toEqual(at(6, 4));
    expect(cornerFor("gunTurret", false, center)).toEqual(at(5, 3));
    const layout = place(island(), b);
    expect(buildingAtTile(layout, at(6, 4))?.id).toBe("t");
    expect(buildingAtTile(layout, at(8, 4))).toBeUndefined();
    expect(fits(layout, turret("u", at(8, 3).x, at(8, 3).y))).toBe(true);
    expect(footprint("goldVault", true)).toEqual({ w: 3, h: 3 });
  });
});

describe("crew island progression", () => {
  it("starts a new island with only its headquarters at level 1 and some resources", () => {
    const layout = starterLayout(NOW);
    expect(layout.buildings.map((b) => [b.type, b.level])).toEqual([["headquarters", 1]]);
    expect(layout.resources).toEqual(START_RESOURCES);
  });

  it("allows one of each producer and one gun turret and mortar at HQ 1, but no storage", () => {
    let layout = { ...island(1) };
    const types: BuildingType[] = ["goldMine", "lumberCamp", "quarry", "gunTurret", "mortar"];
    for (const type of types) expect(buildBlocker(layout, type)).toBeNull();
    expect(buildBlocker(layout, "scrapYard")).toMatch(/level 2/);
    expect(buildBlocker(layout, "goldVault")).toMatch(/level 3/);
    expect(buildBlocker(layout, "harpoon")).toMatch(/level 4/);
    layout = place(layout, building("m", "goldMine", at(0, 0)));
    expect(buildBlocker(layout, "goldMine")).not.toBeNull();
    layout = place(layout, turret("t", at(6, 0).x, at(6, 0).y));
    expect(buildBlocker(layout, "gunTurret")).toMatch(/headquarters to 3/);
  });

  it("allows 1, 2 and then 3 of each storage at HQ 3, 7 and 20", () => {
    for (const [hq, count] of [
      [2, 0],
      [3, 1],
      [6, 1],
      [7, 2],
      [19, 2],
      [20, 3],
    ] as const) {
      let layout = island(hq);
      let placed = 0;
      for (const t of buildableTiles()) {
        const vault = building(`v${placed}`, "goldVault", t);
        if (!buildBlocker(layout, "goldVault") && fits(layout, vault)) {
          layout = place(layout, vault);
          placed++;
        }
      }
      expect(placed).toBe(count);
    }
  });

  it("caps upgrades by the headquarters' level, and storages at level 8", () => {
    let layout = finishWork(place(island(3), building("v", "goldVault", at(0, 0))));
    const now = () => layout.stamp;
    const upgrade = (l: CrewLayout) => tryOp(l, { kind: "upgrade", id: "v" }, now());
    expect(upgrade(layout)).toEqual({ error: "Upgrade the headquarters first" });
    layout = {
      ...layout,
      buildings: layout.buildings.map((b) => (b.type === "headquarters" ? { ...b, level: 20 } : b)),
    };
    for (let level = 2; level <= 8; level++) {
      const result = upgrade(layout);
      if (!("layout" in result)) throw new Error(result.error);
      layout = finishWork(result.layout);
    }
    expect(layout.buildings.find((b) => b.id === "v")?.level).toBe(8);
    expect(upgrade(layout)).toEqual({ error: "Already at its highest level" });
  });

  it("upgrades the headquarters up to level 20", () => {
    let layout = island(19);
    const result = tryOp(layout, { kind: "upgrade", id: "hq" }, NOW);
    if (!("layout" in result)) throw new Error(result.error);
    layout = finishWork(result.layout);
    expect(hqLevel(layout)).toBe(20);
    expect(tryOp(layout, { kind: "upgrade", id: "hq" }, layout.stamp)).toEqual({
      error: "Already at its highest level",
    });
  });

  it("takes minutes, then hours, for each level, and longer for the headquarters", () => {
    const minutes = (type: BuildingType, level: number) => buildTime(type, level) / 60_000;
    expect(minutes("gunTurret", 1)).toBe(0.5);
    expect([2, 3, 4, 5].map((level) => minutes("gunTurret", level))).toEqual([1, 2, 3, 5]);
    expect(minutes("gunTurret", 8)).toBeGreaterThanOrEqual(60);
    expect(minutes("headquarters", 2)).toBeLessThanOrEqual(5);
    expect(minutes("headquarters", 6)).toBeLessThanOrEqual(30);
    expect(minutes("headquarters", 8)).toBeGreaterThanOrEqual(60);
    for (let level = 3; level <= 10; level++) {
      expect(minutes("mortar", level)).toBeGreaterThan(minutes("mortar", level - 1));
    }
    for (let level = 3; level <= 20; level++) {
      expect(minutes("headquarters", level)).toBeGreaterThan(minutes("headquarters", level - 1));
    }
  });

  it("charges up front, but only raises the level when the work is done", () => {
    let layout = finishWork(place(island(5), turret("t", at(0, 0).x, at(0, 0).y)));
    expect(layout.buildings.find((b) => b.id === "t")?.level).toBe(1);
    const start = layout.stamp;
    const gold = layout.resources.gold;
    const started = applyOp(layout, { kind: "upgrade", id: "t" }, start);
    if (!started) throw new Error("not started");
    layout = started;
    expect(layout.resources.gold).toBeLessThan(gold);
    expect(layout.buildings.find((b) => b.id === "t")?.level).toBe(1);
    expect(buildJobOn(layout, "t")?.doneAt).toBe(start + buildTime("gunTurret", 2));
    expect(tryOp(layout, { kind: "upgrade", id: "t" }, start)).toEqual({
      error: "Already upgrading",
    });
    const before = settle(layout, start + buildTime("gunTurret", 2) - 1);
    expect(before.buildings.find((b) => b.id === "t")?.level).toBe(1);
    const after = settle(layout, start + buildTime("gunTurret", 2));
    expect(after.buildings.find((b) => b.id === "t")?.level).toBe(2);
    expect(after.builds).toEqual([]);
  });

  it("says what the next level of a building gives", () => {
    expect(nextLevelGain("goldMine", 1)).toMatch(/an hour/);
    expect(nextLevelGain("goldVault", 1)).toMatch(/storage/);
    expect(nextLevelGain("gunTurret", 1)).toBe("+12% strength");
  });

  it("sells land mines from HQ 2, a tile each, and they can't be upgraded", () => {
    expect(buildBlocker(island(1), "landmine")).toMatch(/level 2/);
    expect(footprint("landmine", false)).toEqual({ w: 1, h: 1 });
    const layout = finishWork(place(island(2), building("m", "landmine", at(0, 0))));
    const mine = layout.buildings.find((b) => b.id === "m");
    if (!mine) throw new Error("no mine");
    expect(mine.level).toBe(1);
    expect(upgradeBlocker(layout, mine)).toMatch(/highest level/);
  });

  it("only sets a bought mine off in a night raid once it's in the ground", () => {
    const placed = place(island(2), building("m", "landmine", at(0, 0)));
    expect(nightIsland(placed, 1).mines).toHaveLength(0);
    const ready = nightIsland(finishWork(placed), 1);
    expect(ready.mines).toHaveLength(1);
    expect(ready.buildings.some((b) => b.type === "landmine")).toBe(false);
  });

  it("keeps a new building out of action until it's up", () => {
    const layout = place(island(3), building("m", "goldMine", at(0, 0)));
    const broke = { ...layout, resources: { gold: 0, timber: 0, stone: 0, scrap: 0 } };
    expect(broke.buildings.find((b) => b.id === "m")?.level).toBe(0);
    expect(production(broke).gold).toBe(0);
    expect(production(finishWork(broke)).gold).toBeGreaterThan(0);
    expect(nightIsland(broke, 1).buildings.some((b) => b.type === "goldMine")).toBe(false);
  });

  it("only has so many builders, more as the headquarters grows", () => {
    let layout = island(3);
    const turrets = [0, 4].map((x) => turret(`t${x}`, at(x, 0).x, at(x, 0).y));
    for (const t of turrets) layout = place(layout, t);
    expect(builderCount(layout)).toBe(2);
    expect(buildBlocker(layout, "mortar")).toMatch(/builders are busy/);
    expect(builderCount(island(20))).toBeGreaterThan(2);
  });

  it("drops the work when a building is removed", () => {
    const layout = place(island(3), turret("t", at(0, 0).x, at(0, 0).y));
    const removed = applyOp(layout, { kind: "remove", id: "t" }, NOW);
    expect(removed?.builds).toEqual([]);
  });

  it("banks raid loot, up to what the island can hold", () => {
    const layout = { ...island(3), resources: { gold: 0, timber: 10, stone: 0, scrap: 0 } };
    const banked = applyOp(layout, { kind: "loot", purse: { timber: 90, gold: 1e12 } }, NOW);
    expect(banked?.resources.timber).toBeCloseTo(100);
    expect(banked?.resources.gold).toBe(capacity(layout).gold);
    const nonsense = applyOp(
      layout,
      { kind: "loot", purse: { timber: Number.NaN, stone: -5 } },
      NOW,
    );
    expect(nonsense?.resources).toEqual(layout.resources);
  });

  it("keeps work under way through a save, and drops work on what's gone", () => {
    const layout = place(island(3), turret("t", at(0, 0).x, at(0, 0).y));
    const back = sanitizeLayout(JSON.parse(JSON.stringify(layout)), NOW);
    expect(back.builds).toEqual(layout.builds);
    expect(back.buildings.find((b) => b.id === "t")?.level).toBe(0);
    const orphaned = {
      ...layout,
      builds: [
        ...layout.builds,
        { target: { building: "ghost" }, doneAt: NOW + 1 },
        { target: "nonsense", doneAt: NOW + 1 },
      ],
    };
    expect(sanitizeLayout(JSON.parse(JSON.stringify(orphaned)), NOW).builds).toHaveLength(1);
    const lost = { ...layout, builds: [] };
    const healed = sanitizeLayout(JSON.parse(JSON.stringify(lost)), NOW);
    expect(healed.buildings.find((b) => b.id === "t")?.level).toBe(1);
  });

  it("charges for building and upgrading, and refuses what the crew can't afford", () => {
    const start = { ...starterLayout(NOW), cleared: allCleared() };
    const built = place(start, turret("t", at(0, 0).x, at(0, 0).y));
    const cost = costFor("gunTurret", 1);
    expect(built.resources.gold).toBe(START_RESOURCES.gold - (cost.gold ?? 0));
    const broke = { ...start, resources: { gold: 0, timber: 0, stone: 0, scrap: 0 } };
    expect(
      tryOp(broke, { kind: "place", building: turret("t", at(0, 0).x, at(0, 0).y) }, NOW),
    ).toEqual({
      error: "Not enough resources",
    });
    expect(tryOp(broke, { kind: "upgrade", id: "hq" }, NOW)).toEqual({
      error: "Not enough resources",
    });
  });

  it("fills the stock from producers over time, up to what storage holds", () => {
    let layout = finishWork(place(island(3), building("m", "goldMine", at(0, 0))));
    layout = { ...layout, resources: { gold: 0, timber: 0, stone: 0, scrap: 0 }, stamp: NOW };
    const later = settle(layout, NOW + HOUR);
    expect(later.resources.gold).toBeCloseTo(900);
    expect(later.resources.timber).toBe(0);
    const muchLater = settle(layout, NOW + 1000 * HOUR);
    expect(muchLater.resources.gold).toBe(capacity(layout).gold);
    const rich = { ...layout, resources: island().resources };
    const withVault = finishWork(place(rich, building("v", "goldVault", at(6, 0))));
    expect(capacity(withVault).gold).toBeGreaterThan(capacity(layout).gold);
  });

  it("moves a building that a change of size has left overlapping another, not losing it", () => {
    const hq = { ...(starterLayout(NOW).buildings[0] as PlacedBuilding), level: 3 };
    const mine = building("m", "goldMine", at(0, 0));
    const close = turret("t", at(3, 0).x, at(3, 0).y);
    const back = sanitizeLayout(
      { buildings: [hq, { ...mine, level: 2 }, { ...close, level: 2 }], cleared: allCleared() },
      NOW,
    );
    expect(back.buildings.map((b) => b.id).sort()).toEqual(["hq", "m", "t"]);
    const [a, b] = [back.buildings[1], back.buildings[2]];
    if (!a || !b) throw new Error("buildings lost");
    expect(fits({ buildings: [a], cleared: allCleared() }, b)).toBe(true);
    expect(b.level).toBe(2);
  });

  it("cleans up untrusted layout data, dropping what the headquarters doesn't allow", () => {
    expect(sanitizeLayout(null, NOW)).toEqual(starterLayout(NOW));
    const hq = starterLayout(NOW).buildings[0] as PlacedBuilding;
    const messy = {
      cleared: ["nonsense", 4],
      resources: { gold: 1e9, timber: -5, stone: "x" },
      stamp: NOW - HOUR,
      buildings: [
        { ...hq, level: 2 },
        { ...turret("ok", at(0, 0).x, at(0, 0).y), level: 9 },
        turret("second", farSpot.x, farSpot.y), // HQ 2 allows only one gun turret
        { ...building("m", "goldMine", at(4, 0)), level: undefined },
        turret("overlap", at(1, 1).x, at(1, 1).y),
        building("vault", "goldVault", at(0, 3)), // needs HQ 3
        { id: "bad", type: "spaceship", ...at(0, 4) },
        { id: "half", type: "mortar", x: O.x + 0.5, y: O.y + 4 },
      ],
    };
    const clean = sanitizeLayout(messy, NOW);
    expect(clean.buildings.map((b) => [b.id, b.level])).toEqual([
      ["hq", 2],
      ["ok", 2],
      ["m", 1],
    ]);
    expect(clean.resources.gold).toBe(capacity(clean).gold);
    expect(clean.resources.timber).toBe(0);
    expect(clean.resources.stone).toBe(0);
    expect(clean.stamp).toBe(NOW - HOUR);
    // Old islands: ground under existing buildings counts as cleared, nothing else.
    for (const b of clean.buildings) {
      const { w, h } = footprint(b.type, b.rotated);
      for (let y = b.y; y < b.y + h; y++)
        for (let x = b.x; x < b.x + w; x++) expect(obstacleAtTile(clean, { x, y })).toBeUndefined();
    }
    expect(clean.cleared).not.toContain("nonsense");
    // A building left off the grass by an older island moves to the nearest spot.
    const stray = { ...building("mine", "goldMine", tileAt({ x: 62, y: -44 })), level: 1 };
    const moved = sanitizeLayout({ buildings: [hq, stray] }, NOW);
    const kept = moved.buildings.find((b) => b.id === "mine");
    expect(kept).toBeDefined();
    if (kept) expect(fits(moved, kept)).toBe(true);
  });
});
