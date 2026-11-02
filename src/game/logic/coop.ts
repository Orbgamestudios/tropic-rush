// Raiding with crewmates. One phone, the host, runs the rules exactly as it does alone. Everyone
// else sends in their controls and gets snapshots back a dozen times a second, moving their own
// hero straight away and sliding everything else along between snapshots. The only allies on a
// raid are real people like this: there are no AI crewmates. No engine imports.

import type { HeroKind } from "./heroes";
import { heroPower, perkMods } from "./heroProgress";
import type { IslandLayout } from "./island";
import {
  createRaid,
  type HeroInput,
  moveByInput,
  type Projectile,
  type ProjectileKind,
  type RaidEvent,
  type RaidState,
  type Team,
  type Zone,
} from "./raid";
import { distance, lerp, type Vec2 } from "./vec";

export const MAX_SEATS = 5;

/** One player on a raid. */
export interface Seat {
  member: string;
  name: string;
  hero: HeroKind;
  level: number;
}

export function createCoopRaid(layout: IslandLayout, seats: readonly Seat[]): RaidState {
  return createRaid(
    layout,
    seats.map((s) => s.hero),
    seats.map((s) => heroPower(s.level)),
    seats.map((s) => perkMods(s.hero, s.level)),
  );
}

/** Keeps the latest stick positions but never loses a press between two steps. */
export function holdInput(held: HeroInput, next: HeroInput): HeroInput {
  return {
    ...next,
    lockAt: next.lockAt ?? held.lockAt,
    autoAim: held.autoAim || next.autoAim,
    toggleBoat: held.toggleBoat || next.toggleBoat,
    boatAbility: next.boatAbility ?? held.boatAbility,
  };
}

/** What's left of an input once a step has used its one-off presses. */
export function afterStep(input: HeroInput): HeroInput {
  return { ...input, lockAt: null, autoAim: false, toggleBoat: false, boatAbility: null };
}

interface HeroSnap {
  x: number;
  y: number;
  f: number;
  hp: number;
  /** Bit flags: alive, gunboat, moving, firing. */
  s: number;
  spin: number;
  unsteady: number;
  target: number | null;
}

type ProjectileSnap = [
  id: number,
  kind: ProjectileKind,
  team: Team,
  x: number,
  y: number,
  vx: number,
  vy: number,
  splash: number,
  lob:
    | [fromX: number, fromY: number, toX: number, toY: number, t: number, d: number, p: number]
    | null,
];

export interface RaidSnapshot {
  time: number;
  status: RaidState["status"];
  lostReason: RaidState["lostReason"];
  energy: number;
  uses: RaidState["abilityUses"];
  occupant: number | null;
  loot: RaidState["loot"];
  heroes: HeroSnap[];
  /** Defenses aiming or firing, and any building whose health has changed: id, hp, aim, firing. */
  buildings: [number, number, number, number][];
  projectiles: ProjectileSnap[];
  /** Mines by index: fuse (or -1), and 1 once exploded. */
  mines: [number, number, number][];
  zones: Zone[];
  turrets: RaidState["turrets"];
  events: RaidEvent[];
}

function projectileSnap(p: Projectile): ProjectileSnap {
  const { lob } = p;
  return [
    p.id,
    p.kind,
    p.team,
    p.pos.x,
    p.pos.y,
    p.vel.x,
    p.vel.y,
    p.splash,
    lob ? [lob.from.x, lob.from.y, lob.to.x, lob.to.y, lob.t, lob.duration, lob.peak] : null,
  ];
}

/** The host's view of the raid, for the wire. `seen` remembers what's already been sent. */
export function takeSnapshot(
  state: RaidState,
  events: readonly RaidEvent[],
  seen: Map<number, number>,
): RaidSnapshot {
  const buildings: RaidSnapshot["buildings"] = [];
  for (const b of state.buildings) {
    if (seen.get(b.id) === b.hp && !b.firing) continue;
    seen.set(b.id, b.hp);
    buildings.push([b.id, b.hp, b.aim, b.firing ? 1 : 0]);
  }
  const mines: RaidSnapshot["mines"] = [];
  state.mines.forEach((m, i) => {
    if (m.fuse !== null || m.exploded) mines.push([i, m.fuse ?? -1, m.exploded ? 1 : 0]);
  });
  return {
    time: state.time,
    status: state.status,
    lostReason: state.lostReason,
    energy: state.energy,
    uses: state.abilityUses,
    occupant: state.boat.occupant,
    loot: state.loot,
    heroes: state.heroes.map((h) => ({
      x: h.pos.x,
      y: h.pos.y,
      f: h.facing,
      hp: h.hp,
      s: (h.alive ? 1 : 0) | (h.inBoat ? 2 : 0) | (h.moving ? 4 : 0) | (h.firing ? 8 : 0),
      spin: h.spin,
      unsteady: h.unsteady,
      target: h.targetId,
    })),
    buildings,
    projectiles: state.projectiles.map(projectileSnap),
    mines,
    zones: state.zones,
    turrets: state.turrets,
    events: [...events],
  };
}

/** Where heroes were last reported, for a guest's phone to slide them towards. */
export type HeroTargets = (Vec2 & { facing: number })[];

function restoreProjectile(snap: ProjectileSnap): Projectile {
  const [id, kind, team, x, y, vx, vy, splash, lob] = snap;
  return {
    id,
    kind,
    team,
    ownerId: 0,
    pos: { x, y },
    vel: { x: vx, y: vy },
    damage: 0,
    splash,
    buildingBonus: 1,
    heavyBonus: 1,
    traveled: 0,
    maxDistance: 0,
    lob: lob && {
      from: { x: lob[0], y: lob[1] },
      to: { x: lob[2], y: lob[3] },
      t: lob[4],
      duration: lob[5],
      peak: lob[6],
    },
    charges: 0,
  };
}

/** How far from the host's word a guest's own hero can drift before it's put back. */
const SNAP_BACK = 3;

/** Brings a guest's copy of the raid into line with the host's. */
export function applySnapshot(
  state: RaidState,
  snap: RaidSnapshot,
  seat: number,
  targets: HeroTargets,
): void {
  // A guest who's retreated has left, whatever the raid goes on to do.
  if (state.status !== "playing") return;
  state.time = snap.time;
  state.status = snap.status;
  state.lostReason = snap.lostReason;
  state.energy = snap.energy;
  state.abilityUses = snap.uses;
  state.boat.occupant = snap.occupant;
  state.loot = snap.loot;
  snap.heroes.forEach((s, i) => {
    const h = state.heroes[i];
    if (!h) return;
    h.hp = s.hp;
    h.alive = (s.s & 1) !== 0;
    h.inBoat = (s.s & 2) !== 0;
    h.firing = (s.s & 8) !== 0;
    h.spin = s.spin;
    h.unsteady = s.unsteady;
    h.targetId = s.target;
    targets[i] = { x: s.x, y: s.y, facing: s.f };
    if (i === seat) {
      if (distance(h.pos, s) > SNAP_BACK) h.pos = { x: s.x, y: s.y };
      return;
    }
    h.moving = (s.s & 4) !== 0;
  });
  const byId = new Map(state.buildings.map((b) => [b.id, b]));
  for (const [id, hp, aim, firing] of snap.buildings) {
    const b = byId.get(id);
    if (!b) continue;
    b.hp = hp;
    b.aim = aim;
    b.firing = firing !== 0;
    b.destroyed = hp <= 0;
  }
  state.projectiles = snap.projectiles.map(restoreProjectile);
  for (const [i, fuse, exploded] of snap.mines) {
    const m = state.mines[i];
    if (!m) continue;
    m.fuse = fuse < 0 ? null : fuse;
    m.exploded = exploded !== 0;
  }
  state.zones = snap.zones;
  state.turrets = snap.turrets;
}

/** A guest's phone between snapshots: their own hero answers at once, the rest slide along. */
export function predict(
  state: RaidState,
  seat: number,
  input: HeroInput,
  targets: HeroTargets,
  dt: number,
): void {
  state.heroes.forEach((h, i) => {
    const target = targets[i];
    if (i === seat) {
      if (h.alive && !h.inBoat) moveByInput(state, h, input, dt);
      if (target) {
        h.pos.x = lerp(h.pos.x, target.x, Math.min(1, dt * 1.5));
        h.pos.y = lerp(h.pos.y, target.y, Math.min(1, dt * 1.5));
      }
      return;
    }
    if (!target) return;
    const k = Math.min(1, dt * 12);
    h.pos = { x: lerp(h.pos.x, target.x, k), y: lerp(h.pos.y, target.y, k) };
    h.facing = target.facing;
  });
  for (const p of state.projectiles) {
    if (p.lob) {
      p.lob.t += dt;
      const t = Math.max(0, Math.min(1, p.lob.t / p.lob.duration));
      p.pos = { x: lerp(p.lob.from.x, p.lob.to.x, t), y: lerp(p.lob.from.y, p.lob.to.y, t) };
    } else {
      p.pos = { x: p.pos.x + p.vel.x * dt, y: p.pos.y + p.vel.y * dt };
    }
  }
}
