// The gunboat: moored off the landing beach, with one radio. Any hero can call it up from wherever
// they stand, then aims anywhere on the island and spends the crew's shared energy. They stay
// where they are while they do, standing still and in the line of fire.

export type Ability = "artillery" | "heal" | "shock" | "barrage" | "smoke";

/** In the order a crew gets them: the first from the start, the rest by blueprint. */
export const ABILITY_ORDER: readonly Ability[] = ["artillery", "heal", "shock", "barrage", "smoke"];

export interface AbilitySpec {
  /** Short enough for its button. */
  label: string;
  name: string;
  text: string;
  baseCost: number;
  /** Each use makes the next one cost this much more energy. */
  costStep: number;
}

export const ABILITIES: Record<Ability, AbilitySpec> = {
  artillery: {
    label: "Artillery",
    name: "Artillery",
    text: "One big shell, anywhere on the island.",
    baseCost: 3,
    costStep: 1,
  },
  heal: {
    label: "Medkit",
    name: "Medkit",
    text: "Heals everyone in a circle.",
    baseCost: 4,
    costStep: 1,
  },
  shock: {
    label: "Shock",
    name: "Shock Grenade",
    text: "Stuns every defense in a wide circle for 4 seconds.",
    baseCost: 5,
    costStep: 2,
  },
  barrage: {
    label: "Barrage",
    name: "Barrage",
    text: "Six shells across an area.",
    baseCost: 6,
    costStep: 2,
  },
  smoke: {
    label: "Smoke",
    name: "Smokescreen",
    text: "Hides heroes in a wide circle for 10 seconds.",
    baseCost: 4,
    costStep: 2,
  },
};

export const ARTILLERY = { damage: 550, splash: 3.2 };
export const BARRAGE = { damage: 210, splash: 2.4, shells: 6, spread: 4.5, stagger: 0.12 };
export const HEAL = { radius: 5.5, healPerSecond: 150, duration: 3 };
/** Both are 6 tiles across, at 2 meters a tile. */
export const SHOCK = { radius: 6, seconds: 4 };
export const SMOKE = { radius: 6, seconds: 10 };

export const START_ENERGY = 10;

export function abilityCost(ability: Ability, uses: number): number {
  const spec = ABILITIES[ability];
  return spec.baseCost + spec.costStep * uses;
}

/** Seconds a boat shell takes to reach its target. */
export function boatShellFlightTime(distance: number): number {
  return 1.1 + distance / 45;
}
