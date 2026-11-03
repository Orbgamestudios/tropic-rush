import { describe, expect, it } from "vitest";
import { BUILDINGS } from "./buildings";
import { TILE } from "./crewIsland";
import { generateIsland } from "./enemyBase";
import { type Ability, abilityCost, SHOCK, SMOKE, START_ENERGY } from "./gunboat";
import { HEROES, type HeroKind } from "./heroes";
import { type HeroMods, heroMods, heroTree, NO_MODS } from "./heroTrees";
import { type IslandLayout, isOnLand, type PlacedBuilding } from "./island";
import { archetypeFor } from "./islandShapes";
import {
  aimStretch,
  createRaid,
  destructionPercent,
  type HeroInput,
  IDLE_INPUT,
  type RaidState,
  SPRINT,
  stepRaid,
} from "./raid";
import { distance, normalize, scale, sub, type Vec2, vec } from "./vec";

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

describe("aiming and locking on", () => {
  it("doesn't fire while aiming, then locks on and keeps firing after letting go", () => {
    const state = raid([
      { type: "storehouse", pos: vec(0, -10) },
      { type: "headquarters", pos: vec(30, -40) },
    ]);
    const store = building(state, 0);
    run(state, 1, [input({ aimPreview: vec(0, -1) })]);
    expect(store.hp).toBe(store.maxHp);
    stepRaid(state, [input({ lockAt: vec(0.1, -1) })], DT);
    expect(hero(state).targetId).toBe(store.id);
    run(state, 2);
    expect(store.hp).toBeLessThan(store.maxHp);
    run(state, 20);
    expect(store.destroyed).toBe(true);
    expect(hero(state).targetId).toBeNull();
  });

  it("stops firing when the hero walks out of range", () => {
    const state = raid([{ type: "storehouse", pos: vec(0, -17) }]);
    stepRaid(state, [input({ lockAt: vec(0, -1) })], DT);
    expect(hero(state).targetId).not.toBeNull();
    run(state, 4, [input({ move: vec(0, 1) })]);
    expect(hero(state).targetId).toBeNull();
    expect(hero(state).firing).toBe(false);
  });

  it("taps lock onto the nearest tower, and a second tap stops", () => {
    const state = raid([
      { type: "storehouse", pos: vec(0, -5) },
      { type: "gunTurret", pos: vec(0, 11) },
    ]);
    stepRaid(state, [input({ autoAim: true })], DT);
    // The tower wins over the nearer storehouse.
    expect(hero(state).targetId).toBe(building(state, 1).id);
    stepRaid(state, [input({ autoAim: true })], DT);
    expect(hero(state).targetId).toBeNull();
  });

  it("retargets when the player aims at another building", () => {
    const state = raid([
      { type: "storehouse", pos: vec(-8, -8) },
      { type: "storehouse", pos: vec(8, -8) },
    ]);
    stepRaid(state, [input({ lockAt: vec(-1, -1) })], DT);
    expect(hero(state).targetId).toBe(building(state, 0).id);
    stepRaid(state, [input({ lockAt: vec(1, -1) })], DT);
    expect(hero(state).targetId).toBe(building(state, 1).id);
  });

  it("holds fire when the player lets go with nothing in the arc", () => {
    const state = raid([{ type: "storehouse", pos: vec(0, -10) }]);
    stepRaid(state, [input({ lockAt: vec(0, 1) })], DT);
    expect(hero(state).targetId).toBeNull();
    run(state, 1);
    expect(hero(state).firing).toBe(false);
    expect(state.projectiles).toHaveLength(0);
  });

  it("still lets a medic throw a bottle at her own feet", () => {
    const state = raid([], ["medic"]);
    stepRaid(state, [input({ lockAt: vec(0, -0.1) })], DT);
    run(state, 0.3);
    expect(hero(state).firing).toBe(true);
  });

  it("slows heroes to a crawl while they aim or fire", () => {
    const free = raid([]);
    const aiming = raid([]);
    const firing = raid([]);
    run(free, 1, [input({ move: vec(1, 0) })]);
    run(aiming, 1, [input({ move: vec(1, 0), aimPreview: vec(0, -1) })]);
    run(firing, 1, [input({ move: vec(1, 0), aim: vec(0, -1) })]);
    expect(hero(aiming).pos.x).toBeLessThan(hero(free).pos.x * 0.25);
    expect(hero(firing).pos.x).toBeLessThan(hero(free).pos.x * 0.25);
  });
});

describe("aiming on the move", () => {
  const north = vec(0, -1);
  /** How far off the aim each shot goes, in radians. */
  const strays = (kind: HeroKind, moving: boolean) => {
    const state = raid([], [kind]);
    const found = new Set<number>();
    for (let t = 0; t < 30; t += DT) {
      stepRaid(state, [input({ aim: north, move: moving ? vec(0.01, 0.06) : vec(0, 0) })], DT);
      for (const e of state.events) {
        if (e.type === "shot") found.add(Math.atan2(e.dir.x, -e.dir.y));
      }
      hero(state).pos = vec(0, 0);
    }
    return Math.max(...[...found].map(Math.abs));
  };

  it("eases off a hero's accuracy as they move, and brings it back as they stop", () => {
    const state = raid([]);
    run(state, 0.1, [input({ move: vec(1, 0) })]);
    const partway = hero(state).unsteady;
    expect(partway).toBeGreaterThan(0);
    expect(partway).toBeLessThan(1);
    run(state, 1, [input({ move: vec(1, 0) })]);
    expect(hero(state).unsteady).toBe(1);
    run(state, 0.1);
    expect(hero(state).unsteady).toBeLessThan(1);
    expect(hero(state).unsteady).toBeGreaterThan(0);
    run(state, 1);
    expect(hero(state).unsteady).toBe(0);
  });

  it("spreads shots about two thirds wider on the move", () => {
    const still = strays("heavy", false);
    const moving = strays("heavy", true);
    expect(moving).toBeGreaterThan(still * 1.4);
    expect(moving).toBeLessThanOrEqual(0.1 * 1.66 + 1e-6);
  });

  it("drops a throw on the mark standing still, and scatters it long and wide on the move", () => {
    const landings = (moving: boolean) => {
      const state = raid([], ["grenadier"]);
      const spots: Vec2[] = [];
      for (let t = 0; t < 40; t += DT) {
        stepRaid(
          state,
          [input({ aim: scale(north, 0.5), move: moving ? vec(0.1, 0) : vec(0, 0) })],
          DT,
        );
        hero(state).pos = vec(0, 0);
        for (const p of state.projectiles) {
          if (p.lob && p.lob.t <= DT * 1.5) spots.push(p.lob.to);
        }
      }
      return spots;
    };
    for (const spot of landings(false)) {
      expect(spot.x).toBeCloseTo(0);
      expect(spot.y).toBeCloseTo(-9.3);
    }
    const scattered = landings(true);
    const across = scattered.map((s) => s.x);
    const along = scattered.map((s) => s.y);
    expect(Math.max(...across) - Math.min(...across)).toBeGreaterThan(1);
    expect(Math.max(...along) - Math.min(...along)).toBeGreaterThan(1);
  });

  it("gives the Grenadier a third more range", () => {
    expect(HEROES.grenadier.attack.range).toBeCloseTo(14 * 1.33, 1);
  });

  it("draws the aim cone wider on the move, and longer too for a thrower", () => {
    const rifle = raid([], ["rifleman"]);
    expect(aimStretch(hero(rifle))).toEqual({ width: 1, length: 1 });
    hero(rifle).unsteady = 1;
    expect(aimStretch(hero(rifle)).width).toBeCloseTo(1.66);
    const grenadier = raid([], ["grenadier"]);
    hero(grenadier).unsteady = 1;
    const { width, length } = aimStretch(hero(grenadier));
    expect(width).toBeGreaterThan(1.66);
    expect(length).toBeGreaterThan(1);
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

  it("chips the headquarters with each building that falls, but leaves it the last blow", () => {
    const state = raid([
      { type: "storehouse", pos: vec(0, -8) },
      { type: "storehouse", pos: vec(2, -8) },
      { type: "headquarters", pos: vec(0, -30) },
    ]);
    const hq = building(state, 2);
    building(state, 0).hp = 1;
    run(state, 2, [input({ aim: vec(0, -1) })]);
    expect(building(state, 0).destroyed).toBe(true);
    expect(hq.hp).toBeCloseTo(hq.maxHp * 0.96);
    hq.hp = hq.maxHp * 0.11;
    building(state, 1).hp = 1;
    run(state, 2, [input({ aim: vec(0.2, -1) })]);
    expect(building(state, 1).destroyed).toBe(true);
    expect(hq.hp).toBeCloseTo(hq.maxHp * 0.1);
    expect(hq.destroyed).toBe(false);
  });

  it("takes the whole base with the headquarters, one building at a time, for its loot", () => {
    const state = raid([
      { type: "headquarters", pos: vec(0, -6) },
      { type: "gunTurret", pos: vec(6, -14) },
      { type: "goldMine", pos: vec(-6, -14) },
      { type: "goldVault", pos: vec(0, -22) },
    ]);
    const hq = building(state, 0);
    hq.hp = 1;
    run(state, 0.6, [input({ aim: vec(0, -1) })]);
    expect(hq.destroyed).toBe(true);
    expect(state.status).toBe("playing");
    expect(state.conquest).not.toBeNull();
    expect(destructionPercent(state)).toBe(25);
    // The guns fall silent, and nobody can be hurt now.
    const { hp } = hero(state);
    run(state, 1, [input({ move: vec(1, 0) })]);
    expect(hero(state).hp).toBe(hp);
    expect(hero(state).moving).toBe(false);
    for (let t = 0; t < 12 && state.status === "playing"; t += DT) stepRaid(state, [], DT);
    expect(state.status).toBe("won");
    expect(destructionPercent(state)).toBe(100);
    expect(state.loot.gold).toBeGreaterThan(0);
  });

  it("can't lose once the base is taken", () => {
    const state = raid([
      { type: "headquarters", pos: vec(0, -6) },
      { type: "goldMine", pos: vec(-6, -14) },
    ]);
    building(state, 0).hp = 1;
    state.timeLimit = 0.5;
    run(state, 0.4, [input({ aim: vec(0, -1) })]);
    run(state, 12);
    expect(state.status).toBe("won");
  });

  it("has defenses shoot heroes in range, but not out of range", () => {
    const near = raid([{ type: "gunTurret", pos: vec(0, -10) }]);
    run(near, 3);
    expect(hero(near).hp).toBeLessThan(hero(near).maxHp);

    const far = raid([{ type: "gunTurret", pos: vec(0, -30) }]);
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
    run(state, 2, [input({ aim: vec(0, -9 / 18.6) })]);
    expect(state.mines[0]?.exploded).toBe(true);
    expect(hero(state).hp).toBe(hero(state).maxHp);
  });
});

describe("sprinting", () => {
  const north = vec(0, -1);

  it("is a little quicker for as long as it's held, then runs out", () => {
    const walking = raid([]);
    const sprinting = raid([]);
    run(walking, 1, [input({ move: north })]);
    run(sprinting, 1, [input({ move: north, sprint: true })]);
    const ratio = hero(sprinting).pos.y / hero(walking).pos.y;
    expect(ratio).toBeCloseTo(SPRINT.speed, 1);
    run(sprinting, SPRINT.seconds, [input({ move: north, sprint: true })]);
    expect(hero(sprinting).sprinting).toBe(false);
  });

  it("stops the moment it's let go, keeping what's left of it", () => {
    const state = raid([]);
    run(state, 1, [input({ move: north, sprint: true })]);
    stepRaid(state, [input({ move: north })], DT);
    expect(hero(state).sprinting).toBe(false);
    expect(hero(state).sprintLeft).toBeCloseTo(SPRINT.seconds - 1, 1);
    run(state, 0.5, [input({ move: north, sprint: true })]);
    expect(hero(state).sprinting).toBe(true);
  });

  it("doesn't go anywhere standing still", () => {
    const state = raid([]);
    run(state, 1, [input({ sprint: true })]);
    expect(hero(state).sprinting).toBe(false);
    expect(hero(state).sprintLeft).toBe(SPRINT.seconds);
  });

  it("can shoot on the run, with the aim all over the place", () => {
    const walking = raid([]);
    const sprinting = raid([]);
    run(walking, 1, [input({ move: north, aim: north })]);
    run(sprinting, 1, [input({ move: north, aim: north, sprint: true })]);
    expect(hero(sprinting).sprinting).toBe(true);
    expect(aimStretch(hero(sprinting)).width).toBeGreaterThan(aimStretch(hero(walking)).width * 2);
    expect(hero(sprinting).pos.y).toBeLessThan(hero(walking).pos.y * 2);
  });

  it("refills slowly, and won't start again on the last drop", () => {
    const state = raid([]);
    run(state, SPRINT.seconds + 0.5, [input({ move: north, sprint: true })]);
    expect(hero(state).sprinting).toBe(false);
    const tillReady = (SPRINT.least / SPRINT.seconds) * SPRINT.recharge;
    run(state, tillReady - 1, [input({ move: north })]);
    stepRaid(state, [input({ move: north, sprint: true })], DT);
    expect(hero(state).sprinting).toBe(false);
    run(state, 1, [input({ move: north })]);
    stepRaid(state, [input({ move: north, sprint: true })], DT);
    expect(hero(state).sprinting).toBe(true);
    run(state, SPRINT.recharge + 1);
    expect(hero(state).sprintLeft).toBe(SPRINT.seconds);
  });
});

describe("the gunboat's weapons", () => {
  const fire = (state: RaidState, ability: Ability, target = vec(0, -10)) => {
    stepRaid(state, [input({ toggleBoat: true })], DT);
    stepRaid(state, [input({ boatAbility: { ability, target } })], DT);
  };
  const noWeapons = (state: RaidState) => {
    state.buildings.forEach((b) => {
      b.reload = 0;
    });
  };
  const landed = (state: RaidState) => {
    for (let t = 0; t < 4 && state.zones.length === 0; t += DT) stepRaid(state, [], DT);
  };

  it("only fires what the crew has researched", () => {
    const state = createRaid(layout([]), ["rifleman"], [], [], { artillery: 1 });
    fire(state, "smoke");
    expect(state.energy).toBe(START_ENERGY);
    expect(state.abilityUses.smoke).toBe(0);
  });

  it("hits harder and lasts longer at higher levels", () => {
    const shock = createRaid(layout([]), ["rifleman"], [], [], { shock: 3 });
    fire(shock, "shock", vec(0, -8));
    landed(shock);
    expect(shock.zones[0]?.time).toBeGreaterThan(SHOCK.seconds + 0.8);
    const smoke = createRaid(layout([]), ["rifleman"], [], [], { smoke: 4 });
    fire(smoke, "smoke", vec(0, -8));
    landed(smoke);
    expect(smoke.zones[0]?.time).toBeGreaterThan(SMOKE.seconds + 4);
  });

  it("is 6 tiles across, either way", () => {
    expect(SHOCK.radius * 2).toBe(6 * TILE);
    expect(SMOKE.radius * 2).toBe(6 * TILE);
  });

  it("stuns the defenses in a shock circle for 4 seconds, and no longer", () => {
    const state = raid([{ type: "gunTurret", pos: vec(0, -8) }]);
    fire(state, "shock", vec(0, -8));
    landed(state);
    expect(state.zones[0]?.kind).toBe("shock");
    hero(state).hp = hero(state).maxHp;
    const before = state.projectiles.filter((p) => p.team === "enemy").length;
    noWeapons(state);
    run(state, SHOCK.seconds - 0.1);
    expect(state.projectiles.filter((p) => p.team === "enemy").length).toBeLessThanOrEqual(before);
    expect(state.zones).toHaveLength(1);
    run(state, 0.3);
    expect(state.zones).toHaveLength(0);
    run(state, 2);
    expect(hero(state).hp).toBeLessThan(hero(state).maxHp);
  });

  it("leaves defenses outside the circle alone", () => {
    const state = raid([{ type: "gunTurret", pos: vec(0, -8) }]);
    fire(state, "shock", vec(30, 30));
    run(state, 3);
    expect(hero(state).hp).toBeLessThan(hero(state).maxHp);
  });

  it("hides heroes in a smokescreen for 10 seconds", () => {
    const state = raid([{ type: "gunTurret", pos: vec(0, -8) }]);
    fire(state, "smoke", hero(state).pos);
    landed(state);
    expect(state.zones[0]?.kind).toBe("smoke");
    expect(state.zones[0]?.time).toBeGreaterThan(SMOKE.seconds - 0.2);
    run(state, 1);
    const { hp } = hero(state);
    run(state, SMOKE.seconds - 2);
    expect(hero(state).hp).toBe(hp);
    run(state, 4);
    expect(hero(state).hp).toBeLessThan(hp);
  });
});

describe("the gunboat", () => {
  it("keeps firing at what the hero's locked onto, and takes no new target", () => {
    const state = raid([
      { type: "storehouse", pos: vec(0, -10) },
      { type: "storehouse", pos: vec(10, 0) },
    ]);
    const [store, other] = [building(state, 0), building(state, 1)];
    stepRaid(state, [input({ lockAt: vec(0, -1) })], DT);
    stepRaid(state, [input({ toggleBoat: true })], DT);
    expect(hero(state).inBoat).toBe(true);
    stepRaid(state, [input({ lockAt: vec(1, 0) })], DT);
    expect(hero(state).targetId).toBe(store.id);
    run(state, 3);
    expect(hero(state).firing).toBe(true);
    expect(store.hp).toBeLessThan(store.maxHp);
    expect(other.hp).toBe(other.maxHp);
  });

  it("answers one hero at a time, from anywhere on the island", () => {
    const state = raid([], ["rifleman", "heavy"], { spawn: vec(0, -30) });
    const open = input({ toggleBoat: true });
    stepRaid(state, [open, open], DT);
    expect(hero(state, 0).inBoat).toBe(true);
    expect(hero(state, 1).inBoat).toBe(false);
    expect(state.boat.occupant).toBe(hero(state, 0).id);
  });

  it("leaves the hero standing where they are, still in the line of fire", () => {
    const state = raid([{ type: "gunTurret", pos: vec(0, -6) }]);
    const { pos } = hero(state);
    stepRaid(state, [input({ toggleBoat: true })], DT);
    run(state, 3, [input({ move: vec(1, 0) })]);
    expect(hero(state).pos).toEqual(pos);
    expect(hero(state).hp).toBeLessThan(hero(state).maxHp);
    stepRaid(state, [input({ toggleBoat: true })], DT);
    expect(hero(state).inBoat).toBe(false);
    expect(hero(state).pos).toEqual(pos);
  });

  it("is free for someone else once the hero calling it falls", () => {
    const state = raid([{ type: "gunTurret", pos: vec(0, -6) }]);
    stepRaid(state, [input({ toggleBoat: true })], DT);
    hero(state).hp = 1;
    run(state, 3);
    expect(hero(state).alive).toBe(false);
    expect(hero(state).inBoat).toBe(false);
    expect(state.boat.occupant).toBeNull();
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

describe("the medic", () => {
  it("throws a bottle that heals crewmates where it lands, and locks onto them", () => {
    const state = raid([], ["medic", "rifleman"]);
    const patient = hero(state, 1);
    patient.pos = vec(9, 0);
    patient.hp = 100;
    stepRaid(state, [input({ lockAt: vec(1, 0) })], DT);
    expect(hero(state).patientId).toBe(patient.id);
    run(state, 1.5);
    expect(patient.hp).toBeGreaterThan(100);
  });

  it("never hurts a building", () => {
    const state = raid([{ type: "storehouse", pos: vec(0, -8) }], ["medic"]);
    run(state, 5, [input({ aim: vec(0, -0.5) })]);
    expect(building(state).hp).toBe(building(state).maxHp);
  });

  it("has no buildings to lock onto", () => {
    const state = raid([{ type: "gunTurret", pos: vec(0, -6) }], ["medic"]);
    stepRaid(state, [input({ lockAt: vec(0, -1) })], DT);
    expect(hero(state).targetId).toBeNull();
  });

  it("can heal herself by throwing at her own feet", () => {
    const state = raid([], ["medic"]);
    hero(state).hp = 100;
    run(state, 2, [input({ aim: vec(0, 0.16) })]);
    expect(hero(state).hp).toBeGreaterThan(100);
  });
});

describe("loot", () => {
  it("pays out materials for mills and storages, and nothing for defenses", () => {
    const state = raid([
      { type: "lumberCamp", pos: vec(0, -7), level: 3 },
      { type: "goldVault", pos: vec(-7, 0), level: 1 },
      { type: "gunTurret", pos: vec(7, 0) },
    ]);
    for (const b of state.buildings) b.hp = 1;
    run(state, 8, [input({ aim: vec(0, -1) })]);
    expect(building(state, 0).destroyed).toBe(true);
    expect(state.loot.timber).toBeGreaterThan(120);
    run(state, 8, [input({ aim: vec(-1, 0) })]);
    expect(building(state, 1).destroyed).toBe(true);
    expect(state.loot.gold).toBe(300);
  });
});

/** True if a rock sits on the straight line between two points. */
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
  // Anything about to land nearby comes first, the way a player would run from it.
  const shell = state.projectiles.find(
    (p) => p.team === "enemy" && p.lob && distance(p.lob.to, h.pos) < 6.5,
  );
  if (shell?.lob) {
    const close = distance(shell.lob.to, h.pos) < 0.2;
    return input({ move: close ? vec(1, 0) : normalize(sub(h.pos, shell.lob.to)) });
  }
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
    // Defenses are meant to be a real threat: a plain bot wins some islands, not all of them.
    for (const seed of [1, 2, 3, 4, 5, 6, 7, 8]) {
      const state = createRaid(generateIsland(seed, 1), ["rifleman"]);
      for (let t = 0; t < 300 && state.status === "playing"; t += DT)
        stepRaid(state, [botInput(state)], DT);
      if (state.status === "won") wins++;
    }
    expect(wins).toBeGreaterThanOrEqual(3);
  });
});

describe("watchtowers", () => {
  const towerAt = (x: number, y: number): PlacedBuilding[] => [
    { type: "watchtower", pos: vec(x, y) },
    { type: "headquarters", pos: vec(70, -70) },
  ];

  it("hold their aim where everyone can see it, then fire one hard shot", () => {
    const state = raid(towerAt(0, -25));
    building(state).reload = 0;
    const atk = BUILDINGS.watchtower.attack;
    if (atk?.kind !== "sniper") throw new Error("not a sniper");
    run(state, 0.6);
    expect(building(state).sights).not.toBeNull();
    expect(state.projectiles).toHaveLength(0);
    const full = hero(state).hp;
    run(state, atk.aimTime);
    expect(building(state).sights).toBeNull();
    expect(hero(state).hp).toBe(full - atk.damage);
  });

  it("outrange every other direct-fire defense", () => {
    const reach = BUILDINGS.watchtower.attack?.range ?? 0;
    expect(reach).toBeGreaterThan(BUILDINGS.gunTurret.attack?.range ?? 0);
    expect(reach).toBeGreaterThan(BUILDINGS.harpoon.attack?.range ?? 0);
  });

  it("miss anyone who steps out of the way once the sights stop moving", () => {
    const state = raid(towerAt(0, -25));
    building(state).reload = 0;
    const atk = BUILDINGS.watchtower.attack;
    if (atk?.kind !== "sniper") throw new Error("not a sniper");
    run(state, atk.aimTime - 0.3);
    const full = hero(state).hp;
    run(state, 1, [input({ move: vec(1, 0) })]);
    expect(hero(state).hp).toBe(full);
  });

  it("lose their aim when nobody's left in range", () => {
    const state = raid(towerAt(0, -25));
    building(state).reload = 0;
    run(state, 0.3);
    expect(building(state).sights).not.toBeNull();
    hero(state).pos = vec(70, 40);
    run(state, 0.1);
    expect(building(state).sights).toBeNull();
    expect(building(state).aiming).toBe(0);
  });
});

describe("hero upgrades", () => {
  /** The ids of these upgrades, whatever comes before them. */
  function owned(kind: HeroKind, names: readonly string[]): string[] {
    return heroTree(kind)
      .filter((u) => names.includes(u.name))
      .map((u) => u.id);
  }

  function modsOf(kind: HeroKind, names: readonly string[]): HeroMods {
    return heroMods(kind, owned(kind, names));
  }

  /** Heroes with these upgrades on an island of these buildings. */
  function raided(
    kinds: HeroKind[],
    names: readonly string[],
    buildings: PlacedBuilding[],
    extra: Partial<IslandLayout> = {},
  ): RaidState {
    return createRaid(
      layout(buildings, extra),
      kinds,
      [],
      kinds.map((k) => modsOf(k, names)),
    );
  }

  const towers: PlacedBuilding[] = [
    { type: "storehouse", pos: vec(0, -8) },
    { type: "storehouse", pos: vec(7, -9) },
    { type: "storehouse", pos: vec(14, -9) },
    { type: "headquarters", pos: vec(40, -40) },
  ];
  const fire = (dir: Vec2) => input({ aim: normalize(dir) });
  const hurtBy = (state: RaidState, amount: number, heavyBonus = 1) => {
    const shot = { ...enemyShot(state), pos: { ...hero(state).pos }, damage: amount, heavyBonus };
    state.projectiles.push(shot);
    stepRaid(state, [], DT);
  };

  it("ricochets rifle bullets into the next building", () => {
    const damage = (names: string[]) => {
      const state = raided(["rifleman"], names, towers);
      run(state, 2, [fire(vec(0, -1))]);
      return building(state, 1).maxHp - building(state, 1).hp;
    };
    expect(damage([])).toBe(0);
    expect(damage(["Ricochet"])).toBeGreaterThan(0);
  });

  it("makes every 6th minigun round explode at full spin", () => {
    const blasts = (names: string[]) => {
      const state = raided(["heavy"], names, towers);
      let count = 0;
      for (let t = 0; t < 4; t += DT) {
        stepRaid(state, [fire(vec(0, -1))], DT);
        count += state.events.filter((e) => e.type === "explosion").length;
      }
      return count;
    };
    expect(blasts([])).toBe(0);
    expect(blasts(["Explosive Belt"])).toBeGreaterThan(0);
  });

  it("brings a fallen hero back twice a raid with Guardian Angel", () => {
    const save = (names: string[]) => {
      const state = raided(["rifleman", "medic"], names, []);
      let back = 0;
      const rifleman = hero(state, 0);
      for (let i = 0; i < 3 && rifleman.alive; i++) {
        state.projectiles.push({ ...enemyShot(state), pos: { ...rifleman.pos } });
        stepRaid(state, [], DT);
        if (rifleman.alive) back++;
      }
      return back;
    };
    expect(save([])).toBe(0);
    expect(save(["Guardian Angel"])).toBe(2);
  });

  it("scatters 5 bomblets from a rocket", () => {
    const grenades = (names: string[]) => {
      const state = raided(["bazooka"], names, towers);
      let most = 0;
      for (let t = 0; t < 1.5; t += DT) {
        stepRaid(state, [t < 0.05 ? fire(vec(0, -1)) : undefined], DT);
        most = Math.max(most, state.projectiles.filter((p) => p.kind === "grenade").length);
      }
      return most;
    };
    expect(grenades([])).toBe(0);
    expect(grenades(["Cluster Warhead"])).toBe(5);
  });

  it("skips a grenade on for two more blasts", () => {
    const blasts = (names: string[]) => {
      const state = raided(["grenadier"], names, towers);
      let count = 0;
      for (let t = 0; t < 3; t += DT) {
        stepRaid(state, [t < 0.05 ? fire(vec(0, -1)) : undefined], DT);
        count += state.events.filter((e) => e.type === "explosion").length;
      }
      return count;
    };
    expect(blasts([])).toBe(1);
    expect(blasts(["Skipping Stone"])).toBe(3);
  });

  it("turns what the Engineer destroys into a turret, with Salvage", () => {
    const turrets = (names: string[]) => {
      const state = raided(["engineer"], names, towers);
      building(state, 0).hp = 1;
      run(state, 1, [fire(vec(0, -1))]);
      return state.turrets;
    };
    expect(turrets([])).toHaveLength(0);
    expect(turrets(["Salvage"])).toHaveLength(1);
  });

  it("sends a shockwave out from what the Tank destroys", () => {
    const damage = (names: string[]) => {
      const state = raided(["tank"], names, [
        { type: "storehouse", pos: vec(0, -8) },
        { type: "storehouse", pos: vec(8, -8) },
        { type: "headquarters", pos: vec(40, -40) },
      ]);
      building(state, 0).hp = 1;
      run(state, 1, [fire(vec(0, -1))]);
      return building(state, 1).maxHp - building(state, 1).hp;
    };
    expect(damage([])).toBe(0);
    expect(damage(["Aftershock"])).toBeGreaterThan(0);
  });

  it("heals a hero who's kept out of trouble, with Field Dressing", () => {
    const state = raided(["rifleman"], ["Field Dressing"], []);
    const h = hero(state);
    h.hp = h.maxHp / 2;
    run(state, 3.5);
    expect(h.hp).toBe(h.maxHp / 2);
    run(state, 1.5);
    expect(h.hp).toBeGreaterThan(h.maxHp / 2);
  });

  it("makes a hero fiercer at the end of their rope, with Last Stand", () => {
    const shots = (names: string[]) => {
      const state = raided(["rifleman"], names, towers);
      hero(state).hp = hero(state).maxHp * 0.2;
      let count = 0;
      for (let t = 0; t < 4; t += DT) {
        stepRaid(state, [fire(vec(0, -1))], DT);
        count += state.events.filter((e) => e.type === "shot").length;
      }
      return count;
    };
    expect(shots(["Last Stand"])).toBeGreaterThan(shots([]));
    const state = raided(["rifleman"], ["Last Stand"], []);
    const h = hero(state);
    h.hp = h.maxHp * 0.2;
    const before = h.hp;
    hurtBy(state, 100);
    expect(before - h.hp).toBeCloseTo(75);
  });

  it("takes less from a blow in a Thick Vest", () => {
    const state = raided(["rifleman"], ["Thick Vest"], []);
    const h = hero(state);
    const before = h.hp;
    hurtBy(state, 100);
    expect(before - h.hp).toBeCloseTo(85);
  });

  it("keeps a hero moving while they fire, with Run and Gun", () => {
    const walked = (names: string[]) => {
      const state = raided(["rifleman"], names, towers);
      const start = hero(state).pos.x;
      run(state, 1, [input({ move: vec(1, 0), aim: vec(0, -1) })]);
      return hero(state).pos.x - start;
    };
    expect(walked(["Run and Gun"])).toBeGreaterThan(walked([]) * 1.5);
  });

  it("carries healing on after a bottle lands, with Lingering Dose", () => {
    const state = raided(["medic"], ["Lingering Dose"], []);
    run(state, 1.2, [input({ aim: vec(0.3, 0) })]);
    expect(state.zones.some((z) => z.kind === "heal")).toBe(true);
  });

  it("turns spare healing into a shield, up to a limit, with Overheal", () => {
    const state = raided(["medic", "rifleman"], ["Overheal"], []);
    const mate = hero(state, 1);
    mate.pos = { ...hero(state, 0).pos };
    run(state, 2, [input({ aim: vec(0.2, 0) })]);
    expect(mate.shield).toBeGreaterThan(0);
    expect(mate.shield).toBeLessThanOrEqual(mate.maxHp * 0.2);
    const before = mate.hp;
    state.projectiles.push({ ...enemyShot(state), pos: { ...mate.pos }, damage: 10 });
    stepRaid(state, [], DT);
    expect(mate.hp).toBe(before);
  });

  it("boosts healed crewmates with Ice Pack and Adrenaline", () => {
    const state = raided(["medic", "rifleman"], ["Ice Pack", "Adrenaline"], []);
    const mate = hero(state, 1);
    mate.pos = { ...hero(state, 0).pos };
    run(state, 1.2, [input({ aim: vec(0.2, 0) })]);
    expect(mate.iced).toBeGreaterThan(0);
    expect(mate.pumped).toBeGreaterThan(0);
    expect(hero(state, 0).iced).toBe(0);
  });

  it("makes every 5th bottle a big one, with Miracle Bottle", () => {
    const state = raided(["medic"], ["Miracle Bottle"], []);
    const sizes: number[] = [];
    for (let t = 0; t < 8; t += DT) {
      stepRaid(state, [input({ aim: vec(0.3, 0) })], DT);
      for (const e of state.events) if (e.type === "healBurst") sizes.push(e.radius);
    }
    expect(sizes[4]).toBeCloseTo((sizes[0] ?? 0) * 2);
  });

  it("speeds a long burst up with Overdrive", () => {
    const shots = (names: string[]) => {
      const state = raided(["heavy"], names, towers);
      let count = 0;
      for (let t = 0; t < 9; t += DT) {
        stepRaid(state, [fire(vec(0, -1))], DT);
        if (t > 6) count += state.events.filter((e) => e.type === "shot").length;
      }
      return count;
    };
    expect(shots(["Overdrive"])).toBeGreaterThan(shots([]));
  });

  it("shrugs harpoons off with Harpoon Hide", () => {
    const taken = (names: string[]) => {
      const state = raided(["heavy"], names, []);
      const h = hero(state);
      const before = h.hp;
      hurtBy(state, 100, 1.6);
      return before - h.hp;
    };
    expect(taken([])).toBeCloseTo(160);
    expect(taken(["Harpoon Hide"])).toBeCloseTo(100);
  });

  it("heals while firing with Iron Gut", () => {
    const state = raided(["heavy"], ["Iron Gut"], towers);
    const h = hero(state);
    h.hp = h.maxHp / 2;
    run(state, 2, [fire(vec(0, -1))]);
    expect(h.hp).toBeGreaterThan(h.maxHp / 2);
  });

  it("sends Big Mo berserk after 500 damage", () => {
    const state = raided(["heavy"], ["Berserk"], []);
    const h = hero(state);
    hurtBy(state, 300);
    expect(h.rage).toBe(0);
    hurtBy(state, 300);
    expect(h.rage).toBeGreaterThan(5);
  });

  it("fires two shells on every 4th shot with Twin Barrels", () => {
    const state = raided(["tank"], ["Twin Barrels"], towers);
    let most = 0;
    for (let t = 0; t < 8; t += DT) {
      stepRaid(state, [fire(vec(0, -1))], DT);
      most = Math.max(most, state.events.filter((e) => e.type === "shot").length);
    }
    expect(most).toBe(2);
  });

  it("repairs a still Tank, and sets it hard in Siege Mode", () => {
    const repaired = raided(["tank"], ["Field Repairs"], []);
    const h = hero(repaired);
    h.hp = h.maxHp / 2;
    run(repaired, 3);
    expect(h.hp).toBeGreaterThan(h.maxHp / 2);
    const dug = raided(["tank"], ["Siege Mode"], []);
    run(dug, 3);
    const before = hero(dug).hp;
    hurtBy(dug, 100);
    expect(before - hero(dug).hp).toBeCloseTo(60);
  });

  it("cuts blast damage with Reactive Armor, but not bullets", () => {
    const state = raided(["tank"], ["Reactive Armor"], [], {
      buildings: [],
    });
    const h = hero(state);
    const before = h.hp;
    state.projectiles.push({
      ...enemyShot(state),
      kind: "mortar",
      damage: 100,
      splash: 3,
      pos: { ...h.pos },
      vel: vec(0, 0),
      lob: { from: { ...h.pos }, to: { ...h.pos }, t: 1, duration: 1, peak: 1 },
    });
    stepRaid(state, [], DT);
    expect(before - h.hp).toBeCloseTo(80);
  });

  it("leaves fire burning where a rocket lands, with Napalm", () => {
    const state = raided(["bazooka"], ["Napalm"], towers);
    run(state, 1, [fire(vec(0, -1))]);
    expect(state.zones.some((z) => z.kind === "fire")).toBe(true);
    const after = building(state, 0).hp;
    run(state, 1);
    expect(building(state, 0).hp).toBeLessThan(after);
  });

  it("gets away quick after a shot, with Getaway", () => {
    const state = raided(["bazooka"], ["Getaway"], towers);
    run(state, 0.1, [fire(vec(0, -1))]);
    expect(hero(state).haste).toBeGreaterThan(1.5);
  });

  it("fires a second rocket straight after the first, with Double Tap", () => {
    const shots = (names: string[]) => {
      const state = raided(["bazooka"], names, towers);
      let count = 0;
      for (let t = 0; t < 1.5; t += DT) {
        stepRaid(state, [fire(vec(0, -1))], DT);
        count += state.events.filter((e) => e.type === "shot").length;
      }
      return count;
    };
    expect(shots([])).toBe(1);
    expect(shots(["Double Tap"])).toBe(2);
  });

  it("curves a guided rocket round cover to its target", () => {
    const rock = {
      kind: "rock" as const,
      pos: vec(0, -6),
      radius: 1.5,
      blocksShots: true,
      scale: 1,
      rotation: 0,
    };
    const hit = (names: string[]) => {
      const far: PlacedBuilding[] = [
        { type: "storehouse", pos: vec(0, -15) },
        { type: "headquarters", pos: vec(40, -40) },
      ];
      const state = raided(["bazooka"], names, far, { obstacles: [rock] });
      hero(state).targetId = building(state, 0).id;
      run(state, 2, [input({ aim: null })]);
      return building(state, 0).hp < building(state, 0).maxHp;
    };
    expect(hit([])).toBe(false);
    expect(hit(["Guided Rocket"])).toBe(true);
  });

  it("lands grenades sooner with Short Fuse", () => {
    const flight = (names: string[]) => {
      const state = raided(["grenadier"], names, towers);
      stepRaid(state, [fire(vec(0, -1))], DT);
      return state.projectiles[0]?.lob?.duration ?? 0;
    };
    expect(flight(["Short Fuse"])).toBeCloseTo(flight([]) * 0.6);
  });

  it("throws two on every 3rd go with Twin Grenades", () => {
    const state = raided(["grenadier"], ["Twin Grenades"], towers);
    let most = 0;
    for (let t = 0; t < 4.5; t += DT) {
      stepRaid(state, [fire(vec(0, -1))], DT);
      most = Math.max(most, state.events.filter((e) => e.type === "shot").length);
    }
    expect(most).toBe(2);
  });

  it("hides heroes in smoke, where defenses can't aim", () => {
    const turret: PlacedBuilding[] = [
      { type: "gunTurret", pos: vec(0, -10) },
      { type: "headquarters", pos: vec(40, -40) },
    ];
    const state = raided(["grenadier"], ["Smoke Shell"], turret);
    let smoked = false;
    for (let t = 0; t < 9 && !smoked; t += DT) {
      stepRaid(state, [fire(vec(0, 0.5))], DT);
      hero(state).hp = hero(state).maxHp;
      smoked = state.zones.some((z) => z.kind === "smoke");
    }
    expect(smoked).toBe(true);
    const zone = state.zones.find((z) => z.kind === "smoke");
    if (!zone) throw new Error("no smoke");
    hero(state).pos = { ...zone.pos };
    state.projectiles.length = 0;
    building(state, 0).firing = false;
    zone.time = 3;
    run(state, 1);
    expect(state.projectiles.filter((p) => p.team === "enemy")).toHaveLength(0);
  });

  it("sets mines off from further with Mine Sweeper", () => {
    const set = (names: string[]) => {
      const state = raided(["grenadier"], names, towers, { mines: [vec(0, -7)] });
      const blast = vec(0, -2);
      hero(state).pos = vec(0, 2);
      state.projectiles.push({
        ...enemyShot(state),
        kind: "grenade",
        team: "crew",
        ownerId: hero(state).id,
        damage: 1,
        splash: 3,
        lob: { from: blast, to: blast, t: 1, duration: 1, peak: 1 },
      });
      stepRaid(state, [], DT);
      return state.mines[0]?.fuse !== null;
    };
    expect(set([])).toBe(false);
    expect(set(["Mine Sweeper"])).toBe(true);
  });

  it("heals on a kill with Tea Break", () => {
    const state = raided(["grenadier"], ["Tea Break"], towers);
    const h = hero(state);
    h.hp = h.maxHp / 2;
    building(state, 0).hp = 1;
    run(state, 1.5, [input({ aim: vec(0, -0.3) })]);
    expect(h.hp).toBeGreaterThan(h.maxHp / 2);
  });

  it("drops a pocket turret, and a decoy that draws every gun", () => {
    const state = raided(
      ["engineer"],
      ["Pocket Turret", "Decoy Drone"],
      [
        { type: "gunTurret", pos: vec(0, -14) },
        { type: "headquarters", pos: vec(40, -40) },
      ],
    );
    for (let t = 0; t < 31; t += DT) {
      stepRaid(state, [], DT);
      hero(state).hp = hero(state).maxHp;
    }
    expect(state.turrets.map((t) => t.kind).sort()).toEqual(["decoy", "pocket"]);
    const decoy = state.turrets.find((t) => t.kind === "decoy");
    const aim = building(state, 0).aim;
    expect(decoy).toBeDefined();
    if (decoy) {
      const toDecoy = Math.atan2(decoy.pos.y - -14, decoy.pos.x);
      expect(aim).toBeCloseTo(toDecoy, 1);
    }
  });

  it("repairs the Tank and turrets nearby with Repair Beam", () => {
    const state = createRaid(
      layout([]),
      ["engineer", "tank"],
      [],
      [modsOf("engineer", ["Repair Beam"]), NO_MODS],
    );
    const tank = hero(state, 1);
    tank.pos = { ...hero(state, 0).pos };
    tank.hp = tank.maxHp / 2;
    run(state, 2);
    expect(tank.hp).toBeGreaterThan(tank.maxHp / 2);
  });

  it("turns up the turrets with Overclock", () => {
    const shots = (names: string[]) => {
      const state = raided(["engineer"], names, towers);
      state.turrets.push({
        id: 999,
        kind: "salvage",
        ownerId: hero(state).id,
        pos: vec(0, -2),
        hp: 900,
        maxHp: 900,
        time: 10,
        reload: 0,
        aim: 0,
      });
      let count = 0;
      for (let t = 0; t < 4; t += DT) {
        stepRaid(state, [], DT);
        count += state.events.filter((e) => e.type === "shot").length;
      }
      return count;
    };
    expect(shots(["Overclock"])).toBeGreaterThan(shots([]));
  });
});

describe("volcanoes", () => {
  function fireMountain(): RaidState {
    for (let seed = 1; seed < 400; seed++) {
      if (archetypeFor(seed, 8) !== "volcano") continue;
      return createRaid(generateIsland(seed, 8), ["rifleman"]);
    }
    throw new Error("no volcano");
  }

  it("burns whoever wades into the lava", () => {
    const state = fireMountain();
    const h = hero(state);
    const { shape } = state;
    let spot = null;
    for (let x = -120; x < 120 && !spot; x += 2) {
      for (let y = -120; y < 120 && !spot; y += 2) {
        if (shape.lava(x, y) > 0.9 && shape.shoreDistance(x, y) > 3) spot = vec(x, y);
      }
    }
    if (!spot) throw new Error("no lava");
    h.pos = spot;
    const before = h.hp;
    run(state, 0.5);
    expect(h.hp).toBeLessThan(before);
    expect(state.status).toBe("playing");
  });

  it("goes off now and then, throwing fire with a warning on the ground", () => {
    const state = fireMountain();
    let erupted = false;
    let bombs = 0;
    for (let t = 0; t < 30 && !erupted; t += DT) {
      stepRaid(state, [], DT);
      hero(state).hp = hero(state).maxHp;
      erupted = state.events.some((e) => e.type === "eruption");
      bombs = state.projectiles.filter((p) => p.kind === "lava").length;
    }
    expect(erupted).toBe(true);
    expect(bombs).toBeGreaterThanOrEqual(4);
  });
});

describe("statues in a raid", () => {
  it("toughens and sharpens the defenders' buildings", () => {
    const place: PlacedBuilding[] = [{ type: "gunTurret", pos: vec(0, -8) }];
    const plain = createRaid(layout(place), []);
    const blessed = createRaid(layout(place, { buffs: { health: 1.15, damage: 1.15 } }), []);
    expect(building(blessed).maxHp).toBeCloseTo(building(plain).maxHp * 1.15);
    expect(building(blessed).power).toBeCloseTo(building(plain).power * 1.15);
  });
});

/** An enemy bullet strong enough to fell any hero. */
function enemyShot(state: RaidState): RaidState["projectiles"][number] {
  return {
    id: state.nextId++,
    kind: "bullet",
    team: "enemy",
    ownerId: 0,
    pos: vec(0, 0),
    vel: vec(0, 0),
    damage: 1e6,
    splash: 0,
    buildingBonus: 1,
    heavyBonus: 1,
    traveled: 0,
    maxDistance: 10,
    lob: null,
    charges: 0,
    homing: null,
    leaves: null,
  };
}
