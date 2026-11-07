// The AI raiders who land on the crew's island at night. Each one sticks near the leader (hero 0),
// picks fights close to them, shoots around cover and keeps a medic on whoever is hurt. Once the
// leader is down, the rest keep pushing on their own. Raiders off a raider ship fight smarter: they
// strafe a defense rather than stand in front of it, go for whatever pays the gunboat's energy while
// they're short of it, and one of them works the gunboat's radio, stunning a nest of defenses and
// then shelling it, or dropping a medkit on hurt raiders bunched together.

import { BUILDINGS } from "./buildings";
import { type Ability, HEAL, SHOCK } from "./gunboat";
import { HEROES } from "./heroes";
import {
  type HeroInput,
  IDLE_INPUT,
  nextAbilityCost,
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

/** Where each squadmate stands relative to the leader when nothing is in reach (behind, fanned). */
const SLOTS: readonly Vec2[] = [vec(-2.6, 2.4), vec(2.6, 2.4), vec(0, 3.8), vec(-4, 4.2)];

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
  const gap = distance(hero.pos, target.pos) - target.radius;
  const reach = HEROES[hero.kind].attack.range;
  const inOut = gap < reach * STRAFE_NEAR ? -0.6 : gap > reach * STRAFE_FAR ? 0.6 : 0;
  return normalize(add(across, scaleVec(to, inOut)));
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
  const saved = tactics.bombards ? BOMBARD_SAVINGS : 0;
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

  // The radio: on to the gunboat when there's something worth firing, and off again after.
  if (state.tactics && hero === radioman(state)) {
    const order = boatOrder(state);
    if (hero.inBoat) {
      const waiting = state.projectiles.some((p) => p.kind === "artillery" && p.team === "crew");
      if (order) return { ...IDLE_INPUT, boatAbility: order };
      if (!waiting) return { ...IDLE_INPUT, toggleBoat: true };
      return IDLE_INPUT;
    }
    if (order) return { ...IDLE_INPUT, toggleBoat: true };
  }
  const anchor = leader && leader !== hero && leader.alive ? leader.pos : null;

  // Too far behind: catch up before anything else.
  if (anchor && distance(hero.pos, anchor) > LEASH)
    return { ...IDLE_INPUT, move: steer(state, hero, anchor) };

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
    if (gap > reach) return { ...IDLE_INPUT, move: steer(state, hero, target.pos) };
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
    return hq ? { ...IDLE_INPUT, move: steer(state, hero, hq.pos) } : IDLE_INPUT;
  }
  const facing = leader.moving ? leader.facing : -Math.PI / 2;
  const slot = SLOTS[(index - 1) % SLOTS.length] ?? vec(0, 3);
  // Rotate the slot so "behind" follows the leader's heading (slots are written facing north).
  const forward = fromAngle(facing);
  const right = vec(-forward.y, forward.x);
  const spot = add(anchor, add(scaleVec(right, slot.x), scaleVec(forward, -slot.y)));
  if (distance(hero.pos, spot) < 1.2)
    return { ...IDLE_INPUT, move: scaleVec(spacing(state, hero), 0.5) };
  const urgency = clamp(distance(hero.pos, spot) / 4, 0.4, 1);
  return { ...IDLE_INPUT, move: scaleVec(steer(state, hero, spot), urgency) };
}
