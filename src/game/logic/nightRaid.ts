// The nightly raid: each day's raider ship (see raiderShip.ts) lands on the crew's island at the
// hour it chose, and its AI raiders try to take the headquarters while nobody's home. It's an
// ordinary raid with the crew's own base as the target, so every building fights at its level. The
// rules are deterministic, so only the seed, the ship and the island need keeping: a replay simply
// runs the same raid again. Raiders carry off what they can reach, and an island that holds them
// off is paid for it, more for a harder ship.

import { SIM_STEP } from "../config";
import { type CrewLayout, hqLevel, type PlacedBuilding } from "./crewIsland";
import type { CrystalCost } from "./crystals";
import type { Difficulty } from "./difficulty";
import { hqCapacity, type Purse, RESOURCES, STORAGES, storageCapacity } from "./economy";
import { minesOf, toRaidBuilding } from "./enemyBase";
import { FULL_ARSENAL } from "./gunboat";
import { HERO_KINDS, type HeroKind } from "./heroes";
import { type IslandLayout, landingPoints } from "./island";
import { createRaid, destructionPercent, type RaidState, stepRaid } from "./raid";
import { heldReward, type RaiderShip, raiderArsenal, raiderCount, raiderPower } from "./raiderShip";
import { createRng } from "./rng";
import { squadInput } from "./squad";
import { type StatueBuffs, statueBuffs } from "./statues";

/** The most of whatever sat in a broken store that raiders can carry away. */
const CARRIED_SHARE = 0.4;

export interface NightReport {
  survived: boolean;
  destroyedPercent: number;
  destroyed: number;
  total: number;
  seconds: number;
  raiders: number;
  raidersDown: number;
  /** What the raiders got away with. */
  stolen: Partial<Purse>;
  /** What holding the island paid: to the island, and crystals to the player. */
  reward: Partial<Purse>;
  crystals: CrystalCost;
}

/** The ship that raided, as much of it as a replay and a strike back need. */
export interface RaidingShip {
  hq: number;
  difficulty: Difficulty;
  plan: string;
  bombards: boolean;
  kinds: HeroKind[];
  powers: number[];
  crew: string;
  homeSeed: number;
  /** When it struck, in milliseconds. */
  at: number;
}

/** A raid that happened, with what's needed to replay it. */
export interface NightRaid {
  /** Which day's ship it was (see shipDay). */
  night: number;
  seed: number;
  /** The island as it stood that night. */
  buildings: PlacedBuilding[];
  cleared: string[];
  /** What the crew's statues were adding that night, for an exact replay. */
  buffs?: Pick<StatueBuffs, "health" | "damage">;
  /** Raids from before the ships have none, and their raiders are worked out from the island. */
  ship?: RaidingShip;
  report: NightReport;
  /** The crew has struck back at the base it came from. */
  avenged?: boolean;
}

type Island = Pick<CrewLayout, "buildings">;

/** A crew's island as a raid map: its buildings at their levels, and the usual landing. */
export function nightIsland(
  crew: Island & { buffs?: Pick<StatueBuffs, "health" | "damage"> },
  seed: number,
): IslandLayout {
  return {
    seed,
    level: 1,
    // Anything still going up can't fight yet. Land mines go off and are set again by morning.
    buildings: crew.buildings
      .filter((b) => b.level > 0 && b.type !== "landmine")
      .map(toRaidBuilding),
    obstacles: [],
    decor: [],
    mines: minesOf(crew.buildings),
    ...landingPoints(),
    buffs: crew.buffs,
  };
}

/** The raiders of a raid from before the ships: by the island's headquarters, at random. */
export function raiderForce(hq: number, seed: number): { kinds: HeroKind[]; powers: number[] } {
  const rng = createRng(seed ^ 0x1dea);
  const kinds: HeroKind[] = ["rifleman"];
  while (kinds.length < raiderCount(hq)) {
    kinds.push(HERO_KINDS[Math.floor(rng() * HERO_KINDS.length)] ?? "rifleman");
  }
  return { kinds, powers: kinds.map(() => raiderPower(hq)) };
}

/** What a day's ship carries into its raid. */
export function raidingShip(ship: RaiderShip): RaidingShip {
  return {
    hq: ship.hq,
    difficulty: ship.difficulty,
    plan: ship.plan.name,
    bombards: ship.plan.bombards,
    kinds: ship.kinds,
    powers: ship.powers,
    crew: ship.crew,
    homeSeed: ship.homeSeed,
    at: ship.at,
  };
}

/** A fresh start of a night's raid, for simulating or replaying it. */
export function startNightRaid(
  crew: Island & { buffs?: Pick<StatueBuffs, "health" | "damage">; ship?: RaidingShip },
  seed: number,
): RaidState {
  const { ship } = crew;
  const { kinds, powers } = ship ?? raiderForce(hqLevel(crew), seed);
  const arsenal = ship ? raiderArsenal(ship.hq) : FULL_ARSENAL;
  const state = createRaid(nightIsland(crew, seed), kinds, powers, [], arsenal);
  state.hitAndRun = true;
  state.tactics = ship ? { bombards: ship.bombards } : null;
  return state;
}

/** One step: every raider is an AI, and nobody defends but the buildings. */
export function stepNightRaid(state: RaidState, dt: number): void {
  stepRaid(
    state,
    state.heroes.map((_, i) => squadInput(state, i)),
    dt,
  );
}

/**
 * What raiders carry away: a share of each resource, by how much of what holds it they broke. The
 * headquarters stores some of everything, so losing it loses the most.
 */
export function stolenBy(state: RaidState, hq: number, stock: Purse): Partial<Purse> {
  const stolen: Partial<Purse> = {};
  const hqDown = state.buildings.some((b) => b.type === "headquarters" && b.destroyed);
  for (const r of RESOURCES) {
    const held = hqCapacity(hq);
    let total = held;
    let lost = hqDown ? held : 0;
    for (const b of state.buildings) {
      if (STORAGES[b.type] !== r) continue;
      total += storageCapacity(b.level);
      if (b.destroyed) lost += storageCapacity(b.level);
    }
    const taken = Math.floor(stock[r] * (lost / total) * CARRIED_SHARE);
    if (taken > 0) stolen[r] = taken;
  }
  return stolen;
}

export function nightReport(
  state: RaidState,
  hq: number,
  stock: Purse,
  ship: Pick<RaidingShip, "hq" | "difficulty">,
  seed: number,
): NightReport {
  const survived = state.status !== "won";
  const raidersDown = state.heroes.filter((h) => !h.alive).length;
  const held = survived
    ? heldReward(ship.hq, ship.difficulty, seed, raidersDown === state.heroes.length)
    : null;
  return {
    survived,
    destroyedPercent: destructionPercent(state),
    destroyed: state.buildings.filter((b) => b.destroyed).length,
    total: state.buildings.length,
    seconds: state.time,
    raiders: state.heroes.length,
    raidersDown,
    stolen: stolenBy(state, hq, stock),
    reward: held?.purse ?? {},
    crystals: held?.crystals ?? {},
  };
}

/** Plays a night's raid start to finish and reports how the island did. */
export function runNightRaid(
  crew: Pick<CrewLayout, "buildings" | "cleared" | "resources" | "statues">,
  night: number,
  seed: number,
  ship?: RaidingShip,
): NightRaid {
  const { health, damage } = statueBuffs(crew.statues);
  const buffs = { health, damage };
  const state = startNightRaid({ buildings: crew.buildings, buffs, ship }, seed);
  while (state.status === "playing") stepNightRaid(state, SIM_STEP);
  const hq = hqLevel(crew);
  return {
    night,
    seed,
    buildings: crew.buildings,
    cleared: crew.cleared,
    buffs,
    ship,
    report: nightReport(state, hq, crew.resources, ship ?? { hq, difficulty: "Medium" }, seed),
  };
}
