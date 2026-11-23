// The player's crew on a raid of their own (the owner's call, 2026-11-22): the heroes the player has,
// other than the one they play, come ashore with them, played by the phone. They keep with the
// player and fight what the player fights. A heavy (the Heavy, the Tank) goes in ahead to stand
// between the player and the defense they're taking down, so its guns turn on them (a defense shoots
// the nearest hero it can see); the rest cover from as far back as their weapons reach, from the side
// the player's on, where no other defense can reach them. A medic patches up whoever's hurt. Badly
// hurt with no medic about, they fall back out of reach. Each says what they're doing as they start
// it ("Going in!"), a line at a time, never chattering. No engine imports.

import { BUILDINGS } from "./buildings";
import { HERO_KINDS, HEROES, type HeroKind } from "./heroes";
import {
  type HeroInput,
  IDLE_INPUT,
  type RaidBuilding,
  type RaidHero,
  type RaidState,
} from "./raid";
import { aimAt, dodge, SLOTS, shotBlocked, squadInput, steer, underFire } from "./squad";
import { add, clamp, distance, fromAngle, normalize, scale, sub, type Vec2, vec } from "./vec";

/** How many of the crew come along at most. */
export const MOST_BOTS = 3;
/** Who comes first, when there are more than can come: a heavy to draw fire, a medic, then guns. */
const PREFERENCE: readonly HeroKind[] = [
  "heavy",
  "tank",
  "medic",
  "rifleman",
  "bazooka",
  "grenadier",
  "engineer",
  "captain",
];

/** The crew who come along with the player's hero. */
export function pickBots(unlocked: readonly HeroKind[], player: HeroKind): HeroKind[] {
  const order = [...PREFERENCE, ...HERO_KINDS.filter((k) => !PREFERENCE.includes(k))];
  return order.filter((k) => k !== player && unlocked.includes(k)).slice(0, MOST_BOTS);
}

/** What a bot is doing, which they say when they start it. */
type Intent = "follow" | "tank" | "cover" | "heal" | "retreat" | "push";

/** A line said by the hero at this index. */
export interface Callout {
  hero: number;
  text: string;
}

/** What each says as they start something; a heavy's own when they go in. */
const LINES: Record<Exclude<Intent, "follow">, readonly string[]> = {
  tank: ["Going in!", "I'll draw their fire!", "Stay behind me!", "On me, I've got this!"],
  cover: ["I'll cover you!", "Covering!", "Got your back!", "On it!"],
  heal: ["Patching you up!", "Hold still!", "Medic coming!"],
  retreat: ["Falling back!", "I'm hit, pulling back!", "Need a breather!"],
  push: ["Pushing on!", "We'll finish it!", "Keep going!"],
};
const DOWN_LINES = ["Got it!", "That one's down!", "Scratch one!", "Tower down!"];
const REGROUP_LINES = ["With you.", "Right behind you.", "Moving up."];

/** Seconds between one bot's lines, and between anyone's. */
const OWN_GAP = 6;
const ANY_GAP = 2.2;
/** A heavy stands this far into a defense's reach, as a share of it. */
const TANK_DEPTH = 0.55;
/** The rest shoot from this share of their own reach. */
const COVER_REACH = 0.85;
/** How far from the player a bot looks for something to fight, and lets itself be drawn. */
const ENGAGE = 14;
const LEASH = 18;
/** Below this share of their health, with no medic about and under fire, they fall back. */
const FALL_BACK = 0.3;
/** A medic tends anyone below this share of their health. */
const HURT = 0.8;
/** The ways round a target a bot tries, either side of straight from the player, in radians. */
const TURNS = [0, 0.35, -0.35, 0.7, -0.7, 1.1, -1.1];

interface Mind {
  intent: Intent;
  /** The building they're fighting, to notice when it falls. */
  focus: number | null;
  lastSaid: number;
}

export class Bots {
  private readonly minds: Mind[];
  private lastSaid = -99;
  /** What's been said since the last time this was emptied. */
  readonly said: Callout[] = [];

  /** For heroes 1 to `count` of the raid; hero 0 is the player. */
  constructor(count: number) {
    this.minds = Array.from({ length: count }, () => ({
      intent: "follow" as Intent,
      focus: null,
      lastSaid: -99,
    }));
  }

  /** Every bot's input this step, in the heroes' order after the player's. */
  inputs(state: RaidState): HeroInput[] {
    return this.minds.map((mind, i) => this.think(state, i + 1, mind));
  }

  private think(state: RaidState, index: number, mind: Mind): HeroInput {
    const hero = state.heroes[index];
    if (!hero?.alive) return IDLE_INPUT;
    // A target of theirs fell.
    if (mind.focus !== null) {
      const was = state.buildings.find((b) => b.id === mind.focus);
      if (!was || was.destroyed) {
        mind.focus = null;
        this.say(state, index, mind, pick(DOWN_LINES, state.time + index));
      }
    }
    const leader = state.heroes[0];
    // The player down: on with the job, the way the night's raiders do it.
    if (!leader?.alive) {
      this.start(state, index, mind, "push");
      return squadInput(state, index);
    }
    const spec = HEROES[hero.kind];
    // Out from under a shell or a sniper's sights first.
    const out = dodge(state, hero, false);
    if (out) return { ...IDLE_INPUT, move: out };
    const medic = state.heroes.some(
      (h) => h.alive && h !== hero && HEROES[h.kind].attack.kind === "heal",
    );
    const threats = underFire(state, hero.pos, 0);
    if (hero.hp / hero.maxHp < FALL_BACK && !medic && threats.length > 0) {
      this.start(state, index, mind, "retreat");
      return { ...IDLE_INPUT, move: away(hero, threats, leader.pos) };
    }
    if (distance(hero.pos, leader.pos) > LEASH) {
      this.start(state, index, mind, "follow");
      return { ...IDLE_INPUT, move: steer(state, hero, leader.pos) };
    }
    if (spec.attack.kind === "heal") {
      const patient = mostHurt(state, hero);
      if (patient) {
        this.start(state, index, mind, "heal");
        const gap = distance(patient.pos, hero.pos);
        const close = gap < spec.attack.range * 0.7;
        return {
          ...IDLE_INPUT,
          move: close ? vec(0, 0) : steer(state, hero, patient.pos),
          aim: close ? aimAt(hero, patient.pos) : null,
        };
      }
      return this.follow(state, index, mind, hero, leader);
    }
    const target = focusOf(state, leader);
    if (!target) return this.follow(state, index, mind, hero, leader);
    mind.focus = target.id;
    const defense = BUILDINGS[target.type].attack;
    const heavy = spec.heavy && defense !== undefined && defense !== null;
    this.start(state, index, mind, heavy ? "tank" : "cover");
    const spot = heavy
      ? standIn(state, target, leader, hero)
      : standBack(state, target, leader, hero);
    const gap = distance(hero.pos, target.pos) - target.radius;
    const inReach = gap <= spec.attack.range * 0.95;
    const clearShot = spec.attack.kind === "lob" || !shotBlocked(state, hero.pos, target.pos);
    const there = distance(hero.pos, spot) < 1.2;
    return {
      ...IDLE_INPUT,
      move: there ? vec(0, 0) : steer(state, hero, spot),
      // Firing all but stops a hero: they get where they're going first, unless they're there or
      // it's a heavy walking in under fire, who shoots back as they go.
      aim: inReach && clearShot && (there || heavy) ? aimAt(hero, target.pos) : null,
    };
  }

  /** Falls in behind the player, in their place in the fan. */
  private follow(
    state: RaidState,
    index: number,
    mind: Mind,
    hero: RaidHero,
    leader: RaidHero,
  ): HeroInput {
    if (mind.intent !== "follow") {
      const fought = mind.intent === "tank" || mind.intent === "cover";
      mind.intent = "follow";
      if (fought) this.say(state, index, mind, pick(REGROUP_LINES, state.time + index));
    }
    const facing = leader.moving ? leader.facing : -Math.PI / 2;
    const slot = SLOTS[(index - 1) % SLOTS.length] ?? vec(0, 3);
    const forward = fromAngle(facing);
    const right = vec(-forward.y, forward.x);
    const spot = add(leader.pos, add(scale(right, slot.x), scale(forward, -slot.y)));
    if (distance(hero.pos, spot) < 1.2) return IDLE_INPUT;
    const urgency = clamp(distance(hero.pos, spot) / 4, 0.4, 1);
    return { ...IDLE_INPUT, move: scale(steer(state, hero, spot), urgency) };
  }

  /** Starts doing something, saying so if it's new. */
  private start(state: RaidState, index: number, mind: Mind, intent: Intent): void {
    if (mind.intent === intent) return;
    mind.intent = intent;
    if (intent === "follow") return;
    this.say(state, index, mind, pick(LINES[intent], state.time * 7 + index));
  }

  private say(state: RaidState, index: number, mind: Mind, text: string): void {
    if (state.time - mind.lastSaid < OWN_GAP || state.time - this.lastSaid < ANY_GAP) return;
    mind.lastSaid = state.time;
    this.lastSaid = state.time;
    this.said.push({ hero: index, text });
  }
}

function pick(lines: readonly string[], seed: number): string {
  return lines[Math.abs(Math.floor(seed)) % lines.length] ?? lines[0] ?? "";
}

/**
 * What the player's fighting: what they're locked onto; or what they're firing at; or else the
 * nearest defense that can reach them; or else the nearest defense, or anything, near them.
 */
function focusOf(state: RaidState, leader: RaidHero): RaidBuilding | null {
  const standing = state.buildings.filter((b) => !b.destroyed);
  if (leader.targetId !== null) {
    const locked = standing.find((b) => b.id === leader.targetId);
    if (locked) return locked;
  }
  if (leader.firing) {
    const ahead = fromAngle(leader.facing);
    const reach = HEROES[leader.kind].attack.range + 2;
    const shot = nearest(leader.pos, standing, (b) => {
      const to = sub(b.pos, leader.pos);
      const gap = distance(b.pos, leader.pos);
      return gap < reach + b.radius && (to.x * ahead.x + to.y * ahead.y) / gap > 0.9;
    });
    if (shot) return shot;
  }
  const reaching = underFire(state, leader.pos, 1);
  return (
    nearest(leader.pos, reaching, () => true) ??
    nearest(
      leader.pos,
      standing,
      (b) => !!BUILDINGS[b.type].attack && distance(b.pos, leader.pos) < ENGAGE + b.radius,
    ) ??
    nearest(leader.pos, standing, (b) => distance(b.pos, leader.pos) < ENGAGE + b.radius)
  );
}

function nearest(
  from: Vec2,
  buildings: readonly RaidBuilding[],
  allowed: (b: RaidBuilding) => boolean,
): RaidBuilding | null {
  let best: RaidBuilding | null = null;
  for (const b of buildings) {
    if (!allowed(b)) continue;
    if (!best || distance(b.pos, from) < distance(best.pos, from)) best = b;
  }
  return best;
}

/** How many defenses other than `target` reach a spot. */
function exposure(state: RaidState, pos: Vec2, target: RaidBuilding): number {
  return underFire(state, pos, 1).filter((b) => b !== target).length;
}

/** The best of the spots round a target, at a distance, starting straight from the player. */
function bestSpot(state: RaidState, target: RaidBuilding, leader: RaidHero, reach: number): Vec2 {
  const from = normalize(sub(leader.pos, target.pos));
  const base = Math.atan2(from.y, from.x);
  let best = add(target.pos, scale(from, reach));
  let bestScore = Infinity;
  for (const turn of TURNS) {
    const spot = add(target.pos, fromAngle(base + turn, reach));
    const score = exposure(state, spot, target) * 10 + Math.abs(turn);
    if (score < bestScore) {
      best = spot;
      bestScore = score;
    }
  }
  return best;
}

/** A heavy's place: well inside the defense's reach, between it and the player. */
function standIn(state: RaidState, target: RaidBuilding, leader: RaidHero, hero: RaidHero): Vec2 {
  const attack = BUILDINGS[target.type].attack;
  const reach = attack ? attack.range * TANK_DEPTH : HEROES[hero.kind].attack.range * 0.6;
  const near = target.radius + HEROES[hero.kind].radius + 1;
  // Never further out than the player: it's to be the nearest one the defense can see.
  const limit = Math.max(near, distance(leader.pos, target.pos) - 2);
  return bestSpot(state, target, leader, clamp(reach, near, limit));
}

/** Everyone else's: as far back as their weapon reaches, out of any other defense's. */
function standBack(state: RaidState, target: RaidBuilding, leader: RaidHero, hero: RaidHero): Vec2 {
  const reach = HEROES[hero.kind].attack.range * COVER_REACH + target.radius;
  return bestSpot(state, target, leader, reach);
}

/** Away from the defenses reaching them, and back towards the player. */
function away(hero: RaidHero, threats: readonly RaidBuilding[], home: Vec2): Vec2 {
  let out = vec(0, 0);
  for (const b of threats) out = add(out, normalize(sub(hero.pos, b.pos)));
  return normalize(add(normalize(out), scale(normalize(sub(home, hero.pos)), 0.5)));
}

/** The most hurt of the crew, the player included, that a medic should go to. */
function mostHurt(state: RaidState, medic: RaidHero): RaidHero | null {
  let patient: RaidHero | null = null;
  for (const h of state.heroes) {
    if (h === medic || !h.alive || h.hp / h.maxHp >= HURT) continue;
    if (distance(h.pos, medic.pos) > ENGAGE + 6) continue;
    if (!patient || h.hp / h.maxHp < patient.hp / patient.maxHp) patient = h;
  }
  return patient;
}
