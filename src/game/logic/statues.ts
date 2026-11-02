// The four ancient statues, hidden in the forest and rocks of every crew's island. Nature turns up
// first, then ice, fire and dark, each deeper into the overgrowth, so the order can't be skipped.
// Each takes 10 of its crystal, 5,000 stone and two days to restore, then blesses the base for
// good. No engine imports.

import { CRYSTAL_KINDS, type CrystalKind } from "./crystals";
import { createRng } from "./rng";

export const STATUE_CRYSTALS = 10;
export const STATUE_STONE = 5000;
export const STATUE_MS = 2 * 24 * 3600 * 1000;

export interface StatueInfo {
  name: string;
  /** What it does once restored. */
  boon: string;
  /** What an old carving says about where it lies. */
  clue: string;
}

export const STATUES: Record<CrystalKind, StatueInfo> = {
  nature: {
    name: "Statue of Nature",
    boon: "Buildings have 15% more health.",
    clue: "among the rocks, not far beyond your first clearing",
  },
  ice: {
    name: "Statue of Ice",
    boon: "20% more resources from your mills, and 20% more plunder from raids.",
    clue: "deep in the forest, where the chainsaw has to go",
  },
  fire: {
    name: "Statue of Fire",
    boon: "Defenses deal 15% more damage.",
    clue: "among the high rocks, a long way from the headquarters",
  },
  dark: {
    name: "Statue of the Deep",
    boon: "Better odds of crystals, blueprints and treasure on every raid.",
    clue: "at the very edge of the island, past everything else",
  },
};

export interface StatueState {
  /** Found by clearing the patch hiding it. */
  found: boolean;
  /** Crystals offered so far: any crewmate can give some. */
  crystals: number;
  /** When restoration finishes, once it's begun (server time, milliseconds). */
  doneAt: number | null;
  restored: boolean;
}

export type Statues = Record<CrystalKind, StatueState>;

export function newStatues(): Statues {
  const blank = (): StatueState => ({ found: false, crystals: 0, doneAt: null, restored: false });
  return { nature: blank(), ice: blank(), fire: blank(), dark: blank() };
}

/** What a crew's restored statues add up to. Multipliers are 1 without them. */
export interface StatueBuffs {
  health: number;
  damage: number;
  production: number;
  plunder: number;
  /** Multiplies the odds of crystals, blueprints and treasure. */
  luck: number;
}

export function statueBuffs(statues: Statues | undefined): StatueBuffs {
  const on = (k: CrystalKind) => statues?.[k].restored === true;
  return {
    health: on("nature") ? 1.15 : 1,
    damage: on("fire") ? 1.15 : 1,
    production: on("ice") ? 1.2 : 1,
    plunder: on("ice") ? 1.2 : 1,
    luck: on("dark") ? 1.4 : 1,
  };
}

/** The statue before this one in the order they're found. */
export function statueBefore(kind: CrystalKind): CrystalKind | null {
  return CRYSTAL_KINDS[CRYSTAL_KINDS.indexOf(kind) - 1] ?? null;
}

interface Patch {
  id: string;
  kind: string;
  tier: number;
}

/** What hides each statue: the kind of overgrowth, and how far out. */
const HIDING: Record<CrystalKind, { kinds: readonly string[]; tier: number }> = {
  nature: { kinds: ["rocks"], tier: 2 },
  ice: { kinds: ["jungle"], tier: 3 },
  fire: { kinds: ["rocks"], tier: 4 },
  dark: { kinds: ["rocks", "jungle"], tier: 5 },
};

/** Which patch hides each statue: different on every crew's island, and the same on every phone. */
export function statueSpots(
  seed: number,
  patches: readonly Patch[],
): Partial<Record<CrystalKind, string>> {
  const rng = createRng(seed ^ 0x57a7);
  const spots: Partial<Record<CrystalKind, string>> = {};
  for (const kind of CRYSTAL_KINDS) {
    const { kinds, tier } = HIDING[kind];
    let places = patches.filter((p) => p.tier === tier && kinds.includes(p.kind));
    // Every island has plenty of these, but a statue must never go missing.
    if (places.length === 0) places = patches.filter((p) => p.tier === tier);
    const pick = places[Math.floor(rng() * places.length)];
    if (pick) spots[kind] = pick.id;
  }
  return spots;
}

/** Reads untrusted saved statues. */
export function readStatues(value: unknown): Statues {
  const out = newStatues();
  const raw = (value ?? {}) as Partial<Record<CrystalKind, Partial<StatueState>>>;
  for (const kind of CRYSTAL_KINDS) {
    const v = raw[kind];
    if (!v || typeof v !== "object") continue;
    const crystals = typeof v.crystals === "number" ? Math.floor(v.crystals) : 0;
    out[kind] = {
      found: v.found === true,
      crystals: Math.max(0, Math.min(STATUE_CRYSTALS, crystals)),
      doneAt: typeof v.doneAt === "number" && Number.isFinite(v.doneAt) ? v.doneAt : null,
      restored: v.restored === true,
    };
  }
  return out;
}
