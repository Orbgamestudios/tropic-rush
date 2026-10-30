// The raid simulation: heroes, enemy defenses, projectiles, the gunboat and win/lose.
// No engine imports, so the same rules can later run on the multiplayer server. For speed,
// stepRaid() updates the state object in place instead of returning a new one.

import { BUILDINGS, type BuildingType } from "./buildings";
import { buildingPower } from "./economy";
import {
  type Ability,
  ARTILLERY,
  abilityCost,
  BARRAGE,
  BOARD_DISTANCE,
  boatShellFlightTime,
  HEAL,
  START_ENERGY,
} from "./gunboat";
import { HEROES, type HeroKind, type SuperKind, shotSpread } from "./heroes";
import { NO_PERKS, type PerkMods } from "./heroProgress";
import { type IslandLayout, isOnLand, type ObstacleKind } from "./island";
import { createRng, type Rng } from "./rng";
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

const SPRINT = { seconds: 3.5, speed: 1.6, damageTaken: 0.6 };
/** Heroes move this much slower while aiming or shooting. */
const SHOOTING_SPEED = 0.6;
/** A released aim locks onto a building this far either side of it at least (radians). */
const LOCK_TOLERANCE = 0.22;
const RAM = { seconds: 0.6, speed: 14, damage: 450 };
const SANDBAGS = { seconds: 12, distance: 2.4, spacing: 1.4, radius: 0.75 };
const SMOKE = { seconds: 6, radius: 5 };
const HEAL_ZONE = { seconds: 4, radius: 5, healPerSecond: 110 };
const VOLLEY_SPREAD = 0.18;
const CREW_TURRET = {
  hp: 900,
  seconds: 18,
  range: 11,
  damage: 40,
  reload: 0.4,
  speed: 30,
  radius: 0.8,
};
const AUTO_FIRE_SECONDS = 0.6;

export type Team = "crew" | "enemy";

export interface RaidHero {
  id: number;
  kind: HeroKind;
  /** Damage multiplier from the hero's level and perks (1 at level 1). */
  power: number;
  /** What the hero's perks change. */
  mods: PerkMods;
  pos: Vec2;
  /** Radians on the ground plane; 0 is east. */
  facing: number;
  hp: number;
  maxHp: number;
  alive: boolean;
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
  /** Super meter, 0 to 1. */
  superCharge: number;
  sprintTime: number;
  ramTime: number;
  ramDir: Vec2;
  autoFireTime: number;
  autoDir: Vec2;
  autoDistance: number;
  /** The building this hero is locked onto and firing at, until it's gone or out of range. */
  targetId: number | null;
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
}

export type ProjectileKind =
  | "bullet"
  | "rocket"
  | "shell"
  | "harpoon"
  | "grenade"
  | "mortar"
  | "artillery";

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
}

export interface Mine {
  id: number;
  pos: Vec2;
  /** Counts down once triggered; null while waiting. */
  fuse: number | null;
  exploded: boolean;
}

export interface Zone {
  id: number;
  kind: "smoke" | "heal";
  pos: Vec2;
  radius: number;
  time: number;
  healPerSecond: number;
}

export interface CrewTurret {
  id: number;
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
  /** Seconds left for temporary obstacles (the Heavy's sandbags); null if permanent. */
  time: number | null;
}

export type RaidEvent =
  | { type: "shot"; pos: Vec2; dir: Vec2; kind: ProjectileKind; team: Team; ownerId: number }
  | { type: "explosion"; pos: Vec2; radius: number }
  | { type: "hit"; pos: Vec2 }
  | { type: "heal"; pos: Vec2 }
  | { type: "destroyed"; id: number; pos: Vec2; buildingType: BuildingType }
  | { type: "heroDown"; id: number; pos: Vec2 }
  | { type: "super"; heroId: number; super: SuperKind; pos: Vec2 }
  | { type: "boarded"; heroId: number }
  | { type: "leftBoat"; heroId: number }
  | { type: "boatFire"; ability: Ability; target: Vec2 }
  | { type: "mineTriggered"; id: number; pos: Vec2 };

export type RaidStatus = "playing" | "won" | "lost";

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
  boat: { pos: Vec2; exit: Vec2; occupant: number | null };
  energy: number;
  abilityUses: Record<Ability, number>;
  /** What happened during the last step, for effects and sounds. */
  events: RaidEvent[];
  nextId: number;
  rng: Rng;
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
  useSuper: boolean;
  /** Board the gunboat, or step off it. */
  toggleBoat: boolean;
  boatAbility: { ability: Ability; target: Vec2 } | null;
}

export const IDLE_INPUT: HeroInput = {
  move: { x: 0, y: 0 },
  aim: null,
  aimPreview: null,
  lockAt: null,
  autoAim: false,
  useSuper: false,
  toggleBoat: false,
  boatAbility: null,
};

/**
 * `powers` are each hero's level multipliers (see heroPower) and `mods` their perks (see
 * perkMods); missing ones change nothing.
 */
export function createRaid(
  layout: IslandLayout,
  kinds: readonly HeroKind[],
  powers: readonly number[] = [],
  mods: readonly PerkMods[] = [],
): RaidState {
  const rng = createRng(layout.seed ^ 0x5bd1e995);
  let nextId = 1;
  const heroes = kinds.map((kind, i): RaidHero => {
    const spec = HEROES[kind];
    const offset = (i - (kinds.length - 1) / 2) * 2.2;
    const power = powers[i] ?? 1;
    const perks = mods[i] ?? NO_PERKS;
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
      superCharge: 0,
      sprintTime: 0,
      ramTime: 0,
      ramDir: vec(0, -1),
      autoFireTime: 0,
      autoDir: vec(0, -1),
      autoDistance: 0,
      targetId: null,
    };
  });
  const buildings = layout.buildings.map((b): RaidBuilding => {
    const spec = BUILDINGS[b.type];
    const level = b.level ?? 1;
    const power = buildingPower(level);
    return {
      id: nextId++,
      type: b.type,
      level,
      power,
      pos: { ...b.pos },
      radius: spec.radius,
      hp: spec.hp * power,
      maxHp: spec.hp * power,
      destroyed: false,
      reload: spec.attack ? rng() * spec.attack.reload : 0,
      aim: Math.PI / 2,
      firing: false,
    };
  });
  const obstacles = layout.obstacles.map(
    (o): Obstacle => ({ ...o, id: nextId++, pos: { ...o.pos }, time: null }),
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
    boat: { pos: { ...layout.boat }, exit: { ...layout.boatExit }, occupant: null },
    energy: START_ENERGY,
    abilityUses: { artillery: 0, barrage: 0, heal: 0 },
    events: [],
    nextId,
    rng,
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
  state.heroes.forEach((hero, i) => {
    updateHero(state, hero, inputs[i] ?? IDLE_INPUT, dt);
  });
  updateBuildings(state, dt);
  updateCrewTurrets(state, dt);
  updateProjectiles(state, dt);
  updateMines(state, dt);
  updateZones(state, dt);
  updateObstacles(state, dt);
  if (state.status === "playing") {
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

export function canBoard(state: RaidState, hero: RaidHero): boolean {
  return (
    hero.alive &&
    !hero.inBoat &&
    state.boat.occupant === null &&
    distance(hero.pos, state.boat.pos) <= BOARD_DISTANCE
  );
}

export function nextAbilityCost(state: RaidState, ability: Ability): number {
  return abilityCost(ability, state.abilityUses[ability]);
}

export function isInSmoke(state: RaidState, pos: Vec2): boolean {
  return state.zones.some((z) => z.kind === "smoke" && distance(z.pos, pos) <= z.radius);
}

// ---------------------------------------------------------------------------------------------
// Heroes

function updateHero(state: RaidState, hero: RaidHero, input: HeroInput, dt: number): void {
  if (!hero.alive) return;
  hero.reload = Math.max(0, hero.reload - dt);
  hero.sprintTime = Math.max(0, hero.sprintTime - dt);
  hero.autoFireTime = Math.max(0, hero.autoFireTime - dt);

  if (input.toggleBoat) toggleBoat(state, hero);
  if (hero.inBoat) {
    hero.moving = false;
    hero.firing = false;
    hero.burstLeft = 0;
    hero.spin = 0;
    hero.targetId = null;
    if (input.boatAbility) fireAbility(state, input.boatAbility.ability, input.boatAbility.target);
    return;
  }

  const spec = HEROES[hero.kind];
  if (input.useSuper && hero.superCharge >= 1) activateSuper(state, hero);

  if (hero.ramTime > 0) {
    updateRam(state, hero, dt);
  } else {
    const move = length(input.move) > 1 ? normalize(input.move) : input.move;
    const slowed = hero.firing || input.aimPreview !== null;
    const speed =
      spec.speed *
      hero.mods.speed *
      (hero.sprintTime > 0 ? SPRINT.speed : 1) *
      (slowed ? SHOOTING_SPEED : 1);
    hero.moving = length(move) > 0.05;
    if (hero.moving) moveHero(state, hero, scale(move, speed * dt));
  }

  // Locking on: let go of a drag to lock onto the building in that direction, or tap to lock
  // onto the nearest tower (tapping the same one again stops).
  if (input.lockAt && length(input.lockAt) > 0.05) {
    const target = lockCandidate(state, hero, input.lockAt);
    hero.targetId = target?.id ?? null;
    if (!target) {
      // Nothing there: a quick volley in that direction.
      hero.autoDir = normalize(input.lockAt);
      hero.autoDistance = clamp(length(input.lockAt), 0.3, 1) * heroRange(hero);
      hero.autoFireTime = AUTO_FIRE_SECONDS;
    }
  } else if (input.autoAim) {
    const target = lockCandidate(state, hero, null);
    hero.targetId = target && target.id !== hero.targetId ? target.id : null;
    hero.autoFireTime = 0;
  }

  let dir: Vec2 | null = null;
  let aimDistance = heroRange(hero);
  const aim = input.aim;
  const locked = hero.targetId === null ? null : lockedBuilding(state, hero);
  if (hero.targetId !== null && !locked) hero.targetId = null;
  if (aim && length(aim) > 0.15) {
    dir = normalize(aim);
    aimDistance = clamp(length(aim), 0, 1) * heroRange(hero);
    hero.autoFireTime = 0;
  } else if (locked) {
    dir = normalize(sub(locked.pos, hero.pos));
    aimDistance = distance(locked.pos, hero.pos);
  } else if (hero.autoFireTime > 0) {
    dir = hero.autoDir;
    aimDistance = hero.autoDistance;
  }

  if (dir) hero.facing = angleOf(dir);
  else if (hero.moving) hero.facing = angleOf(input.move);

  updateAttack(state, hero, dir, aimDistance, dt);
}

function moveHero(state: RaidState, hero: RaidHero, delta: Vec2): void {
  const r = HEROES[hero.kind].radius;
  let next = add(hero.pos, delta);
  if (!isOnLand(next.x, next.y, r)) {
    // Slide along the shoreline instead of stopping dead.
    const alongX = vec(next.x, hero.pos.y);
    const alongY = vec(hero.pos.x, next.y);
    if (isOnLand(alongX.x, alongX.y, r)) next = alongX;
    else if (isOnLand(alongY.x, alongY.y, r)) next = alongY;
    else next = { ...hero.pos };
  }
  for (let pass = 0; pass < 2; pass++) {
    for (const b of state.buildings) if (!b.destroyed) next = pushOut(next, r, b.pos, b.radius);
    for (const o of state.obstacles) next = pushOut(next, r, o.pos, o.radius);
    for (const t of state.turrets) next = pushOut(next, r, t.pos, CREW_TURRET.radius);
  }
  if (isOnLand(next.x, next.y, r * 0.5)) hero.pos = next;
}

function pushOut(pos: Vec2, radius: number, center: Vec2, otherRadius: number): Vec2 {
  const d = distance(pos, center);
  const min = radius + otherRadius;
  if (d >= min) return pos;
  if (d < 1e-6) return add(center, vec(min, 0));
  return add(center, scale(normalize(sub(pos, center)), min));
}

function updateAttack(
  state: RaidState,
  hero: RaidHero,
  dir: Vec2 | null,
  aimDistance: number,
  dt: number,
) {
  const atk = HEROES[hero.kind].attack;
  hero.firing = dir !== null;
  switch (atk.kind) {
    case "burst": {
      if (hero.burstLeft > 0) {
        hero.firing = true;
        hero.burstTimer -= dt;
        if (hero.burstTimer <= 0) {
          const stray = (state.rng() - 0.5) * 2 * shotSpread(hero.kind);
          spawnDirect(
            state,
            hero,
            "bullet",
            fromAngle(angleOf(hero.burstDir) + stray),
            atk.speed,
            atk.range + hero.mods.range,
            atk.damage * hero.power,
            0,
            1,
          );
          hero.burstLeft--;
          hero.burstTimer = atk.interval;
          if (hero.burstLeft === 0) hero.reload = atk.reload * hero.mods.reload;
        }
      } else if (dir && hero.reload <= 0) {
        hero.burstLeft = atk.shots + hero.mods.shots;
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
      hero.spin = Math.min(1, hero.spin + dt / atk.spinUp);
      if (hero.reload <= 0) {
        const spread = (state.rng() - 0.5) * 2 * atk.spread;
        const shotDir = fromAngle(angleOf(dir) + spread);
        spawnDirect(
          state,
          hero,
          "bullet",
          shotDir,
          atk.speed,
          atk.range + hero.mods.range,
          atk.damage * hero.power,
          0,
          1,
        );
        hero.reload = lerp(atk.slowInterval, atk.fastInterval, hero.spin) * hero.mods.reload;
      }
      return;
    }
    case "shell": {
      if (dir && hero.reload <= 0) {
        const kind = hero.kind === "bazooka" ? "rocket" : atk.splash > 0 ? "shell" : "bullet";
        spawnDirect(
          state,
          hero,
          kind,
          dir,
          atk.speed,
          atk.range + hero.mods.range,
          atk.damage * hero.power,
          atk.splash,
          atk.buildingBonus,
        );
        hero.reload = atk.reload * hero.mods.reload;
      }
      return;
    }
    case "lob": {
      if (dir && hero.reload <= 0) {
        const reach = clamp(aimDistance, 3, atk.range + hero.mods.range);
        const to = add(hero.pos, scale(dir, reach));
        const duration = atk.flightTime * (0.55 + (0.45 * reach) / (atk.range + hero.mods.range));
        spawnLob(
          state,
          "grenade",
          "crew",
          hero.id,
          hero.pos,
          to,
          duration,
          3 + reach * 0.25,
          atk.damage * hero.power,
          atk.splash,
        );
        hero.reload = atk.reload * hero.mods.reload;
      }
      return;
    }
    case "spray": {
      if (dir && hero.reload <= 0) {
        sprayTick(
          state,
          hero,
          dir,
          atk.range + hero.mods.range,
          atk.damage * hero.power,
          atk.heal,
          atk.coneHalfAngle,
        );
        hero.reload = atk.reload * hero.mods.reload;
      }
      return;
    }
  }
}

function sprayTick(
  state: RaidState,
  medic: RaidHero,
  dir: Vec2,
  range: number,
  damage: number,
  heal: number,
  halfAngle: number,
): void {
  const facing = angleOf(dir);
  const inCone = (pos: Vec2, extra: number) => {
    const d = distance(pos, medic.pos);
    return (
      d <= range + extra &&
      (d < 0.5 || Math.abs(angleDiff(angleOf(sub(pos, medic.pos)), facing)) <= halfAngle)
    );
  };
  let healed = 0;
  for (const h of state.heroes) {
    if (h === medic || !h.alive || h.inBoat || !inCone(h.pos, 0)) continue;
    healed += healHero(state, h, heal);
  }
  // A little self-heal, so a medic playing solo isn't helpless.
  healed += healHero(state, medic, heal * 0.2);
  medic.superCharge = Math.min(
    1,
    medic.superCharge + (healed * medic.mods.superRate) / HEROES.medic.superCharge,
  );
  for (const b of state.buildings) {
    if (!b.destroyed && inCone(b.pos, b.radius)) damageBuilding(state, b, damage, medic.id);
  }
}

function activateSuper(state: RaidState, hero: RaidHero): void {
  const spec = HEROES[hero.kind];
  hero.superCharge = 0;
  const forward = fromAngle(hero.facing);
  state.events.push({ type: "super", heroId: hero.id, super: spec.super, pos: { ...hero.pos } });
  switch (spec.super) {
    case "sprint":
      hero.sprintTime = SPRINT.seconds;
      return;
    case "ram":
      hero.ramTime = RAM.seconds;
      hero.ramDir = forward;
      return;
    case "sandbags": {
      const center = add(hero.pos, scale(forward, SANDBAGS.distance + spec.radius));
      const along = vec(-forward.y, forward.x);
      for (const offset of [-1.5, -0.5, 0.5, 1.5]) {
        const pos = add(center, scale(along, offset * SANDBAGS.spacing));
        if (!isOnLand(pos.x, pos.y, 0.5)) continue;
        state.obstacles.push({
          id: state.nextId++,
          kind: "sandbag",
          pos,
          radius: SANDBAGS.radius,
          blocksShots: true,
          scale: 1,
          rotation: angleOf(along),
          time: SANDBAGS.seconds,
        });
      }
      return;
    }
    case "volley": {
      const atk = spec.attack;
      if (atk.kind !== "shell") return;
      for (const spread of [-VOLLEY_SPREAD, 0, VOLLEY_SPREAD]) {
        const dir = fromAngle(hero.facing + spread);
        spawnDirect(
          state,
          hero,
          "rocket",
          dir,
          atk.speed,
          atk.range,
          atk.damage * hero.power,
          atk.splash,
          atk.buildingBonus,
        );
      }
      return;
    }
    case "smoke":
      state.zones.push({
        id: state.nextId++,
        kind: "smoke",
        pos: { ...hero.pos },
        radius: SMOKE.radius,
        time: SMOKE.seconds,
        healPerSecond: 0,
      });
      return;
    case "healZone":
      state.zones.push({
        id: state.nextId++,
        kind: "heal",
        pos: { ...hero.pos },
        radius: HEAL_ZONE.radius,
        time: HEAL_ZONE.seconds,
        healPerSecond: HEAL_ZONE.healPerSecond,
      });
      return;
    case "turret": {
      const pos = add(hero.pos, scale(forward, 1.8));
      state.turrets.push({
        id: state.nextId++,
        ownerId: hero.id,
        pos: isOnLand(pos.x, pos.y, 0.5) ? pos : { ...hero.pos },
        hp: CREW_TURRET.hp,
        maxHp: CREW_TURRET.hp,
        time: CREW_TURRET.seconds,
        reload: 0,
        aim: hero.facing,
      });
      return;
    }
  }
}

function updateRam(state: RaidState, hero: RaidHero, dt: number): void {
  hero.ramTime = Math.max(0, hero.ramTime - dt);
  hero.moving = true;
  hero.facing = angleOf(hero.ramDir);
  const r = HEROES[hero.kind].radius;
  const next = add(hero.pos, scale(hero.ramDir, RAM.speed * dt));
  for (const b of state.buildings) {
    if (!b.destroyed && distance(next, b.pos) < r + b.radius + 0.2) {
      damageBuilding(state, b, RAM.damage, hero.id);
      state.events.push({
        type: "explosion",
        pos: add(hero.pos, scale(hero.ramDir, r)),
        radius: 1.5,
      });
      hero.ramTime = 0;
      return;
    }
  }
  moveHero(state, hero, sub(next, hero.pos));
}

function healHero(state: RaidState, hero: RaidHero, amount: number): number {
  if (!hero.alive || hero.inBoat || hero.hp >= hero.maxHp) return 0;
  const healed = Math.min(amount, hero.maxHp - hero.hp);
  hero.hp += healed;
  if (healed > 0 && state.rng() < 0.15) state.events.push({ type: "heal", pos: { ...hero.pos } });
  return healed;
}

function damageHero(state: RaidState, hero: RaidHero, amount: number, heavyBonus = 1): void {
  if (!hero.alive || hero.inBoat) return;
  const spec = HEROES[hero.kind];
  const taken =
    amount * (spec.heavy ? heavyBonus : 1) * (hero.sprintTime > 0 ? SPRINT.damageTaken : 1);
  hero.hp -= taken;
  state.events.push({ type: "hit", pos: { ...hero.pos } });
  if (hero.hp <= 0) {
    hero.hp = 0;
    hero.alive = false;
    hero.firing = false;
    hero.moving = false;
    state.events.push({ type: "heroDown", id: hero.id, pos: { ...hero.pos } });
  }
}

// ---------------------------------------------------------------------------------------------
// The gunboat

function toggleBoat(state: RaidState, hero: RaidHero): void {
  if (hero.inBoat) {
    hero.inBoat = false;
    state.boat.occupant = null;
    hero.pos = { ...state.boat.exit };
    state.events.push({ type: "leftBoat", heroId: hero.id });
  } else if (canBoard(state, hero)) {
    hero.inBoat = true;
    state.boat.occupant = hero.id;
    hero.ramTime = 0;
    state.events.push({ type: "boarded", heroId: hero.id });
  }
}

function fireAbility(state: RaidState, ability: Ability, target: Vec2): void {
  const cost = nextAbilityCost(state, ability);
  if (state.energy < cost) return;
  state.energy -= cost;
  state.abilityUses[ability]++;
  state.events.push({ type: "boatFire", ability, target: { ...target } });
  const from = state.boat.pos;
  const flight = boatShellFlightTime(distance(from, target));
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
        ARTILLERY.damage,
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
          BARRAGE.damage,
          BARRAGE.splash,
        );
        lob.t = -i * BARRAGE.stagger;
      }
      return;
    case "heal":
      state.zones.push({
        id: state.nextId++,
        kind: "heal",
        pos: { ...target },
        radius: HEAL.radius,
        time: HEAL.duration,
        healPerSecond: HEAL.healPerSecond,
      });
      return;
  }
}

// ---------------------------------------------------------------------------------------------
// Enemy defenses and the Engineer's turret

interface Target {
  pos: Vec2;
  hero: RaidHero | null;
  turret: CrewTurret | null;
}

function findTarget(state: RaidState, from: Vec2, range: number, minRange: number): Target | null {
  let best: Target | null = null;
  let bestDistance = Infinity;
  for (const hero of state.heroes) {
    if (!hero.alive || hero.inBoat || isInSmoke(state, hero.pos)) continue;
    const d = distance(from, hero.pos);
    if (d < minRange || d > range + HEROES[hero.kind].radius || d >= bestDistance) continue;
    best = { pos: hero.pos, hero, turret: null };
    bestDistance = d;
  }
  for (const turret of state.turrets) {
    const d = distance(from, turret.pos);
    if (d < minRange || d > range || d >= bestDistance) continue;
    best = { pos: turret.pos, hero: null, turret };
    bestDistance = d;
  }
  return best;
}

function updateBuildings(state: RaidState, dt: number): void {
  for (const b of state.buildings) {
    b.firing = false;
    const atk = BUILDINGS[b.type].attack;
    if (b.destroyed || !atk) continue;
    b.reload = Math.max(0, b.reload - dt);
    const minRange = atk.kind === "mortar" ? atk.minRange : 0;
    const target = findTarget(state, b.pos, atk.range, minRange);
    if (!target) continue;
    const toTarget = sub(target.pos, b.pos);
    b.aim = angleOf(toTarget);
    const dir = normalize(toTarget);
    const muzzle = add(b.pos, scale(dir, b.radius * 0.7));
    if (atk.kind === "flame") {
      b.firing = true;
      if (b.reload > 0) continue;
      b.reload = atk.reload;
      for (const hero of state.heroes) {
        if (!hero.alive || hero.inBoat) continue;
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
    const target = nearestBuilding(state, t.pos, CREW_TURRET.range);
    if (!target) continue;
    const dir = normalize(sub(target.pos, t.pos));
    t.aim = angleOf(dir);
    if (t.reload > 0) continue;
    t.reload = CREW_TURRET.reload;
    const p = makeProjectile(state, "bullet", "crew", t.ownerId, add(t.pos, scale(dir, 0.6)));
    p.vel = scale(dir, CREW_TURRET.speed);
    p.damage = CREW_TURRET.damage;
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
  return HEROES[hero.kind].attack.range + hero.mods.range;
}

/** The locked target, if it still stands and is in range. */
function lockedBuilding(state: RaidState, hero: RaidHero): RaidBuilding | null {
  const b = state.buildings.find((x) => x.id === hero.targetId);
  if (!b || b.destroyed) return null;
  const reach = heroRange(hero) + 0.5;
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
  const range = heroRange(hero);
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
  if (b.destroyed || state.status !== "playing") return;
  const dealt = Math.min(b.hp, amount);
  b.hp -= amount;
  const owner = state.heroes.find((h) => h.id === ownerId);
  if (owner) {
    owner.superCharge = Math.min(
      1,
      owner.superCharge + (dealt * owner.mods.superRate) / HEROES[owner.kind].superCharge,
    );
  }
  if (b.hp > 0) return;
  b.hp = 0;
  b.destroyed = true;
  b.firing = false;
  state.energy += BUILDINGS[b.type].energy;
  state.events.push({ type: "destroyed", id: b.id, pos: { ...b.pos }, buildingType: b.type });
  if (b.type === "headquarters") state.status = "won";
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
): void {
  const start = add(hero.pos, scale(dir, HEROES[hero.kind].radius + 0.3));
  const p = makeProjectile(state, kind, "crew", hero.id, start);
  p.vel = scale(dir, speed);
  p.damage = damage;
  p.splash = splash;
  p.buildingBonus = buildingBonus;
  p.maxDistance = range;
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
): Lob {
  const p = makeProjectile(state, kind, team, ownerId, from);
  const lob: Lob = { from: { ...from }, to: { ...to }, t: 0, duration, peak };
  p.lob = lob;
  p.damage = damage;
  p.splash = splash;
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

function updateProjectiles(state: RaidState, dt: number): void {
  // Hits and explosions never spawn new projectiles, so filtering in one pass is safe.
  state.projectiles = state.projectiles.filter((p) => stepProjectile(state, p, dt));
}

/** Moves one projectile; returns false once it has hit something or run out of range. */
function stepProjectile(state: RaidState, p: Projectile, dt: number): boolean {
  if (p.lob) {
    p.lob.t += dt;
    const t = clamp(p.lob.t / p.lob.duration, 0, 1);
    p.pos = vec(lerp(p.lob.from.x, p.lob.to.x, t), lerp(p.lob.from.y, p.lob.to.y, t));
    if (p.lob.t < p.lob.duration) return true;
    explode(state, p.lob.to, p.splash, p.damage, p.team, p.ownerId, p.buildingBonus, p.heavyBonus);
    return false;
  }

  const step = scale(p.vel, dt);
  p.pos = add(p.pos, step);
  p.traveled += length(step);

  for (const o of state.obstacles) {
    if (o.blocksShots && distance(p.pos, o.pos) <= o.radius) return impact(state, p);
  }
  if (p.team === "crew") {
    for (const b of state.buildings) {
      if (b.destroyed || distance(p.pos, b.pos) > b.radius) continue;
      if (p.splash > 0) return impact(state, p);
      damageBuilding(state, b, p.damage * p.buildingBonus, p.ownerId);
      state.events.push({ type: "hit", pos: { ...p.pos } });
      return false;
    }
  } else {
    for (const hero of state.heroes) {
      if (!hero.alive || hero.inBoat || distance(p.pos, hero.pos) > HEROES[hero.kind].radius)
        continue;
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
    if (p.splash > 0)
      explode(state, p.pos, p.splash, p.damage, p.team, p.ownerId, p.buildingBonus, p.heavyBonus);
    return false;
  }
  return true;
}

function impact(state: RaidState, p: Projectile): boolean {
  if (p.splash > 0)
    explode(state, p.pos, p.splash, p.damage, p.team, p.ownerId, p.buildingBonus, p.heavyBonus);
  else state.events.push({ type: "hit", pos: { ...p.pos } });
  return false;
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
  if (team === "crew") {
    for (const b of state.buildings) {
      if (!b.destroyed && distance(pos, b.pos) - b.radius <= radius) {
        damageBuilding(state, b, damage * buildingBonus, ownerId);
      }
    }
  } else {
    for (const hero of state.heroes) {
      if (distance(pos, hero.pos) <= radius + HEROES[hero.kind].radius)
        damageHero(state, hero, damage, heavyBonus);
    }
    for (const t of state.turrets) {
      if (distance(pos, t.pos) <= radius) t.hp -= damage;
    }
  }
  // Any blast sets off hidden mines it reaches; that's how a Grenadier clears a beach.
  for (const mine of state.mines) {
    if (!mine.exploded && mine.fuse === null && distance(pos, mine.pos) <= radius + 0.5)
      mine.fuse = 0.15;
  }
}

// ---------------------------------------------------------------------------------------------
// Mines, zones and temporary obstacles

function updateMines(state: RaidState, dt: number): void {
  for (const mine of state.mines) {
    if (mine.exploded) continue;
    if (mine.fuse === null) {
      const stepped = state.heroes.some(
        (h) => h.alive && !h.inBoat && distance(h.pos, mine.pos) <= MINE_TRIGGER_RADIUS,
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
    if (zone.kind !== "heal") continue;
    for (const hero of state.heroes) {
      if (distance(hero.pos, zone.pos) <= zone.radius)
        healHero(state, hero, zone.healPerSecond * dt);
    }
  }
  state.zones = state.zones.filter((z) => z.time > 0);
}

function updateObstacles(state: RaidState, dt: number): void {
  let expired = false;
  for (const o of state.obstacles) {
    if (o.time === null) continue;
    o.time -= dt;
    if (o.time <= 0) expired = true;
  }
  if (expired) state.obstacles = state.obstacles.filter((o) => o.time === null || o.time > 0);
}
