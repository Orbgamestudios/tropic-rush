// The raid simulation: heroes, enemy defenses, projectiles, the gunboat and win/lose.
// No engine imports, so the same rules can later run on the multiplayer server. For speed,
// stepRaid() updates the state object in place instead of returning a new one.

import { BUILDINGS, type BuildingType, type DefenseAttack } from "./buildings";
import { buildingPower, emptyPurse, lootFor, type Purse, RESOURCES } from "./economy";
import {
  type Ability,
  ARTILLERY,
  type Arsenal,
  abilityCost,
  BARRAGE,
  boatShellFlightTime,
  FULL_ARSENAL,
  HEAL,
  SHOCK,
  SMOKE,
  START_ENERGY,
  smokeSeconds,
  stunSeconds,
  weaponPower,
} from "./gunboat";
import { HEROES, type HeroKind, shotSpread } from "./heroes";
import { type HeroMods, NO_MODS } from "./heroTrees";
import { HOME_SHAPE, type IslandLayout, type IslandShape, type ObstacleKind } from "./island";
import { createRng, type Rng } from "./rng";
import {
  FAST_BARRIER,
  FAST_FORWARD,
  RETRY_BACK,
  retryOwners,
  type Shards,
  SLOW_WORLD,
  TIME_POWER_SPECS,
  type TimePower,
} from "./timeShards";
import {
  add,
  angleDiff,
  angleOf,
  clamp,
  distance,
  fromAngle,
  length,
  lerp,
  normalize,
  scale,
  sub,
  type Vec2,
  vec,
} from "./vec";

export const RAID_SECONDS = 300;

const MINE_TRIGGER_RADIUS = 1.4;
const MINE_FUSE = 0.5;
const MINE_SPLASH = 2.6;
const MINE_DAMAGE = 450;
/** A sniper's sights stop following this long before it fires, leaving time to step aside. */
const SIGHTS_HELD = 0.25;
/** How fast a sniper's sights close on where it wants them, and how fast it reads a target's
 * movement. Smooth rather than instant, so a sudden change of direction takes it a moment. */
const SIGHTS_RATE = 7;
const TRACKING_RATE = 6;
/** The furthest ahead a sniper will lead a target, in meters. */
const MOST_LEAD = 9;
/** Nothing moves this fast: it's changed targets, which isn't movement to read. */
const FASTEST_TARGET = 18;

/** The little pop of a gunboat canister opening over its target, in meters. */
const CANISTER_BLAST = 0.8;
/** Heroes slow to this share of their speed while aiming or shooting. */
const SHOOTING_SPEED = 0.2;
/** On the move, shots stray this much wider, coming on and easing off over this many seconds. */
const MOVING_SPREAD = 0.66;
const STEADY_SECONDS = 0.5;
/** On the move, a throw can land this far off: a share of its length, and radians to the side. */
const THROW_LENGTH_SCATTER = 0.2;
const THROW_WIDTH_SCATTER = 0.12;
/** A released aim locks onto a building this far either side of it at least (radians). */
const LOCK_TOLERANCE = 0.22;
const CREW_TURRET = {
  hp: 900,
  seconds: 18,
  range: 11,
  damage: 40,
  reload: 0.4,
  speed: 30,
  radius: 0.8,
};
/** The Engineer's smaller turret and his decoy: how they differ from a full turret. */
const POCKET_TURRET = { hp: 450, seconds: 20, damage: 0.6 };
const DECOY_DRONE = { hp: 2000, seconds: 6, reach: 30 };
const GADGET_SECONDS = 30;
const AUTO_FIRE_SECONDS = 0.6;
/** Each building that falls takes this share off the headquarters, but never its last sliver. */
const HQ_CHIP = 0.04;
const HQ_CHIP_FLOOR = 0.1;
/** Once the headquarters is down the rest goes up one at a time, in about this many seconds. */
const CONQUEST = { firstAfter: 0.9, seconds: 7, longestGap: 0.45, lastAfter: 1.1 } as const;

/** What the capstones that carry a hero's signature move do; see heroTrees.ts. */
const SIGNATURE = {
  /** Sgt. Steele: how far a bullet can jump, and how much of its damage it keeps. */
  ricochetRange: 12,
  ricochetDamage: 0.6,
  /** Big Mo: every nth round at full spin explodes. */
  explosiveEvery: 6,
  explosiveDamage: 3,
  explosiveSplash: 2.2,
  /** Doc Penny: the health a fallen hero comes back with. */
  angelHealth: 0.4,
  /** Ace: bomblets per rocket are 1 + 2 × their charges. */
  bombletDamage: 0.25,
  bombletSplash: 1.8,
  /** Mr. Pemberton: each skip goes this far and keeps this much of the blast. */
  skipDistance: 4.5,
  skipDamage: 0.7,
  /** Tilly & Tank: the shockwave from whatever they destroy. */
  shockwaveRadius: 5.5,
  shockwaveDamage: 360,
} as const;

/** The rest of the tree's tricks, all in seconds and shares of something. */
const TRICKS = {
  /** Sgt. Steele's Field Dressing, and his Last Stand below this share of health. */
  dressingWait: 4,
  dressingHeal: 0.03,
  lastStandAt: 0.3,
  lastStandFire: 1.4,
  lastStandTaken: 0.75,
  /** Doc Penny. */
  lingerSeconds: 3,
  lingerShare: 0.2,
  overhealMost: 0.2,
  boostSeconds: 3,
  adrenalineFire: 1.2,
  miracleEvery: 5,
  /** Big Mo. */
  overdriveAfter: 5,
  overdriveFire: 1.21,
  gutHeal: 0.02,
  rageAt: 500,
  rageSeconds: 6,
  rageFire: 1.43,
  /** Tilly & Tank. */
  repairsHeal: 0.02,
  siegeAfter: 2,
  siegeFire: 1.3,
  siegeTaken: 0.6,
  /** Ace. */
  tapDelay: 0.3,
  napalmSeconds: 3,
  napalmShare: 0.14,
  guidedTurn: 5,
  /** Mr. Pemberton. */
  smokeEvery: 5,
  smokeSeconds: 4,
  sweeperReach: 2,
  /** Gus. */
  overclockFire: 1.3,
  beamReach: 8,
  beamHeal: 0.02,
} as const;

/** Lava burns a share of a hero's health each second. */
const LAVA_BURN = 0.1;
/** The mountain goes off this often, throwing burning rock. */
const ERUPTION_EVERY = 38;
const LAVA_BOMB = { damage: 260, splash: 4, flight: 2.2, peak: 22 };

export type Team = "crew" | "enemy";

export interface RaidHero {
  id: number;
  kind: HeroKind;
  /** Damage multiplier: how strong raiders are sent, and the hero's upgrades. */
  power: number;
  /** What the hero's upgrades change. */
  mods: HeroMods;
  pos: Vec2;
  /** Radians on the ground plane; 0 is east. */
  facing: number;
  hp: number;
  maxHp: number;
  alive: boolean;
  /** Calling the gunboat: the hero stands where they are, still in the fight, and can't move. */
  inBoat: boolean;
  moving: boolean;
  /** True while the hero is shooting (for muzzle flashes, spray and the minigun's spin). */
  firing: boolean;
  reload: number;
  burstLeft: number;
  burstTimer: number;
  burstDir: Vec2;
  /** Minigun spin-up, 0 to 1. */
  spin: number;
  /** How much moving is throwing off their aim: 0 steady, 1 at the worst. */
  unsteady: number;
  autoFireTime: number;
  autoDir: Vec2;
  autoDistance: number;
  /** The building this hero is locked onto and firing at, until it's gone or out of range. */
  targetId: number | null;
  /** The crewmate a medic is locked onto and throwing to. */
  patientId: number | null;
  /** Rounds fired, for everything that counts every nth shot. */
  shotCount: number;
  /**
   * Firing from inside smoke gives a hero away: from `revealFrom` until `revealUntil` (raid time,
   * seconds), defenses can see them through it.
   */
  revealFrom: number;
  revealUntil: number;
  /** Fallen heroes this medic has brought back this raid. */
  saves: number;
  /** Health soaked up before the real health is touched. */
  shield: number;
  /** Seconds since last hit, firing without a break, and standing still. */
  sinceHit: number;
  fireTime: number;
  stillTime: number;
  /** Damage taken towards going berserk. */
  rageBuild: number;
  /** Seconds left of each boost. */
  rage: number;
  pumped: number;
  /** A second rocket is ready, for a quick double shot. */
  tapReady: boolean;
  /** Seconds until the next pocket turret and decoy drone. */
  pocketIn: number;
  droneIn: number;
  /** The time shards this hero's player brought, less those used. */
  shards: Shards;
  /** What's left of fast forward's barrier round them. */
  barrier: number;
  /** Where they were and how they stood a moment ago, every so often: what a retry goes back to. */
  trail: { pos: Vec2; hp: number }[];
  trailIn: number;
  /** A recorded copy plays out what this hero did; null for a hero in their own right. */
  copyOf: number | null;
}

export interface RaidBuilding {
  id: number;
  type: BuildingType;
  /** Upgrade level, and the health and damage multiplier it gives. */
  level: number;
  power: number;
  pos: Vec2;
  radius: number;
  hp: number;
  maxHp: number;
  destroyed: boolean;
  reload: number;
  /** Where the defense is pointing, in radians. */
  aim: number;
  firing: boolean;
  /** Where a sniper's sights are while it takes aim, and how long it's been at it. */
  sights: Vec2 | null;
  aiming: number;
  /** Where a sniper last saw its target, and how it reckons that's moving. */
  tracked: Vec2 | null;
  trackedVel: Vec2;
  /** Brought to nothing while time stood still: it falls, to this hero, when time goes on. */
  fallsTo: number | null;
  /** It's paid out its energy and loot: coming back on a rewind, it doesn't pay again. */
  paid: boolean;
}

export type ProjectileKind =
  | "bullet"
  | "sniper"
  | "rocket"
  | "shell"
  | "harpoon"
  | "grenade"
  | "mortar"
  | "artillery"
  | "vial"
  | "acid"
  | "lava";

export interface Lob {
  from: Vec2;
  to: Vec2;
  /** Seconds since launch; starts negative for staggered barrage shells. */
  t: number;
  duration: number;
  /** Highest point of the arc, in meters (for the renderer). */
  peak: number;
}

export interface Projectile {
  id: number;
  kind: ProjectileKind;
  team: Team;
  ownerId: number;
  pos: Vec2;
  vel: Vec2;
  damage: number;
  splash: number;
  buildingBonus: number;
  heavyBonus: number;
  traveled: number;
  maxDistance: number;
  lob: Lob | null;
  /** Ricochets or grenade skips left, or the rocket's cluster tier. */
  charges: number;
  /** The building a guided rocket is curving towards. */
  homing: number | null;
  /** What it leaves where it lands. */
  leaves: ZoneDrop | null;
}

export interface Mine {
  id: number;
  pos: Vec2;
  /** Counts down once triggered; null while waiting. */
  fuse: number | null;
  exploded: boolean;
}

export type ZoneKind = "heal" | "fire" | "smoke" | "shock";

/** A zone a shell leaves behind it. */
export interface ZoneDrop {
  kind: ZoneKind;
  radius: number;
  seconds: number;
}

export interface Zone {
  id: number;
  kind: ZoneKind;
  pos: Vec2;
  radius: number;
  time: number;
  /** Healing a second, on a healing zone. */
  healPerSecond: number;
  /** Damage a second to buildings, on burning ground. */
  burnPerSecond: number;
  ownerId: number;
}

export type TurretKind = "salvage" | "pocket" | "decoy";

export interface CrewTurret {
  id: number;
  kind: TurretKind;
  ownerId: number;
  pos: Vec2;
  hp: number;
  maxHp: number;
  time: number;
  reload: number;
  aim: number;
}

export interface Obstacle {
  id: number;
  kind: ObstacleKind;
  pos: Vec2;
  radius: number;
  blocksShots: boolean;
  scale: number;
  rotation: number;
}

export type RaidEvent =
  | { type: "shot"; pos: Vec2; dir: Vec2; kind: ProjectileKind; team: Team; ownerId: number }
  | { type: "explosion"; pos: Vec2; radius: number }
  | { type: "hit"; pos: Vec2 }
  | { type: "heal"; pos: Vec2 }
  | { type: "healBurst"; pos: Vec2; radius: number }
  | { type: "acidBurst"; pos: Vec2; radius: number }
  | { type: "loot"; pos: Vec2; loot: Partial<Purse> }
  | { type: "destroyed"; id: number; pos: Vec2; buildingType: BuildingType }
  | { type: "heroDown"; id: number; pos: Vec2 }
  | { type: "boarded"; heroId: number }
  | { type: "leftBoat"; heroId: number }
  | { type: "boatFire"; ability: Ability; target: Vec2 }
  | { type: "mineTriggered"; id: number; pos: Vec2 }
  /** A hero's rage or last stand has just come on. */
  | { type: "enrage"; pos: Vec2 }
  | { type: "eruption"; pos: Vec2 }
  | { type: "timePower"; power: TimePower; heroId: number }
  | { type: "timeEnd"; power: TimePower }
  /** A fallen hero taken back a few seconds, on a retry shard the given hero brought. */
  | { type: "retried"; heroId: number; spentFrom: number; pos: Vec2; path: Vec2[] }
  /** A record's time goes back: its hero runs back along the way they came, to where it began. */
  | { type: "rewound"; heroId: number; path: Vec2[] };

export type RaidStatus = "playing" | "won" | "lost";

/** One step of the past: each building's health, whether it was down and its aim, and the shots. */
export interface PastFrame {
  time: number;
  buildings: [id: number, hp: number, down: number, aim: number][];
  shots: Projectile[];
}

/** What goes back when a record ends. The clock, the retries and the shards used don't. */
interface RecordedWorld {
  heroes: RaidHero[];
  buildings: RaidBuilding[];
  projectiles: Projectile[];
  mines: Mine[];
  zones: Zone[];
  turrets: CrewTurret[];
  boat: RaidState["boat"];
  energy: number;
  loot: Purse;
  abilityUses: Record<Ability, number>;
  conquest: number | null;
  eruptionIn: number;
}

export interface RaidState {
  time: number;
  timeLimit: number;
  status: RaidStatus;
  lostReason: "crew" | "time" | null;
  heroes: RaidHero[];
  buildings: RaidBuilding[];
  projectiles: Projectile[];
  mines: Mine[];
  zones: Zone[];
  turrets: CrewTurret[];
  obstacles: Obstacle[];
  boat: { pos: Vec2; occupant: number | null };
  energy: number;
  /** Materials carried off so far, from mills and storages broken. Kept win or lose. */
  loot: Purse;
  abilityUses: Record<Ability, number>;
  /** The gunboat weapons this crew has, and their levels. */
  gunboat: Arsenal;
  /** What happened during the last step, for effects and sounds. */
  events: RaidEvent[];
  nextId: number;
  rng: Rng;
  /** The land the raid is on. */
  shape: IslandShape;
  /** Seconds until the next eruption, on an island with a volcano. */
  eruptionIn: number;
  /** The headquarters is down: seconds until the next building goes up. Null until then. */
  conquest: number | null;
  /** AI raiders on the crew's own island: they grab what they can, and only its fall ends it. */
  hitAndRun: boolean;
  /**
   * AI raiders off a raider ship: they strafe the defenses and work the gunboat, saving its energy
   * for big strikes if they bombard. Null for raids from before the ships, which replay as they ran.
   */
  tactics: { bombards: boolean } | null;
  /**
   * The time power running, crew-wide, and who used it. A record is `replaying` once time has
   * gone back and the copy is playing it out.
   */
  timePower: { power: TimePower; heroId: number; left: number; replaying?: boolean } | null;
  /** The world step by step over the last few seconds, for a rewind: kept while one's to hand. */
  past: PastFrame[];
  /** Damage done to each building while a rewind runs, which stays, and shots that hit on it. */
  rewound: { hurt: Record<number, number>; hit: string[] } | null;
  /** A record: the world as it began, and what its hero has done since, step by step. */
  recording: { world: RecordedWorld; inputs: HeroInput[]; step: number; path: Vec2[] } | null;
  /** Retries left in the crew's pool, and whose shard each one is, in the order they'll go. */
  retries: number;
  retryFrom: number[];
}

export interface HeroInput {
  /** Movement stick, length 0 to 1. */
  move: Vec2;
  /** Fire straight away in this direction (length 0 to 1 sets the distance). AI and tests. */
  aim: Vec2 | null;
  /** The player is dragging the aim stick: shows the cone and slows the hero, doesn't fire. */
  aimPreview: Vec2 | null;
  /** The player let go of the aim stick: lock onto the building in this direction's cone. */
  lockAt: Vec2 | null;
  /** A quick tap of the fire button: lock onto the nearest tower in range (tap again to stop). */
  autoAim: boolean;
  /** Open the gunboat's view, or go back to the hero. */
  toggleBoat: boolean;
  boatAbility: { ability: Ability; target: Vec2 } | null;
  /** Use a time shard. */
  timePower: TimePower | null;
}

export const IDLE_INPUT: HeroInput = {
  move: { x: 0, y: 0 },
  aim: null,
  aimPreview: null,
  lockAt: null,
  autoAim: false,
  toggleBoat: false,
  boatAbility: null,
  timePower: null,
};

/** What's left of an input once a step has used its one-off presses. */
export function afterStep(input: HeroInput): HeroInput {
  return {
    ...input,
    lockAt: null,
    autoAim: false,
    toggleBoat: false,
    boatAbility: null,
    timePower: null,
  };
}

/**
 * `powers` are how strong each hero is sent in (night raiders start well below a player's heroes)
 * and `mods` what their upgrades add (see heroMods); missing ones change nothing. `shards` are the
 * time crystals each hero's player brings, and `raiders` how many the island calls for, which
 * sets how many retries there are.
 */
export function createRaid(
  layout: IslandLayout,
  kinds: readonly HeroKind[],
  powers: readonly number[] = [],
  mods: readonly HeroMods[] = [],
  gunboat: Arsenal = FULL_ARSENAL,
  shards: readonly Shards[] = [],
  raiders = 1,
): RaidState {
  const rng = createRng(layout.seed ^ 0x5bd1e995);
  const buffs = layout.buffs ?? { health: 1, damage: 1 };
  let nextId = 1;
  const heroes = kinds.map((kind, i): RaidHero => {
    const spec = HEROES[kind];
    const offset = (i - (kinds.length - 1) / 2) * 2.2;
    const power = powers[i] ?? 1;
    const perks = mods[i] ?? NO_MODS;
    const hp = spec.hp * power * perks.hp;
    return {
      id: nextId++,
      kind,
      power: power * perks.damage,
      mods: perks,
      pos: vec(layout.spawn.x + offset, layout.spawn.y),
      facing: -Math.PI / 2,
      hp,
      maxHp: hp,
      alive: true,
      inBoat: false,
      moving: false,
      firing: false,
      reload: 0,
      burstLeft: 0,
      burstTimer: 0,
      burstDir: vec(0, -1),
      spin: 0,
      unsteady: 0,
      autoFireTime: 0,
      autoDir: vec(0, -1),
      autoDistance: 0,
      shotCount: 0,
      revealFrom: 0,
      revealUntil: 0,
      saves: 0,
      shield: 0,
      sinceHit: 0,
      fireTime: 0,
      stillTime: 0,
      rageBuild: 0,
      rage: 0,
      pumped: 0,
      tapReady: true,
      pocketIn: GADGET_SECONDS,
      droneIn: GADGET_SECONDS,
      targetId: null,
      patientId: null,
      shards: { ...shards[i] },
      barrier: 0,
      trail: [],
      trailIn: 0,
      copyOf: null,
    };
  });
  const owners = retryOwners(
    heroes.map((h) => h.shards.retry ?? 0),
    raiders,
  );
  const retries = owners.length;
  const retryFrom = owners.map((i) => heroes[i]?.id ?? 0);
  const buildings = layout.buildings.map((b): RaidBuilding => {
    const spec = BUILDINGS[b.type];
    const level = b.level ?? 1;
    const power = buildingPower(level, b.type);
    const hp = spec.hp * power * buffs.health;
    return {
      id: nextId++,
      type: b.type,
      level,
      power: power * buffs.damage,
      pos: { ...b.pos },
      radius: spec.radius,
      hp,
      maxHp: hp,
      destroyed: false,
      reload: spec.attack ? rng() * spec.attack.reload : 0,
      aim: Math.PI / 2,
      firing: false,
      sights: null,
      aiming: 0,
      tracked: null,
      trackedVel: vec(0, 0),
      fallsTo: null,
      paid: false,
    };
  });
  const obstacles = layout.obstacles.map(
    (o): Obstacle => ({ ...o, id: nextId++, pos: { ...o.pos } }),
  );
  const mines = layout.mines.map(
    (pos): Mine => ({ id: nextId++, pos: { ...pos }, fuse: null, exploded: false }),
  );
  return {
    time: 0,
    timeLimit: RAID_SECONDS,
    status: "playing",
    lostReason: null,
    heroes,
    buildings,
    projectiles: [],
    mines,
    zones: [],
    turrets: [],
    obstacles,
    boat: { pos: { ...layout.boat }, occupant: null },
    energy: START_ENERGY,
    loot: emptyPurse(),
    abilityUses: { artillery: 0, heal: 0, shock: 0, barrage: 0, smoke: 0 },
    gunboat,
    events: [],
    nextId,
    rng,
    shape: layout.shape ?? HOME_SHAPE,
    eruptionIn: ERUPTION_EVERY * 0.6,
    conquest: null,
    hitAndRun: false,
    tactics: null,
    timePower: null,
    retries,
    retryFrom,
    past: [],
    rewound: null,
    recording: null,
  };
}

/** Advances the raid by `dt` seconds. `inputs[i]` drives `state.heroes[i]`. */
export function stepRaid(
  state: RaidState,
  inputs: readonly (HeroInput | undefined)[],
  dt: number,
): void {
  state.events.length = 0;
  if (state.status !== "playing") return;
  state.time += dt;
  startTimePower(state, inputs);
  const power = state.timePower?.power;
  // Fast forward runs everything twice over in the same time; slow and pause hold the world back
  // while the heroes and their shots go on as they were.
  const passes = power === "fastForward" ? FAST_FORWARD : 1;
  // While a rewind runs the world goes back through the past instead of on.
  const world = power === "pause" || power === "rewind" ? 0 : power === "slow" ? SLOW_WORLD : 1;
  for (let pass = 0; pass < passes; pass++) {
    state.heroes.forEach((hero, i) => {
      const input = hero.copyOf === null ? (inputs[i] ?? IDLE_INPUT) : echoInput(state);
      if (pass === 0) record(state, hero, input);
      updateHero(state, hero, pass === 0 ? input : afterStep(input), dt);
    });
    if (power === "rewind") runBack(state);
    if (world > 0) updateBuildings(state, dt * world);
    else for (const b of state.buildings) b.firing = false;
    updateCrewTurrets(state, dt);
    updateProjectiles(state, dt, dt * world);
    updateMines(state, dt * world);
    updateZones(state, dt);
    updateLava(state, dt * world);
    stepConquest(state, dt * world);
  }
  keepTrails(state, dt);
  keepPast(state);
  tickTimePower(state, dt);
  if (state.status === "playing" && state.conquest === null) {
    if (state.heroes.every((h) => !h.alive)) {
      state.status = "lost";
      state.lostReason = "crew";
    } else if (state.time >= state.timeLimit) {
      state.status = "lost";
      state.lostReason = "time";
    }
  }
}

export function destructionPercent(state: RaidState): number {
  if (state.buildings.length === 0) return 0;
  const destroyed = state.buildings.filter((b) => b.destroyed).length;
  return Math.round((destroyed / state.buildings.length) * 100);
}

/** The gunboat answers one hero at a time, wherever they are. */
export function canBoard(state: RaidState, hero: RaidHero): boolean {
  return hero.alive && !hero.inBoat && state.boat.occupant === null;
}

export function nextAbilityCost(state: RaidState, ability: Ability): number {
  return abilityCost(ability, state.abilityUses[ability]);
}

// ---------------------------------------------------------------------------------------------
// Time shards

/** Whether a hero can use one of their shards now: one power runs at a time, for everyone. */
export function canUseShard(state: RaidState, hero: RaidHero, power: TimePower): boolean {
  return (
    state.timePower === null &&
    hero.alive &&
    power !== "retry" &&
    hero.copyOf === null &&
    (hero.shards[power] ?? 0) > 0
  );
}

function startTimePower(state: RaidState, inputs: readonly (HeroInput | undefined)[]): void {
  state.heroes.forEach((hero, i) => {
    const power = inputs[i]?.timePower;
    if (!power || !canUseShard(state, hero, power)) return;
    hero.shards[power] = (hero.shards[power] ?? 1) - 1;
    state.timePower = { power, heroId: hero.id, left: TIME_POWER_SPECS[power].seconds };
    if (power === "fastForward") {
      for (const h of state.heroes) h.barrier = h.alive ? h.maxHp * FAST_BARRIER : 0;
    }
    if (power === "rewind") {
      // It runs back as far as there's past to go back through, up to its full length.
      const first = state.past[0];
      const reach = first ? state.time - first.time : 0;
      state.timePower.left = Math.min(state.timePower.left, reach);
      state.rewound = { hurt: {}, hit: [] };
    }
    if (power === "record") {
      state.recording = { world: recordWorld(state), inputs: [], step: 0, path: [] };
    }
    state.events.push({ type: "timePower", power, heroId: hero.id });
  });
}

function tickTimePower(state: RaidState, dt: number): void {
  const running = state.timePower;
  if (!running) return;
  running.left -= dt;
  if (running.left > 0) return;
  if (running.power === "record" && !running.replaying) replay(state, running);
  else endTimePower(state);
}

function endTimePower(state: RaidState): void {
  const running = state.timePower;
  if (!running) return;
  state.timePower = null;
  state.events.push({ type: "timeEnd", power: running.power });
  for (const h of state.heroes) h.barrier = 0;
  // A rewind has used up the past it ran back through; a record's copy is gone.
  if (running.power === "rewind") {
    state.past = [];
    state.rewound = null;
  }
  if (running.power === "record") {
    state.heroes = state.heroes.filter((h) => h.copyOf === null);
    state.recording = null;
  }
  // Whatever was brought to nothing while time stood still comes down now.
  for (const b of state.buildings) {
    if (b.fallsTo !== null && !b.destroyed) knockDown(state, b, b.fallsTo);
    b.fallsTo = null;
  }
}

/** Keeps the last few seconds of the world, while anyone in the crew could rewind it. */
function keepPast(state: RaidState): void {
  if (state.timePower?.power === "rewind") return;
  if (!state.heroes.some((h) => h.alive && (h.shards.rewind ?? 0) > 0)) {
    state.past.length = 0;
    return;
  }
  state.past.push({
    time: state.time,
    buildings: state.buildings.map((b) => [b.id, b.hp, b.destroyed ? 1 : 0, b.aim]),
    shots: state.projectiles.filter((p) => p.team === "enemy").map(copyProjectile),
  });
  const reach = TIME_POWER_SPECS.rewind.seconds;
  while ((state.past[0]?.time ?? state.time) < state.time - reach) state.past.shift();
}

function copyProjectile(p: Projectile): Projectile {
  return {
    ...p,
    pos: { ...p.pos },
    vel: { ...p.vel },
    lob: p.lob && { ...p.lob, from: { ...p.lob.from }, to: { ...p.lob.to } },
    leaves: p.leaves && { ...p.leaves },
  };
}

/**
 * One step of a rewind: the world goes back one step through the past. Buildings get back the
 * damage done to them before it began, though not what's done while it runs, and come back up if
 * they'd fallen. Enemy shots fly back the way they came, catching any hero in their path, and into
 * the guns that fired them.
 */
function runBack(state: RaidState): void {
  const frame = state.past.pop();
  const rewound = state.rewound;
  if (!frame || !rewound) {
    endTimePower(state);
    return;
  }
  const byId = new Map(state.buildings.map((b) => [b.id, b]));
  const earlier = new Set(frame.shots.map((p) => p.id));
  for (const p of state.projectiles) {
    if (p.team !== "enemy" || earlier.has(p.id)) continue;
    const gun = byId.get(p.ownerId);
    if (gun && !gun.destroyed) hurtBack(state, gun, p.damage);
  }
  for (const [id, hp, down, aim] of frame.buildings) {
    const b = byId.get(id);
    if (!b) continue;
    const left = hp - (rewound.hurt[id] ?? 0);
    if (left <= 0) {
      if (!b.destroyed) knockDown(state, b, 0);
      continue;
    }
    if (b.destroyed && down === 0) b.destroyed = false;
    if (b.destroyed) continue;
    b.hp = Math.min(b.maxHp, left);
    b.aim = aim;
    b.firing = false;
  }
  state.projectiles = state.projectiles.filter((p) => p.team !== "enemy").concat(frame.shots);
  for (const p of frame.shots) {
    if (p.lob) continue;
    for (const hero of state.heroes) {
      if (!hero.alive) continue;
      const key = `${p.id}:${hero.id}`;
      if (distance(p.pos, hero.pos) > HEROES[hero.kind].radius + 0.3) continue;
      if (rewound.hit.includes(key)) continue;
      rewound.hit.push(key);
      damageHero(state, hero, p.damage, p.heavyBonus);
    }
  }
}

/** A shot flying home into its own gun. */
function hurtBack(state: RaidState, gun: RaidBuilding, amount: number): void {
  const rewound = state.rewound;
  if (rewound) rewound.hurt[gun.id] = (rewound.hurt[gun.id] ?? 0) + amount;
  gun.hp -= amount;
  state.events.push({ type: "hit", pos: { ...gun.pos } });
  if (gun.hp <= 0) knockDown(state, gun, 0);
}

function recordWorld(state: RaidState): RecordedWorld {
  return structuredClone({
    heroes: state.heroes,
    buildings: state.buildings,
    projectiles: state.projectiles,
    mines: state.mines,
    zones: state.zones,
    turrets: state.turrets,
    boat: state.boat,
    energy: state.energy,
    loot: state.loot,
    abilityUses: state.abilityUses,
    conquest: state.conquest,
    eruptionIn: state.eruptionIn,
  });
}

/** While a record runs, notes what its hero does each step. */
function record(state: RaidState, hero: RaidHero, input: HeroInput): void {
  const running = state.timePower;
  if (running?.power !== "record" || running.replaying || running.heroId !== hero.id) return;
  const rec = state.recording;
  if (!rec) return;
  rec.inputs.push(structuredClone(input));
  // Where they went, now and then, for running back along it when time goes back.
  if (rec.inputs.length % 6 === 1) rec.path.push({ ...hero.pos });
}

/** What a recorded copy does this step: what its hero did, though never on the gunboat. */
function echoInput(state: RaidState): HeroInput {
  const rec = state.recording;
  const input = rec?.inputs[rec.step] ?? IDLE_INPUT;
  return { ...input, toggleBoat: false, boatAbility: null, timePower: null };
}

/** The record runs out: the world goes back to where it began, and the copy sets off. */
function replay(state: RaidState, running: NonNullable<RaidState["timePower"]>): void {
  const rec = state.recording;
  if (!rec) {
    endTimePower(state);
    return;
  }
  // Where the hero got to, before time takes them back.
  const end = state.heroes.find((h) => h.id === running.heroId)?.pos;
  const world = structuredClone(rec.world);
  const shards = new Map(state.heroes.map((h) => [h.id, h.shards]));
  for (const h of world.heroes) h.shards = shards.get(h.id) ?? h.shards;
  const recorder = world.heroes.find((h) => h.id === running.heroId);
  Object.assign(state, {
    heroes: world.heroes,
    buildings: world.buildings,
    projectiles: world.projectiles,
    mines: world.mines,
    zones: world.zones,
    turrets: world.turrets,
    boat: world.boat,
    energy: world.energy,
    loot: world.loot,
    abilityUses: world.abilityUses,
    conquest: world.conquest,
    eruptionIn: world.eruptionIn,
  });
  if (recorder?.alive) {
    const copy: RaidHero = {
      ...structuredClone(recorder),
      id: state.nextId++,
      copyOf: recorder.id,
      inBoat: false,
      shards: {},
      trail: [],
    };
    state.heroes.push(copy);
  }
  state.events.push({
    type: "rewound",
    heroId: running.heroId,
    path: [...(end ? [{ ...end }] : []), ...[...rec.path].reverse()],
  });
  running.replaying = true;
  running.left = TIME_POWER_SPECS.record.seconds;
  state.events.push({ type: "timePower", power: "record", heroId: running.heroId });
}

/** The hero a record's copy is playing for: unseen by the defenses while the copy is out. */
function hiddenByCopy(state: RaidState, hero: RaidHero): boolean {
  const running = state.timePower;
  return running?.power === "record" && running.replaying === true && running.heroId === hero.id;
}

const TRAIL_EVERY = 0.25;
/** A retry never brings a hero back with less than this share of their health. */
const RETRY_LEAST = 0.3;

function keepTrails(state: RaidState, dt: number): void {
  if (state.retries <= 0) return;
  for (const hero of state.heroes) {
    if (!hero.alive) continue;
    hero.trailIn -= dt;
    if (hero.trailIn > 0) continue;
    hero.trailIn = TRAIL_EVERY;
    hero.trail.push({ pos: { ...hero.pos }, hp: hero.hp });
    if (hero.trail.length > RETRY_BACK / TRAIL_EVERY + 1) hero.trail.shift();
  }
}

/** Takes a falling hero back to a few seconds ago, if the crew has a retry left. */
function retry(state: RaidState, hero: RaidHero): boolean {
  if (state.retries <= 0) return false;
  const then = hero.trail[0] ?? { pos: hero.pos, hp: hero.maxHp };
  state.retries--;
  const spentFrom = state.retryFrom.shift() ?? hero.id;
  // The way back, from where they fell to where they were.
  const path = [{ ...hero.pos }, ...hero.trail.map((t) => ({ ...t.pos })).reverse()];
  hero.pos = { ...then.pos };
  hero.hp = Math.max(then.hp, hero.maxHp * RETRY_LEAST);
  hero.trail = [];
  hero.trailIn = 0;
  state.events.push({ type: "retried", heroId: hero.id, spentFrom, pos: { ...hero.pos }, path });
  return true;
}

// ---------------------------------------------------------------------------------------------
// Heroes

function updateHero(state: RaidState, hero: RaidHero, input: HeroInput, dt: number): void {
  if (hero.copyOf !== null && state.recording) state.recording.step++;
  if (!hero.alive) return;
  // A minigun keeps the part of a step it was owed, or every round would wait for a whole step and
  // anything that speeds it up a little would never show.
  hero.reload -= dt;
  if (HEROES[hero.kind].attack.kind !== "minigun") hero.reload = Math.max(0, hero.reload);
  hero.autoFireTime = Math.max(0, hero.autoFireTime - dt);
  tickTricks(state, hero, dt);

  // The base has fallen: everyone stands and watches it go.
  if (state.conquest !== null) {
    if (hero.inBoat) toggleBoat(state, hero);
    hero.moving = false;
    hero.firing = false;
    hero.targetId = null;
    hero.patientId = null;
    return;
  }

  if (input.toggleBoat) toggleBoat(state, hero);
  // On the gunboat a hero can't move or pick a new target, but keeps firing at what they're on.
  if (hero.inBoat) {
    hero.moving = false;
    if (input.boatAbility) fireAbility(state, input.boatAbility.ability, input.boatAbility.target);
  } else {
    moveByInput(state, hero, input, dt);
    lockOn(state, hero, input);
  }
  hero.unsteady = clamp(hero.unsteady + (hero.moving ? dt : -dt) / STEADY_SECONDS, 0, 1);

  let dir: Vec2 | null = null;
  let aimDistance = heroRange(hero);
  const aim = hero.inBoat ? null : input.aim;
  const locked = hero.targetId === null ? null : lockedBuilding(state, hero);
  if (hero.targetId !== null && !locked) hero.targetId = null;
  const patient = hero.patientId === null ? null : lockedPatient(state, hero);
  if (aim && length(aim) > 0.15) {
    dir = normalize(aim);
    aimDistance = clamp(length(aim), 0, 1) * heroRange(hero);
    hero.autoFireTime = 0;
  } else if (locked) {
    dir = normalize(sub(locked.pos, hero.pos));
    aimDistance = distance(locked.pos, hero.pos);
  } else if (patient) {
    dir = normalize(sub(patient.pos, hero.pos));
    aimDistance = distance(patient.pos, hero.pos);
  } else if (hero.autoFireTime > 0) {
    dir = hero.autoDir;
    aimDistance = hero.autoDistance;
  }

  if (dir) hero.facing = angleOf(dir);
  else if (hero.moving) hero.facing = angleOf(input.move);

  const before = state.events.length;
  updateAttack(state, hero, dir, aimDistance, dt);
  const shot = state.events
    .slice(before)
    .some((e) => e.type === "shot" && e.ownerId === hero.id && e.kind !== "vial");
  if (shot && inSmoke(state, hero.pos)) givenAway(state, hero);
}

/** How long after firing from smoke the defenses round about can see a hero, and for how long. */
const SMOKE_GIVEN_AWAY = { after: 0.6, seconds: 1.5 };

/** A shot from inside smoke: a moment later the defenses can see where it came from. */
function givenAway(state: RaidState, hero: RaidHero): void {
  if (state.time >= hero.revealUntil) hero.revealFrom = state.time + SMOKE_GIVEN_AWAY.after;
  hero.revealUntil = state.time + SMOKE_GIVEN_AWAY.after + SMOKE_GIVEN_AWAY.seconds;
}

/** Whether defenses can see a hero, smoke or no smoke. */
function seen(state: RaidState, hero: RaidHero): boolean {
  if (hiddenByCopy(state, hero)) return false;
  if (!inSmoke(state, hero.pos)) return true;
  return state.time >= hero.revealFrom && state.time < hero.revealUntil;
}

/**
 * Locking on: let go of a drag to lock onto the building in that direction, or tap to lock onto
 * the nearest tower (tapping the same one again stops). With nothing in the arc, letting go just
 * stops firing. A medic locks onto crewmates first, and buildings if there's nobody there.
 */
function lockOn(state: RaidState, hero: RaidHero, input: HeroInput): void {
  if (HEROES[hero.kind].attack.kind === "heal") lockPatient(state, hero, input);
  else if (input.lockAt && length(input.lockAt) > 0.05) {
    hero.targetId = lockCandidate(state, hero, input.lockAt)?.id ?? null;
  } else if (input.autoAim) {
    const target = lockCandidate(state, hero, null);
    hero.targetId = target && target.id !== hero.targetId ? target.id : null;
    hero.autoFireTime = 0;
  }
}

/** The timers and steady effects of a hero's upgrades, once a step. */
function tickTricks(state: RaidState, hero: RaidHero, dt: number): void {
  const m = hero.mods;
  hero.sinceHit += dt;
  hero.rage = Math.max(0, hero.rage - dt);
  hero.pumped = Math.max(0, hero.pumped - dt);
  hero.fireTime = hero.firing ? hero.fireTime + dt : 0;
  hero.stillTime = hero.moving ? 0 : hero.stillTime + dt;
  const regen =
    (m.fieldDressing && hero.sinceHit >= TRICKS.dressingWait ? TRICKS.dressingHeal : 0) +
    (m.ironGut && hero.firing ? TRICKS.gutHeal : 0) +
    (m.fieldRepairs && !hero.moving ? TRICKS.repairsHeal : 0);
  if (regen > 0) healHero(state, hero, hero.maxHp * regen * dt);
  if (m.repairBeam) repairNearby(state, hero, dt);
  if (m.pocketTurret) {
    hero.pocketIn -= dt;
    if (hero.pocketIn <= 0) {
      hero.pocketIn = GADGET_SECONDS;
      placeTurret(state, hero, nearHero(hero), POCKET_TURRET.seconds, "pocket");
    }
  }
  if (m.decoyDrone) {
    hero.droneIn -= dt;
    if (hero.droneIn <= 0) {
      hero.droneIn = GADGET_SECONDS;
      placeTurret(state, hero, nearHero(hero), DECOY_DRONE.seconds, "decoy");
    }
  }
}

/** A spot just ahead of a hero, for dropping things. */
function nearHero(hero: RaidHero): Vec2 {
  return add(hero.pos, fromAngle(hero.facing, 2.4));
}

/** The Engineer's beam: the Tank and any turret near him slowly mend. */
function repairNearby(state: RaidState, hero: RaidHero, dt: number): void {
  for (const t of state.turrets) {
    if (t.ownerId !== hero.id || distance(t.pos, hero.pos) > TRICKS.beamReach) continue;
    t.hp = Math.min(t.maxHp, t.hp + t.maxHp * TRICKS.beamHeal * dt);
  }
  for (const other of state.heroes) {
    if (other.kind !== "tank" || distance(other.pos, hero.pos) > TRICKS.beamReach) continue;
    healHero(state, other, other.maxHp * TRICKS.beamHeal * dt);
  }
}

/** How much quicker a hero is firing right now, from whatever's come over them. */
function fireBoost(hero: RaidHero): number {
  const m = hero.mods;
  let boost = 1;
  if (m.lastStand && hero.hp < hero.maxHp * TRICKS.lastStandAt) boost *= TRICKS.lastStandFire;
  if (hero.rage > 0) boost *= TRICKS.rageFire;
  if (m.overdrive && hero.fireTime >= TRICKS.overdriveAfter) boost *= TRICKS.overdriveFire;
  if (m.siegeMode && hero.stillTime >= TRICKS.siegeAfter) boost *= TRICKS.siegeFire;
  if (hero.pumped > 0) boost *= TRICKS.adrenalineFire;
  return boost;
}

/** Seconds until a hero's next shot. */
function shotTime(hero: RaidHero, base: number): number {
  return (base * hero.mods.reload) / fireBoost(hero);
}

/** A hero's full speed right now. */
function heroSpeed(hero: RaidHero, slowed: boolean): number {
  const firing = slowed && hero.rage <= 0 ? SHOOTING_SPEED : 1;
  return HEROES[hero.kind].speed * firing;
}

/** Walks a hero by the move stick. Guests' phones use this too, to answer the stick at once. */
export function moveByInput(state: RaidState, hero: RaidHero, input: HeroInput, dt: number): void {
  const move = length(input.move) > 1 ? normalize(input.move) : input.move;
  const speed = heroSpeed(hero, hero.firing || input.aimPreview !== null);
  hero.moving = length(move) > 0.05;
  if (hero.moving) moveHero(state, hero, scale(move, speed * dt));
}

function moveHero(state: RaidState, hero: RaidHero, delta: Vec2): void {
  const r = HEROES[hero.kind].radius;
  const { shape } = state;
  const onLand = (p: Vec2, margin: number) => shape.shoreDistance(p.x, p.y) > margin;
  let next = add(hero.pos, delta);
  if (!onLand(next, r)) {
    // Slide along the shoreline instead of stopping dead.
    const alongX = vec(next.x, hero.pos.y);
    const alongY = vec(hero.pos.x, next.y);
    if (onLand(alongX, r)) next = alongX;
    else if (onLand(alongY, r)) next = alongY;
    else next = { ...hero.pos };
  }
  for (let pass = 0; pass < 2; pass++) {
    for (const b of state.buildings) if (!b.destroyed) next = pushOut(next, r, b.pos, b.radius);
    for (const o of state.obstacles) next = pushOut(next, r, o.pos, o.radius);
    for (const t of state.turrets) {
      if (t.kind !== "decoy") next = pushOut(next, r, t.pos, CREW_TURRET.radius);
    }
  }
  if (onLand(next, r * 0.5)) hero.pos = next;
}

function pushOut(pos: Vec2, radius: number, center: Vec2, otherRadius: number): Vec2 {
  const d = distance(pos, center);
  const min = radius + otherRadius;
  if (d >= min) return pos;
  if (d < 1e-6) return add(center, vec(min, 0));
  return add(center, scale(normalize(sub(pos, center)), min));
}

/** How much a hero's moving is throwing their aim off, where 1 is walking and firing. */
const wobble = (hero: RaidHero) => hero.unsteady;

/** How far a shot strays this time, in radians: the hero's cone, wider while they're moving. */
function strayAngle(state: RaidState, hero: RaidHero): number {
  const spread = shotSpread(hero.kind, hero.mods.spread) * (1 + MOVING_SPREAD * wobble(hero));
  return (state.rng() - 0.5) * 2 * spread;
}

/** Where a throw lands: right on the mark standing still, anywhere round it on the move. */
function throwTarget(state: RaidState, hero: RaidHero, dir: Vec2, reach: number): Vec2 {
  const wide = (state.rng() - 0.5) * 2 * THROW_WIDTH_SCATTER * wobble(hero);
  const long = (state.rng() - 0.5) * 2 * THROW_LENGTH_SCATTER * wobble(hero);
  return add(hero.pos, fromAngle(angleOf(dir) + wide, reach * (1 + long)));
}

/** How much wider and longer a hero's aim cone is right now, for drawing it. */
export function aimStretch(hero: RaidHero): { width: number; length: number } {
  const kind = HEROES[hero.kind].attack.kind;
  if (kind !== "lob" && kind !== "heal") {
    return { width: 1 + MOVING_SPREAD * wobble(hero), length: 1 };
  }
  return {
    width: 1 + (THROW_WIDTH_SCATTER / shotSpread(hero.kind)) * wobble(hero),
    length: 1 + THROW_LENGTH_SCATTER * wobble(hero),
  };
}

/** Two shells side by side, for the shots that go out double. */
function twinOffset(dir: Vec2, gap: number): Vec2 {
  return vec(-dir.y * gap, dir.x * gap);
}

function updateAttack(
  state: RaidState,
  hero: RaidHero,
  dir: Vec2 | null,
  aimDistance: number,
  dt: number,
) {
  const atk = HEROES[hero.kind].attack;
  const m = hero.mods;
  hero.firing = dir !== null;
  switch (atk.kind) {
    case "burst": {
      if (hero.burstLeft > 0) {
        hero.firing = true;
        hero.burstTimer -= dt;
        if (hero.burstTimer <= 0) {
          const stray = strayAngle(state, hero);
          spawnDirect(
            state,
            hero,
            "bullet",
            fromAngle(angleOf(hero.burstDir) + stray),
            atk.speed * m.shotSpeed,
            atk.range,
            atk.damage * hero.power,
            0,
            1,
          );
          hero.burstLeft--;
          hero.burstTimer = atk.interval * m.unload;
          if (hero.burstLeft === 0) hero.reload = shotTime(hero, atk.reload);
        }
      } else if (dir && hero.reload <= 0) {
        hero.burstLeft = atk.shots + m.shots;
        hero.burstTimer = 0;
        hero.burstDir = dir;
      }
      return;
    }
    case "minigun": {
      if (!dir) {
        hero.spin = Math.max(0, hero.spin - dt);
        return;
      }
      hero.spin = Math.min(1, hero.spin + dt / (atk.spinUp * m.spinUp));
      if (hero.reload <= 0) {
        const shotDir = fromAngle(angleOf(dir) + strayAngle(state, hero));
        hero.shotCount++;
        const every = m.signature > 0 ? SIGNATURE.explosiveEvery : 0;
        const explosive = every > 0 && hero.spin >= 1 && hero.shotCount % every === 0;
        spawnDirect(
          state,
          hero,
          explosive ? "shell" : "bullet",
          shotDir,
          atk.speed * m.shotSpeed,
          atk.range,
          atk.damage * hero.power * (explosive ? SIGNATURE.explosiveDamage : 1),
          explosive ? SIGNATURE.explosiveSplash + m.splash : 0,
          1,
        );
        hero.reload =
          Math.max(-dt, hero.reload) +
          shotTime(hero, lerp(atk.slowInterval, atk.fastInterval, hero.spin));
      }
      return;
    }
    case "shell": {
      if (dir && hero.reload <= 0) {
        const kind = hero.kind === "bazooka" ? "rocket" : atk.splash > 0 ? "shell" : "bullet";
        hero.shotCount++;
        const twin = m.twinEvery > 0 && hero.shotCount % m.twinEvery === 0;
        const shot = fromAngle(angleOf(dir) + strayAngle(state, hero));
        const fire = (offset: Vec2) =>
          spawnDirect(
            state,
            hero,
            kind,
            shot,
            atk.speed * m.shotSpeed,
            atk.range,
            atk.damage * hero.power,
            atk.splash > 0 ? atk.splash + m.splash : 0,
            atk.buildingBonus,
            offset,
          );
        fire(twin ? twinOffset(shot, 0.5) : vec(0, 0));
        if (twin) fire(twinOffset(shot, -0.5));
        if (m.doubleTap && hero.tapReady) {
          hero.tapReady = false;
          hero.reload = TRICKS.tapDelay;
        } else {
          hero.tapReady = true;
          hero.reload = shotTime(hero, atk.reload);
        }
      }
      return;
    }
    case "lob": {
      if (dir && hero.reload <= 0) {
        const range = atk.range;
        const reach = clamp(aimDistance, 3, range);
        const duration = atk.flightTime * m.flight * (0.55 + (0.45 * reach) / range);
        hero.shotCount++;
        const twin = m.twinEvery > 0 && hero.shotCount % m.twinEvery === 0;
        const smoke = m.smokeShell && hero.shotCount % TRICKS.smokeEvery === 0;
        const toss = (spot: Vec2) => {
          const lob = spawnLob(
            state,
            "grenade",
            "crew",
            hero.id,
            hero.pos,
            spot,
            duration,
            3 + reach * 0.25,
            atk.damage * hero.power,
            atk.splash + m.splash,
            m.signature,
          );
          return lob;
        };
        const to = throwTarget(state, hero, dir, reach);
        const first = toss(to);
        if (smoke) {
          const radius = atk.splash + m.splash + 1.5;
          leaveZone(state, first, { kind: "smoke", radius, seconds: TRICKS.smokeSeconds });
        }
        if (twin) toss(add(to, twinOffset(dir, 2.2)));
        hero.reload = shotTime(hero, atk.reload);
      }
      return;
    }
    case "heal": {
      if (dir && hero.reload <= 0 && hero.targetId !== null) {
        const range = reachOfBuildings(hero);
        const reach = clamp(aimDistance, 0, range);
        spawnLob(
          state,
          "acid",
          "crew",
          hero.id,
          hero.pos,
          throwTarget(state, hero, dir, reach),
          atk.flightTime * (0.55 + (0.45 * reach) / range),
          2.5 + reach * 0.2,
          atk.acid.damage * hero.power,
          atk.acid.splash,
        );
        hero.reload = shotTime(hero, atk.reload);
      } else if (dir && hero.reload <= 0) {
        const range = atk.range;
        const reach = clamp(aimDistance, 0, range);
        hero.shotCount++;
        const miracle = m.miracle && hero.shotCount % TRICKS.miracleEvery === 0;
        spawnLob(
          state,
          "vial",
          "crew",
          hero.id,
          hero.pos,
          throwTarget(state, hero, dir, reach),
          atk.flightTime * (0.55 + (0.45 * reach) / range),
          2.5 + reach * 0.2,
          atk.heal * hero.power * m.heal * (miracle ? 2 : 1),
          (atk.splash + m.splash) * (miracle ? 2 : 1),
        );
        hero.reload = shotTime(hero, atk.reload);
      }
      return;
    }
  }
}

/** Finds the shell a lob belongs to and marks it to leave a zone where it lands. */
function leaveZone(state: RaidState, lob: Lob, drop: ZoneDrop): void {
  for (const p of state.projectiles) if (p.lob === lob) p.leaves = drop;
}

function placeTurret(
  state: RaidState,
  owner: RaidHero,
  pos: Vec2,
  seconds: number,
  kind: TurretKind = "salvage",
): void {
  const hp =
    kind === "pocket" ? POCKET_TURRET.hp : kind === "decoy" ? DECOY_DRONE.hp : CREW_TURRET.hp;
  state.turrets.push({
    id: state.nextId++,
    kind,
    ownerId: owner.id,
    pos: { ...pos },
    hp,
    maxHp: hp,
    time: seconds,
    reload: 0,
    aim: owner.facing,
  });
}

function healHero(state: RaidState, hero: RaidHero, amount: number, healer?: RaidHero): void {
  if (!hero.alive) return;
  const m = healer?.mods;
  if (healer && healer !== hero) {
    if (m?.adrenaline) hero.pumped = TRICKS.boostSeconds;
  }
  const spare = hero.hp + amount - hero.maxHp;
  if (spare > 0 && m?.overheal) {
    hero.shield = Math.min(hero.maxHp * TRICKS.overhealMost, hero.shield + spare);
  }
  if (hero.hp >= hero.maxHp) return;
  hero.hp = Math.min(hero.maxHp, hero.hp + amount);
  if (state.rng() < 0.15) state.events.push({ type: "heal", pos: { ...hero.pos } });
}

/** What a blow actually comes to, once a hero's armor and moods have had their say. */
function damageTaken(hero: RaidHero, amount: number, heavyBonus: number, blast: boolean): number {
  const m = hero.mods;
  let taken = amount * m.damageTaken;
  if (HEROES[hero.kind].heavy && !m.harpoonProof) taken *= heavyBonus;
  if (blast) taken *= m.blastTaken;
  if (m.lastStand && hero.hp < hero.maxHp * TRICKS.lastStandAt) taken *= TRICKS.lastStandTaken;
  if (m.siegeMode && hero.stillTime >= TRICKS.siegeAfter) taken *= TRICKS.siegeTaken;
  return taken;
}

function damageHero(
  state: RaidState,
  hero: RaidHero,
  amount: number,
  heavyBonus = 1,
  blast = false,
): void {
  if (!hero.alive || state.conquest !== null) return;
  // Nothing touches a hero while they're being recorded, or while their copy plays it out.
  const running = state.timePower;
  if (running?.power === "record" && running.heroId === hero.id) return;
  const m = hero.mods;
  const wasStanding = hero.hp >= hero.maxHp * TRICKS.lastStandAt;
  let taken = damageTaken(hero, amount, heavyBonus, blast);
  if (hero.barrier > 0) {
    const held = Math.min(hero.barrier, taken);
    hero.barrier -= held;
    taken -= held;
    // Fast forward lasts as long as the barrier round whoever used it.
    const running = state.timePower;
    if (hero.barrier <= 0 && running?.power === "fastForward" && running.heroId === hero.id) {
      endTimePower(state);
    }
  }
  const soaked = Math.min(hero.shield, taken);
  hero.shield -= soaked;
  taken -= soaked;
  hero.hp -= taken;
  hero.sinceHit = 0;
  state.events.push({ type: "hit", pos: { ...hero.pos } });
  if (m.berserk) {
    hero.rageBuild += taken;
    if (hero.rageBuild >= TRICKS.rageAt) {
      hero.rageBuild = 0;
      hero.rage = TRICKS.rageSeconds;
      state.events.push({ type: "enrage", pos: { ...hero.pos } });
    }
  }
  if (m.lastStand && wasStanding && hero.hp > 0 && hero.hp < hero.maxHp * TRICKS.lastStandAt) {
    state.events.push({ type: "enrage", pos: { ...hero.pos } });
  }
  const copy = hero.copyOf !== null;
  if (hero.hp <= 0 && (copy || (!guardianAngel(state, hero) && !retry(state, hero)))) {
    hero.hp = 0;
    hero.alive = false;
    hero.firing = false;
    hero.moving = false;
    if (hero.inBoat) state.boat.occupant = null;
    hero.inBoat = false;
    state.events.push({ type: "heroDown", id: hero.id, pos: { ...hero.pos } });
    // A copy that falls ends the record it was playing out.
    if (copy) endTimePower(state);
  }
}

/** The Medic's signature: pulls a falling hero back, a set number of times a raid. */
function guardianAngel(state: RaidState, hero: RaidHero): boolean {
  const medic = state.heroes.find(
    (h) => h.kind === "medic" && h.alive && h.saves < h.mods.signature,
  );
  if (!medic) return false;
  medic.saves++;
  hero.hp = hero.maxHp * SIGNATURE.angelHealth;
  state.events.push(
    { type: "explosion", pos: { ...hero.pos }, radius: 1.2 },
    { type: "heal", pos: { ...hero.pos } },
    { type: "heal", pos: { ...medic.pos } },
  );
  return true;
}

// ---------------------------------------------------------------------------------------------
// The gunboat

function toggleBoat(state: RaidState, hero: RaidHero): void {
  if (hero.inBoat) {
    hero.inBoat = false;
    state.boat.occupant = null;
    state.events.push({ type: "leftBoat", heroId: hero.id });
  } else if (canBoard(state, hero)) {
    hero.inBoat = true;
    state.boat.occupant = hero.id;
    state.events.push({ type: "boarded", heroId: hero.id });
  }
}

function fireAbility(state: RaidState, ability: Ability, target: Vec2): void {
  const cost = nextAbilityCost(state, ability);
  const level = state.gunboat[ability];
  if (state.energy < cost || !level) return;
  const power = weaponPower(level);
  state.energy -= cost;
  state.abilityUses[ability]++;
  state.events.push({ type: "boatFire", ability, target: { ...target } });
  const from = state.boat.pos;
  const flight = boatShellFlightTime(distance(from, target));
  const canister = (drop: ZoneDrop) => {
    const lob = spawnLob(
      state,
      "artillery",
      "crew",
      0,
      from,
      target,
      flight,
      16,
      0,
      CANISTER_BLAST,
    );
    leaveZone(state, lob, drop);
  };
  switch (ability) {
    case "artillery":
      spawnLob(
        state,
        "artillery",
        "crew",
        0,
        from,
        target,
        flight,
        16,
        ARTILLERY.damage * power,
        ARTILLERY.splash,
      );
      return;
    case "barrage":
      for (let i = 0; i < BARRAGE.shells; i++) {
        const offset = fromAngle(
          state.rng() * Math.PI * 2,
          Math.sqrt(state.rng()) * BARRAGE.spread,
        );
        const lob = spawnLob(
          state,
          "artillery",
          "crew",
          0,
          from,
          add(target, offset),
          flight,
          16,
          BARRAGE.damage * power,
          BARRAGE.splash,
        );
        lob.t = -i * BARRAGE.stagger;
      }
      return;
    case "heal":
      addZone(state, "heal", target, HEAL.radius, HEAL.duration, 0, {
        heal: HEAL.healPerSecond * power,
      });
      return;
    case "shock":
      canister({ kind: "shock", radius: SHOCK.radius, seconds: stunSeconds(level) });
      return;
    case "smoke":
      canister({ kind: "smoke", radius: SMOKE.radius, seconds: smokeSeconds(level) });
      return;
  }
}

function addZone(
  state: RaidState,
  kind: ZoneKind,
  pos: Vec2,
  radius: number,
  time: number,
  ownerId: number,
  rate: { heal?: number; burn?: number } = {},
): void {
  state.zones.push({
    id: state.nextId++,
    kind,
    pos: { ...pos },
    radius,
    time,
    healPerSecond: rate.heal ?? 0,
    burnPerSecond: rate.burn ?? 0,
    ownerId,
  });
}

// ---------------------------------------------------------------------------------------------
// Enemy defenses and the Engineer's turret

interface Target {
  pos: Vec2;
  hero: RaidHero | null;
  turret: CrewTurret | null;
}

/** Defenses can't aim into smoke, and anyone in it can't be seen, unless they fire from it. */
function inSmoke(state: RaidState, pos: Vec2): boolean {
  return state.zones.some((z) => z.kind === "smoke" && distance(pos, z.pos) <= z.radius);
}

/** A defense caught in a shock circle can't do a thing until it's over. */
export function shocked(state: RaidState, b: RaidBuilding): boolean {
  return state.zones.some(
    (z) => z.kind === "shock" && distance(b.pos, z.pos) - b.radius <= z.radius,
  );
}

function findTarget(state: RaidState, from: Vec2, range: number, minRange: number): Target | null {
  // A decoy in reach draws every gun, whoever else is nearer.
  for (const turret of state.turrets) {
    if (turret.kind !== "decoy") continue;
    const d = distance(from, turret.pos);
    if (d >= minRange && d <= Math.min(range, DECOY_DRONE.reach)) {
      return { pos: turret.pos, hero: null, turret };
    }
  }
  let best: Target | null = null;
  let bestDistance = Infinity;
  for (const hero of state.heroes) {
    if (!hero.alive) continue;
    const d = distance(from, hero.pos);
    if (d < minRange || d > range + HEROES[hero.kind].radius || d >= bestDistance) continue;
    if (!seen(state, hero)) continue;
    best = { pos: hero.pos, hero, turret: null };
    bestDistance = d;
  }
  for (const turret of state.turrets) {
    const d = distance(from, turret.pos);
    if (d < minRange || d > range || d >= bestDistance) continue;
    if (inSmoke(state, turret.pos)) continue;
    best = { pos: turret.pos, hero: null, turret };
    bestDistance = d;
  }
  return best;
}

/**
 * A sniper takes its time, and anyone can see it doing so: its sights slide along ahead of a
 * target, to where they'll be when a shot gets there, hold still for a moment, and then it fires.
 * Keep running the same way and it hits. Change direction once the sights stop, and it doesn't.
 */
function dropAim(b: RaidBuilding): void {
  b.sights = null;
  b.aiming = 0;
  b.tracked = null;
  b.trackedVel = vec(0, 0);
}

function takeAim(
  state: RaidState,
  b: RaidBuilding,
  atk: Extract<DefenseAttack, { kind: "sniper" }>,
  target: Vec2,
  dt: number,
): void {
  if (b.reload > 0) return;
  b.aiming += dt;
  if (b.tracked) {
    const seen = scale(sub(target, b.tracked), 1 / dt);
    const reading = 1 - Math.exp(-dt * TRACKING_RATE);
    if (length(seen) <= FASTEST_TARGET) {
      b.trackedVel = add(b.trackedVel, scale(sub(seen, b.trackedVel), reading));
    }
  }
  b.tracked = { ...target };
  // The hold, the shot's flight, and what the sights themselves lag by, following something moving.
  const ahead = SIGHTS_HELD + distance(b.pos, target) / atk.speed + 1 / SIGHTS_RATE;
  const lead = scale(b.trackedVel, ahead);
  const far = length(lead);
  const wanted = add(target, far > MOST_LEAD ? scale(lead, MOST_LEAD / far) : lead);
  if (!b.sights) b.sights = wanted;
  else if (b.aiming < atk.aimTime - SIGHTS_HELD) {
    b.sights = add(b.sights, scale(sub(wanted, b.sights), 1 - Math.exp(-dt * SIGHTS_RATE)));
  }
  const toSights = sub(b.sights, b.pos);
  b.aim = angleOf(toSights);
  if (b.aiming < atk.aimTime) return;
  const dir = normalize(toSights);
  const muzzle = add(b.pos, scale(dir, b.radius * 0.7));
  dropAim(b);
  b.reload = atk.reload;
  b.firing = true;
  const damage = atk.damage * b.power;
  spawnEnemyDirect(state, b, "sniper", muzzle, dir, atk.speed, atk.range + 2, damage, 1);
}

function updateBuildings(state: RaidState, dt: number): void {
  for (const b of state.buildings) {
    b.firing = false;
    const atk = BUILDINGS[b.type].attack;
    if (b.destroyed || !atk || state.conquest !== null) continue;
    if (shocked(state, b)) {
      dropAim(b);
      continue;
    }
    b.reload = Math.max(0, b.reload - dt);
    const minRange = atk.kind === "mortar" ? atk.minRange : 0;
    const target = findTarget(state, b.pos, atk.range, minRange);
    if (!target) {
      dropAim(b);
      continue;
    }
    if (atk.kind === "sniper") {
      takeAim(state, b, atk, target.pos, dt);
      continue;
    }
    const toTarget = sub(target.pos, b.pos);
    b.aim = angleOf(toTarget);
    const dir = normalize(toTarget);
    const muzzle = add(b.pos, scale(dir, b.radius * 0.7));
    if (atk.kind === "flame") {
      b.firing = true;
      if (b.reload > 0) continue;
      b.reload = atk.reload;
      for (const hero of state.heroes) {
        if (!hero.alive) continue;
        if (distance(hero.pos, b.pos) > atk.range + HEROES[hero.kind].radius) continue;
        if (Math.abs(angleDiff(angleOf(sub(hero.pos, b.pos)), b.aim)) > atk.coneHalfAngle) continue;
        damageHero(state, hero, atk.damage * b.power);
      }
      for (const t of state.turrets) {
        if (distance(t.pos, b.pos) <= atk.range) t.hp -= atk.damage * b.power;
      }
      continue;
    }
    if (b.reload > 0) continue;
    b.reload = atk.reload;
    b.firing = true;
    switch (atk.kind) {
      case "bullet":
        spawnEnemyDirect(
          state,
          b,
          "bullet",
          muzzle,
          dir,
          atk.speed,
          atk.range + 2,
          atk.damage * b.power,
          1,
        );
        break;
      case "harpoon":
        spawnEnemyDirect(
          state,
          b,
          "harpoon",
          muzzle,
          dir,
          atk.speed,
          atk.range + 2,
          atk.damage * b.power,
          atk.heavyBonus,
        );
        break;
      case "mortar":
        spawnLob(
          state,
          "mortar",
          "enemy",
          b.id,
          b.pos,
          { ...target.pos },
          atk.flightTime,
          9,
          atk.damage * b.power,
          atk.splash,
        );
        break;
    }
  }
}

function updateCrewTurrets(state: RaidState, dt: number): void {
  for (const t of state.turrets) {
    t.time -= dt;
    t.reload = Math.max(0, t.reload - dt);
    if (t.kind === "decoy") continue;
    const target = nearestBuilding(state, t.pos, CREW_TURRET.range);
    if (!target) continue;
    const dir = normalize(sub(target.pos, t.pos));
    t.aim = angleOf(dir);
    if (t.reload > 0) continue;
    const owner = state.heroes.find((h) => h.id === t.ownerId);
    t.reload = CREW_TURRET.reload / (owner?.mods.overclock ? TRICKS.overclockFire : 1);
    const p = makeProjectile(state, "bullet", "crew", t.ownerId, add(t.pos, scale(dir, 0.6)));
    p.vel = scale(dir, CREW_TURRET.speed);
    p.damage = CREW_TURRET.damage * (t.kind === "pocket" ? POCKET_TURRET.damage : 1);
    p.maxDistance = CREW_TURRET.range + 2;
    state.projectiles.push(p);
    state.events.push({
      type: "shot",
      pos: p.pos,
      dir,
      kind: "bullet",
      team: "crew",
      ownerId: t.ownerId,
    });
  }
  state.turrets = state.turrets.filter((t) => {
    if (t.time > 0 && t.hp > 0) return true;
    state.events.push({ type: "explosion", pos: t.pos, radius: 1.2 });
    return false;
  });
}

/** How far a hero reaches, perks included. */
export function heroRange(hero: RaidHero): number {
  return HEROES[hero.kind].attack.range;
}

/** How far a hero reaches a building from, perks included: a medic's acid doesn't go as far. */
function reachOfBuildings(hero: RaidHero): number {
  const atk = HEROES[hero.kind].attack;
  return atk.kind === "heal" ? atk.acid.range : heroRange(hero);
}

/**
 * The medic's lock: on the crewmate she aims at, or with a tap on whoever is worst hurt. With
 * nobody to look after, it's a building, which gets acid.
 */
function lockPatient(state: RaidState, hero: RaidHero, input: HeroInput): void {
  if (input.lockAt && length(input.lockAt) > 0.05) {
    const patient = patientCandidate(state, hero, input.lockAt);
    hero.patientId = patient?.id ?? null;
    hero.targetId = patient ? null : (lockCandidate(state, hero, input.lockAt)?.id ?? null);
    if (!patient && hero.targetId === null) {
      // Nobody there: a bottle on that spot, which is also how she heals herself.
      hero.autoDir = normalize(input.lockAt);
      hero.autoDistance = clamp(length(input.lockAt), 0, 1) * heroRange(hero);
      hero.autoFireTime = AUTO_FIRE_SECONDS;
    }
  } else if (input.autoAim) {
    const patient = patientCandidate(state, hero, null);
    const building = patient ? null : lockCandidate(state, hero, null);
    hero.patientId = patient && patient.id !== hero.patientId ? patient.id : null;
    hero.targetId = building && building.id !== hero.targetId ? building.id : null;
    hero.autoFireTime = 0;
  }
}

/** The crewmate she's locked onto, while they're in reach and still need it. */
function lockedPatient(state: RaidState, hero: RaidHero): RaidHero | null {
  const patient = state.heroes.find((h) => h.id === hero.patientId);
  if (!patient?.alive || distance(patient.pos, hero.pos) > heroRange(hero) + 0.5) {
    hero.patientId = null;
    return null;
  }
  return patient.hp < patient.maxHp ? patient : null;
}

/**
 * Who a medic would lock onto: the crewmate closest to the aim direction in range, or with no
 * direction the worst hurt of them. On her own she has nobody but herself to look after.
 */
export function patientCandidate(
  state: RaidState,
  hero: RaidHero,
  dir: Vec2 | null,
): RaidHero | null {
  const range = heroRange(hero);
  let best: RaidHero | null = null;
  let bestScore = Infinity;
  for (const h of state.heroes) {
    if (!h.alive || distance(h.pos, hero.pos) > range) continue;
    if (h === hero && dir) continue;
    if (!dir && h.hp >= h.maxHp) continue;
    let score = h.hp / h.maxHp + (h === hero ? 0.5 : 0);
    if (dir) {
      const off = Math.abs(angleDiff(angleOf(sub(h.pos, hero.pos)), angleOf(dir)));
      if (off > 0.5) continue;
      score = off;
    }
    if (score < bestScore) {
      best = h;
      bestScore = score;
    }
  }
  return best;
}

/** The locked target, if it still stands and is in range. */
function lockedBuilding(state: RaidState, hero: RaidHero): RaidBuilding | null {
  const b = state.buildings.find((x) => x.id === hero.targetId);
  if (!b || b.destroyed) return null;
  const reach = reachOfBuildings(hero) + 0.5;
  return distance(b.pos, hero.pos) - b.radius <= reach ? b : null;
}

/**
 * Which building a hero would lock onto: the one closest to the aim direction inside the cone
 * and in range, or with no direction the nearest tower in range (any building if no tower is).
 */
export function lockCandidate(
  state: RaidState,
  hero: RaidHero,
  dir: Vec2 | null,
): RaidBuilding | null {
  const range = reachOfBuildings(hero);
  if (!dir) {
    let best: RaidBuilding | null = null;
    let bestScore = Infinity;
    for (const b of state.buildings) {
      if (b.destroyed) continue;
      const d = distance(hero.pos, b.pos) - b.radius;
      if (d > range) continue;
      const score = d + (BUILDINGS[b.type].attack ? 0 : 1000);
      if (score < bestScore) {
        best = b;
        bestScore = score;
      }
    }
    return best;
  }
  const aimAngle = angleOf(dir);
  const tolerance = Math.max(LOCK_TOLERANCE, shotSpread(hero.kind));
  let best: RaidBuilding | null = null;
  let bestScore = Infinity;
  for (const b of state.buildings) {
    if (b.destroyed) continue;
    const gap = distance(hero.pos, b.pos);
    if (gap - b.radius > range) continue;
    // Wide buildings are easier to hit: their size widens the cone a little.
    const off = Math.abs(angleDiff(angleOf(sub(b.pos, hero.pos)), aimAngle));
    if (off > tolerance + Math.atan2(b.radius, Math.max(gap, 0.1))) continue;
    const score = off * 10 + gap * 0.05;
    if (score < bestScore) {
      best = b;
      bestScore = score;
    }
  }
  return best;
}

function nearestBuilding(state: RaidState, from: Vec2, range: number): RaidBuilding | null {
  let best: RaidBuilding | null = null;
  let bestDistance = Infinity;
  for (const b of state.buildings) {
    if (b.destroyed) continue;
    const d = distance(from, b.pos) - b.radius;
    if (d <= range && d < bestDistance) {
      best = b;
      bestDistance = d;
    }
  }
  return best;
}

function damageBuilding(state: RaidState, b: RaidBuilding, amount: number, ownerId: number): void {
  if (b.destroyed || state.status !== "playing" || state.conquest !== null) return;
  const owner = state.heroes.find((h) => h.id === ownerId);
  const m = owner?.mods;
  const dealt =
    amount * (m?.buildingDamage ?? 1) * (BUILDINGS[b.type].attack ? (m?.defenseDamage ?? 1) : 1);
  b.hp -= dealt;
  if (state.rewound) state.rewound.hurt[b.id] = (state.rewound.hurt[b.id] ?? 0) + dealt;
  if (b.hp > 0) return;
  if (state.timePower?.power === "pause") {
    b.hp = 0;
    b.fallsTo ??= ownerId;
    return;
  }
  knockDown(state, b, ownerId);
}

function knockDown(state: RaidState, b: RaidBuilding, ownerId: number): void {
  const owner = state.heroes.find((h) => h.id === ownerId);
  fell(state, b);
  if (b.type === "headquarters") takeBase(state);
  else if (!state.hitAndRun) chipHeadquarters(state);
  if (owner) destroyedBy(state, owner, b);
}

/** A building comes down, and pays out whatever it held. */
function fell(state: RaidState, b: RaidBuilding): void {
  b.hp = 0;
  b.destroyed = true;
  b.firing = false;
  state.events.push({ type: "destroyed", id: b.id, pos: { ...b.pos }, buildingType: b.type });
  if (b.paid) return;
  b.paid = true;
  state.energy += BUILDINGS[b.type].energy;
  const loot = lootFor(b.type, b.level);
  if (Object.keys(loot).length > 0) {
    for (const r of RESOURCES) state.loot[r] += loot[r] ?? 0;
    state.events.push({ type: "loot", pos: { ...b.pos }, loot });
  }
}

function standing(state: RaidState): RaidBuilding[] {
  return state.buildings.filter((b) => !b.destroyed);
}

/** Every building that falls shakes the headquarters a little. */
function chipHeadquarters(state: RaidState): void {
  const hq = standing(state).find((b) => b.type === "headquarters");
  if (!hq) return;
  const floor = Math.min(hq.hp, hq.maxHp * HQ_CHIP_FLOOR);
  hq.hp = Math.max(floor, hq.hp - hq.maxHp * HQ_CHIP);
  state.events.push({ type: "hit", pos: { ...hq.pos } });
}

/** The headquarters is down, and the base with it: the guns fall silent. */
function takeBase(state: RaidState): void {
  if (state.hitAndRun || standing(state).length === 0) {
    state.status = "won";
    return;
  }
  state.conquest = CONQUEST.firstAfter;
  for (const b of state.buildings) b.sights = null;
}

/** Sets off what's left of a taken base one building at a time, outward from the headquarters. */
function stepConquest(state: RaidState, dt: number): void {
  if (state.conquest === null) return;
  state.conquest -= dt;
  if (state.conquest > 0) return;
  const left = standing(state);
  const hq = state.buildings.find((b) => b.type === "headquarters");
  if (left.length === 0) {
    state.status = "won";
    return;
  }
  const from = hq?.pos ?? vec(0, 0);
  const next = left.reduce((a, b) => (distance(a.pos, from) <= distance(b.pos, from) ? a : b));
  fell(state, next);
  state.conquest =
    left.length > 1
      ? Math.min(CONQUEST.longestGap, CONQUEST.seconds / state.buildings.length)
      : CONQUEST.lastAfter;
}

/** Upgrades set off by knocking a building down. */
function destroyedBy(state: RaidState, owner: RaidHero, b: RaidBuilding): void {
  const m = owner.mods;
  if (m.healOnKill > 0) healHero(state, owner, owner.maxHp * m.healOnKill);
  if (owner.kind === "engineer" && m.signature > 0) {
    placeTurret(state, owner, b.pos, CREW_TURRET.seconds);
  }
  // A shockwave can knock the next building down and set off another: that's the fun of it.
  if (owner.kind === "tank" && m.signature > 0) {
    const radius = SIGNATURE.shockwaveRadius + b.radius;
    explode(state, b.pos, radius, SIGNATURE.shockwaveDamage, "crew", owner.id, 1, 1);
  }
}

// ---------------------------------------------------------------------------------------------
// Projectiles

function makeProjectile(
  state: RaidState,
  kind: ProjectileKind,
  team: Team,
  ownerId: number,
  pos: Vec2,
): Projectile {
  return {
    id: state.nextId++,
    kind,
    team,
    ownerId,
    pos: { ...pos },
    vel: vec(0, 0),
    damage: 0,
    splash: 0,
    buildingBonus: 1,
    heavyBonus: 1,
    traveled: 0,
    maxDistance: 0,
    lob: null,
    charges: 0,
    homing: null,
    leaves: null,
  };
}

function spawnDirect(
  state: RaidState,
  hero: RaidHero,
  kind: ProjectileKind,
  dir: Vec2,
  speed: number,
  range: number,
  damage: number,
  splash: number,
  buildingBonus: number,
  offset: Vec2 = vec(0, 0),
): void {
  const start = add(add(hero.pos, scale(dir, HEROES[hero.kind].radius + 0.3)), offset);
  const p = makeProjectile(state, kind, "crew", hero.id, start);
  p.vel = scale(dir, speed);
  p.damage = damage;
  p.splash = splash;
  p.buildingBonus = buildingBonus;
  p.maxDistance = range;
  if (hero.kind === "rifleman" || hero.kind === "bazooka") p.charges = hero.mods.signature;
  if (kind === "rocket" && hero.mods.guided) {
    p.homing = hero.targetId;
    // A curving rocket flies a longer way round than a straight one.
    p.maxDistance = range * 1.5;
  }
  state.projectiles.push(p);
  state.events.push({ type: "shot", pos: start, dir, kind, team: "crew", ownerId: hero.id });
}

function spawnEnemyDirect(
  state: RaidState,
  b: RaidBuilding,
  kind: ProjectileKind,
  start: Vec2,
  dir: Vec2,
  speed: number,
  range: number,
  damage: number,
  heavyBonus: number,
): void {
  const p = makeProjectile(state, kind, "enemy", b.id, start);
  p.vel = scale(dir, speed);
  p.damage = damage;
  p.heavyBonus = heavyBonus;
  p.maxDistance = range;
  state.projectiles.push(p);
  state.events.push({ type: "shot", pos: start, dir, kind, team: "enemy", ownerId: b.id });
}

function spawnLob(
  state: RaidState,
  kind: ProjectileKind,
  team: Team,
  ownerId: number,
  from: Vec2,
  to: Vec2,
  duration: number,
  peak: number,
  damage: number,
  splash: number,
  charges = 0,
): Lob {
  const p = makeProjectile(state, kind, team, ownerId, from);
  const lob: Lob = { from: { ...from }, to: { ...to }, t: 0, duration, peak };
  p.lob = lob;
  p.damage = damage;
  p.splash = splash;
  p.charges = charges;
  state.projectiles.push(p);
  if (kind !== "artillery") {
    state.events.push({
      type: "shot",
      pos: { ...from },
      dir: normalize(sub(to, from)),
      kind,
      team,
      ownerId,
    });
  }
  return lob;
}

/** `worldDt` is how far enemy shots go: less under slow, and none at all while time stands still. */
function updateProjectiles(state: RaidState, dt: number, worldDt = dt): void {
  // Hits can spawn new projectiles (ricochets, bomblets, skips): they land in the fresh list.
  const moving = state.projectiles;
  state.projectiles = [];
  const kept = moving.filter((p) => {
    if (p.team !== "enemy") return stepProjectile(state, p, dt);
    return worldDt <= 0 || stepProjectile(state, p, worldDt);
  });
  state.projectiles = kept.concat(state.projectiles);
}

/** Moves one projectile; returns false once it has hit something or run out of range. */
function stepProjectile(state: RaidState, p: Projectile, dt: number): boolean {
  if (p.lob) {
    p.lob.t += dt;
    const t = clamp(p.lob.t / p.lob.duration, 0, 1);
    p.pos = vec(lerp(p.lob.from.x, p.lob.to.x, t), lerp(p.lob.from.y, p.lob.to.y, t));
    if (p.lob.t < p.lob.duration) return true;
    detonate(state, p, p.lob.to);
    return false;
  }

  if (p.homing !== null) steerRocket(state, p, dt);
  const step = scale(p.vel, dt);
  p.pos = add(p.pos, step);
  p.traveled += length(step);

  // A guided rocket curves up and round whatever's in its way.
  if (p.homing === null) {
    for (const o of state.obstacles) {
      if (o.blocksShots && distance(p.pos, o.pos) <= o.radius) return impact(state, p);
    }
  }
  if (p.team === "crew") {
    for (const b of state.buildings) {
      if (b.destroyed || distance(p.pos, b.pos) > b.radius) continue;
      if (p.splash > 0) return impact(state, p);
      damageBuilding(state, b, p.damage * p.buildingBonus, p.ownerId);
      state.events.push({ type: "hit", pos: { ...p.pos } });
      if (p.charges > 0) ricochet(state, p, b);
      return false;
    }
  } else {
    for (const hero of state.heroes) {
      if (!hero.alive || distance(p.pos, hero.pos) > HEROES[hero.kind].radius) continue;
      damageHero(state, hero, p.damage, p.heavyBonus);
      return false;
    }
    for (const t of state.turrets) {
      if (distance(p.pos, t.pos) > CREW_TURRET.radius) continue;
      t.hp -= p.damage;
      state.events.push({ type: "hit", pos: { ...p.pos } });
      return false;
    }
  }
  if (p.traveled >= p.maxDistance) {
    // Rockets and shells burst at the end of their range; bullets just fade.
    if (p.splash > 0) detonate(state, p, p.pos);
    return false;
  }
  return true;
}

function impact(state: RaidState, p: Projectile): boolean {
  if (p.splash > 0) detonate(state, p, p.pos);
  else state.events.push({ type: "hit", pos: { ...p.pos } });
  return false;
}

/** Turns a guided rocket towards its building, a little each step. */
function steerRocket(state: RaidState, p: Projectile, dt: number): void {
  const target = state.buildings.find((b) => b.id === p.homing);
  if (!target || target.destroyed) {
    p.homing = null;
    return;
  }
  const speed = length(p.vel);
  const wanted = angleOf(sub(target.pos, p.pos));
  const facing = angleOf(p.vel);
  const turn = clamp(angleDiff(wanted, facing), -TRICKS.guidedTurn * dt, TRICKS.guidedTurn * dt);
  p.vel = scale(fromAngle(facing + turn), speed);
}

/** A projectile's blast, and whatever the hero's upgrades add to it. */
function detonate(state: RaidState, p: Projectile, pos: Vec2): void {
  const owner = state.heroes.find((h) => h.id === p.ownerId);
  if (p.kind === "vial") {
    state.events.push({ type: "healBurst", pos: { ...pos }, radius: p.splash });
    for (const hero of state.heroes) {
      if (distance(pos, hero.pos) <= p.splash + HEROES[hero.kind].radius)
        healHero(state, hero, p.damage, owner);
    }
    if (owner?.mods.lingering) {
      const heal = p.damage * TRICKS.lingerShare;
      addZone(state, "heal", pos, p.splash, TRICKS.lingerSeconds, owner.id, { heal });
    }
    return;
  }
  if (p.kind === "acid") {
    state.events.push({ type: "acidBurst", pos: { ...pos }, radius: p.splash });
    blast(state, pos, p.splash, p.damage, p.team, p.ownerId, p.buildingBonus, p.heavyBonus);
    return;
  }
  explode(state, pos, p.splash, p.damage, p.team, p.ownerId, p.buildingBonus, p.heavyBonus);
  if (p.kind === "rocket" && owner?.mods.napalm) {
    const burn = p.damage * TRICKS.napalmShare;
    addZone(state, "fire", pos, p.splash, TRICKS.napalmSeconds, owner.id, { burn });
  }
  if (p.leaves) addZone(state, p.leaves.kind, pos, p.leaves.radius, p.leaves.seconds, p.ownerId);
  if (p.charges === 0) return;
  if (p.kind === "rocket") scatterBomblets(state, p, pos);
  if (p.kind === "grenade" && p.lob) skipGrenade(state, p, p.lob, pos);
}

/** The Rifleman's signature: a bullet jumps from the building it hit to the next one along. */
function ricochet(state: RaidState, p: Projectile, from: RaidBuilding): void {
  let next: RaidBuilding | null = null;
  let best: number = SIGNATURE.ricochetRange;
  for (const b of state.buildings) {
    if (b === from || b.destroyed) continue;
    const gap = distance(from.pos, b.pos) - b.radius;
    if (gap < best) {
      next = b;
      best = gap;
    }
  }
  if (!next) return;
  const dir = normalize(sub(next.pos, from.pos));
  const start = add(from.pos, scale(dir, from.radius + 0.3));
  const bounce = makeProjectile(state, p.kind, p.team, p.ownerId, start);
  bounce.vel = scale(dir, length(p.vel));
  bounce.damage = p.damage * SIGNATURE.ricochetDamage;
  bounce.maxDistance = SIGNATURE.ricochetRange + next.radius;
  bounce.charges = p.charges - 1;
  state.projectiles.push(bounce);
  state.events.push({
    type: "shot",
    pos: start,
    dir,
    kind: p.kind,
    team: p.team,
    ownerId: p.ownerId,
  });
}

/** The Bazooka's signature: a rocket throws bomblets out round its blast. */
function scatterBomblets(state: RaidState, p: Projectile, pos: Vec2): void {
  const count = 1 + 2 * p.charges;
  const damage = p.damage * p.buildingBonus * SIGNATURE.bombletDamage;
  for (let i = 0; i < count; i++) {
    const angle = ((i + state.rng() * 0.6) / count) * Math.PI * 2;
    const to = add(pos, scale(fromAngle(angle), 2.5 + state.rng() * 2));
    spawnLob(
      state,
      "grenade",
      "crew",
      p.ownerId,
      pos,
      to,
      0.5,
      2.2,
      damage,
      SIGNATURE.bombletSplash,
    );
  }
}

/** The Grenadier's signature: a grenade skips on along its line for another blast. */
function skipGrenade(state: RaidState, p: Projectile, lob: Lob, pos: Vec2): void {
  const to = add(pos, scale(normalize(sub(lob.to, lob.from)), SIGNATURE.skipDistance));
  const damage = p.damage * SIGNATURE.skipDamage;
  spawnLob(
    state,
    "grenade",
    "crew",
    p.ownerId,
    pos,
    to,
    0.45,
    1.8,
    damage,
    p.splash,
    p.charges - 1,
  );
}

function explode(
  state: RaidState,
  pos: Vec2,
  radius: number,
  damage: number,
  team: Team,
  ownerId: number,
  buildingBonus: number,
  heavyBonus: number,
): void {
  state.events.push({ type: "explosion", pos: { ...pos }, radius });
  blast(state, pos, radius, damage, team, ownerId, buildingBonus, heavyBonus);
}

/** What a blast does, whatever it looks like. */
function blast(
  state: RaidState,
  pos: Vec2,
  radius: number,
  damage: number,
  team: Team,
  ownerId: number,
  buildingBonus: number,
  heavyBonus: number,
): void {
  if (team === "crew") {
    for (const b of state.buildings) {
      if (!b.destroyed && distance(pos, b.pos) - b.radius <= radius) {
        damageBuilding(state, b, damage * buildingBonus, ownerId);
      }
    }
  } else {
    for (const hero of state.heroes) {
      if (distance(pos, hero.pos) <= radius + HEROES[hero.kind].radius)
        damageHero(state, hero, damage, heavyBonus, true);
    }
    for (const t of state.turrets) {
      if (distance(pos, t.pos) <= radius) t.hp -= damage;
    }
  }
  // Any blast sets off hidden mines it reaches; that's how a Grenadier clears a beach.
  const sweeper = state.heroes.find((h) => h.id === ownerId)?.mods.mineSweeper;
  const reach = radius * (sweeper ? TRICKS.sweeperReach : 1) + 0.5;
  for (const mine of state.mines) {
    if (!mine.exploded && mine.fuse === null && distance(pos, mine.pos) <= reach) mine.fuse = 0.15;
  }
}

// ---------------------------------------------------------------------------------------------
// Mines and zones

function updateMines(state: RaidState, dt: number): void {
  for (const mine of state.mines) {
    if (mine.exploded) continue;
    if (mine.fuse === null) {
      const stepped = state.heroes.some(
        (h) => h.alive && distance(h.pos, mine.pos) <= MINE_TRIGGER_RADIUS,
      );
      if (stepped) {
        mine.fuse = MINE_FUSE;
        state.events.push({ type: "mineTriggered", id: mine.id, pos: { ...mine.pos } });
      }
      continue;
    }
    mine.fuse -= dt;
    if (mine.fuse > 0) continue;
    mine.exploded = true;
    explode(state, mine.pos, MINE_SPLASH, MINE_DAMAGE, "enemy", 0, 1, 1);
  }
}

function updateZones(state: RaidState, dt: number): void {
  for (const zone of state.zones) {
    zone.time -= dt;
    if (zone.kind === "heal") {
      const healer = state.heroes.find((h) => h.id === zone.ownerId);
      for (const hero of state.heroes) {
        if (distance(hero.pos, zone.pos) <= zone.radius)
          healHero(state, hero, zone.healPerSecond * dt, healer);
      }
    } else if (zone.kind === "fire") {
      for (const b of state.buildings) {
        if (!b.destroyed && distance(zone.pos, b.pos) - b.radius <= zone.radius) {
          damageBuilding(state, b, zone.burnPerSecond * dt, zone.ownerId);
        }
      }
    }
  }
  state.zones = state.zones.filter((z) => z.time > 0);
}

/** Lava burns anyone who wades in, and the mountain now and then throws fire about. */
function updateLava(state: RaidState, dt: number): void {
  const { shape } = state;
  if (!shape.volcano) return;
  for (const hero of state.heroes) {
    if (hero.alive && shape.lava(hero.pos.x, hero.pos.y) > 0.5) {
      damageHero(state, hero, hero.maxHp * LAVA_BURN * dt);
    }
  }
  state.eruptionIn -= dt;
  if (state.eruptionIn > 0) return;
  state.eruptionIn = ERUPTION_EVERY;
  const vent = shape.volcano.pos;
  state.events.push({ type: "eruption", pos: { ...vent } });
  const living = state.heroes.filter((h) => h.alive);
  const bombs = 4 + Math.floor(state.rng() * 3);
  for (let i = 0; i < bombs; i++) {
    // Some come down near the crew, the rest wherever they like.
    const near = living[i % Math.max(1, living.length)];
    const scatter = fromAngle(state.rng() * Math.PI * 2, 6 + state.rng() * 12);
    const spot =
      near && i % 2 === 0
        ? add(near.pos, scatter)
        : add(vent, fromAngle(state.rng() * 6.28, 24 + state.rng() * 40));
    const lob = spawnLob(
      state,
      "lava",
      "enemy",
      0,
      vent,
      spot,
      LAVA_BOMB.flight,
      LAVA_BOMB.peak,
      LAVA_BOMB.damage,
      LAVA_BOMB.splash,
    );
    lob.t = -i * 0.35;
  }
}
