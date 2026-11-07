import { describe, expect, it } from "vitest";
import { DIFFICULTIES, type Difficulty } from "./difficulty";
import { dayStart, heldReward, raiderCount, raiderShip, shipDay } from "./raiderShip";

const HOUR = 3_600_000;

describe("raider ships", () => {
  it("turns up each morning, and strikes that night between 9 pm and 5 am", () => {
    const morning = dayStart(20_000, 0);
    expect(shipDay(morning - 1, 0)).toBe(19_999);
    expect(shipDay(morning, 0)).toBe(20_000);
    expect(shipDay(morning + 23 * HOUR, 0)).toBe(20_000);
    for (let day = 20_000; day < 20_200; day++) {
      const ship = raiderShip(day, 5, 0);
      const after = (ship.at - dayStart(day, 0)) / HOUR;
      expect(after).toBeGreaterThanOrEqual(16);
      expect(after).toBeLessThanOrEqual(24);
      // It lets on roughly when, and the real moment is inside what it says.
      expect(ship.at).toBeGreaterThanOrEqual(ship.window.from);
      expect(ship.at).toBeLessThanOrEqual(ship.window.to);
    }
  });

  it("is the same ship on every phone, and a different one most days", () => {
    expect(raiderShip(20_000, 5, 0)).toEqual(raiderShip(20_000, 5, 0));
    const plans = new Set(
      Array.from({ length: 40 }, (_, i) => raiderShip(20_000 + i, 5, 0).plan.name),
    );
    expect(plans.size).toBeGreaterThan(4);
  });

  it("comes in every difficulty, mostly the easier ones", () => {
    const seen: Record<Difficulty, number> = {
      Easy: 0,
      Medium: 0,
      Hard: 0,
      Extreme: 0,
      Impossible: 0,
    };
    for (let day = 0; day < 2000; day++) seen[raiderShip(day, 10, 0).difficulty]++;
    for (const band of DIFFICULTIES) expect(seen[band], band).toBeGreaterThan(0);
    expect(seen.Easy + seen.Medium).toBeGreaterThan(seen.Extreme + seen.Impossible);
  });

  it("carries more raiders, and stronger, the harder it is", () => {
    expect(raiderCount(20)).toBeGreaterThan(raiderCount(1));
    for (let day = 0; day < 200; day++) {
      const ship = raiderShip(day, 10, 0);
      expect(ship.kinds).toHaveLength(raiderCount(ship.hq));
      expect(ship.powers.every((p) => p === ship.powers[0])).toBe(true);
    }
  });

  it("pays a crystal on an easy ship, four on an impossible one, and more of the rest too", () => {
    const crystals = (d: Difficulty) =>
      Object.values(heldReward(10, d, 3).crystals).reduce((a, b) => a + (b ?? 0), 0);
    expect(crystals("Easy")).toBe(1);
    expect(crystals("Impossible")).toBe(4);
    const gold = (d: Difficulty) => heldReward(10, d, 3).purse.gold ?? 0;
    expect(gold("Impossible")).toBeGreaterThan(gold("Easy"));
    expect(heldReward(10, "Easy", 3, true).purse.gold).toBeGreaterThan(gold("Easy"));
  });
});
