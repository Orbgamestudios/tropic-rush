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

/** The weapons a crew has, and what level each is at. */
export type Arsenal = Partial<Record<Ability, number>>;

export const FULL_ARSENAL: Arsenal = { artillery: 1, heal: 1, shock: 1, barrage: 1, smoke: 1 };

/** The headquarters level each level of a weapon needs: 3 or 4 more, each time. */
export const WEAPON_LEVEL_HQ = [1, 4, 8, 11, 15, 18] as const;
export const MAX_WEAPON_LEVEL = WEAPON_LEVEL_HQ.length;
const WEAPON_LEVEL_GOLD = [0, 400, 800, 1500, 2500, 4000] as const;

/** Gold to take a weapon up from this level to the next. */
export function weaponUpGold(level: number): number {
  return WEAPON_LEVEL_GOLD[level] ?? 0;
}

/** What each level adds to a weapon. */
export const WEAPON_GAIN: Record<Ability, string> = {
  artillery: "+15% damage a level",
  heal: "+15% healing a level",
  shock: "+0.5 seconds of stun a level",
  barrage: "+15% damage a level",
  smoke: "+1.5 seconds of cover a level",
};

/** How much harder a weapon hits or heals at a level. */
export function weaponPower(level: number): number {
  return 1 + 0.15 * (level - 1);
}

export function stunSeconds(level: number): number {
  return SHOCK.seconds + 0.5 * (level - 1);
}

export function smokeSeconds(level: number): number {
  return SMOKE.seconds + 1.5 * (level - 1);
}

export function abilityCost(ability: Ability, uses: number): number {
  const spec = ABILITIES[ability];
  return spec.baseCost + spec.costStep * uses;
}

/** Seconds a boat shell takes to reach its target. */
export function boatShellFlightTime(distance: number): number {
  return 1.1 + distance / 45;
}
