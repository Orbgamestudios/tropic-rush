// The nightly raid: once a day, in the small hours, AI raiders land on the crew's island and try
// to take the headquarters while nobody's home. It's an ordinary raid with the crew's own base as
// the target, so every building fights at its level. The rules are deterministic, so only the
// seed and the island need keeping: a replay simply runs the same raid again.

import { SIM_STEP } from "../config";
import { type CrewLayout, hqLevel, type PlacedBuilding } from "./crewIsland";
import { minesOf, toRaidBuilding } from "./enemyBase";
import { HERO_KINDS, type HeroKind } from "./heroes";
import { type IslandLayout, landingPoints } from "./island";
import { createRaid, destructionPercent, type RaidState, stepRaid } from "./raid";
import { createRng } from "./rng";
import { squadInput } from "./squad";

/** Raids land at this hour, local time. */
const RAID_HOUR = 3;
const DAY_MS = 86_400_000;
const HOUR_MS = 3_600_000;

export interface NightReport {
  survived: boolean;
  destroyedPercent: number;
  destroyed: number;
  total: number;
  seconds: number;
  raiders: number;
  raidersDown: number;
}

/** A raid that happened, with what's needed to replay it. */
export interface NightRaid {
  /** Which night it was (see nightNumber). */
  night: number;
  seed: number;
  /** The island as it stood that night. */
  buildings: PlacedBuilding[];
  cleared: string[];
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
export function nightIsland(crew: Island, seed: number): IslandLayout {
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
export function startNightRaid(crew: Island, seed: number): RaidState {
  const { kinds, powers } = raiderForce(hqLevel(crew), seed);
  return createRaid(nightIsland(crew, seed), kinds, powers);
}

/** One step: every raider is an AI, and nobody defends but the buildings. */
export function stepNightRaid(state: RaidState, dt: number): void {
  stepRaid(
    state,
    state.heroes.map((_, i) => squadInput(state, i)),
    dt,
  );
}

export function nightReport(state: RaidState): NightReport {
  return {
    survived: state.status !== "won",
    destroyedPercent: destructionPercent(state),
    destroyed: state.buildings.filter((b) => b.destroyed).length,
    total: state.buildings.length,
    seconds: state.time,
    raiders: state.heroes.length,
    raidersDown: state.heroes.filter((h) => !h.alive).length,
  };
}

/** Plays a night's raid start to finish and reports how the island did. */
export function runNightRaid(
  crew: Pick<CrewLayout, "buildings" | "cleared">,
  night: number,
  seed: number,
): NightRaid {
  const state = startNightRaid(crew, seed);
  while (state.status === "playing") stepNightRaid(state, SIM_STEP);
  return {
    night,
    seed,
    buildings: crew.buildings,
    cleared: crew.cleared,
    report: nightReport(state),
  };
}
