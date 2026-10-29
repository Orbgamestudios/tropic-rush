// Pure game rules: no Phaser imports, so they can be unit tested in milliseconds.

export const ROUND_MS = 30_000;

/** Extra touch slop around targets; fingers are far less precise than mouse pointers. */
export const TOUCH_FORGIVENESS = 1.25;

export interface RoundState {
  timeLeftMs: number;
  score: number;
  streak: number;
  over: boolean;
}

export function newRound(durationMs = ROUND_MS): RoundState {
  return { timeLeftMs: durationMs, score: 0, streak: 0, over: false };
}

export function tick(state: RoundState, deltaMs: number): RoundState {
  if (state.over) return state;
  const timeLeftMs = Math.max(0, state.timeLeftMs - deltaMs);
  return { ...state, timeLeftMs, over: timeLeftMs === 0 };
}

/** Every 5 hits in a row is worth one more point per hit. */
export function pointsFor(streak: number): number {
  return 1 + Math.floor(streak / 5);
}

export function hit(state: RoundState): RoundState {
  if (state.over) return state;
  const streak = state.streak + 1;
  return { ...state, streak, score: state.score + pointsFor(streak - 1) };
}

export function miss(state: RoundState): RoundState {
  if (state.over) return state;
  return { ...state, streak: 0 };
}

export function isHit(
  pointerX: number,
  pointerY: number,
  targetX: number,
  targetY: number,
  radius: number,
): boolean {
  const reach = radius * TOUCH_FORGIVENESS;
  return (pointerX - targetX) ** 2 + (pointerY - targetY) ** 2 <= reach ** 2;
}
