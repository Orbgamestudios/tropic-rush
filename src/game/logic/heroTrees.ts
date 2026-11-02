// The hero upgrade trees (docs/HERO_TREES.md): every hero has one first upgrade, then two paths of
// six more, 13 in all, bought with gold and crystals. Three small checkpoints sit on each line
// between two upgrades, 42 in all, bought with gold and in order. An upgrade needs its line done,
// and a capstone either of the two lines into it. Everything can be bought in the end. No engine
// imports.

import { CRYSTAL_KINDS, type CrystalCost, type Crystals } from "./crystals";
import { HERO_KINDS, type HeroKind } from "./heroes";

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
  /** Extra range in meters. */
  range: number;
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
  range: 0,
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
  /** 1 to 5, or 0 for a checkpoint. */
  tier: number;
  gold: number;
  crystals: CrystalCost;
  /** Owning any one of these opens it up; empty for the first upgrade. */
  needs: readonly string[];
  mods: Partial<HeroMods>;
  icon: UpgradeIcon;
  /** The path it's on, for the screen. Null for the first upgrade. */
  path: string | null;
  /** Where it goes on the screen: 0 to 4 across, 0 to 7 down. */
  column: number;
  row: number;
  /** Null for an upgrade proper. */
  line: CheckpointSpot | null;
}

/** Gold for an upgrade of each tier. */
const TIER_GOLD = [0, 150, 400, 900, 2000, 4000] as const;

export function upgradeGold(tier: number): number {
  return TIER_GOLD[tier] ?? 0;
}

const CHECKPOINTS_PER_LINE = 3;
/** Gold for a checkpoint, by the tier of the upgrade its line leads to. */
const CHECKPOINT_GOLD = [0, 0, 500, 800, 1200, 1800] as const;
/** How strong a checkpoint is in percent, by the tier of the upgrade its line leads to. */
const CHECKPOINT_PERCENT = [0, 0, 3, 3, 4, 4] as const;
/** Percent for percent, these do far less than the rest, so they get twice as much. */
const SLIGHT_STAT = 2;

/** Lines bending out of an upgrade keep their checkpoints clear of each other where they meet. */
const ALONG_LINE: Record<"straight" | "out" | "in", readonly number[]> = {
  straight: [0.26, 0.5, 0.74],
  out: [0.36, 0.56, 0.76],
  in: [0.24, 0.44, 0.64],
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

/** What the time between shots is called for each hero, on a checkpoint that shortens it. */
const RELOAD_WORDS: Record<HeroKind, { name: string; verb: string }> = {
  rifleman: { name: "Quick Reload", verb: "Reloads" },
  medic: { name: "Quick Throw", verb: "Throws" },
  heavy: { name: "Hot Trigger", verb: "Fires" },
  tank: { name: "Quick Reload", verb: "Reloads" },
  bazooka: { name: "Quick Reload", verb: "Reloads" },
  grenadier: { name: "Quick Throw", verb: "Throws" },
  engineer: { name: "Hot Trigger", verb: "Fires" },
};

function checkpoint(kind: HeroKind, stat: CheckpointStat, percent: number): Draft {
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
        `Bullets leave a burst ${percent * SLIGHT_STAT}% quicker.`,
        {},
        "barrage",
        { unload: faster },
      );
    case "spin":
      return up("Spin Up", `Spins up ${percent * SLIGHT_STAT}% faster.`, {}, "gear", {
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

interface PathDraft {
  name: string;
  /** What its checkpoints give, round and round from the first upgrade to the capstone. */
  checkpoints: readonly CheckpointStat[];
  second: Draft;
  /** A tier 3 upgrade and the tier 4 upgrade it leads to, twice over. */
  upper: readonly [Draft, Draft];
  lower: readonly [Draft, Draft];
  capstone: Draft;
}

interface TreeDraft {
  first: Draft;
  paths: readonly [PathDraft, PathDraft];
}

const TREES: Record<HeroKind, TreeDraft> = {
  rifleman: {
    first: up("Basic Training", "+10% health.", { nature: 1 }, "heart", { hp: 1.1 }),
    paths: [
      {
        name: "Marksman",
        checkpoints: ["damage", "unload", "reload", "damage", "health"],
        second: up("Hot Rounds", "+15% damage.", { fire: 2 }, "flame", { damage: 1.15 }),
        upper: [
          up("Long Barrel", "+3 m range.", { fire: 3 }, "range", { range: 3 }),
          up("Deadeye", "+25% damage to defenses.", { fire: 5 }, "crosshair", {
            defenseDamage: 1.25,
          }),
        ],
        lower: [
          up("Steady Hands", "One more bullet in every burst.", { fire: 1, dark: 2 }, "barrage", {
            shots: 1,
          }),
          up("Fast Unload", "Bursts fire 40% quicker.", { fire: 3, dark: 2 }, "clock", {
            reload: 0.6,
          }),
        ],
        capstone: up(
          "Ricochet",
          "Bullets bounce off a building into the next one.",
          { fire: 4, dark: 4 },
          "star",
          { signature: 1 },
        ),
      },
      {
        name: "Survivor",
        checkpoints: ["health", "speed", "health", "reload", "damage"],
        second: up("Field Rations", "+20% health.", { nature: 2 }, "heart", { hp: 1.2 }),
        upper: [
          up("Light Boots", "+12% move speed.", { ice: 3 }, "speed", { speed: 1.12 }),
          up("Run and Gun", "Moves at 40% speed while firing, not 20%.", { ice: 5 }, "speed", {
            fireSpeed: 0.4,
          }),
        ],
        lower: [
          up(
            "Field Dressing",
            "Heals 3% a second after 4 seconds without being hit.",
            { nature: 3 },
            "medkit",
            { fieldDressing: true },
          ),
          up("Thick Vest", "Takes 15% less damage.", { nature: 5 }, "shield", {
            damageTaken: 0.85,
          }),
        ],
        capstone: up(
          "Last Stand",
          "Enrages below 30% health: fires 40% faster and takes 25% less damage.",
          { nature: 4, dark: 4 },
          "skull",
          { lastStand: true },
        ),
      },
    ],
  },
  medic: {
    first: up("Steady Hand", "+15% healing.", { nature: 1 }, "heal", { heal: 1.15 }),
    paths: [
      {
        name: "Field Hospital",
        checkpoints: ["heal", "reload", "heal", "health", "speed"],
        second: up("Stronger Mix", "+25% healing.", { nature: 2 }, "heal", { heal: 1.25 }),
        upper: [
          up("Wide Splash", "Bottles burst 1.5 m wider.", { nature: 3 }, "range", { splash: 1.5 }),
          up("Good Arm", "+3 m throwing range.", { fire: 5 }, "range", { range: 3 }),
        ],
        lower: [
          up(
            "Lingering Dose",
            "Healing carries on for 3 seconds after the bottle lands.",
            { nature: 2, ice: 1 },
            "clock",
            { lingering: true },
          ),
          up(
            "Overheal",
            "Healing past full health becomes a shield worth up to 20% health.",
            { nature: 3, dark: 2 },
            "shield",
            { overheal: true },
          ),
        ],
        capstone: up(
          "Guardian Angel",
          "Twice a raid, a fallen hero gets back up with 40% health.",
          { nature: 4, dark: 4 },
          "star",
          { signature: 2 },
        ),
      },
      {
        name: "Combat Medic",
        checkpoints: ["reload", "health", "speed", "heal", "health"],
        second: up("Quick Hands", "Throws 20% faster.", { fire: 2 }, "clock", { reload: 0.8 }),
        upper: [
          up("Fleet Foot", "+12% move speed.", { ice: 3 }, "speed", { speed: 1.12 }),
          up("Ice Pack", "Healed crewmates move 20% faster for 3 seconds.", { ice: 5 }, "speed", {
            icePack: true,
          }),
        ],
        lower: [
          up("Iron Stomach", "+30% health.", { nature: 3 }, "heart", { hp: 1.3 }),
          up(
            "Adrenaline",
            "Healed crewmates fire 20% faster for 3 seconds.",
            { fire: 3, dark: 2 },
            "energy",
            { adrenaline: true },
          ),
        ],
        capstone: up(
          "Miracle Bottle",
          "Every 5th bottle heals double, and bursts twice as wide.",
          { fire: 4, dark: 4 },
          "skull",
          { miracle: true },
        ),
      },
    ],
  },
  heavy: {
    first: up("Warm Up", "Minigun spins up 20% faster.", { fire: 1 }, "gear", { spinUp: 0.8 }),
    paths: [
      {
        name: "Gunner",
        checkpoints: ["damage", "reload", "spin", "damage", "health"],
        second: up("Hot Barrels", "Fires 15% faster.", { fire: 2 }, "flame", { reload: 0.85 }),
        upper: [
          up("Longer Belt", "+3 m range.", { fire: 3 }, "range", { range: 3 }),
          up("Tight Barrels", "40% less spread.", { fire: 5 }, "crosshair", { spread: 0.6 }),
        ],
        lower: [
          up("Heavy Rounds", "+20% damage.", { fire: 3 }, "sword", { damage: 1.2 }),
          up(
            "Overdrive",
            "After 5 seconds of non-stop fire, fires 25% faster.",
            { fire: 3, dark: 2 },
            "energy",
            { overdrive: true },
          ),
        ],
        capstone: up(
          "Explosive Belt",
          "At full spin, every 6th round explodes.",
          { fire: 4, dark: 4 },
          "star",
          { signature: 1 },
        ),
      },
      {
        name: "Juggernaut",
        checkpoints: ["health", "speed", "health", "damage", "reload"],
        second: up("Thick Skin", "+20% health.", { nature: 2 }, "heart", { hp: 1.2 }),
        upper: [
          up("Big Boots", "+12% move speed.", { ice: 3 }, "speed", { speed: 1.12 }),
          up("Rolling Thunder", "Moves at 45% speed while firing.", { ice: 5 }, "speed", {
            fireSpeed: 0.45,
          }),
        ],
        lower: [
          up(
            "Harpoon Hide",
            "Harpoons lose their bonus damage against him.",
            { nature: 3 },
            "shield",
            {
              harpoonProof: true,
            },
          ),
          up("Iron Gut", "Heals 2% a second while firing.", { nature: 5 }, "medkit", {
            ironGut: true,
          }),
        ],
        capstone: up(
          "Berserk",
          "Enrages after taking 500 damage: for 6 seconds, fires 50% faster and can't be slowed.",
          { nature: 4, dark: 4 },
          "skull",
          { berserk: true },
        ),
      },
    ],
  },
  tank: {
    first: up("Extra Plating", "+15% health.", { nature: 1 }, "heart", { hp: 1.15 }),
    paths: [
      {
        name: "Wrecker",
        checkpoints: ["damage", "reload", "damage", "health", "speed"],
        second: up("Bigger Shells", "+15% damage.", { fire: 2 }, "sword", { damage: 1.15 }),
        upper: [
          up("Wider Blast", "+1 m splash.", { fire: 3 }, "range", { splash: 1 }),
          up("Bunker Buster", "+30% damage to buildings.", { fire: 5 }, "hammer", {
            buildingDamage: 1.3,
          }),
        ],
        lower: [
          up("Autoloader", "Fires 25% faster.", { fire: 3 }, "clock", { reload: 0.75 }),
          up("Twin Barrels", "Every 4th shot fires two shells.", { fire: 3, dark: 2 }, "barrage", {
            twinEvery: 4,
          }),
        ],
        capstone: up(
          "Aftershock",
          "Whatever it destroys goes up in a shockwave that can set off the next.",
          { fire: 4, dark: 4 },
          "star",
          { signature: 1 },
        ),
      },
      {
        name: "Fortress",
        checkpoints: ["health", "speed", "health", "reload", "damage"],
        second: up("Reinforced Hull", "+20% health.", { nature: 2 }, "heart", { hp: 1.2 }),
        upper: [
          up("Bigger Engine", "+15% move speed.", { ice: 3 }, "speed", { speed: 1.15 }),
          up("Bulldozer", "Moves at 45% speed while firing.", { ice: 5 }, "speed", {
            fireSpeed: 0.45,
          }),
        ],
        lower: [
          up("Field Repairs", "Heals 2% a second while standing still.", { nature: 3 }, "hammer", {
            fieldRepairs: true,
          }),
          up("Reactive Armor", "Takes 20% less from blasts.", { nature: 5 }, "shield", {
            blastTaken: 0.8,
          }),
        ],
        capstone: up(
          "Siege Mode",
          "After 2 seconds standing still: fires 30% faster and takes 40% less damage.",
          { nature: 4, dark: 4 },
          "skull",
          { siegeMode: true },
        ),
      },
    ],
  },
  bazooka: {
    first: up("Quick Loader", "Reloads 10% faster.", { fire: 1 }, "clock", { reload: 0.9 }),
    paths: [
      {
        name: "Demolition",
        checkpoints: ["damage", "reload", "damage", "health", "speed"],
        second: up("Bigger Warhead", "+15% damage.", { fire: 2 }, "sword", { damage: 1.15 }),
        upper: [
          up("Long Tube", "+3 m range.", { fire: 3 }, "range", { range: 3 }),
          up("Fast Rockets", "Rockets fly 40% faster.", { ice: 5 }, "rocket", { shotSpeed: 1.4 }),
        ],
        lower: [
          up("Wide Blast", "+1 m splash.", { fire: 3 }, "range", { splash: 1 }),
          up("Napalm", "Blasts leave fire burning for 3 seconds.", { fire: 3, dark: 2 }, "flame", {
            napalm: true,
          }),
        ],
        capstone: up(
          "Cluster Warhead",
          "Rockets throw out 5 bomblets where they burst.",
          { fire: 4, dark: 4 },
          "star",
          { signature: 2 },
        ),
      },
      {
        name: "Hit and Run",
        checkpoints: ["health", "reload", "speed", "damage", "reload"],
        second: up("Flak Jacket", "+20% health.", { nature: 2 }, "heart", { hp: 1.2 }),
        upper: [
          up("Light Pack", "+12% move speed.", { ice: 3 }, "speed", { speed: 1.12 }),
          up("Getaway", "+30% move speed for 2 seconds after each shot.", { ice: 5 }, "speed", {
            getaway: true,
          }),
        ],
        lower: [
          up("Speed Loader", "Reloads 20% faster.", { fire: 3 }, "clock", { reload: 0.8 }),
          up("Double Tap", "Holds two rockets before reloading.", { fire: 3, dark: 2 }, "barrage", {
            doubleTap: true,
          }),
        ],
        capstone: up(
          "Guided Rocket",
          "Rockets curve round cover to reach a locked target.",
          { fire: 4, dark: 4 },
          "skull",
          { guided: true },
        ),
      },
    ],
  },
  grenadier: {
    first: up("Strong Arm", "+2 m range.", { fire: 1 }, "range", { range: 2 }),
    paths: [
      {
        name: "Ordnance",
        checkpoints: ["damage", "reload", "damage", "health", "speed"],
        second: up("Bigger Charge", "+15% damage.", { fire: 2 }, "sword", { damage: 1.15 }),
        upper: [
          up("Long Throw", "+3 m range.", { fire: 3 }, "range", { range: 3 }),
          up("Short Fuse", "Grenades land 40% sooner.", { ice: 5 }, "clock", { flight: 0.6 }),
        ],
        lower: [
          up("Wider Blast", "+1 m splash.", { fire: 3 }, "grenade", { splash: 1 }),
          up(
            "Mine Sweeper",
            "Shows every mine, and blasts set them off from twice as far.",
            { fire: 3, dark: 2 },
            "crosshair",
            { mineSweeper: true },
          ),
        ],
        capstone: up(
          "Skipping Stone",
          "Grenades skip on for two more blasts.",
          { fire: 4, dark: 4 },
          "star",
          { signature: 2 },
        ),
      },
      {
        name: "Old Campaigner",
        checkpoints: ["health", "reload", "health", "speed", "damage"],
        second: up("Stiff Upper Lip", "+20% health.", { nature: 2 }, "heart", { hp: 1.2 }),
        upper: [
          up("Quick March", "+12% move speed.", { ice: 3 }, "speed", { speed: 1.12 }),
          up("Tea Break", "Destroying a building heals 15%.", { nature: 5 }, "medkit", {
            healOnKill: 0.15,
          }),
        ],
        lower: [
          up("Quick Pin", "Throws 20% faster.", { fire: 3 }, "clock", { reload: 0.8 }),
          up("Twin Grenades", "Every 3rd throw is two grenades.", { fire: 3, dark: 2 }, "grenade", {
            twinEvery: 3,
          }),
        ],
        capstone: up(
          "Smoke Shell",
          "Every 5th grenade leaves smoke: defenses can't aim into it for 4 seconds.",
          { ice: 4, dark: 4 },
          "smoke",
          { smokeShell: true },
        ),
      },
    ],
  },
  engineer: {
    first: up("Spare Parts", "Fires 10% faster.", { fire: 1 }, "gear", { reload: 0.9 }),
    paths: [
      {
        name: "Salvager",
        checkpoints: ["damage", "reload", "damage", "health", "speed"],
        second: up("Sharper Rounds", "+15% damage.", { fire: 2 }, "sword", { damage: 1.15 }),
        upper: [
          up("Longer Barrel", "+3 m range.", { fire: 3 }, "range", { range: 3 }),
          up("Armor Piercing", "+25% damage to defenses.", { fire: 5 }, "crosshair", {
            defenseDamage: 1.25,
          }),
        ],
        lower: [
          up("Quick Wrench", "Fires 20% faster.", { fire: 3 }, "clock", { reload: 0.8 }),
          up("Overclock", "His turrets fire 30% faster.", { fire: 3, dark: 2 }, "energy", {
            overclock: true,
          }),
        ],
        capstone: up(
          "Salvage",
          "Everything he destroys comes back as his turret for a while.",
          { fire: 4, dark: 4 },
          "star",
          { signature: 1 },
        ),
      },
      {
        name: "Gadgeteer",
        checkpoints: ["health", "speed", "health", "reload", "damage"],
        second: up("Hard Hat", "+20% health.", { nature: 2 }, "heart", { hp: 1.2 }),
        upper: [
          up("Tool Belt", "+12% move speed.", { ice: 3 }, "speed", { speed: 1.12 }),
          up(
            "Pocket Turret",
            "Drops a small turret every 30 seconds.",
            { ice: 3, dark: 2 },
            "turret",
            { pocketTurret: true },
          ),
        ],
        lower: [
          up("Patch Up", "Destroying a building heals 10%.", { nature: 3 }, "medkit", {
            healOnKill: 0.1,
          }),
          up(
            "Repair Beam",
            "Slowly repairs the Tank and turrets near him.",
            { nature: 5 },
            "hammer",
            {
              repairBeam: true,
            },
          ),
        ],
        capstone: up(
          "Decoy Drone",
          "Every 30 seconds, a drone draws the defenses' fire for 6 seconds.",
          { nature: 4, dark: 4 },
          "skull",
          { decoyDrone: true },
        ),
      },
    ],
  },
};

const slug = (name: string) => name.toLowerCase().replace(/[^a-z]+/g, "-");

function buildTree(kind: HeroKind): readonly TreeUpgrade[] {
  const { first, paths } = TREES[kind];
  const out: TreeUpgrade[] = [];
  const add = (
    draft: Draft,
    tier: number,
    needs: readonly string[],
    path: string | null,
    column: number,
    row: number,
  ): TreeUpgrade => {
    const id = `${kind}-${slug(draft.name)}`;
    const gold = upgradeGold(tier);
    const upgrade = { ...draft, id, tier, gold, needs, path, column, row, line: null };
    out.push(upgrade);
    return upgrade;
  };
  const start = add(first, 1, [], null, 0, 3.5);
  paths.forEach((p, i) => {
    const top = i * 4;
    let made = 0;
    /** Lays the checkpoints from an upgrade towards the next, and says the last of them. */
    const line = (
      from: TreeUpgrade,
      to: { draft: Draft; column: number; row: number },
      tier: number,
    ): string => {
      const bend = tier === 5 ? "in" : to.row === from.row ? "straight" : "out";
      let needs = from.id;
      for (let n = 0; n < CHECKPOINTS_PER_LINE; n++) {
        const stat = p.checkpoints[made % p.checkpoints.length] ?? "health";
        const percent = CHECKPOINT_PERCENT[tier] ?? 0;
        const at = ALONG_LINE[bend][n] ?? 0.5;
        const id = `${kind}-step-${i}-${made}`;
        out.push({
          ...checkpoint(kind, stat, percent),
          id,
          tier: 0,
          gold: CHECKPOINT_GOLD[tier] ?? 0,
          needs: [needs],
          path: p.name,
          ...lineAt(from, to, at),
          line: { from: from.id, to: `${kind}-${slug(to.draft.name)}`, at },
        });
        needs = id;
        made++;
      }
      return needs;
    };
    const place = (draft: Draft, column: number, row: number) => ({ draft, column, row });

    const toSecond = place(p.second, 1, top + 1.5);
    const second = add(p.second, 2, [line(start, toSecond, 2)], p.name, 1, top + 1.5);
    const ends = [p.upper, p.lower].map(([third, fourth], j) => {
      const row = top + 0.5 + j * 2;
      const toThird = place(third, 2, row);
      const middle = add(third, 3, [line(second, toThird, 3)], p.name, 2, row);
      const toFourth = place(fourth, 3, row);
      return add(fourth, 4, [line(middle, toFourth, 4)], p.name, 3, row);
    });
    const toTop = place(p.capstone, 4, top + 1.5);
    const needs = ends.map((end) => line(end, toTop, 5));
    add(p.capstone, 5, needs, p.name, 4, top + 1.5);
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

/** The names of a hero's two paths. */
export function treePaths(kind: HeroKind): readonly [string, string] {
  const [a, b] = TREES[kind].paths;
  return [a.name, b.name];
}

/** The hero's two best upgrades, their capstones. */
export function capstones(kind: HeroKind): readonly TreeUpgrade[] {
  return heroTree(kind).filter((u) => u.tier === 5);
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
): boolean {
  if (owned.includes(upgrade.id) || lockedBy(kind, upgrade, owned)) return false;
  if (gold < upgrade.gold) return false;
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

/** Keeps only upgrades that exist and whose path is intact, for untrusted saved data. */
export function readOwned(kind: HeroKind, value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const wanted = new Set(value.filter((id): id is string => typeof id === "string"));
  const owned: string[] = [];
  for (const upgrade of heroTree(kind)) {
    if (!wanted.has(upgrade.id)) continue;
    if (upgrade.needs.length === 0 || upgrade.needs.some((id) => owned.includes(id))) {
      owned.push(upgrade.id);
    }
  }
  return owned;
}

/** Each hero's upgrades, empty to start with. */
export function noUpgrades(): Record<HeroKind, string[]> {
  return Object.fromEntries(HERO_KINDS.map((k) => [k, []])) as unknown as Record<
    HeroKind,
    string[]
  >;
}

/** Upgrades and checkpoints together. */
export const UPGRADES_PER_HERO = 55;
