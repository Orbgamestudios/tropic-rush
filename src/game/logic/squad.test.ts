import { describe, expect, it } from "vitest";
import { generateIsland } from "./island";
import { createRaid, IDLE_INPUT, type RaidHero, type RaidState, stepRaid } from "./raid";
import { squadInput } from "./squad";
import { distance, vec } from "./vec";

const DT = 1 / 60;

function hero(state: RaidState, i: number): RaidHero {
  const h = state.heroes[i];
  if (!h) throw new Error(`no hero ${i}`);
  return h;
}

describe("squad", () => {
  it("follows the leader across the island", () => {
    const layout = generateIsland(4, 1);
    // No buildings, so nothing distracts them.
    const state = createRaid({ ...layout, buildings: [], mines: [] }, [
      "rifleman",
      "medic",
      "heavy",
    ]);
    const leader = hero(state, 0);
    // Walk north for 5 seconds, then wait for the slower ones to catch up.
    for (let t = 0; t < 9; t += DT) {
      const move = t < 5 ? vec(0, -1) : vec(0, 0);
      stepRaid(state, [{ ...IDLE_INPUT, move }, squadInput(state, 1), squadInput(state, 2)], DT);
    }
    for (const mate of state.heroes.slice(1))
      expect(distance(mate.pos, leader.pos)).toBeLessThan(6);
  });

  it("never boards the gunboat and idles when dead", () => {
    const state = createRaid(generateIsland(2, 1), ["rifleman", "bazooka"]);
    expect(squadInput(state, 1).toggleBoat).toBe(false);
    hero(state, 1).alive = false;
    expect(squadInput(state, 1)).toBe(IDLE_INPUT);
  });

  it("lets a squad of AI heroes win a level 1 island on its own", () => {
    let wins = 0;
    for (const seed of [1, 2, 3]) {
      const state = createRaid(generateIsland(seed, 1), ["rifleman", "heavy", "medic"]);
      // The leader is down from the start, so the squad has to finish the job.
      hero(state, 0).alive = false;
      for (let t = 0; t < 300 && state.status === "playing"; t += DT)
        stepRaid(state, [IDLE_INPUT, squadInput(state, 1), squadInput(state, 2)], DT);
      if (state.status === "won") wins++;
    }
    expect(wins).toBeGreaterThanOrEqual(2);
  });
});
