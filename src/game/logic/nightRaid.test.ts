import { describe, expect, it } from "vitest";
import { SIM_STEP } from "../config";
import { type CrewLayout, type PlacedBuilding, starterLayout } from "./crewIsland";
import {
  nextRaidTime,
  nightNumber,
  raiderForce,
  runNightRaid,
  startNightRaid,
  stepNightRaid,
} from "./nightRaid";

const NOW = 1_000_000_000;
const HOUR = 3_600_000;

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
  it("ticks over once a day at the raid hour, in local time", () => {
    const utc3am = 20_000 * 24 * HOUR + 3 * HOUR;
    expect(nightNumber(utc3am - 1, 0)).toBe(nightNumber(utc3am, 0) - 1);
    expect(nightNumber(utc3am + 23 * HOUR, 0)).toBe(nightNumber(utc3am, 0));
    expect(nextRaidTime(utc3am - HOUR, 0)).toBe(utc3am);
    expect(nextRaidTime(utc3am, 0)).toBe(utc3am + 24 * HOUR);
  });

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

  it("replays exactly the same raid from its seed", () => {
    const crew = fortified();
    const { report, seed } = runNightRaid(crew, 3, 77);
    const again = startNightRaid(crew, seed);
    while (again.status === "playing") stepNightRaid(again, SIM_STEP);
    expect(again.time).toBeCloseTo(report.seconds, 6);
    expect(again.buildings.filter((b) => b.destroyed)).toHaveLength(report.destroyed);
    expect(again.heroes.filter((h) => !h.alive)).toHaveLength(report.raidersDown);
  });
});
