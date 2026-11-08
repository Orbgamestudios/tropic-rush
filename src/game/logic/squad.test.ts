import { describe, expect, it } from "vitest";
import { BUILDINGS } from "./buildings";
import { generateIsland } from "./enemyBase";
import type { IslandLayout, PlacedBuilding } from "./island";
import {
  createRaid,
  IDLE_INPUT,
  type Projectile,
  type RaidHero,
  type RaidState,
  stepRaid,
} from "./raid";
import { dodge, squadInput } from "./squad";
import { add, distance, length, normalize, scale, sub, type Vec2, vec } from "./vec";

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

function layout(buildings: PlacedBuilding[]): IslandLayout {
  return {
    seed: 3,
    level: 1,
    buildings,
    obstacles: [],
    decor: [],
    mines: [],
    spawn: vec(0, 0),
    boat: vec(0, 6),
  };
}

/** A rifleman raider off a ship, a gun turret 12 meters north. */
function raid(dodges = true): RaidState {
  const state = createRaid(layout([{ type: "gunTurret", pos: vec(0, -12) }]), ["rifleman"]);
  state.tactics = { bombards: false, dodges };
  return state;
}

function shot(from: Vec2, vel: Vec2, lob: Projectile["lob"] = null): Projectile {
  return {
    id: 999,
    kind: lob ? "mortar" : "bullet",
    team: "enemy",
    ownerId: 0,
    pos: from,
    vel,
    damage: 40,
    splash: lob ? 2.5 : 0,
    buildingBonus: 1,
    heavyBonus: 1,
    traveled: 0,
    maxDistance: 30,
    lob,
    charges: 0,
    homing: null,
    leaves: null,
  };
}

const dot = (a: Vec2, b: Vec2) => a.x * b.x + a.y * b.y;

describe("raiders who dodge", () => {
  it("stop shooting to step across a bullet coming at them", () => {
    const state = raid();
    const hero = state.heroes[0];
    if (!hero) throw new Error("no raider");
    state.projectiles.push(shot(vec(0, -8), vec(0, 30)));
    const input = squadInput(state, 0);
    expect(input.aim).toBeNull();
    expect(length(input.move)).toBeGreaterThan(0.5);
    // Across the bullet's line, not along it.
    expect(Math.abs(dot(normalize(input.move), vec(0, 1)))).toBeLessThan(0.5);
  });

  it("let a bullet that'll miss go by", () => {
    const state = raid();
    state.projectiles.push(shot(vec(6, -8), vec(0, 30)));
    expect(dodge(state, state.heroes[0] as never)).toBeNull();
  });

  it("run clear of where a mortar shell is about to land", () => {
    const state = raid();
    const landing = vec(0.8, 0.2);
    state.projectiles.push(
      shot(vec(0, -6), vec(0, 0), {
        from: vec(0, -12),
        to: landing,
        t: 1.2,
        duration: 1.8,
        peak: 9,
      }),
    );
    const input = squadInput(state, 0);
    // Away from the landing spot.
    expect(dot(input.move, vec(-landing.x, -landing.y))).toBeGreaterThan(0);
    expect(input.aim).toBeNull();
  });

  it("step out of a sniper's sights holding on them", () => {
    const state = raid();
    const tower = state.buildings[0];
    if (!tower) throw new Error("no defense");
    tower.sights = vec(0, 0);
    expect(dodge(state, state.heroes[0] as never)).not.toBeNull();
  });

  it("raiders from before stand and shoot, so old raids replay as they ran", () => {
    const state = raid(false);
    state.energy = 0;
    state.projectiles.push(shot(vec(0, -8), vec(0, 30)));
    // In reach of the turret: an old raider keeps firing.
    const hero = state.heroes[0];
    if (!hero) throw new Error("no raider");
    hero.pos = vec(0, -3);
    expect(squadInput(state, 0).aim).not.toBeNull();
  });

  it("won't call the gunboat while standing in a defense's reach", () => {
    const state = raid();
    state.energy = 30;
    const hero = state.heroes[0];
    if (!hero) throw new Error("no raider");
    hero.pos = vec(0, -4);
    const input = squadInput(state, 0);
    expect(input.toggleBoat).toBe(false);
    // Backing off, away from the turret to the north.
    expect(input.move.y).toBeGreaterThan(0);
  });
});
