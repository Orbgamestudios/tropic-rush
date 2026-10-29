import { describe, expect, it } from "vitest";
import { BUILDINGS } from "./buildings";
import { abilityCost, START_ENERGY } from "./gunboat";
import type { HeroKind } from "./heroes";
import { generateIsland, type IslandLayout, isOnLand, type PlacedBuilding } from "./island";
import {
  createRaid,
  destructionPercent,
  type HeroInput,
  IDLE_INPUT,
  type RaidState,
  stepRaid,
} from "./raid";
import { distance, normalize, sub, type Vec2, vec } from "./vec";

const DT = 1 / 60;

function layout(buildings: PlacedBuilding[], extra: Partial<IslandLayout> = {}): IslandLayout {
  return {
    seed: 1,
    level: 1,
    buildings,
    obstacles: [],
    decor: [],
    mines: [],
    spawn: vec(0, 0),
    boat: vec(0, 3),
    boatExit: vec(0, 2),
    ...extra,
  };
}

function raid(
  buildings: PlacedBuilding[],
  heroes: HeroKind[] = ["rifleman"],
  extra = {},
): RaidState {
  return createRaid(layout(buildings, extra), heroes);
}

function input(partial: Partial<HeroInput>): HeroInput {
  return { ...IDLE_INPUT, ...partial };
}

function run(state: RaidState, seconds: number, inputs: (HeroInput | undefined)[] = []): void {
  for (let t = 0; t < seconds; t += DT) stepRaid(state, inputs, DT);
}

function hero(state: RaidState, i = 0) {
  const h = state.heroes[i];
  if (!h) throw new Error(`no hero ${i}`);
  return h;
}

function building(state: RaidState, i = 0) {
  const b = state.buildings[i];
  if (!b) throw new Error(`no building ${i}`);
  return b;
}

describe("raid movement", () => {
  it("moves heroes and keeps them out of buildings", () => {
    const state = raid([{ type: "headquarters", pos: vec(0, -10) }]);
    run(state, 3, [input({ move: vec(0, -1) })]);
    const h = hero(state);
    expect(h.pos.y).toBeLessThan(-0.5);
    expect(distance(h.pos, vec(0, -10))).toBeGreaterThanOrEqual(
      BUILDINGS.headquarters.radius + 0.5,
    );
  });

  it("keeps heroes on the island", () => {
    const state = raid([], ["rifleman"], { spawn: vec(0, 55) });
    run(state, 6, [input({ move: vec(0, 1) })]);
    const { pos } = hero(state);
    expect(isOnLand(pos.x, pos.y, 0.3)).toBe(true);
  });
});

describe("raid combat", () => {
  it("lets heroes destroy buildings for energy, and wins when the HQ falls", () => {
    const state = raid([
      { type: "storehouse", pos: vec(0, -8) },
      { type: "headquarters", pos: vec(0, -20) },
    ]);
    const aimNorth = [input({ aim: vec(0, -1) })];
    run(state, 15, aimNorth);
    expect(building(state, 0).destroyed).toBe(true);
    expect(state.energy).toBe(START_ENERGY + BUILDINGS.storehouse.energy);
    expect(state.status).toBe("playing");
    run(state, 60, aimNorth);
    expect(building(state, 1).destroyed).toBe(true);
    expect(state.status).toBe("won");
    expect(destructionPercent(state)).toBe(100);
  });

  it("has defenses shoot heroes in range, but not out of range", () => {
    const near = raid([{ type: "gunTurret", pos: vec(0, -10) }]);
    run(near, 3);
    expect(hero(near).hp).toBeLessThan(hero(near).maxHp);

    const far = raid([{ type: "gunTurret", pos: vec(0, -22) }]);
    run(far, 3);
    expect(hero(far).hp).toBe(hero(far).maxHp);
  });

  it("gives the mortar a blind spot up close", () => {
    const close = raid([{ type: "mortar", pos: vec(0, -4) }]);
    run(close, 8);
    expect(hero(close).hp).toBe(hero(close).maxHp);

    const inRange = raid([{ type: "mortar", pos: vec(0, -15) }]);
    run(inRange, 8);
    expect(hero(inRange).hp).toBeLessThan(hero(inRange).maxHp);
  });

  it("can't target heroes hidden in smoke", () => {
    const state = raid([{ type: "gunTurret", pos: vec(0, -10) }], ["grenadier"]);
    hero(state).superCharge = 1;
    stepRaid(state, [input({ useSuper: true })], DT);
    run(state, 3);
    expect(hero(state).hp).toBe(hero(state).maxHp);
  });

  it("does not respawn a fallen hero, and a fallen solo crew loses", () => {
    const state = raid([{ type: "gunTurret", pos: vec(0, -8) }]);
    hero(state).hp = 1;
    run(state, 3);
    expect(hero(state).alive).toBe(false);
    expect(state.status).toBe("lost");
    expect(state.lostReason).toBe("crew");
  });

  it("loses when time runs out", () => {
    const state = raid([{ type: "headquarters", pos: vec(0, -30) }]);
    state.timeLimit = 1;
    run(state, 1.5);
    expect(state.status).toBe("lost");
    expect(state.lostReason).toBe("time");
  });

  it("sets off a mine when a hero steps on it", () => {
    const state = raid([], ["rifleman"], { mines: [vec(0, -2)] });
    run(state, 2, [input({ move: vec(0, -1) })]);
    expect(state.mines[0]?.exploded).toBe(true);
    expect(hero(state).hp).toBeLessThan(hero(state).maxHp);
  });

  it("lets explosions clear mines safely", () => {
    const state = raid([], ["grenadier"], { mines: [vec(0, -9)] });
    run(state, 2, [input({ aim: vec(0, -9 / 14) })]);
    expect(state.mines[0]?.exploded).toBe(true);
    expect(hero(state).hp).toBe(hero(state).maxHp);
  });
});

describe("supers", () => {
  it("charge from damage dealt", () => {
    const state = raid([{ type: "headquarters", pos: vec(0, -10) }]);
    run(state, 3, [input({ aim: vec(0, -1) })]);
    expect(hero(state).superCharge).toBeGreaterThan(0);
  });

  it("fire once full and empty the meter", () => {
    const state = raid([], ["rifleman", "heavy"]);
    hero(state, 0).superCharge = 1;
    hero(state, 1).superCharge = 1;
    stepRaid(state, [input({ useSuper: true }), input({ useSuper: true })], DT);
    expect(hero(state, 0).sprintTime).toBeGreaterThan(0);
    expect(hero(state, 0).superCharge).toBe(0);
    expect(state.obstacles.filter((o) => o.kind === "sandbag").length).toBeGreaterThan(0);
    run(state, 13);
    expect(state.obstacles).toHaveLength(0);
  });
});

describe("the gunboat", () => {
  it("has one seat and must be reached first", () => {
    const state = raid([], ["rifleman", "heavy"], { spawn: vec(0, 1) });
    const board = input({ toggleBoat: true });
    stepRaid(state, [board, board], DT);
    expect(hero(state, 0).inBoat).toBe(true);
    expect(hero(state, 1).inBoat).toBe(false);
    expect(state.boat.occupant).toBe(hero(state, 0).id);

    const far = raid([], ["rifleman"], { spawn: vec(0, -20) });
    stepRaid(far, [board], DT);
    expect(hero(far).inBoat).toBe(false);
  });

  it("keeps the hero in it safe and drops them back on the beach", () => {
    const state = raid([{ type: "gunTurret", pos: vec(0, -6) }]);
    stepRaid(state, [input({ toggleBoat: true })], DT);
    run(state, 3);
    expect(hero(state).hp).toBe(hero(state).maxHp);
    stepRaid(state, [input({ toggleBoat: true })], DT);
    expect(hero(state).inBoat).toBe(false);
    expect(hero(state).pos).toEqual(vec(0, 2));
  });

  it("spends escalating energy on abilities and refuses when short", () => {
    const state = raid([{ type: "storehouse", pos: vec(0, -10) }]);
    stepRaid(state, [input({ toggleBoat: true })], DT);
    const fire = (ability: "artillery" | "barrage" | "heal") =>
      stepRaid(state, [input({ boatAbility: { ability, target: vec(0, -10) } })], DT);

    fire("artillery");
    expect(state.energy).toBe(START_ENERGY - abilityCost("artillery", 0));
    fire("barrage");
    const left = state.energy;
    expect(left).toBe(START_ENERGY - abilityCost("artillery", 0) - abilityCost("barrage", 0));
    fire("heal");
    expect(left).toBeLessThan(abilityCost("heal", 0));
    expect(state.energy).toBe(left);
    expect(state.zones).toHaveLength(0);

    run(state, 4);
    expect(building(state).hp).toBeLessThan(building(state).maxHp);
  });
});

/** True if a rock or sandbag sits on the straight line between two points. */
function lineBlocked(state: RaidState, from: Vec2, to: Vec2): boolean {
  const d = sub(to, from);
  const len2 = d.x * d.x + d.y * d.y;
  return state.obstacles.some((o) => {
    if (!o.blocksShots) return false;
    const t = Math.max(
      0,
      Math.min(1, ((o.pos.x - from.x) * d.x + (o.pos.y - from.y) * d.y) / len2),
    );
    return distance(o.pos, vec(from.x + d.x * t, from.y + d.y * t)) <= o.radius + 0.15;
  });
}

// A simple bot: walk towards the nearest defense (then anything else, then the HQ) and shoot,
// stepping sideways around cover that blocks its shots, the way a player would.
function botInput(state: RaidState): HeroInput {
  const h = hero(state);
  const alive = state.buildings.filter((b) => !b.destroyed);
  const defenses = alive.filter((b) => BUILDINGS[b.type].attack);
  const others = alive.filter((b) => !BUILDINGS[b.type].attack && b.type !== "headquarters");
  const pool = defenses.length ? defenses : others.length ? others : alive;
  const target = pool.reduce<(typeof pool)[number] | undefined>(
    (best, b) => (!best || distance(h.pos, b.pos) < distance(h.pos, best.pos) ? b : best),
    undefined,
  );
  if (!target) return IDLE_INPUT;
  const toTarget: Vec2 = sub(target.pos, h.pos);
  const dir = normalize(toTarget);
  const inRange = distance(h.pos, target.pos) - target.radius < 12;
  if (!inRange) return input({ move: dir });
  if (lineBlocked(state, h.pos, target.pos))
    return input({ move: vec(-dir.y + dir.x * 0.3, dir.x + dir.y * 0.3) });
  return input({ aim: dir });
}

describe("balance", () => {
  it("lets a solo rifleman beat a level 1 island", () => {
    let wins = 0;
    for (const seed of [1, 2, 3]) {
      const state = createRaid(generateIsland(seed, 1), ["rifleman"]);
      for (let t = 0; t < 300 && state.status === "playing"; t += DT)
        stepRaid(state, [botInput(state)], DT);
      if (state.status === "won") wins++;
    }
    expect(wins).toBeGreaterThanOrEqual(2);
  });
});
