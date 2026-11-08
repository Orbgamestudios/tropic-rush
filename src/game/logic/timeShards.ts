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
  glyph: string;
  text: string;
  /** How long it runs, in seconds of the raid's clock. */
  seconds: number;
}

export const TIME_POWER_SPECS: Record<TimePower, TimePowerSpec> = {
  slow: {
    name: "Slow",
    color: "#ffd21f",
    glyph: "▶|",
    text: "The world runs at half speed. Your heroes and their shots don't.",
    seconds: 8,
  },
  pause: {
    name: "Pause",
    color: "#3d8bff",
    glyph: "⏸",
    text: "Time stops. Shots hang in the air and defenses can't turn or fall, but they still take damage.",
    seconds: 5,
  },
  fastForward: {
    name: "Fast forward",
    color: "#ff8a1f",
    glyph: "⏩",
    text: "Everything runs at double speed, behind a barrier worth a fifth of each hero's health.",
    seconds: 10,
  },
  record: {
    name: "Record",
    color: "#2fd36b",
    glyph: "⏺",
    text: "Nothing can hurt you while you're recorded. Then time goes back, and a copy of you plays it out.",
    seconds: 8,
  },
  rewind: {
    name: "Rewind",
    color: "#a64dff",
    glyph: "⏪",
    text: "The world runs backwards. Enemy shots fly home, and what you broke before mends itself.",
    seconds: 5,
  },
  retry: {
    name: "Retry",
    color: "#ff3b4a",
    glyph: "♥",
    text: "A fallen hero is taken back to a few seconds before they fell.",
    seconds: 0,
  },
};

/** How fast the world runs, against the heroes, under slow. */
export const SLOW_WORLD = 0.5;
/** Under fast forward, everything runs this many times as fast. */
export const FAST_FORWARD = 2;
/** The barrier fast forward puts round each hero, as a share of their health. */
export const FAST_BARRIER = 0.2;
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

/** The most kinds of power a player takes on a raid, retries aside. */
export const SHARD_PICKS = 3;

/**
 * What a player takes on a raid: the powers they picked that they still have (or, if none, the
 * first three they have), up to three, and all their retries.
 */
export function packShards(owned: Shards, picks: readonly TimePower[] = []): Shards {
  const have = (p: TimePower) => p !== "retry" && (owned[p] ?? 0) > 0;
  const picked = picks.filter(have);
  const powers = picked.length > 0 ? picked : TIME_POWERS.filter(have);
  const pack: Shards = {};
  for (const power of powers.slice(0, SHARD_PICKS)) pack[power] = owned[power];
  if ((owned.retry ?? 0) > 0) pack.retry = owned.retry;
  return pack;
}

/** Picks or drops a power from the three taken on raids. */
export function togglePick(picks: readonly TimePower[], power: TimePower): TimePower[] {
  if (power === "retry") return [...picks];
  if (picks.includes(power)) return picks.filter((p) => p !== power);
  return [...picks, power].slice(-SHARD_PICKS);
}

export function readPicks(value: unknown): TimePower[] {
  if (!Array.isArray(value)) return [];
  return TIME_POWERS.filter((p) => p !== "retry" && value.includes(p)).slice(0, SHARD_PICKS);
}

/**
 * The retries a crew can use on a raid: a slot for each crewmate attacking, or for each member of
 * the crew when someone goes alone, each filled from the retry shards they brought.
 */
export function retrySlots(brought: readonly number[], crewSize: number): number {
  if (brought.length === 1) return Math.min(brought[0] ?? 0, Math.max(1, crewSize));
  return brought.reduce((sum, n) => sum + Math.min(1, n), 0);
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
