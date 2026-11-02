// What a won raid turns up beyond its gold: crystals from the headquarters, a blueprint for a
// defense the crew hasn't worked out yet, and now and then a treasure chest. Only raider bases have
// blueprints to find: a rival crew doesn't leave theirs lying about. No engine imports.

import type { BuildingType } from "./buildings";
import type { CrystalCost, CrystalKind } from "./crystals";
import { createRng } from "./rng";
import type { Difficulty } from "./worldMap";

/** Defenses a crew has to discover. The gun turret needs no blueprint, so nobody's defenseless. */
export const BLUEPRINT_TYPES: readonly BuildingType[] = [
  "mortar",
  "landmine",
  "watchtower",
  "harpoon",
  "flamethrower",
];

export function needsBlueprint(type: BuildingType): boolean {
  return BLUEPRINT_TYPES.includes(type);
}

/** Crystals on a win: always the low number, and the odds of each one past it. */
const CRYSTALS: Record<Difficulty, { least: number; extra: readonly number[] }> = {
  Easy: { least: 0, extra: [0.5] },
  Fair: { least: 1, extra: [] },
  Hard: { least: 1, extra: [0.5] },
  Deadly: { least: 1, extra: [0.6, 0.35] },
};

const BLUEPRINT_CHANCE = 0.35;
/** Each win without one makes the next likelier, and this many in a row guarantees it. */
const DROUGHT_CHANCE = 0.2;
const DROUGHT_LIMIT = 3;
const CHEST_CHANCE = 0.05;
const CHEST_GOLD = 400;

export interface SpoilsRoll {
  seed: number;
  difficulty: Difficulty;
  /** The crystal this island holds. */
  crystal: CrystalKind;
  /** Raider bases only; empty for a rival crew's. */
  defenses: readonly BuildingType[];
  /** The crew's known blueprints. */
  known: readonly BuildingType[];
  /** Wins since the last blueprint. */
  drought: number;
  /** The player's first ever win, which always shows them how this works. */
  firstWin: boolean;
  /** From the Statue of the Deep. */
  luck: number;
  tier: number;
}

export interface Spoils {
  crystals: CrystalCost;
  blueprint: BuildingType | null;
  /** Gold from a treasure chest. */
  chest: number;
}

export function rollSpoils(roll: SpoilsRoll): Spoils {
  const rng = createRng(roll.seed ^ 0x600d);
  const table = CRYSTALS[roll.difficulty];
  let count = Math.max(table.least, roll.firstWin ? 1 : 0);
  for (const chance of table.extra) if (rng() < chance * roll.luck) count++;
  const crystals: CrystalCost = count > 0 ? { [roll.crystal]: count } : {};

  const unknown = BLUEPRINT_TYPES.filter(
    (t) => roll.defenses.includes(t) && !roll.known.includes(t),
  );
  const chance = (BLUEPRINT_CHANCE + DROUGHT_CHANCE * roll.drought) * roll.luck;
  const sure = roll.firstWin || roll.drought >= DROUGHT_LIMIT;
  // Roll even with nothing to find, so what's found doesn't change the rest of the spoils.
  const found = rng() < chance || sure;
  const blueprint = found ? (unknown[Math.floor(rng() * unknown.length)] ?? null) : null;
  const chest = rng() < CHEST_CHANCE * roll.luck ? CHEST_GOLD * roll.tier : 0;
  return { crystals, blueprint, chest };
}
