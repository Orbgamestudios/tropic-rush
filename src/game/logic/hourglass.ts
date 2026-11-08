// The Hourglass: a ruin deep in the crew island's forest where the old wise ones broke crystals into
// time shards (docs/STORY.md). The crew finds it by clearing the jungle hiding it and mends it
// together, with stone and gold and a day's work. Once it's whole, each player can break their own
// crystals there into shards of the power they choose. No engine imports.

import { CRYSTAL_KINDS, type CrystalKind, type Crystals } from "./crystals";
import type { Purse } from "./economy";
import { createRng, type Rng } from "./rng";
import { type Shards, shardsFromCrystal, type TimePower } from "./timeShards";

export const HOURGLASS_COST: Partial<Purse> = { stone: 6000, gold: 3000 };
export const HOURGLASS_MS = 24 * 3600 * 1000;

export interface HourglassState {
  /** Found by clearing the jungle hiding it. */
  found: boolean;
  /** When the mending's done, once it's begun (server time, milliseconds). */
  doneAt: number | null;
  mended: boolean;
}

export function newHourglass(): HourglassState {
  return { found: false, doneAt: null, mended: false };
}

/** Reads an untrusted saved Hourglass. */
export function readHourglass(value: unknown): HourglassState {
  const v = (value ?? {}) as Partial<HourglassState>;
  return {
    found: v.found === true,
    doneAt: typeof v.doneAt === "number" && Number.isFinite(v.doneAt) ? v.doneAt : null,
    mended: v.mended === true,
  };
}

interface Patch {
  id: string;
  kind: string;
  tier: number;
}

/**
 * The jungle patch hiding the Hourglass: deep in the forest, where a chainsaw has to go, and never
 * one of the statues' patches. Different on every crew's island, and the same on every phone.
 */
export function hourglassSpot(
  seed: number,
  patches: readonly Patch[],
  taken: readonly string[],
): string | undefined {
  const rng = createRng(seed ^ 0x40c1a55);
  const free = patches.filter((p) => !taken.includes(p.id));
  let places = free.filter((p) => p.kind === "jungle" && p.tier === 3);
  if (places.length === 0) places = free.filter((p) => p.tier === 3);
  if (places.length === 0) places = free;
  return places[Math.floor(rng() * places.length)]?.id;
}

/** Why a crystal can't be broken here, or null if it can. */
export function breakBlocker(
  hourglass: HourglassState,
  crystals: Crystals,
  kind: CrystalKind,
): string | null {
  if (!hourglass.found) return "Find the Hourglass first";
  if (!hourglass.mended) return "Mend the Hourglass first";
  if (crystals[kind] <= 0) return "No crystals of that kind";
  return null;
}

/** Breaks one crystal into shards of the chosen power: usually 2 to 4, now and then 1 or 5. */
export function breakCrystal(
  crystals: Crystals,
  shards: Shards,
  kind: CrystalKind,
  power: TimePower,
  rng: Rng = Math.random,
): { crystals: Crystals; shards: Shards; made: number } {
  const made = shardsFromCrystal(rng);
  return {
    crystals: { ...crystals, [kind]: crystals[kind] - 1 },
    shards: { ...shards, [power]: (shards[power] ?? 0) + made },
    made,
  };
}

/** The crystal a player has most of, to break first. */
export function plentiest(crystals: Crystals): CrystalKind {
  return CRYSTAL_KINDS.reduce((a, b) => (crystals[b] > crystals[a] ? b : a));
}
