import { describe, expect, it } from "vitest";
import { BUILDINGS } from "./buildings";
import { generateIsland } from "./enemyBase";
import { createRaid, IDLE_INPUT, type RaidHero, type RaidState, stepRaid } from "./raid";
import { squadInput } from "./squad";
import { add, distance, normalize, scale, sub, vec } from "./vec";

const DT = 1 / 60;

function hero(state: RaidState, i: number): RaidHero {
  const h = state.heroes[i];
  if (!h) throw new Error(`no hero ${i}`);
  return h;
}

describe("raiders", () => {
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

  it("keeps a medic with the fighters, throwing to whoever's hurt", () => {
    const layout = generateIsland(4, 1);
    const state = createRaid({ ...layout, buildings: [], mines: [] }, ["rifleman", "medic"]);
    const leader = hero(state, 0);
    leader.hp = 100;
    for (let t = 0; t < 3; t += DT) stepRaid(state, [IDLE_INPUT, squadInput(state, 1)], DT);
    expect(leader.hp).toBeGreaterThan(100);
    expect(distance(hero(state, 1).pos, leader.pos)).toBeLessThan(12);
  });

  it("off a raider ship, works the gunboat: stuns a nest of defenses, then shells it", () => {
    const state = createRaid(generateIsland(7, 8), ["rifleman", "heavy", "bazooka"], [], [], {
      artillery: 1,
      shock: 1,
      barrage: 1,
    });
    state.tactics = { bombards: true };
    state.energy = 30;
    // Put the raiders right by the nearest pair of defenses.
    const defenses = state.buildings.filter((b) => BUILDINGS[b.type].attack);
    const [a, b] = [...defenses].sort((x, y) => distance(x.pos, y.pos) - distance(y.pos, x.pos));
    if (!a || !b) throw new Error("no defenses");
    for (const h of state.heroes) h.pos = vec(a.pos.x + 12, a.pos.y);
    const fired: string[] = [];
    for (let t = 0; t < 8; t += DT) {
      stepRaid(
        state,
        state.heroes.map((_, i) => squadInput(state, i)),
        DT,
      );
      for (const e of state.events) if (e.type === "boatFire") fired.push(e.ability);
    }
    expect(fired.length).toBeGreaterThan(0);
    expect(fired).not.toContain("heal");
    // Whoever took the radio has let it go again by the end.
    expect(state.heroes.some((h) => h.inBoat)).toBe(state.boat.occupant !== null);
  });

  it("off a raider ship, keeps moving round a defense rather than standing in its sights", () => {
    const moved = (tactics: boolean) => {
      // One defense in open ground, and a raider within reach of it, between it and the beach.
      const layout = generateIsland(7, 4);
      const tower = layout.buildings.find((b) => BUILDINGS[b.type].attack);
      if (!tower) throw new Error("no defense");
      const state = createRaid({ ...layout, buildings: [tower], obstacles: [], mines: [] }, [
        "rifleman",
      ]);
      state.tactics = tactics ? { bombards: false } : null;
      // Nothing for the gunboat, so the lone raider stays on its feet.
      state.energy = 0;
      const target = state.buildings[0];
      if (!target) throw new Error("no defense");
      const h = hero(state, 0);
      const toBeach = normalize(sub(layout.spawn, target.pos));
      h.pos = add(target.pos, scale(toBeach, 10));
      let walked = 0;
      for (let t = 0; t < 2; t += DT) {
        const before = { ...h.pos };
        stepRaid(state, [squadInput(state, 0)], DT);
        walked += distance(before, h.pos);
      }
      return walked;
    };
    expect(moved(false)).toBeLessThan(0.1);
    expect(moved(true)).toBeGreaterThan(1);
  });
});
