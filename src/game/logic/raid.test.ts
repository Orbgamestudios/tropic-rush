import { describe, expect, it } from "vitest";
import { BUILDINGS } from "./buildings";
import { generateIsland } from "./enemyBase";
import { abilityCost, START_ENERGY } from "./gunboat";
import { HEROES, type HeroKind } from "./heroes";
import { perkMods } from "./heroProgress";
import { type IslandLayout, isOnLand, type PlacedBuilding } from "./island";
import {
  aimStretch,
  createRaid,
  destructionPercent,
  type HeroInput,
  IDLE_INPUT,
  type RaidState,
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

  it("spreads shots about a quarter wider on the move", () => {
    const still = strays("heavy", false);
    const moving = strays("heavy", true);
    expect(moving).toBeGreaterThan(still * 1.1);
    expect(moving).toBeLessThanOrEqual(0.1 * 1.25 + 1e-6);
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
    expect(aimStretch(hero(rifle))).toEqual({ width: 1.25, length: 1 });
    const grenadier = raid([], ["grenadier"]);
    hero(grenadier).unsteady = 1;
    const { width, length } = aimStretch(hero(grenadier));
    expect(width).toBeGreaterThan(1.25);
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

describe("the gunboat", () => {
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

describe("signature moves", () => {
  /** A hero at a level, alone or with friends, on an island of these buildings. */
  function signed(kinds: HeroKind[], level: number, buildings: PlacedBuilding[]): RaidState {
    return createRaid(
      layout(buildings),
      kinds,
      [],
      kinds.map((k) => perkMods(k, level)),
    );
  }

  const towers: PlacedBuilding[] = [
    { type: "storehouse", pos: vec(0, -8) },
    { type: "storehouse", pos: vec(7, -9) },
    { type: "storehouse", pos: vec(14, -9) },
    { type: "headquarters", pos: vec(40, -40) },
  ];
  const fire = (dir: Vec2) => input({ aim: normalize(dir) });

  it("ricochets rifle bullets into the next building, further at level 10", () => {
    const damage = (level: number) => {
      const state = signed(["rifleman"], level, towers);
      run(state, 2, [fire(vec(0, -1))]);
      return [1, 2].map((i) => building(state, i).maxHp - building(state, i).hp);
    };
    expect(damage(4)).toEqual([0, 0]);
    expect(damage(5)[0]).toBeGreaterThan(0);
    expect(damage(5)[1]).toBe(0);
    expect(damage(10)[1]).toBeGreaterThan(0);
  });

  it("makes some minigun rounds explode at full spin, more often at level 10", () => {
    const blasts = (level: number) => {
      const state = signed(["heavy"], level, towers);
      let count = 0;
      for (let t = 0; t < 4; t += DT) {
        stepRaid(state, [fire(vec(0, -1))], DT);
        count += state.events.filter((e) => e.type === "explosion").length;
      }
      return count;
    };
    expect(blasts(4)).toBe(0);
    expect(blasts(5)).toBeGreaterThan(0);
    expect(blasts(10)).toBeGreaterThan(blasts(5));
  });

  it("brings a fallen hero back once a raid, twice at level 10", () => {
    const shots = (level: number) => {
      const state = signed(["rifleman", "medic"], level, []);
      let downs = 0;
      const rifleman = hero(state, 0);
      for (let i = 0; i < 3 && rifleman.alive; i++) {
        state.projectiles.push({ ...enemyShot(state), pos: { ...rifleman.pos } });
        stepRaid(state, [], DT);
        if (rifleman.alive) downs++;
      }
      return { downs, alive: rifleman.alive, hp: rifleman.hp / rifleman.maxHp };
    };
    expect(shots(4).downs).toBe(0);
    expect(shots(5)).toMatchObject({ downs: 1, alive: false });
    expect(shots(10)).toMatchObject({ downs: 2, alive: false });
  });

  it("scatters bomblets from rockets", () => {
    const grenades = (level: number) => {
      const state = signed(["bazooka"], level, towers);
      let most = 0;
      for (let t = 0; t < 1.5; t += DT) {
        stepRaid(state, [t < 0.05 ? fire(vec(0, -1)) : undefined], DT);
        most = Math.max(most, state.projectiles.filter((p) => p.kind === "grenade").length);
      }
      return most;
    };
    expect(grenades(4)).toBe(0);
    expect(grenades(5)).toBe(3);
    expect(grenades(10)).toBe(5);
  });

  it("skips grenades on for more blasts", () => {
    const blasts = (level: number) => {
      const state = signed(["grenadier"], level, towers);
      let count = 0;
      for (let t = 0; t < 3; t += DT) {
        stepRaid(state, [t < 0.05 ? fire(vec(0, -1)) : undefined], DT);
        count += state.events.filter((e) => e.type === "explosion").length;
      }
      return count;
    };
    expect(blasts(4)).toBe(1);
    expect(blasts(5)).toBe(2);
    expect(blasts(10)).toBe(3);
  });

  it("turns what the Engineer destroys into a turret", () => {
    const turrets = (level: number) => {
      const state = signed(["engineer"], level, towers);
      building(state, 0).hp = 1;
      run(state, 1, [fire(vec(0, -1))]);
      return state.turrets;
    };
    expect(turrets(4)).toHaveLength(0);
    expect(turrets(5)).toHaveLength(1);
    expect(turrets(10)[0]?.time).toBeGreaterThan(turrets(5)[0]?.time ?? 0);
  });

  it("sends a shockwave out from what the Tank destroys, further at level 10", () => {
    const damage = (level: number) => {
      const state = signed(["tank"], level, [
        { type: "storehouse", pos: vec(0, -8) },
        { type: "storehouse", pos: vec(12, -8) },
        { type: "headquarters", pos: vec(40, -40) },
      ]);
      building(state, 0).hp = 1;
      run(state, 1, [fire(vec(0, -1))]);
      return building(state, 1).maxHp - building(state, 1).hp;
    };
    expect(damage(4)).toBe(0);
    expect(damage(5)).toBe(0);
    expect(damage(10)).toBeGreaterThan(0);
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
  };
}
