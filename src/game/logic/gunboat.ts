// The gunboat: moored off the landing beach, with one radio. Any hero can call it up from wherever
// they stand, then aims anywhere on the island and spends the crew's shared energy. They stay
// where they are while they do, standing still and in the line of fire.

export type Ability = "artillery" | "barrage" | "heal";

export const ABILITY_ORDER: readonly Ability[] = ["artillery", "barrage", "heal"];

export interface AbilitySpec {
  label: string;
  baseCost: number;
  /** Each use makes the next one cost this much more energy. */
  costStep: number;
}

export const ABILITIES: Record<Ability, AbilitySpec> = {
  artillery: { label: "Artillery", baseCost: 3, costStep: 1 },
  barrage: { label: "Barrage", baseCost: 6, costStep: 2 },
  heal: { label: "Heal", baseCost: 4, costStep: 1 },
};

export const ARTILLERY = { damage: 550, splash: 3.2 };
export const BARRAGE = { damage: 210, splash: 2.4, shells: 6, spread: 4.5, stagger: 0.12 };
export const HEAL = { radius: 5.5, healPerSecond: 150, duration: 3 };

export const START_ENERGY = 10;

export function abilityCost(ability: Ability, uses: number): number {
  const spec = ABILITIES[ability];
  return spec.baseCost + spec.costStep * uses;
}

/** Seconds a boat shell takes to reach its target. */
export function boatShellFlightTime(distance: number): number {
  return 1.1 + distance / 45;
}
