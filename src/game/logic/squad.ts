// The AI raiders who land on the crew's island at night. Each one sticks near the leader (hero 0),
// picks fights close to them, shoots around cover and keeps a medic on whoever is hurt. Once the
// leader is down, the rest keep pushing on their own. Raiders off a raider ship fight smarter: they
// strafe a defense rather than stand in front of it, go for whatever pays the gunboat's energy while
// they're short of it, and one of them works the gunboat's radio, stunning a nest of defenses and
// then shelling it, or dropping a medkit on hurt raiders bunched together. Since 2026-11-08 they
// also stop shooting to get out of the way of what's coming at them: sidestepping bullets and
// harpoons, running clear of where a mortar shell will land, stepping out of a sniper's sights,
// backing off when badly hurt, and stepping out of the defenses' reach before calling the gunboat.
// Since 2026-11-09, instead of sidestepping each bullet on the spot, they keep moving across a
// defense's line of fire, zigzagging in and circling it at range, and stop only for the moment
// their weapon's ready to fire back.

import { BUILDINGS } from "./buildings";
import { type Ability, HEAL, SHOCK, SMOKE } from "./gunboat";
import { HEROES } from "./heroes";
import {
  type HeroInput,
  IDLE_INPUT,
  nextAbilityCost,
  type Projectile,
  type RaidBuilding,
  type RaidHero,
  type RaidState,
  shocked,
} from "./raid";
import { add, clamp, distance, fromAngle, length, normalize, sub, type Vec2, vec } from "./vec";

/** Squadmates engage buildings within this distance of the leader. */
const ENGAGE_RADIUS = 17;
/** Past this distance from the leader they drop the fight and catch up. */
const LEASH = 20;
/** A medic heals anyone below this share of their health. */
const HURT = 0.75;

/** A strafing raider keeps between these shares of its range from what it's shooting... */
const STRAFE_NEAR = 0.6;
const STRAFE_FAR = 0.9;
/** ...and changes direction about this often, in seconds. */
const STRAFE_TURN = 1.7;
/** Short of this much energy, raiders go for whatever pays it before the defenses. */
const WANT_ENERGY = 6;
/** A crew that bombards holds this much before it spends any on a single shell. */
const BOMBARD_SAVINGS = 12;
/** The gunboat reaches for defenses this close to a raider. */
const BOAT_REACH = 26;
/** Raiders this hurt, two or more within a medkit's circle, get one. */
const BOAT_HEAL_AT = 0.45;

/** A raider sidesteps a direct shot that will pass this close within this many seconds... */
const SHOT_MISS = 0.9;
const SHOT_SEEN = 0.75;
/** ...and runs from a mortar shell landing within its splash this soon. */
const SHELL_SEEN = 1.5;
/** Below this share of their health, a raider backs out of the defenses' reach for a while. */
const BACK_OFF = 0.28;

/**
 * Raiders who weave see a shot coming this many seconds off. A defense fires at where they are, not
 * where they're going, so they keep moving one way across its line of fire for a stretch...
 */
const WEAVE_SEEN = 1;
/** Closer than this to a shot's line counts as square on to it, in meters. */
const SQUARE_ON = 0.3;
const WEAVE_TURN = 3;
/**
 * ...stopping to shoot back between stretches of this long, for a burst no longer than its shots
 * take to reach them, so what it fires at them standing lands after they've moved on.
 */
const WEAVE = 0.55;
const BURST = [0.15, 0.5] as const;
/** Below this share of their health, a raider under fire stops shooting back and just weaves. */
const HOLD_FIRE = 0.5;

/** Where each squadmate stands relative to the leader when nothing is in reach (behind, fanned). */
const SLOTS: readonly Vec2[] = [vec(-2.6, 2.4), vec(2.6, 2.4), vec(0, 3.8), vec(-4, 4.2)];

const dot = (a: Vec2, b: Vec2) => a.x * b.x + a.y * b.y;

function shotBlocked(state: RaidState, from: Vec2, to: Vec2): boolean {
  const d = sub(to, from);
  const len2 = d.x * d.x + d.y * d.y || 1;
  return state.obstacles.some((o) => {
    if (!o.blocksShots) return false;
    const t = clamp(((o.pos.x - from.x) * d.x + (o.pos.y - from.y) * d.y) / len2, 0, 1);
    return distance(o.pos, vec(from.x + d.x * t, from.y + d.y * t)) <= o.radius + 0.15;
  });
}

function pickTarget(state: RaidState, hero: RaidHero, anchor: Vec2 | null): RaidBuilding | null {
  let best: RaidBuilding | null = null;
  let bestScore = Infinity;
  for (const b of state.buildings) {
    if (b.destroyed) continue;
    if (anchor && distance(b.pos, anchor) > ENGAGE_RADIUS + b.radius) continue;
    // Defenses first (they're shooting at us), the HQ last unless it's all that's left. Short of
    // energy, raiders with a gunboat to feed go for what pays it.
    const spec = BUILDINGS[b.type];
    const feed = state.tactics && state.energy < WANT_ENERGY && !spec.attack && spec.energy > 0;
    const weight = feed ? 0.5 : spec.attack ? 0.6 : b.type === "headquarters" ? 1.6 : 1;
    const score = distance(b.pos, hero.pos) * weight;
    if (score < bestScore) {
      best = b;
      bestScore = score;
    }
  }
  return best;
}

/** Pushes squadmates apart so they don't stack on one spot. */
function spacing(state: RaidState, hero: RaidHero): Vec2 {
  let push = vec(0, 0);
  for (const other of state.heroes) {
    if (other === hero || !other.alive) continue;
    const gap = distance(other.pos, hero.pos);
    const room = HEROES[hero.kind].radius + HEROES[other.kind].radius + 0.9;
    if (gap < room && gap > 0.001) push = add(push, normalize(sub(hero.pos, other.pos)));
  }
  return push;
}

function steer(state: RaidState, hero: RaidHero, toward: Vec2): Vec2 {
  const dir = normalize(sub(toward, hero.pos));
  const push = spacing(state, hero);
  return length(push) > 0 ? normalize(add(dir, scaleVec(push, 0.6))) : dir;
}

function scaleVec(a: Vec2, s: number): Vec2 {
  return vec(a.x * s, a.y * s);
}

function aimAt(hero: RaidHero, pos: Vec2): Vec2 {
  const range = HEROES[hero.kind].attack.range;
  const d = sub(pos, hero.pos);
  // The stick's length sets the distance for lobbed shots, so aim exactly at the target.
  return scaleVec(normalize(d), clamp(length(d) / range, 0.3, 1));
}

/** Circles a defense rather than standing in front of it, closing or backing off to keep in range. */
function strafe(state: RaidState, hero: RaidHero, index: number, target: RaidBuilding): Vec2 {
  const to = normalize(sub(target.pos, hero.pos));
  const side = Math.floor(state.time / STRAFE_TURN + index * 0.37) % 2 === 0 ? 1 : -1;
  const across = vec(-to.y * side, to.x * side);
  return normalize(add(across, keepRange(hero, target)));
}

/** In or out, to stay within reach of what they're shooting without walking right up to it. */
function keepRange(hero: RaidHero, target: RaidBuilding): Vec2 {
  const gap = distance(hero.pos, target.pos) - target.radius;
  const reach = HEROES[hero.kind].attack.range;
  const inOut = gap < reach * STRAFE_NEAR ? -0.6 : gap > reach * STRAFE_FAR ? 0.6 : 0;
  return scaleVec(normalize(sub(target.pos, hero.pos)), inOut);
}

/**
 * Which way to step to get out of the way of what's coming, or null if nothing is: across the
 * line of a bullet or harpoon that will pass close, out of where a mortar shell will land, and to
 * one side of a sniper's sights holding on them.
 */
export function dodge(state: RaidState, hero: RaidHero, bullets = true): Vec2 | null {
  const r = HEROES[hero.kind].radius;
  let away = vec(0, 0);
  for (const p of state.projectiles) {
    if (p.team !== "enemy" || (!bullets && !p.lob)) continue;
    if (p.lob) {
      const left = p.lob.duration - p.lob.t;
      if (left > SHELL_SEEN) continue;
      const gap = distance(p.lob.to, hero.pos);
      if (gap > p.splash + r + 0.8) continue;
      // Straight out from where it'll land, harder the nearer the middle.
      const out = gap > 0.01 ? normalize(sub(hero.pos, p.lob.to)) : fromAngle(hero.facing + 1.6);
      away = add(away, scaleVec(out, 2 - gap / (p.splash + r + 0.8)));
      continue;
    }
    const toHero = sub(hero.pos, p.pos);
    const speed2 = dot(p.vel, p.vel);
    const ahead = dot(toHero, p.vel);
    if (speed2 < 1e-6 || ahead <= 0) continue;
    const t = Math.min(SHOT_SEEN, ahead / speed2);
    const closest = add(p.pos, scaleVec(p.vel, t));
    if (distance(closest, hero.pos) > r + SHOT_MISS || t >= SHOT_SEEN) continue;
    // Across the shot's line, to whichever side they're already on.
    const across = normalize(vec(-p.vel.y, p.vel.x));
    const side = dot(sub(hero.pos, closest), across) >= 0 ? 1 : -1;
    away = add(away, scaleVec(across, side));
  }
  for (const b of state.buildings) {
    if (!b.sights || b.destroyed || distance(b.sights, hero.pos) > r + 1.6) continue;
    const line = normalize(sub(hero.pos, b.pos));
    const side = Math.floor(state.time * 0.7 + b.id) % 2 === 0 ? 1 : -1;
    away = add(away, vec(-line.y * side, line.x * side));
  }
  return length(away) > 0.01 ? normalize(add(away, scaleVec(spacing(state, hero), 0.3))) : null;
}

/** The soonest bullet or harpoon on its way to hit this raider, if any. */
function incoming(state: RaidState, hero: RaidHero): Projectile | null {
  const r = HEROES[hero.kind].radius;
  let soonest: Projectile | null = null;
  let first = WEAVE_SEEN;
  for (const p of state.projectiles) {
    if (p.team !== "enemy" || p.lob) continue;
    const speed2 = dot(p.vel, p.vel);
    const ahead = dot(sub(hero.pos, p.pos), p.vel);
    if (speed2 < 1e-6 || ahead <= 0) continue;
    const t = ahead / speed2;
    if (t >= first || distance(add(p.pos, scaleVec(p.vel, t)), hero.pos) > r + SHOT_MISS) continue;
    soonest = p;
    first = t;
  }
  return soonest;
}

/**
 * Across a shot's line, away from it on whichever side they're already on: moving, that's the way
 * they were going, since it was aimed at where they'd been, so they keep circling the defense and
 * never turn back into the shots trailing behind them. Caught square on, standing, they pick a
 * side and hold it a while. `toward` leans it the way they're heading.
 */
function weave(
  state: RaidState,
  hero: RaidHero,
  index: number,
  shot: Projectile,
  toward: Vec2 | null,
): Vec2 {
  const across = normalize(vec(-shot.vel.y, shot.vel.x));
  const offset = dot(sub(hero.pos, shot.pos), across);
  const held = Math.floor((state.time + index * 1.3) / WEAVE_TURN) % 2 === 0 ? 1 : -1;
  const side = Math.abs(offset) > SQUARE_ON ? Math.sign(offset) : held;
  const lean = toward ? scaleVec(toward, 0.6) : vec(0, 0);
  return normalize(add(add(scaleVec(across, side), lean), scaleVec(spacing(state, hero), 0.4)));
}

/**
 * Whether a weaving raider stops to shoot back now: the moment their weapon's ready, for the one
 * shot or burst, then on the move again while it reloads. A minigun has to keep turning to fire at
 * all, so its gunner stops for a burst no longer than the shots coming at them take to arrive.
 */
function shootsBack(state: RaidState, hero: RaidHero, index: number, shot: Projectile): boolean {
  if (HEROES[hero.kind].attack.kind !== "minigun") return hero.reload <= 0 && hero.burstLeft === 0;
  const flight = (shot.traveled + distance(shot.pos, hero.pos)) / Math.max(1, length(shot.vel));
  const burst = clamp(flight * 0.85, BURST[0], BURST[1]);
  return (state.time + index * 0.37) % (WEAVE + burst) < burst;
}

/** The defenses that can reach a spot, with a little to spare. */
function underFire(state: RaidState, pos: Vec2, spare = 1.5): RaidBuilding[] {
  return state.buildings.filter((b) => {
    const attack = BUILDINGS[b.type].attack;
    return (
      !b.destroyed && attack && !shocked(state, b) && distance(b.pos, pos) < attack.range + spare
    );
  });
}

/** Straight away from the nearest of these defenses. */
function awayFrom(hero: RaidHero, threats: readonly RaidBuilding[]): Vec2 {
  const nearest = threats.reduce((a, b) =>
    distance(b.pos, hero.pos) < distance(a.pos, hero.pos) ? b : a,
  );
  return normalize(sub(hero.pos, nearest.pos));
}

/** Who works the gunboat's radio: the last raider standing who isn't the leader or a medic. */
function radioman(state: RaidState): RaidHero | null {
  for (let i = state.heroes.length - 1; i > 0; i--) {
    const h = state.heroes[i];
    if (h?.alive && HEROES[h.kind].attack.kind !== "heal") return h;
  }
  const leader = state.heroes[0];
  return leader?.alive ? leader : null;
}

function middle(points: readonly Vec2[]): Vec2 {
  const sum = points.reduce((a, p) => add(a, p), vec(0, 0));
  return scaleVec(sum, 1 / Math.max(1, points.length));
}

/**
 * What the gunboat should fire now, if anything: a medkit on hurt raiders bunched together, a
 * shock on a nest of defenses the squad is near, a barrage on the nest once it's stunned, or a
 * shell on the toughest defense in reach. One thing in the air at a time.
 */
function boatOrder(state: RaidState): { ability: Ability; target: Vec2 } | null {
  const { tactics } = state;
  if (!tactics) return null;
  if (state.projectiles.some((p) => p.kind === "artillery" && p.team === "crew")) return null;
  const afford = (a: Ability) =>
    (state.gunboat[a] ?? 0) > 0 && state.energy >= nextAbilityCost(state, a);
  const raiders = state.heroes.filter((h) => h.alive);
  const hurt = raiders.filter((h) => h.hp / h.maxHp < BOAT_HEAL_AT);
  if (hurt.length >= 2 && afford("heal") && !state.zones.some((z) => z.kind === "heal")) {
    const spot = middle(hurt.map((h) => h.pos));
    if (hurt.every((h) => distance(h.pos, spot) < HEAL.radius))
      return { ability: "heal", target: spot };
  }
  const threats = state.buildings.filter(
    (b) =>
      !b.destroyed &&
      BUILDINGS[b.type].attack &&
      raiders.some((h) => distance(h.pos, b.pos) < BOAT_REACH),
  );
  if (threats.length === 0) return null;
  // Raiders pinned down and hurting, together: hide them in smoke.
  if (tactics.dodges && afford("smoke") && !state.zones.some((z) => z.kind === "smoke")) {
    const pinned = raiders.filter(
      (h) => h.hp / h.maxHp < 0.6 && underFire(state, h.pos, 0).length >= 2,
    );
    const spot = middle(pinned.map((h) => h.pos));
    if (pinned.length >= 2 && pinned.every((h) => distance(h.pos, spot) < SMOKE.radius * 0.8))
      return { ability: "smoke", target: spot };
  }
  // The densest knot of them, by how many stand within a shock's circle of each.
  let nest: RaidBuilding[] = [];
  for (const b of threats) {
    const near = threats.filter((o) => distance(o.pos, b.pos) <= SHOCK.radius);
    if (near.length > nest.length) nest = near;
  }
  const spot = middle(nest.map((b) => b.pos));
  if (nest.length >= 2) {
    const stunned = nest.every((b) => shocked(state, b));
    if (!stunned && afford("shock")) return { ability: "shock", target: spot };
    if (afford("barrage") && (stunned || !tactics.bombards))
      return { ability: "barrage", target: spot };
  }
  // Those that dodge don't hoard: a shell whenever one's affordable, or a little saved to bombard.
  const saved = tactics.bombards ? (tactics.dodges ? 8 : BOMBARD_SAVINGS) : 0;
  if (!afford("artillery") || state.energy < saved) return null;
  const toughest = threats.reduce((a, b) => (b.hp > a.hp ? b : a));
  return { ability: "artillery", target: toughest.pos };
}

/** The input for raider `index` this step. */
export function squadInput(state: RaidState, index: number): HeroInput {
  const hero = state.heroes[index];
  const leader = state.heroes[0];
  if (!hero || !hero.alive) return IDLE_INPUT;
  const spec = HEROES[hero.kind];

  // Raiders who dodge stop shooting to get out of the way of what's coming, and back off when
  // they're badly hurt, unless a medic is on them.
  // Out of the way first, unless already on the radio.
  // Those who weave take bullets and harpoons in their stride below, and only drop everything for
  // a shell or a sniper.
  const weaves = state.tactics?.weaves === true && !hero.inBoat;
  if (state.tactics?.dodges && !hero.inBoat) {
    const out = dodge(state, hero, !weaves);
    if (out) return { ...IDLE_INPUT, move: out };
    const tended = state.heroes.some(
      (h) => h.alive && h !== hero && HEROES[h.kind].attack.kind === "heal",
    );
    const threats = underFire(state, hero.pos, 0);
    if (hero.hp / hero.maxHp < BACK_OFF && !tended && threats.length > 0)
      return { ...IDLE_INPUT, move: awayFrom(hero, threats) };
  }
  // The radio: on to the gunboat when there's something worth firing, and off again after.
  if (state.tactics && hero === radioman(state)) {
    const order = boatOrder(state);
    if (hero.inBoat) {
      const waiting = state.projectiles.some((p) => p.kind === "artillery" && p.team === "crew");
      if (order) return { ...IDLE_INPUT, boatAbility: order };
      if (!waiting) return { ...IDLE_INPUT, toggleBoat: true };
      return IDLE_INPUT;
    }
    if (order) {
      // On the radio they can't move: get out of the defenses' reach before calling it in.
      const threats = state.tactics.dodges ? underFire(state, hero.pos) : [];
      if (threats.length === 0) return { ...IDLE_INPUT, toggleBoat: true };
      return { ...IDLE_INPUT, move: awayFrom(hero, threats) };
    }
  }
  const anchor = leader && leader !== hero && leader.alive ? leader.pos : null;
  // Under fire, they zigzag wherever they're going, and fight back between stretches of it.
  const shot = weaves ? incoming(state, hero) : null;
  const go = (toward: Vec2): Vec2 => {
    const dir = steer(state, hero, toward);
    return shot ? weave(state, hero, index, shot, dir) : dir;
  };
  const holding =
    shot !== null && !(hero.hp / hero.maxHp > HOLD_FIRE && shootsBack(state, hero, index, shot));

  // Too far behind: catch up before anything else.
  if (anchor && distance(hero.pos, anchor) > LEASH) return { ...IDLE_INPUT, move: go(anchor) };

  // The medic tends to the most hurt teammate in reach.
  if (spec.attack.kind === "heal") {
    let patient: RaidHero | null = null;
    for (const h of state.heroes) {
      if (h === hero || !h.alive || h.hp / h.maxHp >= HURT) continue;
      if (distance(h.pos, hero.pos) > spec.attack.range) continue;
      if (!patient || h.hp / h.maxHp < patient.hp / patient.maxHp) patient = h;
    }
    if (patient) {
      const gap = distance(patient.pos, hero.pos);
      const close = gap < spec.attack.range * 0.7;
      if (shot && (!close || holding)) {
        return {
          ...IDLE_INPUT,
          move: weave(state, hero, index, shot, close ? null : go(patient.pos)),
        };
      }
      return {
        ...IDLE_INPUT,
        move: close ? vec(0, 0) : steer(state, hero, patient.pos),
        aim: close ? aimAt(hero, patient.pos) : null,
      };
    }
  }

  // A medic can't hurt anything: she keeps to whoever else is fighting.
  const target = spec.attack.kind === "heal" ? null : pickTarget(state, hero, anchor);
  if (target) {
    const gap = distance(hero.pos, target.pos) - target.radius;
    const reach = spec.attack.range * 0.85;
    if (shot) {
      // Weaving in, or round it at range, firing back whenever they're ready and it's in reach.
      if (holding || gap > spec.attack.range * 0.95) {
        const lean = gap > reach ? normalize(sub(target.pos, hero.pos)) : keepRange(hero, target);
        return { ...IDLE_INPUT, move: weave(state, hero, index, shot, lean) };
      }
    } else if (gap > reach) return { ...IDLE_INPUT, move: steer(state, hero, target.pos) };
    const lobbed = spec.attack.kind === "lob";
    if (!lobbed && shotBlocked(state, hero.pos, target.pos)) {
      // Side-step around the cover, the way a player would.
      const dir = normalize(sub(target.pos, hero.pos));
      const side = index % 2 ? 1 : -1;
      return { ...IDLE_INPUT, move: vec(-dir.y * side + dir.x * 0.3, dir.x * side + dir.y * 0.3) };
    }
    // Off a raider ship, they keep moving round a defense rather than stand still in its sights.
    const dodging = state.tactics && BUILDINGS[target.type].attack;
    return {
      ...IDLE_INPUT,
      move: dodging ? strafe(state, hero, index, target) : scaleVec(spacing(state, hero), 0.5),
      aim: aimAt(hero, target.pos),
    };
  }

  // Nothing in reach: fall in behind the leader, or head for the HQ once leaderless.
  if (!anchor || !leader) {
    const hq = state.buildings.find((b) => b.type === "headquarters" && !b.destroyed);
    return hq ? { ...IDLE_INPUT, move: go(hq.pos) } : IDLE_INPUT;
  }
  const facing = leader.moving ? leader.facing : -Math.PI / 2;
  const slot = SLOTS[(index - 1) % SLOTS.length] ?? vec(0, 3);
  // Rotate the slot so "behind" follows the leader's heading (slots are written facing north).
  const forward = fromAngle(facing);
  const right = vec(-forward.y, forward.x);
  const spot = add(anchor, add(scaleVec(right, slot.x), scaleVec(forward, -slot.y)));
  if (shot) return { ...IDLE_INPUT, move: go(spot) };
  if (distance(hero.pos, spot) < 1.2)
    return { ...IDLE_INPUT, move: scaleVec(spacing(state, hero), 0.5) };
  const urgency = clamp(distance(hero.pos, spot) / 4, 0.4, 1);
  return { ...IDLE_INPUT, move: scaleVec(steer(state, hero, spot), urgency) };
}
