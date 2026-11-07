// A defense with nothing to shoot keeps watch: it turns its head along the shore, pauses, and turns
// again, mostly back towards the beach, the way a sentry looks for something. Only for show: the
// raid's rules never see it. The moment it has a target it swings round to it, quickly.

/** How far either side of the beach it looks, in radians, and how often it looks straight out. */
const WATCH_ARC = 1.2;
const BEACH_SHARE = 0.4;
/** How fast it turns while watching, and onto a target, in radians a second. */
const WATCH_TURN = 1.1;
const AIM_TURN = 9;
/** How long it holds each look, in seconds, least and most. */
const PAUSE = [1.4, 3.4] as const;
/** After a fight, it keeps looking where it last aimed this long before it watches again. */
const AFTER_FIGHT = 1.5;

const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));

export class Lookout {
  /** The head's turn, with 0 straight out towards the beach. */
  angle: number;
  private goal: number;
  private nextLook: number;

  constructor(start = 0) {
    this.angle = start;
    this.goal = start;
    this.nextLook = Math.random() * PAUSE[1];
  }

  /** Turns the head on; \`aim\` is the target's bearing in the head's own terms, or null for none. */
  update(time: number, dt: number, aim: number | null): number {
    if (aim !== null) {
      this.goal = aim;
      this.nextLook = time + AFTER_FIGHT;
      return this.turn(dt, AIM_TURN);
    }
    if (time >= this.nextLook) {
      this.goal = Math.random() < BEACH_SHARE ? 0 : (Math.random() * 2 - 1) * WATCH_ARC;
      const swing = Math.abs(wrap(this.goal - this.angle)) / WATCH_TURN;
      this.nextLook = time + swing + PAUSE[0] + Math.random() * (PAUSE[1] - PAUSE[0]);
    }
    return this.turn(dt, WATCH_TURN);
  }

  private turn(dt: number, speed: number): number {
    const gap = wrap(this.goal - this.angle);
    const step = Math.min(Math.abs(gap), speed * dt);
    // Eases into the end of a turn, so it settles rather than stopping dead.
    const eased = Math.abs(gap) < 0.25 ? step * Math.max(0.35, Math.abs(gap) / 0.25) : step;
    this.angle = wrap(this.angle + Math.sign(gap) * eased);
    return this.angle;
  }
}
