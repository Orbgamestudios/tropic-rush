// The hero upgrade trees (docs/HERO_TREES.md): every hero has one first upgrade, then four branches
// of nine more, one for each crystal: nature keeps a hero alive, fire hits harder, ice is quicker,
// and dark holds the tricks. Each branch is paid for in its own crystal, with gold, and two small
// checkpoints sit on each line between upgrades, bought with gold and in order. Each tier opens
// at a headquarters level, so a hero is only as strong as the islands its crew can reach. No
// engine imports.

import { CRYSTAL_KINDS, type CrystalCost, type CrystalKind, type Crystals } from "./crystals";
import { HERO_KINDS, type HeroKind } from "./heroes";
import { OLD_CRYSTAL_ORDER, OLD_UPGRADE_COSTS } from "./oldTrees";

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

/** Where a checkpoint sits: on the line between two upgrades, `at` of the way along it. */
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
  /** 1 to 10, or 0 for a checkpoint. */
  tier: number;
  gold: number;
  crystals: CrystalCost;
  /** The headquarters level it can be bought from. */
  hq: number;
  /** Owning any one of these opens it up; empty for the first upgrade. */
  needs: readonly string[];
  mods: Partial<HeroMods>;
  icon: UpgradeIcon;
  /** The branch it's on, for the screen. Null for the first upgrade. */
  path: string | null;
  /** Which crystal the branch is: null for the first upgrade. */
  branch: CrystalKind | null;
  /** Where it goes on the screen: 0 to 9 across, 0 to 3 down. */
  column: number;
  row: number;
  /** Null for an upgrade proper. */
  line: CheckpointSpot | null;
}

/** How far along a branch goes: the first upgrade, then nine more on each branch. */
export const TIERS = 10;

/** Gold, crystals and the headquarters level each tier needs. */
const TIER_GOLD = [0, 150, 400, 700, 1100, 1600, 2300, 3200, 4400, 6000, 8000] as const;
const TIER_CRYSTALS = [0, 1, 1, 1, 2, 2, 2, 3, 3, 4, 5] as const;
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

const CHECKPOINTS_PER_LINE = 2;
/** Gold for a checkpoint, by the tier of the upgrade its line leads to. */
const CHECKPOINT_GOLD = [0, 0, 300, 450, 650, 900, 1200, 1600, 2100, 2700, 3400] as const;
/** How strong a checkpoint is in percent, by the tier of the upgrade its line leads to. */
const CHECKPOINT_PERCENT = [0, 0, 1, 1, 1, 1, 2, 2, 2, 2, 2] as const;
/** Percent for percent, these do far less than the rest, so they get twice as much. */
const SLIGHT_STAT = 2;
/** The Heavy's upgrades that make his gun stronger do this much of what everyone else's do. */
const HEAVY_GUN = 0.85;

/** Where the checkpoints sit along a line, on a branch or bending out to one from the first. */
const ALONG_LINE: Record<"straight" | "out", readonly number[]> = {
  straight: [0.35, 0.65],
  out: [0.5, 0.75],
};

/** The curve from one spot on the board to another, in columns and rows. */
export function lineAt(
  from: { column: number; row: number },
  to: { column: number; row: number },
  t: number,
): { column: number; row: number } {
  const ease = t * t * (3 - 2 * t);
  const across = 1.5 * t * (1 - t) + t * t * t;
  return {
    column: from.column + (to.column - from.column) * across,
    row: from.row + (to.row - from.row) * ease,
  };
}

type CheckpointStat = "health" | "damage" | "heal" | "reload" | "unload" | "spin" | "speed";

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

/** A percent kept to a tenth, so what a card says is what it does. */
const tenth = (n: number) => Math.round(n * 10) / 10;

/** The Heavy's gun gets less from everything that makes guns stronger. */
function gunShare(kind: HeroKind, percent: number): number {
  return kind === "heavy" ? tenth(percent * HEAVY_GUN) : percent;
}

function checkpoint(kind: HeroKind, stat: CheckpointStat, base: number): Draft {
  const gun = stat === "damage" || stat === "reload" || stat === "spin";
  const percent = gun ? gunShare(kind, base) : base;
  const more = 1 + percent / 100;
  const less = 1 - percent / 100;
  const faster = 1 - (percent * SLIGHT_STAT) / 100;
  switch (stat) {
    case "health":
      return up("Toughness", `+${percent}% health.`, {}, "heart", { hp: more });
    case "damage":
      return up("Punch", `+${percent}% damage.`, {}, "sword", { damage: more });
    case "heal":
      return up("Strong Dose", `+${percent}% healing.`, {}, "heal", { heal: more });
    case "reload": {
      const { name, verb } = RELOAD_WORDS[kind];
      return up(name, `${verb} ${percent}% faster.`, {}, "clock", { reload: less });
    }
    case "unload":
      return up(
        "Quick Unload",
        `Bullets leave a burst ${tenth(percent * SLIGHT_STAT)}% quicker.`,
        {},
        "barrage",
        { unload: faster },
      );
    case "spin":
      return up("Spin Up", `Spins up ${tenth(percent * SLIGHT_STAT)}% faster.`, {}, "gear", {
        spinUp: faster,
      });
    case "speed":
      return up("Fitness", `+${percent}% move speed.`, {}, "speed", { speed: more });
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

/** What a hero's branch is called, and the two special upgrades on it: at tier 6 and at the end. */
interface BranchDraft {
  name: string;
  six: Draft;
  ten: Draft;
}

interface TreeDraft {
  first: Draft;
  branches: Record<CrystalKind, BranchDraft>;
  /** Tier 5 on the ice branch: whatever makes this hero's weapon quicker. */
  quick: Draft;
  /** Tier 5 on the fire branch, for heroes whose shots burst: a wider blast. */
  wide?: Draft;
  /** Tier 5 on the nature branch, for a healer: stronger healing. */
  mend?: Draft;
}

/** The branches, in order down the screen. */
export const BRANCHES: readonly CrystalKind[] = ["nature", "fire", "ice", "dark"];

const TREES: Record<HeroKind, TreeDraft> = {
  rifleman: {
    first: up("Basic Training", "+10% health.", { nature: 1 }, "heart", { hp: 1.1 }),
    quick: special("Smooth Action", "Bullets leave a burst 20% quicker.", "barrage", {
      unload: 0.8,
    }),
    branches: {
      nature: {
        name: "Survivor",
        six: special("Thick Vest", "Takes 15% less damage.", "shield", { damageTaken: 0.85 }),
        ten: special(
          "Last Stand",
          "Enrages below 30% health: fires 40% faster and takes 25% less damage.",
          "skull",
          { lastStand: true },
        ),
      },
      fire: {
        name: "Marksman",
        six: special("Deadeye", "+25% damage to defenses.", "crosshair", { defenseDamage: 1.25 }),
        ten: special("Steady Hands", "One more bullet in every burst.", "barrage", { shots: 1 }),
      },
      ice: {
        name: "Skirmisher",
        six: special("Run and Gun", "Moves at 40% speed while firing, not 20%.", "speed", {
          fireSpeed: 0.4,
        }),
        ten: special("Fast Unload", "Bursts fire 40% quicker.", "clock", { reload: 0.6 }),
      },
      dark: {
        name: "Veteran",
        six: special(
          "Field Dressing",
          "Heals 3% a second after 4 seconds without being hit.",
          "medkit",
          { fieldDressing: true },
        ),
        ten: special("Ricochet", "Bullets bounce off a building into the next one.", "star", {
          signature: 1,
        }),
      },
    },
  },
  medic: {
    first: up("Steady Hand", "+15% healing.", { nature: 1 }, "heal", { heal: 1.15 }),
    quick: special("Flat Throw", "Bottles land 15% sooner.", "clock", { flight: 0.85 }),
    mend: special("Strong Brew", "+12% healing.", "heal", { heal: 1.12 }),
    branches: {
      nature: {
        name: "Field Hospital",
        six: special(
          "Lingering Dose",
          "Healing carries on for 3 seconds after the bottle lands.",
          "clock",
          { lingering: true },
        ),
        ten: special(
          "Overheal",
          "Healing past full health becomes a shield worth up to 20% health.",
          "shield",
          { overheal: true },
        ),
      },
      fire: {
        name: "Alchemist",
        six: special("Wide Splash", "Bottles burst 1.5 m wider.", "range", { splash: 1.5 }),
        ten: special(
          "Miracle Bottle",
          "Every 5th bottle heals double, and bursts twice as wide.",
          "skull",
          { miracle: true },
        ),
      },
      ice: {
        name: "Combat Medic",
        six: special("Ice Pack", "Healed crewmates move 20% faster for 3 seconds.", "speed", {
          icePack: true,
        }),
        ten: special("Adrenaline", "Healed crewmates fire 20% faster for 3 seconds.", "energy", {
          adrenaline: true,
        }),
      },
      dark: {
        name: "Guardian",
        six: special("Corrosive Acid", "+25% damage to defenses.", "flame", {
          defenseDamage: 1.25,
        }),
        ten: special(
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
    branches: {
      nature: {
        name: "Juggernaut",
        six: special("Harpoon Hide", "Harpoons lose their bonus damage against him.", "shield", {
          harpoonProof: true,
        }),
        ten: special("Iron Gut", "Heals 2% a second while firing.", "medkit", { ironGut: true }),
      },
      fire: {
        name: "Gunner",
        six: special("Tight Barrels", "40% less spread.", "crosshair", { spread: 0.6 }),
        ten: special("Overdrive", "After 5 seconds of non-stop fire, fires 21% faster.", "energy", {
          overdrive: true,
        }),
      },
      ice: {
        name: "Rolling Fire",
        six: special("Rolling Thunder", "Moves at 45% speed while firing.", "speed", {
          fireSpeed: 0.45,
        }),
        ten: special("Hair Trigger", "Spins up 34% faster.", "gear", { spinUp: 0.66 }),
      },
      dark: {
        name: "Berserker",
        six: special(
          "Berserk",
          "Enrages after taking 500 damage: for 6 seconds, fires 43% faster and can't be slowed.",
          "skull",
          { berserk: true },
        ),
        ten: special("Explosive Belt", "At full spin, every 6th round explodes.", "star", {
          signature: 1,
        }),
      },
    },
  },
  tank: {
    first: up("Extra Plating", "+15% health.", { nature: 1 }, "heart", { hp: 1.15 }),
    quick: special("Hot Charge", "Shells fly 20% faster.", "rocket", { shotSpeed: 1.2 }),
    wide: special("Bigger Bang", "+0.5 m splash.", "range", { splash: 0.5 }),
    branches: {
      nature: {
        name: "Fortress",
        six: special("Field Repairs", "Heals 2% a second while standing still.", "hammer", {
          fieldRepairs: true,
        }),
        ten: special(
          "Siege Mode",
          "After 2 seconds standing still: fires 30% faster and takes 40% less damage.",
          "skull",
          { siegeMode: true },
        ),
      },
      fire: {
        name: "Wrecker",
        six: special("Bunker Buster", "+30% damage to buildings.", "hammer", {
          buildingDamage: 1.3,
        }),
        ten: special("Twin Barrels", "Every 4th shot fires two shells.", "barrage", {
          twinEvery: 4,
        }),
      },
      ice: {
        name: "Panzer",
        six: special("Bulldozer", "Moves at 45% speed while firing.", "speed", { fireSpeed: 0.45 }),
        ten: special("Autoloader", "Fires 25% faster.", "clock", { reload: 0.75 }),
      },
      dark: {
        name: "Siege Engine",
        six: special("Reactive Armor", "Takes 20% less from blasts.", "shield", {
          blastTaken: 0.8,
        }),
        ten: special(
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
    branches: {
      nature: {
        name: "Daredevil",
        six: special("Blast Shield", "Takes 25% less from blasts.", "shield", { blastTaken: 0.75 }),
        ten: special("Second Wind", "Destroying a building heals 15%.", "medkit", {
          healOnKill: 0.15,
        }),
      },
      fire: {
        name: "Demolition",
        six: special("Napalm", "Blasts leave fire burning for 3 seconds.", "flame", {
          napalm: true,
        }),
        ten: special("Cluster Warhead", "Rockets throw out 5 bomblets where they burst.", "star", {
          signature: 2,
        }),
      },
      ice: {
        name: "Hit and Run",
        six: special("Fast Rockets", "Rockets fly 40% faster.", "rocket", { shotSpeed: 1.4 }),
        ten: special("Getaway", "+30% move speed for 2 seconds after each shot.", "speed", {
          getaway: true,
        }),
      },
      dark: {
        name: "Trickshot",
        six: special("Double Tap", "Holds two rockets before reloading.", "barrage", {
          doubleTap: true,
        }),
        ten: special(
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
    branches: {
      nature: {
        name: "Old Campaigner",
        six: special("Tea Break", "Destroying a building heals 15%.", "medkit", {
          healOnKill: 0.15,
        }),
        ten: special(
          "Last Orders",
          "Enrages below 30% health: throws 40% faster and takes 25% less damage.",
          "skull",
          { lastStand: true },
        ),
      },
      fire: {
        name: "Ordnance",
        six: special("Twin Grenades", "Every 3rd throw is two grenades.", "grenade", {
          twinEvery: 3,
        }),
        ten: special("Skipping Stone", "Grenades skip on for two more blasts.", "star", {
          signature: 2,
        }),
      },
      ice: {
        name: "Quick March",
        six: special("Short Fuse", "Grenades land 40% sooner.", "clock", { flight: 0.6 }),
        ten: special("Rapid Lob", "Throws 30% faster.", "clock", { reload: 0.7 }),
      },
      dark: {
        name: "Saboteur",
        six: special(
          "Mine Sweeper",
          "Shows every mine, and blasts set them off from twice as far.",
          "crosshair",
          { mineSweeper: true },
        ),
        ten: special(
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
    branches: {
      nature: {
        name: "Medic Bay",
        six: special("Patch Up", "Destroying a building heals 10%.", "medkit", {
          healOnKill: 0.1,
        }),
        ten: special("Repair Beam", "Slowly repairs the Tank and turrets near him.", "hammer", {
          repairBeam: true,
        }),
      },
      fire: {
        name: "Salvager",
        six: special("Armor Piercing", "+25% damage to defenses.", "crosshair", {
          defenseDamage: 1.25,
        }),
        ten: special(
          "Salvage",
          "Everything he destroys comes back as his turret for a while.",
          "star",
          { signature: 1 },
        ),
      },
      ice: {
        name: "Mechanic",
        six: special("Overclock", "His turrets fire 30% faster.", "energy", { overclock: true }),
        ten: special("Rapid Fire", "Fires 25% faster.", "clock", { reload: 0.75 }),
      },
      dark: {
        name: "Gadgeteer",
        six: special("Pocket Turret", "Drops a small turret every 30 seconds.", "turret", {
          pocketTurret: true,
        }),
        ten: special(
          "Decoy Drone",
          "Every 30 seconds, a drone draws the defenses' fire for 6 seconds.",
          "skull",
          { decoyDrone: true },
        ),
      },
    },
  },
};

/** One plain step up a branch: a name, and how much of which stat in percent. */
type Step = readonly [
  name: string,
  stat: "hp" | "taken" | "damage" | "defense" | "speed" | "reload" | "building",
  percent: number,
];

/**
 * The plain steps up each branch, at tiers 2, 3, 4, 5, 7, 8 and 9, round its specials at 6 and
 * 10. Nature keeps a hero alive, fire hits harder, ice is quicker and dark is a bit of everything.
 */
const STEPS: Record<CrystalKind, readonly Step[]> = {
  nature: [
    ["Hardy", "hp", 6],
    ["Brace", "taken", 5],
    ["Sturdy", "hp", 7],
    ["Mend", "hp", 5],
    ["Iron Will", "hp", 9],
    ["Bulwark", "taken", 7],
    ["Unbreakable", "hp", 10],
  ],
  fire: [
    ["Sharp", "damage", 5],
    ["Breaker", "defense", 10],
    ["Fierce", "damage", 6],
    ["Payload", "building", 10],
    ["Ferocity", "damage", 8],
    ["Siegebreaker", "defense", 12],
    ["Devastation", "damage", 10],
  ],
  ice: [
    ["Nimble", "speed", 5],
    ["Brisk", "reload", 5],
    ["Swift", "speed", 6],
    ["Quick", "reload", 5],
    ["Fleet", "reload", 6],
    ["Rapid", "speed", 8],
    ["Lightning", "reload", 8],
  ],
  dark: [
    ["Shadow", "damage", 4],
    ["Cunning", "reload", 5],
    ["Grit", "hp", 5],
    ["Edge", "damage", 5],
    ["Dread", "reload", 6],
    ["Menace", "hp", 6],
    ["Nightfall", "damage", 6],
  ],
};

/** Which tiers of a branch are plain steps: the specials sit at 6 and 10. */
const STEP_TIERS = [2, 3, 4, 5, 7, 8, 9] as const;

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
    case "building":
      return up(name, `+${percent}% damage to buildings.`, {}, "hammer", { buildingDamage: more });
    case "speed":
      return up(name, `+${percent}% move speed.`, {}, "speed", { speed: more });
    case "reload":
      return up(name, `${RELOAD_WORDS[kind].verb} ${percent}% faster.`, {}, "clock", {
        reload: less,
      });
  }
}

/** What each branch's checkpoints give, round and round along it. */
function checkpointStats(kind: HeroKind, branch: CrystalKind): readonly CheckpointStat[] {
  switch (branch) {
    case "nature":
      return kind === "medic" ? ["health", "heal"] : ["health"];
    case "fire":
      return ["damage"];
    case "ice":
      return kind === "rifleman"
        ? ["reload", "unload", "speed"]
        : kind === "heavy"
          ? ["spin", "reload", "speed"]
          : ["reload", "speed"];
    case "dark":
      return ["damage", "reload", "health"];
  }
}

/** The draft at one tier of a branch. */
function branchDraft(kind: HeroKind, branch: CrystalKind, tier: number): Draft {
  const tree = TREES[kind];
  const b = tree.branches[branch];
  if (tier === 6) return b.six;
  if (tier === TIERS) return b.ten;
  // Tier 5 is where a hero's own kind of weapon gets its turn, if it has one.
  if (tier === 5) {
    if (branch === "ice") return tree.quick;
    if (branch === "fire" && tree.wide) return tree.wide;
    if (branch === "nature" && tree.mend) return tree.mend;
  }
  const at = STEP_TIERS.indexOf(tier as (typeof STEP_TIERS)[number]);
  const plain = STEPS[branch][at];
  if (!plain) throw new Error(`No step for tier ${tier}`);
  return step(kind, plain);
}

const slug = (name: string) => name.toLowerCase().replace(/[^a-z]+/g, "-");

function buildTree(kind: HeroKind): readonly TreeUpgrade[] {
  const { first, branches } = TREES[kind];
  const out: TreeUpgrade[] = [];
  // Ids changed with the four branches, so nothing from the old trees is taken for something new.
  const idOf = (name: string) => `${kind}:${slug(name)}`;
  const start: TreeUpgrade = {
    ...first,
    id: idOf(first.name),
    tier: 1,
    gold: upgradeGold(1),
    hq: tierHq(1),
    needs: [],
    path: null,
    branch: null,
    column: 0,
    row: 1.5,
    line: null,
  };
  out.push(start);
  BRANCHES.forEach((branch, row) => {
    const { name: path } = branches[branch];
    const stats = checkpointStats(kind, branch);
    let made = 0;
    let previous = start;
    for (let tier = 2; tier <= TIERS; tier++) {
      const draft = branchDraft(kind, branch, tier);
      const id = idOf(draft.name);
      const column = tier - 1;
      const bend = previous.row === row ? "straight" : "out";
      let needs = previous.id;
      for (let n = 0; n < CHECKPOINTS_PER_LINE; n++) {
        const stat = stats[made % stats.length] ?? "health";
        const at = ALONG_LINE[bend][n] ?? 0.5;
        const stepId = `${kind}:${branch}-${made}`;
        out.push({
          ...checkpoint(kind, stat, CHECKPOINT_PERCENT[tier] ?? 0),
          id: stepId,
          tier: 0,
          gold: CHECKPOINT_GOLD[tier] ?? 0,
          hq: tierHq(tier),
          needs: [needs],
          path,
          branch,
          ...lineAt(previous, { column, row }, at),
          line: { from: previous.id, to: id, at },
        });
        needs = stepId;
        made++;
      }
      const upgrade: TreeUpgrade = {
        ...draft,
        // Every upgrade on a branch is paid for in its own crystal.
        crystals: { [branch]: TIER_CRYSTALS[tier] ?? 1 },
        id,
        tier,
        gold: upgradeGold(tier),
        hq: tierHq(tier),
        needs: [needs],
        path,
        branch,
        column,
        row,
        line: null,
      };
      out.push(upgrade);
      previous = upgrade;
    }
  });
  return out;
}

const BUILT = new Map<HeroKind, readonly TreeUpgrade[]>(
  HERO_KINDS.map((kind) => [kind, buildTree(kind)]),
);

/** Every upgrade a hero has, first upgrade first. */
export function heroTree(kind: HeroKind): readonly TreeUpgrade[] {
  return BUILT.get(kind) ?? [];
}

/** The names of a hero's four branches, in the order of BRANCHES. */
export function treePaths(kind: HeroKind): readonly string[] {
  return BRANCHES.map((b) => TREES[kind].branches[b].name);
}

/** The best upgrade on each branch: the one at its end. */
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

/** What a set of upgrades cost: gold and crystals. Ones from the old trees cost what they did. */
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
    const before = id.startsWith(`${kind}-`) ? old[id.slice(kind.length + 1)] : undefined;
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
 * comes before it, and says what the rest cost, to give back: upgrades from the old trees, and
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

/** Upgrades and checkpoints together: the first, then nine of each on four branches. */
export const UPGRADES_PER_HERO = 1 + BRANCHES.length * (TIERS - 1) * (1 + CHECKPOINTS_PER_LINE);
