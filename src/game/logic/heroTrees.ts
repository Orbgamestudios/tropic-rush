// The hero upgrade trees (docs/HERO_TREES.md): a trunk of four upgrades up to headquarters 5, with two
// short side paths off its second, then two branches, Assault and Survival, which split again after
// headquarters 11 into the hero's four last branches, each with its own specials and capstone. An
// upgrade costs gold and the crystal of what it does: nature for staying alive, fire for hitting
// harder, ice for being quicker, and on the last branches whichever crystal the branch is. Three
// minis sit on each line between upgrades, bought with gold, each a little of something. Each tier
// opens at a headquarters level, so a hero is only as strong as the islands its crew can reach. No
// engine imports.

import { CRYSTAL_KINDS, type CrystalCost, type CrystalKind, type Crystals } from "./crystals";
import { HERO_KINDS, type HeroKind } from "./heroes";
import {
  branchTreeCost,
  OLD_CRYSTAL_ORDER,
  OLD_UPGRADE_COSTS,
  TRUNK_CHECKPOINT_GOLD,
} from "./oldTrees";

/** What a hero's upgrades add up to. Multipliers start at 1, additions and tricks at 0. */
export interface HeroMods {
  hp: number;
  damage: number;
  /** Time between shots: below 1 fires faster. */
  reload: number;
  /** Time between the bullets of a burst. */
  unload: number;
  speed: number;
  /** Extra shots in a burst. */
  shots: number;
  /** Extra blast radius in meters. */
  splash: number;
  heal: number;
  /** Extra damage to buildings of any kind, and on top of that to defenses. */
  buildingDamage: number;
  defenseDamage: number;
  /** Share of full speed while firing; 0 leaves the usual share. */
  fireSpeed: number;
  spinUp: number;
  spread: number;
  /** How long a throw stays in the air. */
  flight: number;
  /** How fast shots fly. */
  shotSpeed: number;
  damageTaken: number;
  blastTaken: number;
  /** Every nth shot or throw goes out double; 0 for none. */
  twinEvery: number;
  /** Share of full health healed on destroying a building. */
  healOnKill: number;
  /** The capstone that carries the hero's old signature move: 0 until it's owned. */
  signature: number;
  fieldDressing: boolean;
  lastStand: boolean;
  lingering: boolean;
  overheal: boolean;
  icePack: boolean;
  adrenaline: boolean;
  miracle: boolean;
  overdrive: boolean;
  harpoonProof: boolean;
  ironGut: boolean;
  berserk: boolean;
  fieldRepairs: boolean;
  siegeMode: boolean;
  napalm: boolean;
  getaway: boolean;
  doubleTap: boolean;
  guided: boolean;
  mineSweeper: boolean;
  smokeShell: boolean;
  overclock: boolean;
  pocketTurret: boolean;
  repairBeam: boolean;
  decoyDrone: boolean;
}

export const NO_MODS: HeroMods = {
  hp: 1,
  damage: 1,
  reload: 1,
  unload: 1,
  speed: 1,
  shots: 0,
  splash: 0,
  heal: 1,
  buildingDamage: 1,
  defenseDamage: 1,
  fireSpeed: 0,
  spinUp: 1,
  spread: 1,
  flight: 1,
  shotSpeed: 1,
  damageTaken: 1,
  blastTaken: 1,
  twinEvery: 0,
  healOnKill: 0,
  signature: 0,
  fieldDressing: false,
  lastStand: false,
  lingering: false,
  overheal: false,
  icePack: false,
  adrenaline: false,
  miracle: false,
  overdrive: false,
  harpoonProof: false,
  ironGut: false,
  berserk: false,
  fieldRepairs: false,
  siegeMode: false,
  napalm: false,
  getaway: false,
  doubleTap: false,
  guided: false,
  mineSweeper: false,
  smokeShell: false,
  overclock: false,
  pocketTurret: false,
  repairBeam: false,
  decoyDrone: false,
};

const MULTIPLIED = new Set<keyof HeroMods>([
  "hp",
  "damage",
  "reload",
  "unload",
  "speed",
  "heal",
  "buildingDamage",
  "defenseDamage",
  "spinUp",
  "spread",
  "flight",
  "shotSpeed",
  "damageTaken",
  "blastTaken",
]);

export type UpgradeIcon =
  | "heart"
  | "sword"
  | "crosshair"
  | "range"
  | "speed"
  | "shield"
  | "flame"
  | "grenade"
  | "medkit"
  | "heal"
  | "rocket"
  | "turret"
  | "smoke"
  | "energy"
  | "skull"
  | "star"
  | "clock"
  | "gear"
  | "hammer"
  | "barrage"
  | "artillery";

/** Where a mini sits: on the line between two upgrades, `at` of the way along it. */
export interface CheckpointSpot {
  from: string;
  to: string;
  at: number;
}

export interface TreeUpgrade {
  /** Stable forever: it's what the save keeps. */
  id: string;
  name: string;
  text: string;
  /** 1 to 10, or 0 for a mini. */
  tier: number;
  gold: number;
  crystals: CrystalCost;
  /** The headquarters level it can be bought from. */
  hq: number;
  /** Owning any one of these opens it up; empty for the first upgrade. */
  needs: readonly string[];
  mods: Partial<HeroMods>;
  icon: UpgradeIcon;
  /** The stretch of the tree it's on, for the screen. Null for the first upgrade. */
  path: string | null;
  /** Where it goes on the screen: 0 to 9 across, 0 to 3 down. */
  column: number;
  row: number;
  /** Null for an upgrade proper. */
  line: CheckpointSpot | null;
}

/** How far up the tree goes: the trunk to tier 4, two branches to 7, then four to 10. */
export const TIERS = 10;
const TRUNK_END = 4;
const SPLIT_END = 7;

/** Gold, crystals and the headquarters level each tier needs. */
const TIER_GOLD = [0, 150, 500, 900, 1400, 2200, 3200, 4400, 6000, 8000, 11000] as const;
const TIER_CRYSTALS = [0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 6] as const;
/**
 * A hero is only as strong as the islands its crew can reach: each tier opens at a headquarters
 * level, and the last only near the top.
 */
const TIER_HQ = [0, 1, 2, 3, 5, 7, 9, 11, 13, 16, 19] as const;

export function upgradeGold(tier: number): number {
  return TIER_GOLD[tier] ?? 0;
}

/** The headquarters level a tier opens at. */
export function tierHq(tier: number): number {
  return TIER_HQ[tier] ?? 1;
}

/** Gold for a mini, by the tier of the upgrade its line leads to. */
const MINI_GOLD = [0, 0, 150, 250, 400, 550, 750, 1000, 1300, 1700, 2200] as const;
/** How strong a mini is in percent, by the tier of the upgrade its line leads to. */
const MINI_PERCENT = [0, 0, 1.5, 1.5, 2, 2, 2, 2.5, 2.5, 2.5, 3] as const;
/** Percent for percent, these do far less than the rest, so they get twice as much. */
const SLIGHT_STAT = 2;
/** The Heavy's upgrades that make his gun stronger do this much of what everyone else's do. */
const HEAVY_GUN = 0.85;

/**
 * Where a line's minis sit along it: evenly on a straight line, and past the bend on one that bends
 * out to a branch, so two lines leaving one upgrade don't crowd their minis together.
 */
const ALONG_LINE: Record<"straight" | "out", readonly number[]> = {
  straight: [0.25, 0.5, 0.75],
  out: [0.4, 0.6, 0.8],
};
/** How far along a line it takes to bend round to its new row. */
const BEND = 0.3;

/** The line from one spot on the board to another, in columns and rows: a bend, then straight on. */
export function lineAt(
  from: { column: number; row: number },
  to: { column: number; row: number },
  t: number,
): { column: number; row: number } {
  const bend = Math.min(1, t / BEND);
  return {
    column: from.column + (to.column - from.column) * t,
    row: from.row + (to.row - from.row) * bend * bend * (3 - 2 * bend),
  };
}

type MiniStat =
  | "health"
  | "armor"
  | "blast"
  | "damage"
  | "defense"
  | "building"
  | "reload"
  | "speed"
  | "heal"
  | "weapon";

/** What the time between shots is called for each hero. */
const RELOAD_WORDS: Record<HeroKind, { name: string; verb: string }> = {
  rifleman: { name: "Quick Reload", verb: "Reloads" },
  medic: { name: "Quick Throw", verb: "Throws" },
  heavy: { name: "Hot Trigger", verb: "Fires" },
  tank: { name: "Quick Reload", verb: "Reloads" },
  bazooka: { name: "Quick Reload", verb: "Reloads" },
  grenadier: { name: "Quick Throw", verb: "Throws" },
  engineer: { name: "Hot Trigger", verb: "Fires" },
};

/** Names for each kind of mini, taken in turn up the tree, so the minis along a line differ. */
const MINI_NAMES: Record<Exclude<MiniStat, "reload" | "weapon">, readonly string[]> = {
  health: ["Toughness", "Stamina", "Thick Skin", "Second Breath", "Iron Lungs"],
  armor: ["Padding", "Hard Knocks", "Shrug It Off", "Battle Scars"],
  blast: ["Ear Plugs", "Hit the Dirt", "Blast Drill"],
  damage: ["Punch", "Hard Hitter", "Follow Through", "Heavy Hand", "Killer Instinct"],
  defense: ["Weak Spot", "Tower Breaker", "Crack Shot"],
  building: ["Wrecker", "Knock Down", "Demolition Drill"],
  speed: ["Fitness", "Light Feet", "Sprint Drill", "Long Strides"],
  heal: ["Strong Dose", "Kind Hands", "Fresh Bandages"],
};

/** The mini that makes each hero's own weapon quicker, and the stat it's on. */
const WEAPON_MINI: Record<
  HeroKind,
  {
    names: readonly string[];
    text: string;
    icon: UpgradeIcon;
    stat: "unload" | "spinUp" | "flight" | "shotSpeed";
  }
> = {
  rifleman: {
    names: ["Quick Unload", "Trigger Discipline"],
    text: "Bullets leave a burst {}% quicker.",
    icon: "barrage",
    stat: "unload",
  },
  medic: {
    names: ["Easy Lob", "Long Arm"],
    text: "Bottles land {}% sooner.",
    icon: "clock",
    stat: "flight",
  },
  heavy: {
    names: ["Spin Up", "Oiled Bearings"],
    text: "Spins up {}% faster.",
    icon: "gear",
    stat: "spinUp",
  },
  tank: {
    names: ["Hot Powder", "Hot Load"],
    text: "Shells fly {}% faster.",
    icon: "rocket",
    stat: "shotSpeed",
  },
  bazooka: {
    names: ["Hot Fuel", "Hot Load"],
    text: "Rockets fly {}% faster.",
    icon: "rocket",
    stat: "shotSpeed",
  },
  grenadier: {
    names: ["Easy Lob", "Long Arm"],
    text: "Grenades land {}% sooner.",
    icon: "clock",
    stat: "flight",
  },
  engineer: {
    names: ["Tight Springs", "Hot Load"],
    text: "Shots fly {}% faster.",
    icon: "gear",
    stat: "shotSpeed",
  },
};

/** A percent kept to a tenth, so what a card says is what it does. */
const tenth = (n: number) => Math.round(n * 10) / 10;

/** The Heavy's gun gets less from everything that makes guns stronger. */
function gunShare(kind: HeroKind, percent: number): number {
  return kind === "heavy" ? tenth(percent * HEAVY_GUN) : percent;
}

/** A mini: `nth` is how many of its kind come before it on the hero's tree, for its name. */
function mini(kind: HeroKind, stat: MiniStat, base: number, nth: number): Draft {
  const gun = stat === "damage" || stat === "reload" || (stat === "weapon" && kind === "heavy");
  const percent = gun ? gunShare(kind, base) : base;
  const slight = tenth(percent * SLIGHT_STAT);
  const more = 1 + percent / 100;
  const less = 1 - percent / 100;
  const pick = (names: readonly string[]) => names[nth % names.length] ?? "";
  switch (stat) {
    case "health":
      return up(pick(MINI_NAMES.health), `+${percent}% health.`, {}, "heart", { hp: more });
    case "armor":
      return up(pick(MINI_NAMES.armor), `Takes ${percent}% less damage.`, {}, "shield", {
        damageTaken: less,
      });
    case "blast":
      return up(pick(MINI_NAMES.blast), `Takes ${percent}% less from blasts.`, {}, "shield", {
        blastTaken: less,
      });
    case "damage":
      return up(pick(MINI_NAMES.damage), `+${percent}% damage.`, {}, "sword", { damage: more });
    case "defense":
      return up(pick(MINI_NAMES.defense), `+${percent}% damage to defenses.`, {}, "crosshair", {
        defenseDamage: more,
      });
    case "building":
      return up(pick(MINI_NAMES.building), `+${percent}% damage to buildings.`, {}, "hammer", {
        buildingDamage: more,
      });
    case "reload": {
      const { name, verb } = RELOAD_WORDS[kind];
      const names = [name, "Muscle Memory", "Rhythm", "Practice"];
      return up(pick(names), `${verb} ${percent}% faster.`, {}, "clock", {
        reload: less,
      });
    }
    case "speed":
      return up(pick(MINI_NAMES.speed), `+${percent}% move speed.`, {}, "speed", { speed: more });
    case "heal":
      return up(pick(MINI_NAMES.heal), `+${percent}% healing.`, {}, "heal", { heal: more });
    case "weapon": {
      const w = WEAPON_MINI[kind];
      const change = w.stat === "shotSpeed" ? 1 + slight / 100 : 1 - slight / 100;
      return up(pick(w.names), w.text.replace("{}", String(slight)), {}, w.icon, {
        [w.stat]: change,
      });
    }
  }
}

interface Draft {
  name: string;
  text: string;
  crystals: CrystalCost;
  icon: UpgradeIcon;
  mods: Partial<HeroMods>;
}

const up = (
  name: string,
  text: string,
  crystals: CrystalCost,
  icon: UpgradeIcon,
  mods: Partial<HeroMods>,
): Draft => ({ name, text, crystals, icon, mods });

/** A special upgrade: its crystals are set by where it lands on its branch. */
const special = (name: string, text: string, icon: UpgradeIcon, mods: Partial<HeroMods>): Draft =>
  up(name, text, {}, icon, mods);

/**
 * One of a hero's four last branches: what it's called, the special that opens it at tier 8, and
 * its capstone at the end.
 */
interface BranchDraft {
  name: string;
  opener: Draft;
  capstone: Draft;
}

interface TreeDraft {
  first: Draft;
  /** The four last branches, each with its crystal. */
  branches: Record<CrystalKind, BranchDraft>;
  /** The trunk's last upgrade: whatever makes this hero's weapon quicker. */
  quick: Draft;
  /** Midway up Assault, for heroes whose shots burst: a wider blast. */
  wide?: Draft;
  /** Midway up Survival, for a healer: stronger healing. */
  mend?: Draft;
  /** The ends of the two side paths off the trunk: one for knocking things down, one for lasting. */
  sapper: Draft;
  scrapper: Draft;
}

const TREES: Record<HeroKind, TreeDraft> = {
  rifleman: {
    first: up("Basic Training", "+10% health.", { nature: 1 }, "heart", { hp: 1.1 }),
    quick: special("Smooth Action", "Bullets leave a burst 20% quicker.", "barrage", {
      unload: 0.8,
    }),
    sapper: special("Hollow Points", "+15% damage to buildings.", "hammer", {
      buildingDamage: 1.15,
    }),
    scrapper: special("Scavenger", "Destroying a building heals 5%.", "medkit", {
      healOnKill: 0.05,
    }),
    branches: {
      nature: {
        name: "Survivor",
        opener: special("Thick Vest", "Takes 15% less damage.", "shield", { damageTaken: 0.85 }),
        capstone: special(
          "Last Stand",
          "Enrages below 30% health: fires 40% faster and takes 25% less damage.",
          "skull",
          { lastStand: true },
        ),
      },
      fire: {
        name: "Marksman",
        opener: special("Deadeye", "+25% damage to defenses.", "crosshair", {
          defenseDamage: 1.25,
        }),
        capstone: special("Steady Hands", "One more bullet in every burst.", "barrage", {
          shots: 1,
        }),
      },
      ice: {
        name: "Skirmisher",
        opener: special("Run and Gun", "Moves at 40% speed while firing, not 20%.", "speed", {
          fireSpeed: 0.4,
        }),
        capstone: special("Fast Unload", "Bursts fire 40% quicker.", "clock", { reload: 0.6 }),
      },
      dark: {
        name: "Veteran",
        opener: special(
          "Field Dressing",
          "Heals 3% a second after 4 seconds without being hit.",
          "medkit",
          { fieldDressing: true },
        ),
        capstone: special("Ricochet", "Bullets bounce off a building into the next one.", "star", {
          signature: 1,
        }),
      },
    },
  },
  medic: {
    first: up("Steady Hand", "+15% healing.", { nature: 1 }, "heal", { heal: 1.15 }),
    quick: special("Flat Throw", "Bottles land 15% sooner.", "clock", { flight: 0.85 }),
    mend: special("Strong Brew", "+12% healing.", "heal", { heal: 1.12 }),
    sapper: special("Big Bottles", "Bottles burst 0.5 m wider.", "range", { splash: 0.5 }),
    scrapper: special("Thick Gloves", "Takes 20% less from blasts.", "shield", { blastTaken: 0.8 }),
    branches: {
      nature: {
        name: "Field Hospital",
        opener: special(
          "Lingering Dose",
          "Healing carries on for 3 seconds after the bottle lands.",
          "clock",
          { lingering: true },
        ),
        capstone: special(
          "Overheal",
          "Healing past full health becomes a shield worth up to 20% health.",
          "shield",
          { overheal: true },
        ),
      },
      fire: {
        name: "Alchemist",
        opener: special("Wide Splash", "Bottles burst 1.5 m wider.", "range", { splash: 1.5 }),
        capstone: special(
          "Miracle Bottle",
          "Every 5th bottle heals double, and bursts twice as wide.",
          "skull",
          { miracle: true },
        ),
      },
      ice: {
        name: "Combat Medic",
        opener: special("Ice Pack", "Healed crewmates move 20% faster for 3 seconds.", "speed", {
          icePack: true,
        }),
        capstone: special(
          "Adrenaline",
          "Healed crewmates fire 20% faster for 3 seconds.",
          "energy",
          {
            adrenaline: true,
          },
        ),
      },
      dark: {
        name: "Guardian",
        opener: special("Corrosive Acid", "+25% damage to defenses.", "flame", {
          defenseDamage: 1.25,
        }),
        capstone: special(
          "Guardian Angel",
          "Twice a raid, a fallen hero gets back up with 40% health.",
          "star",
          { signature: 2 },
        ),
      },
    },
  },
  heavy: {
    first: up("Warm Up", "Minigun spins up 17% faster.", { fire: 1 }, "gear", { spinUp: 0.83 }),
    quick: special("Greased Barrels", "Spins up 17% faster.", "gear", { spinUp: 0.83 }),
    sapper: special("Steady Stance", "25% less spread.", "crosshair", { spread: 0.75 }),
    scrapper: special("Flak Vest", "Takes 20% less from blasts.", "shield", { blastTaken: 0.8 }),
    branches: {
      nature: {
        name: "Juggernaut",
        opener: special("Harpoon Hide", "Harpoons lose their bonus damage against him.", "shield", {
          harpoonProof: true,
        }),
        capstone: special("Iron Gut", "Heals 2% a second while firing.", "medkit", {
          ironGut: true,
        }),
      },
      fire: {
        name: "Gunner",
        opener: special("Tight Barrels", "40% less spread.", "crosshair", { spread: 0.6 }),
        capstone: special(
          "Overdrive",
          "After 5 seconds of non-stop fire, fires 21% faster.",
          "energy",
          {
            overdrive: true,
          },
        ),
      },
      ice: {
        name: "Rolling Fire",
        opener: special("Rolling Thunder", "Moves at 45% speed while firing.", "speed", {
          fireSpeed: 0.45,
        }),
        capstone: special("Hair Trigger", "Spins up 34% faster.", "gear", { spinUp: 0.66 }),
      },
      dark: {
        name: "Berserker",
        opener: special(
          "Berserk",
          "Enrages after taking 500 damage: for 6 seconds, fires 43% faster and can't be slowed.",
          "skull",
          { berserk: true },
        ),
        capstone: special("Explosive Belt", "At full spin, every 6th round explodes.", "star", {
          signature: 1,
        }),
      },
    },
  },
  tank: {
    first: up("Extra Plating", "+15% health.", { nature: 1 }, "heart", { hp: 1.15 }),
    quick: special("Hot Charge", "Shells fly 20% faster.", "rocket", { shotSpeed: 1.2 }),
    wide: special("Bigger Bang", "+0.5 m splash.", "range", { splash: 0.5 }),
    sapper: special("Dozer Blade", "+15% damage to buildings.", "hammer", { buildingDamage: 1.15 }),
    scrapper: special("Scrap Welder", "Destroying a building heals 5%.", "hammer", {
      healOnKill: 0.05,
    }),
    branches: {
      nature: {
        name: "Fortress",
        opener: special("Field Repairs", "Heals 2% a second while standing still.", "hammer", {
          fieldRepairs: true,
        }),
        capstone: special(
          "Siege Mode",
          "After 2 seconds standing still: fires 30% faster and takes 40% less damage.",
          "skull",
          { siegeMode: true },
        ),
      },
      fire: {
        name: "Wrecker",
        opener: special("Bunker Buster", "+30% damage to buildings.", "hammer", {
          buildingDamage: 1.3,
        }),
        capstone: special("Twin Barrels", "Every 4th shot fires two shells.", "barrage", {
          twinEvery: 4,
        }),
      },
      ice: {
        name: "Panzer",
        opener: special("Bulldozer", "Moves at 45% speed while firing.", "speed", {
          fireSpeed: 0.45,
        }),
        capstone: special("Autoloader", "Fires 25% faster.", "clock", { reload: 0.75 }),
      },
      dark: {
        name: "Siege Engine",
        opener: special("Reactive Armor", "Takes 20% less from blasts.", "shield", {
          blastTaken: 0.8,
        }),
        capstone: special(
          "Aftershock",
          "Whatever it destroys goes up in a shockwave that can set off the next.",
          "star",
          { signature: 1 },
        ),
      },
    },
  },
  bazooka: {
    first: up("Quick Loader", "Reloads 10% faster.", { fire: 1 }, "clock", { reload: 0.9 }),
    quick: special("Hot Motor", "Rockets fly 20% faster.", "rocket", { shotSpeed: 1.2 }),
    wide: special("Bigger Bang", "+0.5 m splash.", "range", { splash: 0.5 }),
    sapper: special("Shaped Charge", "+15% damage to defenses.", "crosshair", {
      defenseDamage: 1.15,
    }),
    scrapper: special("Blast Goggles", "Takes 20% less from blasts.", "shield", {
      blastTaken: 0.8,
    }),
    branches: {
      nature: {
        name: "Daredevil",
        opener: special("Blast Shield", "Takes 25% less from blasts.", "shield", {
          blastTaken: 0.75,
        }),
        capstone: special("Second Wind", "Destroying a building heals 15%.", "medkit", {
          healOnKill: 0.15,
        }),
      },
      fire: {
        name: "Demolition",
        opener: special("Napalm", "Blasts leave fire burning for 3 seconds.", "flame", {
          napalm: true,
        }),
        capstone: special(
          "Cluster Warhead",
          "Rockets throw out 5 bomblets where they burst.",
          "star",
          {
            signature: 2,
          },
        ),
      },
      ice: {
        name: "Hit and Run",
        opener: special("Fast Rockets", "Rockets fly 40% faster.", "rocket", { shotSpeed: 1.4 }),
        capstone: special("Getaway", "+30% move speed for 2 seconds after each shot.", "speed", {
          getaway: true,
        }),
      },
      dark: {
        name: "Trickshot",
        opener: special("Double Tap", "Holds two rockets before reloading.", "barrage", {
          doubleTap: true,
        }),
        capstone: special(
          "Guided Rocket",
          "Rockets curve round cover to reach a locked target.",
          "skull",
          { guided: true },
        ),
      },
    },
  },
  grenadier: {
    first: up("Bigger Charge", "+10% damage.", { fire: 1 }, "sword", { damage: 1.1 }),
    quick: special("Light Grenades", "Grenades land 15% sooner.", "clock", { flight: 0.85 }),
    wide: special("Bigger Bang", "+0.5 m splash.", "grenade", { splash: 0.5 }),
    sapper: special("Sticky Bombs", "+15% damage to buildings.", "grenade", {
      buildingDamage: 1.15,
    }),
    scrapper: special("Tin Helmet", "Takes 20% less from blasts.", "shield", { blastTaken: 0.8 }),
    branches: {
      nature: {
        name: "Old Campaigner",
        opener: special("Tea Break", "Destroying a building heals 15%.", "medkit", {
          healOnKill: 0.15,
        }),
        capstone: special(
          "Last Orders",
          "Enrages below 30% health: throws 40% faster and takes 25% less damage.",
          "skull",
          { lastStand: true },
        ),
      },
      fire: {
        name: "Ordnance",
        opener: special("Twin Grenades", "Every 3rd throw is two grenades.", "grenade", {
          twinEvery: 3,
        }),
        capstone: special("Skipping Stone", "Grenades skip on for two more blasts.", "star", {
          signature: 2,
        }),
      },
      ice: {
        name: "Quick March",
        opener: special("Short Fuse", "Grenades land 40% sooner.", "clock", { flight: 0.6 }),
        capstone: special("Rapid Lob", "Throws 30% faster.", "clock", { reload: 0.7 }),
      },
      dark: {
        name: "Saboteur",
        opener: special(
          "Mine Sweeper",
          "Shows every mine, and blasts set them off from twice as far.",
          "crosshair",
          { mineSweeper: true },
        ),
        capstone: special(
          "Smoke Shell",
          "Every 5th grenade leaves smoke: defenses can't aim into it for 4 seconds.",
          "smoke",
          { smokeShell: true },
        ),
      },
    },
  },
  engineer: {
    first: up("Spare Parts", "Fires 10% faster.", { fire: 1 }, "gear", { reload: 0.9 }),
    quick: special("Oiled Gears", "Shots fly 20% faster.", "gear", { shotSpeed: 1.2 }),
    sapper: special("Scrap Rounds", "+15% damage to defenses.", "crosshair", {
      defenseDamage: 1.15,
    }),
    scrapper: special("Toolbelt", "Destroying a building heals 5%.", "medkit", {
      healOnKill: 0.05,
    }),
    branches: {
      nature: {
        name: "Medic Bay",
        opener: special("Patch Up", "Destroying a building heals 10%.", "medkit", {
          healOnKill: 0.1,
        }),
        capstone: special(
          "Repair Beam",
          "Slowly repairs the Tank and turrets near him.",
          "hammer",
          {
            repairBeam: true,
          },
        ),
      },
      fire: {
        name: "Salvager",
        opener: special("Armor Piercing", "+25% damage to defenses.", "crosshair", {
          defenseDamage: 1.25,
        }),
        capstone: special(
          "Salvage",
          "Everything he destroys comes back as his turret for a while.",
          "star",
          { signature: 1 },
        ),
      },
      ice: {
        name: "Mechanic",
        opener: special("Overclock", "His turrets fire 30% faster.", "energy", { overclock: true }),
        capstone: special("Rapid Fire", "Fires 25% faster.", "clock", { reload: 0.75 }),
      },
      dark: {
        name: "Gadgeteer",
        opener: special("Pocket Turret", "Drops a small turret every 30 seconds.", "turret", {
          pocketTurret: true,
        }),
        capstone: special(
          "Decoy Drone",
          "Every 30 seconds, a drone draws the defenses' fire for 6 seconds.",
          "skull",
          { decoyDrone: true },
        ),
      },
    },
  },
};

/** One plain step: a name, and how much of which stat in percent. */
type Step = readonly [
  name: string,
  stat: "hp" | "taken" | "damage" | "defense" | "speed" | "reload",
  percent: number,
];

/** The trunk's plain steps, at tiers 2 and 3, before the hero's own at 4. */
const TRUNK_STEPS: readonly Step[] = [
  ["Hardy", "hp", 20],
  ["Sharp", "damage", 15],
];

/** The two short side paths off the trunk's second upgrade, each ending in one of the hero's own. */
const SIDES = [
  { name: "Sapper", row: 0.4, end: "sapper" },
  { name: "Scrapper", row: 2.6, end: "scrapper" },
] as const;

/** The two ways the trunk splits, and which two of a hero's last branches each leads on to. */
const SPLITS = [
  { name: "Assault", row: 0.5, leaves: ["fire", "ice"] },
  { name: "Survival", row: 2.5, leaves: ["nature", "dark"] },
] as const;
type Split = (typeof SPLITS)[number]["name"];

/** The plain steps up each of the first two branches, at tiers 5, 6 and 7. */
const SPLIT_STEPS: Record<Split, readonly [Step, Step, Step]> = {
  Assault: [
    ["Fierce", "damage", 12],
    ["Breaker", "defense", 15],
    ["Brisk", "reload", 12],
  ],
  Survival: [
    ["Sturdy", "hp", 15],
    ["Brace", "taken", 10],
    ["Swift", "speed", 18],
  ],
};

/** The plain step at tier 9 of each last branch, between its opener and its capstone. */
const LEAF_STEPS: Record<CrystalKind, Step> = {
  nature: ["Unbreakable", "hp", 15],
  fire: ["Devastation", "damage", 12],
  ice: ["Lightning", "reload", 12],
  dark: ["Nightfall", "damage", 10],
};

const TRUNK = "Basics";
const TRUNK_ROW = 1.5;
const LEAF_ROW: Record<CrystalKind, number> = { fire: 0, ice: 1, nature: 2, dark: 3 };

function step(kind: HeroKind, [name, stat, base]: Step): Draft {
  const gun = stat === "damage" || stat === "reload";
  const percent = gun ? gunShare(kind, base) : base;
  const more = 1 + percent / 100;
  const less = 1 - percent / 100;
  switch (stat) {
    case "hp":
      return up(name, `+${percent}% health.`, {}, "heart", { hp: more });
    case "taken":
      return up(name, `Takes ${percent}% less damage.`, {}, "shield", { damageTaken: less });
    case "damage":
      return up(name, `+${percent}% damage.`, {}, "sword", { damage: more });
    case "defense":
      return up(name, `+${percent}% damage to defenses.`, {}, "crosshair", { defenseDamage: more });
    case "speed":
      return up(name, `+${percent}% move speed.`, {}, "speed", { speed: more });
    case "reload":
      return up(name, `${RELOAD_WORDS[kind].verb} ${percent}% faster.`, {}, "clock", {
        reload: less,
      });
  }
}

/** Off the last branches, an upgrade is paid for in the crystal of what it does. */
function crystalFor(mods: Partial<HeroMods>): CrystalKind {
  if (mods.hp || mods.damageTaken || mods.blastTaken || mods.heal || mods.healOnKill) {
    return "nature";
  }
  if (mods.damage || mods.defenseDamage || mods.buildingDamage || mods.splash || mods.spread) {
    return "fire";
  }
  return "ice";
}

type Stretch = "trunk" | (typeof SIDES)[number]["name"] | Split | CrystalKind;

/** What a stretch's minis give, round and round along it. */
function miniStats(kind: HeroKind, path: Stretch): readonly MiniStat[] {
  const medic = kind === "medic";
  switch (path) {
    case "trunk":
      return ["health", "damage", "weapon", "speed"];
    case "Sapper":
      return ["building", "defense", "damage"];
    case "Scrapper":
      return medic ? ["heal", "armor", "speed"] : ["health", "armor", "speed"];
    case "Assault":
      return ["damage", "reload", "defense", "weapon"];
    case "Survival":
      return medic ? ["heal", "health", "speed", "armor"] : ["health", "speed", "armor", "blast"];
    case "nature":
      return medic ? ["health", "heal", "armor"] : ["health", "armor", "blast"];
    case "fire":
      return ["damage", "defense", "building"];
    case "ice":
      return ["reload", "speed", "weapon"];
    case "dark":
      return ["damage", "reload", "health", "blast"];
  }
}

/** The upgrade at a tier of the trunk, or of one of the two branches it splits into. */
function coreDraft(kind: HeroKind, split: Split | null, tier: number): Draft {
  const tree = TREES[kind];
  if (!split) {
    const plain = TRUNK_STEPS[tier - 2];
    return tier === TRUNK_END || !plain ? tree.quick : step(kind, plain);
  }
  const at = tier - TRUNK_END - 1;
  // Midway up each is where a hero's own kind of weapon gets its turn, if it has one.
  if (at === 1 && split === "Assault" && tree.wide) return tree.wide;
  if (at === 1 && split === "Survival" && tree.mend) return tree.mend;
  return step(kind, SPLIT_STEPS[split][at] ?? SPLIT_STEPS[split][0]);
}

/** The upgrade at a tier of one of the last branches. */
function leafDraft(kind: HeroKind, leaf: CrystalKind, tier: number): Draft {
  const branch = TREES[kind].branches[leaf];
  if (tier === SPLIT_END + 1) return branch.opener;
  if (tier === TIERS) return branch.capstone;
  return step(kind, LEAF_STEPS[leaf]);
}

const slug = (name: string) => name.toLowerCase().replace(/[^a-z]+/g, "-");

function buildTree(kind: HeroKind): readonly TreeUpgrade[] {
  const tree = TREES[kind];
  const out: TreeUpgrade[] = [];
  // Ids changed with the trunk, so nothing from the four-branch trees is taken for something new.
  const idOf = (name: string) => `${kind}/${slug(name)}`;
  const start: TreeUpgrade = {
    ...tree.first,
    id: idOf(tree.first.name),
    tier: 1,
    gold: upgradeGold(1),
    hq: tierHq(1),
    needs: [],
    path: null,
    column: 0,
    row: TRUNK_ROW,
    line: null,
  };
  out.push(start);
  /** Minis so far on each stretch, and of each kind on the whole tree. */
  const made = new Map<string, number>();
  const seen = new Map<MiniStat, number>();
  /** Carries on from an upgrade along one stretch: three minis, then an upgrade, each tier. */
  const extend = (
    from: TreeUpgrade,
    path: string,
    stretch: Stretch,
    row: number,
    tiers: readonly [number, number],
    draftAt: (tier: number) => Draft,
    pays: (draft: Draft) => CrystalKind,
  ): TreeUpgrade => {
    const stats = miniStats(kind, stretch);
    let previous = from;
    for (let tier = tiers[0]; tier <= tiers[1]; tier++) {
      const draft = draftAt(tier);
      const id = idOf(draft.name);
      const column = tier - 1;
      let needs = previous.id;
      for (const at of ALONG_LINE[previous.row === row ? "straight" : "out"]) {
        const n = made.get(path) ?? 0;
        made.set(path, n + 1);
        const stat = stats[n % stats.length] ?? "health";
        const nth = seen.get(stat) ?? 0;
        seen.set(stat, nth + 1);
        const miniId = `${kind}/${slug(path)}-mini-${n}`;
        out.push({
          ...mini(kind, stat, MINI_PERCENT[tier] ?? 0, nth),
          id: miniId,
          tier: 0,
          gold: MINI_GOLD[tier] ?? 0,
          hq: tierHq(tier),
          needs: [needs],
          path,
          ...lineAt(previous, { column, row }, at),
          line: { from: previous.id, to: id, at },
        });
        needs = miniId;
      }
      const upgrade: TreeUpgrade = {
        ...draft,
        crystals: { [pays(draft)]: TIER_CRYSTALS[tier] ?? 1 },
        id,
        tier,
        gold: upgradeGold(tier),
        hq: tierHq(tier),
        needs: [needs],
        path,
        column,
        row,
        line: null,
      };
      out.push(upgrade);
      previous = upgrade;
    }
    return previous;
  };
  const byWhatItDoes = (draft: Draft) => crystalFor(draft.mods);
  const trunkAt = (tier: number) => coreDraft(kind, null, tier);
  const second = extend(start, TRUNK, "trunk", TRUNK_ROW, [2, 2], trunkAt, byWhatItDoes);
  for (const side of SIDES) {
    extend(second, side.name, side.name, side.row, [3, 3], () => tree[side.end], byWhatItDoes);
  }
  const trunk = extend(second, TRUNK, "trunk", TRUNK_ROW, [3, TRUNK_END], trunkAt, byWhatItDoes);
  for (const split of SPLITS) {
    const fork = extend(
      trunk,
      split.name,
      split.name,
      split.row,
      [TRUNK_END + 1, SPLIT_END],
      (tier) => coreDraft(kind, split.name, tier),
      byWhatItDoes,
    );
    for (const leaf of split.leaves) {
      extend(
        fork,
        tree.branches[leaf].name,
        leaf,
        LEAF_ROW[leaf],
        [SPLIT_END + 1, TIERS],
        (tier) => leafDraft(kind, leaf, tier),
        () => leaf,
      );
    }
  }
  return out;
}

const BUILT = new Map<HeroKind, readonly TreeUpgrade[]>(
  HERO_KINDS.map((kind) => [kind, buildTree(kind)]),
);

/** Every upgrade a hero has, first upgrade first. */
export function heroTree(kind: HeroKind): readonly TreeUpgrade[] {
  return BUILT.get(kind) ?? [];
}

/** A named stretch of the tree. */
export interface TreePath {
  name: string;
  /** The crystal one of the four last branches is paid for in; null for the rest. */
  crystal: CrystalKind | null;
}

/** The trunk and its side paths, the two branches it splits into, then the four last branches. */
export function treePaths(kind: HeroKind): readonly TreePath[] {
  const { branches } = TREES[kind];
  return [
    { name: TRUNK, crystal: null },
    ...SIDES.map((side): TreePath => ({ name: side.name, crystal: null })),
    ...SPLITS.flatMap((split): TreePath[] => [
      { name: split.name, crystal: null },
      ...split.leaves.map((leaf) => ({ name: branches[leaf].name, crystal: leaf })),
    ]),
  ];
}

/** The best upgrade on each last branch: the one at its end. */
export function capstones(kind: HeroKind): readonly TreeUpgrade[] {
  return heroTree(kind).filter((u) => u.tier === TIERS);
}

/** The upgrades proper, without the checkpoints between them. */
export function majorUpgrades(kind: HeroKind): readonly TreeUpgrade[] {
  return heroTree(kind).filter((u) => u.tier > 0);
}

/** Why an upgrade can't be bought yet, or null if it's open. */
export function lockedBy(
  kind: HeroKind,
  upgrade: TreeUpgrade,
  owned: readonly string[],
): TreeUpgrade[] | null {
  if (upgrade.needs.length === 0 || upgrade.needs.some((id) => owned.includes(id))) return null;
  return heroTree(kind).filter((u) => upgrade.needs.includes(u.id));
}

export function canBuy(
  kind: HeroKind,
  upgrade: TreeUpgrade,
  owned: readonly string[],
  gold: number,
  crystals: Crystals,
  hq: number,
): boolean {
  if (owned.includes(upgrade.id) || lockedBy(kind, upgrade, owned)) return false;
  if (upgrade.hq > hq || gold < upgrade.gold) return false;
  return CRYSTAL_KINDS.every((k) => crystals[k] >= (upgrade.crystals[k] ?? 0));
}

/** Everything a hero's owned upgrades add up to. */
export function heroMods(kind: HeroKind, owned: readonly string[]): HeroMods {
  const out: HeroMods = { ...NO_MODS };
  for (const upgrade of heroTree(kind)) {
    if (!owned.includes(upgrade.id)) continue;
    for (const [key, value] of Object.entries(upgrade.mods) as [keyof HeroMods, unknown][]) {
      const target = out as unknown as Record<string, number | boolean>;
      if (typeof value === "boolean") target[key] = value;
      else if (key === "fireSpeed" || key === "healOnKill" || key === "twinEvery") {
        target[key] = Math.max(target[key] as number, value as number);
      } else if (key === "signature") target[key] = value as number;
      else if (MULTIPLIED.has(key)) target[key] = (target[key] as number) * (value as number);
      else target[key] = (target[key] as number) + (value as number);
    }
  }
  return out;
}

/**
 * What a checkpoint on the first trunk trees cost (2026-11-03): one on each line, with ids
 * `${kind}/${stretch}-${n}`. Their upgrades are still here, at the same prices.
 */
function firstTrunkCost(kind: HeroKind, name: string): readonly number[] | undefined {
  const match = /^([a-z-]+)-([0-2])$/.exec(name);
  if (!match) return undefined;
  const [, stretch = "", n = "0"] = match;
  const leaves = Object.values(TREES[kind].branches).map((b) => slug(b.name));
  const first =
    stretch === "basics"
      ? 2
      : stretch === "assault" || stretch === "survival"
        ? TRUNK_END + 1
        : leaves.includes(stretch)
          ? SPLIT_END + 1
          : 0;
  const gold = first ? TRUNK_CHECKPOINT_GOLD[first + Number(n)] : undefined;
  return gold ? [gold] : undefined;
}

/** What a set of upgrades cost: gold and crystals. Ones from older trees cost what they did. */
function costOf(kind: HeroKind, ids: readonly string[]): { gold: number; crystals: CrystalCost } {
  const tree = new Map(heroTree(kind).map((u) => [u.id, u]));
  const old = OLD_UPGRADE_COSTS[kind];
  let gold = 0;
  const crystals: CrystalCost = {};
  const addCrystals = (k: CrystalKind, n: number) => {
    if (n > 0) crystals[k] = (crystals[k] ?? 0) + n;
  };
  for (const id of ids) {
    const now = tree.get(id);
    if (now) {
      gold += now.gold;
      for (const k of CRYSTAL_KINDS) addCrystals(k, now.crystals[k] ?? 0);
      continue;
    }
    const name = id.slice(kind.length + 1);
    const before = id.startsWith(`${kind}-`)
      ? old[name]
      : id.startsWith(`${kind}:`)
        ? branchTreeCost(kind, name)
        : id.startsWith(`${kind}/`)
          ? firstTrunkCost(kind, name)
          : undefined;
    if (!before) continue;
    const [coins = 0, ...gems] = before;
    gold += coins;
    OLD_CRYSTAL_ORDER.forEach((k, i) => {
      addCrystals(k, gems[i] ?? 0);
    });
  }
  return { gold, crystals };
}

/**
 * Keeps the upgrades that are still to be had and that the headquarters allows, each with what
 * comes before it, and says what the rest cost, to give back: upgrades from older trees, and
 * any above what the headquarters lets a hero have. Untrusted data is fine.
 */
export function trimUpgrades(
  kind: HeroKind,
  value: unknown,
  hq = Number.POSITIVE_INFINITY,
): { owned: string[]; refund: { gold: number; crystals: CrystalCost } } {
  const given = Array.isArray(value)
    ? [...new Set(value.filter((id): id is string => typeof id === "string"))]
    : [];
  const wanted = new Set(given);
  const owned: string[] = [];
  for (const upgrade of heroTree(kind)) {
    if (!wanted.has(upgrade.id) || upgrade.hq > hq) continue;
    if (upgrade.needs.length === 0 || upgrade.needs.some((id) => owned.includes(id))) {
      owned.push(upgrade.id);
    }
  }
  const kept = new Set(owned);
  return {
    owned,
    refund: costOf(
      kind,
      given.filter((id) => !kept.has(id)),
    ),
  };
}

/** Keeps only upgrades that exist, that the headquarters allows, and whose path is intact. */
export function readOwned(kind: HeroKind, value: unknown, hq?: number): string[] {
  return trimUpgrades(kind, value, hq).owned;
}

/** Each hero's upgrades, empty to start with. */
export function noUpgrades(): Record<HeroKind, string[]> {
  return Object.fromEntries(HERO_KINDS.map((k) => [k, []])) as unknown as Record<
    HeroKind,
    string[]
  >;
}

/** Majors and minis together: 24 majors, and three minis on the line into each but the first. */
const MAJORS =
  TRUNK_END + SIDES.length + SPLITS.length * (SPLIT_END - TRUNK_END + 2 * (TIERS - SPLIT_END));
export const UPGRADES_PER_HERO = MAJORS + (MAJORS - 1) * ALONG_LINE.straight.length;
