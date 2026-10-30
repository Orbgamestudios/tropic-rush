// Personal hero progress: each player's heroes level up with gold won on raids, and medals from
// victories unlock the heroes beyond the starting three. Levels add health and damage.
// Draft numbers, not balanced yet. No engine imports.

import { HEROES, type HeroAttack, type HeroKind, STARTER_HEROES } from "./heroes";

export const MAX_HERO_LEVEL = 10;

/** Display names for the hero cards. */
export const HERO_NAMES: Record<HeroKind, string> = {
  rifleman: "Sgt. Steele",
  medic: "Doc Penny",
  tank: "Tilly & Tank",
  heavy: "Big Mo",
  bazooka: "Ace",
  grenadier: "Mr. Pemberton",
  engineer: "Gus",
};

/** Medals needed to unlock each hero (starters are free). */
export const UNLOCK_MEDALS: Record<HeroKind, number> = {
  rifleman: 0,
  heavy: 0,
  medic: 0,
  grenadier: 2,
  bazooka: 3,
  engineer: 4,
  tank: 6,
};

export function isStarter(kind: HeroKind): boolean {
  return STARTER_HEROES.includes(kind);
}

/** Health and damage multiplier at a level: +8% per level. */
export function heroPower(level: number): number {
  return 1 + 0.08 * (Math.min(MAX_HERO_LEVEL, Math.max(1, level)) - 1);
}

/** Gold to go from `level` to `level + 1`. */
export function levelUpCost(level: number): number {
  return Math.round((120 * 1.55 ** (level - 1)) / 10) * 10;
}

/** Rough damage per second, for comparing heroes. */
export function damagePerSecond(attack: HeroAttack): number {
  switch (attack.kind) {
    case "burst":
      return (attack.damage * attack.shots) / attack.reload;
    case "minigun":
      return attack.damage / attack.fastInterval;
    case "shell":
    case "lob":
      return attack.damage / attack.reload;
    case "spray":
      return attack.damage / attack.reload;
  }
}

export interface HeroStats {
  hp: number;
  dps: number;
  speed: number;
  range: number;
}

export function heroStats(kind: HeroKind, level: number): HeroStats {
  const spec = HEROES[kind];
  const power = heroPower(level);
  return {
    hp: Math.round(spec.hp * power),
    dps: Math.round(damagePerSecond(spec.attack) * power),
    speed: spec.speed,
    range: spec.attack.range,
  };
}

/** Each stat as 0..1 against the strongest hero at max level, for the stat bars. */
export function statBars(kind: HeroKind, level: number): HeroStats {
  const kinds = Object.keys(HEROES) as HeroKind[];
  const best = kinds.map((k) => heroStats(k, MAX_HERO_LEVEL));
  const max = (pick: (s: HeroStats) => number) => Math.max(...best.map(pick));
  const s = heroStats(kind, level);
  return {
    hp: s.hp / max((x) => x.hp),
    dps: s.dps / max((x) => x.dps),
    speed: s.speed / max((x) => x.speed),
    range: s.range / max((x) => x.range),
  };
}

export interface RaidReward {
  gold: number;
  medals: number;
  /** 0 to 3 stars: 50% destroyed, the headquarters down (a win), everything destroyed. */
  stars: number;
}

/** What a raid pays out, from how much was destroyed and the island's HQ level. */
export function raidReward(
  won: boolean,
  destroyedPercent: number,
  islandLevel: number,
): RaidReward {
  const stars =
    (destroyedPercent >= 50 ? 1 : 0) + (won ? 1 : 0) + (destroyedPercent >= 100 ? 1 : 0);
  const gold = Math.round(destroyedPercent * 2 * islandLevel + (won ? 150 * islandLevel : 0));
  return { gold, medals: won ? islandLevel : 0, stars };
}
