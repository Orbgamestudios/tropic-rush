// The nightly raid: once a day, in the small hours, AI raiders land on the crew's island and try
// to take the headquarters while nobody's home. It's an ordinary raid with the crew's own base as
// the target, so every building fights at its level. The rules are deterministic, so only the
// seed and the island need keeping: a replay simply runs the same raid again. Raiders carry off
// what they can reach, and an island that holds them off is paid for it.

import { SIM_STEP } from "../config";
import { type CrewLayout, hqLevel, type PlacedBuilding } from "./crewIsland";
import { hqCapacity, type Purse, RESOURCES, STORAGES, storageCapacity } from "./economy";
import { minesOf, toRaidBuilding } from "./enemyBase";
import { HERO_KINDS, type HeroKind } from "./heroes";
import { type IslandLayout, landingPoints } from "./island";
import { createRaid, destructionPercent, type RaidState, stepRaid } from "./raid";
import { createRng } from "./rng";
import { squadInput } from "./squad";
import { type StatueBuffs, statueBuffs } from "./statues";

/** Raids land at this hour, local time. */
const RAID_HOUR = 3;
const DAY_MS = 86_400_000;
const HOUR_MS = 3_600_000;

/** The most of whatever sat in a broken store that raiders can carry away. */
const CARRIED_SHARE = 0.4;
/** Gold for holding the island: a base amount, and more for each headquarters level. */
const HELD_GOLD = 100;
const HELD_GOLD_PER_LEVEL = 60;

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
  /** Gold for holding the island. */
  reward: number;
}

/** A raid that happened, with what's needed to replay it. */
export interface NightRaid {
  /** Which night it was (see nightNumber). */
  night: number;
  seed: number;
  /** The island as it stood that night. */
  buildings: PlacedBuilding[];
  cleared: string[];
  /** What the crew's statues were adding that night, for an exact replay. */
  buffs?: Pick<StatueBuffs, "health" | "damage">;
  report: NightReport;
}

type Island = Pick<CrewLayout, "buildings">;

/** Counts nights: it ticks over at the raid hour, in the phone's own time zone. */
export function nightNumber(
  now: number,
  offsetMinutes = new Date(now).getTimezoneOffset(),
): number {
  return Math.floor((now - offsetMinutes * 60_000 - RAID_HOUR * HOUR_MS) / DAY_MS);
}

/** When the next raid lands, in milliseconds. */
export function nextRaidTime(
  now: number,
  offsetMinutes = new Date(now).getTimezoneOffset(),
): number {
  return (
    (nightNumber(now, offsetMinutes) + 1) * DAY_MS + RAID_HOUR * HOUR_MS + offsetMinutes * 60_000
  );
}

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

/** The raiders: more of them, and stronger, as the headquarters grows. */
export function raiderForce(hq: number, seed: number): { kinds: HeroKind[]; powers: number[] } {
  const rng = createRng(seed ^ 0x1dea);
  const count = Math.min(6, 1 + Math.floor(hq / 3));
  const kinds: HeroKind[] = ["rifleman"];
  while (kinds.length < count) {
    kinds.push(HERO_KINDS[Math.floor(rng() * HERO_KINDS.length)] ?? "rifleman");
  }
  // Raiders start well below a player's heroes, so a young island's first defenses can hold.
  const power = 0.3 + 0.055 * hq;
  return { kinds, powers: kinds.map(() => power) };
}

/** A fresh start of a night's raid, for simulating or replaying it. */
export function startNightRaid(
  crew: Island & { buffs?: Pick<StatueBuffs, "health" | "damage"> },
  seed: number,
): RaidState {
  const { kinds, powers } = raiderForce(hqLevel(crew), seed);
  const state = createRaid(nightIsland(crew, seed), kinds, powers);
  state.hitAndRun = true;
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

/** Gold for seeing off a night's raid: a bonus if not one raider got away. */
export function heldReward(hq: number, cleanSweep: boolean): number {
  const gold = HELD_GOLD + HELD_GOLD_PER_LEVEL * hq;
  return cleanSweep ? Math.round(gold * 1.5) : gold;
}

export function nightReport(state: RaidState, hq: number, stock: Purse): NightReport {
  const survived = state.status !== "won";
  const raidersDown = state.heroes.filter((h) => !h.alive).length;
  return {
    survived,
    destroyedPercent: destructionPercent(state),
    destroyed: state.buildings.filter((b) => b.destroyed).length,
    total: state.buildings.length,
    seconds: state.time,
    raiders: state.heroes.length,
    raidersDown,
    stolen: stolenBy(state, hq, stock),
    reward: survived ? heldReward(hq, raidersDown === state.heroes.length) : 0,
  };
}

/** Plays a night's raid start to finish and reports how the island did. */
export function runNightRaid(
  crew: Pick<CrewLayout, "buildings" | "cleared" | "resources" | "statues">,
  night: number,
  seed: number,
): NightRaid {
  const { health, damage } = statueBuffs(crew.statues);
  const buffs = { health, damage };
  const state = startNightRaid({ buildings: crew.buildings, buffs }, seed);
  while (state.status === "playing") stepNightRaid(state, SIM_STEP);
  return {
    night,
    seed,
    buildings: crew.buildings,
    cleared: crew.cleared,
    buffs,
    report: nightReport(state, hqLevel(crew), crew.resources),
  };
}
