// The four crystals: won from enemy headquarters, spent on hero upgrades and on restoring the
// ancient statues. Nature buys health, fire damage, ice speed and dark new abilities. No engine
// imports.

import { createRng } from "./rng";

export type CrystalKind = "nature" | "fire" | "ice" | "dark";

/** In the order the statues are found. */
export const CRYSTAL_KINDS: readonly CrystalKind[] = ["nature", "ice", "fire", "dark"];

export const CRYSTAL_LABELS: Record<CrystalKind, string> = {
  nature: "Nature",
  fire: "Fire",
  ice: "Ice",
  dark: "Dark",
};

export type Crystals = Record<CrystalKind, number>;
export type CrystalCost = Partial<Crystals>;

export function noCrystals(): Crystals {
  return { nature: 0, fire: 0, ice: 0, dark: 0 };
}

/** How the hero trees spend them, so bases drop them in about the same shares. */
const SHARES: readonly (readonly [CrystalKind, number])[] = [
  ["fire", 0.38],
  ["nature", 0.23],
  ["dark", 0.22],
  ["ice", 0.17],
];

/** The crystal an island's headquarters holds, shown on its card. */
export function islandCrystal(seed: number): CrystalKind {
  const roll = createRng(seed ^ 0x51ce)();
  let total = 0;
  for (const [kind, share] of SHARES) {
    total += share;
    if (roll < total) return kind;
  }
  return "fire";
}

export function canPayCrystals(wallet: Crystals, cost: CrystalCost): boolean {
  return CRYSTAL_KINDS.every((k) => wallet[k] >= (cost[k] ?? 0));
}

export function payCrystals(wallet: Crystals, cost: CrystalCost): Crystals {
  const out = { ...wallet };
  for (const k of CRYSTAL_KINDS) out[k] -= cost[k] ?? 0;
  return out;
}

export function addCrystals(wallet: Crystals, gained: CrystalCost): Crystals {
  const out = { ...wallet };
  for (const k of CRYSTAL_KINDS) out[k] += gained[k] ?? 0;
  return out;
}

/** Reads untrusted saved crystals. */
export function readCrystals(value: unknown): Crystals {
  const v = (value ?? {}) as Partial<Record<CrystalKind, unknown>>;
  const out = noCrystals();
  for (const k of CRYSTAL_KINDS) {
    const n = v[k];
    if (typeof n === "number" && Number.isFinite(n)) out[k] = Math.max(0, Math.floor(n));
  }
  return out;
}
