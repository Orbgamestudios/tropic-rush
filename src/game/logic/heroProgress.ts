// Personal hero progress: new heroes join as the crew's headquarters grows, and each hero grows
// through their upgrade tree (heroTrees.ts), bought with gold and crystals won on raids. No engine
// imports.

import { HERO_KINDS, HEROES, type HeroAttack, type HeroKind, STARTER_HEROES } from "./heroes";
import { heroMods, heroTree, UPGRADES_PER_HERO } from "./heroTrees";

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

/**
 * The headquarters level each hero joins at. A stand-in for the story arc that will bring them
 * in later.
 */
export const HERO_UNLOCK_HQ: Record<HeroKind, number> = {
  rifleman: 1,
  heavy: 3,
  medic: 6,
  grenadier: 9,
  bazooka: 12,
  engineer: 15,
  tank: 18,
};

/** The heroes a headquarters of this level has: only the level counts, whatever a save says. */
export function heroesAt(hq: number): HeroKind[] {
  return HERO_KINDS.filter((k) => HERO_UNLOCK_HQ[k] <= hq);
}

/** Who a headquarters of this level adds to `unlocked`. */
export function heroesJoining(unlocked: readonly HeroKind[], hq: number): HeroKind[] {
  return heroesAt(hq).filter((k) => !unlocked.includes(k));
}

export function isStarter(kind: HeroKind): boolean {
  return STARTER_HEROES.includes(kind);
}

/** What hero levels used to cost: saves from then get all of it back as gold. */
export function oldLevelRefund(levels: Record<string, unknown>): number {
  let gold = 0;
  for (const kind of HERO_KINDS) {
    const level = levels[kind];
    if (typeof level !== "number") continue;
    const top = Math.min(10, Math.floor(level));
    for (let l = 1; l < top; l++) gold += Math.round((120 * 1.55 ** (l - 1)) / 10) * 10;
  }
  return gold;
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
    case "heal":
      return attack.heal / attack.reload;
  }
}

export interface HeroStats {
  hp: number;
  dps: number;
  speed: number;
  range: number;
}

export function heroStats(kind: HeroKind, owned: readonly string[]): HeroStats {
  const spec = HEROES[kind];
  const mods = heroMods(kind, owned);
  const { attack } = spec;
  const shots =
    attack.kind === "burst"
      ? (attack.shots + mods.shots) / attack.shots
      : attack.kind === "heal"
        ? mods.heal
        : 1;
  const dps = damagePerSecond(attack) * mods.damage * shots;
  return {
    hp: Math.round(spec.hp * mods.hp),
    dps: Math.round(dps / mods.reload),
    speed: spec.speed * mods.speed,
    range: attack.range + mods.range,
  };
}

/** Each stat as 0..1 against the strongest any hero can get, for the stat bars. */
export function statBars(kind: HeroKind, owned: readonly string[]): HeroStats {
  const best = HERO_KINDS.map((k) =>
    heroStats(
      k,
      heroTree(k).map((u) => u.id),
    ),
  );
  const max = (pick: (s: HeroStats) => number) => Math.max(...best.map(pick));
  const s = heroStats(kind, owned);
  return {
    hp: s.hp / max((x) => x.hp),
    dps: s.dps / max((x) => x.dps),
    speed: s.speed / max((x) => x.speed),
    range: s.range / max((x) => x.range),
  };
}

/** How far along their tree a hero is, for the little badge on their portrait. */
export function treeProgress(owned: readonly string[]): string {
  return `${owned.length}/${UPGRADES_PER_HERO}`;
}

export interface RaidReward {
  gold: number;
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
  return { gold, stars };
}
