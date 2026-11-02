// Personal hero progress: each player's heroes level up with gold won on raids, and medals from
// victories unlock the heroes beyond the starting three. Every level adds health and damage, and
// levels 3, 5, 7 and 10 each award a perk of that hero's own. Level 5 is the hero's signature
// move, a new way to play that no one else has, and level 10 makes it stronger.
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

/** What perks change, added up. Multipliers default to 1, additions to 0. */
export interface PerkMods {
  damage: number;
  /** Time between shots: below 1 fires faster. */
  reload: number;
  speed: number;
  hp: number;
  /** Extra shots in a burst. */
  shots: number;
  /** Extra range in meters. */
  range: number;
  /** The tier of the hero's signature move: 0 none, 1 at level 5, 2 at level 10. */
  signature: number;
}

export const NO_PERKS: PerkMods = {
  damage: 1,
  reload: 1,
  speed: 1,
  hp: 1,
  shots: 0,
  range: 0,
  signature: 0,
};

export interface Perk {
  level: number;
  name: string;
  text: string;
  mods: Partial<PerkMods>;
}

/** Levels that award a perk. */
export const PERK_LEVELS = [3, 5, 7, 10] as const;

export const PERKS: Record<HeroKind, readonly Perk[]> = {
  rifleman: [
    { level: 3, name: "Steady hands", text: "One more shot in every burst.", mods: { shots: 1 } },
    {
      level: 5,
      name: "Ricochet",
      text: "Bullets bounce off a building into the next one.",
      mods: { signature: 1 },
    },
    { level: 7, name: "Long barrel", text: "3 m more range.", mods: { range: 3 } },
    {
      level: 10,
      name: "Legend of the beach",
      text: "Ricochets bounce twice, and another shot per burst.",
      mods: { signature: 1, shots: 1 },
    },
  ],
  medic: [
    { level: 3, name: "Good arm", text: "3 m more throwing range.", mods: { range: 3 } },
    {
      level: 5,
      name: "Guardian angel",
      text: "Once a raid, a hero who falls gets back up.",
      mods: { signature: 1 },
    },
    { level: 7, name: "Iron stomach", text: "30% more health.", mods: { hp: 1.3 } },
    {
      level: 10,
      name: "Miracle worker",
      text: "Guardian angel works twice a raid, and throws 25% faster.",
      mods: { signature: 1, reload: 0.75 },
    },
  ],
  heavy: [
    { level: 3, name: "Hot barrels", text: "Fires 15% faster.", mods: { reload: 0.85 } },
    {
      level: 5,
      name: "Explosive belt",
      text: "At full spin, every 8th round explodes.",
      mods: { signature: 1 },
    },
    { level: 7, name: "Thick skin", text: "30% more health.", mods: { hp: 1.3 } },
    {
      level: 10,
      name: "Big Mo's big day",
      text: "Every 5th round explodes, and moves 20% quicker.",
      mods: { signature: 1, speed: 1.2 },
    },
  ],
  bazooka: [
    { level: 3, name: "Quick loader", text: "Reloads 20% faster.", mods: { reload: 0.8 } },
    {
      level: 5,
      name: "Cluster warhead",
      text: "Rockets throw out 3 bomblets where they burst.",
      mods: { signature: 1 },
    },
    { level: 7, name: "Long tube", text: "3 m more range.", mods: { range: 3 } },
    {
      level: 10,
      name: "Danger close",
      text: "5 bomblets a rocket, and reloads 15% faster again.",
      mods: { signature: 1, reload: 0.85 },
    },
  ],
  grenadier: [
    { level: 3, name: "Strong arm", text: "3 m more range.", mods: { range: 3 } },
    {
      level: 5,
      name: "Skipping stone",
      text: "Grenades skip on for a second blast.",
      mods: { signature: 1 },
    },
    { level: 7, name: "Quick pin", text: "Throws 20% faster.", mods: { reload: 0.8 } },
    {
      level: 10,
      name: "Stiff upper lip",
      text: "Grenades skip twice, and 40% more health.",
      mods: { signature: 1, hp: 1.4 },
    },
  ],
  engineer: [
    { level: 3, name: "Spare parts", text: "Works 20% faster.", mods: { reload: 0.8 } },
    {
      level: 5,
      name: "Salvage",
      text: "Every building you destroy comes back as your turret, for a while.",
      mods: { signature: 1 },
    },
    { level: 7, name: "Hard hat", text: "30% more health.", mods: { hp: 1.3 } },
    {
      level: 10,
      name: "Master mechanic",
      text: "Salvaged turrets last the full time, and 25% more damage.",
      mods: { signature: 1, damage: 1.25 },
    },
  ],
  tank: [
    { level: 3, name: "Extra plating", text: "25% more health.", mods: { hp: 1.25 } },
    {
      level: 5,
      name: "Aftershock",
      text: "Whatever you destroy goes up in a shockwave that can set off the next.",
      mods: { signature: 1 },
    },
    { level: 7, name: "Autoloader", text: "Fires 25% faster.", mods: { reload: 0.75 } },
    {
      level: 10,
      name: "Tilly's pride",
      text: "A far bigger shockwave, and fires 15% faster again.",
      mods: { signature: 1, reload: 0.85 },
    },
  ],
};

/** Everything a hero's perks add up to at a level. */
export function perkMods(kind: HeroKind, level: number): PerkMods {
  const out = { ...NO_PERKS };
  for (const perk of PERKS[kind]) {
    if (perk.level > level) continue;
    const m = perk.mods;
    out.damage *= m.damage ?? 1;
    out.reload *= m.reload ?? 1;
    out.speed *= m.speed ?? 1;
    out.hp *= m.hp ?? 1;
    out.shots += m.shots ?? 0;
    out.range += m.range ?? 0;
    out.signature += m.signature ?? 0;
  }
  return out;
}

/** Whether a perk brings or strengthens the hero's signature move. */
export function isSignature(perk: Perk): boolean {
  return (perk.mods.signature ?? 0) > 0;
}

/** The perk a hero gets on reaching exactly this level, if any. */
export function perkAt(kind: HeroKind, level: number): Perk | undefined {
  return PERKS[kind].find((p) => p.level === level);
}

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

export function heroStats(kind: HeroKind, level: number): HeroStats {
  const spec = HEROES[kind];
  const power = heroPower(level);
  const mods = perkMods(kind, level);
  const dps = damagePerSecond(spec.attack) * power * mods.damage;
  return {
    hp: Math.round(spec.hp * power * mods.hp),
    dps: Math.round(dps / mods.reload),
    speed: spec.speed * mods.speed,
    range: spec.attack.range + mods.range,
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
