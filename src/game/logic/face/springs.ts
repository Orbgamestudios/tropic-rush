// A face eases into a new look rather than snapping to it. Each part of it (a brow's inner end, a
// lid, the corners of the mouth) is a critically damped spring: it gets where it's going as fast as
// it can without overshooting and bouncing, which is how muscles move. How quickly is given as a
// settle time: the seconds to get all but a hundredth of the way.

/** How many of a spring's own time constants it takes to get within a hundredth of its target. */
const SETTLE_CONSTANTS = 6.64;

export interface Spring {
  value: number;
  speed: number;
}

export function spring(value = 0): Spring {
  return { value, speed: 0 };
}

/** The stiffness (in radians a second) that settles in `seconds`. */
export function stiffnessFor(seconds: number): number {
  return SETTLE_CONSTANTS / Math.max(seconds, 1e-3);
}

/**
 * Moves a spring on by `dt` towards `target`, settling in `settle` seconds. Exact for a critically
 * damped spring over any step, so it behaves the same at 30 frames a second as at 120.
 */
export function stepSpring(s: Spring, target: number, settle: number, dt: number): void {
  const w = stiffnessFor(settle);
  const offset = s.value - target;
  const decay = Math.exp(-w * dt);
  const b = s.speed + w * offset;
  s.value = target + (offset + b * dt) * decay;
  s.speed = (s.speed - w * b * dt) * decay;
}

/** A whole set of named springs, stepped together towards a set of targets. */
export class SpringSet<K extends string> {
  private readonly springs = new Map<K, Spring>();

  constructor(keys: readonly K[], start: (key: K) => number = () => 0) {
    for (const key of keys) this.springs.set(key, spring(start(key)));
  }

  get(key: K): number {
    return this.springs.get(key)?.value ?? 0;
  }

  /** Steps every spring towards its target; a key with no target eases back to `rest`. */
  step(targets: Partial<Record<K, number>>, settle: number, dt: number, rest = 0): void {
    for (const [key, s] of this.springs) stepSpring(s, targets[key] ?? rest, settle, dt);
  }

  /** Jumps a spring straight to a value, at rest. */
  set(key: K, value: number): void {
    const s = this.springs.get(key);
    if (s) {
      s.value = value;
      s.speed = 0;
    }
  }
}
