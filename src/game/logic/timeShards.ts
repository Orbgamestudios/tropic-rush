// Time shards: broken from crystals at the Hourglass (docs/STORY.md), each holding one power over
// time on a raid. Only one power runs at once, and it acts on the whole crew whoever used it.
// Retries are different: a pool the crew shares, which brings a fallen hero back by itself. The
// numbers are a first pass. No engine imports.

import type { Rng } from "./rng";

export type TimePower = "slow" | "pause" | "fastForward" | "record" | "rewind" | "retry";

/** In the order the shard bar shows them. */
export const TIME_POWERS: readonly TimePower[] = [
  "slow",
  "pause",
  "fastForward",
  "record",
  "rewind",
  "retry",
];

export interface TimePowerSpec {
  name: string;
  /** What the whole screen is washed with while it runs. */
  color: string;
  text: string;
  /** How long it runs, in seconds of the raid's clock. */
  seconds: number;
}

export const TIME_POWER_SPECS: Record<TimePower, TimePowerSpec> = {
  slow: {
    name: "Slow",
    color: "#ffd21f",
    text: "The world runs at half speed. Your heroes and their shots don't.",
    seconds: 10,
  },
  pause: {
    name: "Pause",
    color: "#3d8bff",
    text: "Time stops. Shots hang in the air and defenses can't turn or fall, but they still take damage.",
    seconds: 10,
  },
  fastForward: {
    name: "Fast forward",
    color: "#ff8a1f",
    text: "Everything runs at double speed, behind a barrier worth a fifth of each hero's health.",
    seconds: 10,
  },
  record: {
    name: "Record",
    color: "#2fd36b",
    text: "Nothing can hurt you while you're recorded. Then time goes back, and a copy of you plays it out.",
    seconds: 10,
  },
  rewind: {
    name: "Rewind",
    color: "#a64dff",
    text: "The world runs backwards. Enemy shots fly home, and what you broke before mends itself.",
    seconds: 10,
  },
  retry: {
    name: "Retry",
    color: "#ff3b4a",
    text: "A fallen hero is taken back to a few seconds before they fell.",
    seconds: 0,
  },
};

/** How fast the world runs, against the heroes, under slow. */
export const SLOW_WORLD = 0.5;
/** Under fast forward, everything runs this many times as fast. */
export const FAST_FORWARD = 2;
/** The barrier fast forward puts round each hero, as a share of their health. */
export const FAST_BARRIER = 0.5;
/** How far back a retry takes a fallen hero, in seconds. */
export const RETRY_BACK = 3;

/** The shards a player owns, by power. */
export type Shards = Partial<Record<TimePower, number>>;

/** What everyone starts with, to try each power before they've broken any crystals of their own. */
export const STARTER_SHARDS: Shards = {
  slow: 2,
  pause: 2,
  fastForward: 2,
  record: 2,
  rewind: 2,
  retry: 2,
};

/**
 * How many time crystals a player takes on a raid, retries aside: three uses in all, any mix of
 * the ones they own, three of the same if they like.
 */
export const LOADOUT_SLOTS = 3;

/** The powers a player can put in a loadout: everything but retries, which go by themselves. */
export const LOADOUT_POWERS: readonly TimePower[] = TIME_POWERS.filter((p) => p !== "retry");

/**
 * The loadout as it stands with what's owned now: each slot needs a crystal of its own, so a
 * slot whose crystal has been used up drops away. With no loadout chosen, it's filled from what
 * they own, one of each kind before any twice.
 */
export function fitLoadout(owned: Shards, loadout: readonly TimePower[] | null): TimePower[] {
  const left: Shards = { ...owned };
  const take = (p: TimePower) => {
    if (p === "retry" || (left[p] ?? 0) <= 0) return false;
    left[p] = (left[p] ?? 0) - 1;
    return true;
  };
  if (loadout) return loadout.filter(take).slice(0, LOADOUT_SLOTS);
  const out: TimePower[] = [];
  while (out.length < LOADOUT_SLOTS) {
    const before = out.length;
    for (const p of LOADOUT_POWERS) if (out.length < LOADOUT_SLOTS && take(p)) out.push(p);
    if (out.length === before) break;
  }
  return out;
}

/** What a player takes on a raid: the crystals in their loadout, and all their retries. */
export function packShards(owned: Shards, loadout: readonly TimePower[] | null = null): Shards {
  const pack: Shards = {};
  for (const p of fitLoadout(owned, loadout)) pack[p] = (pack[p] ?? 0) + 1;
  if ((owned.retry ?? 0) > 0) pack.retry = owned.retry;
  return pack;
}

/** Puts a crystal in the next free slot, if there's one and they own another of it. */
export function addToLoadout(
  owned: Shards,
  loadout: readonly TimePower[] | null,
  power: TimePower,
): TimePower[] {
  const now = fitLoadout(owned, loadout);
  if (power === "retry" || now.length >= LOADOUT_SLOTS) return now;
  const using = now.filter((p) => p === power).length;
  return using < (owned[power] ?? 0) ? [...now, power] : now;
}

/** Takes a crystal back out of its slot. */
export function removeFromLoadout(
  owned: Shards,
  loadout: readonly TimePower[] | null,
  slot: number,
): TimePower[] {
  return fitLoadout(owned, loadout).filter((_, i) => i !== slot);
}

/** Reads a saved loadout; null for one never chosen. */
export function readLoadout(value: unknown): TimePower[] | null {
  if (!Array.isArray(value)) return null;
  return value
    .filter((p): p is TimePower => LOADOUT_POWERS.includes(p as TimePower))
    .slice(0, LOADOUT_SLOTS);
}

/**
 * The retries a raid gives: a slot for each raider the island calls for beyond those going, each
 * filled with a retry crystal one of them brings. One person on a one-person island gets none;
 * alone on a three-person island, two. Who each slot's crystal belongs to, in the order they go:
 * one from each raider in turn.
 */
export function retryOwners(brought: readonly number[], raiders: number): number[] {
  const slots = Math.max(0, raiders - brought.length);
  const left = [...brought];
  const owners: number[] = [];
  while (owners.length < slots && left.some((n) => n > 0)) {
    left.forEach((n, i) => {
      if (owners.length >= slots || n <= 0) return;
      owners.push(i);
      left[i] = n - 1;
    });
  }
  return owners;
}

/** How many shards a crystal breaks into at the Hourglass: usually 2 to 4, now and then 1 or 5. */
export function shardsFromCrystal(rng: Rng): number {
  const roll = rng();
  if (roll < 0.1) return 1;
  if (roll >= 0.9) return 5;
  return 2 + Math.floor(((roll - 0.1) / 0.8) * 3);
}

export function readShards(value: unknown): Shards {
  const v = (value ?? {}) as Partial<Record<TimePower, unknown>>;
  const out: Shards = {};
  for (const power of TIME_POWERS) {
    const n = v[power];
    if (typeof n === "number" && Number.isFinite(n) && n >= 1) out[power] = Math.floor(n);
  }
  return out;
}
