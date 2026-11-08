import { describe, expect, it } from "vitest";
import { BUILDINGS } from "./buildings";
import { abilityCost } from "./gunboat";
import type { IslandLayout, PlacedBuilding } from "./island";
import {
  canUseShard,
  createRaid,
  type HeroInput,
  IDLE_INPUT,
  type RaidEvent,
  type RaidState,
  stepRaid,
} from "./raid";
import { createRng } from "./rng";
import {
  FAST_BARRIER,
  packShards,
  readPicks,
  readShards,
  retrySlots,
  type Shards,
  shardsFromCrystal,
  TIME_POWER_SPECS,
  type TimePower,
  togglePick,
} from "./timeShards";
import { distance, vec } from "./vec";

const DT = 1 / 60;

function layout(buildings: PlacedBuilding[]): IslandLayout {
  return {
    seed: 1,
    level: 1,
    buildings,
    obstacles: [],
    decor: [],
    mines: [],
    spawn: vec(0, 0),
    boat: vec(0, 3),
  };
}

const ALL: Shards = { slow: 2, pause: 2, fastForward: 2, retry: 1 };

/** A rifleman with shards, and a gun turret 12 meters north that can reach them. */
function raid(shards: Shards = ALL, crewSize = 1): RaidState {
  const turret: PlacedBuilding = { type: "gunTurret", pos: vec(0, -12) };
  return createRaid(layout([turret]), ["rifleman"], [], [], undefined, [shards], crewSize);
}

function input(partial: Partial<HeroInput> = {}): HeroInput {
  return { ...IDLE_INPUT, ...partial };
}

/** Runs the raid, collecting what happened. */
function run(state: RaidState, seconds: number, each: HeroInput = IDLE_INPUT): RaidEvent[] {
  const events: RaidEvent[] = [];
  for (let t = 0; t < seconds - 1e-9; t += DT) {
    stepRaid(state, [each], DT);
    events.push(...state.events);
  }
  return events;
}

function use(state: RaidState, power: TimePower): RaidEvent[] {
  stepRaid(state, [input({ timePower: power })], DT);
  return [...state.events];
}

function hero(state: RaidState) {
  const h = state.heroes[0];
  if (!h) throw new Error("no hero");
  return h;
}

function turret(state: RaidState) {
  const b = state.buildings[0];
  if (!b) throw new Error("no turret");
  return b;
}

const enemyShots = (events: RaidEvent[]) =>
  events.filter((e) => e.type === "shot" && e.team === "enemy").length;

describe("time shards", () => {
  it("packs the three powers picked, or else the first three owned, and every retry", () => {
    const owned: Shards = { slow: 2, pause: 1, fastForward: 4, record: 3, rewind: 1, retry: 2 };
    expect(packShards(owned)).toEqual({ slow: 2, pause: 1, fastForward: 4, retry: 2 });
    expect(packShards(owned, ["rewind", "record"])).toEqual({ rewind: 1, record: 3, retry: 2 });
    // A pick that's run out drops away; with none left it's back to the first three.
    expect(packShards({ ...owned, rewind: 0 }, ["rewind", "record"])).toEqual({
      record: 3,
      retry: 2,
    });
    expect(packShards({ pause: 1, retry: 0 }, ["slow"])).toEqual({ pause: 1 });
  });

  it("picks up to three powers, dropping the oldest for a fourth, and never retries", () => {
    expect(togglePick([], "slow")).toEqual(["slow"]);
    expect(togglePick(["slow", "pause"], "slow")).toEqual(["pause"]);
    expect(togglePick(["slow", "pause", "record"], "rewind")).toEqual([
      "pause",
      "record",
      "rewind",
    ]);
    expect(togglePick(["slow"], "retry")).toEqual(["slow"]);
    expect(readPicks(["rewind", "retry", "junk", "slow", "pause", "record"])).toEqual([
      "slow",
      "pause",
      "record",
    ]);
  });

  it("gives a slot of retries for each crewmate attacking, or each crew member to someone alone", () => {
    expect(retrySlots([5], 4)).toBe(4);
    expect(retrySlots([2], 4)).toBe(2);
    expect(retrySlots([0], 4)).toBe(0);
    expect(retrySlots([3, 0, 1], 5)).toBe(2);
  });

  it("breaks a crystal into 2 to 4 shards most of the time, 1 or 5 now and then", () => {
    const rng = createRng(7);
    const counts = new Map<number, number>();
    const tries = 10000;
    for (let i = 0; i < tries; i++) {
      const n = shardsFromCrystal(rng);
      counts.set(n, (counts.get(n) ?? 0) + 1);
    }
    expect([...counts.keys()].sort()).toEqual([1, 2, 3, 4, 5]);
    expect((counts.get(1) ?? 0) / tries).toBeCloseTo(0.1, 1);
    expect((counts.get(5) ?? 0) / tries).toBeCloseTo(0.1, 1);
  });

  it("reads only whole, positive counts of real powers from a save", () => {
    expect(readShards({ slow: 2.7, pause: -1, nonsense: 4, retry: "3", rewind: 1 })).toEqual({
      slow: 2,
      rewind: 1,
    });
    expect(readShards(null)).toEqual({});
  });
});

describe("time powers on a raid", () => {
  it("runs one at a time, for as long as it lasts, taking the shard", () => {
    const state = raid();
    const started = use(state, "slow");
    expect(started).toContainEqual({ type: "timePower", power: "slow", heroId: hero(state).id });
    expect(hero(state).shards.slow).toBe(1);
    expect(canUseShard(state, hero(state), "pause")).toBe(false);
    use(state, "pause");
    expect(state.timePower?.power).toBe("slow");
    expect(hero(state).shards.pause).toBe(2);
    run(state, TIME_POWER_SPECS.slow.seconds);
    expect(state.timePower).toBeNull();
  });

  it("can't be used without a shard, and retries aren't used by hand", () => {
    const state = raid({ slow: 1, rewind: 3, retry: 1 });
    expect(canUseShard(state, hero(state), "pause")).toBe(false);
    expect(canUseShard(state, hero(state), "retry")).toBe(false);
    expect(canUseShard(state, hero(state), "rewind")).toBe(true);
    expect(canUseShard(state, hero(state), "slow")).toBe(true);
  });

  it("slow: the defenses fire half as often and their shots fly half as fast, the heroes don't", () => {
    const normal = raid();
    const slowed = raid();
    use(slowed, "slow");
    stepRaid(normal, [], DT);
    const shotsNormal = enemyShots(run(normal, 6));
    const shotsSlowed = enemyShots(run(slowed, 6));
    expect(shotsSlowed / shotsNormal).toBeCloseTo(0.5, 1);

    const fly = (state: RaidState) => {
      const bullet = state.projectiles.find((p) => p.team === "enemy");
      if (!bullet) throw new Error("no bullet");
      const from = { ...bullet.pos };
      stepRaid(state, [], DT);
      return distance(from, bullet.pos);
    };
    expect(fly(slowed) / fly(normal)).toBeCloseTo(0.5, 2);

    const walk = (state: RaidState) => {
      const from = { ...hero(state).pos };
      run(state, 0.5, input({ move: vec(1, 0) }));
      return distance(from, hero(state).pos);
    };
    expect(walk(slowed)).toBeCloseTo(walk(normal), 1);
  });

  it("pause: shots hang and defenses hold fire, but take damage, and fall when it ends", () => {
    const state = raid();
    run(state, 1);
    use(state, "pause");
    const hanging = state.projectiles.filter((p) => p.team === "enemy").map((p) => ({ ...p.pos }));
    const events = run(state, 1);
    expect(enemyShots(events)).toBe(0);
    expect(state.projectiles.filter((p) => p.team === "enemy").map((p) => p.pos)).toEqual(hanging);

    const b = turret(state);
    b.hp = 1;
    run(state, 1, input({ aim: vec(0, -1) }));
    expect(b.hp).toBe(0);
    expect(b.destroyed).toBe(false);
    run(state, TIME_POWER_SPECS.pause.seconds);
    expect(state.timePower).toBeNull();
    expect(b.destroyed).toBe(true);
  });

  it("fast forward: twice as far in the same time, behind a barrier that ends it when it breaks", () => {
    const normal = raid();
    const fast = raid();
    use(fast, "fastForward");
    stepRaid(normal, [], DT);
    const h = hero(fast);
    expect(h.barrier).toBeCloseTo(h.maxHp * FAST_BARRIER);
    const walk = (state: RaidState) => {
      const from = { ...hero(state).pos };
      run(state, 0.5, input({ move: vec(1, 0) }));
      return distance(from, hero(state).pos);
    };
    expect(walk(fast) / walk(normal)).toBeCloseTo(2, 1);

    // Standing in the turret's fire, the barrier soaks it up until it breaks, and then it's over.
    const hpBefore = h.hp;
    let seconds = 0;
    while (fast.timePower && seconds < TIME_POWER_SPECS.fastForward.seconds) {
      run(fast, 0.1);
      seconds += 0.1;
      if (fast.timePower) expect(h.hp).toBe(hpBefore);
    }
    expect(fast.timePower).toBeNull();
    expect(h.barrier).toBe(0);
    expect(seconds).toBeLessThan(TIME_POWER_SPECS.fastForward.seconds);
  });

  it("retry: a fallen hero is taken back a few seconds, until the crew's retries run out", () => {
    const state = raid({ retry: 1 });
    const h = hero(state);
    const start = { ...h.pos };
    run(state, 4, input({ move: vec(0, -1) }));
    expect(distance(start, h.pos)).toBeGreaterThan(5);
    const there = { ...h.pos };
    h.hp = 1;
    const events = run(state, 1);
    const retried = events.find((e) => e.type === "retried");
    expect(retried).toMatchObject({ heroId: h.id, spentFrom: h.id });
    expect(h.alive).toBe(true);
    expect(state.retries).toBe(0);
    expect(state.status).toBe("playing");
    // Three seconds back is well short of where they fell.
    expect(distance(start, h.pos)).toBeLessThan(distance(start, there));

    h.hp = 1;
    run(state, 1);
    expect(h.alive).toBe(false);
    expect(state.status).toBe("lost");
  });

  it("gives someone alone a retry slot for each crew member, from their own shards", () => {
    expect(raid({ retry: 5 }, 3).retries).toBe(3);
    expect(raid({ retry: 1 }, 3).retries).toBe(1);
    expect(raid({}, 3).retries).toBe(0);
  });
});

/** A rifleman with a record shard, and a gun turret 12 meters north that can reach them. */
function recording(): RaidState {
  return raid({ record: 1 });
}

describe("record", () => {
  it("can't hurt the hero while it records, then takes the world back and sends out a copy", () => {
    const state = recording();
    const h = hero(state);
    const start = { ...h.pos };
    const hp = h.hp;
    use(state, "record");
    run(state, 3, input({ move: vec(1, 0) }));
    const recordedTo = { ...h.pos };
    expect(distance(start, recordedTo)).toBeGreaterThan(5);
    run(state, TIME_POWER_SPECS.record.seconds - 3);
    expect(h.hp).toBe(hp);

    // Time goes back: the hero's where they began, and a copy of them sets off to do it again.
    const [real, copy] = state.heroes;
    expect(state.timePower).toMatchObject({ power: "record", replaying: true });
    expect(distance(real?.pos ?? recordedTo, start)).toBeLessThan(0.5);
    expect(copy?.copyOf).toBe(real?.id);
    run(state, 3);
    expect(distance(copy?.pos ?? start, recordedTo)).toBeLessThan(1);

    // The defenses can only see the copy.
    const copyHp = copy?.hp ?? 0;
    const realHp = real?.hp ?? 0;
    run(state, 2);
    expect(copy?.hp ?? 0).toBeLessThan(copyHp);
    expect(real?.hp).toBe(realHp);

    run(state, TIME_POWER_SPECS.record.seconds);
    expect(state.timePower).toBeNull();
    expect(state.heroes.map((x) => x.copyOf)).toEqual([null]);
  });

  it("brings back what fell while it was recording, and what was spent", () => {
    const state = recording();
    const b = turret(state);
    b.hp = 1;
    const energy = state.energy;
    use(state, "record");
    run(state, 1, input({ aim: vec(0, -1) }));
    expect(b.destroyed).toBe(true);
    expect(state.energy).toBeGreaterThan(energy);
    // The moment time goes back, before the copy has a chance to knock it down again.
    run(state, TIME_POWER_SPECS.record.seconds - 1);
    expect(state.timePower?.replaying).toBe(true);
    const back = turret(state);
    expect(back.destroyed).toBe(false);
    expect(state.energy).toBe(energy);
  });
});

describe("rewind", () => {
  /** A rifleman with a rewind shard next to a storehouse, the turret well out of reach. */
  function store(): RaidState {
    const buildings: PlacedBuilding[] = [{ type: "storehouse", pos: vec(0, -6) }];
    return createRaid(layout(buildings), ["rifleman"], [], [], undefined, [{ rewind: 1 }]);
  }

  it("mends what was broken before it, as the world runs back", () => {
    const state = store();
    const b = turret(state);
    run(state, 2, input({ aim: vec(0, -1) }));
    const hit = b.hp;
    expect(hit).toBeLessThan(b.maxHp);
    run(state, 0.5);
    use(state, "rewind");
    run(state, TIME_POWER_SPECS.rewind.seconds);
    expect(state.timePower).toBeNull();
    expect(b.hp).toBeGreaterThan(hit);
  });

  it("stands a fallen building back up, but doesn't pay for it twice", () => {
    const state = store();
    const b = turret(state);
    b.hp = 30;
    run(state, 1, input({ aim: vec(0, -1) }));
    expect(b.destroyed).toBe(true);
    const energy = state.energy;
    use(state, "rewind");
    run(state, TIME_POWER_SPECS.rewind.seconds);
    expect(b.destroyed).toBe(false);
    run(state, 2, input({ aim: vec(0, -1) }));
    expect(b.destroyed).toBe(true);
    expect(state.energy).toBe(energy);
  });

  it("keeps what's done while it runs, and sends the defenses' shots home into them", () => {
    const state = raid({ rewind: 1 });
    const gun = turret(state);
    run(state, 3);
    expect(state.projectiles.some((p) => p.team === "enemy")).toBe(true);
    const before = gun.hp;
    const events: RaidEvent[] = [...use(state, "rewind")];
    events.push(...run(state, state.timePower?.left ?? 0));
    expect(enemyShots(events)).toBe(0);
    expect(gun.hp).toBeLessThan(before);
  });

  it("only runs back as far as it can remember", () => {
    const state = raid({ rewind: 1 });
    run(state, 1);
    use(state, "rewind");
    expect(state.timePower?.left).toBeLessThanOrEqual(1.01);
  });
});

describe("the gunboat", () => {
  it("costs more for each use, by more each time", () => {
    const steps = [0, 1, 2, 3, 4].map((uses) => abilityCost("barrage", uses));
    for (let i = 2; i < steps.length; i++) {
      expect((steps[i] ?? 0) - (steps[i - 1] ?? 0)).toBeGreaterThanOrEqual(
        (steps[i - 1] ?? 0) - (steps[i - 2] ?? 0),
      );
    }
    expect(steps[4]).toBeGreaterThan((steps[0] ?? 0) * 4);
  });

  it("gets most of its energy from the defenses, little from mills and storages", () => {
    expect(BUILDINGS.goldMine.energy).toBeLessThan(BUILDINGS.gunTurret.energy / 2);
    expect(BUILDINGS.storehouse.energy).toBeLessThan(BUILDINGS.mortar.energy / 2);
  });
});
