import { describe, expect, it } from "vitest";
import { Bots, MOST_BOTS, pickBots } from "./bots";
import { BUILDINGS } from "./buildings";
import { HEROES } from "./heroes";
import type { IslandLayout, PlacedBuilding } from "./island";
import { createRaid, IDLE_INPUT, type RaidHero, type RaidState, stepRaid } from "./raid";
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
    spawn: vec(0, 30),
    boat: vec(0, 34),
  };
}

function hero(state: RaidState, i: number): RaidHero {
  const h = state.heroes[i];
  if (!h) throw new Error(`no hero ${i}`);
  return h;
}

/** Runs the raid with the player standing still, the bots thinking. */
function run(state: RaidState, bots: Bots, seconds: number): void {
  for (let t = 0; t < seconds; t += DT) stepRaid(state, [IDLE_INPUT, ...bots.inputs(state)], DT);
}

describe("the player's crew", () => {
  it("brings a heavy and a medic first, never the player's own hero, and only so many", () => {
    expect(pickBots(["captain", "rifleman"], "captain")).toEqual(["rifleman"]);
    const all = pickBots(["captain", "rifleman", "medic", "heavy", "tank", "bazooka"], "rifleman");
    expect(all).toHaveLength(MOST_BOTS);
    expect(all.slice(0, 3)).toEqual(["heavy", "tank", "medic"]);
    expect(all).not.toContain("rifleman");
  });

  it("goes in ahead with a heavy, and covers from out of the other defenses' reach", () => {
    // The turret the player's fighting, and a mortar off to one side that the others keep clear of.
    const state = createRaid(
      layout([
        { type: "gunTurret", pos: vec(0, 0) },
        { type: "mortar", pos: vec(-24, 6) },
      ]),
      ["captain", "heavy", "rifleman"],
    );
    const bots = new Bots(2);
    const turret = state.buildings[0];
    const mortar = state.buildings[1];
    if (!turret || !mortar) throw new Error("no buildings");
    // The player stands in reach of the turret with their pistols, locked onto it.
    const player = hero(state, 0);
    player.pos = vec(0, 12.5);
    player.targetId = turret.id;
    for (const i of [1, 2]) hero(state, i).pos = vec(i === 1 ? 2 : -2, 16);
    run(state, bots, 4);
    const heavy = hero(state, 1);
    const rifle = hero(state, 2);
    const turretReach = BUILDINGS.gunTurret.attack?.range ?? 0;
    // The heavy's well inside the turret's reach, nearer it than the player.
    expect(distance(heavy.pos, turret.pos)).toBeLessThan(turretReach * 0.75);
    expect(distance(heavy.pos, turret.pos)).toBeLessThan(distance(player.pos, turret.pos) - 1);
    // The Rifleman's back at his own reach, out of the mortar's.
    const rifleGap = distance(rifle.pos, turret.pos);
    expect(rifleGap).toBeGreaterThan(HEROES.rifleman.attack.range * 0.6);
    expect(rifleGap).toBeLessThan(HEROES.rifleman.attack.range + turret.radius + 1);
    expect(distance(rifle.pos, mortar.pos)).toBeGreaterThan(
      (BUILDINGS.mortar.attack?.range ?? 0) + 0.5,
    );
    // And they're shooting it.
    expect(turret.hp).toBeLessThan(turret.maxHp);
    // Each said what they were doing, once.
    const said = bots.said.map((c) => c.hero);
    expect(said).toContain(1);
    expect(new Set(said).size).toBe(said.length);
  });

  it("falls in behind the player when there's nothing to fight", () => {
    const state = createRaid(layout([]), ["captain", "rifleman"]);
    const bots = new Bots(1);
    hero(state, 1).pos = vec(10, 40);
    run(state, bots, 4);
    expect(distance(hero(state, 1).pos, hero(state, 0).pos)).toBeLessThan(5);
  });

  it("patches the player up as a medic", () => {
    const state = createRaid(layout([]), ["captain", "medic"]);
    const bots = new Bots(1);
    const player = hero(state, 0);
    player.hp = player.maxHp * 0.4;
    const before = player.hp;
    run(state, bots, 4);
    expect(player.hp).toBeGreaterThan(before);
    expect(bots.said.map((c) => c.text)).toEqual(
      expect.arrayContaining([expect.stringMatching(/./)]),
    );
  });
});
