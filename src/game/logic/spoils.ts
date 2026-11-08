// What a won raid turns up beyond its gold: crystals from the headquarters, a blueprint for a
// defense or gunboat weapon the crew hasn't worked out yet, and now and then a treasure chest. Only
// raider bases have blueprints to find: a rival crew doesn't leave theirs lying about. Blueprints
// go to the crew, who turn them into the real thing at the laboratory. No engine imports.

import { BUILDINGS, type BuildingType } from "./buildings";
import type { CrystalCost, CrystalKind } from "./crystals";
import type { Difficulty } from "./difficulty";
import { ABILITIES, ABILITY_ORDER, type Ability, STARTING_WEAPONS } from "./gunboat";
import { createRng } from "./rng";

export type Blueprint = BuildingType | Ability;

/** Defenses a crew has to discover. The gun turret needs no blueprint, so nobody's defenseless. */
export const DEFENSE_BLUEPRINTS: readonly BuildingType[] = [
  "mortar",
  "landmine",
  "watchtower",
  "harpoon",
  "flamethrower",
];

/** Gunboat weapons to discover, one after another. */
export const GUNBOAT_BLUEPRINTS: readonly Ability[] = ABILITY_ORDER.filter(
  (a) => !STARTING_WEAPONS.includes(a),
);

export const BLUEPRINT_TYPES: readonly Blueprint[] = [...DEFENSE_BLUEPRINTS, ...GUNBOAT_BLUEPRINTS];

export function needsBlueprint(type: BuildingType): boolean {
  return DEFENSE_BLUEPRINTS.includes(type);
}

export function isWeapon(type: Blueprint): type is Ability {
  return (ABILITY_ORDER as readonly Blueprint[]).includes(type);
}

export function blueprintName(type: Blueprint): string {
  return isWeapon(type) ? ABILITIES[type].name : BUILDINGS[type].label;
}

/** The gunboat weapon that can turn up next: they're found in order. */
export function nextWeapon(known: readonly Blueprint[]): Ability | null {
  return GUNBOAT_BLUEPRINTS.find((w) => !known.includes(w)) ?? null;
}

/** Crystals on a win: always the low number, and the odds of each one past it. */
const CRYSTALS: Record<Difficulty, { least: number; extra: readonly number[] }> = {
  Easy: { least: 0, extra: [0.5] },
  Medium: { least: 1, extra: [] },
  Hard: { least: 1, extra: [0.5] },
  Extreme: { least: 1, extra: [0.6, 0.35] },
  Impossible: { least: 2, extra: [0.6, 0.4] },
};

/** The fewest and most crystals a win here can give, for the map to say. */
export function crystalRange(difficulty: Difficulty): [number, number] {
  const { least, extra } = CRYSTALS[difficulty];
  return [least, least + extra.length];
}

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
  known: readonly Blueprint[];
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
  blueprint: Blueprint | null;
  /** Gold from a treasure chest. */
  chest: number;
}

export function rollSpoils(roll: SpoilsRoll): Spoils {
  const rng = createRng(roll.seed ^ 0x600d);
  const table = CRYSTALS[roll.difficulty];
  let count = Math.max(table.least, roll.firstWin ? 1 : 0);
  for (const chance of table.extra) if (rng() < chance * roll.luck) count++;
  const crystals: CrystalCost = count > 0 ? { [roll.crystal]: count } : {};

  const weapon = roll.defenses.length > 0 ? nextWeapon(roll.known) : null;
  const unknown: Blueprint[] = DEFENSE_BLUEPRINTS.filter(
    (t) => roll.defenses.includes(t) && !roll.known.includes(t),
  );
  if (weapon) unknown.push(weapon);
  const chance = (BLUEPRINT_CHANCE + DROUGHT_CHANCE * roll.drought) * roll.luck;
  const sure = roll.firstWin || roll.drought >= DROUGHT_LIMIT;
  // Roll even with nothing to find, so what's found doesn't change the rest of the spoils.
  const found = rng() < chance || sure;
  const blueprint = found ? (unknown[Math.floor(rng() * unknown.length)] ?? null) : null;
  const chest = rng() < CHEST_CHANCE * roll.luck ? CHEST_GOLD * roll.tier : 0;
  return { crystals, blueprint, chest };
}
