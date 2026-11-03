// What the sea leaves on a beach comes and goes. Each beach's finds fall into a few lots, each with
// its own turn of the tide, so something changes every few hours and nothing stays much past 12.
// It goes by the clock alone, so it needs no saving, and costs nothing while nobody's looking.

const HOUR = 3_600_000;
/** How long a find stays before the tide takes it. */
const TIDE = 12 * HOUR;
/** A beach's finds come in this many lots, turning one after another. */
export const TIDE_LOTS = 3;

/** Each beach keeps its own hours. */
const beachShift = (seed: number) => ((Math.abs(seed) % 997) / 997) * TIDE;

/** Which tide brought in one lot of a beach's finds, as a number that goes up by 1 each time. */
export function lotTide(seed: number, lot: number, now: number): number {
  return Math.floor((now + beachShift(seed) + (lot * TIDE) / TIDE_LOTS) / TIDE);
}

/** A number that changes whenever anything on a beach does. */
export function tideTurn(seed: number, now: number): number {
  return Math.floor(((now + beachShift(seed)) * TIDE_LOTS) / TIDE);
}
