import { describe, expect, it } from "vitest";
import { SIM_STEP } from "../config";
import { BUILDINGS } from "./buildings";
import { applyOp, type CrewLayout, type PlacedBuilding, starterLayout } from "./crewIsland";
import { hqCapacity } from "./economy";
import {
  raiderForce,
  raidingShip,
  runNightRaid,
  startNightRaid,
  stepNightRaid,
  stolenBy,
} from "./nightRaid";
import { heldReward, raiderShip } from "./raiderShip";

const NOW = 1_000_000_000;

/** An HQ 1 island with what that level allows: one gun turret and one mortar, by the HQ. */
function fortified(): CrewLayout {
  const start = starterLayout(NOW);
  const hq = start.buildings[0] as PlacedBuilding;
  const beside = (type: PlacedBuilding["type"], dx: number, dy: number): PlacedBuilding => ({
    id: type,
    type,
    x: hq.x + dx,
    y: hq.y + dy,
    rotated: false,
    level: 1,
  });
  return {
    ...start,
    buildings: [hq, beside("gunTurret", -5, 6), beside("mortar", 6, 4)],
  };
}

describe("night raids", () => {
  it("sends more and stronger raiders at a higher headquarters", () => {
    const low = raiderForce(1, 5);
    const high = raiderForce(12, 5);
    expect(high.kinds.length).toBeGreaterThan(low.kinds.length);
    expect(high.powers[0]).toBeGreaterThan(low.powers[0] ?? 0);
  });

  it("overruns an undefended island, but a fortified one holds", () => {
    const bare = runNightRaid(starterLayout(NOW), 1, 11);
    expect(bare.report.survived).toBe(false);
    const held = runNightRaid(fortified(), 1, 11);
    expect(held.report.survived).toBe(true);
    expect(held.report.raidersDown).toBeGreaterThan(0);
  });

  it("carries off loot when it breaks what holds it", () => {
    const bare = runNightRaid(starterLayout(NOW), 1, 11);
    const stock = starterLayout(NOW).resources;
    expect(bare.report.stolen.gold).toBeGreaterThan(0);
    expect(bare.report.stolen.gold).toBeLessThan(stock.gold);
    expect(bare.report.reward).toEqual({});
    expect(bare.report.crystals).toEqual({});
  });

  it("pays for holding the island, and takes nothing that wasn't reached", () => {
    const held = runNightRaid(fortified(), 1, 11);
    expect(held.report.reward.gold).toBeGreaterThan(0);
    expect(Object.values(held.report.crystals).reduce((a, b) => a + (b ?? 0), 0)).toBe(2);
    expect(held.report.stolen).toEqual({});
  });

  it("raids with the day's ship: its raiders, and its pay for holding it off", () => {
    const ship = raiderShip(20_000, 1);
    const raid = runNightRaid(fortified(), ship.day, ship.seed, raidingShip(ship));
    expect(raid.report.raiders).toBe(ship.kinds.length);
    const replay = startNightRaid(raid, raid.seed);
    expect(replay.heroes.map((h) => h.kind)).toEqual(ship.kinds);
    if (raid.report.survived) {
      const most = heldReward(ship.hq, ship.difficulty, raid.seed, true);
      expect(raid.report.reward.gold).toBeLessThanOrEqual(most.purse.gold ?? 0);
    }
  });

  it("only takes a share of what's in a broken storage", () => {
    const state = startNightRaid(starterLayout(NOW), 1);
    const stock = { gold: 1000, timber: 1000, stone: 1000, scrap: 1000 };
    expect(stolenBy(state, 1, stock)).toEqual({});
    for (const b of state.buildings) b.destroyed = true;
    const taken = stolenBy(state, 1, stock);
    expect(taken.gold).toBe(400);
  });

  it("counts a night once, however many crewmates' phones report it", () => {
    const start = fortified();
    const hit = { kind: "night", night: 50, stolen: { gold: 100 }, reward: {} } as const;
    const once = applyOp(start, hit, NOW + 1000);
    if (!once) throw new Error("refused");
    expect(once.resources.gold).toBeLessThan(start.resources.gold);
    expect(applyOp(once, hit, NOW + 2000)).toBeNull();
    expect(applyOp(once, { ...hit, night: 51 }, NOW + 2000)).not.toBeNull();
  });

  it("can't take what isn't there, or pay past what storage holds", () => {
    const start = fortified();
    const robbed = applyOp(
      start,
      { kind: "night", night: 50, stolen: { gold: 1e9 }, reward: {} },
      NOW + 1000,
    );
    expect(robbed?.resources.gold).toBe(0);
    const paid = applyOp(
      start,
      { kind: "night", night: 50, stolen: {}, reward: { gold: 1e9, timber: 50 } },
      NOW + 1000,
    );
    expect(paid?.resources.gold).toBe(hqCapacity(1));
    expect(paid?.resources.timber).toBe(start.resources.timber + 50);
    // An older phone still reports its pay as gold alone.
    const old = applyOp(start, { kind: "night", night: 50, stolen: {}, reward: 30 }, NOW + 1000);
    expect(old?.resources.gold).toBe(start.resources.gold + 30);
  });

  it("fights with what the statues give, the same in the replay", () => {
    const crew = fortified();
    const statues = { ...crew.statues, nature: { ...crew.statues.nature, restored: true } };
    const raid = runNightRaid({ ...crew, statues }, 3, 77);
    expect(raid.buffs?.health).toBeGreaterThan(1);
    const state = startNightRaid(raid, raid.seed);
    expect(state.buildings[0]?.maxHp).toBeGreaterThan(BUILDINGS.headquarters.hp);
  });

  it("replays exactly the same raid from its seed", () => {
    const crew = fortified();
    const ship = raidingShip(raiderShip(20_001, 3));
    const raid = runNightRaid(crew, 3, 77, ship);
    const again = startNightRaid({ ...crew, ship }, raid.seed);
    while (again.status === "playing") stepNightRaid(again, SIM_STEP);
    expect(again.time).toBeCloseTo(raid.report.seconds, 6);
    expect(again.buildings.filter((b) => b.destroyed)).toHaveLength(raid.report.destroyed);
    expect(again.heroes.filter((h) => !h.alive)).toHaveLength(raid.report.raidersDown);
  });
});
