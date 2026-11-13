// The raider ship: each morning one turns up somewhere on the crew's map, and that night it lands
// on their island. Tapping it says when it's likely to strike, how hard it is, from easy (green) to
// impossible (purple), who's aboard and what holding it off pays: a few crystals and some of
// everything, more for a harder ship. It can't be called in early. Each ship sails from a raider
// base of its own, which the crew can strike back at if the raid gets through. The rules are
// deterministic, so a day's ship is the same on every phone. No engine imports.

import { CRYSTAL_KINDS, type CrystalCost } from "./crystals";
import { type Difficulty, hqInBand, rollBand } from "./difficulty";
import type { Purse } from "./economy";
import type { Arsenal } from "./gunboat";
import type { HeroKind } from "./heroes";
import { createRng } from "./rng";

const DAY_MS = 86_400_000;
const HOUR_MS = 3_600_000;
/** A day's ship turns up at this hour, local time... */
const ARRIVES_HOUR = 5;
/** ...and strikes this many hours later, give or take `STRIKE_SPREAD`: between 9 pm and 5 am. */
const STRIKE_AFTER = 20;
const STRIKE_SPREAD = 4;
/** How far either side of the real moment the ship lets on it'll strike, in hours. */
const WINDOW_HOURS = 1;

/** The most raiders a ship carries. */
const MOST_RAIDERS = 8;
/**
 * A ship's crew is sized to the island it raids, not the base it sailed from, which an impossible
 * ship's is far above: harder ships bring one more raider at most, and somewhat stronger ones.
 */
const EXTRA_RAIDERS: Record<Difficulty, number> = {
  Easy: 0,
  Medium: 0,
  Hard: 0,
  Extreme: 1,
  Impossible: 1,
};
const RAIDER_STRENGTH: Record<Difficulty, number> = {
  Easy: 0.8,
  Medium: 0.95,
  Hard: 1.08,
  Extreme: 1.2,
  Impossible: 1.32,
};

/** How a ship's crew goes about it, and who's aboard, in the order they sign on. */
export interface RaidPlan {
  name: string;
  kinds: readonly HeroKind[];
  /** Holds the gunboat's energy for big strikes on the defenses, rather than firing it off. */
  bombards: boolean;
}

const PLANS: readonly RaidPlan[] = [
  {
    name: "Tank wall",
    kinds: ["tank", "tank", "tank", "medic", "rifleman", "tank", "engineer", "medic"],
    bombards: false,
  },
  {
    name: "Heavy, medic and bazooka",
    kinds: ["heavy", "medic", "bazooka", "bazooka", "heavy", "medic", "bazooka", "rifleman"],
    bombards: true,
  },
  {
    name: "Grenade rain",
    kinds: ["grenadier", "heavy", "grenadier", "medic", "grenadier", "heavy", "grenadier", "medic"],
    bombards: true,
  },
  {
    name: "Rifle squad",
    kinds: ["rifleman", "rifleman", "medic", "rifleman", "rifleman", "medic", "rifleman", "heavy"],
    bombards: false,
  },
  {
    name: "Rocket battery",
    kinds: ["bazooka", "heavy", "bazooka", "medic", "bazooka", "tank", "bazooka", "bazooka"],
    bombards: true,
  },
  {
    name: "Engineers' fort",
    kinds: ["engineer", "heavy", "engineer", "medic", "engineer", "tank", "engineer", "medic"],
    bombards: false,
  },
  {
    name: "Mixed crew",
    kinds: ["rifleman", "heavy", "medic", "bazooka", "grenadier", "tank", "engineer", "rifleman"],
    bombards: true,
  },
];

/** Crystals for holding off a ship, by how hard it is. */
const HELD_CRYSTALS: Record<Difficulty, number> = {
  Easy: 1,
  Medium: 2,
  Hard: 2,
  Extreme: 3,
  Impossible: 4,
};
/** Everything else for holding it off: gold, and timber and stone in proportion, by difficulty. */
const HELD_GOLD = 120;
const HELD_GOLD_PER_LEVEL = 50;
const HELD_FACTOR: Record<Difficulty, number> = {
  Easy: 1,
  Medium: 1.3,
  Hard: 1.7,
  Extreme: 2.2,
  Impossible: 3,
};
/** Not one raider getting away pays this much more. */
const CLEAN_SWEEP = 1.25;

const CREW_START = ["Black", "Red", "Bloody", "Grim", "Howling", "Rotten", "Scarlet", "Dread"];
const CREW_END = ["Gulls", "Sharks", "Knives", "Barnacles", "Hooks", "Skulls", "Eels", "Jackals"];

/** What holding off a ship pays. */
export interface HeldReward {
  crystals: CrystalCost;
  purse: Partial<Purse>;
}

export interface RaiderShip {
  /** Which day it is (see shipDay). */
  day: number;
  seed: number;
  /** The headquarters level it raids at, which sets how many raiders and how strong. */
  hq: number;
  difficulty: Difficulty;
  /** When it strikes, in milliseconds, and the window it lets on. */
  at: number;
  window: { from: number; to: number };
  plan: RaidPlan;
  kinds: HeroKind[];
  powers: number[];
  /** The crew aboard, and the seed of the base they sailed from. */
  crew: string;
  homeSeed: number;
  reward: HeldReward;
  /** Picks where it lies on the map. */
  spotSeed: number;
}

/** Counts days: each one starts at the ship's hour, in the phone's own time zone. */
export function shipDay(now: number, offsetMinutes = new Date(now).getTimezoneOffset()): number {
  return Math.floor((now - offsetMinutes * 60_000 - ARRIVES_HOUR * HOUR_MS) / DAY_MS);
}

/** When a day begins, in milliseconds. */
export function dayStart(day: number, offsetMinutes: number): number {
  return day * DAY_MS + ARRIVES_HOUR * HOUR_MS + offsetMinutes * 60_000;
}

/** How many raiders a ship of this headquarters level carries. */
export function raiderCount(hq: number): number {
  return Math.min(MOST_RAIDERS, 2 + Math.floor(hq / 4));
}

/** How strong each raider is, against a player's hero: well below at first, then catching up. */
export function raiderPower(hq: number): number {
  return 0.3 + 0.055 * hq;
}

/**
 * The gunboat a ship's raiders call on: shells and medkits from the start, the shock grenade and the
 * barrage on stronger ships, and every weapon better as the ship's headquarters climbs.
 */
export function raiderArsenal(hq: number): Arsenal {
  const level = Math.min(6, 1 + Math.floor(hq / 8));
  return {
    artillery: level,
    heal: level,
    ...(hq >= 6 ? { shock: level } : {}),
    ...(hq >= 10 ? { barrage: level } : {}),
  };
}

/** What holding off a ship pays, a little more if not one raider got away. */
export function heldReward(
  hq: number,
  difficulty: Difficulty,
  seed: number,
  cleanSweep = false,
): HeldReward {
  const rng = createRng(seed ^ 0x9e1d);
  const crystals: CrystalCost = {};
  for (let i = 0; i < HELD_CRYSTALS[difficulty]; i++) {
    const kind = CRYSTAL_KINDS[Math.floor(rng() * CRYSTAL_KINDS.length)] ?? "nature";
    crystals[kind] = (crystals[kind] ?? 0) + 1;
  }
  const gold = (HELD_GOLD + HELD_GOLD_PER_LEVEL * hq) * HELD_FACTOR[difficulty];
  const more = cleanSweep ? CLEAN_SWEEP : 1;
  const round = (n: number) => Math.round((n * more) / 10) * 10;
  return {
    crystals,
    purse: { gold: round(gold), timber: round(gold * 0.6), stone: round(gold * 0.4) },
  };
}

/** The day's ship, for a crew at this headquarters level. */
export function raiderShip(
  day: number,
  yourHq: number,
  offsetMinutes = new Date().getTimezoneOffset(),
): RaiderShip {
  const seed = (Math.imul(day, 2654435761) ^ 0x5a1b) >>> 0;
  const rng = createRng(seed);
  const difficulty = rollBand(rng());
  const hq = hqInBand(difficulty, yourHq, rng());
  const at =
    dayStart(day, offsetMinutes) + (STRIKE_AFTER + (rng() * 2 - 1) * STRIKE_SPREAD) * HOUR_MS;
  const plan = PLANS[Math.floor(rng() * PLANS.length)] ?? (PLANS[0] as RaidPlan);
  const count = Math.min(MOST_RAIDERS, raiderCount(yourHq) + EXTRA_RAIDERS[difficulty]);
  const kinds = Array.from(
    { length: count },
    (_, i) => plan.kinds[i % plan.kinds.length] ?? "rifleman",
  );
  const power = raiderPower(yourHq) * RAIDER_STRENGTH[difficulty];
  const start = CREW_START[Math.floor(rng() * CREW_START.length)];
  const end = CREW_END[Math.floor(rng() * CREW_END.length)];
  const homeSeed = Math.floor(rng() * 2 ** 31);
  const hour = Math.round(at / HOUR_MS) * HOUR_MS;
  return {
    day,
    seed,
    hq,
    difficulty,
    at,
    window: { from: hour - WINDOW_HOURS * HOUR_MS, to: hour + WINDOW_HOURS * HOUR_MS },
    plan,
    kinds,
    powers: kinds.map(() => power),
    crew: `The ${start} ${end}`,
    homeSeed,
    reward: heldReward(hq, difficulty, seed),
    spotSeed: Math.floor(rng() * 2 ** 31),
  };
}

/** The ship out on the map now: today's, until it strikes. Gone from then until morning. */
export function shipAtSea(now: number, yourHq: number): RaiderShip | null {
  const ship = raiderShip(shipDay(now), yourHq);
  return now < ship.at ? ship : null;
}

/** The next ship to strike: today's if it hasn't yet, or else tomorrow's. */
export function nextShip(now: number, yourHq: number): RaiderShip {
  return shipAtSea(now, yourHq) ?? raiderShip(shipDay(now) + 1, yourHq);
}
